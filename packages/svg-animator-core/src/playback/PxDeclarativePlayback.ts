// @px-area control
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// ============================================================================
// THE PLAY EXECUTOR — one implementation of "on" and "off" for every driver
// (dev-docs/plans/playback-layers.md): the `play` / `pause` props, the triggers' event lists and
// the imperative api all end up here. The timeline's `actions` say HOW (start / stop / finish); the
// executor performs them on any engine api, and owns the one state the engines cannot tell apart —
// PAUSED versus STOPPED — so the state rule can be applied: `start` acts when stopped, `pause` when
// playing, `resume` when paused, `stop` when playing or paused.
//
// The declarative half (`play` as a STATE, review §10) is a thin resolver on top: a one-shot
// document treats `play` as a POSE switch (false = the start pose, true = the end pose) and a
// looping one as a RUN switch; both are spelled with the executor's five verbs.
// ============================================================================

import type { PxActions, PxAnimationPlayerApi, PxPlayExecutor } from '../format/PxAnimatorTypes';
import { PxFinishTransition, PxStopTransition, PxStartTransition, PxPlayState, resolveActions } from '../format/PxAnimatorConstants';

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
    'play' | 'pause' | 'cancel' | 'finish' | 'setPlaybackRate' | 'getCurrentTime' | 'setCurrentTime' | 'isPlaying'>;

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
 * iteration's start. `play` / `pause` / `cancel` are bound at creation: `composeApiExtras` replaces
 * them on the api with executor-calling versions. Everything else is read live, so a wrapper added
 * later (the `playDuration` rate factor) is honoured.
 * @public @advanced
 */
export function createPlayExecutor(api: PxPlayTarget, cfg: PxPlayExecutorConfig, raf: (cb: () => void) => void): PxPlayExecutor {
    const raw = { play: api.play.bind(api), pause: api.pause.bind(api), cancel: api.cancel.bind(api) };
    const world = resolvePlaybackWorld(cfg.totalMs === Infinity ? 'infinite' : cfg.passMs > 0 ? cfg.totalMs / cfg.passMs : 1);
    const passMs = Math.max(cfg.passMs, 1);
    const actions = resolveActions(cfg.actions);
    const startTransition = actions.start.transition;
    const stopTransition = actions.stop.transition;
    const completeIteration = actions.stop.completeIteration;
    const finishTransition = actions.finish.transition;

    /** The one fact the engines cannot report: a pause is resumable, a stop is not. */
    let paused = false;
    /** The executor turned the run backwards (a rewind); only then does it touch the rate again,
     *  so a custom rate set through the api survives every on / off. */
    let reversed = false;
    /** A deferred move in flight (iteration completion, a loop's rewind) — one at a time. */
    let pending: (() => void) | null = null;
    const cancelPending = (): void => { pending?.(); pending = null; };

    const atEnd = (): boolean => { const t = api.getCurrentTime(); return t !== null && t >= cfg.totalMs - SNAP_EPSILON_MS; };
    const atStart = (): boolean => { const t = api.getCurrentTime(); return t !== null && t <= SNAP_EPSILON_MS; };

    /** An off in flight — rewinding, or completing its iteration — reads as STOPPED: it is heading there,
     *  and a `start` event turns it around (the hover-in during a hover-out rewind). */
    const state = (): PxPlayState => {
        if (reversed || pending) return PxPlayState.stopped;
        return api.isPlaying() ? PxPlayState.playing : paused ? PxPlayState.paused : PxPlayState.stopped;
    };

    const forward = (): void => { if (reversed) { reversed = false; api.setPlaybackRate(1); } };
    /** The start pose, at rest. */
    const rest = (): void => { forward(); raw.cancel(); };
    /** A fresh run from the beginning (the delay applies again — a restart is a new run). */
    const restart = (): void => { paused = false; rest(); raw.play(); };

    const start = (): void => {
        cancelPending();
        paused = false;
        switch (startTransition) {
            case PxStartTransition.restart:
                restart();
                break;
            case PxStartTransition.jumpToFinished:
                // the end pose with no motion; a loop has no end — its first pass's end stands in
                forward();
                if (world === PxPlaybackWorld.oneShot) api.finish();
                else { raw.pause(); api.setCurrentTime(passMs); }
                break;
            case PxStartTransition.continue:
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
        api.setPlaybackRate(-1);
        raw.play();
        if (world === PxPlaybackWorld.loop) {
            const t0 = api.getCurrentTime() ?? 0;
            const target = Math.floor(Math.max(t0 - SNAP_EPSILON_MS, 0) / passMs) * passMs;
            watch(() => { const t = api.getCurrentTime(); return t === null || t <= target + SNAP_EPSILON_MS; }, rest);
        }
    };

    /** The off-action itself, from the current position. */
    const performOff = (): void => {
        paused = false;
        if (stopTransition === PxStopTransition.rewind) rewind();
        else rest();
    };

    const stop = (): void => {
        // already stopping, or already at rest; a STOPPED player elsewhere (the end pose, a held frame) still goes to rest
        if (reversed || (state() === PxPlayState.stopped && !pending && atStart())) return;
        if (completeIteration && api.isPlaying()) {
            // the off lands on the iteration boundary, not mid-beat (a one-shot: at its end)
            const startIteration = Math.floor((api.getCurrentTime() ?? 0) / passMs);
            watch(() => { const t = api.getCurrentTime(); return t !== null && Math.floor(t / passMs) > startIteration; }, performOff);
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
        cancel: () => { cancelPending(); paused = false; rest(); },
        showEnd: () => { cancelPending(); paused = false; api.setCurrentTime(cfg.totalMs); },
        rewind,
        onNaturalFinish: () => {
            if (pending) return;                       // a deferred move owns the end (an off completing its iteration)
            paused = false;
            if (reversed) { rest(); return; }          // the end of a rewind: rest at the start
            if (finishTransition === PxFinishTransition.reset) rest();
            else if (finishTransition === PxFinishTransition.rewind) rewind();
        },
        dispose: cancelPending,
    };
}

// ── the declarative half ───────────────────────────────────────────────────────────────────

/** One step the declarative resolver asks the executor for. @public @advanced */
export enum PxDeclarativeAction {
    /** Silent mount pose: the FINISH pose with no motion (a seek, no lifecycle events). */
    showEnd = 'showEnd',
    /** The configured play-start. */
    start = 'start',
    /** The configured play-stop. */
    stop = 'stop',
    /** Freeze the clock at the current frame. */
    pause = 'pause',
    /** Unfreeze: continue toward the current target. */
    resume = 'resume',
}

/** The declarative props a change is judged by. @public @advanced */
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
 * to ask the executor for, plus the usage warnings to emit. `play` names a STATE: a one-shot's
 * finish pose (a mount never animates — it shows the pose) or a loop's running. A contract breach
 * (`pause` without `play`) warns and changes nothing.
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
        // a loop with `play` runs (running IS the named state); a one-shot shows its pose without motion
        if (next.play) {
            if (world === PxPlaybackWorld.loop) { if (!next.pause) actions.push(PxDeclarativeAction.start); }
            else actions.push(PxDeclarativeAction.showEnd);
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
export type PxDeclarativeTarget = Pick<PxAnimationPlayerApi, 'play' | 'pause' | 'stop' | 'setCurrentTime'>;

/** Executes one {@link PxDeclarativeAction} on the api; `totalMs` is the whole run, for the mount pose. @public @advanced */
export function applyDeclarativeAction(api: PxDeclarativeTarget, action: PxDeclarativeAction, totalMs: number): void {
    switch (action) {
        case PxDeclarativeAction.showEnd: api.setCurrentTime(totalMs); break;
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
    cancel: () => void;
    /** ONE fresh pass from the start, whatever `iterations` say. */
    playOnce: () => void;
    getDuration: () => number | null;
    /** The executor every driver shares — the triggers and the components use it, never a second one. */
    playExecutor: PxPlayExecutor;
}

/**
 * Completes an engine api with the COMPOSED members — ONE implementation on top of any engine, so
 * none can drift: `play()` / `pause()` / `stop()` / `cancel()` through the player's one executor
 * (review §10, D5), `playOnce()` (always a fresh pass from the start; a multi-pass document gets a
 * boundary watcher that settles at the end of pass ONE — `'reset'` snaps to rest, the default holds
 * the pass-end pose; re-entrant) and `getDuration()` (one pass of the content window, ms; review §14).
 * Reuses an executor the engine already attached (`playExecutor`), so triggers wired inside the
 * engine and the public api share one state. Mutates and returns the same object.
 * @public @advanced
 */
export function composeApiExtras<T extends PxApiExtrasTarget>(api: T, cfg: PxApiExtrasConfig, raf: (cb: () => void) => void): T & PxApiExtras {
    const raw = { play: api.play.bind(api), pause: api.pause.bind(api), cancel: api.cancel.bind(api),
        getCurrentTime: api.getCurrentTime.bind(api), setCurrentTime: api.setCurrentTime.bind(api) };
    const { passMs, totalMs } = executorConfigOf(cfg);
    const iterations = passMs > 0 ? totalMs / passMs : 1;
    const executor = ensurePlayExecutor(api, cfg, raf);
    // ONE type-level widening: every member is assigned right below, completing the api.
    const full = api as T & PxApiExtras;
    full.playExecutor = executor;
    full.play = () => executor.play();
    full.pause = () => executor.pause();
    full.stop = () => executor.stop();
    full.cancel = () => executor.cancel();
    full.getDuration = () => cfg.duration ?? null;
    let token = 0;
    // destroy() invalidates a pending pass watcher — otherwise it rAF-loops forever on a dead animator
    if (full.destroy) {
        const destroyEngine = full.destroy.bind(full);
        full.destroy = () => { token++; executor.dispose(); destroyEngine(); };
    }
    full.playOnce = () => {
        const mine = ++token;
        executor.cancel();
        raw.play();
        const multiPass = iterations > 1;
        if (!multiPass || !passMs) return;
        const tick = (): void => {
            if (mine !== token) return;                 // a later playOnce took over
            const t = raw.getCurrentTime();
            if (t !== null && t >= passMs) {
                if (resolveActions(cfg.actions).finish.transition === PxFinishTransition.reset) raw.cancel();
                else { raw.pause(); raw.setCurrentTime(passMs); }
                return;
            }
            raf(tick);
        };
        raf(tick);
    };
    return full;
}
