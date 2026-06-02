/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

export { createAnimator, createAnimatorImpl, generateNewIds, loadTagAnimators, PX_ANIMATOR_DATA_KEY } from './PxAnimator';

export { px, schemaKeys, describeSchema } from './PxSchema';
export type { KeysMatch, PxInfer, PxSchema, PxSchemaDesc, PxValidationContext, RemoveIndex } from './PxSchema';

export type { PxAnimatorOptions } from './PxAnimator';
export {
    PX_TRANSFORM_PART_KEYS,
    PxAnimatedSvgDocumentSchema,
    PxAnimationDefinitionSchema,
    PxAnimatorConfigSchema,
    PxAnimatorEngine,
    PxAnimatorMode,
    PxAttrValueSchema,
    PxBezierPathSchema,
    PxBindingSchema,
    PxDefsSchema,
    PxEasingOrRefSchema,
    PxElementAnimationSchema,
    PxKeyframeSchema,
    PxLoopSchema,
    PxNodeBase,
    PxNodeSchema,
    PxPropertyAnimationSchema,
    PxSvgNodeExtra,
    PxTransformPartsSchema,
    PxTransformValueSchema,
    PxTriggerSchema
} from './PxAnimatorTypes';

// Types
export type {
    FillMode, JsMode, OutAction, PlaybackDirection,
    PxAnimatedSvgDocument,
    PxAnimationDefinition,
    PxAnimatorAPI,
    PxAnimatorCallbacksConfig,
    PxAnimatorConfig,
    PxAttrValue,
    PxBezierPath,
    PxBinding,
    PxDefs,
    PxElementAnimation,
    PxKeyframe,
    PxNode,
    PxPropertyAnimation,
    PxSvgNode,
    PxTransformPartKey,
    PxTransformParts,
    PxTransformValue,
    PxTrigger,
    PxValidationResult,
    StartOn
} from './PxAnimatorTypes';

export {
    getAnimatorConfig,
    getBindings,
    getChildren,
    getDefs,
    isPxElementFileFormat,
    isPxElementFileFormatDeep
} from './PxAnimatorTypes';

export { PX_ANIM_ATTR_NAME, PX_ANIM_SRC_ATTR_NAME } from './PxAnimatorTypes';
export { camelCaseToKebabWordIfNeeded, COLOUR_ATTR_NAMES, STYLE_ATTR_NAMES, toRGBA, TRANSFORM_FN_NAMES } from './PxAnimatorUtil';



// Triggers
export { setupAnimationTriggers } from './PxAnimatorTriggers';

// Normalization utilities
export {
    calcAnimationValues,
    getNormalisedBindings as normalizeDocument,
    materialiseInternalLoopsInPropAnim,
    materialiseInternalLoopsInTree,
} from './PxDefinitions';

// Motion-along-path materialiser — desugars tangented `transform` kfs + `autoOrient`
// into plain sampled `{ translate, rotate? }` kfs. Called automatically by the
// player's binding pipeline; exposed so the Editor can produce a fully-flat
// document for renderers without tangent support (e.g. react-native-svg).
// Pair with `applyPlayerEffects` + `materialiseInternalLoopsInTree` for the
// full flatten pipeline (see motion-along-path-waapi-rework.md).
export {
    materialiseMotionPathInPropAnim,
    materialiseMotionPathsInTree,
    evaluateMotionPathSegment,
    propAnimIsMotionPath,
} from './PxMotionPath';
export type { MotionPathMaterialisationOptions, MotionPathSample } from './PxMotionPath';

// `<use>` instance materialiser — replaces `<use href="#anim-target">` with
// `<g>` carrying a deep clone of the target subtree (fresh ids, rewritten
// internal refs). Workaround for WAAPI / CSS animations not propagating
// through SVG `<use>` shadow trees in Chrome and Safari.
export { materialiseAnimatedUseInstances } from './PxAnimatorUseMaterialiser';

// Single-call materialisation pipeline — runs `applyPlayerEffects` +
// `materialiseInternalLoopsInTree` + (for webapi) `materialiseMotionPathsInTree`
// + `materialiseAnimatedUseInstances` in the canonical order. The player calls
// this internally from `createAnimatorImpl`; exported here so the Editor's
// flat-export path uses the EXACT same function — guarantees no pipeline
// drift between in-player and out-of-player paths.
export { materialiseAllInTree } from './PxAnimatorMaterialiseAll';
export type { MaterialiseAllOptions } from './PxAnimatorMaterialiseAll';

// Low-level APIs (for advanced usage)
export { getNormalizedProps, renderNode } from './PxAnimatorDOM';
export { createBasicFrameLoopAnimator, createFrameLoopAnimator } from './PxAnimatorFrameLoop';
export type { PxPlatformAdapter } from './PxAnimatorFrameLoop';
export { createWebApiAnimator } from './PxAnimatorWebApi';

// Player-effects materialiser — turns `node.effects` (the lightweight design format
// emitted by the Editor) into a plain renderable node tree. Called automatically by
// `createAnimatorImpl` before any other normalisation; exposed for the Editor's
// "equal in effect" comparison harness.
export { applyPlayerEffects } from './effects/PlayerEffectsUtil';
export type { ApplyResult } from './effects/types';
export { collectSampleTimes, diffInEffect, visualModelAt } from './effects/PlayerEffectsUtil.visualModel';

// Effects schemas + walker validator. `createAnimatorImpl` runs `validateNodeEffects`
// on the doc before materialisation and logs warnings; callers can also run it
// explicitly (Editor's test harnesses do).
export {
    PxEffectsSchema,
    PxFillGradientEffectSchema,
    PxGradientSpreadMethod,
    PxGradientStopSchema,
    PxGradientType,
    PxGradientUnits,
    PxMaskedByEffectSchema,
    PxRefEffectSchema,
    PxRepeaterEffectSchema,
    PxRetimeEffectSchema,
    PxStrokeGradientEffectSchema,
    PxTransformationEffectSchema,
    PxTrimPathEffectSchema,
    validateNodeEffects,
} from './PxAnimatorTypes';
export type {
    PxAnimatable,
    PxEffects,
    PxFillGradientEffect,
    PxGradientStop,
    PxMaskedByEffect,
    PxRefEffect,
    PxRepeaterEffect,
    PxRetimeEffect,
    PxStrokeGradientEffect,
    PxTransformationEffect,
    PxTrimPathEffect,
    Vec2,
} from './PxAnimatorTypes';

