/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// Regression: gradient GEOMETRY must animate in the frames engine, not just stops.
//
// The wire animates geometry on the SLOTS themselves (`p1`/`p2`/`c`/`r`/`fp` as
// grammar-1 animatables — SCHEMA-DESIGN §4 E-3). `synthesiseGradientDef` splits
// a vec slot into per-axis channels on the def node's own `animate` under the REAL
// SVG attr names (`y1`, `fx`, …) so the frame loop drives them like it drives the
// stops' `stopColor`. The old per-scalar `effects.fillGradient.animate.gradientY1…`
// wire channels were REMOVED outright (backward compat dropped) — a leftover
// `animate` key is simply ignored by the applier and flagged by strict validation.

import { describe, expect, it } from 'vitest';
import { entryOf, materialize, untyped } from '../effectTestKit';
import type { PxFillGradientEffect, PxNode } from '../../format/PxAnimatorTypes';


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
    return materialize({ type: 'svg', children: [node] });
}

describe('gradient geometry animation (frames engine)', () => {
    it('linear: animated endpoints land as y1/y2 animate blocks on the def', () => {
        const node: PxNode = {
            type: 'ellipse', rx: 64, ry: 64,
            effects: {
                fillGradient: {
                    type: 'linear',
                    start: { value: [-45, -45], keyframes: [{ time: 0, value: [-45, -45] }, { time: 1000, value: [-45, 45] }] },
                    end: { value: [45, 45], keyframes: [{ time: 0, value: [45, 45] }, { time: 1000, value: [45, -45] }] },
                    stops: [{ offset: 0, color: '#ff0000' }, { offset: 1, color: '#0000ff' }],
                    gradientUnits: 'userSpaceOnUse',
                },
            },
        };

        const def = findDef(applied(node), 'linearGradient');
        expect(def).toBeTruthy();
        // Static base geometry still present…
        expect(def?.x1).toBe('-45');
        expect(def?.y1).toBe('-45');
        // …and the animation split per axis onto the REAL attr names.
        expect(entryOf(def, 'y1')?.keyframes).toEqual([{ time: 0, value: -45 }, { time: 1000, value: 45 }]);
        expect(entryOf(def, 'y2')?.keyframes).toEqual([{ time: 0, value: 45 }, { time: 1000, value: -45 }]);
        expect(entryOf(def, 'x1')?.keyframes).toEqual([{ time: 0, value: -45 }, { time: 1000, value: -45 }]);
    });

    it('radial: animated focal point lands as fx/fy animate blocks on the def', () => {
        const node: PxNode = {
            type: 'ellipse', rx: 64, ry: 64,
            effects: {
                fillGradient: {
                    type: 'radial', center: [0, 0], radius: 56,
                    focal: { value: [-30, -30], keyframes: [{ time: 0, value: [-30, -30] }, { time: 1000, value: [30, 30] }] },
                    stops: [{ offset: 0, color: '#ff0000' }, { offset: 1, color: '#0000ff' }],
                    gradientUnits: 'userSpaceOnUse',
                },
            },
        };

        const def = findDef(applied(node), 'radialGradient');
        expect(def).toBeTruthy();
        expect(def?.fx).toBe('-30');
        expect(entryOf(def, 'fx')?.keyframes).toEqual([{ time: 0, value: -30 }, { time: 1000, value: 30 }]);
        expect(entryOf(def, 'fy')?.keyframes).toEqual([{ time: 0, value: -30 }, { time: 1000, value: 30 }]);
    });

    it('REMOVED legacy `animate.gradientY1…` channels are ignored (no def animation)', () => {
        const node: PxNode = {
            type: 'ellipse',
            effects: {
                // `animate` is the REMOVED legacy channel key — not a gradient field, on purpose.
                fillGradient: untyped<PxFillGradientEffect>({
                    type: 'linear', start: [0, 0], end: [10, 10],
                    stops: [{ offset: 0, color: '#000' }, { offset: 1, color: '#fff' }],
                    animate: { gradientY1: { keyframes: [{ time: 0, value: 0 }, { time: 1000, value: 10 }] } },
                }),
            },
        };
        const def = findDef(applied(node), 'linearGradient');
        expect(def?.animate).toBeUndefined();   // statics only — legacy channels dropped
        expect(def?.x1).toBe('0');
    });
});
