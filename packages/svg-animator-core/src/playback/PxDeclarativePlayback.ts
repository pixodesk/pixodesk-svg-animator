// @px-area control
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// ============================================================================
// THE PLAY EXECUTOR — one implementation of "on" and "off" for every driver
// (dev-docs/plans/playback-layers.md): the `play` / `pause` / `playState` props, the triggers' event lists and
// the imperative api all end up here. The timeline's `actions` say HOW (start / stop / finish); the
// executor performs them on any engine api, and owns the states the engines cannot tell apart —
// PAUSED versus IDLE versus FINISHED — so the state rule can be applied: `start` acts when idle or
// finished, `pause` when playing, `resume` when paused, `stop` when playing, paused or finished.
//
// The action model (schema 1.23): every move names a destination (start | end) and a manner (jump | animate);
// arriving at the END by any route — the natural end, `stop: '…ToEnd'`, `start: 'jumpToEnd'`, `jumpToEnd()` —
// runs `actions.finish`. "End" is the end of the CURRENT pass (a one-shot: the run's end).
//
// The declarative half (`play` / `pause` as props, review §10; `playState` folds into them) is a thin
// resolver on top: `play` true starts (a mount included — a one-shot plays to its end and rests there), false
// stops; spelled with the executor's verbs.
// ============================================================================

import type { PxActions, PxAnimationPlayerApi, PxPlayExecutor } from '../format/PxAnimatorTypes';
import { PxFinishBehavior, PxStopBehavior, PxStartBehavior, PxPlayState, type PxPlaybackDirection, resolveActions } from '../format/PxAnimatorConstants';
import { iterationIndexOf, iterationTimeOf, runMsOf, totalDurationMs, type PxRunGeometry } from './PxPlaybackTime';

/** What the declarative `play` drives: a POSE (one-shot) or a RUN (loop). @public @advanced */
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

/** The slice of the api the executor drives — structural, so the components' HANDLE qualifies as
 *  well as a full engine api. @public @advanced */
export type PxPlayTarget = Pick<PxAnimationPlayerApi,
    'play' | 'pause' | 'jumpToStart' | 'jumpToEnd' | 'getPlaybackSpeed' | 'setPlaybackSpeed' | 'getTotalTime' | 'setTotalTime' | 'isPlaying'>;

/** What the executor needs beside the api: the run's geometry and the timeline's `actions`. @public @advanced */
export interface PxPlayExecutorConfig {
    /** One pass of the content window, ms (`getAnimatorConfig(doc).duration`). */
    passMs: number;
    /** The whole run, ms — `passMs × iterations`; `Infinity` when endless. */
    totalMs: number;
    actions?: PxActions;
}

const SNAP_EPSILON_MS = 1;

// @px-area control
/**
 * Builds the executor for one player. `raf` is injected (the web passes requestAnimationFrame) for
 * the deferred moves — playing on to the end of the pass (`animateToEnd`), and stopping a loop's
 * `animateToStart` at the pass's start. `play` / `pause` / `jumpToStart` are bound at creation: `composeApiExtras`
 * replaces them on the api with executor-calling versions. Everything else is read live. An `animateToStart` leg
 * turns the speed negative and restores the speed it found (the file's `playbackSpeed`, or what the page set).
 * @public @advanced
 */
export function createPlayExecutor(api: PxPlayTarget, cfg: PxPlayExecutorConfig, raf: (cb: () => void) => void): PxPlayExecutor {
    const raw = { play: api.play.bind(api), pause: api.pause.bind(api), jumpToStart: api.jumpToStart.bind(api), jumpToEnd: api.jumpToEnd.bind(api) };
    const world = resolvePlaybackWorld(cfg.totalMs === Infinity ? 'infinite' : cfg.passMs > 0 ? cfg.totalMs / cfg.passMs : 1);
    const passMs = Math.max(cfg.passMs, 1);
    const actions = resolveActions(cfg.actions);
    const startBehavior = actions.start.behavior;
    const stopBehavior = actions.stop.behavior;
    const finishBehavior = actions.finish.behavior;
    /** The player's `onStop` — told whenever the configured stop is performed. */
    let onStop: (() => void) | undefined;

    /** The one fact the engines cannot report: a pause is resumable, a stop is not. */
    let paused = false;
    /** The executor turned the run backwards (an `animateToStart` leg); only then does it touch the speed again,
     *  so a custom speed set through the api survives every on / off. */
    let reversed = false;
    /** A LOOP held at a pass end by a stop that went there (`finish: hold`) — the engines cannot report it. */
    let heldAtEnd = false;
    /** A deferred move in flight (`animateToEnd`, a loop's `animateToStart`) — one at a time. */
    let pending: (() => void) | null = null;
    /** The arrival of an `animateToEnd` in flight — the watch or the engine's natural end calls it, whichever is first. */
    let arrive: (() => void) | null = null;
    const cancelPending = (): void => { pending?.(); pending = null; arrive = null; };

    const atEnd = (): boolean => { const t = api.getTotalTime(); return t !== null && t >= cfg.totalMs - SNAP_EPSILON_MS; };
    const atStart = (): boolean => { const t = api.getTotalTime(); return t !== null && t <= SNAP_EPSILON_MS; };
    /** The end of the pass the playhead is in — a boundary it rests on counts as the end of the pass it closes. */
    const passEndMs = (): number => {
        if (world === PxPlaybackWorld.oneShot) return cfg.totalMs;
        const t = Math.max(api.getTotalTime() ?? 0, 0);
        return Math.max(Math.ceil((t - SNAP_EPSILON_MS) / passMs), 1) * passMs;
    };
    /** The forward speed an `animateToStart` leg found, restored when it ends — a custom speed survives every on / off. */
    let forwardSpeed = 1;

    /** A move in flight — playing back to the start, or on to the end — reads as IDLE: it is heading to rest, and a
     *  `start` event turns it around (the hover-in during a hover-out `animateToStart`). A run that reached its end and
     *  rests there is FINISHED — a `stop` still acts on it, a `start` is a fresh run. */
    const state = (): PxPlayState => {
        if (reversed || pending) return PxPlayState.idle;
        if (api.isPlaying()) return PxPlayState.playing;
        if (paused) return PxPlayState.paused;
        return heldAtEnd || atEnd() ? PxPlayState.finished : PxPlayState.idle;
    };

    const forward = (): void => { if (reversed) { reversed = false; api.setPlaybackSpeed(forwardSpeed); } };
    /** The idle pose, at rest. */
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
        if (atStart() && !api.isPlaying()) { rest(); return; }
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

    /** At the end — by any route: performs `actions.finish`. */
    const finishAt = (): void => {
        paused = false;
        if (finishBehavior === PxFinishBehavior.jumpToStart) rest();
        else if (finishBehavior === PxFinishBehavior.animateToStart) animateToStart();
        else if (world === PxPlaybackWorld.loop) heldAtEnd = true;   // `hold`: a one-shot's end pose is the engine's to hold
    };

    /** At once to the end of the pass, then `finish`. A one-shot: the engine's jump (its `onFinish` runs `finish`);
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

    /** Plays on to the end of the pass (a paused run resumes), then `onStop` and `finish`. A one-shot arrives with the
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
            if (world === PxPlaybackWorld.loop && !atEnd()) { raw.pause(); api.setTotalTime(end); }
            onStop?.();
            finishAt();
        };
        watch(() => { const t = api.getTotalTime(); return t !== null && t >= end - SNAP_EPSILON_MS; }, arrival);
        arrive = arrival;
    };

    const start = (): void => {
        cancelPending();
        paused = false;
        heldAtEnd = false;
        switch (startBehavior) {
            case PxStartBehavior.jumpToStart:
                restart();
                break;
            case PxStartBehavior.jumpToEnd:
                // the end pose with no motion, then `finish`; a loop has no end — its first pass's end stands in
                forward();
                if (world === PxPlaybackWorld.oneShot) raw.jumpToEnd();
                else { raw.pause(); api.setTotalTime(passMs); finishAt(); }
                break;
            case PxStartBehavior.continue:
            default:
                // continue from where it is; at the end of a one-shot that is a fresh run from the beginning
                if (atEnd() && !api.isPlaying()) { restart(); break; }
                forward();
                raw.play();
        }
    };

    const stop = (): void => {
        // already heading to the start, or already at rest, there is nothing to stop
        if (reversed || (state() === PxPlayState.idle && !pending && atStart())) return;
        const toEnd = stopBehavior === PxStopBehavior.jumpToEnd || stopBehavior === PxStopBehavior.animateToEnd;
        // a stop that goes to the end has nothing to do once it rests there
        if (toEnd && state() === PxPlayState.finished) return;
        if (stopBehavior === PxStopBehavior.animateToEnd) {
            if (pending) return;                                         // already on its way there
            animateToEnd();                                              // `onStop` on arrival
            return;
        }
        cancelPending();
        paused = false;
        if (stopBehavior === PxStopBehavior.animateToStart) animateToStart();
        else if (stopBehavior === PxStopBehavior.jumpToEnd) jumpToEnd();
        else rest();
        onStop?.();
    };

    return {
        state,
        start,
        stop,
        pause: () => {
            // the engine's pause always runs (it announces `onPause`); only a RUN becomes resumable
            const wasPlaying = api.isPlaying();
            cancelPending();
            raw.pause();
            if (wasPlaying) paused = true;
        },
        resume: () => { if (!paused) return; paused = false; raw.play(); },
        play: () => { if (paused) { paused = false; forward(); raw.play(); } else start(); },
        jumpToStart: () => { cancelPending(); paused = false; rest(); },
        animateToStart,
        setOnStop: (listener) => { onStop = listener; },
        onNaturalFinish: () => {
            if (arrive) { const arrival = arrive; cancelPending(); arrival(); return; }   // an `animateToEnd` arrived
            if (pending) return;                       // a loop's `animateToStart` owns the end
            paused = false;
            if (reversed) { rest(); return; }          // the end of an `animateToStart` leg: rest at the start
            finishAt();
        },
        dispose: cancelPending,
    };
}

// ── the declarative half ───────────────────────────────────────────────────────────────────

/** One step the declarative resolver asks the executor for. @public @advanced */
export enum PxDeclarativeAction {
    /** The configured play-start. */
    start = 'start',
    /** The configured play-stop. */
    stop = 'stop',
    /** Freeze the clock at the current frame. */
    pause = 'pause',
    /** Unfreeze: continue toward the current target. */
    resume = 'resume',
}

/** The declarative props a change is judged by — the two levels (`playState` folds into them, `playStateToLevels`). @public @advanced */
export interface PxDeclarativeProps {
    play?: boolean;
    pause?: boolean;
}

/** What {@link resolveDeclarativePlayback} is given. @public @advanced */
export interface PxDeclarativeArgs {
    world: PxPlaybackWorld;
    /** The previous render's props; `undefined` on mount or when the player was recreated. */
    prev?: PxDeclarativeProps;
    next: PxDeclarativeProps;
}

/**
 * ONE rule for the declarative playback props (review §10, D5). Pure: returns the ordered actions
 * to ask the executor for, plus the usage warnings to emit. `play` true means "it plays": a mount
 * with it starts the run (a one-shot plays to its end and rests there; the pose without motion is
 * `showAtProgress={1}`), false stops it — but a MOUNT with `play={false}` does nothing (no stop action runs on a
 * player that never started). A contract breach (`pause` without `play`) warns and changes nothing.
 * @public @advanced
 */
export function resolveDeclarativePlayback(args: PxDeclarativeArgs): {
    actions: Array<PxDeclarativeAction>;
    warnings: Array<string>;
} {
    const { world, prev, next } = args;
    const actions: Array<PxDeclarativeAction> = [];
    const warnings: Array<string> = [];
    const mount = prev === undefined;
    const playChanged = mount || prev.play !== next.play;
    const pauseChanged = mount ? next.pause !== undefined : prev.pause !== next.pause;

    if (next.play === undefined) {
        if (next.pause !== undefined && pauseChanged) {
            warnings.push('`pause` does nothing without `play` — it freezes a run that `play` owns.');
        }
        return { actions, warnings };
    }

    if (mount) {
        // a mount with `play` plays — a loop runs, a one-shot plays to its end; `pause` beside it freezes the start
        if (next.play) {
            actions.push(PxDeclarativeAction.start);
            if (next.pause) actions.push(PxDeclarativeAction.pause);
        }
        return { actions, warnings };
    }
    if (playChanged) {
        if (next.play) {
            actions.push(PxDeclarativeAction.start);
            if (next.pause) actions.push(PxDeclarativeAction.pause);   // the freeze axis still holds
        } else {
            actions.push(PxDeclarativeAction.stop);                      // `play: false` forcibly unfreezes
        }
        return { actions, warnings };
    }
    if (pauseChanged && next.play) {
        actions.push(next.pause ? PxDeclarativeAction.pause : PxDeclarativeAction.resume);
    }
    return { actions, warnings };
}

/** The slice of the api the declarative resolver drives — the PUBLIC api, whose `play()` / `pause()` /
 *  `stop()` already go through the player's one executor (a component's proxy qualifies, and queues
 *  the calls until the player exists). @public @advanced */
export type PxDeclarativeTarget = Pick<PxAnimationPlayerApi, 'play' | 'pause' | 'stop'>;

/** Executes one {@link PxDeclarativeAction} on the api. @public @advanced */
export function applyDeclarativeAction(api: PxDeclarativeTarget, action: PxDeclarativeAction): void {
    switch (action) {
        case PxDeclarativeAction.start: api.play(); break;
        case PxDeclarativeAction.stop: api.stop(); break;
        case PxDeclarativeAction.pause: api.pause(); break;
        case PxDeclarativeAction.resume: api.play(); break;
    }
}

// ── the composed api ───────────────────────────────────────────────────────────────────────

/** The slice of the runtime view {@link composeApiExtras} reads. @public @advanced */
export interface PxApiExtrasConfig extends Pick<PxPlayExecutorConfig, 'actions'> {
    /** One pass of the content window, ms. */
    duration?: number;
    iterations?: number | 'infinite';
    /** Each pass's direction — the per-iteration reads count a reversed pass down. */
    direction?: PxPlaybackDirection;
    /** The file's `timeline.playbackSpeed` — set on the engine once at composition; the handle's `setPlaybackSpeed` replaces it. */
    playbackSpeed?: number;
    /** The player's `onStop`, handed to the executor: told whenever the configured stop is performed. */
    onStop?: () => void;
}

/** The executor's geometry and `actions` from the runtime view. @public @advanced */
export function executorConfigOf(cfg: PxApiExtrasConfig): PxPlayExecutorConfig {
    const passMs = cfg.duration ?? 0;
    const iterations = cfg.iterations === 'infinite' ? Infinity : (typeof cfg.iterations === 'number' && cfg.iterations >= 1 ? cfg.iterations : 1);
    return {
        passMs, totalMs: passMs * iterations, actions: cfg.actions,
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
    /** The state-rule `play()`: paused → resume, otherwise the configured start. */
    play: () => void;
    pause: () => void;
    /** The configured stop. */
    stop: () => void;
    /** The unconditional jump to the idle pose. */
    jumpToStart: () => void;
    /** ONE fresh pass from the start, whatever `iterations` say. */
    playOnce: () => void;
    getDuration: () => number | null;
    getPlayState: () => PxPlayState;
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
 * none can drift: `play()` / `pause()` / `stop()` / `jumpToStart()` through the player's one executor
 * (review §10, D5), `playOnce()` (always a fresh pass from the start; a multi-pass document gets a
 * boundary watcher that settles at the end of pass ONE — `'jumpToStart'` snaps to rest, the default holds
 * the pass-end pose; re-entrant), `getDuration()` (one pass of the content window, ms; review §14), the state read,
 * and every per-iteration and playback read off the engine's run clock and speed (the time contract on
 * `PxAnimationPlayerApi`). Reuses an executor the engine already attached (`playExecutor`), so triggers wired inside
 * the engine and the public api share one state. Mutates and returns the same object.
 * @public @advanced
 */
export function composeApiExtras<T extends PxApiExtrasTarget>(api: T, cfg: PxApiExtrasConfig, raf: (cb: () => void) => void): T & PxApiExtras {
    const raw = { play: api.play.bind(api), pause: api.pause.bind(api), jumpToStart: api.jumpToStart.bind(api),
        getTotalTime: api.getTotalTime.bind(api), setTotalTime: api.setTotalTime.bind(api) };
    const { passMs, totalMs } = executorConfigOf(cfg);
    const iterations = passMs > 0 ? totalMs / passMs : 1;
    const geometry: PxRunGeometry = { durationMs: passMs, iterations, direction: cfg.direction };
    const executor = ensurePlayExecutor(api, cfg, raf);
    if (cfg.onStop) executor.setOnStop(cfg.onStop);
    // the file's speed is the initial one; the handle's `setPlaybackSpeed` replaces it
    if (cfg.playbackSpeed !== undefined && Number.isFinite(cfg.playbackSpeed) && cfg.playbackSpeed > 0) api.setPlaybackSpeed(cfg.playbackSpeed);
    // ONE type-level widening: every member is assigned right below, completing the api.
    const full = api as T & PxApiExtras;
    full.playExecutor = executor;
    full.play = () => executor.play();
    full.pause = () => executor.pause();
    full.stop = () => executor.stop();
    full.jumpToStart = () => executor.jumpToStart();
    full.getDuration = () => cfg.duration ?? null;
    let destroyed = false;
    full.getPlayState = () => destroyed ? PxPlayState.destroyed : executor.state();
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
    let token = 0;
    // destroy() invalidates a pending pass watcher — otherwise it rAF-loops forever on a dead animator
    if (full.destroy) {
        const destroyEngine = full.destroy.bind(full);
        full.destroy = () => { token++; destroyed = true; executor.dispose(); destroyEngine(); };
    }
    full.playOnce = () => {
        const mine = ++token;
        executor.jumpToStart();
        raw.play();
        const multiPass = iterations > 1;
        if (!multiPass || !passMs) return;
        const tick = (): void => {
            if (mine !== token) return;                 // a later playOnce took over
            const t = raw.getTotalTime();
            if (t !== null && t >= passMs) {
                if (resolveActions(cfg.actions).finish.behavior === PxFinishBehavior.jumpToStart) raw.jumpToStart();
                else { raw.pause(); raw.setTotalTime(passMs); }
                return;
            }
            raf(tick);
        };
        raf(tick);
    };
    return full;
}
