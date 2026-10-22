// @px-area effects
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/


import { hasPathRotation, keyframeWith, partsRecord, ReadKind, readAnimatable, TransformPart, type ReadPart } from '../shared/transformParts';
import { PxChannelNumberSchema, PxVec2Schema, type PxAnimatable, type PxNode, type PxPropertyAnimation, type PxTransformByEffect, type PxVec2 } from '../../format/PxAnimatorTypes';
import type { ApplyContext } from '../shared/types';


// @px-importance important
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
export function applyTransformByEffect(node: PxNode, fx: PxTransformByEffect | undefined, ctx: ApplyContext): PxNode {
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
    n = wrapTransformPart(n, TransformPart.Scale, readAnimatable(normalizeScale(fx.scale), PxVec2Schema));
    n = wrapTransformPart(n, TransformPart.Skew, readAnimatable(fx.skew, PxChannelNumberSchema));
    n = wrapTransformPart(n, TransformPart.Rotate, readAnimatable(fx.rotate, PxChannelNumberSchema));
    n = wrapOrigin(n, fx.origin, /*invert=*/false);                      // +origin (r/k/s sandwich)

    if (hasPathRotation(fx.translate)) {
        // Sandwich translate with its own +o/-o so the motion-path tangent
        // rotation built into the translate wrapper pivots around origin
        // (the `[+o, t_path_ao, -o]` branch).
        n = wrapOrigin(n, fx.origin, /*invert=*/true);                   // -origin (translate sandwich)
        n = wrapTransformPart(n, TransformPart.Translate, readAnimatable(fx.translate, PxVec2Schema));
        n = wrapOrigin(n, fx.origin, /*invert=*/false);                  // +origin (translate sandwich)
    } else {
        n = wrapTransformPart(n, TransformPart.Translate, readAnimatable(fx.translate, PxVec2Schema));
    }

    // The OUTERMOST wrapper takes the element's id (B4/A1): an id names the WHOLE
    // transformed unit — same law as `repeaterEffect`, the editor's heavy render,
    // and `ctx.idMap` (which already points at the outer wrapper). Leaving it on
    // the core makes a live `<use href>` / the maskedBy-generated `<use>` resolve to
    // the UNtransformed element in the DOM.
    if (n !== node && node.id) {
        n.id = node.id;
        delete node.id;
    }
    return n;
}

/**
 * The wire `effects.transformBy.scale` is a FACTOR (1.5 = 150%) in every form —
 * bare static, `{value:…}` and `{keyframes:…}` alike (one convention, see
 * dev-docs/schema-design.md I-3; the old bare-static PERCENT form is gone) — so no
 * normalization is needed any more. Kept as a named identity so the call site
 * still documents the convention decision.
 */
function normalizeScale(raw: PxAnimatable<PxVec2> | undefined): PxAnimatable<PxVec2> | undefined {
    return raw;
}

/** Wraps `inner` in a `<g>` carrying a single transform part, static or animated. */
function wrapTransformPart<T extends number | PxVec2>(inner: PxNode, part: TransformPart, v: ReadPart<T>): PxNode {
    if (v.kind === ReadKind.Static) {
        return { type: 'g', transform: { value: partsRecord(part, v.value, undefined) }, children: [inner] };
    }
    if (v.kind === ReadKind.Animated) {
        const animTr: PxPropertyAnimation = { keyframes: v.keyframes.map(kf => keyframeWith(kf, partsRecord(part, kf.value, undefined))) };
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
function wrapOrigin(inner: PxNode, raw: PxAnimatable<PxVec2> | undefined, invert: boolean): PxNode {
    if (raw === undefined) return inner;
    const v = readAnimatable(raw, PxVec2Schema);
    const sign = (value: PxVec2): PxVec2 => invert ? [-value[0], -value[1]] : value;

    if (v.kind === ReadKind.Absent) return inner;
    if (v.kind === ReadKind.Static) {
        if (v.value[0] === 0 && v.value[1] === 0) return inner;  // identity — skip
        return { type: 'g', transform: { value: { translate: sign(v.value) } }, children: [inner] };
    }
    if (v.kind === ReadKind.Animated) {
        const animTr: PxPropertyAnimation = { keyframes: v.keyframes.map(kf => keyframeWith(kf, { translate: sign(kf.value) })) };
        if (v.loop !== undefined) animTr.loop = v.loop;
        return {
            type: 'g',
            animate: { transform: animTr },
            children: [inner],
        };
    }
    return inner;
}
