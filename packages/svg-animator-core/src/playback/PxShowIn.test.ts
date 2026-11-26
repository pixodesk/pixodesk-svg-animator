/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// `effects.show` (1.31; `showIn` until 1.33) — the rule, the steps current now, and the lowering that keeps it.

import { describe, expect, it } from 'vitest';
import type { PxDocument, PxNode } from '../format/PxAnimatorTypes';
import { materializeNodeEffects } from '../effects/PlayerEffectsUtil';
import { currentFlowStepsOf, isShownIn, showInTargetsOf, showOneOfTargetsOf, shownOptionOf } from './PxShowIn';
import { planUnits } from './PxUnits';

const DOC: PxDocument = {
    type: 'svg',
    animator: {
        timelines: [{ outTime: 2000 }, { id: 'l', outTime: 2000 }],
        flowSteps: [
            { id: 'a', segment: { inTime: 0, outTime: 1000 } }, { id: 'b', segment: { inTime: 1000, outTime: 2000 } },
            { id: 'off', flow: 'lamp', segment: { timeline: 'l', inTime: 0, outTime: 1000 } }, { id: 'on', flow: 'lamp', segment: { timeline: 'l', inTime: 1000, outTime: 2000 } },
        ],
        flows: [{ id: 'default', initialFlowStep: 'b' }, { id: 'lamp' }],
        bindings: [{ element: '#pre', animateWith: [], show: { when: { flowSteps: ['on'] } } }],
    },
    children: [
        { type: 'g', id: 'g1', effects: { show: { when: { flowSteps: ['a'] } } }, children: [
            { type: 'rect', id: 'r1', effects: { show: { when: { flowSteps: ['b', 'on'] } } } },
        ] },
        { type: 'rect', effects: { show: { when: { flowSteps: ['a'] } } } },   // no id: the lowering gives it one
    ],
};

describe('effects.show (1.31; `showIn` until 1.33) — the rule', () => {
    it('shown while any listed step is current; an empty list — always', () => {
        expect(isShownIn(['a', 'on'], new Set(['b', 'on']))).toBe(true);
        expect(isShownIn(['a'], new Set(['b', 'off']))).toBe(false);
        expect(isShownIn([], new Set())).toBe(true);
    });

    it('the steps current now: each flow\'s own, else its start (`initialFlowStep`, else the first)', () => {
        const all = planUnits(DOC);
        if (!all) throw new Error('no plan');
        expect([...currentFlowStepsOf(all, new Map())].sort()).toEqual(['b', 'off']);
        expect([...currentFlowStepsOf(all, new Map([['lamp', 'on']]))].sort()).toEqual(['b', 'on']);
    });

    it('the elements that say it: the tree\'s nodes with an id, then the bindings (bare ids)', () => {
        expect(showInTargetsOf(DOC).map(t => t.id + ':' + t.flowSteps.join('+'))).toEqual(['g1:a', 'r1:b+on', 'pre:on']);
    });

    it('the lowering keeps it on the node — the one effect it keeps — and gives a node with no id one', () => {
        const out = materializeNodeEffects(DOC).root;
        const kids = (out.children ?? []) as Array<PxNode>;
        expect(kids[0].effects).toEqual({ show: { when: { flowSteps: ['a'] } } });
        expect(kids[0].id).toBe('g1');
        expect(typeof kids[1].id).toBe('string');
        expect(kids[1].effects).toEqual({ show: { when: { flowSteps: ['a'] } } });
        expect(showInTargetsOf(out as PxDocument).length).toBe(4);
    });
});

describe('effects.showOneChild (1.32; `showOneOf` until 1.33) — the rule and the lowering', () => {
    it('a position, rounded down; out of range or absent — none (an absent `when.index` is read as 0 before)', () => {
        expect(shownOptionOf(1, 3)).toBe(1);
        expect(shownOptionOf(2.9, 3)).toBe(2);
        expect(shownOptionOf(3, 3)).toBeUndefined();
        expect(shownOptionOf(-1, 3)).toBeUndefined();
        expect(shownOptionOf(undefined, 3)).toBeUndefined();
    });

    it('the lowering keeps it on the group with its children as options — each child given an id', () => {
        const doc: PxDocument = { type: 'svg', children: [
            { type: 'g', id: 'g', effects: { showOneChild: { when: { index: 1 } } }, children: [{ type: 'rect', id: 'a' }, { type: 'rect' }] },
        ] };
        const out = materializeNodeEffects(doc).root;
        const g = (out.children ?? [])[0];
        const options = g.effects?.showOneChild?.options ?? [];
        expect(g.effects?.showOneChild?.when?.index).toBe(1);
        expect(options[0]).toEqual({ element: '#a' });
        expect(options[1].element).toBe('#' + String((g.children ?? [])[1].id));
        expect(showOneOfTargetsOf(out as PxDocument)).toEqual([{ which: 1, options: ['a', String((g.children ?? [])[1].id)] }]);
    });
});
