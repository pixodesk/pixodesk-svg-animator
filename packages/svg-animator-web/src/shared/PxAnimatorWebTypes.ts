/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type {
    PxAnimationPlayerApi as PxAnimatorAPICore,
    PxEngineAnimationPlayerApi as PxEngineAnimatorApiCore,
} from '@pixodesk/svg-animator-core';

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
