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
    WIRE_VERSION_KEY,
    PLAYER_WIRE_VERSION,
    BASELINE_PLAYER_VERSION,
    PLAYER_WIRE_STEPS,
    WireVersionRelation,
    parseWireVersion,
    formatWireVersion,
    readWireVersion,
    compareWireVersion,
    versionAdvice,
    convertPlayerDocument,
    applyWireSteps,
    downgradePlayerDocument,
    WireStepKind,
} from './version/PxWireVersion';
export type {
    WireVersion,
    WireVersionStep,
    PlayerConversionResult,
    WireConversionConfig,
} from './version/PxWireVersion';
export type { PxInfer, PxSchema, PxSchemaDesc, PxValidationContext, RemoveIndex } from './schema/PxSchema';

// Wire-format schemas
export { PxAnimatedSvgDocumentSchema, PxAnimatorConfigSchema, PxAttrValueSchema, PxBezierPathSchema, PxDefsSchema, PxElementAnimationSchema, PxKeyframeSchema, PxKeyframeValueSchema, PxLoopSchema, PxNodeBase, PxNodeSchema, PxPropertyAnimationSchema, PxSvgNodeExtra, PxTransformPartsSchema, PxTriggerSchema, PxTimelineSchema, PxTransformValueSchema } from './format/PxAnimatorTypes';
export { resolveTimelineEngine, isNativeForced, mayUseNativeScrollTimeline, PxTimelineEngine, PxCloneWithout, PxTimelineEngineExtra, PX_TRIGGER_DEFAULTS, resolveTrigger, PX_TRANSFORM_PART_KEYS } from './format/PxAnimatorConstants';
// ONE control-mode rule for react / vue / rn (API review §1, §7) — logic + warning text.
export { PxControlMode, resolveControlMode, controlModeTakesOverTrigger } from './format/PxAnimatorConstants';
export type { PxControlProps } from './format/PxAnimatorConstants';
export { PX_PLAYER_SCHEMA_VERSION } from './version/PxSchemaVersion';

// Document / model types
export type { PxAnimatedSvgDocument, PxAnimationDefinition, PxAnimatorAPI, PxEngineCallbacks, PxAnimatorConfig, PxBasicAnimatorAPI, PxBezierPath, PxBinding, PxDefs, PxElementAnimation, PxGlyph, PxGlyphFont, PxKeyframe, PxLoop, PxNode, PxPropertyAnimation, PxScroll, PxScrollRangePoint, PxSvgNode, PxTimeline, PxTransformParts, PxTrigger, PxTransformValue } from './format/PxAnimatorTypes';
// VALUE exports, not `export type`: each wire enum is a const namespace AND the string type
// derived from it under the same name (review §2.7), so a consumer gets both `PxStartOn.click`
// and `startOn?: PxStartOn` from one import.
export { PxFillMode, PxOutAction, PxPlaybackDirection, PxStartOn } from './format/PxAnimatorConstants';

export { isPxElementFileFormatDeep } from './format/PxAnimatorTypes';
export { getBindings, getChildren, getDefs } from './format/PxAnimatorConstants';
export { getAnimatorConfig, isPxElementFileFormat, flattenAnimatorTimeline, nestAnimatorTimeline } from './format/PxAnimatorConstants';

// Utils (string/color/easing/bezier math)

// Document id regeneration (fresh ids + rewritten internal refs)
export { generateNewIds } from './util/PxIdUtil';

// Node props normalization + attribute/tag sanitization (platform-neutral —
// renderers on every platform share the same security and normalization rules)
export {
    getNormalizedProps,
} from './util/PxNodeProps';

// Normalization / interpolation
export {
    calcAnimationValues,
    getNormalizedBindings,
} from './animation/PxDefinitions';

// Motion-along-path materializer (sampling)

// `<use>` instance materializer

// Single-call materialization pipeline (effects → loops → motion-path → use)
export { materializeAllInTree } from './materialize/PxAnimatorMaterializeAll';

// Adapter-driven frame-loop engine (platform-neutral playback)
export { createBasicFrameLoopAnimator } from './playback/PxFrameLoop';
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
export { PxDiagnosticKind } from './playback/PxDiagnostics';
export type { PxDiagnostic, PxDiagnostics, PxDiagnosticsConfig } from './playback/PxDiagnostics';

// The shapes every framework component shares (review §9) — one definition, three aliases.
export type { PxAnimatorHandle, PxAnimatorCallbacks } from './format/PxAnimatorTypes';
export type { PxPlaybackOverrideProps } from './playback/PxAnimatorConfigPatch';

// Element-creation factory + glyph-text materializer

// Player-effects materializer + visual-model diff harness
export { applyPlayerEffects } from './effects/PlayerEffectsUtil';

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
export type { PxAnimatorConfigPatch, PxAnimatorConfigMergeResult, PxAnimatorConfigShortcuts, PxTimelinePatch } from './playback/PxAnimatorConfigPatch';
export { PxGradientSpreadMethod, PxGradientType, PxLoopDirection, PxLoopRepeatAt, PxStrokeTrimSubPaths, PxUnits, PxMaskType, PxPathOverflow, PxLengthAdjust, PxTextPathMethod, PxTextPathSpacing } from './format/PxAnimatorConstants';
// The remaining wire enums (review §2.7). `PxFillMode` / `PxOutAction` / `PxPlaybackDirection` /
// `PxStartOn` are exported above and must NOT be repeated here — one export per identifier.
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
    Vec2,
} from './format/PxAnimatorTypes';

// Loop snap-back gap — the editor imports this so both sides stay in lockstep.

// Internal to this repository: the editor and the sibling packages import these.
// (A `/internal` entry point needs a published release first — see API-SURFACE-REVIEW.md §E.)
export { LOOP_JUMP_SHIFT_MS, interpolateValue, mergeStaticTransformIntoAnimDef } from './animation/PxDefinitions';
export { diffInEffect } from './effects/PlayerEffectsUtil.visualModel';
export type { PxCreateElement } from './effects/text/elementFactory';
export { createPathSampler } from './effects/text/pathSampler';
export { layoutGlyphTextChars, materializeGlyphText, materializeGlyphTextAlongPath } from './effects/text/textGlyphsEffect';
export type { GlyphCharBox } from './effects/text/textGlyphsEffect';
export { extendedPathForBrowser } from './effects/text/textPathEffect';
export { PX_ANIM_ATTR_NAME, PX_ANIM_SRC_ATTR_NAME, TEXT_CONTENT_ATTR } from './format/PxAnimatorConstants';
export { kfEasing, kfValue } from './format/PxAnimatorTypes';
export type { PxAnimatable, PxAnyKeyframe, PxNormalizedKeyframe, PxNormalizedPropertyAnimation } from './format/PxAnimatorTypes';
export { reportDocumentDiagnostics } from './format/PxDocumentDiagnostic';
export type { MaterializeAllOptions } from './materialize/PxAnimatorMaterializeAll';
export { materializeMotionPathInPropAnim } from './materialize/PxMotionPath';
export { createDiagnostics } from './playback/PxDiagnostics';
export { isScrollTimeline, scrollOffsetProgress, scrollPhaseInterval, scrollResolveAxis, scrollTotalDurationMs, scrollViewProgress } from './playback/PxScrollMath';
export { PX_UNKNOWN_KEY_ERROR } from './schema/PxSchema';
export { COLOR_ATTR_NAMES, DEFAULT_DURATION_MS, PCT_BASED_ATTR_NAMES, STYLE_ATTR_NAMES, TRANSFORM_FN_NAMES, bezierToSvgPath, camelCaseToKebabWordIfNeeded, clamp, composeTransformParts, cubicBezier, kebabToCamelCaseWord, reverseEasing, splitEasing, subdivideCubicBezier, toRGBA } from './util/PxAnimatorUtil';
export { deepClone, generateUniqueId } from './util/PxIdUtil';
export { CSS_ONLY_STYLE_PROPS, DISALLOWED_SVG_TAGS_LOWER, sanitizeAttributeValue } from './util/PxNodeProps';
export { schemaFieldUniverse } from './version/PxSchemaFieldUniverse';
export { diffFieldUniverse, planSchemaRelease, releaseLogProblems } from './version/PxSchemaRelease';
