/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/


import type { PxClipPathEffect, PxNode } from '../PxAnimatorTypes';
import type { ApplyContext } from './types';
import { genId } from './util';


/**
 * CLIP-PATH → a `<clipPath>` in defs holding a single `<path>` built from the effect's
 * `d`, referenced via `clip-path="url(#…)"` on the host element.
 *
 * Materialiser pattern, mirroring `applyMaskedByEffect` (mint a def, set a URL ref on the
 * node) but far simpler — the clip geometry is a self-contained vector path (no ancestor
 * transform compensation, no source lookup).
 *
 * ANIMATED clip: when `fx.animate` is present it becomes the child `<path>`'s `animate.d`
 * block. The def is spliced into the walked tree, so `collectIds` auto-assigns the animated
 * path an id and the frame loop rewrites its `d` per frame. `clip-path` is a live reference
 * (verified: the browser re-clips on every `d` change across SMIL/CSS/JS/WAAPI), so the clip
 * animates without any per-frame re-binding on the host.
 */
export function applyClipPathEffect(
    node: PxNode,
    fx: PxClipPathEffect | undefined,
    ctx: ApplyContext,
): PxNode {
    if (!fx || (!fx.d && !fx.animate)) return node;

    const clipId = genId(ctx, 'clip');
    const pathChild: PxNode = { type: 'path', d: fx.d };
    if (fx.animate) pathChild.animate = { d: fx.animate };
    ctx.defs.push({ type: 'clipPath', id: clipId, children: [pathChild] });
    node.clipPath = 'url(#' + clipId + ')';
    return node;
}
