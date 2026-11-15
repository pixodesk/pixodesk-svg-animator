// @px-area config
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// ============================================================================
// Wire CONSTANTS and schema-free helpers.
//
// Split out of `PxAnimatorTypes` so that code needing only an enum does not drag the
// SCHEMA ENGINE in with it. `PxAnimatorTypes` builds ~31 schema declarations at module
// scope through curried `implementsInterface<T>()(px.object(...))` calls, which no
// minifier can treat as side-effect-free — so a single value import from it pulls in
// `PxSchema` plus every declaration.
//
// That is exactly what happened: `PxDefinitions` imported `PxLoopExtend` (one small const)
// and the pre-rendered player builds ended up carrying 14 KB of validation code they never
// call. See dev-docs/plans/prerendered-player-builds.md.
//
// RULE: nothing in this file may import a VALUE from `PxAnimatorTypes`. Type-only imports
// are fine — they are erased at build time and cannot create a runtime edge.
// ============================================================================

import type { PxDocument, PxAnimatorConfig, PxAnimatorRuntimeConfig, PxBinding, PxDefinitions, PxNode, PxScrollMomentWire, PxTimeline, PxActionTriggers, PxActionTriggersInput, PxActions, PxTriggerEventObject, PxTriggerEventFilter, _PxScrollTimeline, _PxTimeTimeline } from './PxAnimatorTypes';
// (TYPES only from PxAnimatorTypes: it reads this module's constants while it loads.)
import { animatorOf, prepOf, stageAtLeast, stampPrep, trustedView, PxDocStage, type PxDocPrep } from './PxDocStage';

// ── WIRE ENUMS (review §2.7) ────────────────────────────────────────────────
// ONE shape for every enumerated wire value: an exported `Px*` const namespace plus the
// string type derived from it, so a call site can write `PxFillMode.forwards` and the
// schema can reference the same members instead of repeating bare literals.
//
// NOT a TypeScript `enum`: these are WIRE values, and a document is authored as plain
// JSON — `{ fill: 'forwards' }`. A string `enum` is nominal, so that literal would not
// typecheck without importing the enum; the derived union accepts both spellings. It is
// also the only form that composes (`PxTimelineEngineSetting` spreads `PxTimelineEngine`)
// and that survives erasable-syntax / type-stripping builds.

/** WAAPI `fill` — which values apply outside the active period. @public */
export const PxFillMode = {
    forwards:  'forwards',
    backwards: 'backwards',
    both:      'both',
    none:      'none',
} as const;

export type PxFillMode = typeof PxFillMode[keyof typeof PxFillMode];

/** Which way each iteration runs — WAAPI `direction`, in the format's camelCase (review §25). @public */
export const PxPlaybackDirection = {
    normal:            'normal',
    reverse:           'reverse',
    alternate:         'alternate',
    alternateReverse:  'alternateReverse',
} as const;

export type PxPlaybackDirection = typeof PxPlaybackDirection[keyof typeof PxPlaybackDirection];

/** The browser's spelling of a direction — CSS `animation-direction` / WAAPI `direction`. @internal */
export type PxCssPlaybackDirection = 'normal' | 'reverse' | 'alternate' | 'alternate-reverse';

/** A direction as the browser takes it (`alternateReverse` → `'alternate-reverse'`). @internal */
export function cssPlaybackDirection(direction: PxPlaybackDirection): PxCssPlaybackDirection {
    switch (direction) {
        case PxPlaybackDirection.alternateReverse: return 'alternate-reverse';
        default: return direction;   // the one-word values are spelled the same
    }
}


/** @internal */
export const PX_DOCUMENT_ATTR_NAME = 'data-px-document';

/** @internal */
export const PX_ANIM_ATTR_NAME = '_px_animator';

/** An interaction the trigger listens for (dev-docs/plans/component-api.md D5) — an OPEN list: a new
 *  interaction is a new member, never a new key. `load` is the document being ready (the visibility gate
 *  still decides whether it may run). @public */
export const PxTriggerEvent = {
    /** The document being ready — NOT "when the page loads": with the default gate it still waits until enough of it is
     *  on screen (`inViewThreshold`, half by default) and pauses while scrolled away (`actions.outOfView`). WHY `load`,
     *  not `ready`: the gate is a condition on EVERY driver, so `load` is the event as it is; `ready` would read as the
     *  gate's answer. */
    load:     'load',
    hoverIn:  'hoverIn',
    hoverOut: 'hoverOut',
    click:    'click',
    /** A button or a finger goes down on it (2026-11-15) — pressed states. */
    pointerDown: 'pointerDown',
    /** …and is released. */
    pointerUp:   'pointerUp',
    /** A key goes down — on the page, while the picture is in view and no text field has the focus; which key is said
     *  in the event's `with` (`{ "event": "keyDown", "with": { "key": "Enter" } }`). */
    keyDown:     'keyDown',
    /** …and comes up. */
    keyUp:       'keyUp',
} as const;

export type PxTriggerEvent = typeof PxTriggerEvent[keyof typeof PxTriggerEvent];

/** One entry of a trigger list: an event word (the whole picture), or an event object — the word plus where it is
 *  heard (`element` of the picture, `selector` of the page) and the event's own fields it must have (`with`). @public */
export type PxTriggerEventEntry = PxTriggerEvent | PxTriggerEventObject;

/** One entry, or several — the house style of `animate`'s references. @public */
export type PxTriggerEvents = PxTriggerEventEntry | Array<PxTriggerEventEntry>;

/** How a pointer event was made — the browser's `pointerType` (2026-11-15). @public */
export const PxPointerType = {
    mouse: 'mouse',
    touch: 'touch',
    pen:   'pen',
} as const;
export type PxPointerType = typeof PxPointerType[keyof typeof PxPointerType];

/** The segment actions (2026-11-15): go to the next segment in the list (after the last, the first), the previous one
 *  (before the first, the last), or a named one — {@link segmentGoToAction}. Each is a key of `actionTriggers` and a
 *  value a segment's `whenFinished` may hold; the same name is the page's call (`player.timeline.segment.next()`). @public */
export const PxSegmentAction = {
    next:     'timeline.segment.next',
    previous: 'timeline.segment.previous',
} as const;
export type PxSegmentAction = typeof PxSegmentAction[keyof typeof PxSegmentAction];

/** The action "go to the segment `name`" — `timeline.segment.goTo(name)`. A whole key, made from the segments' names
 *  and looked up as it is: nothing ever takes it apart. @public */
export function segmentGoToAction(name: string): string {
    return SEGMENT_GOTO_PREFIX + name + ')';
}
const SEGMENT_GOTO_PREFIX = 'timeline.segment.goTo(';

/** True for a key of the `timeline.segment.goTo(…)` family — recognised by its spelling, never taken apart (a name
 *  the timeline lacks is reported, see `segmentReferenceIssues`). @public @advanced */
export function isSegmentGoToAction(key: string): boolean {
    return key.startsWith(SEGMENT_GOTO_PREFIX) && key.endsWith(')');
}

/** How a segment is LEFT when another is asked for (2026-11-15): `jump` (default) — a cut; `animateToEnd` — this pass
 *  plays to its end first; `animateToStart` — it plays back to its start first. @public */
export const PxWhenLeaving = {
    jump:           'jump',
    animateToEnd:   'animateToEnd',
    animateToStart: 'animateToStart',
} as const;
export type PxWhenLeaving = typeof PxWhenLeaving[keyof typeof PxWhenLeaving];

/** THE BUILT-IN ACTION NAMES — the one place they are spelled. Each is a key of `animator.actionTriggers` (its trigger
 *  list) and, for the one with settings, of `timeline.actions` (playback-layers.md, layers 0–1): `"timeline.start"` /
 *  `"timeline.stop"` bracket a PLAYBACK, `"timeline.pause"` / `"timeline.resume"` a FREEZE inside it, and
 *  `"timeline.play"` is start-or-carry-on (resumes a pause, turns a return around, starts otherwise);
 *  `player.timeline.start()` … press them from code. A dot marks a built-in action, `<state variable>.<verb>`
 *  (dev-docs/plans/animation-state.playback-namespace.md §3): a custom action name (layer 2) has none, so the two can
 *  never collide. `startRun` … in 1.24; `timeline.play` since 1.26. Read and write the keys through these constants —
 *  `triggers[PxTriggerList.startPlayback]` — never a spelled-out string. @public @advanced */
export const PxTriggerList = {
    startPlayback:   'timeline.start',
    playPlayback:    'timeline.play',
    stopPlayback:    'timeline.stop',
    pausePlayback:   'timeline.pause',
    resumePlayback:  'timeline.resume',
} as const;

export type PxTriggerList = typeof PxTriggerList[keyof typeof PxTriggerList];

// @px-area control
/** The events a list may name — the schema is built from it, and an event outside it is dropped and warned:
 *   - `timeline.start` / `timeline.play`: load · hoverIn · click (starting when the pointer LEAVES makes no sense)
 *   - `timeline.stop`: hoverOut · click (stopping on load or when the pointer ARRIVES makes no sense)
 *   - `timeline.pause` / `timeline.resume`: hoverIn · hoverOut · click (a marquee pauses on hover in, a hover animation on hover out)
 *  @public @advanced */
export function allowedTriggerEvents(list: PxTriggerList): ReadonlyArray<PxTriggerEvent> {
    // the pointer and key events (2026-11-15) are aimed at something the reader acts on: every list may name them
    const pressed = [PxTriggerEvent.pointerDown, PxTriggerEvent.pointerUp, PxTriggerEvent.keyDown, PxTriggerEvent.keyUp];
    switch (list) {
        case PxTriggerList.startPlayback:
        case PxTriggerList.playPlayback: return [PxTriggerEvent.load, PxTriggerEvent.hoverIn, PxTriggerEvent.click, ...pressed];
        case PxTriggerList.stopPlayback: return [PxTriggerEvent.hoverOut, PxTriggerEvent.click, ...pressed];
        case PxTriggerList.pausePlayback:
        case PxTriggerList.resumePlayback: return [PxTriggerEvent.hoverIn, PxTriggerEvent.hoverOut, PxTriggerEvent.click, ...pressed];
    }
}

/** Every event — what a segment action may name (2026-11-15). @public @advanced */
export const PX_ALL_TRIGGER_EVENTS: ReadonlyArray<PxTriggerEvent> = [PxTriggerEvent.load, PxTriggerEvent.hoverIn, PxTriggerEvent.hoverOut,
    PxTriggerEvent.click, PxTriggerEvent.pointerDown, PxTriggerEvent.pointerUp, PxTriggerEvent.keyDown, PxTriggerEvent.keyUp];

// @px-area control
/** The event that undoes another — what resumes a pause: hoverIn ↔ hoverOut, click → click; `load` has none.
 *  @public @advanced */
export function counterpartTriggerEvent(event: PxTriggerEvent): PxTriggerEvent | undefined {
    switch (event) {
        case PxTriggerEvent.hoverIn: return PxTriggerEvent.hoverOut;
        case PxTriggerEvent.hoverOut: return PxTriggerEvent.hoverIn;
        case PxTriggerEvent.click: return PxTriggerEvent.click;
        case PxTriggerEvent.pointerDown: return PxTriggerEvent.pointerUp;
        case PxTriggerEvent.pointerUp: return PxTriggerEvent.pointerDown;
        case PxTriggerEvent.keyDown: return PxTriggerEvent.keyUp;
        case PxTriggerEvent.keyUp: return PxTriggerEvent.keyDown;
        case PxTriggerEvent.load: return undefined;
    }
}

/*
 * TWO KINDS OF WORDS (schema 1.26, dev-docs/plans/animation-state.feedback.2026-11-12.md):
 *   - STATE words change the playback state: `start` · `play` · `stop` · `pause` · `resume` (and the gate's `stop`).
 *   - MOVE words change only the picture — WHERE it goes and HOW:
 *
 *   | word                  | means                                                                     |
 *   |-----------------------|---------------------------------------------------------------------------|
 *   | `jumpToStart`         | at once to the idle pose (`whenIdle`: the file's static look, or the first frame) |
 *   | `animateToStart`      | plays backwards to the idle pose                                          |
 *   | `jumpToEnd`           | at once to the end of the pass (a one-shot: the playback's end)           |
 *   | `animateToEnd`        | plays on to the end of the pass                                           |
 *   | `animateToEndAndBack` | plays on to the end of the pass, then backwards to the idle pose          |
 *   | `hold`                | stays where it is                                                         |
 *
 * WHY these words (`reset` / `rewind` / `restart` / `completeIteration` until 1.22): one destination word and one manner
 * word say what a reader had to look up — "reset to where?", "rewind how?", "complete what?".
 *
 * THE PLAYBACK (schema 1.25; dev-docs/plans/animation-state.playback-noun.md): one instance of the animation being in
 * effect — it begins with `timeline.start` (always from the start) or `timeline.play`, lasts while `playing` · `paused`
 * · `finished`, and is retired by `timeline.stop`. `off` = no playback. Reaching the end makes it `finished` whatever
 * `whenFinished` then shows (1.26): the state and the picture are two different things.
 */

/** `actions["timeline.stop"]` (`behavior`) — where the playback's stop takes the picture and how: back to the rest pose at
 *  once (`jumpToStart`, the default) or playing backwards (`animateToStart`, the `returning` state); on to the end of the
 *  pass at once (`jumpToEnd`) or playing there (`animateToEnd` — "stop after this pass"), both rest `finished` and then
 *  `whenFinished` applies; or playing on to the end of the pass and then backwards to the rest pose
 *  (`animateToEndAndBack`, 1.26 — `completeIteration: true` with `rewind` until 1.22). @public */
export const PxStopPlaybackBehavior = {
    jumpToStart:         'jumpToStart',
    animateToStart:      'animateToStart',
    jumpToEnd:           'jumpToEnd',
    animateToEnd:        'animateToEnd',
    animateToEndAndBack: 'animateToEndAndBack',
} as const;

export type PxStopPlaybackBehavior = typeof PxStopPlaybackBehavior[keyof typeof PxStopPlaybackBehavior];

/** `timeline.whenFinished` — what the picture shows once the playback is `finished` (the natural end, or a stop that went
 *  there): the last frame (`hold`, the default), the rest pose at once (`jumpToStart`) or playing backwards to it
 *  (`animateToStart`). Only the picture moves: the playback stays `finished` until the next start or stop. A sensor's
 *  rule beside `whenIdle`, not an action: nobody presses it, the clock does. WHY the name (`atEnd` until 1.25,
 *  `actions.finish` until 1.23): it pairs with `whenIdle` and names the state it governs. @public */
export const PxWhenFinished = {
    hold:           'hold',
    jumpToStart:    'jumpToStart',
    animateToStart: 'animateToStart',
} as const;

export type PxWhenFinished = typeof PxWhenFinished[keyof typeof PxWhenFinished];

/** `actions.outOfView` (`behavior`) — what happens once none of the graphic is on screen (the visibility gate's closing
 *  edge; coming back into view is its partner). The gate presses the real buttons, so the state and the callbacks follow:
 *  `pause` (default) pauses a playing playback and resumes it when seen again; `continue` keeps it playing; `stop` stops
 *  it at once — no animated return, no finishing of the pass — and starts it again when seen. The gate only undoes what
 *  it did itself: a playback the page paused stays paused. WHY `outOfView`: it names the condition in the words
 *  `inViewThreshold` / `inViewDebounce` already use. (`jumpToStart` until 1.25, which held the clock without a stop.) @public */
export const PxOutOfViewBehavior = {
    pause:    'pause',
    continue: 'continue',
    stop:     'stop',
} as const;

export type PxOutOfViewBehavior = typeof PxOutOfViewBehavior[keyof typeof PxOutOfViewBehavior];

/** `timeline.whenIdle` — what is shown while there is no playback (`off`, {@link PxPlaybackState}): before the first playback,
 *  after a stop that went back to the start. `static` (default) = the SVG as it is in
 *  the file, no animation applied; `firstFrame` = the first frame's values (hand-authored files; the Editor never
 *  writes it — its static look IS the first frame). It is CSS's `animation-fill-mode` split in two: `whenIdle:
 *  'firstFrame'` = `backwards`, `whenFinished: 'hold'` = `forwards`, both = `both` ({@link fillModeOf}). WHY `whenIdle`:
 *  `idle` is WAAPI's word for exactly this state — `beforeStart` (until 1.14) read as the first start only,
 *  `showWhenStopped` (until 1.18) as played-then-stopped; the playback state reads `off` since 1.24, the key keeps its
 *  word. A paused animation shows its paused frame, a finished one its held frame. @public */
export const PxWhenIdle = {
    static:     'static',
    firstFrame: 'firstFrame',
} as const;

export type PxWhenIdle = typeof PxWhenIdle[keyof typeof PxWhenIdle];


/** `timeline.follows` (`type: 'scroll'`) — what the playhead follows. The `…DomElement` words follow where an element
 *  is on the screen; the `…Scroll` words follow how far something is scrolled. @public */
export const PxScrollFollows = {
    /** The animation itself, on its way across the screen (the default). */
    thisDomElement:  'thisDomElement',
    /** The element around it — the nearest one that really moves (sticky and fixed ancestors are skipped). */
    parentDomElement: 'parentDomElement',
    /** An element of the page, named by `selector`. */
    pageDomElement:  'pageDomElement',
    /** How far the page is scrolled. */
    pageScroll:      'pageScroll',
    /** How far the scrolling box around it is scrolled — or the box `selector` names. */
    containerScroll: 'containerScroll',
} as const;

export type PxScrollFollows = typeof PxScrollFollows[keyof typeof PxScrollFollows];

/** True for the `…DomElement` words — the playhead follows where an element is on the screen. @public @advanced */
export function followsElement(follows: PxScrollFollows | undefined): boolean {
    return follows !== PxScrollFollows.pageScroll && follows !== PxScrollFollows.containerScroll;
}

/** The seven moments of an element crossing the screen, in the order they happen while scrolling on — the same
 *  order for an element that fits the screen and for one taller than it. `fullyIn` is "all of it is in, or it fills
 *  the screen"; `startsToLeave` is "its first pixel goes out, or it stops filling the screen". @public */
export const PxScrollMoment = {
    appears:       'appears',
    halfIn:        'halfIn',
    fullyIn:       'fullyIn',
    centered:      'centered',
    startsToLeave: 'startsToLeave',
    halfOut:       'halfOut',
    gone:          'gone',
} as const;

export type PxScrollMoment = typeof PxScrollMoment[keyof typeof PxScrollMoment];

/** The seven moments in scroll order. @public @advanced */
export const PX_SCROLL_MOMENT_ORDER: ReadonlyArray<PxScrollMoment> = [PxScrollMoment.appears, PxScrollMoment.halfIn, PxScrollMoment.fullyIn,
    PxScrollMoment.centered, PxScrollMoment.startsToLeave, PxScrollMoment.halfOut, PxScrollMoment.gone];

/** `timeline.axis` — which way the scrolling goes. Absent = the way the page scrolls (its writing mode). @public */
export const PxScrollAxis = {
    vertical:   'vertical',
    horizontal: 'horizontal',
} as const;

export type PxScrollAxis = typeof PxScrollAxis[keyof typeof PxScrollAxis];

/** A named line across the element or the screen, for an exact place (`{ element, screen }`). `left` / `right` are
 *  the same lines as `top` / `bottom` when the axis is horizontal. A number 0–1 is a share from the start edge. @public */
export const PxScrollLine = {
    top:    'top',
    center: 'center',
    bottom: 'bottom',
    left:   'left',
    right:  'right',
} as const;

export type PxScrollLine = typeof PxScrollLine[keyof typeof PxScrollLine];

/** A line's share from the start edge: `top` / `left` 0, `center` 0.5, `bottom` / `right` 1; a number as it is. @public @advanced */
export function scrollLineShare(line: PxScrollLine | number | undefined, fallback: number): number {
    switch (line) {
        case PxScrollLine.top: case PxScrollLine.left: return 0;
        case PxScrollLine.center: return 0.5;
        case PxScrollLine.bottom: case PxScrollLine.right: return 1;
        default: return typeof line === 'number' && Number.isFinite(line) ? line : fallback;
    }
}

/** `timeline.holdOnScreen.at` — where the held element stays on the screen. @public */
export const PxHoldAt = {
    top:    'top',
    center: 'center',
    bottom: 'bottom',
} as const;

export type PxHoldAt = typeof PxHoldAt[keyof typeof PxHoldAt];

/** A CSS view-timeline range name — the browser's spelling of a stretch of an element's journey. @internal */
export type PxCssRangeName = 'cover' | 'entry' | 'exit' | 'entry-crossing' | 'exit-crossing';

/** A moment as the browser's range takes it: `{ name, fraction }`, or `undefined` when the browser cannot say it
 *  (an exact place on a line other than the screen's top or bottom — the player then measures by itself). The seven
 *  words adapt to the size exactly as CSS's names do. @internal */
export function cssRangeOfMoment(moment: PxScrollMomentSettings | undefined, fallback: PxScrollMoment): { name: PxCssRangeName; fraction: number } | undefined {
    const word = moment?.moment ?? (moment?.domElement === undefined && moment?.screen === undefined ? fallback : undefined);
    switch (word) {
        case PxScrollMoment.appears: return { name: 'cover', fraction: 0 };
        case PxScrollMoment.halfIn: return { name: 'entry', fraction: 0.5 };
        case PxScrollMoment.fullyIn: return { name: 'entry', fraction: 1 };
        case PxScrollMoment.centered: return { name: 'cover', fraction: 0.5 };
        case PxScrollMoment.startsToLeave: return { name: 'exit', fraction: 0 };
        case PxScrollMoment.halfOut: return { name: 'exit', fraction: 0.5 };
        case PxScrollMoment.gone: return { name: 'cover', fraction: 1 };
    }
    const screen = scrollLineShare(moment?.screen, 1);
    const element = clampShare(scrollLineShare(moment?.domElement, 0));
    if (screen === 1) return { name: 'entry-crossing', fraction: element };
    if (screen === 0) return { name: 'exit-crossing', fraction: element };
    return undefined;
}

/** A share kept inside 0–1 (the format's shares are 0–1; a value outside is a validation problem). @internal */
export function clampShare(share: number): number {
    return share < 0 ? 0 : share > 1 ? 1 : share;
}

/** One end of a scroll timeline's stretch in the RUNTIME VIEW — the settings form of the wire's word-or-object:
 *  `{ moment }` for a word, `{ domElement, screen }` for an exact place, `{ scrolled }` for a share of the scroll.
 *  @internal */
export interface PxScrollMomentSettings {
    moment?: PxScrollMoment;
    domElement?: PxScrollLine | number;
    screen?: PxScrollLine | number;
    scrolled?: number;
}

/** A scroll timeline's own settings in the RUNTIME VIEW (`animator.scroll` after `resolveAnimatorTimeline`): the
 *  wire's keys, with the two moments in their settings form and `holdOnScreen` spread into flat keys. @internal */
export interface PxScrollSettings {
    follows?: PxScrollFollows;
    selector?: string;
    axis?: PxScrollAxis;
    smoothing?: number;
    firstFrameWhen?: PxScrollMomentSettings;
    lastFrameWhen?: PxScrollMomentSettings;
    /** Held in place while it plays. */
    holdOnScreen?: boolean;
    holdAt?: PxHoldAt;
    holdForScreens?: number;
    holdOffset?: number;
}

/** `alongPathMode` — how a value is sampled along a motion path. @public */
export const PxAlongPathMode = {
    sampled:    'sampled',
    offsetPath: 'offsetPath',
} as const;

export type PxAlongPathMode = typeof PxAlongPathMode[keyof typeof PxAlongPathMode];

/** A compiled animation's `kind` — how its values are represented, blended and written. @public @advanced */
export const PxValueKind = {
    /** A number — opacity, r, stroke width, … (with an optional `unit`). */
    number: 'number',
    /** A 0..1 number written as a percentage — `offset-distance`. */
    percent: 'percent',
    /** RGBA 0..1 — fill, stroke, stop-color, … */
    color: 'color',
    /** Bezier paths — `d`. */
    path: 'path',
    /** A transform parts record — `transform` (a motion path keeps its tangents for the frame loop). */
    transform: 'transform',
    /** A number list — `stroke-dasharray`. */
    numberList: 'numberList',
    /** The per-part channels, written into `transform`. */
    translate: 'translate',
    scale: 'scale',
    rotate: 'rotate',
    skew: 'skew',
    /** Anything else (`url(#…)`, `none`, a string that is no number or colour): switches, never blends. */
    discrete: 'discrete',
} as const;

export type PxValueKind = typeof PxValueKind[keyof typeof PxValueKind];

/** WIRE `timeline.engine` — who runs the animation. `auto` (default) prefers the
 *  platform's animation API and falls back to JS when the document needs something it
 *  cannot express; `native` DEMANDS that API (WAAPI — and, for scroll/view timelines,
 *  the browser's ScrollTimeline) with no fallback; `js` pins the player's own frame loop
 *  and its own progress measurement. Const-namespace + matching string type so call
 *  sites use named members (`PxTimelineEngineSetting.js`), not bare literals.
 *
 *  NAMED `engine`, not `mode`: it selects HOW the animated attributes get updated, not
 *  WHAT you see — an implementation preference. (`native` is the one value that can also
 *  change the outcome: being a demand, an attribute WAAPI declines simply does not
 *  animate. See `isNativeForced`.) */
/** Timeline keys that BOTH union members carry, so they survive a change of `type`. */
export const PX_TIMELINE_SHARED_KEYS = ['inTime', 'outTime', 'iterations', 'engine'] as const;

/** Timeline keys that exist ONLY on the time-driven member — a scroll timeline is moved by the scrolling, so nothing
 *  starts it, nothing delays it, nothing remaps its pace, and no frame rate applies (a frame is drawn when it moves). */
export const PX_TIME_ONLY_TIMELINE_KEYS = ['actions', 'segments', 'delay', 'playbackSpeed', 'iterationDirection', 'whenIdle',
    'inViewThreshold', 'inViewDebounce', 'frameRate'] as const;

/**
 * The flat RUNTIME-VIEW keys — `duration`, `trigger`, `scroll`, … at the animator ROOT.
 *
 * They are the internal view the engines consume, never a wire spelling: on the wire playback
 * lives inside `timeline`. `getAnimatorConfig` drops them from a document, so a stray one is an
 * unknown key the diagnostic reports rather than a second spelling that quietly plays.
 */
export const PX_FLAT_RUNTIME_VIEW_KEYS: ReadonlyArray<string> = [
    ...PX_TIMELINE_SHARED_KEYS, ...PX_TIME_ONLY_TIMELINE_KEYS,
    'duration', 'fill', 'resetOnFinish', 'direction', 'timelineSource', 'scroll',
];
// `whenFinished` is a TIMELINE key copied to the view as it is, so it is not listed here

/**
 * THE ENGINES — the two things that can actually update an animated attribute: hand it to the
 * platform's animation API (`native`), or write it from the player's own frame loop (`js`).
 *
 * This is the CORE set. Code that always knows which engine is running takes this (e.g.
 * `normalizeBindings`'s `engine` arg gates motion-along-path materialization).
 * @public
 */
export const PxTimelineEngine = {
    native: 'native',
    js:     'js',
} as const;

export type PxTimelineEngine = typeof PxTimelineEngine[keyof typeof PxTimelineEngine];

/**
 * What `timeline.engine` ACCEPTS on the wire: the engines above plus `auto` — "you pick", which
 * prefers `native` and falls back to `js` per document when the platform API declines an
 * attribute.
 *
 * Built by ADDING to the core set rather than subtracting from a wider one, so the two cannot
 * drift: every engine is automatically an accepted value, and `auto` is visibly the one extra.
 *
 * WHY `native`, not `waapi`: the word is platform-neutral — the browser's Web Animations API on the web, the
 * platform's own driver elsewhere; React Native accepts the key and ignores it (it always compiles for its driver).
 * @public
 */
export const PxTimelineEngineSetting = {
    ...PxTimelineEngine,
    auto: 'auto',
} as const;

export type PxTimelineEngineSetting = typeof PxTimelineEngineSetting[keyof typeof PxTimelineEngineSetting];

// @px-area engine
/** What a requested engine resolves to BEFORE the runtime probes support: `js` pins the frame
 *  loop, anything else starts at `native`. NOTE this is only the STARTING point — `auto` still
 *  falls back to `js` per document when the platform API declines an attribute, which happens at
 *  bind time (see `PxAnimatorBind`), not here. * @public @advanced
 */
export function resolveTimelineEngine(engine: PxTimelineEngineSetting | undefined): PxTimelineEngine {
    return engine === PxTimelineEngineSetting.js ? PxTimelineEngine.js : PxTimelineEngine.native;
}

// @px-area engine
/** `native` is a demand, not a preference: no JS fallback when the platform API declines an attribute. @public @advanced */
export function isNativeForced(engine: PxTimelineEngineSetting | undefined): boolean {
    return engine === PxTimelineEngineSetting.native;
}

// @px-area engine
/** May the browser's ScrollTimeline/ViewTimeline drive a scroll/view timeline?
 *  `auto` tries it first (falling back to the player's own measurement), `native`
 *  asks for it, `js` never uses it. * @public @advanced
 */
export function mayUseNativeScrollTimeline(engine: PxTimelineEngineSetting | undefined): boolean {
    return engine !== PxTimelineEngineSetting.js;
}

/**
 * THE PLAYBACK DEFAULTS (playback-layers.md, layers 0–1) — what absent `actions` settings mean. One table,
 * stated by the schemas and applied by {@link resolveTriggers} / {@link resolveActions} / {@link resolveGate},
 * which every player calls — so a file behaves the same everywhere. No `start` row: an absent `actionTriggers`
 * block, like an empty one, names NO event (schema 1.17) — a file that plays by itself says `start: 'load'`.
 *   - stopPlayback `jumpToStart` · whenFinished `hold` — the two moves' presets
 *   - outOfView `pause` — an animation nobody can see does not run
 *   - `whenIdle` 'static' — idle, it shows the SVG as it is in the file
 *   - `inViewThreshold` 0.5 / `inViewDebounce` 150 — half of it on screen, that long, before it counts as seen
 * @public @advanced
 */
export const PX_PLAYBACK_DEFAULTS = {
    // no `timeline.start`: an absent `actionTriggers` block, like an empty one, names NO event — nothing plays until something
    // drives it; a file that plays by itself says `startPlayback: 'load'` (schema 1.17, dev-docs/reviews/schema-and-props--manual-review.md B2)
    stopPlaybackBehavior: 'jumpToStart',
    whenFinished: 'hold',
    outOfViewBehavior: 'pause',
    whenIdle: 'static',
    inViewThreshold: 0.5,
    inViewDebounce: 150,
} as const;

/** A file's `timeline.playbackSpeed` is usable when it is a positive finite number — 0 would stall the playback and a
 *  negative one reverse it (that is `iterationDirection`). The handle's `timeline.setSpeed()` accepts a negative value
 *  (play backwards); see `isValidPlaybackRate`. @public @advanced */
export function isWirePlaybackSpeed(speed: number): boolean {
    return Number.isFinite(speed) && speed > 0;
}

/**
 * What an absent content window means for the runtime view's `duration` — one pass of 1000 ms when the document has neither `outTime` nor keyframes, kept here as a constant for the runtime's arithmetic. @internal
 */
export const PX_DEFAULT_DURATION_MS = 1000;
/** What an absent `timeline.iterations` means — see `PX_DEFAULT_DURATION_MS`. @internal */
export const PX_DEFAULT_ITERATIONS = 1;
/** What an absent `unitsPerEm` of a glyph font means — see `PX_DEFAULT_DURATION_MS`. @internal */
export const PX_DEFAULT_UNITS_PER_EM = 1000;

/** The triggers with their lists normalised: every list an array of ALLOWED events, `timeline.resume` DERIVED unless the
 *  file names it ({@link derivedResume}); an absent block and an empty one are the same thing — nothing starts it
 *  (the manual document); a file that plays by itself names `startPlayback: 'load'`. @public @advanced */
export interface PxResolvedTriggers {
    // each list holds the entries' KEYS ({@link triggerKeyOf}): a bare word is its own key, so a list of words reads
    // as it always did; an event object's key names it among the lists, and `specs` says what it is
    readonly startPlayback: ReadonlyArray<string>;
    readonly playPlayback: ReadonlyArray<string>;
    readonly stopPlayback: ReadonlyArray<string>;
    readonly pausePlayback: ReadonlyArray<string>;
    readonly resumePlayback: ReadonlyArray<string>;
    /** The segment actions' entries — `next`, `previous` and one `goTo` per named segment (2026-11-15). */
    readonly segments: ReadonlyArray<PxSegmentTrigger>;
    /** Every key in the lists above → the entry in its settings form — what the wiring listens for. */
    readonly specs: ReadonlyMap<string, PxTriggerEventSpec>;
}

/** One entry of a trigger list in its settings form (2026-11-15) — what the wiring attaches a listener for. @public @advanced */
export interface PxTriggerEventSpec {
    /** Names the entry among the lists: the word alone for a bare word, else a stable spelling of all its fields. */
    readonly key: string;
    readonly event: PxTriggerEvent;
    /** One of this file's elements, `#id`. */
    readonly element?: string;
    /** An element of the page, a CSS selector. */
    readonly selector?: string;
    /** The event's own fields it must have. */
    readonly filter?: PxTriggerEventFilter;
}

/** What a segment trigger does (2026-11-15). @public @advanced */
export const PxSegmentTriggerKind = {
    next:     'next',
    previous: 'previous',
    goTo:     'goTo',
} as const;
export type PxSegmentTriggerKind = typeof PxSegmentTriggerKind[keyof typeof PxSegmentTriggerKind];

/** One segment action and the entries that press it. @public @advanced */
export interface PxSegmentTrigger {
    readonly kind: PxSegmentTriggerKind;
    /** The segment `goTo` goes to. */
    readonly segment?: string;
    readonly keys: ReadonlyArray<string>;
}

/** The built-in actions' settings with every default applied — see {@link resolveActions}; `whenFinished` is the
 *  timeline's own rule (a sensor's, not a button's) and is resolved beside them from `timeline.whenFinished`. The start
 *  has no settings since 1.26: it always plays from the start. @public @advanced */
export interface PxResolvedActions {
    readonly stopPlayback:   { readonly behavior: PxStopPlaybackBehavior };
    readonly outOfView: { readonly behavior: PxOutOfViewBehavior };
    readonly whenFinished: PxWhenFinished;
}

// ── CONTROL MODE (API review §1 / §7; `autoplay` → `playUsingActionTriggers` → `playerActionTriggers` (1.26) →
//    no prop at all: the file drives (2026-11-13)) ──
// Which set of props drives playback. Every component picked its own order, so
// `autoplay` + `showAtProgress={0.5}` played on React and Vue but seeked on React Native, and
// React let a REF choose the mode — `<SvgAnimationPlayer autoplay playerRef={api} />` never
// started, because the imperative branch replaced the trigger with an empty one.
//
// One order, decided once, used by web / react / vue / rn. This module owns the LOGIC and the
// WARNING TEXT only; each surface keeps its own `console.warn` wiring.

/** Which props drive playback. `playerRef` is deliberately NOT a mode: the handle is filled in
 *  every mode, so passing it alone leaves the document's own triggers in charge. * @public
 */
export const PxControlMode = {
    /** `showAsStatic` — the picture as drawn: no triggers, no scroll, every playback call ignored with a warning (PX1506). */
    static:    'static',
    /** `showAtProgress` / `showAtTime` — the host holds the frame; the component seeks and stays paused. */
    fixedTime: 'fixedTime',
    /** `playback` — the host holds the playback's position: `off` · `on` · `paused`. */
    playback:   'playback',
    /** `disableActionTriggers` (or `actionTriggers: null`) — nothing fires by itself; code presses the buttons. */
    manual:    'manual',
    /** No control prop (the default) — the document's `actionTriggers` drive it, or the `actionTriggers` block given instead. */
    actionTriggers: 'actionTriggers',
} as const;

export type PxControlMode = typeof PxControlMode[keyof typeof PxControlMode];

/**
 * The control props EVERY surface takes — the web player's options and the pre-rendered builds' too. Left out, all
 * three: the file's own `actionTriggers` drive it, the way the editor saved it. One at a time; a mix warns (PX1501).
 * @public
 */
export interface PxCommonControlProps {
    /**
     * The picture as drawn — nothing plays, whatever the file says: no triggers, no scroll, and every playback call
     * (`timeline.start()`, a seek, `timeline.setSpeed()`, …) is ignored with a warning (PX1506). The reads still answer.
     * Beats every other control prop.
     */
    showAsStatic?: boolean;
    /** Manual: the file's `actionTriggers` are switched off, so nothing starts it by itself — your code presses the
     *  buttons (`timeline.start()`, …). `actionTriggers: null` (or `{}`) says the same. */
    disableActionTriggers?: boolean;
    /**
     * The triggers to use INSTEAD of the file's `actionTriggers` — a REPLACEMENT of the whole block, as in the file:
     * lists left out are not listed, never the file's values (the lists belong together: switching `hoverIn` →
     * `click` wants other `pause` / `stop` lists too). `null` or `{}`: no triggers, the same as
     * `disableActionTriggers`. Left out: the file's own. (`playerActionTriggers` until 2026-11-13, which also took
     * `true` — now the default.)
     */
    actionTriggers?: PxActionTriggersInput | null;
}

/**
 * Every control prop, each optional and in any mix — what {@link resolveControlMode} reads, so a JavaScript caller's
 * conflicting set still gets its PX1501 warning. Components TYPE their props as {@link PxControlProps} (one family).
 * @public @advanced
 */
export interface PxAnyControlProps extends PxCommonControlProps {
    /**
     * SHOW one frame — nothing plays: the position counted in iterations, in the order they play — `0` the first frame,
     * `1` the end of the first iteration, `1.2` 20 % into the second (an `alternate` second pass runs backwards, so that
     * is the frame at 80 %). Clamped to `0 … iterations`; nothing wraps. The read twin is the handle's
     * `getCurrentProgress()`.
     */
    showAtProgress?: number;
    /** SHOW the frame at this time, ms into ONE iteration (0..duration). The read twin is `getCurrentTime()`. Ms like
     *  every time on this API (WAAPI's unit), so not `showAtMs`; `show…` because a driver is named by its verb — it
     *  shows a frame, it never plays. */
    showAtTime?: number;
    /** THE LEVER — the playback's position, held: `off` (no playback — a change to it presses `timeline.stop()`, a mount with it
     *  presses nothing), `on` (a playback: from `off` or `finished` `timeline.start()` — a one-shot plays to its end and rests
     *  there, the pose without motion is `showAtProgress={1}`; from `paused` `timeline.resume()`), `paused` (the playback frozen
     *  where it is: from `on` `timeline.pause()`; from `off` `timeline.start()` + `timeline.pause()` — the first frame, held). The two
     *  levers of the box (the playback on / off, the freeze on / off) folded into ONE word with no invalid pair: `paused`
     *  without a playback cannot be written. `play` because a driver prop starts with its verb (`play…` plays, `show…`
     *  shows a frame) — here the noun alone, since the noun is the media word (`playRun` in 1.24; `play` / `pause` /
     *  `playState` until 1.23). The readout is
     *  `timeline.getState()`: the request says `on`, the result says `playing` or `finished`. */
    playback?: PxPlayback;
    // TODO (dev-docs/plans/component-api.md D4): `playUsingScrollTimeline?: PxScrollTimeline` — the scroll driver, a
    // full scroll-driven timeline config, when scroll-driven playback lands. A driver is named by its verb: `play…`
    // when it plays, `show…` when it only shows a frame.
}

/** One driver family's props, every other control prop typed `never` — so two families do not compile together. */
type PxOnlyControlProps<K extends keyof PxAnyControlProps> =
    Pick<PxAnyControlProps, K> & { [P in Exclude<keyof PxAnyControlProps, K>]?: never };

/**
 * The control props every framework component takes — ONE driver family at a time, checked by TypeScript:
 * `showAsStatic` · `showAtProgress` · `showAtTime` · `playback` · `disableActionTriggers` · `actionTriggers`. None of
 * them: the file's own triggers drive it. Two families at once do not compile; a JavaScript caller gets the precedence
 * of {@link resolveControlMode} and a PX1501 warning.
 * ONE definition (review §9) — React, Vue and React Native take it, so the hover text is what their users see.
 * @public
 */
export type PxControlProps =
    | PxOnlyControlProps<'showAsStatic'>
    | PxOnlyControlProps<'showAtProgress'>
    | PxOnlyControlProps<'showAtTime'>
    | PxOnlyControlProps<'playback'>
    | PxOnlyControlProps<'disableActionTriggers'>
    | PxOnlyControlProps<'actionTriggers'>;

/** The positions of the `playback` prop — what a host can ASK for: `off` (no playback), `on` (a playback), `paused` (the playback
 *  frozen). The player's own readout, {@link PxPlaybackState}, says what it IS (`playing` or `finished` for `on`, plus the
 *  states it reaches by itself). @public */
export const PxPlayback = {
    off:    'off',
    on:     'on',
    paused: 'paused',
} as const;
export type PxPlayback = typeof PxPlayback[keyof typeof PxPlayback];

/** The chosen mode plus any conflict warnings — ready-made sentences, so three components
 *  cannot word the same conflict three ways. * @public
 */
export interface PxResolvedControlMode {
    readonly mode: PxControlMode;
    readonly warnings: ReadonlyArray<string>;
}

/** One rung of the precedence ladder: the prop names a warning uses, whether they were given, the mode they pick. */
interface PxControlTier {
    readonly name: string;
    readonly given: boolean;
    readonly mode: PxControlMode;
}

/** An `actionTriggers` value that IS a block — `null` (no triggers) and `undefined` (the file's own) are not. */
function isActionTriggersBlock(value: PxActionTriggersInput | null | undefined): value is PxActionTriggersInput {
    return typeof value === 'object' && value !== null;
}

// @px-area control
/**
 * Picks the control mode from the props (or the web player's options) given.
 *
 * PRECEDENCE, most specific first:
 *   1. `showAsStatic` — the picture as drawn; nothing may move it
 *   2. `showAtProgress` / `showAtTime` — an explicit position is the most precise instruction there is
 *   3. `playback` — the playback's position, held by the host
 *   4. `disableActionTriggers` (or `actionTriggers: null`) — manual: code presses the buttons
 *   5. otherwise `actionTriggers` — the file's own triggers, or the block given instead
 *
 * `playerRef` is absent on purpose. A ref is a handle, not an instruction: it is populated in
 * every mode, so a bare component + `playerRef` plays as the file says AND gives you the handle.
 *
 * A warning is produced only when props from two different tiers are set together — the
 * lower tier is then ignored, and silence about that is what made this hard to debug.
 * @public
 */
export function resolveControlMode(props: PxAnyControlProps): PxResolvedControlMode {
    const warnings: Array<string> = [];
    const named = (a: string, b: string, winner: string): string =>
        a + ' and ' + b + ' were both set — ' + winner + ' wins, ' + (winner === a ? b : a) + ' is ignored.';
    if (props.showAtProgress !== undefined && props.showAtTime !== undefined) warnings.push(named('showAtProgress', 'showAtTime', 'showAtProgress'));

    const tiers: ReadonlyArray<PxControlTier> = [
        { name: 'showAsStatic', given: !!props.showAsStatic, mode: PxControlMode.static },
        { name: 'showAtProgress/showAtTime', given: props.showAtProgress !== undefined || props.showAtTime !== undefined, mode: PxControlMode.fixedTime },
        { name: 'playback', given: props.playback !== undefined, mode: PxControlMode.playback },
        { name: props.disableActionTriggers ? 'disableActionTriggers' : 'actionTriggers', given: !!props.disableActionTriggers || props.actionTriggers === null, mode: PxControlMode.manual },
        { name: 'actionTriggers', given: isActionTriggersBlock(props.actionTriggers), mode: PxControlMode.actionTriggers },
    ];
    const winner = tiers.find(t => t.given);
    if (!winner) return { mode: PxControlMode.actionTriggers, warnings };
    for (const tier of tiers) {
        if (tier !== winner && tier.given) warnings.push(named(winner.name, tier.name, winner.name));
    }
    return { mode: winner.mode, warnings };
}

// @px-area control
/**
 * True when the surface must take the document's triggers over — replaced by an EMPTY block
 * (`withoutTriggerDriver`), so nothing starts the animation by itself.
 *
 * Every mode except `actionTriggers` — the default, the one mode that says "let the triggers decide" (the file's, or
 * the block given). `static` takes them over too, and more: see `withStaticPicture`.
 * @public
 */
export function controlModeTakesOverTrigger(mode: PxControlMode): boolean {
    return mode !== PxControlMode.actionTriggers;
}

// @px-area control
/** One entry or several, as an array. @public @advanced */
export function triggerEventList(events: PxTriggerEvents | undefined): ReadonlyArray<PxTriggerEventEntry> {
    return events === undefined ? [] : Array.isArray(events) ? events : [events];
}

/** The word of an entry. @public @advanced */
export function triggerEventOf(entry: PxTriggerEventEntry): PxTriggerEvent {
    return typeof entry === 'string' ? entry : entry.event;
}

/** The filter's fields in a fixed order, as one spelling — part of an entry's key. Each field read by its name. */
function filterKeyOf(filter: PxTriggerEventFilter | undefined): string {
    if (!filter) return '';
    const parts: Array<string> = [];
    const add = (name: string, value: string | number | boolean | undefined): void => { if (value !== undefined) parts.push(name + '=' + String(value)); };
    add('key', filter.key); add('code', filter.code); add('ctrlKey', filter.ctrlKey); add('shiftKey', filter.shiftKey);
    add('altKey', filter.altKey); add('metaKey', filter.metaKey); add('metaOrCtrlKey', filter.metaOrCtrlKey);
    add('button', filter.button); add('pointerType', filter.pointerType);
    return parts.join(';');
}

/** An entry's key — see {@link PxTriggerEventSpec.key}. @public @advanced */
export function triggerKeyOf(entry: PxTriggerEventEntry): string {
    return triggerSpecOf(entry).key;
}

/** An entry in its settings form. @public @advanced */
export function triggerSpecOf(entry: PxTriggerEventEntry): PxTriggerEventSpec {
    if (typeof entry === 'string') return { key: entry, event: entry };
    const filter = filterKeyOf(entry.with);
    const plain = entry.element === undefined && entry.selector === undefined && filter === '';
    const key = plain ? entry.event : [entry.event, entry.element ?? '', entry.selector ?? '', filter].join('|');
    const spec: { -readonly [K in keyof PxTriggerEventSpec]: PxTriggerEventSpec[K] } = { key, event: entry.event };
    if (entry.element !== undefined) spec.element = entry.element;
    if (entry.selector !== undefined) spec.selector = entry.selector;
    if (entry.with !== undefined && filter !== '') spec.filter = entry.with;
    return spec;
}

/** The spec with its word swapped for its counterpart (hoverIn ↔ hoverOut, pointerDown ↔ pointerUp, …), or undefined. */
function counterpartSpecOf(spec: PxTriggerEventSpec): PxTriggerEventSpec | undefined {
    const event = counterpartTriggerEvent(spec.event);
    if (event === undefined) return undefined;
    return triggerSpecOf({ event, element: spec.element, selector: spec.selector, with: spec.filter });
}

/** A list's entries that the list may name ({@link allowedTriggerEvents}) — the others are dropped — as keys, each
 *  entry's spec recorded in `specs`. */
function allowedKeysOf(allowed: ReadonlyArray<PxTriggerEvent>, events: PxTriggerEvents | undefined,
    specs: Map<string, PxTriggerEventSpec>): ReadonlyArray<string> {
    const keys: Array<string> = [];
    for (const entry of triggerEventList(events)) {
        if (!allowed.includes(triggerEventOf(entry))) continue;
        const spec = triggerSpecOf(entry);
        specs.set(spec.key, spec);
        if (!keys.includes(spec.key)) keys.push(spec.key);
    }
    return keys;
}

/** `list` plus the keys of `more` it does not name yet. */
function unionKeys(list: ReadonlyArray<string>, more: ReadonlyArray<string>): ReadonlyArray<string> {
    return more.length === 0 ? list : [...list, ...more.filter(e => !list.includes(e))];
}

// @px-area control
/** What resumes a paused playback (`timeline.resume`) — derived, never configured for the built-in events: the counterpart of
 *  each `timeline.pause` entry (hoverIn ↔ hoverOut, click → click, pointerDown ↔ pointerUp, keyDown ↔ keyUp — at the same
 *  place, with the same fields), plus the `timeline.start` entries that do not also STOP it. Keys in, keys out; `specs`
 *  (absent: bare words only) says what an entry is and receives the counterparts. @public @advanced */
export function derivedResume(startPlayback: ReadonlyArray<string>, stopPlayback: ReadonlyArray<string>,
    pausePlayback: ReadonlyArray<string>, specs?: Map<string, PxTriggerEventSpec>): ReadonlyArray<string> {
    const counterparts: Array<string> = [];
    for (const key of pausePlayback) {
        const spec = specs?.get(key) ?? (isTriggerEvent(key) ? triggerSpecOf(key) : undefined);
        const counterpart = spec ? counterpartSpecOf(spec) : undefined;
        if (counterpart === undefined) continue;
        specs?.set(counterpart.key, counterpart);
        if (!counterparts.includes(counterpart.key)) counterparts.push(counterpart.key);
    }
    return unionKeys(counterparts, startPlayback.filter(e => !stopPlayback.includes(e)));
}

/** One entry or several, checked — what an open key of `actionTriggers` (a segment's `goTo`) holds. @public @advanced */
export function isTriggerEvents(value: unknown): value is PxTriggerEvents {
    const entry = (v: unknown): boolean => typeof v === 'string' ? isTriggerEvent(v)
        : typeof v === 'object' && v !== null && !Array.isArray(v) && 'event' in v && typeof v.event === 'string' && isTriggerEvent(v.event);
    return Array.isArray(value) ? value.every(entry) : entry(value);
}

/** A bare event word. */
function isTriggerEvent(value: string): value is PxTriggerEvent {
    return (PX_ALL_TRIGGER_EVENTS as ReadonlyArray<string>).includes(value);
}

// @px-area control
/** A document's triggers with the lists normalised — see {@link PxResolvedTriggers}. Entries a list may not name are
 *  dropped ({@link triggerIssues} says which). `timeline.resume` is {@link derivedResume} unless the file names the list —
 *  then the file's list is used as written. `segmentNames`: the timeline's segments, in list order — their `goTo` keys are
 *  looked up by name (a key naming no segment is not read; `validateDocument` warns). @public @advanced */
export function resolveTriggers(triggers: PxActionTriggers | undefined, segmentNames: ReadonlyArray<string> = []): PxResolvedTriggers {
    const specs = new Map<string, PxTriggerEventSpec>();
    if (triggers === undefined) return { startPlayback: [], playPlayback: [], stopPlayback: [], pausePlayback: [], resumePlayback: [], segments: [], specs };
    const listOf = (list: PxTriggerList): ReadonlyArray<string> => allowedKeysOf(allowedTriggerEvents(list), triggers[list], specs);
    const startPlayback = listOf(PxTriggerList.startPlayback);
    const playPlayback = listOf(PxTriggerList.playPlayback);
    const stopPlayback = listOf(PxTriggerList.stopPlayback);
    const pausePlayback = listOf(PxTriggerList.pausePlayback);
    const resumePlayback = triggers[PxTriggerList.resumePlayback] !== undefined ? listOf(PxTriggerList.resumePlayback)
        : derivedResume(startPlayback, stopPlayback, pausePlayback, specs);
    const segments: Array<PxSegmentTrigger> = [];
    const segmentList = (kind: PxSegmentTriggerKind, action: string, segment?: string): void => {
        const value: unknown = triggers[action];
        const keys = allowedKeysOf(PX_ALL_TRIGGER_EVENTS, isTriggerEvents(value) ? value : undefined, specs);
        if (keys.length) segments.push(segment === undefined ? { kind, keys } : { kind, segment, keys });
    };
    if (segmentNames.length) {
        segmentList(PxSegmentTriggerKind.next, PxSegmentAction.next);
        segmentList(PxSegmentTriggerKind.previous, PxSegmentAction.previous);
        for (const name of segmentNames) segmentList(PxSegmentTriggerKind.goTo, segmentGoToAction(name), name);
    }
    return { startPlayback, playPlayback, stopPlayback, pausePlayback, resumePlayback, segments, specs };
}

/** What {@link triggerIssues} reports. @public @advanced */
export const PxTriggerIssueKind = {
    /** The list may not name the event ({@link allowedTriggerEvents}) — it is dropped. */
    eventNotAllowed: 'eventNotAllowed',
    /** Two lists react to the event in the same state: `timeline.stop` with `timeline.pause` (playing — the pause wins),
     *  `timeline.stop` with a pause's counterpart (paused — the resume wins), or `timeline.start` with `timeline.play`
     *  (off — the start wins). The file should name one. */
    collision:       'collision',
    /** The file's `timeline.resume` list names an event the derivation would not (no `timeline.pause` event's counterpart, no
     *  `timeline.start` event that does not stop) — honoured as written, noted so a surprising resume is no mystery. */
    resumeExtra:     'resumeExtra',
    /** The file's `timeline.resume` list leaves out an event the derivation would name — a `timeline.pause` event whose
     *  counterpart no longer resumes it (that pause then waits for `timeline.start` or `timeline.stop`). Honoured as written. */
    resumeMissing:   'resumeMissing',
} as const;

export type PxTriggerIssueKind = typeof PxTriggerIssueKind[keyof typeof PxTriggerIssueKind];

/** One problem with a triggers block — structured, so a caller decides on `kind`, never on text. @public @advanced */
export interface PxTriggerIssue {
    readonly kind: PxTriggerIssueKind;
    /** The list that names the event (`timeline.stop` for a collision). */
    readonly list: PxTriggerList;
    /** The entry's key ({@link triggerKeyOf}) — the bare word for a word. */
    readonly event: string;
    /** A collision's other list — `timeline.pause`, `timeline.resume` or `timeline.play`. */
    readonly otherList?: PxTriggerList;
}

// @px-area control
/** Every problem with a triggers block, for the players to warn about and the Editor to show — see
 *  {@link PxTriggerIssueKind}. An empty array is a clean block. @public @advanced */
export function triggerIssues(triggers: PxActionTriggers | undefined): Array<PxTriggerIssue> {
    if (triggers === undefined) return [];
    const issues: Array<PxTriggerIssue> = [];
    const lists: ReadonlyArray<[PxTriggerList, PxTriggerEvents | undefined]> = [
        [PxTriggerList.startPlayback, triggers[PxTriggerList.startPlayback]], [PxTriggerList.playPlayback, triggers[PxTriggerList.playPlayback]],
        [PxTriggerList.stopPlayback, triggers[PxTriggerList.stopPlayback]],
        [PxTriggerList.pausePlayback, triggers[PxTriggerList.pausePlayback]], [PxTriggerList.resumePlayback, triggers[PxTriggerList.resumePlayback]],
    ];
    for (const [list, events] of lists) {
        const allowed = allowedTriggerEvents(list);
        for (const entry of triggerEventList(events)) {
            if (!allowed.includes(triggerEventOf(entry))) issues.push({ kind: PxTriggerIssueKind.eventNotAllowed, list, event: triggerKeyOf(entry) });
        }
    }
    const resolved = resolveTriggers(triggers);
    if (triggers[PxTriggerList.resumePlayback] !== undefined) {
        // only the events a resume list may name count — `load` is derived (a start that does not stop) but never listable
        const resumable = allowedTriggerEvents(PxTriggerList.resumePlayback);
        const specs = new Map(resolved.specs);
        const derived = derivedResume(resolved.startPlayback, resolved.stopPlayback, resolved.pausePlayback, specs)
            .filter(e => { const spec = specs.get(e); return spec !== undefined && resumable.includes(spec.event); });
        for (const event of resolved.resumePlayback) {
            if (!derived.includes(event)) issues.push({ kind: PxTriggerIssueKind.resumeExtra, list: PxTriggerList.resumePlayback, event });
        }
        for (const event of derived) {
            if (!resolved.resumePlayback.includes(event)) issues.push({ kind: PxTriggerIssueKind.resumeMissing, list: PxTriggerList.resumePlayback, event });
        }
    }
    const counterparts = derivedResume([], [], resolved.pausePlayback, new Map(resolved.specs));
    for (const event of resolved.stopPlayback) {
        if (resolved.pausePlayback.includes(event)) issues.push({ kind: PxTriggerIssueKind.collision, list: PxTriggerList.stopPlayback, event, otherList: PxTriggerList.pausePlayback });
        if (counterparts.includes(event)) issues.push({ kind: PxTriggerIssueKind.collision, list: PxTriggerList.stopPlayback, event, otherList: PxTriggerList.resumePlayback });
    }
    for (const event of resolved.startPlayback) {
        if (resolved.playPlayback.includes(event)) issues.push({ kind: PxTriggerIssueKind.collision, list: PxTriggerList.startPlayback, event, otherList: PxTriggerList.playPlayback });
    }
    return issues;
}

// @px-area control
/** An action slot's settings: the word form (`'animateToStart'`) is exactly `{ behavior: 'animateToStart' }`; an absent slot stays absent.
 *  The one reader of the shorthand — every consumer goes through it (or {@link resolveActions}). @public @advanced */
export function actionSettingsOf(slot: PxActions[typeof PxTriggerList.stopPlayback]): { behavior?: PxStopPlaybackBehavior } | undefined;
export function actionSettingsOf(slot: PxActions['outOfView']): { behavior?: PxOutOfViewBehavior } | undefined;
export function actionSettingsOf(slot: string | { behavior?: string } | undefined): { behavior?: string } | undefined {
    return typeof slot === 'string' ? { behavior: slot } : slot;
}

// @px-area control
/** A document's `actions` (and its `whenFinished`) with every default applied — see {@link PxResolvedActions}. @public @advanced */
export function resolveActions(actions: PxActions | undefined, whenFinished?: PxWhenFinished): PxResolvedActions {
    const stopPlayback = actionSettingsOf(actions?.[PxTriggerList.stopPlayback]);
    const outOfView = actionSettingsOf(actions?.outOfView);
    return {
        stopPlayback:   { behavior: stopPlayback?.behavior ?? PX_PLAYBACK_DEFAULTS.stopPlaybackBehavior },
        outOfView: { behavior: outOfView?.behavior ?? PX_PLAYBACK_DEFAULTS.outOfViewBehavior },
        whenFinished: whenFinished ?? PX_PLAYBACK_DEFAULTS.whenFinished,
    };
}

/** The visibility gate with its defaults applied: how `outOfView` reacts (`actions.outOfView`) and when
 *  the view sensor counts the graphic as seen (the two timeline numbers). Read from the runtime view by every
 *  player. @public @advanced */
export interface PxResolvedGate {
    readonly outOfView: PxOutOfViewBehavior;
    readonly inViewThreshold: number;
    readonly inViewDebounce: number;
}

// @px-area control
/** The gate of a runtime view, defaulted — see {@link PxResolvedGate}. @public @advanced */
export function resolveGate(cfg: Pick<PxAnimatorRuntimeConfig, 'actions' | 'inViewThreshold' | 'inViewDebounce'> | undefined): PxResolvedGate {
    return {
        outOfView: actionSettingsOf(cfg?.actions?.outOfView)?.behavior ?? PX_PLAYBACK_DEFAULTS.outOfViewBehavior,
        inViewThreshold: cfg?.inViewThreshold ?? PX_PLAYBACK_DEFAULTS.inViewThreshold,
        inViewDebounce: cfg?.inViewDebounce ?? PX_PLAYBACK_DEFAULTS.inViewDebounce,
    };
}

/** The playback's state — the one readout (`timeline.getState()`): `off` = no playback (before the first, back at the rest pose
 *  after a stop; WAAPI's `idle`, `idle` here until 1.23); `playing` · `paused` · `finished` = a playback (`finished` reached
 *  its end — whatever `whenFinished` then shows, 1.26 — until the next start or stop; `paused` also after a seek that was
 *  not made while playing); `returning` = no playback, but the picture still plays back to the rest pose (a stop with
 *  `animateToStart` — SVGator's `rollback`); `scrubbing` = a scroll timeline, always: the scrolling moves the playhead, so
 *  it never starts, pauses or finishes; `destroyed` = after `destroy()`, every call a no-op. Which button an event
 *  presses in each state: {@link triggerActionFor}. @public @advanced */
export const PxPlaybackState = {
    off:       'off',
    playing:   'playing',
    paused:    'paused',
    finished:  'finished',
    returning: 'returning',
    scrubbing: 'scrubbing',
    destroyed: 'destroyed',
} as const;
export type PxPlaybackState = typeof PxPlaybackState[keyof typeof PxPlaybackState];

/** What the state rule asks for when an event arrives — one of the five buttons. @public @advanced */
export const PxTriggerAction = {
    startPlayback:  PxTriggerList.startPlayback,
    playPlayback:   PxTriggerList.playPlayback,
    stopPlayback:   PxTriggerList.stopPlayback,
    pausePlayback:  PxTriggerList.pausePlayback,
    resumePlayback: PxTriggerList.resumePlayback,
} as const;
export type PxTriggerAction = typeof PxTriggerAction[keyof typeof PxTriggerAction];

// @px-area control
/** Whether any of the five lists names the event — the wiring listens only for those. @public @advanced */
export function triggerListsEvent(triggers: PxResolvedTriggers, event: string): boolean {
    return triggers.startPlayback.includes(event) || triggers.playPlayback.includes(event) || triggers.stopPlayback.includes(event)
        || triggers.pausePlayback.includes(event) || triggers.resumePlayback.includes(event)
        || triggers.segments.some(s => s.keys.includes(event));
}

// @px-area control
/** Every key the lists and the segment actions name — what the wiring listens for, each once. @public @advanced */
export function triggerKeys(triggers: PxResolvedTriggers): ReadonlyArray<string> {
    const keys: Array<string> = [];
    const add = (list: ReadonlyArray<string>): void => { for (const k of list) if (!keys.includes(k)) keys.push(k); };
    add(triggers.startPlayback); add(triggers.playPlayback); add(triggers.stopPlayback); add(triggers.pausePlayback); add(triggers.resumePlayback);
    for (const s of triggers.segments) add(s.keys);
    return keys;
}

// @px-area control
/** One resolved list, by the button it presses. */
function triggerListOf(triggers: PxResolvedTriggers, action: PxTriggerAction): ReadonlyArray<string> {
    switch (action) {
        case PxTriggerAction.startPlayback: return triggers.startPlayback;
        case PxTriggerAction.playPlayback: return triggers.playPlayback;
        case PxTriggerAction.stopPlayback: return triggers.stopPlayback;
        case PxTriggerAction.pausePlayback: return triggers.pausePlayback;
        case PxTriggerAction.resumePlayback: return triggers.resumePlayback;
    }
}

// @px-area control
/** THE STATE RULE, decided once for every wiring — the web triggers, the CSS components, React Native (1.26): the
 *  player's state picks the lists an event is read from, in order, and the first list that names it wins.
 *
 *  | state       | lists, first match wins                                                   |
 *  |-------------|---------------------------------------------------------------------------|
 *  | `playing`   | pause · stop · start (a play has nothing to do)                           |
 *  | `paused`    | resume · play · stop · start                                              |
 *  | `off`       | start · play                                                              |
 *  | `returning` | start (from the start) · play (turns around)                              |
 *  | `finished`  | last frame held: stop · start · play; otherwise start · play · stop       |
 *
 *  `timeline.start` restarts in every state it is read in. A finished playback that still shows its last frame is undone
 *  by an event in both `start` and `stop` (a click toggle); one whose picture went back (`whenFinished`) plays again.
 *  The collisions a file can make are reported by {@link triggerIssues}. @public @advanced */
export function triggerActionFor(triggers: PxResolvedTriggers, state: PxPlaybackState, event: string, whenFinished: PxWhenFinished): PxTriggerAction | undefined {
    const first = (...actions: Array<PxTriggerAction>): PxTriggerAction | undefined => actions.find(a => triggerListOf(triggers, a).includes(event));
    const { startPlayback: start, playPlayback: play, stopPlayback: stop, pausePlayback: pause, resumePlayback: resume } = PxTriggerAction;
    switch (state) {
        case PxPlaybackState.playing: return first(pause, stop, start);
        case PxPlaybackState.paused: return first(resume, play, stop, start);
        case PxPlaybackState.off:
        case PxPlaybackState.returning: return first(start, play);
        case PxPlaybackState.finished: return whenFinished === PxWhenFinished.hold ? first(stop, start, play) : first(start, play, stop);
        case PxPlaybackState.destroyed: return undefined;
    }
}

// V3 — every closed value list is a NAMED const + a strict `px.enum` slot, so a
// typo is a schema ERROR instead of silently shipping. Plain `px.string()` stays
// ONLY where SVG itself is open-ended (`gradientTransform`, `viewBox`, `path` d,
// ids/refs).

/** `loop.repeatAt` — WHICH END of the keyframe sequence the repeated segment is taken
 *  from, and therefore which side of the timeline the repetition fills. A named
 *  two-way selector (not a boolean) so a third value stays possible. * @public
 */
export const PxLoopRepeatAt = {
    /** Segment from the START; the repetition runs BEFORE the first keyframe
     *  (intro loops that play until the main timeline begins). */
    start: 'start',
    /** DEFAULT — segment from the END; the repetition runs AFTER the last keyframe
     *  (idle/outro loops that continue once the main timeline has finished). */
    end: 'end',
} as const;

export type PxLoopRepeatAt = typeof PxLoopRepeatAt[keyof typeof PxLoopRepeatAt];

/** `loop.direction` — how successive repetitions play, spelled like the timeline's
 *  own `direction` so the two read as one idea. * @public
 */
export const PxLoopDirection = {
    /** DEFAULT — cycle: every repetition replays the segment the same way round. */
    normal: 'normal',
    /** Ping-pong: repetitions alternate forward / backward. */
    alternate: 'alternate',
} as const;

export type PxLoopDirection = typeof PxLoopDirection[keyof typeof PxLoopDirection];

/** SVG `mask-type` — how the mask source's pixels become alpha. @public */
export const PxMaskType = {
    luminance: 'luminance',
    alpha:     'alpha',
} as const;

export type PxMaskType = typeof PxMaskType[keyof typeof PxMaskType];

/** SVG coordinate system for `maskUnits` / `maskContentUnits` (and the gradient twin below). @public */
export const PxUnits = {
    userSpaceOnUse:    'userSpaceOnUse',
    objectBoundingBox: 'objectBoundingBox',
} as const;

export type PxUnits = typeof PxUnits[keyof typeof PxUnits];

/** `clone.omit` — which part of the SOURCE'S OWN transform a `<use>` clone leaves out. Absent = the whole element, as
 *  SVG `<use>` (a direct link, moves with the source); `translate` = the source's placement is dropped, so the clone
 *  stays where the `<use>` put it but still rotates/scales with the source. A future value `transform` may drop the
 *  whole transform (content only) — not implemented yet. The wire is subtractive because the mechanism is a ladder —
 *  the `<use>` can only point at one wrapper layer of the source (was `clone.type: 'content'` once). WHY `omit`
 *  (`without` until 1.19): TypeScript's `Omit<T, K>` and lodash's `_.omit` mean exactly this — a copy of something
 *  without these keys — and it grows into a list if the ladder ever needs two rungs at once. @public */
export const PxCloneOmit = {
    translate: 'translate',
    // transform: 'transform',   // future: drop rotate/scale too (content only)
} as const;

export type PxCloneOmit = typeof PxCloneOmit[keyof typeof PxCloneOmit];

/** `textPath.pathOverflow` — glyphs past the path end: hide them, or keep laying
 *  them along the tangent extension. * @public
 */
export const PxPathOverflow = {
    clip:   'clip',
    extend: 'extend',
} as const;

export type PxPathOverflow = typeof PxPathOverflow[keyof typeof PxPathOverflow];

/** SVG `lengthAdjust` — what `textLength` stretches. @public */
export const PxLengthAdjust = {
    spacing:          'spacing',
    spacingAndGlyphs: 'spacingAndGlyphs',
} as const;

export type PxLengthAdjust = typeof PxLengthAdjust[keyof typeof PxLengthAdjust];

/** SVG `<textPath method>` — how glyphs follow curvature. @public */
export const PxTextPathMethod = {
    align:   'align',
    stretch: 'stretch',
} as const;

export type PxTextPathMethod = typeof PxTextPathMethod[keyof typeof PxTextPathMethod];

/** SVG `<textPath spacing>` — whether the renderer may adjust spacing. @public */
export const PxTextPathSpacing = {
    auto:  'auto',
    exact: 'exact',
} as const;

export type PxTextPathSpacing = typeof PxTextPathSpacing[keyof typeof PxTextPathSpacing];

/** `strokeTrim.subPaths` — what the 0..1 `range`/`offset` window is measured over.
 *  `separate` (default): each sub-path against its OWN length, all trimmed alike.
 *  `combined`: every descendant sub-path chained end-to-end into one virtual path,
 *  so the window slides across siblings (AE "Trim All As One"). * @public
 */
export const PxStrokeTrimSubPaths = {
    separate: 'separate',
    combined: 'combined',
} as const;

export type PxStrokeTrimSubPaths = typeof PxStrokeTrimSubPaths[keyof typeof PxStrokeTrimSubPaths];


// S8: `textContent` is the ONE text-content key (the DOM property name). `text` is not a wire
// key: it was triply overloaded (the `text` tag, the `effects.text` group, and a content alias)
// and no reader accepts it.
/** @internal */
export const PX_TEXT_CONTENT_ATTR = 'textContent';

/** The DOM `class` attribute. A name we EMIT but do not own, so it is written through this
 *  constant rather than as an identifier — every other emitted attribute name reaches the
 *  DOM as a string, and `class` was the one exception, which is why the minifier renamed it
 *  to `ct` in the shipped bundles (dev-docs/plans/minification-boundary.md §1.1). */
export const CLASS_ATTR = 'class';

/** The DOM `transform` attribute, and the key the animation record uses for it. Both are
 *  DATA names — a dictionary key, not a field of one of our typed structures — so they are
 *  written as constants rather than as identifiers. */
export const TRANSFORM_ATTR = 'transform';

/** `animate.offsetDistance` — the CSS Motion Path channel the offset-path materializer writes. */
export const OFFSET_DISTANCE_ATTR = 'offsetDistance';

// Wire keys that are NEVER DOM attributes (internal use only).
//
// `effects` is here for safety rather than necessity: `materializeNodeEffects` deletes it at
// load, so today nothing reaches the renderer with it still attached. That is a property
// of the pipeline, though, not of the contract — an effect path that returns early, or a
// document carrying an effect key the pipeline does not recognize, would otherwise leave
// the object behind and the renderer would write `effects="[object Object]"` with no error
// anywhere. Listing it makes the invariant structural (J4).
/**
 * WIRE `definitions.variables.<name>.type` — what kind of value a variable holds (docs/library/variables.md). The value grammars the format already has, under the same spellings:
 * `number` 40 · `vector` [200, 60] · `color` "#2a7fff" · `string` "Hello" · `boolean` true · `image` a URL or data URL ·
 * `numberList` [16, 16] · `path` "M0 0L…". @public
 */
export const PxVariableType = {
    number:     'number',
    vector:     'vector',
    color:      'color',
    string:     'string',
    boolean:    'boolean',
    image:      'image',
    numberList: 'numberList',
    path:       'path',
} as const;
export type PxVariableType = typeof PxVariableType[keyof typeof PxVariableType];

/** @internal */
export const INTERNAL_ATTRS = new Set([
    'type', 'children', 'animator', 'meta', 'animate', 'effects', PX_TEXT_CONTENT_ATTR
]);

// ============================================================================
// TRANSFORM
// ============================================================================

/**
 * Names of the transform parts that can appear inside a transform value record.
 * The unified `transform` slot replaces the earlier per-part top-level keys
 * (`translate`, `rotate`, `scale`, `origin`) — those names now live as keys
 * inside a `PxTransformParts` record.
 */
/** The transform-part names, as a named record — they are keys of a DATA record (the
 *  transform value), so code reaches them through this rather than as bare literals. */
export const TRANSFORM_PART = {
    translate: 'translate',
    rotate: 'rotate',
    scale: 'scale',
    origin: 'origin',
} as const;

/** @public */
export const PX_TRANSFORM_PART_KEYS = [
    TRANSFORM_PART.translate, TRANSFORM_PART.rotate, TRANSFORM_PART.scale, TRANSFORM_PART.origin,
] as const;

/** One of the transform-part key strings. @public */
export type PxTransformPartKey = typeof PX_TRANSFORM_PART_KEYS[number];

// ─────────────────────────────────────────────────────────────────────────────
// Gradient paint effect — `fillGradient` / `strokeGradient`.
//
// Materializer pattern mirrors `maskedByEffect`: at apply time the gradient
// effect generates a `<linearGradient>` / `<radialGradient>` def into `ctx.defs`,
// then sets the host element's `fill` / `stroke` to `url(#auto-id)`. The wire
// gradient is geometry parts (`p1`/`p2` linear, `c`/`r`/`fp` radial — standard
// animatable slots) + a stop sequence that is either static (bare array) or
// animated (a single `{keyframes}` block whose each kf's `value` is the FULL
// `Array<{offset, color}>` snapshot at that time). Per-stop independent
// timelines are intentionally NOT modelled — the source is a single
// stop-color keyframe group. Animated geometry is frames-engine only
// (CSS/WAAPI cannot animate gradient endpoints; `mode: 'auto'` handles it).
//
// Stop count is constant across kfs. `gradientTransform` is captured as static
// only (animated transform is vanishingly rare).
// ─────────────────────────────────────────────────────────────────────────────

/** Loose enums for `spreadMethod` / gradient `type` — kept on the wire as
 *  plain strings (matches the rest of the schema's loose-enum stance) but
 *  collected here so call sites use named constants instead of bare literals.
 *
 *  `gradientUnits` has NO enum of its own: it takes the same two values as every other
 *  units slot, so it reuses {@link PxUnits} (review §2.7 — one name per value set). * @public
 */
export const PxGradientSpreadMethod = {
    pad:     'pad',
    reflect: 'reflect',
    repeat:  'repeat',
} as const;

export type PxGradientSpreadMethod = typeof PxGradientSpreadMethod[keyof typeof PxGradientSpreadMethod];

/** @public */
export const PxGradientType = {
    linear: 'linear',
    radial: 'radial',
} as const;

export type PxGradientType = typeof PxGradientType[keyof typeof PxGradientType];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// @px-area validation
/** The cheap shallow gate — "is this a Pixodesk document at all?". With `validateDocument`,
 *  the whole public checking surface (review §15). @public */
export function isPxDocument(doc: unknown): doc is PxDocument {
    if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return false;

    // `type` is the root tag, and the ONLY discriminator: `svg`, or an HTML element that wraps
    // SVG content (`div`, …). A `tagName` alternative was accepted here until 2026-08; nothing
    // ever wrote it. Lottie JSON has no `type`, so it never passes.
    return 'type' in doc && typeof doc.type === 'string' && doc.type.length > 0;
}

/**
 * The animator config, at either of its TWO canonical addresses (S4).
 *
 * `animator` is the only name. It has two addresses because the SVG form has no other
 * slot: a `.svga`/JSON document carries it at the top level, while a pre-rendered
 * `.svg` carries it inside the root element's `data-px-meta` blob — i.e. under `meta`.
 * The editor lifts/un-lifts between the two on write/read.
 *
 * The `animation` / `meta.animation` spellings were removed 2026-08: nothing wrote
 * them and they were never in the schema.
 * @public @advanced
 */
export function getAnimatorConfig(doc: PxDocument): PxAnimatorRuntimeConfig | undefined {
    // A PREPARED document (stage ≥ resolved) carries its runtime view in the stamp — a plain
    // property read, same object every time, while the doc still holds the config object the view
    // came from. Anything else derives FRESH on every call: no module state, no caches
    // (dev-docs/plans/prepare-document-pipeline.md); hot paths prepare first.
    const trusted = trustedView(doc, prepOf(doc));
    return trusted ? trusted.view : deriveRuntimeView(doc);
}

// @px-area pipeline
/** `prep` re-pointed at `doc`: its view is reused while `doc` holds the same animator config object, else re-derived. @internal */
export function prepFor(doc: PxDocument, prep: PxDocPrep): PxDocPrep {
    if (!stageAtLeast(prep.stage, PxDocStage.resolved)) return prep;
    const cfg = animatorOf(doc);
    return cfg === prep.viewOf ? prep : { ...prep, view: deriveRuntimeView(doc), viewOf: cfg };
}

// @px-area pipeline
/** Stamps `to` (a doc the caller derived from `from`, e.g. by id regeneration) with `from`'s stage —
 *  the view re-derived when `to`'s animator config is a new object. Returns `to`. @internal */
export function carryPrep<T extends PxDocument>(from: PxDocument, to: T): T {
    const prep = prepOf(from);
    if (prep && to !== (from as PxDocument)) stampPrep(to, prepFor(to, prep));
    return to;
}

// @px-importance important
/** The runtime view derived from the wire form — what `prepareDocument` attaches at `resolved`. @internal */
export function deriveRuntimeView(doc: PxDocument): PxAnimatorRuntimeConfig | undefined {
    const cfg = animatorOf(doc);
    if (!cfg) return undefined;

    // A document states playback ONLY inside `timeline`. A flat key at the animator root is not a
    // second spelling to honor — it is an unknown key (`validateDocument` and the entry diagnostic
    // both report it), so it is dropped here and never reaches an engine.
    const wire = cfg as Record<string, unknown>;
    const stray = PX_FLAT_RUNTIME_VIEW_KEYS.filter(k => wire[k] !== undefined);
    const source = stray.length ? { ...wire } : cfg;
    for (const k of stray) delete (source as Record<string, unknown>)[k];

    // Every internal consumer sees the FLAT view — the nested `timeline` spelling is
    // folded down here, so the engines/effects/drivers never branch on it.
    let view = resolveAnimatorTimeline(source as PxAnimatorRuntimeConfig);
    // Resolve the window (first-use review §4) — the ONE place, so every engine just reads
    // `duration`: an absent `outTime` means the max raw keyframe time, else the old default;
    // a `playbackSpeed` that is not a positive finite number is ignored (it would stall or reverse the playback).
    if (view.duration === undefined || (view.playbackSpeed !== undefined && !isWirePlaybackSpeed(view.playbackSpeed))) {
        view = { ...view };
        if (view.duration === undefined) view.duration = (maxKeyframeTimeOf(doc) ?? PX_DEFAULT_DURATION_MS) - (view.inTime ?? 0);
        if (view.playbackSpeed !== undefined && !isWirePlaybackSpeed(view.playbackSpeed)) delete view.playbackSpeed;
    }
    return view;
}


// ============================================================================
// TIMELINE SPELLING (review §2.1)
//
// The wire spelling is `animator.timeline: { type?: 'time'|'scroll'|'view', … }` (absent = 'time');
// the flat form (`timelineSource` + `scroll` + loose clock knobs) is the INTERNAL
// runtime view only — not a wire format. These two functions convert between them:
//   • resolveAnimatorTimeline — wire → runtime view; applied by `getAnimatorConfig`,
//     so ALL runtime code keeps consuming the flat form it always has.
//   • nestAnimatorTimeline — runtime view → wire; applied by writers (the editor) so
//     files carry only the nested spelling and its mode-dead keys are structurally absent.
// ============================================================================

/** Wire window → flat view: `duration` = window length, `inTime` = the sampling shift.
 *  The pre-1.3 `timeline.duration` is NOT read: `convertWireDocument` renames it in stamped documents. */
function foldWindow(timeline: PxTimeline, flat: PxAnimatorRuntimeConfig): void {
    const inTime = typeof timeline.inTime === 'number' ? timeline.inTime : 0;
    const outTime = timeline.outTime;
    if (inTime !== 0) flat.inTime = inTime;
    if (outTime !== undefined) flat.duration = outTime - inTime;
}

/** The max RAW keyframe time (ms) in the document — `node.animate` across the tree plus the
 *  named `definitions.animations` — before loop expansion (loops fill TO the window). What an
 *  absent `outTime` means; `undefined` when there are no keyframe times to take it from.
 *  @internal */
export function maxKeyframeTimeOf(doc: PxDocument): number | undefined {
    let max: number | undefined;
    const scanAnimation = (animation: unknown): void => {
        if (!animation || typeof animation !== 'object') return;
        for (const prop of Object.values(animation as Record<string, unknown>)) {
            const keyframes = (prop as { keyframes?: Array<{ time?: number }> } | undefined)?.keyframes;
            if (!Array.isArray(keyframes)) continue;
            for (const kf of keyframes) {
                if (typeof kf?.time === 'number' && (max === undefined || kf.time > max)) max = kf.time;
            }
        }
    };
    const scanNode = (node: unknown): void => {
        if (!node || typeof node !== 'object') return;
        scanAnimation((node as { animate?: unknown }).animate);
        const children = (node as { children?: Array<unknown> }).children;
        if (Array.isArray(children)) children.forEach(scanNode);
    };
    scanNode(doc);
    // The definitions read RAW (not via `getDefinitions`, whose route through `getAnimatorConfig`
    // would re-enter this scan before the memo is set).
    const animator = animatorOf(doc) as { definitions?: { animations?: Record<string, unknown> } } | undefined;
    const animations = animator?.definitions?.animations;
    if (animations && typeof animations === 'object') Object.values(animations).forEach(scanAnimation);
    return max;
}

// @px-importance important
/**
 * Resolves `cfg.timeline` (the wire spelling) into the runtime-view fields the engines consume.
 * Returns `cfg` unchanged when there is nothing to resolve. Pure: never mutates, never caches.
 * Public code reads the result through `getAnimatorConfig` / `prepareDocument` (review §17a).
 * @internal
 */
export function resolveAnimatorTimeline(cfg: PxAnimatorRuntimeConfig): PxAnimatorRuntimeConfig {
    const timeline = cfg.timeline;
    if (timeline === undefined || timeline === null || typeof timeline !== 'object') return cfg;

    const { timeline: _dropped, ...flat }: PxAnimatorRuntimeConfig = cfg;
    // the triggers sit at the animator's root (they will name more than one timeline); an EMPTY block means "nothing
    // starts it" — copied as it is
    if (cfg.actionTriggers !== undefined) flat.actionTriggers = { ...cfg.actionTriggers };

    // `engine` is shared by every timeline type: how the attributes get updated.
    if (timeline.engine !== undefined) flat.engine = timeline.engine;

    if (timeline.type === 'scroll') {
        flat.timelineSource = 'scroll';
        foldWindow(timeline, flat);
        if (timeline.iterations !== undefined) flat.iterations = timeline.iterations;
        flat.scroll = scrollSettingsOf(timeline);
    } else { // 'time', absent, or unknown — the time-driven timeline is the default
        if (timeline.frameRate !== undefined) flat.frameRate = timeline.frameRate;
        foldWindow(timeline, flat);
        if (timeline.playbackSpeed !== undefined) flat.playbackSpeed = timeline.playbackSpeed;
        if (timeline.delay !== undefined) flat.delay = timeline.delay;
        if (timeline.iterations !== undefined) flat.iterations = timeline.iterations;
        if (timeline.iterationDirection !== undefined) flat.direction = timeline.iterationDirection;
        // the built-in actions' settings travel as their block; the engines' rest-pose view is derived from
        // two of them: `fill` (CSS animation-fill-mode) and `resetOnFinish`
        const actions = timeline.actions !== undefined ? expandedActions(timeline.actions) : undefined;
        if (actions !== undefined && Object.keys(actions).length > 0) flat.actions = actions;
        if (timeline.whenFinished !== undefined) { flat.whenFinished = timeline.whenFinished; flat.resetOnFinish = timeline.whenFinished === PxWhenFinished.jumpToStart; }
        if (timeline.whenIdle !== undefined) flat.whenIdle = timeline.whenIdle;
        if (timeline.whenIdle !== undefined || timeline.whenFinished !== undefined) flat.fill = fillModeOf(timeline.whenIdle, timeline.whenFinished);
        if (timeline.inViewThreshold !== undefined) flat.inViewThreshold = timeline.inViewThreshold;
        if (timeline.inViewDebounce !== undefined) flat.inViewDebounce = timeline.inViewDebounce;
        if (timeline.segments !== undefined) flat.segments = [...timeline.segments];
    }

    return flat;
}

/** A wire moment (a word, `{ domElement, screen }` or `{ scrolled }`) in its settings form — `undefined` for anything else. */
function momentSettingsOf(moment: unknown): PxScrollMomentSettings | undefined {
    if (typeof moment === 'string') return (PX_SCROLL_MOMENT_ORDER as ReadonlyArray<string>).includes(moment) ? { moment: moment as PxScrollMoment } : undefined;
    if (!moment || typeof moment !== 'object' || Array.isArray(moment)) return undefined;
    const raw = moment as { domElement?: unknown; screen?: unknown; scrolled?: unknown };
    const line = (value: unknown): PxScrollLine | number | undefined =>
        typeof value === 'number' || (typeof value === 'string' && value in PxScrollLine) ? value as PxScrollLine | number : undefined;
    const settings: PxScrollMomentSettings = {};
    if (typeof raw.scrolled === 'number') settings.scrolled = raw.scrolled;
    const element = line(raw.domElement); if (element !== undefined) settings.domElement = element;
    const screen = line(raw.screen); if (screen !== undefined) settings.screen = screen;
    return Object.keys(settings).length ? settings : undefined;
}

/** The wire's shortest spelling of a moment: the word alone, or the object as it is. */
function wireMomentOf(settings: PxScrollMomentSettings): PxScrollMomentWire | undefined {
    if (settings.moment !== undefined) return settings.moment;
    if (settings.scrolled !== undefined) return { scrolled: settings.scrolled };
    if (settings.domElement !== undefined || settings.screen !== undefined) {
        return { domElement: settings.domElement ?? PxScrollLine.top, screen: settings.screen ?? PxScrollLine.bottom };
    }
    return undefined;
}

/** A scroll timeline's own keys in the runtime view's settings form ({@link PxScrollSettings}). */
function scrollSettingsOf(timeline: _PxScrollTimeline): PxScrollSettings {
    const scroll: PxScrollSettings = {};
    if (timeline.follows !== undefined) scroll.follows = timeline.follows;
    if (timeline.selector !== undefined) scroll.selector = timeline.selector;
    if (timeline.axis !== undefined) scroll.axis = timeline.axis;
    if (timeline.smoothing !== undefined) scroll.smoothing = timeline.smoothing;
    const first = momentSettingsOf(timeline.firstFrameWhen); if (first) scroll.firstFrameWhen = first;
    const last = momentSettingsOf(timeline.lastFrameWhen); if (last) scroll.lastFrameWhen = last;
    const hold = timeline.holdOnScreen;
    if (hold === true || (hold && typeof hold === 'object')) {
        scroll.holdOnScreen = true;
        if (typeof hold === 'object') {
            if (hold.at !== undefined) scroll.holdAt = hold.at;
            if (hold.forScreens !== undefined) scroll.holdForScreens = hold.forScreens;
            if (hold.offset !== undefined) scroll.holdOffset = hold.offset;
        }
    }
    return scroll;
}

/** The engines' CSS-style fill mode from the two settings that say it: the first frame before play
 *  (`whenIdle: firstFrame` → `backwards` / `both`) and the last frame after a natural end (`whenFinished: hold` →
 *  `forwards` / `both`). @public @advanced */
export function fillModeOf(whenIdle: PxWhenIdle | undefined, whenFinished: PxWhenFinished | undefined): PxFillMode {
    const before = (whenIdle ?? PX_PLAYBACK_DEFAULTS.whenIdle) === PxWhenIdle.firstFrame;
    const after = (whenFinished ?? PX_PLAYBACK_DEFAULTS.whenFinished) === PxWhenFinished.hold;
    return before ? (after ? PxFillMode.both : PxFillMode.backwards) : (after ? PxFillMode.forwards : PxFillMode.none);
}

/** An `actions` block in its SETTINGS form — no word slots, the runtime view's spelling. */
export type PxActionsSettings = { [K in keyof PxActions]?: Exclude<NonNullable<PxActions[K]>, string> };

/** A copy of an `actions` block in its settings form: every slot through {@link actionSettingsOf} (the word
 *  `'animateToStart'` is exactly `{ behavior: 'animateToStart' }`); an EMPTY settings block says nothing (every field its default),
 *  so it is dropped. What `resolveAnimatorTimeline` hands the engines, so no reader meets the word form. */
function expandedActions(actions: PxActions): PxActionsSettings {
    const copy: PxActionsSettings = {};
    const said = <T extends object>(slot: T | undefined): slot is T => slot !== undefined && Object.keys(slot).length > 0;
    const stop = actionSettingsOf(actions[PxTriggerList.stopPlayback]); if (said(stop)) copy[PxTriggerList.stopPlayback] = { ...stop };
    const outOfView = actionSettingsOf(actions.outOfView); if (said(outOfView)) copy.outOfView = { ...outOfView };
    return copy;
}

/** The wire's canonical form — the SHORTEST exact spelling: a slot that says only `behavior` is the word itself
 *  (the rule `mergeTimeline` applies to a merged block as RULE 5). What `nestAnimatorTimeline` writes. */
function compactedActions(actions: PxActions): PxActions {
    const settings = expandedActions(actions);
    const onlyBehavior = (slot: { behavior?: string }): boolean => slot.behavior !== undefined && Object.keys(slot).length === 1;
    const copy: PxActions = {};
    const stop = settings[PxTriggerList.stopPlayback];
    if (stop !== undefined) copy[PxTriggerList.stopPlayback] = onlyBehavior(stop) ? stop.behavior : stop;
    if (settings.outOfView !== undefined) copy.outOfView = onlyBehavior(settings.outOfView) ? settings.outOfView.behavior : settings.outOfView;
    return copy;
}

/**
 * Converts a FLAT animator config into the written spelling: mode-specific keys fold into
 * one discriminated `timeline` object; the legacy flat keys are removed from the output.
 * Returns a new object (input untouched); a config already carrying `timeline` passes
 * through unchanged; a pure-shared config (duration/mode/… only) gets no `timeline` at all.
 * @public @advanced
 */
export function nestAnimatorTimeline(cfg: PxAnimatorRuntimeConfig): PxAnimatorConfig {
    if (!cfg || cfg.timeline !== undefined) return cfg;

    const { timelineSource, scroll, actionTriggers, actions, delay, iterations, direction, fill, resetOnFinish,
            whenFinished, whenIdle, inViewThreshold, inViewDebounce, segments,
            duration, inTime, playbackSpeed, engine, frameRate, ...shared } = cfg;
    // flat `duration` is the WINDOW LENGTH; on the wire the window is written as its two points
    const writeWindow = (timeline: { inTime?: number; outTime?: number }) => {
        if (inTime !== undefined && inTime !== 0) timeline.inTime = inTime;
        if (duration !== undefined) timeline.outTime = (inTime ?? 0) + duration;
    };

    if (timelineSource === 'scroll') {
        const timeline: _PxScrollTimeline = { type: 'scroll' };
        if (engine !== undefined) timeline.engine = engine;
        writeWindow(timeline);
        // Finite iterations only: 'infinite' cannot be spread between two moments.
        if (typeof iterations === 'number') timeline.iterations = iterations;
        if (scroll) {
            if (scroll.follows !== undefined) timeline.follows = scroll.follows;
            if (scroll.selector !== undefined) timeline.selector = scroll.selector;
            const first = scroll.firstFrameWhen && wireMomentOf(scroll.firstFrameWhen); if (first !== undefined) timeline.firstFrameWhen = first;
            const last = scroll.lastFrameWhen && wireMomentOf(scroll.lastFrameWhen); if (last !== undefined) timeline.lastFrameWhen = last;
            if (scroll.holdOnScreen) {
                const hold: { at?: PxHoldAt; forScreens?: number; offset?: number } = {};
                if (scroll.holdAt !== undefined) hold.at = scroll.holdAt;
                if (scroll.holdForScreens !== undefined) hold.forScreens = scroll.holdForScreens;
                if (scroll.holdOffset !== undefined) hold.offset = scroll.holdOffset;
                timeline.holdOnScreen = Object.keys(hold).length ? hold : true;
            }
            if (scroll.axis !== undefined) timeline.axis = scroll.axis;
            if (scroll.smoothing !== undefined) timeline.smoothing = scroll.smoothing;
        }
        return { ...shared, timeline };   // a scroll timeline has no triggers: nothing starts it
    }

    // Time-driven: `type` is optional on the wire and 'time' is the default, so the
    // writer omits it — the common case declares nothing.
    const timeline: _PxTimeTimeline = {};
    if (engine !== undefined) timeline.engine = engine;
    if (frameRate !== undefined) timeline.frameRate = frameRate;
    writeWindow(timeline);
    if (playbackSpeed !== undefined) timeline.playbackSpeed = playbackSpeed;
    if (delay !== undefined) timeline.delay = delay;
    if (iterations !== undefined) timeline.iterations = iterations;
    if (direction !== undefined) timeline.iterationDirection = direction;
    // the actions block; the rest-pose view back to its two settings: `fill` / `resetOnFinish` → `whenFinished` and the rest pose
    const compacted: PxActions = actions !== undefined ? compactedActions(actions) : {};
    if (Object.keys(compacted).length > 0) timeline.actions = compacted;
    if (whenFinished !== undefined) timeline.whenFinished = whenFinished;
    else if (resetOnFinish || fill === PxFillMode.none || fill === PxFillMode.backwards) timeline.whenFinished = PxWhenFinished.jumpToStart;
    if (whenIdle !== undefined) timeline.whenIdle = whenIdle;
    else if (fill === PxFillMode.backwards || fill === PxFillMode.both) timeline.whenIdle = PxWhenIdle.firstFrame;
    if (inViewThreshold !== undefined) timeline.inViewThreshold = inViewThreshold;
    if (inViewDebounce !== undefined) timeline.inViewDebounce = inViewDebounce;
    if (segments !== undefined && segments.length > 0) timeline.segments = [...segments];

    // An empty time timeline says nothing — omit the block entirely. The triggers sit beside it, at the root.
    const nested: PxAnimatorConfig = Object.keys(timeline).length > 0 ? { ...shared, timeline } : { ...shared };
    if (actionTriggers !== undefined) nested.actionTriggers = { ...actionTriggers };
    return nested;
}


/** @public @advanced */
export function getDefinitions(doc: PxDocument): PxDefinitions | undefined {
    if (!doc) return undefined;
    return getAnimatorConfig(doc)?.definitions;
}

/** The bind-by-id document's `animator.bindings`, as written — `target` keeps its `#`. @public @advanced */
export function getBindings(doc: PxDocument): PxBinding[] | undefined {
    if (!doc) return undefined;
    return getAnimatorConfig(doc)?.bindings;
}


/** @public @advanced */
export function getChildren(doc: PxDocument): PxNode[] | undefined {
    return doc?.children;
}
