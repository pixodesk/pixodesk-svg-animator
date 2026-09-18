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

export { px, schemaKeys, describeSchema } from './schema/PxSchema';
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
export type { PxInfer, PxSchema, PxSchemaDesc, PxValidationContext, PxRemoveIndex } from './schema/PxSchema';

// Wire-format schemas
export { PxAnimatedSvgDocumentSchema, PxAnimatorConfigSchema, PxAttrValueSchema, PxBezierPathSchema, PxDefinitionsSchema, PxElementAnimationSchema, PxKeyframeSchema, PxKeyframeValueSchema, PxLoopSchema, PxNodeBaseSchema, PxNodeSchema, PxPropertyAnimationSchema, PxSvgNodeRootSchema, PxTransformPartsSchema, PxTriggerSchema, PxTimelineSchema, PxTransformValueSchema } from './format/PxAnimatorTypes';
export { resolveTimelineEngine, isNativeForced, mayUseNativeScrollTimeline, PxTimelineEngine, PxCloneWithout, PxTimelineEngineSetting, PX_TRIGGER_DEFAULTS, resolveTrigger, PX_TRANSFORM_PART_KEYS } from './format/PxAnimatorConstants';
// ONE control-mode rule for react / vue / rn (API review §1, §7) — logic + warning text.
export { PxControlMode, resolveControlMode, controlModeTakesOverTrigger } from './format/PxAnimatorConstants';
export type { PxControlProps } from './format/PxAnimatorConstants';
export { PX_WIRE_SCHEMA_VERSION } from './version/PxSchemaVersion';

// Document / model types
export type { PxAnimatedSvgDocument, PxAnimationDefinition, PxAnimatorApi, PxEngineCallbacks, PxAnimatorConfig, PxPlaybackApi, PxBezierPath, PxBinding, PxDefinitions, PxElementAnimation, PxGlyph, PxGlyphFont, PxKeyframe, PxLoop, PxNode, PxPropertyAnimation, PxScroll, PxScrollRangePoint, PxSvgNode, PxTimeline, PxTransformParts, PxTrigger, PxTransformValue } from './format/PxAnimatorTypes';
// VALUE exports, not `export type`: each wire enum is a const namespace AND the string type
// derived from it under the same name (review §2.7), so a consumer gets both `PxTriggerStart.click`
// and `start?: PxTriggerStart` from one import.
export { PxFillMode, PxMouseOutAction, PxOffScreenAction, PxPlaybackDirection, PxTriggerStart } from './format/PxAnimatorConstants';

export { isValidPxDocument } from './format/PxAnimatorTypes';
export { getBindings, getChildren, getDefinitions } from './format/PxAnimatorConstants';
export { getAnimatorConfig, isPxDocument, flattenAnimatorTimeline, nestAnimatorTimeline } from './format/PxAnimatorConstants';

// Utils (string/color/easing/bezier math)

// Document id regeneration (fresh ids + rewritten internal refs)
export { generateNewIds } from './util/PxIdUtil';

// Node props normalization + attribute/tag sanitization (platform-neutral —
// renderers on every platform share the same security and normalization rules)
export {
    toDomProps,
} from './util/PxNodeProps';

// Normalization / interpolation
export {
    calcAnimationValues,
    normalizeBindings,
} from './animation/PxDefinitions';

// Motion-along-path materializer (sampling)

// `<use>` instance materializer

// Single-call materialization pipeline (effects → loops → motion-path → use)
export { materializeAllInTree } from './materialize/PxAnimatorMaterializeAll';

// Adapter-driven frame-loop engine (platform-neutral playback)
export { createAdapterAnimator } from './playback/PxFrameLoop';
export type { PxPlatformAdapter } from './playback/PxFrameLoop';

// The ONE time contract every engine implements (review §3)
export {
    clampSeekMs,
    createRunClock,
    isValidPlaybackRate,
    progressSpanMs,
    progressToTimeMs,
    PX_RATE_REJECTED,
    seekCeilingMs,
    timeToProgress,
} from './playback/PxPlaybackTime';

// The ONE diagnostics channel every player reports through (review §5)
export { PxDiagnosticCode } from './playback/PxDiagnosticCode';
export { PxDiagnosticKind } from './playback/PxDiagnostics';
export type { PxDiagnostic, PxDiagnostics, PxDiagnosticsConfig } from './playback/PxDiagnostics';

// The shapes every framework component shares (review §9) — one definition, three aliases.
export type { PxAnimatorHandle, PxAnimatorCallbacks } from './format/PxAnimatorTypes';
export type { PxPlaybackOverride } from './playback/PxAnimatorConfigPatch';

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
    validateNodeEffects,
} from './format/PxAnimatorTypes';
export { applyAnimatorConfig, foldTimelineOverride, mergeAnimatorConfig } from './playback/PxAnimatorConfigPatch';
export { diagnoseDocument } from './format/PxDocumentDiagnostic';
export type { PxAnimatorConfigPatch, PxAnimatorConfigMergeResult, PxTimelineShortcuts, PxTimelinePatch } from './playback/PxAnimatorConfigPatch';
export { PxGradientSpreadMethod, PxGradientType, PxLoopDirection, PxLoopRepeatAt, PxStrokeTrimSubPaths, PxUnits, PxMaskType, PxPathOverflow, PxLengthAdjust, PxTextPathMethod, PxTextPathSpacing } from './format/PxAnimatorConstants';
// The remaining wire enums (review §2.7). `PxFillMode` / `PxOffScreenAction` / `PxMouseOutAction` /
// `PxPlaybackDirection` / `PxTriggerStart` are exported above and must NOT be repeated here —
// one export per identifier.
export {
    PxAlongPathMode,
    PxFinishAction,
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
