/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/


/**
 * RETIME (`<use>` timeline remap) — runs AFTER every other pass-1 effect has
 * materialised, so the `<use>`'s `href` already points at the right post-pass-1
 * target (e.g. the inner-content layer that `contentRefSplit` produced).
 *
 * Retime lives nested under the merged `clone` effect (`effects.clone.retime`).
 * For every `<use>` carrying it we:
 *   1. follow `useNode.href` (no `sourceId` lookup — the editor-side id wouldn't
 *      resolve in the lightweight tree);
 *   2. recursively materialise the chain target-side, preserving each
 *      intermediate `<use>`'s offset/transform and accumulating retime at every
 *      nested-retime hop (`concatRetime(child, parent)`);
 *   3. wire the chain root into the `<use>` site — see RETIME_MATERIALISATION_MODE.
 *
 * Each chain link becomes its own defs entry with the right accumulated retime
 * applied to ITS OWN kfs, and the link's `href` rewritten to point at the
 * next-level materialisation.
 *
 * NB: `clone.sourceId` is intentionally IGNORED by retime — it carries an
 * upstream core id that does not exist in the lightweight tree; retime
 * follows `href`.
 */

import type { PxNode, PxRetimeEffect } from '../PxAnimatorTypes';
import type { ApplyContext } from './types';
import { applyUseOffsetToG } from '../PxNodeCloneUtil';
import { clone, genId, indexById, regenerateIdsInClone, stripHash } from './util';


/** Mode A (true): replace `<use>` with `<g>` whose child IS the chain-root clone.
 *  Mode B (false): push the chain-root clone into `<defs>`, rewrite `<use>.href`.
 *
 *  Mode B is the default — it preserves the `<use>`'s native semantics (x/y
 *  positioning, width/height — none of which `<g>` interprets). Mode A would
 *  need to bake those into the new `<g>`'s transform to stay equivalent. */
const RETIME_MATERIALISATION_MODE_INLINE_G = false;


interface Retime { start: number; stretch: number; }

function asRetime(r: PxRetimeEffect): Retime {
    // `timeCrop` is declared on the wire schema but not implemented yet —
    // warn instead of silently dropping it so producers notice.
    if (r.timeCrop) {
        console.warn('retime: `timeCrop` is not supported yet and will be ignored');
    }
    return { start: r.start ?? 0, stretch: r.stretch ?? 1 };
}

/** parent applied OUTSIDE, child INSIDE → `t = parent.start + parent.stretch * (child.start + child.stretch * t_local)`. */
function concatRetime(child: Retime, parent: Retime): Retime {
    return {
        start: parent.start + parent.stretch * child.start,
        stretch: parent.stretch * child.stretch,
    };
}

/** Retime lives nested under the `clone` effect (`effects.clone.retime`). */
function readCloneRetime(n: PxNode): PxRetimeEffect | undefined {
    return n.effects?.clone?.retime;
}

/** Removes the retime slice and prunes now-empty `clone` / `effects` buckets. */
function clearCloneRetime(n: PxNode): void {
    const clone = n.effects?.clone;
    if (!clone) return;
    delete clone.retime;
    if (Object.keys(clone).length === 0) delete n.effects!.clone;
    if (n.effects && Object.keys(n.effects).length === 0) delete n.effects;
}


/** Pass-2 driver. Re-indexes ids (pass-1 mints new ones like `_lw_inner_0`),
 *  then materialises retime at every site. Order-independent: each site
 *  recursively expands its own chain via the original retime layout. */
export function applyAllRetimeEffects(root: PxNode, ctx: ApplyContext): void {
    ctx.idMap.clear();
    indexById(root, ctx.idMap);

    const sites: Array<PxNode> = [];
    const collect = (n: PxNode): void => {
        if (readCloneRetime(n)) sites.push(n);
        n.children?.forEach(collect);
    };
    collect(root);

    // OUTER-most sites first. Materialising a site CONSUMES its retime in place (see the
    // load-bearing note below) — so when an outer use's chain later clones a subtree whose
    // inner retimed use was already processed, the inner retime is gone and never composes
    // with the outer one: a doubly-retimed chain started at +inner instead of
    // +inner∘outer. Document order only happens to work when the outer use serialises
    // first; a symbol-heavy document (e.g. one imported from Lottie precomps) puts the
    // template's inner use ahead of the outer site. Order by reachability instead: a site
    // whose chain can reach other sites materialises before them.
    const reachCount = new Map<PxNode, number>();
    for (const site of sites) {
        let count = 0;
        const visited = new Set<string>();
        const walk = (n: PxNode | undefined): void => {
            if (!n) return;
            if (n !== site && readCloneRetime(n)) count++;
            if (n.type === 'use' && n.href) {
                const id = stripHash(n.href);
                if (id && !visited.has(id)) { visited.add(id); walk(ctx.idMap.get(id)); }
            }
            n.children?.forEach(walk);
        };
        const rootId = stripHash(site.href);
        if (rootId) { visited.add(rootId); walk(ctx.idMap.get(rootId)); }
        reachCount.set(site, count);
    }
    // Stable sort: deeper reach first; equal reach keeps document order.
    sites.sort((a, b) => (reachCount.get(b) ?? 0) - (reachCount.get(a) ?? 0));

    for (const useNode of sites) {
        const retime = readCloneRetime(useNode);
        if (!retime) continue;
        // Per-site delete is LOAD-BEARING, not just cleanup: once this use is
        // materialised its `href` is rewritten to an already-time-shifted clone, so
        // a downstream use that references THIS one must NOT re-compose this retime
        // (buildChainClone reads `target`'s clone.retime). Deleting it here makes
        // that read return undefined → no double-count. Moving cleanup to a single
        // end-of-pipeline strip regresses nested retime to +750 instead of +500.
        clearCloneRetime(useNode);
        materialiseRetime(useNode, asRetime(retime), ctx);
    }
}


/** Materialises `retime` on `useNode` by cloning the chain rooted at
 *  `useNode.href` and wiring the clone into the `<use>` site. */
function materialiseRetime(useNode: PxNode, retime: Retime, ctx: ApplyContext): void {
    const targetId = stripHash(useNode.href);
    if (!targetId) { ctx.errors.push('retime: <use> has no href to follow'); return; }

    const chainRootId = buildChainClone(targetId, retime, ctx, new Set());
    if (!chainRootId) return;

    if (RETIME_MATERIALISATION_MODE_INLINE_G) {
        const cloneNode = ctx.idMap.get(chainRootId)!;
        useNode.type = 'g';
        delete useNode.href;
        useNode.children = [cloneNode];
        // `<g>` ignores `x`/`y`; preserve the use's position offset as a
        // `translate(x,y)` applied AFTER any transform (nested inner `<g>`).
        applyUseOffsetToG(useNode);
        ctx.defs = ctx.defs.filter(d => d !== cloneNode);  // un-defs it since it's inline now
    } else {
        useNode.href = '#' + chainRootId;
    }
}


/** Clones `targetId`'s node, remaps its OWN kfs by `accum`, then — if the target
 *  is a `<use>` — recursively materialises ITS target (folding any nested retime
 *  into accum via `concatRetime`). Returns the clone's new id, or undefined on
 *  dangling refs / loops. The clone is pushed to `ctx.defs` and indexed in
 *  `ctx.idMap` so siblings can resolve it. */
function buildChainClone(targetId: string, accum: Retime, ctx: ApplyContext, chain: Set<string>): string | undefined {
    if (chain.has(targetId)) { ctx.errors.push('retime: loop via "' + targetId + '"'); return undefined; }
    const target = ctx.idMap.get(targetId);
    if (!target) { ctx.warnings.push('retime: target "' + targetId + '" not found'); return undefined; }

    const cloneNode = clone(target);
    regenerateIdsInClone(cloneNode, ctx);

    // Clone's OWN body kfs (intermediate-use's animated transform, ball's animation, …).
    // For a use, this is usually a no-op (no kfs on the use itself); for a leaf it
    // remaps the entire reachable subtree.
    if (target.type === 'use') {
        remapKeyframeTimesOnly(cloneNode, accum.start, accum.stretch);
    } else {
        remapKeyframeTimes(cloneNode, accum.start, accum.stretch);
    }

    // Strip any retime carried into the clone (already consumed via the chain).
    clearCloneRetime(cloneNode);

    // If the target is a `<use>`, recurse on ITS href. Nested retime on the
    // intermediate use folds in via concat.
    if (target.type === 'use' && target.href) {
        const subId = stripHash(target.href);
        if (subId) {
            const innerRetime = readCloneRetime(target);
            const subAccum = innerRetime ? concatRetime(asRetime(innerRetime), accum) : accum;
            const subChain = new Set(chain); subChain.add(targetId);
            const subId2 = buildChainClone(subId, subAccum, ctx, subChain);
            if (subId2) cloneNode.href = '#' + subId2;
        }
    } else {
        // Container target (e.g. a content-ref split wrapper) may HOLD nested
        // `<use>` children that themselves carry retime — the nested content-ref
        // case `use → <g> → use(retime) → …`. Those uses aren't in the pass-2
        // site list (they only exist inside this fresh clone), so materialise
        // them here, composing their retime with `accum` (recurse into children).
        // Without this the inner use's retime stays dangling and the subtree
        // renders un-shifted.
        materialiseNestedRetimeUses(cloneNode, accum, ctx, chain, targetId);
    }

    ctx.defs.push(cloneNode);
    if (typeof cloneNode.id === 'string') ctx.idMap.set(cloneNode.id, cloneNode);
    return typeof cloneNode.id === 'string' ? cloneNode.id : undefined;
}


/** Walks a freshly-cloned container subtree and materialises every nested
 *  `<use>` that carries retime: composes its retime with `accum` and rewires its
 *  href to a fresh chain clone (then drops the now-consumed retime). The
 *  container analogue of `buildChainClone`'s use-target recursion — needed for
 *  nested content-ref retime where the inner `<use retime>` lives INSIDE the
 *  cloned wrapper rather than at its href root. */
function materialiseNestedRetimeUses(node: PxNode, accum: Retime, ctx: ApplyContext, chain: Set<string>, parentTargetId: string): void {
    const visit = (n: PxNode): void => {
        const retime = readCloneRetime(n);
        if (n.type === 'use' && retime && n.href) {
            const subId = stripHash(n.href);
            if (subId) {
                const subAccum = concatRetime(asRetime(retime), accum);
                const subChain = new Set(chain); subChain.add(parentTargetId);
                const subId2 = buildChainClone(subId, subAccum, ctx, subChain);
                if (subId2) n.href = '#' + subId2;
            }
            clearCloneRetime(n);
        }
        n.children?.forEach(visit);
    };
    visit(node);
}


/** Remaps every keyframe `time` in `node` and its subtree: `t' = start + t·stretch`. */
function remapKeyframeTimes(node: PxNode, start: number, stretch: number): void {
    remapKeyframeTimesOnly(node, start, stretch);
    node.children?.forEach(c => remapKeyframeTimes(c, start, stretch));
}

function remapKeyframeTimesOnly(node: PxNode, start: number, stretch: number): void {
    const remap = (kfs: Array<any>): void => {
        for (const kf of kfs) if (typeof kf.time === 'number') kf.time = start + kf.time * stretch;
    };
    if (node.transform && typeof node.transform === 'object' && Array.isArray((node.transform as any).keyframes)) {
        remap((node.transform as any).keyframes);
    }
    if (node.animate && typeof node.animate === 'object') {
        for (const prop of Object.keys(node.animate)) {
            const anim = (node.animate as any)[prop];
            if (anim && Array.isArray(anim.keyframes)) remap(anim.keyframes);
        }
    }
}
