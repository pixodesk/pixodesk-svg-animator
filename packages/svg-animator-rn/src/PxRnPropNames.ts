/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { kebabToCamelCaseWord } from '@pixodesk/svg-animator-core';
import { svgTransformToMatrix } from './PxRnMatrix';

/** Attribute names with a react-native-svg prop equivalent under a
 *  different name (not just a casing change). */
const ATTR_NAME_OVERRIDES: Record<string, string> = {
    'xlink:href': 'href',
};

/** Props react-native-svg does not understand / must not receive. */
const DROPPED_ATTRS = new Set(['class', 'className', 'style', 'xmlns', 'xmlns:xlink', 'data-px-meta']);

/**
 * Converts one normalised wire attribute name (camelCase after core's
 * `getNormalizedProps`, or kebab-case raw) to a react-native-svg prop name.
 * Returns undefined for props that must be dropped.
 *
 * Pure (no react-native-svg import) so the track compiler and its tests
 * don't need a React Native environment.
 */
export function toRnPropName(attrName: string): string | undefined {
    if (DROPPED_ATTRS.has(attrName)) return undefined;
    const override = ATTR_NAME_OVERRIDES[attrName];
    if (override) return override;
    // react-native-svg uses camelCase props (strokeWidth, fillOpacity, …);
    // core's kebabToCamelCaseWord is a no-op for already-camelCase input.
    return kebabToCamelCaseWord(attrName);
}

/** Props whose value is a LIST of lengths. react-native-svg's native side
 *  expects a number array here (its JS `extractLengthList` splits strings, but
 *  values delivered through reanimated's animated-props path bypass that JS
 *  extraction and reach the native view directly). */
const LENGTH_LIST_PROPS = new Set(['strokeDasharray']);

/**
 * Converts one already-renamed prop value into the shape react-native-svg
 * expects: length-list props become number arrays; numeric strings become
 * numbers; everything else passes through.
 */
export function toRnPropValue(
    rnPropName: string,
    value: string | number,
    /** The owning element's tag. The ROOT `<Svg>` handles `transform` through a
     *  different code path (`extractTransformSvgView`, which wants a string or
     *  an RN style) — a matrix there would be dropped, so leave it alone. */
    tag?: string,
    /** Opt in to the NATIVE representation of a value (see below). Defaults to
     *  off, so web keeps the plain SVG/DOM form it has always been given. */
    native = false,
): string | number | Array<number> {
    // On a device `transform` must arrive as a matrix, not a string: the
    // string→matrix parse happens in JS during render, which reanimated's
    // animated-props path skips entirely. See PxRnMatrix for the full why.
    // On the web the DOM parses the string itself and an array would serialise
    // to a meaningless `transform="1,0,0,1,3,4"`, so it must stay a string.
    if (native && rnPropName === 'transform' && typeof value === 'string' && tag !== 'svg') {
        const m = svgTransformToMatrix(value);
        if (m) return m;
    }
    if (LENGTH_LIST_PROPS.has(rnPropName)) {
        const parts = String(value).trim().replace(/,/g, ' ').split(/\s+/).map(Number).filter(n => Number.isFinite(n));
        // An odd-length dasharray repeats to become even (SVG spec); rn-svg
        // does this itself for the static path — mirror it so both paths agree.
        return parts.length % 2 === 1 ? parts.concat(parts) : parts;
    }
    if (typeof value === 'number') return value;
    const num = +value;
    return Number.isFinite(num) && String(num) === value ? num : value;
}
