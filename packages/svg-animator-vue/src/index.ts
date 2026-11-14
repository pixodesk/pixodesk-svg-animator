/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import SvgAnimationPlayer from './SvgAnimator';
export { SvgAnimationPlayer };
export type { PxAnimationPlayerHandle, PxPlaybackControls } from '@pixodesk/svg-animator-core';
// Variables — the `variables` / `variant` props and the handle's `variables` speak these types
export type { PxVariableValue, PxVariablesApi, PxVariablesOptions } from '@pixodesk/svg-animator-core';

import SvgCssAnimationPlayer from './SvgCssAnimator';
export { SvgCssAnimationPlayer };

// The document type, so a TypeScript user can cast a JSON import without a second package.
export type { PxDocument } from '@pixodesk/svg-animator-web';
