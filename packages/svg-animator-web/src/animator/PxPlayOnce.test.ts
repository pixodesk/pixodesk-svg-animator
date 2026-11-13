/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/
// The one-pass recipe that replaced `playOnce()` in 1.26 (`runOnce()` in 1.24): `timelineOptions: { iterations: 1 }` and
// `playback.start()`, which is re-entrant — it always plays from the start. Frame-loop engine under fake timers, like
// PxAnimatorWindow.test.ts.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSvgAnimationPlayer } from '../index';
import type { PxDocumentJson } from '@pixodesk/svg-animator-core';

function doc(extra: Record<string, unknown> = {}): PxDocumentJson {
    return {
        type: 'svg', viewBox: '0 0 10 10',
        animator: { timeline: { engine: 'js', outTime: 1000, ...extra } },
        children: [{
            type: 'rect', id: 'r', width: 10, height: 10,
            animate: { opacity: { keyframes: [{ time: 0, value: 0 }, { time: 1000, value: 1 }] } },
        }],
    };
}

const opacity = () => Number(document.querySelector('rect')?.getAttribute('opacity'));

describe('one pass from the start — the recipe that replaced playOnce() (1.26)', () => {
    beforeEach(() => { document.body.innerHTML = '<div id="box"></div>'; vi.useFakeTimers(); });
    afterEach(() => vi.useRealTimers());

    it('start() plays one fresh pass mid-flight — re-entrant restart', () => {
        const api = createSvgAnimationPlayer({ document: doc(), container: '#box' });
        api.playback.start();
        vi.advanceTimersByTime(500);
        expect(api.playback.getCurrentTime()).toBeCloseTo(500, -2);
        api.playback.start();                                      // restart from 0, no juggling
        vi.advanceTimersByTime(32);
        expect(api.playback.getCurrentTime()).toBeLessThan(100);
        api.destroy();
    });

    it('iterations 1 caps a loop-configured document at ONE pass and holds the pass-end pose', () => {
        const api = createSvgAnimationPlayer({ document: doc({ iterations: 'infinite' }), container: '#box', timelineOptions: { iterations: 1 } });
        api.playback.start();
        vi.advanceTimersByTime(1400);                     // well past one pass; watcher settles it
        vi.advanceTimersByTime(200);
        expect(api.playback.isPlaying()).toBe(false);
        expect(api.playback.getCurrentTime()).toBeCloseTo(1000, -2);
        expect(opacity()).toBe(1);
    });

    it("a loop document with whenFinished 'jumpToStart' snaps to rest after the pass", () => {
        const api = createSvgAnimationPlayer({ document: doc({ iterations: 'infinite', actionTriggers: {}, whenFinished: 'jumpToStart' }), container: '#box', timelineOptions: { iterations: 1 } });
        api.playback.start();
        vi.advanceTimersByTime(1600);
        expect(api.playback.isPlaying()).toBe(false);
        expect(opacity()).toBe(0);
    });
});
