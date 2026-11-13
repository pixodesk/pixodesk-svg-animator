// @px-area engine
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { getAnimatorConfig, toPxDocument, type PxDocumentJson, PxDiagnosticCode, PxDiagnosticKind, PxTimelineEngineSetting, type PxDocument, type PxAnimatorRuntimeConfig, type PxAnimationPlayerCallbacks, type PxCommonControlProps, type PxEngineCallbacks, type PxPlayExecutor } from '@pixodesk/svg-animator-core';
import { applyPlaybackOverride, composeApiExtras, isNativeForced, mayUseNativeScrollTimeline, PxControlMode, PxPlaybackWrite, resolveControlMode, withControlMode, type PxPlatformAdapter } from '@pixodesk/svg-animator-core/engine';
import { createDiagnostics, isScrollTimeline, scrollTotalDurationMs } from '@pixodesk/svg-animator-core/internal';
import { asThrownError, createInertAnimator, toEngineCallbacks, toPlayerCallbacks } from '../shared/PxAnimatorCallbacks';
import type { PxPlayerCallbacks } from '../shared/PxAnimatorCallbacks';
import { registerAnimator, withRegistryEvents } from '../registry/PxAnimatorRegistry';
import { createFrameLoopAnimator } from './PxAnimatorFrameLoop';
import { webRaf } from '../shared/PxWebRaf';
import type { PxAnimationPlayerApi, PxEngineAnimationPlayerApi } from '../shared/PxAnimatorWebTypes';
import { createWebApiAnimator } from './PxAnimatorWebApi';
import { applyScrollPin, createNativeScrollTimeline, createScrollDriver } from '../scroll/PxScrollDriver';

/**
 * Engine construction, shared by the full player and the pre-rendered builds.
 *
 * Everything here operates on a document that is ALREADY in its final shape — no
 * validation, no materialization, no rendering. `createAnimatorImpl` calls in after it
 * has done those stages; the pre-rendered entries call in directly, because the Editor
 * did them at export time. See dev-docs/plans/prerendered-player-builds.md.
 */

/**
 * Applies the two `animator` config behaviors that are engine-independent, then hands
 * off to `make` for the actual engine.
 *
 * `whenFinished` is composed here so BOTH engines get it: the engine's raw end goes to the player's executor, which
 * decides whether it is the playback's finish (`onPlaybackFinish`, then hold / reset / rewind) or the end of a return
 * leg. The executor is taken right after creation — a finish always happens asynchronously later.
 */
export function finaliseAnimator(
    animatorConfig: PxAnimatorRuntimeConfig,
    callbacks: PxPlayerCallbacks | undefined,
    make: (engineCallbacks?: PxEngineCallbacks) => PxEngineAnimationPlayerApi<Element>
): PxAnimationPlayerApi {

    let executor: PxPlayExecutor | undefined;
    const engineCallbacks: PxEngineCallbacks = {
        ...toEngineCallbacks(callbacks),
        // the playback events ride along for the executor the engine's own triggers press (a `load` start happens inside
        // `make`, before `composeApiExtras` could attach them); the engine never fires them itself
        playbackListeners: callbacks,
        onFinish: () => { executor?.onNaturalFinish(); },
    };

    // `playback` (the buttons, the seeks, the reads) is composed ON TOP of the engine — the one shared rule (review
    // §10, D5); the playback events are the executor's to tell (when it performs the act), never the engine's
    const res = composeApiExtras(make(engineCallbacks), { ...animatorConfig, playbackListeners: callbacks }, webRaf);
    executor = res.playExecutor;

    // the file's `playbackSpeed` is set on the engine inside `composeApiExtras`; scroll owns its pace (no speed there)
    return res;
}

// @px-importance important
/**
 * Picks the engine the way the full player does, from `timeline.engine`: `player` pins the
 * frame loop; otherwise waapi, with a frames fallback for unsupported attrs unless
 * `native` demands waapi. `mode` `static` (`showAsStatic`) builds the engine but never lets anything move it: no
 * scroll attached, every playback call ignored with a warning (PX1506).
 */
export function bindWithEngineChoice(
    doc: PxDocument,
    adapter?: PxPlatformAdapter,
    callbacks?: PxPlayerCallbacks,
    rootElement?: Element | null,
    mode: PxControlMode = PxControlMode.actionTriggers,
): PxAnimationPlayerApi {
    // One channel for everything this binder and the scroll driver have to say (review §5).
    const diag = createDiagnostics(callbacks, '[PxAnimator]');
    if (mode === PxControlMode.static) return guardStaticPlayback(diag, bindEngine(doc, adapter, callbacks, rootElement, diag, false));
    return bindEngine(doc, adapter, callbacks, rootElement, diag, true);
}

/** {@link bindWithEngineChoice}'s engine; `followScroll` false builds a scroll-driven document's engine with no scroll
 *  attached — it rests on the static SVG, never played (the rest-pose stage). */
function bindEngine(
    doc: PxDocument,
    adapter: PxPlatformAdapter | undefined,
    callbacks: PxPlayerCallbacks | undefined,
    rootElement: Element | null | undefined,
    diag: ReturnType<typeof createDiagnostics>,
    followScroll: boolean,
): PxAnimationPlayerApi {
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
    if (followScroll && isScrollTimeline(animatorConfig)) {
        return guardScrollDrivenPlayback(diag, finaliseAnimator(animatorConfig, callbacks, cb => {

            // `pin` — hold the canvas on screen for the scrubbed stretch (`position: sticky`,
            // + an optional tall wrapper the player injects). MUST be applied before anything
            // measures: it changes the very geometry the timeline reads, and
            // `subject: 'parent'` is meant to resolve THROUGH the injected wrapper.
            let unpin = () => { /* nothing pinned */ };

            // `auto` / `native`: try the browser's own timeline first.
            if (mayUseNativeScrollTimeline(animatorConfig.engine) && rootElement) {
                unpin = applyScrollPin(rootElement, animatorConfig.scroll);
                const native = createNativeScrollTimeline(rootElement, animatorConfig, diag);
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
                animatorConfig.engine !== PxTimelineEngineSetting.js
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
                    progress => api.setTotalTime(progress * totalMs), diag);
                if (driver) {
                    // Tie the driver's (and the pin's) lifetime to the animator's.
                    const destroy = api.destroy.bind(api);
                    api.destroy = () => { driver.destroy(); unpin(); destroy(); };
                }
            } else {
                diag.warn(PxDiagnosticKind.host, PxDiagnosticCode.scrollNoRootToObserve);
            }
            return api;
        }));
    }

    return finaliseAnimator(animatorConfig, callbacks, cb => {
        if (animatorConfig.engine === PxTimelineEngineSetting.js) {
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

/** On a scroll / view timeline the scroll position owns the playhead: the playback verbs are no-ops that say so
 *  (PX1505 `scrollOwnsPlayhead`); seeks still apply until the next scroll moves the playhead. */
function guardScrollDrivenPlayback(diag: ReturnType<typeof createDiagnostics>, api: PxAnimationPlayerApi): PxAnimationPlayerApi {
    const ignored = (call: PxPlaybackWrite) => (): void => diag.warn(PxDiagnosticKind.usage, PxDiagnosticCode.scrollOwnsPlayhead, call);
    const playback = api.playback;
    playback.start = ignored(PxPlaybackWrite.start);
    playback.stop = ignored(PxPlaybackWrite.stop);
    playback.pause = ignored(PxPlaybackWrite.pause);
    playback.resume = ignored(PxPlaybackWrite.resume);
    playback.play = ignored(PxPlaybackWrite.play);
    playback.setSpeed = ignored(PxPlaybackWrite.setSpeed);
    playback.setDurationAtSpeed = ignored(PxPlaybackWrite.setDurationAtSpeed);
    return api;
}

/** `showAsStatic`: the picture stays as drawn — every playback write is a no-op that says so (PX1506
 *  `showAsStaticIgnoresCall`); the reads answer from the engine, which never moves. */
function guardStaticPlayback(diag: ReturnType<typeof createDiagnostics>, api: PxAnimationPlayerApi): PxAnimationPlayerApi {
    const ignored = (call: PxPlaybackWrite) => (): void => diag.warn(PxDiagnosticKind.usage, PxDiagnosticCode.showAsStaticIgnoresCall, call);
    const playback = api.playback;
    playback.start = ignored(PxPlaybackWrite.start);
    playback.play = ignored(PxPlaybackWrite.play);
    playback.stop = ignored(PxPlaybackWrite.stop);
    playback.pause = ignored(PxPlaybackWrite.pause);
    playback.resume = ignored(PxPlaybackWrite.resume);
    playback.setCurrentTime = ignored(PxPlaybackWrite.setCurrentTime);
    playback.setCurrentProgress = ignored(PxPlaybackWrite.setCurrentProgress);
    playback.setTotalTime = ignored(PxPlaybackWrite.setTotalTime);
    playback.setSpeed = ignored(PxPlaybackWrite.setSpeed);
    playback.setDurationAtSpeed = ignored(PxPlaybackWrite.setDurationAtSpeed);
    return api;
}

/**
 * Options accepted by the pre-rendered entry points — a subset of `PxAnimationPlayerOptions`: the
 * document, the control options and the callbacks INLINE under the same names every surface uses (review §9). No
 * `adapter`: a pre-rendered SVG is by definition already in the DOM (review §25.14). With no control option the
 * document's own `timeline.actionTriggers` decide — the way the editor saved it.
 * @public
 */
export interface PxPrerenderedAnimationPlayerOptions extends PxAnimationPlayerCallbacks, PxCommonControlProps {
    /**
     * The animation document. For a pre-rendered SVG this carries `animator.definitions`
     * and `animator.bindings` only — no `children`, because the elements are already
     * in the DOM. Inline only: the pre-rendered SVG carries it. (`doc` until 1.25.)
     */
    document: PxDocumentJson;
}

/** The document as the options' control mode plays it — the same rule as `createSvgAnimationPlayer` (core
 *  `resolveControlMode` + `withControlMode`); a conflicting mix warns (PX1501). */
function docToPlay(options: PxPrerenderedAnimationPlayerOptions): { doc: PxDocument; mode: PxControlMode } {
    const control = resolveControlMode({
        showAsStatic: options.showAsStatic, disableActionTriggers: options.disableActionTriggers, actionTriggers: options.actionTriggers,
    });
    const diag = createDiagnostics(options, '[PxAnimator]');
    for (const w of control.warnings) diag.warn(PxDiagnosticKind.usage, PxDiagnosticCode.controlPropsConflict, w);
    const overridden = applyPlaybackOverride(requireDoc(options), { actionTriggers: options.actionTriggers });
    for (const w of overridden.warnings) diag.warn(PxDiagnosticKind.usage, PxDiagnosticCode.timelineOverrideIgnored, w);
    return { doc: withControlMode(overridden.doc, control.mode), mode: control.mode };
}

function requireDoc(options: PxPrerenderedAnimationPlayerOptions): PxDocument {
    // A wrong CALL throws (a bug at the call site); a document that cannot play is reported
    // through `onError` below — the rule in core's `PxDiagnostics` (review §25.1).
    if (!options?.document) throw new Error('createSvgAnimationPlayer: `document` is required');
    return toPxDocument(options.document);
}

/**
 * Builds the player; when that throws, reports "this instance will not play" through the
 * diagnostics channel and returns an inert API instead of throwing at the caller.
 */
function buildOrReport(options: PxPrerenderedAnimationPlayerOptions, build: () => PxAnimationPlayerApi): PxAnimationPlayerApi {
    try {
        return build();
    } catch (e) {
        const err = asThrownError(e);
        createDiagnostics(options, '[PxAnimator]')
            .error(PxDiagnosticKind.internal, PxDiagnosticCode.buildFailed, err);
        return createInertAnimator();
    }
}

/**
 * Pre-rendered entry, both engines (`auto` / `player` / `native` all honored).
 *
 * Deliberately skips `validateNodeEffects`, `materializeAllInTree`, `generateNewIds` and
 * `renderNode`. Safe because the payload has no `children`, so all four are provably
 * no-ops for this document shape — and none of them reads `animator.bindings`.
 * @public
 */
export function createPrerenderedAnimator(options: PxPrerenderedAnimationPlayerOptions): PxAnimationPlayerApi {
    const { doc, mode } = docToPlay(options);
    return registered(options, callbacks => buildOrReport(options, () => bindWithEngineChoice(doc, undefined, callbacks, null, mode)));
}

/**
 * The page-wide registry (`getAllSvgAnimationPlayers()`) for the pre-rendered builds: the returned
 * API is enrolled — a build that failed (the inert API, `isReady()` false) is not — and hears
 * the playback events and the finish through the callbacks the player is given.
 */
function registered(options: PxPrerenderedAnimationPlayerOptions, build: (callbacks: PxPlayerCallbacks) => PxAnimationPlayerApi): PxAnimationPlayerApi {
    let apiRef: PxAnimationPlayerApi | undefined;
    const api = build(withRegistryEvents(toPlayerCallbacks(options), () => apiRef));
    if (api.isReady()) {
        apiRef = api;
        registerAnimator(api);
        // `onReady` (review §14): asynchronous, so the create call has returned first
        queueMicrotask(() => options.onReady?.());
    }
    return api;
}

/**
 * Pre-rendered entry, WAAPI only — the smallest build. Forces waapi so there is no
 * frames fallback to link against (`createWebApiAnimator` never returns null when
 * forced; it only warns about unsupported attrs).
 * @public
 */
export function createPrerenderedWaapiAnimator(options: PxPrerenderedAnimationPlayerOptions): PxAnimationPlayerApi {
    const { doc, mode } = docToPlay(options);
    return registered(options, callbacks => buildOrReport(options, () => {
        const animatorConfig = getAnimatorConfig(doc) || {};
        const api = finaliseAnimator(animatorConfig, callbacks, cb => createWebApiAnimator(doc, cb, null, true));
        return mode === PxControlMode.static ? guardStaticPlayback(createDiagnostics(callbacks, '[PxAnimator]'), api) : api;
    }));
}
