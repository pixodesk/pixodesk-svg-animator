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
 *      maskedBy / strokeTrim / retime) materialised into wrappers, defs, clones.
 *   2. `materialiseInternalLoopsInTree` — every `propAnim.loop` expanded into
 *      repeated keyframes filling the duration.
 *   3. `materialiseMotionPathsInTree` — `transform` kfs with tangents +
 *      `autoOrient` flattened into sampled `{translate, rotate}` kfs. Only
 *      for `engine === waapi` — frames-mode keeps the parametric form and
 *      evaluates per frame for max spatial fidelity.
 *   4. `materialiseAnimatedUseInstances` — `<use>` referencing an animated
 *      subtree replaced with a `<g>` carrying a deep clone (fresh ids).
 *      Only for `engine === waapi` — frames-mode updates source attrs
 *      per frame, which propagate through `<use>` shadow trees natively.
 *
 * Immutable: input doc is never mutated. Steps that didn't apply (the engine
 * gating or "nothing to do" early-outs) return the input by reference.
 */

import { applyPlayerEffects } from './effects/PlayerEffectsUtil';
import { DEFAULT_DURATION_MS } from './PxAnimatorUtil';
import { materialiseInternalLoopsInTree } from './PxDefinitions';
import { materialiseOffsetPathsInTree } from './PxOffsetPathMaterialiser';
import { materialiseMotionPathsInTree } from './PxMotionPath';
import type { MotionPathMaterialisationOptions } from './PxMotionPath';
import { getAnimatorConfig, PxAnimatorEngine } from './PxAnimatorConstants';
import type { PxAnimatedSvgDocument, PxNode } from './PxAnimatorTypes';
import { materialiseAnimatedUseInstances } from './PxAnimatorUseMaterialiser';


/** Options accepted by {@link materialiseAllInTree}. Mostly forwarded to the
 *  per-stage materialisers; ordering is fixed (see module doc). */
export interface MaterialiseAllOptions {
    /** Knobs forwarded to `materialiseMotionPathsInTree`. Only consulted for
     *  `engine === waapi` — frames-mode skips that stage entirely. */
    motionPath?: MotionPathMaterialisationOptions;
}


export function materialiseAllInTree(
    doc: PxAnimatedSvgDocument,
    engine: PxAnimatorEngine,
    opts?: MaterialiseAllOptions,
): PxAnimatedSvgDocument {
    // 1. Effects → structural materialisation. Always runs; returns a fresh root.
    let root = applyPlayerEffects(doc).root as PxAnimatedSvgDocument;

    // 1b. `alongPathMode: 'offsetPath'` transforms → CSS Motion Path (offset-path style
    //     + `offsetDistance` binding). Both engines: frames drives `offset-distance` per
    //     rAF, waapi animates it natively (percent values). BEFORE loop expansion so a
    //     carried `loop` expands on the rewritten binding.
    root = materialiseOffsetPathsInTree(root);

    // 2. Loops → flat repeated keyframes. Always runs (both engines need flat
    //    kfs covering the duration; per-binding expansion in
    //    `normalizeKeyframes` becomes a no-op once the loop field is consumed).
    const duration = getAnimatorConfig(root)?.duration ?? DEFAULT_DURATION_MS;
    root = materialiseInternalLoopsInTree(root, duration);

    if (engine === PxAnimatorEngine.waapi) {
        // 3. Motion-along-path → sampled `{translate, rotate}` kfs. WAAPI can't
        //    evaluate parametric tangents; frames-mode does that per frame so
        //    we skip this for frames.
        root = materialiseMotionPathsInTree(root, opts?.motionPath);

        // 4. <use> referencing animated subtrees → <g> wrapping a fresh clone.
        //    WAAPI / CSS animations don't reliably propagate through SVG <use>
        //    shadow trees in Chrome / Safari; frames-mode updates source
        //    attributes per frame and the shadow tree picks those up natively.
        root = materialiseAnimatedUseInstances(root);

        // 5. Prune <defs> `<g>`/`<symbol>` entries that step 4 orphaned — i.e. no
        //    `<use>` references them any more (the animated uses that did got
        //    inlined into `<g>`+clones). waapi-only: frames keeps `<use href>`,
        //    so nothing is orphaned there.
        root = pruneUnreferencedDefs(root);
    }

    return root;
}


/**
 * Removes orphaned `<defs>` entries: direct `<defs>` children of type `<g>` /
 * `<symbol>` whose `id` is no longer targeted by ANY `<use href>` in the tree.
 * Runs after step 4 (`materialiseAnimatedUseInstances`), which inlines animated
 * `<use>`s and thereby leaves their former defs targets unreferenced.
 *
 * Loops to a fixpoint so chains collapse fully: pruning an entry can drop the
 * `<use>`s inside it, which in turn orphans the entries THOSE referenced. The
 * loop also drops a `<defs>` node once pruning has emptied it.
 *
 * Scope is intentionally limited to `<g>`/`<symbol>` (the `<use>`-target element
 * types) so `url(#…)`-referenced defs (gradients / masks / clipPaths / filters)
 * are never touched. Mutates `root` in place — safe, as it's a freshly
 * materialised tree owned by {@link materialiseAllInTree}.
 */
function pruneUnreferencedDefs(root: PxAnimatedSvgDocument): PxAnimatedSvgDocument {
    const stripHash = (h: string): string => (h.startsWith('#') ? h.slice(1) : h);
    const walk = (n: PxNode, fn: (n: PxNode) => void): void => { fn(n); n.children?.forEach(c => walk(c, fn)); };

    let changed = true;
    while (changed) {
        changed = false;
        const referenced = new Set<string>();
        walk(root, n => {
            if (n.type === 'use' && typeof n.href === 'string') referenced.add(stripHash(n.href));
        });
        walk(root, n => {
            if (!n.children) return;
            let kept = n.children;
            // (a) inside <defs>: drop <g>/<symbol> entries no <use> targets any more
            if (n.type === 'defs') {
                kept = kept.filter(c =>
                    !((c.type === 'g' || c.type === 'symbol') && typeof c.id === 'string' && !referenced.has(c.id)));
            }
            // (b) anywhere: drop a now-empty <defs> child
            kept = kept.filter(c => !(c.type === 'defs' && (!c.children || c.children.length === 0)));
            if (kept.length !== n.children.length) { n.children = kept; changed = true; }
        });
    }
    return root;
}
