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
        // clip → the minted def is the geometry verbatim (extend appends a tangent tail, tested below).
        const out = materialise(scene({ path: 'M0,0 Q50,80 100,0', pathOverflow: 'clip' }));

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
        // Animated ALSO writes the first-kf value as the static baseline attr —
        // the shared `writeAnimatableChannel` emit path (pre-tick DOM renders the
        // kf-at-time-0 state, same as trimPath's dasharray baseline).
        expect(tp.startOffset).toBe('0');
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

    it('case 6 — pathOverflow:extend extends the minted <path> along the tangent; clip leaves it', () => {
        const short = 'M0,0 L100,0';
        const extendD = pathDef(materialise(scene({ path: short, pathOverflow: 'extend', textLength: 500 }))).d;
        const clipD = pathDef(materialise(scene({ path: short, pathOverflow: 'clip' }))).d;

        expect(clipD).toBe(short);                          // clip → browser drops overflow, path unchanged
        expect(extendD.length).toBeGreaterThan(short.length); // extend → straight tangent tail appended
        const xs = (extendD.match(/-?\d*\.?\d+/g) ?? []).map(Number).filter((_, i) => i % 2 === 0);
        expect(Math.max(...xs)).toBeGreaterThan(100);       // extension runs past the original end (x=100)
    });

    it('case 7 — default overflow (undefined) extends (extend is the default)', () => {
        const short = 'M0,0 L100,0';
        const d = pathDef(materialise(scene({ path: short, textLength: 500 }))).d;
        expect(d.length).toBeGreaterThan(short.length);
    });
});
