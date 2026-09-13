/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// Reference spelling (review §3.2): EVERY element reference is `#id`-spelled. A binding's
// `target` carries the hash on the wire; the engines get bare DOM ids (review 2.12).

import { describe, expect, it } from 'vitest';
import { getBindings } from './PxAnimatorConstants';
import { normalizeBindings } from '../animation/PxDefinitions';
import { generateNewIds } from '../util/PxIdUtil';

const doc = () => ({
    type: 'svg',
    children: [{ type: 'rect', id: 'ball' }],
    animator: {
        definitions: { animations: { fadeIn: { opacity: { keyframes: [{ time: 0, value: 0 }, { time: 1000, value: 1 }] } } } },
        bindings: [{ target: '#ball', animateWith: ['fadeIn'] }],
    },
} as never);

describe('bindings — #id-spelled targets (review §3.2, 2.12)', () => {

    it('getBindings returns the list as written — the target keeps its hash', () => {
        expect(getBindings(doc())).toEqual([{ target: '#ball', animateWith: ['fadeIn'] }]);
    });

    it('normalizeBindings resolves the names and strips the hash — engines get bare DOM ids', () => {
        const [binding] = normalizeBindings(doc());
        expect(binding.id).toBe('ball');
        expect(Object.keys(binding.animate)).toEqual(['opacity']);
    });

    it('generateNewIds rewrites a hashed target and keeps its spelling', () => {
        const out: any = generateNewIds(doc());
        expect(out.animator.bindings).toHaveLength(1);
        const target: string = out.animator.bindings[0].target;
        expect(target.startsWith('#')).toBe(true);
        expect(target.slice(1)).toBe(out.children[0].id); // still points at the (renamed) element
        expect(out.animator.bindings[0].animateWith).toEqual(['fadeIn']);
    });
});
