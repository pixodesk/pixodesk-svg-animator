/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/


/** Generic, effect-agnostic helpers for the player-effects applier. */

import type { ApplyContext, PxNode, Vec2 } from './types';

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

/** JSON-only deep clone (arrays + plain objects). */
export function clone<T>(value: T): T {
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(clone) as unknown as T;
    const out: { [k: string]: any } = {};
    for (const k of Object.keys(value as object)) out[k] = clone((value as any)[k]);
    return out as T;
}

/**
 * Regenerates every `id` inside `root` (including root itself) using fresh `genId`s,
 * then rewrites internal DOM refs (`href="#oldId"` and `url(#oldId)` inside string
 * attrs) to the new ids. References that point OUTSIDE the cloned subtree are left
 * untouched. `meta.*` is intentionally skipped — by the time retime runs in the
 * player, materialisation has already absorbed meta-driven structure.
 *
 * Returns the old→new id map so callers can rewrite their own outward-facing
 * references (e.g. a `<use>` href to the cloned subtree root).
 */
export function regenerateIdsInClone(root: PxNode, ctx: ApplyContext): Map<string, string> {
    const oldToNew = new Map<string, string>();

    const walkAssign = (n: PxNode): void => {
        if (typeof n.id === 'string') {
            const newId = genId(ctx, 'retimed');
            oldToNew.set(n.id, newId);
            n.id = newId;
        }
        n.children?.forEach(walkAssign);
    };
    walkAssign(root);

    const rewriteUrl = (s: string): string => s.replace(/url\(#([^)]+)\)/g, (m, oldId) => {
        const newId = oldToNew.get(oldId);
        return newId ? 'url(#' + newId + ')' : m;
    });

    const walkRewrite = (n: PxNode): void => {
        if (typeof n.href === 'string' && n.href.startsWith('#')) {
            const newId = oldToNew.get(n.href.slice(1));
            if (newId) n.href = '#' + newId;
        }
        for (const k of Object.keys(n)) {
            if (k === 'children' || k === 'effects' || k === 'meta' || k === 'href' || k === 'id') continue;
            const v = n[k];
            if (typeof v === 'string' && v.indexOf('url(#') !== -1) n[k] = rewriteUrl(v);
        }
        n.children?.forEach(walkRewrite);
    };
    walkRewrite(root);

    return oldToNew;
}
