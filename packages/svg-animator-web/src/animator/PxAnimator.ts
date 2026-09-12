/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { reportDocumentDiagnostics, applyAnimatorConfig, createDiagnostics, foldAnimatorConfigShortcuts, generateNewIds, getAnimatorConfig, isPxElementFileFormat, materializeAllInTree, PX_ANIM_ATTR_NAME, PX_ANIM_SRC_ATTR_NAME, PxDiagnosticKind, resolveTimelineEngine, type PxTimelineEngine, validateNodeEffects, type PxAnimatedSvgDocument, type PxAnimatorCallbacksConfig, type PxAnimatorConfigPatch, type PxPlatformAdapter, type PxTrigger } from '@pixodesk/svg-animator-core';
import { bindWithEngineChoice } from '../engines/PxAnimatorBind';
import { renderNode } from '../dom/PxAnimatorDOM';
import { setupAnimationTriggers } from '../triggers/PxAnimatorTriggers';
import type { PxAnimatorAPI } from '../shared/PxAnimatorWebTypes';

// Re-export so the package surface keeps `generateNewIds` at its historical home.
export { generateNewIds };


/**
 * Creates an animator instance from a normalized player config.
 * This is the internal implementation that both engines use.
 *
 * The engine choice plus the `resetOnFinish` / `debugGlobalName` handling live in
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
 * This function serves as the main entry point for the animation library. The engine comes from
 * `timeline.engine`: `auto` tries the browser's Web Animations API and falls back to the frame
 * loop, `native` and `js` force one — see `resolveTimelineEngine`.
 *
 * @param doc The animated SVG document.
 * @param callbacks Optional object with callback functions for animation lifecycle events (play, pause, finish, etc.).
 * @param containerElement Optional selector or element to render the SVG into.
 * @returns An PxAnimatorAPI instance to programmatically control the animation.
 */
function createAnimatorImpl(
    doc: PxAnimatedSvgDocument,
    adapter?: PxPlatformAdapter,
    callbacks?: PxAnimatorCallbacksConfig,
    containerElement?: string | Element,
    config?: PxAnimatorConfigPatch,
    resetDocDefaults?: boolean
): PxAnimatorAPI {

    // Validate every `node.effects` bucket against `PxEffectsSchema` and warn
    // about any shape drift. Doesn't mutate or block — the materializer tries
    // its best even when shapes are off, but a warning helps spot wire-format
    // regressions early.
    // Everything this player has to say goes through one channel (API review §5): the caller's
    // `onWarn` / `onError` if given, the console otherwise, and neither when `silent`.
    const diag = createDiagnostics(callbacks, '[PxAnimator]');

    const effectsWarnings = validateNodeEffects(doc as any);
    for (const w of effectsWarnings) diag.warn(PxDiagnosticKind.document, 'effects shape: ' + w);

    // …and the WHOLE-document check beside it. This is the boundary diagnostic: if a consumer's
    // build mangled property names, the keys reaching us are unrecognizable and this says so,
    // instead of the animation silently rendering nothing (MINIFICATION-BOUNDARY-PLAN §3).
    reportDocumentDiagnostics(doc, '[PxAnimator] createAnimator');

    // The per-instance override, applied BEFORE anything reads the config. Everything below
    // depends on the final values: `timeline.engine` picks the engine, `duration` drives loop
    // expansion and motion-path sampling in `materializeAllInTree`, and `generateNewIds`
    // rewrites `animateById` keys — a late patch would be read by none of them.
    if (config !== undefined || resetDocDefaults) {
        const patched = applyAnimatorConfig(doc, config ?? {}, { resetDefaults: !!resetDocDefaults });
        for (const w of patched.warnings) diag.warn(PxDiagnosticKind.usage, 'config override: ' + w);
        doc = patched.doc;
    }

    // Decide the engine upfront so the materialization pipeline knows which
    // stages to run. `auto` and `native` resolve to the native (WAAPI) materialization; if the
    // native engine later declines the document at construction, the frame loop (`js`) is used
    // as fallback — slight over-materialization for that doc, but no correctness issue.
    const animatorConfig = getAnimatorConfig(doc) || {};
    const engine: PxTimelineEngine = resolveTimelineEngine(animatorConfig.engine);

    // Run the full document materialization pipeline:
    //   effects → loops → motion-path (native engine only) → animated-use (native engine only)
    // The exact same function is exported for the Editor — no parallel pipeline.
    doc = materializeAllInTree(doc, engine);

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
            rootElement = renderNode(doc, undefined, diag);
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
export { PX_ANIMATOR_DATA_KEY } from '../shared/PxAnimatorKeys';

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

    /**
     * Per-instance override of the document's `animator` config — the same shape as
     * `animator` in SCHEMA.md, deep-merged over what the document says, so one file can play
     * twice on a page with different timing. `null` at any slot DELETES that key, which is
     * how you restore a default that absence means.
     *
     * Also accepts a JSON STRING of the same object. Strings are immune to property mangling,
     * so that form survives a build that renames object keys (see docs/library/minification.md).
     */
    config?: PxAnimatorConfigPatch | string;

    /**
     * Ignore the document's own playback settings and start from the player's defaults, with
     * `config` applied on top. The lookup tables (`definitions`, `animateById`) are kept
     * either way — resetting those would leave the animation with nothing to animate.
     */
    resetDocDefaults?: boolean;

    /** Shortcut for `config.timeline.duration` (ms). Wins over the same key inside `config`. */
    duration?: number;
    /** Shortcut for `config.timeline.delay` (ms). */
    delay?: number;
    /** Shortcut for `config.timeline.iterations`. */
    iterations?: number | 'infinite';
    /** Shortcut for `config.timeline.trigger.startOn`. Typed from the WIRE, so it includes
     *  `'programmatic'` — the value that says "nothing starts this but a `play()` call". */
    startOn?: PxTrigger['startOn'];
}

/**
 * The `createAnimator` spelling of the shared shortcut fold (core owns the logic so the three
 * component packages and the plain-JS entry cannot drift).
 */
export function resolveAnimatorConfigOption(options: PxAnimatorOptions): PxAnimatorConfigPatch | undefined {
    const { config, duration, delay, iterations, startOn } = options;
    return foldAnimatorConfigShortcuts(config, { duration, delay, iterations, startOn });
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

    const { src, data, adapter, callbacks, container, resetDocDefaults } = options;
    const config = resolveAnimatorConfigOption(options);

    if (data !== undefined && src !== undefined) {
        throw new Error('createAnimator: provide either `src` or `data`, not both');
    }
    if (data === undefined && src === undefined) {
        throw new Error('createAnimator: either `src` or `data` is required');
    }

    if (data !== undefined) {
        return createAnimatorImpl(data, adapter, callbacks, container, config, resetDocDefaults);
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

    // A failed load is the one thing the web player could never tell anyone about: it went to
    // `console.error` and the proxy then answered `isReady() === false` for ever (API review §5).
    const loadDiag = createDiagnostics(callbacks, '[PxAnimator]');

    fetch(src!).then(res => res.json()).then(json => {
        if (destroyed) return; // destroy() was called before the document loaded
        if (isPxElementFileFormat(json)) {
            animator = createAnimatorImpl(json, adapter, callbacks, container, config, resetDocDefaults);
            const queued = pending;
            pending = null;
            queued?.forEach(call => call(animator!));
        } else {
            loadDiag.error(PxDiagnosticKind.document,
                'createAnimator: invalid animation document format at "' + src + '"');
        }
    }).catch(err => {
        pending = null;
        // `host`, not `document`: the file may be perfect — the page could not fetch it.
        loadDiag.error(PxDiagnosticKind.host,
            'createAnimator: failed to load "' + src + '" — ' + (err?.message ?? String(err)));
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
        "getCurrentProgress": () => animator ? animator.getCurrentProgress() : null,
        "setCurrentProgress": (progress: number) => { enqueue(api => api.setCurrentProgress(progress)); },
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
/**
 * Everything `createAnimator` takes except the three the tag supplies (`src`, `container`) or
 * forbids (`data`): callbacks, the diagnostics channel, a playback override and its shortcuts.
 */
export type PxTagAnimatorOptions = Omit<PxAnimatorOptions, 'src' | 'data' | 'container'>;

/**
 * Scan the page for `<div data-px-animation-src="animation.json">` and create one player per
 * match, rendered into that element and stored on it. Safe to call repeatedly: elements that
 * already carry a player are skipped.
 *
 * `options` applies to EVERY player this call creates (review §15) — the same callbacks, the
 * same override. Omit it for the zero-config path.
 */
export function loadTagAnimators(options?: PxTagAnimatorOptions) {
    const elements = document.querySelectorAll('[' + PX_ANIM_SRC_ATTR_NAME + ']');
    for (let i = 0; i < elements.length; i++) {
        const element = elements[i];
        if (!(element as any)[PX_ANIM_ATTR_NAME]) {
            const src = element.getAttribute(PX_ANIM_SRC_ATTR_NAME);
            if (src) {
                (element as any)[PX_ANIM_ATTR_NAME] = createAnimator({ ...options, src, container: element });
            }
        }
    }
}

// No module-level globals (API review §4). This file used to end by assigning
// `window.createAnimator` / `loadTagAnimators` / `setupAnimationTriggers` whenever it loaded —
// for every ESM and CJS consumer too, not just `<script>` pages. That could overwrite a page's
// own `createAnimator`, and the side effect made the whole module untree-shakable.
//
// `<script>` users reach all three through `PixodeskAnimator.*` on the UMD build, which is what
// the editor's exported SVG+JS calls. Older exported files are unaffected: they inline their own
// player and assign these names themselves.