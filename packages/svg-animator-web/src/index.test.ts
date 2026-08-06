/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAnimator } from './index';
import type { PxAnimatedSvgDocument, PxAnimationDefinition } from '@pixodesk/svg-animator-core';
import { cubicBezier, reverseEasing, splitEasing, subdivideCubicBezier } from '@pixodesk/svg-animator-core';
import { calcAnimationValues, getNormalisedBindings } from '@pixodesk/svg-animator-core';
import { materialiseAllInTree } from '@pixodesk/svg-animator-core';
import { PxAnimatorEngine } from '@pixodesk/svg-animator-core';


describe('animateBackground', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="svg-container"></div>';
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('Simple test', async () => {

        createAnimator({ data: getTestJson(), container: '#svg-container' });

        const svg = document.querySelector('svg');
        expect(svg).not.toBeNull();
        const ellipse = document.querySelector('ellipse');
        expect(ellipse).not.toBeNull();

        expect(ellipse?.getAttribute('transform')).toMatch('translate(200,100)');

        vi.advanceTimersByTime(64); // Trigger frame halfway through animation
        expect(ellipse?.getAttribute('transform')).toMatch('translate(200,150)');

        // Trigger frame end of animation
        vi.advanceTimersByTime(64);
        expect(ellipse?.getAttribute('transform')).toMatch('translate(200,200)');
    });

    it('Loop (per-property, cycle)', async () => {
        const json = getTestJson();
        // Double the duration so keyframes occupy first half → loop fills second half
        json.animator!.duration = 256;
        // Add loop:true to the translate property
        (json.animator!.animate as any)['_px_2pp00tnc']['translate'].loop = true;

        createAnimator({ data: json, container: '#svg-container' });

        const ellipse = document.querySelector('ellipse');
        expect(ellipse).not.toBeNull();

        expect(ellipse?.getAttribute('transform')).toMatch('translate(200,100)');

        // First half: 0→128ms, goes from 100→200
        vi.advanceTimersByTime(64);
        expect(ellipse?.getAttribute('transform')).toMatch('translate(200,150)');

        vi.advanceTimersByTime(64); // t=128
        expect(ellipse?.getAttribute('transform')).toMatch('translate(200,200)');

        // Second half: 128→256ms, loop repeats 100→200 (cycle mode)
        vi.advanceTimersByTime(64); // t=192 (midpoint of second cycle)
        expect(ellipse?.getAttribute('transform')).toMatch('translate(200,150)');

        vi.advanceTimersByTime(64); // t=256
        expect(ellipse?.getAttribute('transform')).toMatch('translate(200,200)');
    });

    it('Remove <script> tag', async () => {

        createAnimator({
            data: {
                type: 'svg',
                children: [
                    { type: 'ellipse', fill: '#0087ff' },
                    { type: 'script', textContent: 'alert("hi");' }
                ]
            },
            container: '#svg-container'
        });

        const svg = document.querySelector('svg');
        expect(svg).not.toBeNull();
        console.log('svg?.children.length', svg?.children.length);
        expect(svg?.innerHTML).toBe('<ellipse fill="#0087ff"></ellipse>');
    });

    it('In-place property animation on element body (Mode A)', async () => {

        createAnimator({
            data: {
                type: 'svg',
                viewBox: '0 0 400 400',
                animator: {
                    mode: 'frames',
                    duration: 128,
                    fill: 'forwards',
                    direction: 'normal',
                    trigger: { startOn: 'load' }
                },
                children: [
                    {
                        type: 'ellipse',
                        id: '_px_inplace_test',
                        cx: 200, cy: 200, rx: 50, ry: 50,
                        // Per-element animation lives under the `animate` bucket, keyed by property.
                        animate: {
                            translate: {
                                keyframes: [
                                    { time: 0, value: [200, 100] },
                                    { time: 128, value: [200, 200] }
                                ]
                            }
                        }
                    }
                ]
            },
            container: '#svg-container'
        });

        const ellipse = document.querySelector('ellipse');
        expect(ellipse).not.toBeNull();

        // Halfway through animation
        vi.advanceTimersByTime(64);
        expect(ellipse?.getAttribute('transform')).toMatch('translate(200,150)');

        // End of animation
        vi.advanceTimersByTime(64);
        expect(ellipse?.getAttribute('transform')).toMatch('translate(200,200)');
    });

    it('frames: play() after natural end rewinds to start (regression)', async () => {

        const api = createAnimator({
            data: {
                type: 'svg',
                viewBox: '0 0 400 400',
                animator: {
                    mode: 'frames',
                    duration: 128,
                    // single play — no looping; animation finishes and holds the last frame
                    iterations: 1,
                    fill: 'forwards',
                    trigger: { startOn: 'load' }
                },
                children: [
                    {
                        type: 'ellipse',
                        id: '_px_replay_test',
                        cx: 200, cy: 200, rx: 50, ry: 50,
                        animate: {
                            translate: {
                                keyframes: [
                                    { time: 0, value: [200, 100] },
                                    { time: 128, value: [200, 200] }
                                ]
                            }
                        }
                    }
                ]
            },
            container: '#svg-container'
        });

        const ellipse = document.querySelector('ellipse');
        expect(ellipse).not.toBeNull();

        // Play through to the natural end — element holds its final frame.
        vi.advanceTimersByTime(128);
        expect(ellipse?.getAttribute('transform')).toMatch('translate(200,200)');

        // Pressing play on a finished animation must rewind to the start, not
        // stay stuck on the last frame.
        api.play();
        vi.advanceTimersByTime(64); // halfway through the replay
        expect(ellipse?.getAttribute('transform')).toMatch('translate(200,150)');

        vi.advanceTimersByTime(64); // end of the replay again
        expect(ellipse?.getAttribute('transform')).toMatch('translate(200,200)');
    });

    it('Animated path `d` accepts both bare string and { path } (Mode A)', async () => {

        createAnimator({
            data: {
                type: 'svg',
                viewBox: '0 0 400 400',
                animator: { mode: 'frames', duration: 100, fill: 'forwards', trigger: { startOn: 'load' } },
                children: [
                    {
                        type: 'path', id: '_px_d_bare', d: 'M0,0L10,0L10,10',
                        animate: { d: { keyframes: [
                            { time: 0, value: 'M0,0L10,0L10,10' },          // bare string (legacy)
                            { time: 100, value: 'M0,0L20,0L20,20' },
                        ] } },
                    },
                    {
                        type: 'path', id: '_px_d_obj', d: 'M0,0L10,0L10,10',
                        animate: { d: { keyframes: [
                            { time: 0, value: { path: 'M0,0L10,0L10,10' } }, // unified { path } form
                            { time: 100, value: { path: 'M0,0L20,0L20,20' } },
                        ] } },
                    },
                ],
            },
            container: '#svg-container',
        });

        const paths = document.querySelectorAll('path');  // ids are regenerated by the player
        expect(paths.length).toBe(2);
        const [bare, obj] = [...Array.from(paths)];

        // Both shapes animate identically: `d` progresses away from the start path.
        vi.advanceTimersByTime(100);
        const endD = bare?.getAttribute('d');
        expect(endD).toBeTruthy();
        expect(endD).not.toBe('M0,0L10,0L10,10');         // moved off the first keyframe toward L20,0L20,20
        expect(obj?.getAttribute('d')).toBe(endD);        // { path } produces the same result as the bare string
    });
});


// ============================================================================
// Loop expansion tests (via getNormalisedBindings + calcAnimationValues)
// ============================================================================

describe('Loop expansion', () => {

    /** Helper: get normalised binding's animate definition for translate */
    function getTranslateAnim(doc: PxAnimatedSvgDocument): PxAnimationDefinition {
        const bindings = getNormalisedBindings(doc);
        expect(bindings.length).toBeGreaterThan(0);
        return bindings[0].animate! as PxAnimationDefinition;
    }

    /** Helper: extract translate [x,y] at a given progress (0-1) from the animation definition */
    function translateAt(animDef: Record<string, any>, progress: number): string {
        const values = calcAnimationValues(animDef, progress);
        return values['transform'] || '';
    }

    // FIXME
    // it('loop:true (default cycle) extends keyframes to fill duration', () => {
    //     const doc: PxAnimatedSvgDocument = {
    //         type: 'svg',
    //         animator: { duration: 200 },
    //         bindings: [{
    //             id: 'el1',
    //             animate: {
    //                 opacity: {
    //                     keyframes: [
    //                         { time: 0, value: 0 },
    //                         { time: 100, value: 1 }
    //                     ],
    //                     loop: true
    //                 }
    //             }
    //         }]
    //     };

    //     const animDef = getTranslateAnim(doc);
    //     const kfs = animDef['opacity']?.kfs;
    //     expect(kfs).toBeDefined();

    //     // Should have keyframes beyond the original 0→100 range
    //     const maxT = Math.max(...(kfs || []).map((k: any) => k.t ?? 0));
    //     expect(maxT).toBeCloseTo(1, 1); // normalized to 1

    //     // At t=0: opacity=0
    //     const v0 = calcAnimationValues(animDef, 0);
    //     expect(+v0['opacity']).toBeCloseTo(0, 1);

    //     // At t=0.5 (=100ms): opacity=1 (end of original keyframes)
    //     const v50 = calcAnimationValues(animDef, 0.5);
    //     expect(+v50['opacity']).toBeCloseTo(1, 1);

    //     // At t=0.75 (=150ms): midpoint of looped cycle → opacity≈0.5
    //     const v75 = calcAnimationValues(animDef, 0.75);
    //     expect(+v75['opacity']).toBeCloseTo(0.5, 1);

    //     // At t=1 (=200ms): end of looped cycle → opacity=1
    //     const v100 = calcAnimationValues(animDef, 1);
    //     expect(+v100['opacity']).toBeCloseTo(1, 1);
    // });

    // FIXME
    // it('loop with alternate (pingpong) reverses direction each rep', () => {
    //     const doc: PxAnimatedSvgDocument = {
    //         type: 'svg',
    //         animator: { duration: 300 },
    //         bindings: [{
    //             id: 'el1',
    //             animate: {
    //                 opacity: {
    //                     keyframes: [
    //                         { time: 0, value: 0 },
    //                         { time: 100, value: 1 }
    //                     ],
    //                     loop: { alternate: true }
    //                 }
    //             }
    //         }]
    //     };

    //     const animDef = getTranslateAnim(doc);

    //     // At t=0: 0
    //     expect(+calcAnimationValues(animDef, 0)['opacity']).toBeCloseTo(0, 1);

    //     // At t=100/300: 1 (end of original)
    //     expect(+calcAnimationValues(animDef, 100 / 300)['opacity']).toBeCloseTo(1, 1);

    //     // First rep after original is reversed (pingpong). At t=200/300: back to 0
    //     expect(+calcAnimationValues(animDef, 200 / 300)['opacity']).toBeCloseTo(0, 1);

    //     // Second rep is forward again. At t=300/300: back to 1
    //     expect(+calcAnimationValues(animDef, 1)['opacity']).toBeCloseTo(1, 1);
    // });

    // FIXME
    // it("loop.extend:'before' extends keyframes before the first keyframe", () => {
    //     const doc: PxAnimatedSvgDocument = {
    //         type: 'svg',
    //         animator: { duration: 200 },
    //         bindings: [{
    //             id: 'el1',
    //             animate: {
    //                 opacity: {
    //                     keyframes: [
    //                         { time: 100, value: 0 },
    //                         { time: 200, value: 1 }
    //                     ],
    //                     loop: { extend: 'before' }
    //                 }
    //             }
    //         }]
    //     };

    //     const animDef = getTranslateAnim(doc);

    //     // At t=0 (=0ms): loop fills 0→100, starts a cycle: opacity=0
    //     expect(+calcAnimationValues(animDef, 0)['opacity']).toBeCloseTo(0, 1);

    //     // At t=0.25 (=50ms): midpoint of looped segment before original
    //     expect(+calcAnimationValues(animDef, 0.25)['opacity']).toBeCloseTo(0.5, 1);

    //     // At t=0.5 (=100ms): junction → start of original keyframes, opacity=0
    //     expect(+calcAnimationValues(animDef, 0.5)['opacity']).toBeCloseTo(0, 1);

    //     // At t=1 (=200ms): end of original keyframes, opacity=1
    //     expect(+calcAnimationValues(animDef, 1)['opacity']).toBeCloseTo(1, 1);
    // });

    // FIXME
    // it('loop with segmentCount uses only specified intervals', () => {
    //     // 3 keyframes (2 intervals), segmentCount=1 → loop only the last interval
    //     const doc: PxAnimatedSvgDocument = {
    //         type: 'svg',
    //         animator: { duration: 400 },
    //         bindings: [{
    //             id: 'el1',
    //             animate: {
    //                 opacity: {
    //                     keyframes: [
    //                         { time: 0, value: 0 },
    //                         { time: 100, value: 0.5 },
    //                         { time: 200, value: 1 }
    //                     ],
    //                     loop: { segmentCount: 1 }
    //                 }
    //             }
    //         }]
    //     };

    //     const animDef = getTranslateAnim(doc);

    //     // Original keyframes span 0→200. segmentCount=1 loops last interval (100→200, values 0.5→1)
    //     // At t=0: 0
    //     expect(+calcAnimationValues(animDef, 0)['opacity']).toBeCloseTo(0, 1);

    //     // At t=100/400=0.25: 0.5
    //     expect(+calcAnimationValues(animDef, 0.25)['opacity']).toBeCloseTo(0.5, 1);

    //     // At t=200/400=0.5: 1 (end of original)
    //     expect(+calcAnimationValues(animDef, 0.5)['opacity']).toBeCloseTo(1, 1);

    //     // Loop fills 200→400 with segment [0.5→1] repeating
    //     // At t=300/400=0.75: midpoint of first looped rep → 0.75
    //     expect(+calcAnimationValues(animDef, 0.75)['opacity']).toBeCloseTo(0.75, 1);

    //     // At t=400/400=1: end of first looped rep → 1
    //     expect(+calcAnimationValues(animDef, 1)['opacity']).toBeCloseTo(1, 1);
    // });

    // FIXME
    // it('loop with partial repetition interpolates at cut point', () => {
    //     // Duration=250, keyframes span 0→100. Fill: 100→250 = 150ms, seg=100ms.
    //     // 1 full rep (100→200) + 0.5 partial rep (200→250, cut at 50% of segment).
    //     const doc: PxAnimatedSvgDocument = {
    //         type: 'svg',
    //         animator: { duration: 250 },
    //         bindings: [{
    //             id: 'el1',
    //             animate: {
    //                 opacity: {
    //                     keyframes: [
    //                         { time: 0, value: 0 },
    //                         { time: 100, value: 1 }
    //                     ],
    //                     loop: true
    //                 }
    //             }
    //         }]
    //     };

    //     const animDef = getTranslateAnim(doc);

    //     // At t=200/250=0.8: end of first full looped rep → 1
    //     expect(+calcAnimationValues(animDef, 0.8)['opacity']).toBeCloseTo(1, 1);

    //     // At t=250/250=1: cut at 50% of partial rep → ≈0.5
    //     expect(+calcAnimationValues(animDef, 1)['opacity']).toBeCloseTo(0.5, 1);
    // });

    it('no gap: loop is no-op when keyframes span full duration', () => {
        const doc: PxAnimatedSvgDocument = {
            type: 'svg',
            animator: {
                duration: 100,
                animate: {
                    'el1': {
                        opacity: {
                            keyframes: [
                                { time: 0, value: 0 },
                                { time: 100, value: 1 }
                            ],
                            loop: true
                        }
                    }
                }
            }
        };

        const animDef = getTranslateAnim(doc);
        const kfs = animDef['opacity']?.kfs;

        // Should only have the original 2 keyframes (no gap to fill)
        expect(kfs?.length).toBe(2);
    });

    // Regression: loopIn (`before`) with a PARTIAL leftover rep — the fill region
    // (0→150ms) is NOT an exact multiple of the segment (100ms): 1 full rep + a 0.5
    // partial. The fill must tile BACKWARD from the boundary (firstT=150ms) so the
    // partial sits at t=0 showing the segment's TAIL and a full rep ends exactly at
    // firstT. The pre-fix forward-tiling put the partial next to firstT and started
    // the element at the segment HEAD (x=0) instead of mid-segment (x=50) → the
    // loopIn `f0` bug. (Linear easing → exact midpoints.) Asserts on the materialised
    // keyframe list since this path keeps kf times in ms (not normalised 0-1).
    it("loop.extend:'before' with partial rep tiles backward from the first keyframe", () => {
        const doc: PxAnimatedSvgDocument = {
            type: 'svg',
            animator: {
                duration: 250,
                animate: {
                    'el1': {
                        transform: {
                            keyframes: [
                                { time: 150, value: { translate: [0, 0] } },
                                { time: 250, value: { translate: [100, 0] } }
                            ],
                            loop: { extend: 'before' }
                        }
                    }
                }
            }
        };

        const animDef = getTranslateAnim(doc);
        const kfs = animDef['transform']?.kfs as Array<{ t: number; v: { translate: [number, number] } }>;
        const x = (i: number) => kfs[i].v.translate[0];

        // Expected backward-tiled fill (then the 2 original kfs):
        //   t=0:[50,0] (tail start) · t=50:[100,0] (tail end) ┊ t=50:[0,0] · t=150:[100,0] (full rep)
        //   ┊ t=150:[0,0] · t=250:[100,0] (original)
        expect(kfs.map(k => k.t)).toEqual([0, 50, 50, 150, 150, 250]);

        // The fix: the FIRST kf is the segment's mid-point tail (x=50), NOT the
        // head (x=0) the forward-tiling bug produced.
        expect(x(0)).toBeCloseTo(50, 5);
        expect(x(1)).toBeCloseTo(100, 5); // tail ends at segment end
        // Full rep restarts at the segment head and ends exactly at firstT.
        expect(x(2)).toBeCloseTo(0, 5);
        expect(x(3)).toBeCloseTo(100, 5);
        // Original segment unchanged.
        expect(x(4)).toBeCloseTo(0, 5);
        expect(x(5)).toBeCloseTo(100, 5);
    });

    // FIXME
    // it('translate with loop:true cycles correctly', () => {
    //     const doc: PxAnimatedSvgDocument = {
    //         type: 'svg',
    //         animator: { duration: 256 },
    //         bindings: [{
    //             id: 'el1',
    //             animate: {
    //                 translate: {
    //                     keyframes: [
    //                         { time: 0, value: [0, 0] },
    //                         { time: 128, value: [100, 200] }
    //                     ],
    //                     loop: true
    //                 }
    //             }
    //         }]
    //     };

    //     const animDef = getTranslateAnim(doc);

    //     // Original: translate goes [0,0]→[100,200] over 0→128ms
    //     expect(translateAt(animDef, 0)).toBe('translate(0,0)');
    //     expect(translateAt(animDef, 0.5)).toBe('translate(100,200)'); // t=128

    //     // Looped cycle: [0,0]→[100,200] over 128→256ms
    //     expect(translateAt(animDef, 0.75)).toBe('translate(50,100)'); // t=192
    //     expect(translateAt(animDef, 1)).toBe('translate(100,200)');   // t=256
    // });
});


// ============================================================================
// Bezier / Easing utility tests
// ============================================================================

describe('subdivideCubicBezier', () => {
    it('split at t=0.5 produces two halves with shared midpoint', () => {
        const p0: [number, number] = [0, 0];
        const p1: [number, number] = [0.25, 0.1];
        const p2: [number, number] = [0.25, 1];
        const p3: [number, number] = [1, 1];

        const { left, right } = subdivideCubicBezier(p0, p1, p2, p3, 0.5);

        // Left starts at p0 and right ends at p3
        expect(left[0]).toEqual(p0);
        expect(right[3]).toEqual(p3);

        // They share the midpoint
        expect(left[3][0]).toBeCloseTo(right[0][0], 10);
        expect(left[3][1]).toBeCloseTo(right[0][1], 10);
    });

    it('split at t=0 returns degenerate left', () => {
        const p0: [number, number] = [0, 0];
        const p1: [number, number] = [0.3, 0];
        const p2: [number, number] = [0.7, 1];
        const p3: [number, number] = [1, 1];

        const { left, right } = subdivideCubicBezier(p0, p1, p2, p3, 0);

        // Left collapses to p0
        expect(left[3]).toEqual(p0);
        // Right is the full curve
        expect(right[0]).toEqual(p0);
        expect(right[3]).toEqual(p3);
    });

    it('split at t=1 returns degenerate right', () => {
        const p0: [number, number] = [0, 0];
        const p1: [number, number] = [0.3, 0];
        const p2: [number, number] = [0.7, 1];
        const p3: [number, number] = [1, 1];

        const { left, right } = subdivideCubicBezier(p0, p1, p2, p3, 1);

        // Left is the full curve
        expect(left[0]).toEqual(p0);
        expect(left[3]).toEqual(p3);
        // Right collapses to p3
        expect(right[0]).toEqual(p3);
    });
});


describe('splitEasing', () => {
    it('returns undefined for undefined (linear) input', () => {
        const { left, right } = splitEasing(undefined, 0.5);
        expect(left).toBeUndefined();
        expect(right).toBeUndefined();
    });

    it('xFraction=0 returns full easing on right', () => {
        const easing: [number, number, number, number] = [0.42, 0, 0.58, 1];
        const { left, right } = splitEasing(easing, 0);
        expect(left).toBeUndefined();
        expect(right).toEqual(easing);
    });

    it('xFraction=1 returns full easing on left', () => {
        const easing: [number, number, number, number] = [0.42, 0, 0.58, 1];
        const { left, right } = splitEasing(easing, 1);
        expect(left).toEqual(easing);
        expect(right).toBeUndefined();
    });

    it('split at 0.5 produces two valid easings', () => {
        const easing: [number, number, number, number] = [0.42, 0, 0.58, 1];
        const { left, right } = splitEasing(easing, 0.5);

        expect(left).toBeDefined();
        expect(right).toBeDefined();

        // Both halves should have control points in [0,1] range (approximately)
        for (const cp of left!) {
            expect(cp).toBeGreaterThanOrEqual(-0.01);
            expect(cp).toBeLessThanOrEqual(1.01);
        }
        for (const cp of right!) {
            expect(cp).toBeGreaterThanOrEqual(-0.01);
            expect(cp).toBeLessThanOrEqual(1.01);
        }
    });

    it('left half evaluated at x=1 produces same y as original at split point', () => {
        const easing: [number, number, number, number] = [0.25, 0.1, 0.25, 1];
        const splitX = 0.4;
        const { left } = splitEasing(easing, splitX);

        // The left half maps [0,1]→[0,splitY]. When evaluated at x=1
        // it should give y=1 (by re-normalization). And the original easing
        // at splitX should equal the same absolute y.
        const originalY = cubicBezier(easing)(splitX);

        // If left easing is defined, evaluate it at x=1 → should give y=1 (normalized)
        if (left) {
            const leftY = cubicBezier(left)(1);
            expect(leftY).toBeCloseTo(1, 1);
        }

        // Original y at split point should be between 0 and 1
        expect(originalY).toBeGreaterThan(0);
        expect(originalY).toBeLessThan(1);
    });
});


describe('reverseEasing', () => {
    it('returns undefined for undefined input', () => {
        expect(reverseEasing(undefined)).toBeUndefined();
    });

    it('reverses a cubic-bezier correctly', () => {
        const easing: [number, number, number, number] = [0.42, 0, 0.58, 1];
        const reversed = reverseEasing(easing)!;

        expect(reversed[0]).toBeCloseTo(1 - 0.58);
        expect(reversed[1]).toBeCloseTo(1 - 1);
        expect(reversed[2]).toBeCloseTo(1 - 0.42);
        expect(reversed[3]).toBeCloseTo(1 - 0);
    });

    it('double-reverse returns original easing', () => {
        const easing: [number, number, number, number] = [0.25, 0.1, 0.25, 1];
        const doubleReversed = reverseEasing(reverseEasing(easing)!)!;

        expect(doubleReversed[0]).toBeCloseTo(easing[0], 10);
        expect(doubleReversed[1]).toBeCloseTo(easing[1], 10);
        expect(doubleReversed[2]).toBeCloseTo(easing[2], 10);
        expect(doubleReversed[3]).toBeCloseTo(easing[3], 10);
    });

    it('reversed easing at x produces 1 - original(1-x)', () => {
        const easing: [number, number, number, number] = [0.42, 0, 0.58, 1];
        const reversed = reverseEasing(easing)!;

        const originalFn = cubicBezier(easing);
        const reversedFn = cubicBezier(reversed);

        // For several x values, reversed(x) ≈ 1 - original(1-x)
        for (const x of [0.1, 0.25, 0.5, 0.75, 0.9]) {
            expect(reversedFn(x)).toBeCloseTo(1 - originalFn(1 - x), 5);
        }
    });
});


describe('Color attribute normalisation (frames-mode parity)', () => {

    /** Walk a transform / colour string out of `calcAnimationValues` and check
     *  it never contains the literal "NaN". */
    function expectNoNaN(values: Record<string, string>): void {
        for (const [k, v] of Object.entries(values)) {
            expect(v, `attr "${k}" contains NaN: ${v}`).not.toMatch(/NaN/);
        }
    }

    function getBindings(doc: PxAnimatedSvgDocument): PxAnimationDefinition {
        const bindings = getNormalisedBindings(doc);
        expect(bindings.length).toBeGreaterThan(0);
        return bindings[0].animate! as PxAnimationDefinition;
    }

    it('camelCase `stopColor` is parsed (regression: frames-mode produced rgba(NaN,NaN,NaN,…))', () => {
        const doc: PxAnimatedSvgDocument = {
            type: 'svg',
            animator: { duration: 1000 },
            children: [
                {
                    type: 'stop',
                    id: 'grad-stop',
                    offset: '100%',
                    stopColor: '#f5180a',
                    animate: {
                        stopColor: {
                            keyframes: [
                                { time: 0,    value: '#f5180a' },
                                { time: 500,  value: '#0a6ef5' },
                                { time: 1000, value: '#f5180a' },
                            ],
                        },
                    },
                },
            ],
        } as PxAnimatedSvgDocument;

        const animDef = getBindings(doc);
        // Sample at several intermediate times. Each must produce a clean
        // rgba(…) string with no NaN channels. The colour branch in
        // `calcPropertyValue` emits under the ORIGINAL propName (camelCase
        // preserved), so look up `stopColor` not `stop-color`.
        for (const t of [0, 100, 250, 500, 750, 900, 1000]) {
            const v = calcAnimationValues(animDef, t);
            expectNoNaN(v);
            expect(v['stopColor']).toBeDefined();
            expect(v['stopColor']).toMatch(/^rgba\(/);
        }
    });

    it('camelCase `floodColor` and `lightingColor` are also normalised', () => {
        for (const prop of ['floodColor', 'lightingColor']) {
            const doc: PxAnimatedSvgDocument = {
                type: 'svg',
                animator: { duration: 1000 },
                children: [
                    {
                        type: 'feFlood',
                        id: 'flood',
                        animate: {
                            [prop]: {
                                keyframes: [
                                    { time: 0,    value: '#ff0000' },
                                    { time: 1000, value: '#00ff00' },
                                ],
                            },
                        } as Record<string, unknown>,
                    } as any,
                ],
            } as PxAnimatedSvgDocument;
            const animDef = getBindings(doc);
            for (const t of [0, 500, 1000]) {
                expectNoNaN(calcAnimationValues(animDef, t));
            }
        }
    });

    it('loop on a `stroke` animation through the materialise-all umbrella does NOT produce NaN at the loop seam', () => {
        // Repro of the visible bug: `<g>` in a repeater + an animated stroke
        // that LOOPS. When the loop cuts mid-segment (segment doesn't fit the
        // duration evenly), `expandLoopKeyframes` interpolates a boundary kf —
        // and `interpolateValue` for a colour attr expects an [r,g,b,a] array,
        // not the original hex string. Without pre-parsing, the boundary kf
        // ends up `[NaN,NaN,NaN,NaN]` and stays NaN for every sample past it.
        //
        // Goes through `materialiseAllInTree` to mirror the player's actual
        // pipeline — the bug surfaced specifically there (raw kfs reach the
        // loop expansion before the binding pipeline's `parseColor` step).
        const doc: PxAnimatedSvgDocument = {
            type: 'svg',
            animator: { duration: 1500 },  // wider than the kfs range → loop fills tail
            children: [
                {
                    type: 'path',
                    id: 'p',
                    animate: {
                        stroke: {
                            loop: true,
                            keyframes: [
                                { time: 0,    value: '#824d7d' },
                                { time: 1000, value: '#10ff60' },
                            ],
                        },
                    },
                } as any,
            ],
        } as PxAnimatedSvgDocument;

        // Run the same pipeline the player uses — for BOTH engines.
        for (const engine of [PxAnimatorEngine.frames, PxAnimatorEngine.waapi]) {
            const flatDoc = materialiseAllInTree(doc, engine);
            const animDef = getBindings(flatDoc);
            // Sample beyond the original kfs range — the loop must repeat
            // without producing NaN colour channels.
            for (const t of [0, 250, 500, 999, 1000, 1100, 1250, 1400, 1500]) {
                const values = calcAnimationValues(animDef, t);
                for (const [k, v] of Object.entries(values)) {
                    expect(v, `engine=${engine} t=${t} attr=${k} → "${v}"`).not.toMatch(/NaN/);
                }
            }
        }
    });

    // Audit other value types — same umbrella path, same loop-seam scenario.
    // Bug shape: `expandLoopKeyframes` calls `interpolateValue(propName, prev.v,
    // next.v, t)` at a partial-cut boundary. Each value type needs `interpolateValue`
    // (and the pre-normalisation in `materialiseInternalLoopsInPropAnim`) to
    // produce a clean result there — otherwise the boundary kf is NaN / broken
    // and stays that way past the seam.

    it('loop on a NUMERIC `opacity` animation — no NaN at the seam', () => {
        const doc: PxAnimatedSvgDocument = {
            type: 'svg',
            animator: { duration: 1500 },
            children: [
                { type: 'rect', id: 'r', animate: { opacity: {
                    loop: true,
                    keyframes: [{ time: 0, value: 0 }, { time: 1000, value: 1 }],
                } } } as any,
            ],
        } as PxAnimatedSvgDocument;
        for (const engine of [PxAnimatorEngine.frames, PxAnimatorEngine.waapi]) {
            const animDef = getBindings(materialiseAllInTree(doc, engine));
            for (const t of [0, 500, 1100, 1400]) {
                expectNoNaN(calcAnimationValues(animDef, t));
            }
        }
    });

    it('loop on a UNIFIED TRANSFORM record animation — no NaN AND correct interpolation at the seam', () => {
        // Most common shape: `animate.transform.keyframes[].value` is an object
        // like `{translate:[x,y], rotate:r}`. At the loop seam,
        // `interpolateValue('transform', objA, objB, t)` used to fall through
        // to `interpolateNum(+a, +b, t)` → `+({}) = NaN` → broken boundary kf.
        // `calcPropertyValue`'s defensive fallback absorbs the NaN (no visible
        // "NaN" string) but the seam SNAPS to the initial value instead of
        // interpolating — visually wrong even though no NaN.
        const doc: PxAnimatedSvgDocument = {
            type: 'svg',
            animator: { duration: 1700 },  // 700ms past the kfs range → forces partial-cut
            children: [
                { type: 'rect', id: 'r', animate: { transform: {
                    loop: true,
                    keyframes: [
                        { time: 0,    value: { translate: [0, 0],   rotate: 0  } },
                        { time: 1000, value: { translate: [50, 50], rotate: 90 } },
                    ],
                } } } as any,
            ],
        } as PxAnimatedSvgDocument;
        for (const engine of [PxAnimatorEngine.frames, PxAnimatorEngine.waapi]) {
            const animDef = getBindings(materialiseAllInTree(doc, engine));
            for (const t of [0, 500, 1100, 1500, 1700]) {
                expectNoNaN(calcAnimationValues(animDef, t));
            }
            // At t=1500 we're at 50% of the partial second iteration (which
            // spans t=1000..1700, cutRelT=0.7). The second iteration restarts
            // from kf0 → kf1, so at half-way through the partial portion the
            // rect should be PARTLY rotated, not at rotate(0).
            const mid = calcAnimationValues(animDef, 1500)['transform'];
            // Should NOT be only `rotate(0)` — the partial loop should produce
            // some interpolated rotation.
            expect(mid, `engine=${engine}`).not.toMatch(/rotate\(0[,)]/);
        }
    });

    it('loop on a PATH `d` animation — no NaN / no empty paths at the seam', () => {
        const doc: PxAnimatedSvgDocument = {
            type: 'svg',
            animator: { duration: 1500 },
            children: [
                { type: 'path', id: 'p', animate: { d: {
                    loop: true,
                    keyframes: [
                        { time: 0,    value: 'M0,0L10,10' },
                        { time: 1000, value: 'M0,0L20,20' },
                    ],
                } } } as any,
            ],
        } as PxAnimatedSvgDocument;
        for (const engine of [PxAnimatorEngine.frames, PxAnimatorEngine.waapi]) {
            const animDef = getBindings(materialiseAllInTree(doc, engine));
            for (const t of [0, 500, 1100, 1400]) {
                const out = calcAnimationValues(animDef, t);
                expectNoNaN(out);
                // Also verify `d` didn't collapse to an empty path at the seam.
                if (out['d']) expect(out['d'].length).toBeGreaterThan(2);
            }
        }
    });

    it('kebab-case `stop-color` still works (no regression)', () => {
        const doc: PxAnimatedSvgDocument = {
            type: 'svg',
            animator: { duration: 1000 },
            children: [
                {
                    type: 'stop',
                    id: 's',
                    animate: {
                        'stop-color': {
                            keyframes: [
                                { time: 0,    value: '#ffffff' },
                                { time: 1000, value: '#000000' },
                            ],
                        },
                    } as Record<string, unknown>,
                } as any,
            ],
        } as PxAnimatedSvgDocument;
        const animDef = getBindings(doc);
        for (const t of [0, 500, 1000]) {
            expectNoNaN(calcAnimationValues(animDef, t));
        }
    });
});


////////////////////////////////////////////////////////////////

function getTestJson(): PxAnimatedSvgDocument {
    return {
        type: 'svg',
        id: '_px_2p4d44pl',
        fill: 'none',
        viewBox: '0 0 400 400',

        animator: {
            mode: 'frames',
            duration: 128,
            fill: 'forwards',
            direction: 'normal',
            trigger: { startOn: 'load' },
            animate: {
                '_px_2pp00tnc': {
                    translate: {
                        keyframes: [
                            { time: 0, value: [200, 100], easing: [0.167, 0.167, 0.833, 0.833] },
                            { time: 128, value: [200, 200] }
                        ]
                    }
                }
            }
        },

        children: [
            {
                type: 'ellipse',
                id: '_px_2pp00tnc',
                fill: '#0087ff',
                stroke: '#ffffff',
                transform: 'translate(200,100)',
                rx: '50',
                ry: '50'
            }
        ]
    };
}
