/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { getAnimatorConfig, isNativeForced, isScrollTimeline, mayUseNativeScrollTimeline, PxTimelineEngineExtra, scrollTotalDurationMs, type PxAnimatedSvgDocument, type PxAnimatorCallbacksConfig, type PxAnimatorConfig, type PxPlatformAdapter } from '@pixodesk/svg-animator-core';
import { createFrameLoopAnimator } from './PxAnimatorFrameLoop';
import type { PxAnimatorAPI } from './PxAnimatorWebTypes';
import { createWebApiAnimator } from './PxAnimatorWebApi';
import { applyScrollPin, createNativeScrollTimeline, createScrollDriver } from './PxScrollDriver';

/**
 * Engine construction, shared by the full player and the pre-rendered builds.
 *
 * Everything here operates on a document that is ALREADY in its final shape — no
 * validation, no materialisation, no rendering. `createAnimatorImpl` calls in after it
 * has done those stages; the pre-rendered entries call in directly, because the Editor
 * did them at export time. See PRERENDERED-PLAYER-BUILDS.md.
 */

/**
 * Applies the two `animator` config behaviours that are engine-independent, then hands
 * off to `make` for the actual engine.
 *
 * `resetOnFinish` is composed here so BOTH engines get it: after a NATURAL finish the
 * document snaps back to its start state (same mechanics as the trigger `reset`
 * out-action). The caller's own `onFinish` still fires first. `apiRef` is assigned right
 * after creation — finish always happens asynchronously later.
 */
export function finaliseAnimator(
    animatorConfig: PxAnimatorConfig,
    callbacks: PxAnimatorCallbacksConfig | undefined,
    make: (effectiveCallbacks?: PxAnimatorCallbacksConfig) => PxAnimatorAPI
): PxAnimatorAPI {

    let apiRef: PxAnimatorAPI | undefined;
    let effectiveCallbacks = callbacks;
    if (animatorConfig.resetOnFinish) {
        effectiveCallbacks = {
            ...callbacks,
            onFinish: () => {
                callbacks?.onFinish?.();
                apiRef?.cancel();
            },
        };
    }

    const res = make(effectiveCallbacks);
    apiRef = res;

    if (animatorConfig.debugGlobalName) {
        (window as any)[animatorConfig.debugGlobalName] = res; // Exposing as global variable for debug
    }

    return res;
}

/**
 * Picks the engine the way the full player does, from `timeline.engine`: `player` pins the
 * frame loop; otherwise waapi, with a frames fallback for unsupported attrs unless
 * `native` demands waapi.
 */
export function bindWithEngineChoice(
    doc: PxAnimatedSvgDocument,
    adapter?: PxPlatformAdapter,
    callbacks?: PxAnimatorCallbacksConfig,
    rootElement?: Element | null
): PxAnimatorAPI {
    const animatorConfig = getAnimatorConfig(doc) || {};

    // Scroll-driven document: the playhead follows scroll position, never the wall
    // clock. One knob — `timeline.engine` — picks the row (scroll-timeline.design.md §4.0):
    //   player → the player measures progress, frames applies values (`setCurrentTime`)
    //   native → browser ScrollTimeline/ViewTimeline drives waapi (compositor thread)
    //   auto   → native first; when unsupported, the player measures and waapi (or
    //            frames, if waapi declines the doc) applies — the fallback cascade (D8)
    // Triggers are inert either way (D3 — both engines warn + skip
    // `setupAnimationTriggers` for scroll docs). The animator is never `play()`ed by us
    // for custom driving; scrubbing via `setCurrentTime` holds the pose.
    if (isScrollTimeline(animatorConfig)) {
        return finaliseAnimator(animatorConfig, callbacks, cb => {

            // `pin` — hold the canvas on screen for the scrubbed stretch (`position: sticky`,
            // + an optional tall wrapper the player injects). MUST be applied before anything
            // measures: it changes the very geometry the timeline reads, and
            // `subject: 'parent'` is meant to resolve THROUGH the injected wrapper.
            let unpin = () => { /* nothing pinned */ };

            // `auto` / `native`: try the browser's own timeline first.
            if (mayUseNativeScrollTimeline(animatorConfig.engine) && rootElement) {
                unpin = applyScrollPin(rootElement, animatorConfig.scroll);
                const native = createNativeScrollTimeline(rootElement, animatorConfig);
                if (native) {
                    const api = createWebApiAnimator(doc, cb, rootElement,
                        isNativeForced(animatorConfig.engine), native);
                    if (api) {
                        const destroyNative = api.destroy.bind(api);
                        api.destroy = () => { unpin(); destroyNative(); };
                        return api;
                    }
                    // unsupported attrs → fall through to frames + custom below
                }
                unpin();                        // …and undo the pin so the fallback re-applies it
                unpin = () => { /* re-pinned below */ };
            }

            // The player measures progress (the reference implementation). Engine per
            // `mode`: waapi unless `player` pins frames or waapi declines the doc.
            const api = (
                animatorConfig.engine !== PxTimelineEngineExtra.js
                    ? createWebApiAnimator(doc, cb, rootElement, isNativeForced(animatorConfig.engine))
                    : null
            ) || createFrameLoopAnimator(doc, adapter, cb, rootElement);

            // The animator knows its real root — for an SVG+JS export the runtime binds to the
            // `<svg>` already in the document, which is NOT the container passed in. Pin and
            // measure the same element, or the pin lands on nothing (it silently did).
            const subject = api.getRootElement?.() || rootElement;
            if (subject) {
                unpin = applyScrollPin(subject, animatorConfig.scroll);
                const totalMs = scrollTotalDurationMs(animatorConfig);
                const driver = createScrollDriver(subject, animatorConfig,
                    progress => api.setCurrentTime(progress * totalMs));
                if (driver) {
                    // Tie the driver's (and the pin's) lifetime to the animator's.
                    const destroy = api.destroy.bind(api);
                    api.destroy = () => { driver.destroy(); unpin(); destroy(); };
                }
            } else {
                console.warn('scroll timeline: no root element to observe — animation will stay at frame 0');
            }
            return api;
        });
    }

    return finaliseAnimator(animatorConfig, callbacks, cb => {
        if (animatorConfig.engine === PxTimelineEngineExtra.js) {
            // `player` pins the frame loop, even if waapi could be used.
            return createFrameLoopAnimator(doc, adapter, cb, rootElement);
        }
        // Try waapi first; fall back to frames if it returns null (unsupported
        // attrs) unless `native` demands waapi.
        return (
            createWebApiAnimator(doc, cb, rootElement,
                isNativeForced(animatorConfig.engine)
            ) ||
            createFrameLoopAnimator(doc, adapter, cb, rootElement)
        );
    });
}

/** Options accepted by the pre-rendered entry points. A subset of `PxAnimatorOptions`: */
export interface PxPrerenderedOptions {
    /**
     * The animation document. For a pre-rendered SVG this carries `animator.definitions`
     * and `animator.animateById` only — no `children`, because the elements are already
     * in the DOM.
     */
    data: PxAnimatedSvgDocument;
    /** Callback functions for animation lifecycle events. */
    callbacks?: PxAnimatorCallbacksConfig;
    /** Platform adapter for frame-loop rendering. */
    adapter?: PxPlatformAdapter;
}

function requireData(options: PxPrerenderedOptions): PxAnimatedSvgDocument {
    if (!options?.data) throw new Error('createAnimator: `data` is required');
    return options.data;
}

/**
 * Pre-rendered entry, both engines (`auto` / `player` / `native` all honoured).
 *
 * Deliberately skips `validateNodeEffects`, `materialiseAllInTree`, `generateNewIds` and
 * `renderNode`. Safe because the payload has no `children`, so all four are provably
 * no-ops for this document shape — and none of them reads `animator.animateById`.
 */
export function createPrerenderedAnimator(options: PxPrerenderedOptions): PxAnimatorAPI {
    return bindWithEngineChoice(requireData(options), options.adapter, options.callbacks, null);
}

/**
 * Pre-rendered entry, WAAPI only — the smallest build. Forces waapi so there is no
 * frames fallback to link against (`createWebApiAnimator` never returns null when
 * forced; it only warns about unsupported attrs).
 */
export function createPrerenderedWaapiAnimator(options: PxPrerenderedOptions): PxAnimatorAPI {
    const doc = requireData(options);
    const animatorConfig = getAnimatorConfig(doc) || {};
    return finaliseAnimator(animatorConfig, options.callbacks,
        cb => createWebApiAnimator(doc, cb, null, true)!);
}
