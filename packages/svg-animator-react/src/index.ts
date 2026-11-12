/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import SvgAnimationPlayer from './SvgAnimator';
export type { SvgAnimationPlayerCallbacks, SvgAnimationPlayerProps } from './SvgAnimator';
export type { PxAnimationPlayerHandle, PxPlaybackControls } from '@pixodesk/svg-animator-core';
export { SvgAnimationPlayer };

import SvgCssAnimationPlayer from './SvgCssAnimator';
export type { SvgCssAnimationPlayerProps } from './SvgCssAnimator';
export { SvgCssAnimationPlayer };

// The document type, so a TypeScript user can cast a JSON import without a second package.
export type { PxDocument } from '@pixodesk/svg-animator-web';
