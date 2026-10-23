/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import SvgAnimationPlayer from './SvgAnimator';
export { SvgAnimationPlayer };
export type { PxAnimationPlayerHandle } from '@pixodesk/svg-animator-core';

import SvgCssAnimationPlayer from './SvgCssAnimator';
export { SvgCssAnimationPlayer };

// The document type, so a TypeScript user can cast a JSON import without a second package.
export type { PxDocument } from '@pixodesk/svg-animator-web';
