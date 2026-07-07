/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// Pure-JSON in/out tests for the TEXT-PATH effect (`textPathEffect.ts`, browser-font
// path). Geometry is INLINE (`textPath.path`): the applier mints a `<path>` def from
// it and wraps the `<text>` host's children in a `<textPath href="#minted">`, forwarding
// `lengthAdjust`/`method`/`spacing`. `startOffset`/`textLength` are `PxAnimatable<number>`:
// static → string attr on `<textPath>`; `{keyframes}` → `<textPath>.animate.<attr>`.

import { describe, expect, it } from 'vitest';
import type { PxNode } from '../PxAnimatorTypes';
import { collectByType, materialise } from './effectTestKit';

/** A `<text>` host with an inline-path textPath effect. */
const scene = (textPath: any): PxNode => ({
    type: 'svg',
    children: [
        { type: 'text', id: 't', children: [{ type: 'tspan', text: 'Hi' }], effects: { textPath } },
    ],
} as unknown as PxNode);

const textNode = (out: PxNode): any => collectByType(out, 'text')[0];
const textPathNode = (out: PxNode): any => collectByType(out, 'textPath')[0];
const pathDef = (out: PxNode): any => collectByType(out, 'path')[0];


describe('textPathEffect — inline path → <path> def + <textPath> wrap', () => {

    it('case 1 — mints a <path> def from the inline path and wraps children in <textPath href=#minted>', () => {
        const out = materialise(scene({ path: 'M0,0 Q50,80 100,0' }));

        const def = pathDef(out);
        expect(def.d).toBe('M0,0 Q50,80 100,0');                       // minted from inline geometry
        const tp = textPathNode(out);
        expect(tp.href).toBe('#' + def.id);                           // references the minted def
        expect(tp.children).toEqual([{ type: 'tspan', text: 'Hi' }]); // original content moved inside
        expect(textNode(out).children).toEqual([tp]);                 // text now holds only the textPath
        expect(textNode(out).effects).toBeUndefined();
    });

    it('case 2 — lengthAdjust/method/spacing + static startOffset/textLength forwarded as attrs', () => {
        const out = materialise(scene({
            path: 'M0,0 L100,0', lengthAdjust: 'spacingAndGlyphs', method: 'stretch', spacing: 'exact',
            startOffset: 25, textLength: 200,
        }));
        expect(textPathNode(out)).toMatchObject({
            lengthAdjust: 'spacingAndGlyphs', method: 'stretch', spacing: 'exact',
            startOffset: '25', textLength: '200',
        });
    });

    it('case 3 — animated startOffset → <textPath>.animate.startOffset.keyframes', () => {
        const out = materialise(scene({
            path: 'M0,0 L100,0',
            startOffset: { keyframes: [{ time: 0, value: 0 }, { time: 1000, value: 100 }] },
        }));
        const tp = textPathNode(out);
        expect(tp.animate.startOffset.keyframes.map((k: any) => k.value)).toEqual([0, 100]);
        expect(tp.startOffset).toBeUndefined(); // animated → no static attr
    });

    it('case 4 — pathOverflow rides on the effect (consumed, not leaked onto <textPath>)', () => {
        const out = materialise(scene({ path: 'M0,0 L100,0', pathOverflow: 'clip' }));
        const tp = textPathNode(out);
        expect(tp).toBeTruthy();
        expect(tp.pathOverflow).toBeUndefined(); // not an SVG textPath attr
    });

    it('case 5 — empty path → no wrap (node unchanged)', () => {
        const out = materialise(scene({ path: '' }));
        expect(collectByType(out, 'textPath')).toHaveLength(0);
        expect(textNode(out).children).toEqual([{ type: 'tspan', text: 'Hi' }]);
    });
});
