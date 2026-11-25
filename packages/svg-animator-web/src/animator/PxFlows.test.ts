/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// States (2026-11-20; segments 2026-11-15) — named parts of a timeline, one current at a time, on the web player's frame loop.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSvgAnimationPlayer as createPlayer } from '../index';
import { PxDiagnosticCode, PxStepEvent, type PxActionEntry, type PxActions, type PxDocument, type PxFlowStep, type PxFlowStepTimelineOptions } from '@pixodesk/svg-animator-core';

/** Every player a test makes is destroyed after it — a live frame loop otherwise outlives its test's fake timers. */
const made: Array<ReturnType<typeof createPlayer>> = [];
const createSvgAnimationPlayer: typeof createPlayer = (options) => {
    const api = createPlayer(options);
    made.push(api);
    return api;
};

/** Opacity runs 0 → 1 over content 0…3000 ms, so the opacity says where the playhead is (content ms / 3000). */
/** The test's states by id, written as the file's list in that order. */
// 1.33: a step's "at its end, go there" is an entry of `actions` (`flowStep.finished`, `when.flowSteps`) and its timing is
// `timelineOptions` — the helper takes both flat on the step, as the tests read it, and writes them as the file has them.
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
/** What a step does at its end, as the test writes it on the step: an entry of `actions` without its triggers and `when`. */
type AtEnd = DistributiveOmit<PxActionEntry, 'triggers' | 'when'>;
type TestStep = Omit<PxFlowStepTimelineOptions, 'whenFinished'> & { whenFinished?: PxFlowStepTimelineOptions['whenFinished'] | AtEnd };
function doc(byId: Record<string, TestStep>, actions: PxActions = [{ name: 'timeline.start', triggers: [{ event: 'load' }] }]): PxDocument {
    const atEnd: PxActions = [];
    const states: Array<PxFlowStep> = Object.entries(byId).map(([id, { whenFinished, ...options }]) => {
        if (whenFinished === undefined || typeof whenFinished === 'string') {
            const all = whenFinished === undefined ? options : { ...options, whenFinished };
            return Object.keys(all).length ? { id, timelineOptions: all } : { id };
        }
        atEnd.push({ ...whenFinished, triggers: [{ event: PxStepEvent.finished }], when: { flowSteps: [id] } });
        return Object.keys(options).length ? { id, timelineOptions: options } : { id };
    });
    return {
        type: 'svg', viewBox: '0 0 10 10',
        animator: { timelines: [{ engine: 'js', outTime: 3000 }], flowSteps: states, actions: [...actions, ...atEnd] },
        children: [
            { type: 'rect', id: 'r', width: 10, height: 10,
              animate: { opacity: { keyframes: [{ time: 0, value: 0 }, { time: 3000, value: 1 }] } } },
            { type: 'circle', id: 'btn', r: 2 },
        ],
    };
}

const THREE = {
    intro:   { inTime: 0,    outTime: 1000, whenFinished: { name: 'flow.next' as const } },
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
        expect(api.flow.get()).toEqual(['intro']);
        expect(api.flow.getAll()).toEqual(['intro', 'loop', 'success']);
        vi.advanceTimersByTime(500);
        expect(contentMs()).toBeGreaterThan(400);
        expect(contentMs()).toBeLessThan(600);
        expect(api.timeline.getDuration()).toBe(1000);   // the state's pass, not the timeline's
    });

    it('a `flowStep.finished` entry: `flow.next` goes on by itself; an endless state repeats inside its part', () => {
        const changes: Array<[string, string]> = [];
        const api = createSvgAnimationPlayer({ document: doc(THREE), container: '#box', onFlowStepChange: (s, p) => changes.push([s, p]) });
        vi.advanceTimersByTime(1200);
        expect(api.flow.get()).toEqual(['loop']);
        expect(changes).toEqual([['loop', 'intro']]);
        vi.advanceTimersByTime(1500);
        expect(api.flow.get()).toEqual(['loop']);
        expect(contentMs()).toBeGreaterThanOrEqual(1000);
        expect(contentMs()).toBeLessThanOrEqual(2000);
        expect(api.timeline.getState()).toBe('playing');
    });

    it('goTo from code changes and plays; a state that ends holds its last frame, finished', () => {
        const api = createSvgAnimationPlayer({ document: doc(THREE), container: '#box' });
        vi.advanceTimersByTime(100);
        api.flow.goTo({ flowStep: 'success' });
        expect(api.flow.get()).toEqual(['success']);
        vi.advanceTimersByTime(1200);
        expect(contentMs()).toBeCloseTo(3000, 0);
        expect(api.timeline.getState()).toBe('finished');
    });

    it('an id the file does not have is ignored; going to the current state does nothing', () => {
        const api = createSvgAnimationPlayer({ document: doc(THREE), container: '#box' });
        api.flow.goTo({ flowStep: 'nope' });
        expect(api.flow.get()).toEqual(['intro']);
        vi.advanceTimersByTime(300);
        api.flow.goTo({ flowStep: 'intro' });
        vi.advanceTimersByTime(100);
        expect(contentMs()).toBeGreaterThan(300);   // not restarted
    });

    // 1.30: wrapping is the `…OrWrap` calls' (it was `next` / `previous`'s until then)
    it('nextOrWrap after the last goes to the first; previousOrWrap before the first, to the last', () => {
        const api = createSvgAnimationPlayer({ document: doc(THREE, []), container: '#box' });
        api.flow.previousOrWrap();
        expect(api.flow.get()).toEqual(['success']);
        api.flow.nextOrWrap();
        expect(api.flow.get()).toEqual(['intro']);
    });

    it('1.30: next on the last step and previous on the first do nothing', () => {
        const api = createSvgAnimationPlayer({ document: doc(THREE, []), container: '#box' });
        api.flow.previous();
        expect(api.flow.get()).toEqual(['intro']);
        api.flow.goTo({ flowStep: 'success' });
        api.flow.next();
        expect(api.flow.get()).toEqual(['success']);
    });

    it('an entry names a flowStep: `flow.goTo` success on a click', () => {
        const api = createSvgAnimationPlayer({ document: doc(THREE, [{ name: 'timeline.start', triggers: [{ event: 'load' }] }, { name: 'flow.goTo', with: { flowStep: 'success' }, triggers: [{ event: 'click' }] }]), container: '#box' });
        vi.advanceTimersByTime(100);
        document.querySelector('svg')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(api.flow.get()).toEqual(['success']);
    });

    it('an event on one element of the picture, and one on an element of the page', () => {
        const api = createSvgAnimationPlayer({
            // 1.30: `flow.nextOrWrap`, so the page button is seen to move the flow from the last step
            document: doc(THREE, [{ name: 'flow.goTo', with: { flowStep: 'success' }, triggers: [{ event: 'click', element: '#btn' }] }, { name: 'flow.nextOrWrap', triggers: [{ event: 'click', selector: '.next' }] }]),
            container: '#box',
        });
        document.querySelector('rect')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(api.flow.get()).toEqual(['intro']);           // not that element
        document.querySelector('circle')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));   // its fresh id is followed
        expect(api.flow.get()).toEqual(['success']);
        document.querySelector('button.next')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(api.flow.get()).toEqual(['intro']);           // after the last, the first
    });

    it('a key, narrowed by `with` — heard while the picture is in view and no field has the focus', () => {
        const api = createSvgAnimationPlayer({
            document: doc(THREE, [{ name: 'flow.next', triggers: [{ event: 'keyDown', with: { key: 'Enter', metaOrCtrlKey: true } }] }]),
            container: '#box',
        });
        const svg = document.querySelector('svg');
        if (!svg) throw new Error('no svg');
        vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 100, 100));
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        expect(api.flow.get()).toEqual(['intro']);           // without ⌘ / Ctrl
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true }));
        expect(api.flow.get()).toEqual(['loop']);
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true }));
        expect(api.flow.get()).toEqual(['success']);
    });

    it('`whenLeaving: animateToEnd` finishes the pass before the next state plays', () => {
        const api = createSvgAnimationPlayer({
            document: doc({ ...THREE, loop: { ...THREE.loop, whenLeaving: 'animateToEnd' } }),
            container: '#box',
        });
        vi.advanceTimersByTime(1300);                    // intro done, 300 ms into the loop
        expect(api.flow.get()).toEqual(['loop']);
        api.flow.goTo({ flowStep: 'success' });
        expect(api.flow.get()).toEqual(['loop']);   // still finishing its pass
        vi.advanceTimersByTime(900);
        expect(api.flow.get()).toEqual(['success']);
    });

    it('the newest request wins while a state is leaving', () => {
        const api = createSvgAnimationPlayer({
            document: doc({ ...THREE, loop: { ...THREE.loop, whenLeaving: 'animateToEnd' } }),
            container: '#box',
        });
        vi.advanceTimersByTime(1300);
        api.flow.goTo({ flowStep: 'success' });
        api.flow.goTo({ flowStep: 'intro' });
        vi.advanceTimersByTime(900);
        expect(api.flow.get()).toEqual(['intro']);
    });

    it('an automatic ring of empty states cannot spin within one frame', () => {
        const api = createSvgAnimationPlayer({
            document: doc({
                a: { inTime: 0, outTime: 0, whenFinished: { name: 'flow.goTo' as const, with: { flowStep: 'b' } } },
                b: { inTime: 0, outTime: 0, whenFinished: { name: 'flow.goTo' as const, with: { flowStep: 'a' } } },
            }),
            container: '#box',
        });
        vi.advanceTimersByTime(200);                     // returns: each hop waits for a frame
        expect(['a', 'b']).toContain(api.flow.get()[0]);
        api.destroy();
    });

    it('a goTo naming a state the file lacks is reported (1114) — on a click and at a step\'s end (`flowStep.finished`)', () => {
        const warnings: Array<PxDiagnosticCode> = [];
        createSvgAnimationPlayer({
            document: doc({ ...THREE, intro: { ...THREE.intro, whenFinished: { name: 'flow.goTo' as const, with: { flowStep: 'lop' } } } },
                [{ name: 'timeline.start', triggers: [{ event: 'load' }] }, { name: 'flow.goTo', with: { flowStep: 'sucess' }, triggers: [{ event: 'click' }] }]),
            container: '#box',
            onWarning: (w) => warnings.push(w.code),
        });
        expect(warnings.filter(c => c === PxDiagnosticCode.flowStepNotFound)).toHaveLength(2);
    });

    it('`next` follows the LIST, not the timeline: a later part listed first plays first', () => {
        const api = createSvgAnimationPlayer({ document: doc({ success: THREE.success, intro: THREE.intro }, []), container: '#box' });
        expect(api.flow.getAll()).toEqual(['success', 'intro']);
        expect(api.flow.get()).toEqual(['success']);
        api.flow.next();
        expect(api.flow.get()).toEqual(['intro']);
    });

    it('an id used twice: the first is played, the later ignored and reported (1115)', () => {
        const warnings: Array<PxDiagnosticCode> = [];
        const twice: PxDocument = doc(THREE);
        const states = twice.animator?.flowSteps;
        if (!states) throw new Error('no states');
        states.push({ id: 'intro', timelineOptions: { inTime: 2500, outTime: 3000 } });
        const api = createSvgAnimationPlayer({ document: twice, container: '#box', onWarning: (w) => warnings.push(w.code) });
        expect(api.flow.getAll()).toEqual(['intro', 'loop', 'success']);
        expect(warnings).toContain(PxDiagnosticCode.flowStepIdDuplicate);
    });

    const click = (): void => { document.querySelector('svg')?.dispatchEvent(new MouseEvent('click', { bubbles: true })); };

    it('`when.flowSteps` (1.29 `from`): an entry holds only while the flow is at one of its steps', () => {
        const api = createSvgAnimationPlayer({
            document: doc(THREE, [{ name: 'timeline.start', triggers: [{ event: 'load' }] }, { name: 'flow.goTo', with: { flowStep: 'success' }, triggers: [{ event: 'click' }], when: { flowSteps: ['loop'] } }]),
            container: '#box',
        });
        vi.advanceTimersByTime(100);
        click();
        expect(api.flow.get()).toEqual(['intro']);           // not from intro
        vi.advanceTimersByTime(1100);                         // intro ends → loop
        click();
        expect(api.flow.get()).toEqual(['success']);
    });

    it('a `flowStep.finished` entry with no `when.flowSteps` is every step\'s end', () => {
        const api = createSvgAnimationPlayer({
            document: doc({ a: { inTime: 0, outTime: 500 }, b: { inTime: 500, outTime: 1000 }, c: { inTime: 1000, outTime: 3000 } },
                [{ name: 'timeline.start', triggers: [{ event: 'load' }] }, { name: 'flow.next', triggers: [{ event: PxStepEvent.finished }] }]),
            container: '#box',
        });
        vi.advanceTimersByTime(600);
        expect(api.flow.get()).toEqual(['b']);
        vi.advanceTimersByTime(600);
        expect(api.flow.get()).toEqual(['c']);
    });

    it('1.30: a `flowStep.finished` next at the last step\'s end — it stays there, finished; `flow.nextOrWrap` goes round', () => {
        const steps = { a: { inTime: 0, outTime: 500 }, b: { inTime: 500, outTime: 1000 } };
        const stays = createSvgAnimationPlayer({
            document: doc(steps, [{ name: 'timeline.start', triggers: [{ event: 'load' }] }, { name: 'flow.next', triggers: [{ event: PxStepEvent.finished }] }]),
            container: '#box',
        });
        vi.advanceTimersByTime(1200);
        expect(stays.flow.get()).toEqual(['b']);
        expect(stays.timeline.getState()).toBe('finished');
        stays.destroy();
        const wraps = createSvgAnimationPlayer({
            document: doc(steps, [{ name: 'timeline.start', triggers: [{ event: 'load' }] }, { name: 'flow.nextOrWrap', triggers: [{ event: PxStepEvent.finished }] }]),
            container: '#box',
        });
        vi.advanceTimersByTime(1200);
        expect(wraps.flow.get()).toEqual(['a']);
    });

    it('1.30: next pressed twice while a step finishes its pass — counted from where it is heading, two steps on', () => {
        const api = createSvgAnimationPlayer({
            document: doc({
                a: { inTime: 0, outTime: 1000, iterations: 'infinite', whenLeaving: 'animateToEnd' },
                b: { inTime: 1000, outTime: 2000 },
                c: { inTime: 2000, outTime: 3000 },
            }),
            container: '#box',
        });
        vi.advanceTimersByTime(300);
        api.flow.next();
        api.flow.next();
        expect(api.flow.get()).toEqual(['a']);               // still finishing its pass
        vi.advanceTimersByTime(800);
        expect(api.flow.get()).toEqual(['c']);
        api.flow.next();                                     // the last: nothing
        expect(api.flow.get()).toEqual(['c']);
    });

    it('a go-to\'s own `with.whenLeaving` (1.29 `behavior`) overrides the step\'s way of leaving', () => {
        const api = createSvgAnimationPlayer({
            document: doc(THREE, [{ name: 'timeline.start', triggers: [{ event: 'load' }] }, { name: 'flow.goTo', with: { flowStep: 'success', whenLeaving: 'animateToEnd' }, triggers: [{ event: 'click' }] }]),
            container: '#box',
        });
        vi.advanceTimersByTime(1300);                        // 300 ms into the loop (it leaves at once by itself)
        click();
        expect(api.flow.get()).toEqual(['loop']);            // finishing its pass first
        vi.advanceTimersByTime(900);
        expect(api.flow.get()).toEqual(['success']);
    });

    it('a stop\'s own `with.whenStopped` (1.29 `behavior`) — the picture travels back instead of jumping', () => {
        const api = createSvgAnimationPlayer({
            document: doc({}, [{ name: 'timeline.start', triggers: [{ event: 'load' }] }, { name: 'timeline.stop', with: { whenStopped: 'animateToStart' }, triggers: [{ event: 'click' }] }]),
            container: '#box',
        });
        vi.advanceTimersByTime(1000);
        click();
        vi.advanceTimersByTime(32);
        expect(contentMs()).toBeGreaterThan(500);            // no snap to the start
        expect(api.timeline.getState()).toBe('returning');
        vi.advanceTimersByTime(3000);
        expect(contentMs()).toBe(0);
        expect(api.timeline.getState()).toBe('off');
    });

    it('a file with no states: get() is empty and the controls do nothing', () => {
        const api = createSvgAnimationPlayer({
            document: { type: 'svg', animator: { timelines: [{ engine: 'js', outTime: 1000 }] }, children: [] },
            container: '#box',
        });
        expect(api.flow.get()).toEqual([]);
        api.flow.next();
        expect(api.flow.getAll()).toEqual([]);
    });
});
