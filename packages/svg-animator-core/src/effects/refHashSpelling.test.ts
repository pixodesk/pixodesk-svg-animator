/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// Ref-spelling normalisation (SCHEMA-DESIGN §4 E-5): the canonical wire form of
// every element reference is `#id`; bare `id` is legacy and must keep working.
// Each applier that consumes a ref reads through `stripHash`, so both spellings
// materialise identically.

import { describe, expect, it } from 'vitest';
import type { PxNode } from '../PxAnimatorTypes';
import { generateNewIds } from '../PxIdUtil';
import { collectByType, materialise } from './effectTestKit';

const REF_FORMS: Array<{ name: string; ref: (id: string) => string }> = [
    { name: 'canonical #id', ref: id => '#' + id },
    { name: 'legacy bare id', ref: id => id },
];

describe('ref spelling — #id canonical, bare legacy', () => {

    for (const form of REF_FORMS) {
        it(`clone.sourceId (${form.name}) → <use> href resolves`, () => {
            const out = materialise({
                type: 'svg', children: [
                    { type: 'rect', id: 'src', width: 10, height: 10 },
                    { type: 'use', href: '#whatever', effects: { clone: { type: 'content', sourceId: form.ref('src') } } },
                ],
            } as unknown as PxNode);
            const use = collectByType(out, 'use')[0] as any;
            // content-ref rewrites href to the allocated inner-content id of `src`
            expect(use.href.startsWith('#')).toBe(true);
            expect(use.href).not.toBe('#whatever');
        });

        it(`maskedBy.href (${form.name}) → mask def references the source`, () => {
            const out = materialise({
                type: 'svg', children: [
                    { type: 'circle', id: 'msrc', r: 5 },
                    { type: 'rect', width: 10, height: 10, effects: { maskedBy: { sourceId: form.ref('msrc') } } },
                ],
            } as unknown as PxNode);
            const mask = collectByType(out, 'mask')[0] as any;
            const use = collectByType(mask, 'use')[0] as any;
            expect(use.href).toBe('#msrc');
        });
    }

    it('generateNewIds rewrites a #id sourceId preserving the hash spelling', () => {
        const doc = {
            type: 'svg', children: [
                { type: 'rect', id: 'src', width: 10, height: 10 },
                { type: 'use', href: '#src', effects: { clone: { sourceId: '#src' } } },
            ],
        } as any;
        const regenerated = generateNewIds(doc) as any;
        const use = regenerated.children[1];
        const newSrcId = regenerated.children[0].id;
        expect(newSrcId).not.toBe('src');
        expect(use.effects.clone.sourceId).toBe('#' + newSrcId);
    });

    it('generateNewIds keeps rewriting a legacy bare sourceId (spelling preserved)', () => {
        const doc = {
            type: 'svg', children: [
                { type: 'rect', id: 'src', width: 10, height: 10 },
                { type: 'use', href: '#src', effects: { clone: { sourceId: 'src' } } },
            ],
        } as any;
        const regenerated = generateNewIds(doc) as any;
        const newSrcId = regenerated.children[0].id;
        expect(regenerated.children[1].effects.clone.sourceId).toBe(newSrcId);
    });
});
