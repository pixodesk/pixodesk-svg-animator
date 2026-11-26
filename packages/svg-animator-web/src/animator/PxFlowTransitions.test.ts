/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// Transitions between flow steps (1.34, 2026-11-26) — a step's in- and out-transition segments, and how two steps hand
// over (`transition`: overlap, mix, leavingStep) — on the web player's frame loop.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSvgAnimationPlayer as createPlayer } from '../index';
import type { PxDocument, PxFlow, PxFlowStep } from '@pixodesk/svg-animator-core';

/** Every player a test makes is destroyed after it — a live frame loop otherwise outlives its test's fake timers. */
const made: Array<ReturnType<typeof createPlayer>> = [];
const createSvgAnimationPlayer: typeof createPlayer = (options) => {
    const api = createPlayer(options);
    made.push(api);
    return api;
};

/** Opacity runs 0 → 1 over content 0…3000 ms, so it says where the playhead is. `card`: comes in over 0–600, loops
 *  600–2600, goes out over 2600–3000. `idle`: loops 0–600. */
const CARD: PxFlowStep = {
    id: 'card',
    segment: { inTime: 600, outTime: 2600, iterations: 'infinite' },
    inTransitionSegment: { inTime: 0, outTime: 600 },
    outTransitionSegment: { inTime: 2600, outTime: 3000 },
};
const IDLE: PxFlowStep = { id: 'idle', segment: { inTime: 0, outTime: 600, iterations: 'infinite' } };

function doc(steps: Array<PxFlowStep> = [CARD, IDLE], flows?: Array<PxFlow>): PxDocument {
    return {
        type: 'svg', viewBox: '0 0 10 10',
        animator: {
            timelines: [{ engine: 'js', outTime: 3000 }],
            flowSteps: steps,
            ...(flows ? { flows } : {}),
            actions: [{ name: 'timeline.start', triggers: [{ event: 'load' }] }],
        },
        children: [
            { type: 'rect', id: 'r', width: 10, height: 10, animate: { opacity: { keyframes: [{ time: 0, value: 0 }, { time: 3000, value: 1 }] } } },
            { type: 'circle', id: 'onlyCard', r: 1, effects: { show: { when: { flowSteps: ['card'] } } } },
            { type: 'circle', id: 'onlyIdle', r: 1, effects: { show: { when: { flowSteps: ['idle'] } } } },
        ],
    };
}

/** The content ms on screen. */
const contentMs = (): number => Number(document.querySelector('rect')?.getAttribute('opacity')) * 3000;
/** Whether an element shown only in some steps is shown — the circles in order: `onlyCard`, `onlyIdle` (ids are the player's own). */
const shown = (id: 'onlyCard' | 'onlyIdle'): boolean => {
    const el = document.querySelector(id === 'onlyCard' ? 'circle:nth-of-type(1)' : 'circle:nth-of-type(2)');
    if (!(el instanceof SVGElement)) throw new Error('no ' + id);
    return el.style.display !== 'none';
};

describe('transitions between flow steps (1.34)', () => {
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

    it('a visit plays the in-transition once, then the segment — which loops on its own (B1: also at the start)', () => {
        const api = createSvgAnimationPlayer({ document: doc(), container: '#box' });
        vi.advanceTimersByTime(300);
        expect(contentMs()).toBeGreaterThan(200);
        expect(contentMs()).toBeLessThan(400);
        vi.advanceTimersByTime(600);                       // 900: 300 ms into the segment
        expect(contentMs()).toBeGreaterThan(800);
        expect(contentMs()).toBeLessThan(1000);
        vi.advanceTimersByTime(2000);                      // 2900: round once — never back into the in-transition
        expect(contentMs()).toBeGreaterThanOrEqual(600);
        expect(contentMs()).toBeLessThanOrEqual(2600);
        expect(api.flow.get()).toEqual(['card']);
    });

    it('leaving plays the out-transition, then the next step; the flow is in the next step from the request (D7)', () => {
        const changes: Array<[string, string]> = [];
        const api = createSvgAnimationPlayer({ document: doc(), container: '#box', onFlowStepChange: (s, p) => changes.push([s, p]) });
        vi.advanceTimersByTime(1000);
        api.flow.goTo({ flowStep: 'idle' });
        expect(api.flow.get()).toEqual(['idle']);
        expect(changes).toEqual([['idle', 'card']]);
        vi.advanceTimersByTime(200);                       // in the out-transition
        expect(contentMs()).toBeGreaterThan(2650);
        expect(contentMs()).toBeLessThan(2900);
        vi.advanceTimersByTime(400);                       // idle's segment
        expect(contentMs()).toBeLessThan(600);
    });

    it('an overlap with a crossfade: the end of the out-transition under the start of the next step, mixed', () => {
        const api = createSvgAnimationPlayer({ document: doc(), container: '#box' });
        vi.advanceTimersByTime(1000);
        api.flow.goTo({ flowStep: 'idle', transition: { overlap: 200 } });
        vi.advanceTimersByTime(100);                       // the out-transition alone: its first 200 ms
        expect(contentMs()).toBeGreaterThan(2650);
        expect(contentMs()).toBeLessThan(2800);
        vi.advanceTimersByTime(200);                       // the window's middle: A at ~2900, B at ~100, half each
        expect(contentMs()).toBeGreaterThan(1200);
        expect(contentMs()).toBeLessThan(1800);
        vi.advanceTimersByTime(250);                       // past the window: idle plays on from where the window left it
        expect(contentMs()).toBeGreaterThan(150);
        expect(contentMs()).toBeLessThan(450);
    });

    it('`nextOnTop`: in the window the next step\'s value wins; a flow\'s `transition` is the default of its arrows', () => {
        const api = createSvgAnimationPlayer({ document: doc([CARD, IDLE], [{ id: 'default', transition: { overlap: 200, mix: 'nextOnTop' } }]), container: '#box' });
        vi.advanceTimersByTime(1000);
        api.flow.goTo({ flowStep: 'idle' });
        vi.advanceTimersByTime(300);
        expect(contentMs()).toBeLessThan(300);
    });

    it('no out-transition: with an overlap the leaving segment plays on under the next step — or holds (`leavingStep`)', () => {
        const plain: PxFlowStep = { id: 'card', segment: { inTime: 600, outTime: 2600, iterations: 'infinite' } };
        const api = createSvgAnimationPlayer({ document: doc([plain, IDLE]), container: '#box' });
        vi.advanceTimersByTime(1000);                      // card at ~1600 — no in-transition: its segment from the start
        api.flow.goTo({ flowStep: 'idle', transition: { overlap: 400, mix: 'previousOnTop', leavingStep: 'holds' } });
        vi.advanceTimersByTime(200);
        expect(contentMs()).toBeGreaterThan(1500);         // held near 1600, on top
        expect(contentMs()).toBeLessThan(1700);
        vi.advanceTimersByTime(300);                       // past the window: idle
        expect(contentMs()).toBeLessThan(600);
    });

    it('back to the step it came from while the change plays: it runs back, and the step goes on from where it was (R1)', () => {
        const api = createSvgAnimationPlayer({ document: doc(), container: '#box' });
        vi.advanceTimersByTime(1000);
        api.flow.goTo({ flowStep: 'idle' });
        vi.advanceTimersByTime(200);                       // ~2800 in the out-transition
        const at = contentMs();
        api.flow.goTo({ flowStep: 'card' });
        expect(api.flow.get()).toEqual(['card']);
        vi.advanceTimersByTime(100);
        expect(contentMs()).toBeLessThan(at);              // running back
        vi.advanceTimersByTime(300);                       // back in the segment, from where it was left (~1000)
        expect(contentMs()).toBeGreaterThan(900);
        expect(contentMs()).toBeLessThan(1500);
    });

    it('a go-to the step it is going to changes nothing (B3)', () => {
        const api = createSvgAnimationPlayer({ document: doc(), container: '#box' });
        vi.advanceTimersByTime(1000);
        api.flow.goTo({ flowStep: 'idle' });
        vi.advanceTimersByTime(100);
        api.flow.goTo({ flowStep: 'idle' });
        vi.advanceTimersByTime(100);
        expect(contentMs()).toBeGreaterThan(2700);         // still in the out-transition
    });

    it('a stop while a change plays: no out-transition — the change settles in the next step, stopped (B2)', () => {
        const api = createSvgAnimationPlayer({ document: doc(), container: '#box' });
        vi.advanceTimersByTime(1000);
        api.flow.goTo({ flowStep: 'idle' });
        vi.advanceTimersByTime(100);
        api.timeline.stop();
        vi.advanceTimersByTime(50);
        expect(api.flow.get()).toEqual(['idle']);
        expect(contentMs()).toBeLessThanOrEqual(600);
    });

    it('start: the step from its in-transition again (B1)', () => {
        const api = createSvgAnimationPlayer({ document: doc(), container: '#box' });
        vi.advanceTimersByTime(1500);
        api.timeline.start();
        vi.advanceTimersByTime(200);
        expect(contentMs()).toBeLessThan(400);
    });

    it('elements shown only in some steps follow the parts that play: both in a window (R2)', () => {
        const api = createSvgAnimationPlayer({ document: doc(), container: '#box' });
        vi.advanceTimersByTime(1000);
        expect(shown('onlyCard')).toBe(true);
        expect(shown('onlyIdle')).toBe(false);
        api.flow.goTo({ flowStep: 'idle', transition: { overlap: 200 } });
        vi.advanceTimersByTime(100);                       // card's out-transition alone
        expect(shown('onlyCard')).toBe(true);
        expect(shown('onlyIdle')).toBe(false);
        vi.advanceTimersByTime(200);                       // the window
        expect(shown('onlyCard')).toBe(true);
        expect(shown('onlyIdle')).toBe(true);
        vi.advanceTimersByTime(300);                       // idle
        expect(shown('onlyCard')).toBe(false);
        expect(shown('onlyIdle')).toBe(true);
    });
});
