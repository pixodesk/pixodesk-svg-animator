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

    // Collects clipPath / other defs minted by the symbol-rewrite path. After
    // the walk completes, these are spliced into the root tree's `<defs>`.
    const defsCollector: Array<PxNode> = [];
    const walked = walkAndMaterialise(root, idMap, animatedIds, genId, defsCollector);
    if (defsCollector.length === 0) return walked;

    // Append a `<defs>` child carrying every collected def. Browsers honour
    // multiple `<defs>` on the same SVG root, so we don't need to splice into
    // an existing one (which would also be more invasive — defs may have been
    // shared by reference with the original tree).
    const defsNode: PxNode = { type: 'defs', children: defsCollector };
    const newChildren = [...(walked.children ?? []), defsNode];
    return { ...walked, children: newChildren };
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
    defsCollector: Array<PxNode>,
): PxNode {
    const clone = deepClonePxNode(target);
    regenerateIdsAndRewriteRefs(clone, genId);

    // `<symbol>` is invisible unless instantiated by `<use>` — a bare clone
    // of it inside our wrapping `<g>` would render nothing. Rewrite the
    // clone-root `<symbol>` into a `<g>` carrying the symbol's viewBox-derived
    // transform + clip (mirroring the browser's `<use href="#symbol">`
    // viewport mapping). Any clipPath defs created go into `defsCollector`.
    const rewrittenClone = clone.type === 'symbol'
        ? rewriteSymbolRootToGroup(clone, genId, defsCollector)
        : clone;

    // Recurse into the clone — any nested `<use>` it contains may itself
    // reference an animated subtree and need materialisation.
    const materialisedClone = walkAndMaterialise(rewrittenClone, idMap, animatedIds, genId, defsCollector);

    // Replace `<use>` with `<g>` wrapping the clone. Keep all of use's own
    // attrs except `href` (now meaningless) — transform / x / y / etc. all
    // continue to apply to the materialised instance.
    const newNode: PxNode = { ...useNode, type: 'g', children: [materialisedClone] };
    delete (newNode as { href?: string }).href;
    return newNode;
}


/** `<symbol>` doesn't render directly. To keep the visual result when a
 *  cloned `<symbol>` lands as the root of a materialised `<use>` target, we
 *  rewrite it as a `<g>` that mirrors the browser's symbol viewport mapping:
 *
 *    - `transform = "translate(-vbX, -vbY)"` so the symbol's local origin
 *      aligns with the use's anchor (use defaults to x=y=0). For symbols with
 *      no viewBox, no transform is needed.
 *    - `clipPath = "url(#<fresh-id>)"` referencing a freshly-built clipPath
 *      in defs whose `<rect>` matches the viewBox rectangle, so content
 *      outside the viewBox is hidden (same as the browser's symbol clipping).
 *
 *  The created clipPath defs are appended to `defsCollector`; the caller is
 *  responsible for splicing them into the root tree once materialisation has
 *  finished. */
function rewriteSymbolRootToGroup(
    symbolNode: PxNode,
    genId: () => string,
    defsCollector: Array<PxNode>,
): PxNode {
    const viewBox = parseViewBox((symbolNode as { viewBox?: unknown }).viewBox);
    const g: PxNode = { ...symbolNode, type: 'g' };
    // Strip symbol-only attributes that don't belong on `<g>`.
    delete (g as { viewBox?: unknown }).viewBox;
    delete (g as { preserveAspectRatio?: unknown }).preserveAspectRatio;
    delete (g as { width?: unknown }).width;
    delete (g as { height?: unknown }).height;

    if (!viewBox) return g;  // no viewBox → no transform / clip required

    const [vbX, vbY, vbW, vbH] = viewBox;
    if (vbX !== 0 || vbY !== 0) {
        (g as { transform?: string }).transform = 'translate(' + (-vbX) + ',' + (-vbY) + ')';
    }
    const clipId = genId();
    defsCollector.push({
        type: 'clipPath',
        id: clipId,
        children: [{ type: 'rect', x: vbX, y: vbY, width: vbW, height: vbH }],
    } as PxNode);
    (g as { clipPath?: string }).clipPath = 'url(#' + clipId + ')';
    return g;
}


function parseViewBox(v: unknown): [number, number, number, number] | undefined {
    if (typeof v !== 'string') return undefined;
    const parts = v.trim().split(/[\s,]+/).map(Number);
    if (parts.length < 4 || parts.some(n => !Number.isFinite(n))) return undefined;
    return [parts[0], parts[1], parts[2], parts[3]];
}


function walkAndMaterialise(
    node: PxNode,
    idMap: Map<string, PxNode>,
    animatedIds: Set<string>,
    genId: () => string,
    defsCollector: Array<PxNode>,
): PxNode {
    if (node.type === 'use' && typeof node.href === 'string') {
        const targetId = stripHash(node.href);
        if (targetId && animatedIds.has(targetId)) {
            const target = idMap.get(targetId);
            if (target) return materialiseOneUse(node, target, idMap, animatedIds, genId, defsCollector);
        }
    }

    if (!node.children) return node;
    let changed = false;
    const newChildren = node.children.map(ch => {
        const m = walkAndMaterialise(ch, idMap, animatedIds, genId, defsCollector);
        if (m !== ch) changed = true;
        return m;
    });
    return changed ? { ...node, children: newChildren } : node;
}
