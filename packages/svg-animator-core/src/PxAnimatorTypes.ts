/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { KeysMatch, PxInfer, PxSchema, PxValidationContext, RemoveIndex } from './PxSchema';
import { implementsInterface, px } from './PxSchema';

export type FillMode = 'forwards' | 'backwards' | 'both' | 'none';

export type PlaybackDirection = 'normal' | 'reverse' | 'alternate' | 'alternate-reverse';

export const PX_ANIM_SRC_ATTR_NAME = 'data-px-animation-src';

export const PX_ANIM_ATTR_NAME = '_px_animator';

export type StartOn = 'load' | 'mouseOver' | 'click' | 'scrollIntoView';

export type OutAction = 'continue' | 'pause' | 'reset' | 'reverse';

/** Animation engine selection (config level). `auto` means "try `webapi`, fall
 *  back to `frames`"; the runtime resolves it to a concrete {@link PxAnimatorEngine}
 *  via `createAnimatorFromConfig`. Wire as a const-namespace + matching string
 *  type so call sites can use named members (`PxAnimatorMode.frames`) instead of
 *  bare string literals. */
export const PxAnimatorMode = {
    auto:   'auto',
    webapi: 'webapi',
    frames: 'frames',
} as const;
export type PxAnimatorMode = typeof PxAnimatorMode[keyof typeof PxAnimatorMode];

/** Resolved engine after `auto` dispatch — used downstream by code that always
 *  knows exactly which engine is running (e.g. `getNormalisedBindings`'s
 *  `engine` arg gates motion-along-path materialisation). Strictly a subset of
 *  {@link PxAnimatorMode} (no `auto`). */
export const PxAnimatorEngine = {
    webapi: PxAnimatorMode.webapi,
    frames: PxAnimatorMode.frames,
} as const;
export type PxAnimatorEngine = typeof PxAnimatorEngine[keyof typeof PxAnimatorEngine];

/** @deprecated Backwards-compatibility alias — use {@link PxAnimatorMode} for the type. */
export type JsMode = PxAnimatorMode;


export const TEXT_ATTR = 'text';
export const TEXT_CONTENT_ATTR = 'textContent';

// Attributes that should not be set on DOM elements (internal use only)
export const INTERNAL_ATTRS = new Set([
    'type', 'children', 'animator', 'meta', 'animate', TEXT_ATTR, TEXT_CONTENT_ATTR
]);


// ============================================================================
// EASING
// ============================================================================

/**
 * Easing function definition.
 * Can be a named reference to a predefined easing or a cubic-bezier array [x1, y1, x2, y2].
 *
 * @example "ease-in" | [0.68, -0.55, 0.265, 1.55]
 *
 * `string | [x1, y1, x2, y2]`
 */
export const PxEasingOrRefSchema = px.union([
    px.string(),
    px.tuple([px.number(), px.number(), px.number(), px.number()] as const),
]);

/**
 * Easing function definition.
 * Can be a named reference to a predefined easing or a cubic-bezier array [x1, y1, x2, y2].
 *
 * @example "ease-in" | "easeOut" | [0.68, -0.55, 0.265, 1.55]
 */
export type PxEasingOrRef = PxInfer<typeof PxEasingOrRefSchema>;


// ============================================================================
// KEYFRAME
// ============================================================================

/**
 * A single animation keyframe defining the state at a specific point in time.
 * Supports both full property names and short aliases for compact notation.
 */
export interface _PxKeyframe {

    /** Timestamp in milliseconds from animation start */
    time?: number;

    /** Short alias for "time" */
    t?: number;

    /** The value of the animated property at this keyframe */
    value?: any;

    /** Short alias for "value" */
    v?: any;

    /** Easing function applied to the interval from this keyframe to the next */
    easing?: PxEasingOrRef;

    /** Short alias for "easing" */
    e?: PxEasingOrRef;

    /**
     * Outgoing spatial tangent `[dx, dy]` for motion-along-path interpolation
     * (translate animations only).
     *
     * Stored as a *delta relative to* this keyframe's translate position —
     * the cubic Bezier segment between this kf and the next is built from
     * `(P0=value, P1=value+tangentOut, P2=next.value+next.tangentIn, P3=next.value)`.
     *
     * Defined when the segment leaving this keyframe is curved.
     */
    tangentOut?: [number, number];

    /** Short alias for "tangentOut" */
    to?: [number, number];

    /**
     * Incoming spatial tangent `[dx, dy]` for motion-along-path interpolation
     * (translate animations only). Delta relative to this keyframe's translate
     * position. See `tangentOut` for the segment construction.
     *
     * Defined when the segment arriving at this keyframe is curved.
     */
    tangentIn?: [number, number];

    /** Short alias for "tangentIn" */
    ti?: [number, number];

    /**
     * Editor-side UI state (whether the keyframe is selected in the timeline).
     * Declared here so strict-mode schema validation accepts it on the wire —
     * the Player ignores it.
     */
    selected?: boolean;
}

/**
 * Allowed shapes for a single keyframe `value` across the wire schema:
 *  - `number`                       — scalar properties (rotate-degree, opacity, offset-distance, …)
 *  - `Array<number>`                — vector properties (translate `[x,y]`, scale `[sx,sy]`, stroke-dasharray, RGBA …)
 *  - `string`                       — color (hex / `url(#…)` / named) and other string-valued props
 *  - `PxTransformParts`             — unified body `transform` parts record
 *                                     `{translate, rotate, scale, origin}`
 *  - `{ paths: Array<PxBezierPath> }` — animated SVG path `d` value
 *  - `Array<PxGradientStop>`        — gradient `stops` timeline (each kf value is
 *                                     the FULL `[{offset, color}, …]` snapshot)
 *
 * Plugged into `PxKeyframeSchema.value` / `.v` — every keyframe value on the
 * wire is validated against this union. The inferred TS type of `PxKeyframe`
 * stays permissive (`value?: any` via the generic default) so the duck-typed
 * interpolator code in `PxDefinitions.ts` (`prevV?.paths`,
 * `Array.isArray(prevV)`, …) keeps working without per-shape narrowing.
 */
export type _PxKeyframeValue =
    | string
    | number
    | Array<number>
    | PxTransformParts
    | { path: string }
    | { paths: Array<PxBezierPath> }
    | Array<_PxGradientStop>;

// `string | number | Array<number> | PxTransformParts | { path: string } | { paths: BezierPath[] }`
//
// `{ path: "M…" }` is the unified single-`d`-string form for animated paths
// (compound shapes are one string with multiple `M…` sub-paths); `{ paths: […] }`
// is the legacy bezier-array form, both accepted.
//
// `PxTransformPartsSchema` / `PxBezierPathSchema` are declared later in this
// file — `px.lazy` defers the lookup until validation time so the declarations
// stay in narrative order without a TDZ at module load.
export const PxKeyframeValueSchema = implementsInterface<_PxKeyframeValue>()(px.union([
    px.string(), // e.g. for colors
    px.number(),
    px.array(px.number()),
    px.lazy<PxTransformParts>(() => PxTransformPartsSchema, {}),
    px.object({ path: px.string() }),
    px.lazy<{ paths: Array<PxBezierPath> }>(() => px.object({ paths: px.array(PxBezierPathSchema) }), { paths: [] }),
    // Gradient `stops` timeline — each kf value is the full stops-array snapshot.
    px.lazy<Array<_PxGradientStop>>(() => px.array(PxGradientStopSchema), []),
]));

/** A single keyframe `value` — union of all wire-allowed shapes. */
export type PxKeyframeValue = PxInfer<typeof PxKeyframeValueSchema>;

// `{ time?:number, t?:number, value?:PxKeyframeValue, v?:PxKeyframeValue,
//    easing?:Easing, e?:Easing, tangentOut?:[dx,dy], tangentIn?:[dx,dy] }`
//
// `value` / `v` validate against {@link PxKeyframeValueSchema} — malformed
// keyframe values are now schema errors instead of passing as `px.any()`
// (SCHEMA-ANALYSIS I-5). The `_PxKeyframe` interface keeps `value?: any` (and
// `PxKeyframe<T = any>` its generic default) so the duck-typed interpolator
// access in `PxDefinitions.ts` stays untyped-permissive at compile time.
export const PxKeyframeSchema = implementsInterface<_PxKeyframe>()(px.object({
    time: px.number().optional(),
    t: px.number().optional(),
    value: PxKeyframeValueSchema.optional(),
    v: PxKeyframeValueSchema.optional(),
    easing: PxEasingOrRefSchema.optional(),
    e: PxEasingOrRefSchema.optional(),
    tangentOut: px.tuple([px.number(), px.number()] as const).optional(),
    to:         px.tuple([px.number(), px.number()] as const).optional(),  // short alias
    tangentIn:  px.tuple([px.number(), px.number()] as const).optional(),
    ti:         px.tuple([px.number(), px.number()] as const).optional(),  // short alias
    selected:   px.boolean().optional(),  // editor-side UI state (Player ignores it)
}));

/**
 * A single animation keyframe defining the state at a specific point in time.
 *
 * Generic over the keyframe `value` type for callers that know the per-property
 * value shape (e.g. `PxKeyframe<Vec2>` in the effect appliers). Defaults to
 * `any`, matching the schema (`value` is stored as `px.any()` on the wire).
 */
export type PxKeyframe<T = any> = Omit<PxInfer<typeof PxKeyframeSchema>, 'value' | 'v'> & { value?: T; v?: T };
const _ck_PxKeyframe: KeysMatch<PxKeyframe, _PxKeyframe> = true; // the key sets are identical


// ============================================================================
// LOOP
// ============================================================================

/**
 * Defines how a property's keyframe animation is extended beyond its defined keyframe range
 * by continuously repeating a chosen segment of the sequence.
 *
 * The repeated segment is a contiguous run of keyframe *intervals* (gaps between consecutive
 * keyframes). Which end of the sequence is repeated is controlled by `before`, and whether
 * each repetition plays in the same direction or alternates is controlled by `alternate`.
 *
 * **Relationship to `animator.iterations`**
 *
 * `PxLoop` and `animator.iterations` are independent mechanisms operating at different levels:
 *
 * - `PxLoop` is a **pre-processing step**: it expands the property's keyframe list to fill the
 *   full `animator.duration` before any playback begins. The runtime sees a single, fully
 *   expanded keyframe sequence — it has no knowledge of the loop.
 *
 * - `animator.iterations` repeats the **entire document timeline** (all properties, all
 *   elements) as a unit, after the expanded keyframes are already in place.
 *
 * The two compose independently: a property with `loop: true` inside a document with
 * `iterations: "infinite"` will cycle its own segment within each document iteration, and
 * that iteration will itself repeat forever — loop-within-loop.
 */
export interface _PxLoop {

    /**
     * Number of keyframe intervals (gaps between consecutive keyframes) that form the repeating
     * segment.
     *
     * - `undefined` → the entire keyframe sequence is used as the loop segment.
     * - `N`         → only the first `N` intervals (when `before: true`) or the last `N` intervals
     *                 (when `before: false`) are looped. Clamped to `[1, keyframes.length - 1]`.
     */
    segmentCount?: number;

    /**
     * Selects which end of the keyframe sequence is looped.
     *
     * - `true`  → the source segment is taken from the *start* of the keyframe sequence.
     *             The animation is extended *before* the first keyframe — useful for intro loops
     *             that run before the main timeline begins.
     *
     * - `false` (default) → the source segment is taken from the *end* of the keyframe sequence.
     *             The animation is extended *after* the last keyframe — useful for idle or outro
     *             loops that continue once the main timeline has finished.
     */
    before?: boolean;

    /**
     * Controls playback direction on each successive loop iteration.
     *
     * - `false` (default) → **cycle**: every iteration replays the segment in the same direction.
     *
     * - `true`  → **pingpong**: iterations alternate between forward and backward playback
     *             (even iterations play forward, odd iterations play in reverse).
     */
    alternate?: boolean;
}

// `{ segmentCount?:number, before?:boolean, alternate?:boolean }`
export const PxLoopSchema = implementsInterface<_PxLoop>()(px.object({
    segmentCount: px.number().optional(),
    before: px.boolean().optional(),
    alternate: px.boolean().optional(),
}));

/**
 * Defines how a property's keyframe animation is extended beyond its defined keyframe range
 * by continuously repeating a chosen segment of the sequence.
 */
export type PxLoop = PxInfer<typeof PxLoopSchema>;
const _ck_PxLoop: KeysMatch<PxLoop, _PxLoop> = true; // the key sets are identical


// ============================================================================
// PROPERTY ANIMATION
// ============================================================================

/**
 * Animation definition for a single CSS/SVG property.
 * Contains an array of keyframes that define how the property changes over time.
 */
export interface _PxPropertyAnimation {

    /**
     * Optional static / base value for the animated property.
     *
     * Two uses:
     *  - structured static: `{value}` with no keyframes is the static form of
     *    the universal animatable pattern (`PxAnimatable<T>`);
     *  - base + keyframes: when both are present, `value` is the baseline the
     *    animation starts from. For most properties keyframe values are
     *    complete and `value` is just the pre-tick DOM baseline; slots with
     *    patch semantics (the editor's extended-d `shape` effect) merge each
     *    keyframe's partial value over this base.
     */
    value?: any;

    /** Array of keyframes defining the animation timeline */
    keyframes?: PxKeyframe[];

    /** Short alias for "keyframes" */
    kfs?: PxKeyframe[];

    /**
     * Optional loop configuration. When set, the keyframe sequence is expanded at pre-processing
     * time to fill the gap between the keyframe range and `animator.duration` by repeating a
     * chosen segment. `true` is shorthand for the default {@link PxLoop} (loop the last segment
     * after the final keyframe, cycling forward). See {@link PxLoop} for details.
     *
     * Note: this operates independently of `animator.iterations` — see {@link _PxLoop} for the
     * interaction between the two.
     */
    loop?: PxLoop | boolean;

    /**
     * Motion-along-path "auto-orient" flag. Only meaningful for translate
     * animations whose keyframes carry spatial tangents (`tangentIn` /
     * `tangentOut`): when true, the element rotates so its local X axis aligns
     * with the path tangent at the current position. The rotation is computed
     * from the cubic-Bezier derivative at the eased progress along the
     * arc-length-parametrised segment.
     */
    autoOrient?: boolean;
}

// `{ value?:KeyframeValue, keyframes?:Keyframe[], kfs?:Keyframe[], loop?:Loop|boolean, autoOrient?:bool }`
export const PxPropertyAnimationSchema = implementsInterface<_PxPropertyAnimation>()(px.object({
    value: PxKeyframeValueSchema.optional(),
    keyframes: px.array(PxKeyframeSchema).optional(),
    kfs: px.array(PxKeyframeSchema).optional(),
    loop: px.union([PxLoopSchema, px.boolean()]).optional(),
    autoOrient: px.boolean().optional(),
}));

/** Animation definition for a single CSS/SVG property. */
export type PxPropertyAnimation = PxInfer<typeof PxPropertyAnimationSchema>;
const _ck_PxPropertyAnimation: KeysMatch<PxPropertyAnimation, _PxPropertyAnimation> = true; // the key sets are identical


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

/**
 * Record of transform parts forming a single transform `value`. Each present
 * key contributes one segment of the composed CSS transform string at render /
 * interpolation time, in the canonical order
 * `translate, translate(+origin), rotate, scale, translate(-origin)`.
 *
 * `origin` is meaningful only when `rotate` or `scale` is also present in the
 * same record — see "When does origin belong inside a keyframe value?" in
 * `file-format-remaining-design-issues2.md`.
 */
export interface _PxTransformParts {

    /** Translation offset `[x, y]` in user units. */
    translate?: [number, number];

    /** Rotation in degrees. */
    rotate?: number;

    /** Skew (skewX) in degrees, pivoting at `origin` — composed between `rotate`
     *  and `scale` (matches Lottie's transform order). */
    skew?: number;

    /** Scale factor `[sx, sy]`. */
    scale?: [number, number];

    /**
     * Pivot for rotate / scale `[x, y]`. Only meaningful alongside `rotate` or
     * `scale` in the same record.
     */
    origin?: [number, number];
}

// `{ translate?:[x,y], rotate?:deg, skew?:deg, scale?:[sx,sy], origin?:[x,y] }`
export const PxTransformPartsSchema = implementsInterface<_PxTransformParts>()(px.object({
    translate: px.tuple([px.number(), px.number()] as const).optional(),
    rotate: px.number().optional(),
    skew: px.number().optional(),
    scale: px.tuple([px.number(), px.number()] as const).optional(),
    origin: px.tuple([px.number(), px.number()] as const).optional(),
}));

/** Record of transform parts forming a single transform `value`. */
export type PxTransformParts = PxInfer<typeof PxTransformPartsSchema>;
const _ck_PxTransformParts: KeysMatch<PxTransformParts, _PxTransformParts> = true; // the key sets are identical

/**
 * Unified `transform` slot value. Three valid shapes:
 *
 * - **SVG transform string** — `"translate(10,10)rotate(45)scale(2,2)"`. What
 *   plain renderers consume directly.
 * - **Structured static** — `{value: PxTransformParts}`. Parametric record;
 *   parts stay independently addressable.
 * - **Animated** — `{keyframes: [{time, value: PxTransformParts, …}, …]}`.
 *   Each keyframe's `value` is a parts record. The interpolator composes the
 *   parts into a single transform string per frame.
 *
 * Replaces the earlier convention of putting each animated transform part
 * under its own top-level attribute name (`translate`, `rotate`, `scale`,
 * `origin`).
 */
export const PxTransformValueSchema = px.union([
    px.string(),
    px.object({ value: PxTransformPartsSchema }),
    PxPropertyAnimationSchema,
]);

/** Unified `transform` slot value: string | structured static | animated. */
export type PxTransformValue = PxInfer<typeof PxTransformValueSchema>;


// ============================================================================
// ANIMATION DEFINITION
// ============================================================================

/**
 * Complete animation definition containing one or more property animations.
 * Each key is a CSS/SVG property name (e.g., "opacity", "translate", "fill").
 *
 * @example
 * { "opacity": { keyframes: [...] }, "translate": { keyframes: [...] } }
 */
export interface _PxAnimationDefinition {
    [property: string]: PxPropertyAnimation;
}

// `Record<propName, PropertyAnimation>`
export const PxAnimationDefinitionSchema = implementsInterface<_PxAnimationDefinition>()(
    px.record(PxPropertyAnimationSchema)
);

/**
 * Complete animation definition containing one or more property animations.
 * Each key is a CSS/SVG property name (e.g., "opacity", "scale", "rotate").
 */
export type PxAnimationDefinition = PxInfer<typeof PxAnimationDefinitionSchema>;


// ============================================================================
// ELEMENT ANIMATION
// ============================================================================

/**
 * Element animation specification. Can be:
 * - A string referencing a named animation from `definitions.animations`
 * - An array of named references
 * - An inline `AnimationDefinition` object
 * - A mixed array of references and inline definitions
 *
 * @example
 * "fadeIn"
 * ["fadeIn", "spin"]
 * { opacity: { keyframes: [...] } }
 * ["fadeIn", { scale: { keyframes: [...] } }]
 */
export type _PxElementAnimation =
    | string
    | string[]
    | PxAnimationDefinition
    | (string | PxAnimationDefinition)[];

// `string | Array<string|AnimationDefinition> | AnimationDefinition`
export const PxElementAnimationSchema = implementsInterface<_PxElementAnimation>()(px.union([
    px.string(),
    px.array(px.union([px.string(), PxAnimationDefinitionSchema])),
    PxAnimationDefinitionSchema,
]));

/**
 * Element animation specification.
 * Can be a string reference, array of references, inline definition, or a mixed array.
 */
export type PxElementAnimation = PxInfer<typeof PxElementAnimationSchema>;


// ============================================================================
// TRIGGER
// ============================================================================

type StartOnExtra = StartOn | 'programmatic';

/**
 * Defines when and how an animation should be triggered.
 */
export interface _PxTrigger {

    /** Event that starts the animation */
    startOn?: StartOnExtra;

    /** Action to take when the trigger condition is no longer met (e.g., mouse leaves) */
    outAction?: 'continue' | 'pause' | 'reset' | 'reverse';

    /** Percentage of element visibility required to trigger (0–1, default 0 = any pixel).
     *  Only applies to scrollIntoView. */
    scrollIntoViewThreshold?: number;
}

// `{ startOn?:'load'|'mouseOver'|'click'|'scrollIntoView'|'programmatic', outAction?:..., scrollIntoViewThreshold?:number }`
export const PxTriggerSchema = implementsInterface<_PxTrigger>()(px.object({
    startOn: px.enum(['load', 'mouseOver', 'click', 'scrollIntoView', 'programmatic'] as const).optional(),
    outAction: px.enum(['continue', 'pause', 'reset', 'reverse'] as const).optional(),
    scrollIntoViewThreshold: px.number().optional(),
}));

/** Defines when and how an animation should be triggered. */
export type PxTrigger = PxInfer<typeof PxTriggerSchema>;
const _ck_PxTrigger: KeysMatch<PxTrigger, _PxTrigger> = true; // the key sets are identical


// ============================================================================
// DEFS
// ============================================================================

/**
 * A single character's embedded outline (glyph-mode text). Coordinates and
 * advance are in the owning {@link _PxGlyphFont}'s `unitsPerEm` units, so the
 * player can render text without the original font. See svga.text.design.md.
 */
export interface _PxGlyph {
    /** Advance width, in the font's `unitsPerEm`. */
    width: number;
    /** Outline path `d`, in the font's `unitsPerEm` (empty for whitespace). */
    d: string;
}

export const PxGlyphSchema = implementsInterface<_PxGlyph>()(px.object({
    width: px.number(),
    d: px.string(),
}));

export type PxGlyph = PxInfer<typeof PxGlyphSchema>;
const _ck_PxGlyph: KeysMatch<PxGlyph, _PxGlyph> = true; // the key sets are identical

/**
 * The used glyphs of one font, keyed by character. Referenced by a text's
 * `font-family` (the key in {@link _PxDefs.glyphs}).
 */
export interface _PxGlyphFont {
    /** CSS family name, e.g. "Roboto". */
    fFamily: string;
    /** Style notation, e.g. "" | "italic". */
    style: string;
    /** Ascent, in `unitsPerEm` units (baseline placement). */
    ascent: number;
    /** Units per em the glyph `width`/`d` are expressed in, e.g. 1000. */
    unitsPerEm: number;
    /** Outlines of the used characters, keyed by the character itself. */
    glyphs: { [char: string]: PxGlyph; };
}

export const PxGlyphFontSchema = implementsInterface<_PxGlyphFont>()(px.object({
    fFamily: px.string(),
    style: px.string(),
    ascent: px.number(),
    unitsPerEm: px.number(),
    glyphs: px.record(PxGlyphSchema),
}));

export type PxGlyphFont = PxInfer<typeof PxGlyphFontSchema>;
const _ck_PxGlyphFont: KeysMatch<PxGlyphFont, _PxGlyphFont> = true; // the key sets are identical

/**
 * Reusable definitions library for easings, animations, and styles.
 * Defined once here, referenced by name on elements.
 */
export interface _PxDefs {

    /** Named cubic-bezier easing functions */
    easings?: { [name: string]: [number, number, number, number]; };

    /** Named animation definitions that can be referenced by elements */
    animations?: { [name: string]: PxAnimationDefinition; };

    /** Named style presets. A node's `style` may reference one by name;
     *  resolved and applied at render time (see `resolveStyle` in PxAnimatorDOM). */
    styles?: { [name: string]: Record<string, string | number>; };

    /** Embedded per-font glyph outlines, keyed by the text's `font-family`.
     *  Lets glyph-mode `<text>` render without an external font. */
    glyphs?: { [fontName: string]: PxGlyphFont; };
}

// `{ easings?:Record<name,[x1,y1,x2,y2]>, animations?:Record<name,AnimationDefinition>, styles?:Record<string,any>, glyphs?:Record<fontName,PxGlyphFont> }`
export const PxDefsSchema = implementsInterface<_PxDefs>()(px.object({
    easings: px.record(px.tuple([px.number(), px.number(), px.number(), px.number()] as const)).optional(),
    animations: px.record(PxAnimationDefinitionSchema).optional(),
    styles: px.record(px.any()).optional(),
    glyphs: px.record(PxGlyphFontSchema).optional(),
}));

/** Reusable definitions library for easings, animations, and styles. */
export type PxDefs = PxInfer<typeof PxDefsSchema>;
const _ck_PxDefs: KeysMatch<PxDefs, _PxDefs> = true; // the key sets are identical


// ============================================================================
// ANIMATOR CONFIG
// ============================================================================

/**
 * Global animation configuration that applies to all animations in the document.
 * Defines timing, playback behaviour, and rendering strategy.
 */
export interface _PxAnimatorConfig {

    /** JavaScript animation implementation strategy */
    mode?: PxAnimatorMode;

    /** Total animation duration in milliseconds */
    duration?: number;

    /** Delay before animation starts in milliseconds */
    delay?: number;

    /**
     * Number of times to repeat the entire document timeline. Use `"infinite"` for endless loop.
     *
     * This repeats **all properties across all elements** as a unit. It is independent of
     * per-property `loop` configuration: if a property uses `loop`, its keyframes are already
     * expanded to fill `duration` before `iterations` takes effect — the two do not interfere,
     * but they do compose (a looping property inside an infinitely iterating document loops
     * within each iteration).
     */
    iterations?: number | "infinite";

    /** After a natural finish, snap the document back to its start state (same
     *  mechanics as the trigger `reset` out-action). Off by default — the animation
     *  holds its end state per `fill`. */
    resetOnFinish?: boolean;

    /**
     * Defines which values are applied before/after the active animation period
     * (maps directly to the Web Animations API `fill` option).
     * Defaults to `'forwards'` when not set so that elements hold their final
     * state after the animation ends — consistent with Lottie and other animation
     * runtimes. Without this default, seeking to the last frame would cause
     * elements to revert to their pre-animation state.
     */
    fill?: FillMode;

    /** Direction of animation playback */
    direction?: PlaybackDirection;

    /** Target frame rate for frame-based animations (only applicable when mode="frames") */
    frameRate?: number;

    /** Trigger configuration for when animation should start */
    trigger?: PxTrigger;

    /** Named easings, animations, and styles — referenced by elements */
    definitions?: PxDefs;

    /**
     * Animation map for pre-rendered SVG elements (Mode B).
     * Maps element IDs to their animation specs. Used when the SVG DOM already exists
     * and the player only needs to animate existing elements.
     *
     * @example { "_px_abc": { opacity: { keyframes: [...] } }, "_px_def": ["fadeIn"] }
     */
    animate?: Record<string, PxElementAnimation>;

    /** Editor-side timeline mode. Written by the editor on every document;
     *  accepted on the wire and ignored by the player. */
    timeline?: string;

    /** Reserved for future use — accepted on the wire but currently has no effect. */
    debug?: boolean;

    /** Debug helper: exposes the animator instance as `window[debugInstName]`. */
    debugInstName?: string;
}

// `{ mode?, duration?, delay?, iterations?, fill?, direction?, frameRate?, trigger?, definitions?, animate?, debug?, debugInstName? }`
export const PxAnimatorConfigSchema = implementsInterface<_PxAnimatorConfig>()(px.object({
    mode: px.enum([PxAnimatorMode.auto, PxAnimatorMode.webapi, PxAnimatorMode.frames] as const).optional(),
    duration: px.number().optional(),
    delay: px.number().optional(),
    iterations: px.union([px.number(), px.literal('infinite')]).optional(),
    fill: px.enum(['forwards', 'backwards', 'both', 'none'] as const).optional(),
    direction: px.enum(['normal', 'reverse', 'alternate', 'alternate-reverse'] as const).optional(),
    frameRate: px.number().optional(),
    trigger: PxTriggerSchema.optional(),
    resetOnFinish: px.boolean().optional(),
    definitions: PxDefsSchema.optional(),
    animate: px.record(PxElementAnimationSchema).optional(),
    timeline: px.string().optional(),
    debug: px.boolean().optional(),
    debugInstName: px.string().optional(),
}));

/**
 * Global animation configuration that applies to all animations in the document.
 * Defines timing, playback behavior, and rendering strategy.
 */
export type PxAnimatorConfig = PxInfer<typeof PxAnimatorConfigSchema>;
const _ck_PxAnimatorConfig: KeysMatch<PxAnimatorConfig, _PxAnimatorConfig> = true; // the key sets are identical


// ============================================================================
// BINDING
// ============================================================================

/**
 * Binds animations to existing DOM elements by ID.
 * Used when the SVG tree is pre-rendered and animations are applied separately.
 */
export interface _PxBinding {

    /** ID targeting elements in the DOM (data-px-id="...") */
    id: string;

    /** Animation to apply to matched elements */
    animate: PxElementAnimation;
}

// `{ id:string, animate:ElementAnimation }`
export const PxBindingSchema = implementsInterface<_PxBinding>()(px.object({
    id: px.string(),
    animate: PxElementAnimationSchema,
}));

/**
 * Binds animations to existing DOM elements via CSS selectors.
 * Used when the SVG tree is pre-rendered and animations are applied separately.
 */
export type PxBinding = PxInfer<typeof PxBindingSchema>;
const _ck_PxBinding: KeysMatch<PxBinding, _PxBinding> = true; // the key sets are identical


// ============================================================================
// NODE
// ============================================================================

/**
 * Per-attribute value shape on the element body. A property key carries either:
 * - a primitive (string/number) — static SVG attribute
 * - a number array — static number-LIST attribute (`strokeDasharray: [16, 16]`);
 *   the canonical static form for list attrs (the "5,5" string form is also
 *   accepted). Raw arrays are unambiguous — only plain OBJECTS need the
 *   `{value}` wrapper.
 * - a `{value: …}` object — structured static parametric source (record-shaped
 *   static value, used by attributes whose static representation is itself a
 *   record — notably `transform: {value: PxTransformParts}`)
 * - a `{keyframes}` / `{kfs}` object — inline property animation
 *
 * The unified rule (primitive/array | `{value}` | `{keyframes}`) applies across
 * the format. For most attributes the `{value}` form is rarely used on the body
 * (a primitive suffices for static); for `transform` it is the canonical
 * structured-static shape. See `PxTransformValueSchema`.
 */
export const PxAttrValueSchema = px.union([
    px.string(),
    px.number(),
    px.array(px.number()),
    px.object({ value: px.any() }),
    PxPropertyAnimationSchema,
]);

/** Per-attribute value: primitive/number-array for static, `{value}` for structured static, `PxPropertyAnimation` for animated. */
export type PxAttrValue = string | number | Array<number> | { value: any } | PxPropertyAnimation;


/**
 * Base interface for all SVG elements.
 * Named properties take precedence over the index signature when accessed.
 */
export interface _PxNode {

    /** SVG element type (e.g., "circle", "rect", "path", "g") */
    type: string;

    /** Child elements (for container elements like <g>) */
    children?: PxNode[];

    /** Meta informaion about this element */
    meta?: any;

    /**
     * Player-effects bucket (transformation/repeater/maskedBy/trimPath/retime/ref)
     * emitted by the Editor's lightweight design format. `applyPlayerEffects`
     * materialises and removes these before any other normalisation, so the
     * Player never observes a non-empty `effects` after entry-point processing.
     *
     * Typed against `PxEffectsSchema` (closed object — strict-mode validation
     * flags unknown effect keys). Adding a new effect requires extending the
     * `_PxEffects` interface AND the schema in lockstep.
     */
    effects?: PxEffects;

    /**
     * In-place property animations for this element. Same shape as the
     * `animator.animate` map values: string ref, array of refs, inline
     * definition (`{propName: PxPropertyAnimation}`), or mixed array.
     * The static initial value of an animated property is still carried as a
     * plain attribute on the body.
     */
    animate?: PxElementAnimation;

    /**
     * FIXME - do we need it?
     * Style applied to this element (named reference or inline object)
     */
    style?: string | Record<string, string | number>;

    /**
     * All other SVG attributes (cx, cy, r, fill, stroke, etc.).
     * A value is either a primitive (static) or a PxPropertyAnimation (in-place
     * animation `{keyframes: [...]}` / `{kfs: [...]}`).
     */
    [key: string]: any;
}

// ============================================================================
// PLAYER-EFFECTS BUCKET — INTERFACES + SCHEMAS (linked via `implementsInterface`)
// ============================================================================
//
// Schemas for the `node.effects` payload emitted by the Editor's lightweight
// design format. `applyPlayerEffects` (in `effects/PlayerEffectsUtil.ts`)
// materialises and removes these before any other normalisation, so the Player
// never observes a non-empty `effects` after entry-point processing.
//
// Each effect is declared as a `_Px*` interface, paired with a `Px*Schema`
// wrapped in `implementsInterface<_Px*>()(…)`. The runtime schema and the
// compile-time interface drift together: a new field added to either without
// matching the other is a TS error. `KeysMatch` asserts key-set equality so
// renames are caught too. This is the same pattern used by `PxKeyframe`,
// `PxLoop`, etc. earlier in this file.
//
// `effects/types.ts` re-exports these types so the applier internals
// (`effects/*.ts`) can still `import from './types'` unchanged.

/** Fixed-length 2-number tuple. `[x, y]` for positions, `[sx, sy]` for scale, …. */
export type Vec2 = [number, number];

/**
 * Animatable wire value — the ONE grammar for every animatable slot:
 *
 *   T                      — raw static (non-object T)
 *   { value: T }           — structured static
 *   PxPropertyAnimation    — animated: `{value?, keyframes|kfs, loop?, autoOrient?}`
 *
 * The animated form IS `PxPropertyAnimation` — the exact object `node.animate`
 * channels use — so effect slots and node attributes share one schema, one
 * reader (`effects/transformParts.readAnimatable`) and one loop-materialisation
 * path. `value` inside the animated form is the optional static baseline (see
 * `_PxPropertyAnimation.value`).
 *
 * Generic over the per-kf value type `T` for compile-time narrowing of the
 * static / `{value}` forms. The animated form uses the lib's non-generic
 * `PxKeyframe` (whose `value` is `any`) — kf values are read with care in the
 * applier (the visualModel walker / `interpParts` know per-property shapes).
 */
export type PxAnimatable<T> = T | { value: T } | _PxPropertyAnimation;

// PxAnimatable<number> — static number OR `{value}` static OR PxPropertyAnimation.
const PxAnimatableNumberSchema = px.union([
    px.number(),
    px.object({ value: px.number() }),
    PxPropertyAnimationSchema,
]);

// PxAnimatable<Vec2> — static `[x,y]` OR `{value:[x,y]}` OR PxPropertyAnimation.
// `as const` on the tuples is REQUIRED for TS to infer `[number, number]` (a
// fixed-length tuple = `Vec2`) instead of the looser `number[]`.
const PxAnimatableVec2Schema = px.union([
    px.tuple([px.number(), px.number()] as const),
    px.object({ value: px.tuple([px.number(), px.number()] as const) }),
    PxPropertyAnimationSchema,
]);


/** Per-part editor transform (`transformation` effect). All parts optional and animatable. */
export interface _PxTransformationEffect {
    translate?: PxAnimatable<Vec2>;
    rotate?: PxAnimatable<number>;
    scale?: PxAnimatable<Vec2>;
    /** Skew (skewX) in degrees — a NUMBER (matches the editor's scalar skew part). */
    skew?: PxAnimatable<number>;
    origin?: PxAnimatable<Vec2>;
}
export const PxTransformationEffectSchema = implementsInterface<_PxTransformationEffect>()(px.object({
    translate: PxAnimatableVec2Schema.optional(),
    rotate: PxAnimatableNumberSchema.optional(),
    scale: PxAnimatableVec2Schema.optional(),
    skew: PxAnimatableNumberSchema.optional(),
    origin: PxAnimatableVec2Schema.optional(),
}));
export type PxTransformationEffect = PxInfer<typeof PxTransformationEffectSchema>;
const _ck_PxTransformationEffect: KeysMatch<PxTransformationEffect, _PxTransformationEffect> = true;


/** Per-copy repeater offsets. Each part is animatable; per-copy values scale
 *  with the copy index `i` (translate/rotate/origin × i; scale per-axis `v^i`).
 *  Static repeater values pass through as a structured `transform: {value:…}` on
 *  the per-copy wrapper; animated values are emitted as `animate.transform.keyframes`
 *  with each kf value scaled by `i`. See `effects/repeaterEffect.ts`. */
export interface _PxRepeaterEffect {
    copies?: number;
    translate?: PxAnimatable<Vec2>;
    rotate?: PxAnimatable<number>;
    scale?: PxAnimatable<Vec2>;       // per-copy FACTOR (0.85 = 85% per copy), like every other scale
    origin?: PxAnimatable<Vec2>;
}
export const PxRepeaterEffectSchema = implementsInterface<_PxRepeaterEffect>()(px.object({
    copies: px.number().optional(),
    translate: PxAnimatableVec2Schema.optional(),
    rotate: PxAnimatableNumberSchema.optional(),
    scale: PxAnimatableVec2Schema.optional(),
    origin: PxAnimatableVec2Schema.optional(),
}));
export type PxRepeaterEffect = PxInfer<typeof PxRepeaterEffectSchema>;
const _ck_PxRepeaterEffect: KeysMatch<PxRepeaterEffect, _PxRepeaterEffect> = true;


/** Mask source ref + standard `<mask>` attributes.
 *  `href` is `#id` (canonical ref spelling, SCHEMA-ANALYSIS §4 E-5); bare `id` is legacy, read-only. */
export interface _PxMaskedByEffect {
    href?: string;
    maskType?: string;
    maskUnits?: string;
    maskContentUnits?: string;
}
export const PxMaskedByEffectSchema = implementsInterface<_PxMaskedByEffect>()(px.object({
    href: px.string().optional(),
    maskType: px.string().optional(),
    maskUnits: px.string().optional(),
    maskContentUnits: px.string().optional(),
}));
export type PxMaskedByEffect = PxInfer<typeof PxMaskedByEffectSchema>;
const _ck_PxMaskedByEffect: KeysMatch<PxMaskedByEffect, _PxMaskedByEffect> = true;


/**
 * Clip-path effect — clips the host element to a vector path. `d` is a standard
 * animatable slot (same grammar as body `d`): static = plain SVG path-data string
 * (one or more subpaths); animated = `{keyframes}` whose values are `{path:"M…"}`.
 * At apply time an animated `d` lands on the minted `<path>`'s `animate.d`, so the
 * player's frame loop rewrites the clip path's `d` attribute per frame. `clip-path`
 * is a live reference, so the browser re-clips each frame (unlike `<marker>` —
 * verified across SMIL/CSS/JS/WAAPI).
 *
 * At apply time the effect mints a `<clipPath><path d/></clipPath>` def and sets
 * `clip-path="url(#auto-id)"` on the host (materialiser pattern, like `maskedBy` /
 * gradient). See `effects/clipPathEffect.ts`.
 *
 * LEGACY: older files carry the animation as a sibling `animate` key
 * (`{d: "M…", animate: {keyframes}}`). Still read (folded into `d`'s animation
 * at apply time); never written.
 */
export interface _PxClipPathEffect {
    d?: PxAnimatable<string>;
    /** @deprecated legacy animated form — read-only; the animation lives on `d` now. */
    animate?: PxPropertyAnimation;
}
export const PxClipPathEffectSchema = implementsInterface<_PxClipPathEffect>()(px.object({
    d: px.union([px.string(), px.object({ value: px.string() }), PxPropertyAnimationSchema]).optional(),
    animate: PxPropertyAnimationSchema.optional(),
}));
export type PxClipPathEffect = PxInfer<typeof PxClipPathEffectSchema>;
const _ck_PxClipPathEffect: KeysMatch<PxClipPathEffect, _PxClipPathEffect> = true;


/**
 * Trim-path effect. `range[0..1]` is the visible fraction of the stroke; `offset`
 * shifts the visible window along the path (also a fraction). Both are animatable.
 * `trimAllAsOne=true` chains all descendant subpath lengths into one virtual path
 * ("Trim All As One"): the trim window slides across siblings instead of being
 * applied to each subpath independently — see `effects/trimPathEffect.ts`.
 */
export interface _PxTrimPathEffect {
    offset?: PxAnimatable<number>;
    range?: PxAnimatable<Vec2>;
    trimAllAsOne?: boolean;
}
export const PxTrimPathEffectSchema = implementsInterface<_PxTrimPathEffect>()(px.object({
    offset: PxAnimatableNumberSchema.optional(),
    range: PxAnimatableVec2Schema.optional(),
    trimAllAsOne: px.boolean().optional(),
}));
export type PxTrimPathEffect = PxInfer<typeof PxTrimPathEffectSchema>;
const _ck_PxTrimPathEffect: KeysMatch<PxTrimPathEffect, _PxTrimPathEffect> = true;


/** `<use>` retime: `baseId` = source (`#id` canonical, bare legacy); `start`/`timeCrop` in ms.
 *  NOTE: `timeCrop` is accepted on the wire but not implemented yet — the
 *  applier warns and ignores it (see `effects/retimeEffect.ts`). */
export interface _PxRetimeEffect {
    baseId?: string;
    start?: number;
    stretch?: number;
    timeCrop?: [number, number];
}
export const PxRetimeEffectSchema = implementsInterface<_PxRetimeEffect>()(px.object({
    baseId: px.string().optional(),
    start: px.number().optional(),
    stretch: px.number().optional(),
    timeCrop: px.tuple([px.number(), px.number()] as const).optional(),
}));
export type PxRetimeEffect = PxInfer<typeof PxRetimeEffectSchema>;
const _ck_PxRetimeEffect: KeysMatch<PxRetimeEffect, _PxRetimeEffect> = true;


/**
 * `<use>` CLONE — merges the former `ref` + `retime` effects. A `<use>` is a clone
 * of something: `type`/`baseId` say WHAT it clones, `retime` says WHEN.
 *   - `type: 'content'` → content-ref (excludes the target's own translate);
 *     `type` absent → direct / whole-element link (keeps translate).
 *   - `baseId` = the source element ref, `#id` (canonical spelling, SCHEMA-ANALYSIS §4 E-5;
 *     bare `id` is legacy, read-only). Lives once here; the player follows `href`.
 *   - `retime` = optional time-shift (nested).
 * Omitted entirely when all-default (a bare `<use href>` carries no `clone` bucket).
 */
export interface _PxCloneEffect {
    type?: string;
    baseId?: string;
    retime?: _PxRetimeEffect;
}
export const PxCloneEffectSchema = implementsInterface<_PxCloneEffect>()(px.object({
    type: px.string().optional(),
    baseId: px.string().optional(),
    retime: PxRetimeEffectSchema.optional(),
}));
export type PxCloneEffect = PxInfer<typeof PxCloneEffectSchema>;
const _ck_PxCloneEffect: KeysMatch<PxCloneEffect, _PxCloneEffect> = true;


// ─────────────────────────────────────────────────────────────────────────────
// Gradient paint effect — `fillGradient` / `strokeGradient`.
//
// Materialiser pattern mirrors `maskedByEffect`: at apply time the gradient
// effect mints a `<linearGradient>` / `<radialGradient>` def into `ctx.defs`,
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

/** A single colour stop. `offset` is in `[0, 1]`; `color` is a CSS colour
 *  string (`#rrggbb`, `rgb(…)`, `rgba(…)`, or named). */
export interface _PxGradientStop {
    offset: number;
    color: string;
}
export const PxGradientStopSchema = implementsInterface<_PxGradientStop>()(px.object({
    offset: px.number(),
    color:  px.string(),
}));
export type PxGradientStop = PxInfer<typeof PxGradientStopSchema>;
const _ck_PxGradientStop: KeysMatch<PxGradientStop, _PxGradientStop> = true;

/** `PxAnimatable<Array<PxGradientStop>>` schema. Static is the bare array;
 *  `{value: […]}` wraps the same; the animated form is `PxPropertyAnimation`
 *  (one timeline whose each kf's `value` is the FULL stops array at that time). */
const PxAnimatableGradientStopsSchema = px.union([
    px.array(PxGradientStopSchema),
    px.object({ value: px.array(PxGradientStopSchema) }),
    PxPropertyAnimationSchema,
]);

/** Gradient paint effect — used by both `fillGradient` and `strokeGradient`
 *  (same shape, different host attribute). Linear: `p1`/`p2`. Radial:
 *  `c`/`r`/`fp`. Stops animate as one timeline; geometry stays static. */
/**
 * Animatable gradient GEOMETRY channels. Keyed by wire name; the applier maps
 * each onto the real SVG attribute of the gradient def it mints:
 *
 * | wire key      | linear | radial |
 * |---------------|--------|--------|
 * | `gradientX1`  | `x1`   | —      |
 * | `gradientY1`  | `y1`   | —      |
 * | `gradientX2`  | `x2`   | —      |
 * | `gradientY2`  | `y2`   | —      |
 * | `gradientCx`  | —      | `cx`   |
 * | `gradientCy`  | —      | `cy`   |
 * | `gradientFx`  | —      | `fx`   |
 * | `gradientFy`  | —      | `fy`   |
 * | `gradientR`   | —      | `r`    |
 *
 * Frames-engine only: CSS/WAAPI cannot animate gradient endpoints, so a document
 * using these falls back to the frames engine (`mode: 'auto'` handles that).
 * See `effects/gradientEffect.ts` (`GRADIENT_ANIM_CHANNEL_TO_ATTR`).
 */
export interface _PxGradientGeometryAnimation {
    gradientX1?: PxPropertyAnimation;
    gradientY1?: PxPropertyAnimation;
    gradientX2?: PxPropertyAnimation;
    gradientY2?: PxPropertyAnimation;
    gradientCx?: PxPropertyAnimation;
    gradientCy?: PxPropertyAnimation;
    gradientFx?: PxPropertyAnimation;
    gradientFy?: PxPropertyAnimation;
    gradientR?:  PxPropertyAnimation;
}
export const PxGradientGeometryAnimationSchema = implementsInterface<_PxGradientGeometryAnimation>()(px.object({
    gradientX1: PxPropertyAnimationSchema.optional(),
    gradientY1: PxPropertyAnimationSchema.optional(),
    gradientX2: PxPropertyAnimationSchema.optional(),
    gradientY2: PxPropertyAnimationSchema.optional(),
    gradientCx: PxPropertyAnimationSchema.optional(),
    gradientCy: PxPropertyAnimationSchema.optional(),
    gradientFx: PxPropertyAnimationSchema.optional(),
    gradientFy: PxPropertyAnimationSchema.optional(),
    gradientR:  PxPropertyAnimationSchema.optional(),
}));
export type PxGradientGeometryAnimation = PxInfer<typeof PxGradientGeometryAnimationSchema>;
const _ck_PxGradientGeometryAnimation: KeysMatch<PxGradientGeometryAnimation, _PxGradientGeometryAnimation> = true;

export interface _PxFillGradientEffect {
    type: PxGradientType;                                 // 'linear' | 'radial'
    p1?:  PxAnimatable<Vec2>;                             // linear start
    p2?:  PxAnimatable<Vec2>;                             // linear end
    c?:   PxAnimatable<Vec2>;                             // radial centre
    r?:   PxAnimatable<number>;                           // radial radius
    fp?:  PxAnimatable<Vec2>;                             // radial focal point
    stops?: PxAnimatable<Array<_PxGradientStop>>;          // single animation timeline
    gradientUnits?:  string;                              // PxGradientUnits values
    spreadMethod?:   string;                              // PxGradientSpreadMethod values
    gradientTransform?: string;                           // static only in v1
    /** @deprecated legacy animated-geometry form (per-scalar `gradientX1`/… channels) —
     *  read-only; geometry now animates on `p1`/`p2`/`c`/`r`/`fp` directly.
     *  Frames-engine only — see {@link _PxGradientGeometryAnimation}. */
    animate?: _PxGradientGeometryAnimation;
}
export const PxFillGradientEffectSchema = implementsInterface<_PxFillGradientEffect>()(px.object({
    type: px.enum([PxGradientType.linear, PxGradientType.radial] as const),
    p1:   PxAnimatableVec2Schema.optional(),
    p2:   PxAnimatableVec2Schema.optional(),
    c:    PxAnimatableVec2Schema.optional(),
    r:    PxAnimatableNumberSchema.optional(),
    fp:   PxAnimatableVec2Schema.optional(),
    stops: PxAnimatableGradientStopsSchema.optional(),
    gradientUnits:     px.string().optional(),
    spreadMethod:      px.string().optional(),
    gradientTransform: px.string().optional(),
    animate: PxGradientGeometryAnimationSchema.optional(),
}));
export type PxFillGradientEffect = PxInfer<typeof PxFillGradientEffectSchema>;
const _ck_PxFillGradientEffect: KeysMatch<PxFillGradientEffect, _PxFillGradientEffect> = true;

/** Stroke gradient is the same shape as fill gradient; the difference is
 *  only which host attribute (`fill` vs `stroke`) the applier rewrites. */
export type _PxStrokeGradientEffect = _PxFillGradientEffect;
export const PxStrokeGradientEffectSchema = PxFillGradientEffectSchema;
export type PxStrokeGradientEffect = PxFillGradientEffect;

/** Text-path effect on a `<text>` host. The path geometry is carried INLINE as
 *  `path` (an SVG `d`; static for now, keyframed animation is a later step) — the
 *  applier mints a `<path>` def from it and wraps the text's children in a native
 *  `<textPath href="#…">` at apply time. All SVG-native textPath attrs
 *  (`lengthAdjust`, `method`, `spacing`, `startOffset`, `textLength`) ride on this
 *  effect; `startOffset`/`textLength` accept the full `PxAnimatable<number>` shape.
 *
 *  `pathOverflow` controls what happens to glyphs past the end of an OPEN path:
 *   - `'extend'` (default): glyphs continue straight along the endpoint tangent
 *     (Lottie / native-glyph behavior).
 *   - `'clip'`: glyphs past the end disappear (native `<textPath>` behavior). */
export interface _PxTextPathEffect {
    path: string;                                         // inline SVG `d`
    pathOverflow?: string;                                // 'clip' | 'extend' (default 'extend')
    lengthAdjust?: string;                                // 'spacing' | 'spacingAndGlyphs'
    method?: string;                                      // 'align' | 'stretch'
    spacing?: string;                                     // 'auto' | 'exact'
    startOffset?: PxAnimatable<number>;
    textLength?: PxAnimatable<number>;
}
export const PxTextPathEffectSchema = implementsInterface<_PxTextPathEffect>()(px.object({
    path: px.string(),
    pathOverflow: px.string().optional(),
    lengthAdjust: px.string().optional(),
    method: px.string().optional(),
    spacing: px.string().optional(),
    startOffset: PxAnimatableNumberSchema.optional(),
    textLength: PxAnimatableNumberSchema.optional(),
}));
export type PxTextPathEffect = PxInfer<typeof PxTextPathEffectSchema>;
const _ck_PxTextPathEffect: KeysMatch<PxTextPathEffect, _PxTextPathEffect> = true;


/**
 * `effects.text` — text-rendering options for a `<text>` node.
 *
 * `useGlyphs: true` tells the player to render this text from the embedded
 * per-glyph outlines in `definitions.glyphs` (self-contained, no external
 * font) instead of a native `<text>`. See svga.text.design.md.
 */
export interface _PxTextEffect {
    useGlyphs?: boolean;
}
export const PxTextEffectSchema = implementsInterface<_PxTextEffect>()(px.object({
    useGlyphs: px.boolean().optional(),
}));
export type PxTextEffect = PxInfer<typeof PxTextEffectSchema>;
const _ck_PxTextEffect: KeysMatch<PxTextEffect, _PxTextEffect> = true;


/** The full `node.effects` bucket. Closed — each known effect is declared
 *  (strict-mode validation flags an unknown effect key as a wire-format drift). */
export interface _PxEffects {
    transformation?: _PxTransformationEffect;
    repeater?: _PxRepeaterEffect;
    maskedBy?: _PxMaskedByEffect;
    clipPath?: _PxClipPathEffect;
    trimPath?: _PxTrimPathEffect;
    clone?: _PxCloneEffect;
    isCombinedShape?: boolean;
    fillGradient?: _PxFillGradientEffect;
    strokeGradient?: _PxStrokeGradientEffect;
    textPath?: _PxTextPathEffect;
    text?: _PxTextEffect;
}
export const PxEffectsSchema = implementsInterface<_PxEffects>()(px.object({
    transformation: PxTransformationEffectSchema.optional(),
    repeater: PxRepeaterEffectSchema.optional(),
    maskedBy: PxMaskedByEffectSchema.optional(),
    clipPath: PxClipPathEffectSchema.optional(),
    trimPath: PxTrimPathEffectSchema.optional(),
    clone: PxCloneEffectSchema.optional(),
    isCombinedShape: px.boolean().optional(),
    fillGradient: PxFillGradientEffectSchema.optional(),
    strokeGradient: PxStrokeGradientEffectSchema.optional(),
    textPath: PxTextPathEffectSchema.optional(),
    text: PxTextEffectSchema.optional(),
}));
export type PxEffects = PxInfer<typeof PxEffectsSchema>;
const _ck_PxEffects: KeysMatch<PxEffects, _PxEffects> = true;

/**
 * Walks `root` and validates every `node.effects` bucket against `PxEffectsSchema`.
 * Returns an array of human-readable warning strings (empty when all good).
 * Doesn't mutate the tree. Called by `createAnimatorImpl` before applying effects.
 *
 * Pass `strict: true` to also flag undeclared keys (useful in dev / tests).
 */
export function validateNodeEffects(root: PxNode, opts?: { strict?: boolean }): Array<string> {
    const warnings: Array<string> = [];
    // `path` is a human-readable breadcrumb prepended to each warning so the
    // reader can locate the offending node in the tree (e.g.
    // `root.children[0].children[2].effects.transformation.translate: …`).
    const walk = (node: PxNode, path: string): void => {
        if (node && node.effects) {
            const ctx: PxValidationContext = { errors: [], warnings: [], strict: !!opts?.strict };
            const ok = PxEffectsSchema.isValid(node.effects, ctx, [path + '.effects']);
            if (!ok) {
                for (const err of ctx.errors) warnings.push(err);
            }
        }
        if (node && Array.isArray(node.children)) {
            node.children.forEach((c, i) => walk(c, path + '.children[' + i + ']'));
        }
    };
    walk(root, 'root');
    return warnings;
}


// ============================================================================
// NODE
// ============================================================================

/**
 * Base shape for all SVG element nodes.
 * Open object: validated known keys + arbitrary SVG attributes whose values are
 * either primitives (static) or PxPropertyAnimation objects (in-place animation).
 * Non-recursive — excludes `children` (circular reference). Used for type extraction via PxInfer.
 *
 * `{ type:string, style?:…, [key:string]: string|number|PxPropertyAnimation }`
 */
export const PxNodeBase = px.openObject({
    type: px.string(),
    id: px.string().optional(),
    meta: px.any().optional(),
    // Player-effects bucket emitted by the Editor's lightweight design format.
    // Consumed and removed by `applyPlayerEffects` before any other normalisation
    // (see `createAnimatorImpl`), so downstream code never sees it.
    effects: PxEffectsSchema.optional(),
    // `PxElementAnimation` (not just `PxAnimationDefinition`) — accepts
    // string ref / array of refs / inline definition / mixed array; mirrors
    // `animator.animate` map values and what `processNode` resolves at runtime.
    animate: PxElementAnimationSchema.optional(),
    style: px.union([px.string(), px.record(px.union([px.string(), px.number()]))]).optional(),
}, PxAttrValueSchema);

// `let` so the lazy closure can capture the variable reference after assignment.
// By the time the lazy resolves (first isValid/sanitize call), PxNodeSchema is assigned.
// `PxNodeBase & { children?:PxNode[] }`
let PxNodeSchema: PxSchema<any> = px.openObject({
    ...PxNodeBase._shape,
    children: px.lazy(() => px.array(PxNodeSchema), []).optional(),
}, PxAttrValueSchema);
export { PxNodeSchema };

/**
 * Base interface for all SVG elements.
 * Extends schema-derived typed fields; adds recursive children and the open
 * index signature for arbitrary SVG attributes (cx, cy, r, fill, etc.).
 * Named properties take precedence over the index signature when accessed.
 */
export interface PxNode extends PxInfer<typeof PxNodeBase> {
    children?: PxNode[];
    [key: string]: any;
}


// ============================================================================
// SVG NODE (ROOT)
// ============================================================================

/**
 * Root SVG element containing the entire animated graphic.
 * Extends PxNode with SVG-specific properties and global configuration.
 */
export interface _PxSvgNode extends PxNode {

    /** FIXME - do we need it? SVG viewport width */
    width?: number;

    /** FIXME - do we need it? SVG viewport height */
    height?: number;

    /** FIXME - do we need it? SVG viewBox attribute defining coordinate system */
    viewBox?: string;

    /** Global animation configuration */
    animator?: PxAnimatorConfig;
}

/**
 * Extra fields present on the root SVG node, on top of PxNode.
 * Used for type extraction via PxInfer.
 *
 * `{ width?:number, height?:number, viewBox?:string, animator?:AnimatorConfig }`
 */
export const PxSvgNodeExtra = px.object({
    width: px.number().optional(),
    height: px.number().optional(),
    viewBox: px.string().optional(),
    animator: PxAnimatorConfigSchema.optional(),
});

/**
 * Root SVG element containing the entire animated graphic.
 * Extends PxNode (inheriting the open index signature) plus schema-derived
 * SVG-root fields.
 */
export interface PxSvgNode extends PxNode, PxInfer<typeof PxSvgNodeExtra> {
}


// ============================================================================
// DOCUMENT
// ============================================================================

/**
 * Root SVG document schema. Enforces `type === 'svg'` to distinguish from child nodes.
 * This is the root type for the entire file format.
 *
 * `{ type:'svg', style?:…, width?:number, height?:number,
 *    viewBox?:string, animator?:AnimatorConfig, children?:PxNode[],
 *    [svgAttr]: string|number|PxPropertyAnimation }`
 */
export const PxAnimatedSvgDocumentSchema = px.openObject({
    ...PxNodeBase._shape,
    ...PxSvgNodeExtra._shape,
    type: px.literal('svg'),     // override string → literal to require 'svg'
    children: px.array(PxNodeSchema).optional()
}, PxAttrValueSchema);

/**
 * The complete animated SVG document.
 * This is the root type for the entire file format.
 */
export interface PxAnimatedSvgDocument extends PxSvgNode {
}


// ============================================================================
// API INTERFACES
// ============================================================================

/** A configuration object for animation lifecycle callbacks. */
export interface PxAnimatorCallbacksConfig {

    /** Callback executed when the animation starts or resumes. */
    onPlay?: () => void;

    /** Callback executed when the animation is paused. */
    onPause?: () => void;

    /** Callback executed when the animation is cancelled. */
    onCancel?: () => void;

    /** Callback executed when the animation finishes naturally. */
    onFinish?: () => void;

    /** Callback executed when the animation is removed. */
    onRemove?: () => void;
}


export type PxPoint2D = Array<number>;


// ============================================================================
// BEZIER PATH
// ============================================================================

/** Represents a vector path for SVG shape animations. */
export interface _PxBezierPath {

    /** An array of vertex points [[x, y], ...]. */
    v: Array<PxPoint2D>;

    /** An array of 'in' tangent handles for each vertex [[x, y], ...]. */
    i?: Array<PxPoint2D>;

    /** An array of 'out' tangent handles for each vertex [[x, y], ...]. */
    o?: Array<PxPoint2D>;

    /** A boolean indicating if the path is closed. */
    c?: boolean;
}

// `{ v:number[][], i?:number[][], o?:number[][], c?:boolean }`
export const PxBezierPathSchema = implementsInterface<_PxBezierPath>()(px.object({
    v: px.array(px.array(px.number())),
    i: px.array(px.array(px.number())).optional(),
    o: px.array(px.array(px.number())).optional(),
    c: px.boolean().optional(),
}));

/** Represents a vector path for SVG shape animations. */
export type PxBezierPath = PxInfer<typeof PxBezierPathSchema>;
const _ck_PxBezierPath: KeysMatch<PxBezierPath, _PxBezierPath> = true; // the key sets are identical


// ============================================================================
// ANIMATOR API
// ============================================================================

/**
 * Basic animation controls common to all animator types.
 *
 * Generic over the platform's root-element type (`TRoot`) so this package stays
 * platform-neutral: the web player specialises it to the DOM `Element`, a
 * React Native player to its own view handle. Defaults to `unknown`.
 */
export interface PxBasicAnimatorAPI<TRoot = unknown> {

    isReady(): boolean;

    /** Returns the root element for the animation (platform-specific type). */
    getRootElement(): TRoot | null;

    /** Returns true if the animation is currently running. */
    isPlaying(): boolean;

    /** Starts or resumes the animation. */
    play(): void;

    /** Pauses the animation at its current state. */
    pause(): void;

    /** Stops the animation and resets it to its initial state. */
    cancel(): void;

}

/** The full programmatic control interface for an animation. */
export interface PxAnimatorAPI<TRoot = unknown> extends PxBasicAnimatorAPI<TRoot> {

    /** Jumps to the end of the animation and holds the final state. */
    finish(): void;

    /** Changes the speed of the animation. 1 is normal, 2 is double, -1 is reverse. */
    setPlaybackRate(rate: number): void;

    /** Returns the current playback time in milliseconds. */
    getCurrentTime(): number | null;

    /** Jumps to a specific time (in milliseconds) in the animation. */
    setCurrentTime(time: number): void;

    /** Stops the animation and cleans up all associated resources. */
    destroy(): void;
}


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

    return fileJson['type'] === 'svg' || fileJson['tagName'] === 'svg';
}


// ============================================================================
// DEEP VALIDATION
// ============================================================================

export interface PxValidationResult {
    valid: boolean;
    errors: string[];
}

/**
 * Deep validation of PxAnimatedSvgDocument using the PxAnimatedSvgDocumentSchema.
 * @returns PxValidationResult with valid flag and array of error messages
 */
export function isPxElementFileFormatDeep(fileJson: any): PxValidationResult {
    const valid: boolean = PxAnimatedSvgDocumentSchema.isValid(fileJson);
    return { valid, errors: valid ? [] : ['Document failed schema validation'] };
}

export function getAnimatorConfig(doc: PxAnimatedSvgDocument): PxAnimatorConfig | undefined {
    return (
        doc?.animator || doc?.meta?.animator ||
        doc?.animation || doc?.meta?.animation // FIXME - decide on the name
    );
}

export function getDefs(doc: PxAnimatedSvgDocument): PxDefs | undefined {
    if (!doc) return undefined;
    return getAnimatorConfig(doc)?.definitions;
}

export function getBindings(doc: PxAnimatedSvgDocument): PxBinding[] | undefined {
    if (!doc) return undefined;
    const animate = getAnimatorConfig(doc)?.animate;
    if (!animate) return undefined;
    return Object.entries(animate).map(([id, anim]) => ({ id, animate: anim }));
}

// FIXME - do we need it?
export function getChildren(doc: PxAnimatedSvgDocument): PxNode[] | undefined {
    return doc?.children;
}