// The cast family + type stamps (dev-docs/plans/schema-cast-and-stamps.md):
// castOrFix validates and repairs in one visit into a NEW, stamped tree; every later `is` / `cast*`
// on that tree answers from the stamp without walking it.
import { describe, expect, it } from 'vitest';
import { px, PxSchemaCastError } from './PxSchema';
import { PxAnimatedSvgDocumentSchema, PxAnimationDefinitionSchema, PxKeyframeSchema, PxTransformPartsSchema } from '../format/PxAnimatorTypes';

const Point = px.object({ x: px.number(), y: px.number() });
const Shape = px.object({ name: px.string(), at: Point, tags: px.array(px.string()).optional() });

describe('schema casts', () => {
    it('is() narrows and rejects', () => {
        const raw: unknown = { x: 1, y: 2 };
        if (Point.is(raw)) expect(raw.x + raw.y).toBe(3);   // compiles only because is() narrows
        expect(Point.is({ x: 1 })).toBe(false);
    });

    it('cast() returns the value itself when valid and throws with the path when not', () => {
        const raw = { name: 'a', at: { x: 1, y: 2 } };
        expect(Shape.cast(raw)).toBe(raw);
        expect(() => Shape.cast({ name: 'a', at: { x: 'one', y: 2 } })).toThrow(PxSchemaCastError);
        try { Shape.cast({ name: 'a', at: { x: 'one', y: 2 } }); } catch (e) { expect(String((e as Error).message)).toContain('at.x'); }
    });

    it('castOrNull() returns the value or null', () => {
        expect(Point.castOrNull({ x: 1, y: 2 })).toEqual({ x: 1, y: 2 });
        expect(Point.castOrNull('nope')).toBeNull();
    });
});

describe('castOrFix — one visit, a new stamped tree', () => {
    it('builds a NEW tree and never touches the input', () => {
        const raw = { name: 'a', at: { x: 1, y: 2 }, tags: ['t'] };
        const before = JSON.stringify(raw);
        const { value, problems } = Shape.castOrFix(raw);
        expect(value).not.toBe(raw);
        expect(value.at).not.toBe(raw.at);
        expect(value).toEqual(raw);
        expect(problems).toEqual([]);
        expect(JSON.stringify(raw)).toBe(before);
        expect(Object.getOwnPropertySymbols(raw)).toEqual([]);           // input never stamped
        expect(Object.keys(value).sort()).toEqual(['at', 'name', 'tags']);   // stamp is invisible
    });

    it('a stamped value answers from the stamp — no walk (proved by a deliberate breach)', () => {
        const { value } = Shape.castOrFix({ name: 'a', at: { x: 1, y: 2 } });
        (value.at as { x: unknown }).x = 'broken';          // breach the immutability convention on purpose
        expect(Shape.is(value)).toBe(true);                 // the stamp answered; nothing was re-walked
        expect(Point.is(value.at)).toBe(true);              // nested objects are stamped too
    });

    it('a copy loses the stamp and is checked again', () => {
        const { value } = Shape.castOrFix({ name: 'a', at: { x: 1, y: 2 } });
        const copy = { ...value, at: { ...value.at, x: 'broken' as unknown as number } };
        expect(Shape.is(copy)).toBe(false);
    });

    it('a union stamps the member that matched AND itself', () => {
        const U = px.union([px.number(), Point]);
        const { value } = U.castOrFix({ x: 1, y: 2 });
        (value as { x: unknown }).x = 'broken';
        expect(Point.is(value)).toBe(true);
        expect(U.is(value)).toBe(true);
    });

    it('keeps undeclared keys untouched (lenient) — sanitize would strip them', () => {
        const raw = { x: 1, y: 2, legacy: { keep: true } };
        expect(Point.castOrFix(raw).value).toEqual(raw);
        expect(Point.sanitize(raw)).toEqual({ x: 1, y: 2 });
    });

    it('repairs invalid declared fields, reports them with paths, and the repaired tree is valid', () => {
        const { value, problems, errors } = Shape.castOrFix({ name: 7, at: { x: 1, y: 'two' }, tags: ['ok', 3] });
        expect(value).toEqual({ name: '', at: { x: 1, y: 0 }, tags: ['ok'] });
        expect(errors.join('\n')).toContain('at.y');
        expect(problems.length).toBeGreaterThan(0);
        expect(Shape.is(value)).toBe(true);
    });

    it('a stamped tree passed again comes back as is', () => {
        const first = Shape.castOrFix({ name: 'a', at: { x: 1, y: 2 } }).value;
        expect(Shape.castOrFix(first).value).toBe(first);
    });

    it('castOrFix agrees with sanitize on declared keys', () => {
        const raw = { name: 'a', at: { x: Infinity, y: 2 }, tags: 'not-an-array' };
        expect(Shape.castOrFix(raw).value).toEqual(Shape.sanitize(raw));
    });
});

describe('castOrFix on real document schemas', () => {
    const doc = {
        type: 'svg', viewBox: '0 0 10 10',
        children: [{
            type: 'rect', id: 'r', width: 4,
            animate: { transform: { keyframes: [{ time: 0, value: { translate: [0, 0] } }, { time: 500, value: { translate: [5, 1] } }] } },
        }],
        animator: { timeline: { outTime: 500 } },
    };

    it('a valid document comes out deep-equal, new, and stamped all the way down', () => {
        const { value, problems } = PxAnimatedSvgDocumentSchema.castOrFix(doc);
        expect(problems).toEqual([]);
        expect(value).toEqual(doc);
        expect(value).not.toBe(doc);
        const animate = PxAnimationDefinitionSchema.cast(value.children?.[0]?.animate);
        const kf = PxKeyframeSchema.cast(animate.transform?.keyframes?.[1]);
        const parts = PxTransformPartsSchema.cast(kf.value);
        Object.assign(parts, { translate: 'broken' });           // a deliberate breach: only a stamp can still say "valid"
        expect(PxTransformPartsSchema.is(parts)).toBe(true);     // the union member stamp answered
    });
});

describe('castOrFix — stamps are never a lie', () => {
    it('never stamps an input that a member passed through (px.any)', () => {
        const U = px.union([px.number(), px.any()]);
        const raw = { a: 1 };
        const { value } = U.castOrFix(raw);
        expect(value).toBe(raw);                                   // passed through by reference…
        expect(Object.getOwnPropertySymbols(raw)).toEqual([]);     // …and left unstamped
    });

    it('a repair that is still invalid is NOT stamped', () => {
        const Holder = px.object({ v: px.defined() });             // a required "present" value cannot be repaired
        const { value, problems } = Holder.castOrFix({});
        expect(problems.length).toBeGreaterThan(0);
        expect(Holder.is(value)).toBe(false);
    });
});

describe('castOrFix — incremental: stamped subtrees are reused, never rebuilt', () => {
    it('re-checking an edited copy rebuilds only what changed', () => {
        const doc = { type: 'svg', children: [{ type: 'rect', id: 'r' }], animator: { timeline: { outTime: 500 } } };
        const first = PxAnimatedSvgDocumentSchema.castOrFix(doc).value as typeof doc;
        const edited = { ...first, animator: { timeline: { outTime: 900 } } };   // a new root, as a config override makes
        const second = PxAnimatedSvgDocumentSchema.castOrFix(edited).value as typeof doc;
        expect(second).not.toBe(edited);
        expect(second.children).toBe(first.children);                          // the stamped subtree was reused as is
        expect(second.animator.timeline.outTime).toBe(900);
    });
});
