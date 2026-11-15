/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// Segments (2026-11-15) — named parts of one timeline, played one at a time, on the web player's frame loop.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSvgAnimationPlayer as createPlayer } from '../index';
import { PxDiagnosticCode, type PxActionTriggers, type PxDocument, type PxTimelineSegment } from '@pixodesk/svg-animator-core';

/** Every player a test makes is destroyed after it — a live frame loop otherwise outlives its test's fake timers. */
const made: Array<ReturnType<typeof createPlayer>> = [];
const createSvgAnimationPlayer: typeof createPlayer = (options) => {
    const api = createPlayer(options);
    made.push(api);
    return api;
};

/** Opacity runs 0 → 1 over content 0…3000 ms, so the opacity says where the playhead is (content ms / 3000). */
/** The test's segments by name, written as the file's list in that order. */
function doc(byName: Record<string, Omit<PxTimelineSegment, 'name'>>, actionTriggers: PxActionTriggers = { 'timeline.start': 'load' }): PxDocument {
    const segments: Array<PxTimelineSegment> = Object.entries(byName).map(([name, seg]) => ({ name, ...seg }));
    return {
        type: 'svg', viewBox: '0 0 10 10',
        animator: { timeline: { engine: 'js', outTime: 3000, segments }, actionTriggers },
        children: [
            { type: 'rect', id: 'r', width: 10, height: 10,
              animate: { opacity: { keyframes: [{ time: 0, value: 0 }, { time: 3000, value: 1 }] } } },
            { type: 'circle', id: 'btn', r: 2 },
        ],
    };
}

const THREE = {
    intro:   { inTime: 0,    outTime: 1000, whenFinished: 'timeline.segment.next' },
    loop:    { inTime: 1000, outTime: 2000, iterations: 'infinite' as const },
    success: { inTime: 2000, outTime: 3000 },
};

/** The content ms on screen. */
const contentMs = (): number => Number(document.querySelector('rect')?.getAttribute('opacity')) * 3000;

describe('segments — named parts of one timeline (2026-11-15)', () => {
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

    it('starts in the first segment and plays only its part', () => {
        const api = createSvgAnimationPlayer({ document: doc(THREE), container: '#box' });
        expect(api.timeline.segment.get()).toBe('intro');
        expect(api.timeline.segment.getAll()).toEqual(['intro', 'loop', 'success']);
        vi.advanceTimersByTime(500);
        expect(contentMs()).toBeGreaterThan(400);
        expect(contentMs()).toBeLessThan(600);
        expect(api.timeline.getDuration()).toBe(1000);   // the segment's pass, not the timeline's
    });

    it('`whenFinished: timeline.segment.next` goes on by itself; an endless segment repeats inside its part', () => {
        const changes: Array<[string, string]> = [];
        const api = createSvgAnimationPlayer({ document: doc(THREE), container: '#box', onSegmentChange: (s, p) => changes.push([s, p]) });
        vi.advanceTimersByTime(1200);
        expect(api.timeline.segment.get()).toBe('loop');
        expect(changes).toEqual([['loop', 'intro']]);
        vi.advanceTimersByTime(1500);
        expect(api.timeline.segment.get()).toBe('loop');
        expect(contentMs()).toBeGreaterThanOrEqual(1000);
        expect(contentMs()).toBeLessThanOrEqual(2000);
        expect(api.timeline.getState()).toBe('playing');
    });

    it('goTo from code changes and plays; a segment that ends holds its last frame, finished', () => {
        const api = createSvgAnimationPlayer({ document: doc(THREE), container: '#box' });
        vi.advanceTimersByTime(100);
        api.timeline.segment.goTo('success');
        expect(api.timeline.segment.get()).toBe('success');
        vi.advanceTimersByTime(1200);
        expect(contentMs()).toBeCloseTo(3000, 0);
        expect(api.timeline.getState()).toBe('finished');
    });

    it('a name the file does not have is ignored; going to the current segment does nothing', () => {
        const api = createSvgAnimationPlayer({ document: doc(THREE), container: '#box' });
        api.timeline.segment.goTo('nope');
        expect(api.timeline.segment.get()).toBe('intro');
        vi.advanceTimersByTime(300);
        api.timeline.segment.goTo('intro');
        vi.advanceTimersByTime(100);
        expect(contentMs()).toBeGreaterThan(300);   // not restarted
    });

    it('next after the last goes to the first; previous before the first, to the last', () => {
        const api = createSvgAnimationPlayer({ document: doc(THREE, {}), container: '#box' });
        api.timeline.segment.previous();
        expect(api.timeline.segment.get()).toBe('success');
        api.timeline.segment.next();
        expect(api.timeline.segment.get()).toBe('intro');
    });

    it('a trigger names a segment: `timeline.segment.goTo(success)` on a click', () => {
        const api = createSvgAnimationPlayer({ document: doc(THREE, { 'timeline.start': 'load', 'timeline.segment.goTo(success)': 'click' }), container: '#box' });
        vi.advanceTimersByTime(100);
        document.querySelector('svg')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(api.timeline.segment.get()).toBe('success');
    });

    it('an event on one element of the picture, and one on an element of the page', () => {
        const api = createSvgAnimationPlayer({
            document: doc(THREE, {
                'timeline.segment.goTo(success)': { event: 'click', element: '#btn' },
                'timeline.segment.next': { event: 'click', selector: '.next' },
            }),
            container: '#box',
        });
        document.querySelector('rect')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(api.timeline.segment.get()).toBe('intro');           // not that element
        document.querySelector('circle')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));   // its fresh id is followed
        expect(api.timeline.segment.get()).toBe('success');
        document.querySelector('button.next')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(api.timeline.segment.get()).toBe('intro');           // after the last, the first
    });

    it('a key, narrowed by `with` — heard while the picture is in view and no field has the focus', () => {
        const api = createSvgAnimationPlayer({
            document: doc(THREE, { 'timeline.segment.next': { event: 'keyDown', with: { key: 'Enter', metaOrCtrlKey: true } } }),
            container: '#box',
        });
        const svg = document.querySelector('svg');
        if (!svg) throw new Error('no svg');
        vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 100, 100));
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        expect(api.timeline.segment.get()).toBe('intro');           // without ⌘ / Ctrl
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true }));
        expect(api.timeline.segment.get()).toBe('loop');
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true }));
        expect(api.timeline.segment.get()).toBe('success');
    });

    it('`whenLeaving: animateToEnd` finishes the pass before the next segment plays', () => {
        const api = createSvgAnimationPlayer({
            document: doc({ ...THREE, loop: { ...THREE.loop, whenLeaving: 'animateToEnd' } }),
            container: '#box',
        });
        vi.advanceTimersByTime(1300);                    // intro done, 300 ms into the loop
        expect(api.timeline.segment.get()).toBe('loop');
        api.timeline.segment.goTo('success');
        expect(api.timeline.segment.get()).toBe('loop');   // still finishing its pass
        vi.advanceTimersByTime(900);
        expect(api.timeline.segment.get()).toBe('success');
    });

    it('the newest request wins while a segment is leaving', () => {
        const api = createSvgAnimationPlayer({
            document: doc({ ...THREE, loop: { ...THREE.loop, whenLeaving: 'animateToEnd' } }),
            container: '#box',
        });
        vi.advanceTimersByTime(1300);
        api.timeline.segment.goTo('success');
        api.timeline.segment.goTo('intro');
        vi.advanceTimersByTime(900);
        expect(api.timeline.segment.get()).toBe('intro');
    });

    it('an automatic ring of empty segments cannot spin within one frame', () => {
        const api = createSvgAnimationPlayer({
            document: doc({
                a: { inTime: 0, outTime: 0, whenFinished: 'timeline.segment.goTo(b)' },
                b: { inTime: 0, outTime: 0, whenFinished: 'timeline.segment.goTo(a)' },
            }),
            container: '#box',
        });
        vi.advanceTimersByTime(200);                     // returns: each hop waits for a frame
        expect(['a', 'b']).toContain(api.timeline.segment.get());
        api.destroy();
    });

    it('a goTo naming a segment the timeline lacks is reported (1114) — in a trigger and in `whenFinished`', () => {
        const warnings: Array<PxDiagnosticCode> = [];
        createSvgAnimationPlayer({
            document: doc({ ...THREE, intro: { ...THREE.intro, whenFinished: 'timeline.segment.goTo(lop)' } },
                { 'timeline.start': 'load', 'timeline.segment.goTo(sucess)': 'click' }),
            container: '#box',
            onWarning: (w) => warnings.push(w.code),
        });
        expect(warnings.filter(c => c === PxDiagnosticCode.segmentNotFound)).toHaveLength(2);
    });

    it('`next` follows the LIST, not the timeline: a later part listed first plays first', () => {
        const api = createSvgAnimationPlayer({ document: doc({ success: THREE.success, intro: THREE.intro }, {}), container: '#box' });
        expect(api.timeline.segment.getAll()).toEqual(['success', 'intro']);
        expect(api.timeline.segment.get()).toBe('success');
        api.timeline.segment.next();
        expect(api.timeline.segment.get()).toBe('intro');
    });

    it('a name used twice: the first is played, the later ignored and reported (1115)', () => {
        const warnings: Array<PxDiagnosticCode> = [];
        const twice: PxDocument = doc(THREE);
        const timeline = twice.animator?.timeline;
        if (!timeline || timeline.type === 'scroll' || !timeline.segments) throw new Error('no segments');
        timeline.segments.push({ name: 'intro', inTime: 2500, outTime: 3000 });
        const api = createSvgAnimationPlayer({ document: twice, container: '#box', onWarning: (w) => warnings.push(w.code) });
        expect(api.timeline.segment.getAll()).toEqual(['intro', 'loop', 'success']);
        expect(warnings).toContain(PxDiagnosticCode.segmentNameDuplicate);
    });

    it('a timeline with no segments: get() is null and the controls do nothing', () => {
        const api = createSvgAnimationPlayer({
            document: { type: 'svg', animator: { timeline: { engine: 'js', outTime: 1000 } }, children: [] },
            container: '#box',
        });
        expect(api.timeline.segment.get()).toBeNull();
        api.timeline.segment.next();
        expect(api.timeline.segment.getAll()).toEqual([]);
    });
});
