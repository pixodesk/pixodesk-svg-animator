/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import {
    Circle,
    ClipPath,
    Defs,
    Ellipse,
    G,
    Image,
    Line,
    LinearGradient,
    Marker,
    Mask,
    Path,
    Pattern,
    Polygon,
    Polyline,
    RadialGradient,
    Rect,
    Stop,
    Svg,
    Symbol as SvgSymbol,
    Text as SvgText,
    TextPath,
    TSpan,
    Use,
} from 'react-native-svg';
import type { ComponentType } from 'react';

/**
 * SVG tag → react-native-svg component. Tags not in this map are skipped at
 * render time (with a warning collected by the renderer) — they go on the
 * feature-gap list rather than crashing the tree.
 */
export const RN_SVG_COMPONENTS: Record<string, ComponentType<any>> = {
    svg: Svg,
    g: G,
    rect: Rect,
    circle: Circle,
    ellipse: Ellipse,
    line: Line,
    path: Path,
    polygon: Polygon,
    polyline: Polyline,
    text: SvgText,
    tspan: TSpan,
    textPath: TextPath,
    defs: Defs,
    linearGradient: LinearGradient,
    radialGradient: RadialGradient,
    stop: Stop,
    use: Use,
    symbol: SvgSymbol,
    mask: Mask,
    clipPath: ClipPath,
    pattern: Pattern,
    marker: Marker,
    image: Image,
};

export { toRnPropName } from './PxRnPropNames';
