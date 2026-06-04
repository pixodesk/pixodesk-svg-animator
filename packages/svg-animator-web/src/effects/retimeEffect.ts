/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/


/**
 * RETIME (`<use>` timeline remap) — runs AFTER every other pass-1 effect has
 * materialised, so the `<use>`'s `href` already points at the right post-pass-1
 * target (e.g. the inner-content layer that `contentRefSplit` produced).
 *
 * For every `<use>` carrying `effects.retime` we:
 *   1. follow `useNode.href` (no `baseId` lookup — the editor-side id wouldn't
 *      resolve in the lightweight tree);
 *   2. recursively materialise the chain target-side, preserving each
 *      intermediate `<use>`'s offset/transform and accumulating retime at every
 *      nested-retime hop (`concatRetime(child, parent)`);
 *   3. wire the chain root into the `<use>` site — see RETIME_MATERIALISATION_MODE.
 *
 * Mirrors the editor's `RetimeRenderer.renderRetime`: each chain link becomes
 * its own defs entry with the right accumulated retime applied to ITS OWN kfs,
 * and the link's `href` rewritten to point at the next-level materialisation.
 *
 * NB: `effects.retime.baseId` is intentionally IGNORED — it carries an
 * editor-side core id that does not exist in the lightweight tree.
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
    return { start: r.start ?? 0, stretch: r.stretch ?? 1 };
}

/** parent applied OUTSIDE, child INSIDE → `t = parent.start + parent.stretch * (child.start + child.stretch * t_local)`. */
function concatRetime(child: Retime, parent: Retime): Retime {
    return {
        start: parent.start + parent.stretch * child.start,
        stretch: parent.stretch * child.stretch,
    };
}


/** Pass-2 driver. Re-indexes ids (pass-1 mints new ones like `_lw_inner_0`),
 *  then materialises retime at every site. Order-independent: each site
 *  recursively expands its own chain via the original retime layout. */
export function applyAllRetimeEffects(root: PxNode, ctx: ApplyContext): void {
    ctx.idMap.clear();
    indexById(root, ctx.idMap);

    const sites: Array<PxNode> = [];
    const collect = (n: PxNode): void => {
        if (n.effects?.retime) sites.push(n);
        n.children?.forEach(collect);
    };
    collect(root);

    for (const useNode of sites) {
        const retime = useNode.effects?.retime;
        if (!retime) continue;
        delete useNode.effects!.retime;
        if (Object.keys(useNode.effects!).length === 0) delete useNode.effects;
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
    if (cloneNode.effects?.retime) {
        delete cloneNode.effects.retime;
        if (Object.keys(cloneNode.effects).length === 0) delete cloneNode.effects;
    }

    // If the target is a `<use>`, recurse on ITS href. Nested retime on the
    // intermediate use folds in via concat.
    if (target.type === 'use' && target.href) {
        const subId = stripHash(target.href);
        if (subId) {
            const innerRetime = target.effects?.retime;
            const subAccum = innerRetime ? concatRetime(asRetime(innerRetime), accum) : accum;
            const subChain = new Set(chain); subChain.add(targetId);
            const subId2 = buildChainClone(subId, subAccum, ctx, subChain);
            if (subId2) cloneNode.href = '#' + subId2;
        }
    }

    ctx.defs.push(cloneNode);
    if (typeof cloneNode.id === 'string') ctx.idMap.set(cloneNode.id, cloneNode);
    return typeof cloneNode.id === 'string' ? cloneNode.id : undefined;
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
