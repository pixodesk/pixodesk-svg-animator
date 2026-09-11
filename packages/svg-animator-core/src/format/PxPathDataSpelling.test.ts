/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// ONE name for path data on the wire: `pathData` (SCHEMA-NAMING-REVIEW §2.4). `d` stays only
// where SVG itself owns it — the node attribute. The keyframe-value wrapper is `{pathData}`, the
// clip geometry is `clipPath.pathData`, and the Lottie-style `{paths: [{v,i,o,c}]}` array is gone.
import { describe, expect, it } from 'vitest';
import { validateDocument } from './PxAnimatorTypes';

/** A document animating `d` with the given keyframe value. */
const animatedD = (value: unknown) => ({
    type: 'svg',
    children: [{
        type: 'path', id: 'p',
        animate: { d: { keyframes: [{ time: 0, value }, { time: 100, value }] } },
    }],
});

/** A document whose node carries the clip-path effect. */
const clipped = (fx: unknown) => ({
    type: 'svg',
    children: [{ type: 'path', id: 'p', d: 'M0,0L10,10', effects: { clipPath: fx } }],
});

describe('path data spelling', () => {

    it('a `d` keyframe carries its geometry under `pathData`', () => {
        expect(validateDocument(animatedD({ pathData: 'M0,0L10,10' }))).toEqual([]);
    });

    it('the old `{path}` wrapper is a schema error', () => {
        expect(validateDocument(animatedD({ path: 'M0,0L10,10' })).length).toBeGreaterThan(0);
    });

    it('the legacy `{paths: [{v,i,o,c}]}` bezier-array form is gone', () => {
        const legacy = { paths: [{ v: [[0, 0], [10, 10]], i: [[0, 0], [0, 0]], o: [[0, 0], [0, 0]], c: true }] };
        expect(validateDocument(animatedD(legacy)).length).toBeGreaterThan(0);
    });

    it('the clip-path effect states its geometry as `pathData`, not `d`', () => {
        expect(validateDocument(clipped({ pathData: 'M0,0L10,10' }))).toEqual([]);
        expect(validateDocument(clipped({ d: 'M0,0L10,10' })).length).toBeGreaterThan(0);
    });

    it('an animated clip path takes the same keyframe values as a body `d`', () => {
        const fx = { pathData: { keyframes: [{ time: 0, value: { pathData: 'M0,0L1,1' } }, { time: 100, value: { pathData: 'M0,0L2,2' } }] } };
        expect(validateDocument(clipped(fx))).toEqual([]);
    });
});
