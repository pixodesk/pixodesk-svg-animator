// @px-area control
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// ============================================================================
// STATES (2026-11-20; "segments" of one timeline, 2026-11-15) — named parts of a timeline; of the states of one
// state machine exactly one is current, and its part plays.
//
// | piece | what it does |
// |---|---|
// | `withStateEngine` | the document as the ENGINE must see it: one plain pass of the whole window (iterations 1,
// |                   | normal direction, no delay, the last frame held); what the timeline said about repeats,
// |                   | direction, speed and the end is written into each state first, so nothing is lost |
// | `resolveStates` | the first timeline's states in list order, every default applied — engine ms, repeats, the end |
// | the state CLOCK | replaces the engine's eight primitives on the api: a clock of its own over the CURRENT state that
// |                 | seeks the (paused) engine every frame — so the executor, the triggers and the api's reads see the
// |                 | state as the whole playback, unchanged |
// | the CONTROLLER | goes to a state: the leaving (`whenLeaving`), the hop at the end (`whenFinished`), the guards |
//
// This module plays ONE state machine on ONE engine. A file with several timelines is split into units first
// (`PxUnits`): a state machine whose states are on several timelines has them laid end to end into one.
// Guards (segments design §5.5): an id that does not exist is not read (PX1114); an id used twice — the first wins
// (PX1115); an automatic hop always shows a frame first (no ring of empty states can spin); the newest request wins
// while one is leaving.
// Accepted limit: the timeline's `delay` is not waited on a timeline that states use.
// ============================================================================

import type { PxActionObject, PxAnimatorRuntimeConfig, PxDocument, PxPlayExecutor, PxPlaybackListeners, PxState, PxTimeline } from '../format/PxAnimatorTypes';
import { PxPlaybackDirection, PxPlaybackState, PxStateAction, PxWhenFinished, PxWhenLeaving, firstTimelineOf, isOnFirstTimeline, isWirePlaybackSpeed } from '../format/PxAnimatorConstants';
import { animatorOf, legacyAnimatorOf } from '../format/PxDocStage';
import { iterationTimeOf, isValidPlaybackRate } from './PxPlaybackTime';

/** A state in its settings form — every default applied. @public @advanced */
export interface PxStateSettings {
    readonly id: string;
    /** Where it begins on the ENGINE's clock (content ms − the window's start). */
    readonly startMs: number;
    /** One pass, ms. */
    readonly passMs: number;
    /** Passes; `Infinity` when endless. */
    readonly iterations: number;
    readonly direction?: PxPlaybackDirection;
    /** A factor on top of the player's speed. */
    readonly speed: number;
    /** What the picture shows when it ends with nowhere to go. */
    readonly whenFinished: PxWhenFinished;
    /** Where it goes on at its end, if anywhere: the next state, the previous one, or the one named. */
    readonly then?: { readonly step: 1 | -1 } | { readonly state: string };
    readonly whenLeaving: PxWhenLeaving;
    readonly initial: boolean;
}

/** The state controls on `player.state` (2026-11-20; `player.timeline.segment` until then). The same names as the
 *  file's actions: `state.next` ↔ `next()`, `state.goTo` with `state: "intro"` ↔ `goTo('intro')`. @public */
export interface PxStateControls {
    /** Goes to the next state of a state machine — after the last, the first. Changes and plays. `stateMachine`: its
     *  id; none — the state machine without an id, else the first. */
    next(stateMachine?: string): void;
    /** Goes to the previous state — before the first, the last. */
    previous(stateMachine?: string): void;
    /** Goes to the state; an id the file does not have is ignored. Going to the current one does nothing. */
    goTo(state: string): void;
    /** The current state of each state machine, in the order of `stateMachines` (the one without an id first);
     *  with `stateMachine` — of that one: `[id]`. Empty when the file has no states. */
    get(stateMachine?: string): Array<string>;
    /** The states' ids, in list order. */
    getAll(): Array<string>;
}

/** The controls of a picture with no states — nothing to go to. @internal */
export const NO_STATE_CONTROLS: PxStateControls = {
    next: () => {}, previous: () => {}, goTo: () => {}, get: () => [], getAll: () => [],
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** A list entry that can be a state — an object with an id. */
function isStateEntry(v: unknown): v is PxState {
    return isRecord(v) && typeof v.id === 'string';
}

/** The first timeline and its states as written — the list's entries that have an id and are a part of the first
 *  timeline — or undefined (no states, or a scroll timeline: nothing starts or finishes there). */
function firstTimelineStates(animator: Record<string, unknown>): { timeline: PxTimeline; states: Array<PxState> } | undefined {
    const timeline = firstTimelineOf({ timelines: Array.isArray(animator.timelines) ? animator.timelines : undefined });
    if (!timeline || timeline.type === 'scroll' || !Array.isArray(animator.states)) return undefined;
    const states = animator.states.filter(isStateEntry).filter(st => isOnFirstTimeline(st, timeline));
    return states.length ? { timeline, states } : undefined;
}

/** The states the player plays: in list order, an id used twice — the first wins (the later is reported, PX1115). */
function uniqueStates(states: ReadonlyArray<PxState>): Array<PxState> {
    const seen = new Set<string>();
    return states.filter(st => !seen.has(st.id) && !!seen.add(st.id));
}

// @px-area pipeline
/**
 * The document as the engine must see it when its first timeline has states — the state clock seeks ONE plain pass of
 * the whole window. Each state first gets what the timeline says and it does not (`iterations`, `iterationDirection`,
 * `playbackSpeed`, `whenFinished`); then the timeline is `iterations: 1`, no direction, no delay, no speed,
 * `whenFinished: hold` (the last frame held, so a seek to the end shows it). Without states: the document as it is.
 * PURE: a new document sharing every untouched subtree. @public @advanced
 */
export function withStateEngine(doc: PxDocument): PxDocument {
    const atRoot = isRecord(doc.animator);
    const animator: unknown = atRoot ? doc.animator : legacyAnimatorOf(doc);
    if (!isRecord(animator)) return doc;
    const found = firstTimelineStates(animator);
    if (!found) return doc;
    const timeline: Record<string, unknown> = { ...found.timeline };
    const baked = new Map<PxState, PxState>();
    for (const st of found.states) {
        const out: PxState = { ...st };
        if (out.iterations === undefined && (typeof timeline.iterations === 'number' || timeline.iterations === 'infinite')) out.iterations = timeline.iterations;
        if (out.iterationDirection === undefined && isDirection(timeline.iterationDirection)) out.iterationDirection = timeline.iterationDirection;
        if (out.playbackSpeed === undefined && typeof timeline.playbackSpeed === 'number') out.playbackSpeed = timeline.playbackSpeed;
        if (out.whenFinished === undefined && isPictureWord(timeline.whenFinished)) out.whenFinished = timeline.whenFinished;
        baked.set(st, out);
    }
    const engineTimeline: Record<string, unknown> = { ...timeline, iterations: 1, whenFinished: PxWhenFinished.hold };
    delete engineTimeline.iterationDirection;
    delete engineTimeline.delay;
    delete engineTimeline.playbackSpeed;
    const timelines = Array.isArray(animator.timelines) ? [engineTimeline, ...animator.timelines.slice(1)] : [engineTimeline];
    const states = Array.isArray(animator.states) ? animator.states.map(st => (isStateEntry(st) ? baked.get(st) ?? st : st)) : animator.states;
    const next = { ...animator, timelines, states };
    if (!atRoot) return { ...doc, meta: { ...(isRecord(doc.meta) ? doc.meta : {}), animator: next } };
    return { ...doc, animator: next } as PxDocument;
}

const isDirection = (v: unknown): v is PxPlaybackDirection =>
    v === PxPlaybackDirection.normal || v === PxPlaybackDirection.reverse || v === PxPlaybackDirection.alternate || v === PxPlaybackDirection.alternateReverse;

const isPictureWord = (v: unknown): v is PxWhenFinished =>
    v === PxWhenFinished.hold || v === PxWhenFinished.jumpToStart || v === PxWhenFinished.animateToStart;

const isLeaving = (v: unknown): v is PxWhenLeaving =>
    v === PxWhenLeaving.jump || v === PxWhenLeaving.animateToEnd || v === PxWhenLeaving.animateToStart;

/** A `whenFinished` that is an action — `{ action: "state.goTo", state }`, `state.next`, `state.previous`. @public @advanced */
export function isStateActionObject(v: unknown): v is PxActionObject {
    return isRecord(v) && (v.action === PxStateAction.goTo || v.action === PxStateAction.next || v.action === PxStateAction.previous);
}

// @px-area control
/** A runtime view's states in LIST order, every default applied; empty without states. An id used twice: the first
 *  wins. A `whenFinished` that names no state reads as `hold`. @public @advanced */
export function resolveStates(cfg: Pick<PxAnimatorRuntimeConfig, 'states' | 'inTime' | 'duration' | 'timelineSource'> | undefined): Array<PxStateSettings> {
    if (!cfg?.states || cfg.timelineSource === 'scroll') return [];
    const states = uniqueStates(cfg.states.filter(isStateEntry));
    const windowStart = cfg.inTime ?? 0;
    const windowEnd = windowStart + (cfg.duration ?? 0);
    const ids = states.map(st => st.id);
    return states.map((st): PxStateSettings => {
        const inTime = typeof st.inTime === 'number' ? st.inTime : windowStart;
        const outTime = typeof st.outTime === 'number' ? st.outTime : windowEnd;
        const iterations = st.iterations === 'infinite' ? Infinity : typeof st.iterations === 'number' && st.iterations > 0 ? st.iterations : 1;
        const whenFinished = st.whenFinished;
        const then: PxStateSettings['then'] = !isStateActionObject(whenFinished) ? undefined
            : whenFinished.action === PxStateAction.next ? { step: 1 }
            : whenFinished.action === PxStateAction.previous ? { step: -1 }
            : whenFinished.state !== undefined && ids.includes(whenFinished.state) ? { state: whenFinished.state } : undefined;
        return {
            id: st.id,
            startMs: Math.max(0, inTime - windowStart),
            passMs: Math.max(0, outTime - inTime),
            iterations,
            direction: isDirection(st.iterationDirection) ? st.iterationDirection : undefined,
            speed: typeof st.playbackSpeed === 'number' && isWirePlaybackSpeed(st.playbackSpeed) ? st.playbackSpeed : 1,
            whenFinished: isPictureWord(whenFinished) ? whenFinished : PxWhenFinished.hold,
            then,
            whenLeaving: isLeaving(st.whenLeaving) ? st.whenLeaving : PxWhenLeaving.jump,
            initial: st.initial === true,
        };
    });
}

/** The ids a later state of the list uses again — each once; the player plays the first (PX1115). @public @advanced */
export function duplicateStateIds(states: ReadonlyArray<PxState> | undefined): Array<string> {
    const seen = new Set<string>();
    const twice = new Set<string>();
    for (const st of states ?? []) {
        if (!isStateEntry(st)) continue;
        if (seen.has(st.id)) twice.add(st.id);
        seen.add(st.id);
    }
    return [...twice];
}

/** A `state.goTo` naming a state the file does not have — it is ignored (PX1114). @public @advanced */
export interface PxStateReferenceIssue {
    /** The state it names. */
    readonly target: string;
    /** The state whose `whenFinished` holds it; absent — a rule of `actionTriggers`. */
    readonly state?: string;
    /** The ids the file has. */
    readonly ids: ReadonlyArray<string>;
}

/** Every `state.goTo` in `actionTriggers` and in the states' `whenFinished` that names no state of the file. @public @advanced */
export function stateReferenceIssues(cfg: Pick<PxAnimatorRuntimeConfig, 'states' | 'actionTriggers'>): Array<PxStateReferenceIssue> {
    const states = uniqueStates((cfg.states ?? []).filter(isStateEntry));
    const ids = states.map(st => st.id);
    const unknown = (target: string | undefined): target is string => target !== undefined && !ids.includes(target);
    const issues: Array<PxStateReferenceIssue> = [];
    for (const rule of cfg.actionTriggers ?? []) {
        if (rule.action === PxStateAction.goTo && unknown(rule.state)) issues.push({ target: rule.state, ids });
    }
    for (const st of states) {
        const wf = st.whenFinished;
        if (isStateActionObject(wf) && wf.action === PxStateAction.goTo && unknown(wf.state)) issues.push({ target: wf.state, state: st.id, ids });
    }
    return issues;
}

/** The engine primitives the state clock takes over (the executor's `PxPlayTarget` and `jumpToEnd`). */
export interface PxStateEngineTarget {
    play(): void;
    pause(): void;
    jumpToStart(): void;
    jumpToEnd?: () => void;
    getPlaybackSpeed(): number;
    setPlaybackSpeed(speed: number): void;
    getTotalTime(): number | null;
    setTotalTime(time: number): void;
    isPlaying(): boolean;
}

/** What the state clock gives the composed api: the live geometry, the controls, and the hooks it needs. @internal */
export interface PxStateRuntime {
    /** The current state's geometry — what the executor and the reads use. */
    geometry(): { passMs: number; totalMs: number; direction?: PxPlaybackDirection; whenFinished: PxWhenFinished };
    readonly controls: PxStateControls;
    /** The executor to drive — set once, right after it is built on the taken-over api. */
    attach(executor: PxPlayExecutor): void;
    /** The listeners told about a change of state. */
    setListeners(listeners: PxPlaybackListeners | undefined): void;
    /** A component's `state` prop: holds the state — the file's state rules are no longer read. `mount`: the first
     *  position — a state that ends is shown at its end without playing, one that repeats plays. */
    hold(id: string, mount: boolean): void;
    /** True while a component holds the state. */
    isHeld(): boolean;
    /** The component let go (its `state` prop gone): the file's state rules are read again; nothing moves. */
    release(): void;
    dispose(): void;
}

/** The runtime a lever holds — one state clock, or a picture of several (each state goes to its own). @internal */
export interface PxStateHolder {
    hold(id: string, mount: boolean): void;
    release(): void;
}

/** A component's `state` prop between the component and its player (React, Vue): the id — or ids, one per state
 *  machine — it holds, applied to the player built now and to every rebuild. @internal */
export interface PxStateLever {
    /** The prop's value — a change goes to the attached player as a request (its `whenLeaving` honoured). */
    set(ids: string | ReadonlyArray<string> | undefined): void;
    /** The state runtime of the player just built (none: destroyed, or no states) — the held ids land as at mount. */
    attach(runtime: PxStateHolder | undefined): void;
}

const idsOf = (ids: string | ReadonlyArray<string> | undefined): ReadonlyArray<string> =>
    ids === undefined ? [] : typeof ids === 'string' ? [ids] : ids;

/** A lever holding `initial` (the prop's first value) — nothing to hold yet when absent. @internal */
export function createStateLever(initial?: string | ReadonlyArray<string>): PxStateLever {
    let held = idsOf(initial);
    let runtime: PxStateHolder | undefined;
    return {
        set: (next) => {
            const ids = idsOf(next);
            if (ids.length === held.length && ids.every((id, i) => id === held[i])) return;
            held = ids;
            if (!runtime) return;
            if (!held.length) runtime.release();
            else for (const id of held) runtime.hold(id, false);
        },
        attach: (next) => {
            runtime = next;
            if (runtime) for (const id of held) runtime.hold(id, true);
        },
    };
}

const EPS = 0.5;

// @px-area control
/**
 * Takes over the engine's eight primitives on `api` with a clock of the CURRENT state (see the top of the file) and
 * returns the controller. `segments`: {@link resolveStates}, non-empty — one state machine; the engine was built from
 * {@link withStateEngine}'s document. `raf` schedules a frame; `now` reads the time in ms. `stateMachine`: the state
 * machine's id, told with every change of state.
 * @internal
 */
export function installStateClock(
    api: PxStateEngineTarget,
    segments: ReadonlyArray<PxStateSettings>,
    raf: (cb: () => void) => void,
    now: () => number = defaultNow,
    stateMachine?: string,
): PxStateRuntime {
    const engine = {
        pause: api.pause.bind(api), jumpToStart: api.jumpToStart.bind(api), setTotalTime: api.setTotalTime.bind(api),
        setPlaybackSpeed: api.setPlaybackSpeed.bind(api),
    };
    engine.pause();
    let current = Math.max(0, segments.findIndex(s => s.initial));
    let local = 0;           // ms on the current segment's whole playback
    let running = false;
    let speed = 1;           // the player's speed, signed (a return leg runs it backwards)
    let lastNow = now();
    let scheduled = false;
    let disposed = false;
    let executor: PxPlayExecutor | undefined;
    let listeners: PxPlaybackListeners | undefined;
    let held = false;
    /** A requested change of state that waits for the current one to leave (`whenLeaving`) — the newest wins. */
    let leaving: { target: number; at: number; backwards: boolean } | null = null;

    const seg = (): PxStateSettings => segments[current];
    const total = (): number => seg().passMs * seg().iterations;
    const velocity = (): number => speed * seg().speed;
    const clampLocal = (ms: number): number => Math.max(0, total() === Infinity ? ms : Math.min(total(), ms));
    const liveLocal = (): number => running ? clampLocal(local + (now() - lastNow) * velocity()) : local;

    /** The engine at the current state's frame for `local`. */
    const draw = (): void => {
        const s = seg();
        const frame = s.passMs > 0 ? iterationTimeOf(local, { durationMs: s.passMs, iterations: s.iterations, direction: s.direction }) : 0;
        engine.setTotalTime(s.startMs + frame);
    };
    /** The state's rest pose: the file's own look when it begins at the window's start, else its first frame. */
    const rest = (): void => {
        const s = seg();
        if (s.startMs === 0 && (s.direction === undefined || s.direction === PxPlaybackDirection.normal)) engine.jumpToStart();
        else draw();
    };

    const schedule = (): void => {
        if (scheduled || disposed) return;
        scheduled = true;
        raf(tick);
    };
    const tick = (): void => {
        scheduled = false;
        if (!running || disposed) return;
        const t = now();
        local += (t - lastNow) * velocity();
        lastNow = t;
        const v = velocity();
        if (leaving && ((!leaving.backwards && v > 0 && local >= leaving.at - EPS) || (leaving.backwards && v < 0 && local <= leaving.at + EPS))) {
            local = leaving.at;
            draw();
            switchTo(leaving.target);
            return;
        }
        const end = total();
        if (v > 0 && end !== Infinity && local >= end) { local = end; draw(); running = false; reachedEnd(); return; }
        if (v < 0 && local <= 0) { local = 0; draw(); running = false; reachedStart(); return; }
        draw();
        schedule();
    };

    /** The current state played to its end. */
    const reachedEnd = (): void => {
        if (leaving) { switchTo(leaving.target); return; }
        const then = seg().then;
        if (then && !executor?.hasPendingMove?.()) {
            // the guard: the end frame is drawn before the hop — no ring of empty states can spin within one frame
            const to = 'state' in then ? segments.findIndex(x => x.id === then.state)
                : (current + then.step + segments.length) % segments.length;
            raf(() => { if (!disposed && to >= 0) switchTo(to); });
            return;
        }
        executor?.onNaturalFinish();
    };
    /** Played back to its start (a return leg, or a leaving that plays back). */
    const reachedStart = (): void => {
        if (leaving) { switchTo(leaving.target); return; }
        executor?.onNaturalFinish();
    };

    /** The change itself: the new state from its start, playing. */
    const switchTo = (target: number): void => {
        if (target < 0 || target >= segments.length) { leaving = null; return; }
        const previous = seg().id;
        leaving = null;
        speed = Math.abs(speed) || 1;
        current = target;
        local = 0;
        if (running) {
            lastNow = now();
            draw();
            schedule();
        } else {
            executor?.startPlayback();
        }
        if (previous !== seg().id) listeners?.onStateChange?.(seg().id, previous, stateMachine);
    };

    /** A request to go to `target` — by the state's way of leaving. */
    const request = (target: number): void => {
        if (target < 0 || target >= segments.length) return;
        if (leaving) { leaving.target = target; return; }      // the newest request wins
        if (target === current) return;
        const s = seg();
        const state = executor?.state();
        const at = liveLocal();
        if (s.whenLeaving === PxWhenLeaving.animateToEnd && state === PxPlaybackState.playing && s.passMs > 0 && velocity() > 0) {
            local = at; lastNow = now();
            const passEnd = Math.min(total(), Math.max(1, Math.ceil((at - EPS) / s.passMs)) * s.passMs);
            leaving = { target, at: passEnd, backwards: false };
            return;
        }
        if (s.whenLeaving === PxWhenLeaving.animateToStart && s.passMs > 0 && at > EPS
            && (state === PxPlaybackState.playing || state === PxPlaybackState.paused || state === PxPlaybackState.finished)) {
            local = at; lastNow = now();
            const passStart = Math.floor(Math.max(at - EPS, 0) / s.passMs) * s.passMs;
            leaving = { target, at: passStart, backwards: true };
            speed = -(Math.abs(speed) || 1);
            if (!running) { running = true; lastNow = now(); schedule(); }
            return;
        }
        switchTo(target);
    };

    const indexOf = (id: string): number => segments.findIndex(s => s.id === id);

    // ── the eight primitives, over the current state ──
    const target = api;
    target.play = () => {
        if (running) return;
        if (velocity() > 0 && total() !== Infinity && local >= total()) local = 0;       // as WAAPI: a play at the end rewinds
        if (velocity() < 0 && local <= 0 && total() !== Infinity) local = total();
        running = true;
        lastNow = now();
        schedule();
    };
    target.pause = () => { if (running) { local = liveLocal(); running = false; draw(); } };
    target.jumpToStart = () => { running = false; local = 0; rest(); };
    target.jumpToEnd = () => { running = false; local = total() === Infinity ? local : total(); draw(); };
    target.getPlaybackSpeed = () => speed;
    target.setPlaybackSpeed = (rate: number) => {
        if (!isValidPlaybackRate(rate)) { engine.setPlaybackSpeed(rate); return; }   // the engine says why it is rejected
        local = liveLocal(); lastNow = now(); speed = rate;
    };
    target.getTotalTime = () => liveLocal();
    target.setTotalTime = (ms: number) => { local = clampLocal(Number.isFinite(ms) ? ms : 0); lastNow = now(); draw(); };
    target.isPlaying = () => running;

    // before anything starts: the initial state's rest pose
    if (seg().startMs !== 0) rest();

    const controls: PxStateControls = {
        next: () => request((current + 1) % segments.length),
        previous: () => request((current - 1 + segments.length) % segments.length),
        goTo: (id: string) => request(indexOf(id)),
        get: () => [seg().id],
        getAll: () => segments.map(s => s.id),
    };

    return {
        geometry: () => ({ passMs: seg().passMs, totalMs: total(), direction: seg().direction, whenFinished: seg().whenFinished }),
        controls,
        attach: (e) => { executor = e; },
        setListeners: (l) => { listeners = l; },
        hold: (id: string, mount: boolean) => {
            const index = indexOf(id);
            if (index < 0) return;
            held = true;
            if (!mount) { request(index); return; }
            const previous = seg().id;
            current = index;
            local = 0;
            if (total() === Infinity) executor?.startPlayback();
            else executor?.seek(total());   // a state that ends shows its end, without playing
            if (previous !== seg().id) listeners?.onStateChange?.(seg().id, previous, stateMachine);
        },
        isHeld: () => held,
        release: () => { held = false; },
        dispose: () => { disposed = true; running = false; },
    };
}

/** The clock the frame loop keeps too — one time source for both. */
function defaultNow(): number {
    return Date.now();
}

/** True when the document's first timeline has states. @public @advanced */
export function hasStates(doc: PxDocument): boolean {
    const animator = animatorOf(doc);
    return isRecord(animator) && firstTimelineStates(animator) !== undefined;
}
