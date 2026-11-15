/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// Table-driven tests over the scroll-timeline maths: the seven moment words (they adapt to the size, exactly as the
// browser's range names do), an exact place (literal), a share scrolled, and the stretch between two moments.

import { describe, expect, it } from 'vitest';
import { cssRangeOfMoment, PxScrollMoment, type PxScrollSettings } from '../format/PxAnimatorConstants';
import {
    isScrollTimeline, scrollMomentFor, scrollMomentU, scrollOffsetProgress, scrollResolveAxis,
    scrollTotalDurationMs, scrollViewProgress,
} from './PxScrollMath';


describe('scrollMomentU — the seven words', () => {

    // An element SMALLER than the screen: 100 tall, screen 400.
    it.each([
        ['appears', 0],
        ['halfIn', 50],
        ['fullyIn', 100],
        ['centered', 250],
        ['startsToLeave', 400],
        ['halfOut', 450],
        ['gone', 500],
    ] as const)('small element: %s → u %d', (moment, expected) => {
        expect(scrollMomentU({ moment }, 100, 400)).toBe(expected);
    });

    // An element TALLER than the screen: 1000 tall, screen 400 — `fullyIn` is "it fills the screen" (its top at the
    // screen's top), `startsToLeave` is "it stops filling it" (its bottom at the screen's bottom).
    it.each([
        ['appears', 0],
        ['halfIn', 200],
        ['fullyIn', 400],
        ['centered', 700],
        ['startsToLeave', 1000],
        ['halfOut', 1200],
        ['gone', 1400],
    ] as const)('large element: %s → u %d', (moment, expected) => {
        expect(scrollMomentU({ moment }, 1000, 400)).toBe(expected);
    });

    it('the words are the browser\'s own range points', () => {
        expect(cssRangeOfMoment({ moment: PxScrollMoment.fullyIn }, PxScrollMoment.appears)).toEqual({ name: 'entry', fraction: 1 });
        expect(cssRangeOfMoment({ moment: PxScrollMoment.startsToLeave }, PxScrollMoment.appears)).toEqual({ name: 'exit', fraction: 0 });
        expect(cssRangeOfMoment(undefined, PxScrollMoment.gone)).toEqual({ name: 'cover', fraction: 1 });
        // an exact place on the screen's bottom or top line is a crossing; any other line has no browser spelling
        expect(cssRangeOfMoment({ domElement: 0.3, screen: 'bottom' }, PxScrollMoment.appears)).toEqual({ name: 'entry-crossing', fraction: 0.3 });
        expect(cssRangeOfMoment({ domElement: 'bottom', screen: 'top' }, PxScrollMoment.appears)).toEqual({ name: 'exit-crossing', fraction: 1 });
        expect(cssRangeOfMoment({ domElement: 'top', screen: 0.8 }, PxScrollMoment.appears)).toBeUndefined();
    });

    it('an exact place is literal: the element\'s line at the screen\'s line', () => {
        // its top 80 % down the screen: u = (1 − 0.8) × 400 + 0 × 100 = 80, for any size
        expect(scrollMomentU({ domElement: 'top', screen: 0.8 }, 100, 400)).toBeCloseTo(80);
        expect(scrollMomentU({ domElement: 'top', screen: 0.8 }, 1000, 400)).toBeCloseTo(80);
        // its bottom at the screen's bottom — `fullyIn` for a small element, NOT for a tall one
        expect(scrollMomentU({ domElement: 'bottom', screen: 'bottom' }, 100, 400)).toBe(100);
        expect(scrollMomentU({ domElement: 'bottom', screen: 'bottom' }, 1000, 400)).toBe(1000);
    });
});


describe('scrollViewProgress', () => {
    // 100 tall, screen 400 → the default stretch appears → gone = u ∈ [0, 500].
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

    it('honors a custom range (entry 0 → contain 1: "while entering and visible")', () => {
        // appears → startsToLeave: u ∈ [0, 400]
        const scroll: PxScrollSettings = { lastFrameWhen: { moment: PxScrollMoment.startsToLeave } };
        expect(scrollViewProgress(400, 100, 400, scroll)).toBe(0);            // u=0
        expect(scrollViewProgress(200, 100, 400, scroll)).toBeCloseTo(0.5);   // u=200
        expect(scrollViewProgress(0, 100, 400, scroll)).toBe(1);              // u=400
    });

    it('fraction interpolates INSIDE a phase', () => {
        // halfIn of a 100-tall element → u 50; gone → 500.
        const scroll: PxScrollSettings = { firstFrameWhen: { moment: PxScrollMoment.halfIn } };
        expect(scrollViewProgress(350, 100, 400, scroll)).toBe(0);                 // u=50 — at start
        expect(scrollViewProgress(350 - 225, 100, 400, scroll)).toBeCloseTo(0.5);  // u=275 = mid of [50,500]
    });

    it('degenerate range (zero-size subject, entry) never NaNs: 0 before, 1 after', () => {
        // a 0-tall element: appears and fullyIn are the same point
        const scroll: PxScrollSettings = { lastFrameWhen: { moment: PxScrollMoment.fullyIn } };
        expect(scrollViewProgress(500, 0, 400, scroll)).toBe(0);   // u=-100, before
        expect(scrollViewProgress(-10, 0, 400, scroll)).toBe(1);   // u=410, after
    });

    it('two moments that come out reversed are taken in scroll order — nothing jumps', () => {
        const reversed: PxScrollSettings = { firstFrameWhen: { moment: PxScrollMoment.gone }, lastFrameWhen: { moment: PxScrollMoment.appears } };
        expect(scrollViewProgress(150, 100, 400, reversed)).toBeCloseTo(0.5);
        expect(scrollViewProgress(400, 100, 400, reversed)).toBe(0);
        expect(scrollViewProgress(-100, 100, 400, reversed)).toBe(1);
    });

    it('held: the default stretch is fullyIn → startsToLeave of the section it is held in', () => {
        // a 1200-tall section, screen 400: caught when it fills the screen (u 400), let go when it stops (u 1200)
        const held: PxScrollSettings = { holdOnScreen: true };
        expect(scrollViewProgress(0, 1200, 400, held)).toBe(0);              // its top at the screen's top: u = 400
        expect(scrollViewProgress(-400, 1200, 400, held)).toBeCloseTo(0.5);  // u = 800
        expect(scrollViewProgress(-800, 1200, 400, held)).toBe(1);           // u = 1200
    });

    it('a moment that does not fit what is followed is replaced by the default', () => {
        // `{ scrolled }` on an element → the default `appears`
        expect(scrollMomentFor({ firstFrameWhen: { scrolled: 0.5 } }, 'first')).toEqual({ moment: PxScrollMoment.appears });
        // a word on the page's scroll → the default `{ scrolled: 1 }`
        expect(scrollMomentFor({ follows: 'pageScroll', lastFrameWhen: { moment: PxScrollMoment.fullyIn } }, 'last')).toEqual({ scrolled: 1 });
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
        const scroll: PxScrollSettings = { follows: 'pageScroll', firstFrameWhen: { scrolled: 0.25 }, lastFrameWhen: { scrolled: 0.75 } };
        expect(scrollOffsetProgress(250, 1000, scroll)).toBe(0);
        expect(scrollOffsetProgress(500, 1000, scroll)).toBeCloseTo(0.5);
        expect(scrollOffsetProgress(750, 1000, scroll)).toBe(1);
        expect(scrollOffsetProgress(100, 1000, scroll)).toBe(0);    // clamped below
        expect(scrollOffsetProgress(900, 1000, scroll)).toBe(1);    // clamped above
    });
    it('a share outside 0–1 is kept inside it', () => {
        const scroll: PxScrollSettings = { follows: 'pageScroll', firstFrameWhen: { scrolled: -1 }, lastFrameWhen: { scrolled: 3 } };
        expect(scrollOffsetProgress(500, 1000, scroll)).toBeCloseTo(0.5);
    });
});


describe('scrollResolveAxis', () => {
    it.each([
        [undefined, undefined, 'y'],            // absent: the way the page scrolls — vertical in horizontal writing
        [undefined, 'horizontal-tb', 'y'],
        [undefined, 'vertical-rl', 'x'],        // …and horizontal in vertical writing
        ['vertical', 'vertical-rl', 'y'],       // a named axis wins over the writing mode
        ['horizontal', 'horizontal-tb', 'x'],
    ] as const)('axis=%s writingMode=%s → %s', (axis, wm, expected) => {
        expect(scrollResolveAxis(axis, wm)).toBe(expected);
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
        expect(scrollTotalDurationMs({})).toBe(1000);   // PX_DEFAULT_DURATION_MS
    });
});
