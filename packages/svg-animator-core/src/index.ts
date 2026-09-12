/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// ============================================================================
// @pixodesk/svg-animator-core — platform-neutral animator core.
// Schema, document types, interpolation, materialisers (effects → plain JSON),
// sampling, and the adapter-driven frame-loop engine. No DOM: this package
// compiles without the "dom" lib and is shared by the web and React Native
// players.
// ============================================================================

// Schema toolkit
export {
    isScrollTimeline,
    scrollOffsetProgress,
    scrollPhaseInterval,
    scrollResolveAxis,
    scrollTotalDurationMs,
    scrollViewProgress,
} from './playback/PxScrollMath';

export { px, schemaKeys, describeSchema, PX_UNKNOWN_KEY_ERROR } from './schema/PxSchema';
export {
    WIRE_VERSION_KEY, PLAYER_WIRE_VERSION, BASELINE_PLAYER_VERSION, PLAYER_WIRE_STEPS,
    WireVersionRelation, WireStepKind,
    parseWireVersion, formatWireVersion, readWireVersion, compareWireVersion, versionAdvice,
    convertPlayerDocument, applyWireSteps, applyWireStepsDown, downgradePlayerDocument,
} from './version/PxWireVersion';
export { schemaFieldUniverse } from './version/PxSchemaFieldUniverse';
export { diffFieldUniverse, planSchemaRelease, releaseLogProblems } from './version/PxSchemaRelease';
export type { SchemaReleasePlan, SchemaReleaseRecord } from './version/PxSchemaRelease';
export type {
    WireVersion, WireVersionStep, PlayerConversionResult, WireConversionConfig,
    WireDowngradeResult, WireDowngradeConfig,
} from './version/PxWireVersion';
export type { KeysMatch, PxInfer, PxSchema, PxSchemaDesc, PxValidationContext, RemoveIndex } from './schema/PxSchema';

// Wire-format schemas
export { PxAnimatedSvgDocumentSchema, PxAnimationDefinitionSchema, PxAnimatorConfigSchema, PxAttrValueSchema, PxBezierPathSchema, PxBindingSchema, PxDefsSchema, PxEasingOrRefSchema, PxElementAnimationSchema, PxKeyframeSchema, PxKeyframeValueSchema, PxLoopSchema, PxNodeBase, PxNodeSchema, PxPropertyAnimationSchema, PxSvgNodeExtra, PxTransformPartsSchema, PxTransformValueSchema, PxTriggerSchema, PxTimelineSchema, PxTimelinePinSchema } from './format/PxAnimatorTypes';
export { resolveTimelineEngine, isNativeForced, mayUseNativeScrollTimeline, PX_TRANSFORM_PART_KEYS, PxTimelineEngine, PxCloneWithout, PxTimelineEngineExtra, PX_TRIGGER_DEFAULTS, resolveTrigger } from './format/PxAnimatorConstants';
// ONE control-mode rule for react / vue / rn (API review §1, §7) — logic + warning text.
export { PxControlMode, resolveControlMode, controlModeTakesOverTrigger } from './format/PxAnimatorConstants';
export type { PxControlProps, PxResolvedControlMode } from './format/PxAnimatorConstants';
export { PX_PLAYER_SCHEMA_VERSION } from './version/PxSchemaVersion';

// Document / model types
export type { PxAnimatedSvgDocument, PxAnimationDefinition, PxAnimatorAPI, PxAnimatorCallbacksConfig, PxAnimatorConfig, PxAttrValue, PxBasicAnimatorAPI, PxBezierPath, PxBinding, PxDefs, PxElementAnimation, PxGlyph, PxGlyphFont, PxKeyframe, PxNormalisedKeyframe, PxNormalisedPropertyAnimation, PxAnyKeyframe, PxLoop, PxNode, PxPropertyAnimation, PxScroll, PxScrollRangePoint, PxSvgNode, PxTimeline, PxTimelinePin, PxTransformParts, PxTransformValue, PxTrigger, PxValidationResult } from './format/PxAnimatorTypes';
export type { PxResolvedTrigger, PxTransformPartKey } from './format/PxAnimatorConstants';
// VALUE exports, not `export type`: each wire enum is a const namespace AND the string type
// derived from it under the same name (review §2.7), so a consumer gets both `PxStartOn.click`
// and `startOn?: PxStartOn` from one import.
export { PxFillMode, PxOutAction, PxPlaybackDirection, PxStartOn } from './format/PxAnimatorConstants';

export { isPxElementFileFormatDeep } from './format/PxAnimatorTypes';
export { getBindings, getChildren, getDefs } from './format/PxAnimatorConstants';
export { getAnimatorConfig, isPxElementFileFormat, flattenAnimatorTimeline, nestAnimatorTimeline } from './format/PxAnimatorConstants';

export { INTERNAL_ATTRS, PX_ANIM_ATTR_NAME, PX_ANIM_SRC_ATTR_NAME, TEXT_CONTENT_ATTR } from './format/PxAnimatorConstants';

// Utils (string/colour/easing/bezier math)
export {
    bezierToSvgPath,
    camelCaseToKebabWordIfNeeded,
    clamp,
    COLOUR_ATTR_NAMES,
    PCT_BASED_ATTR_NAMES,
    composeTransformParts,
    parseTransformParts,
    cubicBezier,
    DEFAULT_DURATION_MS,
    interpolateBeziers,
    kebabToCamelCaseWord,
    reverseEasing,
    splitEasing,
    STYLE_ATTR_NAMES,
    subdivideCubicBezier,
    toRGBA,
    TRANSFORM_FN_NAMES
} from './util/PxAnimatorUtil';

// Document id regeneration (fresh ids + rewritten internal refs)
export { deepClone, generateNewIds, generateUniqueId } from './util/PxIdUtil';

// Node props normalisation + attribute/tag sanitisation (platform-neutral —
// renderers on every platform share the same security and normalisation rules)
export {
    CSS_ONLY_STYLE_PROPS,
    DISALLOWED_SVG_TAGS_LOWER,
    getNormalizedProps,
    resolveStyle,
    sanitiseAttributeValue
} from './util/PxNodeProps';

// Normalization / interpolation
export {
    calcAnimationValues,
    getNormalisedBindings,
    mergeStaticTransformIntoAnimDef,
    interpolateValue,
    materialiseInternalLoopsInPropAnim,
    materialiseInternalLoopsInTree,
} from './animation/PxDefinitions';

// Motion-along-path materialiser (sampling)
export {
    materialiseMotionPathInPropAnim,
    materialiseMotionPathsInTree,
    evaluateMotionPathSegment,
    propAnimIsMotionPath,
} from './materialise/PxMotionPath';
export type { MotionPathMaterialisationOptions, MotionPathSample } from './materialise/PxMotionPath';

// `<use>` instance materialiser
export { materialiseAnimatedUseInstances } from './materialise/PxAnimatorUseMaterialiser';

// Single-call materialisation pipeline (effects → loops → motion-path → use)
export { materialiseAllInTree } from './materialise/PxAnimatorMaterialiseAll';
export type { MaterialiseAllOptions } from './materialise/PxAnimatorMaterialiseAll';

// Adapter-driven frame-loop engine (platform-neutral playback)
export { createBasicFrameLoopAnimator } from './playback/PxFrameLoop';
export type { PxPlatformAdapter } from './playback/PxFrameLoop';

// The ONE time contract every engine implements (review §3)
export { clampSeekMs, createRunClock, isValidPlaybackRate, progressSpanMs, progressToTimeMs,
    PX_RATE_REJECTED, seekCeilingMs, timeToProgress } from './playback/PxPlaybackTime';
export type { PxRunClock } from './playback/PxPlaybackTime';

// The ONE diagnostics channel every player reports through (review §5)
export { createDiagnostics, PxDiagnosticKind } from './playback/PxDiagnostics';
export type { PxDiagnostic, PxDiagnostics, PxDiagnosticsConfig } from './playback/PxDiagnostics';

// Element-creation factory + glyph-text materialiser
export { jsonElementFactory } from './effects/text/elementFactory';
export type { PxCreateElement } from './effects/text/elementFactory';
export { layoutGlyphTextChars, materialiseGlyphText, materialiseGlyphTextAlongPath, materialiseGlyphTextHorizontal, MISSING_GLYPH_CLASS_NAME } from './effects/text/textGlyphsEffect';
export type { GlyphCharBox, GlyphCharBoxAlongPath, GlyphMaterialiseOpts } from './effects/text/textGlyphsEffect';
export { createPathSampler } from './effects/text/pathSampler';
export type { PathPoint, PathSampler } from './effects/text/pathSampler';
export { extendedPathForBrowser, shiftAnimatable } from './effects/text/textPathEffect';
export type { ExtendPathOpts, ExtendedPath } from './effects/text/textPathEffect';

// Player-effects materialiser + visual-model diff harness
export { applyPlayerEffects } from './effects/PlayerEffectsUtil';
export type { ApplyResult } from './effects/shared/types';
export { collectSampleTimes, diffInEffect, visualModelAt } from './effects/PlayerEffectsUtil.visualModel';

// Effects schemas + walker validator
export { PxCloneEffectSchema, PxEffectsSchema, PxFillGradientEffectSchema, PxGradientStopSchema, PxMaskedByEffectSchema, PxRepeaterEffectSchema, PxRetimeEffectSchema,
    PxScrollRangePointSchema,
    PxScrollRangeSchema,
    PxScrollSchema, PxStrokeGradientEffectSchema, PxTextPathEffectSchema, PxTextEffectSchema, PxTransformByEffectSchema, PxStrokeTrimEffectSchema, validateDocument, validateNodeEffects } from './format/PxAnimatorTypes';
export { kfTime, kfValue, kfEasing, kfTangentIn, kfTangentOut } from './format/PxAnimatorTypes';
export { applyAnimatorConfig, foldAnimatorConfigShortcuts, mergeAnimatorConfig } from './playback/PxAnimatorConfigPatch';
export { diagnoseDocument, reportDocumentDiagnostics } from './format/PxDocumentDiagnostic';
export type { PxDocumentDiagnosis } from './format/PxDocumentDiagnostic';
export type { PxAnimatorConfigPatch, PxAnimatorConfigMergeResult, PxAnimatorConfigShortcuts } from './playback/PxAnimatorConfigPatch';
export { PxGradientSpreadMethod, PxGradientType, PxLoopDirection, PxLoopRepeatAt, PxStrokeTrimSubPaths, PxUnits } from './format/PxAnimatorConstants';
// The remaining wire enums (review §2.7). `PxFillMode` / `PxOutAction` / `PxPlaybackDirection` /
// `PxStartOn` are exported above and must NOT be repeated here — one export per identifier.
export { PxAlongPathMode, PxFinishAction, PxPinAlign, PxScrollAxis, PxScrollKind, PxScrollPhase,
    PxScrollSource } from './format/PxAnimatorConstants';
export type {
    PxAnimatable,
    PxCloneEffect,
    PxEffects,
    PxFillGradientEffect,
    PxGradientStop,
    PxMaskedByEffect,
    PxRepeaterEffect,
    PxRetimeEffect,
    PxStrokeGradientEffect,
    PxTextPathEffect,
    PxTransformByEffect,
    PxStrokeTrimEffect,
    Vec2,
} from './format/PxAnimatorTypes';

// Loop snap-back gap — the editor imports this so both sides stay in lockstep.
export { LOOP_JUMP_SHIFT_MS } from './animation/PxDefinitions';
