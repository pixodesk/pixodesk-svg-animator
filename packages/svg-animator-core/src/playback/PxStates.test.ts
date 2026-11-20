/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// States (2026-11-20; segments 2026-11-15) — the platform-neutral half: reading them, checking the ids, the rules' repair.

import { describe, expect, it } from 'vitest';
import { PxActionTriggersSchema } from '../format/PxAnimatorTypes';
import { PxStateAction, PxTriggerList, PxWhenFinished, PxWhenLeaving } from '../format/PxAnimatorConstants';
import { duplicateStateIds, isStateActionObject, resolveStates, stateReferenceIssues } from './PxStates';

describe('states — resolveStates', () => {
    it('in LIST order — not by their place on the timeline — with the defaults stated', () => {
        const states = resolveStates({
            inTime: 0, duration: 3000,
            states: [
                { id: 'late', inTime: 2000, outTime: 3000 },
                { id: 'early', inTime: 0, outTime: 1000, whenFinished: { action: PxStateAction.next }, iterations: 'infinite' },
            ],
        });
        expect(states.map(s => s.id)).toEqual(['late', 'early']);   // `next` from `late` goes to `early`
        expect(states[0]).toMatchObject({ startMs: 2000, passMs: 1000, iterations: 1, speed: 1, whenLeaving: PxWhenLeaving.jump, initial: false });
        expect(states[1]).toMatchObject({ startMs: 0, passMs: 1000, iterations: Infinity, then: { step: 1 }, whenFinished: PxWhenFinished.hold });
    });

    it('an id used twice: the first wins, the later is reported (PX1115)', () => {
        const cfg = { duration: 2000, states: [{ id: 'a', inTime: 0, outTime: 1000 }, { id: 'a', inTime: 1000, outTime: 2000 }, { id: 'b' }] };
        expect(resolveStates(cfg).map(s => [s.id, s.startMs])).toEqual([['a', 0], ['b', 0]]);
        expect(duplicateStateIds(cfg.states)).toEqual(['a']);
        expect(duplicateStateIds([{ id: 'a' }, { id: 'b' }])).toEqual([]);
    });

    it('a go-to names its state; a go-to to nothing reads as hold; previous steps back', () => {
        const [a, b, c] = resolveStates({
            duration: 3000,
            states: [
                { id: 'a', inTime: 0, outTime: 1000, whenFinished: { action: PxStateAction.goTo, state: 'b' } },
                { id: 'b', inTime: 1000, outTime: 2000, whenFinished: { action: PxStateAction.goTo, state: 'nope' } },
                { id: 'c', inTime: 2000, outTime: 3000, whenFinished: { action: PxStateAction.previous } },
            ],
        });
        expect(a.then).toEqual({ state: 'b' });
        expect(b.then).toBeUndefined();
        expect(c.then).toEqual({ step: -1 });
    });

    it('a scroll timeline has none', () => {
        expect(resolveStates({ timelineSource: 'scroll', duration: 1000, states: [{ id: 'a' }] })).toEqual([]);
    });

    it('an action object is told from a picture word', () => {
        expect(isStateActionObject({ action: PxStateAction.next })).toBe(true);
        expect(isStateActionObject(PxWhenFinished.hold)).toBe(false);
        expect(isStateActionObject({ action: PxTriggerList.startPlayback })).toBe(false);
    });
});

describe('states — the ids a go-to may use (PX1114)', () => {
    it('reports a rule and a whenFinished that name no state; the known ones and the other rules pass', () => {
        const issues = stateReferenceIssues({
            states: [{ id: 'intro', whenFinished: { action: PxStateAction.goTo, state: 'lop' } }, { id: 'loop' }],
            actionTriggers: [
                { action: PxTriggerList.startPlayback, event: 'load' },
                { action: PxStateAction.goTo, state: 'loop', event: 'click' },
                { action: PxStateAction.goTo, state: 'sucess', event: 'click' },
            ],
        });
        expect(issues).toEqual([
            { target: 'sucess', ids: ['intro', 'loop'] },
            { target: 'lop', state: 'intro', ids: ['intro', 'loop'] },
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
            { action: PxStateAction.next, event: 'keyDown', with: { key: 'ArrowRight' } },
            { action: PxStateAction.goTo, state: 'b', event: 'pointerUp' },
        ];
        const fixed = PxActionTriggersSchema.castOrFix(rules);
        expect(fixed.value).toEqual(rules);
        expect(fixed.problems).toEqual([]);
    });
});
