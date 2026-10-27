// @px-area entry
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { applyAnimatorConfig, toPxDocument, type PxDocumentInput, generateNewIds, getAnimatorConfig, isPxDocument, prepareDocument, PxDocStage, PxDiagnosticCode, PxDiagnosticKind, type PxTimelineEngine, type PxDocument, type PxEngineCallbacks, type PxAnimationPlayerCallbacks, type PxPlaybackOverride, type PxPlaybackOverrideInput, type PxTrigger } from '@pixodesk/svg-animator-core';
import { withoutTriggerDriver, applyPlaybackOverride, resolveTimelineEngine, type PxPlatformAdapter } from '@pixodesk/svg-animator-core/engine';
import { reportDocumentProblems, validateDeprecatedTransformChannels } from '@pixodesk/svg-animator-core/internal';
import { reportDocumentDiagnostics, createDiagnostics, isScrollTimeline, PX_ANIM_ATTR_NAME, PX_ANIM_SRC_ATTR_NAME } from '@pixodesk/svg-animator-core/internal';
import { asThrownError, toEngineCallbacks } from '../shared/PxAnimatorCallbacks';
import { registerAnimator, withRegistryEvents } from '../registry/PxAnimatorRegistry';
import { bindWithEngineChoice } from '../engines/PxAnimatorBind';
import { renderNode } from '../dom/PxAnimatorDOM';
import { setupAnimationTriggers } from '../triggers/PxAnimatorTriggers';
import type { PxAnimationPlayerApi } from '../shared/PxAnimatorWebTypes';

// Re-export so the package surface keeps `generateNewIds` at its historical home.
export { generateNewIds };


/**
 * Creates an animator instance from a normalized player config.
 * This is the internal implementation that both engines use.
 *
 * The engine choice plus the `resetOnFinish` handling live in
 * `PxAnimatorBind` so the pre-rendered builds share them verbatim — one code path, no
 * parallel pipeline. See dev-docs/plans/prerendered-player-builds.md.
 */
function createAnimatorFromConfig(
    doc: PxDocument,
    adapter?: PxPlatformAdapter,
    callbacks?: PxEngineCallbacks,
    rootElement?: Element | null
): PxAnimationPlayerApi {
    return bindWithEngineChoice(doc, adapter, callbacks, rootElement);
}


// @px-importance important
/**
 * Creates an animator instance from a `PxDocument`.
 *
 * This function serves as the main entry point for the animation library. The engine comes from
 * `timeline.engine`: `auto` tries the browser's Web Animations API and falls back to the frame
 * loop, `native` and `js` force one — see `resolveTimelineEngine`.
 *
 * @param doc The animated SVG document.
 * @param callbacks Optional object with callback functions for animation lifecycle events (play, pause, finish, etc.).
 * @param containerElement Optional selector or element to render the SVG into.
 * @param providedRoot The root `<svg>` a caller rendered itself — used when there is no container.
 * @returns An PxAnimationPlayerApi instance to programmatically control the animation.
 */
function createAnimatorImpl(
    doc: PxDocument,
    adapter?: PxPlatformAdapter,
    callbacks?: PxEngineCallbacks,
    containerElement?: string | Element,
    override?: PxPlaybackOverrideInput,
    providedRoot?: Element,
    playOnTrigger?: boolean | PxTrigger
): PxAnimationPlayerApi {

    // Everything this player has to say goes through one channel (API review §5): the caller's
    // `onWarn` / `onError` if given, the console otherwise — unless `muteWarn` / `muteError` switch it off.
    const diag = createDiagnostics(callbacks, '[PxAnimator]');
    const onProblems = (problems: Parameters<typeof reportDocumentProblems>[0]) => reportDocumentProblems(problems, diag);

    // Migrate an OLDER stamped document and check it ONCE (`checked` stage): a repaired, type-stamped
    // copy; every repair is reported — inside `effects` as `effectsShape`, anything else as
    // `documentRepaired`. Every later stage and cast reuses the stamps instead of re-checking.
    doc = prepareDocument(doc, { stage: PxDocStage.checked, onProblems });
    // §6: per-key transform channels still play (old migrated files), but are named as deprecated
    for (const w of validateDeprecatedTransformChannels(doc)) diag.warn(PxDiagnosticKind.document, PxDiagnosticCode.deprecatedTransformChannel, w);

    // The boundary diagnostic, STRICT: if a consumer's build mangled property names, the keys
    // reaching us are unrecognizable and this says so, instead of the animation silently rendering
    // nothing (dev-docs/plans/minification-boundary.md §3). On the checked copy, which keeps unknown
    // keys and has its invalid values already repaired and reported above — so it names exactly the
    // keys this build does not know.
    reportDocumentDiagnostics(doc, '[PxAnimator] createSvgAnimationPlayer');

    // The per-instance override, applied BEFORE anything reads the config. Everything below
    // depends on the final values: `timeline.engine` picks the engine, the content window drives loop
    // expansion and motion-path sampling in `materializeAllInTree`, and `generateNewIds`
    // rewrites binding targets — a late patch would be read by none of them.
    if (override !== undefined) {
        const overridden = applyPlaybackOverride(doc, override);
        for (const w of overridden.warnings) diag.warn(PxDiagnosticKind.usage, PxDiagnosticCode.timelineOverrideIgnored, w);
        doc = overridden.doc;
    }

    // The no-driver rule (first-use review §1+2): without `playOnTrigger` the document must not
    // start itself — the EMPTY trigger goes on AFTER the caller's own override, so nothing re-arms
    // it; the same rule the components' control modes apply. Scroll-driven documents are exempt:
    // scroll IS their named driver, and a clock trigger pushed into a scroll timeline would only
    // be reported as an ignored override.
    if (!playOnTrigger && !isScrollTimeline(getAnimatorConfig(doc))) {
        doc = withoutTriggerDriver(doc);
    }

    // Lower once through the staged pipeline (`prepareDocument`) — the patched doc above is a new,
    // unstamped object, so it is resolved afresh. `resolved` first: the engine is read from the
    // runtime view. `auto` and `native` resolve to the native (WAAPI) materialization; if the
    // native engine later declines the document at construction, the frame loop (`js`) is used
    // as fallback — slight over-materialization for that doc, but no correctness issue.
    const resolved = prepareDocument(doc, { stage: PxDocStage.resolved, onProblems });   // only the override's own values can still need repair
    const engine: PxTimelineEngine = resolveTimelineEngine(getAnimatorConfig(resolved)?.engine);

    // `plain`: effects → offset-path → compiled animations (loops, motion paths) → animated-use + prune
    // (native only) → rest poses. The exact same pipeline is exported for the Editor — no parallel pipeline.
    doc = prepareDocument(resolved, { engine });

    let rootElement: Element | null = null;

    // Render whenever there's a container. A document with no children is still a
    // document — it carries the viewBox/size that make it a viewport — so it renders as an
    // EMPTY `<svg>`. Gating on `doc.children` left `getRootElement()` answering `null`,
    // which a consumer cannot tell apart from "the render failed".
    if (containerElement) {

        doc = prepareDocument(doc, { engine, freshIds: true }); // fresh ids so repeated createSvgAnimationPlayer(...) calls never collide

        const containerEl = typeof containerElement === 'string' ?
            document.querySelector(containerElement) : containerElement;

        if (containerEl) {
            rootElement = renderNode(doc, undefined, diag);
            if (rootElement) {
                containerEl.replaceChildren(rootElement);
            }
        }
    }

    // A caller that rendered the document itself hands over the root it rendered — see
    // `PxInternalAnimationPlayerOptions.rootElement`. A container render above always wins.
    if (!rootElement && providedRoot) rootElement = providedRoot;

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
 * Everything `createSvgAnimationPlayer` takes. The playback override (`timeline`, and the object form of
 * `playOnTrigger`) and the callbacks are core's shared shapes — the SAME names, inline, as the
 * React, Vue and React Native components take (review §9) — so only what is web-specific is
 * declared here.
 * @public
 */
export type PxAnimationPlayerOptions = PxPlaybackOverride & PxAnimationPlayerCallbacks & {
    /**
     * Play on a trigger. `true` — the way the editor saved it: the document's own `timeline.trigger`
     * starts (and gates) playback. An OBJECT — that trigger instead, as a WHOLE (keys left out take the
     * wire defaults, not the file's values). WITHOUT it the player builds still — the first frame is
     * shown, the trigger is replaced by the EMPTY one — and the returned api (`play()`, `setCurrentTime()`)
     * drives it (first-use review §1+2: nothing plays until a line names the driver).
     */
    playOnTrigger?: boolean | PxTrigger;
    /** URL to fetch the animation document from. Provide either this or `doc`, not both. */
    src?: string;
    /** The animation document, inline (see docs/format/README.md) — typed as a JSON import
     *  produces it ({@link PxDocumentInput}), so `import animation from './animation.json'`
     *  passes with no cast. Provide either this or `src`, not both. */
    doc?: PxDocumentInput;
    /** CSS selector or element to render the SVG into. */
    container?: string | Element;
};

/**
 * What the framework COMPONENTS build the player with: the public options plus the `adapter`
 * that routes the frame loop's attribute writes to the elements they rendered themselves.
 *
 * NOT part of the public API (review §25.14). The React and Vue packages are its only callers;
 * `createSvgAnimationPlayer`'s signature says `PxAnimationPlayerOptions` on purpose — a page has a DOM to write
 * to, so for anyone else the option would only be a way to hold the player wrong. Exported as a
 * type so those packages can name it; never documented as an option.
 * @internal
 */
export type PxInternalAnimationPlayerOptions = PxAnimationPlayerOptions & {
    /** A custom render target for the frame-loop engine (`PxPlatformAdapter`). */
    adapter?: PxPlatformAdapter;

    /**
     * The root `<svg>` the CALLER rendered, when it renders the document itself (the React and
     * Vue components). Triggers attach to it — pointer listeners, the visibility gate — and
     * without one they are not wired at all, so even a `load` trigger never fires.
     *
     * Otherwise the engines look the root up as `#` + the document's root id, which finds
     * nothing for the common document whose root `<svg>` has no id. The component already holds
     * the element, so it hands it over rather than have it guessed.
     */
    rootElement?: Element;
};

/** The one place `createSvgAnimationPlayer` reads past its public signature — see `PxInternalAnimationPlayerOptions`. */
function isInternalOptions(options: PxAnimationPlayerOptions): options is PxInternalAnimationPlayerOptions {
    // EITHER internal key. Testing `adapter` alone meant a caller passing only `rootElement` —
    // what the React and Vue components do — had it silently ignored.
    return 'adapter' in options || 'rootElement' in options;
}

/**
 * Creates an animation player for an SVG animation.
 *
 * @param options.src URL to fetch the animation document from.
 * @param options.doc The animation document, inline.
 * @param options.container CSS selector or element to render the SVG into.
 * @returns A PxAnimationPlayerApi instance to programmatically control the animation.
 * @public
 */
export function createSvgAnimationPlayer(options: PxAnimationPlayerOptions): PxAnimationPlayerApi {

    const { src, doc, container } = options;
    const adapter = isInternalOptions(options) ? options.adapter : undefined;
    const providedRoot = isInternalOptions(options) ? options.rootElement : undefined;
    // The registry hears play / pause / … through the engine callbacks, and names the PROXY
    // below — the object the caller holds — never the engine API behind it.
    let proxy: PxAnimationPlayerApi | undefined;
    const callbacks = withRegistryEvents(toEngineCallbacks(options), () => proxy);

    // A wrong CALL throws — a bug at the call site, found the moment the line runs. A document
    // or environment that cannot play is reported through `onError` instead (the rule in core's
    // `PxDiagnostics`, review §25.1): the returned API stays inert and `isReady()` false.
    if (doc !== undefined && src !== undefined) {
        throw new Error('createSvgAnimationPlayer: provide either `src` or `doc`, not both');
    }
    if (doc === undefined && src === undefined) {
        throw new Error('createSvgAnimationPlayer: either `src` or `doc` is required');
    }

    let animator: PxAnimationPlayerApi | null = null;

    // Control calls made before the player exists are queued and replayed (in order) once it
    // is ready, so e.g. `createSvgAnimationPlayer({src}).play()` works as expected. Getters are not
    // queued — they return their "not ready yet" value until then. With `doc` the player is
    // ready before this returns; the same proxy then simply forwards.
    let pending: Array<(api: PxAnimationPlayerApi) => void> | null = [];
    let destroyed = false;

    const enqueue = (call: (api: PxAnimationPlayerApi) => void) => {
        if (animator) {
            call(animator);
        } else if (pending) {
            pending.push(call);
        }
    };

    const diag = createDiagnostics(callbacks, '[PxAnimator]');

    const ready = (api: PxAnimationPlayerApi): void => {
        animator = api;
        const queued = pending;
        pending = null;
        queued?.forEach(call => call(api));
        // `onReady` (review §14) — the push twin of `isReady()`. Always asynchronous, so the
        // `createSvgAnimationPlayer` call has returned and the handler can use the returned api.
        queueMicrotask(() => { if (!destroyed) options.onReady?.(); });
    };
    // The instance will not play: report once, drop the queue, stay inert.
    const failed = (kind: PxDiagnosticKind, code: PxDiagnosticCode, ...data: Array<unknown>): void => {
        pending = null;
        diag.error(kind, code, ...data);
    };
    // Building the player threw: a broken document past validation, or a player bug — never a
    // throw at the caller, which would land inside a fetch callback where no one can catch it.
    const build = (document: PxDocument): void => {
        try {
            ready(createAnimatorImpl(document, adapter, callbacks, container, options, providedRoot, options.playOnTrigger));
        } catch (e) {
            const err = asThrownError(e);
            failed(PxDiagnosticKind.internal, PxDiagnosticCode.buildFailed, err);
        }
    };

    // The proxy: forwards once the player exists, queues control calls until then. Built and
    // listed BEFORE the build, so a `load` trigger's first `play` during construction is
    // announced for it like every later one.
    proxy = {
        "isReady": () => !!animator,
        "getRootElement": () => animator ? animator.getRootElement() : null,
        "isPlaying": () => animator?.isPlaying() || false,
        "play": () => { enqueue(api => api.play()); },
        "pause": () => { enqueue(api => api.pause()); },
        "stop": () => { enqueue(api => api.stop()); },
        "cancel": () => { enqueue(api => api.cancel()); },
        "finish": () => { enqueue(api => api.finish()); },
        "playOnce": () => { enqueue(api => api.playOnce()); },
        "getDuration": () => animator ? animator.getDuration() : null,
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
    // Listed from this moment (`add`) until `destroy()` — a `src` still loading included.
    registerAnimator(proxy);

    if (doc !== undefined) {
        build(toPxDocument(doc));
    } else if (src !== undefined) {   // neither is a thrown call error above
        fetch(src).then(res => res.json()).then(json => {
            if (destroyed) return; // destroy() was called before the document loaded
            if (isPxDocument(json)) build(json);
            else failed(PxDiagnosticKind.document, PxDiagnosticCode.invalidDocumentAtSrc, src);
        }).catch(err => {
            // `host`, not `document`: the file may be perfect — the page could not fetch it.
            failed(PxDiagnosticKind.host, PxDiagnosticCode.loadFailed, src, err?.message ?? String(err));
        });
    }

    return proxy;
}

/**
 * Everything `createSvgAnimationPlayer` takes except the three the tag supplies (`src`, `container`) or
 * forbids (`data`): callbacks, the diagnostics channel, the playback override.
 * @public
 */
export type PxPageAnimationPlayerOptions = PxPlaybackOverride & PxAnimationPlayerCallbacks & {
    /** One trigger for EVERY player this call creates, instead of each file's own — the whole block. Absent: each file's. */
    playOnTrigger?: PxTrigger;
};

/**
 * Scan the page for `<div data-px-animation-src="animation.json">` and create one player per
 * match, rendered into that element. Safe to call repeatedly: elements that already carry a
 * player are skipped. Returns the players THIS call created; {@link getSvgAnimationPlayer} finds one later.
 *
 * `options` applies to EVERY player this call creates (review §15) — the same callbacks, the
 * same override. Omit it for the zero-config path.
 * @public
 */
export function createSvgAnimationPlayersFromPage(options?: PxPageAnimationPlayerOptions): Array<PxAnimationPlayerApi> {
    const created: Array<PxAnimationPlayerApi> = [];
    const elements = document.querySelectorAll('[' + PX_ANIM_SRC_ATTR_NAME + ']');
    for (let i = 0; i < elements.length; i++) {
        const element: PxTagElement = elements[i];
        if (!element[PX_ANIM_ATTR_NAME]) {
            const src = element.getAttribute(PX_ANIM_SRC_ATTR_NAME);
            if (src) {
                // A tag embeds a finished file: the file IS the driver — unless the call names one trigger for every player.
                const api = createSvgAnimationPlayer({ ...options, src, container: element, playOnTrigger: options?.playOnTrigger ?? true });
                element[PX_ANIM_ATTR_NAME] = api;
                created.push(api);
            }
        }
    }
    return created;
}

/**
 * The player {@link createSvgAnimationPlayersFromPage} created in `element`, or `undefined` when it has none.
 * @public
 */
export function getSvgAnimationPlayer(element: Element): PxAnimationPlayerApi | undefined {
    const tagged: PxTagElement = element;
    return tagged[PX_ANIM_ATTR_NAME];
}

/** A `data-px-animation-src` element: the player `createSvgAnimationPlayersFromPage` created is kept ON it, so a second call skips it. */
interface PxTagElement extends Element {
    [PX_ANIM_ATTR_NAME]?: PxAnimationPlayerApi;
}

// No module-level globals (API review §4). This file used to end by assigning
// `window.createSvgAnimationPlayer` / `loadTagSvgAnimators` (now `createSvgAnimationPlayersFromPage`) / `setupAnimationTriggers` whenever it loaded —
// for every ESM and CJS consumer too, not just `<script>` pages. That could overwrite a page's
// own `createSvgAnimationPlayer`, and the side effect made the whole module untree-shakable.
//
// `<script>` users reach all three through `Pixodesk.SvgAnimator.*` on the UMD build, which is what
// the editor's exported SVG+JS calls. Older exported files are unaffected: they inline their own
// player and assign these names themselves.