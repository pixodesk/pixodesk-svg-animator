/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// Pure-JSON in/out tests for the TEXT-PATH effect (`textPathEffect.ts`, browser-font
// path). Geometry is INLINE (`textPath.path`): the applier generates a `<path>` def from
// it and wraps the `<text>` host's children in a `<textPath href="#generated">`, forwarding
// `lengthAdjust`/`method`/`spacing`. `startOffset`/`textLength` are `PxAnimatable<number>`:
// static → string attr on `<textPath>`; `{keyframes}` → `<textPath>.animate.<attr>`.

import { describe, expect, it } from 'vitest';
import type { PxLoop, PxNode, PxTextPathEffect } from '../../format/PxAnimatorTypes';
import { authoredEntry, collectByType, entryOf, materialize } from '../effectTestKit';

/** A `<text>` host with an inline-path textPath effect. */
const scene = (textPath: PxTextPathEffect): PxNode => ({
    type: 'svg',
    children: [
        { type: 'text', id: 't', children: [{ type: 'tspan', textContent: 'Hi' }], effects: { textPath } },
    ],
});

const textNode = (out: PxNode): PxNode => collectByType(out, 'text')[0];
const textPathNode = (out: PxNode): PxNode => collectByType(out, 'textPath')[0];
const pathDef = (out: PxNode): PxNode => collectByType(out, 'path')[0];
/** The generated `<path>` def's `d` — throws unless it is a string. */
const pathDefD = (out: PxNode): string => {
    const d = pathDef(out).d;
    if (typeof d !== 'string') throw new Error('generated <path> has no string `d`');
    return d;
};


describe('textPathEffect — inline path → <path> def + <textPath> wrap', () => {

    it('case 1 — generates a <path> def from the inline path and wraps children in <textPath href=#generated>', () => {
        // clip → the generated def is the geometry verbatim (extend appends a tangent tail, tested below).
        const out = materialize(scene({ pathData: 'M0,0 Q50,80 100,0', pathOverflow: 'clip' }));

        const def = pathDef(out);
        expect(def.d).toBe('M0,0 Q50,80 100,0');                       // generated from inline geometry
        const tp = textPathNode(out);
        expect(tp.href).toBe('#' + def.id);                           // references the generated def
        expect(tp.children).toEqual([{ type: 'tspan', textContent: 'Hi' }]); // original content moved inside
        expect(textNode(out).children).toEqual([tp]);                 // text now holds only the textPath
        expect(textNode(out).effects).toBeUndefined();
    });

    it('case 2 — lengthAdjust/method/spacing + static startOffset/textLength forwarded as attrs', () => {
        const out = materialize(scene({
            pathData: 'M0,0 L100,0', lengthAdjust: 'spacingAndGlyphs', method: 'stretch', spacing: 'exact',
            startOffset: 25, textLength: 200,
        }));
        expect(textPathNode(out)).toMatchObject({
            lengthAdjust: 'spacingAndGlyphs', method: 'stretch', spacing: 'exact',
            startOffset: '25', textLength: '200',
        });
    });

    it('case 3 — animated startOffset → <textPath>.animate.startOffset.keyframes', () => {
        const out = materialize(scene({
            pathData: 'M0,0 L100,0',
            startOffset: { keyframes: [{ time: 0, value: 0 }, { time: 1000, value: 100 }] },
        }));
        const tp = textPathNode(out);
        expect(authoredEntry(tp, 'startOffset').keyframes?.map(k => k.value)).toEqual([0, 100]);
        // Animated ALSO writes the first-kf value as the static baseline attr —
        // the shared `writeAnimatableChannel` emit path (pre-tick DOM renders the
        // kf-at-time-0 state, same as strokeTrim's dasharray baseline).
        expect(tp.startOffset).toBe('0');
    });

    it('case 4 — pathOverflow rides on the effect (consumed, not leaked onto <textPath>)', () => {
        const out = materialize(scene({ pathData: 'M0,0 L100,0', pathOverflow: 'clip' }));
        const tp = textPathNode(out);
        expect(tp).toBeTruthy();
        expect(tp.pathOverflow).toBeUndefined(); // not an SVG textPath attr
    });

    it('case 5 — empty path → no wrap (node unchanged)', () => {
        const out = materialize(scene({ pathData: '' }));
        expect(collectByType(out, 'textPath')).toHaveLength(0);
        expect(textNode(out).children).toEqual([{ type: 'tspan', textContent: 'Hi' }]);
    });

    it('case 6 — pathOverflow:extend extends the generated <path> along the tangent; clip leaves it', () => {
        const short = 'M0,0 L100,0';
        const extendD = pathDefD(materialize(scene({ pathData: short, pathOverflow: 'extend', textLength: 500 })));
        const clipD = pathDefD(materialize(scene({ pathData: short, pathOverflow: 'clip' })));

        expect(clipD).toBe(short);                          // clip → browser drops overflow, path unchanged
        expect(extendD.length).toBeGreaterThan(short.length); // extend → straight tangent tail appended
        const xs = (extendD.match(/-?\d*\.?\d+/g) ?? []).map(Number).filter((_: number, i: number) => i % 2 === 0);
        expect(Math.max(...xs)).toBeGreaterThan(100);       // extension runs past the original end (x=100)
    });

    it('case 7 — default overflow (undefined) extends (extend is the default)', () => {
        const short = 'M0,0 L100,0';
        const d = pathDefD(materialize(scene({ pathData: short, textLength: 500 })));
        expect(d.length).toBeGreaterThan(short.length);
    });
});


describe('textPathEffect — animated pathData (a moving path, browser-font)', () => {

    const A = 'M0 0L100 0';
    const B = 'M0 50L100 50';
    const animated = (extra: Omit<PxTextPathEffect, 'pathData'> = {}) => scene({ pathData: { keyframes: [{ time: 0, value: { pathData: A } }, { time: 1000, value: { pathData: B } }] }, ...extra });

    it('keeps the keyframes on the generated def as `animate.d`; the body `d` is the first keyframe\'s path', () => {
        const out = materialize(animated());
        const def = pathDef(out);
        expect(def.d).toBe(A);                                     // a string, not the `{pathData}` baseline object
        expect(authoredEntry(def, 'd').keyframes).toEqual([
            { time: 0, value: { pathData: A } },
            { time: 1000, value: { pathData: B } },
        ]);
        expect(textPathNode(out).href).toBe('#' + def.id);        // still wrapped and linked
    });

    it('forces `clip` while the path animates — no tangent lead-in, startOffset untouched', () => {
        // `extend` on a static path would prepend a lead-in and shift startOffset (case 6).
        const out = materialize(animated({ pathOverflow: 'extend', startOffset: -40 }));
        expect(pathDef(out).d).toBe(A);                             // geometry as-is
        expect(textPathNode(out).startOffset).toBe('-40');         // not shifted
    });

    it('a `{value}` static form unwraps like a plain string', () => {
        const out = materialize(scene({ pathData: { value: A } }));
        expect(pathDef(out).d).toBe(A);
        expect(entryOf(pathDef(out), 'd')).toBeUndefined();
    });

    it('carries the loop onto the def\'s `animate.d`', () => {
        const loop: PxLoop = { direction: 'alternate' };
        const out = materialize(scene({ pathData: { keyframes: [{ time: 0, value: { pathData: A } }, { time: 1000, value: { pathData: B } }], loop } }));
        expect(authoredEntry(pathDef(out), 'd').loop).toEqual(loop);
    });
});
