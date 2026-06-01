/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

/**
 * `<use>` instance materialiser.
 *
 * WAAPI / CSS animations applied to an SVG source element don't reliably
 * render through `<use>` shadow trees in Chrome and Safari — the source
 * animates, the `<use>` shows static. This module fixes that by deep-cloning
 * every animated target into the corresponding `<use>` site (with fresh ids
 * and rewritten internal refs), and replacing the `<use>` with a `<g>` that
 * carries the use's transform/x/y attributes. Both engines (frames + webapi)
 * then animate the cloned nodes directly.
 *
 * Shares the deep-clone + id-regen + ref-rewrite primitives with the retime
 * effect (see `PxNodeCloneUtil`).
 *
 * Immutable: returns the input by reference when no `<use>` needs
 * materialisation; otherwise returns a new tree sharing untouched sub-trees.
 */

import { deepClonePxNode, regenerateIdsAndRewriteRefs } from './PxNodeCloneUtil';
import type { PxNode } from './PxAnimatorTypes';


/**
 * Walks `root`. For every `<use>` whose `href` target subtree contains any
 * `animate` bucket (recursively, following further `<use>` chains and
 * children), replaces the `<use>` with a `<g>` carrying a deep clone of the
 * target. The clone gets a fresh id on every node, and any internal `href` /
 * `url(#…)` refs that pointed at ids inside the cloned subtree are rewritten
 * to the new ids. Refs that point OUTSIDE the cloned subtree (e.g. a sibling
 * gradient) are left untouched.
 *
 * Recursive: if the materialised clone itself contains a `<use>` that needs
 * materialisation, that's handled in the same pass.
 */
export function materialiseAnimatedUseInstances(root: PxNode): PxNode {
    const idMap = buildIdMap(root);
    const animatedIds = computeAnimatedSubtreeIds(root, idMap);
    if (animatedIds.size === 0) return root;

    let idCounter = 0;
    const genId = (): string => '_lw_use_mat_' + (++idCounter);

    return walkAndMaterialise(root, idMap, animatedIds, genId);
}


// ─────────────────────────────────────────────────────────────────────────────
//  Internals
// ─────────────────────────────────────────────────────────────────────────────


function buildIdMap(root: PxNode): Map<string, PxNode> {
    const map = new Map<string, PxNode>();
    const visit = (n: PxNode): void => {
        if (typeof n.id === 'string') map.set(n.id, n);
        n.children?.forEach(visit);
    };
    visit(root);
    return map;
}


/** Returns the set of ids whose subtree (including descendants and any
 *  `<use>`-referenced sub-subtrees) contains at least one `animate` bucket.
 *  Uses a per-walk `visited` set to avoid infinite recursion on `<use>` cycles. */
function computeAnimatedSubtreeIds(root: PxNode, idMap: Map<string, PxNode>): Set<string> {
    const cache = new WeakMap<PxNode, boolean>();
    const result = new Set<string>();

    const hasAnim = (n: PxNode, visiting: Set<PxNode>): boolean => {
        const cached = cache.get(n);
        if (cached !== undefined) return cached;
        if (visiting.has(n)) return false;  // cycle guard
        visiting.add(n);

        let r = false;
        if (n.animate && typeof n.animate === 'object' && !Array.isArray(n.animate)) {
            for (const _ in n.animate) { r = true; break; }
        }
        if (!r && n.children) {
            for (const ch of n.children) {
                if (hasAnim(ch, visiting)) { r = true; break; }
            }
        }
        if (!r && n.type === 'use' && typeof n.href === 'string') {
            const targetId = stripHash(n.href);
            const target = targetId ? idMap.get(targetId) : undefined;
            if (target) r = hasAnim(target, visiting);
        }

        visiting.delete(n);
        cache.set(n, r);
        return r;
    };

    for (const [id, node] of idMap) {
        if (hasAnim(node, new Set())) result.add(id);
    }
    return result;
}


function stripHash(href: unknown): string | undefined {
    if (typeof href !== 'string') return undefined;
    return href.startsWith('#') ? href.slice(1) : href;
}


/** Builds the materialised `<g>` replacement for one `<use>` whose target's
 *  subtree is animated. Carries the use's transform / position attributes. */
function materialiseOneUse(
    useNode: PxNode,
    target: PxNode,
    idMap: Map<string, PxNode>,
    animatedIds: Set<string>,
    genId: () => string,
): PxNode {
    const clone = deepClonePxNode(target);
    regenerateIdsAndRewriteRefs(clone, genId);

    // Recurse into the clone — any nested `<use>` it contains may itself
    // reference an animated subtree and need materialisation.
    const materialisedClone = walkAndMaterialise(clone, idMap, animatedIds, genId);

    // Replace `<use>` with `<g>` wrapping the clone. Keep all of use's own
    // attrs except `href` (now meaningless) — transform / x / y / etc. all
    // continue to apply to the materialised instance.
    const newNode: PxNode = { ...useNode, type: 'g', children: [materialisedClone] };
    delete (newNode as { href?: string }).href;
    return newNode;
}


function walkAndMaterialise(
    node: PxNode,
    idMap: Map<string, PxNode>,
    animatedIds: Set<string>,
    genId: () => string,
): PxNode {
    if (node.type === 'use' && typeof node.href === 'string') {
        const targetId = stripHash(node.href);
        if (targetId && animatedIds.has(targetId)) {
            const target = idMap.get(targetId);
            if (target) return materialiseOneUse(node, target, idMap, animatedIds, genId);
        }
    }

    if (!node.children) return node;
    let changed = false;
    const newChildren = node.children.map(ch => {
        const m = walkAndMaterialise(ch, idMap, animatedIds, genId);
        if (m !== ch) changed = true;
        return m;
    });
    return changed ? { ...node, children: newChildren } : node;
}
