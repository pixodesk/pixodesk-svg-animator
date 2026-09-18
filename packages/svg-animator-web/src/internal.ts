/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// ============================================================================
// @pixodesk/svg-animator-web/internal — NOT a public API.
//
// Everything here is `@internal`: exported so the Pixodesk editor and the sibling player
// packages stay in lockstep with the player, and for no other reason. It may change in any
// release, with no note and no deprecation. If you are not this repository, import from
// `@pixodesk/svg-animator-web` instead — see dev-docs/reviews/api-surface-review.md §4.
//
// These names are ALSO still on the main entry for this release, so the editor keeps working
// against the published package until it moves across. The next release drops them from there.
// ============================================================================

// The key the editor writes into every exported SVG+JS (`createAnimator({"doc": …})`), so the
// two sides cannot disagree about its spelling.
export { PX_ANIMATOR_DOC_KEY } from './shared/PxAnimatorKeys';

// The public options plus `adapter` — what the React and Vue components build the player with.
export type { PxInternalAnimatorOptions } from './animator/PxAnimator';

// The visibility gate the JSON player wires for every document, so the CSS-only React and Vue
// wrappers gate on exactly the same rules (threshold, dwell, hysteresis, hidden tab) instead of
// each growing its own IntersectionObserver with its own edge cases.
export { createVisibilityGate, PLAY_WHEN_VISIBLE_DEFAULTS } from './triggers/PxVisibilityGate';
export type { PxGateHost, PxGateTrigger, PxVisibilityGate } from './triggers/PxVisibilityGate';
