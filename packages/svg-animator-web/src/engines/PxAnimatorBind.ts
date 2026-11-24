// @px-area engine
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { PX_DEFAULT_TIMELINE, getAnimatorConfig, toPxDocument, type PxRunListProps, type PxDocumentJson, PxDiagnosticCode, PxDiagnosticKind, PxPlaybackState, PxTimelineEngineSetting, type PxDocument, type PxAnimatorRuntimeConfig, type PxAnimationPlayerCallbacks, type PxCommonControlProps, type PxEngineCallbacks, type PxPlayExecutor, type PxTimelineControls } from '@pixodesk/svg-animator-core';
import { applyPlaybackOverride, composeApiExtras, isNativeForced, type PxRunLists, mayUseNativeScrollTimeline, PxControlMode, PxPlaybackWrite, PxVariablesRuntime, resolveControlMode, withControlMode, type PxPlatformAdapter } from '@pixodesk/svg-animator-core/engine';
import { createDiagnostics, isScrollTimeline, scrollTotalDurationMs } from '@pixodesk/svg-animator-core/internal';
import { asThrownError, createInertAnimator, toEngineCallbacks, toPlayerCallbacks } from '../shared/PxAnimatorCallbacks';
import type { PxPlayerCallbacks } from '../shared/PxAnimatorCallbacks';
import { registerAnimator, withRegistryEvents } from '../registry/PxAnimatorRegistry';
import { createFrameLoopAnimator } from './PxAnimatorFrameLoop';
import { webRaf } from '../shared/PxWebRaf';
import { bindPlanned, type PxPrerenderedVariables } from './PxAnimatorUnits';
import type { PxAnimationPlayerApi, PxBoundPlayerApi, PxEngineAnimationPlayerApi, PxPlayerEngineApi } from '../shared/PxAnimatorWebTypes';
import { createWebApiAnimator } from './PxAnimatorWebApi';
import { applyHoldOnScreen, createNativeScrollTimeline, createScrollDriver } from '../scroll/PxScrollDriver';

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
 * A scroll timeline never starts, pauses or finishes (D3): no playback event is told, and the engine's end is no finish.
 */
export function finaliseAnimator(
    animatorConfig: PxAnimatorRuntimeConfig,
    callbacks: PxPlayerCallbacks | undefined,
    make: (engineCallbacks?: PxEngineCallbacks) => PxEngineAnimationPlayerApi<Element>,
    triggersByFlow?: boolean,
): PxBoundPlayerApi {

    const told = tellsPlaybackEvents(animatorConfig);
    const listeners = told ? callbacks : undefined;
    let executor: PxPlayExecutor | undefined;
    const engineCallbacks: PxEngineCallbacks = {
        ...toEngineCallbacks(callbacks),
        // the playback events ride along for the executor the engine's own triggers press (a `load` start happens inside
        // `make`, before `composeApiExtras` could attach them); the engine never fires them itself
        playbackListeners: listeners,
        onFinish: told ? () => { executor?.onNaturalFinish(); } : undefined,
        triggersByFlow,
    };

    // `playback` (the buttons, the seeks, the reads) is composed ON TOP of the engine — the one shared rule (review
    // §10, D5); the playback events are the executor's to tell (when it performs the act), never the engine's
    const res = composeApiExtras(make(engineCallbacks), { ...animatorConfig, playbackListeners: listeners }, webRaf);
    executor = res.playExecutor;
    // no timeline by id until the binder that knows the document says which (`bindWithEngineChoice`)
    const built: PxBoundPlayerApi = Object.assign(res, { getTimeline: (): PxTimelineControls | undefined => undefined });

    // the file's `playbackSpeed` is set on the engine inside `composeApiExtras`; scroll owns its pace (no speed there)
    return built;
}

/** The playback events (`onPlaybackStart` … `onPlaybackFinish`) are told — not on a scroll timeline, which never starts
 *  or finishes: the playhead only moves inside 0–1 (D3). */
function tellsPlaybackEvents(animatorConfig: PxAnimatorRuntimeConfig): boolean {
    return !isScrollTimeline(animatorConfig);
}

// @px-importance important
/**
 * Picks the engine the way the full player does, from `timeline.engine`: `player` pins the
 * frame loop; otherwise waapi, with a frames fallback for unsupported attrs unless
 * `native` demands waapi. `mode` `static` (`showAsStatic`) builds the engine but never lets anything move it: no
 * scroll attached, every playback call ignored with a warning (PX1506). `followed`: an element page code handed over in
 * `timelineOptions.follows` — what a scroll timeline follows.
 */
export function bindWithEngineChoice(
    doc: PxDocument,
    adapter?: PxPlatformAdapter,
    callbacks?: PxPlayerCallbacks,
    rootElement?: Element | null,
    mode: PxControlMode = PxControlMode.actions,
    followed?: Element,
    triggersByFlow?: boolean,
): PxBoundPlayerApi {
    // One channel for everything this binder and the scroll driver have to say (review §5).
    const diag = createDiagnostics(callbacks, '[PxAnimator]');
    const api = mode === PxControlMode.static ? guardStaticPlayback(diag, bindEngine(doc, adapter, callbacks, rootElement, diag, false, undefined, triggersByFlow))
        : bindEngine(doc, adapter, callbacks, rootElement, diag, true, followed, triggersByFlow);
    // one timeline — the default one: `getTimeline(PX_DEFAULT_TIMELINE)` finds it (2026-11-22)
    api.getTimeline = (id) => (id === PX_DEFAULT_TIMELINE ? api.timeline : undefined);
    return api;
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
    followed?: Element,
    triggersByFlow?: boolean,
): PxBoundPlayerApi {
    const animatorConfig = getAnimatorConfig(doc) || {};

    // Scroll-driven document: the playhead follows scroll position, never the wall
    // clock. One knob — `timeline.engine` — picks the row (scroll-timeline.design.md §4.0):
    //   player → the player measures progress, frames applies values (`setCurrentTime`)
    //   native → browser ScrollTimeline/ViewTimeline drives waapi (compositor thread)
    //   auto   → native first; when unsupported, the player measures and waapi (or
    //            frames, if waapi declines the doc) applies — the fallback cascade (D8)
    // Triggers are inert either way (D3 — both engines warn + skip
    // `setupAnimationTriggers` for scroll docs). The animator is never `play()`ed by us
    // for custom driving; scrubbing via the engine's own `setTotalTime` holds the pose.
    if (followScroll && isScrollTimeline(animatorConfig)) {
        return guardScrollDrivenPlayback(diag, finaliseAnimator(animatorConfig, callbacks, cb => {

            // `holdOnScreen` — hold the canvas on screen for the scrubbed stretch (`position: sticky`,
            // + an optional tall wrapper the player injects). MUST be applied before anything
            // measures: it changes the very geometry the timeline reads, and the held section
            // is meant to resolve THROUGH the injected wrapper.
            let unpin = () => { /* nothing held */ };

            // `auto` / `native`: try the browser's own timeline first.
            if (mayUseNativeScrollTimeline(animatorConfig.engine) && rootElement) {
                unpin = applyHoldOnScreen(rootElement, animatorConfig.scroll);
                const native = createNativeScrollTimeline(rootElement, animatorConfig, diag, followed);
                if (native) {
                    const api = createWebApiAnimator(doc, cb, rootElement,
                        isNativeForced(animatorConfig.engine), native, triggersByFlow);
                    if (api) {
                        const destroyNative = api.destroy.bind(api);
                        api.destroy = () => { unpin(); destroyNative(); };
                        return api;
                    }
                    // unsupported attrs → fall through to frames + custom below
                }
                unpin();                        // …and undo the hold so the fallback re-applies it
                unpin = () => { /* held again below */ };
            }

            // The player measures progress (the reference implementation). Engine per
            // `mode`: waapi unless `player` pins frames or waapi declines the doc.
            const api = (
                animatorConfig.engine !== PxTimelineEngineSetting.js
                    ? createWebApiAnimator(doc, cb, rootElement, isNativeForced(animatorConfig.engine), undefined, triggersByFlow)
                    : null
            ) || createFrameLoopAnimator(doc, adapter, cb, rootElement);

            // The animator knows its real root — for an SVG+JS export the runtime binds to the
            // `<svg>` already in the document, which is NOT the container passed in. Hold and
            // measure the same element, or the hold lands on nothing (it silently did).
            const root = api.getRootElement?.() || rootElement;
            if (root) {
                unpin = applyHoldOnScreen(root, animatorConfig.scroll);
                const totalMs = scrollTotalDurationMs(animatorConfig);
                // the ENGINE's own seek — the public seeks are ignored on a scroll timeline (D16); the driver owns the playhead
                const driver = createScrollDriver(root, animatorConfig,
                    progress => api.setTotalTime(progress * totalMs), diag, followed);
                if (driver) {
                    // Tie the driver's (and the hold's) lifetime to the animator's.
                    const destroy = api.destroy.bind(api);
                    api.destroy = () => { driver.destroy(); unpin(); destroy(); };
                }
            } else {
                diag.warn(PxDiagnosticKind.host, PxDiagnosticCode.scrollNoRootToObserve);
            }
            return api;
        }, triggersByFlow));
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
                isNativeForced(animatorConfig.engine), undefined, triggersByFlow,
            ) ||
            createFrameLoopAnimator(doc, adapter, cb, rootElement)
        );
    }, triggersByFlow);
}

/** On a scroll timeline the scrolling owns the playhead, on every engine:
 *  - the state reads `scrubbing` (D3) — never playing, paused or finished; `destroyed` after `destroy()`
 *  - the buttons, the speed and the seeks are no-ops that say so (PX1505 `scrollOwnsPlayhead`, D16); the reads answer
 *  - the driver moves the engine's own clock, which no guard touches */
function guardScrollDrivenPlayback<T extends PxPlayerEngineApi>(diag: ReturnType<typeof createDiagnostics>, api: T): T {
    const ignored = (call: PxPlaybackWrite) => (): void => diag.warn(PxDiagnosticKind.usage, PxDiagnosticCode.scrollOwnsPlayhead, call);
    const playback = api.timeline;
    let destroyed = false;
    playback.getState = () => destroyed ? PxPlaybackState.destroyed : PxPlaybackState.scrubbing;
    playback.isActive = () => false;
    playback.isPlaying = () => false;
    playback.start = ignored(PxPlaybackWrite.start);
    playback.stop = ignored(PxPlaybackWrite.stop);
    playback.pause = ignored(PxPlaybackWrite.pause);
    playback.resume = ignored(PxPlaybackWrite.resume);
    playback.play = ignored(PxPlaybackWrite.play);
    playback.setSpeed = ignored(PxPlaybackWrite.setSpeed);
    playback.setDurationAtSpeed = ignored(PxPlaybackWrite.setDurationAtSpeed);
    playback.setCurrentTime = ignored(PxPlaybackWrite.setCurrentTime);
    playback.setCurrentProgress = ignored(PxPlaybackWrite.setCurrentProgress);
    playback.setTotalTime = ignored(PxPlaybackWrite.setTotalTime);
    const destroyApi = api.destroy.bind(api);
    api.destroy = () => { destroyed = true; destroyApi(); };
    return api;
}

/** `showAsStatic`: the picture stays as drawn — every playback write is a no-op that says so (PX1506
 *  `showAsStaticIgnoresCall`); the reads answer from the engine, which never moves. */
function guardStaticPlayback<T extends PxPlayerEngineApi>(diag: ReturnType<typeof createDiagnostics>, api: T): T {
    const ignored = (call: PxPlaybackWrite) => (): void => diag.warn(PxDiagnosticKind.usage, PxDiagnosticCode.showAsStaticIgnoresCall, call);
    const playback = api.timeline;
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
 * document's own `actions` decide — the way the editor saved it.
 * @public
 */
export interface PxPrerenderedAnimationPlayerOptions extends PxAnimationPlayerCallbacks, PxCommonControlProps, PxRunListProps {
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
        showAsStatic: options.showAsStatic, disableActions: options.disableActions, actions: options.actions,
    });
    const diag = createDiagnostics(options, '[PxAnimator]');
    for (const w of control.warnings) diag.warn(PxDiagnosticKind.usage, PxDiagnosticCode.controlPropsConflict, w);
    const overridden = applyPlaybackOverride(requireDoc(options), { actions: options.actions });
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
function buildOrReport(options: PxPrerenderedAnimationPlayerOptions, build: () => PxPlayerEngineApi): PxPlayerEngineApi {
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
    // planned as the full player plans it (2026-11-22): flows side by side, one step's playback live in each
    const runtime = prerenderedVariablesOf(options);
    return registered(options, runtime, callbacks => buildOrReport(options, () => bindPlanned(doc,
        (d, cb, followed, byFlow) => bindWithEngineChoice(d, undefined, cb, null, mode, followed, byFlow), callbacks, undefined, runListsOf(options),
        showOneOfVariables(runtime))));
}

/** A pre-rendered player's variables: the document's declarations. A value set is stored; only `showOneOf` draws it. */
function prerenderedVariablesOf(options: PxPrerenderedAnimationPlayerOptions): PxVariablesRuntime {
    return new PxVariablesRuntime(toPxDocument(options.document), undefined, createDiagnostics(options, '[PxAnimator]'));
}

/** What `showOneOf` (1.32) reads of a pre-rendered player's variables — a bound `which`, again on every change. */
function showOneOfVariables(runtime: PxVariablesRuntime): PxPrerenderedVariables {
    return {
        read: name => runtime.valueOf(name),
        onChange: listener => { runtime.attach(() => { runtime.takeChanges(); webRaf(listener); }); },
    };
}

/**
 * The page-wide registry (`getAllSvgAnimationPlayers()`) for the pre-rendered builds: the returned
 * API is enrolled — a build that failed (the inert API, `isReady()` false) is not — and hears
 * the playback events and the finish through the callbacks the player is given.
 */
function registered(options: PxPrerenderedAnimationPlayerOptions, runtime: PxVariablesRuntime, build: (callbacks: PxPlayerCallbacks) => PxPlayerEngineApi): PxAnimationPlayerApi {
    let apiRef: PxAnimationPlayerApi | undefined;
    // A pre-rendered SVG has its values baked in by the editor: `variables` reads the document's declarations, and
    // a value set here is stored but not drawn (accepted limit — the JSON player draws every change) — but `showOneOf`
    // (1.32) follows a bound `which` (`showOneOfVariables`).
    const variables = runtime.api;
    const api: PxAnimationPlayerApi = { ...build(withRegistryEvents(toPlayerCallbacks(options), () => apiRef)), variables };
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
    const runtime = prerenderedVariablesOf(options);
    // planned as the full player plans it (2026-11-22) — every step on WAAPI alone, so no frame loop is linked
    return registered(options, runtime, callbacks => buildOrReport(options, () => bindPlanned(doc, (d, cb, _followed, byFlow) => {
        const api = finaliseAnimator(getAnimatorConfig(d) || {}, cb, ecb => createWebApiAnimator(d, ecb, null, true, undefined, byFlow), byFlow);
        return mode === PxControlMode.static ? guardStaticPlayback(createDiagnostics(cb, '[PxAnimator]'), api) : api;
    }, callbacks, undefined, runListsOf(options), showOneOfVariables(runtime))));
}

/** The page's lists of what runs (2026-11-22), from the options. */
function runListsOf(options: PxRunListProps): PxRunLists {
    return { flows: options.flows, timelines: options.timelines };
}
