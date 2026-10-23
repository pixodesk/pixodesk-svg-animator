/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/
// §6 (dev-docs/reviews/first-use-review.md): per-key transform channels (`animate.translate`,
// `animate.rotate`, …) are DEPRECATED — still read (old migrated files carry them), but flagged,
// because two of them on one node are last-write-wins. The record form `animate.transform`, or
// `effects.transformBy` for independently-timed parts, is the spelling.
import { describe, expect, it } from 'vitest';
import type { PxNode } from '../index';
import { validateDeprecatedTransformChannels } from '../internal';

const kfs = { keyframes: [{ time: 0, value: [0, 0] }, { time: 1000, value: [9, 9] }] };

describe('deprecated per-key transform channels (§6)', () => {
    it('flags each node carrying one, with the composed alternative named', () => {
        const doc: PxNode = {
            type: 'svg',
            children: [
                { type: 'rect', id: 'a', animate: { translate: kfs, rotate: { keyframes: [{ time: 0, value: 0 }] } } },
                { type: 'g', children: [{ type: 'circle', id: 'b', animate: { scale: kfs } }] },
            ],
        };
        const warnings = validateDeprecatedTransformChannels(doc);
        expect(warnings).toHaveLength(2);
        expect(warnings[0]).toContain('translate');
        expect(warnings[0]).toContain('rotate');
        expect(warnings[0]).toContain('#a');
        expect(warnings[0]).toContain('animate.transform');
        expect(warnings[1]).toContain('scale');
    });

    it('stays quiet for the record form, non-transform channels, and effect parts', () => {
        const doc: PxNode = {
            type: 'svg',
            children: [{
                type: 'rect',
                animate: { transform: { keyframes: [{ time: 0, value: { translate: [0, 0] } }] }, opacity: { keyframes: [{ time: 0, value: 1 }] } },
                effects: { transformBy: { translate: kfs }, repeater: { copies: 2, rotate: { keyframes: [{ time: 0, value: 0 }] } } },
            }],
        };
        expect(validateDeprecatedTransformChannels(doc)).toEqual([]);
    });
});
