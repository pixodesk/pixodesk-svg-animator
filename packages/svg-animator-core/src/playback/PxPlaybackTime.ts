/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// ONE time contract for every engine (API review §3). The same three calls used to mean three
// different things:
//
//   | engine          | getCurrentTime()        | setCurrentTime(t) | setPlaybackRate(0) |
//   |-----------------|-------------------------|-------------------|--------------------|
//   | web, WAAPI      | ms across the whole run | NOT clamped       | accepted           |
//   | web, frame loop | ms across the whole run | clamped           | rejected + warn    |
//   | React Native    | ms within ONE iteration | wrapped           | rejected + warn    |
//
// So a slider built on `getCurrentTime()` jumped back every iteration on React Native, and
// `timeline.engine: 'auto'` meant two documents on one page could answer the same call
// differently. The contract every player now implements:
//
//   - time is ms from the start of the WHOLE run, iterations included — never per-iteration;
//   - a seek clamps to [0, seekCeilingMs];
//   - a rate of 0 is rejected everywhere, with this one message.

/** The one message every engine prints for a rejected rate. */
export const PX_RATE_REJECTED = 'setPlaybackRate: rate must be finite and non-zero';

/**
 * A playback rate is usable when it is finite and non-zero.
 *
 * 0 is rejected rather than accepted: it freezes the animation in a state indistinguishable
 * from a stuck player, and `pause()` already says that properly. Two of the three engines
 * rejected it already — this makes the third agree.
 */
export function isValidPlaybackRate(rate: number): boolean {
    return Number.isFinite(rate) && rate !== 0;
}

/**
 * Highest seekable time, ms — `duration × iterations`.
 *
 * `Infinity` for an endless timeline, so callers must test `Number.isFinite` before using it
 * as an upper bound. This is the SEEK ceiling, which is deliberately not the same thing as the
 * span `progress` covers — see `progressSpanMs`.
 */
export function seekCeilingMs(durationMs: number, iterations: number): number {
    if (!(durationMs > 0)) return 0;
    if (iterations === Infinity) return Infinity;
    return durationMs * (iterations > 0 ? iterations : 1);
}

/**
 * The span `progress` 0→1 covers, ms.
 *
 * An endless timeline maps progress onto ONE iteration — the rule the components already
 * document for the `progress` prop ("0–1 of duration × iterations, one iteration when
 * iterations is 'infinite'"). Always finite, so it is safe as a divisor.
 */
export function progressSpanMs(durationMs: number, iterations: number): number {
    if (!(durationMs > 0)) return 0;
    if (iterations === Infinity) return durationMs;
    return durationMs * (iterations > 0 ? iterations : 1);
}

/**
 * Clamps a seek into [0, ceiling].
 *
 * `NaN` and anything below 0 land on 0. `Infinity` means "the end", so it clamps to the ceiling
 * like any other overshoot — except on an endless timeline, where there is no end to land on and
 * a non-finite playhead would poison every later read, so that reads as 0.
 */
export function clampSeekMs(timeMs: number, ceilingMs: number): number {
    if (Number.isNaN(timeMs) || timeMs < 0) return 0;
    if (Number.isFinite(ceilingMs)) return timeMs > ceilingMs ? ceilingMs : timeMs;
    return Number.isFinite(timeMs) ? timeMs : 0;
}

/**
 * Whole-run ms → 0–1.
 *
 * A finite timeline clamps at both ends. An endless one wraps within the current iteration,
 * so the value stays meaningful however long it has been running. A zero-length span reads as
 * 0 rather than NaN.
 */
export function timeToProgress(timeMs: number, durationMs: number, iterations: number): number {
    const span = progressSpanMs(durationMs, iterations);
    if (!(span > 0) || !Number.isFinite(timeMs)) return 0;
    if (timeMs <= 0) return 0;
    if (iterations === Infinity) return (timeMs % span) / span;
    return timeMs >= span ? 1 : timeMs / span;
}

/** 0–1 → whole-run ms, clamped into the span. A non-finite progress reads as 0. */
export function progressToTimeMs(progress: number, durationMs: number, iterations: number): number {
    const span = progressSpanMs(durationMs, iterations);
    if (!(span > 0) || !Number.isFinite(progress)) return 0;
    if (progress <= 0) return 0;
    return progress >= 1 ? span : progress * span;
}

/** A playhead that keeps whole-run time across iterations. See `createRunClock`. */
export interface PxRunClock {
    /** Whole-run position right now, ms, clamped to the ceiling. */
    now(): number;
    /** True while time is advancing. */
    isRunning(): boolean;
    /** Start or resume at `rate`, optionally from a given whole-run time. */
    start(rate: number, atMs?: number): void;
    /** Stop advancing, freezing the current position. */
    stop(): void;
    /** Jump to a whole-run time; keeps running if it already was. */
    seek(ms: number): void;
}

/**
 * A whole-run playhead that survives repetition.
 *
 * React Native drives playback with Reanimated's `withRepeat`, whose shared value only ever
 * holds the position WITHIN one iteration and which never reports how many iterations have
 * elapsed. Whole-run time therefore cannot be recovered from it: under `alternate` the value
 * runs backwards rather than wrapping, which is indistinguishable from a negative rate. So the
 * time is kept on a clock of its own — the same thing the frame-loop engine does inline.
 *
 * `nowFn` is injectable so this is testable without real time passing.
 */
export function createRunClock(ceilingMs: number, nowFn: () => number = Date.now): PxRunClock {
    let baseMs = 0;        // whole-run ms as of the last start/seek/stop
    let startedAt = 0;     // nowFn() when running began
    let running = false;   // a FLAG, not `startedAt !== 0`: a time source may legitimately
    let rate = 1;          //   read 0, and `Date.now()` never does — so the bug would hide.

    const value = (): number => running
        ? clampSeekMs(baseMs + (nowFn() - startedAt) * rate, ceilingMs)
        : clampSeekMs(baseMs, ceilingMs);

    return {
        now: value,
        isRunning: () => running,
        start: (r: number, atMs?: number) => {
            baseMs = clampSeekMs(atMs ?? value(), ceilingMs);
            rate = isValidPlaybackRate(r) ? r : 1;
            startedAt = nowFn();
            running = true;
        },
        stop: () => {
            baseMs = value();
            startedAt = 0;
            running = false;
        },
        seek: (ms: number) => {
            baseMs = clampSeekMs(ms, ceilingMs);
            if (running) startedAt = nowFn();
        },
    };
}
