/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/


import type { ApplyContext, PxNode, PxRepeaterEffect, Vec2 } from './types';
import { clone } from './util';


/**
 * REPEATER → N clones inside a `<g>` wrapper, each offset by a per-copy
 * translate/rotate/scale increment.
 */
export function applyRepeaterEffect(node: PxNode, fx: PxRepeaterEffect | undefined, ctx: ApplyContext): PxNode {
    if (!fx) return node;

    const copies = fx.copies ?? 1;
    if (copies < 1) { ctx.errors.push('repeater.copies invalid: ' + fx.copies); return node; }

    // The base element's SHARED transform (static baseline + any animation) is
    // lifted onto the wrapper so the per-copy increments compose in the wrapper's
    // coordinate space. Non-transform animations (opacity, fill) stay per copy.
    const sharedTransform = node.transform;
    const sharedAnimTransform = node.animate?.transform;

    const base = clone(node);
    delete base.transform;
    if (base.animate) {
        delete base.animate.transform;
        if (Object.keys(base.animate).length === 0) delete base.animate;
    }

    const children: Array<PxNode> = [base];
    for (let i = 1; i < copies; i++) {
        const copy = clone(base);
        copy.transform = { value: perCopyParts(fx, i) };
        children.push(copy);
    }

    const wrapper: PxNode = { type: 'g', children };
    if (sharedTransform !== undefined) wrapper.transform = sharedTransform;
    if (sharedAnimTransform !== undefined) wrapper.animate = { transform: sharedAnimTransform };
    return wrapper;
}

/** Transform parts for copy `i`: translate×i, rotate×i, scale^i (percent), origin×i. */
function perCopyParts(fx: PxRepeaterEffect, i: number) {
    const parts: { translate?: Vec2; rotate?: number; scale?: Vec2; origin?: Vec2 } = {};
    if (fx.translate) parts.translate = [fx.translate[0] * i, fx.translate[1] * i];
    if (fx.rotate !== undefined) parts.rotate = fx.rotate * i;
    if (fx.scale) parts.scale = [(fx.scale[0] / 100) ** i, (fx.scale[1] / 100) ** i];
    if (fx.origin) parts.origin = [fx.origin[0] * i, fx.origin[1] * i];
    return parts;
}
