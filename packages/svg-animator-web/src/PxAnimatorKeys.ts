/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

/**
 * Wire keys shared by every entry point.
 *
 * These live here rather than in `PxAnimator.ts` on purpose: that module ends with a
 * top-level `if (typeof window !== 'undefined')` block that publishes `createAnimator` /
 * `loadTagAnimators` as globals. A module-level side effect cannot be tree-shaken, so
 * importing ANY symbol from `PxAnimator.ts` pulls the entire full player in with it —
 * which silently made the pre-rendered builds the same size as the full one until this
 * constant was moved out. See PRERENDERED-PLAYER-BUILDS.md.
 */

/** Key under which `createAnimator` options carry an inline animation document. */
export const PX_ANIMATOR_DATA_KEY = 'data';
