import { describe, expect, it } from 'vitest';
import type { PxInfer } from './PxSchema';
import { px } from './PxSchema';
import { PxPropertyAnimationSchema } from './PxAnimatorTypes';

/**
 * Q1 regression — a union must keep EVERY member in its inferred type, including
 * the bare-static ones.
 *
 * `px.union` / `px.discriminatedUnion` declare their schema list as `const T`. Drop
 * that modifier and TS infers a plain ARRAY, unifies the element type to a single
 * `PxSchema<…>`, and `UnionMembers` then has one member to map — the union collapses
 * to whichever branch won unification (in practice the last object branch). The bare
 * statics vanish from BOTH the source-level type and the emitted `.d.ts`, so the
 * published types reject legal wire values (`translate: [100, 100]` on an animatable
 * slot). The assignments below are the real assertion: they stop compiling if the
 * modifier is ever removed.
 */
describe('union type inference keeps every member (Q1)', () => {

    const ANIMATABLE_VEC2 = px.union([
        px.tuple([px.number(), px.number()] as const),
        px.object({ value: px.tuple([px.number(), px.number()] as const) }),
        PxPropertyAnimationSchema,
    ]);

    it('the bare-static branch survives inference — compile-time assertion', () => {
        // Each spelling of the same animatable value must satisfy the inferred type.
        const bare: PxInfer<typeof ANIMATABLE_VEC2> = [100, 100];
        const structured: PxInfer<typeof ANIMATABLE_VEC2> = { value: [100, 100] };
        const animated: PxInfer<typeof ANIMATABLE_VEC2> = {
            keyframes: [{ time: 0, value: [0, 0] }, { time: 1000, value: [100, 100] }],
        };
        expect([bare, structured, animated]).toHaveLength(3);
    });

    it('…and validation accepts all three at runtime', () => {
        for (const raw of [[100, 100], { value: [100, 100] }, { keyframes: [{ time: 0, value: [0, 0] }] }]) {
            expect(ANIMATABLE_VEC2.isValid(raw), JSON.stringify(raw)).toBe(true);
        }
    });

    it('a bare primitive survives alongside an object branch', () => {
        const S = px.union([px.number(), px.object({ value: px.number() })]);
        const n: PxInfer<typeof S> = 42;
        const o: PxInfer<typeof S> = { value: 42 };
        expect([n, o]).toHaveLength(2);
    });

});
