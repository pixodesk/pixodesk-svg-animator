/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

/**
 * Shared "clone a subtree and rewire its internal references" primitives.
 *
 * Used by:
 *   - The retime effect's `<use>` chain materialiser (`effects/util.ts`'s
 *     `clone` + `regenerateIdsInClone`, which now delegate here).
 *   - `PxAnimatorUseMaterialiser` — the WAAPI-side post-pass that replaces
 *     `<use>` instances referencing animated subtrees with deep clones.
 *
 * Both call sites need the exact same two operations: a structural deep clone
 * of a `PxNode` subtree, and a renumber-all-ids pass that also rewrites
 * internal `href="#X"` / `url(#X)` references to the new ids while leaving
 * outward-facing references alone.
 */

import type { PxNode } from './PxAnimatorTypes';


/** Recursive deep clone for plain JSON-shaped `PxNode` data (objects, arrays,
 *  primitives). Faster than `JSON.parse(JSON.stringify(x))` for large trees,
 *  no behaviour difference for our wire format (no `Date` / `Map` / functions).
 */
export function deepClonePxNode<T>(value: T): T {
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(deepClonePxNode) as unknown as T;
    const out: { [k: string]: unknown } = {};
    for (const k of Object.keys(value as object)) out[k] = deepClonePxNode((value as { [k: string]: unknown })[k]);
    return out as T;
}


/**
 * Regenerates every `id` inside `root` (root included) using fresh ids from
 * `genId()`, then rewrites internal DOM references (`href="#oldId"` and
 * `url(#oldId)` inside string attrs) to the new ids. References that point
 * OUTSIDE the cloned subtree are left untouched.
 *
 * `meta.*`, `effects.*`, `animate.*` are intentionally skipped — they don't
 * carry DOM-reference syntax, and walking them per-string is wasted work.
 *
 * Returns the old→new id map so callers can rewrite their own outward-facing
 * references (e.g. a `<use>` href pointing at the cloned subtree root).
 */
export function regenerateIdsAndRewriteRefs(
    root: PxNode,
    genId: () => string,
): Map<string, string> {
    const oldToNew = new Map<string, string>();

    const walkAssign = (n: PxNode): void => {
        if (typeof n.id === 'string') {
            const newId = genId();
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
            if (k === 'children' || k === 'effects' || k === 'meta' || k === 'animate' || k === 'href' || k === 'id') continue;
            const v = (n as { [k: string]: unknown })[k];
            if (typeof v === 'string' && v.indexOf('url(#') !== -1) {
                (n as { [k: string]: unknown })[k] = rewriteUrl(v);
            }
        }
        n.children?.forEach(walkRewrite);
    };
    walkRewrite(root);

    return oldToNew;
}


function toFiniteNum(v: unknown): number {
    const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN;
    return Number.isFinite(n) ? n : 0;
}

/**
 * Applies a `<use>`'s `x`/`y` offset when it is materialised into a `<g>`.
 *
 * Per SVG 2, `<use x y>` is an extra `translate(x, y)` appended AFTER the use's
 * own `transform`, so it composes innermost (closest to the referenced content).
 * `<g>` has no `x`/`y`, so the offset must become a transform — and when the use
 * also carries a (possibly animated) `transform`, the two can't be merged into a
 * single attribute, so the content is wrapped in an inner offset `<g>`:
 *
 *     <use transform="T" x="X" y="Y">
 *       → <g transform="T"><g transform="translate(X,Y)">…content…</g></g>
 *
 * With no transform/animation, a single `<g transform="translate(X,Y)">` suffices.
 *
 * `gNode` is the `<g>` already derived from the use (type:'g', href dropped, the
 * use's `transform`/`animate`/etc. carried over, `x`/`y` still present). Mutates
 * and returns it; `x`/`y` are removed.
 */
export function applyUseOffsetToG(gNode: PxNode): PxNode {
    const x = toFiniteNum((gNode as { x?: unknown }).x);
    const y = toFiniteNum((gNode as { y?: unknown }).y);
    delete (gNode as { x?: unknown }).x;
    delete (gNode as { y?: unknown }).y;
    if (!x && !y) return gNode;

    const offset = 'translate(' + x + ',' + y + ')';

    // Any existing transform/animation on the outer <g> must apply OUTSIDE the
    // offset, so push the offset into an inner wrapper rather than risk
    // overwriting/conflicting with the carried-over `transform`/`animate`.
    const carriesTransform =
        (gNode as { transform?: unknown }).transform !== undefined ||
        (gNode as { animate?: unknown }).animate !== undefined;

    if (carriesTransform) {
        const inner: PxNode = { type: 'g', transform: offset, children: gNode.children ?? [] } as PxNode;
        gNode.children = [inner];
    } else {
        (gNode as { transform?: string }).transform = offset;
    }
    return gNode;
}
