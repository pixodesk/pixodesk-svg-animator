/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// Several timelines (2026-11-20) — a free timeline beside a state machine whose states are on two timelines, on the
// web player's frame loop. The units: the shine (the first timeline, free) and the pointer (states on `grow` and `dip`).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSvgAnimationPlayer as createPlayer } from '../index';
import type { PxDocument } from '@pixodesk/svg-animator-core';

const made: Array<ReturnType<typeof createPlayer>> = [];
const createSvgAnimationPlayer: typeof createPlayer = (options) => {
    const api = createPlayer(options);
    made.push(api);
    return api;
};

/** The shine runs x 0 → 40 over 4 s; the button's opacity rides `grow` (0 → 1 over 1 s), its width rides `dip`
 *  (10 → 20 over 1 s). The node's own values: opacity 0.5, width 5. */
function buttonDoc(): PxDocument {
    return {
        type: 'svg', viewBox: '0 0 100 100',
        animator: {
            timelines: [
                { engine: 'js', outTime: 4000, iterations: 'infinite' },
                { id: 'grow', engine: 'js', outTime: 1000 },
                { id: 'dip', engine: 'js', outTime: 1000 },
            ],
            states: [
                { id: 'idle', timeline: 'grow', inTime: 0, outTime: 0 },
                { id: 'hover', timeline: 'grow' },
                { id: 'press', timeline: 'dip', whenFinished: { action: 'state.goTo', state: 'hover' } },
            ],
            actionTriggers: [
                { action: 'timeline.start', event: 'load' },
                { action: 'state.goTo', state: 'press', event: 'click', element: '#btn' },
            ],
        },
        children: [
            { type: 'rect', id: 'shine', x: 0, width: 4, height: 4,
              animate: { x: { keyframes: [{ time: 0, value: 0 }, { time: 4000, value: 40 }] } } },
            { type: 'rect', id: 'btn', width: 5, height: 5, opacity: 0.5,
              animate: {
                  opacity: { byTimeline: [{ timeline: 'grow', keyframes: [{ time: 0, value: 0 }, { time: 1000, value: 1 }] }] },
                  width: { byTimeline: [{ timeline: 'dip', keyframes: [{ time: 0, value: 10 }, { time: 1000, value: 20 }] }] },
              } },
        ],
    };
}

const shineX = (): number => Number(document.querySelectorAll('rect')[0]?.getAttribute('x'));
const button = (): Element | null => document.querySelectorAll('rect')[1] ?? null;
const opacity = (): number => Number(button()?.getAttribute('opacity'));
const width = (): number => Number(button()?.getAttribute('width'));

describe('several timelines — units side by side (2026-11-20)', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="box"></div>';
        vi.useFakeTimers({
            toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame'],
        });
    });
    afterEach(() => {
        made.splice(0).forEach(api => api.destroy());
        vi.useRealTimers();
    });

    it('the free timeline plays by itself while the state machine rests in its first state', () => {
        const api = createSvgAnimationPlayer({ document: buttonDoc(), container: '#box' });
        vi.advanceTimersByTime(1000);
        expect(shineX()).toBeGreaterThan(8);
        expect(shineX()).toBeLessThan(12);
        expect(api.state.get()).toEqual(['idle']);
        expect(opacity()).toBeCloseTo(0, 1);   // `idle` = the first frame of `grow`
        expect(width()).toBeCloseTo(5, 1);     // no track on `grow`: the node's own width
    });

    it('a state on the other timeline plays its track; the first timeline\'s attribute holds the node\'s own value', () => {
        const api = createSvgAnimationPlayer({ document: buttonDoc(), container: '#box' });
        vi.advanceTimersByTime(100);
        api.state.goTo('press');
        expect(api.state.get()).toEqual(['press']);
        vi.advanceTimersByTime(500);
        expect(width()).toBeGreaterThan(13);
        expect(width()).toBeLessThan(17);
        expect(opacity()).toBeCloseTo(0.5, 1);   // `grow` is not showing: the node's own opacity
        expect(shineX()).toBeGreaterThan(5);     // the shine goes on
    });

    it('`whenFinished` goes to a state on another timeline; its track plays from 0', () => {
        const api = createSvgAnimationPlayer({ document: buttonDoc(), container: '#box' });
        api.state.goTo('press');
        vi.advanceTimersByTime(1200);
        expect(api.state.get()).toEqual(['hover']);
        vi.advanceTimersByTime(400);
        expect(opacity()).toBeGreaterThan(0.2);
        expect(opacity()).toBeLessThan(0.8);
        expect(width()).toBeCloseTo(5, 1);       // `dip` is not showing any more
    });

    it('a rule on an element of the picture moves the state machine; the free timeline is not touched', () => {
        const api = createSvgAnimationPlayer({ document: buttonDoc(), container: '#box' });
        vi.advanceTimersByTime(100);
        button()?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(api.state.get()).toEqual(['press']);
        expect(api.timeline.getState()).toBe('playing');
    });

    it('getTimeline finds a timeline by its id; one the file lacks is undefined', () => {
        const api = createSvgAnimationPlayer({ document: buttonDoc(), container: '#box' });
        expect(api.getTimeline('grow')).toBeDefined();
        expect(api.getTimeline('dip')).toBe(api.getTimeline('grow'));   // one state machine: one unit
        expect(api.getTimeline('nope')).toBeUndefined();
        expect(api.state.getAll()).toEqual(['idle', 'hover', 'press']);
    });
});
