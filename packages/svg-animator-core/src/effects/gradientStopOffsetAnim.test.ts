/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// Regression: gradient stop `.offset` must animate, not just `.color`.
//
// The fixture animates the stop OFFSETS in the last segment (the 2nd stop's
// offset jumps 0.512 → 0.713 between the t=3070 and t=3990 keyframes). The bug
// was that `animatedStopNode` (effects/gradientEffect.ts) emitted only
// `stop.animate.stopColor.keyframes` and froze `offset` to the first kf, so
// stops stayed put on the canvas while colours animated.

import { describe, expect, it } from 'vitest';
import { applyPlayerEffects } from './PlayerEffectsUtil';
import type { PxNode } from '../PxAnimatorTypes';


/** The user's exact `strokeGradient` stops timeline (offsets move in last seg). */
function buildStrokeGradientNode(): PxNode {
    return {
        type: 'svg',
        children: [
            {
                type: 'ellipse',
                rx: 86, ry: 86,
                effects: {
                    strokeGradient: {
                        type: 'linear',
                        p1: [-85.79, -43.19],
                        p2: [116.05, -43.59],
                        stops: {
                            keyframes: [
                                { time: 0,    value: [{ offset: 0, color: '#ff0000' }, { offset: 0.512, color: '#ffff00' }, { offset: 0.992, color: '#0000ff' }], easing: [0.167, 0.167, 0.833, 0.833] },
                                { time: 1580, value: [{ offset: 0, color: '#ffff00' }, { offset: 0.512, color: '#0000ff' }, { offset: 0.992, color: '#ff0000' }], easing: [0.167, 0.167, 0.833, 0.833] },
                                { time: 3070, value: [{ offset: 0, color: '#ffff00' }, { offset: 0.512, color: '#0000ff' }, { offset: 0.992, color: '#ff0000' }], easing: [0.167, 0.167, 0.833, 0.833] },
                                { time: 3990, value: [{ offset: 0.713, color: '#ffff00' }, { offset: 0.895, color: '#0000ff' }, { offset: 0.992, color: '#ff0000' }], easing: [0.167, 0.167, 0.833, 0.833] },
                            ],
                        },
                        gradientUnits: 'userSpaceOnUse',
                        spreadMethod: 'pad',
                    },
                },
            },
        ],
    } as unknown as PxNode;
}


/** Finds the materialised `<stop>` children of the synthesised gradient def. */
function findStops(root: PxNode): Array<PxNode> {
    const out: Array<PxNode> = [];
    const walk = (n: PxNode) => {
        if (n.type === 'stop') out.push(n);
        n.children?.forEach(walk);
    };
    walk(root);
    return out;
}


describe('animated gradient stop offset', () => {

    it('each stop whose offset changes across keyframes gets an animate.offset timeline', () => {
        const { root, errors } = applyPlayerEffects(buildStrokeGradientNode());
        expect(errors).toEqual([]);

        const stops = findStops(root);
        expect(stops.length).toBe(3);

        // Stop 0: offset goes 0 → 0 → 0 → 0.713  ⇒ MUST animate.
        // Stop 1: offset goes 0.512 → 0.512 → 0.512 → 0.895 ⇒ MUST animate.
        const stop0Anim = (stops[0].animate as any)?.offset;
        const stop1Anim = (stops[1].animate as any)?.offset;

        expect(stop0Anim, 'stop[0] offset is not animated').toBeTruthy();
        expect(stop1Anim, 'stop[1] offset is not animated').toBeTruthy();

        // And the offset keyframes must carry the moved value at the last kf.
        const lastKf = stop1Anim.keyframes[stop1Anim.keyframes.length - 1];
        expect(lastKf.value).toBeCloseTo(0.895, 3);
    });
});
