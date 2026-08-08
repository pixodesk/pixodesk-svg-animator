/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// ============================================================================
// UMD / iife entry — the PLAYBACK surface only.
//
// Why this file exists (see BUNDLE-SIZE-PLAN.md §1):
//   `index.ts` exports ~96 names, most of them editor-facing (schema objects,
//   validators, materialisers, the visual-diff harness). esm/cjs consumers
//   tree-shake those away, but **iife cannot tree-shake at the consumer** — so
//   every `<script>` user was downloading the transitive closure of all 96.
//
//   Building the UMD from this narrower entry lets the bundler drop what is now
//   unreachable. Measured: 114,365 -> 101,188 raw, 31,505 -> 28,417 brotli (-9.8%).
//   No code was removed from the package; `index.ts` is unchanged and esm/cjs
//   consumers keep the full surface.
//
// Rule for this file: add a name here ONLY if a `<script>` consumer calls it at
// runtime. Anything the Editor imports belongs in `index.ts`.
// ============================================================================

// The player itself. `createAnimator` is what the Editor's exported SVG+JS calls
// (`PixodeskAnimator.createAnimator({...})`); `loadTagAnimators` is the
// declarative `data-px-animation-src` bootstrap.
export {
    createAnimator,
    createAnimatorImpl,
    generateNewIds,
    loadTagAnimators,
    PX_ANIMATOR_DATA_KEY,
} from './PxAnimator';

// Trigger wiring — `createAnimator` uses it internally; exposed so a page can
// re-arm triggers after swapping document content.
export { setupAnimationTriggers } from './PxAnimatorTriggers';

// Config enums a caller needs to build `PxAnimatorOptions` by hand.
export { PxAnimatorEngine, PxAnimatorMode } from '@pixodesk/svg-animator-core';

// Attribute names used by the declarative bootstrap.
export { PX_ANIM_ATTR_NAME, PX_ANIM_SRC_ATTR_NAME } from '@pixodesk/svg-animator-core';

// Types are erased at build time — zero bytes, kept for editor tooling.
export type { PxAnimatorOptions } from './PxAnimator';
export type { PxAnimatorAPI, PxBasicAnimatorAPI } from './PxAnimatorWebTypes';
export type {
    PxAnimatedSvgDocument,
    PxAnimatorCallbacksConfig,
    PxAnimatorConfig,
    PxNode,
} from '@pixodesk/svg-animator-core';
