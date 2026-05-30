/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/


import { partsRecord, readAnimatable, readStaticOrigin, keyframeWith } from './transformParts';
import type { ApplyContext, PxAnimatable, PxMaskedByEffect, PxNode, PxTransformationEffect, Vec2 } from './types';
import { genId } from './util';


/**
 * MASKED-BY → a `<mask>` in defs holding the source `<use>` wrapped in the
 * INVERSE of the masked element's transform, plus `mask="url(#…)"` on the element.
 *
 * The mask source lives in root space; wrapping it in the inverse transform keeps
 * it aligned under the (possibly animated) target. Inverse = negate translate /
 * rotate, invert scale, with the wrapper nesting reversed.
 */
export function applyMaskedByEffect(
    node: PxNode, fx: PxMaskedByEffect | undefined, transformation: PxTransformationEffect | undefined, ctx: ApplyContext
): PxNode {
    if (!fx) return node;
    if (!fx.href) { ctx.errors.push('maskedBy.href missing — cannot build mask'); return node; }

    const maskId = genId(ctx, 'mask');

    let content: PxNode = { type: 'use', href: '#' + fx.href };
    content = wrapInverseTransform(content, transformation, ctx);

    const mask: PxNode = { type: 'mask', id: maskId, children: [content] };
    if (fx.maskType) mask.maskType = fx.maskType;
    if (fx.maskUnits) mask.maskUnits = fx.maskUnits;
    if (fx.maskContentUnits) mask.maskContentUnits = fx.maskContentUnits;
    ctx.defs.push(mask);

    node.mask = 'url(#' + maskId + ')';
    return node;
}

/** Wraps `inner` in inverse-transform `<g>`s: translate(innermost) → rotate → scale(outermost). */
function wrapInverseTransform(inner: PxNode, fx: PxTransformationEffect | undefined, ctx: ApplyContext): PxNode {
    if (!fx) return inner;
    const origin = readStaticOrigin(fx.origin, ctx);

    let n = inner;
    n = wrapInversePart(n, 'translate', fx.translate, undefined, ctx);
    n = wrapInversePart(n, 'rotate', fx.rotate, origin, ctx);
    n = wrapInversePart(n, 'scale', fx.scale, origin, ctx);
    return n;
}

function wrapInversePart(
    inner: PxNode, part: 'translate' | 'rotate' | 'scale',
    raw: PxAnimatable<any> | undefined, origin: Vec2 | undefined, ctx: ApplyContext
): PxNode {
    if (raw === undefined) return inner;
    const v = readAnimatable<any>(raw);
    if (v.kind === 'static') {
        return { type: 'g', transform: { value: partsRecord(part, invertPartValue(part, v.value), origin) }, children: [inner] };
    }
    if (v.kind === 'animated') {
        return {
            type: 'g',
            animate: { transform: { keyframes: v.keyframes.map(kf => keyframeWith(kf, partsRecord(part, invertPartValue(part, kf.value), origin))) } },
            children: [inner],
        };
    }
    return inner;
}

function invertPartValue(part: 'translate' | 'rotate' | 'scale', value: any): any {
    if (part === 'translate') return [-value[0], -value[1]];
    if (part === 'rotate') return -value;
    return [1 / value[0], 1 / value[1]];   // scale
}
