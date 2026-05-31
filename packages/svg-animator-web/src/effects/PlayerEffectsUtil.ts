/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/


/**
 * Lightweight, dependency-free applier for "player-effects" SVGA JSON.
 *
 * Input: the JSON produced by `SvgaJsonWithPlayerEffectsSerialisationUtil`, where
 * structure-creating effects are left UN-applied on `node.effects`. This module
 * reads those effects and MATERIALISES them into a plain node tree (extra `<g>`
 * wrappers, copies, mask defs) that renders identically to the heavy editor path.
 *
 * Design goals (intentional): minimal, transparent, no merging/optimisation. It
 * is fine to emit more nodes than strictly necessary — the only contract is "same
 * result on screen". Each effect lives in its own file; this module only wires
 * them into the recursion. Nothing here imports outside `effects/`, so the whole
 * folder can move into the Player codebase verbatim.
 */

import { identifyContentRefTargets, splitForContentRef } from './contentRefSplit';
import { applyMaskedByEffect, collectMaskAncestorChains } from './maskedByEffect';
import { applyRefAndTransformationEffect } from './refEffect';
import { applyRepeaterEffect } from './repeaterEffect';
import { applyAllRetimeEffects, captureRetimeMap } from './retimeEffect';
import { applyTrimPathEffect } from './trimPathEffect';
import type { PxNode, PxRetimeEffect } from '../PxAnimatorTypes';
import type { ApplyContext, ApplyResult } from './types';
import { clone, genId, indexById, spliceDefs } from './util';

export type { PxNode } from '../PxAnimatorTypes';
export type { ApplyResult } from './types';


/**
 * Applies all player-effects in `root` and returns a materialised copy plus any
 * generated <defs> nodes, warnings and errors. `root` is not mutated.
 *
 * Two passes:
 *  1. `applyPlayerEffects_exceptRetime` — materialises every effect except retime.
 *  2. `applyPlayerEffects_retime` — applies retime, cloning the NOW-materialised
 *     subtrees so retimed `<use>`s see the same wrappers/animations the heavy
 *     editor path would produce.
 *
 * Pre-pass identifies every element that is the target of a `<use>` with
 * `ref:{type:'content'}` and allocates a fresh "inner" id for it; pass 1 then
 * splits those sources into outer-translate + inner-content layers so the use
 * can target the inner layer (mirrors the editor's heavy materialisation).
 */
export function applyPlayerEffects(root: PxNode): ApplyResult {
    const ctx: ApplyContext = {
        defs: [], warnings: [], errors: [],
        idMap: new Map(), nextId: 0,
        contentRefInnerIds: new Map(),
        maskAncestorChains: new Map(),
    };

    const working = clone(root);
    indexById(working, ctx.idMap);
    identifyContentRefTargets(working, ctx, () => genId(ctx, 'inner'));
    collectMaskAncestorChains(working, ctx);

    // Snapshot retime markers BEFORE pass-1 / pass-2 mutate them. Lets pass 2
    // chase nested `<use retime> → <use retime> → leaf` chains via the original
    // (pre-mutation) retime layout regardless of traversal order.
    const retimeMap = new Map<string, PxRetimeEffect>();
    captureRetimeMap(working, retimeMap);

    const afterPass1 = applyPlayerEffects_exceptRetime(working, ctx);
    const out = applyPlayerEffects_retime(afterPass1, ctx, retimeMap);
    spliceDefs(out, ctx.defs);

    return { root: out, defs: ctx.defs, warnings: ctx.warnings, errors: ctx.errors };
}

/**
 * Pass 1 — materialise every effect except retime. Retime is preserved on the
 * original (now wrapped-inner) node so pass 2 can find and apply it.
 *
 * After wrapping, the outer-most wrapper for a node with `originalId` is written
 * back into `ctx.idMap` so retime's clone target picks up the FULL materialised
 * subtree, not the bare un-wrapped original.
 *
 * If the node is a content-ref target, `splitForContentRef` re-shapes the
 * materialised result into outer-translate + inner-rest layers — the outer keeps
 * the original id, the inner gets the pre-allocated inner id so the `<use>` can
 * target it.
 */
function applyPlayerEffects_exceptRetime(node: PxNode, ctx: ApplyContext): PxNode {
    if (node.children) node.children = node.children.map(child => applyPlayerEffects_exceptRetime(child, ctx));

    const fx = node.effects;
    const originalId = typeof node.id === 'string' ? node.id : undefined;
    const innerIdForContentRef = originalId ? ctx.contentRefInnerIds.get(originalId) : undefined;

    if (!fx && !innerIdForContentRef) return node;

    const { transformation, repeater, maskedBy, trimPath, retime, ref } = fx ?? {};
    const isCombinedShape = fx?.isCombinedShape;
    if (fx) delete node.effects;

    let n = node;
    n = applyTrimPathEffect(n, trimPath, isCombinedShape, ctx);         // innermost
    n = applyRepeaterEffect(n, repeater, ctx);
    n = applyMaskedByEffect(n, maskedBy, transformation, ctx);          // mask sits on inner element

    if (innerIdForContentRef) {
        // Source of a content-ref `<use>`: split into outer-translate + inner-rest +
        // bare element so the use can target the inner layer.
        n = splitForContentRef(n, transformation, originalId!, innerIdForContentRef, ctx);
    } else {
        n = applyRefAndTransformationEffect(n, ref, transformation, ctx);
    }

    if (retime) node.effects = { retime };                              // hand off to pass 2
    if (originalId) ctx.idMap.set(originalId, n);                       // outer wrapper is the clone target
    return n;
}

/** Pass 2 — apply retime to every node that carries it. The chain-aware
 *  recursion lives in `retimeEffect.ts`; here we just hand it the snapshot. */
function applyPlayerEffects_retime(node: PxNode, ctx: ApplyContext, retimeMap: Map<string, PxRetimeEffect>): PxNode {
    applyAllRetimeEffects(node, retimeMap, ctx);
    return node;
}
