/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/


/**
 * RETIME (`<use>` timeline remap) — mirrors the editor's
 * `RetimeRenderer.renderRetime`. For every `<use>` that carries `effects.retime`
 * we deep-clone the source named by `retime.baseId` and remap every keyframe
 * time inside the clone by `t' = accum.start + accum.stretch * t` (ms units).
 *
 * Nested chains:
 *
 *     outerUse(retime A) → innerUse(retime B) → leaf
 *
 * are unfolded by chasing the chain via a snapshot of the original retime map
 * (so `<use retime>`s that have already been processed elsewhere in the tree
 * still appear "retimed" from this side). Each link in the chain produces ITS
 * OWN clone, with the accumulated retime applied to its OWN kfs:
 *
 *   - outerUse clones innerUse (kfs remapped by A), then sets its `href` to the
 *     clone id.
 *   - inside that clone, the inner `<use>`'s href is rewritten to a fresh clone
 *     of leaf whose kfs are remapped by `concat(B, A)`.
 *
 * `concatRetime(child, parent) = { start: parent.start + parent.stretch * child.start,
 *                                   stretch: parent.stretch * child.stretch }`
 * (semantic: `parent` is applied OUTSIDE, `child` inside — same as the editor).
 */

import type { PxNode, PxRetimeEffect } from '../PxAnimatorTypes';
import type { ApplyContext } from './types';
import { clone, genId, regenerateIdsInClone } from './util';

interface Retime { start: number; stretch: number; }

const IDENTITY: Retime = { start: 0, stretch: 1 };

function asRetime(r: PxRetimeEffect): Retime {
    return { start: r.start ?? 0, stretch: r.stretch ?? 1 };
}

/** parent is applied OUTSIDE, child INSIDE → `t_global = parent.start + parent.stretch * (child.start + child.stretch * t_local)`. */
function concatRetime(child: Retime, parent: Retime): Retime {
    return {
        start: parent.start + parent.stretch * child.start,
        stretch: parent.stretch * child.stretch,
    };
}

/** Walks `root`, captures every `effects.retime` keyed by node id. The snapshot
 *  is taken BEFORE pass-2 mutates the originals, so when an outer retime needs
 *  to chase through an inner `<use retime>` that's already been processed in
 *  another part of the tree, the chain is still discoverable. */
export function captureRetimeMap(root: PxNode, out: Map<string, PxRetimeEffect>): void {
    if (typeof root.id === 'string' && root.effects?.retime) out.set(root.id, root.effects.retime);
    root.children?.forEach(c => captureRetimeMap(c, out));
}

/** Single-pass driver: walks the tree, applies retime to every `<use>` that
 *  carries `effects.retime`. The retime map snapshot must be taken upstream
 *  (before any modification). */
export function applyAllRetimeEffects(
    root: PxNode,
    retimeMap: Map<string, PxRetimeEffect>,
    ctx: ApplyContext,
): void {
    const walk = (n: PxNode): void => {
        const retime = n.effects?.retime;
        if (retime) {
            delete n.effects!.retime;
            applyRetimeToUse(n, retime, ctx, retimeMap);
        }
        n.children?.forEach(walk);
    };
    walk(root);
}

/**
 * Applies a retime to one `<use>`. Builds a clone of the target (and its retime
 * chain, if any) in `ctx.defs` and rewrites `useNode.href` to point at it.
 */
function applyRetimeToUse(
    useNode: PxNode,
    retime: PxRetimeEffect,
    ctx: ApplyContext,
    retimeMap: Map<string, PxRetimeEffect>,
): void {
    const baseId = retime.baseId;
    if (!baseId) { ctx.errors.push('retime: missing baseId'); return; }

    const target = ctx.idMap.get(baseId);
    if (!target) { ctx.warnings.push('retime: target "' + baseId + '" not found'); return; }

    const accum = asRetime(retime);
    const cloneNode = buildRetimedClone(target, accum, ctx, retimeMap, new Set([baseId]));
    if (cloneNode) useNode.href = '#' + cloneNode.id;
}

/**
 * Returns a fresh clone of `target` with its kfs remapped by `accum`. When the
 * target itself was a `<use>` with `effects.retime` in the original tree (read
 * from `retimeMap`), the clone's `href` is rewritten to a recursively-built
 * inner clone whose accum is `concatRetime(target.retime, accum)`. Otherwise
 * (leaf), the kfs of the clone + its descendants are remapped in place.
 *
 * Loops are detected via `chain` — the set of `baseId`s already being expanded.
 */
function buildRetimedClone(
    target: PxNode,
    accum: Retime,
    ctx: ApplyContext,
    retimeMap: Map<string, PxRetimeEffect>,
    chain: Set<string>,
): PxNode | undefined {
    const cloneNode = clone(target);
    regenerateIdsInClone(cloneNode, ctx);
    const cloneId = genId(ctx, 'retime');
    cloneNode.id = cloneId;

    // Any `effects.retime` on the clone (carried over from the snapshot) is
    // consumed via the chain expansion below — strip it from the clone so the
    // runtime / further passes don't trip on it.
    if (cloneNode.effects?.retime) {
        delete cloneNode.effects.retime;
        if (Object.keys(cloneNode.effects).length === 0) delete cloneNode.effects;
    }

    // If the original target was itself a `<use>` with retime, build the inner
    // clone with the accumulated retime and rewrite this clone's href to it.
    // Otherwise (leaf), remap the clone subtree's kfs by accum.
    const targetOriginalId = typeof target.id === 'string' ? target.id : undefined;
    const targetRetime = targetOriginalId ? retimeMap.get(targetOriginalId) : undefined;
    if (targetRetime?.baseId) {
        if (chain.has(targetRetime.baseId)) {
            ctx.errors.push('retime: loop detected via "' + targetRetime.baseId + '"');
        } else {
            const innerAccum = concatRetime(asRetime(targetRetime), accum);
            const innerTarget = ctx.idMap.get(targetRetime.baseId);
            if (!innerTarget) {
                ctx.warnings.push('retime: target "' + targetRetime.baseId + '" not found');
            } else {
                const innerChain = new Set(chain); innerChain.add(targetRetime.baseId);
                const innerClone = buildRetimedClone(innerTarget, innerAccum, ctx, retimeMap, innerChain);
                if (innerClone) cloneNode.href = '#' + innerClone.id;
            }
        }
        // Remap the clone's OWN body kfs by accum (the intermediate `<use>`'s own
        // animate properties remap at this level; the inner clone holds the
        // recursed-down content with accumulated retime).
        remapKeyframeTimesOnly(cloneNode, accum.start, accum.stretch);
    } else {
        // Leaf — remap the entire clone subtree.
        remapKeyframeTimes(cloneNode, accum.start, accum.stretch);
    }

    ctx.defs.push(cloneNode);
    return cloneNode;
}

/** Remaps every keyframe `time` in the subtree: `t' = start + t·stretch`. */
function remapKeyframeTimes(node: PxNode, start: number, stretch: number): void {
    remapKeyframeTimesOnly(node, start, stretch);
    node.children?.forEach(child => remapKeyframeTimes(child, start, stretch));
}

/** Remaps only the node's OWN kfs (no recursion). Used for intermediate `<use>`
 *  clones — the recursed-into leaf clone is handled separately. */
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
