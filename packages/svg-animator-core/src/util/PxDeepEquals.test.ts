import { describe, expect, it } from 'vitest';
import { deepEquals } from './PxDeepEquals';

describe('deepEquals', () => {

    it('primitives and null compare by value', () => {
        expect(deepEquals(1, 1)).toBe(true);
        expect(deepEquals('a', 'a')).toBe(true);
        expect(deepEquals(null, null)).toBe(true);
        expect(deepEquals(1, '1')).toBe(false);
        expect(deepEquals(null, {})).toBe(false);
        expect(deepEquals(undefined, null)).toBe(false);
    });

    it('a re-created document with the same content is equal, key order ignored', () => {
        const make = () => ({ type: 'svg', children: [{ type: 'rect', animate: { opacity: { keyframes: [{ time: 0, value: 1 }] } } }] });
        expect(deepEquals(make(), make())).toBe(true);
        expect(deepEquals({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    });

    it('a changed value, a missing key or a different length is not equal', () => {
        expect(deepEquals({ a: 1 }, { a: 2 })).toBe(false);
        expect(deepEquals({ a: 1 }, { a: 1, b: undefined })).toBe(false);
        expect(deepEquals({ a: undefined }, { b: undefined })).toBe(false);
        expect(deepEquals([1, 2], [1, 2, 3])).toBe(false);
        expect(deepEquals([1], { 0: 1 })).toBe(false);
    });

    // A document built in a render that reuses ONE object in two places (the same keyframes on two
    // elements). The old guard marked every object it had seen and threw on the second visit.
    it('an object reused in two places is compared, not mistaken for a cycle', () => {
        const make = () => {
            const fade = { keyframes: [{ time: 0, value: 0 }, { time: 500, value: 1 }] };
            return { children: [{ animate: { opacity: fade } }, { animate: { opacity: fade } }] };
        };
        expect(deepEquals(make(), make())).toBe(true);
    });

    it('a true cycle throws', () => {
        const a: { self?: unknown } = {};
        a.self = a;
        const b: { self?: unknown } = {};
        b.self = b;
        expect(() => deepEquals(a, b)).toThrow('Circular reference detected');
    });
});
