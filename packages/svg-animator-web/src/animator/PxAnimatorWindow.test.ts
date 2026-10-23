/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/
// The content window (first-use review §4): `inTime`/`outTime` play a slice of the content and
// `playDuration` remaps it to wall time as an initial rate factor. Frame-loop engine under fake
// timers, like index.test.ts.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSvgAnimationPlayer } from '../index';
import type { PxDocument } from '@pixodesk/svg-animator-core';

/** Opacity 0 → 1 over content 500…1500 ms; keyframes also exist OUTSIDE the window below. */
function windowDoc(extra: Record<string, unknown> = {}): PxDocument {
    return {
        type: 'svg', viewBox: '0 0 10 10',
        animator: { timeline: { engine: 'js', inTime: 500, outTime: 1500, ...extra } },
        children: [{
            type: 'rect', id: 'r', width: 10, height: 10,
            animate: { opacity: { keyframes: [
                { time: 0, value: 0.5 },      // before the window — shapes the value AT 500 via interpolation
                { time: 500, value: 0 },
                { time: 1500, value: 1 },
            ] } },
        }],
    };
}

const opacity = () => Number(document.querySelector('rect')?.getAttribute('opacity'));

describe('the content window (§4)', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="box"></div>';
        vi.useFakeTimers();
    });
    afterEach(() => vi.useRealTimers());

    it('inTime/outTime: the window is the playing slice — the first frame is the content AT inTime', () => {
        const api = createSvgAnimationPlayer({ doc: windowDoc(), container: '#box', playAsSaved: true });
        expect(opacity()).toBe(0);                      // content 500, not content 0
        api.pause();
        api.setCurrentTime(500);                        // window midpoint = content 1000
        vi.advanceTimersByTime(32);
        expect(opacity()).toBeCloseTo(0.5, 2);
        api.setCurrentTime(1000);                       // window end = content 1500
        vi.advanceTimersByTime(32);
        expect(opacity()).toBe(1);
    });

    it('playDuration: the window remapped to wall ms — rate factor under the api, time space unchanged', () => {
        // window 1000 ms played over 2000 wall ms → factor 0.5: after 500 wall ms, content time 250
        const api = createSvgAnimationPlayer({ doc: windowDoc({ playDuration: 2000 }), container: '#box', playAsSaved: true });
        vi.advanceTimersByTime(500);
        expect(api.getCurrentTime()).toBeCloseTo(250, -1);   // CONTENT ms of the window, not wall
        // the caller's own rate stays in its own units: 2 means 2 × the file's pacing
        api.setPlaybackRate(2);
        vi.advanceTimersByTime(500);                          // 500 wall ms at effective rate 1
        expect(api.getCurrentTime()).toBeCloseTo(750, -1);
    });
});
