/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// ============================================================================
// @pixodesk/svg-animator-web — browser player.
// The platform-neutral parts (schema, types, materializers, interpolation,
// sampling, frame-loop engine) live in @pixodesk/svg-animator-core and are
// re-exported here so this package's public surface is unchanged by the core
// extraction. Core is bundled into this package's dist (tsup `noExternal`),
// so consumers — including the UMD build — stay self-contained.
// ============================================================================

// `createAnimatorImpl` is no longer exported (review §11): six positional parameters, marked
// internal, and nothing outside this file ever called it — `createAnimator` is the door.
export { createAnimator, generateNewIds, loadTagAnimators, PX_ANIMATOR_DOC_KEY } from './animator/PxAnimator';
export type { PxTagAnimatorOptions } from './animator/PxAnimator';

export { px, schemaKeys, describeSchema } from '@pixodesk/svg-animator-core';
export type { KeysMatch, PxInfer, PxSchema, PxSchemaDesc, PxValidationContext, RemoveIndex } from '@pixodesk/svg-animator-core';

export type { PxAnimatorOptions } from './animator/PxAnimator';
export type { PxAnimatorConfigPatch, PxAnimatorConfigMergeResult, PxAnimatorConfigShortcuts, PxTimelinePatch } from '@pixodesk/svg-animator-core';
export {
    PX_TRANSFORM_PART_KEYS,
    PxAnimatedSvgDocumentSchema,
    PxAnimationDefinitionSchema,
    PxAnimatorConfigSchema,
    PxTimelineEngine,
    PxTimelineEngineExtra,
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
    PxFillMode, PxOutAction, PxPlaybackDirection,
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
    PxNormalizedKeyframe,
    PxAnyKeyframe,
    PxLoop,
    PxNode,
    PxPropertyAnimation,
    PxSvgNode,
    PxTransformPartKey,
    PxTransformParts,
    PxTransformValue,
    PxTrigger,
    PxValidationResult,
    PxStartOn
} from '@pixodesk/svg-animator-core';

// DOM specializations — on the web `getRootElement()` returns a DOM Element.
export type { PxAnimatorAPI, PxBasicAnimatorAPI } from './shared/PxAnimatorWebTypes';

export {
    getAnimatorConfig,
    getBindings,
    getChildren,
    getDefs,
    isPxElementFileFormat,
    isPxElementFileFormatDeep
} from '@pixodesk/svg-animator-core';

export { PX_ANIM_ATTR_NAME, PX_ANIM_SRC_ATTR_NAME } from '@pixodesk/svg-animator-core';
// ONE control-mode rule for every component (API review §1, §7). React and Vue reach core
// through this package, so the resolver is forwarded here; React Native imports core directly.
export { PxControlMode, resolveControlMode, controlModeTakesOverTrigger } from '@pixodesk/svg-animator-core';
export type { PxControlProps, PxResolvedControlMode } from '@pixodesk/svg-animator-core';

// The ONE diagnostics channel every player reports through (review §5).
export { createDiagnostics, PxDiagnosticKind } from '@pixodesk/svg-animator-core';
export type { PxDiagnostic, PxDiagnostics, PxDiagnosticsConfig } from '@pixodesk/svg-animator-core';

// The shapes every framework component shares (review §9) — one definition, three aliases.
export type { PxAnimatorHandle, PxComponentCallbacks, PxPlaybackOverrideProps } from '@pixodesk/svg-animator-core';

// The time contract (review §3) and the trigger defaults, so the components map `progress` and
// thresholds with core's rule instead of re-deriving it.
export { progressToTimeMs, timeToProgress, DEFAULT_DURATION_MS, PX_TRIGGER_DEFAULTS, resolveTrigger } from '@pixodesk/svg-animator-core';

// The schema-version API, `diagnoseDocument` and the timeline / pin / scroll schema values
// (review §17): a web-only install no longer needs core beside it for these.
export {
    PX_PLAYER_SCHEMA_VERSION, WIRE_VERSION_KEY, PLAYER_WIRE_VERSION, BASELINE_PLAYER_VERSION, PLAYER_WIRE_STEPS,
    WireVersionRelation, WireStepKind,
    parseWireVersion, formatWireVersion, readWireVersion, compareWireVersion, versionAdvice,
    convertPlayerDocument, downgradePlayerDocument,
    diagnoseDocument,
    PxTimelineSchema, PxTimelinePinSchema, PxScrollSchema, PxScrollRangeSchema, PxScrollRangePointSchema,
} from '@pixodesk/svg-animator-core';
export type {
    WireVersion, WireVersionStep, PlayerConversionResult, WireConversionConfig,
    WireDowngradeResult, WireDowngradeConfig, PxDocumentDiagnosis,
} from '@pixodesk/svg-animator-core';
export { camelCaseToKebabWordIfNeeded, COLOR_ATTR_NAMES, STYLE_ATTR_NAMES, toRGBA, TRANSFORM_FN_NAMES } from '@pixodesk/svg-animator-core';



// Triggers
export { setupAnimationTriggers } from './triggers/PxAnimatorTriggers';

// Normalization utilities
export {
    calcAnimationValues,
    getNormalizedBindings as normalizeDocument,
    materializeInternalLoopsInPropAnim,
    materializeInternalLoopsInTree,
} from '@pixodesk/svg-animator-core';

// Motion-along-path materializer — desugars tangented `transform` kfs + `autoOrient`
// into plain sampled `{ translate, rotate? }` kfs. Called automatically by the
// player's binding pipeline; exposed so the Editor can produce a fully-flat
// document for renderers without tangent support (e.g. react-native-svg).
// Pair with `applyPlayerEffects` + `materializeInternalLoopsInTree` for the
// full flatten pipeline (see motion-along-path-waapi-rework.md).
export {
    materializeMotionPathInPropAnim,
    materializeMotionPathsInTree,
    evaluateMotionPathSegment,
    propAnimIsMotionPath,
} from '@pixodesk/svg-animator-core';
export type { MotionPathMaterializationOptions, MotionPathSample } from '@pixodesk/svg-animator-core';

// `<use>` instance materializer — replaces `<use href="#anim-target">` with
// `<g>` carrying a deep clone of the target subtree (fresh ids, rewritten
// internal refs). Workaround for WAAPI / CSS animations not propagating
// through SVG `<use>` shadow trees in Chrome and Safari.
export { materializeAnimatedUseInstances } from '@pixodesk/svg-animator-core';

// Single-call materialization pipeline — runs `applyPlayerEffects` +
// `materializeInternalLoopsInTree` + (for waapi) `materializeMotionPathsInTree`
// + `materializeAnimatedUseInstances` in the canonical order. The player calls
// this internally from `createAnimatorImpl`; exported here so the Editor's
// flat-export path uses the EXACT same function — guarantees no pipeline
// drift between in-player and out-of-player paths.
export { materializeAllInTree } from '@pixodesk/svg-animator-core';
export type { MaterializeAllOptions } from '@pixodesk/svg-animator-core';

// Low-level APIs (for advanced usage)
export { getNormalizedProps, renderNode } from './dom/PxAnimatorDOM';

// Element-creation factory + glyph-text materializer. The materializer emits
// via an injected factory so the SAME layout produces plain wire nodes (effects
// pipeline), DOM, or the editor's React/px elements — the editor calls
// `materializeGlyphText` with its own `createPxElement` for Step 3 (static SVG
// with baked glyph outlines). See textGlyphsEffect / elementFactory.
export { jsonElementFactory } from '@pixodesk/svg-animator-core';
export type { PxCreateElement } from '@pixodesk/svg-animator-core';
export { layoutGlyphTextChars, materializeGlyphText, materializeGlyphTextAlongPath, materializeGlyphTextHorizontal, MISSING_GLYPH_CLASS_NAME } from '@pixodesk/svg-animator-core';
export type { GlyphCharBox, GlyphCharBoxAlongPath, GlyphMaterializeOpts } from '@pixodesk/svg-animator-core';
export { createPathSampler } from '@pixodesk/svg-animator-core';
export type { PathPoint, PathSampler } from '@pixodesk/svg-animator-core';
export { extendedPathForBrowser, shiftAnimatable } from '@pixodesk/svg-animator-core';
export type { ExtendPathOpts, ExtendedPath } from '@pixodesk/svg-animator-core';
export { createBasicFrameLoopAnimator, createFrameLoopAnimator } from './engines/PxAnimatorFrameLoop';
export type { PxPlatformAdapter } from '@pixodesk/svg-animator-core';
export { createWebApiAnimator } from './engines/PxAnimatorWebApi';

// Player-effects materializer — turns `node.effects` (the lightweight design format
// emitted by the Editor) into a plain renderable node tree. Called automatically by
// `createAnimatorImpl` before any other normalization; exposed for the Editor's
// "equal in effect" comparison harness.
export { applyPlayerEffects } from '@pixodesk/svg-animator-core';
export type { ApplyResult } from '@pixodesk/svg-animator-core';
export { collectSampleTimes, diffInEffect, visualModelAt } from '@pixodesk/svg-animator-core';

// Effects schemas + walker validator. `createAnimatorImpl` runs `validateNodeEffects`
// on the doc before materialization and logs warnings; callers can also run it
// explicitly (Editor's test harnesses do).
export {
    PxCloneEffectSchema,
    PxEffectsSchema,
    PxFillGradientEffectSchema,
    PxGradientSpreadMethod,
    PxGradientStopSchema,
    PxCloneWithout,
    PxLoopRepeatAt,
    PxLoopDirection,
    PxStrokeTrimSubPaths,
    PxGradientType,
    PxUnits,
    // One `Px*` const per wire enum (review §2.7) — forwarded so React/Vue can name values.
    // The four that are also re-exported as TYPES above (PxFillMode, PxOutAction,
    // PxPlaybackDirection, PxStartOn) must not be repeated here: same identifier, one export.
    PxAlongPathMode,
    PxFinishAction,
    PxPinAlign,
    PxScrollAxis,
    PxScrollKind,
    PxScrollPhase,
    PxScrollSource,
    PxMaskedByEffectSchema,
    PxRepeaterEffectSchema,
    PxRetimeEffectSchema,
    PxStrokeGradientEffectSchema,
    PxTextPathEffectSchema,
    PxTextEffectSchema,
    PxTransformByEffectSchema,
    PxStrokeTrimEffectSchema,
    validateDocument,
    validateNodeEffects,
    applyAnimatorConfig,
    foldTimelineOverride,
    mergeAnimatorConfig,
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
    PxStrokeTrimEffect,
    Vec2,
} from '@pixodesk/svg-animator-core';
