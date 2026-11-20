/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// Units (2026-11-20) — a document with several timelines split into one-timeline documents over the same picture.

import { describe, expect, it } from 'vitest';
import type { PxDocument, PxNode } from '../format/PxAnimatorTypes';
import { PxDocStage } from '../format/PxDocStage';
import { prepareDocument } from '../pipeline/PxPrepareDocument';
import { PxTimelineEngine } from '../format/PxAnimatorConstants';
import { planUnits, unitDocumentOf } from './PxUnits';
import { timelineWindowsOf } from './PxTimelineWindows';
import { isRecord } from '../schema/PxSchema';

const plain = (doc: PxDocument): PxDocument => prepareDocument(prepareDocument(doc, { stage: PxDocStage.resolved }), { engine: PxTimelineEngine.js });

/** The bell button of the design doc, reduced: a free shine, a pointer state machine on `grow` + `dip`, a `notice`
 *  state machine on `ring`, a scroll timeline `reveal`. */
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
                { id: 'hover', timeline: 'grow' },
                { id: 'press', timeline: 'dip', whenFinished: { action: 'state.goTo', state: 'hover' } },
                { id: 'calm', stateMachine: 'notice', timeline: 'ring', inTime: 0, outTime: 0 },
                { id: 'ringing', stateMachine: 'notice', timeline: 'ring', inTime: 0, outTime: 600 },
            ],
            stateMachines: [{ id: 'notice' }],
            actionTriggers: [
                { action: 'timeline.start', event: 'load' },
                { action: 'state.goTo', state: 'hover', event: 'hoverIn' },
                { action: 'state.goTo', state: 'ringing', event: 'click' },
                { action: 'state.next', stateMachine: 'notice', event: 'keyDown' },
                { action: 'timeline.pause', timeline: 'ring', event: 'hoverOut' },
            ],
        },
        children: [
            { type: 'rect', id: 'shine', x: 0, animate: { x: { keyframes: [{ time: 0, value: 0 }, { time: 4000, value: 40 }] } } },
            { type: 'rect', id: 'bg', width: 5, opacity: 0.5, animate: {
                opacity: { byTimeline: [{ timeline: 'grow', keyframes: [{ time: 0, value: 0 }, { time: 150, value: 1 }] }] },
                width: { byTimeline: [{ timeline: 'dip', keyframes: [{ time: 0, value: 10 }, { time: 200, value: 20 }] }] },
            } },
            { type: 'g', id: 'bell', opacity: 1, animate: {
                opacity: { byTimeline: [{ timeline: 'reveal', keyframes: [{ time: 0, value: 0 }, { time: 1000, value: 1 }] }] },
            } },
            { type: 'circle', id: 'badge', r: 4, animate: {
                r: { byTimeline: [{ timeline: 'ring', keyframes: [{ time: 0, value: 0 }, { time: 600, value: 0 }, { time: 800, value: 4 }] }] },
            } },
        ],
    };
}

const nodeById = (doc: PxDocument, id: string): PxNode | undefined => {
    const find = (n: PxNode): PxNode | undefined => n.id === id ? n : (n.children ?? []).map(find).find(Boolean);
    return find(doc as PxNode);
};

describe('units — the plan', () => {
    it('one timeline, or states on the first only: no plan (today\'s player)', () => {
        expect(planUnits(plain({ type: 'svg', animator: { timelines: [{ outTime: 1000 }] }, children: [] }))).toBeUndefined();
        expect(planUnits(plain({ type: 'svg', animator: { timelines: [{ outTime: 1000 }], states: [{ id: 'a' }, { id: 'b' }] }, children: [] }))).toBeUndefined();
    });

    it('a unit per free timeline and per state machine, the first timeline\'s unit primary', () => {
        const plan = planUnits(plain(bell()));
        expect(plan?.units.map(u => [u.timelines, u.stateMachine, u.primary, u.scroll])).toEqual([
            [[0], undefined, true, false],
            [[1, 2], '', false, false],
            [[3], 'notice', false, false],
            [[4], undefined, false, true],
        ]);
    });

    it('a state on a timeline the file lacks, or on one another state machine uses, is not read', () => {
        const doc = bell();
        doc.animator?.states?.push({ id: 'lost', timeline: 'nope' }, { id: 'taken', stateMachine: 'other', timeline: 'ring' });
        const plan = planUnits(plain(doc));
        expect(plan?.units.flatMap(u => u.states.map(st => st.id))).toEqual(['idle', 'hover', 'press', 'calm', 'ringing']);
    });

    it('a timeline whose id an earlier one has, and a free timeline nothing rides, get no unit', () => {
        const doc = bell();
        doc.animator?.timelines?.push({ id: 'grow', outTime: 50 }, { id: 'idle', outTime: 500 });
        const plan = planUnits(plain(doc));
        expect(plan?.units.map(u => u.timelines)).toEqual([[0], [1, 2], [3], [4]]);
    });

    it('every timeline\'s window by its id', () => {
        expect([...timelineWindowsOf(bell())]).toEqual([
            ['grow', { windowStart: 0, windowEnd: 150 }], ['dip', { windowStart: 0, windowEnd: 200 }],
            ['ring', { windowStart: 0, windowEnd: 1400 }], ['reveal', { windowStart: 0, windowEnd: 1000 }],
        ]);
    });
});

describe('units — a unit\'s document', () => {
    it('a free timeline: its tracks only, the rules for the whole picture, no states', () => {
        const doc = plain(bell());
        const plan = planUnits(doc);
        if (!plan) throw new Error('no plan');
        const shine = unitDocumentOf(doc, plan.units[0], plan);
        expect(shine.animator?.timelines).toEqual([{ outTime: 4000, iterations: 'infinite' }]);
        expect(shine.animator?.states).toBeUndefined();
        expect(shine.animator?.actionTriggers).toEqual([{ action: 'timeline.start', event: 'load' }]);
        expect(Object.keys(nodeById(shine, 'shine')?.animate ?? {})).toEqual(['x']);
        expect(nodeById(shine, 'bg')?.animate).toBeUndefined();
    });

    it('a state machine on two timelines: laid end to end, the states moved, an attribute with no track holds the node\'s value', () => {
        const doc = plain(bell());
        const plan = planUnits(doc);
        if (!plan) throw new Error('no plan');
        const pointer = unitDocumentOf(doc, plan.units[1], plan);
        // grow 0–150, a gap of 1000, dip at 1150–1350
        expect(pointer.animator?.timelines?.[0]?.outTime).toBe(1350);
        expect(pointer.animator?.states?.map(st => [st.id, st.inTime, st.outTime])).toEqual([['idle', 0, 0], ['hover', 0, 150], ['press', 1150, 1350]]);
        expect(pointer.animator?.actionTriggers).toEqual([{ action: 'timeline.start', event: 'load' }, { action: 'state.goTo', state: 'hover', event: 'hoverIn' }]);
        const animate: unknown = nodeById(pointer, 'bg')?.animate;
        const w = isRecord(animate) ? animate.width : undefined;
        expect(isRecord(w) && Array.isArray(w.keyframes) ? w.keyframes.map(kf => isRecord(kf) ? [kf.time, kf.value] : kf) : undefined)
            .toEqual([[0, 5], [150, 5], [1150, 10], [1350, 20]]);
    });

    it('the shared animations of the pre-rendered path are promoted too — a free timeline\'s track; laid end to end with the bound element\'s own value held', () => {
        const doc = bell();
        doc.children?.push({ type: 'rect', id: 'chip', width: 3 });
        if (doc.animator) {
            doc.animator.definitions = { animations: {
                chipGrow: { width: { byTimeline: [{ timeline: 'dip', keyframes: [{ time: 0, value: 6 }, { time: 200, value: 9 }] }] } },
                chipShine: { opacity: { keyframes: [{ time: 0, value: 0 }, { time: 4000, value: 1 }] } },
            } };
            doc.animator.bindings = [{ element: '#chip', animateWith: ['chipGrow', 'chipShine'] }];
        }
        const prepared = plain(doc);
        const plan = planUnits(prepared);
        if (!plan) throw new Error('no plan');
        const animationsOf = (d: PxDocument): Record<string, unknown> => {
            const a: unknown = d.animator?.definitions?.animations;
            return isRecord(a) ? a : {};
        };
        const shine = animationsOf(unitDocumentOf(prepared, plan.units[0], plan));
        expect(isRecord(shine.chipShine) && 'opacity' in shine.chipShine).toBe(true);    // the first timeline's
        expect(isRecord(shine.chipGrow) && 'width' in shine.chipGrow).toBe(false);       // on `dip`: not this unit's
        const pointer = animationsOf(unitDocumentOf(prepared, plan.units[1], plan));
        const w = isRecord(pointer.chipGrow) ? pointer.chipGrow.width : undefined;
        expect(isRecord(w) && Array.isArray(w.keyframes) ? w.keyframes.map(kf => isRecord(kf) ? [kf.time, kf.value] : kf) : undefined)
            .toEqual([[0, 3], [150, 3], [1150, 6], [1350, 9]]);
    });

    it('a track naming the FIRST timeline is its keyframes — alone in the file, and in a state machine\'s unit', () => {
        const xOf = (d: PxDocument, id: string): unknown => {
            const animate: unknown = nodeById(d, id)?.animate;
            const x = isRecord(animate) ? animate.x : undefined;
            return isRecord(x) && Array.isArray(x.keyframes) ? x.keyframes.map(kf => isRecord(kf) ? [kf.time, kf.value] : kf) : undefined;
        };
        const track = { byTimeline: [{ timeline: 'main', keyframes: [{ time: 0, value: 0 }, { time: 500, value: 50 }] }] };
        const alone = plain({ type: 'svg', animator: { timelines: [{ id: 'main', outTime: 500 }] }, children: [{ type: 'rect', id: 'r', x: 0, animate: { x: track } }] });
        expect(planUnits(alone)).toBeUndefined();
        expect(xOf(alone, 'r')).toEqual([[0, 0], [500, 50]]);
        const machines = plain({
            type: 'svg',
            animator: {
                timelines: [{ id: 'main', outTime: 500 }, { id: 'other', outTime: 300 }],
                states: [{ id: 'a', stateMachine: 'm1', timeline: 'main' }, { id: 'b', stateMachine: 'm2', timeline: 'other' }],
                stateMachines: [{ id: 'm1' }, { id: 'm2' }],
            },
            children: [{ type: 'rect', id: 'r', x: 0, animate: { x: track } }],
        });
        const plan = planUnits(machines);
        if (!plan) throw new Error('no plan');
        expect(xOf(unitDocumentOf(machines, plan.units[0], plan), 'r')).toEqual([[0, 0], [500, 50]]);
    });

    it('the rules go to their unit: a named state machine\'s `next`, a rule naming a timeline', () => {
        const doc = plain(bell());
        const plan = planUnits(doc);
        if (!plan) throw new Error('no plan');
        const notice = unitDocumentOf(doc, plan.units[2], plan);
        expect(notice.animator?.actionTriggers).toEqual([
            { action: 'timeline.start', event: 'load' },
            { action: 'state.goTo', state: 'ringing', event: 'click' },
            { action: 'state.next', stateMachine: 'notice', event: 'keyDown' },
            { action: 'timeline.pause', event: 'hoverOut' },
        ]);
        const reveal = unitDocumentOf(doc, plan.units[3], plan);
        expect(reveal.animator?.actionTriggers).toBeUndefined();   // a scroll timeline: nothing starts it — no list
        expect(reveal.animator?.timelines?.[0]).toMatchObject({ type: 'scroll', outTime: 1000 });
    });
});
