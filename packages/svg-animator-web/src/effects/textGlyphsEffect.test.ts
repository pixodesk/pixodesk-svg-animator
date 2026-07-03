/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// Pure-JSON in/out tests for the GLYPH-TEXT effect (`textGlyphsEffect.ts`).
// A <text> with `effects.text.useGlyphs` + `definitions.glyphs` is replaced by a
// <g> of baked <path> outlines: glyphs sharing paint merge into one path;
// differing fill splits; text-anchor shifts each line by its advance width.
//
// Font `F`: unitsPerEm 1000, so fontSize 100 → scale 0.1 (integer-clean bakes).
//   H: width 700, box 100×700   i: width 300, box 50×500   ' ': width 250, no outline

import { describe, expect, it } from 'vitest';
import type { PxNode } from '../PxAnimatorTypes';
import { collectByType, materialiseRaw } from './effectTestKit';

const glyphs = {
    F: {
        fFamily: 'F', style: '', ascent: 800, unitsPerEm: 1000,
        glyphs: {
            H: { width: 700, d: 'M0 0L100 0L100 -700Z' },
            i: { width: 300, d: 'M0 0L50 0L50 -500Z' },
            ' ': { width: 250, d: '' },
        },
    },
};

/** svg root carrying the glyph defs + one <text> host. */
function scene(text: any, textAttrs: any = {}, tspans?: Array<any>): PxNode {
    return {
        type: 'svg',
        animator: { definitions: { glyphs } },
        children: [{
            type: 'text', id: 't', ...textAttrs,
            children: tspans ?? [{ type: 'tspan', text: 'Hi', fontFamily: 'F', fontSize: '100px' }],
            effects: { text },
        }],
    } as unknown as PxNode;
}

const run = (text: any, textAttrs?: any, tspans?: Array<any>) => materialiseRaw(scene(text, textAttrs, tspans));
const paths = (root: PxNode) => collectByType(root, 'path');


describe('textGlyphsEffect — <text> → baked <path> outlines', () => {

    it('merges glyphs sharing paint into one <path> and converts <text> to <g>', () => {
        const { root } = run({ useGlyphs: true });

        expect(collectByType(root, 'text')).toHaveLength(0);
        const g = collectByType(root, 'g').find(n => n.id === 't');
        expect(g).toBeTruthy();
        expect(g!.fontSize).toBeUndefined();   // text attrs dropped
        expect(g!.fontFamily).toBeUndefined();

        const p = paths(root);
        expect(p).toHaveLength(1);
        // H at pen 0, i at pen 70 (700*0.1); coords scaled ×0.1.
        expect(p[0].d).toBe('M0 0L10 0L10-70ZM70 0L75 0L75-50Z');
        expect(p[0].fill).toBeUndefined();
        expect(root.effects).toBeFalsy();
    });

    it('splits into one <path> per distinct fill, keeping pen continuous', () => {
        const { root } = run({ useGlyphs: true }, {}, [
            { type: 'tspan', text: 'H', fontFamily: 'F', fontSize: '100px', fill: '#f00' },
            { type: 'tspan', text: 'i', fontFamily: 'F', fontSize: '100px', fill: '#00f' },
        ]);

        const p = paths(root);
        expect(p).toHaveLength(2);
        expect(p[0].fill).toBe('#f00');
        expect(p[0].d).toBe('M0 0L10 0L10-70Z');
        expect(p[1].fill).toBe('#00f');
        expect(p[1].d).toBe('M70 0L75 0L75-50Z'); // continues after H's advance
    });

    it('text-anchor:middle shifts the line left by half its advance width', () => {
        // advances: H 70 + i 30 = 100 → middle shift −50.
        const { root } = run({ useGlyphs: true }, { textAnchor: 'middle' });
        expect(paths(root)[0].d).toBe('M-50 0L-40 0L-40-70ZM20 0L25 0L25-50Z');
    });

    it('advances past whitespace (no outline) using its width', () => {
        // 'H' (adv 70) + ' ' (adv 25) + 'i' → i pen at 95.
        const { root } = run({ useGlyphs: true }, {}, [
            { type: 'tspan', text: 'H i', fontFamily: 'F', fontSize: '100px' },
        ]);
        expect(paths(root)[0].d).toBe('M0 0L10 0L10-70ZM95 0L100 0L100-50Z');
    });

    it('uses the sole embedded font when a run has no font-family', () => {
        const { root } = run({ useGlyphs: true }, {}, [
            { type: 'tspan', text: 'Hi', fontSize: '100px' }, // no fontFamily
        ]);
        expect(paths(root)).toHaveLength(1);
        expect(paths(root)[0].d).toBe('M0 0L10 0L10-70ZM70 0L75 0L75-50Z');
    });

    it('is a no-op when useGlyphs is not set', () => {
        const { root } = run({});
        expect(collectByType(root, 'text')).toHaveLength(1);
        expect(paths(root)).toHaveLength(0);
    });

    it('warns and leaves native text when no glyphs are defined', () => {
        const input = {
            type: 'svg',
            children: [{ type: 'text', id: 't', children: [{ type: 'tspan', text: 'Hi', fontFamily: 'F' }], effects: { text: { useGlyphs: true } } }],
        } as unknown as PxNode;
        const { root, warnings } = materialiseRaw(input);
        expect(collectByType(root, 'text')).toHaveLength(1);
        expect(warnings.join(' ')).toContain('no definitions.glyphs');
    });
});
