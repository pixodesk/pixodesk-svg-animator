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
// `@pixodesk/svg-animator-core` instead — see API-SURFACE-REVIEW.md §4.
//
// These names are ALSO still on the main entry for this release, so the editor keeps working
// against the published package until it moves across. The next release drops them from there.
// ============================================================================

export { PX_LOOP_JUMP_SHIFT_MS, interpolateValue, mergeStaticTransformIntoAnimDef } from './animation/PxDefinitions';
export { diffInEffect } from './effects/PlayerEffectsUtil.visualModel';
export type { PxCreateElement } from './effects/text/elementFactory';
export { createPathSampler } from './effects/text/pathSampler';
export { layoutGlyphTextChars, materializeGlyphText, materializeGlyphTextAlongPath } from './effects/text/textGlyphsEffect';
export type { PxGlyphCharBox } from './effects/text/textGlyphsEffect';
export { extendedPathForBrowser } from './effects/text/textPathEffect';
export { PX_ANIM_ATTR_NAME, PX_ANIM_SRC_ATTR_NAME, PX_TEXT_CONTENT_ATTR } from './format/PxAnimatorConstants';
export { keyframeEasing, keyframeValue } from './format/PxAnimatorTypes';
export type { PxAnimatable, PxAnyKeyframe, PxNormalizedKeyframe, PxNormalizedPropertyAnimation } from './format/PxAnimatorTypes';
export { reportDocumentDiagnostics } from './format/PxDocumentDiagnostic';
export type { PxMaterializeAllOptions } from './materialize/PxAnimatorMaterializeAll';
export { materializeMotionPathInPropAnim } from './materialize/PxMotionPath';
export { createDiagnostics } from './playback/PxDiagnostics';
export { isScrollTimeline, scrollOffsetProgress, scrollPhaseInterval, scrollResolveAxis, scrollTotalDurationMs, scrollViewProgress } from './playback/PxScrollMath';
export { PX_UNKNOWN_KEY_ERROR } from './schema/PxSchema';
export { PX_COLOR_ATTR_NAMES, PX_DEFAULT_DURATION_MS, PX_PCT_BASED_ATTR_NAMES, PX_STYLE_ATTR_NAMES, PX_TRANSFORM_FN_NAMES, bezierToSvgPath, camelCaseToKebabWordIfNeeded, clamp, composeTransformParts, cubicBezier, kebabToCamelCaseWord, reverseEasing, splitEasing, subdivideCubicBezier, toRGBA } from './util/PxAnimatorUtil';
export { deepClone, generateUniqueId } from './util/PxIdUtil';
export { PX_CSS_ONLY_STYLE_PROPS, PX_DISALLOWED_SVG_TAGS_LOWER, sanitizeAttributeValue } from './util/PxNodeProps';
export { schemaFieldUniverse } from './version/PxSchemaFieldUniverse';
export { diffFieldUniverse, planSchemaRelease, releaseLogProblems } from './version/PxSchemaRelease';
