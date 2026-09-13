/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type {
    PxAnimatorApi as PxAnimatorAPICore,
    PxPlaybackApi as PxBasicAnimatorAPICore,
} from '@pixodesk/svg-animator-core';

/**
 * DOM specializations of the platform-neutral animator API types.
 * `getRootElement()` returns a DOM `Element` on the web — these aliases keep
 * the historical (pre-core-extraction) signatures for web consumers.
 * @public
 */
export type PxPlaybackApi = PxBasicAnimatorAPICore<Element>;
/** @public */
export type PxAnimatorApi = PxAnimatorAPICore<Element>;
