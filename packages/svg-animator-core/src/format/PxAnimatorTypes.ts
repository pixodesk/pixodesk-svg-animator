// @px-area validation
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { KeysMatch, PxInfer, PxSchema, PxValidationContext, PxValidationFinding, PxRemoveIndex } from '../schema/PxSchema';
import { implementsInterface, px, PxValidationFindingKind, reportValidationError } from '../schema/PxSchema';
// Constants live in their own module so importing one does not pull the schema engine
// in; re-exported here so this module's public surface is unchanged. See there.
export * from './PxAnimatorConstants';
import { getAnimatorConfig, INTERNAL_ATTRS, isPxDocument, PX_DEFAULT_DURATION_MS, PX_DEFAULT_ITERATIONS, PX_DEFAULT_UNITS_PER_EM, PX_TRANSFORM_PART_KEYS, PX_PLAYBACK_DEFAULTS, PxTimelineEngineSetting, PxCloneOmit, PxPathOverflow, PxGradientSpreadMethod, PxGradientType, PxLengthAdjust, PxLoopRepeatAt, PxLoopDirection, PxMaskType, PxTextPathMethod, PxTextPathSpacing, PxStrokeTrimSubPaths, PxUnits,
    // Wire enums named in review §2.7 — used as VALUES by the schemas below.
    PxAlongPathMode, PxFillMode, PxStopPlaybackBehavior, PxWhenFinished, PxOutOfViewBehavior, PxWhenIdle, PxPinAlign, PxPlaybackDirection,
    PxScrollAxis, PxScrollKind, PxScrollPhase, PxScrollSource, PxTriggerEvent, PxTriggerList, allowedTriggerEvents, PxValueKind } from './PxAnimatorConstants';
import type { PxPlaybackState, PxTimelineEngine, PxTransformPartKey, PxTriggerEvents } from './PxAnimatorConstants';
// Version stamps are parsed by the reader's own parser (review §2.10) so the validator and the
// reader can never disagree on what counts as a stamp. `PxWireVersion` imports only
// `PxSchemaVersion`, so this edge creates no cycle.
import { parseWireVersion } from '../version/PxWireVersion';
// The diagnostics channel's payload, named by `PxEngineCallbacks` below (review §5).
// `PxDiagnostics` imports nothing, so this edge creates no cycle either.
import type { PxDiagnosticKind, PxDiagnosticsConfig } from '../playback/PxDiagnostics';

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
 * @public @advanced
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
 *
 * THE AUTHORED FORM: `time` / `value` / `easing` / `tangentIn` / `tangentOut`.
 * Locked to `PxKeyframeSchema` by the `KeysMatch` assertion below, so this interface and the
 * validator cannot drift apart. The compiled form ({@link PxCompiledKeyframe}) uses the same keys.
 */
export interface _PxKeyframe {

    /** Timestamp in milliseconds from animation start */
    time?: number;

    /** The value of the animated property at this keyframe */
    value?: _PxKeyframeValue;

    /** Easing function applied to the interval from this keyframe to the next */
    easing?: PxEasingOrRef;

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

    /**
     * Incoming spatial tangent `[dx, dy]` for motion-along-path interpolation
     * (translate animations only). Delta relative to this keyframe's translate
     * position. See `tangentOut` for the segment construction.
     *
     * Defined when the segment arriving at this keyframe is curved.
     */
    tangentIn?: [number, number];

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
    | { pathData: string }
    | Array<_PxGradientStop>;

// `string | number | Array<number> | PxTransformParts | { pathData: string }`
//
// `{ pathData: "M…" }` is the ONE form for animated path geometry: a single `d` string
// (a compound shape is one string with several `M…` sub-paths). The Lottie-style
// `{ paths: [{v,i,o,c}] }` array was retired 2026-09-11 — it lives on only as the
// interpolator's INTERNAL shape (`normalizePathValue` in `PxDefinitions.ts`).
//
// `PxTransformPartsSchema` is declared later in this file — `px.lazy` defers the lookup
// until validation time so the declarations stay in narrative order without a TDZ at load.
/** The `{pathData}` keyframe value of an animated path `d`. @internal */
export const PxPathDataValueSchema = px.object({ pathData: px.string() });

/** @public @advanced */
export const PxKeyframeValueSchema = implementsInterface<_PxKeyframeValue>()(px.union([
    px.string(), // e.g. for colors
    px.number(),
    px.array(px.number()),
    // ORDER LAW: the key-discriminated object shape (`{pathData}`) comes BEFORE the
    // all-optional transform-parts record. In default (non-strict) mode that record accepts
    // ANY object (every key optional, unknown keys ignored), so listing it earlier made
    // Union.sanitize route `{pathData}` values into it and strip them to `{}` —
    // silent morph-data loss (repro: the editor's keyframeValueSanitize spec). Validity is
    // order-independent (`some()`); only sanitize routing depends on this order.
    PxPathDataValueSchema,
    // Gradient `stops` timeline — each kf value is the full stops-array snapshot.
    px.lazy<Array<_PxGradientStop>>(() => px.array(PxGradientStopSchema), []),
    px.lazy<PxTransformParts>(() => PxTransformPartsSchema, {}),
]));

/** A single keyframe `value` — union of all wire-allowed shapes. */
export type PxKeyframeValue = PxInfer<typeof PxKeyframeValueSchema>;

// `{ time?:number, t?:number, value?:PxKeyframeValue, v?:PxKeyframeValue,
//    easing?:Easing, e?:Easing, tangentOut?:[dx,dy], tangentIn?:[dx,dy] }`
//
// `value` / `v` validate against {@link PxKeyframeValueSchema} — malformed
// keyframe values are now schema errors instead of passing as `px.any()`
// (SCHEMA-DESIGN I-5). The `_PxKeyframe` interface keeps `value?: any` (and
// `PxKeyframe<T = any>` its generic default) so the duck-typed interpolator
// access in `PxDefinitions.ts` stays untyped-permissive at compile time.
// LONG SPELLINGS ONLY (review §1.2/§6.1): the short aliases (`t`/`v`/`e`/`to`/`ti`)
// were removed outright — one clear spelling, no mixing ambiguity.
/** @public @advanced */
export const PxKeyframeSchema = implementsInterface<_PxKeyframe>()(px.object({
    time: px.number().optional(),
    value: PxKeyframeValueSchema.optional(),
    easing: PxEasingOrRefSchema.optional(),
    tangentOut: px.tuple([px.number(), px.number()] as const).optional(),
    tangentIn: px.tuple([px.number(), px.number()] as const).optional(),
    // (`selected` — editor timeline-selection UI state — was REMOVED from the wire
    // (review §1.3): editor data lives under `meta`. The editor still carries it on
    // its internal COPY-PASTE payload, which never validates against this schema.)
}));

/**
 * A single animation keyframe defining the state at a specific point in time.
 *
 * Generic over the keyframe `value` type for callers that know the per-property
 * value shape (e.g. `PxKeyframe<PxVec2>` in the effect appliers). Defaults to
 * `any`, matching the schema (`value` is stored as `px.any()` on the wire).
 * @public
 */
// The authored type, generic over the value type.
export type PxKeyframe<T = unknown> = Omit<_PxKeyframe, 'value'> & { value?: T };
// Locks the interface to the schema at the default instantiation.
const _ck_PxKeyframe: KeysMatch<PxInfer<typeof PxKeyframeSchema>, _PxKeyframe> = true;


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
     * - `N`         → only the first `N` intervals (when `repeatAt: 'start'`) or the last `N`
     *                 intervals (when `repeatAt: 'end'`) are looped. Clamped to `[1, keyframes.length - 1]`.
     */
    segmentCount?: number;

    /**
     * Which end of the keyframe sequence the repetition fills — see {@link PxLoopRepeatAt}.
     * `'start'` repeats ahead of the first keyframe (intro loop); `'end'` (default)
     * repeats past the last (idle/outro loop).
     */
    repeatAt?: PxLoopRepeatAt;

    /**
     * How successive repetitions play — see {@link PxLoopDirection}.
     *
     * - `'normal'` (default) → **cycle**: every repetition replays the segment the same way round.
     * - `'alternate'`        → **ping-pong**: repetitions alternate forward and backward
     *                          (even repetitions play forward, odd ones in reverse).
     */
    direction?: PxLoopDirection;
}

// `{ segmentCount?:number, repeatAt?:'start'|'end', direction?:'normal'|'alternate' }`
/** @public @advanced */
export const PxLoopSchema = implementsInterface<_PxLoop>()(px.object({
    segmentCount: px.number().optional(),
    repeatAt: px.enum([PxLoopRepeatAt.start, PxLoopRepeatAt.end] as const, PxLoopRepeatAt.end).optional(),
    direction: px.enum([PxLoopDirection.normal, PxLoopDirection.alternate] as const, PxLoopDirection.normal).optional(),
}));

/**
 * Defines how a property's keyframe animation is extended beyond its defined keyframe range
 * by continuously repeating a chosen segment of the sequence.
 * @public
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
    value?: _PxKeyframeValue;

    /** Array of keyframes defining the animation timeline */
    keyframes?: Array<_PxKeyframe>;

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

    /**
     * How a motion-along-path `transform` animation is RENDERED: `'sampled'` (default,
     * absent) — the path is pre-sampled into plain transform keyframes;
     * `'offsetPath'` — the browser drives it as a CSS Motion Path (`offset-path` /
     * `offset-distance`). Written by the editor, consumed by `materializeAllInTree`.
     */
    alongPathMode?: 'sampled' | 'offsetPath';
}

// `{ value?:KeyframeValue, keyframes?:Keyframe[], loop?:Loop|boolean, autoOrient?:bool, alongPathMode?:'sampled'|'offsetPath' }`
// (the `kfs` alias was removed outright — review §1.2/§6.1: one spelling only)
/** @public @advanced */
export const PxPropertyAnimationSchema = implementsInterface<_PxPropertyAnimation>()(px.object({
    value: PxKeyframeValueSchema.optional(),
    keyframes: px.array(PxKeyframeSchema).optional(),
    loop: px.union([PxLoopSchema, px.boolean()]).optional(),
    autoOrient: px.boolean().optional(),
    alongPathMode: px.enum([PxAlongPathMode.sampled, PxAlongPathMode.offsetPath] as const, PxAlongPathMode.sampled).optional(),
}));

/** Animation definition for a single CSS/SVG property — the authored form. @public */
export type PxPropertyAnimation = _PxPropertyAnimation;
// KeysMatch compares only the KEY SETS, so it still locks the schema to the interface even
// though the two disagree about the VALUE type of `keyframes` (above). Worth having here in
// particular: this is the object that carried the `kfs` alias until it was deleted.
const _ck_PxPropertyAnimation: KeysMatch<PxInfer<typeof PxPropertyAnimationSchema>, _PxPropertyAnimation> = true;


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
/** @public @advanced */
export const PxTransformPartsSchema = implementsInterface<_PxTransformParts>()(px.object({
    translate: px.tuple([px.number(), px.number()] as const).optional(),
    rotate: px.number().optional(),
    skew: px.number().optional(),
    scale: px.tuple([px.number(), px.number()] as const).optional(),
    origin: px.tuple([px.number(), px.number()] as const).optional(),
}));

/** Record of transform parts forming a single transform `value`. @public */
export type PxTransformParts = PxInfer<typeof PxTransformPartsSchema>;
const _ck_PxTransformParts: KeysMatch<PxTransformParts, _PxTransformParts> = true; // the key sets are identical

/** The structured-static wrapper `{value: parts}` of a `transform` slot (legacy beside the bare record). @internal */
export const PxTransformValueWrapperSchema = px.object({ value: PxTransformPartsSchema });

/**
 * Unified `transform` slot value. Valid shapes:
 *
 * - **Bare parts record** — `{translate:[100,100], rotate:45, scale:[1.5,1.5],
 *   origin:[25,25]}` — THE canonical lightweight static (SCHEMA-DESIGN §2/S1):
 *   the authored parts verbatim, the exact record grammar animated keyframe
 *   values use. Unambiguous because a body attr never carries animation — that
 *   lives in the parallel `animate` channel (R2); the parts keys are disjoint
 *   from the animation-wrapper keys.
 * - **SVG transform string** — `"translate(125,125)rotate(45)…translate(-25,-25)"`.
 *   The pre-rendered/browser form (origin baked into a pivot sandwich) and the
 *   foreign-SVG import path. Read forever.
 * - **Structured static** — `{value: PxTransformParts}`. Read-accepted legacy
 *   spelling of the record.
 * - **Animated** — `{keyframes: [{time, value: PxTransformParts, …}, …]}`.
 *   Legacy inline form (the editor writes the `animate` channel instead).
 *
 * Replaces the earlier convention of putting each animated transform part
 * under its own top-level attribute name (`translate`, `rotate`, `scale`,
 * `origin`).
 * @public @advanced
 */
export const PxTransformValueSchema = px.union([
    px.string(),
    PxTransformPartsSchema,
    PxTransformValueWrapperSchema,
    PxPropertyAnimationSchema,
]);

/** Unified `transform` slot value: string | structured static | animated. @public */
export type PxTransformValue = PxInfer<typeof PxTransformValueSchema>;


// ============================================================================
// COMPILED ANIMATION — the low layer (dev-docs/plans/compiled-animation-layer.md)
// ============================================================================
//
// What the `plain` stage lowers every `animate` entry to, and what the engines play. The same
// keyframe keys as the authored form; the values are typed by `kind` and nothing is left to
// resolve: no `loop`, no named easing, `time` required, times in content ms. An entry is
// all authored or all compiled. The editor writes the authored form only.

/** A resolved cubic-bezier easing `[x1, y1, x2, y2]` — the only easing a compiled keyframe carries. @public @advanced */
export const PxCubicBezierSchema = px.tuple([px.number(), px.number(), px.number(), px.number()] as const);

/** A resolved cubic-bezier easing `[x1, y1, x2, y2]`. @public @advanced */
export type PxCubicBezier = PxInfer<typeof PxCubicBezierSchema>;

/** A compiled colour `[r, g, b, a]`, every channel 0..1 — always four. @public @advanced */
export const PxRgbaSchema = px.tuple([px.number(), px.number(), px.number(), px.number()] as const);

/** A compiled colour `[r, g, b, a]`, every channel 0..1. @public @advanced */
export type PxRgba = PxInfer<typeof PxRgbaSchema>;

/** A compiled keyframe holding a `V`. */
const compiledKeyframe = <V>(value: PxSchema<V>) => px.object({
    time: px.number(),
    value,
    easing: PxCubicBezierSchema.optional(),
});

/** A compiled `transform` keyframe: a motion path's tangents stay for the frame loop (the native engine samples them away). */
const PxCompiledTransformKeyframeSchema = px.extendedObject(compiledKeyframe(PxTransformPartsSchema), {
    tangentIn: px.tuple([px.number(), px.number()] as const).optional(),
    tangentOut: px.tuple([px.number(), px.number()] as const).optional(),
});

/** A compiled keyframe holding a `V` — the fields every kind shares (only `transform` keyframes carry tangents). @public @advanced */
export type PxCompiledKeyframe<V> = Omit<PxInfer<typeof PxCompiledTransformKeyframeSchema>, 'value'> & { value: V };

/** A `d` value once compiled: the parsed bezier paths. @public @advanced */
export type PxPathValue = PxInfer<typeof PxNormalizedPathValueSchema>;

const compiledMember = <K extends PxValueKind, V>(kind: K, value: PxSchema<V>) =>
    px.object({ kind: px.literal(kind), keyframes: px.array(compiledKeyframe(value)) });

/** One member per `kind` — the value each kind holds. */
const PX_COMPILED_MEMBERS = [
    px.extendedObject(compiledMember(PxValueKind.number, px.number()), {
        /** The one unit every authored value carried (`"20%"` → `20` + `"%"`) — written back with it. */
        unit: px.string().optional(),
    }),
    compiledMember(PxValueKind.percent, px.number()),
    compiledMember(PxValueKind.rotate, px.number()),
    compiledMember(PxValueKind.skew, px.number()),
    compiledMember(PxValueKind.color, PxRgbaSchema),
    compiledMember(PxValueKind.path, px.lazy<PxPathValue>(() => PxNormalizedPathValueSchema, { paths: [] })),
    px.object({
        kind: px.literal(PxValueKind.transform),
        keyframes: px.array(PxCompiledTransformKeyframeSchema),
        /** With tangents: the frame loop turns the element along the path. */
        autoOrient: px.boolean().optional(),
    }),
    compiledMember(PxValueKind.numberList, px.array(px.number())),
    compiledMember(PxValueKind.translate, px.array(px.number())),
    compiledMember(PxValueKind.scale, px.array(px.number())),
    compiledMember(PxValueKind.discrete, px.string()),
] as const;

/** A compiled animation — one property's keyframes, explicit and typed by `kind`. @public @advanced */
export const PxCompiledAnimationSchema = px.discriminatedUnion('kind', PX_COMPILED_MEMBERS);

/** A compiled animation — one property's keyframes, explicit and typed by `kind`. @public @advanced */
export type PxCompiledAnimation = PxInfer<typeof PxCompiledAnimationSchema>;

/** The `animate` entry union around an authored schema — the player's, or one that WIDENS it (the editor's). @internal */
export const anyPropertyAnimationSchemaOf = <A>(authored: PxSchema<A>) => px.discriminatedUnion('kind', PX_COMPILED_MEMBERS, authored);

/** An `animate` entry: authored (no `kind` — what the editor writes) or compiled. @public @advanced */
export const PxAnyPropertyAnimationSchema = anyPropertyAnimationSchemaOf(PxPropertyAnimationSchema);

/** An `animate` entry: authored or compiled. @public @advanced */
export type PxAnyPropertyAnimation = PxInfer<typeof PxAnyPropertyAnimationSchema>;

/** Whether an `animate` entry is in the compiled form. @public @advanced */
export function isCompiledAnimation(anim: PxAnyPropertyAnimation): anim is PxCompiledAnimation {
    return 'kind' in anim;
}


// ============================================================================
// ANIMATION DEFINITION
// ============================================================================

/**
 * Complete animation definition containing one or more property animations.
 * Each key is a CSS/SVG property name (e.g., "opacity", "transform", "fill").
 * (Per-key transform parts — "translate", "rotate", … — are the DEPRECATED spelling: still
 * read, warned as PX1107; spell the pose as a `transform` record, or `effects.transformBy`.)
 *
 * @example
 * { "opacity": { keyframes: [...] }, "transform": { keyframes: [...] } }
 */
export interface _PxAnimationDefinition {
    [property: string]: PxAnyPropertyAnimation;
}

// `Record<propName, PropertyAnimation | CompiledAnimation>`
/** @public @advanced */
export const PxAnimationDefinitionSchema = implementsInterface<_PxAnimationDefinition>()(
    px.record(PxAnyPropertyAnimationSchema)
);

/**
 * Complete animation definition containing one or more property animations.
 * Each key is a CSS/SVG property name (e.g., "opacity", "scale", "rotate").
 * @public
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
 * ["fadeIn", { transform: { keyframes: [...] } }]
 */
export type _PxElementAnimation =
    | string
    | string[]
    | PxAnimationDefinition
    | (string | PxAnimationDefinition)[];

// `string | Array<string|AnimationDefinition> | AnimationDefinition`
/** @public @advanced */
export const PxElementAnimationSchema = implementsInterface<_PxElementAnimation>()(px.union([
    px.string(),
    px.array(px.union([px.string(), PxAnimationDefinitionSchema])),
    PxAnimationDefinitionSchema,
]));

/**
 * Element animation specification.
 * Can be a string reference, array of references, inline definition, or a mixed array.
 * @public
 */
export type PxElementAnimation = PxInfer<typeof PxElementAnimationSchema>;


// ============================================================================
// TRIGGER
// ============================================================================

/**
 * WHEN — which interactions call the built-in actions (dev-docs/plans/playback-layers.md, layer 0). Lists of
 * events from the OPEN vocabulary {@link PxTriggerEvent}; each a single event or several, like `animate`'s
 * references. The state rule, over stopped · playing · paused: `start` acts when stopped, `pause` when playing,
 * `resume` when paused, `stop` when playing or paused — so `click` in `start` and `pause` toggles through all
 * three. Each list names only the events that make sense for it ({@link allowedTriggerEvents}); `resume` is
 * DERIVED when the file does not name it ({@link derivedResume}). HOW each action looks is the timeline's `actions`
 * block: the triggers say only WHEN.
 *
 * WHY THESE NAMES (outside reviews, 2026-10/11; the playback, 2026-11-10 — dev-docs/plans/animation-state.brainstorm.md):
 * `actionTriggers`, not `triggers` — the word *action* is the link to the `actions` block: a key here is a BUTTON a
 * page event presses, the same key there says how that button moves the playhead. The four keys ARE the handle's
 * methods (`playback.start()` / `playback.stop()` / `playback.pause()` / `playback.resume()`) and the edges of the components' `playback`
 * prop: `playback.start` / `playback.stop` bracket a PLAYBACK (one instance of the animation being in effect), `playback.pause` /
 * `playback.resume` bracket a FREEZE inside it. The two blocks are not symmetrical and do not claim to be: a pause and a
 * resume have one possible behavior, so there is no `actions["playback.pause"]`; `whenFinished` and `outOfView` are the
 * clock's and the gate's rules, not page events, so they have no list here. Which list an event is read from in each
 * state: `triggerActionFor`.
 */
export interface _PxActionTriggers {
    /** Starts a playback from the start — in every state it is read in (1.26). An absent block, like an empty one, means
     *  nothing starts it (1.17); a file that plays by itself says `'load'`. */
    [PxTriggerList.startPlayback]?: PxTriggerEvents;
    /** Start or carry on (1.26): resumes a paused playback, turns a returning picture around, starts otherwise; nothing
     *  while playing. What `playback.start` did by default until 1.25. */
    [PxTriggerList.playPlayback]?: PxTriggerEvents;
    /** Stops the playback (when playing, paused or finished) — per `actions["playback.stop"]`. */
    [PxTriggerList.stopPlayback]?: PxTriggerEvents;
    /** Freezes the playback where it is (when playing). */
    [PxTriggerList.pausePlayback]?: PxTriggerEvents;
    /** Resumes it (when paused). Absent, it is DERIVED — the counterpart of each `playback.pause` event (hover out resumes
     *  what hover in paused, a click what a click paused) plus the `playback.start` events that do not stop it. Named, the
     *  list is used as written; the players note where it differs from the derivation ({@link triggerIssues}). */
    [PxTriggerList.resumePlayback]?: PxTriggerEvents;
}

const PxTriggerEventSchema = px.enum([PxTriggerEvent.load, PxTriggerEvent.hoverIn, PxTriggerEvent.hoverOut, PxTriggerEvent.click] as const, PxTriggerEvent.load);
/** One event or several — `"hoverIn"` or `["hoverIn", "click"]`. @public @advanced */
export const PxTriggerEventsSchema = px.union([PxTriggerEventSchema, px.array(PxTriggerEventSchema)]);

/** One event or several, from the events `list` may name — anything else fails the schema, and the document
 *  repair drops that event (never the whole list). */
function triggerListSchema(list: PxTriggerList) {
    return px.words(allowedTriggerEvents(list));
}

/** `timeline.actionTriggers`. @public @advanced */
export const PxActionTriggersSchema = implementsInterface<_PxActionTriggers>()(px.object({
    [PxTriggerList.startPlayback]: triggerListSchema(PxTriggerList.startPlayback).optional(),
    [PxTriggerList.playPlayback]: triggerListSchema(PxTriggerList.playPlayback).optional(),
    [PxTriggerList.stopPlayback]: triggerListSchema(PxTriggerList.stopPlayback).optional(),
    [PxTriggerList.pausePlayback]: triggerListSchema(PxTriggerList.pausePlayback).optional(),
    [PxTriggerList.resumePlayback]: triggerListSchema(PxTriggerList.resumePlayback).optional(),
}));

/** WHEN each built-in action fires — the `actionTriggers` block; see {@link _PxActionTriggers}. A key names the
 *  action, the same key in `actions` says how that action looks. @public */
export type PxActionTriggers = PxInfer<typeof PxActionTriggersSchema>;
const _ck_PxActionTriggers: KeysMatch<PxActionTriggers, _PxActionTriggers> = true; // the key sets are identical

/** The block the `actionTriggers` prop / option takes (every surface, `bind` included) — the same shape the FILE has
 *  ({@link _PxActionTriggers}), `playback.resume` included: left out, it is derived from the other lists; named, it is used
 *  as written. WHY the same power as the file (`resume` was left out until 1.22): an override that cannot say what a
 *  file can is a trap. @public @advanced */
export type PxActionTriggersInput = PxActionTriggers;

/**
 * HOW the built-in actions look (playback-layers.md, layer 1) — one slot per button that has a choice: `behavior` names a
 * PRESET (where the move ends and the path there), and a slot that says only `behavior` is written as the word itself —
 * `"playback.stop": 'animateToStart'` is exactly `"playback.stop": { behavior: 'animateToStart' }`. The words are explained
 * once, in the table above `PxStopPlaybackBehavior`. Nothing to configure on `playback.start` (always from the start,
 * 1.26), `playback.play`, `playback.pause` or `playback.resume`. A key here names the button; the same key in
 * `actionTriggers` says when a page event presses it.
 *
 * WHY `behavior` (1.14): "stop behavior: animateToStart" says what kind of thing the value is; `do` (1.11) and
 * `transition` (1.10, read as CSS) did not. WHY `outOfView` is here and `whenFinished` is not (1.24): both are sensor
 * rules, not buttons; `outOfView` stays where every file has it, `finish` moved beside `whenIdle` because it names what
 * the picture shows once the playback is finished — the second half of CSS's `animation-fill-mode`.
 */
export interface _PxActions {
    /** `behavior`: `jumpToStart` (default), `animateToStart` (the `returning` state), `jumpToEnd`, `animateToEnd` (after
     *  the current pass; both rest `finished`, then `whenFinished` applies), `animateToEndAndBack` (after the current pass,
     *  then backwards to the rest pose). */
    [PxTriggerList.stopPlayback]?: PxStopPlaybackBehavior | { behavior?: PxStopPlaybackBehavior };
    /** None of it on screen (the visibility gate's closing edge) — `behavior`: `pause` (default), `continue`, `stop`.
     *  Back in view, the gate undoes what it did (resumes, or starts again). */
    outOfView?: PxOutOfViewBehavior | { behavior?: PxOutOfViewBehavior };
}

const PxStopPlaybackPresetSchema = px.enum([PxStopPlaybackBehavior.jumpToStart, PxStopPlaybackBehavior.animateToStart, PxStopPlaybackBehavior.jumpToEnd,
    PxStopPlaybackBehavior.animateToEnd, PxStopPlaybackBehavior.animateToEndAndBack] as const, PX_PLAYBACK_DEFAULTS.stopPlaybackBehavior);
const PxOutOfViewPresetSchema = px.enum([PxOutOfViewBehavior.pause, PxOutOfViewBehavior.continue, PxOutOfViewBehavior.stop] as const, PX_PLAYBACK_DEFAULTS.outOfViewBehavior);
/** `timeline.whenFinished` — a plain word, like `whenIdle`. @public @advanced */
export const PxWhenFinishedSchema = px.enum([PxWhenFinished.hold, PxWhenFinished.jumpToStart, PxWhenFinished.animateToStart] as const, PX_PLAYBACK_DEFAULTS.whenFinished);

/** `actions["playback.stop"]`, the settings form. @public @advanced */
export const PxStopPlaybackActionSchema = px.object({ behavior: PxStopPlaybackPresetSchema.optional() });
/** `actions.outOfView`, the settings form. @public @advanced */
export const PxOutOfViewActionSchema = px.object({ behavior: PxOutOfViewPresetSchema.optional() });

/** Each slot: the preset word, or the settings. @public @advanced */
export const PxActionsSchema = implementsInterface<_PxActions>()(px.object({
    [PxTriggerList.stopPlayback]: px.union([PxStopPlaybackPresetSchema, PxStopPlaybackActionSchema]).optional(),
    outOfView: px.union([PxOutOfViewPresetSchema, PxOutOfViewActionSchema]).optional(),
}));

/** HOW the built-in actions look — see {@link _PxActions}. @public */
export type PxActions = PxInfer<typeof PxActionsSchema>;
const _ck_PxActions: KeysMatch<PxActions, _PxActions> = true;


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
    /** Outline path data, in the font's `unitsPerEm` (empty for whitespace). Named
     *  `pathData`, never `d`: `d` is SVG's name for the node ATTRIBUTE only, and every
     *  structure of ours spells the concept out (review §2.4). */
    pathData: string;
}

export const PxGlyphSchema = implementsInterface<_PxGlyph>()(px.object({
    width: px.number(),
    pathData: px.string(),
}));

/** @public */
export type PxGlyph = PxInfer<typeof PxGlyphSchema>;
const _ck_PxGlyph: KeysMatch<PxGlyph, _PxGlyph> = true; // the key sets are identical

/**
 * The used glyphs of one font, keyed by character. Referenced by a text's
 * `font-family` (the key in {@link _PxDefs.fonts}).
 */
export interface _PxGlyphFont {
    /** CSS family name, e.g. "Roboto". */
    fontFamily: string;
    /** Font-style notation, e.g. "" | "italic" (review §5.2 — `style` would collide with the node's CSS `style`). */
    fontStyle: string;
    /** Ascent, in `unitsPerEm` units (baseline placement). */
    ascent: number;
    /** Units per em the glyph `width`/`pathData` are expressed in. Default 1000. */
    unitsPerEm?: number;
    /** Outlines of the used characters, keyed by the character itself. */
    glyphs: { [char: string]: PxGlyph; };
}

export const PxGlyphFontSchema = implementsInterface<_PxGlyphFont>()(px.object({
    fontFamily: px.string(),
    fontStyle: px.string(),
    ascent: px.number(),
    unitsPerEm: px.number(PX_DEFAULT_UNITS_PER_EM).optional(),
    glyphs: px.record(PxGlyphSchema),
}));

/** @public */
export type PxGlyphFont = PxInfer<typeof PxGlyphFontSchema>;
const _ck_PxGlyphFont: KeysMatch<PxGlyphFont, _PxGlyphFont> = true; // the key sets are identical

/**
 * Reusable definitions library for easings, animations and fonts.
 * Defined once here, referenced by name on elements (or, for animations, from bindings).
 * (`styles` — named style presets — was removed on 2026-09-13, review 2.13: nothing wrote it.)
 */
export interface _PxDefs {

    /** Named cubic-bezier easing functions */
    easings?: { [name: string]: [number, number, number, number]; };

    /** Named animation definitions that can be referenced by elements */
    animations?: { [name: string]: PxAnimationDefinition; };

    /** Embedded fonts — per-font glyph outlines, keyed by the text's `font-family`.
     *  Lets glyph-mode `<text>` render without an external font. */
    fonts?: { [fontName: string]: PxGlyphFont; };
}

// `{ easings?:Record<name,[x1,y1,x2,y2]>, animations?:Record<name,AnimationDefinition>, fonts?:Record<fontName,PxGlyphFont> }`
/** @public @advanced */
export const PxDefinitionsSchema = implementsInterface<_PxDefs>()(px.object({
    easings: px.record(px.tuple([px.number(), px.number(), px.number(), px.number()] as const)).optional(),
    animations: px.record(PxAnimationDefinitionSchema).optional(),
    fonts: px.record(PxGlyphFontSchema).optional(),
}));

/** Reusable definitions library for easings, animations and fonts. @public */
export type PxDefinitions = PxInfer<typeof PxDefinitionsSchema>;
const _ck_PxDefs: KeysMatch<PxDefinitions, _PxDefs> = true; // the key sets are identical


// ============================================================================
// SCROLL TIMELINE
// ============================================================================

/**
 * A point on a scroll timeline's range, anchoring where the animation's 0%/100% sit.
 *
 * For `kind: 'view'`, `phase` names WHICH slice of the subject's journey across the
 * scrollport the point is measured in (CSS "timeline range name"), and `fraction` is the
 * 0..1 position within that slice. For `kind: 'scroll'` there are no phases — `phase` is
 * ignored and `fraction` is a fraction of the scroller's total scroll range.
 *
 * Structured on purpose (never a CSS string like `"cover 0%"`): atomic values, mechanical
 * translation to CSS `animation-range` / WAAPI `rangeStart/rangeEnd` where needed.
 */
export interface _PxScrollRangePoint {
    /** `view` kind only: the journey phase this point is anchored in. Default `'cover'`. */
    phase?: PxScrollPhase;
    /** 0..1 within the phase (or of the total scroll range for `kind: 'scroll'`). */
    fraction?: number;
}

/** @public @advanced */
export const PxScrollRangePointSchema = implementsInterface<_PxScrollRangePoint>()(px.object({
    phase: px.enum([PxScrollPhase.cover, PxScrollPhase.contain, PxScrollPhase.entry,
                    PxScrollPhase.exit, PxScrollPhase.entryCrossing, PxScrollPhase.exitCrossing] as const, PxScrollPhase.cover).optional(),
    fraction: px.number().optional(),
}));
/** @public */
export type PxScrollRangePoint = PxInfer<typeof PxScrollRangePointSchema>;
const _ck_PxScrollRangePoint: KeysMatch<PxScrollRangePoint, _PxScrollRangePoint> = true; // the key sets are identical

/**
 * Scroll-timeline configuration — consulted only when `timelineSource: 'scroll'`.
 * All fields optional; the defaults give "scrub the whole animation as the SVG crosses
 * the viewport" (`view` / `block` / full `cover` range).
 */
export interface _PxScroll {
    /** What progress measures. `'view'` (default): the SVG's own journey across the
     *  scrollport (enter → leave). `'scroll'`: the scroll container's offset ratio,
     *  regardless of where the SVG sits. */
    kind?: 'view' | 'scroll';

    /** Scroll axis. `block`/`inline` are writing-mode relative (block = vertical in
     *  horizontal writing); `x`/`y` are physical. Default `'block'`. */
    axis?: 'block' | 'inline' | 'x' | 'y';

    /** `kind: 'scroll'` only: which scroller. `'nearest'` (default) = nearest scrollable
     *  ancestor of the SVG; `'root'` = the document. (`view` always tracks the nearest
     *  scrollport.) */
    source?: 'nearest' | 'root';

    /**
     * `kind: 'view'` only — WHICH ELEMENT'S journey is measured. Unset (default) = the
     * animation's own `<svg>`. The same indirection CSS gives via `view-timeline-name` +
     * `timeline-scope`, GSAP via `trigger`, Framer via "Section in view".
     *
     * - `'parent'` — the nearest ancestor that actually scrolls past: any `sticky`/`fixed`
     *   ancestors are skipped and their container is used instead. This is what makes a
     *   PINNED section work (a stuck element's rect stops moving, so measuring the graphic
     *   itself would freeze); its `contain` phase is exactly the pinned stretch.
     * - `'scroller'` — the scroll container itself.
     * - anything else — a CSS selector, resolved against the host document.
     *
     * An unresolvable selector warns and falls back to the `<svg>` (never a silent freeze).
     */
    subject?: string;

    /**
     * MILLISECONDS of catch-up lag — the same idea as GSAP's `scrub: <seconds>`, in the unit
     * the rest of this schema uses (`duration`, `delay`). Unset/0 = the playhead is locked to
     * the scrollbar; above 0 the progress eases toward the scroll position instead of snapping
     * to it, which reads far smoother under momentum scrolling and trackpads.
     * Custom driver only — a browser-native `ScrollTimeline` has no equivalent, so setting
     * this forces the player's own measurement (the browser timeline is skipped).
     */
    smoothing?: number;

    /**
     * Hold the canvas still on screen while scrolling scrubs it — GSAP's `pin: true`, done with
     * `position: sticky` (which keeps the element's space in normal flow, so unlike GSAP's
     * `position: fixed` no spacer padding has to be injected into the host's layout).
     *
     * The player owns the DOM inside its own container, so this needs NO host CSS. Pair it with
     * `subject: 'parent'` for the complete scrollytelling pattern.
     */
    pin?: boolean;

    /**
     * `pin` only: WHERE in the scrollport the canvas is held — the alignment the sticky
     * offset is computed from. `top` (default) holds it against the top edge; `center`
     * and `bottom` need the canvas's own height, so the player measures it and keeps the
     * offset in sync on resize. `pinOffset` is added on top of whichever alignment is chosen.
     */
    pinAlign?: 'top' | 'center' | 'bottom';

    /** `pin` only: offset from the alignment position (see `pinAlign`), in px. Default 0.
     *  The runtime-view twin of the wire `timeline.pin.offset` (review §2.6). */
    pinOffset?: number;

    /**
     * `pin` only: how much scroll travel the pin should last, in VIEWPORT HEIGHTS — the player
     * injects a wrapper of that height around the canvas to create it. Omit to pin inside
     * whatever tall section the host page already provides.
     */
    pinDistance?: number;

    /** The timeline slice mapped onto animation progress 0..1.
     *  Default `{ start: {phase:'cover', fraction:0}, end: {phase:'cover', fraction:1} }`. */
    range?: {
        start?: _PxScrollRangePoint;
        end?: _PxScrollRangePoint;
    };
}

/** The `range` sub-object — named so consumers can derive its keys. @public @advanced */
export const PxScrollRangeSchema = px.object({
    start: PxScrollRangePointSchema.optional(),
    end: PxScrollRangePointSchema.optional(),
});

/** @public @advanced */
export const PxScrollSchema = implementsInterface<_PxScroll>()(px.object({
    kind: px.enum([PxScrollKind.view, PxScrollKind.scroll] as const, PxScrollKind.view).optional(),
    axis: px.enum([PxScrollAxis.block, PxScrollAxis.inline, PxScrollAxis.x, PxScrollAxis.y] as const, PxScrollAxis.block).optional(),
    source: px.enum([PxScrollSource.nearest, PxScrollSource.root] as const, PxScrollSource.nearest).optional(),
    // Free-form: the two keywords `parent`/`scroller` plus any CSS selector.
    subject: px.string().optional(),
    smoothing: px.number().optional(),
    pin: px.boolean(false).optional(),
    pinAlign: px.enum([PxPinAlign.top, PxPinAlign.center, PxPinAlign.bottom] as const, PxPinAlign.top).optional(),
    pinOffset: px.number().optional(),
    pinDistance: px.number().optional(),
    range: PxScrollRangeSchema.optional(),
}));
/** @public */
export type PxScroll = PxInfer<typeof PxScrollSchema>;
const _ck_PxScroll: KeysMatch<PxScroll, _PxScroll> = true; // the key sets are identical


// ============================================================================
// TIMELINE — what advances the animation's progress (review §2.1)
// ============================================================================
//
// `animator.timeline` is a discriminated object: `type?: 'time' | 'scroll' | 'view'`,
// deliberately mirroring WAAPI's three timeline classes (DocumentTimeline /
// ScrollTimeline / ViewTimeline) and CSS `animation-timeline: auto | scroll() | view()`.
// Each mode carries ONLY its own parameters, so a key that is dead in the other mode is
// structurally unwritable — the old flat spelling (`timelineSource` + sibling `scroll` +
// clock knobs loose at the animator root) required design rules (D3/D4) to keep dead keys
// out; readers accept BOTH spellings (see `resolveAnimatorTimeline`), writers emit only
// this one.

/** Pin parameters as one object — presence enables pinning (review §2.2; the flat runtime-view
 *  spelling is `scroll.pin/pinAlign/pinOffset/pinDistance`). */
export interface _PxTimelinePin {
    /** Where the pinned canvas sits in the viewport. Default `'top'`. */
    align?: 'top' | 'center' | 'bottom';
    /** Offset from the alignment position, in px. Default 0. Named `offset`, not `top`: it is a
     *  delta from whichever edge `align` picked, so `{ align: 'bottom', top: 20 }` read as a
     *  contradiction (review §2.6). */
    offset?: number;
    /** How much scroll travel the pin lasts, in VIEWPORT HEIGHTS. Omit to pin inside
     *  whatever tall section the host page already provides. */
    distance?: number;
}

/** @public @advanced */
export const PxTimelinePinSchema = implementsInterface<_PxTimelinePin>()(px.object({
    align: px.enum([PxPinAlign.top, PxPinAlign.center, PxPinAlign.bottom] as const, PxPinAlign.top).optional(),
    offset: px.number().optional(),
    distance: px.number().optional(),
}));
/** @public */
export type PxTimelinePin = PxInfer<typeof PxTimelinePinSchema>;
const _ck_PxTimelinePin: KeysMatch<PxTimelinePin, _PxTimelinePin> = true; // the key sets are identical

// Time-driven — playback on its own clock (not scroll): something STARTS it (trigger) and it has the
// WAAPI playback dynamics. `type` is OPTIONAL: an absent `type` (or an absent
// `timeline` altogether) means this one — the common case declares nothing.
// `resetOnFinish` has no slot here: its successor is `timeline.whenFinished: 'jumpToStart'` (review §13).
/** `timeline.engine` — HOW the animated attributes get updated (every timeline type;
 *  default `auto`). Not `mode`: an implementation preference, not a behavior switch. */
const PxTimelineEngineSchema = px.enum([PxTimelineEngineSetting.auto, PxTimelineEngineSetting.native, PxTimelineEngineSetting.js] as const, PxTimelineEngineSetting.auto).optional();

/**
 * The time-driven timeline. Declared as an interface so a rename inside the schema below is a
 * COMPILE error rather than a silent wire-format change — `resolveAnimatorTimeline` reads the
 * timeline through `any`, so without this lock nothing else in the repo would notice.
 */
export interface _PxTimeTimeline {
    /** Optional: an absent `type` (or an absent `timeline`) already means this member. */
    type?: 'time';
    /** How the animated attributes get updated. Default `auto`. WHY `engine`, not `mode`: it picks HOW attributes
     *  are driven (an implementation preference), not WHAT you see; see {@link PxTimelineEngineSetting} for `native`. */
    engine?: PxTimelineEngineSetting;
    /** Target fps for the player's frame loop — a parameter of the `engine` chosen above, so it
     *  sits beside it. Uncapped when absent; ignored by every engine except the frame loop. */
    frameRate?: number;
    /** CONTENT ms where the window begins (first-use review §4). Default 0. WHY `inTime` / `outTime`, not
     *  `startTime` / `endTime`: they are the editor's in and out points — positions in the CONTENT, not in the playback
     *  (a playback with `iterations: 3` has one `outTime` and three passes). */
    inTime?: number;
    /** CONTENT ms where the window ends. The editor always writes it; absent, the player derives
     *  it — the max raw keyframe time across all animations, else the old default length. */
    outTime?: number;
    /** The SPEED one pass plays at: 1 (default) = one content ms per playback ms, 2 = twice as fast, 0.5 = half. The
     *  handle's `playback.setSpeed()` replaces it at runtime; `playback.setDurationAtSpeed(ms)` is the same knob asked for as a
     *  length. WHY a speed, not a duration (`playDuration` until 1.15): every player spells speed as a factor
     *  (lottie-web `setSpeed`, WAAPI `playbackRate`, GSAP `timeScale`) and a factor needs no knowledge of the content's
     *  length. WHY `playback…` (`playSpeed` until 1.21): "playback speed" is how media players say it, and the handle's
     *  family reads the same (`playback.getDurationAtSpeed()`, `playback.getCurrentTimeAtSpeed()`). Must be positive; direction is
     *  `iterationDirection`. */
    playbackSpeed?: number;
    /** WHEN each button is pressed — the lists of events. Absent and `{}` are the same: nothing starts it (the
     *  manual document); a file that plays by itself names `"playback.start": 'load'` — the editor always writes it, and 1.17
     *  wrote it into files that relied on the old "absent = load". WHY: a default nobody wrote is a guess, and an
     *  absent block and an empty one meaning different things trapped every merge patch and hand edit. */
    actionTriggers?: _PxActionTriggers;
    /** Wait before the first iteration, ms. Negative skips ahead. Waited whenever a playback starts from the
     *  beginning — every `playback.start`, a `playback.play` from rest — never on a resume from a pause. */
    delay?: number;
    /** Repeat count, or `'infinite'` — WAAPI's word and values. */
    iterations?: number | 'infinite';
    /** Each iteration's direction (`reverse` applies to a single pass too — still one iteration). WAAPI's
     *  `direction`, with `iteration` in front because it is per iteration — a scroll timeline has an axis direction of
     *  its own; `alternateReverse` is `alternate-reverse` in the format's camelCase, like every value. */
    iterationDirection?: PxPlaybackDirection;
    /** HOW the buttons move the playhead — `playback.stop` (+ the gate's `outOfView`), each a preset word or its settings. */
    actions?: _PxActions;
    /** What the picture shows once the playback is `finished` — the natural end, or a stop that went there: `hold` the
     *  last frame (default), `jumpToStart` / `animateToStart` back to the rest pose. The playback stays `finished` either
     *  way. The runtime view derives `fill` from it and `whenIdle`. (`atEnd` until 1.25, `actions.finish` until 1.23.) */
    whenFinished?: PxWhenFinished;
    /** What is shown while IDLE — before the first play, back at the start after a jump or an animate there: `static` (default) = the SVG as it
     *  is in the file, no animation applied; `firstFrame` = the first frame's values — hand-authored files only; the
     *  Editor never writes it (by the format's contract the static attributes ARE the first frame, `PxRestPose`).
     *  Named after the state it governs, WAAPI's `idle`; see {@link PxWhenIdle}. */
    whenIdle?: PxWhenIdle;
    /** How much must be on screen to count as in view (0–1, default 0.5; 0 = any visible pixel). */
    inViewThreshold?: number;
    /** How long that must hold, ms (default 150). WHY `debounce`, not `delay`: a pending open is CANCELLED when
     *  visibility drops below the threshold before the time is up — scrolling straight past starts nothing. */
    inViewDebounce?: number;
}

/** The time-driven member of {@link PxTimelineSchema} — what an absent `type` selects. Exported
 *  so a reader can ask it what an omitted field means (`PxTimeTimelineSchema.defaults.whenIdle`).
 *  @public @advanced */
export const PxTimeTimelineSchema = implementsInterface<_PxTimeTimeline>()(px.object({
    type: px.literal('time').optional(),
    engine: PxTimelineEngineSchema,
    frameRate: px.number().optional(),
    // First-use review §4: the content WINDOW replaces `duration` — `inTime`/`outTime` are
    // content ms (the editing in/out points). `outTime` has a DERIVED default (max keyframe
    // time), so the schema states no constant for it.
    inTime: px.number(0).optional(),
    outTime: px.number().optional(),
    playbackSpeed: px.number(1).optional(),
    actionTriggers: PxActionTriggersSchema.optional(),
    delay: px.number(0).optional(),
    iterations: px.union([px.number(PX_DEFAULT_ITERATIONS), px.literal('infinite')], PX_DEFAULT_ITERATIONS).optional(),
    iterationDirection: px.enum([PxPlaybackDirection.normal, PxPlaybackDirection.reverse, PxPlaybackDirection.alternate, PxPlaybackDirection.alternateReverse] as const, PxPlaybackDirection.normal).optional(),
    actions: PxActionsSchema.optional(),
    whenFinished: PxWhenFinishedSchema.optional(),
    whenIdle: px.enum([PxWhenIdle.static, PxWhenIdle.firstFrame] as const, PX_PLAYBACK_DEFAULTS.whenIdle).optional(),
    inViewThreshold: px.number(PX_PLAYBACK_DEFAULTS.inViewThreshold).optional(),
    inViewDebounce: px.number(PX_PLAYBACK_DEFAULTS.inViewDebounce).optional(),
}));
const _ck_PxTimeTimeline: KeysMatch<PxInfer<typeof PxTimeTimelineSchema>, _PxTimeTimeline> = true;

// Scroll-driven modes — progress scrubbed from scroll position; nothing starts or
// finishes it, so none of the clock knobs exist here. `'scroll'` tracks a scroller's
// scroll offset, `'view'` tracks the subject's visibility through the viewport —
// exactly WAAPI ScrollTimeline vs ViewTimeline (the old nested `scroll.kind` dissolved
// into this discriminant). `mode` (shared by every timeline type) says who runs the
// animation; `pin` is boolean-or-object (§2.2).
const scrollishTimelineShape = {
    // First-use review §4: the content WINDOW — under scrubbing it is the keyframe span the
    // scroll range maps onto. No `playDuration` here: scroll owns the pace.
    inTime: px.number(0).optional(),
    outTime: px.number().optional(),
    // Finite repeat count IS meaningful when scrubbing — the scroll range maps onto
    // duration × iterations (rule D4; `'infinite'` cannot map to a range, so no literal here).
    iterations: px.number().optional(),
    engine: PxTimelineEngineSchema,
    frameRate: px.number().optional(),
    axis: px.enum([PxScrollAxis.block, PxScrollAxis.inline, PxScrollAxis.x, PxScrollAxis.y] as const, PxScrollAxis.block).optional(),
    source: px.enum([PxScrollSource.nearest, PxScrollSource.root] as const, PxScrollSource.nearest).optional(),
    subject: px.string().optional(),   // 'parent' | 'scroller' | any CSS selector
    smoothing: px.number().optional(), // ms
    pin: px.union([px.boolean(), PxTimelinePinSchema]).optional(),
    range: PxScrollRangeSchema.optional(),
};
/** The keys both scroll-driven members carry. Locked the same way as the time member. */
export interface _PxScrollishTimelineShape {
    /** CONTENT ms where the window begins. Default 0. */
    inTime?: number;
    /** CONTENT ms where the window ends; under scrubbing the scroll range maps onto the window. */
    outTime?: number;
    /** Finite only — `'infinite'` cannot map onto a range (rule D4). */
    iterations?: number;
    /** How the animated attributes get updated. Default `auto`. */
    engine?: PxTimelineEngineSetting;
    /** Target fps for the player's frame loop (shared with the time member). */
    frameRate?: number;
    /** `block`/`inline` are writing-mode relative; `x`/`y` are physical. Default `'block'`. */
    axis?: 'block' | 'inline' | 'x' | 'y';
    /** `'nearest'` (default) scrollable ancestor, or `'root'`, the document. */
    source?: 'nearest' | 'root';
    /** `'parent'` · `'scroller'` · any CSS selector. */
    subject?: string;
    /** How long the playhead takes to catch up with the scrollbar, ms. */
    smoothing?: number;
    /** `true` to pin with defaults, or the parameters (review §2.2). */
    pin?: boolean | _PxTimelinePin;
    /** The slice of the timeline mapped onto progress 0..1. */
    range?: { start?: _PxScrollRangePoint; end?: _PxScrollRangePoint };
}

/** `interface X extends Y { type: 'scroll' }` — spelled as an intersection so the key-set
 *  check below compares exactly the discriminant plus the shared shape. */
export type _PxScrollTimeline = _PxScrollishTimelineShape & { type: 'scroll' };
export type _PxViewTimeline = _PxScrollishTimelineShape & { type: 'view' };

const PxScrollTimelineSchema = implementsInterface<_PxScrollTimeline>()(
    px.object({ type: px.literal('scroll'), ...scrollishTimelineShape }));
const PxViewTimelineSchema = implementsInterface<_PxViewTimeline>()(
    px.object({ type: px.literal('view'), ...scrollishTimelineShape }));
const _ck_PxScrollTimeline: KeysMatch<PxInfer<typeof PxScrollTimelineSchema>, _PxScrollTimeline> = true;
const _ck_PxViewTimeline: KeysMatch<PxInfer<typeof PxViewTimelineSchema>, _PxViewTimeline> = true;

/** @public @advanced */
export const PxTimelineSchema = px.discriminatedUnion('type', [
    PxTimeTimelineSchema,   // first = the member an absent `type` selects
    PxScrollTimelineSchema,
    PxViewTimelineSchema,
]);
/** @public */
export type PxTimeline = PxInfer<typeof PxTimelineSchema>;


// ============================================================================
// ANIMATOR CONFIG
// ============================================================================

/**
 * Global animation configuration that applies to all animations in the document.
 * Defines timing, playback behavior, and rendering strategy.
 */
export interface _PxAnimatorConfig {

    /** RUNTIME VIEW ONLY (not wire — the wire spells it `timeline.engine`, on every
     *  timeline type; same word both sides). How the animated attributes get updated;
     *  see {@link PxTimelineEngineSetting}. */
    engine?: PxTimelineEngineSetting;

    /** RUNTIME VIEW ONLY (not wire — the wire spells the window `timeline.inTime`/`outTime`).
     *  The resolved CONTENT WINDOW LENGTH in ms (`outTime − inTime`): the engines' one length. */
    duration?: number;

    /** RUNTIME VIEW ONLY. The resolved window start in CONTENT ms — `normalizeBindings` shifts
     *  every keyframe time by it, so the engines keep sampling from 0. Default 0. */
    inTime?: number;

    /** RUNTIME VIEW ONLY. The file's `timeline.playbackSpeed` — the speed the player starts at; the handle's
     *  `playback.setSpeed()` replaces it. Absent = 1. */
    playbackSpeed?: number;

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
     *  mechanics as a `jumpToStart` stop). Off by default — the animation
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
    fill?: PxFillMode;

    /** Direction of animation playback */
    direction?: PxPlaybackDirection;

    /** RUNTIME VIEW ONLY — the wire spells it `timeline.frameRate`. Target frame rate for the
     *  player's frame loop; ignored by WAAPI, React Native and the pre-rendered CSS export. */
    frameRate?: number;

    /** WHEN each button is pressed — copied from the wire's `timeline.actionTriggers` */
    actionTriggers?: PxActionTriggers;
    /** HOW the built-in actions look — copied from the wire (`fill` / `resetOnFinish` / `direction` above are derived). */
    actions?: PxActions;
    /** The wire's rest pose, carried through so a WRITER round-trips it; the engines read `fill`. */
    whenIdle?: PxWhenIdle;
    /** The wire's `whenFinished`, carried through (the executor reads it; the engines read `fill` / `resetOnFinish`). */
    whenFinished?: PxWhenFinished;
    inViewThreshold?: number;
    inViewDebounce?: number;

    /** Named easings, animations and embedded fonts — referenced by elements and bindings */
    definitions?: PxDefinitions;

    /**
     * The bind-by-id document (a pre-rendered SVG + JS export, no `children`): the elements
     * already exist as markup, so instead of carrying them again the document lists WHICH
     * element plays WHICH named animations — see {@link _PxBinding}. Written by the editor's
     * exporter only; a self-contained document keeps its keyframes on the nodes (`node.animate`).
     *
     * @example [{ target: "#_px_3cnuvau3", animateWith: ["a0"] }]
     */
    bindings?: Array<PxBinding>;

    /**
     * RUNTIME VIEW ONLY (not wire) — what ADVANCES the animation. `'time'` (default)
     * is the player's own clock; `'scroll'` is scroll-linked playback ("scrubbing"), matching
     * CSS scroll-driven animations.
     *
     * The wire spells this as `timeline.type` ('time' — or absent — vs 'scroll'/'view');
     * `resolveAnimatorTimeline` folds it into this field for the engines.
     * Distinct from `actionTriggers["playback.start"]`, which says what STARTS the animation: one
     * names the beginning, this one names what moves the playhead afterwards.
     * Design: app `svgeditor/animation/scroll-timeline.design.md`.
     */
    timelineSource?: string;

    /** RUNTIME VIEW ONLY (not wire) — scroll-timeline parameters, only consulted when
     *  `timelineSource: 'scroll'`. The wire spells them inside `timeline`. */
    scroll?: PxScroll;

    /** What advances the animation — THE wire spelling (review §2.1): a discriminated
     *  `{ type?: 'time' | 'scroll' | 'view', … }` object mirroring WAAPI's timeline
     *  classes. Carries the playback dynamics (`trigger`/`delay`/`iterations`/`fillMode`/
     *  `direction` for time; scroll geometry for scroll/view); the flat fields above
     *  are the internal runtime view `resolveAnimatorTimeline` produces from it. */
    timeline?: PxTimeline;

    /**
     * WIRE FORMAT VERSION, `"a.b.c"` — the layering, not a build number:
     *   `a.b`  the PLAYER schema. A reader at `a.b` reads any file at `a.[b' <= b]`.
     *   `c`    the EDITOR's extension on top of that player schema (`meta.*`). The player
     *          ignores it entirely; it is scoped to `(a,b)` and restarts when `b` moves.
     *
     * A mismatch on its own means NOTHING and must never warn: a bump says the schema gained
     * something, not that this document uses it. The number is consulted only when a
     * conversion needs it, or when unknown content was actually met — where it turns
     * "something is wrong" into "written for 1.5, this build reads 1.1; update the player".
     *
     * ABSENT means unknown, never "oldest": no version is assumed and no migration is guessed.
     *
     * WHY `version`, not `schemaVersion`: inside `animator` the word already says whose version it is, and the
     * three-part number is this format's own (above), not semver — a longer name would promise the wrong thing.
     */
    version?: string;
}

// ============================================================================
// BINDINGS — the bind-by-id document (a pre-rendered SVG + JS export)
// ============================================================================

/**
 * One binding: WHICH element (`target`, `#id`-spelled like every element reference) plays
 * WHICH named animations (`animateWith` — names into `definitions.animations`, applied in
 * order, always an array).
 *
 * `…With` is the format's naming convention for "by name, from `definitions`" (review 2.12):
 * a bare key holds the thing itself (`node.animate` holds keyframes); `<key>With` holds an
 * ARRAY of names of the same concept (`animateWith` → `definitions.animations`). Two kinds of
 * reference, two spellings — `source` / `target` point at ELEMENTS (`#id`), `…With` points at
 * DEFINITIONS. Nothing else uses the convention yet; it is written down here so the next
 * key that refers to a definition by name spells it the same way.
 */
export interface _PxBinding {
    /** The element to animate — its id, written `'#id'`; NOT a CSS selector (no `.class`, no `svg > g`). WHY
     *  `target`: WAAPI's `KeyframeEffect.target`; `selector` would promise what no player resolves. */
    target: string;
    /** Names into `definitions.animations`, applied in order. */
    animateWith: Array<string>;
}

/** @public @advanced */
export const PxBindingSchema = implementsInterface<_PxBinding>()(px.object({
    target: px.string(),
    animateWith: px.array(px.string()),
}));

/** @public */
export type PxBinding = PxInfer<typeof PxBindingSchema>;
const _ck_PxBinding: KeysMatch<PxBinding, _PxBinding> = true; // the key sets are identical

// The WIRE format (review §2.1): playback dynamics live only inside `timeline` —
// the flat spelling (`trigger`/`delay`/`iterations`/`fill`/`direction`/`resetOnFinish`/
// `timelineSource`/`scroll`) is NOT part of the format. It exists only as the internal
// runtime VIEW (`_PxAnimatorConfig`) that `resolveAnimatorTimeline` produces for the engines.
/** @public @advanced */
export const PxAnimatorConfigSchema = implementsInterface<_PxAnimatorConfig>()(px.object({
    // (`mode`, `duration` and `frameRate` live INSIDE `timeline` on the wire — §2.8; they exist
    // at this level only on the runtime view, like the rest of the playback dynamics.)
    // THE spelling of "what advances progress" — clock / scroll / view (review §2.1).
    timeline: PxTimelineSchema.optional(),
    definitions: PxDefinitionsSchema.optional(),
    bindings: px.array(PxBindingSchema).optional(),
    // Declared HERE because this is a closed object: an undeclared key would be stripped by
    // `sanitize` and flagged by strict validation on our own files.
    version: px.string().optional(),
}));

/**
 * The document's `animator` block as written in a file: `timeline`, `definitions`, `bindings`,
 * `version` — the playback dynamics live inside `timeline` (review §2.1).
 * A flat key (`duration`, `trigger`, …) does not type-check here: the player drops it.
 * @public
 */
export type PxAnimatorConfig = PxInfer<typeof PxAnimatorConfigSchema>;

/**
 * The flat runtime view of the `animator` block: `timeline` folded into top-level `duration`,
 * `trigger`, `delay`, `iterations`, `fill`, `direction`, `resetOnFinish`, `timelineSource` /
 * `scroll`, `engine`, `frameRate`. Not a file format — `getAnimatorConfig` and
 * `resolveAnimatorTimeline` return it, `nestAnimatorTimeline` turns it back into a
 * {@link PxAnimatorConfig}. A superset of the written shape.
 * @public @advanced
 */
export type PxAnimatorRuntimeConfig = _PxAnimatorConfig;



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
 * - a `{keyframes}` object — inline property animation
 *
 * The unified rule (primitive/array | `{value}` | `{keyframes}`) applies across
 * the format. For most attributes the `{value}` form is rarely used on the body
 * (a primitive suffices for static); for `transform` it is the canonical
 * structured-static shape. See `PxTransformValueSchema`.
 */
/**
 * Value of an open (undeclared) attribute key on a node — i.e. a BODY attribute.
 *
 * STATIC ONLY (R2/J3): a body attr never carries its own animation. Animation goes
 * in the parallel `animate` channel, keyed by attribute name — that is what keeps a
 * document degradable to valid static SVG. `PxPropertyAnimationSchema` used to be a
 * member here, which made an inline `"opacity": {keyframes:[…]}` schema-LEGAL even
 * though nothing writes it and nothing reads it; worse, being an all-optional object
 * schema it was ALSO what (accidentally) validated the transform parts record. The
 * parts record is now declared explicitly, so the two are no longer conflated.
 * @public @advanced
 */
export const PxAttrValueSchema = px.union([
    px.string(),
    px.number(),
    px.array(px.number()),
    // Structured static — `{value: …}` (read-accepted transitional spelling, S1).
    // `defined`, not `any`: the KEY's presence is what identifies this branch (V6).
    px.object({ value: px.defined() }),
    // Bare transform parts record — the canonical static `transform` on the wire (T2).
    PxTransformPartsSchema,
]);

/** Per-attribute value: primitive/number-array for static, `{value}` for structured
 *  static, or a bare transform parts record. NEVER an animation — see `animate` (R2). * @public
 */
export type PxAttrValue = string | number | Array<number> | { value: unknown } | PxTransformParts;


/**
 * Base interface for all SVG elements.
 * Named properties take precedence over the index signature when accessed.
 */
export interface _PxNode {

    /** SVG element type (e.g., "circle", "rect", "path", "g") */
    type: string;

    /** A REAL `type` attribute, for the elements that have one (`<feTurbulence
     *  type="fractalNoise">`, `<feFuncR type="table">`) — `type` itself is the tag name.
     *  The renderer turns this back into the attribute. */
    domType?: string;

    /** Text content of a `<text>` / `<tspan>` — the one text-content key (the DOM property name). */
    textContent?: string;

    /** Child elements (for container elements like <g>) */
    children?: PxNode[];

    /** Meta informaion about this element — the editor's, opaque to the player. */
    meta?: unknown;

    /**
     * Player-effects bucket (transformation/repeater/maskedBy/strokeTrim/retime/ref)
     * emitted by the Editor's lightweight design format. `materializeNodeEffects`
     * materializes and removes these before any other normalization, so the
     * Player never observes a non-empty `effects` after entry-point processing.
     *
     * Typed against `PxEffectsSchema` (closed object — strict-mode validation
     * flags unknown effect keys). Adding a new effect requires extending the
     * `_PxEffects` interface AND the schema in lockstep.
     */
    effects?: PxEffects;

    /**
     * In-place property animations for this element. Same shape as the
     * `node.animate` values: string ref, array of refs, inline
     * definition (`{propName: PxPropertyAnimation}`), or mixed array.
     * The static initial value of an animated property is still carried as a
     * plain attribute on the body.
     */
    animate?: PxElementAnimation;

    /**
     * Inline style declarations for this element — camelCase CSS property names, exactly like
     * React's `style` prop (`whiteSpace`, `pointerEvents`, `mixBlendMode`) → value. The web
     * player writes them to `element.style`, React Native applies them as props; an explicit
     * attribute on the node wins. An OBJECT only: no CSS text, no preset names
     * (`definitions.styles` was removed — review 2.13).
     */
    style?: Record<string, string | number>;

    /**
     * Every other key is an SVG attribute under its camelCase DOM name — the spelling React
     * uses (`strokeWidth`, `fontSize`, `viewBox`, `clipPath`), which is what the editor writes.
     * The player renders it to the standard attribute (`stroke-width`) and accepts that kebab
     * spelling on the way in. A value is either a primitive (static) or a PxPropertyAnimation
     * (in-place animation `{ keyframes: [...] }`).
     */
    [camelCaseDomKey: string]: unknown;
}

// ============================================================================
// PLAYER-EFFECTS BUCKET — INTERFACES + SCHEMAS (linked via `implementsInterface`)
// ============================================================================
//
// Schemas for the `node.effects` payload emitted by the Editor's lightweight
// design format. `materializeNodeEffects` (in `effects/PlayerEffectsUtil.ts`)
// materializes and removes these before any other normalization, so the Player
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

/** Fixed-length 2-number tuple. `[x, y]` for positions, `[sx, sy]` for scale, …. @public */
export type PxVec2 = [number, number];

// The VALUE grammars of the animatable channels — `readAnimatable` casts static and keyframe values with them.
/** @internal */
export const PxVec2Schema = px.tuple([px.number(), px.number()] as const);
/** @internal */
export const PxChannelNumberSchema = px.number();
/** A path slot's value: the `d` string, or the `{pathData}` keyframe-value object. @internal */
export const PxPathValueSchema = px.union([px.string(), PxPathDataValueSchema]);

/**
 * Animatable wire value — the ONE grammar for every animatable slot:
 *
 *   T                      — raw static (non-object T)
 *   { value: T }           — structured static
 *   PxPropertyAnimation    — animated: `{value?, keyframes, loop?, autoOrient?}`
 *
 * The animated form IS `PxPropertyAnimation` — the exact object `node.animate`
 * channels use — so effect slots and node attributes share one schema, one
 * reader (`effects/transformParts.readAnimatable`) and one loop-materialization
 * path. `value` inside the animated form is the optional static baseline (see
 * `_PxPropertyAnimation.value`).
 *
 * Generic over the per-kf value type `T` for compile-time narrowing of the
 * static / `{value}` forms. The animated form uses the lib's non-generic
 * `PxKeyframe` (whose `value` is `any`) — kf values are read with care in the
 * applier (the visualModel walker / `interpParts` know per-property shapes).
 * @internal
 */
export type PxAnimatable<T> = T | { value: T } | _PxPropertyAnimation;

// ORDER LAW (same medicine as PxKeyframeValueSchema): in every animatable union the
// PropertyAnimation member comes BEFORE the bare `{value}` wrapper. Union.sanitize takes
// the first member that validates, and default-mode object validation tolerates unknown
// keys — wrapper-first would route `{value, keyframes}` to the wrapper and silently strip
// the keyframes. A `{value}`-only static hitting PropertyAnimation first loses nothing
// (it declares `value` too). Validity is order-independent; only repair cares.

// PxAnimatable<number> — static number OR `{value}` static OR PxPropertyAnimation.
const PxAnimatableNumberSchema = px.union([
    PxChannelNumberSchema,
    PxPropertyAnimationSchema,
    px.object({ value: PxChannelNumberSchema }),
]);

// PxAnimatable<PxVec2> — static `[x,y]` OR `{value:[x,y]}` OR PxPropertyAnimation.
// `as const` on the tuples is REQUIRED for TS to infer `[number, number]` (a
// fixed-length tuple = `PxVec2`) instead of the looser `number[]`.
const PxAnimatableVec2Schema = px.union([
    PxVec2Schema,
    PxPropertyAnimationSchema,
    px.object({ value: PxVec2Schema }),
]);

// PxAnimatable<string> — static `"M…"` OR `{value:"M…"}` OR PxPropertyAnimation.
const PxAnimatableStringSchema = px.union([
    px.string(),
    PxPropertyAnimationSchema,
    px.object({ value: px.string() }),
]);

// ── CHANNEL vs CONFIG (V2) — the split is declared in the SOURCE, twice over ──
// An effect slot is one of exactly two kinds, and both declarations must agree:
//   channel (samplable per frame) → interface `PxAnimatable<T>` + a named
//                                   `PxAnimatable*Schema` in the schema
//   static config (read once)     → the bare type + a bare `px.*()` slot
// Never hand-inline the `[T, {value:T}, PxPropertyAnimation]` union at a slot:
// the NAME is what makes the split machine-readable. Editor side mirrors this
// with `isAnimatable: true` on the value's config.


/** Per-part editor transform (`transformBy` effect). All parts optional and animatable. */
export interface _PxTransformByEffect {
    translate?: PxAnimatable<PxVec2>;
    rotate?: PxAnimatable<number>;
    scale?: PxAnimatable<PxVec2>;
    /** Skew (skewX) in degrees — a NUMBER (matches the editor's scalar skew part). */
    skew?: PxAnimatable<number>;
    origin?: PxAnimatable<PxVec2>;
}
/** @public @advanced */
export const PxTransformByEffectSchema = implementsInterface<_PxTransformByEffect>()(px.object({
    translate: PxAnimatableVec2Schema.optional(),
    rotate: PxAnimatableNumberSchema.optional(),
    scale: PxAnimatableVec2Schema.optional(),
    skew: PxAnimatableNumberSchema.optional(),
    origin: PxAnimatableVec2Schema.optional(),
}));
/** @public */
export type PxTransformByEffect = PxInfer<typeof PxTransformByEffectSchema>;
const _ck_PxTransformByEffect: KeysMatch<PxTransformByEffect, _PxTransformByEffect> = true;


/** Per-copy repeater offsets. Each part is animatable; per-copy values scale
 *  with the copy index `i` (translate/rotate/skew × i; scale per-axis `v^i`).
 *  Static repeater values pass through as a structured `transform: {value:…}` on
 *  the per-copy wrapper; animated values are emitted as `animate.transform.keyframes`
 *  with each kf value scaled by `i`. See `effects/repeaterEffect.ts`.
 *
 *  NAMING — why `repeater`, NOT `repeat` (SCHEMA-DESIGN R5 / issues N6): this
 *  effect repeats in SPACE (N copies, each with a compounding per-copy delta), but
 *  in an ANIMATION format a bare `repeat` reads as TIME — and this format has real
 *  time-repetition concepts for it to be confused with: `animator.iterations`,
 *  per-property `loop {segmentCount, alternate}`, and SVG/SMIL's own
 *  `repeatCount`/`repeatDur`. The agent noun keeps it unambiguously spatial, and
 *  matches the term the audience already knows (After Effects "Repeater",
 *  Lottie shape item `rp`). Same principle as `maskedBy` over `mask`: prefer the
 *  form that preserves the right MEANING over the grammatically uniform one. */
export interface _PxRepeaterEffect {
    copies?: number;
    translate?: PxAnimatable<PxVec2>;
    rotate?: PxAnimatable<number>;
    /** Per-copy skew (skewX) increment in degrees — copy `i` is skewed by `skew × i`. */
    skew?: PxAnimatable<number>;
    scale?: PxAnimatable<PxVec2>;       // per-copy FACTOR (0.85 = 85% per copy), like every other scale
    origin?: PxAnimatable<PxVec2>;
}
/** @public @advanced */
export const PxRepeaterEffectSchema = implementsInterface<_PxRepeaterEffect>()(px.object({
    // STATIC config, not a channel (V2/SCHEMA-DESIGN R5): the copy COUNT is read
    // once at expansion time and never sampled — plain number, no `keyframes`.
    copies: px.number().optional(),
    translate: PxAnimatableVec2Schema.optional(),
    rotate: PxAnimatableNumberSchema.optional(),
    skew: PxAnimatableNumberSchema.optional(),
    scale: PxAnimatableVec2Schema.optional(),
    origin: PxAnimatableVec2Schema.optional(),
}));
/** @public */
export type PxRepeaterEffect = PxInfer<typeof PxRepeaterEffectSchema>;
const _ck_PxRepeaterEffect: KeysMatch<PxRepeaterEffect, _PxRepeaterEffect> = true;


/** Mask source ref + standard `<mask>` attributes.
 *  `source` is `#id` (canonical ref spelling, SCHEMA-DESIGN §4 E-5); bare `id` is legacy, read-only.
 *  `start`/`size` are the `<mask>` viewport — its `x`/`y` and `width`/`height` in
 *  `maskUnits` space. Absent = SVG's implicit mask region (−10% … 120% of the
 *  bounding box), which is also the editor's default — so they only appear when a
 *  document (typically an imported SVG) carries explicit mask bounds. */
export interface _PxMaskedByEffect {
    source?: string;
    maskType?: string;
    maskUnits?: string;
    maskContentUnits?: string;
    // Mask viewport in `maskUnits` space — the SVG `<mask>` attrs verbatim (B5).
    // NOT `start`/`size` pairs: those were the EDITOR's model FIELD names, never a
    // wire spelling — the editor has always written these four scalars, so the old
    // pair declaration meant the player silently dropped every non-default viewport.
    x?: number;
    y?: number;
    width?: number;
    height?: number;
}
/** @public @advanced */
export const PxMaskedByEffectSchema = implementsInterface<_PxMaskedByEffect>()(px.object({
    source: px.string().optional(),
    // SVG's own initial values — what a <mask> does when the attribute is not there.
    maskType: px.enum([PxMaskType.luminance, PxMaskType.alpha] as const, PxMaskType.luminance).optional(),
    maskUnits: px.enum([PxUnits.userSpaceOnUse, PxUnits.objectBoundingBox] as const, PxUnits.objectBoundingBox).optional(),
    maskContentUnits: px.enum([PxUnits.userSpaceOnUse, PxUnits.objectBoundingBox] as const, PxUnits.userSpaceOnUse).optional(),
    x: px.number().optional(),
    y: px.number().optional(),
    width: px.number().optional(),
    height: px.number().optional(),
}));
/** @public */
export type PxMaskedByEffect = PxInfer<typeof PxMaskedByEffectSchema>;
const _ck_PxMaskedByEffect: KeysMatch<PxMaskedByEffect, _PxMaskedByEffect> = true;


/**
 * Clip-path effect — clips the host element to a vector path. `pathData` is a standard
 * animatable slot (same grammar as the body `d` ATTRIBUTE, which keeps SVG's own name):
 * static = plain SVG path-data string (one or more subpaths); animated = `{keyframes}`
 * whose values are `{pathData:"M…"}`.
 * At apply time an animated slot lands on the generated `<path>`'s `animate.d`, so the
 * player's frame loop rewrites the clip path's `d` attribute per frame. `clip-path`
 * is a live reference, so the browser re-clips each frame (unlike `<marker>` —
 * verified across SMIL/CSS/JS/WAAPI).
 *
 * At apply time the effect generates a `<clipPath><path d/></clipPath>` def and sets
 * `clip-path="url(#auto-id)"` on the host (materializer pattern, like `maskedBy` /
 * gradient). See `effects/clipPathEffect.ts`.
 */
export interface _PxClipPathEffect {
    pathData?: PxAnimatable<string>;
}
/** @public @advanced */
export const PxClipPathEffectSchema = implementsInterface<_PxClipPathEffect>()(px.object({
    pathData: PxAnimatableStringSchema.optional(),
}));
export type PxClipPathEffect = PxInfer<typeof PxClipPathEffectSchema>;
const _ck_PxClipPathEffect: KeysMatch<PxClipPathEffect, _PxClipPathEffect> = true;


/**
 * Stroke-trim effect. `range[0..1]` is the visible fraction of the STROKE; `offset`
 * shifts the visible window along the path (also a fraction). Both are animatable.
 * `subPaths` says what that fraction is measured over: `separate` (default) trims
 * each sub-path against its own length; `combined` chains all descendant sub-path
 * lengths into one virtual path ("Trim All As One") so the window slides across
 * siblings — see `effects/strokeTrimEffect.ts`.
 *
 * NAME — renamed from `trimPath` (2026-08, hard rename, no legacy alias): this
 * trims the STROKE only. It emits `stroke-dasharray` / `stroke-dashoffset` (plus
 * `stroke-opacity` for the empty-range hide) and NEVER rewrites `d`, so the fill
 * is untouched. Lottie's same-named `ty:'tm'` is a path OPERATOR that rewrites
 * geometry (and therefore does change the fill) — the old name imported that
 * wrong mental model from the format most authors convert from.
 */
export interface _PxStrokeTrimEffect {
    offset?: PxAnimatable<number>;
    range?: PxAnimatable<PxVec2>;
    subPaths?: PxStrokeTrimSubPaths;
}
/** @public @advanced */
export const PxStrokeTrimEffectSchema = implementsInterface<_PxStrokeTrimEffect>()(px.object({
    offset: PxAnimatableNumberSchema.optional(),
    range: PxAnimatableVec2Schema.optional(),
    subPaths: px.enum([PxStrokeTrimSubPaths.separate, PxStrokeTrimSubPaths.combined] as const, PxStrokeTrimSubPaths.separate).optional(),
}));
/** @public */
export type PxStrokeTrimEffect = PxInfer<typeof PxStrokeTrimEffectSchema>;
const _ck_PxStrokeTrimEffect: KeysMatch<PxStrokeTrimEffect, _PxStrokeTrimEffect> = true;


/** Ref-attr naming rule (see editor dev-docs/schema-design.md): `source` = ref to an EXTERNAL element
 *  (clone/maskedBy/retime); `coreId` = a unit's own survivor; `partOf` = a derived node's host.
 *
 *  `<use>` retime: pure timing — the source ref lives ONCE, on the parent `clone.source`
 *  (review §4.3; retime's own duplicate `source` was removed outright — no consumer ever
 *  read it: the materializer follows `href`). Lottie's layer timing, in the timeline's own words:
 *  `offset` (Lottie `st`, document ms the source's time 0 lands on), `stretch` (Lottie `sr`, After
 *  Effects' word: 2 = twice as long, half speed), `inTime` / `outTime` (Lottie `ip` / `op`) — a
 *  VISIBILITY WINDOW on the document timeline, both or neither, implemented (2026-08) as an opacity
 *  gate on a player-side wrapper `<g>`, independent of the `offset` / `stretch` remap (see
 *  `effects/retimeEffect.ts`). WHY these keys (`start` / `timeCrop: [a, b]` until 1.20): a window is
 *  spelled as two named points everywhere else in the format (the timeline's `inTime` / `outTime`,
 *  the scroll `range`); tuples are for vectors and points. `offset`, not `start`: that word is a
 *  trigger list and an action elsewhere. */
export interface _PxRetimeEffect {
    offset?: number;
    stretch?: number;
    inTime?: number;
    outTime?: number;
}
/** @public @advanced */
export const PxRetimeEffectSchema = implementsInterface<_PxRetimeEffect>()(px.object({
    offset: px.number(0).optional(),
    stretch: px.number(1).optional(),
    inTime: px.number().optional(),
    outTime: px.number().optional(),
}));
/** @public */
export type PxRetimeEffect = PxInfer<typeof PxRetimeEffectSchema>;
const _ck_PxRetimeEffect: KeysMatch<PxRetimeEffect, _PxRetimeEffect> = true;


/**
 * `<use>` CLONE — merges the former `ref` + `retime` effects. A `<use>` is a clone
 * of something: `type`/`source` say WHAT it clones, `retime` says WHEN.
 *   - `omit: 'translate'` → content-ref: the source's own translate is left out (the
 *     clone stays where the `<use>` put it, still rotates/scales with the source);
 *     absent → direct / whole-element link (keeps translate). A future `'transform'`
 *     value may leave out the whole transform.
 *   - `source` = the source element ref, `#id` (canonical spelling, SCHEMA-DESIGN §4 E-5;
 *     bare `id` is legacy, read-only). Lives once here; the player follows `href`.
 *   - `retime` = optional time-shift (nested).
 * Omitted entirely when all-default (a bare `<use href>` carries no `clone` bucket).
 */
export interface _PxCloneEffect {
    omit?: string;
    source?: string;
    retime?: _PxRetimeEffect;
}
/** @public @advanced */
export const PxCloneEffectSchema = implementsInterface<_PxCloneEffect>()(px.object({
    // Subtractive on purpose: the `<use>` can only point at one wrapper layer of the
    // source, so the choices form a ladder — 'translate' now, maybe 'transform' later.
    omit: px.enum([PxCloneOmit.translate] as const).optional(),
    source: px.string().optional(),
    retime: PxRetimeEffectSchema.optional(),
}));
/** @public */
export type PxCloneEffect = PxInfer<typeof PxCloneEffectSchema>;
const _ck_PxCloneEffect: KeysMatch<PxCloneEffect, _PxCloneEffect> = true;


/** A single color stop. `offset` is in `[0, 1]`; `color` is a CSS color
 *  string (`#rrggbb`, `rgb(…)`, `rgba(…)`, or named). */
export interface _PxGradientStop {
    offset: number;
    color: string;
}
/** @public @advanced */
export const PxGradientStopSchema = implementsInterface<_PxGradientStop>()(px.object({
    offset: px.number(),
    color:  px.string(),
}));
/** @public */
export type PxGradientStop = PxInfer<typeof PxGradientStopSchema>;
const _ck_PxGradientStop: KeysMatch<PxGradientStop, _PxGradientStop> = true;

/** `PxAnimatable<Array<PxGradientStop>>` schema. Static is the bare array;
 *  `{value: […]}` wraps the same; the animated form is `PxPropertyAnimation`
 *  (one timeline whose each kf's `value` is the FULL stops array at that time).
 *  LAW (SCHEMA-DESIGN R5, S9): stops are ONE animatable value — whole-array
 *  snapshots on a single timeline, deliberately NO per-stop keyframes/easing
 *  (gradient GEOMETRY animates per-slot with independent timelines). */
/** The stops slot's value grammar — one whole-array snapshot. @internal */
export const PxGradientStopsSchema = px.array(PxGradientStopSchema);

const PxAnimatableGradientStopsSchema = px.union([
    PxGradientStopsSchema,
    px.object({ value: PxGradientStopsSchema }),
    PxPropertyAnimationSchema,
]);

/** Gradient paint effect — used by both `fillGradient` and `strokeGradient`
 *  (same shape, different host attribute). Linear: `start`/`end`. Radial:
 *  `center`/`radius`/`focal`. Stops animate as one timeline; geometry stays static. */
// (The old `_PxGradientGeometryAnimation` per-scalar channel record —
// `animate: {gradientX1: …}` — was REMOVED outright, read included: geometry
// animates on the `start`/`end`/`center`/`radius`/`focal` slots. Backward compat dropped
// deliberately. Frames-engine-only note still applies to animated geometry:
// CSS/WAAPI cannot animate gradient endpoints; `mode: 'auto'` handles it.)

export interface _PxFillGradientEffect {
    type: PxGradientType;                                 // 'linear' | 'radial'
    start?:  PxAnimatable<PxVec2>;                          // linear start  ([x1,y1]; review §4.2 — plain words, no abbreviations)
    end?:    PxAnimatable<PxVec2>;                          // linear end    ([x2,y2])
    center?: PxAnimatable<PxVec2>;                          // radial center ([cx,cy])
    radius?: PxAnimatable<number>;                        // radial radius (r)
    focal?:  PxAnimatable<PxVec2>;                          // radial focal point ([fx,fy])
    stops?: PxAnimatable<Array<_PxGradientStop>>;          // single animation timeline
    gradientUnits?:  string;                              // PxUnits values
    spreadMethod?:   string;                              // PxGradientSpreadMethod values
    gradientTransform?: string;                           // static only in v1
}
/** @public @advanced */
export const PxFillGradientEffectSchema = implementsInterface<_PxFillGradientEffect>()(px.object({
    // Contextual kind — the `type` convention, see `PxNodeBaseSchema.type`.
    type: px.enum([PxGradientType.linear, PxGradientType.radial] as const),
    start:  PxAnimatableVec2Schema.optional(),
    end:    PxAnimatableVec2Schema.optional(),
    center: PxAnimatableVec2Schema.optional(),
    radius: PxAnimatableNumberSchema.optional(),
    focal:  PxAnimatableVec2Schema.optional(),
    stops: PxAnimatableGradientStopsSchema.optional(),
    // SVG's own initial values — what a gradient does when the attribute is not there.
    gradientUnits:     px.enum([PxUnits.userSpaceOnUse, PxUnits.objectBoundingBox] as const, PxUnits.objectBoundingBox).optional(),
    spreadMethod:      px.enum([PxGradientSpreadMethod.pad, PxGradientSpreadMethod.reflect, PxGradientSpreadMethod.repeat] as const, PxGradientSpreadMethod.pad).optional(),
    gradientTransform: px.string().optional(),
}));
/** @public */
export type PxFillGradientEffect = PxInfer<typeof PxFillGradientEffectSchema>;
const _ck_PxFillGradientEffect: KeysMatch<PxFillGradientEffect, _PxFillGradientEffect> = true;

/** Stroke gradient is the same shape as fill gradient; the difference is
 *  only which host attribute (`fill` vs `stroke`) the applier rewrites. */
export type _PxStrokeGradientEffect = _PxFillGradientEffect;
/** @public @advanced */
export const PxStrokeGradientEffectSchema = PxFillGradientEffectSchema;
/** @public */
export type PxStrokeGradientEffect = PxFillGradientEffect;

/** Text-path effect on a `<text>` host. The path geometry is carried INLINE as
 *  `pathData` — a standard animatable slot: static = an SVG `d` string; animated =
 *  `{keyframes}` whose values are `{pathData:"M…"}` (every keyframe with the same point
 *  count, as for a body `d`). The applier generates a `<path>` def from it and wraps the
 *  text's children in a native `<textPath href="#…">` at apply time — an animated slot
 *  becomes that def's `animate.d`, which only the frame loop drives (`<textPath>` does not
 *  follow a CSS-animated `d`). Glyph text (`effects.text.useGlyphs`) re-samples each glyph's
 *  place on the moving path instead, so there it works on every engine. All SVG-native
 *  textPath attrs (`lengthAdjust`, `method`, `spacing`, `startOffset`, `textLength`) ride
 *  on this effect; `startOffset`/`textLength` accept the full `PxAnimatable<number>` shape.
 *
 *  `pathOverflow` controls what happens to glyphs past the end of an OPEN path:
 *   - `'extend'` (default): glyphs continue straight along the endpoint tangent
 *     (Lottie / native-glyph behavior). Browser text falls back to `'clip'` while the
 *     path animates (the tangent lead-in is computed for one geometry).
 *   - `'clip'`: glyphs past the end disappear (native `<textPath>` behavior). */
export interface _PxTextPathEffect {
    pathData: PxAnimatable<string>;                       // inline SVG `d`, static or keyframed
    pathOverflow?: string;                                // 'clip' | 'extend' (default 'extend')
    lengthAdjust?: string;                                // 'spacing' | 'spacingAndGlyphs'
    method?: string;                                      // 'align' | 'stretch'
    spacing?: string;                                     // 'auto' | 'exact'
    startOffset?: PxAnimatable<number>;
    textLength?: PxAnimatable<number>;
}
/** @public @advanced */
export const PxTextPathEffectSchema = implementsInterface<_PxTextPathEffect>()(px.object({
    pathData: PxAnimatableStringSchema,
    // `extend` is what an omitted pathOverflow means (glyphs continue along the tangent); the
    // other three are SVG's own initial values for the native <textPath> attributes.
    pathOverflow: px.enum([PxPathOverflow.clip, PxPathOverflow.extend] as const, PxPathOverflow.extend).optional(),
    lengthAdjust: px.enum([PxLengthAdjust.spacing, PxLengthAdjust.spacingAndGlyphs] as const, PxLengthAdjust.spacing).optional(),
    method: px.enum([PxTextPathMethod.align, PxTextPathMethod.stretch] as const, PxTextPathMethod.align).optional(),
    spacing: px.enum([PxTextPathSpacing.auto, PxTextPathSpacing.exact] as const, PxTextPathSpacing.exact).optional(),
    startOffset: PxAnimatableNumberSchema.optional(),
    textLength: PxAnimatableNumberSchema.optional(),
}));
/** @public */
export type PxTextPathEffect = PxInfer<typeof PxTextPathEffectSchema>;
const _ck_PxTextPathEffect: KeysMatch<PxTextPathEffect, _PxTextPathEffect> = true;


/**
 * `effects.text` — text-rendering options for a `<text>` node.
 *
 * `useGlyphs: true` tells the player to render this text from the embedded
 * per-glyph outlines in `definitions.fonts` (self-contained, no external
 * font) instead of a native `<text>`. See svga.text.design.md.
 */
export interface _PxTextEffect {
    useGlyphs?: boolean;
}
/** @public @advanced */
export const PxTextEffectSchema = implementsInterface<_PxTextEffect>()(px.object({
    useGlyphs: px.boolean().optional(),
}));
export type PxTextEffect = PxInfer<typeof PxTextEffectSchema>;
const _ck_PxTextEffect: KeysMatch<PxTextEffect, _PxTextEffect> = true;


/**
 * The full `node.effects` bucket. Closed — each known effect is declared
 * (strict-mode validation flags an unknown effect key as a wire-format drift).
 *
 * DESIGN LAW — attribute vs effect:
 *  - An ATTRIBUTE is a value the browser consumes as-is on that element
 *    (`fill="#f00"`, `opacity`, `d`); animating it is "this value over time" —
 *    one channel, zero structure. The test is STRUCTURE, not value-encoding
 *    complexity: `transform` has a parts-record wire value but lands in one
 *    attribute on the same element, so it stays an attribute.
 *  - An EFFECT is anything whose realization requires structure — generating defs
 *    (gradient, clipPath, maskedBy, textPath), wrapper nodes (transformation),
 *    clones (repeater, clone), or geometry-derived multi-attr rewrites (strokeTrim).
 *  - The same attribute name can sit on both sides, split by value: flat `fill`
 *    is an attribute; gradient fill is an effect (no value of `fill` IS a
 *    gradient — it needs a def + stops + a `url(#id)` indirection).
 *  New features follow the same test: pattern fills / filters need defs → effects.
 *
 * COMPOSITION ORDER (SCHEMA-DESIGN §R5): one bag per element — JSON key order
 * carries NO meaning and is never read. The applier composes in one hard-coded
 * order, innermost → outermost:
 *   glyphs/textPath → fill/strokeGradient → strokeTrim → repeater → maskedBy
 *   → clipPath → clone-href+transformBy         (retime = pass 2, time-remap only)
 * "Other" orders are expressed by STRUCTURE (nest elements), never by key order.
 * If authorable order is ever demanded: an explicit `effects.order: [names]`
 * extension — never key-order significance (JSON tooling silently reorders).
 */
export interface _PxEffects {
    transformBy?: _PxTransformByEffect;
    repeater?: _PxRepeaterEffect;
    maskedBy?: _PxMaskedByEffect;
    clipPath?: _PxClipPathEffect;
    strokeTrim?: _PxStrokeTrimEffect;
    clone?: _PxCloneEffect;
    fillGradient?: _PxFillGradientEffect;
    strokeGradient?: _PxStrokeGradientEffect;
    textPath?: _PxTextPathEffect;
    text?: _PxTextEffect;
}
/** @public @advanced */
export const PxEffectsSchema = implementsInterface<_PxEffects>()(px.object({
    transformBy: PxTransformByEffectSchema.optional(),
    repeater: PxRepeaterEffectSchema.optional(),
    maskedBy: PxMaskedByEffectSchema.optional(),
    clipPath: PxClipPathEffectSchema.optional(),
    strokeTrim: PxStrokeTrimEffectSchema.optional(),
    clone: PxCloneEffectSchema.optional(),
    fillGradient: PxFillGradientEffectSchema.optional(),
    strokeGradient: PxStrokeGradientEffectSchema.optional(),
    textPath: PxTextPathEffectSchema.optional(),
    text: PxTextEffectSchema.optional(),
}));
/** @public */
export type PxEffects = PxInfer<typeof PxEffectsSchema>;
const _ck_PxEffects: KeysMatch<PxEffects, _PxEffects> = true;

/**
 * Walks `root` and validates every `node.effects` bucket against `PxEffectsSchema`.
 * Returns an array of human-readable warning strings (empty when all good).
 * Doesn't mutate the tree. Called by `createAnimatorImpl` before applying effects.
 *
 * Pass `strict: true` to also flag undeclared keys (useful in dev / tests).
 * @internal — folded into `validateDocument`; on the `/internal` entry for the players.
 */
export function validateNodeEffects(root: PxNode, options?: { strict?: boolean }): Array<string> {
    const ctx = newCollectingContext(!!options?.strict);
    collectNodeEffectProblems(root, ctx, false);
    return ctx.errors;
}

/** The transform parts a per-key `animate` channel can (deprecatedly) name. */
const PX_PER_KEY_TRANSFORM_CHANNELS = ['translate', 'rotate', 'scale', 'skew', 'origin'] as const;

/**
 * Walks `root` and flags every node animating a transform PART as its own `animate` channel
 * (`animate.translate`, `animate.rotate`, …) — the DEPRECATED spelling (format review §6): two
 * such channels on one node are last-write-wins, so the composed forms replace it. Still read,
 * for files migrated from the pre-record era; new documents spell it `animate.transform`
 * (record keyframes), or `effects.transformBy` when the parts need independent timing.
 * Returns one human-readable warning per offending node (empty when all good); never mutates.
 * @internal — the players run it on load (PX1107); on the `/internal` entry.
 */
export function validateDeprecatedTransformChannels(root: PxNode): Array<string> {
    const warnings: Array<string> = [];
    const walk = (node: PxNode, path: Array<string>): void => {
        const animate = node?.animate as { [k: string]: unknown } | undefined;
        if (animate) {
            const hit = PX_PER_KEY_TRANSFORM_CHANNELS.filter((k) => animate[k] !== undefined);
            if (hit.length) {
                const where = node.id ? '#' + node.id : path.join('.');
                warnings.push(
                    'deprecated per-key transform channel(s) ' + hit.map((k) => 'animate.' + k).join(', ') + ' on ' + where +
                    ' — several on one node are last-write-wins. Use `animate.transform` record keyframes (value: { ' +
                    hit.join(', ') + ' }), or `effects.transformBy` for independently-timed parts.');
            }
        }
        if (node && Array.isArray(node.children)) {
            node.children.forEach((c, i) => walk(c, [...path, 'children', '[' + i + ']']));
        }
    };
    walk(root, [PX_VALIDATION_ROOT_SEGMENT]);
    return warnings;
}

/** The first path segment of every whole-document finding (`root.children[0]…`): the document
 *  itself, so a path can always be told apart from a node-relative one. @internal */
export const PX_VALIDATION_ROOT_SEGMENT = 'root';

/** A context that collects lines AND findings — what every document-level check reports into. */
function newCollectingContext(strict: boolean): PxValidationContext & { findings: Array<PxValidationFinding> } {
    return { errors: [], warnings: [], findings: [], strict };
}

/** Every node's `effects` bucket, judged on its own so one failing bucket cannot hide the next.
 *  The path is the breadcrumb a reader locates the node by (`root.children[0].effects…`);
 *  `once` drops a line the context already holds (the whole-document check reports each mistake once). */
function collectNodeEffectProblems(root: PxNode, ctx: PxValidationContext & { findings: Array<PxValidationFinding> }, once: boolean): void {
    const walk = (node: PxNode, path: Array<string>): void => {
        if (node && node.effects) {
            const own = newCollectingContext(!!ctx.strict);
            if (!PxEffectsSchema.isValid(node.effects, own, [...path, 'effects'])) {
                for (const [i, f] of own.findings.entries()) {
                    if (once && ctx.errors.includes(f.message)) continue;
                    ctx.errors.push(own.errors[i]);
                    ctx.findings.push(f);
                }
            }
        }
        if (node && Array.isArray(node.children)) {
            node.children.forEach((c, i) => walk(c, [...path, 'children', '[' + i + ']']));
        }
    };
    walk(root, [PX_VALIDATION_ROOT_SEGMENT]);
}

/**
 * Cross-checks glyph-mode text against the embedded faces (review §2.5).
 *
 * A `definitions.fonts` key IS the face name, matched against the node's `font-family`
 * verbatim — so a name with no entry renders a row of □ placeholder boxes behind nothing but
 * a console warning. Nothing else catches that: the schema validates each side's SHAPE, never
 * that the two agree.
 *
 * Deliberately silent in two legal cases:
 *  - the document embeds NO faces — browser-font text, a different situation entirely;
 *  - a node carries no `font-family` — with exactly one face embedded the player resolves it
 *    (`soleFont`), and with none there is nothing to name.
 *
 * The reverse (a face nothing references) is NOT reported: keeping the outlines of a text
 * whose glyph mode is currently off is legal and deliberate, so that toggling it back on
 * needs no font reload.
 */
export function validateGlyphFontRefs(root: PxNode, fonts: { [face: string]: unknown; } | undefined): Array<string> {
    const ctx = newCollectingContext(false);
    collectGlyphFontRefProblems(root, fonts, ctx);
    return ctx.errors;
}

function collectGlyphFontRefProblems(root: PxNode, fonts: { [face: string]: unknown; } | undefined, ctx: PxValidationContext): void {
    if (!fonts || !Object.keys(fonts).length) return;

    const walk = (node: PxNode, path: Array<string>, inherited: string | undefined, inGlyphText: boolean): void => {
        if (!node) return;
        // `font-family` inherits down the text tree, exactly as the renderer resolves it.
        const own = typeof node.fontFamily === 'string' ? node.fontFamily : undefined;
        const family = own ?? inherited;
        const isGlyphText = inGlyphText || (node.type === 'text' && !!node.effects?.text?.useGlyphs);
        // Report at the node that DECLARES the family — one problem per mistake, not one per
        // descendant that merely inherits it.
        if (isGlyphText && own && !Object.prototype.hasOwnProperty.call(fonts, own)) {
            reportValidationError(ctx, path, PxValidationFindingKind.missingReference,
                'glyph-mode text uses font-family "' + own + '", which has no entry in animator.definitions.fonts', { once: true });
        }
        if (Array.isArray(node.children)) {
            node.children.forEach((c, i) => walk(c, [...path, 'children', '[' + i + ']'], family, isGlyphText));
        }
    };
    walk(root, [PX_VALIDATION_ROOT_SEGMENT], undefined, false);
}

/**
 * Cross-checks named easing references against `definitions.easings` (review §2.9).
 *
 * A keyframe's `easing` is either a cubic-bezier array or the NAME of an entry in
 * `definitions.easings` — CSS keywords are deliberately not built in (player weight), so
 * `easing: "ease-in-out"` validates as a string, resolves to nothing, and plays LINEAR behind
 * one `console.warn`. That makes it the likeliest silent mistake in a generated document, and
 * the schema cannot catch it: it checks the shape of each side, never that the two agree.
 *
 * Only the wire spelling `easing` is read. The runtime view's `e` is an already-RESOLVED curve,
 * never a name, so it has nothing to cross-check.
 */
/** @internal — folded into `validateDocument`; on the `/internal` entry for the editor. */
export function validateEasingRefs(root: PxNode, easings: { [name: string]: unknown; } | undefined): Array<string> {
    const ctx = newCollectingContext(false);
    collectEasingRefProblems(root, easings, ctx);
    return ctx.errors;
}

function collectEasingRefProblems(root: PxNode, easings: { [name: string]: unknown; } | undefined, ctx: PxValidationContext): void {
    const walk = (node: unknown, path: Array<string>): void => {
        if (Array.isArray(node)) {
            node.forEach((item, i) => walk(item, [...path, '[' + i + ']']));
            return;
        }
        if (!node || typeof node !== 'object') return;
        const easing = (node as { easing?: unknown }).easing;
        if (typeof easing === 'string' && !(easings && Object.prototype.hasOwnProperty.call(easings, easing))) {
            reportValidationError(ctx, [...path, 'easing'], PxValidationFindingKind.missingReference,
                '"' + easing + '" names no entry in animator.definitions.easings — it will play linear', { once: true });
        }
        for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
            if (key === 'easing') continue;   // already handled; a string has nothing to walk
            if (value && typeof value === 'object') walk(value, [...path, key]);
        }
    };
    walk(root, [PX_VALIDATION_ROOT_SEGMENT]);
}

/**
 * Checks the `animator.version` stamp parses (review §2.10).
 *
 * The slot is `px.string()`, so `"v1"` validates and is then read as UNSTAMPED — the document
 * silently loses the one diagnostic that says which schema wrote it. Parsing is delegated to
 * {@link parseWireVersion} so this can never disagree with the reader.
 *
 * An ABSENT stamp is legal and silent: only a present-but-unparseable one is reported.
 */
/** @internal — folded into `validateDocument`; on the `/internal` entry for the editor. */
export function validateVersionStamp(doc: PxDocument): Array<string> {
    const ctx = newCollectingContext(false);
    collectVersionStampProblems(doc, ctx);
    return ctx.errors;
}

function collectVersionStampProblems(doc: PxDocument, ctx: PxValidationContext): void {
    const version = getAnimatorConfig(doc)?.version;
    if (version === undefined) return;
    if (parseWireVersion(version) !== undefined) return;
    reportValidationError(ctx, [PX_VALIDATION_ROOT_SEGMENT, 'animator', 'version'], PxValidationFindingKind.invalidValue,
        JSON.stringify(version) + ' is not a version stamp ("a.b" or "a.b.c") — it reads as unstamped', { once: true });
}

/**
 * THE one validation call (review §15). Checks a WHOLE document against the wire schema — plus
 * every node's `effects` bucket, the glyph-font and easing references and the version stamp —
 * and answers `{ valid, errors, findings }`: human-readable problem lines (`path: what is
 * wrong`) and their structured twins. Never throws. `strict` (the default) rejects keys the
 * schema does not declare — the right answer before you ship; `{ strict: false }` tolerates
 * them, which is what a READER wants: an unknown key usually means a newer writer. The player
 * itself only warns and skips what it cannot read; this is the yes/no for tooling, CI and
 * agents. The only other public check is the `isPxDocument` type guard — everything narrower
 * (`validateNodeEffects`, `diagnoseDocument`, …) is plumbing on the `/internal` entry.
 * @public
 */
export function validateDocument(doc: unknown, options?: { strict?: boolean }): PxValidationResult {
    const { errors, findings } = collectDocumentProblems(doc, options);
    return { valid: errors.length === 0, errors, findings };
}

// @px-importance important
/** The one validator behind {@link validateDocument} and {@link isValidPxDocument}: every problem
 *  as a line AND a finding, each mistake once. */
function collectDocumentProblems(doc: unknown, options?: { strict?: boolean }): { errors: Array<string>; findings: Array<PxValidationFinding> } {
    // Strict (the default) rejects keys the schema does not declare — the right answer for a
    // document you are about to ship. `strict: false` tolerates them, which is what a READER
    // wants: an unknown key usually means a newer writer — worth a warning, never a refusal.
    const strict = options?.strict !== false;
    const ctx = newCollectingContext(strict);
    PxDocumentSchema.isValid(doc, ctx, [PX_VALIDATION_ROOT_SEGMENT]);
    if (doc && typeof doc === 'object') {
        collectNodeEffectProblems(doc as PxNode, ctx, true);
        const defs = getAnimatorConfig(doc as PxDocument)?.definitions;
        collectGlyphFontRefProblems(doc as PxNode, defs?.fonts, ctx);
        collectEasingRefProblems(doc as PxNode, defs?.easings, ctx);
        collectVersionStampProblems(doc as PxDocument, ctx);
    }
    return { errors: ctx.errors, findings: ctx.findings };
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
 * @public @advanced
 */
export const PxNodeBaseSchema = px.openObject({
    // CONVENTION (SCHEMA-DESIGN R1 / issues N4): `type` is the ONE word for "what
    // kind of thing is this", discriminated by its CARRIER — here the node TAG
    // (`rect`, `text`), and inside a sub-object that object's kind (`fillGradient.type`,
    // `fillGradient.type`, editor `preset.type`). Each sits in its own object, so
    // the carrier disambiguates completely; synonyms (`cloneKind`, `presetShape`)
    // would add words that all mean "type" and still need the carrier to read.
    // Guarding a `type` SLOT against a wrong VALUE is the job of strict enums
    // (issues V3), never of distinct key names.
    type: px.string(),
    // The escape hatch for elements that carry a REAL `type` attribute — `<feTurbulence
    // type="fractalNoise">`, `<feFuncR type="table">`, `<feColorMatrix type="saturate">`.
    // `type` is taken by the tag name, so the attribute travels here and the renderer puts
    // it back (`PxAnimatorDOM.renderNode`, `PxRnRender`). Declared here — not merely
    // documented — because a wire key that is not in a schema is invisible to the
    // minifier's reserve list and gets renamed (dev-docs/plans/minification-boundary.md §1.1).
    domType: px.string().optional(),
    // Text content of a `<text>` / `<tspan>`. Declared, so a non-string value is a schema error
    // and the minifier reserves the key; `text` is NOT an alias for it and is not read anywhere.
    textContent: px.string().optional(),
    id: px.string().optional(),
    meta: px.any().optional(),
    // Player-effects bucket emitted by the Editor's lightweight design format.
    // Consumed and removed by `materializeNodeEffects` before any other normalization
    // (see `createAnimatorImpl`), so downstream code never sees it.
    effects: PxEffectsSchema.optional(),
    // `PxElementAnimation` (not just `PxAnimationDefinition`) — accepts
    // string ref / array of refs / inline definition / mixed array; mirrors
    // `node.animate` values and what `processNode` resolves at runtime.
    animate: PxElementAnimationSchema.optional(),
    style: px.record(px.union([px.string(), px.number()])).optional(),
}, PxAttrValueSchema);

// `let` so the lazy closure can capture the variable reference after assignment.
// By the time the lazy resolves (first isValid/sanitize call), PxNodeSchema is assigned.
// `PxNodeBaseSchema & { children?:PxNode[] }`
/** @public @advanced */
let PxNodeSchema: PxSchema<PxNode> = px.openObject({
    ...PxNodeBaseSchema._shape,
    children: px.lazy(() => px.array(PxNodeSchema), []).optional(),
}, PxAttrValueSchema);
export { PxNodeSchema };

/**
 * Base interface for all SVG elements.
 * Extends schema-derived typed fields; adds recursive children and the open
 * index signature for arbitrary SVG attributes under their camelCase DOM names
 * (cx, cy, r, fill, strokeWidth, …) — see `_PxNodeBase`.
 * Named properties take precedence over the index signature when accessed.
 * @public
 */
export interface PxNode extends PxInfer<typeof PxNodeBaseSchema> {
    children?: PxNode[];
    [camelCaseDomKey: string]: unknown;
}


// ============================================================================
// SVG NODE (ROOT)
// ============================================================================

/**
 * Root SVG element containing the entire animated graphic.
 * Extends PxNode with SVG-specific properties and global configuration.
 */
export interface _PxSvgNode extends PxNode {

    /** SVG viewport width. `number` OR an SVG length string (`"100%"`, `"12em"`) —
     *  percentages are legal SVG and appear in real documents. */
    width?: number | string;

    /** SVG viewport height — `number` or SVG length string, see `width`. */
    height?: number | string;

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
 * @public @advanced
 */
export const PxSvgNodeRootSchema = px.object({
    // `"100%"` and other SVG length strings are legal here — a number-only slot rejected
    // real documents (e.g. apple-store-look-14-main.json) at the root <svg>.
    width: px.union([px.number(), px.string()]).optional(),
    height: px.union([px.number(), px.string()]).optional(),
    viewBox: px.string().optional(),
    animator: PxAnimatorConfigSchema.optional(),
});

/**
 * Root SVG element containing the entire animated graphic.
 * Extends PxNode (inheriting the open index signature) plus schema-derived
 * SVG-root fields.
 * @public
 */
export interface PxSvgNode extends PxNode, PxInfer<typeof PxSvgNodeRootSchema> {
}


// ============================================================================
// DOCUMENT
// ============================================================================

/**
 * Root document schema. `type` is the root tag — `svg`, or an HTML element (`div`, …) whose subtree holds HTML
 * and `svg` elements; elements are SVG inside `<svg>` and HTML outside it.
 * This is the root type for the entire file format.
 *
 * `{ type:'svg', style?:…, width?:number, height?:number,
 *    viewBox?:string, animator?:AnimatorConfig, children?:PxNode[],
 *    [svgAttr]: string|number|PxPropertyAnimation }`
 * @public @advanced
 */
export const PxDocumentSchema = px.openObject({
    ...PxNodeBaseSchema._shape,
    ...PxSvgNodeRootSchema._shape,
    type: px.string(),           // the root tag: `svg`, or an HTML element wrapping SVG content (`div`, …)
    children: px.array(PxNodeSchema).optional()
}, PxAttrValueSchema);

/**
 * The complete animated SVG document.
 * This is the root type for the entire file format.
 * @public
 */
export interface PxDocument extends PxSvgNode {
}

/** What a `.json` import produces from a given wire type: every string literal is widened to
 *  `string` and every tuple to a plain array, because TypeScript types an imported JSON file
 *  structurally. Objects and optionality are preserved; a record (index signature) also takes
 *  `undefined`, because elements that differ in keys get each missing one as `key?: undefined`. */
type PxWidenJsonImport<T> =
    T extends string ? string :
    T extends number ? number :
    T extends boolean ? boolean :
    T extends Array<infer U> ? Array<PxWidenJsonImport<U>> :
    T extends object ? { [K in keyof T]: PxWidenJsonImport<T[K]> | (string extends K ? undefined : never) } :
    T;

/**
 * The document as a `.json` IMPORT types it — {@link PxDocument} with every literal
 * union widened to `string` and tuples widened to arrays, so
 * `import animation from './animation.json'` passes straight into `doc` with no cast
 * (first-use review §5). Every player entry point takes this type and validates the values at
 * runtime as always; use `PxDocument` when BUILDING a document in code, for the
 * narrow literal types and autocomplete. WHY `PxDocumentJson` (`PxDocumentInput` until 1.21): it names what the
 * type IS — the shape a JSON import has — where "input" said nothing.
 * @public
 */
export type PxDocumentJson = PxWidenJsonImport<PxDocument>;

// @px-area schema
/**
 * Names the one type-level narrowing from {@link PxDocumentJson} (what a JSON import is typed
 * as) to {@link PxDocument} (the wire type the internals speak). Not a check: the
 * runtime validates and diagnoses real value mismatches on every create/bind path as before.
 * @public @advanced
 */
export function toPxDocument(doc: PxDocumentJson): PxDocument {
    return doc as PxDocument;
}


// ============================================================================
// API INTERFACES
// ============================================================================

// -- Callbacks: one chain, three levels (API review §9, §5; dev-docs/reviews/api-surface-review.md §26.1) ----------------------------
//
//   PxDiagnosticsConfig          onWarning / onError / suppressWarnings / suppressErrors   — what `createDiagnostics` reads
//   PxEngineCallbacks            + onPlay / onPause / onFinish / onDestroy   — what an ENGINE takes (its raw clock signals)
//   PxAnimationPlayerCallbacks   + onReady / onPlaybackStart / onPlaybackStop / onPlaybackPause / onPlaybackResume /
//                                  onPlaybackFinish / onDestroy               — what every PUBLIC surface takes
//
// The playback events are the EXECUTOR's (it performs the buttons and sees the end); the engine's `onPlay` / `onPause` /
// `onFinish` never reach a page — a jump's internal pause, the end of a return leg, are not the user's. `onDestroy` is shared.
// The diagnostics rule (`onError` = this instance will not play; `onWarning` = it plays, but
// something was ignored, degraded or misspelled) is written on `PxDiagnosticsConfig`.

// @px-area engine
/**
 * The callbacks an ENGINE takes — the frame loop, WAAPI, React Native's sampler: the playback
 * lifecycle plus the diagnostics channel. Public surfaces take `PxAnimationPlayerCallbacks`.
 * @public
 */
export interface PxEngineCallbacks extends PxDiagnosticsConfig {

    /** The engine's clock started or continued — raw; the public `onPlaybackStart` / `onPlaybackResume` are the executor's. */
    onPlay?: () => void;

    /** The engine's clock stopped — raw (a user pause, the gate's hold, a jump's internal pause); the public
     *  `onPlaybackPause` is the executor's. */
    onPause?: () => void;

    /** The engine's clock reached an end — raw: the end of the last pass, an engine jump there, or the end of a return
     *  leg played backwards. The executor decides which of these is the playback's finish (`onPlaybackFinish`). */
    onFinish?: () => void;

    /** `destroy()`'s pair (review §11): the player was torn down — an unmount, a document
     *  swap, or an explicit `destroy()` call. */
    onDestroy?: () => void;

    /** The playback events (`onPlaybackStart` …) for the executor the engine's OWN triggers press — handed on to
     *  `setupAnimationTriggers`, never fired by the engine: a `load` trigger presses `playback.start` inside the engine's
     *  constructor, before the public api is composed, so the listeners must already be attached there. */
    playbackListeners?: PxPlaybackListeners;
}

// @px-area entry
/**
 * What every PUBLIC surface takes, inline and under the same names — `createSvgAnimationPlayer({ onPlaybackFinish })`,
 * `createSvgAnimationPlayersFromPage`, the pre-rendered entries, and `<SvgAnimationPlayer onPlaybackFinish />` on React,
 * Vue and React Native (review §9, §24): the four buttons' events (MediaRecorder's set: one event per method, told
 * by the executor when it performs the act), the end, the teardown, and the diagnostics channel.
 *
 * ONE definition: the components derive their props from it instead of each spelling the same
 * names, which is how their comments had already started to drift.
 * @public
 */
export interface PxAnimationPlayerCallbacks extends PxDiagnosticsConfig {
    /** The player exists and the SVG is rendered (review §14) — the push twin of `isReady()`.
     *  Fires ONCE, always asynchronously (so the create call has returned): with an inline `document`
     *  effectively immediately, with a URL after the fetch. */
    onReady?: () => void;
    /** A playback began — `playback.start()`, `playback.play()` from rest, a `playback.start` / `playback.play` trigger,
     *  `playback` to `on` / `paused` from `off`, the gate starting it again; a returning picture turned around by a play.
     *  (`onPlay` until 1.23, which also fired for a resume.) */
    onPlaybackStart?: () => void;
    /** The playback was stopped — `playback.stop()`, a `playback.stop` trigger, `playback="off"`, the gate's `stop` — at
     *  once, or on arrival for the stops that finish the pass first. A pause is `onPlaybackPause`, the natural end
     *  `onPlaybackFinish`, a removal `onDestroy`; a seek reports nothing. WHY no `onReset` (until 1.22): it fired for a
     *  mix no page could act on; the state is `playback.getState() === 'off'`. */
    onPlaybackStop?: () => void;
    /** The playback was frozen — `playback.pause()`, a `playback.pause` trigger, `playback="paused"`, or the gate's
     *  `pause` when it left the screen (1.26: the state reads `paused` then too). */
    onPlaybackPause?: () => void;
    /** The playback continued after a freeze — `playback.resume()`, `playback.play()`, a `playback.resume` trigger,
     *  `playback` back to `on`, or the gate when it is seen again. */
    onPlaybackResume?: () => void;
    /** The playback reached the end of its last pass by playing — the state is `finished` from here, whatever
     *  `whenFinished` then shows. Not for a stop that goes to the end (that is `onPlaybackStop`), never for a loop without
     *  end. WHY `finish`: one pair with the `finished` state — WAAPI's word. (`onFinish` until 1.25.) */
    onPlaybackFinish?: () => void;
    /** `destroy()`'s pair (review §11): the player was torn down — an unmount, a document swap, or an explicit
     *  `destroy()` call. */
    onDestroy?: () => void;
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
/** @public @advanced */
export const PxBezierPathSchema = implementsInterface<_PxBezierPath>()(px.object({
    v: px.array(px.array(px.number())),
    i: px.array(px.array(px.number())).optional(),
    o: px.array(px.array(px.number())).optional(),
    c: px.boolean().optional(),
}));

/** Represents a vector path for SVG shape animations. @public */
export type PxBezierPath = PxInfer<typeof PxBezierPathSchema>;

/** A `d` keyframe value after normalization — the bezier paths the engines interpolate. @internal */
export const PxNormalizedPathValueSchema = px.object({ paths: px.array(PxBezierPathSchema) });
const _ck_PxBezierPath: KeysMatch<PxBezierPath, _PxBezierPath> = true; // the key sets are identical


// ============================================================================
// ANIMATION PLAYER API
// ============================================================================

/**
 * Basic animation controls common to every animation player.
 *
 * Generic over the platform's root-element type (`TRoot`) so this package stays
 * platform-neutral: the web player specializes it to the DOM `Element`, a
 * React Native player to its own view handle. Defaults to `unknown`.
 * @public
 */
// @px-area entry
/**
 * `player.playback` — everything a page does to the animation: the buttons, the state, the seeks, both clocks and the
 * speed (dev-docs/plans/animation-state.playback-namespace.md §2, animation-state.feedback.2026-11-12.md). ONE object per
 * player, the same on every read, made of closures — `const { start } = player.playback` works. Calls made before the
 * document is ready are queued; after `destroy()` every call is a no-op. (Flat on the player until 1.25; `playOnce()`,
 * `jumpToStart()` and `jumpToEnd()` until 1.25 — a one-iteration timeline and `start()`, `stop()`, `setCurrentProgress()`
 * say the same.)
 *
 * ### The time contract (API review §3; schema-and-props--manual-review.md A1 / A5; …improvements.md §0)
 *
 * Every engine — the browser's WAAPI, the frame loop, React Native — answers these the same way. Two clocks only:
 * CONTENT time (ms as the keyframes are authored) and time AT THE CURRENT SPEED (content time ÷ |speed|).
 *
 * - **Plain time names are content ms inside the iteration.** `getCurrentTime()` is the content time of the frame on
 *   screen, `0..getDuration()`, the way lottie-web's `currentFrame`, Three.js `action.time` and GSAP `time()`
 *   read. A reversed pass of `alternate` counts down.
 * - **Progress counts iterations, in the order they play** (1.26): `getCurrentProgress()` is `1.2` 20 % into the second
 *   iteration; one number says the pass and the place in it, and nothing wraps.
 * - **`total…` names the whole playback**, every iteration included — GSAP's words exactly (`time` / `totalTime`,
 *   `duration` / `totalDuration`, `progress` / `totalProgress`): `getTotalTime()` / `setTotalTime()`,
 *   `getTotalProgress()`, `getTotalDuration()` (`null` when endless — the honest slider maximum). The delay sits before 0.
 * - **`…AtSpeed` names the same values at the current speed**: `getDurationAtSpeed()` = one pass ÷ |speed|,
 *   `getCurrentTimeAtSpeed()` = the playhead ÷ |speed|, `getTotalTimeAtSpeed()` = the playback's playhead ÷ |speed|.
 *   Derived from the position, so paused time never counts.
 * - **A seek clamps** to the pass or the playback; **a speed of 0 is rejected** with a warning, everywhere. Use `pause()`.
 * - **The seek rule** (1.26): a seek while `playing` keeps playing from there; in every other state the playback becomes
 *   `paused` at that frame, and `resume()` plays on from it. A seek reports nothing.
 *
 * The maths lives in `playback/PxPlaybackTime.ts`, and the members are composed once in `composeApiExtras`, so there
 * is one implementation rather than one per engine.
 * @public
 */
export interface PxPlaybackControls {
    // ── the buttons ──
    /** Starts a playback FROM THE START — in every state: from `off` or `finished`, while `playing` (it restarts), while
     *  `paused` (the freeze is dropped) and while `returning`; the delay is waited again. Reports `onPlaybackStart`. To
     *  carry on instead of restarting, `play()`. (Until 1.25 the file's start behavior decided, `continue` by default.) */
    start(): void;
    /** Start or carry on — what a Play button wants (1.26): nothing while `playing`; `paused` resumes (`onPlaybackResume`);
     *  a picture on its way back to the start (`returning`, or a `whenFinished: 'animateToStart'` return) turns around and
     *  plays forward from where it is (`onPlaybackStart`); otherwise it starts from the start (`onPlaybackStart`). */
    play(): void;
    /** Ends the playback per `actions["playback.stop"]`: `jumpToStart` (default) or `animateToStart` (the `returning`
     *  state) back to the rest pose → `off`; `jumpToEnd` / `animateToEnd` to the end of the current pass → `finished`,
     *  then `whenFinished` applies; `animateToEndAndBack` on to the end of the pass, then backwards to the rest pose →
     *  `off`. Clears a freeze. Reports `onPlaybackStop` — on arrival for the stops that finish the pass first. A no-op
     *  when there is nothing to stop (`off`, `returning`). */
    stop(): void;
    /** Freezes the playback where it is — only while `playing`. Reports `onPlaybackPause`. */
    pause(): void;
    /** Continues the playback from the frozen frame — only while `paused`. Reports `onPlaybackResume`. */
    resume(): void;
    // ── the state ──
    /** The one state read — the playback's state: `off` (no playback) · `playing` · `paused` (also after a seek that was
     *  not made while playing) · `finished` (reached its end, whatever `whenFinished` then shows — until the next start
     *  or stop) · `returning` (no playback, but the picture still plays back to the rest pose — a stop with
     *  `animateToStart`) · `destroyed` (after `destroy()`, every call a no-op). */
    getState(): PxPlaybackState;
    /** A playback exists: `playing` · `paused` · `finished`. */
    isActive(): boolean;
    /** `getState() === 'playing'`. A picture moving back to the start is not playing (`returning`, or `finished`). */
    isPlaying(): boolean;
    // ── content time: one pass ──
    /** CONTENT ms of ONE pass of the content window (`outTime − inTime`) — one iteration, as WAAPI's `duration`,
     *  CSS `animation-duration` and lottie-web's `getDuration()` are. `null` before a document given as a URL has loaded. */
    getDuration(): number | null;
    /** The frame on screen: content ms inside the current iteration, `0..getDuration()`; a reversed pass of
     *  `alternate` counts down. `null` before ready. */
    getCurrentTime(): number | null;
    /** Seeks inside the CURRENT iteration, ms clamped to `[0, getDuration()]` (the pass keeps its direction). The seek
     *  rule: while `playing` it continues from there; otherwise the playback is `paused` at that frame. */
    setCurrentTime(time: number): void;
    /** The position counted in iterations, in the order they play: `0.5` half-way through the first, `1.2` 20 % into the
     *  second (an `alternate` second pass runs backwards, so that is the frame at 80 %). No upper bound on an endless
     *  playback. `null` before ready. (0–1 of the current iteration until 1.25 — `getCurrentTime() / getDuration()`
     *  reads that.) */
    getCurrentProgress(): number | null;
    /** Seeks to a position counted in iterations — the twin of `getCurrentProgress`: `setCurrentProgress(1.2)` is 20 % into
     *  the second iteration. Clamped to `[0, iterations]` (no upper bound when endless); nothing wraps, so `1` is the last
     *  frame of the first iteration. The seek rule as for `setCurrentTime`. */
    setCurrentProgress(progress: number): void;
    /** Which pass is playing, 0-based; the end of a pass belongs to it. */
    getCurrentIteration(): number;
    // ── content time: the whole playback ──
    /** The whole playback, ms: one pass × iterations; `null` when `iterations` is `'infinite'` (nothing to multiply —
     *  the honest answer instead of a division the page has to guard), and `null` before ready. The delay is not counted. */
    getTotalDuration(): number | null;
    /** The playhead on the WHOLE playback, ms — every iteration included; 0 while the delay waits; grows without bound on
     *  an endless file. `null` before ready. */
    getTotalTime(): number | null;
    /** Seeks on the whole playback, ms; clamped to `[0, getTotalDuration()]` (no upper bound when endless). The seek rule
     *  as for `setCurrentTime`. */
    setTotalTime(time: number): void;
    /** The playhead as 0–1 of the whole playback (GSAP's `totalProgress`); `null` when endless or before ready. */
    getTotalProgress(): number | null;
    // ── the speed ──
    /** The speed: 1 normal, 2 double, 0.5 half, negative plays backwards (on top of `iterationDirection` — a
     *  `reverse` pass at −1 plays forwards). The file's `timeline.playbackSpeed` is the initial value; `setSpeed`
     *  replaces it. (`getPlaybackSpeed()` until 1.25.) */
    getSpeed(): number;
    /** Changes the speed. A speed of 0 — or a non-finite one — is rejected with a warning; use `pause()`. */
    setSpeed(speed: number): void;
    // ── time at the current speed ──
    /** One pass in ms at the current speed: `getDuration() / |speed|`. `null` before ready.
     *  (`getPlaybackDuration()` until 1.25.) */
    getDurationAtSpeed(): number | null;
    /** The speed asked for as a length: sets the speed so that one pass takes `ms` at it. */
    setDurationAtSpeed(ms: number): void;
    /** The whole playback in ms at the current speed: `getTotalDuration() / |speed|`; `null` when endless or before ready. */
    getTotalDurationAtSpeed(): number | null;
    /** The playhead inside the iteration in ms at the current speed: `getCurrentTime() / |speed|`. Derived from the
     *  position, never a stopwatch — paused time and speed changes cannot confuse it. `null` before ready. */
    getCurrentTimeAtSpeed(): number | null;
    /** The playhead on the whole playback in ms at the current speed: `getTotalTime() / |speed|`. `null` before ready. */
    getTotalTimeAtSpeed(): number | null;
}

/**
 * The player: its own lifecycle, and `playback` — everything a page does to the animation ({@link PxPlaybackControls}).
 *
 * Generic over the platform's root-element type (`TRoot`) so this package stays platform-neutral: the web player
 * specializes it to the DOM `Element`, a React Native player to its own view handle. Defaults to `unknown`.
 * @public
 */
export interface PxAnimationPlayerApi<TRoot = unknown> {
    /** The buttons, the state, the seeks, both clocks and the speed — see {@link PxPlaybackControls}. */
    readonly playback: PxPlaybackControls;
    /** Whether the document has loaded and the player is built — calls made earlier are queued. */
    isReady(): boolean;
    /** Returns the root element for the animation (platform-specific type). */
    getRootElement(): TRoot | null;
    /** Stops the animation and cleans up all associated resources. */
    destroy(): void;
}
/**
 * The imperative handle a framework component exposes through its ref: the player API minus
 * what the component itself owns — `isReady` (the document is inline, so it is always ready),
 * `getRootElement` (the framework renders it) and `destroy` (unmounting does it).
 *
 * ONE definition and ONE name (review §9): every framework package re-exports
 * `PxAnimationPlayerHandle` itself — the per-package aliases (`ReactAnimatorApi`, …) are gone, so the
 * three cannot drift (React Native's speed comment had already lost "negative plays backwards").
 * @public
 */
export type PxAnimationPlayerHandle = Omit<PxAnimationPlayerApi, 'isReady' | 'getRootElement' | 'destroy'>;


/** The playback events the executor tells — the public callbacks' playback subset, told when the act is PERFORMED. @public @advanced */
export type PxPlaybackListeners = Pick<PxAnimationPlayerCallbacks, 'onPlaybackStart' | 'onPlaybackStop' | 'onPlaybackPause' | 'onPlaybackResume' | 'onPlaybackFinish'>;

/**
 * The player's ONE executor of the buttons (dev-docs/plans/playback-layers.md, animation-state.brainstorm.md) — what
 * the triggers' event lists, the `playback` prop and the api's methods all call. It performs the timeline's `actions`
 * (`playback.stop`) and `whenFinished` on the engine, owns the states the engines cannot report — paused (resumable)
 * versus off, finished, returning — and tells the playback events.
 * @public @advanced
 */
export interface PxPlayExecutor {
    /** off · playing · paused · finished · returning — see {@link PxPlaybackControls.getState}. */
    state(): PxPlaybackState;
    /** A playback from the start, in every state. */
    startPlayback(): void;
    /** Start or carry on: resume a pause, turn a return around, start otherwise; nothing while playing. */
    playPlayback(): void;
    /** The configured stop (`actions["playback.stop"]`); nothing to stop when off or returning. */
    stopPlayback(): void;
    /** Freeze where it is (only while playing). */
    pausePlayback(): void;
    /** Continue from the paused position (only while paused). */
    resumePlayback(): void;
    /** A seek on the whole playback, ms, by the seek rule: playing keeps playing, any other state becomes paused there. */
    seek(totalMs: number): void;
    /** The visibility gate's closing edge, per `actions.outOfView`: `pause` pauses a playing playback, `stop` stops a playing
     *  or finished one at once (no animated return); a return leg ends at once. Remembers what it did, for {@link returnToView}. */
    leaveView(behavior: PxOutOfViewBehavior): void;
    /** The gate's opening edge: undoes what {@link leaveView} did — resumes its pause, starts again after its stop — unless
     *  something else changed the playback in between. */
    returnToView(): void;
    /** The playback events — one set; the composed api hands the player's callbacks in. */
    setListeners(listeners: PxPlaybackListeners | undefined): void;
    /** The engine's clock reached an end (its `onFinish`): the playback's natural end (`finished`, `onPlaybackFinish`, then
     *  `whenFinished`), or the end of a return leg (rest there). The engines' `onFinish` hook calls this. */
    onNaturalFinish(): void;
    dispose(): void;
}

/** What an ENGINE constructs: the primitives — one clock for the whole playback (`getTotalTime` / `setTotalTime`), the
 *  speed, the raw `play` / `pause` (the clock on / off, with the engine's own `onPlay` / `onPause`), `jumpToStart` /
 *  `jumpToEnd`. Flat and internal: the public `player.playback` ({@link PxPlaybackControls}) is composed ONCE on top
 *  of any engine (`composeApiExtras`: `finaliseAnimator` on the web, the handle builder on React Native), so no rule
 *  can drift between engines. @public @advanced */
export interface PxEngineAnimationPlayerApi<TRoot = unknown> {
    isReady(): boolean;
    getRootElement(): TRoot | null;
    /** The clock moves. */
    isPlaying(): boolean;
    /** The clock on (raw — the buttons are the executor's). */
    play(): void;
    /** The clock off (raw — the gate's hold and a jump's internal pause use it too). */
    pause(): void;
    jumpToStart(): void;
    jumpToEnd(): void;
    getPlaybackSpeed(): number;
    setPlaybackSpeed(speed: number): void;
    /** The engine's one clock: ms on the whole playback. */
    getTotalTime(): number | null;
    setTotalTime(time: number): void;
    destroy(): void;
    /** The player's one executor (D5), attached by the engine so triggers wired inside it and the composed api share one state. */
    playExecutor?: PxPlayExecutor;
}


// ============================================================================
// DEEP VALIDATION
// ============================================================================

/** What {@link validateDocument} answers: the yes/no, the problem lines, and their structured
 *  twins for code that must BRANCH on what went wrong. @public */
export interface PxValidationResult {
    valid: boolean;
    errors: Array<string>;
    /** The structured twin of `errors`, one finding per line — see `PxValidationContext.findings`. */
    findings: Array<PxValidationFinding>;
}

/**
 * The pre-§15 spelling of `validateDocument(doc, { strict: false })` — kept on the `/internal`
 * entry for the editor's read path; new code calls `validateDocument`. (The `is` prefix lied:
 * it returns an object, not a boolean.)
 * @internal
 */
export function isValidPxDocument(doc: unknown): PxValidationResult {
    return validateDocument(doc, { strict: false });
}
