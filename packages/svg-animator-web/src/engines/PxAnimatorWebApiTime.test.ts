/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// The shared time contract (API review §3) as the WAAPI engine implements it.
//
// This engine was the odd one out: `setCurrentTime` passed the value straight to
// `Animation.currentTime`, which accepts anything and would park the playhead past the end,
// and `setPlaybackSpeed(0)` was accepted where the other two engines rejected it.
//
// jsdom has no Web Animations API, so the two classes the engine constructs are stubbed with
// the bare minimum — the same approach as PxAnimatorWebApiTrigger.test.ts.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSvgAnimationPlayer } from '../animator/PxAnimator';
import type { PxDocument } from '@pixodesk/svg-animator-core';

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

function doc(timeline: Record<string, unknown> = {}): PxDocument {
    return {
        type: 'svg',
        viewBox: '0 0 100 100',
        animator: { timeline: { engine: 'native', outTime: DUR, ...timeline } },
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
        const api = createSvgAnimationPlayer({ document: doc(), container: '#stage' });

        api.playback.setCurrentTime(99_999);
        expect(api.playback.getCurrentTime()).toBe(DUR);
        // ...and it reached the real Animation objects, not just the wrapper.
        expect(created.every(a => a.currentTime === DUR)).toBe(true);
    });

    it('floors a negative seek at 0', () => {
        const api = createSvgAnimationPlayer({ document: doc(), container: '#stage' });

        api.playback.setCurrentTime(-500);
        expect(api.playback.getCurrentTime()).toBe(0);
    });

    it('the playback axis clamps to duration × iterations; the plain axis stays inside the pass', () => {
        const api = createSvgAnimationPlayer({ document: doc({ iterations: 3 }), container: '#stage' });

        api.playback.setTotalTime(99_999);
        expect(api.playback.getTotalTime()).toBe(DUR * 3);
        expect(api.playback.getTotalDuration()).toBe(DUR * 3);
        expect(api.playback.getCurrentIteration()).toBe(2);
        expect(api.playback.getCurrentTime()).toBe(DUR);          // the last pass's end
        api.playback.setCurrentTime(99_999);                      // a plain seek stays in the current pass
        expect(api.playback.getTotalTime()).toBe(DUR * 3);
    });

    it('leaves an endless playback unbounded — there is no end to clamp to; its total duration is null', () => {
        const api = createSvgAnimationPlayer({ document: doc({ iterations: 'infinite' }), container: '#stage' });

        api.playback.setTotalTime(DUR * 10);
        expect(api.playback.getTotalTime()).toBe(DUR * 10);
        expect(api.playback.getTotalDuration()).toBeNull();
        expect(api.playback.getTotalDurationAtSpeed()).toBeNull();
    });

    it('rejects a rate of 0 with a warning and leaves the rate alone', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => { });
        const api = createSvgAnimationPlayer({ document: doc(), container: '#stage' });

        api.playback.setSpeed(0);

        expect(warn).toHaveBeenCalled();
        expect(created.every(a => a.playbackRate === 1)).toBe(true);
        warn.mockRestore();
    });

    it('still accepts ordinary rates, forwards and backwards', () => {
        const api = createSvgAnimationPlayer({ document: doc(), container: '#stage' });

        api.playback.setSpeed(2);
        expect(created.every(a => a.playbackRate === 2)).toBe(true);

        api.playback.setSpeed(-1);
        expect(created.every(a => a.playbackRate === -1)).toBe(true);
    });

    it('reports progress counted in iterations, in play order (1.26); the plain time axis is the iteration', () => {
        const api = createSvgAnimationPlayer({ document: doc({ iterations: 2 }), container: '#stage' });

        api.playback.setTotalTime(DUR);              // end of iteration 1 = half the playback
        expect(api.playback.getCurrentProgress()).toBe(1);
        expect(api.playback.getCurrentIteration()).toBe(0);
        api.playback.setTotalTime(DUR + DUR / 2);    // halfway through the second pass
        expect(api.playback.getCurrentIteration()).toBe(1);
        expect(api.playback.getCurrentProgress()).toBeCloseTo(1.5, 5);
        expect(api.playback.getCurrentTime()).toBeCloseTo(DUR / 2, 5);

        api.playback.setCurrentProgress(2);          // the end of the second pass
        expect(api.playback.getTotalTime()).toBe(DUR * 2);
        expect(api.playback.getCurrentTime()).toBe(DUR);
    });

    it('the play family is the position and the lengths divided by the speed', () => {
        const api = createSvgAnimationPlayer({ document: doc({ iterations: 2 }), container: '#stage' });
        api.playback.setTotalTime(DUR / 2);
        api.playback.setSpeed(2);
        expect(api.playback.getSpeed()).toBe(2);
        expect(api.playback.getDurationAtSpeed()).toBe(DUR / 2);
        expect(api.playback.getTotalDurationAtSpeed()).toBe(DUR);
        expect(api.playback.getCurrentTimeAtSpeed()).toBeCloseTo(DUR / 4, 5);
        api.playback.setDurationAtSpeed(DUR * 4);        // one pass over four times its length = a quarter speed
        expect(api.playback.getSpeed()).toBe(0.25);
    });
});
