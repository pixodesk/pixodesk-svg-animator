/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

/**
 * Wire keys shared by every entry point.
 *
 * These live here rather than in `PxAnimator.ts` on purpose: that module used to end with a
 * top-level `if (typeof window !== 'undefined')` block publishing `createSvgAnimationPlayer` /
 * `loadTagSvgAnimators` as globals. A module-level side effect cannot be tree-shaken, so
 * importing ANY symbol from `PxAnimator.ts` pulled the entire full player in with it —
 * which silently made the pre-rendered builds the same size as the full one until this
 * constant was moved out. See dev-docs/plans/prerendered-player-builds.md.
 *
 * That block is gone (API review §4) and the package now declares `"sideEffects": false`, but
 * keeping these here costs nothing and removes the trap for good.
 */

/**
 * Key under which `createSvgAnimationPlayer` options carry the animation document. The editor
 * writes it into every exported SVG+JS — `bind({"document": …})` — so it is part of the
 * export format, which is why it is a named constant and not a literal. (`doc` until 1.25: an older export embeds the
 * player it was written for, so it keeps working.)
 * @internal
 */
export const PX_ANIMATOR_DOC_KEY = 'document';

/** Key under which `createSvgAnimationPlayer` options carry the per-instance `timeline` override. */
export const PX_ANIMATOR_TIMELINE_KEY = 'timeline';

