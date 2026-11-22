// @px-area control
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// ============================================================================
// THE FLOW SWITCH (2026-11-22, kf app/docs/app-design/timelines-and-states.plan.md P-1) — one flow: of its steps one is
// current, and the current step has the ORDINARY playback on its own timeline (ready · playing · paused · finished),
// built by the platform (`bind`) exactly as a one-timeline file's is. Nothing is glued and no clock of ours moves a
// picture: going to another step stops the current playback — it lets go of what it holds — and builds the next.
//
// | piece | what it does |
// |---|---|
// | `timeline` | `player.timeline` — the current step's playback; a speed the page sets carries on to every step |
// | `executor` | the one the triggers and the gate press — the current step's |
// | `controls` | `player.flow` — `goTo` · `next` · `previous` · `get` · `getAll` |
// | leaving | `whenLeaving`: `jump` at once · `animateToEnd` plays on to the end of the pass · `animateToStart` plays back to the start of the pass — then the next step from its start, playing |
// | the end | a step whose `whenFinished` is an action goes on there after a frame (the guard); else its playback is finished as usual |
// ============================================================================

import type { PxPlayExecutor, PxTimelineControls } from '../format/PxAnimatorTypes';
import { PxPlaybackState, PxWhenLeaving } from '../format/PxAnimatorConstants';
import { forwardPlaybackControls, PxPlaybackWrite } from './PxDeclarativePlayback';
import type { PxFlowControls, PxFlowRuntime } from './PxFlows';

/** One step's playback as the switch drives it — what the platform builds for a step. @internal */
export interface PxFlowStepPlayer {
    readonly timeline: PxTimelineControls;
    readonly playExecutor: PxPlayExecutor;
    /** The engine's own clock — the switch runs it backwards to leave by `animateToStart`. */
    play(): void;
    getPlaybackSpeed(): number;
    setPlaybackSpeed(speed: number): void;
    getTotalTime(): number | null;
    /** Stops it and lets go of everything it holds. */
    destroy(): void;
}

/** One step as the switch reads it. @internal */
export interface PxFlowSwitchStep {
    readonly id: string;
    /** Where it goes on at its end: the next step, the previous one, or the one named. */
    readonly then?: { readonly step: 1 | -1 } | { readonly flowStep: string };
    readonly whenLeaving: PxWhenLeaving;
    readonly initial: boolean;
    /** It repeats for ever — held at mount it plays; one that ends is shown at its end. */
    readonly endless: boolean;
}

/** What a switch is built from. @internal */
export interface PxFlowSwitchOptions<P extends PxFlowStepPlayer = PxFlowStepPlayer> {
    /** The flow's id — `default` for the flow `default`. */
    readonly flow: string;
    readonly steps: ReadonlyArray<PxFlowSwitchStep>;
    /** Builds step `index`'s playback; its playback events go to `events` (the switch reads the finish first). */
    bind(index: number, events: { onPlaybackFinish(): void }): P;
    readonly raf: (cb: () => void) => void;
    /** Told on every change of step. */
    readonly onChange?: (flowStep: string, previous: string, flow: string) => void;
    /** The page's `onPlaybackFinish` — told when a step's playback finishes and the flow does not go on. */
    readonly onPlaybackFinish?: () => void;
}

/** A flow at work: the runtime the triggers and the lever hold, the playback the page sees. @internal */
export interface PxFlowSwitch<P extends PxFlowStepPlayer = PxFlowStepPlayer> extends PxFlowRuntime {
    readonly timeline: PxTimelineControls;
    readonly executor: PxPlayExecutor;
    /** The current step's index and playback. */
    currentIndex(): number;
    currentPlayer(): P;
}

const EPS = 0.5;

// @px-importance important
/** A flow's switch — see the top of the file. The initial step's playback is built now, at rest. @internal */
export function createFlowSwitch<P extends PxFlowStepPlayer>(o: PxFlowSwitchOptions<P>): PxFlowSwitch<P> {
    const n = o.steps.length;
    let index = Math.max(0, o.steps.findIndex(s => s.initial));
    let disposed = false;
    let held = false;
    /** A way out in progress — the newest request wins while it runs. */
    let leaving: { target: number; cancel: () => void } | null = null;
    /** A speed the page set — every later step plays at it too. */
    let pageSpeed: number | undefined;

    const indexOf = (id: string): number => o.steps.findIndex(s => s.id === id);
    const build = (i: number): P => o.bind(i, { onPlaybackFinish: () => finished(i) });
    let player = build(index);

    /** Step `i`'s playback reached its natural end. */
    const finished = (i: number): void => {
        if (disposed || i !== index) return;
        if (leaving) { go(leaving.target); return; }
        const then = o.steps[i].then;
        if (!then) { o.onPlaybackFinish?.(); return; }
        const to = 'flowStep' in then ? indexOf(then.flowStep) : (i + then.step + n) % n;
        // the guard: the end frame is drawn before the hop — no ring of empty steps can spin within one frame
        o.raf(() => { if (!disposed && index === i && to >= 0) go(to); });
    };

    /** The change itself: the current playback goes, the target's is built and plays from its start. */
    const enter = (target: number, play: boolean): void => {
        const previous = o.steps[index].id;
        leaving?.cancel();
        leaving = null;
        player.destroy();
        index = target;
        player = build(target);
        if (pageSpeed !== undefined) player.timeline.setSpeed(pageSpeed);
        if (play) player.playExecutor.startPlayback();
        if (previous !== o.steps[index].id) o.onChange?.(o.steps[index].id, previous, o.flow);
    };
    const go = (target: number): void => { if (!disposed) enter(target, true); };

    /** Watches each frame until `test` holds, then `then` — unless cancelled. */
    const watch = (target: number, test: () => boolean): void => {
        let cancelled = false;
        leaving = { target, cancel: () => { cancelled = true; } };
        const tick = (): void => {
            if (cancelled || disposed) return;
            if (test()) { const to = leaving?.target ?? target; go(to); return; }
            o.raf(tick);
        };
        o.raf(tick);
    };

    /** A request to go to `target` — by the current step's way of leaving. */
    const request = (target: number): void => {
        if (target < 0 || target >= n || disposed) return;
        if (leaving) { leaving.target = target; return; }      // the newest request wins
        if (target === index) return;
        const way = o.steps[index].whenLeaving;
        const state = player.playExecutor.state();
        const passMs = player.timeline.getDuration() ?? 0;
        const at = Math.max(player.getTotalTime() ?? 0, 0);
        if (way === PxWhenLeaving.animateToEnd && state === PxPlaybackState.playing && passMs > 0) {
            const total = player.timeline.getTotalDuration();
            const passEnd = Math.min(total ?? Infinity, Math.max(1, Math.ceil((at - EPS) / passMs)) * passMs);
            watch(target, () => (player.getTotalTime() ?? 0) >= passEnd - EPS || player.playExecutor.state() !== PxPlaybackState.playing);
            return;
        }
        if (way === PxWhenLeaving.animateToStart && passMs > 0 && at > EPS
            && (state === PxPlaybackState.playing || state === PxPlaybackState.paused || state === PxPlaybackState.finished)) {
            const passStart = Math.floor(Math.max(at - EPS, 0) / passMs) * passMs;
            player.setPlaybackSpeed(-(Math.abs(player.getPlaybackSpeed()) || 1));
            player.play();
            watch(target, () => (player.getTotalTime() ?? 0) <= passStart + EPS);
            return;
        }
        go(target);
    };

    const controls: PxFlowControls = {
        next: () => request((index + 1) % n),
        previous: () => request((index - 1 + n) % n),
        goTo: (id: string) => request(indexOf(id)),
        get: () => [o.steps[index].id],
        getAll: () => o.steps.map(s => s.id),
    };

    const timeline = forwardPlaybackControls(() => player.timeline, (call, run) => {
        run(player.timeline);
        if (call === PxPlaybackWrite.setSpeed || call === PxPlaybackWrite.setDurationAtSpeed) pageSpeed = player.timeline.getSpeed();
    }, () => (disposed ? PxPlaybackState.destroyed : PxPlaybackState.off));

    const executor: PxPlayExecutor = {
        state: () => player.playExecutor.state(),
        startPlayback: () => player.playExecutor.startPlayback(),
        playPlayback: () => player.playExecutor.playPlayback(),
        stopPlayback: () => player.playExecutor.stopPlayback(),
        pausePlayback: () => player.playExecutor.pausePlayback(),
        resumePlayback: () => player.playExecutor.resumePlayback(),
        seek: (ms) => player.playExecutor.seek(ms),
        leaveView: (behavior) => player.playExecutor.leaveView(behavior),
        returnToView: () => player.playExecutor.returnToView(),
        // the step playbacks carry the page's listeners from their build (`bind`)
        setListeners: () => {},
        onNaturalFinish: () => player.playExecutor.onNaturalFinish(),
        hasPendingMove: () => leaving !== null || (player.playExecutor.hasPendingMove?.() ?? false),
        dispose: () => {},
    };

    return {
        timeline,
        executor,
        controls,
        currentIndex: () => index,
        currentPlayer: () => player,
        hold: (id: string, mount: boolean) => {
            const target = indexOf(id);
            if (target < 0) return;
            held = true;
            if (!mount) { request(target); return; }
            if (target !== index) enter(target, false);
            if (o.steps[target].endless) player.playExecutor.startPlayback();
            else player.playExecutor.seek(player.timeline.getTotalDuration() ?? 0);   // a step that ends shows its end, not playing
        },
        isHeld: () => held,
        release: () => { held = false; },
        dispose: () => { disposed = true; leaving?.cancel(); leaving = null; player.destroy(); },
    };
}
