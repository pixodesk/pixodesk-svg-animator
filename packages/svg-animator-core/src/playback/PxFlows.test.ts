/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// Flows (2026-11-22; states 11-20, segments 11-15) — the platform-neutral half: the steps as a flow plays them, checking
// the ids, the rules' repair.

import { describe, expect, it } from 'vitest';
import { PxActionsSchema, PxFlowStepTimelineOptionsSchema, type PxActionObject, type PxActionRule, type PxDocument, type PxFlowStep } from '../format/PxAnimatorTypes';
import { PxFlowAction, PxStepEvent, PxTriggerList, PxWhenFinished, PxWhenLeaving, actionEntryOf, actionRulesOf } from '../format/PxAnimatorConstants';
import { atEndActionOf, duplicateFlowStepIds, flowStepReferenceIssues } from './PxFlows';
import { planUnits, switchStepsOf } from './PxUnits';

// 1.29: a step's "at its end, go there" is an entry of `actions` (`flowStep.finished`, `when.flowSteps`) — the helper takes
// it on the step as `atEnd`, as the tests read it, and writes it as the file has it.
type TestStep = PxFlowStep & { atEnd?: PxActionObject };

/** A one-timeline document (0…3000 ms) with these steps — and the steps of its one flow as the switch reads them. */
function flowOf(testSteps: Array<TestStep>, timeline: Record<string, unknown> = { outTime: 3000 }) {
    const rules: Array<PxActionRule> = [];
    const steps = testSteps.map(({ atEnd, ...st }): PxFlowStep => {
        if (atEnd !== undefined) rules.push({ ...atEnd, event: PxStepEvent.finished, from: [st.id] });
        return st;
    });
    const doc = { type: 'svg', animator: { timelines: [timeline], flowSteps: steps, actions: rules.map(actionEntryOf) } } as PxDocument;
    const plan = planUnits(doc);
    const unit = plan?.units[0];
    return { plan, unit, steps: unit && plan ? switchStepsOf(unit, plan, rules) : [] };
}

describe('flows — the steps as a flow plays them', () => {
    it('in LIST order — not by their place on the timeline — with the defaults stated', () => {
        const { unit, steps } = flowOf([
            { id: 'late', timelineOptions: { inTime: 2000, outTime: 3000 } },
            { id: 'early', timelineOptions: { inTime: 0, outTime: 1000, iterations: 'infinite' }, atEnd: { action: PxFlowAction.next } },
        ]);
        expect(steps.map(s => s.id)).toEqual(['late', 'early']);   // `next` from `late` goes to `early`
        expect(unit?.steps.map(s => s.step.inTime)).toEqual([2000, 0]);
        expect(steps[0]).toMatchObject({ whenLeaving: PxWhenLeaving.jump, initial: false, endless: false });
        expect(steps[1]).toMatchObject({ then: { step: 1 }, endless: true });
    });

    it('an id used twice: the first wins, the later is reported (PX1115)', () => {
        const cfg = { flowSteps: [{ id: 'a', timelineOptions: { inTime: 0, outTime: 1000 } }, { id: 'a', timelineOptions: { inTime: 1000, outTime: 2000 } }, { id: 'b' }] };
        const { unit } = flowOf(cfg.flowSteps);
        expect(unit?.steps.map(s => [s.id, s.step.inTime])).toEqual([['a', 0], ['b', undefined]]);
        expect(duplicateFlowStepIds(cfg.flowSteps)).toEqual(['a']);
        expect(duplicateFlowStepIds([{ id: 'a' }, { id: 'b' }])).toEqual([]);
    });

    it('a go-to names its step; a go-to to nothing reads as hold; previous steps back', () => {
        const [a, b, c] = flowOf([
            { id: 'a', timelineOptions: { inTime: 0, outTime: 1000 }, atEnd: { action: PxFlowAction.goTo, flowStep: 'b' } },
            { id: 'b', timelineOptions: { inTime: 1000, outTime: 2000 }, atEnd: { action: PxFlowAction.goTo, flowStep: 'nope' } },
            { id: 'c', timelineOptions: { inTime: 2000, outTime: 3000 }, atEnd: { action: PxFlowAction.previous } },
        ]).steps;
        expect(a.then).toEqual({ flowStep: 'b' });
        expect(b.then).toBeUndefined();
        expect(c.then).toEqual({ step: -1 });
    });

    it('a scroll timeline: a part of it is no step; the whole of it is one (2026-11-22)', () => {
        const scroll = { type: 'scroll', outTime: 1000 };
        // a part of a scroll timeline is not read — the timeline is then alone, as it plays today: no plan
        expect(flowOf([{ id: 'a', timelineOptions: { inTime: 0, outTime: 500 } }], scroll).plan).toBeUndefined();
        // the whole of it is a step, and the flow is moved by the scrolling
        const whole = flowOf([{ id: 'a' }], scroll);
        expect(whole.unit?.steps.map(s => s.id)).toEqual(['a']);
        expect(whole.unit?.scroll).toBe(true);
    });

    // 1.33: `isFlowActionObject` is gone — a step's end is a flow action's rule; its `whenFinished` a picture word only
    it('an action object is told from a picture word', () => {
        const atEnd = (name: PxFlowAction | PxTriggerList) => actionRulesOf([{ name, triggers: [{ event: PxStepEvent.finished }] }]);
        expect(atEndActionOf('a', atEnd(PxFlowAction.next))).toEqual({ action: PxFlowAction.next });
        expect(atEndActionOf('a', atEnd(PxTriggerList.startPlayback))).toBeUndefined();
        expect(PxFlowStepTimelineOptionsSchema.isValid({ whenFinished: PxWhenFinished.hold })).toBe(true);
        expect(PxFlowStepTimelineOptionsSchema.isValid({ whenFinished: { action: PxFlowAction.next } })).toBe(false);
    });
});

describe('flows — where a step goes on at its end (1.29: a `flowStep.finished` entry)', () => {
    const entries = actionRulesOf([
        { name: PxTriggerList.startPlayback, triggers: [{ event: 'click' }] },                                                    // not a step's end
        { name: PxFlowAction.goTo, with: { flowStep: 'c' }, triggers: [{ event: PxStepEvent.finished }], when: { flowSteps: ['a', 'b'] } },
        { name: PxFlowAction.next, triggers: [{ event: PxStepEvent.finished }] },                                                 // no `when`: any step
    ]);

    it('the first entry whose `when.flowSteps` names the step; one with none is every step\'s', () => {
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
    // 1.29: a step's end is an entry (`flowStep.finished`, `when.flowSteps`) — the issue names that step
    it('reports an event\'s go-to and a step\'s end that name no step; the known ones and the other entries pass', () => {
        const issues = flowStepReferenceIssues({
            flowSteps: [{ id: 'intro' }, { id: 'loop' }],
            actionRules: actionRulesOf([
                { name: PxTriggerList.startPlayback, triggers: [{ event: 'load' }] },
                { name: PxFlowAction.goTo, with: { flowStep: 'loop' }, triggers: [{ event: 'click' }] },
                { name: PxFlowAction.goTo, with: { flowStep: 'sucess' }, triggers: [{ event: 'click' }] },
                { name: PxFlowAction.goTo, with: { flowStep: 'lop' }, triggers: [{ event: PxStepEvent.finished }], when: { flowSteps: ['intro'] } },
            ]),
        });
        expect(issues).toEqual([
            { target: 'sucess', ids: ['intro', 'loop'] },
            { target: 'lop', flowStep: 'intro', ids: ['intro', 'loop'] },
        ]);
    });
});

describe('flows — a `when.flowSteps` that names no step (PX1114, 1.29)', () => {
    it('each unknown id of a `when.flowSteps` is reported; the known ones and a timeline\'s own step pass', () => {
        const issues = flowStepReferenceIssues({
            flowSteps: [{ id: 'intro' }],
            actionRules: actionRulesOf([
                { name: PxTriggerList.pausePlayback, triggers: [{ event: 'click' }], when: { flowSteps: ['intro', 'gone'] } },
                { name: PxFlowAction.next, triggers: [{ event: PxStepEvent.finished }], when: { flowSteps: ['hover'] } },
            ]),
        }, ['hover']);
        expect(issues).toEqual([{ target: 'gone', ids: ['intro', 'hover'] }]);
    });
});

describe('rules — the repair drops a rule that does not fit, rule by rule', () => {
    it('a rule with an unknown action or event is dropped; a good rule stays as written', () => {
        const good = [
            { name: 'timeline.start', triggers: [{ event: 'load' }] },
            { name: 'timeline.start', triggers: [{ event: 'click', selector: '.go', with: { metaOrCtrlKey: true } }] },
        ];
        const fixed = PxActionsSchema.castOrFix([good[0], { name: 'timeline.jump', triggers: [{ event: 'click' }] }, good[1], { name: 'timeline.start', triggers: [{ event: 'wave' }] }]);
        // the good entries as written; the unknown event heard nowhere
        expect(fixed.value.filter(e => e.triggers?.length)).toEqual(good);
        expect(actionRulesOf(fixed.value)).toEqual([
            { action: 'timeline.start', event: 'load' },
            { action: 'timeline.start', event: 'click', selector: '.go', with: { metaOrCtrlKey: true } },
        ]);
        expect(fixed.problems.length).toBe(2);
    });

    it('a state action takes any event and names its state', () => {
        const entries = [
            { name: PxFlowAction.next, triggers: [{ event: 'keyDown', with: { key: 'ArrowRight' } }] },
            { name: PxFlowAction.goTo, with: { flowStep: 'b' }, triggers: [{ event: 'pointerUp' }] },
        ];
        const fixed = PxActionsSchema.castOrFix(entries);
        expect(fixed.value).toEqual(entries);
        expect(fixed.problems).toEqual([]);
    });
});
