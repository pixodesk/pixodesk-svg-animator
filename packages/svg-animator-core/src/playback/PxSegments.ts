// @px-area control
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// ============================================================================
// SEGMENTS (2026-11-15) — named parts of one timeline, played one at a time.
//
// | piece | what it does |
// |---|---|
// | `withSegmentEngine` | the document as the ENGINE must see it: one plain pass of the whole window (iterations 1,
// |                     | normal direction, no delay, the last frame held); what the timeline said about repeats,
// |                     | direction, speed and the end is written into each segment first, so nothing is lost |
// | `resolveSegments` | the segments in list order, every default applied — engine ms, repeats, the end, the leaving |
// | the segment CLOCK | replaces the engine's eight primitives on the api: a clock of its own over the CURRENT segment
// |                   | that seeks the (paused) engine every frame — so the executor, the triggers and the api's reads
// |                   | see the segment as the whole playback, unchanged |
// | the CONTROLLER | goes to a segment: the leaving (`whenLeaving`), the hop at the end (`whenFinished`), the guards |
//
// Guards (segments design §5.5): a name that does not exist is not read (PX1114); a name used twice — the first wins
// (PX1115); an automatic hop always shows a frame first (no ring of empty segments can spin); the newest request wins
// while one is leaving.
// Accepted limit (iteration 1): the timeline's `delay` is not waited on a timeline with segments.
// ============================================================================

import type { PxAnimatorRuntimeConfig, PxDocument, PxPlayExecutor, PxPlaybackListeners, PxTimelineSegment } from '../format/PxAnimatorTypes';
import { PxPlaybackDirection, PxPlaybackState, PxSegmentAction, PxWhenFinished, PxWhenLeaving, isSegmentGoToAction, isWirePlaybackSpeed, segmentGoToAction } from '../format/PxAnimatorConstants';
import { animatorOf, legacyAnimatorOf } from '../format/PxDocStage';
import { iterationTimeOf, isValidPlaybackRate } from './PxPlaybackTime';

/** A segment in its settings form — every default applied. @public @advanced */
export interface PxSegmentSettings {
    readonly name: string;
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
    /** Where it goes on at its end, if anywhere: the next segment, or a named one. */
    readonly then?: { readonly next: true } | { readonly segment: string };
    readonly whenLeaving: PxWhenLeaving;
    readonly initial: boolean;
}

/** The segment controls on `player.timeline.segment` (2026-11-15). The same names as the file's actions:
 *  `timeline.segment.next` ↔ `next()`, `timeline.segment.goTo(intro)` ↔ `goTo('intro')`. @public */
export interface PxSegmentControls {
    /** Goes to the next segment in the list — after the last, the first. Changes and plays. */
    next(): void;
    /** Goes to the previous segment — before the first, the last. */
    previous(): void;
    /** Goes to the named segment; a name the file does not have is ignored. Going to the current one does nothing. */
    goTo(name: string): void;
    /** The segment the timeline is in; `null` when the file names none. */
    get(): string | null;
    /** The segments' names, in list order. */
    getAll(): Array<string>;
}

/** The controls of a timeline with no segments — nothing to go to. @internal */
export const NO_SEGMENT_CONTROLS: PxSegmentControls = {
    next: () => {}, previous: () => {}, goTo: () => {}, get: () => null, getAll: () => [],
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** A list entry that can be a segment — an object with a name. */
function isSegmentEntry(v: unknown): v is PxTimelineSegment {
    return isRecord(v) && typeof v.name === 'string';
}

/** The time timeline's segments as written — the list's entries that have a name — or undefined. */
function segmentsOf(timeline: unknown): Array<PxTimelineSegment> | undefined {
    if (!isRecord(timeline) || timeline.type === 'scroll') return undefined;
    const segments = timeline.segments;
    if (!Array.isArray(segments)) return undefined;
    const out = segments.filter(isSegmentEntry);
    return out.length ? out : undefined;
}

/** The segments the player plays: in list order, a name used twice — the first wins (the later is reported, PX1115). */
function uniqueSegments(segments: ReadonlyArray<PxTimelineSegment>): Array<PxTimelineSegment> {
    const seen = new Set<string>();
    return segments.filter(seg => !seen.has(seg.name) && !!seen.add(seg.name));
}

// @px-area pipeline
/**
 * The document as the engine must see it when its timeline has segments — the segment clock seeks ONE plain pass of
 * the whole window. Each segment first gets what the timeline says and it does not (`iterations`,
 * `iterationDirection`, `playbackSpeed`, `whenFinished`); then the timeline is `iterations: 1`, no direction, no delay,
 * no speed, `whenFinished: hold` (the last frame held, so a seek to the end shows it). Without segments: the document
 * as it is. PURE: a new document sharing every untouched subtree. @public @advanced
 */
export function withSegmentEngine(doc: PxDocument): PxDocument {
    const atRoot = isRecord(doc.animator);
    const animator: unknown = atRoot ? doc.animator : legacyAnimatorOf(doc);
    if (!isRecord(animator)) return doc;
    const timeline = animator.timeline;
    const segments = segmentsOf(timeline);
    if (!segments || !isRecord(timeline)) return doc;
    const baked = segments.map((seg): PxTimelineSegment => {
        const out: PxTimelineSegment = { ...seg };
        if (out.iterations === undefined && (typeof timeline.iterations === 'number' || timeline.iterations === 'infinite')) out.iterations = timeline.iterations;
        if (out.iterationDirection === undefined && isDirection(timeline.iterationDirection)) out.iterationDirection = timeline.iterationDirection;
        if (out.playbackSpeed === undefined && typeof timeline.playbackSpeed === 'number') out.playbackSpeed = timeline.playbackSpeed;
        if (out.whenFinished === undefined && typeof timeline.whenFinished === 'string') out.whenFinished = timeline.whenFinished;
        return out;
    });
    const engineTimeline: Record<string, unknown> = { ...timeline, iterations: 1, whenFinished: PxWhenFinished.hold, segments: baked };
    delete engineTimeline.iterationDirection;
    delete engineTimeline.delay;
    delete engineTimeline.playbackSpeed;
    const next = { ...animator, timeline: engineTimeline };
    if (!atRoot) return { ...doc, meta: { ...(isRecord(doc.meta) ? doc.meta : {}), animator: next } };
    return { ...doc, animator: next } as PxDocument;
}

const isDirection = (v: unknown): v is PxPlaybackDirection =>
    v === PxPlaybackDirection.normal || v === PxPlaybackDirection.reverse || v === PxPlaybackDirection.alternate || v === PxPlaybackDirection.alternateReverse;

const isPictureWord = (v: unknown): v is PxWhenFinished =>
    v === PxWhenFinished.hold || v === PxWhenFinished.jumpToStart || v === PxWhenFinished.animateToStart;

const isLeaving = (v: unknown): v is PxWhenLeaving =>
    v === PxWhenLeaving.jump || v === PxWhenLeaving.animateToEnd || v === PxWhenLeaving.animateToStart;

// @px-area control
/** A runtime view's segments in LIST order, every default applied; empty without segments. A name used twice: the
 *  first wins. A segment's `whenFinished` that names no segment reads as `hold`. @public @advanced */
export function resolveSegments(cfg: Pick<PxAnimatorRuntimeConfig, 'segments' | 'inTime' | 'duration' | 'timelineSource'> | undefined): Array<PxSegmentSettings> {
    if (!cfg?.segments || cfg.timelineSource === 'scroll') return [];
    const segments = uniqueSegments(cfg.segments);
    const windowStart = cfg.inTime ?? 0;
    const windowEnd = windowStart + (cfg.duration ?? 0);
    const names = segments.map(seg => seg.name);
    return segments.map((seg): PxSegmentSettings => {
        const inTime = typeof seg.inTime === 'number' ? seg.inTime : windowStart;
        const outTime = typeof seg.outTime === 'number' ? seg.outTime : windowEnd;
        const iterations = seg.iterations === 'infinite' ? Infinity : typeof seg.iterations === 'number' && seg.iterations > 0 ? seg.iterations : 1;
        const whenFinished = seg.whenFinished;
        const target = names.find(n => segmentGoToAction(n) === whenFinished);
        const then: PxSegmentSettings['then'] = whenFinished === PxSegmentAction.next ? { next: true }
            : target !== undefined ? { segment: target } : undefined;
        return {
            name: seg.name,
            startMs: Math.max(0, inTime - windowStart),
            passMs: Math.max(0, outTime - inTime),
            iterations,
            direction: isDirection(seg.iterationDirection) ? seg.iterationDirection : undefined,
            speed: typeof seg.playbackSpeed === 'number' && isWirePlaybackSpeed(seg.playbackSpeed) ? seg.playbackSpeed : 1,
            whenFinished: isPictureWord(whenFinished) ? whenFinished : PxWhenFinished.hold,
            then,
            whenLeaving: isLeaving(seg.whenLeaving) ? seg.whenLeaving : PxWhenLeaving.jump,
            initial: seg.initial === true,
        };
    });
}

/** The names a later segment of the list uses again — each once; the player plays the first (PX1115). @public @advanced */
export function duplicateSegmentNames(cfg: Pick<PxAnimatorRuntimeConfig, 'segments' | 'timelineSource'>): Array<string> {
    if (!cfg.segments || cfg.timelineSource === 'scroll') return [];
    const seen = new Set<string>();
    const twice = new Set<string>();
    for (const seg of cfg.segments) {
        if (seen.has(seg.name)) twice.add(seg.name);
        seen.add(seg.name);
    }
    return [...twice];
}

/** A `timeline.segment.goTo(‹name›)` naming a segment the timeline does not have — it is ignored. @public @advanced */
export interface PxSegmentReferenceIssue {
    /** The action as written. */
    readonly action: string;
    /** The segment whose `whenFinished` holds it; absent — a key of `actionTriggers`. */
    readonly segment?: string;
    /** The names the timeline has. */
    readonly names: ReadonlyArray<string>;
}

/** Every goTo in `actionTriggers` and in the segments' `whenFinished` that names no segment of this timeline. @public @advanced */
export function segmentReferenceIssues(cfg: Pick<PxAnimatorRuntimeConfig, 'segments' | 'actionTriggers' | 'timelineSource'>): Array<PxSegmentReferenceIssue> {
    const segments = cfg.timelineSource === 'scroll' ? [] : uniqueSegments(cfg.segments ?? []);
    const names = segments.map(seg => seg.name);
    const known = new Set(names.map(segmentGoToAction));
    const unknown = (action: string | undefined): action is string => action !== undefined && isSegmentGoToAction(action) && !known.has(action);
    const issues: Array<PxSegmentReferenceIssue> = [];
    for (const action of Object.keys(cfg.actionTriggers ?? {})) if (unknown(action)) issues.push({ action, names });
    for (const seg of segments) if (unknown(seg.whenFinished)) issues.push({ action: seg.whenFinished, segment: seg.name, names });
    return issues;
}

/** The engine primitives the segment clock takes over (the executor's `PxPlayTarget` and `jumpToEnd`). */
export interface PxSegmentEngineTarget {
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

/** What the segment clock gives the composed api: the live geometry, the controls, and the hooks it needs. @internal */
export interface PxSegmentRuntime {
    /** The current segment's geometry — what the executor and the reads use. */
    geometry(): { passMs: number; totalMs: number; direction?: PxPlaybackDirection; whenFinished: PxWhenFinished };
    readonly controls: PxSegmentControls;
    /** The executor to drive — set once, right after it is built on the taken-over api. */
    attach(executor: PxPlayExecutor): void;
    /** The listeners told about a change of segment. */
    setListeners(listeners: PxPlaybackListeners | undefined): void;
    /** A component's `segment` prop: holds the segment — the file's segment triggers are no longer read. `mount`: the
     *  first position — a segment that ends is shown at its end without playing, one that repeats plays. */
    hold(name: string, mount: boolean): void;
    /** True while a component holds the segment. */
    isHeld(): boolean;
    /** The component let go (its `segment` prop gone): the file's segment triggers are read again; nothing moves. */
    release(): void;
    dispose(): void;
}

/** A component's `segment` prop between the component and its player (React, Vue): the name it holds, applied to the
 *  player built now and to every rebuild. @internal */
export interface PxSegmentLever {
    /** The prop's value — a change goes to the attached player as a request (its `whenLeaving` honoured). */
    set(name: string | undefined): void;
    /** The segment runtime of the player just built (none: destroyed, or no segments) — the held name lands as at mount. */
    attach(runtime: PxSegmentRuntime | undefined): void;
}

/** A lever holding `initial` (the prop's first value) — nothing to hold yet when absent. @internal */
export function createSegmentLever(initial?: string): PxSegmentLever {
    let name = initial;
    let runtime: PxSegmentRuntime | undefined;
    return {
        set: (next) => {
            if (next === name) return;
            name = next;
            if (!runtime) return;
            if (name === undefined) runtime.release();
            else runtime.hold(name, false);
        },
        attach: (next) => {
            runtime = next;
            if (runtime && name !== undefined) runtime.hold(name, true);
        },
    };
}

const EPS = 0.5;

// @px-area control
/**
 * Takes over the engine's eight primitives on `api` with a clock of the CURRENT segment (see the top of the file)
 * and returns the controller. `segments`: {@link resolveSegments}, non-empty; the engine was built from
 * {@link withSegmentEngine}'s document. `raf` schedules a frame; `now` reads the time in ms.
 * @internal
 */
export function installSegmentClock(
    api: PxSegmentEngineTarget,
    segments: ReadonlyArray<PxSegmentSettings>,
    raf: (cb: () => void) => void,
    now: () => number = defaultNow,
): PxSegmentRuntime {
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
    /** A requested change of segment that waits for the current one to leave (`whenLeaving`) — the newest wins. */
    let leaving: { target: number; at: number; backwards: boolean } | null = null;

    const seg = (): PxSegmentSettings => segments[current];
    const total = (): number => seg().passMs * seg().iterations;
    const velocity = (): number => speed * seg().speed;
    const clampLocal = (ms: number): number => Math.max(0, total() === Infinity ? ms : Math.min(total(), ms));
    const liveLocal = (): number => running ? clampLocal(local + (now() - lastNow) * velocity()) : local;

    /** The engine at the current segment's frame for `local`. */
    const draw = (): void => {
        const s = seg();
        const frame = s.passMs > 0 ? iterationTimeOf(local, { durationMs: s.passMs, iterations: s.iterations, direction: s.direction }) : 0;
        engine.setTotalTime(s.startMs + frame);
    };
    /** The segment's rest pose: the file's own look when it begins at the window's start, else its first frame. */
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

    /** The current segment played to its end. */
    const reachedEnd = (): void => {
        if (leaving) { switchTo(leaving.target); return; }
        const then = seg().then;
        if (then && !executor?.hasPendingMove?.()) {
            // the guard: the end frame is drawn before the hop — no ring of empty segments can spin within one frame
            const target = 'segment' in then ? then.segment : undefined;
            const to = target === undefined ? (current + 1) % segments.length : segments.findIndex(x => x.name === target);
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

    /** The change itself: the new segment from its start, playing. */
    const switchTo = (target: number): void => {
        if (target < 0 || target >= segments.length) { leaving = null; return; }
        const previous = seg().name;
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
        if (previous !== seg().name) listeners?.onSegmentChange?.(seg().name, previous);
    };

    /** A request to go to `target` — by the segment's way of leaving. */
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

    const indexOf = (name: string): number => segments.findIndex(s => s.name === name);

    // ── the eight primitives, over the current segment ──
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

    // before anything starts: the initial segment's rest pose
    if (seg().startMs !== 0) rest();

    const controls: PxSegmentControls = {
        next: () => request((current + 1) % segments.length),
        previous: () => request((current - 1 + segments.length) % segments.length),
        goTo: (name: string) => request(indexOf(name)),
        get: () => seg().name,
        getAll: () => segments.map(s => s.name),
    };

    return {
        geometry: () => ({ passMs: seg().passMs, totalMs: total(), direction: seg().direction, whenFinished: seg().whenFinished }),
        controls,
        attach: (e) => { executor = e; },
        setListeners: (l) => { listeners = l; },
        hold: (name: string, mount: boolean) => {
            held = true;
            const index = indexOf(name);
            if (index < 0) return;
            if (!mount) { request(index); return; }
            const previous = seg().name;
            current = index;
            local = 0;
            if (total() === Infinity) executor?.startPlayback();
            else executor?.seek(total());   // a segment that ends shows its end, without playing
            if (previous !== seg().name) listeners?.onSegmentChange?.(seg().name, previous);
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

/** True when the document's timeline names segments. @public @advanced */
export function hasSegments(doc: PxDocument): boolean {
    const animator = animatorOf(doc);
    return isRecord(animator) && segmentsOf(animator.timeline) !== undefined;
}
