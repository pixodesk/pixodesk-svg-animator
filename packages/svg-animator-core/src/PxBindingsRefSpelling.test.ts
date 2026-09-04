/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// Reference spelling (review §3.2): EVERY element reference is `#id`-spelled —
// record keys included. `animator.animateById` keys carry the hash on the wire;
// consumers get bare DOM ids.

import { describe, expect, it } from 'vitest';
import { getBindings } from './PxAnimatorConstants';
import { generateNewIds } from './PxIdUtil';

describe('animateById — #id-spelled keys (review §3.2)', () => {

    it('getBindings strips the hash — binding ids are bare DOM ids', () => {
        const bindings = getBindings({
            type: 'svg',
            animator: { animateById: { '#ball': 'fadeIn' } },
        } as never);
        expect(bindings).toEqual([{ id: 'ball', animate: 'fadeIn' }]);
    });

    it('generateNewIds rewrites a hashed key and keeps its spelling', () => {
        const out: any = generateNewIds({
            type: 'svg',
            children: [{ type: 'rect', id: 'ball' }],
            animator: { animateById: { '#ball': 'fadeIn' } },
        } as never);
        const keys = Object.keys(out.animator.animateById);
        expect(keys).toHaveLength(1);
        expect(keys[0].startsWith('#')).toBe(true);
        expect(keys[0].slice(1)).toBe(out.children[0].id); // still points at the (renamed) element
    });
});
