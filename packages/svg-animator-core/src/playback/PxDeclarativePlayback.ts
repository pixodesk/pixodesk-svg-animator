// @px-area control
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// ============================================================================
// THE PLAY EXECUTOR — one implementation of the four buttons for every driver
// (dev-docs/plans/playback-layers.md, dev-docs/plans/animation-state.brainstorm.md): the `playRun` prop, the
// triggers' event lists and the imperative api all end up here. The timeline's `actions` say HOW (`startRun` /
// `stopRun`), `atEnd` what the end of the pass does; the executor performs them on any engine api, owns the
// states the engines cannot tell apart — OFF versus PAUSED versus FINISHED versus RETURNING — so the state rule can
// be applied, and tells the run events (`onRunStart` / `onRunStop` / `onRunPause` / `onRunResume`) when it performs
// the act — never the engine's raw `onPlay` / `onPause`, which the gate's hold and a jump's internal pause also fire.
//
// The run (schema 1.24): one instance of the animation being in effect — `startRun` begins it, it lasts while
// `playing` · `paused` · `finished`, `stopRun` or `atEnd: jumpToStart` / `animateToStart` retire it; `off` = no
// run; `returning` = no run, the picture still playing back to the rest pose.
//
// The action model (schema 1.23): every move names a destination (start | end) and a manner (jump | animate);
// arriving at the END by any route — the natural end, `stopRun: '…ToEnd'`, `startRun: 'jumpToEnd'`, `jumpToEnd()` —
// runs `atEnd`. "End" is the end of the CURRENT pass (a one-shot: the run's end).
//
// The declarative half (`playRun` as a prop, review §10) is a thin resolver on top: the lever's three positions —
// `off` · `on` · `paused` — and a change between two of them is one or two buttons, spelled with the executor's verbs.
// ============================================================================

import type { PxActions, PxAnimationPlayerApi, PxPlayExecutor, PxRunListeners } from '../format/PxAnimatorTypes';
import { PxAtEndBehavior, PxStopRunBehavior, PxStartRunBehavior, PxRunState, PxPlayRun, type PxPlaybackDirection, resolveActions } from '../format/PxAnimatorConstants';
import { iterationIndexOf, iterationTimeOf, runMsOf, totalDurationMs, type PxRunGeometry } from './PxPlaybackTime';

/** What a run is on this document: a POSE (one-shot — it plays to its end and rests) or a RUN that loops. @public @advanced */
export enum PxPlaybackWorld {
    oneShot = 'oneShot',
    loop = 'loop',
}

/** The world from the document's EFFECTIVE iterations (file value + the `timeline` prop):
 *  more than one pass means there is no stable finish pose to switch to. @public @advanced */
export function resolvePlaybackWorld(iterations: number | 'infinite' | undefined): PxPlaybackWorld {
    if (iterations === 'infinite' || (typeof iterations === 'number' && iterations > 1)) return PxPlaybackWorld.loop;
    return PxPlaybackWorld.oneShot;
}

/** The slice of the api the executor drives — the ENGINE's raw primitives (its `play` / `pause` are the clock on /
 *  off); structural, so the components' HANDLE qualifies as well as a full engine api. @public @advanced */
export type PxPlayTarget = Pick<PxAnimationPlayerApi,
    'play' | 'pause' | 'jumpToStart' | 'jumpToEnd' | 'getPlaybackSpeed' | 'setPlaybackSpeed' | 'getTotalTime' | 'setTotalTime' | 'isPlaying'>;

/** What the executor needs beside the api: the run's geometry, the timeline's `actions` and its `atEnd`. @public @advanced */
export interface PxPlayExecutorConfig {
    /** One pass of the content window, ms (`getAnimatorConfig(doc).duration`). */
    passMs: number;
    /** The whole run, ms — `passMs × iterations`; `Infinity` when endless. */
    totalMs: number;
    actions?: PxActions;
    atEnd?: PxAtEndBehavior;
}

const SNAP_EPSILON_MS = 1;

// @px-area control
/**
 * Builds the executor for one player. `raf` is injected (the web passes requestAnimationFrame) for
 * the deferred moves — playing on to the end of the pass (`animateToEnd`), stopping a loop's
 * `animateToStart` at the pass's start, and `runOnce()` on a loop. The engine's raw `play` / `pause` /
 * `jumpToStart` / `jumpToEnd` are bound at creation: `composeApiExtras` replaces `play` / `pause` on the api with the
 * aliases. Everything else is read live. An `animateToStart` leg turns the speed negative and restores the speed it
 * found (the file's `playbackSpeed`, or what the page set).
 * @public @advanced
 */
export function createPlayExecutor(api: PxPlayTarget, cfg: PxPlayExecutorConfig, raf: (cb: () => void) => void): PxPlayExecutor {
    const raw = { play: api.play.bind(api), pause: api.pause.bind(api), jumpToStart: api.jumpToStart.bind(api), jumpToEnd: api.jumpToEnd.bind(api) };
    const world = resolvePlaybackWorld(cfg.totalMs === Infinity ? 'infinite' : cfg.passMs > 0 ? cfg.totalMs / cfg.passMs : 1);
    const passMs = Math.max(cfg.passMs, 1);
    const actions = resolveActions(cfg.actions, cfg.atEnd);
    const startBehavior = actions.startRun.behavior;
    const stopBehavior = actions.stopRun.behavior;
    const atEnd = actions.atEnd;
    /** The player's run events — told whenever a button's act is performed. */
    let listeners: PxRunListeners | undefined;
    const tellStart = (): void => { listeners?.onRunStart?.(); };
    const tellStop = (): void => { listeners?.onRunStop?.(); };
    const tellPause = (): void => { listeners?.onRunPause?.(); };
    const tellResume = (): void => { listeners?.onRunResume?.(); };

    /** The one fact the engines cannot report: a pause is resumable, a stop is not. */
    let paused = false;
    /** The executor turned the run backwards (an `animateToStart` leg — the `returning` state); only then does it touch
     *  the speed again, so a custom speed set through the api survives every on / off. */
    let reversed = false;
    /** A LOOP held at a pass end by a stop that went there (`atEnd: hold`) — the engines cannot report it. */
    let heldAtEnd = false;
    /** A deferred move in flight (`animateToEnd`, a loop's `animateToStart`, `runOnce` on a loop) — one at a time. */
    let pending: (() => void) | null = null;
    /** The arrival of an `animateToEnd` in flight — the watch or the engine's natural end calls it, whichever is first. */
    let arrive: (() => void) | null = null;
    const cancelPending = (): void => { pending?.(); pending = null; arrive = null; };

    const atEndPos = (): boolean => { const t = api.getTotalTime(); return t !== null && t >= cfg.totalMs - SNAP_EPSILON_MS; };
    const atStartPos = (): boolean => { const t = api.getTotalTime(); return t !== null && t <= SNAP_EPSILON_MS; };
    /** The end of the pass the playhead is in — a boundary it rests on counts as the end of the pass it closes. */
    const passEndMs = (): number => {
        if (world === PxPlaybackWorld.oneShot) return cfg.totalMs;
        const t = Math.max(api.getTotalTime() ?? 0, 0);
        return Math.max(Math.ceil((t - SNAP_EPSILON_MS) / passMs), 1) * passMs;
    };
    /** The forward speed an `animateToStart` leg found, restored when it ends — a custom speed survives every on / off. */
    let forwardSpeed = 1;

    /** The run's state. A return leg reads RETURNING (no run; `startRun` turns it around — the hover-in during a
     *  hover-out `animateToStart`); an `animateToEnd` in flight is still PLAYING. A run that reached its end and rests
     *  there is FINISHED — `stopRun` still acts on it, `startRun` is a fresh run. */
    const state = (): PxRunState => {
        if (reversed) return PxRunState.returning;
        if (api.isPlaying()) return PxRunState.playing;
        if (paused) return PxRunState.paused;
        return heldAtEnd || atEndPos() ? PxRunState.finished : PxRunState.off;
    };

    const forward = (): void => { if (reversed) { reversed = false; api.setPlaybackSpeed(forwardSpeed); } };
    /** The rest pose, at rest. */
    const rest = (): void => { heldAtEnd = false; forward(); raw.jumpToStart(); };
    /** A fresh run from the beginning (the delay applies again — a new run). */
    const restart = (): void => { paused = false; rest(); raw.play(); };

    /** Watches the whole-run time each frame; fires `then` once `test` holds, unless cancelled. */
    const watch = (test: () => boolean, then: () => void): void => {
        cancelPending();
        let cancelled = false;
        pending = () => { cancelled = true; };
        const tick = (): void => {
            if (cancelled) return;
            if (test()) { pending = null; then(); return; }
            raf(tick);
        };
        raf(tick);
    };

    /** Plays back to the start; a loop plays back the pass it is in, then rests (the engine would keep looping backwards). */
    const animateToStart = (): void => {
        cancelPending();
        paused = false;
        heldAtEnd = false;
        if (atStartPos() && !api.isPlaying()) { rest(); return; }
        reversed = true;
        forwardSpeed = Math.abs(api.getPlaybackSpeed()) || 1;
        api.setPlaybackSpeed(-forwardSpeed);
        raw.play();
        if (world === PxPlaybackWorld.loop) {
            const t0 = api.getTotalTime() ?? 0;
            const target = Math.floor(Math.max(t0 - SNAP_EPSILON_MS, 0) / passMs) * passMs;
            watch(() => { const t = api.getTotalTime(); return t === null || t <= target + SNAP_EPSILON_MS; }, rest);
        }
    };

    /** At the end — by any route: performs `atEnd`. */
    const finishAt = (): void => {
        paused = false;
        if (atEnd === PxAtEndBehavior.jumpToStart) rest();
        else if (atEnd === PxAtEndBehavior.animateToStart) animateToStart();
        else if (world === PxPlaybackWorld.loop) heldAtEnd = true;   // `hold`: a one-shot's end pose is the engine's to hold
    };

    /** At once to the end of the pass, then `atEnd`. A one-shot: the engine's jump (its `onFinish` runs `atEnd`);
     *  a loop: held on the pass boundary (the run has no end to report). */
    const jumpToEnd = (): void => {
        cancelPending();
        paused = false;
        forward();
        if (world === PxPlaybackWorld.oneShot) { raw.jumpToEnd(); return; }
        const end = passEndMs();
        raw.pause();
        api.setTotalTime(end);
        finishAt();
    };

    /** Plays on to the end of the pass (a paused run resumes), then `onRunStop` and `atEnd`. A one-shot arrives with the
     *  engine's natural end; a loop is held on the pass boundary. */
    const animateToEnd = (): void => {
        paused = false;
        forward();
        const end = passEndMs();
        if (!api.isPlaying()) raw.play();
        let done = false;
        const arrival = (): void => {
            if (done) return;
            done = true;
            arrive = null;
            if (world === PxPlaybackWorld.loop && !atEndPos()) { raw.pause(); api.setTotalTime(end); }
            tellStop();
            finishAt();
        };
        watch(() => { const t = api.getTotalTime(); return t !== null && t >= end - SNAP_EPSILON_MS; }, arrival);
        arrive = arrival;
    };

    /** Lever 1 on: the configured start. A fresh run tells `onRunStart`; `continue` on a paused run only unfreezes it
     *  (`onRunResume`); `continue` on a playing run changes nothing. */
    const startRun = (): void => {
        const was = state();
        const wasPaused = paused;
        cancelPending();
        paused = false;
        heldAtEnd = false;
        switch (startBehavior) {
            case PxStartRunBehavior.jumpToStart:
                restart();
                tellStart();
                break;
            case PxStartRunBehavior.jumpToEnd:
                // the end pose with no motion, then `atEnd`; a loop has no end — its first pass's end stands in
                forward();
                if (world === PxPlaybackWorld.oneShot) raw.jumpToEnd();
                else { raw.pause(); api.setTotalTime(passMs); finishAt(); }
                tellStart();
                break;
            case PxStartRunBehavior.continue:
            default:
                // continue from where it is; at the end of a one-shot that is a fresh run from the beginning (a loop
                // held at a pass end plays on from there — the run's end is the only end that restarts)
                if (atEndPos() && !api.isPlaying()) { restart(); tellStart(); break; }
                if (was === PxRunState.playing) break;
                forward();
                raw.play();
                if (wasPaused) tellResume(); else tellStart();
        }
    };

    /** Lever 1 off: the configured stop. Nothing to stop when there is no run (`off` at rest, `returning`). */
    const stopRun = (): void => {
        const was = state();
        if (was === PxRunState.returning || (was === PxRunState.off && atStartPos())) return;
        const toEnd = stopBehavior === PxStopRunBehavior.jumpToEnd || stopBehavior === PxStopRunBehavior.animateToEnd;
        // a stop that goes to the end has nothing to do once it rests there
        if (toEnd && was === PxRunState.finished) return;
        if (stopBehavior === PxStopRunBehavior.animateToEnd) {
            if (pending) return;                                         // already on its way there
            animateToEnd();                                              // `onRunStop` on arrival
            return;
        }
        cancelPending();
        paused = false;
        if (stopBehavior === PxStopRunBehavior.animateToStart) animateToStart();
        else if (stopBehavior === PxStopRunBehavior.jumpToEnd) jumpToEnd();
        else rest();
        tellStop();
    };

    /** Lever 2 on: freeze — only a PLAYING run (a return leg, a finished or an off one have nothing to freeze). */
    const pauseRun = (): void => {
        if (state() !== PxRunState.playing) return;
        cancelPending();
        raw.pause();
        paused = true;
        tellPause();
    };

    /** Lever 2 off: continue from the frozen frame — only while paused. */
    const resumeRun = (): void => {
        if (!paused) return;
        paused = false;
        raw.play();
        tellResume();
    };

    /** ONE fresh pass from the start; a loop stops at its first pass end, per `atEnd`. */
    const runOnce = (): void => {
        cancelPending();
        paused = false;
        rest();
        raw.play();
        tellStart();
        if (world !== PxPlaybackWorld.loop) return;
        watch(() => { const t = api.getTotalTime(); return t !== null && t >= passMs - SNAP_EPSILON_MS; }, () => {
            if (atEnd === PxAtEndBehavior.jumpToStart) rest();
            else if (atEnd === PxAtEndBehavior.animateToStart) animateToStart();
            else { raw.pause(); api.setTotalTime(passMs); heldAtEnd = true; }
        });
    };

    return {
        state,
        startRun,
        stopRun,
        pauseRun,
        resumeRun,
        play: () => { if (state() === PxRunState.paused) resumeRun(); else startRun(); },
        jumpToStart: () => { cancelPending(); paused = false; rest(); },
        animateToStart,
        runOnce,
        setListeners: (next) => { listeners = next; },
        onNaturalFinish: () => {
            if (arrive) { const arrival = arrive; cancelPending(); arrival(); return; }   // an `animateToEnd` arrived
            if (pending) return;                       // a loop's `animateToStart` or `runOnce` owns the end
            paused = false;
            if (reversed) { rest(); return; }          // the end of an `animateToStart` leg: rest at the start
            finishAt();
        },
        dispose: cancelPending,
    };
}

// ── the declarative half ───────────────────────────────────────────────────────────────────

/** One step the declarative resolver asks the executor for — one of the four buttons. @public @advanced */
export enum PxDeclarativeAction {
    startRun = 'startRun',
    stopRun = 'stopRun',
    pauseRun = 'pauseRun',
    resumeRun = 'resumeRun',
}

/** The declarative prop a change is judged by — the lever's position. @public @advanced */
export interface PxDeclarativeProps {
    playRun?: PxPlayRun;
}

/** What {@link resolveDeclarativePlayback} is given. @public @advanced */
export interface PxDeclarativeArgs {
    /** Informational — the one-shot / loop world the run is in (the pose contract is the components'). */
    world: PxPlaybackWorld;
    /** The previous render's props; `undefined` on mount or when the player was recreated. */
    prev?: PxDeclarativeProps;
    next: PxDeclarativeProps;
}

/**
 * ONE rule for the `playRun` prop (review §10, D5). Pure: returns the ordered buttons to press. The diff of two
 * positions: `off` → `on` is `startRun`, `on` → `paused` is `pauseRun`, `paused` → `on` is `resumeRun`, anything →
 * `off` is `stopRun`; `off` → `paused` is `startRun` + `pauseRun` (the first frame, held). A MOUNT with `"off"`
 * presses nothing (no run to stop); a mount with `"on"` starts the run (a one-shot plays to its end and rests
 * there), with `"paused"` starts it frozen. No position pair is invalid, so there is nothing to warn about.
 * @public @advanced
 */
export function resolveDeclarativePlayback(args: PxDeclarativeArgs): { actions: Array<PxDeclarativeAction> } {
    const { prev, next } = args;
    const actions: Array<PxDeclarativeAction> = [];
    const to = next.playRun;
    if (to === undefined) return { actions };
    const mount = prev === undefined;
    const from = prev?.playRun;
    if (from === to) return { actions };
    switch (to) {
        case PxPlayRun.on:
            actions.push(from === PxPlayRun.paused ? PxDeclarativeAction.resumeRun : PxDeclarativeAction.startRun);
            break;
        case PxPlayRun.paused:
            if (from !== PxPlayRun.on) actions.push(PxDeclarativeAction.startRun);
            actions.push(PxDeclarativeAction.pauseRun);
            break;
        case PxPlayRun.off:
            if (!mount) actions.push(PxDeclarativeAction.stopRun);
            break;
    }
    return { actions };
}

/** The slice of the api the declarative resolver drives — the PUBLIC api, whose buttons already go through the
 *  player's one executor (a component's proxy qualifies, and queues the calls until the player exists). @public @advanced */
export type PxDeclarativeTarget = Pick<PxAnimationPlayerApi, 'startRun' | 'stopRun' | 'pauseRun' | 'resumeRun'>;

/** Presses one {@link PxDeclarativeAction} on the api. @public @advanced */
export function applyDeclarativeAction(api: PxDeclarativeTarget, action: PxDeclarativeAction): void {
    switch (action) {
        case PxDeclarativeAction.startRun: api.startRun(); break;
        case PxDeclarativeAction.stopRun: api.stopRun(); break;
        case PxDeclarativeAction.pauseRun: api.pauseRun(); break;
        case PxDeclarativeAction.resumeRun: api.resumeRun(); break;
    }
}

// ── the composed api ───────────────────────────────────────────────────────────────────────

/** The slice of the runtime view {@link composeApiExtras} reads. @public @advanced */
export interface PxApiExtrasConfig extends Pick<PxPlayExecutorConfig, 'actions' | 'atEnd'> {
    /** One pass of the content window, ms. */
    duration?: number;
    iterations?: number | 'infinite';
    /** Each pass's direction — the per-iteration reads count a reversed pass down. */
    direction?: PxPlaybackDirection;
    /** The file's `timeline.playbackSpeed` — set on the engine once at composition; the handle's `setPlaybackSpeed` replaces it. */
    playbackSpeed?: number;
    /** The player's run callbacks, handed to the executor: told whenever a button's act is performed. */
    runListeners?: PxRunListeners;
}

/** The executor's geometry, `actions` and `atEnd` from the runtime view. @public @advanced */
export function executorConfigOf(cfg: PxApiExtrasConfig): PxPlayExecutorConfig {
    const passMs = cfg.duration ?? 0;
    const iterations = cfg.iterations === 'infinite' ? Infinity : (typeof cfg.iterations === 'number' && cfg.iterations >= 1 ? cfg.iterations : 1);
    return {
        passMs, totalMs: passMs * iterations, actions: cfg.actions, atEnd: cfg.atEnd,
    };
}

/** The player's ONE executor: the one already attached to the api (an engine wired its triggers
 *  through it), or a new one attached now. @public @advanced */
export function ensurePlayExecutor(api: PxApiExtrasTarget, cfg: PxApiExtrasConfig, raf: (cb: () => void) => void): PxPlayExecutor {
    if (api.playExecutor) return api.playExecutor;
    const executor = createPlayExecutor(api, executorConfigOf(cfg), raf);
    api.playExecutor = executor;
    return executor;
}

/** The slice of the api `composeApiExtras` drives — structural, so the components' HANDLE
 *  (which has no `destroy`) qualifies as well as a full engine api. @public @advanced */
export type PxApiExtrasTarget = PxPlayTarget & { destroy?: () => void; playExecutor?: PxPlayExecutor };

/** What `composeApiExtras` adds. @public @advanced */
export interface PxApiExtras {
    /** The four buttons, through the executor. */
    startRun: () => void;
    stopRun: () => void;
    pauseRun: () => void;
    resumeRun: () => void;
    /** The aliases: `play()` = paused → `resumeRun()`, otherwise `startRun()`; `pause()` = `pauseRun()`. */
    play: () => void;
    pause: () => void;
    /** The unconditional jump to the rest pose. */
    jumpToStart: () => void;
    /** ONE fresh pass from the start, whatever `iterations` say. */
    runOnce: () => void;
    getDuration: () => number | null;
    getRunState: () => PxRunState;
    isRunActive: () => boolean;
    // the per-iteration and playback reads, derived from the engine's run clock and speed (PxPlaybackTime.ts)
    getTotalDuration: () => number | null;
    getTotalProgress: () => number | null;
    getCurrentIteration: () => number;
    getCurrentTime: () => number | null;
    setCurrentTime: (ms: number) => void;
    getCurrentProgress: () => number | null;
    setCurrentProgress: (progress: number) => void;
    getPlaybackDuration: () => number | null;
    setPlaybackDuration: (ms: number) => void;
    getTotalPlaybackDuration: () => number | null;
    getCurrentPlaybackTime: () => number | null;
    getTotalPlaybackTime: () => number | null;
    /** The executor every driver shares — the triggers and the components use it, never a second one. */
    playExecutor: PxPlayExecutor;
}

/**
 * Completes an engine api with the COMPOSED members — ONE implementation on top of any engine, so
 * none can drift: the four buttons, the `play()` / `pause()` aliases, `jumpToStart()` and `runOnce()` through the
 * player's one executor (review §10, D5), `getDuration()` (one pass of the content window, ms; review §14), the
 * state reads, and every per-iteration and playback read off the engine's run clock and speed (the time contract on
 * `PxAnimationPlayerApi`). Reuses an executor the engine already attached (`playExecutor`), so triggers wired inside
 * the engine and the public api share one state. Mutates and returns the same object.
 * @public @advanced
 */
export function composeApiExtras<T extends PxApiExtrasTarget>(api: T, cfg: PxApiExtrasConfig, raf: (cb: () => void) => void): T & PxApiExtras {
    const raw = { getTotalTime: api.getTotalTime.bind(api), setTotalTime: api.setTotalTime.bind(api) };
    const { passMs, totalMs } = executorConfigOf(cfg);
    const iterations = passMs > 0 ? totalMs / passMs : 1;
    const geometry: PxRunGeometry = { durationMs: passMs, iterations, direction: cfg.direction };
    const executor = ensurePlayExecutor(api, cfg, raf);
    if (cfg.runListeners) executor.setListeners(cfg.runListeners);
    // the file's speed is the initial one; the handle's `setPlaybackSpeed` replaces it
    if (cfg.playbackSpeed !== undefined && Number.isFinite(cfg.playbackSpeed) && cfg.playbackSpeed > 0) api.setPlaybackSpeed(cfg.playbackSpeed);
    // ONE type-level widening: every member is assigned right below, completing the api.
    const full = api as T & PxApiExtras;
    full.playExecutor = executor;
    full.startRun = () => executor.startRun();
    full.stopRun = () => executor.stopRun();
    full.pauseRun = () => executor.pauseRun();
    full.resumeRun = () => executor.resumeRun();
    full.play = () => executor.play();
    full.pause = () => executor.pauseRun();
    full.jumpToStart = () => executor.jumpToStart();
    full.runOnce = () => executor.runOnce();
    full.getDuration = () => cfg.duration ?? null;
    let destroyed = false;
    full.getRunState = () => destroyed ? PxRunState.destroyed : executor.state();
    full.isRunActive = () => {
        const s = full.getRunState();
        return s === PxRunState.playing || s === PxRunState.paused || s === PxRunState.finished;
    };
    // the two axes, derived from the engine's run clock (PxPlaybackTime.ts)
    const ready = (): boolean => cfg.duration !== undefined;
    const speedAbs = (): number => Math.abs(api.getPlaybackSpeed()) || 1;
    full.getTotalDuration = () => ready() ? totalDurationMs(passMs, iterations) : null;
    full.getTotalProgress = () => {
        const total = full.getTotalDuration(); const t = raw.getTotalTime();
        return total === null || t === null ? null : (total > 0 ? Math.min(1, Math.max(0, t / total)) : 0);
    };
    full.getCurrentIteration = () => iterationIndexOf(raw.getTotalTime() ?? 0, passMs, iterations);
    full.getCurrentTime = () => { const t = raw.getTotalTime(); return t === null ? null : iterationTimeOf(t, geometry); };
    full.setCurrentTime = (ms) => raw.setTotalTime(runMsOf(full.getCurrentIteration(), ms, geometry));
    full.getCurrentProgress = () => { const t = full.getCurrentTime(); return t === null ? null : (passMs > 0 ? t / passMs : 0); };
    full.setCurrentProgress = (p) => full.setCurrentTime((Number.isFinite(p) ? Math.min(1, Math.max(0, p)) : 0) * passMs);
    // the playback family: every value the position or the length divided by the speed; the setter the speed itself
    full.getPlaybackDuration = () => ready() ? passMs / speedAbs() : null;
    full.setPlaybackDuration = (ms) => { const sign = api.getPlaybackSpeed() < 0 ? -1 : 1; api.setPlaybackSpeed(sign * passMs / ms); };
    full.getTotalPlaybackDuration = () => { const total = full.getTotalDuration(); return total === null ? null : total / speedAbs(); };
    full.getCurrentPlaybackTime = () => { const t = full.getCurrentTime(); return t === null ? null : t / speedAbs(); };
    full.getTotalPlaybackTime = () => { const t = raw.getTotalTime(); return t === null ? null : t / speedAbs(); };
    // destroy() invalidates a pending watcher — otherwise it rAF-loops forever on a dead animator
    if (full.destroy) {
        const destroyEngine = full.destroy.bind(full);
        full.destroy = () => { destroyed = true; executor.dispose(); destroyEngine(); };
    }
    return full;
}
