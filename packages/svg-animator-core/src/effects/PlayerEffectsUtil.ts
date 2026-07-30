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
import { applyFillGradientEffect, applyStrokeGradientEffect } from './gradientEffect';
import { applyClipPathEffect } from './clipPathEffect';
import { applyMaskedByEffect, collectMaskAncestorChains } from './maskedByEffect';
import { applyRefAndTransformationEffect, applyRefHref } from './refEffect';
import { applyRepeaterEffect } from './repeaterEffect';
import { applyAllRetimeEffects } from './retimeEffect';
import { applyTextPathEffect } from './textPathEffect';
import { applyTextGlyphsAlongPath, applyTextGlyphsEffect } from './textGlyphsEffect';
import { applyTrimPathEffect } from './trimPathEffect';
import { getAnimatorConfig, getDefs, PxAnimatorEngine, PxAnimatorMode } from '../PxAnimatorTypes';
import type { PxNode } from '../PxAnimatorTypes';
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
 * can target the inner layer.
 */
export function applyPlayerEffects(root: PxNode): ApplyResult {
    const ctx: ApplyContext = {
        defs: [], warnings: [], errors: [],
        idMap: new Map(), nextId: 0,
        contentRefInnerIds: new Map(),
        maskAncestorChains: new Map(),
        // Resolved engine: `frames` ONLY when explicitly set; auto/webapi/unset →
        // webapi (we're not 100% sure it's frames, and CSS/WAAPI need the inline form).
        engine: getAnimatorConfig(root)?.mode === PxAnimatorMode.frames
            ? PxAnimatorEngine.frames
            : PxAnimatorEngine.webapi,
        glyphs: getDefs(root)?.glyphs,
    };

    const working = clone(root);
    indexById(working, ctx.idMap);
    identifyContentRefTargets(working, ctx, () => genId(ctx, 'inner'));
    collectMaskAncestorChains(working, ctx);

    const afterPass1 = applyPlayerEffects_exceptRetime(working, ctx);
    const out = applyPlayerEffects_retime(afterPass1, ctx);
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

    const { transformation, repeater, maskedBy, clipPath, trimPath, clone: cloneFx, fillGradient, strokeGradient, textPath, text } = fx ?? {};
    const isCombinedShape = fx?.isCombinedShape;
    if (fx) delete node.effects;

    let n = node;
    // Glyph text: replace the <text>/<tspan> subtree with baked <path> outlines
    // BEFORE any wrapper. Along-path glyphs place+rotate each glyph to the
    // referenced path's tangent; plain glyphs lay out horizontally.
    let consumedByGlyphs = false;
    if (text?.useGlyphs) {
        if (textPath) {
            // Path geometry is INLINE (`textPath.path`) — no `<path>` def lookup.
            const pathD = typeof textPath.path === 'string' ? textPath.path : undefined;
            // textLength passes through as a full PxAnimatable — static stretches the
            // run; animated re-spaces the glyphs over time (same per-glyph sampled
            // keyframe machinery as animated startOffset).
            const glyphed = applyTextGlyphsAlongPath(n, ctx, pathD, textPath.startOffset, textPath.textLength, textPath.pathOverflow);
            if (glyphed) { n = glyphed; consumedByGlyphs = true; } // native textPath NOT applied
        } else {
            n = applyTextGlyphsEffect(n, text, ctx);
            consumedByGlyphs = true;
        }
    }
    // textPath wraps the host's own children in a `<textPath>` — must run BEFORE any
    // structural wrapper (trim/repeater/mask) so the wrapping happens on the un-cloned
    // content first. Skipped when glyphs consumed it.
    if (!consumedByGlyphs) n = applyTextPathEffect(n, textPath, ctx);
    // Paint-gradient defs are minted FIRST, before any structural wrapper —
    // the gradient effect sits on the innermost element (alongside its `fill`
    // / `stroke` body attrs), so it must materialise before trim/repeater/
    // mask wrap around it. `<linearGradient>` defs themselves don't get
    // wrapped — they live in `ctx.defs` independent of the structure walk.
    n = applyFillGradientEffect(n, fillGradient, ctx);
    n = applyStrokeGradientEffect(n, strokeGradient, ctx);
    n = applyTrimPathEffect(n, trimPath, isCombinedShape, ctx);         // innermost shape
    n = applyRepeaterEffect(n, repeater, ctx);
    n = applyMaskedByEffect(n, maskedBy, transformation, ctx);          // mask sits on inner element
    n = applyClipPathEffect(n, clipPath, ctx);                         // clip-path ref on the element

    if (innerIdForContentRef) {
        // This node is the SOURCE of a content-ref `<use>` → split into
        // outer-translate + inner-rest + bare element so the use can target the
        // inner layer. But it may ALSO be a content-ref CONSUMER itself (a
        // `<use>` that both references content and is referenced — the nested
        // case): rewrite its OWN ref href first so the split moves a resolved
        // body inward, not the dangling editor-side content id.
        applyRefHref(n, cloneFx, ctx);
        n = splitForContentRef(n, transformation, originalId!, innerIdForContentRef, ctx);
    } else {
        n = applyRefAndTransformationEffect(n, cloneFx, transformation, ctx);
    }

    // Hand off the retime slice to pass 2 (keeps it nested under `clone`). The
    // ref part (type/baseId) was consumed above.
    if (cloneFx?.retime) node.effects = { clone: { retime: cloneFx.retime } };
    if (originalId) ctx.idMap.set(originalId, n);                       // outer wrapper is the clone target
    return n;
}

/** Pass 2 — apply retime to every `<use>` that carries it. Follows the
 *  materialised `<use>.href` (not the editor-side `retime.baseId`). */
function applyPlayerEffects_retime(node: PxNode, ctx: ApplyContext): PxNode {
    applyAllRetimeEffects(node, ctx);
    return node;
}

