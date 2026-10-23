/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import SvgAnimator from './SvgAnimator';
export { SvgAnimator };
export type { PxAnimatorHandle } from '@pixodesk/svg-animator-core';

import SvgCssAnimator from './SvgCssAnimator';
export { SvgCssAnimator };

// The document type, so a TypeScript user can cast a JSON import without a second package.
export type { PxDocument } from '@pixodesk/svg-animator-web';
