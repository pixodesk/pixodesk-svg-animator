/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// V3 — closed value lists are strict `px.enum`s, so a typo is a schema ERROR
// instead of validating silently and shipping. Before this, `maskType:'lumnance'`
// passed validation while `direction:'revrese'` (already an enum) failed — the
// same class of mistake caught in one slot and missed in the next.
//
// Plain `px.string()` is kept ONLY where SVG itself is open-ended: `gradientTransform`,
// `viewBox`, textPath `path` (a `d`), ids/refs, `debugInstName`.

import { describe, expect, it } from 'vitest';
import {
    PxCloneEffectSchema, PxFillGradientEffectSchema, PxMaskedByEffectSchema, PxNodeSchema,
    PxTextPathEffectSchema,
} from './PxAnimatorTypes';
import type { PxValidationContext } from './PxSchema';

const ctx = (): PxValidationContext => ({ errors: [], warnings: [] });

/** [schema, slot, a VALID value, a TYPO that must now be rejected] */
const CASES: Array<[any, string, unknown, unknown, Record<string, unknown>]> = [
    [PxMaskedByEffectSchema, 'maskType', 'luminance', 'lumnance', {}],
    [PxMaskedByEffectSchema, 'maskUnits', 'objectBoundingBox', 'objectBoundingBoxx', {}],
    [PxMaskedByEffectSchema, 'maskContentUnits', 'userSpaceOnUse', 'userSpace', {}],
    [PxCloneEffectSchema, 'type', 'content', 'contents', {}],
    [PxFillGradientEffectSchema, 'gradientUnits', 'userSpaceOnUse', 'userSpaceOnuse', { type: 'linear' }],
    [PxFillGradientEffectSchema, 'spreadMethod', 'reflect', 'reflectt', { type: 'linear' }],
    [PxTextPathEffectSchema, 'pathOverflow', 'clip', 'clipp', { path: 'M0,0L10,0' }],
    [PxTextPathEffectSchema, 'lengthAdjust', 'spacingAndGlyphs', 'spacingAndGlyph', { path: 'M0,0L10,0' }],
    [PxTextPathEffectSchema, 'method', 'stretch', 'strech', { path: 'M0,0L10,0' }],
    [PxTextPathEffectSchema, 'spacing', 'exact', 'exactt', { path: 'M0,0L10,0' }],
];

describe('closed value lists are strict enums (V3)', () => {

    for (const [schema, slot, good, typo, base] of CASES) {
        it(`${slot}: accepts '${good}', REJECTS '${typo}'`, () => {
            expect(schema.isValid({ ...base, [slot]: good }, ctx(), []), `'${good}' is valid`).toBe(true);

            const bad = ctx();
            expect(schema.isValid({ ...base, [slot]: typo }, bad, []), `'${typo}' must be rejected`).toBe(false);
            expect(bad.errors.join(' ')).toContain(slot);
        });
    }

    it('open-ended SVG values stay plain strings (not enum-restricted)', () => {
        // `gradientTransform` is an arbitrary transform string — must NOT be constrained.
        expect(PxFillGradientEffectSchema.isValid(
            { type: 'linear', gradientTransform: 'rotate(31.5) translate(4,2)' }, ctx(), [])).toBe(true);
        // textPath `path` is a `d` — likewise open.
        expect(PxTextPathEffectSchema.isValid(
            { path: 'M0,0C10,10 20,-10 30,0' }, ctx(), [])).toBe(true);
    });
});


// J3 — a BODY attribute is STATIC-ONLY. Animation belongs in the parallel `animate`
// channel (R2); an inline `"opacity": {keyframes:[…]}` was schema-legal but nothing
// wrote or read it. Removing that branch also un-conflated a real case: the transform
// PARTS RECORD used to validate only by accident, through the same all-optional
// animation schema. It is now declared explicitly.
describe('body attrs are statics-only (J3)', () => {

    const node = (attrs: Record<string, unknown>) => ({ type: 'rect', ...attrs });

    it('accepts the static forms: primitive, number-array, {value}, parts record', () => {
        for (const attrs of [
            { opacity: 0.5 },
            { fill: '#f00' },
            { strokeDasharray: [4, 2] },
            { transform: { value: { translate: [10, 20] } } },
            { transform: { translate: [10, 20], rotate: 45, origin: [5, 5] } },
        ]) {
            const ctx: PxValidationContext = { errors: [], warnings: [] };
            expect(PxNodeSchema.isValid(node(attrs), ctx, []), JSON.stringify(attrs) + ' → ' + ctx.errors.join(';')).toBe(true);
        }
    });

    // The inline form is no longer a DECLARED member — `PxAttrValue` (the exported
    // type) and the schema union both say statics-only now.
    //
    // HONEST LIMITATION — validation still cannot REJECT it, for two independent
    // reasons found while writing this test:
    //   1. `{value: px.any()}` matches ANY object: `px.any()` accepts `undefined`, so
    //      the `value` key isn't effectively required.
    //   2. `Union.isValid` calls members as `s.isValid(raw)` WITHOUT forwarding `ctx`,
    //      so `strict: true` never reaches them — strict is inert inside every union.
    // Catching a stray inline animation therefore needs a walker lint (the same shape
    // as `lintPlayerEffectsBucketKeys`, added for the identical gap in V1), or a fix
    // to `Union.isValid`. Asserted here as CURRENT behaviour so the day either changes,
    // this test flips and says so.
    it('inline animation on a body attr: still ACCEPTED by validation (documented gap)', () => {
        const inline = node({ opacity: { keyframes: [{ time: 0, value: 0 }, { time: 1000, value: 1 }] } });
        for (const strict of [false, true]) {
            const ctx: PxValidationContext = { errors: [], warnings: [], strict };
            expect(PxNodeSchema.isValid(inline, ctx, []), `strict=${strict}`).toBe(true);
        }
        // The canonical spelling is of course valid too — that is the one to write.
        const ok: PxValidationContext = { errors: [], warnings: [] };
        expect(PxNodeSchema.isValid(
            node({ animate: { opacity: { keyframes: [{ time: 0, value: 0 }, { time: 1000, value: 1 }] } } }), ok, [])).toBe(true);
    });

});
