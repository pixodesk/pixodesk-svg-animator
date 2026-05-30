/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/


import type { PxNode } from './types';


/**
 * TRIM-PATH / COMBINED-SHAPE → wrap the shape in a `<g>` that keeps the
 * presentation attrs, move the geometry into a `<path>` child, and keep
 * `trimPath` / `isCombinedShape` under `meta.effects`.
 *
 * No dash geometry is computed here — the heavy path doesn't either; the trim
 * stays as meta for the renderer to apply.
 */
export function applyTrimPathEffect(node: PxNode, trimPath: object | undefined, isCombinedShape: boolean | undefined): PxNode {
    if (!trimPath && !isCombinedShape) return node;

    const d = node.d ?? rectToPathD(node);
    if (d === undefined) return node;   // unsupported shape — leave it untouched

    const g: PxNode = { ...node, type: 'g' };
    delete g.d;

    const meta = (g.meta = { ...(g.meta || {}) });
    const effects = (meta.effects = { ...(meta.effects || {}) });
    if (trimPath) effects.trimPath = trimPath;
    effects.isCombinedShape = true;

    g.children = [{ type: 'path', d }];
    return g;
}

/** Converts a `<rect>` to its outline path `d`; returns undefined for other shapes. */
function rectToPathD(node: PxNode): string | undefined {
    if (node.type !== 'rect') return undefined;
    const x = Number(node.x ?? 0), y = Number(node.y ?? 0);
    const w = Number(node.width ?? 0), h = Number(node.height ?? 0);
    return 'M' + (x + w) + ',' + y + 'L' + (x + w) + ',' + (y + h) + 'L' + x + ',' + (y + h) + 'L' + x + ',' + y + 'L' + (x + w) + ',' + y + 'z';
}
