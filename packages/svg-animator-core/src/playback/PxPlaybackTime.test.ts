/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// The ONE time contract shared by every engine (API review §3).

import { describe, expect, it } from 'vitest';
import {
    clampSeekMs, createRunClock, isValidPlaybackRate, progressSpanMs, progressToTimeMs,
    PX_RATE_REJECTED, seekCeilingMs, timeToProgress,
} from './PxPlaybackTime';

const DUR = 1000;

describe('isValidPlaybackRate', () => {

    it('accepts any finite non-zero rate, forwards or backwards', () => {
        expect(isValidPlaybackRate(1)).toBe(true);
        expect(isValidPlaybackRate(2)).toBe(true);
        expect(isValidPlaybackRate(-1)).toBe(true);
        expect(isValidPlaybackRate(0.25)).toBe(true);
    });

    it('rejects 0 — that is what pause() is for', () => {
        expect(isValidPlaybackRate(0)).toBe(false);
    });

    it('rejects non-finite rates', () => {
        expect(isValidPlaybackRate(NaN)).toBe(false);
        expect(isValidPlaybackRate(Infinity)).toBe(false);
        expect(isValidPlaybackRate(-Infinity)).toBe(false);
    });

    it('has one message, so every engine says the same thing', () => {
        expect(PX_RATE_REJECTED).toContain('non-zero');
    });
});

describe('seekCeilingMs vs progressSpanMs — deliberately different', () => {

    it('agree on a finite timeline', () => {
        expect(seekCeilingMs(DUR, 3)).toBe(3000);
        expect(progressSpanMs(DUR, 3)).toBe(3000);
    });

    it('disagree on an endless one: seeking is unbounded, progress spans ONE iteration', () => {
        // This is the whole reason they are two functions. Collapsing them would either
        // cap an endless seek or make every `progress` read 0.
        expect(seekCeilingMs(DUR, Infinity)).toBe(Infinity);
        expect(progressSpanMs(DUR, Infinity)).toBe(DUR);
    });

    it('a zero-length timeline is 0, not NaN', () => {
        expect(seekCeilingMs(0, 3)).toBe(0);
        expect(progressSpanMs(0, 3)).toBe(0);
    });

    it('treats a nonsense iteration count as one iteration', () => {
        expect(seekCeilingMs(DUR, 0)).toBe(DUR);
        expect(progressSpanMs(DUR, 0)).toBe(DUR);
    });
});

describe('clampSeekMs', () => {

    it('clamps into [0, ceiling]', () => {
        expect(clampSeekMs(-5, 3000)).toBe(0);
        expect(clampSeekMs(1500, 3000)).toBe(1500);
        expect(clampSeekMs(5000, 3000)).toBe(3000);
    });

    it('only floors when the ceiling is endless', () => {
        expect(clampSeekMs(-5, Infinity)).toBe(0);
        expect(clampSeekMs(9_999_999, Infinity)).toBe(9_999_999);
    });

    it('a non-finite seek reads as 0 rather than poisoning the playhead', () => {
        expect(clampSeekMs(NaN, 3000)).toBe(0);
        expect(clampSeekMs(-Infinity, 3000)).toBe(0);
        // Infinity means "the end", so it clamps like any other overshoot...
        expect(clampSeekMs(Infinity, 3000)).toBe(3000);
        // ...but an endless timeline has no end to land on, and handing back a non-finite
        // playhead would poison every later read.
        expect(clampSeekMs(Infinity, Infinity)).toBe(0);
    });
});

describe('timeToProgress', () => {

    it('maps the whole run, iterations included — not one iteration', () => {
        // The React Native bug §3 names: 1500ms of a 3×1000ms run is HALF the run,
        // not "500ms into iteration 2".
        expect(timeToProgress(1500, DUR, 3)).toBeCloseTo(0.5);
        expect(timeToProgress(0, DUR, 3)).toBe(0);
        expect(timeToProgress(3000, DUR, 3)).toBe(1);
    });

    it('clamps past the end of a finite run', () => {
        expect(timeToProgress(4000, DUR, 3)).toBe(1);
        expect(timeToProgress(-500, DUR, 3)).toBe(0);
    });

    it('wraps within the current iteration when endless', () => {
        expect(timeToProgress(500, DUR, Infinity)).toBeCloseTo(0.5);
        expect(timeToProgress(2500, DUR, Infinity)).toBeCloseTo(0.5);
    });

    it('a zero-length timeline reads 0, not NaN', () => {
        expect(timeToProgress(100, 0, 3)).toBe(0);
        expect(Number.isNaN(timeToProgress(100, 0, 3))).toBe(false);
    });
});

describe('progressToTimeMs', () => {

    it('maps 0–1 onto the whole run', () => {
        expect(progressToTimeMs(0.5, DUR, 3)).toBe(1500);
        expect(progressToTimeMs(0, DUR, 3)).toBe(0);
        expect(progressToTimeMs(1, DUR, 3)).toBe(3000);
    });

    it('clamps out-of-range progress instead of overshooting', () => {
        expect(progressToTimeMs(1.5, DUR, 3)).toBe(3000);
        expect(progressToTimeMs(-1, DUR, 3)).toBe(0);
        expect(progressToTimeMs(NaN, DUR, 3)).toBe(0);
    });

    it('spans ONE iteration when endless — the documented `progress` prop rule', () => {
        expect(progressToTimeMs(0.5, DUR, Infinity)).toBe(500);
        expect(progressToTimeMs(1, DUR, Infinity)).toBe(DUR);
    });
});

describe('createRunClock — whole-run time across iterations', () => {

    /** A clock driven by a variable we control, so no real time has to pass. */
    const fake = (ceiling = 3000) => {
        let t = 0;
        const clock = createRunClock(ceiling, () => t);
        return { clock, advance: (ms: number) => { t += ms; } };
    };

    it('starts stopped at 0', () => {
        const { clock } = fake();
        expect(clock.now()).toBe(0);
        expect(clock.isRunning()).toBe(false);
    });

    it('runs even when the time source itself reads 0', () => {
        // The running flag must not be inferred from the start timestamp. `Date.now()` is
        // never 0, so treating `startedAt === 0` as "stopped" works in production and fails
        // only under an injected clock — a bug that would otherwise never surface.
        let t = 0;
        const clock = createRunClock(3000, () => t);
        clock.start(1);
        expect(clock.isRunning()).toBe(true);
        t = 250;
        expect(clock.now()).toBe(250);
    });

    it('advances while running and freezes when stopped', () => {
        const { clock, advance } = fake();
        clock.start(1);
        advance(500);
        expect(clock.now()).toBe(500);

        clock.stop();
        advance(400);
        expect(clock.now()).toBe(500);   // frozen, not 900
        expect(clock.isRunning()).toBe(false);
    });

    it('resumes from where it stopped', () => {
        const { clock, advance } = fake();
        clock.start(1);
        advance(500);
        clock.stop();
        clock.start(1);
        advance(100);
        expect(clock.now()).toBe(600);
    });

    it('keeps counting PAST one iteration — the whole point (§3)', () => {
        // A 3×1000ms run: at 2500ms the playhead is 2500 into the RUN, even though the
        // animated value is only 500 into its third iteration.
        const { clock, advance } = fake();
        clock.start(1);
        advance(2500);
        expect(clock.now()).toBe(2500);
    });

    it('honors the rate', () => {
        const { clock, advance } = fake();
        clock.start(2);
        advance(500);
        expect(clock.now()).toBe(1000);
    });

    it('runs backwards on a negative rate, never below 0', () => {
        const { clock, advance } = fake();
        clock.seek(1000);
        clock.start(-1);
        advance(400);
        expect(clock.now()).toBe(600);
        advance(5000);
        expect(clock.now()).toBe(0);
    });

    it('clamps at the ceiling', () => {
        const { clock, advance } = fake();
        clock.start(1);
        advance(999_999);
        expect(clock.now()).toBe(3000);
    });

    it('seeks while running without losing the rate', () => {
        const { clock, advance } = fake();
        clock.start(1);
        advance(200);
        clock.seek(2000);
        expect(clock.now()).toBe(2000);
        advance(100);
        expect(clock.now()).toBe(2100);
    });

    it('a rejected rate falls back to 1 instead of freezing time', () => {
        const { clock, advance } = fake();
        clock.start(0);
        advance(300);
        expect(clock.now()).toBe(300);
    });

    it('an endless timeline keeps counting up', () => {
        const { clock, advance } = fake(Infinity);
        clock.start(1);
        advance(10_000);
        expect(clock.now()).toBe(10_000);
    });
});

describe('the two directions agree', () => {

    it('round-trips a finite run', () => {
        for (const t of [0, 250, 1500, 2999, 3000]) {
            expect(progressToTimeMs(timeToProgress(t, DUR, 3), DUR, 3)).toBeCloseTo(t);
        }
    });

    it('round-trips an endless run within the iteration', () => {
        for (const t of [0, 250, 999]) {
            expect(progressToTimeMs(timeToProgress(t, DUR, Infinity), DUR, Infinity)).toBeCloseTo(t);
        }
    });
});
