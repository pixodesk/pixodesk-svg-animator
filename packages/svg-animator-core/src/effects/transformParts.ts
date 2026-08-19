/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/


/**
 * Helpers for reading animatable transform parts and shaping them into the
 * player's `PxTransformParts` records. Shared by the transformation and
 * masked-by effects (the latter builds INVERSE parts).
 */

import type { PxAnimatable, PxKeyframe, PxLoop, PxNode, Vec2 } from '../PxAnimatorTypes';
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


/** Builds a player `PxTransformParts` record for one part (+ optional origin). */
export function partsRecord(part: TransformPart, value: any, origin: Vec2 | undefined) {
    const rec: { translate?: Vec2; rotate?: number; skew?: number; scale?: Vec2; origin?: Vec2 } = {};
    if (part === TransformPart.Translate) rec.translate = value;
    else if (part === TransformPart.Rotate) rec.rotate = value;
    else if (part === TransformPart.Skew) rec.skew = value;
    else rec.scale = value;
    if (origin && part !== TransformPart.Translate) rec.origin = origin;
    return rec;
}

export type ReadPart<T> =
    | { kind: ReadKind.Absent }
    | { kind: ReadKind.Static; value: T }
    | { kind: ReadKind.Animated; keyframes: Array<PxKeyframe<T>>; autoOrient?: boolean; loop?: PxLoop | boolean; base?: T };

/** Normalises an animatable field into a static value or a keyframe list (with
 *  `autoOrient` and `loop` propagated — the latter so timeline-level loop config
 *  reaches the per-attribute `animate.X.loop` emitted by callers; without it,
 *  effect-driven animations would silently ignore `loop.alternate`/cycle while
 *  every non-effect property loops fine). A `value` present NEXT TO keyframes
 *  is surfaced as `base` (the static baseline of the unified animatable form). */
export function readAnimatable<T>(raw: PxAnimatable<T> | undefined): ReadPart<T> {
    if (raw === undefined) return { kind: ReadKind.Absent };
    if (Array.isArray(raw)) return { kind: ReadKind.Static, value: raw as unknown as T };
    if (typeof raw === 'object') {
        const obj = raw as {
            value?: T; v?: T;
            keyframes?: Array<PxKeyframe<T>>; kfs?: Array<PxKeyframe<T>>;
            autoOrient?: boolean; loop?: PxLoop | boolean;
        };
        const kfs = obj.keyframes ?? obj.kfs;
        if (kfs) {
            // Normalise the wire's short aliases ONCE, here, so every consumer
            // downstream (transformation, repeater, …) only ever sees the long
            // form. Without this a keyframe authored `{t, v}` lost both its time
            // and its value and the animation silently froze at frame 0.
            const out: ReadPart<T> = { kind: ReadKind.Animated, keyframes: kfs.map(normaliseKeyframe), autoOrient: obj.autoOrient, loop: obj.loop };
            const base = obj.value ?? obj.v;
            if (base !== undefined && out.kind === ReadKind.Animated) out.base = base;
            return out;
        }
        const staticValue = obj.value ?? obj.v;
        if (staticValue !== undefined) return { kind: ReadKind.Static, value: staticValue };
    }
    return { kind: ReadKind.Static, value: raw as T };
}

/**
 * Writes a normalised animatable (`ReadPart`) onto a node as attribute/animation —
 * the ONE emit path shared by the effect appliers (strokeTrim, textPath, …):
 *   - Static → `node[attrName] = value` (stringified when `opts.asString`).
 *   - Animated → `node.animate[attrName] = {keyframes, loop?, autoOrient?}` PLUS a
 *     static baseline attr (`base` if present, else the first kf's value). The
 *     animator only pushes animated values to the DOM on its first rAF tick — a
 *     DOM snapshot between mount and that tick (visual-test live-mode sample at
 *     t=0) must render the kf-at-time-0 state, not the un-styled default.
 */
export function writeAnimatableChannel(
    node: PxNode,
    attrName: string,
    read: ReadPart<any>,
    opts?: { asString?: boolean },
): void {
    const toOut = (v: unknown): unknown => (opts?.asString && v !== undefined && v !== null) ? String(v) : v;
    if (read.kind === ReadKind.Absent) return;
    if (read.kind === ReadKind.Static) {
        node[attrName] = toOut(read.value);
        return;
    }
    const prevAnimate = node.animate && typeof node.animate === 'object' && !Array.isArray(node.animate) ? node.animate : undefined;
    const animate: Record<string, any> = { ...(prevAnimate || {}) };
    const block: { keyframes: Array<PxKeyframe>; loop?: PxLoop | boolean; autoOrient?: boolean } = { keyframes: read.keyframes };
    if (read.loop !== undefined) block.loop = read.loop;
    if (read.autoOrient !== undefined) block.autoOrient = read.autoOrient;
    animate[attrName] = block;
    node.animate = animate;
    const baseline = read.base ?? read.keyframes[0]?.value ?? (read.keyframes[0] as { v?: unknown } | undefined)?.v;
    if (baseline !== undefined) node[attrName] = toOut(baseline);
}

/** Rewrites a keyframe's short aliases (`t`/`v`/`e`/`to`/`ti`) to their long
 *  names. Long names win when both are present, matching `PxMotionPath`'s
 *  `tangentIn ?? ti` precedence. */
function normaliseKeyframe<T>(kf: PxKeyframe<T>): PxKeyframe<T> {
    if (!kf || typeof kf !== 'object') return kf;
    const k = kf as PxKeyframe<T> & { t?: number; v?: T; e?: unknown; to?: Vec2; ti?: Vec2 };
    if (k.t === undefined && k.v === undefined && k.e === undefined && k.to === undefined && k.ti === undefined) {
        return kf; // already long-form — keep the same object
    }
    const out: any = { ...k };
    if (out.time === undefined && k.t !== undefined) out.time = k.t;
    if (out.value === undefined && k.v !== undefined) out.value = k.v;
    if (out.easing === undefined && k.e !== undefined) out.easing = k.e;
    if (out.tangentOut === undefined && k.to !== undefined) out.tangentOut = k.to;
    if (out.tangentIn === undefined && k.ti !== undefined) out.tangentIn = k.ti;
    return out as PxKeyframe<T>;
}

/** Origin used inside rotate/scale records. Animated origin falls back to frame 0. */
export function readStaticOrigin(raw: PxAnimatable<Vec2> | undefined, ctx: ApplyContext): Vec2 | undefined {
    const o = readAnimatable<Vec2>(raw);
    if (o.kind === ReadKind.Absent) return undefined;
    if (o.kind === ReadKind.Static) return o.value;
    ctx.warnings.push('transformBy.origin: animated origin approximated by its first keyframe');
    return o.keyframes[0]?.value;
}

/** Copies a keyframe's time / easing / motion-path tangent handles onto a new parts-record value. */
export function keyframeWith(kf: PxKeyframe<any>, value: any): PxKeyframe<any> {
    const out: PxKeyframe<any> = { value };
    if (kf.time !== undefined) out.time = kf.time;
    if (kf.easing !== undefined) out.easing = kf.easing;
    if (kf.tangentOut !== undefined) out.tangentOut = kf.tangentOut;
    if (kf.tangentIn !== undefined) out.tangentIn = kf.tangentIn;
    return out;
}
