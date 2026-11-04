// @px-area control
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// ============================================================================
// THE PLAY EXECUTOR — one implementation of "on" and "off" for every driver
// (dev-docs/plans/playback-layers.md): the `playWhile` / `pauseWhile` / `playState` props, the triggers' event lists and
// the imperative api all end up here. The timeline's `actions` say HOW (start / stop / finish); the
// executor performs them on any engine api, and owns the states the engines cannot tell apart —
// PAUSED versus STOPPED versus FINISHED — so the state rule can be applied: `start` acts when stopped or
// finished, `pause` when playing, `resume` when paused, `stop` when playing, paused or finished.
//
// The declarative half (`playWhile` / `pauseWhile` as props, review §10; `playState` folds into them) is a thin
// resolver on top: `playWhile` true starts (a mount included — a one-shot plays to its end and rests there), false
// stops; spelled with the executor's verbs.
// ============================================================================

import type { PxActions, PxAnimationPlayerApi, PxPlayExecutor } from '../format/PxAnimatorTypes';
import { PxFinishBehavior, PxStopBehavior, PxStartBehavior, PxPlayState, type PxPlaybackDirection, resolveActions } from '../format/PxAnimatorConstants';
import { iterationIndexOf, iterationTimeOf, runMsOf, totalDurationMs, type PxRunGeometry } from './PxPlaybackTime';

/** What the declarative `playWhile` drives: a POSE (one-shot) or a RUN (loop). @public @advanced */
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
    'play' | 'pause' | 'reset' | 'jumpToEnd' | 'getPlaySpeed' | 'setPlaySpeed' | 'getTotalTime' | 'setTotalTime' | 'isPlaying'>;

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
 * the deferred moves — completing the iteration before an off, and stopping a loop's rewind at the
 * iteration's start. `play` / `pause` / `reset` are bound at creation: `composeApiExtras` replaces
 * them on the api with executor-calling versions. Everything else is read live. A rewind turns the speed
 * negative and restores the speed it found (the file's `playSpeed`, or what the page set) when it ends.
 * @public @advanced
 */
export function createPlayExecutor(api: PxPlayTarget, cfg: PxPlayExecutorConfig, raf: (cb: () => void) => void): PxPlayExecutor {
    const raw = { play: api.play.bind(api), pause: api.pause.bind(api), reset: api.reset.bind(api) };
    const world = resolvePlaybackWorld(cfg.totalMs === Infinity ? 'infinite' : cfg.passMs > 0 ? cfg.totalMs / cfg.passMs : 1);
    const passMs = Math.max(cfg.passMs, 1);
    const actions = resolveActions(cfg.actions);
    const startBehavior = actions.start.behavior;
    const stopBehavior = actions.stop.behavior;
    const completeIteration = actions.stop.completeIteration;
    const finishBehavior = actions.finish.behavior;
    /** The player's `onStop` — told whenever the configured stop is performed. */
    let onStop: (() => void) | undefined;

    /** The one fact the engines cannot report: a pause is resumable, a stop is not. */
    let paused = false;
    /** The executor turned the run backwards (a rewind); only then does it touch the rate again,
     *  so a custom rate set through the api survives every on / off. */
    let reversed = false;
    /** A deferred move in flight (iteration completion, a loop's rewind) — one at a time. */
    let pending: (() => void) | null = null;
    const cancelPending = (): void => { pending?.(); pending = null; };

    const atEnd = (): boolean => { const t = api.getTotalTime(); return t !== null && t >= cfg.totalMs - SNAP_EPSILON_MS; };
    const atStart = (): boolean => { const t = api.getTotalTime(); return t !== null && t <= SNAP_EPSILON_MS; };
    /** The forward speed a rewind found, restored when it ends — a custom speed survives every on / off. */
    let forwardSpeed = 1;

    /** An off in flight — rewinding, or completing its iteration — reads as STOPPED: it is heading there,
     *  and a `start` event turns it around (the hover-in during a hover-out rewind). A run that reached its
     *  end and rests there is FINISHED — a `stop` still acts on it, a `start` is a fresh run. */
    const state = (): PxPlayState => {
        if (reversed || pending) return PxPlayState.idle;
        if (api.isPlaying()) return PxPlayState.playing;
        if (paused) return PxPlayState.paused;
        return atEnd() ? PxPlayState.finished : PxPlayState.idle;
    };

    const forward = (): void => { if (reversed) { reversed = false; api.setPlaySpeed(forwardSpeed); } };
    /** The start pose, at rest. */
    const rest = (): void => { forward(); raw.reset(); };
    /** A fresh run from the beginning (the delay applies again — a restart is a new run). */
    const restart = (): void => { paused = false; rest(); raw.play(); };

    const start = (): void => {
        cancelPending();
        paused = false;
        switch (startBehavior) {
            case PxStartBehavior.restart:
                restart();
                break;
            case PxStartBehavior.jumpToEnd:
                // the end pose with no motion; a loop has no end — its first pass's end stands in
                forward();
                if (world === PxPlaybackWorld.oneShot) api.jumpToEnd();
                else { raw.pause(); api.setTotalTime(passMs); }
                break;
            case PxStartBehavior.continue:
            default:
                // continue from where it is; at the end of a one-shot that is a fresh run from the beginning
                if (atEnd() && !api.isPlaying()) { restart(); break; }
                forward();
                raw.play();
        }
    };

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

    /** Plays back to the start; a loop rewinds the iteration it is in, then rests (the engine
     *  would keep looping backwards). */
    const rewind = (): void => {
        cancelPending();
        paused = false;
        if (atStart() && !api.isPlaying()) { rest(); return; }
        reversed = true;
        forwardSpeed = Math.abs(api.getPlaySpeed()) || 1;
        api.setPlaySpeed(-forwardSpeed);
        raw.play();
        if (world === PxPlaybackWorld.loop) {
            const t0 = api.getTotalTime() ?? 0;
            const target = Math.floor(Math.max(t0 - SNAP_EPSILON_MS, 0) / passMs) * passMs;
            watch(() => { const t = api.getTotalTime(); return t === null || t <= target + SNAP_EPSILON_MS; }, rest);
        }
    };

    /** The off-action itself, from the current position — the moment `onStop` is told. */
    const performOff = (): void => {
        paused = false;
        if (stopBehavior === PxStopBehavior.rewind) rewind();
        else rest();
        onStop?.();
    };

    const stop = (): void => {
        // already stopping, or already at rest; a STOPPED player elsewhere (the end pose, a held frame) still goes to rest
        if (reversed || (state() === PxPlayState.idle && !pending && atStart())) return;
        if (completeIteration && api.isPlaying()) {
            // the off lands on the iteration boundary, not mid-beat (a one-shot: at its end)
            const startIteration = Math.floor((api.getTotalTime() ?? 0) / passMs);
            watch(() => { const t = api.getTotalTime(); return t !== null && Math.floor(t / passMs) > startIteration; }, performOff);
            return;
        }
        cancelPending();
        performOff();
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
        reset: () => { cancelPending(); paused = false; rest(); },
        rewind,
        setOnStop: (listener) => { onStop = listener; },
        onNaturalFinish: () => {
            if (pending) return;                       // a deferred move owns the end (an off completing its iteration)
            paused = false;
            if (reversed) { rest(); return; }          // the end of a rewind: rest at the start
            if (finishBehavior === PxFinishBehavior.reset) rest();
            else if (finishBehavior === PxFinishBehavior.rewind) rewind();
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

/** The declarative props a change is judged by — the two levels (`playState` folds into them, `playLevelsOf`). @public @advanced */
export interface PxDeclarativeProps {
    playWhile?: boolean;
    pauseWhile?: boolean;
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
 * to ask the executor for, plus the usage warnings to emit. `playWhile` true means "it plays": a mount
 * with it starts the run (a one-shot plays to its end and rests there; the pose without motion is
 * `showAtProgress={1}`), false stops it. A contract breach (`pauseWhile` without `playWhile`) warns and changes nothing.
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
    const playChanged = mount || prev.playWhile !== next.playWhile;
    const pauseChanged = mount ? next.pauseWhile !== undefined : prev.pauseWhile !== next.pauseWhile;

    if (next.playWhile === undefined) {
        if (next.pauseWhile !== undefined && pauseChanged) {
            warnings.push('`pauseWhile` does nothing without `playWhile` — it freezes a run that `playWhile` owns.');
        }
        return { actions, warnings };
    }

    if (mount) {
        // a mount with `playWhile` plays — a loop runs, a one-shot plays to its end; `pauseWhile` beside it freezes the start
        if (next.playWhile) {
            actions.push(PxDeclarativeAction.start);
            if (next.pauseWhile) actions.push(PxDeclarativeAction.pause);
        }
        return { actions, warnings };
    }
    if (playChanged) {
        if (next.playWhile) {
            actions.push(PxDeclarativeAction.start);
            if (next.pauseWhile) actions.push(PxDeclarativeAction.pause);   // the freeze axis still holds
        } else {
            actions.push(PxDeclarativeAction.stop);                      // `playWhile: false` forcibly unfreezes
        }
        return { actions, warnings };
    }
    if (pauseChanged && next.playWhile) {
        actions.push(next.pauseWhile ? PxDeclarativeAction.pause : PxDeclarativeAction.resume);
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
    /** The file's `timeline.playSpeed` — set on the engine once at composition; the handle's `setPlaySpeed` replaces it. */
    playSpeed?: number;
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
    /** The unconditional reset-now. */
    reset: () => void;
    /** ONE fresh pass from the start, whatever `iterations` say. */
    playOnce: () => void;
    getDuration: () => number | null;
    getPlayState: () => PxPlayState;
    // the per-iteration and real-time reads, derived from the engine's run clock and speed (PxPlaybackTime.ts)
    getTotalDuration: () => number | null;
    getCurrentIteration: () => number;
    getCurrentTime: () => number | null;
    setCurrentTime: (ms: number) => void;
    getCurrentProgress: () => number | null;
    setCurrentProgress: (progress: number) => void;
    getPlayDuration: () => number | null;
    setPlayDuration: (ms: number) => void;
    getTotalPlayDuration: () => number | null;
    getCurrentPlayTime: () => number | null;
    /** The executor every driver shares — the triggers and the components use it, never a second one. */
    playExecutor: PxPlayExecutor;
}

/**
 * Completes an engine api with the COMPOSED members — ONE implementation on top of any engine, so
 * none can drift: `play()` / `pause()` / `stop()` / `reset()` through the player's one executor
 * (review §10, D5), `playOnce()` (always a fresh pass from the start; a multi-pass document gets a
 * boundary watcher that settles at the end of pass ONE — `'reset'` snaps to rest, the default holds
 * the pass-end pose; re-entrant), `getDuration()` (one pass of the content window, ms; review §14), the state read,
 * and every per-iteration and real-time read off the engine's run clock and speed (the time contract on
 * `PxAnimationPlayerApi`). Reuses an executor the engine already attached (`playExecutor`), so triggers wired inside
 * the engine and the public api share one state. Mutates and returns the same object.
 * @public @advanced
 */
export function composeApiExtras<T extends PxApiExtrasTarget>(api: T, cfg: PxApiExtrasConfig, raf: (cb: () => void) => void): T & PxApiExtras {
    const raw = { play: api.play.bind(api), pause: api.pause.bind(api), reset: api.reset.bind(api),
        getTotalTime: api.getTotalTime.bind(api), setTotalTime: api.setTotalTime.bind(api) };
    const { passMs, totalMs } = executorConfigOf(cfg);
    const iterations = passMs > 0 ? totalMs / passMs : 1;
    const geometry: PxRunGeometry = { durationMs: passMs, iterations, direction: cfg.direction };
    const executor = ensurePlayExecutor(api, cfg, raf);
    if (cfg.onStop) executor.setOnStop(cfg.onStop);
    // the file's speed is the initial one; the handle's `setPlaySpeed` replaces it
    if (cfg.playSpeed !== undefined && Number.isFinite(cfg.playSpeed) && cfg.playSpeed > 0) api.setPlaySpeed(cfg.playSpeed);
    // ONE type-level widening: every member is assigned right below, completing the api.
    const full = api as T & PxApiExtras;
    full.playExecutor = executor;
    full.play = () => executor.play();
    full.pause = () => executor.pause();
    full.stop = () => executor.stop();
    full.reset = () => executor.reset();
    full.getDuration = () => cfg.duration ?? null;
    let destroyed = false;
    full.getPlayState = () => destroyed ? PxPlayState.destroyed : executor.state();
    // the two axes, derived from the engine's run clock (PxPlaybackTime.ts)
    const ready = (): boolean => cfg.duration !== undefined;
    const speedAbs = (): number => Math.abs(api.getPlaySpeed()) || 1;
    full.getTotalDuration = () => ready() ? totalDurationMs(passMs, iterations) : null;
    full.getCurrentIteration = () => iterationIndexOf(raw.getTotalTime() ?? 0, passMs, iterations);
    full.getCurrentTime = () => { const t = raw.getTotalTime(); return t === null ? null : iterationTimeOf(t, geometry); };
    full.setCurrentTime = (ms) => raw.setTotalTime(runMsOf(full.getCurrentIteration(), ms, geometry));
    full.getCurrentProgress = () => { const t = full.getCurrentTime(); return t === null ? null : (passMs > 0 ? t / passMs : 0); };
    full.setCurrentProgress = (p) => full.setCurrentTime((Number.isFinite(p) ? Math.min(1, Math.max(0, p)) : 0) * passMs);
    // the real-time family: every value the position or the length divided by the speed; the setter the speed itself
    full.getPlayDuration = () => ready() ? passMs / speedAbs() : null;
    full.setPlayDuration = (ms) => { const sign = api.getPlaySpeed() < 0 ? -1 : 1; api.setPlaySpeed(sign * passMs / ms); };
    full.getTotalPlayDuration = () => { const total = full.getTotalDuration(); return total === null ? null : total / speedAbs(); };
    full.getCurrentPlayTime = () => { const t = full.getCurrentTime(); return t === null ? null : t / speedAbs(); };
    let token = 0;
    // destroy() invalidates a pending pass watcher — otherwise it rAF-loops forever on a dead animator
    if (full.destroy) {
        const destroyEngine = full.destroy.bind(full);
        full.destroy = () => { token++; destroyed = true; executor.dispose(); destroyEngine(); };
    }
    full.playOnce = () => {
        const mine = ++token;
        executor.reset();
        raw.play();
        const multiPass = iterations > 1;
        if (!multiPass || !passMs) return;
        const tick = (): void => {
            if (mine !== token) return;                 // a later playOnce took over
            const t = raw.getTotalTime();
            if (t !== null && t >= passMs) {
                if (resolveActions(cfg.actions).finish.behavior === PxFinishBehavior.reset) raw.reset();
                else { raw.pause(); raw.setTotalTime(passMs); }
                return;
            }
            raf(tick);
        };
        raf(tick);
    };
    return full;
}
