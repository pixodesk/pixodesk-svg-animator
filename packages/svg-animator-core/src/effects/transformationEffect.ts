/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/


import { keyframeWith, partsRecord, ReadKind, readAnimatable, TransformPart } from './transformParts';
import type { PxAnimatable, PxNode, PxTransformationEffect, Vec2 } from '../PxAnimatorTypes';
import type { ApplyContext } from './types';


/**
 * TRANSFORMATION → one `<g>` wrapper per part (translate/rotate/scale/skew),
 * with origin emitted as SEPARATE `+origin` / `-origin` wrappers flanking the
 * rotate/scale pair.
 *
 * Per-wrapper kfs:
 *  - each wrapper carries ONE animatable quantity, so animated origin / rotate /
 *    scale all play correctly per their own keyframe timelines — nothing is
 *    baked into another part's wrapper.
 *  - the `+o · ... · -o` sandwich pivots rotate+scale around the (possibly
 *    animated) origin; translates compose flat (commute).
 *
 * Wrapper nesting (outer → inner):
 *
 *     translate → +origin → rotate → scale → -origin → skew → element
 *
 * Composition: `M = translate(t) · +origin(t) · rotate(t) · scale(t) · -origin(t) · skew`
 * (skew is appended innermost and not composed here).
 */
export function applyTransformationEffect(node: PxNode, fx: PxTransformationEffect | undefined, ctx: ApplyContext): PxNode {
    if (!fx) return node;

    // The element's own `transform` string is the frame-0 baseline; wrappers
    // carry the full (animated) transform, so the baseline is dropped.
    delete node.transform;

    // Innermost first. Order outer→inner: [+o, t, -o, +o, r, skew, s, -o] for
    // auto-orient (translate carries motion-path rotation that must pivot around
    // origin too), else [t, +o, r, skew, s, -o] (translate composes flat).
    // Skew sits BETWEEN rotate and scale, inside the origin sandwich — the canonical
    // slot shared with the unified body transform and Lottie (see skew-support.plan.md).
    let n = node;
    n = wrapOrigin(n, fx.origin, /*invert=*/true);                       // -origin (r/k/s sandwich)
    n = wrapTransformPart(n, TransformPart.Scale, normalizeScale(fx.scale), ctx);
    n = wrapTransformPart(n, TransformPart.Skew, fx.skew, ctx);
    n = wrapTransformPart(n, TransformPart.Rotate, fx.rotate, ctx);
    n = wrapOrigin(n, fx.origin, /*invert=*/false);                      // +origin (r/k/s sandwich)

    if (translateHasAutoOrient(fx.translate)) {
        // Sandwich translate with its own +o/-o so the motion-path tangent
        // rotation built into the translate wrapper pivots around origin
        // (the `[+o, t_path_ao, -o]` branch).
        n = wrapOrigin(n, fx.origin, /*invert=*/true);                   // -origin (translate sandwich)
        n = wrapTransformPart(n, TransformPart.Translate, fx.translate, ctx);
        n = wrapOrigin(n, fx.origin, /*invert=*/false);                  // +origin (translate sandwich)
    } else {
        n = wrapTransformPart(n, TransformPart.Translate, fx.translate, ctx);
    }
    return n;
}

/** True when the translate animation carries motion-path tangent handles or
 *  `autoOrient` — the path-tangent rotation needs origin-sandwich to pivot. */
function translateHasAutoOrient(translate: PxAnimatable<Vec2> | undefined): boolean {
    if (!translate || typeof translate !== 'object') return false;
    const obj = translate as { autoOrient?: boolean; keyframes?: Array<{ tangentOut?: Vec2; tangentIn?: Vec2 }> };
    if (obj.autoOrient) return true;
    return Array.isArray(obj.keyframes) && obj.keyframes.some(kf => kf.tangentOut || kf.tangentIn);
}

/**
 * The wire `effects.transformation.scale` is a FACTOR (1.5 = 150%) in every form —
 * bare static, `{value:…}` and `{keyframes:…}` alike (one convention, see
 * SCHEMA-ANALYSIS.md I-3; the old bare-static PERCENT form is gone) — so no
 * normalisation is needed any more. Kept as a named identity so the call site
 * still documents the convention decision.
 */
function normalizeScale(raw: PxAnimatable<Vec2> | undefined): PxAnimatable<Vec2> | undefined {
    return raw;
}

/** Wraps `inner` in a `<g>` carrying a single transform part, static or animated. */
function wrapTransformPart(
    inner: PxNode, part: TransformPart,
    raw: PxAnimatable<any> | undefined, ctx: ApplyContext
): PxNode {
    if (raw === undefined) return inner;

    const v = readAnimatable<any>(raw);
    if (v.kind === ReadKind.Static) {
        return { type: 'g', transform: { value: partsRecord(part, v.value, undefined) }, children: [inner] };
    }
    if (v.kind === ReadKind.Animated) {
        const animTr: any = { keyframes: v.keyframes.map(kf => keyframeWith(kf, partsRecord(part, kf.value, undefined))) };
        if (v.autoOrient) animTr.autoOrient = true;
        if (v.loop !== undefined) animTr.loop = v.loop;
        return {
            type: 'g',
            animate: { transform: animTr },
            children: [inner],
        };
    }
    return inner;
}

/**
 * Wraps `inner` in a `<g translate>` that shifts by `+origin` (invert=false) or
 * `-origin` (invert=true). Origin is animatable — keyframes are carried through.
 *
 * Emitted as a `{translate}` PartsRecord (not the `{origin}` field) so a `+o`
 * wrapper is just a plain translate in the walker's eyes: the walker composes
 * the origin-sandwich rotation/scale around origin by stacking the wrappers,
 * NOT by reading `origin` off the rotate/scale wrapper's parts record.
 */
function wrapOrigin(inner: PxNode, raw: PxAnimatable<Vec2> | undefined, invert: boolean): PxNode {
    if (raw === undefined) return inner;
    const v = readAnimatable<Vec2>(raw);
    const sign = (value: Vec2): Vec2 => invert ? [-value[0], -value[1]] : value;

    if (v.kind === ReadKind.Absent) return inner;
    if (v.kind === ReadKind.Static) {
        if (v.value[0] === 0 && v.value[1] === 0) return inner;  // identity — skip
        return { type: 'g', transform: { value: { translate: sign(v.value) } }, children: [inner] };
    }
    if (v.kind === ReadKind.Animated) {
        const animTr: any = { keyframes: v.keyframes.map(kf => keyframeWith(kf, { translate: sign(kf.value as Vec2) })) };
        if (v.loop !== undefined) animTr.loop = v.loop;
        return {
            type: 'g',
            animate: { transform: animTr },
            children: [inner],
        };
    }
    return inner;
}
