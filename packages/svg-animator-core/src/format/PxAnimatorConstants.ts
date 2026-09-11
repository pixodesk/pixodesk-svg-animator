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
// call. See PRERENDERED-PLAYER-BUILDS.md.
//
// RULE: nothing in this file may import a VALUE from `PxAnimatorTypes`. Type-only imports
// are fine — they are erased at build time and cannot create a runtime edge.
// ============================================================================

import type { PxAnimatedSvgDocument, PxAnimatorConfig, PxBinding, PxDefs, PxNode, PxScroll, PxTrigger } from './PxAnimatorTypes';

export type FillMode = 'forwards' | 'backwards' | 'both' | 'none';

export type PlaybackDirection = 'normal' | 'reverse' | 'alternate' | 'alternate-reverse';


export const PX_ANIM_SRC_ATTR_NAME = 'data-px-animation-src';

export const PX_ANIM_ATTR_NAME = '_px_animator';

export type StartOn = 'load' | 'mouseOver' | 'click' | 'scrollIntoView';

export type OutAction = 'continue' | 'pause' | 'reset' | 'reverse';

/** WIRE `timeline.engine` — who runs the animation. `auto` (default) prefers the
 *  platform's animation API and falls back to JS when the document needs something it
 *  cannot express; `native` DEMANDS that API (WAAPI — and, for scroll/view timelines,
 *  the browser's ScrollTimeline) with no fallback; `js` pins the player's own frame loop
 *  and its own progress measurement. Const-namespace + matching string type so call
 *  sites use named members (`PxTimelineEngineExtra.js`), not bare literals.
 *
 *  NAMED `engine`, not `mode`: it selects HOW the animated attributes get updated, not
 *  WHAT you see — an implementation preference. (`native` is the one value that can also
 *  change the outcome: being a demand, an attribute WAAPI declines simply does not
 *  animate. See `isNativeForced`.) */
/** Timeline keys that BOTH union members carry, so they survive a change of `type`. */
export const PX_TIMELINE_SHARED_KEYS = ['duration', 'iterations', 'engine', 'frameRate'] as const;

/** Timeline keys that exist ONLY on the time-driven member — a scroll/view timeline is
 *  scrubbed by position, so nothing starts it and nothing delays it. */
export const PX_TIME_ONLY_TIMELINE_KEYS = ['trigger', 'delay', 'fillMode', 'direction'] as const;

/**
 * THE ENGINES — the two things that can actually update an animated attribute: hand it to the
 * platform's animation API (`native`), or write it from the player's own frame loop (`js`).
 *
 * This is the CORE set. Code that always knows which engine is running takes this (e.g.
 * `getNormalisedBindings`'s `engine` arg gates motion-along-path materialisation).
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
 */
export const PxTimelineEngineExtra = {
    ...PxTimelineEngine,
    auto: 'auto',
} as const;

export type PxTimelineEngineExtra = typeof PxTimelineEngineExtra[keyof typeof PxTimelineEngineExtra];

/** What a requested engine resolves to BEFORE the runtime probes support: `js` pins the frame
 *  loop, anything else starts at `native`. NOTE this is only the STARTING point — `auto` still
 *  falls back to `js` per document when the platform API declines an attribute, which happens at
 *  bind time (see `PxAnimatorBind`), not here. */
export function resolveTimelineEngine(engine: PxTimelineEngineExtra | undefined): PxTimelineEngine {
    return engine === PxTimelineEngineExtra.js ? PxTimelineEngine.js : PxTimelineEngine.native;
}

/** `native` is a demand, not a preference: no JS fallback when the platform API declines an attribute. */
export function isNativeForced(engine: PxTimelineEngineExtra | undefined): boolean {
    return engine === PxTimelineEngineExtra.native;
}

/** May the browser's ScrollTimeline/ViewTimeline drive a scroll/view timeline?
 *  `auto` tries it first (falling back to the player's own measurement), `native`
 *  asks for it, `js` never uses it. */
export function mayUseNativeScrollTimeline(engine: PxTimelineEngineExtra | undefined): boolean {
    return engine !== PxTimelineEngineExtra.js;
}

/**
 * THE TRIGGER DEFAULTS — what a missing `trigger` field means. One table, declared by
 * `PxTriggerSchema` and applied by {@link resolveTrigger}, which every player calls (the web's
 * `setupAnimationTriggers`, the React Native component) — so a file behaves the same everywhere:
 *   - `startOn` 'load' — a document is designed to play
 *   - `outAction` 'continue' — leaving the trigger does not interrupt playback
 *   - `scrollIntoViewThreshold` 0 — any visible pixel counts
 */
export const PX_TRIGGER_DEFAULTS = {
    startOn: 'load',
    outAction: 'continue',
    scrollIntoViewThreshold: 0,
} as const;

/** A trigger with every default filled in. */
export interface PxResolvedTrigger {
    readonly startOn: NonNullable<PxTrigger['startOn']>;
    readonly outAction: NonNullable<PxTrigger['outAction']>;
    readonly scrollIntoViewThreshold: number;
}

/** A document's trigger with the defaults filled in. (`finishAction` is not a start/stop decision:
 *  it reaches the engines as the runtime view's `resetOnFinish`.) */
export function resolveTrigger(trigger: PxTrigger | undefined): PxResolvedTrigger {
    return {
        startOn: trigger?.startOn ?? PX_TRIGGER_DEFAULTS.startOn,
        outAction: trigger?.outAction ?? PX_TRIGGER_DEFAULTS.outAction,
        scrollIntoViewThreshold: trigger?.scrollIntoViewThreshold ?? PX_TRIGGER_DEFAULTS.scrollIntoViewThreshold,
    };
}

// V3 — every closed value list is a NAMED const + a strict `px.enum` slot, so a
// typo is a schema ERROR instead of silently shipping. Plain `px.string()` stays
// ONLY where SVG itself is open-ended (`gradientTransform`, `viewBox`, `path` d,
// ids/refs, `debugGlobalName`).

/** `loop.repeatAt` — WHICH END of the keyframe sequence the repeated segment is taken
 *  from, and therefore which side of the timeline the repetition fills. A named
 *  two-way selector (not a boolean) so a third value stays possible. */
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
 *  own `direction` so the two read as one idea. */
export const PxLoopDirection = {
    /** DEFAULT — cycle: every repetition replays the segment the same way round. */
    normal: 'normal',
    /** Ping-pong: repetitions alternate forward / backward. */
    alternate: 'alternate',
} as const;

export type PxLoopDirection = typeof PxLoopDirection[keyof typeof PxLoopDirection];

/** SVG `mask-type` — how the mask source's pixels become alpha. */
export const PxMaskType = {
    luminance: 'luminance',
    alpha:     'alpha',
} as const;

export type PxMaskType = typeof PxMaskType[keyof typeof PxMaskType];

/** SVG coordinate system for `maskUnits` / `maskContentUnits` (and the gradient twin below). */
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
 *  `content` excludes the target's own translate (see `contentRefSplit`). */
export const PxCloneWithout = {
    translate: 'translate',
    // transform: 'transform',   // future: drop rotate/scale too (content only)
} as const;

export type PxCloneWithout = typeof PxCloneWithout[keyof typeof PxCloneWithout];

/** `textPath.pathOverflow` — glyphs past the path end: hide them, or keep laying
 *  them along the tangent extension. */
export const PxPathOverflow = {
    clip:   'clip',
    extend: 'extend',
} as const;

export type PxPathOverflow = typeof PxPathOverflow[keyof typeof PxPathOverflow];

/** SVG `lengthAdjust` — what `textLength` stretches. */
export const PxLengthAdjust = {
    spacing:          'spacing',
    spacingAndGlyphs: 'spacingAndGlyphs',
} as const;

export type PxLengthAdjust = typeof PxLengthAdjust[keyof typeof PxLengthAdjust];

/** SVG `<textPath method>` — how glyphs follow curvature. */
export const PxTextPathMethod = {
    align:   'align',
    stretch: 'stretch',
} as const;

export type PxTextPathMethod = typeof PxTextPathMethod[keyof typeof PxTextPathMethod];

/** SVG `<textPath spacing>` — whether the renderer may adjust spacing. */
export const PxTextPathSpacing = {
    auto:  'auto',
    exact: 'exact',
} as const;

export type PxTextPathSpacing = typeof PxTextPathSpacing[keyof typeof PxTextPathSpacing];

/** `strokeTrim.subPaths` — what the 0..1 `range`/`offset` window is measured over.
 *  `separate` (default): each sub-path against its OWN length, all trimmed alike.
 *  `combined`: every descendant sub-path chained end-to-end into one virtual path,
 *  so the window slides across siblings (AE "Trim All As One"). */
export const PxStrokeTrimSubPaths = {
    separate: 'separate',
    combined: 'combined',
} as const;

export type PxStrokeTrimSubPaths = typeof PxStrokeTrimSubPaths[keyof typeof PxStrokeTrimSubPaths];


// S8: `textContent` is the ONE text-content key (the DOM property name). `text` is not a wire
// key: it was triply overloaded (the `text` tag, the `effects.text` group, and a content alias)
// and no reader accepts it.
export const TEXT_CONTENT_ATTR = 'textContent';

/** The DOM `class` attribute. A name we EMIT but do not own, so it is written through this
 *  constant rather than as an identifier — every other emitted attribute name reaches the
 *  DOM as a string, and `class` was the one exception, which is why the minifier renamed it
 *  to `ct` in the shipped bundles (MINIFICATION-BOUNDARY-PLAN.md §1.1). */
export const CLASS_ATTR = 'class';

/** The DOM `transform` attribute, and the key the animation record uses for it. Both are
 *  DATA names — a dictionary key, not a field of one of our typed structures — so they are
 *  written as constants rather than as identifiers. */
export const TRANSFORM_ATTR = 'transform';

/** `animate.offsetDistance` — the CSS Motion Path channel the offset-path materialiser writes. */
export const OFFSET_DISTANCE_ATTR = 'offsetDistance';

// Wire keys that are NEVER DOM attributes (internal use only).
//
// `effects` is here for safety rather than necessity: `applyPlayerEffects` deletes it at
// load, so today nothing reaches the renderer with it still attached. That is a property
// of the pipeline, though, not of the contract — an effect path that returns early, or a
// document carrying an effect key the pipeline does not recognise, would otherwise leave
// the object behind and the renderer would write `effects="[object Object]"` with no error
// anywhere. Listing it makes the invariant structural (J4).
export const INTERNAL_ATTRS = new Set([
    'type', 'children', 'animator', 'meta', 'animate', 'effects', TEXT_CONTENT_ATTR
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

export const PX_TRANSFORM_PART_KEYS = [
    TRANSFORM_PART.translate, TRANSFORM_PART.rotate, TRANSFORM_PART.scale, TRANSFORM_PART.origin,
] as const;

/** One of the transform-part key strings. */
export type PxTransformPartKey = typeof PX_TRANSFORM_PART_KEYS[number];

// ─────────────────────────────────────────────────────────────────────────────
// Gradient paint effect — `fillGradient` / `strokeGradient`.
//
// Materialiser pattern mirrors `maskedByEffect`: at apply time the gradient
// effect generates a `<linearGradient>` / `<radialGradient>` def into `ctx.defs`,
// then sets the host element's `fill` / `stroke` to `url(#auto-id)`. The wire
// gradient is geometry parts (`p1`/`p2` linear, `c`/`r`/`fp` radial — standard
// animatable slots) + a stop sequence that is either static (bare array) or
// animated (a single `{keyframes}` block whose each kf's `value` is the FULL
// `Array<{offset, color}>` snapshot at that time). Per-stop independent
// timelines are intentionally NOT modelled — the source is a single
// stop-colour keyframe group. Animated geometry is frames-engine only
// (CSS/WAAPI cannot animate gradient endpoints; `mode: 'auto'` handles it).
//
// Stop count is constant across kfs. `gradientTransform` is captured as static
// only (animated transform is vanishingly rare).
// ─────────────────────────────────────────────────────────────────────────────

/** Loose enums for `gradientUnits` / `spreadMethod` — kept on the wire as
 *  plain strings (matches the rest of the schema's loose-enum stance) but
 *  collected here so call sites use named constants instead of bare literals. */
export const PxGradientUnits = {
    userSpaceOnUse:    'userSpaceOnUse',
    objectBoundingBox: 'objectBoundingBox',
} as const;

export type PxGradientUnits = typeof PxGradientUnits[keyof typeof PxGradientUnits];

export const PxGradientSpreadMethod = {
    pad:     'pad',
    reflect: 'reflect',
    repeat:  'repeat',
} as const;

export type PxGradientSpreadMethod = typeof PxGradientSpreadMethod[keyof typeof PxGradientSpreadMethod];

export const PxGradientType = {
    linear: 'linear',
    radial: 'radial',
} as const;

export type PxGradientType = typeof PxGradientType[keyof typeof PxGradientType];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function isPxElementFileFormat(fileJson: any): fileJson is PxAnimatedSvgDocument {
    if (!(
        fileJson &&
        typeof fileJson === 'object' &&
        !Array.isArray(fileJson)
    )) {
        return false;
    }

    // `type` is the tag, and the ONLY discriminator — it is what the schema requires
    // (`px.literal('svg')`). A `tagName` alternative was accepted here until 2026-08,
    // which meant a tagName-only document passed this gate and then failed
    // `isPxElementFileFormatDeep`; nothing ever wrote it.
    return fileJson.type === 'svg';
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
 */
export function getAnimatorConfig(doc: PxAnimatedSvgDocument): PxAnimatorConfig | undefined {
    const cfg = doc?.animator || doc?.meta?.animator;
    // Every internal consumer sees the FLAT view — the nested `timeline` spelling is
    // folded down here, once, so the engines/effects/drivers never branch on it.
    return cfg ? flattenAnimatorTimeline(cfg) : undefined;
}


// ============================================================================
// TIMELINE SPELLING (review §2.1)
//
// The wire spelling is `animator.timeline: { type?: 'time'|'scroll'|'view', … }` (absent = 'time');
// the flat form (`timelineSource` + `scroll` + loose clock knobs) is the INTERNAL
// runtime view only — not a wire format. These two functions convert between them:
//   • flattenAnimatorTimeline — wire → runtime view; applied by `getAnimatorConfig`,
//     so ALL runtime code keeps consuming the flat form it always has.
//   • nestAnimatorTimeline — runtime view → wire; applied by writers (the editor) so
//     files carry only the nested spelling and its mode-dead keys are structurally absent.
// ============================================================================

/** Memo: flatten allocates a new config; repeated `getAnimatorConfig` calls must keep
 *  returning the SAME object (some callers compare identity / cache off it). */
const flattenMemo = new WeakMap<object, PxAnimatorConfig>();

/**
 * Folds `cfg.timeline` (the wire spelling) into the flat runtime-view fields the engines
 * consume. Returns `cfg` unchanged when there is nothing to fold. Never mutates input.
 */
export function flattenAnimatorTimeline(cfg: PxAnimatorConfig): PxAnimatorConfig {
    const timeline: any = (cfg as any).timeline;
    if (timeline === undefined || timeline === null || typeof timeline !== 'object') return cfg;

    const memoised = flattenMemo.get(cfg as object);
    if (memoised) return memoised;

    const { timeline: _dropped, ...flat } = cfg as any;

    // `engine` and `frameRate` are shared by every timeline type: how the attributes get
    // updated, and at what rate when that is the player's own frame loop.
    if (timeline.engine !== undefined) flat.engine = timeline.engine;
    if (timeline.frameRate !== undefined) flat.frameRate = timeline.frameRate;

    if (timeline.type === 'scroll' || timeline.type === 'view') {
        flat.timelineSource = 'scroll';
        if (timeline.duration !== undefined) flat.duration = timeline.duration;   // §2.8
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
            if (pin.top !== undefined) scroll.pinTop = pin.top;
            if (pin.distance !== undefined) scroll.pinDistance = pin.distance;
        }
        flat.scroll = scroll;
    } else { // 'time', absent, or unknown — the time-driven timeline is the default
        if (timeline.duration !== undefined) flat.duration = timeline.duration;   // §2.8
        if (timeline.trigger !== undefined) {
            const { finishAction, ...restTrigger } = timeline.trigger;
            if (Object.keys(restTrigger).length) flat.trigger = restTrigger;
            if (finishAction !== undefined) flat.resetOnFinish = finishAction === 'reset';
        }
        if (timeline.delay !== undefined) flat.delay = timeline.delay;
        if (timeline.iterations !== undefined) flat.iterations = timeline.iterations;
        if (timeline.direction !== undefined) flat.direction = timeline.direction;
        if (timeline.fillMode !== undefined) flat.fill = timeline.fillMode;   // wire `fillMode` → runtime `fill`
    }

    flattenMemo.set(cfg as object, flat);
    return flat;
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
 */
export function nestAnimatorTimeline(cfg: PxAnimatorConfig): PxAnimatorConfig {
    if (!cfg || (cfg as any).timeline !== undefined) return cfg;

    const { timelineSource, scroll, trigger, delay, iterations, direction, fill, resetOnFinish,
            duration, engine, frameRate, ...shared } = cfg as any;

    if (timelineSource === 'scroll') {
        const timeline: any = { type: scrollKindOrDefault(scroll?.kind) };
        if (engine !== undefined) timeline.engine = engine;
        if (frameRate !== undefined) timeline.frameRate = frameRate;
        if (duration !== undefined) timeline.duration = duration;   // §2.8
        // Finite iterations survive scrubbing (D4); 'infinite' cannot map to a range.
        if (typeof iterations === 'number') timeline.iterations = iterations;
        if (scroll) {
            if (scroll.axis !== undefined) timeline.axis = scroll.axis;
            if (scroll.source !== undefined) timeline.source = scroll.source;
            if (scroll.subject !== undefined) timeline.subject = scroll.subject;
            if (scroll.smoothing !== undefined) timeline.smoothing = scroll.smoothing;
            if (scroll.range !== undefined) timeline.range = scroll.range;
            const hasPinParams = scroll.pinAlign !== undefined || scroll.pinTop !== undefined || scroll.pinDistance !== undefined;
            if (hasPinParams) {
                timeline.pin = {
                    ...(scroll.pinAlign !== undefined ? { align: scroll.pinAlign } : {}),
                    ...(scroll.pinTop !== undefined ? { top: scroll.pinTop } : {}),
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
    const timeline: any = {};
    if (engine !== undefined) timeline.engine = engine;
    if (frameRate !== undefined) timeline.frameRate = frameRate;
    if (duration !== undefined) timeline.duration = duration;   // §2.8
    if (trigger !== undefined || resetOnFinish) {
        const t: any = { ...(trigger || {}) };
        if (resetOnFinish) t.finishAction = 'reset';
        timeline.trigger = t;
    }
    if (delay !== undefined) timeline.delay = delay;
    if (iterations !== undefined) timeline.iterations = iterations;
    if (direction !== undefined) timeline.direction = direction;
    if (fill !== undefined) timeline.fillMode = fill;   // runtime `fill` → wire `fillMode`

    // An empty time timeline says nothing — omit the block entirely.
    return Object.keys(timeline).length > 0 ? { ...shared, timeline } : shared;
}


export function getDefs(doc: PxAnimatedSvgDocument): PxDefs | undefined {
    if (!doc) return undefined;
    return getAnimatorConfig(doc)?.definitions;
}

export function getBindings(doc: PxAnimatedSvgDocument): PxBinding[] | undefined {
    if (!doc) return undefined;
    const animateById = getAnimatorConfig(doc)?.animateById;
    if (!animateById) return undefined;
    // Keys are `#id`-spelled (review §3.2 — EVERY element reference carries the hash,
    // record keys included); the binding id is the bare DOM id.
    return Object.entries(animateById).map(([id, anim]) => ({ id: id.startsWith('#') ? id.slice(1) : id, animate: anim }));
}


export function getChildren(doc: PxAnimatedSvgDocument): PxNode[] | undefined {
    return doc?.children;
}
