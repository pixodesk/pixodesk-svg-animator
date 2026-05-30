/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/


/**
 * Helpers for reading animatable transform parts and shaping them into the
 * player's `PxTransformParts` records. Shared by the transformation and
 * masked-by effects (the latter builds INVERSE parts).
 */

import type { ApplyContext, PxAnimatable, PxKeyframe, Vec2 } from './types';

/** Builds a player `PxTransformParts` record for one part (+ optional origin). */
export function partsRecord(part: 'translate' | 'rotate' | 'scale', value: any, origin: Vec2 | undefined) {
    const rec: { translate?: Vec2; rotate?: number; scale?: Vec2; origin?: Vec2 } = {};
    if (part === 'translate') rec.translate = value;
    else if (part === 'rotate') rec.rotate = value;
    else rec.scale = value;
    if (origin && part !== 'translate') rec.origin = origin;
    return rec;
}

export type ReadPart<T> =
    | { kind: 'absent' }
    | { kind: 'static'; value: T }
    | { kind: 'animated'; keyframes: Array<PxKeyframe<T>>; autoOrient?: boolean };

/** Normalises an animatable field into a static value or a keyframe list (with
 *  `autoOrient` propagated for motion-path translate). */
export function readAnimatable<T>(raw: PxAnimatable<T> | undefined): ReadPart<T> {
    if (raw === undefined) return { kind: 'absent' };
    if (Array.isArray(raw)) return { kind: 'static', value: raw as unknown as T };
    if (typeof raw === 'object') {
        const obj = raw as { value?: T; keyframes?: Array<PxKeyframe<T>>; autoOrient?: boolean };
        if (obj.keyframes) {
            return { kind: 'animated', keyframes: obj.keyframes, autoOrient: obj.autoOrient };
        }
        if (obj.value !== undefined) return { kind: 'static', value: obj.value };
    }
    return { kind: 'static', value: raw as T };
}

/** Origin used inside rotate/scale records. Animated origin falls back to frame 0. */
export function readStaticOrigin(raw: PxAnimatable<Vec2> | undefined, ctx: ApplyContext): Vec2 | undefined {
    const o = readAnimatable<Vec2>(raw);
    if (o.kind === 'absent') return undefined;
    if (o.kind === 'static') return o.value;
    ctx.warnings.push('transformation.origin: animated origin approximated by its first keyframe');
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
