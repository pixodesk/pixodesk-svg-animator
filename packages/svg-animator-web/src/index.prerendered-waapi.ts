/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// ============================================================================
// UMD entry for PRE-RENDERED SVG — WAAPI only. The smallest build.
//
// Inlined by the Editor into SVG+JS exports whose animator mode is `waapi`. On top of
// what `index.prerendered.ts` drops, this also excludes the frame-loop engine: waapi is
// forced, so there is no fallback path to link against (`createWebApiAnimator` never
// returns null when forced — it only warns about unsupported attrs).
//
// Exported AS `createAnimator` so the emitted `<script>` is identical across bundles.
// See PRERENDERED-PLAYER-BUILDS.md.
// ============================================================================

export { createPrerenderedWaapiAnimator as createAnimator } from './PxAnimatorBind';
export { PX_ANIMATOR_DATA_KEY } from './PxAnimatorKeys';

export { setupAnimationTriggers } from './PxAnimatorTriggers';

export type { PxPrerenderedOptions } from './PxAnimatorBind';
export type { PxAnimatorAPI, PxBasicAnimatorAPI } from './PxAnimatorWebTypes';
export type { PxAnimatedSvgDocument, PxAnimatorCallbacksConfig } from '@pixodesk/svg-animator-core';
