/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

/**
 * A feature-explorer fixture, as written by the editor.
 *
 * Deliberately looser than `PxAnimatedSvgDocument`: these files are DATA
 * exported from another system and contain a few keys the player's schema does
 * not declare (`animator.timeline`, and animated-gradient-geometry payloads).
 * Typing them strictly would mean hand-editing 118 generated fixtures, which
 * defeats the point of copying them verbatim. The player validates at runtime
 * anyway — `validateNodeEffects` reports anything genuinely malformed.
 */
export interface SvgaCaseJson {
    type: 'svg';
    [key: string]: any;
}
