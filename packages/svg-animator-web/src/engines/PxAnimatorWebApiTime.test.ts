/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// The shared time contract (API review §3) as the WAAPI engine implements it.
//
// This engine was the odd one out: `setCurrentTime` passed the value straight to
// `Animation.currentTime`, which accepts anything and would park the playhead past the end,
// and `setPlaybackRate(0)` was accepted where the other two engines rejected it.
//
// jsdom has no Web Animations API, so the two classes the engine constructs are stubbed with
// the bare minimum — the same approach as PxAnimatorWebApiTrigger.test.ts.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAnimator } from '../animator/PxAnimator';
import type { PxAnimatedSvgDocument } from '@pixodesk/svg-animator-core';

const DUR = 1000;

/** Every Animation the engine builds, so the test can read what was actually applied. */
const created: Array<StubAnimation> = [];

class StubKeyframeEffect {
    constructor(readonly target: Element, readonly keyframes: unknown, private readonly timing: EffectTiming) {}
    getTiming(): EffectTiming { return this.timing; }
    updateTiming(): void {}
}

class StubAnimation {
    playState: AnimationPlayState = 'idle';
    playbackRate = 1;
    currentTime: number | null = 0;
    onfinish: (() => void) | null = null;
    onremove: (() => void) | null = null;
    constructor(readonly effect: StubKeyframeEffect) { created.push(this); }
    play(): void { this.playState = 'running'; }
    pause(): void { this.playState = 'paused'; }
    cancel(): void { this.playState = 'idle'; }
    finish(): void { this.playState = 'finished'; }
}

function doc(timeline: Record<string, unknown> = {}): PxAnimatedSvgDocument {
    return {
        type: 'svg',
        viewBox: '0 0 100 100',
        animator: { timeline: { engine: 'native', duration: DUR, ...timeline } },
        children: [{
            type: 'rect', id: 'r1', opacity: 0,
            animate: { opacity: { keyframes: [{ time: 0, value: 0 }, { time: DUR, value: 1 }] } },
        }],
    };
}

beforeEach(() => {
    created.length = 0;
    document.body.innerHTML = '<div id="stage"></div>';
    vi.stubGlobal('KeyframeEffect', StubKeyframeEffect);
    vi.stubGlobal('Animation', StubAnimation);
    vi.stubGlobal('CSS', { supports: () => true });
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('WAAPI engine — the shared time contract', () => {

    it('clamps a seek past the end (WAAPI itself would accept it)', () => {
        const api = createAnimator({ doc: doc(), container: '#stage' });

        api.setCurrentTime(99_999);
        expect(api.getCurrentTime()).toBe(DUR);
        // ...and it reached the real Animation objects, not just the wrapper.
        expect(created.every(a => a.currentTime === DUR)).toBe(true);
    });

    it('floors a negative seek at 0', () => {
        const api = createAnimator({ doc: doc(), container: '#stage' });

        api.setCurrentTime(-500);
        expect(api.getCurrentTime()).toBe(0);
    });

    it('clamps to duration × iterations, not to one iteration', () => {
        const api = createAnimator({ doc: doc({ iterations: 3 }), container: '#stage' });

        api.setCurrentTime(99_999);
        expect(api.getCurrentTime()).toBe(DUR * 3);
    });

    it('leaves an endless timeline unbounded — there is no end to clamp to', () => {
        const api = createAnimator({ doc: doc({ iterations: 'infinite' }), container: '#stage' });

        api.setCurrentTime(DUR * 10);
        expect(api.getCurrentTime()).toBe(DUR * 10);
    });

    it('rejects a rate of 0 with a warning and leaves the rate alone', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => { });
        const api = createAnimator({ doc: doc(), container: '#stage' });

        api.setPlaybackRate(0);

        expect(warn).toHaveBeenCalled();
        expect(created.every(a => a.playbackRate === 1)).toBe(true);
        warn.mockRestore();
    });

    it('still accepts ordinary rates, forwards and backwards', () => {
        const api = createAnimator({ doc: doc(), container: '#stage' });

        api.setPlaybackRate(2);
        expect(created.every(a => a.playbackRate === 2)).toBe(true);

        api.setPlaybackRate(-1);
        expect(created.every(a => a.playbackRate === -1)).toBe(true);
    });

    it('reports progress as 0–1 of the whole run', () => {
        const api = createAnimator({ doc: doc({ iterations: 2 }), container: '#stage' });

        api.setCurrentTime(DUR);            // end of iteration 1 = half the run
        expect(api.getCurrentProgress()).toBeCloseTo(0.5, 5);

        api.setCurrentProgress(1);
        expect(api.getCurrentTime()).toBe(DUR * 2);
    });
});
