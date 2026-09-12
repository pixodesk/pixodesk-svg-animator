/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

/**
 * Wire keys shared by every entry point.
 *
 * These live here rather than in `PxAnimator.ts` on purpose: that module used to end with a
 * top-level `if (typeof window !== 'undefined')` block publishing `createAnimator` /
 * `loadTagAnimators` as globals. A module-level side effect cannot be tree-shaken, so
 * importing ANY symbol from `PxAnimator.ts` pulled the entire full player in with it —
 * which silently made the pre-rendered builds the same size as the full one until this
 * constant was moved out. See PRERENDERED-PLAYER-BUILDS.md.
 *
 * That block is gone (API review §4) and the package now declares `"sideEffects": false`, but
 * keeping these here costs nothing and removes the trap for good.
 */

/**
 * Key under which `createAnimator` options carry the inline animation document. The editor
 * writes it into every exported SVG+JS — `createAnimator({"doc": …})` — so it is part of the
 * export format, which is why it is a named constant and not a literal.
 */
export const PX_ANIMATOR_DOC_KEY = 'doc';

/** Key under which `createAnimator` options carry the per-instance `timeline` override. */
export const PX_ANIMATOR_TIMELINE_KEY = 'timeline';

/** Key that makes the override start from the player's default timeline instead of the document's. */
export const PX_ANIMATOR_RESET_KEY = 'resetTimeline';
