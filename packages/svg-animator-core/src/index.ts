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
} from './PxScrollMath';

export { px, schemaKeys, describeSchema } from './PxSchema';
export type { KeysMatch, PxInfer, PxSchema, PxSchemaDesc, PxValidationContext, RemoveIndex } from './PxSchema';

// Wire-format schemas
export { PxAnimatedSvgDocumentSchema, PxAnimationDefinitionSchema, PxAnimatorConfigSchema, PxAttrValueSchema, PxBezierPathSchema, PxBindingSchema, PxDefsSchema, PxEasingOrRefSchema, PxElementAnimationSchema, PxKeyframeSchema, PxKeyframeValueSchema, PxLoopSchema, PxNodeBase, PxNodeSchema, PxPropertyAnimationSchema, PxSvgNodeExtra, PxTransformPartsSchema, PxTransformValueSchema, PxTriggerSchema } from './PxAnimatorTypes';
export { PX_TRANSFORM_PART_KEYS, PxAnimatorEngine, PxAnimatorMode } from './PxAnimatorConstants';

// Document / model types
export type { PxAnimatedSvgDocument, PxAnimationDefinition, PxAnimatorAPI, PxAnimatorCallbacksConfig, PxAnimatorConfig, PxAttrValue, PxBasicAnimatorAPI, PxBezierPath, PxBinding, PxDefs, PxElementAnimation, PxGlyph, PxGlyphFont, PxKeyframe, PxLoop, PxNode, PxPropertyAnimation, PxScroll, PxScrollPhase, PxScrollRangePoint, PxSvgNode, PxTransformParts, PxTransformValue, PxTrigger, PxValidationResult } from './PxAnimatorTypes';
export type { FillMode, JsMode, OutAction, PlaybackDirection, PxTransformPartKey, StartOn } from './PxAnimatorConstants';

export { isPxElementFileFormatDeep } from './PxAnimatorTypes';
export { getBindings, getChildren, getDefs } from './PxAnimatorConstants';
export { getAnimatorConfig, isPxElementFileFormat } from './PxAnimatorConstants';

export { INTERNAL_ATTRS, PX_ANIM_ATTR_NAME, PX_ANIM_SRC_ATTR_NAME, TEXT_ATTR, TEXT_CONTENT_ATTR } from './PxAnimatorConstants';

// Utils (string/colour/easing/bezier math)
export {
    bezierToSvgPath,
    camelCaseToKebabWordIfNeeded,
    clamp,
    COLOUR_ATTR_NAMES,
    PCT_BASED_ATTR_NAMES,
    composeTransformParts,
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
} from './PxAnimatorUtil';

// Document id regeneration (fresh ids + rewritten internal refs)
export { deepClone, generateNewIds, generateUniqueId } from './PxIdUtil';

// Node props normalisation + attribute/tag sanitisation (platform-neutral —
// renderers on every platform share the same security and normalisation rules)
export {
    CSS_ONLY_STYLE_PROPS,
    DISALLOWED_SVG_TAGS_LOWER,
    getNormalizedProps,
    resolveStyle,
    sanitiseAttributeValue
} from './PxNodeProps';

// Normalization / interpolation
export {
    calcAnimationValues,
    getNormalisedBindings,
    interpolateValue,
    materialiseInternalLoopsInPropAnim,
    materialiseInternalLoopsInTree,
} from './PxDefinitions';

// Motion-along-path materialiser (sampling)
export {
    materialiseMotionPathInPropAnim,
    materialiseMotionPathsInTree,
    evaluateMotionPathSegment,
    propAnimIsMotionPath,
} from './PxMotionPath';
export type { MotionPathMaterialisationOptions, MotionPathSample } from './PxMotionPath';

// `<use>` instance materialiser
export { materialiseAnimatedUseInstances } from './PxAnimatorUseMaterialiser';

// Single-call materialisation pipeline (effects → loops → motion-path → use)
export { materialiseAllInTree } from './PxAnimatorMaterialiseAll';
export type { MaterialiseAllOptions } from './PxAnimatorMaterialiseAll';

// Adapter-driven frame-loop engine (platform-neutral playback)
export { createBasicFrameLoopAnimator } from './PxFrameLoop';
export type { PxPlatformAdapter } from './PxFrameLoop';

// Element-creation factory + glyph-text materialiser
export { jsonElementFactory } from './effects/elementFactory';
export type { PxCreateElement } from './effects/elementFactory';
export { layoutGlyphTextChars, materialiseGlyphText, materialiseGlyphTextAlongPath, materialiseGlyphTextHorizontal, MISSING_GLYPH_CLASS_NAME } from './effects/textGlyphsEffect';
export type { GlyphCharBox, GlyphCharBoxAlongPath, GlyphMaterialiseOpts } from './effects/textGlyphsEffect';
export { createPathSampler } from './effects/pathSampler';
export type { PathPoint, PathSampler } from './effects/pathSampler';
export { extendedPathForBrowser, shiftAnimatable } from './effects/textPathEffect';
export type { ExtendPathOpts, ExtendedPath } from './effects/textPathEffect';

// Player-effects materialiser + visual-model diff harness
export { applyPlayerEffects } from './effects/PlayerEffectsUtil';
export type { ApplyResult } from './effects/types';
export { collectSampleTimes, diffInEffect, visualModelAt } from './effects/PlayerEffectsUtil.visualModel';

// Effects schemas + walker validator
export { PxCloneEffectSchema, PxEffectsSchema, PxFillGradientEffectSchema, PxGradientStopSchema, PxMaskedByEffectSchema, PxRepeaterEffectSchema, PxRetimeEffectSchema,
    PxScrollRangePointSchema,
    PxScrollRangeSchema,
    PxScrollSchema, PxStrokeGradientEffectSchema, PxTextPathEffectSchema, PxTextEffectSchema, PxTransformByEffectSchema, PxStrokeTrimEffectSchema, validateNodeEffects } from './PxAnimatorTypes';
export { PxGradientSpreadMethod, PxGradientType, PxLoopExtend, PxStrokeTrimSubPaths, PxGradientUnits } from './PxAnimatorConstants';
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
} from './PxAnimatorTypes';

// Loop snap-back gap — the editor imports this so both sides stay in lockstep.
export { LOOP_JUMP_SHIFT_MS } from './PxDefinitions';
