/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// ============================================================================
// @pixodesk/svg-animator-web/engine — for player authors.
//
// The DOM rendering the React and Vue players share, and the frame-loop engine against a
// custom render target. Supported, but you need it only to build a player; playing a document
// is the main entry, `@pixodesk/svg-animator-web` (first-use review §23).
// ============================================================================

export { renderNode, toDomProps } from './dom/PxAnimatorDOM';
export { createAdapterSvgAnimationPlayer } from './engines/PxAnimatorFrameLoop';
export type { PxPlatformAdapter } from '@pixodesk/svg-animator-core/engine';
