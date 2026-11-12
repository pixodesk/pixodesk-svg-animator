// @px-area control
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// ============================================================================
// THE PLAY EXECUTOR — one implementation of the four buttons for every driver
// (dev-docs/plans/playback-layers.md, dev-docs/plans/animation-state.brainstorm.md): the `playback` prop, the
// triggers' event lists and the imperative api all end up here. The timeline's `actions` say HOW (`playback.start` /
// `playback.stop`), `atEnd` what the end of the pass does; the executor performs them on any engine api, owns the
// states the engines cannot tell apart — OFF versus PAUSED versus FINISHED versus RETURNING — so the state rule can
// be applied, and tells the playback events (`onPlaybackStart` / `onPlaybackStop` / `onPlaybackPause` / `onPlaybackResume`) when it performs
// the act — never the engine's raw `onPlay` / `onPause`, which the gate's hold and a jump's internal pause also fire.
//
// The playback (schema 1.25; "the run" in 1.24): one instance of the animation being in effect — `playback.start` begins
// it, it lasts while `playing` · `paused` · `finished`, `playback.stop` or `atEnd: jumpToStart` / `animateToStart` retire
// it; `off` = no playback; `returning` = no playback, the picture still playing back to the rest pose.
//
// The action model (schema 1.23): every move names a destination (start | end) and a manner (jump | animate);
// arriving at the END by any route — the natural end, `stopPlayback: '…ToEnd'`, `startPlayback: 'jumpToEnd'`, `jumpToEnd()` —
// runs `atEnd`. "End" is the end of the CURRENT pass (a one-shot: the playback's end).
//
// The declarative half (`playback` as a prop, review §10) is a thin resolver on top: the lever's three positions —
// `off` · `on` · `paused` — and a change between two of them is one or two buttons, spelled with the executor's verbs.
// ============================================================================

import type { PxActions, PxAnimationPlayerApi, PxEngineAnimationPlayerApi, PxPlayExecutor, PxPlaybackControls, PxPlaybackListeners } from '../format/PxAnimatorTypes';
import { PxAtEndBehavior, PxStopPlaybackBehavior, PxStartPlaybackBehavior, PxPlaybackState, PxPlayback, type PxPlaybackDirection, resolveActions } from '../format/PxAnimatorConstants';
import { iterationIndexOf, iterationTimeOf, runMsOf, totalDurationMs, type PxRunGeometry } from './PxPlaybackTime';

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
    'play' | 'pause' | 'jumpToStart' | 'jumpToEnd' | 'getPlaybackSpeed' | 'setPlaybackSpeed' | 'getTotalTime' | 'setTotalTime' | 'isPlaying'>;

/** What the executor needs beside the api: the playback's geometry, the timeline's `actions` and its `atEnd`. @public @advanced */
export interface PxPlayExecutorConfig {
    /** One pass of the content window, ms (`getAnimatorConfig(doc).duration`). */
    passMs: number;
    /** The whole playback, ms — `passMs × iterations`; `Infinity` when endless. */
    totalMs: number;
    actions?: PxActions;
    atEnd?: PxAtEndBehavior;
}

const SNAP_EPSILON_MS = 1;

// @px-area control
/**
 * Builds the executor for one player. `raf` is injected (the web passes requestAnimationFrame) for
 * the deferred moves — playing on to the end of the pass (`animateToEnd`), stopping a loop's
 * `animateToStart` at the pass's start, and `playOnce()` on a loop. The engine's raw `play` / `pause` /
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
    const startBehavior = actions.startPlayback.behavior;
    const stopBehavior = actions.stopPlayback.behavior;
    const atEnd = actions.atEnd;
    /** The player's playback events — told whenever a button's act is performed. */
    let listeners: PxPlaybackListeners | undefined;
    const tellStart = (): void => { listeners?.onPlaybackStart?.(); };
    const tellStop = (): void => { listeners?.onPlaybackStop?.(); };
    const tellPause = (): void => { listeners?.onPlaybackPause?.(); };
    const tellResume = (): void => { listeners?.onPlaybackResume?.(); };

    /** The one fact the engines cannot report: a pause is resumable, a stop is not. */
    let paused = false;
    /** The executor turned the playback backwards (an `animateToStart` leg — the `returning` state); only then does it touch
     *  the speed again, so a custom speed set through the api survives every on / off. */
    let reversed = false;
    /** A LOOP held at a pass end by a stop that went there (`atEnd: hold`) — the engines cannot report it. */
    let heldAtEnd = false;
    /** A deferred move in flight (`animateToEnd`, a loop's `animateToStart`, `playOnce` on a loop) — one at a time. */
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

    /** The playback's state. A return leg reads RETURNING (no playback; `playback.start` turns it around — the hover-in during a
     *  hover-out `animateToStart`); an `animateToEnd` in flight is still PLAYING. A playback that reached its end and rests
     *  there is FINISHED — `playback.stop` still acts on it, `playback.start` is a fresh playback. */
    const state = (): PxPlaybackState => {
        if (reversed) return PxPlaybackState.returning;
        if (api.isPlaying()) return PxPlaybackState.playing;
        if (paused) return PxPlaybackState.paused;
        return heldAtEnd || atEndPos() ? PxPlaybackState.finished : PxPlaybackState.off;
    };

    const forward = (): void => { if (reversed) { reversed = false; api.setPlaybackSpeed(forwardSpeed); } };
    /** The rest pose, at rest. */
    const rest = (): void => { heldAtEnd = false; forward(); raw.jumpToStart(); };
    /** A fresh playback from the beginning (the delay applies again — a new playback). */
    const restart = (): void => { paused = false; rest(); raw.play(); };

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
     *  a loop: held on the pass boundary (the playback has no end to report). */
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

    /** Plays on to the end of the pass (a paused playback resumes), then `onPlaybackStop` and `atEnd`. A one-shot arrives with the
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

    /** Lever 1 on: the configured start. A fresh playback tells `onPlaybackStart`; `continue` on a paused playback only unfreezes it
     *  (`onPlaybackResume`); `continue` while playing changes nothing. */
    const startPlayback = (): void => {
        const was = state();
        const wasPaused = paused;
        cancelPending();
        paused = false;
        heldAtEnd = false;
        switch (startBehavior) {
            case PxStartPlaybackBehavior.jumpToStart:
                restart();
                tellStart();
                break;
            case PxStartPlaybackBehavior.jumpToEnd:
                // the end pose with no motion, then `atEnd`; a loop has no end — its first pass's end stands in
                forward();
                if (world === PxPlaybackWorld.oneShot) raw.jumpToEnd();
                else { raw.pause(); api.setTotalTime(passMs); finishAt(); }
                tellStart();
                break;
            case PxStartPlaybackBehavior.continue:
            default:
                // continue from where it is; at the end of a one-shot that is a fresh playback from the beginning (a loop
                // held at a pass end plays on from there — the playback's end is the only end that restarts)
                if (atEndPos() && !api.isPlaying()) { restart(); tellStart(); break; }
                if (was === PxPlaybackState.playing) break;
                forward();
                raw.play();
                if (wasPaused) tellResume(); else tellStart();
        }
    };

    /** Lever 1 off: the configured stop. Nothing to stop when there is no playback (`off` at rest, `returning`). */
    const stopPlayback = (): void => {
        const was = state();
        if (was === PxPlaybackState.returning || (was === PxPlaybackState.off && atStartPos())) return;
        const toEnd = stopBehavior === PxStopPlaybackBehavior.jumpToEnd || stopBehavior === PxStopPlaybackBehavior.animateToEnd;
        // a stop that goes to the end has nothing to do once it rests there
        if (toEnd && was === PxPlaybackState.finished) return;
        if (stopBehavior === PxStopPlaybackBehavior.animateToEnd) {
            if (pending) return;                                         // already on its way there
            animateToEnd();                                              // `onPlaybackStop` on arrival
            return;
        }
        cancelPending();
        paused = false;
        if (stopBehavior === PxStopPlaybackBehavior.animateToStart) animateToStart();
        else if (stopBehavior === PxStopPlaybackBehavior.jumpToEnd) jumpToEnd();
        else rest();
        tellStop();
    };

    /** Lever 2 on: freeze — only while PLAYING (a return leg, a finished or an off one have nothing to freeze). */
    const pausePlayback = (): void => {
        if (state() !== PxPlaybackState.playing) return;
        cancelPending();
        raw.pause();
        paused = true;
        tellPause();
    };

    /** Lever 2 off: continue from the frozen frame — only while paused. */
    const resumePlayback = (): void => {
        if (!paused) return;
        paused = false;
        raw.play();
        tellResume();
    };

    /** ONE fresh pass from the start; a loop stops at its first pass end, per `atEnd`. */
    const playOnce = (): void => {
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
        startPlayback,
        stopPlayback,
        pausePlayback,
        resumePlayback,
        jumpToStart: () => { cancelPending(); paused = false; rest(); },
        animateToStart,
        playOnce,
        setListeners: (next) => { listeners = next; },
        onNaturalFinish: () => {
            if (arrive) { const arrival = arrive; cancelPending(); arrival(); return; }   // an `animateToEnd` arrived
            if (pending) return;                       // a loop's `animateToStart` or `playOnce` owns the end
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
export interface PxApiExtrasConfig extends Pick<PxPlayExecutorConfig, 'actions' | 'atEnd'> {
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
    /** Everything a page does to the animation — the public `player.playback` ({@link PxPlaybackControls}). */
    playback: PxPlaybackControls;
    /** The executor every driver shares — the triggers and the components use it, never a second one. */
    playExecutor: PxPlayExecutor;
}

/** An engine's primitives with `playback` composed on top — what `composeApiExtras` returns and the frame-loop
 *  factory hands a player author; a {@link PxAnimationPlayerApi} as far as a page is concerned. @public @advanced */
export type PxComposedAnimationPlayerApi<TRoot = unknown> = PxEngineAnimationPlayerApi<TRoot> & PxApiExtras;

/**
 * Completes an engine api with `playback` — ONE implementation on top of any engine, so none can drift: the four
 * buttons, `jumpToStart()` and `playOnce()` through the player's one executor (review §10, D5), `getDuration()` (one
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
    const setCurrentTime = (ms: number): void => raw.setTotalTime(runMsOf(getCurrentIteration(), ms, geometry));
    const playback: PxPlaybackControls = {
        "start": () => executor.startPlayback(),
        "stop": () => executor.stopPlayback(),
        "pause": () => executor.pausePlayback(),
        "resume": () => executor.resumePlayback(),
        "playOnce": () => executor.playOnce(),
        "getState": getState,
        "isActive": () => {
            const s = getState();
            return s === PxPlaybackState.playing || s === PxPlaybackState.paused || s === PxPlaybackState.finished;
        },
        "isPlaying": () => api.isPlaying(),
        "jumpToStart": () => executor.jumpToStart(),
        "jumpToEnd": () => api.jumpToEnd(),
        "getDuration": () => cfg.duration ?? null,
        "getCurrentTime": getCurrentTime,
        "setCurrentTime": setCurrentTime,
        "getCurrentProgress": () => { const t = getCurrentTime(); return t === null ? null : (passMs > 0 ? t / passMs : 0); },
        "setCurrentProgress": (p) => setCurrentTime((Number.isFinite(p) ? Math.min(1, Math.max(0, p)) : 0) * passMs),
        "getCurrentIteration": getCurrentIteration,
        "getTotalDuration": getTotalDuration,
        "getTotalTime": () => raw.getTotalTime(),
        "setTotalTime": (ms) => raw.setTotalTime(ms),
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
    start: 'playback.start()', stop: 'playback.stop()', pause: 'playback.pause()', resume: 'playback.resume()',
    playOnce: 'playback.playOnce()', jumpToStart: 'playback.jumpToStart()', jumpToEnd: 'playback.jumpToEnd()',
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
        "stop": () => write(PxPlaybackWrite.stop, p => p.stop()),
        "pause": () => write(PxPlaybackWrite.pause, p => p.pause()),
        "resume": () => write(PxPlaybackWrite.resume, p => p.resume()),
        "playOnce": () => write(PxPlaybackWrite.playOnce, p => p.playOnce()),
        "getState": () => target()?.getState() ?? idleState(),
        "isActive": () => target()?.isActive() ?? false,
        "isPlaying": () => target()?.isPlaying() ?? false,
        "jumpToStart": () => write(PxPlaybackWrite.jumpToStart, p => p.jumpToStart()),
        "jumpToEnd": () => write(PxPlaybackWrite.jumpToEnd, p => p.jumpToEnd()),
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
