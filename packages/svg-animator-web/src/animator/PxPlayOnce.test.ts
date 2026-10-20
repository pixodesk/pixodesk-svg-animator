/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/
// `playOnce()` (review §10): always ONE fresh pass from the start, whatever `iterations` say —
// the one-shot verb behind "plays once on click". Frame-loop engine under fake timers, like
// PxAnimatorWindow.test.ts.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSvgAnimator } from '../index';
import type { PxDocumentInput } from '@pixodesk/svg-animator-core';

function doc(extra: Record<string, unknown> = {}): PxDocumentInput {
    return {
        type: 'svg', viewBox: '0 0 10 10',
        animator: { timeline: { engine: 'js', outTime: 1000, ...extra } },
        children: [{
            type: 'rect', id: 'r', width: 10, height: 10,
            animate: { opacity: { keyframes: [{ time: 0, value: 0 }, { time: 1000, value: 1 }] } },
        }],
    } as unknown as PxDocumentInput;
}

const opacity = () => Number(document.querySelector('rect')?.getAttribute('opacity'));

describe('playOnce (§10)', () => {
    beforeEach(() => { document.body.innerHTML = '<div id="box"></div>'; vi.useFakeTimers(); });
    afterEach(() => vi.useRealTimers());

    it('plays one fresh pass mid-flight — re-entrant restart', () => {
        const api = createSvgAnimator({ doc: doc(), container: '#box' });
        api.playOnce();
        vi.advanceTimersByTime(500);
        expect(api.getCurrentTime()).toBeCloseTo(500, -2);
        api.playOnce();                                   // restart from 0, no juggling
        vi.advanceTimersByTime(32);
        expect(api.getCurrentTime()).toBeLessThan(100);
        api.destroy();
    });

    it('caps a loop-configured document at ONE pass and holds the pass-end pose', () => {
        const api = createSvgAnimator({ doc: doc({ iterations: 'infinite' }), container: '#box' });
        api.playOnce();
        vi.advanceTimersByTime(1400);                     // well past one pass; watcher settles it
        vi.advanceTimersByTime(200);
        expect(api.isPlaying()).toBe(false);
        expect(api.getCurrentTime()).toBeCloseTo(1000, -2);
        expect(opacity()).toBe(1);
    });

    it("a loop document with trigger.finish 'reset' snaps to rest after the pass", () => {
        const api = createSvgAnimator({ doc: doc({ iterations: 'infinite', trigger: { start: 'none', finish: 'reset' } }), container: '#box' });
        api.playOnce();
        vi.advanceTimersByTime(1600);
        expect(api.isPlaying()).toBe(false);
        expect(opacity()).toBe(0);
    });
});
