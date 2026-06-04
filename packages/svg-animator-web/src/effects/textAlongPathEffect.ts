/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/


import type { PxNode, PxTextAlongPathEffect } from '../PxAnimatorTypes';
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

    const textPath: PxNode = {
        type: 'textPath',
        href: fx.href,
        children: node.children ?? [],
    };
    if (fx.lengthAdjust !== undefined) textPath.lengthAdjust = fx.lengthAdjust;
    if (fx.method !== undefined)       textPath.method = fx.method;
    if (fx.spacing !== undefined)      textPath.spacing = fx.spacing;
    if (fx.startOffset !== undefined)  textPath.startOffset = String(fx.startOffset);
    if (fx.textLength !== undefined)   textPath.textLength = String(fx.textLength);

    node.children = [textPath];
    return node;
}
