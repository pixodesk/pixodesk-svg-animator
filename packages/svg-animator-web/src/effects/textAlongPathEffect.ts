/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/


import type { PxAnimatable, PxNode, PxTextAlongPathEffect } from '../PxAnimatorTypes';
import type { ApplyContext } from './types';


/**
 * `effects.textAlongPath` materialiser.
 *
 * Editor model holds the path geometry as a `<path>` def, with the text node
 * pointing at it via `effects.textAlongPath.href`. SVG's native rendering
 * requires a `<textPath href="#…">` wrapper inside `<text>`, so this applier
 * mints that wrapper around the text node's children and forwards the
 * textPath SVG attrs (`lengthAdjust`, `method`, `spacing`, `startOffset`,
 * `textLength`) verbatim.
 *
 * `startOffset` / `textLength` accept the full `PxAnimatable<number>` shape:
 * a static number is set as an attribute on the `<textPath>`; the
 * `{keyframes}` form is forwarded to `<textPath>.animate.<attr>` so the
 * player's binding pipeline animates it the same way as any other animated
 * attribute. The `{value}` form is unwrapped to the same static shape.
 *
 * The `<path>` def itself isn't touched here — it lives in `ctx.defs` (root
 * defs) like any other shape def, free to carry its own animations / shape
 * effects.
 */
export function applyTextAlongPathEffect(
    node: PxNode,
    fx: PxTextAlongPathEffect | undefined,
    _ctx: ApplyContext,
): PxNode {
    if (!fx) return node;

    // Wire stores the bare id (per the maskedBy convention) — add the `#`
    // for the native `<textPath href="#…">` syntax.
    const href = typeof fx.href === 'string' && !fx.href.startsWith('#') ? '#' + fx.href : fx.href;
    const textPath: PxNode = {
        type: 'textPath',
        href,
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
    if (typeof raw === 'object') {
        const obj = raw as { value?: number; keyframes?: Array<unknown> };
        if (Array.isArray(obj.keyframes)) {
            const prevAnimate = node.animate && typeof node.animate === 'object' && !Array.isArray(node.animate) ? node.animate : undefined;
            const animate: Record<string, any> = { ...(prevAnimate || {}) };
            animate[attrName] = { keyframes: obj.keyframes };
            node.animate = animate;
            return;
        }
        if (typeof obj.value === 'number') {
            node[attrName] = String(obj.value);
            return;
        }
    }
}
