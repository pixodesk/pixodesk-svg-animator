/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// The format's camelCase values, spelled the browser's way where a player hands them over
// (first-use review §25): the CSS keyword is the value's kebab-case form, for every value.
import { describe, expect, it } from 'vitest';
import { cssPlaybackDirection, cssRangeOfMoment, PX_SCROLL_MOMENT_ORDER, PxPlaybackDirection } from './PxAnimatorConstants';
import { camelCaseToKebabWordIfNeeded } from '../util/PxAnimatorUtil';

describe('the browser spelling of format values', () => {
    it('every direction', () => {
        for (const d of Object.values(PxPlaybackDirection)) expect(cssPlaybackDirection(d)).toBe(camelCaseToKebabWordIfNeeded(d));
        expect(cssPlaybackDirection(PxPlaybackDirection.alternateReverse)).toBe('alternate-reverse');
    });
    it('every scroll phase', () => {
        // each moment word is a browser range point: one of CSS's kebab-case range names at 0, 50 or 100 %
        for (const moment of PX_SCROLL_MOMENT_ORDER) {
            const range = cssRangeOfMoment({ moment }, moment);
            expect(['cover', 'entry', 'exit']).toContain(range?.name);
            expect([0, 0.5, 1]).toContain(range?.fraction);
        }
        expect(cssRangeOfMoment({ element: 0.2, screen: 'bottom' }, 'appears')?.name).toBe(camelCaseToKebabWordIfNeeded('entryCrossing'));
    });
});
