/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// Frames-mode motion-along-path, regression cover for `effect.clone.symbol.alongPath.aaa`.
//
// The animation's keyframes start PART-WAY into the timeline (250ms of a 1000ms doc), so
// the first rendered frame sits BEFORE the first keyframe. `getKeyframesPair` answered that
// with the (first, last) pair — a kf[0]→kf[2] straight chord that skips the apex — and
// `getSegmentCache` stored the resulting Bezier under `prevKf` ALONE. From then on every
// evaluation of the real kf[0]→kf[1] segment hit that poisoned entry, so the shape travelled
// the chord from start to end and then jumped to the apex to run the (correctly cached)
// second segment.
//
// Only frames-mode is affected: WAAPI materialises motion paths into sampled kfs upstream.

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createBasicFrameLoopAnimator, type PxPlatformAdapter } from '../PxFrameLoop';
import { calcAnimationValues, getNormalisedBindings } from '../PxDefinitions';
import type { PxAnimatedSvgDocument } from '../PxAnimatorTypes';
import { PxAnimatorEngine } from '../PxAnimatorTypes';

const START: [number, number] = [124.7115, 74.3754];
const APEX: [number, number] = [154.5315, 12.1887];
const END: [number, number] = [189.172, 75.1807];

/** Keyframes start at 250ms — deliberately NOT at 0, which is what exposes the bug. */
const mkDoc = (): PxAnimatedSvgDocument => ({
    type: 'svg', viewBox: '0 0 200 200',
    animator: {
        mode: 'frames', duration: 1000,
        definitions: { animations: { a0: { transform: { autoOrient: true, keyframes: [
            { time: 250, value: { translate: START } },
            { time: 500, value: { translate: APEX }, tangentOut: [23.4667, -0.6531], tangentIn: [-23.4668, 0.6532] },
            { time: 750, value: { translate: END } },
        ] } } } },
        animate: { el1: ['a0'] },
    },
    children: [{ type: 'ellipse', id: 'el1', rx: 9.641, ry: 9.641 }],
} as unknown as PxAnimatedSvgDocument);

function xy(transform: string | undefined): [number, number] {
    const m = /translate\(([-\d.]+),([-\d.]+)\)/.exec(transform || '');
    return m ? [parseFloat(m[1]), parseFloat(m[2])] : [NaN, NaN];
}

/** Straight START→END would sit at y≈74–75 the whole way; the arc peaks at y≈12. */
const CHORD_Y = 74.5;

function mkAnimator() {
    const attrs = new Map<string, string>();
    const adapter: PxPlatformAdapter = { isConnected: () => true, setAttribute: (id, a, v) => attrs.set(id + '|' + a, v) };
    const api = createBasicFrameLoopAnimator(mkDoc(), adapter);
    return { api, transform: () => attrs.get('el1|transform') };
}


describe('frames motion-path — a pre-start frame must not poison the segment cache', () => {

    it('evaluating BEFORE the first keyframe leaves mid-segment sampling on the arc', () => {
        const animDef = getNormalisedBindings(mkDoc(), PxAnimatorEngine.frames)[0].animate as never;

        // Frame 0 of playback: before the first kf. This is the call that used to poison.
        calcAnimationValues(animDef, 0);

        const [, y] = xy(calcAnimationValues(animDef, 384).transform);
        expect(y, 'mid-first-segment must be up on the arc, not on the START→END chord').toBeLessThan(50);
    });

    it('the apex keyframe is honoured at its own time', () => {
        const animDef = getNormalisedBindings(mkDoc(), PxAnimatorEngine.frames)[0].animate as never;
        calcAnimationValues(animDef, 0);

        const [x, y] = xy(calcAnimationValues(animDef, 500).transform);
        expect(x).toBeCloseTo(APEX[0], 1);
        expect(y).toBeCloseTo(APEX[1], 1);
    });

    it('auto-orient before the start uses the real initial tangent, not the chord angle', () => {
        const animDef = getNormalisedBindings(mkDoc(), PxAnimatorEngine.frames)[0].animate as never;
        const deg = (t: number) => parseFloat((/rotate\(([-\d.]+)\)/.exec(calcAnimationValues(animDef, t).transform) || [])[1]);

        // The path leaves START heading steeply up (≈ -84°). The chord is ≈ +0.7°.
        expect(deg(0), 'pre-start rotation matches the first keyframe').toBeCloseTo(deg(250), 1);
        expect(Math.abs(deg(0)), 'not the flat START→END chord angle').toBeGreaterThan(45);
    });

    describe('through the real frame loop', () => {
        beforeEach(() => vi.useFakeTimers());
        afterEach(() => vi.useRealTimers());

        it('PLAYBACK follows the arc — no chord run and no jump to the apex', () => {
            const { api, transform } = mkAnimator();
            api.play();

            const pts: Array<[number, number]> = [];
            for (let i = 0; i < 50; i++) {
                vi.advanceTimersByTime(16);
                pts.push(xy(transform()));
            }

            // Somewhere in the first segment the shape must be high on the arc.
            const firstSegment = pts.slice(14, 30);
            expect(Math.min(...firstSegment.map(p => p[1])), 'first segment climbs the arc').toBeLessThan(50);

            // …and the whole run is continuous: the old bug teleported ~69 units from the
            // chord's end back to the apex.
            let maxStep = 0;
            for (let i = 1; i < pts.length; i++) {
                const step = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
                if (Number.isFinite(step)) maxStep = Math.max(maxStep, step);
            }
            expect(maxStep, 'no teleport between consecutive frames').toBeLessThan(20);
        });

        it('seeking after playing still lands on the arc', () => {
            const { api, transform } = mkAnimator();
            api.play();
            vi.advanceTimersByTime(400);
            api.pause();
            api.setCurrentTime(384);
            expect(xy(transform())[1], 'y at 384 is on the arc').toBeLessThan(50);
        });
    });
});
