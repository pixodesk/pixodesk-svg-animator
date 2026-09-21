/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

/**
 * Single-call materialization pipeline.
 *
 * Runs the full sequence of document-level transformations that turn the
 * wire-format `PxAnimatedSvgDocument` into a flat tree any renderer can
 * consume. The player itself calls this from `createAnimatorImpl`; the same
 * function is exported for the Editor (or any external caller) so the
 * Editor's flat-export path is GUARANTEED to be byte-identical to what the
 * player sees internally — no parallel pipeline to drift.
 *
 *   1. `materializeNodeEffects` — `node.effects` (ref / transformation / repeater /
 *      maskedBy / strokeTrim / retime) materialized into wrappers, defs, clones.
 *   2. `materializeInternalLoopsInTree` — every `propAnim.loop` expanded into
 *      repeated keyframes filling the duration.
 *   3. `materializeMotionPathsInTree` — `transform` kfs with tangents +
 *      `autoOrient` flattened into sampled `{translate, rotate}` kfs. Only
 *      for `engine === waapi` — frames-mode keeps the parametric form and
 *      evaluates per frame for max spatial fidelity.
 *   4. `materializeAnimatedUseInstances` — `<use>` referencing an animated
 *      subtree replaced with a `<g>` carrying a deep clone (fresh ids).
 *      Only for `engine === waapi` — frames-mode updates source attrs
 *      per frame, which propagate through `<use>` shadow trees natively.
 *   5. `materializeRestPosesInTree` — every animated property with no static value gets
 *      its FIRST-FRAME value as a plain attribute, so the static document — what both
 *      engines show at rest — is the first frame. Last, so generated nodes and clones
 *      are covered. Never changes the animation. See `PxRestPose`.
 *
 * Immutable: input doc is never mutated. Steps that didn't apply (the engine
 * gating or "nothing to do" early-outs) return the input by reference.
 */

import { materializeNodeEffects } from '../effects/PlayerEffectsUtil';
import { PX_DEFAULT_DURATION_MS } from '../util/PxAnimatorUtil';
import { materializeInternalLoopsInTree } from '../animation/PxDefinitions';
import { materializeOffsetPathsInTree } from './PxOffsetPathMaterializer';
import { materializeMotionPathsInTree } from './PxMotionPath';
import type { MotionPathMaterializationOptions } from './PxMotionPath';
import { getAnimatorConfig, PxTimelineEngine, resolveTimelineEngine } from '../format/PxAnimatorConstants';
import type { PxAnimatedSvgDocument, PxNode } from '../format/PxAnimatorTypes';
import { materializeAnimatedUseInstances } from './PxAnimatorUseMaterializer';
import { generateNewIds } from '../util/PxIdUtil';
import { materializeRestPosesInTree } from './PxRestPose';


/** Options accepted by {@link materializeAllInTree}. Mostly forwarded to the
 *  per-stage materializers; ordering is fixed (see module doc). * @internal
 */
export interface PxMaterializeAllOptions {
    /** Knobs forwarded to `materializeMotionPathsInTree`. Only consulted for
     *  `engine === waapi` — frames-mode skips that stage entirely. */
    motionPath?: MotionPathMaterializationOptions;
}


/** @public @advanced */
export function materializeAllInTree(
    doc: PxAnimatedSvgDocument,
    engine: PxTimelineEngine,
    options?: PxMaterializeAllOptions,
): PxAnimatedSvgDocument {
    // 1. Effects → structural materialization. Always runs; returns a fresh root.
    let root = materializeNodeEffects(doc).root as PxAnimatedSvgDocument;

    // 1b. `alongPathMode: 'offsetPath'` transforms → CSS Motion Path (offset-path style
    //     + `offsetDistance` binding). Both engines: frames drives `offset-distance` per
    //     rAF, waapi animates it natively (percent values). BEFORE loop expansion so a
    //     carried `loop` expands on the rewritten binding.
    root = materializeOffsetPathsInTree(root);

    // 2. Loops → flat repeated keyframes. Always runs (both engines need flat
    //    kfs covering the duration; per-binding expansion in
    //    `normalizeKeyframes` becomes a no-op once the loop field is consumed).
    const duration = getAnimatorConfig(root)?.duration ?? PX_DEFAULT_DURATION_MS;
    root = materializeInternalLoopsInTree(root, duration);

    if (engine === PxTimelineEngine.native) {
        // 3. Motion-along-path → sampled `{translate, rotate}` kfs. WAAPI can't
        //    evaluate parametric tangents; frames-mode does that per frame so
        //    we skip this for frames.
        root = materializeMotionPathsInTree(root, options?.motionPath);

        // 4. <use> referencing animated subtrees → <g> wrapping a fresh clone.
        //    WAAPI / CSS animations don't reliably propagate through SVG <use>
        //    shadow trees in Chrome / Safari; frames-mode updates source
        //    attributes per frame and the shadow tree picks those up natively.
        root = materializeAnimatedUseInstances(root);

        // 5. Prune <defs> `<g>`/`<symbol>` entries that step 4 orphaned — i.e. no
        //    `<use>` references them any more (the animated uses that did got
        //    inlined into `<g>`+clones). waapi-only: frames keeps `<use href>`,
        //    so nothing is orphaned there.
        root = pruneUnreferencedDefs(root);
    }

    // 6. Rest poses — LAST, so every node the stages above generated is covered, clones
    //    included. Both engines show the STATIC document at rest (unplayed, or cancelled), and
    //    a generated animated wrapper has no static transform of its own. See `PxRestPose`.
    root = materializeRestPosesInTree(root, engine);

    return root;
}


/**
 * The document exactly as the web player RENDERS it: materialized for the engine the document
 * resolves to, then with fresh ids.
 *
 * For adapters that build the DOM themselves (React, Vue). They must render THIS rather than
 * the raw document — `effects` only become the `<radialGradient>`/`<mask>`/wrapper nodes the
 * shapes point at during materialization. Rendering the raw document drops all of it, and a
 * document whose paint comes from `effects` alone renders as an empty canvas.
 *
 * - **Order matters.** Ids are regenerated AFTER materializing, because materialization mints
 *   its def ids from a counter that starts at zero on every call — two instances on one page
 *   would otherwise share them, and `url(#…)` resolves document-wide to the first match.
 * - **Safe to hand on to `createAnimator`.** Materialization consumes `node.effects` and
 *   flattens loops, so the player's own pass over the result changes nothing, and the ids it
 *   binds to are the ids that were rendered.
 *
 * The web player's container path does the same two steps inline (it only regenerates ids
 * when it owns the render); this is that sequence, named, so the adapters cannot drift from it.
 * @internal
 */
export function prepareDocumentForRender(doc: PxAnimatedSvgDocument): PxAnimatedSvgDocument {
    const engine = resolveTimelineEngine(getAnimatorConfig(doc)?.engine);
    return generateNewIds(materializeAllInTree(doc, engine));
}


/**
 * Removes orphaned `<defs>` entries: direct `<defs>` children of type `<g>` /
 * `<symbol>` whose `id` is no longer targeted by ANY `<use href>` in the tree.
 * Runs after step 4 (`materializeAnimatedUseInstances`), which inlines animated
 * `<use>`s and thereby leaves their former defs targets unreferenced.
 *
 * Loops to a fixpoint so chains collapse fully: pruning an entry can drop the
 * `<use>`s inside it, which in turn orphans the entries THOSE referenced. The
 * loop also drops a `<defs>` node once pruning has emptied it.
 *
 * Scope is intentionally limited to `<g>`/`<symbol>` (the `<use>`-target element
 * types) so `url(#…)`-referenced defs (gradients / masks / clipPaths / filters)
 * are never touched. Mutates `root` in place — safe, as it's a freshly
 * materialized tree owned by {@link materializeAllInTree}.
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
