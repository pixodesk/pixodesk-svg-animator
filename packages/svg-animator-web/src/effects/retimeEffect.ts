/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/


/**
 * RETIME (`<use>` timeline remap) → clone the source named by `retime.baseId`,
 * remap every keyframe time (`t' = start + t·stretch`, in ms), and either:
 *   - (a) `RETIME_AS_SYMBOL=true`  — emit the clone as a `<symbol>` in defs and point
 *         the `<use>` at it (mirrors the editor's heavy materialisation), or
 *   - (b) `RETIME_AS_SYMBOL=false` — replace the `<use>` with a `<g>` that copies the
 *         use's own attrs (x/y → translate, transform, animate, …) and holds the
 *         cloned content inline.
 *
 * Both share the clone + keyframe-remap core; only the wrapping differs.
 */

import type { PxNode, PxRetimeEffect } from '../PxAnimatorTypes';
import type { ApplyContext } from './types';
import { clone, genId, regenerateIdsInClone } from './util';

const RETIME_AS_SYMBOL = true;

export function applyRetimeEffect(node: PxNode, retime: PxRetimeEffect | undefined, ctx: ApplyContext): PxNode {
    if (!retime) return node;

    const baseId = retime.baseId;
    if (!baseId) { ctx.errors.push('retime: missing baseId'); return node; }

    const target = ctx.idMap.get(baseId);
    if (!target) { ctx.warnings.push('retime: target "' + baseId + '" not found'); return node; }

    const start = retime.start ?? 0;
    const stretch = retime.stretch ?? 1;

    if (RETIME_AS_SYMBOL) {
        const symbolClone = clone(target);
        regenerateIdsInClone(symbolClone, ctx);            // fresh ids inside + internal href/url rewrites
        const cloneId = genId(ctx, 'retime');
        symbolClone.id = cloneId;                          // root id is the one we href to
        remapKeyframeTimes(symbolClone, start, stretch);
        ctx.defs.push(symbolClone);
        node.href = '#' + cloneId;
        return node;
    }

    // Inline replace: a <g> carrying the use's own attrs, holding the cloned content.
    // `<use href=#symbol>` renders the symbol's CHILDREN; `<use href=#element>` renders
    // a clone of the element itself.
    const sourceNodes = target.type === 'symbol' ? (target.children || []) : [target];
    const content = sourceNodes.map(child => {
        const c = clone(child);
        regenerateIdsInClone(c, ctx);                      // fresh ids inside + internal href/url rewrites
        remapKeyframeTimes(c, start, stretch);
        return c;
    });

    const g: PxNode = { ...node, type: 'g', children: content };
    delete g.href;

    // The use's x/y offset becomes a translate on the <g>.
    const x = Number(node.x ?? 0), y = Number(node.y ?? 0);
    if (x || y) {
        const offset = 'translate(' + x + ',' + y + ')';
        g.transform = typeof g.transform === 'string' ? offset + g.transform : offset;
        delete g.x; delete g.y;
    }
    return g;
}

/** Remaps every keyframe `time` in the subtree: `t' = start + t·stretch`. */
function remapKeyframeTimes(node: PxNode, start: number, stretch: number): void {
    const remap = (kfs: Array<any>) => {
        for (const kf of kfs) if (typeof kf.time === 'number') kf.time = start + kf.time * stretch;
    };

    if (node.transform && typeof node.transform === 'object' && Array.isArray(node.transform.keyframes)) {
        remap(node.transform.keyframes);
    }
    if (node.animate && typeof node.animate === 'object') {
        for (const prop of Object.keys(node.animate)) {
            const anim = node.animate[prop];
            if (anim && Array.isArray(anim.keyframes)) remap(anim.keyframes);
        }
    }
    node.children?.forEach(child => remapKeyframeTimes(child, start, stretch));
}
