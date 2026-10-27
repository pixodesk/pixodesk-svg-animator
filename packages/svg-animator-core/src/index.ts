/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// ============================================================================
// @pixodesk/svg-animator-core — platform-neutral animator core.
// Schema, document types, interpolation, materializers (effects → plain JSON),
// sampling, and the adapter-driven frame-loop engine. No DOM: this package
// compiles without the "dom" lib and is shared by the web and React Native
// players.
// ============================================================================

// Schema toolkit

export { px, schemaKeys, describeSchema, PxSchemaCastError } from './schema/PxSchema';
export {
    PX_WIRE_VERSION_KEY,
    PX_WIRE_VERSION,
    PX_WIRE_BASELINE_VERSION,
    PX_WIRE_STEPS,
    PxWireVersionRelation,
    parseWireVersion,
    formatWireVersion,
    readWireVersion,
    compareWireVersion,
    wireVersionAdvice,
    convertWireDocument,
    applyWireSteps,
    downgradeWireDocument,
    PxWireStepKind,
} from './version/PxWireVersion';
export type {
    PxWireVersion,
    PxWireVersionStep,
    PxWireConversionResult,
    PxWireConversionOptions,
} from './version/PxWireVersion';
export type { PxInfer, PxSchema, PxAnySchema, PxSchemaDesc, PxValidationContext, PxValidationFinding, PxRemoveIndex, PxCastResult } from './schema/PxSchema';
export type { PxValidationResult } from './format/PxAnimatorTypes';
export { PxValidationFindingKind } from './schema/PxSchema';

// Wire-format schemas
export { toPxDocument, isCompiledAnimation, PxDocumentSchema, PxAnimatorConfigSchema, PxAnyPropertyAnimationSchema, PxAttrValueSchema, PxBezierPathSchema, PxCompiledAnimationSchema, PxCubicBezierSchema, PxRgbaSchema, PxDefinitionsSchema, PxElementAnimationSchema, PxKeyframeSchema, PxKeyframeValueSchema, PxLoopSchema, PxNodeBaseSchema, PxNodeSchema, PxPropertyAnimationSchema, PxSvgNodeRootSchema, PxTransformPartsSchema, PxTriggerSchema, PxTimelineSchema, PxTimeTimelineSchema, PxTransformValueSchema } from './format/PxAnimatorTypes';
export { PxTimelineEngine, PxCloneWithout, PxTimelineEngineSetting, PX_PLAYBACK_DEFAULTS, PX_TRANSFORM_PART_KEYS } from './format/PxAnimatorConstants';

// Document / model types
export type { PxDocument, PxDocumentInput, PxAnimationDefinition, PxAnimationPlayerApi, PxEngineCallbacks, PxAnimatorConfig, PxAnimatorRuntimeConfig, PxBezierPath, PxBinding, PxDefinitions, PxElementAnimation, PxGlyph, PxGlyphFont, PxKeyframe, PxLoop, PxNode, PxPropertyAnimation, PxAnyPropertyAnimation, PxCompiledAnimation, PxCompiledKeyframe, PxCubicBezier, PxPathValue, PxRgba, PxScroll, PxScrollRangePoint, PxSvgNode, PxTimeline, PxTransformParts, PxTrigger, PxTransformValue } from './format/PxAnimatorTypes';
// VALUE exports, not `export type`: each wire enum is a const namespace AND the string type
// derived from it under the same name (review §2.7), so a consumer gets both `PxTriggerEvent.click`
// and `start?: PxTriggerEvent` from one import.
export { PxFillMode, PxPlayOnAction, PxPlayOffAction, PxPlayEndAction, PxOutOfViewAction, PxPlaybackDirection, PxTriggerEvent } from './format/PxAnimatorConstants';

export { getBindings, getChildren, getDefinitions } from './format/PxAnimatorConstants';
export { getAnimatorConfig, isPxDocument, nestAnimatorTimeline } from './format/PxAnimatorConstants';

// Utils (string/color/easing/bezier math)

// Document id regeneration (fresh ids + rewritten internal refs)
export { generateNewIds } from './util/PxIdUtil';

// Motion-along-path materializer (sampling)

// `<use>` instance materializer

// Single-call materialization pipeline (effects → loops → motion-path → use)
export { materializeAllInTree } from './materialize/PxAnimatorMaterializeAll';

// The staged lowering pipeline: current → resolved → plain, stamped on the result
export { prepareDocument } from './pipeline/PxPrepareDocument';
export type { PxPrepareOptions } from './pipeline/PxPrepareDocument';
export { PxDocStage, documentStage } from './format/PxDocStage';
export type { PxPreparedDocument } from './format/PxDocStage';

// Engine wiring for player authors — the time contract, control rules, runtime form, adapter — is on
// `@pixodesk/svg-animator-core/engine` (src/engine.ts).

// The ONE diagnostics channel every player reports through (review §5)
export { PxDiagnosticCode } from './playback/PxDiagnosticCode';
export { PxDiagnosticKind } from './playback/PxDiagnostics';
export type { PxDiagnostic, PxDiagnostics, PxDiagnosticsConfig } from './playback/PxDiagnostics';

// The shapes every framework component shares (review §9) — one definition, three aliases.
export type { PxAnimationPlayerHandle, PxAnimationPlayerCallbacks } from './format/PxAnimatorTypes';
export type { PxPlaybackOverride, PxPlaybackOverrideInput, PxTimelineWithoutTrigger, PxPlaybackOverrideResult } from './playback/PxAnimatorConfigPatch';

// Element-creation factory + glyph-text materializer

// Player-effects materializer + visual-model diff harness
export { materializeNodeEffects } from './effects/PlayerEffectsUtil';

// Effects schemas + walker validator
export {
    PxClipPathEffectSchema,
    PxCloneEffectSchema,
    PxEffectsSchema,
    PxFillGradientEffectSchema,
    PxGradientStopSchema,
    PxMaskedByEffectSchema,
    PxRepeaterEffectSchema,
    PxRetimeEffectSchema,
    PxScrollRangePointSchema,
    PxScrollRangeSchema,
    PxScrollSchema,
    PxTextPathEffectSchema,
    PxTextEffectSchema,
    PxTransformByEffectSchema,
    PxStrokeTrimEffectSchema,
    validateDocument,
} from './format/PxAnimatorTypes';
export { applyAnimatorConfig, mergeAnimatorConfig } from './playback/PxAnimatorConfigPatch';
export type { PxTriggerEvents } from './format/PxAnimatorConstants';
export type { PxPlayExecutor } from './format/PxAnimatorTypes';
export { PxPlayState, PxTriggerAction } from './format/PxAnimatorConstants';
export type { PxPatch, PxAnimatorConfigPatch, PxAnimatorConfigMergeResult, PxTimelinePatch } from './playback/PxAnimatorConfigPatch';
export { PxGradientSpreadMethod, PxGradientType, PxLoopDirection, PxLoopRepeatAt, PxStrokeTrimSubPaths, PxUnits, PxMaskType, PxPathOverflow, PxLengthAdjust, PxTextPathMethod, PxTextPathSpacing } from './format/PxAnimatorConstants';
// The remaining wire enums (review §2.7). `PxFillMode` / `PxOutOfViewAction` / `PxPlayOnAction, PxPlayOffAction, PxPlayEndAction` /
// `PxPlaybackDirection` / `PxTriggerEvent` are exported above and must NOT be repeated here —
// one export per identifier.
export {
    PxAlongPathMode,
    PxPinAlign,
    PxScrollAxis,
    PxScrollKind,
    PxScrollPhase,
    PxScrollSource,
} from './format/PxAnimatorConstants';
export type {
    PxEffects,
    PxVec2,
} from './format/PxAnimatorTypes';

// Loop snap-back gap — the editor imports this so both sides stay in lockstep.
