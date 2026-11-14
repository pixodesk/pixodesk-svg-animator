// @px-area entry
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { toPxDocument, type PxDocumentJson, generateNewIds, getAnimatorConfig, isPxDocument, prepareDocument, PxDocStage, PxDiagnosticCode, PxDiagnosticKind, PxPlaybackState, type PxTimelineEngine, type PxDocument, type PxAnimationPlayerCallbacks, type PxPlaybackOverride, type PxPlaybackOverrideInput, type PxCommonControlProps, type PxVariablesApi, type PxVariablesOptions, type PxPlaybackControls } from '@pixodesk/svg-animator-core';
import { withControlMode, applyPlaybackOverride, resolveTimelineEngine, forwardPlaybackControls, resolveControlMode, PxVariablesRuntime, withActionTriggers, triggerEventList, type PxControlMode, type PxResolvedControlMode, type PxPlatformAdapter } from '@pixodesk/svg-animator-core/engine';
import { reportDocumentProblems, validateDeprecatedTransformChannels } from '@pixodesk/svg-animator-core/internal';
import { reportDocumentDiagnostics, createDiagnostics, PX_ANIM_ATTR_NAME, PX_DOCUMENT_ATTR_NAME } from '@pixodesk/svg-animator-core/internal';
import { asThrownError, toPlayerCallbacks } from '../shared/PxAnimatorCallbacks';
import type { PxPlayerCallbacks } from '../shared/PxAnimatorCallbacks';
import { registerAnimator, withRegistryEvents } from '../registry/PxAnimatorRegistry';
import { bindWithEngineChoice } from '../engines/PxAnimatorBind';
import { renderNode } from '../dom/PxAnimatorDOM';
import { setupAnimationTriggers } from '../triggers/PxAnimatorTriggers';
import type { PxAnimationPlayerApi, PxPlayerEngineApi } from '../shared/PxAnimatorWebTypes';
import { PxWebVariables } from '../variables/PxWebVariables';

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
    mode: PxControlMode,
    adapter?: PxPlatformAdapter,
    callbacks?: PxPlayerCallbacks,
    rootElement?: Element | null
): PxPlayerEngineApi {
    return bindWithEngineChoice(doc, adapter, callbacks, rootElement, mode);
}

/** One build of the player: the engine api, the document as rendered (materialized, fresh ids) and its root. */
interface PxBuiltPlayer {
    readonly api: PxPlayerEngineApi;
    readonly doc: PxDocument;
    readonly root: Element | null;
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
 * @param callbacks Optional object with callback functions for the lifecycle events (the playback events, finish, etc.).
 * @param containerElement Optional selector or element to render the SVG into.
 * @param providedRoot The root `<svg>` a caller rendered itself — used when there is no container.
 * @param mode The control mode the options picked (core `resolveControlMode`).
 * @param renderIntoProvidedRoot A rebuild for a root the caller rendered: the new content replaces the root's
 *        children (the root element itself, and the attributes its framework set, stay).
 * @returns The build: the engine api, the document as rendered, its root.
 */
function createAnimatorImpl(
    doc: PxDocument,
    mode: PxControlMode,
    adapter?: PxPlatformAdapter,
    callbacks?: PxPlayerCallbacks,
    containerElement?: string | Element,
    override?: PxPlaybackOverrideInput,
    providedRoot?: Element,
    renderIntoProvidedRoot?: boolean,
): PxBuiltPlayer {

    // Everything this player has to say goes through one channel (API review §5): the caller's
    // `onWarning` / `onError` if given, the console otherwise — unless `suppressWarnings` / `suppressErrors` switch it off.
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
    // keys this build does not know. Through the player's channel: `onWarning` gets it, `suppressWarnings` mutes it.
    reportDocumentDiagnostics(doc, '[PxAnimator] createSvgAnimationPlayer', diag);

    // The per-instance override, applied BEFORE anything reads the config. Everything below
    // depends on the final values: `timeline.engine` picks the engine, the content window drives loop
    // expansion and motion-path sampling in `materializeAllInTree`, and `generateNewIds`
    // rewrites binding targets — a late patch would be read by none of them.
    if (override !== undefined) {
        const overridden = applyPlaybackOverride(doc, override);
        for (const w of overridden.warnings) diag.warn(PxDiagnosticKind.usage, PxDiagnosticCode.timelineOverrideIgnored, w);
        doc = overridden.doc;
    }

    // The control mode, AFTER the caller's own override, so nothing re-arms what it switched off: `static` → the
    // picture as drawn; `manual` → no triggers; the default → the file's own triggers, or the block given.
    doc = withControlMode(doc, mode);

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
    // `PxInternalAnimationPlayerOptions.rootElement`. A container render above always wins. A rebuild (variables)
    // renders the new content into that root itself: its children are replaced, the element stays.
    if (!rootElement && providedRoot) {
        if (renderIntoProvidedRoot) {
            doc = prepareDocument(doc, { engine, freshIds: true });
            const fresh = renderNode(doc, undefined, diag);
            if (fresh) providedRoot.replaceChildren(...Array.from(fresh.childNodes));
        }
        rootElement = providedRoot;
    }

    const api = createAnimatorFromConfig(doc, mode, adapter, callbacks, rootElement);

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

    return { api, doc, root: rootElement };
}

// Re-exported so this module's public surface is unchanged; declared in
// `PxAnimatorKeys` so entries can use it without importing this module. See there.
export { PX_ANIMATOR_DOC_KEY } from '../shared/PxAnimatorKeys';

/**
 * Everything `createSvgAnimationPlayer` takes. The playback override (`timelineOptions`, `actions`), the control
 * options (`showAsStatic`, `disableActionTriggers`, `actionTriggers`) and the callbacks are core's shared shapes —
 * the SAME names, inline, as the React, Vue and React Native components take (review §9) — so only what is
 * web-specific is declared here. With no control option the file plays the way the editor saved it: its own
 * `timeline.actionTriggers` start (and gate) playback.
 * @public
 */
export type PxAnimationPlayerOptions = PxPlaybackOverride & PxCommonControlProps & PxVariablesOptions & PxAnimationPlayerCallbacks & {
    /** The animation document: a URL to fetch it from, or the document itself (see docs/format/README.md) — typed as a
     *  JSON import produces it ({@link PxDocumentJson}), so `import animation from './animation.json'` passes with no
     *  cast. A string is always a URL. (`src` / `doc` until 1.25 — two names for one thing.) */
    document: string | PxDocumentJson;
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

    /**
     * The variables of a component that rendered the document itself (React, Vue): it resolved the document with
     * them before rendering, so the player takes them over instead of reading `document` again — the same values,
     * the same marked nodes.
     */
    variablesRuntime?: PxVariablesRuntime;
};

/** The one place `createSvgAnimationPlayer` reads past its public signature — see `PxInternalAnimationPlayerOptions`. */
function isInternalOptions(options: PxAnimationPlayerOptions): options is PxInternalAnimationPlayerOptions {
    // ANY internal key. Testing `adapter` alone meant a caller passing only `rootElement` —
    // what the React and Vue components do — had it silently ignored.
    return 'adapter' in options || 'rootElement' in options || 'variablesRuntime' in options;
}

/** A playback state carried across a rebuild (§7: a change never seeks, pauses or restarts the animation). */
interface PxPlaybackSnapshot {
    readonly state: PxPlaybackState;
    readonly time: number;
    readonly speed: number;
}

function snapshotOf(playback: PxPlaybackControls): PxPlaybackSnapshot {
    return { state: playback.getState(), time: playback.getTotalTime() ?? 0, speed: playback.getSpeed() };
}

/** Puts a fresh build where the old one was — the state, the time and the speed. A finished playback comes back
 *  paused at its last frame (accepted limit: the executor's `finished` cannot be set from outside). */
function restorePlayback(playback: PxPlaybackControls, s: PxPlaybackSnapshot): void {
    if (s.speed !== 1) playback.setSpeed(s.speed);
    switch (s.state) {
        case PxPlaybackState.playing:
        case PxPlaybackState.returning:
            playback.start();
            if (s.time) playback.setTotalTime(s.time);
            break;
        case PxPlaybackState.paused:
            playback.start();
            playback.setTotalTime(s.time);
            playback.pause();
            break;
        case PxPlaybackState.finished:
            playback.setTotalTime(s.time);
            break;
        default:
            break;
    }
}

/** The document without `load` in its start and play lists — a rebuild must not start the animation again. */
function withoutLoadTriggers(doc: PxDocument): PxDocument {
    const triggers = getAnimatorConfig(doc)?.actionTriggers;
    if (!triggers) return doc;
    const start = triggerEventList(triggers['playback.start']).filter(e => e !== 'load');
    const play = triggerEventList(triggers['playback.play']).filter(e => e !== 'load');
    return withActionTriggers(doc, { ...triggers, 'playback.start': start, 'playback.play': play });
}

/** The callbacks, silent while `muted()` — a rebuild's own starts, pauses and destroy are not the caller's events. */
function mutedWhile(callbacks: PxPlayerCallbacks, muted: () => boolean, onActivity: () => void): PxPlayerCallbacks {
    const gate = <A extends Array<unknown>>(fn: ((...args: A) => void) | undefined) =>
        (...args: A): void => { onActivity(); if (!muted()) fn?.(...args); };
    return {
        ...callbacks,
        onPlaybackStart: gate(callbacks.onPlaybackStart),
        onPlaybackStop: gate(callbacks.onPlaybackStop),
        onPlaybackPause: gate(callbacks.onPlaybackPause),
        onPlaybackResume: gate(callbacks.onPlaybackResume),
        onPlaybackFinish: gate(callbacks.onPlaybackFinish),
        onDestroy: (...args) => { if (!muted()) callbacks.onDestroy?.(...args); },
    };
}

/**
 * Creates an animation player for an SVG animation.
 *
 * @param options.document The animation document — a URL to fetch it from, or the document itself.
 * @param options.container CSS selector or element to render the SVG into.
 * @returns A PxAnimationPlayerApi instance to programmatically control the animation.
 * @public
 */
export function createSvgAnimationPlayer(options: PxAnimationPlayerOptions): PxAnimationPlayerApi {

    const { container } = options;
    // `document` is the page's too: the option is read once, under another name
    const source = options.document;
    const adapter = isInternalOptions(options) ? options.adapter : undefined;
    const providedRoot = isInternalOptions(options) ? options.rootElement : undefined;
    // The registry hears the playback events and the finish through the player callbacks, and names the PROXY
    // below — the object the caller holds — never the engine API behind it.
    let proxy: PxAnimationPlayerApi | undefined;
    const callbacks = withRegistryEvents(toPlayerCallbacks(options), () => proxy);
    // ONE control-mode rule (core), the web player's three options of it
    const control: PxResolvedControlMode = resolveControlMode({
        showAsStatic: options.showAsStatic, disableActionTriggers: options.disableActionTriggers, actionTriggers: options.actionTriggers,
    });

    // A wrong CALL throws — a bug at the call site, found the moment the line runs. A document
    // or environment that cannot play is reported through `onError` instead (the rule in core's
    // `PxDiagnostics`, review §25.1): the returned API stays inert and `isReady()` false.
    if (source === undefined || source === null) {
        throw new Error('createSvgAnimationPlayer: `document` is required — a URL, or the document itself');
    }

    let animator: PxPlayerEngineApi | null = null;
    // Variables (docs/library/variables.md): the runtime holds the values, the web side draws them; created with the
    // document, so calls made before then wait — and land before the first paint
    const providedRuntime = isInternalOptions(options) ? options.variablesRuntime : undefined;
    let runtime: PxVariablesRuntime | undefined;
    let variables: PxWebVariables | undefined;
    let pendingVariables: Array<(api: PxVariablesApi) => void> = [];
    let muted = false;

    // Control calls made before the player exists are queued and replayed (in order) once it
    // is ready, so e.g. `createSvgAnimationPlayer({ document: url }).playback.start()` works as expected. Getters are not
    // queued — they return their "not ready yet" value until then. With an inline document the player is
    // ready before this returns; the same proxy then simply forwards.
    let pending: Array<(api: PxPlayerEngineApi) => void> | null = [];
    let destroyed = false;

    const enqueue = (call: string, run: (api: PxPlayerEngineApi) => void) => {
        if (destroyed) {
            // a call on a destroyed player is a no-op, said once per call — `playback.getState()` reads `destroyed`
            diag.warn(PxDiagnosticKind.usage, PxDiagnosticCode.callAfterDestroy, call);
        } else if (animator) {
            run(animator);
        } else if (pending) {
            pending.push(run);
        }
    };

    const diag = createDiagnostics(callbacks, '[PxAnimator]');
    for (const w of control.warnings) diag.warn(PxDiagnosticKind.usage, PxDiagnosticCode.controlPropsConflict, w);

    const ready = (api: PxPlayerEngineApi): void => {
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
    const engineCallbacks = mutedWhile(callbacks, () => muted, () => variables?.onPlaybackActivity());
    const build = (document: PxDocument): void => {
        try {
            const rt = providedRuntime ?? new PxVariablesRuntime(document, options, diag);
            runtime = rt;
            for (const call of pendingVariables) call(rt.api);
            pendingVariables = [];
            rt.takeChanges();   // the first build reads them all
            // a component that rendered the document passes the document it rendered: resolved already
            const toBuild = providedRuntime || !rt.hasVariables() ? document : rt.resolvedDocument(true);
            const first = createAnimatorImpl(toBuild, control.mode, adapter, engineCallbacks, container, options, providedRoot);
            if (rt.hasVariables()) {
                variables = new PxWebVariables(rt, { playback: () => animator?.playback, rebuild });
                variables.bind(first.doc, first.root);
            }
            ready(first.api);
        } catch (e) {
            const err = asThrownError(e);
            failed(PxDiagnosticKind.internal, PxDiagnosticCode.buildFailed, err);
        }
    };

    // A change direct writes cannot make (an effect's setting, an animated default switching): the player is built
    // again from the runtime's current document, in the same place, its playback state and time carried over.
    function rebuild(): void {
        const previous = animator;
        const rt = runtime;
        if (!previous || !rt || destroyed) return;
        const snapshot = snapshotOf(previous.playback);
        muted = true;
        try {
            const doc = withoutLoadTriggers(rt.resolvedDocument(true));
            const quiet: PxPlayerCallbacks = { ...engineCallbacks, onWarning: undefined, suppressWarnings: true };
            const next = createAnimatorImpl(doc, control.mode, adapter, quiet, container, options, providedRoot, !container);
            previous.destroy();
            animator = next.api;
            restorePlayback(next.api.playback, snapshot);
            variables?.bind(next.doc, next.root);
        } catch (e) {
            diag.error(PxDiagnosticKind.internal, PxDiagnosticCode.buildFailed, asThrownError(e));
        } finally {
            muted = false;
        }
    }

    // `player.variables` — forwards once the runtime exists; writes made earlier wait for it
    const withVariables = (run: (api: PxVariablesApi) => void): void => {
        if (destroyed) diag.warn(PxDiagnosticKind.usage, PxDiagnosticCode.callAfterDestroy, 'variables');
        else if (runtime) run(runtime.api);
        else pendingVariables.push(run);
    };
    const variablesApi: PxVariablesApi = {
        get: name => runtime?.api.get(name),
        set: (name, value) => withVariables(api => api.set(name, value)),
        setVariables: values => withVariables(api => api.setVariables(values)),
        getAll: () => runtime?.api.getAll() ?? {},
        getKeys: () => runtime?.api.getKeys() ?? [],
        reset: name => withVariables(api => api.reset(name)),
        getDefinitions: () => runtime?.api.getDefinitions() ?? {},
        setVariant: name => withVariables(api => api.setVariant(name)),
        getVariant: () => runtime ? runtime.api.getVariant() : (options.variant ?? null),
        getVariantKeys: () => runtime?.api.getVariantKeys() ?? [],
    };

    // The proxy: forwards once the player exists, queues control calls until then. Built and
    // listed BEFORE the build, so a `load` trigger's first `play` during construction is
    // announced for it like every later one.
    proxy = {
        // ONE forwarder for every wrapper (core `forwardPlaybackControls`): reads give their not-ready value until the
        // player exists, writes go through the queue
        "playback": forwardPlaybackControls(
            () => animator?.playback,
            (call, run) => enqueue(call, api => { run(api.playback); variables?.onPlaybackActivity(); }),
            () => destroyed ? PxPlaybackState.destroyed : PxPlaybackState.off),
        "variables": variablesApi,
        "isReady": () => !!animator,
        "getRootElement": () => animator ? animator.getRootElement() : null,
        "destroy": () => {
            destroyed = true;
            pending = null; // drop any queued calls
            pendingVariables = [];
            variables?.destroy();
            animator?.destroy();
        }
    };
    // Listed from this moment (`add`) until `destroy()` — a URL still loading included.
    registerAnimator(proxy);

    if (typeof source !== 'string') {
        build(toPxDocument(source));
    } else {
        const src = source;
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
 * Everything `createSvgAnimationPlayer` takes except the two the tag supplies (`document`, `container`): callbacks, the
 * diagnostics channel, the playback override.
 * @public
 */
export type PxPageAnimationPlayerOptions = PxPlaybackOverride & PxCommonControlProps & PxVariablesOptions & PxAnimationPlayerCallbacks;

/**
 * Scan the page for `<div data-px-document="animation.json">` and create one player per
 * match, rendered into that element. Safe to call repeatedly: elements that already carry a
 * player are skipped. Returns the players THIS call created; {@link getSvgAnimationPlayer} finds one later.
 *
 * `options` applies to EVERY player this call creates (review §15) — the same callbacks, the
 * same override. Omit it for the zero-config path.
 * @public
 */
export function createSvgAnimationPlayersFromPage(options?: PxPageAnimationPlayerOptions): Array<PxAnimationPlayerApi> {
    const created: Array<PxAnimationPlayerApi> = [];
    const elements = document.querySelectorAll('[' + PX_DOCUMENT_ATTR_NAME + ']');
    for (let i = 0; i < elements.length; i++) {
        const element: PxTagElement = elements[i];
        if (!element[PX_ANIM_ATTR_NAME]) {
            const url = element.getAttribute(PX_DOCUMENT_ATTR_NAME);
            if (url) {
                // A tag embeds a finished file: the file drives, as on every surface — unless the options say otherwise for every player.
                const api = createSvgAnimationPlayer({ ...options, document: url, container: element });
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

/** A `data-px-document` element: the player `createSvgAnimationPlayersFromPage` created is kept ON it, so a second call skips it. */
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