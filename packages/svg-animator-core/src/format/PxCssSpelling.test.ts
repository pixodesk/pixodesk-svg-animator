/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// The format's camelCase values, spelled the browser's way where a player hands them over
// (first-use review §25): the CSS keyword is the value's kebab-case form, for every value.
import { describe, expect, it } from 'vitest';
import { cssPlaybackDirection, cssScrollPhase, PxPlaybackDirection, PxScrollPhase } from './PxAnimatorConstants';
import { camelCaseToKebabWordIfNeeded } from '../util/PxAnimatorUtil';

describe('the browser spelling of format values', () => {
    it('every direction', () => {
        for (const d of Object.values(PxPlaybackDirection)) expect(cssPlaybackDirection(d)).toBe(camelCaseToKebabWordIfNeeded(d));
        expect(cssPlaybackDirection(PxPlaybackDirection.alternateReverse)).toBe('alternate-reverse');
    });
    it('every scroll phase', () => {
        for (const p of Object.values(PxScrollPhase)) expect(cssScrollPhase(p)).toBe(camelCaseToKebabWordIfNeeded(p));
        expect(cssScrollPhase(PxScrollPhase.entryCrossing)).toBe('entry-crossing');
    });
});
