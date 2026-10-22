// @px-area pipeline
// ============================================================================
// prepareDocument — ONE staged, immutable lowering pipeline
// (dev-docs/plans/prepare-document-pipeline.md; first-use review §17a).
//
// A raw document is lowered through ordered stages, each a pure doc → new-doc step; the
// result carries a stage stamp (see PxDocStage) and is trusted by later calls:
//     current   — version-migrated to the schema this build reads
//     checked   — validated and repaired against the schema in ONE visit, every object
//                 type-stamped: later `Schema.cast*` reads answer from the stamps
//                 (dev-docs/plans/schema-cast-and-stamps.md)
//     resolved  — the animator config's runtime view computed once and attached
//     plain     — effects/loops/motion-paths/<use>/rest poses materialized for an ENGINE;
//                 directly consumable by WAAPI or the frame loop
// Re-preparing a document that already reached the target stage returns it unchanged.
// ============================================================================
import { convertWireDocument } from '../version/PxWireVersion';
import { carryPrep, deriveRuntimeView, resolveTimelineEngine, PxTimelineEngine } from '../format/PxAnimatorConstants';
import { animatorOf, prepOf, stampPrep, stageAtLeast, trustedView, PxDocStage, type PxDocPrep, type PxPreparedDocument } from '../format/PxDocStage';
import { materializeAllInTree } from '../materialize/PxAnimatorMaterializeAll';
import { generateNewIds } from '../util/PxIdUtil';
import { PxAnimatedSvgDocumentSchema, type PxAnimatedSvgDocument } from '../format/PxAnimatorTypes';
import type { PxValidationFinding } from '../schema/PxSchema';

/** Options of {@link prepareDocument}. @public @advanced */
export interface PxPrepareOptions {
    /** How far to lower; the default is `plain` — ready for an engine. */
    stage?: PxDocStage;
    /** The engine `plain` materializes for; the default is what the document's `timeline.engine` resolves to. */
    engine?: PxTimelineEngine;
    /** Mint fresh ids on the result — required before putting the same animation on a page twice. */
    freshIds?: boolean;
    /** What the `checked` stage repaired, one finding per problem (called only when there are any). */
    onProblems?: (problems: ReadonlyArray<PxValidationFinding>) => void;
}

/**
 * Lowers a document to the requested stage and stamps the RESULT; the input is never touched
 * (frozen inputs welcome). A document already at or past the target — same engine, for `plain` —
 * comes back unchanged, so calling this "just in case" costs nothing.
 * @public @advanced
 */
export function prepareDocument(doc: PxAnimatedSvgDocument, options?: PxPrepareOptions): PxPreparedDocument {
    const target = options?.stage ?? PxDocStage.plain;
    // A stamp whose view no longer belongs to the doc (its config was swapped in place — a breach of
    // the immutability convention) is not trusted at all: the doc is lowered afresh.
    const stamped = prepOf(doc);
    const existing: PxDocPrep | undefined = stamped && (!stageAtLeast(stamped.stage, PxDocStage.resolved) || trustedView(doc, stamped)) ? stamped : undefined;

    // Trust an existing stamp that satisfies the request. Ids are NOT recorded in the stamp
    // (accepted limit): `freshIds` re-mints them on the trusted doc, never re-lowers it.
    if (existing && stageAtLeast(existing.stage, target)) {
        const engineOk = target !== PxDocStage.plain
            || existing.engine === (options?.engine ?? resolveTimelineEngine(existing.view?.engine));
        if (engineOk) return (options?.freshIds ? carryPrep(doc, generateNewIds(doc)) : doc) as PxPreparedDocument;
    }

    // current — version-migrate. `convertWireDocument` may return the input by reference
    // (nothing to apply); the stamp must then go on a shallow copy, never on the input.
    let cur: PxAnimatedSvgDocument;
    if (existing) cur = doc;
    else {
        const converted = convertWireDocument(doc).doc as PxAnimatedSvgDocument;
        cur = stampPrep(converted === doc ? { ...doc } : converted, { stage: PxDocStage.current });
    }
    if (target === PxDocStage.current) return cur as PxPreparedDocument;

    // checked — one visit: a repaired, type-stamped copy (stamped subtrees are reused, not rebuilt).
    if (!existing || !stageAtLeast(existing.stage, PxDocStage.checked)) {
        const { value, problems } = PxAnimatedSvgDocumentSchema.castOrFix(cur);
        if (problems.length) options?.onProblems?.(problems);
        cur = stampPrep(value, { stage: PxDocStage.checked });
    }
    if (target === PxDocStage.checked) return cur as PxPreparedDocument;

    // resolved — the runtime view, computed once. `view` may be undefined (no animator block):
    // that too is an answer `getAnimatorConfig` then gives without deriving.
    const trusted = existing ? trustedView(cur, existing) : undefined;
    const view = trusted ? trusted.view : deriveRuntimeView(cur);
    if (!trusted) cur = stampPrep(cur === doc ? { ...doc } : cur, { stage: PxDocStage.resolved, view, viewOf: animatorOf(cur) });
    if (target === PxDocStage.resolved) return cur as PxPreparedDocument;

    // plain — materialize for the engine (stamps its own result, view carried through).
    const engine = options?.engine ?? resolveTimelineEngine(view?.engine);
    let out = materializeAllInTree(cur, engine);
    if (options?.freshIds) out = carryPrep(out, generateNewIds(out));
    return out as PxPreparedDocument;
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
 * - **Safe to hand on to `createSvgAnimator`.** Materialization consumes `node.effects` and
 *   flattens loops, so the player's own pass over the result changes nothing, and the ids it
 *   binds to are the ids that were rendered.
 *
 * The web player's container path does the same two steps inline (it only regenerates ids
 * when it owns the render); this is that sequence, named, so the adapters cannot drift from it.
 * @internal
 */
export function prepareDocumentForRender(
    doc: PxAnimatedSvgDocument,
    onProblems?: PxPrepareOptions['onProblems'],
): PxAnimatedSvgDocument {
    // checked → resolved → plain (for the engine the document resolves to) → fresh ids
    return prepareDocument(doc, { freshIds: true, onProblems });
}
