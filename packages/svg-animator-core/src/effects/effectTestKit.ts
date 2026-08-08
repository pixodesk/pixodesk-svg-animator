/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// Shared helpers for the per-effect pure-JSON in/out tests (`*.test.ts` next to
// each effect). Each effect is a transformer `outJson = applyPlayerEffects(inJson)`
// — we put a single effect bucket on an input node, run the real driver, then
// assert the materialised tree. NOT a test file (no `.test` suffix) so vitest
// skips it and tsup never bundles it (entry is index.ts only).

import { applyPlayerEffects } from './PlayerEffectsUtil';
import { materialiseAllInTree } from '../PxAnimatorMaterialiseAll';
import { PxAnimatorEngine } from '../PxAnimatorConstants';
import type { PxAnimatedSvgDocument, PxNode } from '../PxAnimatorTypes';

export { PxAnimatorEngine };

/** Run the real player-effect pipeline; throw on any materialisation error. */
export function materialise(input: PxNode): PxNode {
    const { root, errors } = applyPlayerEffects(input);
    if (errors.length) throw new Error('applyPlayerEffects errors:\n' + errors.join('\n'));
    return root;
}

/**
 * Run the FULL engine-aware pipeline (`materialiseAllInTree`): effects + loop
 * expansion, plus the `waapi`-only stages (motion-path flatten + animated-`<use>`
 * inline). Use this to test behaviour that DIFFERS between `waapi` and `frames`
 * — the plain {@link materialise} (effects only) is engine-agnostic.
 */
export function materialiseEngine(input: PxNode, engine: PxAnimatorEngine): PxNode {
    return materialiseAllInTree(input as PxAnimatedSvgDocument, engine) as unknown as PxNode;
}

/** Same as {@link materialise} but returns warnings/errors too (for negative tests). */
export function materialiseRaw(input: PxNode): ReturnType<typeof applyPlayerEffects> {
    return applyPlayerEffects(input);
}

/**
 * Snapshot-normaliser → returns a STRING (not an object) so we control key order:
 * `children` is always emitted LAST (the default object snapshot sorts keys
 * alphabetically, which buries `children` at the top). Also replaces auto-allocated
 * `_lw_*` ids with stable `__GEN_N__` slugs (rewriting `#…`/`url(#…)` refs to match)
 * and collapses each node's `animate` to a single-line JSON string.
 */
export function normaliseGeneratedIds(tree: PxNode): string {
    const cloned: PxNode = JSON.parse(JSON.stringify(tree));
    const map = new Map<string, string>();
    let counter = 0;
    const alloc = (id: string): string => {
        const existing = map.get(id);
        if (existing !== undefined) return existing;
        const slug = '__GEN_' + (counter++) + '__';
        map.set(id, slug);
        return slug;
    };
    const walkAssign = (n: PxNode): void => {
        if (typeof n.id === 'string' && n.id.startsWith('_lw_')) n.id = alloc(n.id);
        n.children?.forEach(walkAssign);
    };
    walkAssign(cloned);
    const rewriteUrl = (s: string): string => s.replace(/url\(#([^)]+)\)/g, (m, id) => {
        const mapped = map.get(id);
        return mapped ? 'url(#' + mapped + ')' : m;
    });
    const walkRewrite = (n: PxNode): void => {
        if (typeof n.href === 'string' && n.href.startsWith('#')) {
            const mapped = map.get(n.href.slice(1));
            if (mapped) n.href = '#' + mapped;
        }
        for (const k of Object.keys(n)) {
            if (k === 'children' || k === 'effects' || k === 'meta' || k === 'id' || k === 'href' || k === 'animate') continue;
            const v = (n as any)[k];
            if (typeof v === 'string' && v.indexOf('url(#') !== -1) (n as any)[k] = rewriteUrl(v);
        }
        // Compact `animate` to one line (keyframe arrays otherwise explode).
        if (n.animate) (n as any).animate = JSON.stringify(n.animate);
        n.children?.forEach(walkRewrite);
    };
    walkRewrite(cloned);
    // JSON.stringify preserves INSERTION order → rebuild every node with non-`children`
    // keys sorted (stable) and `children` appended last, then serialise.
    return JSON.stringify(childrenLast(cloned), null, 2);
}

/** Recursively rebuilds objects so `children` is the last key (other keys sorted). */
function childrenLast(v: any): any {
    if (Array.isArray(v)) return v.map(childrenLast);
    if (v && typeof v === 'object') {
        const out: any = {};
        for (const k of Object.keys(v).filter(k => k !== 'children').sort()) out[k] = childrenLast(v[k]);
        if ('children' in v) out.children = childrenLast(v.children);
        return out;
    }
    return v;
}

/** Every node in the tree, pre-order. */
export function flatten(root: PxNode): Array<PxNode> {
    const out: Array<PxNode> = [];
    const walk = (n: PxNode): void => { out.push(n); n.children?.forEach(walk); };
    walk(root);
    return out;
}

/** All nodes of a given `type` (e.g. 'g', 'use', 'mask', 'linearGradient'). */
export function collectByType(root: PxNode, type: string): Array<PxNode> {
    return flatten(root).filter(n => n.type === type);
}

/** Count nodes matching a predicate. */
export function countNodes(root: PxNode, pred: (n: PxNode) => boolean): number {
    return flatten(root).filter(pred).length;
}

/** Every transform-keyframe `time` array in the tree (one per animated element),
 *  sorted for stable compare — the smoking gun for retime / repeater kf shifts. */
export function transformKfTimes(root: PxNode): Array<Array<number>> {
    const out: Array<Array<number>> = [];
    for (const n of flatten(root)) {
        const kfs = (n.animate as any)?.transform?.keyframes;
        if (Array.isArray(kfs)) out.push(kfs.map((k: any) => k.time));
    }
    return out.sort((a, b) => (a[0] - b[0]) || ((a[1] ?? 0) - (b[1] ?? 0)));
}

/** Nodes that STILL carry `effects.<key>` after materialisation (should be 0 —
 *  every applied effect must be consumed, never left dangling on the wire). */
export function danglingEffectCount(root: PxNode, key: string): number {
    return countNodes(root, n => !!(n.effects as any)?.[key]);
}

/** True if every effect bucket was consumed (no node has a non-empty `effects`). */
export function noEffectsRemain(root: PxNode): boolean {
    return countNodes(root, n => !!n.effects && Object.keys(n.effects).length > 0) === 0;
}
