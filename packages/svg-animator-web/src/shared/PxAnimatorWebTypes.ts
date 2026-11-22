/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type {
    PxAnimationPlayerApi as PxAnimatorAPICore,
} from '@pixodesk/svg-animator-core';
import type {
    PxEngineAnimationPlayerApi as PxEngineAnimatorApiCore,
} from '@pixodesk/svg-animator-core/engine';
import type { PxCssRangeName, PxFlowHolder } from '@pixodesk/svg-animator-core/internal';
import type { PxFlowStepPlayer } from '@pixodesk/svg-animator-core/engine';

/**
 * DOM specializations of the platform-neutral player API types.
 * `getRootElement()` returns a DOM `Element` on the web — these aliases keep
 * the historical (pre-core-extraction) signatures for web consumers.
 * @public
 */
/** @public */
export type PxAnimationPlayerApi = PxAnimatorAPICore<Element>;

/** A build of the player before `variables` is added — what the engines and the binders return; with flows, what
 *  the components' `flowStep` prop holds. @internal */
export type PxPlayerEngineApi = Omit<PxAnimationPlayerApi, 'variables'> & { flowHolder?: PxFlowHolder };

/** One document bound to one engine — a player of one timeline, and what a flow's step is built as (2026-11-22). @internal */
export type PxBoundPlayerApi = PxPlayerEngineApi & PxFlowStepPlayer;

/** What the web ENGINES construct — the api minus `playback` (the buttons, seeks and reads), composed in `finaliseAnimator`.
 *  @public @advanced */
export type PxEngineAnimationPlayerApi<TRoot = Element> = PxEngineAnimatorApiCore<TRoot>;

/**
 * A WAAPI `TimelineRangeOffset` — what `Animation.rangeStart` / `rangeEnd` take; not in the DOM typings yet:
 * a CSS percentage (`CSS.percent(…)`), plus the named range on a VIEW timeline (`cover`, `entry`, …).
 * @internal
 */
export interface PxNativeRangeOffset {
    rangeName?: PxCssRangeName;
    offset: CSSNumericValue;
}
