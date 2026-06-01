/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/


/** Generic, effect-agnostic helpers for the player-effects applier. */

import { deepClonePxNode, regenerateIdsAndRewriteRefs } from '../PxNodeCloneUtil';
import type { PxNode, Vec2 } from '../PxAnimatorTypes';
import type { ApplyContext } from './types';

/** Mints a deterministic id for a generated node (`<mask>`, retimed `<symbol>`, …). */
export function genId(ctx: ApplyContext, prefix: string): string {
    return '_lw_' + prefix + '_' + (ctx.nextId++);
}

export function stripHash(href: any): string | undefined {
    return typeof href === 'string' ? href.replace(/^#/, '') : undefined;
}

/** Reads the leading `translate(x,y)` from an SVG transform string. */
export function readTranslateFromTransform(transform: any): Vec2 | undefined {
    if (typeof transform !== 'string') return undefined;
    const m = transform.match(/translate\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)/);
    return m ? [Number(m[1]), Number(m[2])] : undefined;
}

/** Records every node carrying an `id` into the lookup map. */
export function indexById(node: PxNode, map: Map<string, PxNode>): void {
    if (typeof node.id === 'string') map.set(node.id, node);
    node.children?.forEach(child => indexById(child, map));
}

/** Inserts generated <defs> nodes at the front of the root's children. */
export function spliceDefs(root: PxNode, defs: Array<PxNode>): void {
    if (!defs.length) return;
    const existing = root.children || (root.children = []);
    existing.unshift({ type: 'defs', children: defs });
}

/** Deep-clone a `PxNode` subtree. Thin wrapper around the shared
 *  {@link deepClonePxNode}; retained as `clone` for the existing call sites. */
export const clone = deepClonePxNode;

/**
 * Regenerates every `id` inside `root` (root included) using `genId(ctx, 'retimed')`
 * and rewrites internal `href="#X"` / `url(#X)` refs. Thin wrapper around the
 * shared {@link regenerateIdsAndRewriteRefs}; encapsulates the retime-specific
 * id-prefix convention so retime call sites stay unchanged.
 */
export function regenerateIdsInClone(root: PxNode, ctx: ApplyContext): Map<string, string> {
    return regenerateIdsAndRewriteRefs(root, () => genId(ctx, 'retimed'));
}
