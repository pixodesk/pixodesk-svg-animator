/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/


/**
 * `dominant-baseline` for glyph-mode text — which line of the glyph box sits on the
 * text's `y`. Native text leaves this to the browser; baked glyph outlines have no
 * baseline table, so the layout shifts them by the offsets below instead.
 */

import { type PxGlyphFont } from '../../format/PxAnimatorTypes';


/** The SVG `dominant-baseline` values (SVG 2, plus the SVG 1.1 edge names that design
 *  tools still export). Unknown values render as `auto`. @internal */
export enum PxDominantBaseline {
    auto = 'auto',
    alphabetic = 'alphabetic',
    ideographic = 'ideographic',
    middle = 'middle',
    central = 'central',
    mathematical = 'mathematical',
    hanging = 'hanging',
    textTop = 'text-top',
    textBottom = 'text-bottom',
    textBeforeEdge = 'text-before-edge',
    textAfterEdge = 'text-after-edge',
}

/** Metric fallbacks, as fractions of the em, for fonts written without them. */
const FALLBACK_ASCENT_EM = 0.9;
const FALLBACK_DESCENT_EM = 0.2;
/** CSS uses 0.5em when a font has no x-height. */
const FALLBACK_X_HEIGHT_EM = 0.5;
/** WebKit/Blink have no hanging metric either: they use 80% of the ascent. */
const HANGING_OF_ASCENT = 0.8;

/**
 * How far to move the glyphs DOWN (+y, in the font's `unitsPerEm` units) so the chosen
 * baseline lands on the pen `y`. Multiply by `fontSize / unitsPerEm` for user units.
 *
 * | baseline                                  | shift            |
 * |-------------------------------------------|------------------|
 * | auto, alphabetic, unknown                 | 0                |
 * | middle                                    | xHeight / 2      |
 * | central                                   | (ascent − descent) / 2 |
 * | mathematical                              | ascent / 2       |
 * | hanging                                   | 0.8 × ascent     |
 * | text-top, text-before-edge                | ascent           |
 * | text-bottom, text-after-edge, ideographic | −descent         |
 *
 * Same table as the WebKit/Blink SVG text layout, so glyph mode matches native text.
 * @internal
 */
export function dominantBaselineShift(baseline: unknown, font: PxGlyphFont | undefined): number {
    const upm = font?.unitsPerEm || 1000;
    const ascent = font?.ascent ?? FALLBACK_ASCENT_EM * upm;
    const descent = font?.descent ?? FALLBACK_DESCENT_EM * upm;
    switch (baseline) {
        case PxDominantBaseline.middle: return (font?.xHeight ?? FALLBACK_X_HEIGHT_EM * upm) / 2;
        case PxDominantBaseline.central: return (ascent - descent) / 2;
        case PxDominantBaseline.mathematical: return ascent / 2;
        case PxDominantBaseline.hanging: return ascent * HANGING_OF_ASCENT;
        case PxDominantBaseline.textTop:
        case PxDominantBaseline.textBeforeEdge: return ascent;
        case PxDominantBaseline.textBottom:
        case PxDominantBaseline.textAfterEdge:
        case PxDominantBaseline.ideographic: return -descent;
        default: return 0;
    }
}
