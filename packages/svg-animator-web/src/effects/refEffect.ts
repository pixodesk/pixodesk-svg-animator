/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/


/**
 * REF + TRANSFORMATION (combined) — mirrors the editor's
 * `SvgTransformElementEffectRenderer.renderElementWrapper`. The use's `href`
 * is set BEFORE `applyTransformationEffect` wraps the node so it lands on the
 * actual `<use>` rather than on an outer `<g>` wrapper.
 *
 * For `ref:{type:'content'}` the source is materialised as multi-layer by
 * `splitForContentRef` (see `contentRefSplit.ts`), and the use's `href` is
 * rewritten to point at the inner (no-translate) layer's id. No translate
 * cancellation is needed on the use side any more.
 */

import { applyTransformationEffect } from './transformationEffect';
import type { ApplyContext, PxNode, PxRefEffect, PxTransformationEffect } from './types';

const CONTENT_SUBREF = 'content';

export function applyRefAndTransformationEffect(
    node: PxNode,
    ref: PxRefEffect | undefined,
    transformation: PxTransformationEffect | undefined,
    ctx: ApplyContext,
): PxNode {
    if (ref) {
        const baseId = ref.baseId;
        if (!baseId) {
            ctx.errors.push('ref: missing baseId');
        } else {
            // For content-ref, redirect href to the inner-layer id produced by
            // `splitForContentRef`. For whole-element ref (or when no split has
            // happened, e.g. target not in the tree), fall back to baseId.
            const targetId = ref.type === CONTENT_SUBREF
                ? (ctx.contentRefInnerIds.get(baseId) || baseId)
                : baseId;
            node.href = '#' + targetId;
        }
    }
    return applyTransformationEffect(node, transformation, ctx);
}
