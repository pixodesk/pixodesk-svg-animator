/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/


import type { PxClipPathEffect, PxNode } from '../PxAnimatorTypes';
import type { ApplyContext } from './types';
import { genId } from './util';


/**
 * CLIP-PATH → a `<clipPath>` in defs holding a single `<path>` built from the effect's
 * static `d`, referenced via `clip-path="url(#…)"` on the host element.
 *
 * Materialiser pattern, mirroring `applyMaskedByEffect` (mint a def, set a URL ref on the
 * node) but far simpler — the clip geometry is a self-contained vector path (no ancestor
 * transform compensation, no source lookup). Static paths only.
 */
export function applyClipPathEffect(
    node: PxNode,
    fx: PxClipPathEffect | undefined,
    ctx: ApplyContext,
): PxNode {
    if (!fx || !fx.d) return node;

    const clipId = genId(ctx, 'clip');
    ctx.defs.push({ type: 'clipPath', id: clipId, children: [{ type: 'path', d: fx.d }] });
    node.clipPath = 'url(#' + clipId + ')';
    return node;
}
