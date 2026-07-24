/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// `animator.resetOnFinish`: after a NATURAL finish the document must snap back to its
// start state (same mechanics as the trigger `reset` out-action — `api.cancel()`),
// instead of holding the end state. Wired centrally in `createAnimatorFromConfig` so
// both engines get it; tested here through the public `createAnimator` (frames mode —
// jsdom has no WAAPI).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAnimator } from './PxAnimator';
import type { PxAnimatedSvgDocument } from './PxAnimatorTypes';


const DUR = 320; // multiple of the 16ms fake-timer rAF step

/** Minimal frames-mode doc: one rect whose opacity animates 0 → 1 over DUR ms. */
function makeDoc(animator: Record<string, unknown> = {}): PxAnimatedSvgDocument {
    return {
        type: 'svg',
        viewBox: '0 0 100 100',
        animator: { mode: 'frames', duration: DUR, ...animator },
        children: [
            {
                type: 'rect',
                id: 'r1',
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
    } as unknown as PxAnimatedSvgDocument;
}

function renderedOpacity(): string | null {
    return document.querySelector('#svg-container rect')?.getAttribute('opacity') ?? null;
}

describe('animator.resetOnFinish', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="svg-container"></div>';
        // 'performance' must be faked alongside requestAnimationFrame (see
        // PxAnimatorFrameLoop.test.ts — rAF scheduling is driven by performance.now()).
        vi.useFakeTimers({
            toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame'],
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('WITHOUT the flag the animation holds its end state (baseline)', () => {
        const api = createAnimator({ data: makeDoc(), container: '#svg-container' });
        api.play();
        vi.advanceTimersByTime(DUR + 32);
        expect(renderedOpacity()).toBe('1');
        api.destroy();
    });

    it('WITH the flag the document snaps back to frame 0 on natural finish', () => {
        const api = createAnimator({ data: makeDoc({ resetOnFinish: true }), container: '#svg-container' });
        api.play();
        vi.advanceTimersByTime(DUR / 2);
        expect(parseFloat(renderedOpacity() ?? 'NaN')).toBeGreaterThan(0);   // mid-flight
        vi.advanceTimersByTime(DUR / 2 + 32);
        expect(renderedOpacity()).toBe('0');   // finished → reset to start
        api.destroy();
    });

    it('the caller’s own onFinish still fires (before the reset)', () => {
        const onFinish = vi.fn();
        const api = createAnimator({ data: makeDoc({ resetOnFinish: true }), container: '#svg-container', callbacks: { onFinish } });
        api.play();
        vi.advanceTimersByTime(DUR + 32);
        expect(onFinish).toHaveBeenCalledTimes(1);
        expect(renderedOpacity()).toBe('0');
        api.destroy();
    });

    it('reset re-arms the animation — play() after finish runs again from the start', () => {
        const api = createAnimator({ data: makeDoc({ resetOnFinish: true }), container: '#svg-container' });
        api.play();
        vi.advanceTimersByTime(DUR + 32);
        expect(renderedOpacity()).toBe('0');
        api.play();
        vi.advanceTimersByTime(DUR / 2);
        expect(parseFloat(renderedOpacity() ?? 'NaN')).toBeCloseTo(0.5, 1);   // replaying
        api.destroy();
    });
});
