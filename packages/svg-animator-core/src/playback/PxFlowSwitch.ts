// @px-area control
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// ============================================================================
// THE FLOW SWITCH (2026-11-22; legs 2026-11-26, kf app/docs/app-design/flow-step-transitions.build.md) — one flow: of its
// steps one is current. What plays is a LEG — one ORDINARY playback, built by the platform (`bind`) exactly as a
// one-timeline file's is: a part of a step (its in-transition, its segment, its out-transition) or the WINDOW of a change
// (`bindWindow` — A's tail and B's head pre-mixed). Nothing is glued and no clock of ours moves a picture: the next leg
// is built when one ends, and the one that ends lets go of what it holds.
//
// | moment | legs |
// |---|---|
// | a visit | B's in-transition (if any), then B's segment — the change ends when the segment starts |
// | a change A → B | A lets go by its `whenLeaving` (jump · to the end of the pass · back to its start — of the part it is in), then A's out-transition (only if A's segment had started), the window (`transition.overlap`), what is left of B's in-transition, B's segment |
// | the window | `overlap'` ms — min(overlap, A's out-transition) when A has one; with none, A's part plays on (or holds) under B's start |
//
// | rule | |
// |---|---|
// | the flow is in B from the request | `get()`, `onChange` — an event is then read as in B (D7) |
// | a go-to B while A → B plays | nothing — B is current |
// | a go-to A while A → B plays | the change runs backwards from where it is: the leg playing, then the legs played, each from its end; A goes on from where it was left (R1) |
// | a go-to C while A → B plays | the leg playing stops if it is not B's own; B is left from the part it is in |
// | a next / previous | counted from the step the flow is in (1.30: from the one a leaving is heading to) |
// | start | the current step from its in-transition (B1) |
// | stop | never plays an out-transition: the change settles in the current step's segment, which is stopped by its `whenStopped` (B2) |
// ============================================================================

import type { PxPlayExecutor, PxStepTransition, PxTimelineControls } from '../format/PxAnimatorTypes';
import { PxFlowAction, PxLeavingStep, PxPlaybackState, PxWhenLeaving, flowStepIndexAfter, flowStepMoveOf } from '../format/PxAnimatorConstants';
import { forwardPlaybackControls, PxPlaybackWrite } from './PxDeclarativePlayback';
import type { PxFlowControls, PxFlowRuntime } from './PxFlows';
import { PxStepPart } from './PxUnits';

/** One step's playback as the switch drives it — what the platform builds for a leg. @internal */
export interface PxFlowStepPlayer {
    readonly timeline: PxTimelineControls;
    readonly playExecutor: PxPlayExecutor;
    /** The engine's own clock — the switch runs it backwards to leave by `animateToStart`, and to run a change back. */
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
    /** Where it goes on at its end: the next step, the previous one (`wrap`: round past an end — the `…OrWrap` actions,
     *  1.30), or the one named. */
    readonly then?: { readonly step: 1 | -1; readonly wrap?: true } | { readonly flowStep: string };
    /** The hand-over at its end (1.34) — its end entry's `with.transition`. */
    readonly thenTransition?: PxStepTransition;
    readonly whenLeaving: PxWhenLeaving;
    readonly initial: boolean;
    /** It repeats for ever — held at mount it plays; one that ends is shown at its end. */
    readonly endless: boolean;
    /** It has an in- / out-transition segment that plays (1.34). */
    readonly hasIn?: boolean;
    readonly hasOut?: boolean;
}

/** A part's length and speed as its document says (1.34) — what a change is laid out by. @internal */
export interface PxFlowPartInfo {
    /** Its playback, ms of its timeline — iterations included; `Infinity` when it repeats for ever. */
    readonly totalMs: number;
    /** Its timeline ms per real ms. */
    readonly speed: number;
}

/** One part a side of a window plays — see `PxFlowWindow`. @internal */
export interface PxFlowWindowSource {
    readonly index: number;
    readonly part: PxStepPart;
    readonly atMs: number;
    readonly rate: number;
    readonly forMs?: number;
}

/** The window of a change, as the switch asks the platform to build it (1.34). @internal */
export interface PxFlowWindowRequest {
    readonly durationMs: number;
    readonly leaving: ReadonlyArray<PxFlowWindowSource>;
    readonly entering: ReadonlyArray<PxFlowWindowSource>;
    readonly transition: PxStepTransition;
}

/** What a switch is built from. @internal */
export interface PxFlowSwitchOptions<P extends PxFlowStepPlayer = PxFlowStepPlayer> {
    /** The flow's id — `default` for the flow `default`. */
    readonly flow: string;
    readonly steps: ReadonlyArray<PxFlowSwitchStep>;
    /** Builds a part of step `index` (none: its segment); its playback events go to `events` (the switch reads the finish first). */
    bind(index: number, events: { onPlaybackFinish(): void }, part?: PxStepPart): P;
    /** A part's length and speed — none: the switch plays the parts one after the other with no window. */
    partInfo?(index: number, part: PxStepPart): PxFlowPartInfo | undefined;
    /** Builds the window of a change — none: an overlap is not played (the parts follow one another). */
    bindWindow?(request: PxFlowWindowRequest, events: { onPlaybackFinish(): void }): P;
    /** The flow's `transition` — every change whose arrow says none. */
    readonly transition?: PxStepTransition;
    readonly raf: (cb: () => void) => void;
    /** Told on every change of step — at its start (D7). */
    readonly onChange?: (flowStep: string, previous: string, flow: string) => void;
    /** Told when the steps whose parts play change — what `show` reads (R2). */
    readonly onPlayingChange?: () => void;
    /** The page's `onPlaybackFinish` — told when a step's playback finishes and the flow does not go on. */
    readonly onPlaybackFinish?: () => void;
}

/** A flow at work: the runtime the triggers and the lever hold, the playback the page sees. @internal */
export interface PxFlowSwitch<P extends PxFlowStepPlayer = PxFlowStepPlayer> extends PxFlowRuntime {
    readonly timeline: PxTimelineControls;
    readonly executor: PxPlayExecutor;
    /** The current step's index, and the playback of the leg that plays. */
    currentIndex(): number;
    currentPlayer(): P;
    /** The steps whose parts play now — two in a window (R2). */
    playing(): Array<string>;
}

const EPS = 0.5;

/** What a leg plays. */
type LegSpec =
    | { readonly kind: 'part'; readonly index: number; readonly part: PxStepPart }
    | { readonly kind: 'window'; readonly request: PxFlowWindowRequest };

/** A leg to run: from `startMs` of its playback (`END`: its end), forwards or backwards, forwards maybe only `untilMs`. */
interface LegRun {
    readonly spec: LegSpec;
    readonly startMs: number;
    readonly backwards: boolean;
    readonly untilMs?: number;
    /** Where it stood when it was left — filled when it ends. */
    endMs?: number;
}
const END = -1;

/** A change at work — what a run back needs (R1). */
interface Change {
    readonly from: number;
    readonly to: number;
    /** The legs it played, in order. */
    readonly done: Array<LegRun>;
    /** The legs it is still to play. */
    queue: Array<LegRun>;
    /** What plays when it is run back, after its legs: the step it left, from where it was left. */
    readonly back: ReadonlyArray<LegRun>;
}

const isOwnPart = (spec: LegSpec, index: number): spec is { kind: 'part'; index: number; part: PxStepPart } => spec.kind === 'part' && spec.index === index;

// @px-importance important
/** A flow's switch — see the top of the file. The initial step's first leg is built now, at rest. @internal */
export function createFlowSwitch<P extends PxFlowStepPlayer>(o: PxFlowSwitchOptions<P>): PxFlowSwitch<P> {
    const n = o.steps.length;
    let index = Math.max(0, o.steps.findIndex(s => s.initial));
    let disposed = false;
    let held = false;
    /** A speed the page set — every later leg plays at it too. */
    let pageSpeed: number | undefined;
    /** The change at work — none when the current step is in its segment, or its first visit. */
    let change: Change | null = null;
    /** A step letting go by its `whenLeaving` — the newest request wins while it runs. */
    let leaving: { from: number; cancel: () => void; target: number; how?: PxWhenLeaving; transition?: PxStepTransition; restore?: number } | null = null;
    /** A watch on the leg that plays (its end, by time) — cancelled with the leg. */
    let watching: (() => void) | null = null;
    /** Whether the current step's segment has started since it was entered — an out-transition plays only then. */
    let arrived = false;
    let token = 0;

    const indexOf = (id: string): number => o.steps.findIndex(s => s.id === id);
    const hasPart = (i: number, part: PxStepPart): boolean =>
        part === PxStepPart.main || (part === PxStepPart.inTransition ? !!o.steps[i].hasIn : !!o.steps[i].hasOut);
    const speedOf = (info: PxFlowPartInfo | undefined): number => Math.abs(pageSpeed ?? info?.speed ?? 1) || 1;
    /** A part's real length, ms — none: unknown (no `partInfo`). */
    const wallMsOf = (i: number, part: PxStepPart): number | undefined => {
        const info = o.partInfo?.(i, part);
        return info ? info.totalMs / speedOf(info) : undefined;
    };

    // ── the leg that plays ──────────────────────────────────────────────────
    let leg: { run: LegRun; player: P; token: number };
    const buildLeg = (run: LegRun): P => {
        const my = ++token;
        const events = { onPlaybackFinish: () => legFinished(my) };
        const player = run.spec.kind === 'part' ? o.bind(run.spec.index, events, run.spec.part) : (o.bindWindow ? o.bindWindow(run.spec.request, events) : o.bind(index, events));
        leg = { run, player, token: my };
        if (pageSpeed !== undefined) player.timeline.setSpeed(pageSpeed);
        return player;
    };
    const stopWatching = (): void => { watching?.(); watching = null; };
    /** Watches each frame until `test` holds, then `then` — unless the leg changes first. */
    const watch = (test: () => boolean, then: () => void): void => {
        stopWatching();
        let cancelled = false;
        watching = () => { cancelled = true; };
        const my = leg.token;
        const tick = (): void => {
            if (cancelled || disposed || leg.token !== my) return;
            if (test()) { watching = null; then(); return; }
            o.raf(tick);
        };
        o.raf(tick);
    };
    const timeOf = (p: P): number => Math.max(p.getTotalTime() ?? 0, 0);

    /** Builds and plays `run`; its end goes on with the change (`legDone`). */
    const runLeg = (run: LegRun): void => {
        stopWatching();
        leg.player.destroy();
        const player = buildLeg(run);
        if (run.backwards) {
            const total = player.timeline.getTotalDuration() ?? 0;
            const from = run.startMs === END ? total : run.startMs;
            player.playExecutor.seek(from);
            player.setPlaybackSpeed(-(Math.abs(player.getPlaybackSpeed()) || 1));
            player.play();
            watch(() => timeOf(player) <= EPS, () => legDone());
        } else {
            player.playExecutor.startPlayback();
            if (run.startMs > 0) player.playExecutor.seek(run.startMs);
            if (run.untilMs !== undefined) watch(() => timeOf(player) >= (run.untilMs ?? 0) - EPS, () => legDone());
        }
        // the change ends when the step it goes to plays its segment, forwards
        if (change && isOwnPart(run.spec, change.to) && run.spec.part === PxStepPart.main && !run.backwards) {
            change = null;
            arrived = true;
        }
        o.onPlayingChange?.();
    };

    /** The leg ended (its finish, or its watch): the change goes on — or, with none, the step's own end. */
    const legDone = (): void => {
        if (disposed) return;
        if (!change) return;
        leg.run.endMs = timeOf(leg.player);
        change.done.push(leg.run);
        const next = change.queue.shift();
        if (next) runLeg(next);
    };

    /** A leg's playback reached its natural end. */
    const legFinished = (my: number): void => {
        if (disposed || my !== leg.token) return;
        if (change && !(leg.run.untilMs !== undefined || leg.run.backwards)) { legDone(); return; }
        if (change) return;          // a watched leg ends by its watch
        // letting go: its part is over — an in-transition that came all the way in has arrived
        if (leaving) {
            if (isOwnPart(leg.run.spec, leaving.from) && leg.run.spec.part === PxStepPart.inTransition && leaving.restore === undefined) arrived = true;
            handOver();
            return;
        }
        // no change at work: the current step's own leg — its in-transition goes on to its segment; its segment ends
        if (isOwnPart(leg.run.spec, index) && leg.run.spec.part === PxStepPart.inTransition) {
            const i = index;
            o.raf(() => { if (!disposed && index === i && leg.token === my) { runLeg({ spec: { kind: 'part', index: i, part: PxStepPart.main }, startMs: 0, backwards: false }); arrived = true; } });
            return;
        }
        finished(index);
    };

    /** Step `i`'s segment reached its natural end. */
    const finished = (i: number): void => {
        if (disposed || i !== index) return;
        const then = o.steps[i].then;
        // a next / previous past an end of the flow (no `…OrWrap`): it stays, finished as usual (1.30)
        const to = !then ? undefined : 'flowStep' in then ? indexOf(then.flowStep) : flowStepIndexAfter(i, n, { delta: then.step, wrap: then.wrap === true });
        if (to === undefined) { o.onPlaybackFinish?.(); return; }
        // the guard: the end frame is drawn before the hop — no ring of empty steps can spin within one frame
        const thenTransition = o.steps[i].thenTransition;
        o.raf(() => { if (!disposed && index === i && to >= 0) request(to, undefined, thenTransition); });
    };

    // ── a change ────────────────────────────────────────────────────────────

    /** The legs of step `to`'s head after `consumed` real ms of it went into a window: what is left of its
     *  in-transition, then its segment. */
    const headRuns = (to: number, consumed: number): Array<LegRun> => {
        const out: Array<LegRun> = [];
        let rest = consumed;
        if (hasPart(to, PxStepPart.inTransition)) {
            const info = o.partInfo?.(to, PxStepPart.inTransition);
            const wall = wallMsOf(to, PxStepPart.inTransition) ?? 0;
            if (rest < wall - EPS) out.push({ spec: { kind: 'part', index: to, part: PxStepPart.inTransition }, startMs: rest * speedOf(info), backwards: false });
            rest = Math.max(0, rest - wall);
        }
        const main = o.partInfo?.(to, PxStepPart.main);
        out.push({ spec: { kind: 'part', index: to, part: PxStepPart.main }, startMs: rest * speedOf(main), backwards: false });
        return out;
    };

    /** The sources of step `to`'s head for a window of `durationMs`: its in-transition, then its segment. */
    const headSources = (to: number, durationMs: number): Array<PxFlowWindowSource> => {
        const out: Array<PxFlowWindowSource> = [];
        if (hasPart(to, PxStepPart.inTransition)) {
            const info = o.partInfo?.(to, PxStepPart.inTransition);
            const wall = wallMsOf(to, PxStepPart.inTransition) ?? 0;
            out.push({ index: to, part: PxStepPart.inTransition, atMs: 0, rate: speedOf(info), forMs: Math.min(durationMs, wall) });
            if (durationMs <= wall) return out;
        }
        out.push({ index: to, part: PxStepPart.main, atMs: 0, rate: speedOf(o.partInfo?.(to, PxStepPart.main)) });
        return out;
    };

    /** The leaving step let go (its `whenLeaving` done): the legs of the change are laid out, and the first plays. */
    const handOver = (): void => {
        const l = leaving;
        if (!l) return;
        leaving = null;
        const from = l.from;
        const to = l.target;
        const tr = l.transition ?? o.transition ?? {};
        const overlap = o.bindWindow && o.partInfo ? Math.max(0, tr.overlap ?? 0) : 0;
        const holds = tr.leavingStep === PxLeavingStep.holds;
        // what plays back to the step it leaves, if this change runs back: its leg from where it stands now
        const own = isOwnPart(leg.run.spec, from) ? leg.run.spec : undefined;
        const back: Array<LegRun> = own ? [{ spec: own, startMs: timeOf(leg.player), backwards: false }] : [];
        // left while it came in: run back, it comes in the rest of the way, then plays its segment
        if (own?.part === PxStepPart.inTransition) back.push({ spec: { kind: 'part', index: from, part: PxStepPart.main }, startMs: 0, backwards: false });
        const queue: Array<LegRun> = [];
        let consumed = 0;
        const outWall = arrived && hasPart(from, PxStepPart.outTransition) ? wallMsOf(from, PxStepPart.outTransition) : undefined;
        if (arrived && hasPart(from, PxStepPart.outTransition)) {
            const info = o.partInfo?.(from, PxStepPart.outTransition);
            const w = Math.min(overlap, outWall ?? 0);
            const rate = speedOf(info);
            queue.push({ spec: { kind: 'part', index: from, part: PxStepPart.outTransition }, startMs: 0, backwards: false, ...(w > 0 ? { untilMs: ((outWall ?? 0) - w) * rate } : {}) });
            if (w > 0) {
                queue.push({ spec: { kind: 'window', request: { durationMs: w, transition: tr,
                    leaving: [{ index: from, part: PxStepPart.outTransition, atMs: ((outWall ?? 0) - w) * rate, rate: holds ? 0 : rate }],
                    entering: headSources(to, w) } }, startMs: 0, backwards: false });
                consumed = w;
            }
        } else if (overlap > 0 && own) {
            queue.push({ spec: { kind: 'window', request: { durationMs: overlap, transition: tr,
                leaving: [{ index: from, part: own.part, atMs: timeOf(leg.player), rate: holds ? 0 : Math.abs(leg.player.getPlaybackSpeed()) }],
                entering: headSources(to, overlap) } }, startMs: 0, backwards: false });
            consumed = overlap;
        }
        queue.push(...headRuns(to, consumed));
        arrived = false;
        change = { from, to, done: [], queue, back };
        const first = change.queue.shift();
        if (first) runLeg(first);
    };

    /** A change runs back from where it is (R1): the leg playing backwards, the legs played backwards from their ends,
     *  then the step it left from where it was left. */
    const runBack = (): void => {
        const c = change;
        if (!c) return;
        stopWatching();
        const at = timeOf(leg.player);
        const current: LegRun = { spec: leg.run.spec, startMs: at, backwards: !leg.run.backwards };
        const played = [...c.done].reverse().map((r): LegRun => ({ spec: r.spec, startMs: r.backwards ? 0 : (r.endMs ?? END), backwards: !r.backwards }));
        const forward: LegRun = { spec: leg.run.spec, startMs: at, backwards: leg.run.backwards, ...(leg.run.untilMs !== undefined ? { untilMs: leg.run.untilMs } : {}) };
        const queue = [...played, ...c.back];
        change = { from: c.to, to: c.from, done: [], queue, back: [forward, ...c.queue] };
        const previous = o.steps[index].id;
        index = c.from;
        o.onChange?.(o.steps[index].id, previous, o.flow);
        // the step it goes back to plays its segment again only if it was there
        arrived = false;
        runLeg(current);
    };

    /** A request to go to `target` — by the current step's way of leaving, or `how` (an entry's own, 1.29), handed over
     *  by `transition` (an arrow's own, 1.34). */
    const request = (target: number, how?: PxWhenLeaving, transition?: PxStepTransition): void => {
        if (target < 0 || target >= n || disposed) return;
        if (leaving) {
            // back to the step letting go: it stays (R1) — a run backwards turns forwards again
            if (target === leaving.from) {
                leaving.cancel();
                if (leaving.restore !== undefined) { leg.player.setPlaybackSpeed(leaving.restore); leg.player.play(); }
                const previous = o.steps[index].id;
                index = leaving.from;
                leaving = null;
                if (previous !== o.steps[index].id) o.onChange?.(o.steps[index].id, previous, o.flow);
                return;
            }
            // the newest request wins
            const previous = o.steps[index].id;
            leaving.target = target; leaving.how = how; leaving.transition = transition;
            index = target;
            if (previous !== o.steps[index].id) o.onChange?.(o.steps[index].id, previous, o.flow);
            return;
        }
        if (change && target === change.from) { runBack(); return; }
        if (target === index) return;
        const from = index;
        const previous = o.steps[from].id;
        index = target;
        o.onChange?.(o.steps[index].id, previous, o.flow);
        const own = isOwnPart(leg.run.spec, from) ? leg.run.spec : undefined;
        // a change at work whose leg is not the leaving step's own (A's tail, a window): it stops — B never played its own part
        if (change && !own) arrived = false;
        change = null;
        stopWatching();
        leaving = { from, target, how, transition, cancel: () => stopWatching() };
        const way = how ?? o.steps[from].whenLeaving;
        const player = leg.player;
        const state = player.playExecutor.state();
        const at = timeOf(player);
        if (own && own.part === PxStepPart.main) {
            const passMs = player.timeline.getDuration() ?? 0;
            if (way === PxWhenLeaving.animateToEnd && state === PxPlaybackState.playing && passMs > 0) {
                const total = player.timeline.getTotalDuration();
                const passEnd = Math.min(total ?? Infinity, Math.max(1, Math.ceil((at - EPS) / passMs)) * passMs);
                watch(() => timeOf(player) >= passEnd - EPS || player.playExecutor.state() !== PxPlaybackState.playing, handOver);
                return;
            }
            if (way === PxWhenLeaving.animateToStart && passMs > 0 && at > EPS
                && (state === PxPlaybackState.playing || state === PxPlaybackState.paused || state === PxPlaybackState.finished)) {
                const passStart = Math.floor(Math.max(at - EPS, 0) / passMs) * passMs;
                leaving.restore = Math.abs(player.getPlaybackSpeed()) || 1;
                player.setPlaybackSpeed(-leaving.restore);
                player.play();
                watch(() => timeOf(player) <= passStart + EPS, handOver);
                return;
            }
        } else if (own && own.part === PxStepPart.inTransition) {
            // leaving while it comes in: its in-transition ends (it arrives), or runs back (it never arrived)
            if (way === PxWhenLeaving.animateToEnd && state === PxPlaybackState.playing) {
                const total = player.timeline.getTotalDuration() ?? 0;
                watch(() => timeOf(player) >= total - EPS || player.playExecutor.state() !== PxPlaybackState.playing, () => { arrived = true; handOver(); });
                return;
            }
            if (way === PxWhenLeaving.animateToStart && at > EPS) {
                leaving.restore = Math.abs(player.getPlaybackSpeed()) || 1;
                player.setPlaybackSpeed(-leaving.restore);
                player.play();
                watch(() => timeOf(player) <= EPS, handOver);
                return;
            }
        }
        handOver();
    };

    /** A next / previous: counted from the step the flow is in — two presses, two steps (1.30); past an end of the flow,
     *  nothing unless it wraps. */
    const step = (action: PxFlowAction, transition?: PxStepTransition): void => {
        const move = flowStepMoveOf(action);
        const to = move ? flowStepIndexAfter(index, n, move) : undefined;
        if (to !== undefined) request(to, undefined, transition);
    };

    /** No change any more: the current step in its segment, built if it is not playing it — what a stop or a hold acts on. */
    const settle = (): void => {
        if (leaving) { leaving.cancel(); leaving = null; }
        change = null;
        stopWatching();
        if (!isOwnPart(leg.run.spec, index) || leg.run.spec.part !== PxStepPart.main) {
            leg.player.destroy();
            buildLeg({ spec: { kind: 'part', index, part: PxStepPart.main }, startMs: 0, backwards: false });
            arrived = true;
            o.onPlayingChange?.();
        }
    };

    /** The current step from its start: its in-transition, then its segment (B1). */
    const restart = (): void => {
        if (leaving) { leaving.cancel(); leaving = null; }
        change = null;
        arrived = !hasPart(index, PxStepPart.inTransition);
        runLeg({ spec: { kind: 'part', index, part: hasPart(index, PxStepPart.inTransition) ? PxStepPart.inTransition : PxStepPart.main }, startMs: 0, backwards: false });
    };

    // the first leg, at rest: the initial step's in-transition (its entrance, B1), else its segment
    {
        const first: LegRun = { spec: { kind: 'part', index, part: hasPart(index, PxStepPart.inTransition) ? PxStepPart.inTransition : PxStepPart.main }, startMs: 0, backwards: false };
        const my = ++token;
        const player = o.bind(index, { onPlaybackFinish: () => legFinished(my) }, first.spec.kind === 'part' ? first.spec.part : undefined);
        leg = { run: first, player, token: my };
        arrived = !hasPart(index, PxStepPart.inTransition);
    }

    const controls: PxFlowControls = {
        next: args => step(PxFlowAction.next, args?.transition),
        previous: args => step(PxFlowAction.previous, args?.transition),
        nextOrWrap: args => step(PxFlowAction.nextOrWrap, args?.transition),
        previousOrWrap: args => step(PxFlowAction.previousOrWrap, args?.transition),
        goTo: args => request(indexOf(args.flowStep), args.whenLeaving, args.transition),
        get: () => [o.steps[index].id],
        getAll: () => o.steps.map(s => s.id),
    };

    const timeline = forwardPlaybackControls(() => leg.player.timeline, (call, run) => {
        // the page's start and stop go by the switch's rules too: start from the in-transition (B1), a stop settles (B2)
        if (call === PxPlaybackWrite.start && hasPart(index, PxStepPart.inTransition)) { restart(); return; }
        if (call === PxPlaybackWrite.start && (change || leaving)) settle();
        if (call === PxPlaybackWrite.stop && (change || leaving || !isOwnPart(leg.run.spec, index) || leg.run.spec.part !== PxStepPart.main)) settle();
        run(leg.player.timeline);
        if (call === PxPlaybackWrite.setSpeed || call === PxPlaybackWrite.setDurationAtSpeed) pageSpeed = leg.player.timeline.getSpeed();
    }, () => (disposed ? PxPlaybackState.destroyed : PxPlaybackState.off));

    const executor: PxPlayExecutor = {
        state: () => leg.player.playExecutor.state(),
        startPlayback: () => {
            // the step from its start — its in-transition first (B1); a step with none starts as it always did
            if (hasPart(index, PxStepPart.inTransition)) { restart(); return; }
            if (change || leaving) settle();
            leg.player.playExecutor.startPlayback();
        },
        playPlayback: () => leg.player.playExecutor.playPlayback(),
        // a stop plays no out-transition (B2): the change settles in the current step's segment, stopped by its manner
        stopPlayback: (behavior) => { if (change || leaving || !isOwnPart(leg.run.spec, index) || leg.run.spec.part !== PxStepPart.main) settle(); leg.player.playExecutor.stopPlayback(behavior); },
        pausePlayback: () => leg.player.playExecutor.pausePlayback(),
        resumePlayback: () => leg.player.playExecutor.resumePlayback(),
        seek: (ms) => leg.player.playExecutor.seek(ms),
        leaveView: (behavior) => leg.player.playExecutor.leaveView(behavior),
        returnToView: () => leg.player.playExecutor.returnToView(),
        // the leg playbacks carry the page's listeners from their build (`bind`)
        setListeners: () => {},
        onNaturalFinish: () => leg.player.playExecutor.onNaturalFinish(),
        hasPendingMove: () => leaving !== null || change !== null || (leg.player.playExecutor.hasPendingMove?.() ?? false),
        dispose: () => {},
    };

    return {
        timeline,
        executor,
        controls,
        currentIndex: () => index,
        currentPlayer: () => leg.player,
        playing: () => {
            const spec = leg.run.spec;
            if (spec.kind === 'part') return [o.steps[spec.index].id];
            const ids = [...spec.request.leaving, ...spec.request.entering].map(s => o.steps[s.index].id);
            return ids.filter((id, i) => ids.indexOf(id) === i);
        },
        hold: (id: string, mount: boolean) => {
            const target = indexOf(id);
            if (target < 0) return;
            held = true;
            if (!mount) { request(target); return; }
            // at mount: the step at rest in its segment — no way in to play
            const previous = index;
            index = target;
            if (previous !== target || change || leaving || leg.run.spec.kind !== 'part' || leg.run.spec.part !== PxStepPart.main) {
                change = null;
                if (leaving) { leaving.cancel(); leaving = null; }
                stopWatching();
                leg.player.destroy();
                buildLeg({ spec: { kind: 'part', index: target, part: PxStepPart.main }, startMs: 0, backwards: false });
                arrived = true;
                o.onPlayingChange?.();
            }
            if (o.steps[target].endless) leg.player.playExecutor.startPlayback();
            else leg.player.playExecutor.seek(leg.player.timeline.getTotalDuration() ?? 0);   // a step that ends shows its end, not playing
        },
        isHeld: () => held,
        release: () => { held = false; },
        dispose: () => { disposed = true; if (leaving) leaving.cancel(); leaving = null; change = null; stopWatching(); leg.player.destroy(); },
    };
}
