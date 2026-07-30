/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import {
    Circle,
    ClipPath,
    Defs,
    Ellipse,
    FeBlend,
    FeColorMatrix,
    FeComponentTransfer,
    FeComposite,
    FeConvolveMatrix,
    FeDiffuseLighting,
    FeDisplacementMap,
    FeDistantLight,
    FeDropShadow,
    FeFlood,
    FeFuncA,
    FeFuncB,
    FeFuncG,
    FeFuncR,
    FeGaussianBlur,
    FeImage,
    FeMerge,
    FeMergeNode,
    FeMorphology,
    FeOffset,
    FePointLight,
    FeSpecularLighting,
    FeSpotLight,
    FeTile,
    FeTurbulence,
    Filter,
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
 *
 * Keys are the wire-format `node.type` values, which follow SVG's own casing
 * (`clipPath`, `feGaussianBlur`, `linearGradient`, …).
 */
export const RN_SVG_COMPONENTS: Record<string, ComponentType<any>> = {
    // Root & containers
    svg: Svg,
    g: G,
    defs: Defs,
    symbol: SvgSymbol,
    use: Use,

    // Shapes
    rect: Rect,
    circle: Circle,
    ellipse: Ellipse,
    line: Line,
    path: Path,
    polygon: Polygon,
    polyline: Polyline,
    image: Image,

    // Text
    text: SvgText,
    tspan: TSpan,
    textPath: TextPath,

    // Paint servers & clipping
    linearGradient: LinearGradient,
    radialGradient: RadialGradient,
    stop: Stop,
    pattern: Pattern,
    mask: Mask,
    clipPath: ClipPath,
    marker: Marker,

    // Filters — react-native-svg implements the full primitive set.
    // NOTE: filter rendering requires the New Architecture (Fabric) and is
    // newer than the rest of react-native-svg; treat visual parity with the
    // web player as unverified until checked on a device.
    filter: Filter,
    feBlend: FeBlend,
    feColorMatrix: FeColorMatrix,
    feComponentTransfer: FeComponentTransfer,
    feComposite: FeComposite,
    feConvolveMatrix: FeConvolveMatrix,
    feDiffuseLighting: FeDiffuseLighting,
    feDisplacementMap: FeDisplacementMap,
    feDistantLight: FeDistantLight,
    feDropShadow: FeDropShadow,
    feFlood: FeFlood,
    feFuncA: FeFuncA,
    feFuncB: FeFuncB,
    feFuncG: FeFuncG,
    feFuncR: FeFuncR,
    feGaussianBlur: FeGaussianBlur,
    feImage: FeImage,
    feMerge: FeMerge,
    feMergeNode: FeMergeNode,
    feMorphology: FeMorphology,
    feOffset: FeOffset,
    fePointLight: FePointLight,
    feSpecularLighting: FeSpecularLighting,
    feSpotLight: FeSpotLight,
    feTile: FeTile,
    feTurbulence: FeTurbulence,
};

export { toRnPropName } from './PxRnPropNames';
