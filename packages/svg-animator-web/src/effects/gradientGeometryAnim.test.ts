/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// Regression: gradient GEOMETRY must animate in the frames engine, not just stops.
//
// The wire carries per-channel keyframes under `effects.fillGradient.animate`
// (`gradientY1`, `gradientFx`, …). `synthesiseGradientDef` used to drop them
// ("static-only in v1"), so an animated linear sweep / radial focal move rendered
// frozen at the base geometry. They must land on the def node's own `animate`
// under the REAL SVG attr names (`y1`, `fx`, …) so the frame loop drives them like
// it drives the stops' `stopColor`.

import { describe, expect, it } from 'vitest';
import { materialise } from './effectTestKit';
import type { PxNode } from '../PxAnimatorTypes';


function findDef(root: PxNode, type: string): PxNode | undefined {
    let found: PxNode | undefined;
    const walk = (n: PxNode) => {
        if (n.type === type) found = n;
        n.children?.forEach(walk);
    };
    walk(root);
    return found;
}

function applied(node: PxNode): PxNode {
    return materialise({ type: 'svg', children: [node] } as unknown as PxNode);
}

describe('gradient geometry animation (frames engine)', () => {
    it('linear: animated endpoints land as y1/y2 animate blocks on the def', () => {
        const node = {
            type: 'ellipse', rx: 64, ry: 64,
            effects: {
                fillGradient: {
                    type: 'linear', p1: [-45, -45], p2: [45, 45],
                    stops: [{ offset: 0, color: '#ff0000' }, { offset: 1, color: '#0000ff' }],
                    animate: {
                        gradientY1: { keyframes: [{ time: 0, value: -45 }, { time: 1000, value: 45 }] },
                        gradientY2: { keyframes: [{ time: 0, value: 45 }, { time: 1000, value: -45 }] },
                    },
                    gradientUnits: 'userSpaceOnUse',
                },
            },
        } as unknown as PxNode;

        const def = findDef(applied(node), 'linearGradient') as any;
        expect(def).toBeTruthy();
        // Static base geometry still present…
        expect(def.x1).toBe('-45');
        expect(def.y1).toBe('-45');
        // …and the animation mapped onto the REAL attr names.
        expect(def.animate?.y1?.keyframes).toEqual([{ time: 0, value: -45 }, { time: 1000, value: 45 }]);
        expect(def.animate?.y2?.keyframes).toEqual([{ time: 0, value: 45 }, { time: 1000, value: -45 }]);
    });

    it('radial: animated focal point lands as fx/fy animate blocks on the def', () => {
        const node = {
            type: 'ellipse', rx: 64, ry: 64,
            effects: {
                fillGradient: {
                    type: 'radial', c: [0, 0], fp: [-30, -30], r: 56,
                    stops: [{ offset: 0, color: '#ff0000' }, { offset: 1, color: '#0000ff' }],
                    animate: {
                        gradientFx: { keyframes: [{ time: 0, value: -30 }, { time: 1000, value: 30 }] },
                        gradientFy: { keyframes: [{ time: 0, value: -30 }, { time: 1000, value: 30 }] },
                    },
                    gradientUnits: 'userSpaceOnUse',
                },
            },
        } as unknown as PxNode;

        const def = findDef(applied(node), 'radialGradient') as any;
        expect(def).toBeTruthy();
        expect(def.fx).toBe('-30');
        expect(def.animate?.fx?.keyframes).toEqual([{ time: 0, value: -30 }, { time: 1000, value: 30 }]);
        expect(def.animate?.fy?.keyframes).toEqual([{ time: 0, value: -30 }, { time: 1000, value: 30 }]);
    });

    it('unknown animate channels are ignored (no stray def attrs)', () => {
        const node = {
            type: 'ellipse',
            effects: {
                fillGradient: {
                    type: 'linear', p1: [0, 0], p2: [10, 10],
                    stops: [{ offset: 0, color: '#000' }, { offset: 1, color: '#fff' }],
                    animate: { somethingElse: { keyframes: [{ time: 0, value: 1 }] } },
                },
            },
        } as unknown as PxNode;
        const def = findDef(applied(node), 'linearGradient') as any;
        expect(def.animate).toBeUndefined();
    });
});
