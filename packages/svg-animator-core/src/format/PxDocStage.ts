// @px-area pipeline
// ============================================================================
// THE DOCUMENT STAGE STAMP (dev-docs/plans/prepare-document-pipeline.md)
//
// A document is lowered through ordered STAGES: `current` (version-migrated) → `checked`
// (validated and repaired against the schema, every object type-stamped) → `resolved`
// (the animator config's runtime view computed once and attached) → `plain` (effects
// materialized for an engine — directly projectable to WAAPI / the frame loop).
//
// The stamp records the stage a document has REACHED, so later work trusts it instead of
// redoing it. Rules that make the trust sound:
//   - The stamp is written ONLY onto objects the pipeline created — never onto the input.
//   - It is a non-enumerable, non-registered Symbol property: invisible to JSON.stringify,
//     Object.keys, schema validation and structuredClone — a saved or cloned document loses
//     it and is verified afresh.
//   - `Symbol()` (not `Symbol.for`) is per-module-instance: a second copy of this library on
//     the page cannot read (or wrongly trust) stamps made by another copy or version.
// ============================================================================
import type { PxDocument, PxAnimatorRuntimeConfig } from './PxAnimatorTypes';
import type { PxTimelineEngine } from './PxAnimatorConstants';

/** How far a document has been lowered — see the module note. @public @advanced */
export const PxDocStage = {
    current: 'current',
    checked: 'checked',
    resolved: 'resolved',
    plain: 'plain',
} as const;
export type PxDocStage = typeof PxDocStage[keyof typeof PxDocStage];

const STAGE_ORDER: Record<PxDocStage, number> = { current: 1, checked: 2, resolved: 3, plain: 4 };
/** Whether a reached stage satisfies a requested one. @internal */
export const stageAtLeast = (reached: PxDocStage, wanted: PxDocStage): boolean =>
    STAGE_ORDER[reached] >= STAGE_ORDER[wanted];

/** The stamp's key. Deliberately module-private in spirit: exported only for `/internal`. @internal */
export const PX_DOC_PREP: unique symbol = Symbol('pxDocPrep');

/** What the stamp records. `view` is the resolved runtime config (undefined = the document has none). @internal */
export interface PxDocPrep {
    readonly stage: PxDocStage;
    /** Set at `plain`: which engine the materialization targeted. */
    readonly engine?: PxTimelineEngine;
    /** Set from `resolved` on: what `getAnimatorConfig` answers without deriving. */
    readonly view?: PxAnimatorRuntimeConfig;
    /** The animator config OBJECT `view` was derived from — the view is trusted only while the
     *  document still holds this very object (a rewritten config, e.g. by id regeneration, re-derives). */
    readonly viewOf?: object;
}

/** The animator config object of a document, at either of its two addresses. @internal */
export function animatorOf(doc: PxDocument | undefined): object | undefined {
    return doc?.animator || legacyAnimatorOf(doc);
}

/** `doc.meta.animator` — the pre-rendered SVG's address (`meta` is otherwise the editor's, opaque). @internal */
export function legacyAnimatorOf(doc: PxDocument | undefined): object | undefined {
    const meta = doc?.meta;
    const legacy = typeof meta === 'object' && meta !== null && 'animator' in meta ? meta.animator : undefined;
    return typeof legacy === 'object' && legacy !== null ? legacy : undefined;
}

/** The stamped view, when it still belongs to `doc`'s current animator config. @internal */
export function trustedView(doc: PxDocument, prep: PxDocPrep | undefined): { view: PxAnimatorRuntimeConfig | undefined } | undefined {
    if (!prep || !stageAtLeast(prep.stage, PxDocStage.resolved) || prep.viewOf !== animatorOf(doc)) return undefined;
    return { view: prep.view };
}

/** A document that passed through `prepareDocument` — carries the stage stamp. @public @advanced */
export interface PxPreparedDocument extends PxDocument {
    readonly [PX_DOC_PREP]: PxDocPrep;
}

/** The stamp of a document, if it carries one. @internal */
export function prepOf(doc: PxDocument | undefined): PxDocPrep | undefined {
    return doc ? (doc as Partial<PxPreparedDocument>)[PX_DOC_PREP] : undefined;
}

/** Writes the stamp onto `doc` — which must be an object the CALLER created, never user input. @internal */
export function stampPrep(doc: PxDocument, prep: PxDocPrep): PxPreparedDocument {
    Object.defineProperty(doc, PX_DOC_PREP, { value: Object.freeze({ ...prep }), enumerable: false, configurable: true });
    return doc as PxPreparedDocument;
}

/** The stage a document was prepared to, or undefined for a raw document. @public @advanced */
export function documentStage(doc: PxDocument): PxDocStage | undefined {
    return prepOf(doc)?.stage;
}
