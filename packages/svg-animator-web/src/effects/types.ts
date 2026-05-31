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
}
