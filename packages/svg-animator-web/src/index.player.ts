/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// ============================================================================
// UMD / iife entry — the PLAYBACK surface only.
//
// Why this file exists (see dev-docs/plans/bundle-size.md §1):
//   `index.ts` exports ~96 names, most of them editor-facing (schema objects,
//   validators, materializers, the visual-diff harness). esm/cjs consumers
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

// The player itself. On the global, `createSvgAnimator` is the member `create` (PX_PLAYER_CREATE): a document
// into a container. `bindSvgAnimator` is `bind` (PX_PLAYER_BIND): a pre-rendered SVG already on the page — what
// the Editor's SVG+JS export calls, so an export that leaves the player to the page works with this build too.
// `loadTagSvgAnimators` is the declarative `data-px-animation-src` bootstrap.
export { createPrerenderedAnimator as bind } from './engines/PxAnimatorBind';
export {
    createSvgAnimator as create,
    generateNewIds,
    loadTagSvgAnimators,
    PX_ANIMATOR_DOC_KEY,
} from './animator/PxAnimator';

// Trigger wiring — `create` uses it internally; exposed so a page can
// re-arm triggers after swapping document content.
export { setupAnimationTriggers } from './triggers/PxAnimatorTriggers';
export { getAllSvgAnimators, onSvgAnimatorsChange } from './registry/PxAnimatorRegistry';
export type { PxAnimatorRegistry, PxAnimatorsEvent, PxAnimatorsListener } from './registry/PxAnimatorRegistry';

// Config enums a caller needs to build `PxAnimatorOptions` by hand.
export { PxTimelineEngine, PxTimelineEngineSetting, validateDocument } from '@pixodesk/svg-animator-core';

// Attribute names used by the declarative bootstrap.
export { PX_ANIM_ATTR_NAME, PX_ANIM_SRC_ATTR_NAME } from '@pixodesk/svg-animator-core/internal';

// Types are erased at build time — zero bytes, kept for editor tooling.
export type { PxAnimatorOptions } from './animator/PxAnimator';
export type { PxAnimatorApi } from './shared/PxAnimatorWebTypes';
export type {
    PxAnimatedSvgDocument,
    PxEngineCallbacks,
    PxAnimatorConfig,
    PxNode,
} from '@pixodesk/svg-animator-core';
