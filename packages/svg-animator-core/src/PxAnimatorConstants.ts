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

import type { PxAnimatedSvgDocument, PxAnimatorConfig, PxBinding, PxDefs, PxNode, PxScroll } from './PxAnimatorTypes';

export type FillMode = 'forwards' | 'backwards' | 'both' | 'none';

export type PlaybackDirection = 'normal' | 'reverse' | 'alternate' | 'alternate-reverse';

export const PX_ANIM_SRC_ATTR_NAME = 'data-px-animation-src';

export const PX_ANIM_ATTR_NAME = '_px_animator';

export type StartOn = 'load' | 'mouseOver' | 'click' | 'scrollIntoView';

export type OutAction = 'continue' | 'pause' | 'reset' | 'reverse';

/** Animation engine selection (config level). `auto` means "try `waapi`, fall
 *  back to `frames`"; the runtime resolves it to a concrete {@link PxAnimatorEngine}
 *  via `createAnimatorFromConfig`. Wire as a const-namespace + matching string
 *  type so call sites can use named members (`PxAnimatorMode.frames`) instead of
 *  bare string literals. */
export const PxAnimatorMode = {
    auto:   'auto',
    waapi: 'waapi',
    frames: 'frames',
} as const;

export type PxAnimatorMode = typeof PxAnimatorMode[keyof typeof PxAnimatorMode];

/** Resolved engine after `auto` dispatch — used downstream by code that always
 *  knows exactly which engine is running (e.g. `getNormalisedBindings`'s
 *  `engine` arg gates motion-along-path materialisation). Strictly a subset of
 *  {@link PxAnimatorMode} (no `auto`). */
export const PxAnimatorEngine = {
    waapi: PxAnimatorMode.waapi,
    frames: PxAnimatorMode.frames,
} as const;

export type PxAnimatorEngine = typeof PxAnimatorEngine[keyof typeof PxAnimatorEngine];

// V3 — every closed value list is a NAMED const + a strict `px.enum` slot, so a
// typo is a schema ERROR instead of silently shipping. Plain `px.string()` stays
// ONLY where SVG itself is open-ended (`gradientTransform`, `viewBox`, `path` d,
// ids/refs, `debugInstName`).

/** `loop.extend` — WHICH END of the keyframe sequence the loop segment is taken from,
 *  and therefore which side the animation is extended on. Replaced the boolean
 *  `before` (N8): a bare preposition named no subject ("before what?"), and a
 *  two-way selector reads better as a named enum — which also leaves room for a
 *  third value (e.g. both ends) that a boolean forecloses. */
export const PxLoopExtend = {
    /** Segment from the START; the animation is extended BEFORE the first keyframe
     *  (intro loops that run before the main timeline begins). */
    before: 'before',
    /** DEFAULT — segment from the END; extended AFTER the last keyframe (idle/outro
     *  loops that continue once the main timeline has finished). */
    after: 'after',
} as const;

export type PxLoopExtend = typeof PxLoopExtend[keyof typeof PxLoopExtend];

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

/** `clone.type` — WHAT a `<use>` clones. Absent = the whole element (a direct link);
 *  `content` excludes the target's own translate (see `contentRefSplit`). */
export const PxCloneType = {
    content: 'content',
} as const;

export type PxCloneType = typeof PxCloneType[keyof typeof PxCloneType];

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

/** @deprecated Backwards-compatibility alias — use {@link PxAnimatorMode} for the type. */
export type JsMode = PxAnimatorMode;

// S8: `textContent` is the CANONICAL text-content key (DOM property name;
// `text` was triply overloaded: the `text` tag, the `effects.text` group, and
// this key). `text` is READ-ONLY legacy — readers accept both, writers emit
// only `textContent`.
export const TEXT_ATTR = 'text';

export const TEXT_CONTENT_ATTR = 'textContent';

// Wire keys that are NEVER DOM attributes (internal use only).
//
// `effects` is here for safety rather than necessity: `applyPlayerEffects` deletes it at
// load, so today nothing reaches the renderer with it still attached. That is a property
// of the pipeline, though, not of the contract — an effect path that returns early, or a
// document carrying an effect key the pipeline does not recognise, would otherwise leave
// the object behind and the renderer would write `effects="[object Object]"` with no error
// anywhere. Listing it makes the invariant structural (J4).
export const INTERNAL_ATTRS = new Set([
    'type', 'children', 'animator', 'meta', 'animate', 'effects', TEXT_ATTR, TEXT_CONTENT_ATTR
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
export const PX_TRANSFORM_PART_KEYS = ['translate', 'rotate', 'scale', 'origin'] as const;

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
    return fileJson['type'] === 'svg';
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
// The wire spelling is `animator.timeline: { type: 'clock'|'scroll'|'view', … }`;
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

    if (timeline.type === 'scroll' || timeline.type === 'view') {
        flat.timelineSource = 'scroll';
        if (timeline.iterations !== undefined) flat.iterations = timeline.iterations;
        const scroll: PxScroll = { ...(flat.scroll || {}) };
        scroll.kind = timeline.type;
        if (timeline.engine !== undefined) scroll.driver = timeline.engine;
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
    } else { // 'clock' (or unknown type — treated as clock, the default mechanism)
        if (timeline.trigger !== undefined) {
            const { onFinish, ...restTrigger } = timeline.trigger;
            if (Object.keys(restTrigger).length) flat.trigger = restTrigger;
            if (onFinish !== undefined) flat.resetOnFinish = onFinish === 'reset';
        }
        if (timeline.delay !== undefined) flat.delay = timeline.delay;
        if (timeline.iterations !== undefined) flat.iterations = timeline.iterations;
        if (timeline.direction !== undefined) flat.direction = timeline.direction;
        if (timeline.fill !== undefined) flat.fill = timeline.fill;
    }

    flattenMemo.set(cfg as object, flat);
    return flat;
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
            ...shared } = cfg as any;

    if (timelineSource === 'scroll') {
        const timeline: any = { type: scroll?.kind === 'view' ? 'view' : 'scroll' };
        // Finite iterations survive scrubbing (D4); 'infinite' cannot map to a range.
        if (typeof iterations === 'number') timeline.iterations = iterations;
        if (scroll) {
            if (scroll.driver !== undefined) timeline.engine = scroll.driver;
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

    const timeline: any = { type: 'clock' };
    if (trigger !== undefined || resetOnFinish) {
        const t: any = { ...(trigger || {}) };
        if (resetOnFinish) t.onFinish = 'reset';
        timeline.trigger = t;
    }
    if (delay !== undefined) timeline.delay = delay;
    if (iterations !== undefined) timeline.iterations = iterations;
    if (direction !== undefined) timeline.direction = direction;
    if (fill !== undefined) timeline.fill = fill;

    // A clock timeline with nothing but its type says nothing — omit the block entirely.
    return Object.keys(timeline).length > 1 ? { ...shared, timeline } : shared;
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
