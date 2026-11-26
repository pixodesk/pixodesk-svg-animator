/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// The checks of timelines, flows and flow steps (2026-11-20; flows 2026-11-22) — a clean file, then one mistake at a time.

import { describe, expect, it } from 'vitest';
import type { PxDocument } from '../format/PxAnimatorTypes';
import { PX_DEFAULT_TIMELINE } from '../format/PxAnimatorConstants';
import { PxTimelineIssueKind, timelineIssues } from './PxTimelineChecks';

/** The flow `default` (the shine, idle · press on `grow` + `dip`, the scroll `reveal` no step names), a `notice` flow on `ring`. */
function bell(): PxDocument {
    return {
        type: 'svg', viewBox: '0 0 100 100',
        animator: {
            timelines: [
                { outTime: 4000, iterations: 'infinite' },
                { id: 'grow', outTime: 150 },
                { id: 'dip', outTime: 200 },
                { id: 'ring', outTime: 1400 },
                { id: 'reveal', type: 'scroll', outTime: 1000 },
            ],
            flowSteps: [
                { id: 'idle', segment: { timeline: 'grow', inTime: 0, outTime: 0 } },
                { id: 'press', segment: { timeline: 'dip' } },
                { id: 'ringing', flow: 'notice', segment: { timeline: 'ring' } },
            ],
            flows: [{ id: 'notice' }],
            actions: [
                { name: 'timeline.start', triggers: [{ event: 'load' }] },
                { name: 'flow.next', with: { flow: 'notice' }, triggers: [{ event: 'keyDown' }] },
                { name: 'timeline.pause', with: { timeline: 'ring' }, triggers: [{ event: 'hoverOut' }] },
            ],
        },
        children: [
            { type: 'rect', id: 'shine', animate: { x: { keyframes: [{ time: 0, value: 0 }, { time: 4000, value: 40 }] } } },
            { type: 'rect', id: 'bg', animate: {
                opacity: { byTimeline: [{ timeline: 'grow', keyframes: [{ time: 0, value: 1 }] }, { timeline: 'dip', keyframes: [{ time: 0, value: 0.5 }] }] },
                translate: { byTimeline: [{ timeline: 'grow', keyframes: [{ time: 0, value: [0, 0] }] }] },
                scale: { byTimeline: [{ timeline: 'dip', keyframes: [{ time: 0, value: [1, 1] }] }] },
            } },
        ],
    };
}

// the fixtures below keep a timeline with no id beside named ones on purpose (the older spelling, still played): its own
// finding, `unnamedAmongSeveral`, is checked in its own case at the end
const kinds = (doc: PxDocument) => timelineIssues(doc).filter(i => i.kind !== PxTimelineIssueKind.unnamedAmongSeveral)
    .map(i => [i.kind, i.key ?? i.attribute ?? '', i.id ?? '', i.at ?? '']);

describe('timeline checks', () => {
    it('the bell file is clean — a flow over several timelines, its transform parts on two of them', () => {
        // its timeline with no id is the older spelling — that finding aside (see `kinds`), it is clean
        expect(kinds(bell())).toEqual([]);
    });

    // 2026-11-22: the timeline with no id is called '' (PX_DEFAULT_TIMELINE), no longer `default`
    it('a repeated timeline or flow id — two timelines with no id are two default ones', () => {
        const doc = bell();
        doc.animator?.timelines?.push({ id: 'grow' }, { outTime: 10 });
        doc.animator?.flows?.push({ id: 'notice' });
        expect(kinds(doc)).toEqual([
            [PxTimelineIssueKind.idDuplicate, 'timelines', 'grow', ''],
            [PxTimelineIssueKind.idDuplicate, 'timelines', PX_DEFAULT_TIMELINE, ''],
            [PxTimelineIssueKind.idDuplicate, 'flows', 'notice', ''],
        ]);
    });

    it('a timeline whose id is `default` is an ordinary one — no repeated id beside the one with no id (2026-11-22)', () => {
        const doc = bell();
        doc.animator?.timelines?.push({ id: 'default', outTime: 10 });
        expect(kinds(doc)).toEqual([]);
    });

    it('references that name nothing: a step\'s timeline, a rule\'s, a track\'s timeline — a flow only steps name is a flow', () => {
        const doc = bell();
        doc.animator?.flowSteps?.push({ id: 'lost', segment: { timeline: 'nope' }, flow: 'gone' });
        doc.animator?.actions?.push({ name: 'timeline.stop', with: { timeline: 'nope2' }, triggers: [{ event: 'click' }] });
        doc.children?.push({ type: 'rect', id: 'stray', animate: { x: { byTimeline: [{ timeline: 'nope3', keyframes: [{ time: 0, value: 1 }] }] } } });
        expect(kinds(doc)).toEqual([
            [PxTimelineIssueKind.referenceNotFound, 'timeline', 'nope', 'lost'],
            [PxTimelineIssueKind.referenceNotFound, 'timeline', 'nope2', 'timeline.stop'],
            [PxTimelineIssueKind.referenceNotFound, 'timeline', 'nope3', 'stray'],
        ]);
    });

    it('one timeline in two flows; a step on a PART of the scroll timeline (the whole of it is a step)', () => {
        const doc = bell();
        doc.animator?.flowSteps?.push({ id: 'taken', flow: 'notice', segment: { timeline: 'grow' } }, { id: 'scrolled', segment: { timeline: 'reveal', inTime: 0, outTime: 500 } });
        expect(kinds(doc)).toEqual([
            [PxTimelineIssueKind.partOfScrollTimeline, '', 'reveal', 'scrolled'],
            [PxTimelineIssueKind.timelineShared, '', 'grow', 'taken'],
        ]);
    });

    it('an attribute two flows move — `default` and `notice`; transform parts count as one', () => {
        const doc = bell();
        doc.children?.push({ type: 'rect', id: 'mixed', animate: {
            opacity: { byTimeline: [{ timeline: 'grow', keyframes: [{ time: 0, value: 1 }] }, { timeline: 'ring', keyframes: [{ time: 0, value: 0 }] }] },
            rotate: { keyframes: [{ time: 0, value: 0 }, { time: 1000, value: 90 }] },
            scale: { byTimeline: [{ timeline: 'ring', keyframes: [{ time: 0, value: [2, 2] }] }] },
        } });
        expect(kinds(doc)).toEqual([
            [PxTimelineIssueKind.attributeSplit, 'opacity', '', 'mixed'],
            [PxTimelineIssueKind.attributeSplit, 'transform', '', 'mixed'],
        ]);
    });

    it('plain keyframes beside byTimeline are the default timeline\'s — no finding (2026-11-22); with no default timeline, a finding', () => {
        const doc = bell();
        doc.children?.push({ type: 'rect', id: 'both', animate: {
            x: { keyframes: [{ time: 0, value: 0 }], byTimeline: [{ timeline: 'grow', keyframes: [{ time: 0, value: 1 }] }] },
        } });
        expect(kinds(doc).filter(k => k[3] === 'both')).toEqual([]);
        const named: PxDocument = { type: 'svg', animator: { timelines: [{ id: 'only', outTime: 100 }] },
            children: [{ type: 'rect', id: 'r', animate: { x: { keyframes: [{ time: 0, value: 0 }, { time: 100, value: 1 }] } } }] };
        expect(kinds(named)).toEqual([[PxTimelineIssueKind.keyframesWithoutDefault, 'x', '', 'r']]);
    });

    it('several timelines, one with no id: a finding — with several, every timeline is named (2026-11-26); one timeline: none', () => {
        const unnamed = (doc: PxDocument) => timelineIssues(doc).filter(i => i.kind === PxTimelineIssueKind.unnamedAmongSeveral);
        expect(unnamed(bell()).map(i => [i.key, i.id])).toEqual([['timelines', '']]);
        const allNamed: PxDocument = { type: 'svg', animator: { timelines: [{ id: 'Timeline1', outTime: 100 }, { id: 'Timeline2', outTime: 100 }] } };
        expect(unnamed(allNamed)).toEqual([]);
        const one: PxDocument = { type: 'svg', animator: { timelines: [{ outTime: 100 }] } };
        expect(unnamed(one)).toEqual([]);
    });
});
