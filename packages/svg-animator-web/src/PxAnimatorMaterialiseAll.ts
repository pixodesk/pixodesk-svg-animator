/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

/**
 * Single-call materialisation pipeline.
 *
 * Runs the full sequence of document-level transformations that turn the
 * wire-format `PxAnimatedSvgDocument` into a flat tree any renderer can
 * consume. The player itself calls this from `createAnimatorImpl`; the same
 * function is exported for the Editor (or any external caller) so the
 * Editor's flat-export path is GUARANTEED to be byte-identical to what the
 * player sees internally — no parallel pipeline to drift.
 *
 *   1. `applyPlayerEffects` — `node.effects` (ref / transformation / repeater /
 *      maskedBy / trimPath / retime) materialised into wrappers, defs, clones.
 *   2. `materialiseInternalLoopsInTree` — every `propAnim.loop` expanded into
 *      repeated keyframes filling the duration.
 *   3. `materialiseMotionPathsInTree` — `transform` kfs with tangents +
 *      `autoOrient` flattened into sampled `{translate, rotate}` kfs. Only
 *      for `engine === webapi` — frames-mode keeps the parametric form and
 *      evaluates per frame for max spatial fidelity.
 *   4. `materialiseAnimatedUseInstances` — `<use>` referencing an animated
 *      subtree replaced with a `<g>` carrying a deep clone (fresh ids).
 *      Only for `engine === webapi` — frames-mode updates source attrs
 *      per frame, which propagate through `<use>` shadow trees natively.
 *
 * Immutable: input doc is never mutated. Steps that didn't apply (the engine
 * gating or "nothing to do" early-outs) return the input by reference.
 */

import { applyPlayerEffects } from './effects/PlayerEffectsUtil';
import { DEFAULT_DURATION_MS } from './PxAnimatorUtil';
import { materialiseInternalLoopsInTree } from './PxDefinitions';
import { materialiseMotionPathsInTree } from './PxMotionPath';
import type { MotionPathMaterialisationOptions } from './PxMotionPath';
import { getAnimatorConfig, PxAnimatorEngine } from './PxAnimatorTypes';
import type { PxAnimatedSvgDocument } from './PxAnimatorTypes';
import { materialiseAnimatedUseInstances } from './PxAnimatorUseMaterialiser';


/** Options accepted by {@link materialiseAllInTree}. Mostly forwarded to the
 *  per-stage materialisers; ordering is fixed (see module doc). */
export interface MaterialiseAllOptions {
    /** Knobs forwarded to `materialiseMotionPathsInTree`. Only consulted for
     *  `engine === webapi` — frames-mode skips that stage entirely. */
    motionPath?: MotionPathMaterialisationOptions;
}


export function materialiseAllInTree(
    doc: PxAnimatedSvgDocument,
    engine: PxAnimatorEngine,
    opts?: MaterialiseAllOptions,
): PxAnimatedSvgDocument {
    // 1. Effects → structural materialisation. Always runs; returns a fresh root.
    let root = applyPlayerEffects(doc).root as PxAnimatedSvgDocument;

    // 2. Loops → flat repeated keyframes. Always runs (both engines need flat
    //    kfs covering the duration; per-binding expansion in
    //    `normalizeKeyframes` becomes a no-op once the loop field is consumed).
    const duration = getAnimatorConfig(root)?.duration ?? DEFAULT_DURATION_MS;
    root = materialiseInternalLoopsInTree(root, duration);

    if (engine === PxAnimatorEngine.webapi) {
        // 3. Motion-along-path → sampled `{translate, rotate}` kfs. WAAPI can't
        //    evaluate parametric tangents; frames-mode does that per frame so
        //    we skip this for frames.
        root = materialiseMotionPathsInTree(root, opts?.motionPath);

        // 4. <use> referencing animated subtrees → <g> wrapping a fresh clone.
        //    WAAPI / CSS animations don't reliably propagate through SVG <use>
        //    shadow trees in Chrome / Safari; frames-mode updates source
        //    attributes per frame and the shadow tree picks those up natively.
        root = materialiseAnimatedUseInstances(root);
    }

    return root;
}
