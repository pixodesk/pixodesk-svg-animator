/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// States (2026-11-20; segments 2026-11-15) — named parts of a timeline, one current at a time, on the web player's frame loop.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSvgAnimationPlayer as createPlayer } from '../index';
import { PxDiagnosticCode, type PxActionTriggers, type PxDocument, type PxState } from '@pixodesk/svg-animator-core';

/** Every player a test makes is destroyed after it — a live frame loop otherwise outlives its test's fake timers. */
const made: Array<ReturnType<typeof createPlayer>> = [];
const createSvgAnimationPlayer: typeof createPlayer = (options) => {
    const api = createPlayer(options);
    made.push(api);
    return api;
};

/** Opacity runs 0 → 1 over content 0…3000 ms, so the opacity says where the playhead is (content ms / 3000). */
/** The test's states by id, written as the file's list in that order. */
function doc(byId: Record<string, Omit<PxState, 'id'>>, actionTriggers: PxActionTriggers = [{ action: 'timeline.start', event: 'load' }]): PxDocument {
    const states: Array<PxState> = Object.entries(byId).map(([id, st]) => ({ id, ...st }));
    return {
        type: 'svg', viewBox: '0 0 10 10',
        animator: { timelines: [{ engine: 'js', outTime: 3000 }], states, actionTriggers },
        children: [
            { type: 'rect', id: 'r', width: 10, height: 10,
              animate: { opacity: { keyframes: [{ time: 0, value: 0 }, { time: 3000, value: 1 }] } } },
            { type: 'circle', id: 'btn', r: 2 },
        ],
    };
}

const THREE = {
    intro:   { inTime: 0,    outTime: 1000, whenFinished: { action: 'state.next' as const } },
    loop:    { inTime: 1000, outTime: 2000, iterations: 'infinite' as const },
    success: { inTime: 2000, outTime: 3000 },
};

/** The content ms on screen. */
const contentMs = (): number => Number(document.querySelector('rect')?.getAttribute('opacity')) * 3000;

describe('states — named parts of a timeline (2026-11-20; segments 2026-11-15)', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="box"></div><button class="next">Next</button>';
        // 'performance' faked with requestAnimationFrame: jsdom's rAF stops firing from the second test otherwise
        vi.useFakeTimers({
            toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame'],
        });
    });
    afterEach(() => {
        made.splice(0).forEach(api => api.destroy());
        vi.useRealTimers();
    });

    it('starts in the first state and plays only its part', () => {
        const api = createSvgAnimationPlayer({ document: doc(THREE), container: '#box' });
        expect(api.state.get()).toEqual(['intro']);
        expect(api.state.getAll()).toEqual(['intro', 'loop', 'success']);
        vi.advanceTimersByTime(500);
        expect(contentMs()).toBeGreaterThan(400);
        expect(contentMs()).toBeLessThan(600);
        expect(api.timeline.getDuration()).toBe(1000);   // the state's pass, not the timeline's
    });

    it('`whenFinished: state.next` goes on by itself; an endless state repeats inside its part', () => {
        const changes: Array<[string, string]> = [];
        const api = createSvgAnimationPlayer({ document: doc(THREE), container: '#box', onStateChange: (s, p) => changes.push([s, p]) });
        vi.advanceTimersByTime(1200);
        expect(api.state.get()).toEqual(['loop']);
        expect(changes).toEqual([['loop', 'intro']]);
        vi.advanceTimersByTime(1500);
        expect(api.state.get()).toEqual(['loop']);
        expect(contentMs()).toBeGreaterThanOrEqual(1000);
        expect(contentMs()).toBeLessThanOrEqual(2000);
        expect(api.timeline.getState()).toBe('playing');
    });

    it('goTo from code changes and plays; a state that ends holds its last frame, finished', () => {
        const api = createSvgAnimationPlayer({ document: doc(THREE), container: '#box' });
        vi.advanceTimersByTime(100);
        api.state.goTo('success');
        expect(api.state.get()).toEqual(['success']);
        vi.advanceTimersByTime(1200);
        expect(contentMs()).toBeCloseTo(3000, 0);
        expect(api.timeline.getState()).toBe('finished');
    });

    it('an id the file does not have is ignored; going to the current state does nothing', () => {
        const api = createSvgAnimationPlayer({ document: doc(THREE), container: '#box' });
        api.state.goTo('nope');
        expect(api.state.get()).toEqual(['intro']);
        vi.advanceTimersByTime(300);
        api.state.goTo('intro');
        vi.advanceTimersByTime(100);
        expect(contentMs()).toBeGreaterThan(300);   // not restarted
    });

    it('next after the last goes to the first; previous before the first, to the last', () => {
        const api = createSvgAnimationPlayer({ document: doc(THREE, []), container: '#box' });
        api.state.previous();
        expect(api.state.get()).toEqual(['success']);
        api.state.next();
        expect(api.state.get()).toEqual(['intro']);
    });

    it('a rule names a state: `state.goTo` success on a click', () => {
        const api = createSvgAnimationPlayer({ document: doc(THREE, [{ action: 'timeline.start', event: 'load' }, { action: 'state.goTo', state: 'success', event: 'click' }]), container: '#box' });
        vi.advanceTimersByTime(100);
        document.querySelector('svg')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(api.state.get()).toEqual(['success']);
    });

    it('an event on one element of the picture, and one on an element of the page', () => {
        const api = createSvgAnimationPlayer({
            document: doc(THREE, [{ action: 'state.goTo', state: 'success', event: 'click', element: '#btn' }, { action: 'state.next', event: 'click', selector: '.next' }]),
            container: '#box',
        });
        document.querySelector('rect')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(api.state.get()).toEqual(['intro']);           // not that element
        document.querySelector('circle')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));   // its fresh id is followed
        expect(api.state.get()).toEqual(['success']);
        document.querySelector('button.next')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(api.state.get()).toEqual(['intro']);           // after the last, the first
    });

    it('a key, narrowed by `with` — heard while the picture is in view and no field has the focus', () => {
        const api = createSvgAnimationPlayer({
            document: doc(THREE, [{ action: 'state.next', event: 'keyDown', with: { key: 'Enter', metaOrCtrlKey: true } }]),
            container: '#box',
        });
        const svg = document.querySelector('svg');
        if (!svg) throw new Error('no svg');
        vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 100, 100));
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        expect(api.state.get()).toEqual(['intro']);           // without ⌘ / Ctrl
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true }));
        expect(api.state.get()).toEqual(['loop']);
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true }));
        expect(api.state.get()).toEqual(['success']);
    });

    it('`whenLeaving: animateToEnd` finishes the pass before the next state plays', () => {
        const api = createSvgAnimationPlayer({
            document: doc({ ...THREE, loop: { ...THREE.loop, whenLeaving: 'animateToEnd' } }),
            container: '#box',
        });
        vi.advanceTimersByTime(1300);                    // intro done, 300 ms into the loop
        expect(api.state.get()).toEqual(['loop']);
        api.state.goTo('success');
        expect(api.state.get()).toEqual(['loop']);   // still finishing its pass
        vi.advanceTimersByTime(900);
        expect(api.state.get()).toEqual(['success']);
    });

    it('the newest request wins while a state is leaving', () => {
        const api = createSvgAnimationPlayer({
            document: doc({ ...THREE, loop: { ...THREE.loop, whenLeaving: 'animateToEnd' } }),
            container: '#box',
        });
        vi.advanceTimersByTime(1300);
        api.state.goTo('success');
        api.state.goTo('intro');
        vi.advanceTimersByTime(900);
        expect(api.state.get()).toEqual(['intro']);
    });

    it('an automatic ring of empty states cannot spin within one frame', () => {
        const api = createSvgAnimationPlayer({
            document: doc({
                a: { inTime: 0, outTime: 0, whenFinished: { action: 'state.goTo' as const, state: 'b' } },
                b: { inTime: 0, outTime: 0, whenFinished: { action: 'state.goTo' as const, state: 'a' } },
            }),
            container: '#box',
        });
        vi.advanceTimersByTime(200);                     // returns: each hop waits for a frame
        expect(['a', 'b']).toContain(api.state.get()[0]);
        api.destroy();
    });

    it('a goTo naming a state the file lacks is reported (1114) — in a rule and in `whenFinished`', () => {
        const warnings: Array<PxDiagnosticCode> = [];
        createSvgAnimationPlayer({
            document: doc({ ...THREE, intro: { ...THREE.intro, whenFinished: { action: 'state.goTo' as const, state: 'lop' } } },
                [{ action: 'timeline.start', event: 'load' }, { action: 'state.goTo', state: 'sucess', event: 'click' }]),
            container: '#box',
            onWarning: (w) => warnings.push(w.code),
        });
        expect(warnings.filter(c => c === PxDiagnosticCode.stateNotFound)).toHaveLength(2);
    });

    it('`next` follows the LIST, not the timeline: a later part listed first plays first', () => {
        const api = createSvgAnimationPlayer({ document: doc({ success: THREE.success, intro: THREE.intro }, []), container: '#box' });
        expect(api.state.getAll()).toEqual(['success', 'intro']);
        expect(api.state.get()).toEqual(['success']);
        api.state.next();
        expect(api.state.get()).toEqual(['intro']);
    });

    it('an id used twice: the first is played, the later ignored and reported (1115)', () => {
        const warnings: Array<PxDiagnosticCode> = [];
        const twice: PxDocument = doc(THREE);
        const states = twice.animator?.states;
        if (!states) throw new Error('no states');
        states.push({ id: 'intro', inTime: 2500, outTime: 3000 });
        const api = createSvgAnimationPlayer({ document: twice, container: '#box', onWarning: (w) => warnings.push(w.code) });
        expect(api.state.getAll()).toEqual(['intro', 'loop', 'success']);
        expect(warnings).toContain(PxDiagnosticCode.stateIdDuplicate);
    });

    it('a file with no states: get() is empty and the controls do nothing', () => {
        const api = createSvgAnimationPlayer({
            document: { type: 'svg', animator: { timelines: [{ engine: 'js', outTime: 1000 }] }, children: [] },
            container: '#box',
        });
        expect(api.state.get()).toEqual([]);
        api.state.next();
        expect(api.state.getAll()).toEqual([]);
    });
});
