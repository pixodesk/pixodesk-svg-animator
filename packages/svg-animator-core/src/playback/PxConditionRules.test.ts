/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// `when.condition` (1.33, D5) in the core: the entries with no triggers the engines watch, how a unit gets its share, and
// when a condition holds.

import { describe, expect, it } from 'vitest';
import type { PxActions, PxDocument } from '../format/PxAnimatorTypes';
import { actionRulesOf, conditionEntryOf, conditionRulesOf, getAnimatorConfig } from '../format/PxAnimatorConstants';
import { isConditionTrue } from '../variables/PxFormula';
import { planUnits, unitConfigOf } from './PxUnits';

const ENTRIES: PxActions = [
    { name: 'timeline.start', triggers: [{ event: 'load' }] },
    { name: 'flow.goTo', with: { flowStep: 'done', whenLeaving: 'animateToEnd' }, when: { flowSteps: ['loading'], condition: 'calc(var(progress) >= 1)' } },
    { name: 'flow.goTo', with: { flowStep: 'done' }, triggers: [{ event: 'click' }], when: { condition: 'var(unlocked)' } },
    { name: 'flow.next' },
];

describe('condition rules (1.33)', () => {
    it('only an entry with no triggers and a condition is watched; it goes back to the same entry', () => {
        const rules = conditionRulesOf(ENTRIES);
        expect(rules).toEqual([{ action: 'flow.goTo', flowStep: 'done', from: ['loading'], behavior: 'animateToEnd', condition: 'calc(var(progress) >= 1)' }]);
        expect(conditionEntryOf(rules[0])).toEqual({ ...ENTRIES[1], triggers: [] });
        // the one with a trigger is a flat rule, its condition on it
        expect(actionRulesOf(ENTRIES).map(r => r.condition)).toEqual([undefined, 'var(unlocked)']);
    });

    it('a unit gets the watched entries of its own steps', () => {
        const doc: PxDocument = {
            type: 'svg',
            animator: {
                timelines: [{ outTime: 3000 }],
                flowSteps: [{ id: 'idle', segment: { inTime: 0, outTime: 1000 } }, { id: 'loading', segment: { inTime: 1000, outTime: 2000 } },
                    { id: 'done', segment: { inTime: 2000, outTime: 3000 } }],
                actions: ENTRIES,
            },
        };
        const plan = planUnits(doc);
        const unit = plan?.units[0];
        expect(plan && unit ? getAnimatorConfig(unitConfigOf(doc, unit, plan))?.conditionRules : undefined)
            .toEqual([{ action: 'flow.goTo', flowStep: 'done', from: ['loading'], behavior: 'animateToEnd', condition: 'calc(var(progress) >= 1)' }]);
    });

    it('a condition holds only when it gives true', () => {
        const read = (name: string): number | boolean | undefined => name === 'progress' ? 1 : name === 'unlocked' ? true : name === 'count' ? 3 : undefined;
        expect(isConditionTrue('var(unlocked)', read)).toBe(true);
        expect(isConditionTrue('calc(var(progress) >= 1)', read)).toBe(true);
        expect(isConditionTrue('calc(var(progress) < 1)', read)).toBe(false);
        expect(isConditionTrue('var(count)', read)).toBe(false);      // a number is not true
        expect(isConditionTrue('var(missing)', read)).toBe(false);
        expect(isConditionTrue('calc(1 >', read)).toBe(false);         // does not parse
    });
});
