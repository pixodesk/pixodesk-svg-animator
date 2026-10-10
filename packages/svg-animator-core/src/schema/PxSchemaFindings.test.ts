/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// `findings` — the structured twin of `errors`. A consumer that must BRANCH on what went wrong
// (the editor's "another version wrote this" advice) reads a `kind` and a `path`, never the text.

import { describe, expect, it } from 'vitest';
import { px, PxValidationFindingKind, type PxValidationContext, type PxValidationFinding } from './PxSchema';

function ctx(): PxValidationContext & { findings: Array<PxValidationFinding> } {
    return { errors: [], warnings: [], findings: [], strict: true };
}

const ANIMATABLE = px.union([
    px.number(),
    px.object({ keyframes: px.array(px.object({ time: px.number(), value: px.number() })) }),
]);

describe('validation findings — structure beside the text', () => {

    it('every error line has a finding twin with the same message, in the same order', () => {
        const c = ctx();
        const schema = px.object({
            name: px.string(),
            size: px.enum(['s', 'm'] as const),
            on: px.literal(true),
            items: px.tuple([px.number(), px.number()]),
            nested: px.object({ n: px.number() }),
        });
        schema.isValid({ name: 1, size: 'xl', on: false, items: [1], nested: { n: 'x', extra: 1 }, stray: 0 }, c, ['root']);
        expect(c.findings.map(f => f.message)).toEqual(c.errors);
        expect(c.findings.map(f => [f.kind, f.path.join('.')])).toEqual([
            [PxValidationFindingKind.typeMismatch, 'root.name'],
            [PxValidationFindingKind.invalidValue, 'root.size'],
            [PxValidationFindingKind.invalidValue, 'root.on'],
            [PxValidationFindingKind.typeMismatch, 'root.items'],
            [PxValidationFindingKind.typeMismatch, 'root.nested.n'],
            [PxValidationFindingKind.unknownKey, 'root.nested.extra'],
            [PxValidationFindingKind.unknownKey, 'root.stray'],
        ]);
        // The reason is the line without its path; `expected` names the accepted shape alone.
        const name = c.findings[0];
        expect(name.reason).toBe('expected string, got number');
        expect(name.expected).toBe('string');
        expect(c.findings[1].expected).toBe('one of "s" | "m"');
    });

    it('an absent value is a typeMismatch for a typed field, a missingValue for `px.defined()`', () => {
        const c = ctx();
        px.object({ a: px.number(), b: px.defined() }).isValid({}, c, ['root']);
        expect(c.findings.map(f => [f.kind, f.path.join('.')])).toEqual([
            [PxValidationFindingKind.typeMismatch, 'root.a'],
            [PxValidationFindingKind.missingValue, 'root.b'],
        ]);
    });

    it('a failed union is ONE finding; the member diagnosis is nested, never a top-level unknown key', () => {
        const c = ctx();
        // `keyframe` should be `keyframes`: the object member descends and names the typo.
        ANIMATABLE.isValid({ keyframe: [{ time: 0, value: 1 }] }, c, ['opacity']);
        expect(c.findings).toHaveLength(1);
        const union = c.findings[0];
        expect(union.kind).toBe(PxValidationFindingKind.unionMismatch);
        expect(union.path).toEqual(['opacity']);
        // The member checks its declared fields first (`keyframes` absent), then the extra key.
        expect(union.memberFindings?.map(f => [f.kind, f.path.join('.')])).toEqual([
            [PxValidationFindingKind.typeMismatch, 'opacity.keyframes'],
            [PxValidationFindingKind.unknownKey, 'opacity.keyframe'],
        ]);
        // The text still carries the diagnosis lines after the headline (§2.8) …
        expect(c.errors.length).toBeGreaterThan(1);
        // … while structurally the document has NO unknown key: the typo is a malformed value.
        expect(c.findings.some(f => f.kind === PxValidationFindingKind.unknownKey)).toBe(false);
    });

    it('a union nobody descended into folds the expectations and nests nothing', () => {
        const c = ctx();
        ANIMATABLE.isValid(true, c, ['opacity']);
        expect(c.findings).toHaveLength(1);
        expect(c.findings[0].kind).toBe(PxValidationFindingKind.unionMismatch);
        expect(c.findings[0].memberFindings).toBeUndefined();
        expect(c.errors.some(e => e.includes('expected finite number | object'))).toBe(true);
    });

    it('a discriminated union that matches nothing is a unionMismatch at its own path', () => {
        const c = ctx();
        const shape = px.discriminatedUnion('type', [px.object({ type: px.literal('a'), x: px.number() })]);
        shape.isValid({ type: 'zzz' }, c, ['root', 'shape']);
        expect(c.findings.map(f => [f.kind, f.path.join('.')])).toEqual([[PxValidationFindingKind.unionMismatch, 'root.shape']]);
    });

    it('a context without `findings` keeps getting the text, unchanged', () => {
        const plain: PxValidationContext = { errors: [], warnings: [], strict: true };
        px.object({ a: px.number() }).isValid({ a: 'x', b: 1 }, plain, ['root']);
        expect(plain.errors).toEqual(['root.a: expected finite number, got "x"', 'root.b: unexpected extra key']);
    });
});
