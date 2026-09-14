/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { applyAnimatorConfig, foldTimelineOverride, generateNewIds, getAnimatorConfig, isPxDocument, materializeAllInTree, PxDiagnosticKind, resolveTimelineEngine, type PxTimelineEngine, validateNodeEffects, type PxAnimatedSvgDocument, type PxEngineCallbacks, type PxAnimatorConfigPatch, type PxAnimatorCallbacks, type PxPlaybackOverride, type PxPlatformAdapter } from '@pixodesk/svg-animator-core';
import { reportDocumentDiagnostics, createDiagnostics, PX_ANIM_ATTR_NAME, PX_ANIM_SRC_ATTR_NAME } from '@pixodesk/svg-animator-core/internal';
import { asThrownError, toEngineCallbacks } from '../shared/PxAnimatorCallbacks';
import { bindWithEngineChoice } from '../engines/PxAnimatorBind';
import { renderNode } from '../dom/PxAnimatorDOM';
import { setupAnimationTriggers } from '../triggers/PxAnimatorTriggers';
import type { PxAnimatorApi } from '../shared/PxAnimatorWebTypes';

// Re-export so the package surface keeps `generateNewIds` at its historical home.
export { generateNewIds };


/**
 * Creates an animator instance from a normalized player config.
 * This is the internal implementation that both engines use.
 *
 * The engine choice plus the `resetOnFinish` / `debugGlobalName` handling live in
 * `PxAnimatorBind` so the pre-rendered builds share them verbatim — one code path, no
 * parallel pipeline. See dev-docs/plans/prerendered-player-builds.md.
 */
function createAnimatorFromConfig(
    doc: PxAnimatedSvgDocument,
    adapter?: PxPlatformAdapter,
    callbacks?: PxEngineCallbacks,
    rootElement?: Element | null
): PxAnimatorApi {
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
 * @returns An PxAnimatorApi instance to programmatically control the animation.
 */
function createAnimatorImpl(
    doc: PxAnimatedSvgDocument,
    adapter?: PxPlatformAdapter,
    callbacks?: PxEngineCallbacks,
    containerElement?: string | Element,
    patch?: PxAnimatorConfigPatch,
    resetTimeline?: boolean
): PxAnimatorApi {

    // Validate every `node.effects` bucket against `PxEffectsSchema` and warn
    // about any shape drift. Doesn't mutate or block — the materializer tries
    // its best even when shapes are off, but a warning helps spot wire-format
    // regressions early.
    // Everything this player has to say goes through one channel (API review §5): the caller's
    // `onWarn` / `onError` if given, the console otherwise — unless `muteWarn` / `muteError` switch it off.
    const diag = createDiagnostics(callbacks, '[PxAnimator]');

    const effectsWarnings = validateNodeEffects(doc as any);
    for (const w of effectsWarnings) diag.warn(PxDiagnosticKind.document, 'effects shape: ' + w);

    // …and the WHOLE-document check beside it. This is the boundary diagnostic: if a consumer's
    // build mangled property names, the keys reaching us are unrecognizable and this says so,
    // instead of the animation silently rendering nothing (dev-docs/plans/minification-boundary.md §3).
    reportDocumentDiagnostics(doc, '[PxAnimator] createAnimator');

    // The per-instance override, applied BEFORE anything reads the config. Everything below
    // depends on the final values: `timeline.engine` picks the engine, `duration` drives loop
    // expansion and motion-path sampling in `materializeAllInTree`, and `generateNewIds`
    // rewrites binding targets — a late patch would be read by none of them.
    if (patch !== undefined || resetTimeline) {
        const patched = applyAnimatorConfig(doc, patch ?? {}, { resetTimeline: !!resetTimeline });
        for (const w of patched.warnings) diag.warn(PxDiagnosticKind.usage, 'timeline override: ' + w);
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
export { PX_ANIMATOR_DOC_KEY } from '../shared/PxAnimatorKeys';

/**
 * Everything `createAnimator` takes. The playback override (`timeline`, `resetTimeline` and the
 * four shortcuts) and the callbacks are core's shared shapes — the SAME names, inline, as the
 * React, Vue and React Native components take (review §9) — so only what is web-specific is
 * declared here.
 * @public
 */
export interface PxAnimatorOptions extends PxPlaybackOverride, PxAnimatorCallbacks {
    /** URL to fetch the animation document from. Provide either this or `doc`, not both. */
    src?: string;
    /** The animation document, inline (see docs/format/README.md). Provide either this or `src`, not both. */
    doc?: PxAnimatedSvgDocument;
    /** CSS selector or element to render the SVG into. */
    container?: string | Element;
}

/**
 * What the framework COMPONENTS build the player with: the public options plus the `adapter`
 * that routes the frame loop's attribute writes to the elements they rendered themselves.
 *
 * NOT part of the public API (review §25.14). The React and Vue packages are its only callers;
 * `createAnimator`'s signature says `PxAnimatorOptions` on purpose — a page has a DOM to write
 * to, so for anyone else the option would only be a way to hold the player wrong. Exported as a
 * type so those packages can name it; never documented as an option.
 * @internal
 */
export interface PxInternalAnimatorOptions extends PxAnimatorOptions {
    /** A custom render target for the frame-loop engine (`PxPlatformAdapter`). */
    adapter?: PxPlatformAdapter;
}

/** The one place `createAnimator` reads past its public signature — see `PxInternalAnimatorOptions`. */
function isInternalOptions(options: PxAnimatorOptions): options is PxInternalAnimatorOptions {
    return 'adapter' in options;
}

/**
 * The `createAnimator` spelling of the shared timeline fold (core owns the logic so the three
 * component packages and the plain-JS entry cannot drift).
 */
export function resolveTimelineOption(options: PxAnimatorOptions): PxAnimatorConfigPatch | undefined {
    const { timeline, duration, delay, iterations, startOn } = options;
    return foldTimelineOverride(timeline, { duration, delay, iterations, startOn });
}

/**
 * Creates an animator instance to control SVG animations.
 *
 * @param options.src URL to fetch the animation document from.
 * @param options.doc The animation document, inline.
 * @param options.container CSS selector or element to render the SVG into.
 * @returns A PxAnimatorApi instance to programmatically control the animation.
 * @public
 */
export function createAnimator(options: PxAnimatorOptions): PxAnimatorApi {

    const { src, doc, container, resetTimeline } = options;
    const adapter = isInternalOptions(options) ? options.adapter : undefined;
    const patch = resolveTimelineOption(options);
    const callbacks = toEngineCallbacks(options);

    // A wrong CALL throws — a bug at the call site, found the moment the line runs. A document
    // or environment that cannot play is reported through `onError` instead (the rule in core's
    // `PxDiagnostics`, review §25.1): the returned API stays inert and `isReady()` false.
    if (doc !== undefined && src !== undefined) {
        throw new Error('createAnimator: provide either `src` or `doc`, not both');
    }
    if (doc === undefined && src === undefined) {
        throw new Error('createAnimator: either `src` or `doc` is required');
    }

    let animator: PxAnimatorApi | null = null;

    // Control calls made before the player exists are queued and replayed (in order) once it
    // is ready, so e.g. `createAnimator({src}).play()` works as expected. Getters are not
    // queued — they return their "not ready yet" value until then. With `doc` the player is
    // ready before this returns; the same proxy then simply forwards.
    let pending: Array<(api: PxAnimatorApi) => void> | null = [];
    let destroyed = false;

    const enqueue = (call: (api: PxAnimatorApi) => void) => {
        if (animator) {
            call(animator);
        } else if (pending) {
            pending.push(call);
        }
    };

    const diag = createDiagnostics(callbacks, '[PxAnimator]');

    const ready = (api: PxAnimatorApi): void => {
        animator = api;
        const queued = pending;
        pending = null;
        queued?.forEach(call => call(api));
    };
    // The instance will not play: report once, drop the queue, stay inert.
    const failed = (kind: PxDiagnosticKind, message: string, detail?: unknown): void => {
        pending = null;
        diag.error(kind, message, detail);
    };
    // Building the player threw: a broken document past validation, or a player bug — never a
    // throw at the caller, which would land inside a fetch callback where no one can catch it.
    const build = (document: PxAnimatedSvgDocument): void => {
        try {
            ready(createAnimatorImpl(document, adapter, callbacks, container, patch, resetTimeline));
        } catch (e) {
            const err = asThrownError(e);
            failed(PxDiagnosticKind.internal, 'createAnimator: could not build the player — ' + err.message, err);
        }
    };

    if (doc !== undefined) {
        build(doc);
    } else {
        fetch(src!).then(res => res.json()).then(json => {
            if (destroyed) return; // destroy() was called before the document loaded
            if (isPxDocument(json)) build(json);
            else failed(PxDiagnosticKind.document, 'createAnimator: invalid animation document format at "' + src + '"');
        }).catch(err => {
            // `host`, not `document`: the file may be perfect — the page could not fetch it.
            failed(PxDiagnosticKind.host, 'createAnimator: failed to load "' + src + '" — ' + (err?.message ?? String(err)));
        });
    }

    // The proxy: forwards once the player exists, queues control calls until then
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
 * @public
 */
export type PxTagAnimatorOptions = Omit<PxAnimatorOptions, 'src' | 'doc' | 'container'>;

/**
 * Scan the page for `<div data-px-animation-src="animation.json">` and create one player per
 * match, rendered into that element and stored on it. Safe to call repeatedly: elements that
 * already carry a player are skipped.
 *
 * `options` applies to EVERY player this call creates (review §15) — the same callbacks, the
 * same override. Omit it for the zero-config path.
 * @public
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