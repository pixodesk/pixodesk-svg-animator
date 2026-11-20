/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// The checks of several timelines and states (2026-11-20) — a clean file, then one mistake at a time.

import { describe, expect, it } from 'vitest';
import type { PxDocument } from '../format/PxAnimatorTypes';
import { PxTimelineIssueKind, timelineIssues } from './PxTimelineChecks';

/** A free shine, a pointer state machine on `grow` + `dip`, a `notice` state machine on `ring`, a scroll `reveal`. */
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
            states: [
                { id: 'idle', timeline: 'grow', inTime: 0, outTime: 0 },
                { id: 'press', timeline: 'dip' },
                { id: 'ringing', stateMachine: 'notice', timeline: 'ring' },
            ],
            stateMachines: [{ id: 'notice' }],
            actionTriggers: [
                { action: 'timeline.start', event: 'load' },
                { action: 'state.next', stateMachine: 'notice', event: 'keyDown' },
                { action: 'timeline.pause', timeline: 'ring', event: 'hoverOut' },
            ],
        },
        children: [
            { type: 'rect', id: 'shine', animate: { x: { keyframes: [{ time: 0, value: 0 }, { time: 4000, value: 40 }] } } },
            { type: 'rect', id: 'bg', animate: {
                opacity: { byTimeline: [{ timeline: 'grow', value: 1 }, { timeline: 'dip', value: 0.5 }] },
                translate: { byTimeline: [{ timeline: 'grow', value: [0, 0] }] },
                scale: { byTimeline: [{ timeline: 'dip', value: [1, 1] }] },
            } },
        ],
    };
}

const kinds = (doc: PxDocument) => timelineIssues(doc).map(i => [i.kind, i.key ?? i.attribute ?? '', i.id ?? '', i.at ?? '']);

describe('timeline checks', () => {
    it('the bell file is clean — a state machine over two timelines, its transform parts on both', () => {
        expect(timelineIssues(bell())).toEqual([]);
    });

    it('a repeated timeline or state machine id', () => {
        const doc = bell();
        doc.animator?.timelines?.push({ id: 'grow' });
        doc.animator?.stateMachines?.push({ id: 'notice' });
        expect(kinds(doc)).toEqual([
            [PxTimelineIssueKind.idDuplicate, 'timelines', 'grow', ''],
            [PxTimelineIssueKind.idDuplicate, 'stateMachines', 'notice', ''],
        ]);
    });

    it('references that name nothing: a state\'s timeline and state machine, a rule\'s, a track\'s timeline', () => {
        const doc = bell();
        doc.animator?.states?.push({ id: 'lost', timeline: 'nope', stateMachine: 'gone' });
        doc.animator?.actionTriggers?.push({ action: 'timeline.stop', timeline: 'nope2', event: 'click' });
        doc.children?.push({ type: 'rect', id: 'stray', animate: { x: { byTimeline: [{ timeline: 'nope3', value: 1 }] } } });
        expect(kinds(doc)).toEqual([
            [PxTimelineIssueKind.referenceNotFound, 'timeline', 'nope', 'lost'],
            [PxTimelineIssueKind.referenceNotFound, 'stateMachine', 'gone', 'lost'],
            [PxTimelineIssueKind.referenceNotFound, 'timeline', 'nope2', 'timeline.stop'],
            [PxTimelineIssueKind.referenceNotFound, 'timeline', 'nope3', 'stray'],
        ]);
    });

    it('one timeline in two state machines; a state on the scroll timeline', () => {
        const doc = bell();
        doc.animator?.states?.push({ id: 'taken', stateMachine: 'notice', timeline: 'grow' }, { id: 'scrolled', timeline: 'reveal' });
        expect(kinds(doc)).toEqual([
            [PxTimelineIssueKind.timelineShared, '', 'grow', 'taken'],
            [PxTimelineIssueKind.stateOnScrollTimeline, '', 'reveal', 'scrolled'],
        ]);
    });

    it('an attribute on timelines of two units — a free one and a state machine\'s; transform parts count as one', () => {
        const doc = bell();
        doc.children?.push({ type: 'rect', id: 'mixed', animate: {
            opacity: { byTimeline: [{ timeline: 'grow', value: 1 }, { timeline: 'ring', value: 0 }] },
            rotate: { keyframes: [{ time: 0, value: 0 }, { time: 1000, value: 90 }] },
            scale: { byTimeline: [{ timeline: 'dip', value: [2, 2] }] },
        } });
        expect(kinds(doc)).toEqual([
            [PxTimelineIssueKind.attributeSplit, 'opacity', '', 'mixed'],
            [PxTimelineIssueKind.attributeSplit, 'transform', '', 'mixed'],
        ]);
    });

    it('plain keyframes beside byTimeline', () => {
        const doc = bell();
        doc.children?.push({ type: 'rect', id: 'both', animate: {
            x: { keyframes: [{ time: 0, value: 0 }], byTimeline: [{ timeline: 'grow', value: 1 }] },
        } });
        expect(kinds(doc)).toContainEqual([PxTimelineIssueKind.keyframesBesideTracks, 'x', '', 'both']);
    });
});
