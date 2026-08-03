/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/


/**
 * REF + TRANSFORMATION (combined). The use's `href` is set BEFORE
 * `applyTransformationEffect` wraps the node so it lands on the actual `<use>`
 * rather than on an outer `<g>` wrapper.
 *
 * For `ref:{type:'content'}` the source is materialised as multi-layer by
 * `splitForContentRef` (see `contentRefSplit.ts`), and the use's `href` is
 * rewritten to point at the inner (no-translate) layer's id. No translate
 * cancellation is needed on the use side any more.
 */

import { applyTransformationEffect } from './transformationEffect';
import type { PxCloneEffect, PxNode, PxTransformationEffect } from '../PxAnimatorTypes';
import type { ApplyContext } from './types';
import { stripHash } from './util';

const CONTENT_SUBREF = 'content';

/**
 * Rewrites `node.href` from the clone's reference part (`type`/`sourceId`) —
 * content-ref → the inner-layer id minted by `splitForContentRef`, whole-element
 * ref → `sourceId`. Pure href mutation (no wrapping), so it can run even when `node`
 * is ALSO a content-ref SOURCE that gets split: a `<use>` that both references
 * content (consumer) and is itself referenced (source) must get its own href
 * rewritten BEFORE the split moves its body inward — otherwise its body keeps the
 * editor-side content id, which doesn't exist in the lightweight tree (dangling
 * href → retime can't follow the chain → the retimed instance renders nothing).
 *
 * A direct-link clone (no `sourceId`, e.g. `clone:{retime}`) keeps its existing
 * `href` — there's nothing to redirect; only content-ref REQUIRES a `sourceId`.
 */
export function applyRefHref(
    node: PxNode,
    clone: PxCloneEffect | undefined,
    ctx: ApplyContext,
): void {
    if (!clone) return;
    // Canonical ref spelling is `#id` (SCHEMA-ANALYSIS §4 E-5); bare `id` is legacy.
    const sourceId = stripHash(clone.sourceId);
    if (!sourceId) {
        if (clone.type === CONTENT_SUBREF) ctx.errors.push('clone: content ref missing sourceId');
        return; // direct link → href already correct, nothing to rewrite
    }
    // For content-ref, redirect href to the inner-layer id produced by
    // `splitForContentRef`. For whole-element ref (or when no split has
    // happened, e.g. target not in the tree), fall back to sourceId.
    const targetId = clone.type === CONTENT_SUBREF
        ? (ctx.contentRefInnerIds.get(sourceId) || sourceId)
        : sourceId;
    node.href = '#' + targetId;
}

export function applyRefAndTransformationEffect(
    node: PxNode,
    clone: PxCloneEffect | undefined,
    transformation: PxTransformationEffect | undefined,
    ctx: ApplyContext,
): PxNode {
    applyRefHref(node, clone, ctx);
    return applyTransformationEffect(node, transformation, ctx);
}
