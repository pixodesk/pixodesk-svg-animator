/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/


import type { PxAnimatable, PxNode, PxTextPathEffect } from '../PxAnimatorTypes';
import type { ApplyContext } from './types';
import { genId } from './util';


/**
 * `effects.textPath` materialiser (browser-font / non-glyph path).
 *
 * The path geometry is carried INLINE on the effect as `path` (an SVG `d`). SVG's
 * native rendering requires a `<textPath href="#…">` wrapper referencing a `<path>`
 * def, so this applier mints that `<path>` def from the inline geometry, wraps the
 * text node's children in the `<textPath>`, and forwards the textPath SVG attrs
 * (`lengthAdjust`, `method`, `spacing`, `startOffset`, `textLength`).
 *
 * `startOffset` / `textLength` accept the full `PxAnimatable<number>` shape: a static
 * number is set as an attribute; the `{keyframes}` form is forwarded to
 * `<textPath>.animate.<attr>`; `{value}` is unwrapped to the static shape.
 *
 * NOTE: `pathOverflow:'extend'` (tangent-extending the minted `<path>` so the browser
 * lays overflow glyphs onto the straight extension) is a later step — today the minted
 * path is the geometry as-is, so native rendering clips at the path end.
 */
export function applyTextPathEffect(
    node: PxNode,
    fx: PxTextPathEffect | undefined,
    ctx: ApplyContext,
): PxNode {
    if (!fx || typeof fx.path !== 'string' || !fx.path) return node;

    const pathId = genId(ctx, 'tpath');
    ctx.defs.push({ type: 'path', id: pathId, d: fx.path });

    const textPath: PxNode = {
        type: 'textPath',
        href: '#' + pathId,
        children: node.children ?? [],
    };
    if (fx.lengthAdjust !== undefined) textPath.lengthAdjust = fx.lengthAdjust;
    if (fx.method !== undefined)       textPath.method = fx.method;
    if (fx.spacing !== undefined)      textPath.spacing = fx.spacing;
    applyAnimatableNumber(textPath, 'startOffset', fx.startOffset);
    applyAnimatableNumber(textPath, 'textLength',  fx.textLength);

    node.children = [textPath];
    return node;
}


/** Routes a `PxAnimatable<number>` onto a node:
 *   - bare `number` / `{value:number}` → `node[attrName] = String(value)`
 *   - `{keyframes:[…]}` → `node.animate[attrName] = { keyframes }`
 *  Mirrors the pattern in `trimPathEffect.applyAttr`. */
function applyAnimatableNumber(node: PxNode, attrName: string, raw: PxAnimatable<number> | undefined): void {
    if (raw === undefined || raw === null) return;

    if (typeof raw === 'number') {
        node[attrName] = String(raw);
        return;
    }
    if (typeof raw === 'object' && raw !== null) {
        const obj = raw as { value?: number; keyframes?: Array<unknown>; loop?: unknown };
        if (Array.isArray(obj.keyframes)) {
            const prevAnimate = node.animate && typeof node.animate === 'object' && !Array.isArray(node.animate) ? node.animate : undefined;
            const animate: Record<string, any> = { ...(prevAnimate || {}) };
            const block: { keyframes: Array<unknown>, loop?: unknown } = { keyframes: obj.keyframes };
            if (obj.loop !== undefined) block.loop = obj.loop;
            animate[attrName] = block;
            node.animate = animate;
            return;
        }
        if (typeof obj.value === 'number') {
            node[attrName] = String(obj.value);
            return;
        }
    }
}
