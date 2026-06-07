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

import { applyUseOffsetToG, deepClonePxNode, regenerateIdsAndRewriteRefs } from './PxNodeCloneUtil';
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

    // The use's default width/height resolves against its viewport (= the
    // root `<svg>`). We snapshot the root's viewBox dimensions once so the
    // symbol-rewrite below can compute the viewBox-to-use-viewport scaling
    // without re-walking the tree for each use.
    const rootViewport = readRootViewport(root);

    // Collects clipPath / other defs minted by the symbol-rewrite path. After
    // the walk completes, these are spliced into the root tree's `<defs>`.
    const defsCollector: Array<PxNode> = [];
    const walked = walkAndMaterialise(root, idMap, animatedIds, genId, defsCollector, rootViewport);
    if (defsCollector.length === 0) return walked;

    // Append a `<defs>` child carrying every collected def. Browsers honour
    // multiple `<defs>` on the same SVG root, so we don't need to splice into
    // an existing one (which would also be more invasive — defs may have been
    // shared by reference with the original tree).
    const defsNode: PxNode = { type: 'defs', children: defsCollector };
    const newChildren = [...(walked.children ?? []), defsNode];
    return { ...walked, children: newChildren };
}


/** Reads the root `<svg>`'s effective viewport dimensions. Used as the
 *  default for `<use>` width/height (which default to 100% of viewport per
 *  SVG spec). Tries `viewBox` first (the typical authored shape from our
 *  serialiser), then falls back to explicit `width`/`height` attrs. */
function readRootViewport(root: PxNode): [number, number] {
    const vb = parseViewBox((root as { viewBox?: unknown }).viewBox);
    if (vb) return [vb[2], vb[3]];
    const w = numericAttr((root as { width?: unknown }).width);
    const h = numericAttr((root as { height?: unknown }).height);
    if (w !== undefined && h !== undefined) return [w, h];
    // No info — fall back to a 1:1 viewport so the scale degrades to "identity
    // along the limiting axis" (= the historical no-scale behaviour). Better
    // than NaN; the failing case is "root has no viewport info at all".
    return [1, 1];
}

function numericAttr(v: unknown): number | undefined {
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
        // Strip a trailing `px` or `%` — for percentages we don't have an
        // outer container to resolve against, so we treat the raw number as
        // the absolute size (correct when the user only authored a viewBox
        // and width/height match it).
        const n = parseFloat(v);
        return Number.isFinite(n) ? n : undefined;
    }
    return undefined;
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
    rootViewport: [number, number],
): PxNode {
    const clone = deepClonePxNode(target);
    regenerateIdsAndRewriteRefs(clone, genId);

    // Use's effective width/height — explicit attrs if set; else 100% of the
    // root viewport per the SVG spec default for `<use>` on a symbol with
    // viewBox. Needed by `rewriteSymbolRootToGroup` to compute the
    // viewBox-to-viewport scaling.
    const useW = numericAttr((useNode as { width?: unknown }).width) ?? rootViewport[0];
    const useH = numericAttr((useNode as { height?: unknown }).height) ?? rootViewport[1];

    // `<symbol>` is invisible unless instantiated by `<use>` — a bare clone
    // of it inside our wrapping `<g>` would render nothing. Rewrite the
    // clone-root `<symbol>` into a `<g>` carrying the symbol's viewBox-derived
    // transform + clip (mirroring the browser's `<use href="#symbol">`
    // viewport mapping). Any clipPath defs created go into `defsCollector`.
    const rewrittenClone = clone.type === 'symbol'
        ? rewriteSymbolRootToGroup(clone, genId, defsCollector, useW, useH)
        : clone;

    // Recurse into the clone — any nested `<use>` it contains may itself
    // reference an animated subtree and need materialisation.
    const materialisedClone = walkAndMaterialise(rewrittenClone, idMap, animatedIds, genId, defsCollector, rootViewport);

    // Replace `<use>` with `<g>` wrapping the clone. Keep all of use's own
    // attrs except `href` (now meaningless). `<g>` has no `x`/`y`, so the use's
    // position offset is converted to a `translate(x,y)` (applied AFTER any
    // transform — see `applyUseOffsetToG`) rather than silently dropped.
    const newNode: PxNode = { ...useNode, type: 'g', children: [materialisedClone] };
    delete (newNode as { href?: string }).href;
    // The viewport-mapping `<g>` we just emitted on the clone root already
    // carries its own width/height-derived scale/translate. Drop the use's
    // own `width`/`height` so they don't appear on the outer `<g>` (where
    // they'd be ignored anyway — `<g>` has no width/height — but emitting
    // them as attributes would be misleading).
    delete (newNode as { width?: unknown }).width;
    delete (newNode as { height?: unknown }).height;
    return applyUseOffsetToG(newNode);
}


/** `<symbol>` doesn't render directly. To keep the visual result when a
 *  cloned `<symbol>` lands as the root of a materialised `<use>` target, we
 *  rewrite it into a `<g>` whose transform + clip mirror the browser's
 *  `<use href="#symbol-with-viewBox">` viewport mapping:
 *
 *  - `transform = "translate(xOff, yOff) scale(s) translate(-vbX, -vbY)"`
 *    where `s` and the centering offsets are derived from the symbol's
 *    `viewBox` and the use's effective width/height per `preserveAspectRatio`
 *    (default `xMidYMid meet`). Without the scale the clone renders at 1:1
 *    in symbol coords, which doesn't match `<use>`'s natural behaviour.
 *  - `clipPath = "url(#<fresh-id>)"` referencing a `<rect>` matching the
 *    viewBox extent (in symbol coords). With the surrounding transform
 *    above the clip rect maps to the visible viewport area, matching how
 *    `<symbol>` viewport clipping works.
 *
 *  Symbols without a `viewBox` rewrite to a plain `<g>` — no viewport
 *  mapping to preserve.
 *
 *  The created clipPath defs are appended to `defsCollector`; the caller
 *  splices them into the root tree once materialisation finishes.
 */
function rewriteSymbolRootToGroup(
    symbolNode: PxNode,
    genId: () => string,
    defsCollector: Array<PxNode>,
    useW: number,
    useH: number,
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
    // `xMidYMid meet` (SVG default) — uniform scale, fit the longer axis;
    // center the shorter axis. Mirrors what the browser does on `<use>` for
    // a symbol-with-viewBox without an explicit preserveAspectRatio override.
    const scale = vbW > 0 && vbH > 0 ? Math.min(useW / vbW, useH / vbH) : 1;
    const xOff = (useW - vbW * scale) / 2;
    const yOff = (useH - vbH * scale) / 2;

    const parts: Array<string> = [];
    if (xOff !== 0 || yOff !== 0) parts.push('translate(' + xOff + ',' + yOff + ')');
    if (scale !== 1) parts.push('scale(' + scale + ')');
    if (vbX !== 0 || vbY !== 0) parts.push('translate(' + (-vbX) + ',' + (-vbY) + ')');
    if (parts.length) (g as { transform?: string }).transform = parts.join('');

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
    rootViewport: [number, number],
): PxNode {
    if (node.type === 'use' && typeof node.href === 'string') {
        const targetId = stripHash(node.href);
        if (targetId && animatedIds.has(targetId)) {
            const target = idMap.get(targetId);
            if (target) return materialiseOneUse(node, target, idMap, animatedIds, genId, defsCollector, rootViewport);
        }
    }

    if (!node.children) return node;
    let changed = false;
    const newChildren = node.children.map(ch => {
        const m = walkAndMaterialise(ch, idMap, animatedIds, genId, defsCollector, rootViewport);
        if (m !== ch) changed = true;
        return m;
    });
    return changed ? { ...node, children: newChildren } : node;
}
