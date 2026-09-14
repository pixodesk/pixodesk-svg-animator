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
