/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// Union failures name the bad key (review §2.8).
//
// A failed union used to report ONE line — "no union member matched for value {…}" — which
// read the same for a `keyframes`/`keyframe` typo, for short `t`/`v` keys and for a plain
// type mismatch. The headline stays (consumers match on it), and after it the union now
// reports the member that got FURTHEST into the value, so the offending key is named.

import { describe, expect, it } from 'vitest';
import { px, type PxValidationContext } from './PxSchema';

const ctx = (): PxValidationContext => ({ errors: [], warnings: [], strict: true });

/** `value` is either a plain number or a keyframed object — a shape this format uses a lot. */
const ANIMATABLE = px.union([
    px.number(),
    px.object({ keyframes: px.array(px.object({ time: px.number(), value: px.number() })) }),
]);

describe('union failure — names the offending key, not just "no member matched" (§2.8)', () => {

    it('keeps the headline consumers match on', () => {
        const c = ctx();
        ANIMATABLE.isValid({ keyframe: [] }, c, ['opacity']);
        expect(c.errors[0]).toContain('no union member matched');
        expect(c.errors[0]).toContain('opacity');
    });

    it('names the typo`d key from the member that got furthest in', () => {
        const c = ctx();
        // `keyframe` should be `keyframes` — the object member descends and reports it.
        ANIMATABLE.isValid({ keyframe: [{ time: 0, value: 1 }] }, c, ['opacity']);
        const joined = c.errors.join('\n');
        expect(joined).toContain('opacity.keyframe');
        expect(c.errors.length).toBeGreaterThan(1);   // headline + the diagnosis
    });

    it('points INSIDE the member, at the deepest thing that is wrong', () => {
        const c = ctx();
        // Right shape, wrong leaf type — the error must carry the leaf's own path.
        ANIMATABLE.isValid({ keyframes: [{ time: 0, value: 'nope' }] }, c, ['opacity']);
        const joined = c.errors.join('\n');
        expect(joined).toContain('opacity.keyframes[0].value');
        expect(joined).toContain('expected finite number');
    });

    it('folds the alternatives into ONE line when nothing descended', () => {
        const c = ctx();
        // A boolean matches no member and cannot descend: report what the slot accepts,
        // once — not one "expected …" line per alternative.
        ANIMATABLE.isValid(true, c, ['opacity']);
        const folded = c.errors.filter(e => e.includes('expected') && e.includes('|'));
        expect(folded).toHaveLength(1);
        expect(folded[0]).toContain('finite number');
        expect(folded[0]).toContain('object');
    });

    it('stays quiet when a member matches', () => {
        const c = ctx();
        expect(ANIMATABLE.isValid({ keyframes: [{ time: 0, value: 1 }] }, c, ['opacity'])).toBe(true);
        expect(c.errors).toEqual([]);
        expect(ANIMATABLE.isValid(5, c, ['opacity'])).toBe(true);
        expect(c.errors).toEqual([]);
    });

    it('does not flood: a big union appends a bounded number of lines', () => {
        const big = px.union([
            px.string(), px.number(), px.boolean(), px.array(px.number()),
            px.object({ a: px.number() }), px.object({ b: px.number() }),
            px.object({ nested: px.object({ deep: px.object({ leaf: px.number() }) }) }),
        ]);
        const c = ctx();
        big.isValid({ nested: { deep: { leaf: 'no' } } }, c, ['slot']);
        expect(c.errors.length).toBeLessThanOrEqual(6);
        expect(c.errors.join('\n')).toContain('slot.nested.deep.leaf');
    });
});
