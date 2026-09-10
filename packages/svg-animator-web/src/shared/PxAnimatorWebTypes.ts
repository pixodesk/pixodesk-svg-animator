/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type {
    PxAnimatorAPI as PxAnimatorAPICore,
    PxBasicAnimatorAPI as PxBasicAnimatorAPICore,
} from '@pixodesk/svg-animator-core';

/**
 * DOM specialisations of the platform-neutral animator API types.
 * `getRootElement()` returns a DOM `Element` on the web — these aliases keep
 * the historical (pre-core-extraction) signatures for web consumers.
 */
export type PxBasicAnimatorAPI = PxBasicAnimatorAPICore<Element>;
export type PxAnimatorAPI = PxAnimatorAPICore<Element>;
