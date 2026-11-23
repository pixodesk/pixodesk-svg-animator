/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// Several timelines (2026-11-20; flows 2026-11-22) — the flow `default` (the shine: the default timeline, which no step
// names) beside the flow `pointer` whose steps are on two timelines, on the web player's frame loop.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSvgAnimationPlayer as createPlayer } from '../index';
import { PX_DEFAULT_TIMELINE, type PxDocument } from '@pixodesk/svg-animator-core';

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
            // the pointer steps name their flow: only flows run side by side (2026-11-22)
            flowSteps: [
                { id: 'idle', flow: 'pointer', timeline: 'grow', inTime: 0, outTime: 0 },
                { id: 'hover', flow: 'pointer', timeline: 'grow' },
                { id: 'press', flow: 'pointer', timeline: 'dip' },
            ],
            flows: [{ id: 'pointer' }],
            actions: [
                { action: 'timeline.start', event: 'load' },
                { action: 'flow.goTo', flowStep: 'press', event: 'click', element: '#btn' },
                // 1.29: "at its end, go to hover" is an entry of the list
                { action: 'flow.goTo', flowStep: 'hover', event: 'finished', from: 'press' },
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

    it('the flow `default` plays the shine while the pointer flow rests in its first step', () => {
        const api = createSvgAnimationPlayer({ document: buttonDoc(), container: '#box' });
        vi.advanceTimersByTime(1000);
        expect(shineX()).toBeGreaterThan(8);
        expect(shineX()).toBeLessThan(12);
        // each running flow's current step, in run order: `default` (the shine's own step), then the pointer's
        expect(api.flow.get()).toEqual(['default', 'idle']);
        expect(opacity()).toBeCloseTo(0, 1);   // `idle` = the first frame of `grow`
        expect(width()).toBeCloseTo(5, 1);     // no track on `grow`: the node's own width
    });

    it('a step on the other timeline plays its track; the first timeline\'s attribute holds the node\'s own value', () => {
        const api = createSvgAnimationPlayer({ document: buttonDoc(), container: '#box' });
        vi.advanceTimersByTime(100);
        api.flow.goTo('press');
        expect(api.flow.get('pointer')).toEqual(['press']);
        vi.advanceTimersByTime(500);
        expect(width()).toBeGreaterThan(13);
        expect(width()).toBeLessThan(17);
        expect(opacity()).toBeCloseTo(0.5, 1);   // `grow` is not showing: the node's own opacity
        expect(shineX()).toBeGreaterThan(5);     // the shine goes on
    });

    it('`whenFinished` goes to a state on another timeline; its track plays from 0', () => {
        const api = createSvgAnimationPlayer({ document: buttonDoc(), container: '#box' });
        api.flow.goTo('press');
        vi.advanceTimersByTime(1200);
        expect(api.flow.get('pointer')).toEqual(['hover']);
        vi.advanceTimersByTime(400);
        expect(opacity()).toBeGreaterThan(0.2);
        expect(opacity()).toBeLessThan(0.8);
        expect(width()).toBeCloseTo(5, 1);       // `dip` is not showing any more
    });

    it('a rule on an element of the picture moves the flow; the free timeline is not touched', () => {
        const api = createSvgAnimationPlayer({ document: buttonDoc(), container: '#box' });
        vi.advanceTimersByTime(100);
        button()?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(api.flow.get('pointer')).toEqual(['press']);
        expect(api.timeline.getState()).toBe('playing');
    });

    it('getTimeline finds a timeline by its id; one the file lacks is undefined', () => {
        const api = createSvgAnimationPlayer({ document: buttonDoc(), container: '#box' });
        expect(api.getTimeline('grow')).toBeDefined();
        expect(api.getTimeline('dip')).toBe(api.getTimeline('grow'));   // one state machine: one unit
        expect(api.getTimeline('nope')).toBeUndefined();
        // every step, flow by flow — the shine's own step first
        expect(api.flow.getAll()).toEqual(['default', 'idle', 'hover', 'press']);
    });

    it('the page says what runs (2026-11-22): `flows` — only those; what does not run holds nothing', () => {
        const api = createSvgAnimationPlayer({ document: buttonDoc(), container: '#box', flows: ['pointer'] });
        vi.advanceTimersByTime(1000);
        expect(shineX()).toBeCloseTo(0, 1);                   // `default` does not run: the shine at its own x
        expect(api.flow.get()).toEqual(['idle']);
        button()?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(api.flow.get()).toEqual(['press']);            // the pointer's rules are heard
    });

    it('`timelines` — each named timeline whole and by itself; the flows do not run, their rules are not heard', () => {
        // 2026-11-22: the page calls the timeline with no id PX_DEFAULT_TIMELINE ('')
        const api = createSvgAnimationPlayer({ document: buttonDoc(), container: '#box', timelines: [PX_DEFAULT_TIMELINE] });
        api.timeline.start();
        vi.advanceTimersByTime(1000);
        expect(shineX()).toBeGreaterThan(8);
        expect(api.flow.get()).toEqual([]);
        button()?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(width()).toBeCloseTo(5, 1);                    // the pointer flow does not run: `press` never plays
    });

    it('a name the file does not have is ignored, with a warning (PX1507)', () => {
        const warnings: Array<unknown> = [];
        createSvgAnimationPlayer({ document: buttonDoc(), container: '#box', flows: ['pointer', 'nope'], onWarning: (w) => warnings.push(w) });
        expect(JSON.stringify(warnings)).toContain('1507');
    });
});

