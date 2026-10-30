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

import type { PxDocument, PxAnimatorConfig, PxAnimatorRuntimeConfig, PxBinding, PxDefinitions, PxNode, PxScroll, PxTimeline, PxTriggers, PxActions, _PxScrollishTimelineShape, _PxTimeTimeline } from './PxAnimatorTypes';
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
export const PX_ANIM_SRC_ATTR_NAME = 'data-px-animation-src';

/** @internal */
export const PX_ANIM_ATTR_NAME = '_px_animator';

/** An interaction the trigger listens for (dev-docs/plans/component-api.md D5) — an OPEN list: a new
 *  interaction is a new member, never a new key. `load` is the document being ready (the visibility gate
 *  still decides whether it may run). @public */
export const PxTriggerEvent = {
    load:     'load',
    hoverIn:  'hoverIn',
    hoverOut: 'hoverOut',
    click:    'click',
} as const;

export type PxTriggerEvent = typeof PxTriggerEvent[keyof typeof PxTriggerEvent];

/** One event, or several — the house style of `animate`'s references. @public */
export type PxTriggerEvents = PxTriggerEvent | Array<PxTriggerEvent>;

/** The trigger lists, by their `timeline.triggers` key (playback-layers.md, layer 0). @public @advanced */
export const PxTriggerList = {
    start:      'start',
    stop:       'stop',
    pause:      'pause',
    resume:     'resume',
    togglePlay: 'togglePlay',
} as const;

export type PxTriggerList = typeof PxTriggerList[keyof typeof PxTriggerList];

// @px-area control
/** The events a list may name — the schema is built from it, and an event outside it is dropped and warned:
 *   - `start`: load · hoverIn · click (starting when the pointer LEAVES makes no sense)
 *   - `stop`: hoverOut · click (stopping on load or when the pointer ARRIVES makes no sense)
 *   - `pause` / `resume`: hoverIn · hoverOut · click (a marquee pauses on hover in, a hover animation on hover out)
 *   - `togglePlay`: click (the only event that both starts and stops)
 *  @public @advanced */
export function allowedTriggerEvents(list: PxTriggerList): ReadonlyArray<PxTriggerEvent> {
    switch (list) {
        case PxTriggerList.start: return [PxTriggerEvent.load, PxTriggerEvent.hoverIn, PxTriggerEvent.click];
        case PxTriggerList.stop: return [PxTriggerEvent.hoverOut, PxTriggerEvent.click];
        case PxTriggerList.pause:
        case PxTriggerList.resume: return [PxTriggerEvent.hoverIn, PxTriggerEvent.hoverOut, PxTriggerEvent.click];
        case PxTriggerList.togglePlay: return [PxTriggerEvent.click];
    }
}

// @px-area control
/** The event that undoes another — what resumes a pause: hoverIn ↔ hoverOut, click → click; `load` has none.
 *  @public @advanced */
export function counterpartTriggerEvent(event: PxTriggerEvent): PxTriggerEvent | undefined {
    switch (event) {
        case PxTriggerEvent.hoverIn: return PxTriggerEvent.hoverOut;
        case PxTriggerEvent.hoverOut: return PxTriggerEvent.hoverIn;
        case PxTriggerEvent.click: return PxTriggerEvent.click;
        case PxTriggerEvent.load: return undefined;
    }
}

/** `actions.start.transition` — a transition PRESET (playback-layers.md, layer 1): where a start ends and the
 *  path there. `continue` plays on from the current position (from the beginning when it rests at the start
 *  or the end), `restart` always from the beginning, `jumpToFinished` shows the end pose with no motion. @public */
export const PxStartTransition = {
    continue:       'continue',
    restart:        'restart',
    jumpToFinished: 'jumpToFinished',
} as const;

export type PxStartTransition = typeof PxStartTransition[keyof typeof PxStartTransition];

/** `actions.stop.transition` — a stop jumps back to the state as before it started (`reset`), or plays
 *  back to it (`rewind` — the VCR word). @public */
export const PxStopTransition = {
    reset:  'reset',
    rewind: 'rewind',
} as const;

export type PxStopTransition = typeof PxStopTransition[keyof typeof PxStopTransition];

/** `actions.finish.transition` — the natural end keeps the last frame (`hold`), jumps back (`reset`), or
 *  plays back (`rewind`). @public */
export const PxFinishTransition = {
    hold:   'hold',
    reset:  'reset',
    rewind: 'rewind',
} as const;

export type PxFinishTransition = typeof PxFinishTransition[keyof typeof PxFinishTransition];

/** `actions.suspend.transition` — what happens once none of the graphic is on screen (the gate's closing
 *  edge; `wake` is its partner): freeze where it is (`pause`), keep playing (`continue`), or go back to the
 *  start and replay when seen (`reset`). The CLOCK is held, never the playback state, so `wake` carries on
 *  only what was running. @public */
export const PxSuspendTransition = {
    pause:    'pause',
    continue: 'continue',
    reset:    'reset',
} as const;

export type PxSuspendTransition = typeof PxSuspendTransition[keyof typeof PxSuspendTransition];

/** `timeline.beforeStart` — the rest pose, before the first start and after a reset: the SVG as authored
 *  (`static`), or the first frame's values (`firstFrame`, hand-authored files; the Editor never writes it). @public */
export const PxBeforeStart = {
    static:     'static',
    firstFrame: 'firstFrame',
} as const;

export type PxBeforeStart = typeof PxBeforeStart[keyof typeof PxBeforeStart];


/** `scroll.kind` — which scroll-driven timeline member this is: the subject's journey
 *  through the scrollport (`view`), or the scroll container's own offset (`scroll`). * @public
 */
export const PxScrollKind = {
    view:   'view',
    scroll: 'scroll',
} as const;

export type PxScrollKind = typeof PxScrollKind[keyof typeof PxScrollKind];

/** `timeline.axis` — which axis of the scroll container drives progress. @public */
export const PxScrollAxis = {
    block:  'block',
    inline: 'inline',
    x:      'x',
    y:      'y',
} as const;

export type PxScrollAxis = typeof PxScrollAxis[keyof typeof PxScrollAxis];

/** `timeline.source` (`scroll` kind) — which scroll container is measured. @public */
export const PxScrollSource = {
    nearest: 'nearest',
    root:    'root',
} as const;

export type PxScrollSource = typeof PxScrollSource[keyof typeof PxScrollSource];

/** `timeline.pin.align` — where the pinned canvas is held in the scrollport. @public */
export const PxPinAlign = {
    top:    'top',
    center: 'center',
    bottom: 'bottom',
} as const;

export type PxPinAlign = typeof PxPinAlign[keyof typeof PxPinAlign];

/** The subject's journey phases across the scrollport (see scroll-timeline.design.md §4
 *  for the exact `u`-space intervals each phase maps to). * @public
 */
export const PxScrollPhase = {
    cover:         'cover',
    contain:       'contain',
    entry:         'entry',
    exit:          'exit',
    entryCrossing: 'entryCrossing',
    exitCrossing:  'exitCrossing',
} as const;

export type PxScrollPhase = typeof PxScrollPhase[keyof typeof PxScrollPhase];

/** The browser's spelling of a phase — a CSS view-timeline range name. @internal */
export type PxCssScrollPhase = 'cover' | 'contain' | 'entry' | 'exit' | 'entry-crossing' | 'exit-crossing';

/** A phase as the browser takes it (`entryCrossing` → `'entry-crossing'`). @internal */
export function cssScrollPhase(phase: PxScrollPhase): PxCssScrollPhase {
    switch (phase) {
        case PxScrollPhase.entryCrossing: return 'entry-crossing';
        case PxScrollPhase.exitCrossing: return 'exit-crossing';
        default: return phase;   // the one-word values are spelled the same
    }
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
export const PX_TIMELINE_SHARED_KEYS = ['inTime', 'outTime', 'iterations', 'engine', 'frameRate'] as const;

/** Timeline keys that exist ONLY on the time-driven member — a scroll/view timeline is
 *  scrubbed by position, so nothing starts it, nothing delays it, and nothing remaps its pace. */
export const PX_TIME_ONLY_TIMELINE_KEYS = ['triggers', 'actions', 'delay', 'playDuration', 'iterationDirection', 'beforeStart',
    'inViewThreshold', 'inViewDebounce'] as const;

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
 * THE PLAYBACK DEFAULTS (playback-layers.md, layers 0–1) — what an absent `triggers` block and absent
 * `actions` settings mean. One table, stated by the schemas and applied by {@link resolveTriggers} /
 * {@link resolveActions} / {@link resolveGate}, which every player calls — so a file behaves the same everywhere:
 *   - `start` 'load' — an absent `triggers` block plays on load: a document is designed to play
 *   - start `continue` · stop `reset` (now) · finish `hold` — the three moves' presets
 *   - suspend `pause` — an animation nobody can see does not run
 *   - `beforeStart` 'static' — the rest pose is the SVG as authored
 *   - `inViewThreshold` 0.5 / `inViewDebounce` 150 — half of it on screen, that long, before it counts as seen
 * @public @advanced
 */
export const PX_PLAYBACK_DEFAULTS = {
    /** an absent `triggers` block starts on load — a document is designed to play */
    start: 'load',
    startTransition: 'continue',
    stopTransition: 'reset',
    stopCompleteIteration: false,
    finishTransition: 'hold',
    suspendTransition: 'pause',
    beforeStart: 'static',
    inViewThreshold: 0.5,
    inViewDebounce: 150,
} as const;

/**
 * What an absent content window means for the runtime view's `duration` — one pass of 1000 ms when the document has neither `outTime` nor keyframes, kept here as a constant for the runtime's arithmetic. @internal
 */
export const PX_DEFAULT_DURATION_MS = 1000;
/** What an absent `timeline.iterations` means — see `PX_DEFAULT_DURATION_MS`. @internal */
export const PX_DEFAULT_ITERATIONS = 1;
/** What an absent `unitsPerEm` of a glyph font means — see `PX_DEFAULT_DURATION_MS`. @internal */
export const PX_DEFAULT_UNITS_PER_EM = 1000;

/** The triggers with their lists normalised: every list an array of ALLOWED events, `togglePlay` expanded into
 *  `start` and `stop`, `resume` DERIVED ({@link derivedResume}), an absent block = `{ start: ['load'] }`, an empty
 *  block = nothing starts it. @public @advanced */
export interface PxResolvedTriggers {
    readonly start: ReadonlyArray<PxTriggerEvent>;
    readonly stop: ReadonlyArray<PxTriggerEvent>;
    readonly pause: ReadonlyArray<PxTriggerEvent>;
    readonly resume: ReadonlyArray<PxTriggerEvent>;
}

/** The four built-in actions' settings with every default applied — see {@link resolveActions}. @public @advanced */
export interface PxResolvedActions {
    readonly start:   { readonly transition: PxStartTransition };
    readonly stop:    { readonly transition: PxStopTransition; readonly completeIteration: boolean };
    readonly finish:  { readonly transition: PxFinishTransition };
    readonly suspend: { readonly transition: PxSuspendTransition };
}

// ── CONTROL MODE (API review §1 / §7; `autoplay` renamed `playOnTrigger`: first-use review §1+2) ──
// Which set of props drives playback. Every component picked its own order, so
// `playOnTrigger` + `playCurrentProgress={0.5}` played on React and Vue but seeked on React Native, and
// React let a REF choose the mode — `<SvgAnimationPlayer playOnTrigger playerRef={api} />` never
// started, because the imperative branch replaced the trigger with an empty one.
//
// One order, decided once, used by react / vue / rn. This module owns the LOGIC and the
// WARNING TEXT only; each component keeps its own `console.warn` wiring.

/** Which props drive playback. `playerRef` is deliberately NOT a mode: the handle is filled in
 *  every mode, so passing it alone leaves the document's own trigger in charge. * @public
 */
export const PxControlMode = {
    /** No control props — the document's trigger decides, and nothing is taken over. */
    static:    'static',
    /** `playCurrentProgress` / `playCurrentTime` — the host holds the frame; the component seeks and stays paused. */
    fixedTime: 'fixedTime',
    /** `play` / `pause` — the host drives playback with booleans. */
    play:      'play',
    /** `playOnTrigger` — plays the way the editor saved it: the document's own trigger decides. */
    playOnTrigger: 'playOnTrigger',
} as const;

export type PxControlMode = typeof PxControlMode[keyof typeof PxControlMode];

/**
 * The control props every framework component takes. `resolveControlMode` reads only WHICH
 * are set; the components read the values. ONE definition (review §9) — React and React
 * Native extend it, so the hover text below is what their users see.
 * @public
 */
export interface PxControlProps {
    /**
     * Show the frame at this position in the whole timeline (duration × iterations): `0` the
     * first frame, `1` the last — of ONE iteration when `iterations` is `'infinite'`, since an
     * endless run has no whole to be a fraction of. Wins over every other control prop. The read
     * twin is the handle's `getCurrentProgress()`.
     */
    playCurrentProgress?: number;
    /** Show the frame at this time, ms from the start of the whole run. Wins like `playCurrentProgress`;
     *  the read twin is `getCurrentTime()`. */
    playCurrentTime?: number;
    /** The STATE switch (§10): `true` calls the built-in `start` (or `resume` when paused), `false` calls
     *  `stop` — performed per `actions` (transition, complete the iteration), always from the current frame;
     *  a mount renders the pose without animating. */
    play?: boolean;
    /** Freeze the current frame NOW / resume toward the current target. Only meaningful while
     *  `play` is true — `play: false` forcibly unfreezes. Never deferred. */
    pause?: boolean;
    /**
     * Play on a trigger. `true` — the way the editor saved it: the document's own `triggers` block
     * decides. An OBJECT — those triggers instead, as a WHOLE (the lists belong together: switching
     * `hoverIn` → `click` wants other `pause` / `stop` lists too); lists left out are simply not listed
     * (`resume` copies `start`), never the file's values.
     */
    playOnTrigger?: boolean | PxTriggers;
    // TODO (dev-docs/plans/component-api.md D4): `playOnScrollTimeline?: PxScrollTimeline` — the scroll driver,
    // a full scroll-driven timeline config, when scroll-driven playback lands. Every driver starts with `play`.
}

/** The chosen mode plus any conflict warnings — ready-made sentences, so three components
 *  cannot word the same conflict three ways. * @public
 */
export interface PxResolvedControlMode {
    readonly mode: PxControlMode;
    readonly warnings: ReadonlyArray<string>;
}

// @px-area control
/**
 * Picks the control mode from the props a component was given.
 *
 * PRECEDENCE, most specific first:
 *   1. `playCurrentProgress` / `playCurrentTime` — an explicit position is the most precise instruction there is
 *   2. `play` / `pause`     — explicit playback state
 *   3. `playOnTrigger`        — defer to the document's trigger
 *   4. otherwise `static`   — nothing plays; the trigger is taken over
 *
 * `playerRef` is absent on purpose. A ref is a handle, not an instruction: it is populated in
 * every mode, so `playOnTrigger` + `playerRef` autostarts AND gives you the handle.
 *
 * A warning is produced only when props from two different tiers are set together — the
 * lower tier is then ignored, and silence about that is what made this hard to debug.
 * @public
 */
export function resolveControlMode(props: PxControlProps): PxResolvedControlMode {
    const hasFixedTime = props.playCurrentProgress !== undefined || props.playCurrentTime !== undefined;
    const hasPlayPause = props.play !== undefined || props.pause !== undefined;
    const hasPlayOnTrigger = !!props.playOnTrigger;

    const warnings: Array<string> = [];
    const named = (a: string, b: string, winner: string): string =>
        a + ' and ' + b + ' were both set — ' + winner + ' wins, ' + (winner === a ? b : a) + ' is ignored.';

    if (hasFixedTime) {
        if (hasPlayPause) warnings.push(named('playCurrentProgress/playCurrentTime', 'play/pause', 'playCurrentProgress/playCurrentTime'));
        if (hasPlayOnTrigger) warnings.push(named('playCurrentProgress/playCurrentTime', 'playOnTrigger', 'playCurrentProgress/playCurrentTime'));
        return { mode: PxControlMode.fixedTime, warnings };
    }
    if (hasPlayPause) {
        if (hasPlayOnTrigger) warnings.push(named('play/pause', 'playOnTrigger', 'play/pause'));
        return { mode: PxControlMode.play, warnings };
    }
    if (hasPlayOnTrigger) return { mode: PxControlMode.playOnTrigger, warnings };
    return { mode: PxControlMode.static, warnings };
}

// @px-area control
/**
 * True when the component must take the document's trigger over — the trigger replaced by an
 * EMPTY one (`withoutTriggerDriver`), so nothing starts the animation by itself.
 *
 * Every mode except `playOnTrigger` — INCLUDING `static`. A component given no control props at
 * all must not start on its own: `<SvgAnimationPlayer doc={…} />` renders the first frame and waits.
 * `playOnTrigger` is the one mode that says "let the document's trigger decide" — and since the
 * first-use review §1+2 the web `createSvgAnimationPlayer` follows the same rule through its
 * `playOnTrigger` option.
 * @public
 */
export function controlModeTakesOverTrigger(mode: PxControlMode): boolean {
    return mode !== PxControlMode.playOnTrigger;
}

// @px-area control
/** One event or several, as an array. @public @advanced */
export function triggerEventList(events: PxTriggerEvents | undefined): ReadonlyArray<PxTriggerEvent> {
    return events === undefined ? [] : Array.isArray(events) ? events : [events];
}

// @px-area control
/** A list's events that the list may name ({@link allowedTriggerEvents}) — the others are dropped. */
function allowedEventsOf(list: PxTriggerList, events: PxTriggerEvents | undefined): ReadonlyArray<PxTriggerEvent> {
    const allowed = allowedTriggerEvents(list);
    return triggerEventList(events).filter(e => allowed.includes(e));
}

/** `list` plus the events of `more` it does not name yet. */
function unionEvents(list: ReadonlyArray<PxTriggerEvent>, more: ReadonlyArray<PxTriggerEvent>): ReadonlyArray<PxTriggerEvent> {
    return more.length === 0 ? list : [...list, ...more.filter(e => !list.includes(e))];
}

// @px-area control
/** What resumes a paused animation — derived, never configured for the built-in events: the counterpart of
 *  each `pause` event (hoverIn ↔ hoverOut, click → click), plus the `start` events that do not also STOP it
 *  (so a click that starts and stops — `togglePlay` — stops a paused one, as it says). @public @advanced */
export function derivedResume(start: ReadonlyArray<PxTriggerEvent>, stop: ReadonlyArray<PxTriggerEvent>,
    pause: ReadonlyArray<PxTriggerEvent>): ReadonlyArray<PxTriggerEvent> {
    const counterparts: Array<PxTriggerEvent> = [];
    for (const event of pause) {
        const counterpart = counterpartTriggerEvent(event);
        if (counterpart !== undefined && !counterparts.includes(counterpart)) counterparts.push(counterpart);
    }
    return unionEvents(counterparts, start.filter(e => !stop.includes(e)));
}

// @px-area control
/** A document's triggers with the lists normalised — see {@link PxResolvedTriggers}. Events a list may not
 *  name are dropped ({@link triggerIssues} says which); an explicit `resume` naming a built-in event is ignored
 *  — resume is {@link derivedResume} (the key is kept for element targets, still to come). @public @advanced */
export function resolveTriggers(triggers: PxTriggers | undefined): PxResolvedTriggers {
    if (triggers === undefined) {
        const start: ReadonlyArray<PxTriggerEvent> = [PX_PLAYBACK_DEFAULTS.start];
        return { start, stop: [], pause: [], resume: start };
    }
    const togglePlay = allowedEventsOf(PxTriggerList.togglePlay, triggers.togglePlay);
    const start = unionEvents(allowedEventsOf(PxTriggerList.start, triggers.start), togglePlay);
    const stop = unionEvents(allowedEventsOf(PxTriggerList.stop, triggers.stop), togglePlay);
    const pause = allowedEventsOf(PxTriggerList.pause, triggers.pause);
    return { start, stop, pause, resume: derivedResume(start, stop, pause) };
}

/** What {@link triggerIssues} reports. @public @advanced */
export const PxTriggerIssueKind = {
    /** The list may not name the event ({@link allowedTriggerEvents}) — it is dropped. */
    eventNotAllowed: 'eventNotAllowed',
    /** Two lists react to the event in the same state: `stop` with `pause` (playing — pause wins), or `stop`
     *  with a pause's counterpart (paused — resume wins). The file should name one. */
    collision:       'collision',
    /** An explicit `resume` names a built-in event the derived resume does not — ignored. */
    resumeIgnored:   'resumeIgnored',
} as const;

export type PxTriggerIssueKind = typeof PxTriggerIssueKind[keyof typeof PxTriggerIssueKind];

/** One problem with a triggers block — structured, so a caller decides on `kind`, never on text. @public @advanced */
export interface PxTriggerIssue {
    readonly kind: PxTriggerIssueKind;
    /** The list that names the event (`stop` for a collision). */
    readonly list: PxTriggerList;
    readonly event: PxTriggerEvent;
    /** A collision's other list — `pause` or `resume`. */
    readonly otherList?: PxTriggerList;
}

// @px-area control
/** Every problem with a triggers block, for the players to warn about and the Editor to show — see
 *  {@link PxTriggerIssueKind}. An empty array is a clean block. @public @advanced */
export function triggerIssues(triggers: PxTriggers | undefined): Array<PxTriggerIssue> {
    if (triggers === undefined) return [];
    const issues: Array<PxTriggerIssue> = [];
    const lists: ReadonlyArray<[PxTriggerList, PxTriggerEvents | undefined]> = [
        [PxTriggerList.start, triggers.start], [PxTriggerList.stop, triggers.stop],
        [PxTriggerList.pause, triggers.pause], [PxTriggerList.togglePlay, triggers.togglePlay],
    ];
    for (const [list, events] of lists) {
        const allowed = allowedTriggerEvents(list);
        for (const event of triggerEventList(events)) {
            if (!allowed.includes(event)) issues.push({ kind: PxTriggerIssueKind.eventNotAllowed, list, event });
        }
    }
    const resolved = resolveTriggers(triggers);
    for (const event of triggerEventList(triggers.resume)) {
        if (!resolved.resume.includes(event)) issues.push({ kind: PxTriggerIssueKind.resumeIgnored, list: PxTriggerList.resume, event });
    }
    const counterparts = derivedResume([], [], resolved.pause);
    for (const event of resolved.stop) {
        if (resolved.pause.includes(event)) issues.push({ kind: PxTriggerIssueKind.collision, list: PxTriggerList.stop, event, otherList: PxTriggerList.pause });
        if (counterparts.includes(event)) issues.push({ kind: PxTriggerIssueKind.collision, list: PxTriggerList.stop, event, otherList: PxTriggerList.resume });
    }
    return issues;
}

// @px-area control
/** A document's `actions` with every default applied — see {@link PxResolvedActions}. @public @advanced */
export function resolveActions(actions: PxActions | undefined): PxResolvedActions {
    return {
        start:   { transition: actions?.start?.transition ?? PX_PLAYBACK_DEFAULTS.startTransition },
        stop:    { transition: actions?.stop?.transition ?? PX_PLAYBACK_DEFAULTS.stopTransition,
                   completeIteration: actions?.stop?.completeIteration ?? PX_PLAYBACK_DEFAULTS.stopCompleteIteration },
        finish:  { transition: actions?.finish?.transition ?? PX_PLAYBACK_DEFAULTS.finishTransition },
        suspend: { transition: actions?.suspend?.transition ?? PX_PLAYBACK_DEFAULTS.suspendTransition },
    };
}

/** The visibility gate with its defaults applied: how `suspend` reacts (`actions.suspend.transition`) and when
 *  the view sensor counts the graphic as seen (the two timeline numbers). Read from the runtime view by every
 *  player. @public @advanced */
export interface PxResolvedGate {
    readonly suspend: PxSuspendTransition;
    readonly inViewThreshold: number;
    readonly inViewDebounce: number;
}

// @px-area control
/** The gate of a runtime view, defaulted — see {@link PxResolvedGate}. @public @advanced */
export function resolveGate(cfg: Pick<PxAnimatorRuntimeConfig, 'actions' | 'inViewThreshold' | 'inViewDebounce'> | undefined): PxResolvedGate {
    return {
        suspend: cfg?.actions?.suspend?.transition ?? PX_PLAYBACK_DEFAULTS.suspendTransition,
        inViewThreshold: cfg?.inViewThreshold ?? PX_PLAYBACK_DEFAULTS.inViewThreshold,
        inViewDebounce: cfg?.inViewDebounce ?? PX_PLAYBACK_DEFAULTS.inViewDebounce,
    };
}

/** The three states the state rule distinguishes: `start` acts when stopped, `pause` when playing,
 *  `resume` when paused, `stop` when playing or paused. @public @advanced */
export const PxPlayState = {
    stopped: 'stopped',
    playing: 'playing',
    paused:  'paused',
} as const;
export type PxPlayState = typeof PxPlayState[keyof typeof PxPlayState];

/** What the state rule asks for when an event arrives. @public @advanced */
export const PxTriggerAction = {
    /** The configured start, or a resume — the executor's state-rule `play()`. */
    play:  'play',
    pause: 'pause',
    /** The configured stop. */
    stop:  'stop',
} as const;
export type PxTriggerAction = typeof PxTriggerAction[keyof typeof PxTriggerAction];

// @px-area control
/** Whether any of the four lists names the event — the wiring listens only for those. @public @advanced */
export function triggerListsEvent(triggers: PxResolvedTriggers, event: PxTriggerEvent): boolean {
    return triggers.start.includes(event) || triggers.stop.includes(event) || triggers.pause.includes(event) || triggers.resume.includes(event);
}

// @px-area control
/** THE STATE RULE, decided once for every wiring — the web triggers, the CSS components, React Native: the
 *  player's state picks the list an event is read from. `pause` wins over `stop` while playing, `resume` wins
 *  over `stop` while paused (both reported as collisions, {@link triggerIssues}). @public @advanced */
export function triggerActionFor(triggers: PxResolvedTriggers, state: PxPlayState, event: PxTriggerEvent): PxTriggerAction | undefined {
    switch (state) {
        case PxPlayState.stopped:
            return triggers.start.includes(event) ? PxTriggerAction.play : undefined;
        case PxPlayState.paused:
            if (triggers.resume.includes(event)) return PxTriggerAction.play;
            return triggers.stop.includes(event) ? PxTriggerAction.stop : undefined;
        case PxPlayState.playing:
            if (triggers.pause.includes(event)) return PxTriggerAction.pause;
            return triggers.stop.includes(event) ? PxTriggerAction.stop : undefined;
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

/** `clone.without` — which part of the SOURCE'S OWN transform a `<use>` clone leaves
 *  out. Absent = the whole element, as SVG `<use>` (a direct link, moves with the source);
 *  `translate` = the source's placement is dropped, so the clone stays where the `<use>` put
 *  it but still rotates/scales with the source. A future value `transform` may drop the
 *  whole transform (content only) — not implemented yet.
 *  (Was `clone.type: 'content'`; the wire is subtractive because the mechanism is a
 *  ladder — the `<use>` can only point at one wrapper layer of the source.)
 *  Old doc line:
 *  `content` excludes the target's own translate (see `contentRefSplit`). * @public
 */
export const PxCloneWithout = {
    translate: 'translate',
    // transform: 'transform',   // future: drop rotate/scale too (content only)
} as const;

export type PxCloneWithout = typeof PxCloneWithout[keyof typeof PxCloneWithout];

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
    // a non-positive `playDuration` is ignored (it would be a division by zero as a rate).
    if (view.duration === undefined || (view.playDuration !== undefined && !(view.playDuration > 0))) {
        view = { ...view };
        if (view.duration === undefined) view.duration = (maxKeyframeTimeOf(doc) ?? PX_DEFAULT_DURATION_MS) - (view.inTime ?? 0);
        if (view.playDuration !== undefined && !(view.playDuration > 0)) delete view.playDuration;
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

    // `engine` and `frameRate` are shared by every timeline type: how the attributes get
    // updated, and at what rate when that is the player's own frame loop.
    if (timeline.engine !== undefined) flat.engine = timeline.engine;
    if (timeline.frameRate !== undefined) flat.frameRate = timeline.frameRate;

    if (timeline.type === 'scroll' || timeline.type === 'view') {
        flat.timelineSource = 'scroll';
        foldWindow(timeline, flat);
        if (timeline.iterations !== undefined) flat.iterations = timeline.iterations;
        const scroll: PxScroll = { ...(flat.scroll || {}) };
        scroll.kind = timeline.type;
        if (timeline.axis !== undefined) scroll.axis = timeline.axis;
        if (timeline.source !== undefined) scroll.source = timeline.source;
        if (timeline.subject !== undefined) scroll.subject = timeline.subject;
        if (timeline.smoothing !== undefined) scroll.smoothing = timeline.smoothing;
        if (timeline.range !== undefined) scroll.range = timeline.range;
        const pin = timeline.pin;
        if (typeof pin === 'boolean') scroll.pin = pin;
        else if (pin && typeof pin === 'object') {
            scroll.pin = true;
            if (pin.align !== undefined) scroll.pinAlign = pin.align;
            if (pin.offset !== undefined) scroll.pinOffset = pin.offset;
            if (pin.distance !== undefined) scroll.pinDistance = pin.distance;
        }
        flat.scroll = scroll;
    } else { // 'time', absent, or unknown — the time-driven timeline is the default
        foldWindow(timeline, flat);
        if (timeline.playDuration !== undefined) flat.playDuration = timeline.playDuration;
        // an EMPTY triggers block means "nothing starts it" — copied as it is
        if (timeline.triggers !== undefined) flat.triggers = { ...timeline.triggers };
        if (timeline.delay !== undefined) flat.delay = timeline.delay;
        if (timeline.iterations !== undefined) flat.iterations = timeline.iterations;
        if (timeline.iterationDirection !== undefined) flat.direction = timeline.iterationDirection;
        // the built-in actions' settings travel as their block; the engines' rest-pose view is derived from
        // two of them: `fill` (CSS animation-fill-mode) and `resetOnFinish`
        const actions = timeline.actions !== undefined ? cloneActions(timeline.actions) : undefined;
        if (actions !== undefined && Object.keys(actions).length > 0) flat.actions = actions;
        const finishTransition = timeline.actions?.finish?.transition;
        if (finishTransition !== undefined) flat.resetOnFinish = finishTransition === PxFinishTransition.reset;
        if (timeline.beforeStart !== undefined) flat.beforeStart = timeline.beforeStart;
        if (timeline.beforeStart !== undefined || finishTransition !== undefined) flat.fill = fillModeOf(timeline.beforeStart, finishTransition);
        if (timeline.inViewThreshold !== undefined) flat.inViewThreshold = timeline.inViewThreshold;
        if (timeline.inViewDebounce !== undefined) flat.inViewDebounce = timeline.inViewDebounce;
    }

    return flat;
}

/** The engines' CSS-style fill mode from the two settings that say it: the first frame before play
 *  (`beforeStart: firstFrame` → `backwards` / `both`) and the last frame after a natural end (finish `hold` →
 *  `forwards` / `both`). @public @advanced */
export function fillModeOf(beforeStart: PxBeforeStart | undefined, finishTransition: PxFinishTransition | undefined): PxFillMode {
    const before = (beforeStart ?? PX_PLAYBACK_DEFAULTS.beforeStart) === PxBeforeStart.firstFrame;
    const after = (finishTransition ?? PX_PLAYBACK_DEFAULTS.finishTransition) === PxFinishTransition.hold;
    return before ? (after ? PxFillMode.both : PxFillMode.backwards) : (after ? PxFillMode.forwards : PxFillMode.none);
}

/** A copy of an `actions` block, one level per action (the blocks are tiny and plain); an EMPTY action
 *  block says nothing (every field its default), so it is dropped — the canonical form. */
function cloneActions(actions: PxActions): PxActions {
    const copy: PxActions = {};
    const said = <T extends object>(block: T | undefined): block is T => block !== undefined && Object.keys(block).length > 0;
    if (said(actions.start)) copy.start = { ...actions.start };
    if (said(actions.stop)) copy.stop = { ...actions.stop };
    if (said(actions.finish)) copy.finish = { ...actions.finish };
    if (said(actions.suspend)) copy.suspend = { ...actions.suspend };
    return copy;
}

/**
 * Which scroll-driven member an absent `scroll.kind` selects — `'view'`, per `_PxScroll.kind`.
 *
 * The flat view says WHICH FAMILY drives progress (`timelineSource: 'scroll'`) separately from
 * WHICH MEMBER of it (`scroll.kind`), and only the family is named "scroll". Defaulting the
 * member to its family's name reads natural and is wrong: it silently rewrote every document
 * that left the kind at its default — which, being the default, is most of them.
 */
function scrollKindOrDefault(kind: unknown): 'view' | 'scroll' {
    return kind === 'scroll' ? 'scroll' : 'view';
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

    const { timelineSource, scroll, triggers, actions, delay, iterations, direction, fill, resetOnFinish,
            beforeStart, inViewThreshold, inViewDebounce,
            duration, inTime, playDuration, engine, frameRate, ...shared } = cfg;
    // flat `duration` is the WINDOW LENGTH; on the wire the window is written as its two points
    const writeWindow = (timeline: { inTime?: number; outTime?: number }) => {
        if (inTime !== undefined && inTime !== 0) timeline.inTime = inTime;
        if (duration !== undefined) timeline.outTime = (inTime ?? 0) + duration;
    };

    if (timelineSource === 'scroll') {
        const timeline: _PxScrollishTimelineShape & { type: 'scroll' | 'view' } = { type: scrollKindOrDefault(scroll?.kind) };
        if (engine !== undefined) timeline.engine = engine;
        if (frameRate !== undefined) timeline.frameRate = frameRate;
        writeWindow(timeline);
        // Finite iterations survive scrubbing (D4); 'infinite' cannot map to a range.
        if (typeof iterations === 'number') timeline.iterations = iterations;
        if (scroll) {
            if (scroll.axis !== undefined) timeline.axis = scroll.axis;
            if (scroll.source !== undefined) timeline.source = scroll.source;
            if (scroll.subject !== undefined) timeline.subject = scroll.subject;
            if (scroll.smoothing !== undefined) timeline.smoothing = scroll.smoothing;
            if (scroll.range !== undefined) timeline.range = scroll.range;
            const hasPinParams = scroll.pinAlign !== undefined || scroll.pinOffset !== undefined || scroll.pinDistance !== undefined;
            if (hasPinParams) {
                timeline.pin = {
                    ...(scroll.pinAlign !== undefined ? { align: scroll.pinAlign } : {}),
                    ...(scroll.pinOffset !== undefined ? { offset: scroll.pinOffset } : {}),
                    ...(scroll.pinDistance !== undefined ? { distance: scroll.pinDistance } : {}),
                };
            } else if (scroll.pin !== undefined) {
                timeline.pin = scroll.pin;
            }
        }
        return { ...shared, timeline };
    }

    // Time-driven: `type` is optional on the wire and 'time' is the default, so the
    // writer omits it — the common case declares nothing.
    const timeline: _PxTimeTimeline = {};
    if (engine !== undefined) timeline.engine = engine;
    if (frameRate !== undefined) timeline.frameRate = frameRate;
    writeWindow(timeline);
    if (playDuration !== undefined) timeline.playDuration = playDuration;
    if (triggers !== undefined) timeline.triggers = { ...triggers };
    if (delay !== undefined) timeline.delay = delay;
    if (iterations !== undefined) timeline.iterations = iterations;
    if (direction !== undefined) timeline.iterationDirection = direction;
    // the actions block; the rest-pose view back to its two settings: `fill` / `resetOnFinish` → the finish
    // transition and the rest pose
    const nested: PxActions = actions !== undefined ? cloneActions(actions) : {};
    if (nested.finish?.transition === undefined && (resetOnFinish || fill === PxFillMode.none || fill === PxFillMode.backwards)) {
        nested.finish = { ...nested.finish, transition: PxFinishTransition.reset };
    }
    if (Object.keys(nested).length > 0) timeline.actions = nested;
    if (beforeStart !== undefined) timeline.beforeStart = beforeStart;
    else if (fill === PxFillMode.backwards || fill === PxFillMode.both) timeline.beforeStart = PxBeforeStart.firstFrame;
    if (inViewThreshold !== undefined) timeline.inViewThreshold = inViewThreshold;
    if (inViewDebounce !== undefined) timeline.inViewDebounce = inViewDebounce;

    // An empty time timeline says nothing — omit the block entirely.
    return Object.keys(timeline).length > 0 ? { ...shared, timeline } : shared;
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
