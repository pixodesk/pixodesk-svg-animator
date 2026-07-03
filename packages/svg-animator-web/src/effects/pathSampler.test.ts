/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// Arc-length + tangent sampling for an SVG path `d` (backing along-path glyphs).

import { describe, expect, it } from 'vitest';
import { createPathSampler } from './pathSampler';

describe('pathSampler', () => {

    it('measures a straight horizontal line and samples point + angle', () => {
        const s = createPathSampler('M0 0L100 0')!;
        expect(s.totalLength).toBeCloseTo(100, 4);
        const p = s.sampleAtDistance(50);
        expect(p.x).toBeCloseTo(50, 4);
        expect(p.y).toBeCloseTo(0, 4);
        expect(p.angle).toBeCloseTo(0, 5);
    });

    it('angle follows a vertical line (down = +y ⇒ +90°)', () => {
        const s = createPathSampler('M0 0L0 100')!;
        expect(s.sampleAtDistance(50).angle).toBeCloseTo(Math.PI / 2, 3);
    });

    it('concatenates multiple segments by arc length', () => {
        const s = createPathSampler('M0 0L100 0L100 100')!; // 100 across + 100 down
        expect(s.totalLength).toBeCloseTo(200, 3);
        const p = s.sampleAtDistance(150); // 50 into the vertical leg
        expect(p.x).toBeCloseTo(100, 2);
        expect(p.y).toBeCloseTo(50, 2);
    });

    it('up-converts quadratics', () => {
        const s = createPathSampler('M0 0Q50 0 100 0')!; // control on the axis → straight, len 100
        expect(s.totalLength).toBeCloseTo(100, 2);
    });

    it('clamps distance to the path ends', () => {
        const s = createPathSampler('M0 0L100 0')!;
        expect(s.sampleAtDistance(-10).x).toBeCloseTo(0, 4);
        expect(s.sampleAtDistance(999).x).toBeCloseTo(100, 4);
    });

    it('returns null for empty input', () => {
        expect(createPathSampler('')).toBeNull();
    });
});
