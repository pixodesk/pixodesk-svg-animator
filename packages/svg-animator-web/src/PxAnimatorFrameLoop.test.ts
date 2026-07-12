/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBasicFrameLoopAnimator, type PxPlatformAdapter } from './PxAnimatorFrameLoop';
import type { PxAnimatedSvgDocument, PxAnimatorCallbacksConfig } from './PxAnimatorTypes';


// Under vi.useFakeTimers() the faked requestAnimationFrame fires every 16ms and
// Date.now() is faked too, so vi.advanceTimersByTime() steps both in lockstep
// (same approach as index.test.ts). DUR is a multiple of 16 so the natural end
// lands exactly on a rAF tick.
const DUR = 320;

/** Minimal frames-mode doc: one rect whose opacity animates 0 → 1 over DUR ms. */
function makeDoc(animator: Record<string, any> = {}): PxAnimatedSvgDocument {
    return {
        type: 'svg',
        viewBox: '0 0 100 100',
        animator: { mode: 'frames', duration: DUR, ...animator },
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

function setup(animator: Record<string, any> = {}, callbacks?: PxAnimatorCallbacksConfig) {
    const mock = createMockAdapter();
    const api = createBasicFrameLoopAnimator(makeDoc(animator), mock.adapter, callbacks);
    return { api, ...mock };
}


describe('createBasicFrameLoopAnimator', () => {
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
        const { api, calls, opacity } = setup({ delay: 160, fill: 'backwards' });

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
        const { api, calls } = setup({ fill: 'none' });

        api.play();
        vi.advanceTimersByTime(DUR + 64);

        // The last rendered state is the fill:'none' revert to frame 0.
        expect(calls[calls.length - 1].value).toBe('0');
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

    it.each([
        { name: "direction 'reverse' mirrors progress", animator: { direction: 'reverse' }, at: 80, expected: 0.75 },
        { name: "direction 'alternate' plays iteration 0 forward", animator: { direction: 'alternate', iterations: 2 }, at: 80, expected: 0.25 },
        { name: "direction 'alternate' mirrors iteration 1", animator: { direction: 'alternate', iterations: 2 }, at: DUR + 80, expected: 0.75 },
        { name: "direction 'alternate-reverse' mirrors iteration 0", animator: { direction: 'alternate-reverse', iterations: 2 }, at: 80, expected: 0.75 },
    ])('$name', ({ animator, at, expected }) => {
        const { api, opacity } = setup(animator);
        api.play();
        vi.advanceTimersByTime(at);
        expect(opacity()).toBeCloseTo(expected, 5);
    });

    it('setPlaybackRate(2) doubles progress', () => {
        const { api, opacity } = setup();

        api.play();
        api.setPlaybackRate(2);
        vi.advanceTimersByTime(80); // logical time 160
        expect(opacity()).toBeCloseTo(0.5, 5);

        vi.advanceTimersByTime(80); // logical time 320 → natural end
        expect(opacity()).toBe(1);
    });

    it('setPlaybackRate(-1) after seeking to the end plays backwards and fires onFinish once at 0', () => {
        const onFinish = vi.fn();
        const { api, opacity } = setup({}, { onFinish });

        api.setCurrentTime(DUR);
        api.setPlaybackRate(-1);
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

        api.setPlaybackRate(-1);
        api.play(); // at time 0 with rate < 0 → auto-seeks to the end

        vi.advanceTimersByTime(16);
        expect(opacity()).toBeCloseTo((DUR - 16) / DUR, 5);

        vi.advanceTimersByTime(144); // logical time 320 − 160 = 160
        expect(opacity()).toBeCloseTo(0.5, 5);
    });

    it('callbacks: onPlay / onPause / onCancel fire; onFinish fires exactly once; onRemove on destroy()', () => {
        const callbacks = {
            onPlay: vi.fn(), onPause: vi.fn(), onCancel: vi.fn(),
            onFinish: vi.fn(), onRemove: vi.fn(),
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

        api.cancel();
        expect(callbacks.onCancel).toHaveBeenCalledTimes(1);

        api.destroy();
        expect(callbacks.onRemove).toHaveBeenCalledTimes(1);
    });

    it('setCurrentTime seeks and re-arms onFinish', () => {
        const onFinish = vi.fn();
        const { api, opacity } = setup({}, { onFinish });

        api.play();
        vi.advanceTimersByTime(DUR);
        expect(onFinish).toHaveBeenCalledTimes(1);

        api.setCurrentTime(0);
        expect(opacity()).toBe(0); // seek renders immediately
        expect(api.getCurrentTime()).toBe(0);

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
        // startOn:'mouseOver' + outAction:'reverse':
        // hover → play to end, leave → reverse to 0, hover → forward to end.
        const onFinish = vi.fn();
        const { api } = setup({}, { onFinish });

        api.play();                       // hover: forward
        vi.advanceTimersByTime(DUR + 32); // natural end
        expect(onFinish).toHaveBeenCalledTimes(1);

        api.setPlaybackRate(-1);          // leave: reverse
        api.play();
        vi.advanceTimersByTime(DUR + 32); // reverse end at t=0
        expect(onFinish).toHaveBeenCalledTimes(2);

        api.setPlaybackRate(1);           // hover again: forward
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

    it('setPlaybackRate() during the delay phase preserves the remaining delay', () => {
        const { api, calls } = setup({ delay: 160 });

        api.play();
        vi.advanceTimersByTime(96);  // inside the delay window
        api.setPlaybackRate(2);

        vi.advanceTimersByTime(16);  // raw time ≈ -64 + 32 = -32 → still waiting
        expect(calls.length).toBe(0);
    });

    it("finish() honours fill:'none' (reverts to frame 0, same as the natural end)", () => {
        const { api, calls } = setup({ fill: 'none' });

        api.play();
        vi.advanceTimersByTime(64);
        api.finish();

        expect(calls[calls.length - 1].value).toBe('0');
    });
});
