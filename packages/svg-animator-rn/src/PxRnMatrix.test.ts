/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { describe, expect, it } from 'vitest';
import { svgTransformToMatrix } from './PxRnMatrix';
import { toRnPropValue } from './PxRnPropNames';
import { sampleProps } from './PxRnTracks';

/** Reference values cross-checked against react-native-svg's own `parse()`. */
describe('svgTransformToMatrix', () => {
    it.each([
        ['translate(10,20)', [1, 0, 0, 1, 10, 20]],
        ['scale(2,3)', [2, 0, 0, 3, 0, 0]],
        ['rotate(90)', [0, 1, -1, 0, 0, 0]],
        ['skewX(45)', [1, 0, 1, 1, 0, 0]],
        ['skewY(45)', [1, 1, 0, 1, 0, 0]],
        ['matrix(1,2,3,4,5,6)', [1, 2, 3, 4, 5, 6]],
        ['translate(5,5) translate(-5,-5)', [1, 0, 0, 1, 0, 0]],
    ] as Array<[string, Array<number>]>)('%s', (input, expected) => {
        const m = svgTransformToMatrix(input)!;
        expect(m).toHaveLength(6);
        m.forEach((v, i) => expect(v).toBeCloseTo(expected[i], 9));
    });

    it('composes a list left-to-right (translate then rotate)', () => {
        // translate(10,0) rotate(90) maps local (1,0) → (10,1)
        const m = svgTransformToMatrix('translate(10,0)rotate(90)')!;
        const x = m[0] * 1 + m[2] * 0 + m[4];
        const y = m[1] * 1 + m[3] * 0 + m[5];
        expect(x).toBeCloseTo(10, 9);
        expect(y).toBeCloseTo(1, 9);
    });

    it('honours a rotation centre', () => {
        // rotate(180, 5, 0) maps (0,0) → (10,0)
        const m = svgTransformToMatrix('rotate(180,5,0)')!;
        expect(m[0] * 0 + m[2] * 0 + m[4]).toBeCloseTo(10, 9);
        expect(m[1] * 0 + m[3] * 0 + m[5]).toBeCloseTo(0, 9);
    });

    it('returns undefined when nothing parses, so the caller can pass the value through', () => {
        expect(svgTransformToMatrix('')).toBeUndefined();
        expect(svgTransformToMatrix('none')).toBeUndefined();
    });
});

describe('toRnPropValue transform handling', () => {
    it('converts a transform string to a matrix when targeting native views', () => {
        expect(toRnPropValue('transform', 'translate(3,4)', undefined, true)).toEqual([1, 0, 0, 1, 3, 4]);
    });

    it('leaves the transform ALONE by default, for the DOM', () => {
        // react-native-web hands the value straight to the DOM, where an array
        // serialises to `transform="1,0,0,1,3,4"` and the element stops moving.
        expect(toRnPropValue('transform', 'translate(3,4)')).toBe('translate(3,4)');
    });

    it('leaves the ROOT <Svg> transform as a string even on native', () => {
        // The root view uses `extractTransformSvgView`, which wants a string /
        // RN style — a matrix would be silently dropped there.
        expect(toRnPropValue('transform', 'translate(3,4)', 'svg', true)).toBe('translate(3,4)');
    });

    it('passes non-transform props through untouched', () => {
        expect(toRnPropValue('fill', 'rgba(1,2,3,1)')).toBe('rgba(1,2,3,1)');
        expect(toRnPropValue('opacity', '0.5')).toBe(0.5);
    });
});

describe('native prop naming (animated path)', () => {
    const tracks = {
        id: 'x',
        props: {
            transform: [[1, 0, 0, 1, 0, 0], [1, 0, 0, 1, 9, 9]] as Array<Array<number>>,
            opacity: [1, 0],
        },
    } as any;

    it('renames transform → matrix for the reanimated path', () => {
        // The native view declares `matrix`; a `transform` prop is silently
        // dropped there, which is exactly why animated transforms did nothing.
        const out = sampleProps(tracks, 0, 1, 2, true);
        expect(out.matrix).toEqual([1, 0, 0, 1, 0, 0]);
        expect(out.transform).toBeUndefined();
        expect(out.opacity).toBe(1);
    });

    it('keeps the wire name for the plain-React path', () => {
        // Plain renders still go through react-native-svg's JS layer, which
        // reads `transform` and derives `matrix` itself.
        const out = sampleProps(tracks, 1, 1, 2, false);
        expect(out.transform).toEqual([1, 0, 0, 1, 9, 9]);
        expect(out.matrix).toBeUndefined();
    });
});
