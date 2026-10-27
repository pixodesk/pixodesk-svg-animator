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
import type { PxCssScrollPhase } from '@pixodesk/svg-animator-core/internal';

/**
 * DOM specializations of the platform-neutral player API types.
 * `getRootElement()` returns a DOM `Element` on the web — these aliases keep
 * the historical (pre-core-extraction) signatures for web consumers.
 * @public
 */
/** @public */
export type PxAnimationPlayerApi = PxAnimatorAPICore<Element>;

/** What the web ENGINES construct — the api minus `playOnce`, composed in `finaliseAnimator`.
 *  @public @advanced */
export type PxEngineAnimationPlayerApi<TRoot = Element> = PxEngineAnimatorApiCore<TRoot>;

/**
 * A WAAPI `TimelineRangeOffset` — what `Animation.rangeStart` / `rangeEnd` take; not in the DOM typings yet:
 * a CSS percentage (`CSS.percent(…)`), plus the named phase on a VIEW timeline (`cover`, `contain`, …).
 * @internal
 */
export interface PxNativeRangeOffset {
    rangeName?: PxCssScrollPhase;
    offset: CSSNumericValue;
}
