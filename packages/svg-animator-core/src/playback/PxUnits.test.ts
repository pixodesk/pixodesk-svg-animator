/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// The plan (2026-11-22; units 2026-11-20) — flows side by side, the flow `default` with a step for every timeline no
// step names, one document per step over the same picture, the clash rule, the page's lists.

import { describe, expect, it } from 'vitest';
import type { PxDocument, PxNode } from '../format/PxAnimatorTypes';
import { PxDocStage } from '../format/PxDocStage';
import { prepareDocument } from '../pipeline/PxPrepareDocument';
import { PX_DEFAULT_TIMELINE, PxTimelineEngine } from '../format/PxAnimatorConstants';
import { attributeOwnersOf, planUnits, stepDocumentOf, unitConfigOf, type PxUnitPlan } from './PxUnits';
import { timelineWindowsOf } from './PxTimelineWindows';
import { isRecord } from '../schema/PxSchema';

const plain = (doc: PxDocument): PxDocument => prepareDocument(prepareDocument(doc, { stage: PxDocStage.resolved }), { engine: PxTimelineEngine.js });

/** The bell button of the design doc, reduced: the shine on the default timeline (no step names it: the flow
 *  `default`), a `pointer` flow on `grow` + `dip`, a `notice` flow on `ring`, a `scrollIn` flow on the scroll timeline. */
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
                { id: 'idle', flow: 'pointer', timeline: 'grow', inTime: 0, outTime: 0 },
                { id: 'hover', flow: 'pointer', timeline: 'grow' },
                { id: 'press', flow: 'pointer', timeline: 'dip' },
                { id: 'calm', flow: 'notice', timeline: 'ring', inTime: 0, outTime: 0 },
                { id: 'ringing', flow: 'notice', timeline: 'ring', inTime: 0, outTime: 600 },
                { id: 'shown', flow: 'scrollIn', timeline: 'reveal' },
            ],
            flows: [{ id: 'pointer' }, { id: 'notice' }, { id: 'scrollIn' }],
            actions: [
                { action: 'timeline.start', event: 'load' },
                { action: 'flow.goTo', flowStep: 'hover', event: 'hoverIn' },
                { action: 'flow.goTo', flowStep: 'ringing', event: 'click' },
                { action: 'flow.next', flow: 'notice', event: 'keyDown' },
                { action: 'timeline.pause', timeline: 'ring', event: 'hoverOut' },
                // 1.29: "at its end, go to hover" is an entry of the list
                { action: 'flow.goTo', flowStep: 'hover', event: 'finished', from: 'press' },
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

/** The plan, or a failed test. */
const planOf = (doc: PxDocument): PxUnitPlan => {
    const plan = planUnits(doc);
    if (!plan) throw new Error('no plan');
    return plan;
};

/** An attribute's plain keyframes in a document, as [time, value] pairs. */
const keyframesOf = (d: PxDocument, id: string, prop: string): unknown => {
    const animate: unknown = nodeById(d, id)?.animate;
    const entry = isRecord(animate) ? animate[prop] : undefined;
    return isRecord(entry) && Array.isArray(entry.keyframes) ? entry.keyframes.map(kf => isRecord(kf) ? [kf.time, kf.value] : kf) : undefined;
};

describe('the plan', () => {
    it('the default timeline alone, with no step written: no plan (today\'s player); steps written: one flow', () => {
        expect(planUnits(plain({ type: 'svg', animator: { timelines: [{ outTime: 1000 }] }, children: [] }))).toBeUndefined();
        const plan = planUnits(plain({ type: 'svg', animator: { timelines: [{ outTime: 1000 }], flowSteps: [{ id: 'a' }, { id: 'b' }] }, children: [] }));
        expect(plan?.units.map(u => [u.flow, u.steps.map(s => s.id)])).toEqual([['default', ['a', 'b']]]);
    });

    it('a unit per running flow — `default` first (the shine\'s own step), then the flows as listed; scroll moves its own', () => {
        const plan = planOf(plain(bell()));
        expect(plan.units.map(u => [u.flow, u.timelines, u.scroll])).toEqual([
            ['default', [0], false],
            ['pointer', [1, 2], false],
            ['notice', [3], false],
            ['scrollIn', [4], true],
        ]);
    });

    it('a step on a timeline the file lacks, or on one another flow uses, is not read', () => {
        const doc = bell();
        doc.animator?.flowSteps?.push({ id: 'lost', timeline: 'nope' }, { id: 'taken', flow: 'other', timeline: 'ring' });
        const plan = planOf(plain(doc));
        expect(plan.units.flatMap(u => u.steps.map(s => s.id))).toEqual(['default', 'idle', 'hover', 'press', 'calm', 'ringing', 'shown']);
        expect(plan.droppedSteps).toEqual([{ timeline: 3, flowStep: 'taken' }]);
    });

    it('a timeline whose id an earlier one has is not read; a timeline no step names is a step of `default`', () => {
        const doc = bell();
        doc.animator?.timelines?.push({ id: 'grow', outTime: 50 }, { id: 'spare', outTime: 500 });
        const plan = planOf(plain(doc));
        expect(plan.units.map(u => u.timelines)).toEqual([[0, 5], [1, 2], [3], [4]]);
        expect(plan.units[0].steps.map(s => [s.id, s.implied])).toEqual([['default', true], ['spare', true]]);
    });

    it('every named timeline\'s window by its id', () => {
        expect([...timelineWindowsOf(bell())]).toEqual([
            ['grow', { windowStart: 0, windowEnd: 150 }], ['dip', { windowStart: 0, windowEnd: 200 }],
            ['ring', { windowStart: 0, windowEnd: 1400 }], ['reveal', { windowStart: 0, windowEnd: 1000 }],
        ]);
    });

    it('two timelines and nothing else are ONE flow of two steps — only flows run side by side (2026-11-22)', () => {
        const plan = planOf(plain({ type: 'svg', animator: { timelines: [{ outTime: 1000 }, { id: 'sun', outTime: 500 }] }, children: [] }));
        expect(plan.units.map(u => [u.flow, u.steps.map(s => s.id)])).toEqual([['default', ['default', 'sun']]]);
    });

    it('in `default` a timeline\'s own step stands at its timeline\'s place (cases c and d of the brainstorm)', () => {
        // c — the default timeline cut into intro · loop; `outro`, a second timeline no step names, comes after them
        const c = planOf(plain({ type: 'svg', animator: {
            timelines: [{ outTime: 2000 }, { id: 'outro', outTime: 500 }],
            flowSteps: [{ id: 'intro', inTime: 0, outTime: 1000 }, { id: 'loop', inTime: 1000, outTime: 2000 }],
        }, children: [] }));
        expect(c.units[0].steps.map(s => s.id)).toEqual(['intro', 'loop', 'outro']);
        // d — the default timeline, no step names it (an idle loop), before hover · press on their own timelines
        const d = planOf(plain({ type: 'svg', animator: {
            timelines: [{ outTime: 2000 }, { id: 'h', outTime: 150 }, { id: 'p', outTime: 200 }],
            flowSteps: [{ id: 'hover', timeline: 'h' }, { id: 'press', timeline: 'p' }],
        }, children: [] }));
        expect(d.units[0].steps.map(s => s.id)).toEqual(['default', 'hover', 'press']);
    });

    // 2026-11-22: the page calls the default timeline PX_DEFAULT_TIMELINE (''); its own step keeps the id `default`
    it('the page says what runs: its flows, its timelines whole and by themselves — `default` named like any other', () => {
        const doc = plain(bell());
        expect(planUnits(doc, { flows: ['notice'] })?.units.map(u => u.flow)).toEqual(['notice']);
        expect(planUnits(doc, { flows: ['notice', 'default'] })?.units.map(u => u.flow)).toEqual(['notice', 'default']);
        const timelines = planUnits(doc, { timelines: ['grow', PX_DEFAULT_TIMELINE] });
        expect(timelines?.units.map(u => [u.flow, u.steps.map(s => s.id)])).toEqual([[undefined, ['grow']], [undefined, ['default']]]);
        expect(planUnits(doc, { flows: ['nope'] })?.units).toEqual([]);
    });

    it('the default timeline is the one with NO id, wherever it stands; plain keyframes are its (2026-11-22)', () => {
        const doc = plain({ type: 'svg', animator: { timelines: [{ id: 'first', outTime: 300 }, { outTime: 1000 }] },
            children: [{ type: 'rect', id: 'r', x: 0, animate: { x: { keyframes: [{ time: 0, value: 0 }, { time: 1000, value: 10 }] } } }] });
        const plan = planOf(doc);
        // 2026-11-22: its name is '' (PX_DEFAULT_TIMELINE); the step it is keeps the id `default`
        expect(plan.timelines.map(t => [t.name, t.isDefault])).toEqual([['first', false], [PX_DEFAULT_TIMELINE, true]]);
        // `default`: the timeline `first` (its place first), then the default timeline's own step
        expect(plan.units[0].steps.map(s => s.id)).toEqual(['first', 'default']);
        const onDefault = stepDocumentOf(doc, plan, 0, 1, attributeOwnersOf(doc, plan));
        expect(keyframesOf(onDefault, 'r', 'x')).toEqual([[0, 0], [1000, 10]]);
    });
});

describe('a step\'s document', () => {
    it('the shine\'s own step: its timeline as it is, its tracks only, no steps or rules — the flow wires them', () => {
        const doc = plain(bell());
        const plan = planOf(doc);
        const shine = stepDocumentOf(doc, plan, 0, 0, attributeOwnersOf(doc, plan));
        expect(shine.animator?.timelines).toEqual([{ outTime: 4000, iterations: 'infinite' }]);
        expect(shine.animator?.flowSteps).toBeUndefined();
        expect(shine.animator?.actions).toBeUndefined();
        expect(Object.keys(nodeById(shine, 'shine')?.animate ?? {})).toEqual(['x']);
        expect(nodeById(shine, 'bg')?.animate).toBeUndefined();
        expect(unitConfigOf(doc, plan.units[0], plan).animator?.actions).toEqual([{ action: 'timeline.start', event: 'load' }]);
    });

    it('a step on another timeline: its part and settings, its own track only — an attribute with no track there has no entry', () => {
        const doc = plain(bell());
        const plan = planOf(doc);
        const claims = attributeOwnersOf(doc, plan);
        const press = stepDocumentOf(doc, plan, 1, 2, claims);
        // its end goes on (an action): the flow's — the playback holds; no delay; before it plays, its first frame
        expect(press.animator?.timelines).toEqual([{ outTime: 200, whenFinished: 'hold', whenIdle: 'firstFrame' }]);
        expect(keyframesOf(press, 'bg', 'width')).toEqual([[0, 10], [200, 20]]);
        expect(keyframesOf(press, 'bg', 'opacity')).toBeUndefined();
        // a step of no length holds its first frame: a part one millisecond long
        expect(stepDocumentOf(doc, plan, 1, 0, claims).animator?.timelines?.[0]).toMatchObject({ inTime: 0, outTime: 1, iterations: 1 });
        // 1.29: the press's "at its end, go to hover" is the flow's entry too
        expect(unitConfigOf(doc, plan.units[1], plan).animator?.actions).toEqual([
            { action: 'timeline.start', event: 'load' }, { action: 'flow.goTo', flowStep: 'hover', event: 'hoverIn' },
            { action: 'flow.goTo', flowStep: 'hover', event: 'finished', from: 'press' },
        ]);
    });

    it('the shared animations of the pre-rendered path are promoted too — each step its own timeline\'s track', () => {
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
        const plan = planOf(prepared);
        const claims = attributeOwnersOf(prepared, plan);
        const animationsOf = (d: PxDocument): Record<string, unknown> => {
            const a: unknown = d.animator?.definitions?.animations;
            return isRecord(a) ? a : {};
        };
        const shine = animationsOf(stepDocumentOf(prepared, plan, 0, 0, claims));
        expect(isRecord(shine.chipShine) && 'opacity' in shine.chipShine).toBe(true);    // the default timeline's
        expect(isRecord(shine.chipGrow) && 'width' in shine.chipGrow).toBe(false);       // on `dip`: not this step's
        const press = animationsOf(stepDocumentOf(prepared, plan, 1, 2, claims));
        const w = isRecord(press.chipGrow) ? press.chipGrow.width : undefined;
        expect(isRecord(w) && Array.isArray(w.keyframes) ? w.keyframes.map(kf => isRecord(kf) ? [kf.time, kf.value] : kf) : undefined)
            .toEqual([[0, 6], [200, 9]]);
    });

    it('a timeline with an id is reached by its tracks — alone in the file (no default timeline), and as a flow\'s step', () => {
        const track = { byTimeline: [{ timeline: 'main', keyframes: [{ time: 0, value: 0 }, { time: 500, value: 50 }] }] };
        const alone = plain({ type: 'svg', animator: { timelines: [{ id: 'main', outTime: 500 }] }, children: [{ type: 'rect', id: 'r', x: 0, animate: { x: track } }] });
        const solo = planOf(alone);
        expect(solo.units.map(u => u.steps.map(s => s.id))).toEqual([['main']]);
        expect(keyframesOf(stepDocumentOf(alone, solo, 0, 0, attributeOwnersOf(alone, solo)), 'r', 'x')).toEqual([[0, 0], [500, 50]]);
        const machines = plain({
            type: 'svg',
            animator: {
                timelines: [{ id: 'main', outTime: 500 }, { id: 'other', outTime: 300 }],
                flowSteps: [{ id: 'a', flow: 'm1', timeline: 'main' }, { id: 'b', flow: 'm2', timeline: 'other' }],
                flows: [{ id: 'm1' }, { id: 'm2' }],
            },
            children: [{ type: 'rect', id: 'r', x: 0, animate: { x: track } }],
        });
        const plan = planOf(machines);
        expect(keyframesOf(stepDocumentOf(machines, plan, 0, 0, attributeOwnersOf(machines, plan)), 'r', 'x')).toEqual([[0, 0], [500, 50]]);
    });

    it('the rules go to their unit: a named flow\'s `next`, a rule naming a timeline; a scroll flow hears none', () => {
        const doc = plain(bell());
        const plan = planOf(doc);
        expect(unitConfigOf(doc, plan.units[2], plan).animator?.actions).toEqual([
            { action: 'timeline.start', event: 'load' },
            { action: 'flow.goTo', flowStep: 'ringing', event: 'click' },
            { action: 'flow.next', flow: 'notice', event: 'keyDown' },
            { action: 'timeline.pause', event: 'hoverOut' },
        ]);
        expect(unitConfigOf(doc, plan.units[3], plan).animator?.actions).toBeUndefined();   // scroll: no list
        expect(stepDocumentOf(doc, plan, 3, 0, attributeOwnersOf(doc, plan)).animator?.timelines?.[0]).toMatchObject({ type: 'scroll', outTime: 1000 });
    });

    it('the clash rule: an attribute two running flows move stays with the first — a node\'s transform parts count as one', () => {
        const doc = plain({ type: 'svg', animator: {
            timelines: [{ id: 'a', outTime: 100 }, { id: 'b', outTime: 100 }],
            flowSteps: [{ id: 'one', flow: 'f1', timeline: 'a' }, { id: 'two', flow: 'f2', timeline: 'b' }],
            flows: [{ id: 'f1' }, { id: 'f2' }],
        }, children: [{ type: 'rect', id: 'r', opacity: 1, animate: {
            opacity: { byTimeline: [{ timeline: 'a', keyframes: [{ time: 0, value: 0 }, { time: 100, value: 1 }] }, { timeline: 'b', keyframes: [{ time: 0, value: 1 }, { time: 100, value: 0 }] }] },
            scale: { byTimeline: [{ timeline: 'a', keyframes: [{ time: 0, value: [1, 1] }, { time: 100, value: [2, 2] }] }] },
            rotate: { byTimeline: [{ timeline: 'b', keyframes: [{ time: 0, value: 0 }, { time: 100, value: 90 }] }] },
        } }] });
        const plan = planOf(doc);
        const claims = attributeOwnersOf(doc, plan);
        expect(claims.filter(c => c.units.length > 1).map(c => c.attribute).sort()).toEqual(['opacity', 'transform']);
        const second = stepDocumentOf(doc, plan, 1, 0, claims);
        expect(nodeById(second, 'r')?.animate).toBeUndefined();          // f2 owns nothing here: f1 moves both
        // the page's order turns the winner
        const flipped = planUnits(doc, { flows: ['f2', 'f1'] });
        if (!flipped) throw new Error('no plan');
        const first = stepDocumentOf(doc, flipped, 0, 0, attributeOwnersOf(doc, flipped));
        // f2 owns both now: its own tracks play (the opacity, the rotation); `scale` has no track on its timeline
        expect(Object.keys(nodeById(first, 'r')?.animate ?? {}).sort()).toEqual(['opacity', 'rotate']);
    });
});
