/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// ============================================================================
// @pixodesk/svg-animator-web — browser player.
// The platform-neutral parts (schema, types, materialisers, interpolation,
// sampling, frame-loop engine) live in @pixodesk/svg-animator-core and are
// re-exported here so this package's public surface is unchanged by the core
// extraction. Core is bundled into this package's dist (tsup `noExternal`),
// so consumers — including the UMD build — stay self-contained.
// ============================================================================

export { createAnimator, createAnimatorImpl, generateNewIds, loadTagAnimators, PX_ANIMATOR_DATA_KEY } from './PxAnimator';

export { px, schemaKeys, describeSchema } from '@pixodesk/svg-animator-core';
export type { KeysMatch, PxInfer, PxSchema, PxSchemaDesc, PxValidationContext, RemoveIndex } from '@pixodesk/svg-animator-core';

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
    PxKeyframeValueSchema,
    PxLoopSchema,
    PxNodeBase,
    PxNodeSchema,
    PxPropertyAnimationSchema,
    PxSvgNodeExtra,
    PxTransformPartsSchema,
    PxTransformValueSchema,
    PxTriggerSchema
} from '@pixodesk/svg-animator-core';

// Types
export type {
    FillMode, JsMode, OutAction, PlaybackDirection,
    PxAnimatedSvgDocument,
    PxAnimationDefinition,
    PxAnimatorCallbacksConfig,
    PxAnimatorConfig,
    PxAttrValue,
    PxBezierPath,
    PxBinding,
    PxDefs,
    PxElementAnimation,
    PxGlyph,
    PxGlyphFont,
    PxKeyframe,
    PxLoop,
    PxNode,
    PxPropertyAnimation,
    PxSvgNode,
    PxTransformPartKey,
    PxTransformParts,
    PxTransformValue,
    PxTrigger,
    PxValidationResult,
    StartOn
} from '@pixodesk/svg-animator-core';

// DOM specialisations — on the web `getRootElement()` returns a DOM Element.
export type { PxAnimatorAPI, PxBasicAnimatorAPI } from './PxAnimatorWebTypes';

export {
    getAnimatorConfig,
    getBindings,
    getChildren,
    getDefs,
    isPxElementFileFormat,
    isPxElementFileFormatDeep
} from '@pixodesk/svg-animator-core';

export { PX_ANIM_ATTR_NAME, PX_ANIM_SRC_ATTR_NAME } from '@pixodesk/svg-animator-core';
export { camelCaseToKebabWordIfNeeded, COLOUR_ATTR_NAMES, STYLE_ATTR_NAMES, toRGBA, TRANSFORM_FN_NAMES } from '@pixodesk/svg-animator-core';



// Triggers
export { setupAnimationTriggers } from './PxAnimatorTriggers';

// Normalization utilities
export {
    calcAnimationValues,
    getNormalisedBindings as normalizeDocument,
    materialiseInternalLoopsInPropAnim,
    materialiseInternalLoopsInTree,
} from '@pixodesk/svg-animator-core';

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
} from '@pixodesk/svg-animator-core';
export type { MotionPathMaterialisationOptions, MotionPathSample } from '@pixodesk/svg-animator-core';

// `<use>` instance materialiser — replaces `<use href="#anim-target">` with
// `<g>` carrying a deep clone of the target subtree (fresh ids, rewritten
// internal refs). Workaround for WAAPI / CSS animations not propagating
// through SVG `<use>` shadow trees in Chrome and Safari.
export { materialiseAnimatedUseInstances } from '@pixodesk/svg-animator-core';

// Single-call materialisation pipeline — runs `applyPlayerEffects` +
// `materialiseInternalLoopsInTree` + (for waapi) `materialiseMotionPathsInTree`
// + `materialiseAnimatedUseInstances` in the canonical order. The player calls
// this internally from `createAnimatorImpl`; exported here so the Editor's
// flat-export path uses the EXACT same function — guarantees no pipeline
// drift between in-player and out-of-player paths.
export { materialiseAllInTree } from '@pixodesk/svg-animator-core';
export type { MaterialiseAllOptions } from '@pixodesk/svg-animator-core';

// Low-level APIs (for advanced usage)
export { getNormalizedProps, renderNode } from './PxAnimatorDOM';

// Element-creation factory + glyph-text materialiser. The materialiser emits
// via an injected factory so the SAME layout produces plain wire nodes (effects
// pipeline), DOM, or the editor's React/px elements — the editor calls
// `materialiseGlyphText` with its own `createPxElement` for Step 3 (static SVG
// with baked glyph outlines). See textGlyphsEffect / elementFactory.
export { jsonElementFactory } from '@pixodesk/svg-animator-core';
export type { PxCreateElement } from '@pixodesk/svg-animator-core';
export { layoutGlyphTextChars, materialiseGlyphText, materialiseGlyphTextAlongPath, materialiseGlyphTextHorizontal } from '@pixodesk/svg-animator-core';
export type { GlyphCharBox, GlyphCharBoxAlongPath, GlyphMaterialiseOpts } from '@pixodesk/svg-animator-core';
export { createPathSampler } from '@pixodesk/svg-animator-core';
export type { PathPoint, PathSampler } from '@pixodesk/svg-animator-core';
export { extendedPathForBrowser, shiftAnimatable } from '@pixodesk/svg-animator-core';
export type { ExtendPathOpts, ExtendedPath } from '@pixodesk/svg-animator-core';
export { createBasicFrameLoopAnimator, createFrameLoopAnimator } from './PxAnimatorFrameLoop';
export type { PxPlatformAdapter } from '@pixodesk/svg-animator-core';
export { createWebApiAnimator } from './PxAnimatorWebApi';

// Player-effects materialiser — turns `node.effects` (the lightweight design format
// emitted by the Editor) into a plain renderable node tree. Called automatically by
// `createAnimatorImpl` before any other normalisation; exposed for the Editor's
// "equal in effect" comparison harness.
export { applyPlayerEffects } from '@pixodesk/svg-animator-core';
export type { ApplyResult } from '@pixodesk/svg-animator-core';
export { collectSampleTimes, diffInEffect, visualModelAt } from '@pixodesk/svg-animator-core';

// Effects schemas + walker validator. `createAnimatorImpl` runs `validateNodeEffects`
// on the doc before materialisation and logs warnings; callers can also run it
// explicitly (Editor's test harnesses do).
export {
    PxCloneEffectSchema,
    PxEffectsSchema,
    PxFillGradientEffectSchema,
    PxGradientSpreadMethod,
    PxGradientStopSchema,
    PxGradientType,
    PxGradientUnits,
    PxMaskedByEffectSchema,
    PxRepeaterEffectSchema,
    PxRetimeEffectSchema,
    PxStrokeGradientEffectSchema,
    PxTextPathEffectSchema,
    PxTextEffectSchema,
    PxTransformByEffectSchema,
    PxTrimPathEffectSchema,
    validateNodeEffects,
} from '@pixodesk/svg-animator-core';
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
    PxTrimPathEffect,
    Vec2,
} from '@pixodesk/svg-animator-core';
