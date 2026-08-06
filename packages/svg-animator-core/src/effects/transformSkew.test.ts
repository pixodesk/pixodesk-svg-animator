/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// Skew as a first-class transform part (see app-side skew-support.plan.md):
//  - `PxTransformParts.skew` (skewX, degrees) composes BETWEEN rotate and scale
//    (Lottie-compatible order), pivoting at `origin`;
//  - transform-record interpolation lerps it;
//  - the composite transformation effect routes skew through the STANDARD
//    partsRecord wrapper — static AND animated (the old Vec2 special case rejected
//    animation and broke on the editor's scalar wire value).

import { describe, expect, it } from 'vitest';
import { composeTransformParts } from '../PxAnimatorUtil';
import { interpolateValue } from '../PxDefinitions';
import type { PxNode } from '../PxAnimatorTypes';
import { materialise } from './effectTestKit';


describe('skew transform part', () => {
    it('composeTransformParts places skewX between rotate and scale, inside the origin sandwich', () => {
        const s = composeTransformParts(
            { translate: [10, 20], origin: [50, 60], rotate: 30, skew: 15, scale: [2, 3] },
            { withUnits: false },
        );
        expect(s).toBe('translate(10,20)translate(50,60)rotate(30)skewX(15)scale(2,3)translate(-50,-60)');
    });

    it('interpolateValue lerps the skew slot', () => {
        const v = interpolateValue('transform', { skew: 0 }, { skew: 30 }, 0.5) as { skew?: number };
        expect(v.skew).toBe(15);
    });

    it('transformBy effect: STATIC scalar skew renders via the standard record wrapper', () => {
        const node = {
            type: 'svg',
            children: [{
                type: 'rect', width: 10, height: 10,
                effects: { transformBy: { skew: 15 } },
            }],
        } as unknown as PxNode;
        const out = materialise(node);
        const json = JSON.stringify(out);
        expect(json).toContain('"skew":15');
    });

    it('transformBy effect: ANIMATED skew produces keyframed skew records (no warning)', () => {
        const node = {
            type: 'svg',
            children: [{
                type: 'rect', width: 10, height: 10,
                effects: { transformBy: { skew: { keyframes: [{ time: 0, value: 0 }, { time: 1000, value: 30 }] } } },
            }],
        } as unknown as PxNode;
        const out = materialise(node);
        const json = JSON.stringify(out);
        expect(json).toContain('"skew":0');
        expect(json).toContain('"skew":30');
    });
});
