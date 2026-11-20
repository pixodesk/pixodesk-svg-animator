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
import type { PxCssRangeName, PxStateHolder } from '@pixodesk/svg-animator-core/internal';

/**
 * DOM specializations of the platform-neutral player API types.
 * `getRootElement()` returns a DOM `Element` on the web — these aliases keep
 * the historical (pre-core-extraction) signatures for web consumers.
 * @public
 */
/** @public */
export type PxAnimationPlayerApi = PxAnimatorAPICore<Element>;

/** A build of the player before `variables` is added — what the engines and the binders return; with states, the
 *  state clock — or, with several timelines, the picture's states — the components' `state` prop holds. @internal */
export type PxPlayerEngineApi = Omit<PxAnimationPlayerApi, 'variables'> & { stateHolder?: PxStateHolder };

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
