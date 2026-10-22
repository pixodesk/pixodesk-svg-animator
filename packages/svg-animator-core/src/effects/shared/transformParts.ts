// @px-area effects
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/


/**
 * Helpers for reading animatable transform parts and shaping them into the
 * player's `PxTransformParts` records. Shared by the transformation and
 * masked-by effects (the latter builds INVERSE parts).
 */

import { px, type PxSchema } from '../../schema/PxSchema';
import {
    isCompiledAnimation, PxEasingOrRefSchema, PxKeyframeValueSchema, PxPropertyAnimationSchema, PxTransformPartsSchema, PxTransformValueWrapperSchema, PxVec2Schema,
    type PxAnimationDefinition, type PxAnyPropertyAnimation, type PxKeyframe, type PxKeyframeValue, type PxLoop, type PxNode, type PxPropertyAnimation, type PxTransformParts, type PxVec2,
} from '../../format/PxAnimatorTypes';
import type { ApplyContext } from './types';


/**
 * Names of the transform parts emitted into a `PxTransformParts` record. The
 * enum's STRING VALUES double as the wire-format object keys, so callers can
 * write `rec[TransformPart.Translate] = …` and produce `{translate: …}`.
 */
export enum TransformPart {
    Translate = 'translate',
    Rotate = 'rotate',
    Scale = 'scale',
    Skew = 'skew',
    Origin = 'origin',
}


/** Result kinds for `readAnimatable` — discriminator on `ReadPart<T>`. */
export enum ReadKind {
    Absent = 'absent',
    Static = 'static',
    Animated = 'animated',
}


/** Builds a player `PxTransformParts` record for one part (+ optional origin): numbers fill rotate / skew, vectors translate / scale. */
export function partsRecord(part: TransformPart, value: number | PxVec2, origin: PxVec2 | undefined): PxTransformParts {
    const rec: PxTransformParts = {};
    if (typeof value === 'number') {
        if (part === TransformPart.Rotate) rec.rotate = value;
        else if (part === TransformPart.Skew) rec.skew = value;
    } else if (part === TransformPart.Translate) rec.translate = value;
    else rec.scale = value;
    if (origin && part !== TransformPart.Translate) rec.origin = origin;
    return rec;
}

/** A keyframe whose `value` was cast to the channel's grammar. */
export type ValueKeyframe<T> = PxKeyframe<T> & { value: T };

export type ReadPart<T> =
    | { kind: ReadKind.Absent }
    | { kind: ReadKind.Static; value: T }
    | { kind: ReadKind.Animated; keyframes: Array<ValueKeyframe<T>>; autoOrient?: boolean; loop?: PxLoop | boolean; base?: T };

/** The retired short spellings (`t`/`v`/`e`/`to`/`ti`) — still read inside effect payloads. */
const ShortSpellingSchema = px.object({
    t: px.number().optional(),
    v: PxKeyframeValueSchema.optional(),
    e: PxEasingOrRefSchema.optional(),
    to: PxVec2Schema.optional(),
    ti: PxVec2Schema.optional(),
});

/** The element's inline animation definition (`node.animate` as an object), if any. */
export function inlineAnimate(node: PxNode): PxAnimationDefinition | undefined {
    const animate = node.animate;
    return typeof animate === 'object' && !Array.isArray(animate) ? animate : undefined;
}

/** An `animate` entry as an effect reworks it: authored only — effects run before the compile step, a compiled entry is already lowered. */
export function authoredOf(anim: PxAnyPropertyAnimation | undefined): PxPropertyAnimation | undefined {
    return anim && !isCompiledAnimation(anim) ? anim : undefined;
}

/** True when a translate animation rotates along its path (tangent handles or `autoOrient`) — origin must then pivot that rotation too. */
export function hasPathRotation(translate: unknown): boolean {
    const anim = PxPropertyAnimationSchema.castOrNull(translate);
    if (!anim) return false;
    if (anim.autoOrient) return true;
    return !!anim.keyframes?.some(kf => kf.tangentOut || kf.tangentIn);
}

/** The STATIC parts record of a `transform` slot — bare record or the `{value}` wrapper; undefined for a string or an animation. */
export function staticTransformParts(transform: unknown): PxTransformParts | undefined {
    if (typeof transform !== 'object' || PxPropertyAnimationSchema.castOrNull(transform)?.keyframes) return undefined;
    // The wrapper first: the all-optional parts record also accepts `{value}`.
    return PxTransformValueWrapperSchema.castOrNull(transform)?.value ?? PxTransformPartsSchema.castOrNull(transform) ?? undefined;
}

/** Normalizes an animatable field into a static value or a keyframe list (with
 *  `autoOrient` and `loop` propagated — the latter so timeline-level loop config
 *  reaches the per-attribute `animate.X.loop` emitted by callers; without it,
 *  effect-driven animations would silently ignore `loop.alternate`/cycle while
 *  every non-effect property loops fine). A `value` present NEXT TO keyframes
 *  is surfaced as `base` (the static baseline of the unified animatable form).
 *  Every value is cast with `valueSchema` (the slot's grammar): a static that does
 *  not match reads as Absent, a keyframe that does not match is skipped. */
export function readAnimatable<T>(raw: unknown, valueSchema: PxSchema<T>): ReadPart<T> {
    if (raw === undefined) return { kind: ReadKind.Absent };
    const anim = PxPropertyAnimationSchema.castOrNull(raw);
    const short = anim ? ShortSpellingSchema.castOrNull(raw) : null;
    const wrapped = anim ? anim.value ?? short?.v : undefined;
    if (anim?.keyframes) {
        // Normalize the wire's short aliases ONCE, here, so every consumer
        // downstream (transformation, repeater, …) only ever sees the long
        // form. Without this a keyframe authored `{t, v}` lost both its time
        // and its value and the animation silently froze at frame 0.
        const keyframes: Array<ValueKeyframe<T>> = [];
        for (const kf of anim.keyframes) {
            const k = normalizeKeyframe(kf, valueSchema);
            if (k) keyframes.push(k);
        }
        const out: ReadPart<T> = { kind: ReadKind.Animated, keyframes, autoOrient: anim.autoOrient, loop: anim.loop };
        const base = valueSchema.castOrNull(wrapped);
        if (base !== null) out.base = base;
        return out;
    }
    const value = valueSchema.castOrNull(wrapped !== undefined ? wrapped : raw);
    return value !== null ? { kind: ReadKind.Static, value } : { kind: ReadKind.Absent };
}

/**
 * Writes a normalized animatable (`ReadPart`) onto a node as attribute/animation —
 * the ONE emit path shared by the effect appliers (strokeTrim, textPath, …):
 *   - Static → `node[attrName] = value` (stringified when `opts.asString`).
 *   - Animated → `node.animate[attrName] = {keyframes, loop?, autoOrient?}` PLUS a
 *     static baseline attr (`base` if present, else the first kf's value). The
 *     animator only pushes animated values to the DOM on its first rAF tick — a
 *     DOM snapshot between mount and that tick (visual-test live-mode sample at
 *     t=0) must render the kf-at-time-0 state, not the un-styled default.
 */
export function writeAnimatableChannel<T extends PxKeyframeValue>(
    node: PxNode,
    attrName: string,
    read: ReadPart<T>,
    opts?: { asString?: boolean },
): void {
    const toOut = (v: unknown): unknown => (opts?.asString && v !== undefined && v !== null) ? String(v) : v;
    if (read.kind === ReadKind.Absent) return;
    if (read.kind === ReadKind.Static) {
        node[attrName] = toOut(read.value);
        return;
    }
    const block: PxPropertyAnimation = { keyframes: read.keyframes };
    if (read.loop !== undefined) block.loop = read.loop;
    if (read.autoOrient !== undefined) block.autoOrient = read.autoOrient;
    const animate: PxAnimationDefinition = { ...inlineAnimate(node) };
    animate[attrName] = block;
    node.animate = animate;
    const baseline = read.base ?? read.keyframes[0]?.value;
    if (baseline !== undefined) node[attrName] = toOut(baseline);
}

/** Rewrites a keyframe's short aliases (`t`/`v`/`e`/`to`/`ti`) to their long
 *  names and casts its value with `valueSchema` — undefined when the value does
 *  not match. Long names win when both are present, matching `PxMotionPath`'s
 *  `tangentIn ?? ti` precedence. */
export function normalizeKeyframe<T>(kf: PxKeyframe, valueSchema: PxSchema<T>): ValueKeyframe<T> | undefined {
    const short = ShortSpellingSchema.castOrNull(kf);
    const value = valueSchema.castOrNull(kf.value ?? short?.v);
    if (value === null) return undefined;
    const out: ValueKeyframe<T> = { ...kf, value };
    if (!short) return out;
    if (out.time === undefined && short.t !== undefined) out.time = short.t;
    if (out.easing === undefined && short.e !== undefined) out.easing = short.e;
    if (out.tangentOut === undefined && short.to !== undefined) out.tangentOut = short.to;
    if (out.tangentIn === undefined && short.ti !== undefined) out.tangentIn = short.ti;
    return out;
}

/** Origin used inside rotate/scale records. Animated origin falls back to frame 0. */
export function readStaticOrigin(raw: unknown, ctx: ApplyContext): PxVec2 | undefined {
    const o = readAnimatable(raw, PxVec2Schema);
    if (o.kind === ReadKind.Absent) return undefined;
    if (o.kind === ReadKind.Static) return o.value;
    ctx.warnings.push('transformBy.origin: animated origin approximated by its first keyframe');
    return o.keyframes[0]?.value;
}

/** Copies a keyframe's time / easing / motion-path tangent handles onto a new value. */
export function keyframeWith<V>(kf: PxKeyframe, value: V): ValueKeyframe<V> {
    const out: ValueKeyframe<V> = { value };
    if (kf.time !== undefined) out.time = kf.time;
    if (kf.easing !== undefined) out.easing = kf.easing;
    if (kf.tangentOut !== undefined) out.tangentOut = kf.tangentOut;
    if (kf.tangentIn !== undefined) out.tangentIn = kf.tangentIn;
    return out;
}
