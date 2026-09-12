/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// ============================================================================
// UMD entry for PRE-RENDERED SVG — WAAPI only. The smallest build.
//
// Inlined by the Editor into SVG+JS exports whose `timeline.engine` is `native`. On top of
// what `index.prerendered.ts` drops, this also excludes the frame-loop engine: the native
// engine is forced, so there is no fallback path to link against (`createWebApiAnimator`
// never returns null when forced — it only warns about unsupported attrs).
//
// Exported AS `createAnimator` so the emitted `<script>` is identical across bundles.
// See PRERENDERED-PLAYER-BUILDS.md.
// ============================================================================

export { createPrerenderedWaapiAnimator as createAnimator } from './engines/PxAnimatorBind';
export { PX_ANIMATOR_DOC_KEY } from './shared/PxAnimatorKeys';

export { setupAnimationTriggers } from './triggers/PxAnimatorTriggers';

export type { PxPrerenderedOptions } from './engines/PxAnimatorBind';
export type { PxAnimatorAPI, PxBasicAnimatorAPI } from './shared/PxAnimatorWebTypes';
export type { PxAnimatedSvgDocument, PxAnimatorCallbacksConfig } from '@pixodesk/svg-animator-core';
