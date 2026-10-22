/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// ============================================================================
// @pixodesk/svg-animator-core/internal — NOT a public API.
//
// Everything here is `@internal`: exported so the Pixodesk editor and the sibling player
// packages stay in lockstep with the player, and for no other reason. It may change in any
// release, with no note and no deprecation. If you are not this repository, import from
// `@pixodesk/svg-animator-core` instead — see dev-docs/reviews/api-surface-review.md §4.
//
// These names are ALSO still on the main entry for this release, so the editor keeps working
// against the published package until it moves across. The next release drops them from there.
// ============================================================================

export { PX_LOOP_JUMP_SHIFT_MS, mergeStaticTransformIntoAnimDef } from './animation/PxDefinitions';
export { channelKindOf, mapChannelKeyframes, type PxChannelLerp } from './animation/PxRuntimeChannel';
export { diffInEffect } from './effects/PlayerEffectsUtil.visualModel';
export { createPathSampler } from './effects/text/pathSampler';
export { layoutGlyphTextChars, materializeGlyphText, materializeGlyphTextAlongPath } from './effects/text/textGlyphsEffect';
export type { PxGlyphCharBox, GlyphFactory, GlyphFontsInput, GlyphMotion, GlyphPaint, GlyphPathProps, GlyphTextNode, GlyphVisibility } from './effects/text/textGlyphsEffect';
export { extendedPathForBrowser } from './effects/text/textPathEffect';
export { PX_ANIM_ATTR_NAME, PX_ANIM_SRC_ATTR_NAME, PX_TEXT_CONTENT_ATTR, PX_DEFAULT_ITERATIONS, PX_DEFAULT_UNITS_PER_EM } from './format/PxAnimatorConstants';
export { keyframeEasing, keyframeValue } from './format/PxAnimatorTypes';
export type { PxAnimatable, PxAnyKeyframe, PxNormalizedKeyframe, PxNormalizedPropertyAnimation } from './format/PxAnimatorTypes';
export { diagnoseDocument, reportDocumentDiagnostics, reportDocumentProblems } from './format/PxDocumentDiagnostic';
// Stage-stamp plumbing for players that derive a doc from a prepared one without touching its config.
export { carryPrep } from './format/PxAnimatorConstants';
// Wire `timeline` → runtime view (review §17a: renamed from flattenAnimatorTimeline, demoted from the
// main entry) — public code reads the view through `getAnimatorConfig` / `prepareDocument`.
export { resolveAnimatorTimeline } from './format/PxAnimatorConstants';
// A motion-path segment table — owned by whoever evaluates segments repeatedly (an animator, a compile).
export { createMotionPathSegments } from './materialize/PxMotionPath';
export { PxNormalizedPathValueSchema } from './format/PxAnimatorTypes';
export { legacyAnimatorOf } from './format/PxDocStage';
export type { MotionPathSegments } from './materialize/PxMotionPath';
// The bump-site string (review §16): public code reads `PX_WIRE_VERSION` / `formatWireVersion`.
export { PX_WIRE_SCHEMA_VERSION } from './version/PxSchemaVersion';
// The narrow document checkers (review §15): `validateDocument` on the MAIN entry is the one
// public answer; these are the plumbing it is built from, for players and the editor.
export { isValidPxDocument, validateDeprecatedTransformChannels, validateEasingRefs, validateNodeEffects, validateVersionStamp } from './format/PxAnimatorTypes';
export type { PxMaterializeAllOptions } from './materialize/PxAnimatorMaterializeAll';
export { prepareDocumentForRender } from './pipeline/PxPrepareDocument';
export { renderPxTree } from './render/PxRenderTree';
export type { PxElementFactory, PxElementSpec } from './render/PxRenderTree';
export { materializeMotionPathInPropAnim } from './materialize/PxMotionPath';
export { createDiagnostics } from './playback/PxDiagnostics';
export { isScrollTimeline, scrollOffsetProgress, scrollPhaseInterval, scrollResolveAxis, scrollTotalDurationMs, scrollViewProgress } from './playback/PxScrollMath';
export { PX_UNKNOWN_KEY_ERROR } from './schema/PxSchema';
export { PX_VALIDATION_ROOT_SEGMENT } from './format/PxAnimatorTypes';
export { PX_COLOR_ATTR_NAMES, PX_DEFAULT_DURATION_MS, PX_PCT_BASED_ATTR_NAMES, PX_STYLE_ATTR_NAMES, PX_TRANSFORM_FN_NAMES, bezierToSvgPath, camelCaseToKebabWordIfNeeded, clamp, composeTransformParts, cubicBezier, kebabToCamelCaseWord, reverseEasing, splitEasing, subdivideCubicBezier, toRGBA } from './util/PxAnimatorUtil';
export { deepClone, generateUniqueId } from './util/PxIdUtil';
export { deepEquals } from './util/PxDeepEquals';
export { PX_CSS_ONLY_STYLE_PROPS, PX_DISALLOWED_SVG_TAGS_LOWER, sanitizeAttributeValue } from './util/PxNodeProps';
export { schemaFieldUniverse } from './version/PxSchemaFieldUniverse';
export { diffFieldUniverse, planSchemaRelease, releaseLogProblems } from './version/PxSchemaRelease';
