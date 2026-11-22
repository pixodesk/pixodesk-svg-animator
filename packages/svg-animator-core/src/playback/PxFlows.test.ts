/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// Flows (2026-11-22; states 11-20, segments 11-15) — the platform-neutral half: the steps as a flow plays them, checking
// the ids, the rules' repair.

import { describe, expect, it } from 'vitest';
import { PxActionTriggersSchema, type PxDocument, type PxFlowStep } from '../format/PxAnimatorTypes';
import { PxFlowAction, PxTriggerList, PxWhenFinished, PxWhenLeaving } from '../format/PxAnimatorConstants';
import { duplicateFlowStepIds, isFlowActionObject, flowStepReferenceIssues } from './PxFlows';
import { planUnits, switchStepsOf } from './PxUnits';

/** A one-timeline document (0…3000 ms) with these steps — and the steps of its one flow as the switch reads them. */
function flowOf(steps: Array<PxFlowStep>, timeline: Record<string, unknown> = { outTime: 3000 }) {
    const doc = { type: 'svg', animator: { timelines: [timeline], flowSteps: steps } } as PxDocument;
    const plan = planUnits(doc);
    const unit = plan?.units[0];
    return { plan, unit, steps: unit && plan ? switchStepsOf(unit, plan) : [] };
}

describe('flows — the steps as a flow plays them', () => {
    it('in LIST order — not by their place on the timeline — with the defaults stated', () => {
        const { unit, steps } = flowOf([
            { id: 'late', inTime: 2000, outTime: 3000 },
            { id: 'early', inTime: 0, outTime: 1000, whenFinished: { action: PxFlowAction.next }, iterations: 'infinite' },
        ]);
        expect(steps.map(s => s.id)).toEqual(['late', 'early']);   // `next` from `late` goes to `early`
        expect(unit?.steps.map(s => s.step.inTime)).toEqual([2000, 0]);
        expect(steps[0]).toMatchObject({ whenLeaving: PxWhenLeaving.jump, initial: false, endless: false });
        expect(steps[1]).toMatchObject({ then: { step: 1 }, endless: true });
    });

    it('an id used twice: the first wins, the later is reported (PX1115)', () => {
        const cfg = { flowSteps: [{ id: 'a', inTime: 0, outTime: 1000 }, { id: 'a', inTime: 1000, outTime: 2000 }, { id: 'b' }] };
        const { unit } = flowOf(cfg.flowSteps);
        expect(unit?.steps.map(s => [s.id, s.step.inTime])).toEqual([['a', 0], ['b', undefined]]);
        expect(duplicateFlowStepIds(cfg.flowSteps)).toEqual(['a']);
        expect(duplicateFlowStepIds([{ id: 'a' }, { id: 'b' }])).toEqual([]);
    });

    it('a go-to names its step; a go-to to nothing reads as hold; previous steps back', () => {
        const [a, b, c] = flowOf([
            { id: 'a', inTime: 0, outTime: 1000, whenFinished: { action: PxFlowAction.goTo, flowStep: 'b' } },
            { id: 'b', inTime: 1000, outTime: 2000, whenFinished: { action: PxFlowAction.goTo, flowStep: 'nope' } },
            { id: 'c', inTime: 2000, outTime: 3000, whenFinished: { action: PxFlowAction.previous } },
        ]).steps;
        expect(a.then).toEqual({ flowStep: 'b' });
        expect(b.then).toBeUndefined();
        expect(c.then).toEqual({ step: -1 });
    });

    it('a scroll timeline: a part of it is no step; the whole of it is one (2026-11-22)', () => {
        const scroll = { type: 'scroll', outTime: 1000 };
        // a part of a scroll timeline is not read — the timeline is then alone, as it plays today: no plan
        expect(flowOf([{ id: 'a', inTime: 0, outTime: 500 }], scroll).plan).toBeUndefined();
        // the whole of it is a step, and the flow is moved by the scrolling
        const whole = flowOf([{ id: 'a' }], scroll);
        expect(whole.unit?.steps.map(s => s.id)).toEqual(['a']);
        expect(whole.unit?.scroll).toBe(true);
    });

    it('an action object is told from a picture word', () => {
        expect(isFlowActionObject({ action: PxFlowAction.next })).toBe(true);
        expect(isFlowActionObject(PxWhenFinished.hold)).toBe(false);
        expect(isFlowActionObject({ action: PxTriggerList.startPlayback })).toBe(false);
    });
});

describe('flows — the ids a go-to may use (PX1114)', () => {
    it('reports a rule and a whenFinished that name no step; the known ones and the other rules pass', () => {
        const issues = flowStepReferenceIssues({
            flowSteps: [{ id: 'intro', whenFinished: { action: PxFlowAction.goTo, flowStep: 'lop' } }, { id: 'loop' }],
            actionTriggers: [
                { action: PxTriggerList.startPlayback, event: 'load' },
                { action: PxFlowAction.goTo, flowStep: 'loop', event: 'click' },
                { action: PxFlowAction.goTo, flowStep: 'sucess', event: 'click' },
            ],
        });
        expect(issues).toEqual([
            { target: 'sucess', ids: ['intro', 'loop'] },
            { target: 'lop', flowStep: 'intro', ids: ['intro', 'loop'] },
        ]);
    });
});

describe('rules — the repair drops a rule that does not fit, rule by rule', () => {
    it('a rule with an unknown action or event is dropped; a good rule stays as written', () => {
        const fixed = PxActionTriggersSchema.castOrFix([
            { action: 'timeline.start', event: 'load' },
            { action: 'timeline.jump', event: 'click' },
            { action: 'timeline.start', event: 'click', selector: '.go', with: { metaOrCtrlKey: true } },
            { action: 'timeline.start', event: 'wave' },
        ]);
        expect(fixed.value).toEqual([
            { action: 'timeline.start', event: 'load' },
            { action: 'timeline.start', event: 'click', selector: '.go', with: { metaOrCtrlKey: true } },
        ]);
        expect(fixed.problems.length).toBe(2);
    });

    it('a state action takes any event and names its state', () => {
        const rules = [
            { action: PxFlowAction.next, event: 'keyDown', with: { key: 'ArrowRight' } },
            { action: PxFlowAction.goTo, flowStep: 'b', event: 'pointerUp' },
        ];
        const fixed = PxActionTriggersSchema.castOrFix(rules);
        expect(fixed.value).toEqual(rules);
        expect(fixed.problems).toEqual([]);
    });
});
