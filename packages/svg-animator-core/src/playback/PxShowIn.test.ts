/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// `effects.showIn` (1.31) — the rule, the steps current now, and the lowering that keeps it.

import { describe, expect, it } from 'vitest';
import type { PxDocument, PxNode } from '../format/PxAnimatorTypes';
import { materializeNodeEffects } from '../effects/PlayerEffectsUtil';
import { currentFlowStepsOf, isShownIn, showInTargetsOf } from './PxShowIn';
import { planUnits } from './PxUnits';

const DOC: PxDocument = {
    type: 'svg',
    animator: {
        timelines: [{ outTime: 2000 }, { id: 'l', outTime: 2000 }],
        flowSteps: [
            { id: 'a', inTime: 0, outTime: 1000 }, { id: 'b', inTime: 1000, outTime: 2000, initial: true },
            { id: 'off', flow: 'lamp', timeline: 'l', inTime: 0, outTime: 1000 }, { id: 'on', flow: 'lamp', timeline: 'l', inTime: 1000, outTime: 2000 },
        ],
        flows: [{ id: 'lamp' }],
        bindings: [{ element: '#pre', animateWith: [], showIn: { flowSteps: ['on'] } }],
    },
    children: [
        { type: 'g', id: 'g1', effects: { showIn: { flowSteps: ['a'] } }, children: [
            { type: 'rect', id: 'r1', effects: { showIn: { flowSteps: ['b', 'on'] } } },
        ] },
        { type: 'rect', effects: { showIn: { flowSteps: ['a'] } } },   // no id: the lowering gives it one
    ],
};

describe('effects.showIn (1.31) — the rule', () => {
    it('shown while any listed step is current; an empty list — always', () => {
        expect(isShownIn(['a', 'on'], new Set(['b', 'on']))).toBe(true);
        expect(isShownIn(['a'], new Set(['b', 'off']))).toBe(false);
        expect(isShownIn([], new Set())).toBe(true);
    });

    it('the steps current now: each flow\'s own, else its start (`initial`, else the first)', () => {
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
        expect(kids[0].effects).toEqual({ showIn: { flowSteps: ['a'] } });
        expect(kids[0].id).toBe('g1');
        expect(typeof kids[1].id).toBe('string');
        expect(kids[1].effects).toEqual({ showIn: { flowSteps: ['a'] } });
        expect(showInTargetsOf(out as PxDocument).length).toBe(4);
    });
});
