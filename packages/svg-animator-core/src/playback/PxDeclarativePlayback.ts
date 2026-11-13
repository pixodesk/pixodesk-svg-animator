// @px-area control
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// ============================================================================
// THE PLAY EXECUTOR — one implementation of the buttons for every driver
// (dev-docs/plans/playback-layers.md, animation-state.brainstorm.md, animation-state.feedback.2026-11-12.md): the
// `playback` prop, the triggers' event lists, the visibility gate and the imperative api all end up here.
//
// - The STATE is the executor's own: off · playing · paused · finished · returning. The engines cannot tell those
//   apart, and since 1.26 the state never follows the picture: a finished playback stays `finished` whatever
//   `whenFinished` shows, and a seek that was not made while playing makes it `paused` there.
// - The buttons (1.26): `start` always from the start; `play` starts or carries on; `stop` per
//   `actions["playback.stop"]`; `pause` / `resume`. The gate presses them too (`leaveView` / `returnToView`).
// - The events (`onPlaybackStart` … `onPlaybackFinish`) are told when the act is performed — never the engine's raw
//   `onPlay` / `onPause` / `onFinish`, which a jump's internal pause and the end of a return leg also fire.
// - The declarative half (`playback` as a prop, review §10) is a thin resolver on top: the lever's three positions —
//   `off` · `on` · `paused` — and a change between two of them is one or two buttons.
// ============================================================================

import type { PxActions, PxAnimationPlayerApi, PxEngineAnimationPlayerApi, PxPlayExecutor, PxPlaybackControls, PxPlaybackListeners } from '../format/PxAnimatorTypes';
import { PxWhenFinished, PxStopPlaybackBehavior, PxOutOfViewBehavior, PxPlaybackState, PxPlayback, type PxPlaybackDirection, resolveActions } from '../format/PxAnimatorConstants';
import { iterationIndexOf, iterationTimeOf, isReversedIteration, runMsOf, totalDurationMs, type PxRunGeometry } from './PxPlaybackTime';

/** What a playback is on this document: a POSE (one-shot — it plays to its end and rests) or a PLAYBACK that loops. @public @advanced */
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
export type PxPlayTarget = Pick<PxEngineAnimationPlayerApi,
    'play' | 'pause' | 'jumpToStart' | 'getPlaybackSpeed' | 'setPlaybackSpeed' | 'getTotalTime' | 'setTotalTime' | 'isPlaying'>;

/** What the executor needs beside the api: the playback's geometry, the timeline's `actions` and its `whenFinished`. @public @advanced */
export interface PxPlayExecutorConfig {
    /** One pass of the content window, ms (`getAnimatorConfig(doc).duration`). */
    passMs: number;
    /** The whole playback, ms — `passMs × iterations`; `Infinity` when endless. */
    totalMs: number;
    /** Each pass's direction — a stop that finishes a pass played backwards is already at the start pose. */
    direction?: PxPlaybackDirection;
    actions?: PxActions;
    whenFinished?: PxWhenFinished;
}

const SNAP_EPSILON_MS = 1;

// @px-area control
/**
 * Builds the executor for one player. `raf` is injected (the web passes requestAnimationFrame) for the deferred moves —
 * playing on to the end of the pass (`animateToEnd` / `animateToEndAndBack`) and stopping a loop's return leg at the start
 * of its pass. The engine's raw `play` / `pause` / `jumpToStart` are bound at creation; everything else is read live. A
 * return leg turns the speed negative and restores the speed it found (the file's `playbackSpeed`, or what the page set).
 * @public @advanced
 */
export function createPlayExecutor(api: PxPlayTarget, cfg: PxPlayExecutorConfig, raf: (cb: () => void) => void): PxPlayExecutor {
    const raw = { play: api.play.bind(api), pause: api.pause.bind(api), jumpToStart: api.jumpToStart.bind(api) };
    const world = resolvePlaybackWorld(cfg.totalMs === Infinity ? 'infinite' : cfg.passMs > 0 ? cfg.totalMs / cfg.passMs : 1);
    const passMs = Math.max(cfg.passMs, 1);
    const iterations = cfg.passMs > 0 ? cfg.totalMs / cfg.passMs : 1;
    const actions = resolveActions(cfg.actions, cfg.whenFinished);
    const stopBehavior = actions.stopPlayback.behavior;
    const whenFinished = actions.whenFinished;
    /** The player's playback events — told whenever a button's act is performed. */
    let listeners: PxPlaybackListeners | undefined;
    const tellStart = (): void => { listeners?.onPlaybackStart?.(); };
    const tellStop = (): void => { listeners?.onPlaybackStop?.(); };
    const tellPause = (): void => { listeners?.onPlaybackPause?.(); };
    const tellResume = (): void => { listeners?.onPlaybackResume?.(); };
    const tellFinish = (): void => { listeners?.onPlaybackFinish?.(); };

    // ── the state the engines cannot report ──
    /** A freeze — a pause, or a seek that was not made while playing. */
    let paused = false;
    /** The playback reached its end; it stays finished whatever the picture then shows, until a start, a stop or a seek. */
    let finished = false;
    /** A return leg plays backwards (a stop's `animateToStart`, or `whenFinished: animateToStart`); the speed is restored after. */
    let reversed = false;
    /** What the visibility gate did when the graphic left the screen — undone when it comes back, unless something else
     *  changed the playback in between (every button and seek clears it). */
    let gateOwes: 'resume' | 'start' | undefined;
    /** A deferred move in flight (a stop finishing its pass, a loop's return leg) — one at a time. */
    let pending: (() => void) | null = null;
    /** The arrival of a stop finishing its pass — the watch or the engine's natural end calls it, whichever is first. */
    let arrive: (() => void) | null = null;
    const cancelPending = (): void => { pending?.(); pending = null; arrive = null; };

    const atStartPos = (): boolean => { const t = api.getTotalTime(); return t !== null && t <= SNAP_EPSILON_MS; };
    /** The end of the pass the playhead is in — a boundary it rests on counts as the end of the pass it closes. */
    const passEndMs = (): number => {
        if (world === PxPlaybackWorld.oneShot) return cfg.totalMs;
        const t = Math.max(api.getTotalTime() ?? 0, 0);
        return Math.max(Math.ceil((t - SNAP_EPSILON_MS) / passMs), 1) * passMs;
    };
    /** The forward speed a return leg found, restored when it ends — a custom speed survives every on / off. */
    let forwardSpeed = 1;

    const state = (): PxPlaybackState => {
        if (finished) return PxPlaybackState.finished;
        if (reversed) return PxPlaybackState.returning;
        if (api.isPlaying()) return PxPlaybackState.playing;
        if (paused) return PxPlaybackState.paused;
        return PxPlaybackState.off;
    };

    const forward = (): void => { if (reversed) { reversed = false; api.setPlaybackSpeed(forwardSpeed); } };
    /** The picture to the rest pose, at rest — the state is the caller's to set. */
    const rest = (): void => { forward(); raw.jumpToStart(); };
    /** A fresh playback from the beginning (the delay applies again). `off` is always the rest pose already, so only the
     *  other states jump there first. */
    const restart = (): void => {
        const atRest = state() === PxPlaybackState.off;
        cancelPending(); paused = false; finished = false; gateOwes = undefined;
        if (!atRest) rest();
        raw.play();
    };
    /** The picture held at `ms` on the whole playback, the clock stopped — no engine finish is fired. */
    const holdAt = (ms: number): void => { forward(); raw.pause(); api.setTotalTime(ms); };

    /** Watches the whole-playback time each frame; fires `then` once `test` holds, unless cancelled. */
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

    /** The picture plays back to the start (a loop: the start of its pass) and rests there — a return leg. */
    const animateToStart = (): void => {
        cancelPending();
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

    /** The playback is finished (1.26: whatever the picture then shows): `whenFinished` moves the picture only. */
    const finish = (): void => {
        paused = false;
        finished = true;
        if (whenFinished === PxWhenFinished.jumpToStart) rest();
        else if (whenFinished === PxWhenFinished.animateToStart) animateToStart();
    };

    /** Plays on to the end of the current pass (a paused playback continues), holds there, then `then`. A one-shot arrives
     *  with the engine's natural end, a loop is held on the pass boundary. */
    const animateToEnd = (then: () => void): void => {
        paused = false;
        forward();
        const end = passEndMs();
        if (!api.isPlaying()) raw.play();
        let done = false;
        const arrival = (): void => {
            if (done) return;
            done = true;
            arrive = null;
            holdAt(end);
            then();
        };
        watch(() => { const t = api.getTotalTime(); return t !== null && t >= end - SNAP_EPSILON_MS; }, arrival);
        arrive = arrival;
    };

    /** Whether the pass that ends at `endMs` played backwards — its end shows the start pose. */
    const passEndsAtStartPose = (endMs: number): boolean => isReversedIteration(iterationIndexOf(endMs, passMs, iterations), cfg.direction);

    // ── the buttons ──

    /** From the start, in every state. */
    const startPlayback = (): void => { restart(); tellStart(); };

    /** Start or carry on. */
    const playPlayback = (): void => {
        const was = state();
        if (was === PxPlaybackState.playing) return;
        if (was === PxPlaybackState.paused) { resumePlayback(); return; }
        if (reversed) {
            // a picture on its way back turns around and plays forward from where it is
            cancelPending();
            finished = false;
            gateOwes = undefined;
            forward();
            raw.play();
            tellStart();
            return;
        }
        startPlayback();
    };

    /** The configured stop. Nothing to stop when there is no playback (`off`, `returning`). */
    const stopPlayback = (): void => {
        const was = state();
        if (was === PxPlaybackState.off || was === PxPlaybackState.returning) return;
        gateOwes = undefined;
        switch (stopBehavior) {
            case PxStopPlaybackBehavior.animateToEnd:
            case PxStopPlaybackBehavior.animateToEndAndBack: {
                const back = stopBehavior === PxStopPlaybackBehavior.animateToEndAndBack;
                if (was === PxPlaybackState.finished) {
                    if (!back) return;                                      // already at the end
                    break;                                                  // only the way back is left: below
                }
                if (arrive) return;                                         // already on its way there
                animateToEnd(() => {
                    tellStop();
                    if (!back) { finish(); return; }
                    paused = false;
                    if (passEndsAtStartPose(api.getTotalTime() ?? 0)) rest(); else animateToStart();
                });
                return;
            }
            case PxStopPlaybackBehavior.jumpToEnd:
                if (was === PxPlaybackState.finished) return;               // already there
                cancelPending();
                holdAt(passEndMs());
                tellStop();
                finish();
                return;
        }
        cancelPending();
        paused = false;
        finished = false;
        if (stopBehavior === PxStopPlaybackBehavior.animateToStart || stopBehavior === PxStopPlaybackBehavior.animateToEndAndBack) animateToStart();
        else rest();
        tellStop();
    };

    /** Freeze — only while playing. */
    const pausePlayback = (): void => {
        if (state() !== PxPlaybackState.playing) return;
        cancelPending();
        raw.pause();
        paused = true;
        gateOwes = undefined;
        tellPause();
    };

    /** Continue from the frozen frame — only while paused. */
    const resumePlayback = (): void => {
        if (state() !== PxPlaybackState.paused) return;
        paused = false;
        gateOwes = undefined;
        raw.play();
        tellResume();
    };

    /** The seek rule: playing keeps playing from there; any other state becomes paused at that frame. Reports nothing. */
    const seek = (ms: number): void => {
        if (state() === PxPlaybackState.playing) { api.setTotalTime(ms); return; }
        cancelPending();
        finished = false;
        gateOwes = undefined;
        holdAt(ms);
        paused = true;
    };

    /** The gate's closing edge. */
    const leaveView = (behavior: PxOutOfViewBehavior): void => {
        if (behavior === PxOutOfViewBehavior.continue) return;
        // off screen, a return leg ends at once — there is nothing to see
        if (reversed) { cancelPending(); rest(); }
        const was = state();
        if (behavior === PxOutOfViewBehavior.pause) {
            if (was !== PxPlaybackState.playing) return;
            pausePlayback();
            gateOwes = 'resume';
            return;
        }
        // `stop`: a hard stop — at once, whatever the stop action says
        if (was !== PxPlaybackState.playing && was !== PxPlaybackState.finished) return;
        cancelPending();
        paused = false;
        finished = false;
        rest();
        tellStop();
        gateOwes = 'start';
    };

    /** The gate's opening edge: undo what it did. */
    const returnToView = (): void => {
        const owed = gateOwes;
        gateOwes = undefined;
        if (owed === 'resume') resumePlayback();
        else if (owed === 'start' && state() === PxPlaybackState.off) startPlayback();
    };

    return {
        state,
        startPlayback,
        playPlayback,
        stopPlayback,
        pausePlayback,
        resumePlayback,
        seek,
        leaveView,
        returnToView,
        setListeners: (next) => { listeners = next; },
        onNaturalFinish: () => {
            if (arrive) { const arrival = arrive; cancelPending(); arrival(); return; }   // a stop finishing its pass arrived
            if (pending) return;                       // a loop's return leg owns the end
            if (reversed) { rest(); return; }          // the end of a return leg: rest at the start (the state stays as it is)
            tellFinish();
            finish();
        },
        dispose: cancelPending,
    };
}

// ── the declarative half ───────────────────────────────────────────────────────────────────

/** One step the declarative resolver asks the executor for — one of the four buttons. @public @advanced */
export enum PxDeclarativeAction {
    startPlayback = 'startPlayback',
    stopPlayback = 'stopPlayback',
    pausePlayback = 'pausePlayback',
    resumePlayback = 'resumePlayback',
}

/** The declarative prop a change is judged by — the lever's position. @public @advanced */
export interface PxDeclarativeProps {
    playback?: PxPlayback;
}

/** What {@link resolveDeclarativePlayback} is given. @public @advanced */
export interface PxDeclarativeArgs {
    /** Informational — the one-shot / loop world the playback is in (the pose contract is the components'). */
    world: PxPlaybackWorld;
    /** The previous render's props; `undefined` on mount or when the player was recreated. */
    prev?: PxDeclarativeProps;
    next: PxDeclarativeProps;
}

/**
 * ONE rule for the `playback` prop (review §10, D5). Pure: returns the ordered buttons to press. The diff of two
 * positions: `off` → `on` is `playback.start`, `on` → `paused` is `playback.pause`, `paused` → `on` is `playback.resume`, anything →
 * `off` is `playback.stop`; `off` → `paused` is `playback.start` + `playback.pause` (the first frame, held). A MOUNT with `"off"`
 * presses nothing (no playback to stop); a mount with `"on"` starts the playback (a one-shot plays to its end and rests
 * there), with `"paused"` starts it frozen. No position pair is invalid, so there is nothing to warn about.
 * @public @advanced
 */
export function resolveDeclarativePlayback(args: PxDeclarativeArgs): { actions: Array<PxDeclarativeAction> } {
    const { prev, next } = args;
    const actions: Array<PxDeclarativeAction> = [];
    const to = next.playback;
    if (to === undefined) return { actions };
    const mount = prev === undefined;
    const from = prev?.playback;
    if (from === to) return { actions };
    switch (to) {
        case PxPlayback.on:
            actions.push(from === PxPlayback.paused ? PxDeclarativeAction.resumePlayback : PxDeclarativeAction.startPlayback);
            break;
        case PxPlayback.paused:
            if (from !== PxPlayback.on) actions.push(PxDeclarativeAction.startPlayback);
            actions.push(PxDeclarativeAction.pausePlayback);
            break;
        case PxPlayback.off:
            if (!mount) actions.push(PxDeclarativeAction.stopPlayback);
            break;
    }
    return { actions };
}

/** The slice of `player.playback` the declarative resolver drives — the PUBLIC buttons, which already go through
 *  the player's one executor (a component's forwarder qualifies, and queues the calls until the player exists). @public @advanced */
export type PxDeclarativeTarget = Pick<PxPlaybackControls, 'start' | 'stop' | 'pause' | 'resume'>;

/** Presses one {@link PxDeclarativeAction} on the api. @public @advanced */
export function applyDeclarativeAction(api: PxDeclarativeTarget, action: PxDeclarativeAction): void {
    switch (action) {
        case PxDeclarativeAction.startPlayback: api.start(); break;
        case PxDeclarativeAction.stopPlayback: api.stop(); break;
        case PxDeclarativeAction.pausePlayback: api.pause(); break;
        case PxDeclarativeAction.resumePlayback: api.resume(); break;
    }
}

// ── the composed api ───────────────────────────────────────────────────────────────────────

/** The slice of the runtime view {@link composeApiExtras} reads. @public @advanced */
export interface PxApiExtrasConfig extends Pick<PxPlayExecutorConfig, 'actions' | 'whenFinished'> {
    /** One pass of the content window, ms. */
    duration?: number;
    iterations?: number | 'infinite';
    /** Each pass's direction — the per-iteration reads count a reversed pass down. */
    direction?: PxPlaybackDirection;
    /** The file's `timeline.playbackSpeed` — set on the engine once at composition; the handle's `setPlaybackSpeed` replaces it. */
    playbackSpeed?: number;
    /** The player's playback callbacks, handed to the executor: told whenever a button's act is performed. */
    playbackListeners?: PxPlaybackListeners;
}

/** The executor's geometry, `actions` and `whenFinished` from the runtime view. @public @advanced */
export function executorConfigOf(cfg: PxApiExtrasConfig): PxPlayExecutorConfig {
    const passMs = cfg.duration ?? 0;
    const iterations = cfg.iterations === 'infinite' ? Infinity : (typeof cfg.iterations === 'number' && cfg.iterations >= 1 ? cfg.iterations : 1);
    return {
        passMs, totalMs: passMs * iterations, direction: cfg.direction, actions: cfg.actions, whenFinished: cfg.whenFinished,
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
    /** Everything a page does to the animation — the public `player.playback` ({@link PxPlaybackControls}). */
    playback: PxPlaybackControls;
    /** The executor every driver shares — the triggers and the components use it, never a second one. */
    playExecutor: PxPlayExecutor;
}

/** An engine's primitives with `playback` composed on top — what `composeApiExtras` returns and the frame-loop
 *  factory hands a player author; a {@link PxAnimationPlayerApi} as far as a page is concerned. @public @advanced */
export type PxComposedAnimationPlayerApi<TRoot = unknown> = PxEngineAnimationPlayerApi<TRoot> & PxApiExtras;

/**
 * Completes an engine api with `playback` — ONE implementation on top of any engine, so none can drift: the five
 * buttons and every seek through the player's one executor (review §10, D5), `getDuration()` (one
 * pass of the content window, ms; review §14), the state reads, and every per-iteration and at-speed read off the
 * engine's clock and speed (the time contract on {@link PxPlaybackControls}). Reuses an executor the engine already
 * attached (`playExecutor`), so triggers wired inside the engine and the public api share one state. Mutates and
 * returns the same object; the engine's own flat primitives stay on it for the players' internals.
 * @public @advanced
 */
export function composeApiExtras<T extends PxApiExtrasTarget>(api: T, cfg: PxApiExtrasConfig, raf: (cb: () => void) => void): T & PxApiExtras {
    const raw = { getTotalTime: api.getTotalTime.bind(api), setTotalTime: api.setTotalTime.bind(api) };
    const { passMs, totalMs } = executorConfigOf(cfg);
    const iterations = passMs > 0 ? totalMs / passMs : 1;
    const geometry: PxRunGeometry = { durationMs: passMs, iterations, direction: cfg.direction };
    const executor = ensurePlayExecutor(api, cfg, raf);
    if (cfg.playbackListeners) executor.setListeners(cfg.playbackListeners);
    // the file's speed is the initial one; `playback.setSpeed` replaces it
    if (cfg.playbackSpeed !== undefined && Number.isFinite(cfg.playbackSpeed) && cfg.playbackSpeed > 0) api.setPlaybackSpeed(cfg.playbackSpeed);
    let destroyed = false;
    // the two axes, derived from the engine's one clock (PxPlaybackTime.ts)
    const ready = (): boolean => cfg.duration !== undefined;
    const speedAbs = (): number => Math.abs(api.getPlaybackSpeed()) || 1;
    const getState = (): PxPlaybackState => destroyed ? PxPlaybackState.destroyed : executor.state();
    const getTotalDuration = (): number | null => ready() ? totalDurationMs(passMs, iterations) : null;
    const getCurrentIteration = (): number => iterationIndexOf(raw.getTotalTime() ?? 0, passMs, iterations);
    const getCurrentTime = (): number | null => { const t = raw.getTotalTime(); return t === null ? null : iterationTimeOf(t, geometry); };
    const setCurrentTime = (ms: number): void => executor.seek(runMsOf(getCurrentIteration(), ms, geometry));
    /** Progress counts iterations in play order (1.26): the whole part is the pass, the rest how far through it. */
    const progressCeiling = iterations === Infinity ? Infinity : Math.max(iterations, 1);
    const playback: PxPlaybackControls = {
        "start": () => executor.startPlayback(),
        "play": () => executor.playPlayback(),
        "stop": () => executor.stopPlayback(),
        "pause": () => executor.pausePlayback(),
        "resume": () => executor.resumePlayback(),
        "getState": getState,
        "isActive": () => {
            const s = getState();
            return s === PxPlaybackState.playing || s === PxPlaybackState.paused || s === PxPlaybackState.finished;
        },
        "isPlaying": () => getState() === PxPlaybackState.playing,
        "getDuration": () => cfg.duration ?? null,
        "getCurrentTime": getCurrentTime,
        "setCurrentTime": setCurrentTime,
        "getCurrentProgress": () => { const t = raw.getTotalTime(); return t === null ? null : (passMs > 0 ? Math.max(t, 0) / passMs : 0); },
        "setCurrentProgress": (p) => executor.seek((Number.isFinite(p) ? Math.min(progressCeiling, Math.max(0, p)) : 0) * passMs),
        "getCurrentIteration": getCurrentIteration,
        "getTotalDuration": getTotalDuration,
        "getTotalTime": () => raw.getTotalTime(),
        "setTotalTime": (ms) => executor.seek(ms),
        "getTotalProgress": () => {
            const total = getTotalDuration(); const t = raw.getTotalTime();
            return total === null || t === null ? null : (total > 0 ? Math.min(1, Math.max(0, t / total)) : 0);
        },
        "getSpeed": () => api.getPlaybackSpeed(),
        "setSpeed": (speed) => api.setPlaybackSpeed(speed),
        // at the current speed: every value the position or the length divided by the speed; the setter the speed itself
        "getDurationAtSpeed": () => ready() ? passMs / speedAbs() : null,
        "setDurationAtSpeed": (ms) => { const sign = api.getPlaybackSpeed() < 0 ? -1 : 1; api.setPlaybackSpeed(sign * passMs / ms); },
        "getTotalDurationAtSpeed": () => { const total = getTotalDuration(); return total === null ? null : total / speedAbs(); },
        "getCurrentTimeAtSpeed": () => { const t = getCurrentTime(); return t === null ? null : t / speedAbs(); },
        "getTotalTimeAtSpeed": () => { const t = raw.getTotalTime(); return t === null ? null : t / speedAbs(); },
    };
    // ONE type-level widening: both members are assigned right below, completing the api.
    const full = api as T & PxApiExtras;
    full.playExecutor = executor;
    full.playback = playback;
    // destroy() invalidates a pending watcher — otherwise it rAF-loops forever on a dead animator
    if (full.destroy) {
        const destroyEngine = full.destroy.bind(full);
        full.destroy = () => { destroyed = true; executor.dispose(); destroyEngine(); };
    }
    return full;
}

/** The calls of {@link PxPlaybackControls} that change something — what a forwarder routes through its `write`,
 *  spelled as a page writes them (PX1503 names the call). @public @advanced */
export const PxPlaybackWrite = {
    start: 'playback.start()', play: 'playback.play()', stop: 'playback.stop()', pause: 'playback.pause()', resume: 'playback.resume()',
    setCurrentTime: 'playback.setCurrentTime()', setCurrentProgress: 'playback.setCurrentProgress()',
    setTotalTime: 'playback.setTotalTime()', setSpeed: 'playback.setSpeed()', setDurationAtSpeed: 'playback.setDurationAtSpeed()',
} as const;
export type PxPlaybackWrite = typeof PxPlaybackWrite[keyof typeof PxPlaybackWrite];

/**
 * A `playback` object that FORWARDS to another one, built once for every wrapper — the web player before it is
 * ready, the React / Vue / React Native handles — so none can drift (review §9). `target()` is the live object
 * (`undefined` while there is none: every read gives its idle value, `idleState()` for the state); every write goes
 * through `write(call, run)`, which decides when and whether `run` reaches the target (queue it, warn first).
 * @public @advanced
 */
export function forwardPlaybackControls(
    target: () => PxPlaybackControls | undefined,
    write: (call: PxPlaybackWrite, run: (playback: PxPlaybackControls) => void) => void,
    idleState: () => PxPlaybackState = () => PxPlaybackState.off,
): PxPlaybackControls {
    return {
        "start": () => write(PxPlaybackWrite.start, p => p.start()),
        "play": () => write(PxPlaybackWrite.play, p => p.play()),
        "stop": () => write(PxPlaybackWrite.stop, p => p.stop()),
        "pause": () => write(PxPlaybackWrite.pause, p => p.pause()),
        "resume": () => write(PxPlaybackWrite.resume, p => p.resume()),
        "getState": () => target()?.getState() ?? idleState(),
        "isActive": () => target()?.isActive() ?? false,
        "isPlaying": () => target()?.isPlaying() ?? false,
        "getDuration": () => target()?.getDuration() ?? null,
        "getCurrentTime": () => target()?.getCurrentTime() ?? null,
        "setCurrentTime": (time) => write(PxPlaybackWrite.setCurrentTime, p => p.setCurrentTime(time)),
        "getCurrentProgress": () => target()?.getCurrentProgress() ?? null,
        "setCurrentProgress": (progress) => write(PxPlaybackWrite.setCurrentProgress, p => p.setCurrentProgress(progress)),
        "getCurrentIteration": () => target()?.getCurrentIteration() ?? 0,
        "getTotalDuration": () => target()?.getTotalDuration() ?? null,
        "getTotalTime": () => target()?.getTotalTime() ?? null,
        "setTotalTime": (time) => write(PxPlaybackWrite.setTotalTime, p => p.setTotalTime(time)),
        "getTotalProgress": () => target()?.getTotalProgress() ?? null,
        "getSpeed": () => target()?.getSpeed() ?? 1,
        "setSpeed": (speed) => write(PxPlaybackWrite.setSpeed, p => p.setSpeed(speed)),
        "getDurationAtSpeed": () => target()?.getDurationAtSpeed() ?? null,
        "setDurationAtSpeed": (ms) => write(PxPlaybackWrite.setDurationAtSpeed, p => p.setDurationAtSpeed(ms)),
        "getTotalDurationAtSpeed": () => target()?.getTotalDurationAtSpeed() ?? null,
        "getCurrentTimeAtSpeed": () => target()?.getCurrentTimeAtSpeed() ?? null,
        "getTotalTimeAtSpeed": () => target()?.getTotalTimeAtSpeed() ?? null,
    };
}
