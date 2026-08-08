/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// ============================================================================
// UMD entry for PRE-RENDERED SVG — both engines (waapi with frames fallback).
//
// Inlined by the Editor into SVG+JS exports whose animator mode is `auto` or
// `frames`. The exported SVG already contains every element: the payload is only
// `animator.definitions` + `animator.animateById`, so the whole construction half of
// the player (effects, materialisers, DOM rendering, schema validation) is
// unreachable and gets tree-shaken away. See PRERENDERED-PLAYER-BUILDS.md.
//
// `createPrerenderedAnimator` is exported AS `createAnimator` so the emitted
// `<script>` — `PixodeskAnimator.createAnimator({"data": …})` — is byte-identical
// regardless of which bundle the Editor inlines.
//
// Validation is deliberately absent: the Editor produced both the DOM and the
// bindings in one pass, so there is nothing a schema check could catch. External
// JSON (`src` / `data-px-animation-src`) still goes through the FULL build, which
// keeps `validateNodeEffects` and its warnings.
// ============================================================================

export { createPrerenderedAnimator as createAnimator } from './PxAnimatorBind';
export { PX_ANIMATOR_DATA_KEY } from './PxAnimatorKeys';

// Trigger wiring — used internally; exposed so a page can re-arm triggers after
// swapping document content.
export { setupAnimationTriggers } from './PxAnimatorTriggers';

// Types are erased at build time — zero bytes.
export type { PxPrerenderedOptions } from './PxAnimatorBind';
export type { PxAnimatorAPI, PxBasicAnimatorAPI } from './PxAnimatorWebTypes';
export type { PxAnimatedSvgDocument, PxAnimatorCallbacksConfig } from '@pixodesk/svg-animator-core';
