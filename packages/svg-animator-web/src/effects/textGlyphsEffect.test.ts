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
import { materialiseGlyphText } from './textGlyphsEffect';

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

    it('single-span line collapse (text folded onto line-tspan AND kept as child) bakes ONCE', () => {
        // The editor's lightweight JSON emits a collapsed single-span line as a
        // line-<tspan> carrying BOTH its folded text and the child span. A container
        // that has children must NOT also render its own text, else the word bakes
        // twice. Regression for the doubled-glyphs bug.
        const { root } = run({ useGlyphs: true }, {}, [
            {
                type: 'tspan', text: 'Hi', fontFamily: 'F', fontSize: '100px',
                children: [{ type: 'tspan', text: 'Hi', fontFamily: 'F', fontSize: '100px' }],
            },
        ]);
        const p = paths(root);
        expect(p).toHaveLength(1);
        expect(p[0].d).toBe('M0 0L10 0L10-70ZM70 0L75 0L75-50Z'); // H+i ONCE, not twice
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


describe('textGlyphsEffect — along-path', () => {

    // svg root with a guide <path id=curve> + a glyph text running along it.
    function alongScene(pathD: string, startOffset?: number, text = 'Hi'): PxNode {
        const textAlongPath: any = { href: 'curve' };
        if (startOffset !== undefined) textAlongPath.startOffset = startOffset;
        return {
            type: 'svg',
            animator: { definitions: { glyphs } },
            children: [
                { type: 'path', id: 'curve', d: pathD },
                {
                    type: 'text', id: 't',
                    children: [{ type: 'tspan', text, fontFamily: 'F', fontSize: '100px' }],
                    effects: { text: { useGlyphs: true }, textAlongPath },
                },
            ],
        } as unknown as PxNode;
    }

    // Glyph paths only (exclude the guide <path id=curve>).
    const glyphPaths = (root: PxNode) =>
        ((collectByType(root, 'g').find(n => n.id === 't')?.children) ?? []).filter(n => n.type === 'path');

    // Path sampling goes through trig, so bakes carry sub-precision float dust
    // ("10.00", "-0.00"): compare the coordinate stream with a tolerance.
    const dNums = (d: unknown) => (String(d).match(/-?\d*\.?\d+/g) ?? []).map(Number);
    const expectD = (d: unknown, expected: Array<number>) => {
        const got = dNums(d);
        expect(got).toHaveLength(expected.length);
        expected.forEach((v, i) => expect(got[i]).toBeCloseTo(v, 1));
    };

    it('on a straight horizontal path reduces to horizontal layout', () => {
        const { root } = materialiseRaw(alongScene('M0 0L1000 0'));
        expect(collectByType(root, 'text')).toHaveLength(0);
        expect(collectByType(root, 'textPath')).toHaveLength(0); // native textPath NOT used
        const p = glyphPaths(root);
        expect(p).toHaveLength(1);
        expectD(p[0].d, [0, 0, 10, 0, 10, -70, /*H*/ 70, 0, 75, 0, 75, -50 /*i*/]);
    });

    it('applies startOffset as distance along the path', () => {
        const { root } = materialiseRaw(alongScene('M0 0L1000 0', 100, 'H'));
        expectD(glyphPaths(root)[0].d, [100, 0, 110, 0, 110, -70]);
    });

    it('rotates each glyph to the path tangent (90° down)', () => {
        const { root } = materialiseRaw(alongScene('M0 0L0 1000', undefined, 'H'));
        const d = glyphPaths(root)[0].d as string;
        expect(d).not.toBe('M0 0L10 0L10-70Z');   // not the horizontal placement
        // H rotated 90°: advance (10 wide) now runs down +y; the stem (70 up) → +x.
        expectD(d, [0, 0, 0, 10, 70, 10]);
    });

    it('keeps the referenced guide path in the tree', () => {
        const { root } = materialiseRaw(alongScene('M0 0L1000 0'));
        expect(collectByType(root, 'path').some(p => p.id === 'curve')).toBe(true);
    });
});


describe('textGlyphsEffect — along-path animated (sliding startOffset)', () => {

    function animScene(pathD: string, kfs: Array<any>, text = 'H', loop?: unknown): PxNode {
        const startOffset: any = { keyframes: kfs };
        if (loop !== undefined) startOffset.loop = loop;
        return {
            type: 'svg',
            animator: { definitions: { glyphs } },
            children: [
                { type: 'path', id: 'curve', d: pathD },
                {
                    type: 'text', id: 't',
                    children: [{ type: 'tspan', text, fontFamily: 'F', fontSize: '100px' }],
                    effects: { text: { useGlyphs: true }, textAlongPath: { href: 'curve', startOffset } },
                },
            ],
        } as unknown as PxNode;
    }

    const glyphPaths = (root: PxNode) =>
        ((collectByType(root, 'g').find(n => n.id === 't')?.children) ?? []).filter(n => n.type === 'path');

    it('emits a separate <path> per glyph with sampled translate+rotate keyframes', () => {
        // H (adv 70, mid 35) slides 0→100 along a straight path over 0→1000ms.
        const { root } = materialiseRaw(animScene('M0 0L1000 0', [{ time: 0, value: 0 }, { time: 1000, value: 100 }], 'H'));
        const p = glyphPaths(root);
        expect(p).toHaveLength(1);
        // Outline baked centred on mid-advance (scale only, no position/rotation).
        expect(p[0].d).toBe('M-35 0L-25 0L-25-70Z');

        const kfs = (p[0].animate as any).transform.keyframes;
        expect(kfs.length).toBeGreaterThan(2); // sub-sampled, not just the 2 endpoints
        expect(kfs[0].time).toBe(0);
        expect(kfs[0].value.translate[0]).toBeCloseTo(35, 2);  // mid at dist 0+35
        expect(kfs[0].value.rotate).toBeCloseTo(0, 3);
        const last = kfs[kfs.length - 1];
        expect(last.time).toBe(1000);
        expect(last.value.translate[0]).toBeCloseTo(135, 2);   // mid at dist 100+35
    });

    it('gives each glyph its own animated path (no merge)', () => {
        const { root } = materialiseRaw(animScene('M0 0L1000 0', [{ time: 0, value: 0 }, { time: 1000, value: 100 }], 'Hi'));
        const p = glyphPaths(root);
        expect(p).toHaveLength(2);
        expect((p[0].animate as any).transform.keyframes.length).toBeGreaterThan(1);
        expect((p[1].animate as any).transform.keyframes.length).toBeGreaterThan(1);
    });

    it('sub-samples so glyphs follow a curve (intermediate points off the chord)', () => {
        // Quarter-circle-ish path; a 2-kf straight interp would cut the corner.
        const { root } = materialiseRaw(animScene('M0 0Q100 0 100 100', [{ time: 0, value: 0 }, { time: 1000, value: 140 }], 'H'));
        const kfs = (glyphPaths(root)[0].animate as any).transform.keyframes;
        expect(kfs.length).toBeGreaterThan(3);
        // rotation changes along the curve (not constant like a straight path)
        const rots = kfs.map((k: any) => k.value.rotate);
        expect(Math.max(...rots) - Math.min(...rots)).toBeGreaterThan(10);
    });

    it('propagates loop to animate.transform', () => {
        const { root } = materialiseRaw(animScene('M0 0L1000 0', [{ time: 0, value: 0 }, { time: 1000, value: 100 }], 'H', true));
        expect((glyphPaths(root)[0].animate as any).transform.loop).toBe(true);
    });

    it('treats a single startOffset keyframe as static (merged, no animation)', () => {
        const { root } = materialiseRaw(animScene('M0 0L1000 0', [{ time: 0, value: 100 }], 'Hi'));
        const p = glyphPaths(root);
        expect(p).toHaveLength(1);               // merged
        expect(p[0].animate).toBeUndefined();
    });
});


describe('materialiseGlyphText — injected element factory (editor reuse)', () => {

    // A non-JSON factory standing in for the editor's React/px `createPxElement`.
    interface Fake { tag: string; attrs: Record<string, any>; kids: Array<Fake>; }
    const fakeFactory = (tag: string, attrs: Record<string, any>, kids?: any): Fake =>
        ({ tag, attrs, kids: Array.isArray(kids) ? kids : (kids ? [kids] : []) });

    const textNode = (): PxNode => ({
        type: 'text', id: 't', transform: 'translate(10,50)',
        children: [{ type: 'tspan', text: 'Hi', fontFamily: 'F', fontSize: '100px', fill: '#f00' }],
    } as unknown as PxNode);

    it('builds the group + paths via the caller-supplied factory (not JSON nodes)', () => {
        const g = materialiseGlyphText<Fake>(textNode(), { glyphs, create: fakeFactory });
        expect(g).toBeTruthy();
        expect(g!.tag).toBe('g');
        expect(g!.attrs.id).toBe('t');
        expect(g!.attrs.transform).toBe('translate(10,50)');
        expect(g!.attrs.fontFamily).toBeUndefined(); // text attrs dropped
        expect(g!.kids).toHaveLength(1);
        expect(g!.kids[0].tag).toBe('path');
        expect(g!.kids[0].attrs.d).toBe('M0 0L10 0L10-70ZM70 0L75 0L75-50Z');
        expect(g!.kids[0].attrs.fill).toBe('#f00');
    });

    it('defaults to plain wire nodes when no factory is passed', () => {
        const g = materialiseGlyphText<PxNode>(textNode(), { glyphs });
        expect(g!.type).toBe('g');
        expect((g!.children as Array<PxNode>)[0].type).toBe('path');
    });
});
