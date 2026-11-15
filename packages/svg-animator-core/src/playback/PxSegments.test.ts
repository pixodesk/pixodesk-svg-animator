/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// Segments (2026-11-15) — the platform-neutral half: reading them, checking the names, the event entries' repair.

import { describe, expect, it } from 'vitest';
import { PxActionTriggersSchema } from '../format/PxAnimatorTypes';
import { isSegmentGoToAction, PxSegmentAction, PxWhenFinished, PxWhenLeaving, segmentGoToAction } from '../format/PxAnimatorConstants';
import { duplicateSegmentNames, resolveSegments, segmentReferenceIssues } from './PxSegments';

describe('segments — resolveSegments', () => {
    it('in LIST order — not by their place on the timeline — with the defaults stated', () => {
        const segments = resolveSegments({
            inTime: 0, duration: 3000,
            segments: [
                { name: 'late', inTime: 2000, outTime: 3000 },
                { name: 'early', inTime: 0, outTime: 1000, whenFinished: PxSegmentAction.next, iterations: 'infinite' },
            ],
        });
        expect(segments.map(s => s.name)).toEqual(['late', 'early']);   // `next` from `late` goes to `early`
        expect(segments[0]).toMatchObject({ startMs: 2000, passMs: 1000, iterations: 1, speed: 1, whenLeaving: PxWhenLeaving.jump, initial: false });
        expect(segments[1]).toMatchObject({ startMs: 0, passMs: 1000, iterations: Infinity, then: { next: true }, whenFinished: PxWhenFinished.hold });
    });

    it('a name used twice: the first wins, the later is reported (PX1115)', () => {
        const cfg = { duration: 2000, segments: [{ name: 'a', inTime: 0, outTime: 1000 }, { name: 'a', inTime: 1000, outTime: 2000 }, { name: 'b' }] };
        expect(resolveSegments(cfg).map(s => [s.name, s.startMs])).toEqual([['a', 0], ['b', 0]]);
        expect(duplicateSegmentNames(cfg)).toEqual(['a']);
        expect(duplicateSegmentNames({ segments: [{ name: 'a' }, { name: 'b' }] })).toEqual([]);
    });

    it('a go-to names its segment; a go-to to nothing reads as hold', () => {
        const [a, b] = resolveSegments({
            duration: 2000,
            segments: [{ name: 'a', inTime: 0, outTime: 1000, whenFinished: segmentGoToAction('b') }, { name: 'b', inTime: 1000, outTime: 2000, whenFinished: segmentGoToAction('nope') }],
        });
        expect(a.then).toEqual({ segment: 'b' });
        expect(b.then).toBeUndefined();
    });

    it('a scroll timeline has none', () => {
        expect(resolveSegments({ timelineSource: 'scroll', duration: 1000, segments: [{ name: 'a' }] })).toEqual([]);
    });
});

describe('segments — the names a go-to may use (PX1114)', () => {
    it('reports a trigger key and a whenFinished that name no segment; the known ones and the other keys pass', () => {
        const issues = segmentReferenceIssues({
            segments: [{ name: 'intro', whenFinished: segmentGoToAction('lop') }, { name: 'loop' }],
            actionTriggers: { 'timeline.start': 'load', [segmentGoToAction('loop')]: 'click', [segmentGoToAction('sucess')]: 'click' },
        });
        expect(issues).toEqual([
            { action: segmentGoToAction('sucess'), names: ['intro', 'loop'] },
            { action: segmentGoToAction('lop'), segment: 'intro', names: ['intro', 'loop'] },
        ]);
    });

    it('recognises the go-to family by its spelling', () => {
        expect(isSegmentGoToAction(segmentGoToAction('a b'))).toBe(true);
        expect(isSegmentGoToAction(PxSegmentAction.next)).toBe(false);
    });
});

describe('event entries — the repair drops what a list may not hold, entry by entry', () => {
    it('an object whose event the list may not name is dropped; a good object stays as written', () => {
        const fixed = PxActionTriggersSchema.castOrFix({
            'timeline.start': ['load', { event: 'hoverOut', element: '#a' }, { event: 'click', selector: '.go', with: { metaOrCtrlKey: true } }],
        });
        expect(fixed.value).toEqual({ 'timeline.start': ['load', { event: 'click', selector: '.go', with: { metaOrCtrlKey: true } }] });
        expect(fixed.problems.length).toBe(1);
    });

    it('a segment action takes any event, a go-to key passes the open block', () => {
        const block = { [PxSegmentAction.next]: { event: 'keyDown', with: { key: 'ArrowRight' } }, [segmentGoToAction('b')]: 'pointerUp' };
        const fixed = PxActionTriggersSchema.castOrFix(block);
        expect(fixed.value).toEqual(block);
        expect(fixed.problems).toEqual([]);
    });
});
