/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// Flows (2026-11-22; states 11-20, segments 11-15) — the platform-neutral half: the steps as a flow plays them, checking
// the ids, the rules' repair.

import { describe, expect, it } from 'vitest';
import { PxActionTriggersSchema, type PxActionObject, type PxActionTriggerRule, type PxDocument, type PxFlowStep } from '../format/PxAnimatorTypes';
import { PxFlowAction, PxStepEvent, PxTriggerList, PxWhenFinished, PxWhenLeaving } from '../format/PxAnimatorConstants';
import { atEndActionOf, duplicateFlowStepIds, isFlowActionObject, flowStepReferenceIssues } from './PxFlows';
import { planUnits, switchStepsOf } from './PxUnits';

// 1.29: a step's "at its end, go there" is an entry of `actions` (`event: 'finished'`, `from`) — the helper still takes it
// on the step, as the tests read it, and writes it as the file has it.
type TestStep = Omit<PxFlowStep, 'whenFinished'> & { whenFinished?: PxFlowStep['whenFinished'] | PxActionObject };

/** A one-timeline document (0…3000 ms) with these steps — and the steps of its one flow as the switch reads them. */
function flowOf(testSteps: Array<TestStep>, timeline: Record<string, unknown> = { outTime: 3000 }) {
    const actions: Array<PxActionTriggerRule> = [];
    const steps = testSteps.map(({ whenFinished, ...st }): PxFlowStep => {
        if (whenFinished === undefined || typeof whenFinished === 'string') return whenFinished === undefined ? st : { ...st, whenFinished };
        actions.push({ ...whenFinished, event: PxStepEvent.finished, from: st.id });
        return st;
    });
    const doc = { type: 'svg', animator: { timelines: [timeline], flowSteps: steps, actions } } as PxDocument;
    const plan = planUnits(doc);
    const unit = plan?.units[0];
    return { plan, unit, steps: unit && plan ? switchStepsOf(unit, plan, actions) : [] };
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

describe('flows — where a step goes on at its end (1.29: a `finished` entry)', () => {
    const entries: Array<PxActionTriggerRule> = [
        { action: PxTriggerList.startPlayback, event: 'click' },                                     // not a step's end
        { action: PxFlowAction.goTo, flowStep: 'c', event: PxStepEvent.finished, from: ['a', 'b'] },
        { action: PxFlowAction.next, event: PxStepEvent.finished },                                  // no `from`: any step
    ];

    it('the first entry whose `from` names the step; one with no `from` is every step\'s', () => {
        expect(atEndActionOf('a', entries)).toEqual({ action: PxFlowAction.goTo, flowStep: 'c' });
        expect(atEndActionOf('b', entries)).toEqual({ action: PxFlowAction.goTo, flowStep: 'c' });
        expect(atEndActionOf('c', entries)).toEqual({ action: PxFlowAction.next });
    });

    it('no entry for the step — it holds (undefined)', () => {
        expect(atEndActionOf('a', [entries[0]])).toBeUndefined();
        expect(atEndActionOf('a', undefined)).toBeUndefined();
    });
});

describe('flows — the ids a go-to may use (PX1114)', () => {
    // 1.29: a step's end is an entry (`finished`, `from`) — the issue names that step
    it('reports an event\'s go-to and a step\'s end that name no step; the known ones and the other entries pass', () => {
        const issues = flowStepReferenceIssues({
            flowSteps: [{ id: 'intro' }, { id: 'loop' }],
            actions: [
                { action: PxTriggerList.startPlayback, event: 'load' },
                { action: PxFlowAction.goTo, flowStep: 'loop', event: 'click' },
                { action: PxFlowAction.goTo, flowStep: 'sucess', event: 'click' },
                { action: PxFlowAction.goTo, flowStep: 'lop', event: PxStepEvent.finished, from: 'intro' },
            ],
        });
        expect(issues).toEqual([
            { target: 'sucess', ids: ['intro', 'loop'] },
            { target: 'lop', flowStep: 'intro', ids: ['intro', 'loop'] },
        ]);
    });
});

describe('flows — a `from` that names no step (PX1114, 1.29)', () => {
    it('each unknown id of a `from` is reported; the known ones and a timeline\'s own step pass', () => {
        const issues = flowStepReferenceIssues({
            flowSteps: [{ id: 'intro' }],
            actions: [
                { action: PxTriggerList.pausePlayback, event: 'click', from: ['intro', 'gone'] },
                { action: PxFlowAction.next, event: PxStepEvent.finished, from: 'hover' },
            ],
        }, ['hover']);
        expect(issues).toEqual([{ target: 'gone', ids: ['intro', 'hover'] }]);
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
