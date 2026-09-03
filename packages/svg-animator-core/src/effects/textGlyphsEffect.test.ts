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
import { layoutGlyphTextChars, materialiseGlyphText } from './textGlyphsEffect';

const glyphs = {
    F: {
        fontFamily: 'F', style: '', ascent: 800, unitsPerEm: 1000,
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
            children: tspans ?? [{ type: 'tspan', textContent: 'Hi', fontFamily: 'F', fontSize: '100px' }],
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
                type: 'tspan', textContent: 'Hi', fontFamily: 'F', fontSize: '100px',
                children: [{ type: 'tspan', textContent: 'Hi', fontFamily: 'F', fontSize: '100px' }],
            },
        ]);
        const p = paths(root);
        expect(p).toHaveLength(1);
        expect(p[0].d).toBe('M0 0L10 0L10-70ZM70 0L75 0L75-50Z'); // H+i ONCE, not twice
    });

    it('splits into one <path> per distinct fill, keeping pen continuous', () => {
        const { root } = run({ useGlyphs: true }, {}, [
            { type: 'tspan', textContent: 'H', fontFamily: 'F', fontSize: '100px', fill: '#f00' },
            { type: 'tspan', textContent: 'i', fontFamily: 'F', fontSize: '100px', fill: '#00f' },
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
            { type: 'tspan', textContent: 'H i', fontFamily: 'F', fontSize: '100px' },
        ]);
        expect(paths(root)[0].d).toBe('M0 0L10 0L10-70ZM95 0L100 0L100-50Z');
    });

    it('uses the sole embedded font when a run has no font-family', () => {
        const { root } = run({ useGlyphs: true }, {}, [
            { type: 'tspan', textContent: 'Hi', fontSize: '100px' }, // no fontFamily
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
            children: [{ type: 'text', id: 't', children: [{ type: 'tspan', textContent: 'Hi', fontFamily: 'F' }], effects: { text: { useGlyphs: true } } }],
        } as unknown as PxNode;
        const { root, warnings } = materialiseRaw(input);
        expect(collectByType(root, 'text')).toHaveLength(1);
        expect(warnings.join(' ')).toContain('no definitions.glyphs');
    });
});


describe('textGlyphsEffect — along-path', () => {

    // svg root with a glyph text running along an INLINE path (textPath.path).
    function alongScene(pathD: string, startOffset?: number, text = 'Hi', pathOverflow?: string): PxNode {
        const textPath: any = { path: pathD };
        if (startOffset !== undefined) textPath.startOffset = startOffset;
        if (pathOverflow !== undefined) textPath.pathOverflow = pathOverflow;
        return {
            type: 'svg',
            animator: { definitions: { glyphs } },
            children: [
                {
                    type: 'text', id: 't',
                    children: [{ type: 'tspan', text, fontFamily: 'F', fontSize: '100px' }],
                    effects: { text: { useGlyphs: true }, textPath },
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

    // Text-on-a-path x/dx/dy (SVG "text on a path" layout, horizontal writing mode):
    // x & dx offset ALONG the path (add to startOffset), dy offsets PERPENDICULAR,
    // y is IGNORED. Same 'H' as the startOffset test → identical baked coords when the
    // net along-path distance is 100.
    const alongWith = (attrs: Record<string, number>, text = 'H') => {
        const scene = alongScene('M0 0L1000 0', undefined, text) as any;
        Object.assign(scene.children[0], attrs);
        return scene as PxNode;
    };

    it('x is an offset ALONG the path (like startOffset)', () => {
        expectD(glyphPaths(materialiseRaw(alongWith({ x: 100 })).root)[0].d, [100, 0, 110, 0, 110, -70]);
    });
    it('dx is an offset ALONG the path', () => {
        expectD(glyphPaths(materialiseRaw(alongWith({ dx: 100 })).root)[0].d, [100, 0, 110, 0, 110, -70]);
    });
    it('x and dx ADD along the path', () => {
        expectD(glyphPaths(materialiseRaw(alongWith({ x: 60, dx: 40 })).root)[0].d, [100, 0, 110, 0, 110, -70]);
    });
    it('dy shifts PERPENDICULAR to the path', () => {
        // Horizontal path (tangent +x) → left normal is +y, so dy=50 lowers the glyph by 50.
        expectD(glyphPaths(materialiseRaw(alongWith({ dy: 50 })).root)[0].d, [0, 50, 10, 50, 10, -20]);
    });
    it('y (on the <text> containing the <textPath>) is IGNORED', () => {
        expectD(glyphPaths(materialiseRaw(alongWith({ y: 50 })).root)[0].d, [0, 0, 10, 0, 10, -70]);
    });

    it('rotates each glyph to the path tangent (90° down)', () => {
        const { root } = materialiseRaw(alongScene('M0 0L0 1000', undefined, 'H'));
        const d = glyphPaths(root)[0].d as string;
        expect(d).not.toBe('M0 0L10 0L10-70Z');   // not the horizontal placement
        // H rotated 90°: advance (10 wide) now runs down +y; the stem (70 up) → +x.
        expectD(d, [0, 0, 0, 10, 70, 10]);
    });

    it('needs no external guide <path> def — geometry is inline on the effect', () => {
        const { root } = materialiseRaw(alongScene('M0 0L1000 0'));
        expect(collectByType(root, 'path').some(p => p.id === 'curve')).toBe(false); // no external def
        expect(glyphPaths(root).length).toBeGreaterThan(0);                          // glyphs baked from inline path
    });

    // Text "Hi" @ 100px on a path of length 50: 'H' centre ≈ 35 (on-path), 'i' centre
    // ≈ 85 (off the end). clip drops 'i'; extend continues it along the tangent.
    const numCount = (d: unknown) => (String(d).match(/-?\d*\.?\d+/g) ?? []).length;
    const glyphNums = (root: PxNode) => numCount(glyphPaths(root).map(p => p.d).join(''));

    it('pathOverflow:clip drops glyphs past the path end (extend keeps them)', () => {
        const clip = materialiseRaw(alongScene('M0 0L50 0', undefined, 'Hi', 'clip')).root;
        const extend = materialiseRaw(alongScene('M0 0L50 0', undefined, 'Hi', 'extend')).root;
        expect(glyphNums(clip)).toBeGreaterThan(0);                 // on-path 'H' kept
        expect(glyphNums(extend)).toBeGreaterThan(glyphNums(clip)); // 'i' dropped only under clip
    });

    it('pathOverflow default (undefined) = extend — nothing dropped', () => {
        const def = materialiseRaw(alongScene('M0 0L50 0', undefined, 'Hi')).root;
        const extend = materialiseRaw(alongScene('M0 0L50 0', undefined, 'Hi', 'extend')).root;
        expect(glyphNums(def)).toBe(glyphNums(extend));
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
                {
                    type: 'text', id: 't',
                    children: [{ type: 'tspan', text, fontFamily: 'F', fontSize: '100px' }],
                    effects: { text: { useGlyphs: true }, textPath: { path: pathD, startOffset } },
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
        children: [{ type: 'tspan', textContent: 'Hi', fontFamily: 'F', fontSize: '100px', fill: '#f00' }],
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


describe('layoutGlyphTextChars — per-char caret/hit boxes', () => {

    // The editor caret indexes these boxes by DOM char index (TextLayout), and its
    // edit canvas renders one zero-width filler char per EMPTY line so the caret has
    // something to measure. The layout must mirror BOTH: a box per real char (spaces
    // included) plus one zero-width filler box per empty line — otherwise the empty
    // line's caret has no box, every LATER line's caret is off by one, and the
    // per-char hit quads (→ element bbox) never grow to include the empty line.

    /** text → line-tspans, editor shape: each line = a positioned tspan (x/y). An
     *  empty line still carries its folded span STYLE (font) but no text. */
    const threeLinesMiddleEmpty = (): PxNode => ({
        type: 'text', id: 't',
        children: [
            { type: 'tspan', x: 0, y: 0,   textContent: 'Hi', fontFamily: 'F', fontSize: '100px' },
            { type: 'tspan', x: 0, y: 120,             fontFamily: 'F', fontSize: '100px' },
            { type: 'tspan', x: 0, y: 240, textContent: 'H',  fontFamily: 'F', fontSize: '100px' },
        ],
    } as unknown as PxNode);

    it('emits one zero-width filler box for an empty line, in DOM order', () => {
        const boxes = layoutGlyphTextChars(threeLinesMiddleEmpty(), { glyphs });

        // 'H','i' + filler + 'H' — the filler occupies the empty line's DOM slot.
        expect(boxes).toHaveLength(4);

        // The filler sits at the empty line's own pen position (x=0, baseline y=120),
        // zero-width, with the line's REAL font metrics (fontSize 100, ascent 800×0.1)
        // so the caret gets the right height.
        expect(boxes[2]).toEqual({ x: 0, y: 120, width: 0, ascent: 80, fontSize: 100 });

        // The line AFTER the empty one stays index-aligned: its 'H' box is back at the
        // line start on its own baseline. (Without the filler this box would sit at
        // index 2 and the caret for every char here would be off by one.)
        expect(boxes[3].x).toBe(0);
        expect(boxes[3].y).toBe(240);
        expect(boxes[3].width).toBe(70); // H advance 700 × 0.1
    });

    it('a whitespace-only line is NOT empty — the space itself is the box', () => {
        // A space is a real editable char: it advances the pen and gets its own box,
        // so no filler is added (adding one would DESYNC the DOM char indexing).
        const node = {
            type: 'text', id: 't',
            children: [
                { type: 'tspan', x: 0, y: 0,   textContent: 'H', fontFamily: 'F', fontSize: '100px' },
                { type: 'tspan', x: 0, y: 120, textContent: ' ', fontFamily: 'F', fontSize: '100px' },
            ],
        } as unknown as PxNode;
        const boxes = layoutGlyphTextChars(node, { glyphs });
        expect(boxes).toHaveLength(2);
        expect(boxes[1].width).toBe(25); // space advance 250 × 0.1 — a real box, not a filler
    });
});


describe('textGlyphsEffect — span opacity folds into the baked paint', () => {

    it('static span opacity lands on the emitted <path> (attr or style form)', () => {
        for (const span of [
            { type: 'tspan', textContent: 'Hi', fontFamily: 'F', fontSize: '100px', opacity: 0.35 },
            { type: 'tspan', textContent: 'Hi', fontFamily: 'F', fontSize: '100px', style: { opacity: 0.35 } },
        ]) {
            const { root } = run({ useGlyphs: true }, {}, [span]);
            const p = paths(root);
            expect(p).toHaveLength(1);
            expect(p[0].opacity).toBe(0.35);
        }
    });

    it('spans differing ONLY in opacity do not merge into one <path>', () => {
        const { root } = run({ useGlyphs: true }, {}, [
            { type: 'tspan', textContent: 'H', fontFamily: 'F', fontSize: '100px', opacity: 0.35 },
            { type: 'tspan', textContent: 'i', fontFamily: 'F', fontSize: '100px' },
        ]);
        const p = paths(root);
        expect(p).toHaveLength(2);
        expect(p.map(n => n.opacity).sort()).toEqual([0.35, undefined]);
    });

    it('animated span opacity rides the emitted <path> as animate.opacity, verbatim', () => {
        const anim = { keyframes: [{ time: 0, value: 1 }, { time: 1000, value: 0.2 }] };
        const { root } = run({ useGlyphs: true }, {}, [
            { type: 'tspan', textContent: 'Hi', fontFamily: 'F', fontSize: '100px', opacity: 1, animate: { opacity: anim } },
        ]);
        const p = paths(root);
        expect(p).toHaveLength(1);
        expect((p[0].animate as any)?.opacity).toStrictEqual(anim);   // opaque pass-through (pipeline clones nodes)
    });

    it('nested span opacity: NEAREST wins — the collapsed-line fold duplicates it on two levels', () => {
        // The editor wire folds a single-span line's style onto the line-tspan AND keeps
        // the child span — the same opacity on both levels. Multiplying would square it.
        const { root } = run({ useGlyphs: true }, {}, [
            {
                type: 'tspan', opacity: 0.35,
                children: [{ type: 'tspan', textContent: 'Hi', fontFamily: 'F', fontSize: '100px', opacity: 0.35 }],
            },
        ]);
        const p = paths(root);
        expect(p).toHaveLength(1);
        expect(p[0].opacity).toBe(0.35);
    });

    it('a parent span opacity still reaches leaf spans that have none of their own', () => {
        const { root } = run({ useGlyphs: true }, {}, [
            {
                type: 'tspan', opacity: 0.35,
                children: [{ type: 'tspan', textContent: 'Hi', fontFamily: 'F', fontSize: '100px' }],
            },
        ]);
        expect(paths(root)[0].opacity).toBe(0.35);
    });

    it('TEXT-level opacity stays on the <g> (toGroup) — NOT doubled into the paths', () => {
        const { root } = run({ useGlyphs: true }, { opacity: 0.35 });
        const g = collectByType(root, 'g').find(n => n.id === 't');
        expect(g!.opacity).toBe(0.35);
        const p = paths(root);
        expect(p[0].opacity).toBeUndefined();
    });
});


describe('textGlyphsEffect — full span paint folds into the baked paths', () => {

    const SPAN = { type: 'tspan', textContent: 'Hi', fontFamily: 'F', fontSize: '100px' };

    it('every static paint prop lands on the emitted <path>', () => {
        const { root } = run({ useGlyphs: true }, {}, [{
            ...SPAN,
            fillOpacity: 0.5, fillRule: 'evenodd',
            strokeOpacity: 0.25, strokeDasharray: [4, 2], strokeDashoffset: 3,
            strokeLinecap: 'round', strokeLinejoin: 'bevel', strokeMiterlimit: 2,
            mixBlendMode: 'multiply',
        }]);
        const p = paths(root);
        expect(p).toHaveLength(1);
        expect(p[0].fillOpacity).toBe(0.5);
        expect(p[0].fillRule).toBe('evenodd');
        expect(p[0].strokeOpacity).toBe(0.25);
        expect(p[0].strokeDasharray).toEqual([4, 2]);
        expect(p[0].strokeDashoffset).toBe(3);
        expect(p[0].strokeLinecap).toBe('round');
        expect(p[0].strokeLinejoin).toBe('bevel');
        expect(p[0].strokeMiterlimit).toBe(2);
        expect(p[0].mixBlendMode).toBe('multiply');
    });

    it('spans differing ONLY in a paint prop (fillOpacity) do not merge', () => {
        const { root } = run({ useGlyphs: true }, {}, [
            { ...SPAN, textContent: 'H', fillOpacity: 0.5 },
            { ...SPAN, textContent: 'i' },
        ]);
        expect(paths(root)).toHaveLength(2);
    });

    it('paint animate keys are forwarded; GEOMETRY animate keys are not', () => {
        const fillAnim = { keyframes: [{ time: 0, value: '#f00' }, { time: 1000, value: '#00f' }] };
        const dashAnim = { keyframes: [{ time: 0, value: 0 }, { time: 1000, value: 12 }] };
        const { root } = run({ useGlyphs: true }, {}, [{
            ...SPAN,
            animate: {
                fill: fillAnim,
                strokeDashoffset: dashAnim,
                fontSize: { keyframes: [{ time: 0, value: 100 }, { time: 1000, value: 10 }] },   // geometry — baked
                x: { keyframes: [{ time: 0, value: 0 }, { time: 1000, value: 50 }] },            // geometry — baked
            },
        }]);
        const p = paths(root);
        expect(p).toHaveLength(1);
        const animate = p[0].animate as any;
        expect(animate?.fill).toStrictEqual(fillAnim);
        expect(animate?.strokeDashoffset).toStrictEqual(dashAnim);
        expect(animate?.fontSize).toBeUndefined();
        expect(animate?.x).toBeUndefined();
    });

    it('TEXT-level paint props stay off the paths (they ride the <g> and inherit)', () => {
        const { root } = run({ useGlyphs: true }, { fillOpacity: 0.5, strokeDashoffset: 3 });
        const g = collectByType(root, 'g').find(n => n.id === 't');
        expect(g!.fillOpacity).toBe(0.5);          // toGroup carried it
        const p = paths(root);
        expect(p[0].fillOpacity).toBeUndefined();  // not doubled into the paint
        expect(p[0].strokeDashoffset).toBeUndefined();
    });
});


describe('textGlyphsEffect — span filter ref folds into the baked paint', () => {

    it('a span filter lands on the emitted <path>; differing filters do not merge', () => {
        const { root } = run({ useGlyphs: true }, {}, [
            { type: 'tspan', textContent: 'H', fontFamily: 'F', fontSize: '100px', filter: 'url(#blur1)' },
            { type: 'tspan', textContent: 'i', fontFamily: 'F', fontSize: '100px' },
        ]);
        const p = paths(root);
        expect(p).toHaveLength(2);
        expect(p.map(n => n.filter).sort()).toEqual(['url(#blur1)', undefined]);
    });

    it('TEXT-level filter stays on the <g> (toGroup) — not doubled into the paths', () => {
        const { root } = run({ useGlyphs: true }, { filter: 'url(#blur1)' });
        const g = collectByType(root, 'g').find(n => n.id === 't');
        expect(g!.filter).toBe('url(#blur1)');
        expect(paths(root)[0].filter).toBeUndefined();
    });
});
