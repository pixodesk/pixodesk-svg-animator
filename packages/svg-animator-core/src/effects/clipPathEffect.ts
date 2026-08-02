/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/


import type { PxClipPathEffect, PxNode } from '../PxAnimatorTypes';
import { ReadKind, readAnimatable, writeAnimatableChannel } from './transformParts';
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
 * `d` is a standard animatable slot (static string / `{value}` / `{keyframes}` with
 * `{path}` values — same grammar as body `d`). An animated `d` becomes the child
 * `<path>`'s `animate.d` block. The def is spliced into the walked tree, so `collectIds`
 * auto-assigns the animated path an id and the frame loop rewrites its `d` per frame.
 * `clip-path` is a live reference (verified: the browser re-clips on every `d` change
 * across SMIL/CSS/JS/WAAPI), so the clip animates without any per-frame re-binding on
 * the host.
 *
 * LEGACY: `{d: "M…", animate: {keyframes}}` (sibling `animate` key) is still read —
 * the animation is folded onto the same `animate.d`; a slot-driven animation wins.
 */
export function applyClipPathEffect(
    node: PxNode,
    fx: PxClipPathEffect | undefined,
    ctx: ApplyContext,
): PxNode {
    if (!fx || (!fx.d && !fx.animate)) return node;

    const clipId = genId(ctx, 'clip');
    const pathChild: PxNode = { type: 'path' };
    const read = readAnimatable<string>(fx.d);
    if (read.kind !== ReadKind.Absent) {
        // Static values may be the bare `d` string or a `{path}` object (the kf
        // value encoding) — normalise to the string for the body attr.
        if (read.kind === ReadKind.Static) {
            pathChild.d = pathString(read.value);
        } else {
            writeAnimatableChannel(pathChild, 'd', read);
            if (pathChild.d !== undefined) pathChild.d = pathString(pathChild.d as unknown);
        }
    }
    if (fx.animate && !(pathChild.animate as Record<string, unknown> | undefined)?.d) {
        const animate = (pathChild.animate as Record<string, unknown> | undefined) ?? {};
        animate.d = fx.animate;
        pathChild.animate = animate as PxNode['animate'];
    }
    ctx.defs.push({ type: 'clipPath', id: clipId, children: [pathChild] });
    node.clipPath = 'url(#' + clipId + ')';
    return node;
}

/** Unwraps a `{path: "M…"}` kf-value object to its string; passes strings through. */
function pathString(v: unknown): string | undefined {
    if (typeof v === 'string') return v;
    if (v && typeof v === 'object' && typeof (v as { path?: unknown }).path === 'string') return (v as { path: string }).path;
    return undefined;
}
