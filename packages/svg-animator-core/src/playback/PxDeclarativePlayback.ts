/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// ============================================================================
// DECLARATIVE PLAYBACK — the `play` / `pause` / `playMode` / `completeIteration` rule
// (first-use review §10), ONE implementation shared by the React, Vue and
// React Native components so the three cannot drift.
//
// The key idea: `play` names a STATE, not a command. For a ONE-SHOT document
// (a single pass) it is a POSE switch — `false` = the start pose, `true` = the
// finish pose — and `playMode` says which pose changes PLAY (animate) vs snap.
// For a LOOPING document it is a RUN switch — running or resting. `pause`
// freezes the clock only and is forcibly lifted by `play: false`.
// ============================================================================

import type { PxAnimatorApi, PxEngineAnimatorApi } from '../format/PxAnimatorTypes';

/** Which pose changes PLAY (animate) vs snap — `fillMode`'s value spellings and side-mapping
 *  (`forwards` is the toward-END side, `backwards` the toward-START side), applied to a
 *  different question: travel, not rest. The default is `forwards`: plays there, snaps back —
 *  the same zero-config behaviour a pre-rendered export's class toggle gives.
 *  @public */
export enum PxPlayMode {
    /** Never plays — both pose changes snap. */
    none = 'none',
    /** Plays toward the end; snaps back to the start (the DEFAULT). */
    forwards = 'forwards',
    /** Snaps to the end; plays back toward the start. */
    backwards = 'backwards',
    /** Plays both ways — the two-pose toggle (hover icons). */
    both = 'both',
}

/** What the declarative `play` drives: a POSE (one-shot) or a RUN (loop). @public @advanced */
export enum PxPlaybackWorld {
    oneShot = 'oneShot',
    loop = 'loop',
}

/** The world from the document's EFFECTIVE iterations (file value + the `iterations` prop):
 *  more than one pass means there is no stable finish pose to switch to. @public @advanced */
export function resolvePlaybackWorld(iterations: number | 'infinite' | undefined): PxPlaybackWorld {
    if (iterations === 'infinite' || (typeof iterations === 'number' && iterations > 1)) return PxPlaybackWorld.loop;
    return PxPlaybackWorld.oneShot;
}

/** One step a component takes against the animator api — see {@link applyDeclarativeAction}.
 *  @public @advanced */
export enum PxDeclarativeAction {
    /** Silent mount pose: show the FINISH pose with no motion (a seek, no lifecycle events). */
    showEnd = 'showEnd',
    /** Animate toward the FINISH pose from the current frame. */
    travelToEnd = 'travelToEnd',
    /** Animate toward the START pose from the current frame. */
    travelToStart = 'travelToStart',
    /** Jump to the START pose (reset). */
    snapToStart = 'snapToStart',
    /** Jump to the FINISH pose. */
    snapToEnd = 'snapToEnd',
    /** Loop world: run (from rest, or cancelling a pending deferred stop). */
    runLoop = 'runLoop',
    /** Loop world: stop now — snap to rest. */
    stopLoopNow = 'stopLoopNow',
    /** Loop world: finish the CURRENT iteration, then rest (`completeIteration`). */
    stopLoopAtIterationEnd = 'stopLoopAtIterationEnd',
    /** Freeze the clock at the current frame. */
    freeze = 'freeze',
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
    /** The RESOLVED mode (default {@link PxPlayMode.forwards}). */
    playMode: PxPlayMode;
    /** True only when the `playMode` prop was explicitly written — the default never warns. */
    playModeExplicit: boolean;
    completeIteration: boolean;
    /** The previous render's props; `undefined` on mount or when the animator was recreated. */
    prev?: PxDeclarativeProps;
    next: PxDeclarativeProps;
}

/**
 * ONE rule for the declarative playback props (review §10). Pure: returns the ordered actions to
 * apply against the animator plus the usage warnings to emit. Contract breaches warn and never
 * alter playback; warnings fire on mount or when the offending prop changes, so they do not
 * repeat on unrelated renders.
 * @public @advanced
 */
export function resolveDeclarativePlayback(args: PxDeclarativeArgs): {
    actions: Array<PxDeclarativeAction>;
    warnings: Array<string>;
} {
    const { world, playMode, playModeExplicit, completeIteration, prev, next } = args;
    const actions: Array<PxDeclarativeAction> = [];
    const warnings: Array<string> = [];
    const mount = prev === undefined;
    const playChanged = mount || prev.play !== next.play;
    const pauseChanged = mount ? next.pause !== undefined : prev.pause !== next.pause;

    // -- contract breaches: warn once (mount, or when the prop lands), change nothing ----------
    if (mount && playModeExplicit && world === PxPlaybackWorld.loop) {
        warnings.push('`playMode` is set, but this document loops (effective iterations > 1) — '
            + 'there is no finish pose to switch to, so `play` acts as a run switch and `playMode` is ignored.');
    }
    if (mount && completeIteration && world === PxPlaybackWorld.oneShot) {
        warnings.push('`completeIteration` is set, but this document plays a single pass — there is no iteration to complete; ignored.');
    }
    if (next.play === undefined) {
        if (next.pause !== undefined && pauseChanged) {
            warnings.push('`pause` does nothing without `play` — it freezes a run that `play` owns.');
        }
        return { actions, warnings };
    }

    const animateToEnd = playMode === PxPlayMode.forwards || playMode === PxPlayMode.both;
    const animateToStart = playMode === PxPlayMode.backwards || playMode === PxPlayMode.both;

    if (world === PxPlaybackWorld.loop) {
        if (playChanged) {
            if (next.play) {
                // "running" IS the named state, so a mount with `play` runs — unless frozen.
                if (!next.pause) actions.push(PxDeclarativeAction.runLoop);
            } else if (!mount) {
                actions.push(completeIteration ? PxDeclarativeAction.stopLoopAtIterationEnd : PxDeclarativeAction.stopLoopNow);
            }
        } else if (pauseChanged && next.play) {
            actions.push(next.pause ? PxDeclarativeAction.freeze : PxDeclarativeAction.resume);
        }
        return { actions, warnings };
    }

    // -- one-shot: play is a POSE switch --------------------------------------------------------
    if (mount) {
        // Mount never animates — render the pose the props name (pause is moot on a still picture).
        if (next.play) actions.push(PxDeclarativeAction.showEnd);
        return { actions, warnings };
    }
    if (playChanged) {
        if (next.play) {
            actions.push(animateToEnd ? PxDeclarativeAction.travelToEnd : PxDeclarativeAction.snapToEnd);
            // the freeze axis still holds: the travel starts, then the clock freezes on it
            if (next.pause && animateToEnd) actions.push(PxDeclarativeAction.freeze);
        } else {
            // `play: false` forcibly unfreezes — the off happens as if nothing had been frozen.
            actions.push(animateToStart ? PxDeclarativeAction.travelToStart : PxDeclarativeAction.snapToStart);
        }
        return { actions, warnings };
    }
    if (pauseChanged && next.play) {
        actions.push(next.pause ? PxDeclarativeAction.freeze : PxDeclarativeAction.resume);
    }
    return { actions, warnings };
}

/** The slice of the api the declarative executor drives — structural, so the components'
 *  HANDLE qualifies as well as a full engine api. @public @advanced */
export type PxDeclarativeTarget = Pick<PxAnimatorApi,
    'play' | 'pause' | 'cancel' | 'finish' | 'setPlaybackRate' | 'getCurrentTime' | 'setCurrentTime' | 'isPlaying'>;

/** What {@link applyDeclarativeAction} needs beside the api: the run's geometry. @public @advanced */
export interface PxDeclarativeRunContext {
    /** One pass of the content window, ms (`getAnimatorConfig(doc).duration`). */
    passMs: number;
    /** The whole run, ms — `passMs × iterations` (equals `passMs` in the one-shot world). */
    totalMs: number;
}

const SNAP_EPSILON_MS = 1;

/**
 * Executes one {@link PxDeclarativeAction} against the animator api — the mechanical half of the
 * shared rule, with the boundary guards that keep `play()`'s rewind-at-the-boundary behaviour
 * from turning an idempotent re-apply into a surprise replay. Engine-agnostic: only the public
 * api is used.
 * @public @advanced
 */
export function applyDeclarativeAction(api: PxDeclarativeTarget, action: PxDeclarativeAction, ctx: PxDeclarativeRunContext): void {
    const t = api.getCurrentTime();
    const atEnd = t !== null && t >= ctx.totalMs - SNAP_EPSILON_MS;
    const atStart = t !== null && t <= SNAP_EPSILON_MS;
    switch (action) {
        case PxDeclarativeAction.showEnd:
            // a silent seek: no play, no lifecycle events — the mount pose
            api.setCurrentTime(ctx.totalMs);
            break;
        case PxDeclarativeAction.travelToEnd:
            if (atEnd && !api.isPlaying()) break;       // already there — play() would rewind and replay
            api.setPlaybackRate(1);
            api.play();
            break;
        case PxDeclarativeAction.travelToStart:
            if (atStart && !api.isPlaying()) break;     // already there — play() would jump to the end
            api.setPlaybackRate(-1);
            api.play();
            break;
        case PxDeclarativeAction.snapToStart:
        case PxDeclarativeAction.stopLoopNow:
            api.setPlaybackRate(1);
            api.cancel();
            break;
        case PxDeclarativeAction.snapToEnd:
            // finish() seeks in the PLAY direction — make sure that direction is forward
            api.setPlaybackRate(1);
            api.finish();
            break;
        case PxDeclarativeAction.runLoop:
            api.setPlaybackRate(1);
            api.play();
            break;
        case PxDeclarativeAction.freeze:
            api.pause();
            break;
        case PxDeclarativeAction.resume:
            api.play();
            break;
        case PxDeclarativeAction.stopLoopAtIterationEnd:
            // deferred — the component runs an iteration watcher (see createIterationStopWatcher)
            break;
    }
}

/** The slice of the runtime view {@link composePlayOnce} reads. @public @advanced */
export interface PxPlayOnceConfig {
    /** One pass of the content window, ms. */
    duration?: number;
    iterations?: number | 'infinite';
    /** The runtime view of `trigger.finish: 'reset'`. */
    resetOnFinish?: boolean;
}

/** The slice of the api `composePlayOnce` drives — structural, so the components' HANDLE
 *  (which has no `destroy`) qualifies as well as a full engine api. @public @advanced */
export type PxPlayOnceTarget = Pick<PxAnimatorApi, 'play' | 'pause' | 'cancel' | 'setPlaybackRate' | 'getCurrentTime' | 'setCurrentTime'> & { destroy?: () => void };

/**
 * Completes an api with the COMPOSED members — `playOnce()` (review §10) and `getDuration()`
 * (review §14) — ONE implementation on top of any engine or handle, so neither can drift.
 * `playOnce`: always a fresh pass from the start; a single-pass document just restarts (its
 * natural finish already applies the file's `finish` action); a multi-pass one gets a boundary
 * watcher that settles at the end of pass ONE — `'reset'` snaps to rest, the default holds the
 * pass-end pose; re-entrant. `getDuration`: one pass of the content window, ms. Mutates and
 * returns the same object.
 * @public @advanced
 */
export function composeApiExtras<T extends PxPlayOnceTarget>(
    api: T,
    cfg: PxPlayOnceConfig,
    raf: (cb: () => void) => void,
): T & { playOnce: () => void; getDuration: () => number | null } {
    // ONE type-level widening: both members are assigned right below, completing the api.
    const full = api as T & { playOnce: () => void; getDuration: () => number | null };
    full.getDuration = () => cfg.duration ?? null;
    let token = 0;
    // destroy() invalidates a pending pass watcher — otherwise it rAF-loops forever on a dead animator
    if (full.destroy) {
        const destroyEngine = full.destroy.bind(full);
        full.destroy = () => { token++; destroyEngine(); };
    }
    full.playOnce = () => {
        const mine = ++token;
        full.setPlaybackRate(1);
        full.cancel();
        full.play();
        const passMs = cfg.duration;
        const multiPass = cfg.iterations === 'infinite' || (typeof cfg.iterations === 'number' && cfg.iterations > 1);
        if (!multiPass || !passMs) return;
        const tick = (): void => {
            if (mine !== token) return;                 // a later playOnce took over
            const t = full.getCurrentTime();
            if (t !== null && t >= passMs) {
                if (cfg.resetOnFinish) {
                    full.cancel();
                } else {
                    full.pause();
                    full.setCurrentTime(passMs);
                }
                return;
            }
            raf(tick);
        };
        raf(tick);
    };
    return full;
}

/**
 * The `completeIteration` watcher: samples the whole-run time each frame and stops the loop the
 * moment the iteration index advances past the one the stop was requested in — the off lands on
 * the boundary, not mid-beat. `raf` is injected (the components pass requestAnimationFrame).
 * Returns a cancel function (a re-on, a doc swap or an unmount discards the pending stop).
 * @public @advanced
 */
export function createIterationStopWatcher(
    api: PxDeclarativeTarget,
    passMs: number,
    raf: (cb: () => void) => void,
    onStopped?: () => void,
): () => void {
    let cancelled = false;
    const startIteration = Math.floor((api.getCurrentTime() ?? 0) / Math.max(passMs, 1));
    const tick = (): void => {
        if (cancelled) return;
        const t = api.getCurrentTime();
        const iteration = t === null ? startIteration : Math.floor(t / Math.max(passMs, 1));
        if (iteration > startIteration) {
            api.setPlaybackRate(1);
            api.cancel();
            onStopped?.();
            return;
        }
        raf(tick);
    };
    raf(tick);
    return () => { cancelled = true; };
}
