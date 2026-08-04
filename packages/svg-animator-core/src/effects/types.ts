/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/


/**
 * Applier-runtime types: `ApplyContext` (per-run mutable state) and `ApplyResult`
 * (return shape of `applyPlayerEffects`).
 *
 * The wire-shape types (`PxNode`, `PxEffects`, individual effect shapes,
 * `PxAnimatable<T>`, etc.) live in `../PxAnimatorTypes` — the single source
 * of truth that pairs each interface with its runtime `Px*Schema` via
 * `implementsInterface`. Effect modules import those directly from there.
 */

import type { PxAnimatorEngine, PxGlyphFont, PxNode } from '../PxAnimatorTypes';


/** Collected diagnostics + new <defs> nodes accumulated during a run. */
export interface ApplyResult {
    root: PxNode;
    defs: Array<PxNode>;
    warnings: Array<string>;
    errors: Array<string>;
}

/**
 * Static-or-animated translate captured from one ancestor `<g>` in the chain
 * walked by `collectMaskAncestorChains`. Only translate is captured today —
 * rotate/scale could be composed too (the `applyMaskedByEffect` math can be
 * extended), but the pre-pass would need to capture them here first.
 */
export interface MaskAncestorTransform {
    translate?: [number, number];
    translateKeyframes?: Array<{ time: number; value: [number, number] }>;
}

/** Mutable per-run state threaded through every effect. */
export interface ApplyContext {
    defs: Array<PxNode>;
    warnings: Array<string>;
    errors: Array<string>;
    idMap: Map<string, PxNode>;
    nextId: number;
    /**
     * The resolved animation engine for this run. `frames` ONLY when mode is
     * explicitly `'frames'`; `auto`/`waapi`/unset all resolve to `waapi` (the
     * actual engine isn't certain yet, and CSS/WAAPI both need the inline form).
     * Effects that emit an animated `<use>`→defs-clone (retime, content-ref) can
     * read this to decide whether to INLINE the animated clone content (only the
     * frame loop animates `<use>` shadow trees natively, so it needn't inline).
     *
     * NOTE: not consumed yet — wired through for the upcoming materialise work.
     */
    engine: PxAnimatorEngine;
    /**
     * For every element id referenced by a `<use>` with `ref:{type:'content'}`,
     * the fresh id of the INNER (no-translate) wrapper produced by
     * `splitForContentRef`. The use's `href` is rewritten to point at this
     * inner id — the source is split into outer-translate + inner-content layers
     * and the use targets the inner one. Populated by `identifyContentRefTargets`
     * before pass 1.
     */
    contentRefInnerIds: Map<string, string>;
    /**
     * For every element involved in a `effects.maskedBy` pair (the masked
     * element and the mask source), the chain of ancestor transforms from
     * root down to (but NOT including) that element. Populated by
     * `collectMaskAncestorChains` BEFORE pass 1 so `applyMaskedByEffect` can
     * place the inner `<use>` at the mask source's world position regardless
     * of how the masked element / mask source are nested under `<g transform>`
     * wrappers.
     *
     * Keyed by NODE REFERENCE (not id): in the lightweight wire format only
     * referenced elements carry an `id` (the mask source), but the masked
     * element typically does not. Look up the source via `ctx.idMap.get(href)`
     * first, then index this map with that node.
     */
    maskAncestorChains: Map<PxNode, Array<MaskAncestorTransform>>;
    /**
     * The document's embedded glyph outlines (`definitions.glyphs`), keyed by
     * font-family. Read once from the root and consumed by the `text.useGlyphs`
     * effect to materialise `<text>` into `<path>` outlines. Undefined when the
     * document carries no glyphs.
     */
    glyphs?: Record<string, PxGlyphFont>;
}
