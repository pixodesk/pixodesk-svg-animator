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
    PxCloneEffectSchema, PxFillGradientEffectSchema, PxMaskedByEffectSchema, PxTextPathEffectSchema,
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
