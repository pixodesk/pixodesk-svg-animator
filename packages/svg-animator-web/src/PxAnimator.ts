/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { generateNewIds, getAnimatorConfig, isPxElementFileFormat, materialiseAllInTree, PX_ANIM_ATTR_NAME, PX_ANIM_SRC_ATTR_NAME, PxAnimatorEngine, PxAnimatorMode, validateNodeEffects, type PxAnimatedSvgDocument, type PxAnimatorCallbacksConfig, type PxPlatformAdapter } from '@pixodesk/svg-animator-core';
import { bindWithEngineChoice } from './PxAnimatorBind';
import { renderNode } from './PxAnimatorDOM';
import { setupAnimationTriggers } from './PxAnimatorTriggers';
import type { PxAnimatorAPI } from './PxAnimatorWebTypes';

// Re-export so the package surface keeps `generateNewIds` at its historical home.
export { generateNewIds };


/**
 * Creates an animator instance from a normalized player config.
 * This is the internal implementation that both engines use.
 *
 * The engine choice plus the `resetOnFinish` / `debugInstName` handling live in
 * `PxAnimatorBind` so the pre-rendered builds share them verbatim — one code path, no
 * parallel pipeline. See PRERENDERED-PLAYER-BUILDS.md.
 */
function createAnimatorFromConfig(
    doc: PxAnimatedSvgDocument,
    adapter?: PxPlatformAdapter,
    callbacks?: PxAnimatorCallbacksConfig,
    rootElement?: Element | null
): PxAnimatorAPI {
    return bindWithEngineChoice(doc, adapter, callbacks, rootElement);
}


/**
 * Creates an animator instance from an AnimatedSvgDocument.
 *
 * This function serves as the main entry point for the animation library. It automatically
 * chooses the best animation engine available ('waapi' or 'frames') or can be
 * forced to use a specific one.
 *
 * @param doc The animated SVG document.
 * @param callbacks Optional object with callback functions for animation lifecycle events (play, pause, finish, etc.).
 * @param containerElement Optional selector or element to render the SVG into.
 * @returns An PxAnimatorAPI instance to programmatically control the animation.
 */
export function createAnimatorImpl(
    doc: PxAnimatedSvgDocument,
    adapter?: PxPlatformAdapter,
    callbacks?: PxAnimatorCallbacksConfig,
    containerElement?: string | Element
): PxAnimatorAPI {

    // Validate every `node.effects` bucket against `PxEffectsSchema` and warn
    // about any shape drift. Doesn't mutate or block — the materialiser tries
    // its best even when shapes are off, but a warning helps spot wire-format
    // regressions early.
    const effectsWarnings = validateNodeEffects(doc as any);
    for (const w of effectsWarnings) console.warn('[PxAnimator] effects shape warning:', w);

    // Decide the engine upfront so the materialisation pipeline knows which
    // stages to run. `auto` (and any non-`frames` value) resolves to `waapi`
    // for materialisation purposes; if waapi later returns null at engine
    // construction, frames is used as fallback — slight over-materialisation
    // for that doc, but no correctness issue.
    const animatorConfig = getAnimatorConfig(doc) || {};
    const engine: PxAnimatorEngine = animatorConfig.mode === PxAnimatorMode.frames
        ? PxAnimatorEngine.frames
        : PxAnimatorEngine.waapi;

    // Run the full document materialisation pipeline:
    //   effects → loops → motion-path (waapi only) → animated-use (waapi only)
    // The exact same function is exported for the Editor — no parallel pipeline.
    doc = materialiseAllInTree(doc, engine);

    let rootElement: Element | null = null;

    // Render whenever there's a container. A document with no children is still a
    // document — it carries the viewBox/size that make it a viewport — so it renders as an
    // EMPTY `<svg>`. Gating on `doc.children` left `getRootElement()` answering `null`,
    // which a consumer cannot tell apart from "the render failed".
    if (containerElement) {

        doc = generateNewIds(doc); // Regenerate IDs so repeated calls to createAnimator(...) produce different ids in elements

        const containerEl = typeof containerElement === 'string' ?
            document.querySelector(containerElement) : containerElement;

        if (containerEl) {
            rootElement = renderNode(doc);
            if (rootElement) {
                containerEl.replaceChildren(rootElement);
            }
        }
    }

    const api = createAnimatorFromConfig(doc, adapter, callbacks, rootElement);

    // The player put the SVG into the container, so destroy() takes it out again —
    // otherwise a frozen last frame lingers after the animator is gone. Scoped to
    // the container path on purpose: a root the caller rendered (the React / Vue
    // adapters, Mode B binding to an existing SVG) is theirs to remove.
    if (containerElement && rootElement) {
        const rendered = rootElement;
        const destroyNative = api.destroy.bind(api);
        api.destroy = () => {
            destroyNative();
            rendered.remove();
        };
    }

    return api;
}

// Re-exported so this module's public surface is unchanged; declared in
// `PxAnimatorKeys` so entries can use it without importing this module. See there.
export { PX_ANIMATOR_DATA_KEY } from './PxAnimatorKeys';

export interface PxAnimatorOptions {
    /** URL to fetch the animation document from. Provide either this or `data`, not both. */
    src?: string;
    /** Inline animation document object. Provide either this or `src`, not both. */
    data?: PxAnimatedSvgDocument;
    /** Platform adapter for frame-loop rendering. */
    adapter?: PxPlatformAdapter;
    /** Callback functions for animation lifecycle events. */
    callbacks?: PxAnimatorCallbacksConfig;
    /** CSS selector or element to render the SVG into. */
    container?: string | Element;
}

/**
 * Creates an animator instance to control SVG animations.
 *
 * @param options.src URL to fetch the animation document from.
 * @param options.data Inline animation document object.
 * @param options.container CSS selector or element to render the SVG into.
 * @returns A PxAnimatorAPI instance to programmatically control the animation.
 */
export function createAnimator(options: PxAnimatorOptions): PxAnimatorAPI {

    const { src, data, adapter, callbacks, container } = options;

    if (data !== undefined && src !== undefined) {
        throw new Error('createAnimator: provide either `src` or `data`, not both');
    }
    if (data === undefined && src === undefined) {
        throw new Error('createAnimator: either `src` or `data` is required');
    }

    if (data !== undefined) {
        return createAnimatorImpl(data, adapter, callbacks, container);
    }

    // URL provided - fetch and create animator
    let animator: PxAnimatorAPI | null = null;

    // Control calls made before the fetch resolves are queued and replayed (in
    // order) once the animator is ready, so e.g. `createAnimator({src}).play()`
    // works as expected. Getters are not queued — they return their "not ready
    // yet" value until the document loads.
    let pending: Array<(api: PxAnimatorAPI) => void> | null = [];
    let destroyed = false;

    const enqueue = (call: (api: PxAnimatorAPI) => void) => {
        if (animator) {
            call(animator);
        } else if (pending) {
            pending.push(call);
        }
    };

    fetch(src!).then(res => res.json()).then(json => {
        if (destroyed) return; // destroy() was called before the document loaded
        if (isPxElementFileFormat(json)) {
            animator = createAnimatorImpl(json, adapter, callbacks, container);
            const queued = pending;
            pending = null;
            queued?.forEach(call => call(animator!));
        } else {
            console.error('createAnimator: invalid animation document format at "' + src + '"');
        }
    }).catch(err => {
        pending = null;
        console.error('createAnimator: failed to load "' + src + '"', err);
    });

    // Return a proxy that forwards calls once loaded
    return {
        "isReady": () => !!animator,
        "getRootElement": () => animator ? animator.getRootElement() : null,
        "isPlaying": () => animator?.isPlaying() || false,
        "play": () => { enqueue(api => api.play()); },
        "pause": () => { enqueue(api => api.pause()); },
        "cancel": () => { enqueue(api => api.cancel()); },
        "finish": () => { enqueue(api => api.finish()); },
        "setPlaybackRate": (rate: number) => { enqueue(api => api.setPlaybackRate(rate)); },
        "getCurrentTime": () => animator ? animator.getCurrentTime() : null,
        "setCurrentTime": (time: number) => { enqueue(api => api.setCurrentTime(time)); },
        "destroy": () => {
            destroyed = true;
            pending = null; // drop any queued calls
            animator?.destroy();
        }
    };
}

/**
 * Scan and load for tags, e.g.
 *  <div data-px-animation-src="animation.json"></div>
 */
export function loadTagAnimators() {
    const elements = document.querySelectorAll('[' + PX_ANIM_SRC_ATTR_NAME + ']');
    for (let i = 0; i < elements.length; i++) {
        const element = elements[i];
        if (!(element as any)[PX_ANIM_ATTR_NAME]) {
            const src = element.getAttribute(PX_ANIM_SRC_ATTR_NAME);
            if (src) {
                (element as any)[PX_ANIM_ATTR_NAME] = createAnimator({ src, container: element });
            }
        }
    }
}

if (typeof window !== 'undefined') {
    (window as any)["loadTagAnimators"] = loadTagAnimators;
    (window as any)["createAnimator"] = createAnimator;
    (window as any)["setupAnimationTriggers"] = setupAnimationTriggers;
}