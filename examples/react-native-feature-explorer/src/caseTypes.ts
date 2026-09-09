/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

/**
 * A feature-explorer fixture, as written by the editor.
 *
 * Deliberately looser than `PxAnimatedSvgDocument`: these files are DATA exported from another
 * system and still carry a few keys the player's schema does not declare (animated-gradient
 * -geometry payloads). Typing them strictly would mean hand-editing 122 fixtures, which defeats
 * the point of copying them verbatim. The player validates at runtime anyway —
 * `validateNodeEffects` reports anything genuinely malformed.
 *
 * The `animator` blocks WERE re-spelled to the wire format (2026-09-09): they used to carry the
 * flat runtime view plus a string-valued `timeline`, which the player only tolerated.
 */
export interface SvgaCaseJson {
    type: 'svg';
    [key: string]: any;
}
