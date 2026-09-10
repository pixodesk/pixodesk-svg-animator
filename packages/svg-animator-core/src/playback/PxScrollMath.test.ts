/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// Table-driven tests over the scroll-timeline math — the phase intervals mirror the
// table in `app/src/svgeditor/animation/scroll-timeline.design.md` §4.

import { describe, expect, it } from 'vitest';
import {
    isScrollTimeline, scrollOffsetProgress, scrollPhaseInterval, scrollResolveAxis,
    scrollTotalDurationMs, scrollViewProgress,
} from './PxScrollMath';


describe('scrollPhaseInterval — the design-doc table', () => {

    // Subject SMALLER than the scrollport: sH=100, vpH=400.
    it.each([
        ['cover', [0, 500]],
        ['entry', [0, 100]],
        ['contain', [100, 400]],
        ['exit', [400, 500]],
        ['entry-crossing', [0, 100]],
        ['exit-crossing', [400, 500]],
    ] as const)('small subject: %s → %j', (phase, expected) => {
        expect(scrollPhaseInterval(phase, 100, 400)).toEqual(expected);
    });

    // Subject LARGER than the scrollport: sH=1000, vpH=400 — min/max case-split flips
    // `contain` to "subject covers the whole scrollport".
    it.each([
        ['cover', [0, 1400]],
        ['entry', [0, 400]],
        ['contain', [400, 1000]],
        ['exit', [1000, 1400]],
        ['entry-crossing', [0, 1000]],
        ['exit-crossing', [400, 1400]],
    ] as const)('large subject: %s → %j', (phase, expected) => {
        expect(scrollPhaseInterval(phase, 1000, 400)).toEqual(expected);
    });
});


describe('scrollViewProgress', () => {
    // sH=100, vpH=400 → default full-cover range = u ∈ [0, 500].
    const p = (subjectStart: number) => scrollViewProgress(subjectStart, 100, 400, undefined);

    it('0 before entering (leading edge below the fold)', () => {
        expect(p(500)).toBe(0);    // u = -100
        expect(p(400)).toBe(0);    // u = 0 — exactly about to enter
    });
    it('scrubs across cover', () => {
        expect(p(150)).toBeCloseTo(0.5);   // u = 250 of 500
    });
    it('1 after fully leaving', () => {
        expect(p(-100)).toBe(1);   // u = 500 — trailing edge at the top
        expect(p(-300)).toBe(1);   // clamped past
    });

    it('honours a custom range (entry 0 → contain 1: "while entering and visible")', () => {
        const range = { start: { phase: 'entry', fraction: 0 }, end: { phase: 'contain', fraction: 1 } } as const;
        // u interval = [0, 400]
        expect(scrollViewProgress(400, 100, 400, range)).toBe(0);            // u=0
        expect(scrollViewProgress(200, 100, 400, range)).toBeCloseTo(0.5);   // u=200
        expect(scrollViewProgress(0, 100, 400, range)).toBe(1);              // u=400
    });

    it('fraction interpolates INSIDE a phase', () => {
        // entry 50% of a 100-tall subject → uStart = 50; end cover 100% → 500.
        const range = { start: { phase: 'entry', fraction: 0.5 }, end: { phase: 'cover', fraction: 1 } } as const;
        expect(scrollViewProgress(350, 100, 400, range)).toBe(0);                 // u=50 — at start
        expect(scrollViewProgress(350 - 225, 100, 400, range)).toBeCloseTo(0.5);  // u=275 = mid of [50,500]
    });

    it('degenerate range (zero-size subject, entry) never NaNs: 0 before, 1 after', () => {
        // sH=0 → entry interval [0,0] → uStart === uEnd.
        const range = { start: { phase: 'entry', fraction: 0 }, end: { phase: 'entry', fraction: 1 } } as const;
        expect(scrollViewProgress(500, 0, 400, range)).toBe(0);   // u=-100, before
        expect(scrollViewProgress(-10, 0, 400, range)).toBe(1);   // u=410, after
    });
});


describe('scrollOffsetProgress', () => {
    it('plain offset ratio', () => {
        expect(scrollOffsetProgress(0, 1000, undefined)).toBe(0);
        expect(scrollOffsetProgress(250, 1000, undefined)).toBeCloseTo(0.25);
        expect(scrollOffsetProgress(1000, 1000, undefined)).toBe(1);
    });
    it('maxOffset 0 → progress 1 (CSS zero-length-timeline rule)', () => {
        expect(scrollOffsetProgress(0, 0, undefined)).toBe(1);
    });
    it('range slices the scroll distance', () => {
        const range = { start: { fraction: 0.25 }, end: { fraction: 0.75 } };
        expect(scrollOffsetProgress(250, 1000, range)).toBe(0);
        expect(scrollOffsetProgress(500, 1000, range)).toBeCloseTo(0.5);
        expect(scrollOffsetProgress(750, 1000, range)).toBe(1);
        expect(scrollOffsetProgress(100, 1000, range)).toBe(0);    // clamped below
        expect(scrollOffsetProgress(900, 1000, range)).toBe(1);    // clamped above
    });
});


describe('scrollResolveAxis', () => {
    it.each([
        [undefined, undefined, 'y'],            // default block, horizontal writing
        ['block', 'horizontal-tb', 'y'],
        ['inline', 'horizontal-tb', 'x'],
        ['block', 'vertical-rl', 'x'],
        ['inline', 'vertical-rl', 'y'],
        ['x', 'vertical-rl', 'x'],              // physical wins over writing mode
        ['y', 'horizontal-tb', 'y'],
    ] as const)('axis=%s writingMode=%s → %s', (axis, wm, expected) => {
        expect(scrollResolveAxis(axis as any, wm)).toBe(expected);
    });
});


describe('config helpers', () => {
    it('isScrollTimeline', () => {
        expect(isScrollTimeline(undefined)).toBe(false);
        expect(isScrollTimeline({})).toBe(false);
        expect(isScrollTimeline({ timelineSource: 'time' })).toBe(false);
        expect(isScrollTimeline({ timelineSource: 'scroll' })).toBe(true);
    });
    it('scrollTotalDurationMs: duration × finite iterations; infinite → 1', () => {
        expect(scrollTotalDurationMs({ duration: 2000 })).toBe(2000);
        expect(scrollTotalDurationMs({ duration: 2000, iterations: 3 })).toBe(6000);
        expect(scrollTotalDurationMs({ duration: 2000, iterations: 'infinite' })).toBe(2000);
        expect(scrollTotalDurationMs({})).toBe(1000);   // DEFAULT_DURATION_MS
    });
});
