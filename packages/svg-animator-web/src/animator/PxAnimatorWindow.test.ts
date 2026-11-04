/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/
// The content window (first-use review §4): `inTime`/`outTime` play a slice of the content and
// `playSpeed` is the initial speed. Frame-loop engine under fake
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
        const api = createSvgAnimationPlayer({ doc: windowDoc(), container: '#box', playUsingActionTriggers: true });
        expect(opacity()).toBe(0);                      // content 500, not content 0
        api.pause();
        api.setCurrentTime(500);                        // window midpoint = content 1000
        vi.advanceTimersByTime(32);
        expect(opacity()).toBeCloseTo(0.5, 2);
        api.setCurrentTime(1000);                       // window end = content 1500
        vi.advanceTimersByTime(32);
        expect(opacity()).toBe(1);
    });

    it('playSpeed: the file sets the initial speed; the handle REPLACES it (no hidden product)', () => {
        // window 1000 ms at speed 0.5: after 500 real ms, content time 250
        const api = createSvgAnimationPlayer({ doc: windowDoc({ playSpeed: 0.5, actionTriggers: { start: 'load' } }), container: '#box', playUsingActionTriggers: true });
        vi.advanceTimersByTime(500);
        expect(api.getPlaySpeed()).toBe(0.5);
        expect(api.getCurrentTime()).toBeCloseTo(250, -1);   // CONTENT ms of the window, not real
        expect(api.getPlayDuration()).toBeCloseTo(2000, 5);  // one pass in real ms at this speed
        api.setPlaySpeed(2);                                  // replaces the file's 0.5
        vi.advanceTimersByTime(500);                          // 500 real ms at speed 2 = 1000 content ms → clamped at the end
        expect(api.getPlaySpeed()).toBe(2);
        expect(api.getCurrentTime()).toBeCloseTo(1000, -1);
    });
});
