/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAdapterSvgAnimationPlayer, type PxPlatformAdapter } from './PxAnimatorFrameLoop';
import type { PxDocument, PxEngineCallbacks, PxInfer, PxTimeTimelineSchema } from '@pixodesk/svg-animator-core';

/** The time-driven member of the wire `timeline` — what every override below patches. */
type PxTimeTimeline = PxInfer<typeof PxTimeTimelineSchema>;


// Under vi.useFakeTimers() the faked requestAnimationFrame fires every 16ms and
// Date.now() is faked too, so vi.advanceTimersByTime() steps both in lockstep
// (same approach as index.test.ts). DUR is a multiple of 16 so the natural end
// lands exactly on a rAF tick.
const DUR = 320;

/**
 * Minimal frames-mode doc: one rect whose opacity animates 0 → 1 over DUR ms.
 *
 * The override is a `timeline` partial — that is where the wire format keeps every playback
 * knob. `frameRate` used to be the one exception, routed back out to `animator`; since it moved
 * into the timeline (2026-09-09) there is no exception left to carve out.
 */
function makeDoc(timeline: PxTimeTimeline = {}): PxDocument {
    return {
        type: 'svg',
        viewBox: '0 0 100 100',
        animator: {
            timeline: { engine: 'js', outTime: DUR, ...timeline },
        },
        children: [
            {
                type: 'rect',
                id: 'el1',
                opacity: 0,
                animate: {
                    opacity: {
                        keyframes: [
                            { time: 0, value: 0 },
                            { time: DUR, value: 1 },
                        ],
                    },
                },
            },
        ],
    };
}

/** Mock adapter: records every setAttribute call and keeps the latest values. */
function createMockAdapter() {
    const calls: Array<{ id: string; attr: string; value: string }> = [];
    const attrs = new Map<string, string>();
    const adapter: PxPlatformAdapter = {
        isConnected: () => true,
        setAttribute: (id, attr, value) => {
            calls.push({ id, attr, value });
            attrs.set(id + '|' + attr, value);
        },
    };
    /** Last rendered opacity of #el1 as a number (NaN if never rendered). */
    const opacity = () => parseFloat(attrs.get('el1|opacity') ?? 'NaN');
    return { adapter, calls, opacity };
}

function setup(timeline: PxTimeTimeline = {}, callbacks?: PxEngineCallbacks) {
    const mock = createMockAdapter();
    const api = createAdapterSvgAnimationPlayer(makeDoc(timeline), mock.adapter, callbacks);
    return { api, ...mock };
}


describe('createAdapterSvgAnimationPlayer', () => {
    beforeEach(() => {
        // 'performance' must be faked alongside requestAnimationFrame: with the
        // default toFake set, jsdom's rAF stops firing from the second test in
        // a file onwards (rAF scheduling is driven by performance.now()).
        vi.useFakeTimers({
            toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame'],
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('play() interpolates attribute values over time (start / mid / end)', () => {
        const { api, calls, opacity } = setup();

        // No renders before play (no delay configured).
        expect(calls.length).toBe(0);

        api.play();
        vi.advanceTimersByTime(16); // first rAF tick
        expect(opacity()).toBeCloseTo(16 / DUR, 5);

        vi.advanceTimersByTime(DUR / 2 - 16); // t = 160 (midpoint)
        expect(opacity()).toBeCloseTo(0.5, 5);

        vi.advanceTimersByTime(DUR / 2); // t = 320 (natural end)
        expect(opacity()).toBe(1);
        expect(api.isPlaying()).toBe(false);
    });

    it('positive delay: no renders during the delay window with default fill, then starts', () => {
        const { api, calls, opacity } = setup({ delay: 160 });

        api.play();
        vi.advanceTimersByTime(144); // still inside the delay window (raw time < 0)
        expect(calls.length).toBe(0);

        vi.advanceTimersByTime(16); // t = 160 → animation time 0
        expect(opacity()).toBe(0);

        vi.advanceTimersByTime(160); // t = 320 → animation time 160
        expect(opacity()).toBeCloseTo(0.5, 5);
    });

    it("positive delay with fill 'backwards': first frame is rendered during the delay", () => {
        const { api, calls, opacity } = setup({ delay: 160, whenIdle: 'firstFrame', whenFinished: 'jumpToStart' });

        // The first frame is rendered already at construction time.
        expect(calls.length).toBeGreaterThan(0);
        expect(opacity()).toBe(0);

        api.play();
        vi.advanceTimersByTime(144); // inside the delay window: frame 0 keeps being rendered
        expect(calls.length).toBeGreaterThan(1);
        expect(calls.every(c => c.value === '0')).toBe(true);

        vi.advanceTimersByTime(176); // t = 320 → animation time 160
        expect(opacity()).toBeCloseTo(0.5, 5);
    });

    it('negative delay seeks into the animation', () => {
        const { api, opacity } = setup({ delay: -160 });

        // The seeked frame is rendered immediately at construction time.
        expect(opacity()).toBeCloseTo(0.5, 5);

        api.play();
        vi.advanceTimersByTime(80); // animation time 160 + 80 = 240
        expect(opacity()).toBeCloseTo(0.75, 5);

        vi.advanceTimersByTime(80); // animation time 320 → natural end
        expect(opacity()).toBe(1);
    });

    it("fill 'forwards' (default) holds the final frame after the natural end", () => {
        const { api, opacity } = setup();

        api.play();
        vi.advanceTimersByTime(DUR + 64);
        expect(opacity()).toBe(1);
        expect(api.isPlaying()).toBe(false);
    });

    it("fill 'none' reverts to frame 0 at the natural end", () => {
        const { api, calls } = setup({ whenFinished: 'jumpToStart' });

        api.play();
        vi.advanceTimersByTime(DUR + 64);

        // The last rendered state is the fill:'none' revert to frame 0.
        expect(calls[calls.length - 1].value).toBe('0');
    });

    it("fill 'both' holds the first frame during the delay AND the final frame after the end", () => {
        const { api, calls, opacity } = setup({ delay: 160, whenIdle: 'firstFrame' });

        // Backwards side: frame 0 rendered at construction and throughout the delay window.
        expect(opacity()).toBe(0);
        api.play();
        vi.advanceTimersByTime(144); // inside the delay window
        expect(calls.every(c => c.value === '0')).toBe(true);

        // Forwards side: after the natural end the final frame is held.
        vi.advanceTimersByTime(16 + DUR + 64); // through animation time 0 → DUR, past the end
        expect(opacity()).toBe(1);
        expect(api.isPlaying()).toBe(false);
    });

    it('iterations: 2 wraps progress within each iteration and finishes after both', () => {
        const onFinish = vi.fn();
        const { api, opacity } = setup({ iterations: 2 }, { onFinish });

        api.play();
        vi.advanceTimersByTime(480); // midpoint of the second iteration
        expect(opacity()).toBeCloseTo(0.5, 5);
        expect(onFinish).not.toHaveBeenCalled();

        vi.advanceTimersByTime(160); // t = 640 = 2 × DUR → natural end
        expect(opacity()).toBe(1);
        expect(onFinish).toHaveBeenCalledTimes(1);
    });

    it("iterations: 'infinite' keeps playing and wraps progress", () => {
        const onFinish = vi.fn();
        const { api, opacity } = setup({ iterations: 'infinite' }, { onFinish });

        api.play();
        vi.advanceTimersByTime(3 * DUR + 160); // midpoint of the fourth iteration
        expect(opacity()).toBeCloseTo(0.5, 5);
        expect(api.isPlaying()).toBe(true);
        expect(onFinish).not.toHaveBeenCalled();
    });

    it.each<{ name: string; timeline: PxTimeTimeline; at: number; expected: number }>([
        { name: "direction 'reverse' mirrors progress", timeline: { iterationDirection: 'reverse' }, at: 80, expected: 0.75 },
        { name: "direction 'alternate' plays iteration 0 forward", timeline: { iterationDirection: 'alternate', iterations: 2 }, at: 80, expected: 0.25 },
        { name: "direction 'alternate' mirrors iteration 1", timeline: { iterationDirection: 'alternate', iterations: 2 }, at: DUR + 80, expected: 0.75 },
        { name: "direction 'alternateReverse' mirrors iteration 0", timeline: { iterationDirection: 'alternateReverse', iterations: 2 }, at: 80, expected: 0.75 },
    ])('$name', ({ timeline, at, expected }) => {
        const { api, opacity } = setup(timeline);
        api.play();
        vi.advanceTimersByTime(at);
        expect(opacity()).toBeCloseTo(expected, 5);
    });

    it('setPlaybackSpeed(2) doubles progress', () => {
        const { api, opacity } = setup();

        api.play();
        api.setPlaybackSpeed(2);
        vi.advanceTimersByTime(80); // logical time 160
        expect(opacity()).toBeCloseTo(0.5, 5);

        vi.advanceTimersByTime(80); // logical time 320 → natural end
        expect(opacity()).toBe(1);
    });

    it('setPlaybackSpeed(-1) after seeking to the end plays backwards and fires onFinish once at 0', () => {
        const onFinish = vi.fn();
        const { api, opacity } = setup({}, { onFinish });

        api.playback.setCurrentTime(DUR);
        api.setPlaybackSpeed(-1);
        api.play();

        vi.advanceTimersByTime(160); // logical time 320 − 160 = 160
        expect(opacity()).toBeCloseTo(0.5, 5);
        expect(onFinish).not.toHaveBeenCalled();

        vi.advanceTimersByTime(160); // reaches 0 → reverse-playback finish
        expect(opacity()).toBe(0);
        expect(onFinish).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(160); // no re-fire after finishing
        expect(onFinish).toHaveBeenCalledTimes(1);
    });

    it('play() at the start with rate -1 rewinds to the end and plays backwards', () => {
        const { api, opacity } = setup();

        api.setPlaybackSpeed(-1);
        api.play(); // at time 0 with rate < 0 → auto-seeks to the end

        vi.advanceTimersByTime(16);
        expect(opacity()).toBeCloseTo((DUR - 16) / DUR, 5);

        vi.advanceTimersByTime(144); // logical time 320 − 160 = 160
        expect(opacity()).toBeCloseTo(0.5, 5);
    });

    it('callbacks: onPlay / onPause fire; onFinish fires exactly once; jumpToStart() reports nothing; onDestroy on destroy()', () => {
        const callbacks = {
            onPlay: vi.fn(), onPause: vi.fn(),
            onFinish: vi.fn(), onDestroy: vi.fn(),
        };
        const { api } = setup({}, callbacks);

        api.play();
        expect(callbacks.onPlay).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(32);
        api.pause();
        expect(callbacks.onPause).toHaveBeenCalledTimes(1);

        api.play();
        vi.advanceTimersByTime(DUR); // past the natural end
        expect(callbacks.onFinish).toHaveBeenCalledTimes(1);
        vi.advanceTimersByTime(160);
        expect(callbacks.onFinish).toHaveBeenCalledTimes(1); // not re-fired

        api.jumpToStart();
        expect(callbacks.onPlay).toHaveBeenCalledTimes(2);   // like a seek: nothing new reported
        expect(callbacks.onPause).toHaveBeenCalledTimes(1);
        expect(callbacks.onFinish).toHaveBeenCalledTimes(1);

        api.destroy();
        expect(callbacks.onDestroy).toHaveBeenCalledTimes(1);
    });

    it('setCurrentTime seeks and re-arms onFinish', () => {
        const onFinish = vi.fn();
        const { api, opacity } = setup({}, { onFinish });

        api.play();
        vi.advanceTimersByTime(DUR);
        expect(onFinish).toHaveBeenCalledTimes(1);

        api.playback.setCurrentTime(0);
        expect(opacity()).toBe(0); // seek renders immediately
        expect(api.playback.getCurrentTime()).toBe(0);

        api.play();
        vi.advanceTimersByTime(DUR);
        expect(onFinish).toHaveBeenCalledTimes(2);
        expect(opacity()).toBe(1);
    });

    it('frameRate throttling skips renders between frames', () => {
        const onFinish = vi.fn();
        const throttled = setup({ frameRate: 10 }, { onFinish }); // min 100ms between renders
        const unthrottled = setup();

        throttled.api.play();
        unthrottled.api.play();
        vi.advanceTimersByTime(DUR);

        // rAF ticks every 16ms → unthrottled renders on every tick; throttled
        // renders far fewer (≥100ms apart), plus the guaranteed finish frame.
        expect(unthrottled.calls.length).toBeGreaterThan(15);
        expect(throttled.calls.length).toBeLessThan(8);

        // Boundary states bypass the throttle: the natural end must always
        // render the final frame and fire onFinish, even when the finishing
        // tick would otherwise be throttle-skipped.
        vi.advanceTimersByTime(DUR);
        expect(onFinish).toHaveBeenCalledTimes(1);
        expect(throttled.calls[throttled.calls.length - 1].value).toBe('1');
    });

    // -- Regressions from adversarial review ---------------------------------

    it('onFinish fires on every replay of a hover/reverse trigger cycle (finish re-arms on play)', () => {
        // Mirrors what setupAnimationTriggers produces for
        // `start: 'hoverIn'` + `stop: 'hoverOut'` with `actions: { stop: { behavior: 'animateToStart' } }`:
        // hover → play to end, leave → reverse to 0, hover → forward to end.
        const onFinish = vi.fn();
        const { api } = setup({}, { onFinish });

        api.play();                       // hover: forward
        vi.advanceTimersByTime(DUR + 32); // natural end
        expect(onFinish).toHaveBeenCalledTimes(1);

        api.setPlaybackSpeed(-1);          // leave: reverse
        api.play();
        vi.advanceTimersByTime(DUR + 32); // reverse end at t=0
        expect(onFinish).toHaveBeenCalledTimes(2);

        api.setPlaybackSpeed(1);           // hover again: forward
        api.play();
        vi.advanceTimersByTime(DUR + 32); // natural end again
        expect(onFinish).toHaveBeenCalledTimes(3);
    });

    it('pause() during the delay phase preserves the remaining delay and renders nothing (default fill)', () => {
        const { api, calls, opacity } = setup({ delay: 160 });

        api.play();
        vi.advanceTimersByTime(96);  // still inside the delay window
        api.pause();

        // No frame-0 write leaked through the pause (fill defaults exclude
        // 'backwards'... default is 'forwards' → nothing rendered pre-start).
        expect(calls.length).toBe(0);

        api.play();
        vi.advanceTimersByTime(48);  // 96 + 48 = 144 < 160 → still waiting
        expect(calls.length).toBe(0);

        vi.advanceTimersByTime(80);  // now 64ms past the delay
        expect(opacity()).toBeGreaterThan(0);
        expect(opacity()).toBeLessThan(0.3);
    });

    it('setPlaybackSpeed() during the delay phase preserves the remaining delay', () => {
        const { api, calls } = setup({ delay: 160 });

        api.play();
        vi.advanceTimersByTime(96);  // inside the delay window
        api.setPlaybackSpeed(2);

        vi.advanceTimersByTime(16);  // raw time ≈ -64 + 32 = -32 → still waiting
        expect(calls.length).toBe(0);
    });

    it("finish() honors fill:'none' (reverts to frame 0, same as the natural end)", () => {
        const { api, calls } = setup({ whenFinished: 'jumpToStart' });

        api.play();
        vi.advanceTimersByTime(64);
        api.jumpToEnd();

        expect(calls[calls.length - 1].value).toBe('0');
    });

    // -- The shared time contract (API review §3) -----------------------------

    describe('time contract', () => {

        it('rejects a rate of 0 with a warning and keeps playing at the old rate', () => {
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => { });
            const { api, opacity } = setup();

            api.play();
            api.setPlaybackSpeed(0);
            expect(warn).toHaveBeenCalled();

            // Still advancing at 1×: a rate of 0 must not have frozen it.
            vi.advanceTimersByTime(DUR / 2);
            expect(opacity()).toBeCloseTo(0.5, 5);
            warn.mockRestore();
        });

        it('clamps a seek past the end instead of parking beyond it — on both axes', () => {
            const { api } = setup();

            api.playback.setCurrentTime(99_999);
            expect(api.playback.getCurrentTime()).toBe(DUR);
            api.playback.setCurrentTime(-500);
            expect(api.playback.getCurrentTime()).toBe(0);
            api.setTotalTime(99_999);
            expect(api.getTotalTime()).toBe(DUR);
            api.setTotalTime(-500);
            expect(api.getTotalTime()).toBe(0);
        });

        it('getCurrentProgress reads 0–1 of the iteration', () => {
            const { api } = setup();

            expect(api.playback.getCurrentProgress()).toBe(0);
            api.playback.setCurrentTime(DUR / 2);
            expect(api.playback.getCurrentProgress()).toBeCloseTo(0.5, 5);
            api.playback.setCurrentTime(DUR);
            expect(api.playback.getCurrentProgress()).toBe(1);
        });

        it('setCurrentProgress is the inverse of getCurrentProgress', () => {
            const { api } = setup();

            api.playback.setCurrentProgress(0.5);
            expect(api.playback.getCurrentTime()).toBeCloseTo(DUR / 2, 5);
            expect(api.playback.getCurrentProgress()).toBeCloseTo(0.5, 5);
        });

        it('the plain time axis is the iteration, progress counts iterations, the total axis is the playback (A5; 1.26)', () => {
            // 2 × 320ms: the playback is two passes; the plain reads never leave the pass they are in.
            const { api } = setup({ iterations: 2 });

            api.setTotalTime(DUR + DUR / 2);          // halfway through the second pass
            expect(api.playback.getCurrentIteration()).toBe(1);
            expect(api.playback.getCurrentTime()).toBeCloseTo(DUR / 2, 5);
            expect(api.playback.getCurrentProgress()).toBeCloseTo(1.5, 5);   // counted in iterations, in play order
            expect(api.playback.getTotalDuration()).toBe(DUR * 2);

            api.playback.setCurrentProgress(2);               // the end of the SECOND pass
            expect(api.getTotalTime()).toBeCloseTo(DUR * 2, 5);
            api.playback.setCurrentTime(DUR / 4);             // a quarter into the CURRENT pass
            expect(api.getTotalTime()).toBeCloseTo(DUR + DUR / 4, 5);
            expect(api.playback.getCurrentIteration()).toBe(1);
            api.playback.setCurrentTime(0);                   // the pass's start is the previous pass's end — the boundary belongs to the pass it ends
            expect(api.getTotalTime()).toBeCloseTo(DUR, 5);
            expect(api.playback.getCurrentIteration()).toBe(0);
        });

        it('a reversed pass of alternate counts the plain axis DOWN — the frame on screen', () => {
            const { api } = setup({ iterations: 2, iterationDirection: 'alternate' });

            api.setTotalTime(DUR + DUR / 4);         // a quarter into the second, reversed pass
            expect(api.playback.getCurrentTime()).toBeCloseTo(DUR * 3 / 4, 5);
            expect(api.playback.getCurrentProgress()).toBeCloseTo(1.25, 5);   // progress is play order: a quarter into the second pass
            api.playback.setCurrentTime(DUR / 4);              // ask for the frame at a quarter: three quarters into the pass
            expect(api.getTotalTime()).toBeCloseTo(DUR + DUR * 3 / 4, 5);
        });

        it('an endless playback: the plain time axis wraps, progress and the total axis are unbounded, its length null', () => {
            const { api } = setup({ iterations: 'infinite' });

            api.setTotalTime(DUR * 2 + DUR / 2);     // two passes done, halfway through the third
            expect(api.playback.getCurrentIteration()).toBe(2);
            expect(api.playback.getCurrentProgress()).toBeCloseTo(2.5, 5);
            expect(api.playback.getTotalDuration()).toBeNull();

            api.setTotalTime(DUR * 10);              // unbounded: there is no end to clamp to
            expect(api.getTotalTime()).toBe(DUR * 10);
        });
    });
});
