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

import type { PxNode } from '../PxAnimatorTypes';


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
 * the editor's heavy-mask renderer also supports rotate/scale, and the
 * `applyMaskedByEffect` math can be extended to compose those, but the
 * pre-pass would need to capture them here first.
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
     * For every element id referenced by a `<use>` with `ref:{type:'content'}`,
     * the fresh id of the INNER (no-translate) wrapper produced by
     * `splitForContentRef`. The use's `href` is rewritten to point at this
     * inner id — mirrors the editor's heavy materialisation, where the source
     * is split into outer-translate + inner-content layers and the use targets
     * the inner one. Populated by `identifyContentRefTargets` before pass 1.
     */
    contentRefInnerIds: Map<string, string>;
    /**
     * For every element involved in a `effects.maskedBy` pair (the masked
     * element and the mask source), the chain of ancestor transforms from
     * root down to (but NOT including) that element. Populated by
     * `collectMaskAncestorChains` BEFORE pass 1 so `applyMaskedByEffect` can
     * place the inner `<use>` at the mask source's world position regardless
     * of how the masked element / mask source are nested under `<g transform>`
     * wrappers — mirrors the editor's `pathToThis` / `pathToMask` machinery.
     *
     * Keyed by NODE REFERENCE (not id): in the lightweight wire format only
     * referenced elements carry an `id` (the mask source), but the masked
     * element typically does not. Look up the source via `ctx.idMap.get(href)`
     * first, then index this map with that node.
     */
    maskAncestorChains: Map<PxNode, Array<MaskAncestorTransform>>;
}
