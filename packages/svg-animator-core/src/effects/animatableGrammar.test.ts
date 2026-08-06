/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// The ONE animatable grammar (SCHEMA-DESIGN §4 E-1/E-2):
//   T | {value: T} | PxPropertyAnimation ({value?, keyframes|kfs, loop?, autoOrient?})
// Every effect slot reads through `readAnimatable` and emits through the shared
// channel writer, so `loop` / the `kfs` alias / the `{value}` base behave the same
// in every effect as they do on `node.animate` channels — including the shared
// loop materialisation. These tests pin that contract per applier.

import { describe, expect, it } from 'vitest';
import type { PxNode } from '../PxAnimatorTypes';
import { collectByType, materialise, materialiseEngine, PxAnimatorEngine } from './effectTestKit';

const doc = (child: Record<string, unknown>): PxNode =>
    ({ type: 'svg', animator: { duration: 2000 }, children: [child] } as unknown as PxNode);

const anim = (n: PxNode | undefined): Record<string, any> => ((n as any)?.animate ?? {});


describe('unified animatable grammar — loop / kfs alias / value base in effect slots', () => {

    it('trimPath.offset — loop rides into animate.strokeDashoffset and expands via the SHARED loop code', () => {
        const input = doc({
            type: 'path', id: 'p', d: 'M0,0 L100,0', stroke: '#000', fill: 'none',
            effects: { trimPath: {
                range: [0, 0.5],
                offset: { keyframes: [{ time: 0, value: 0 }, { time: 500, value: -1 }], loop: true },
            } },
        });

        // Effects-only: the synthesized channel carries the loop verbatim.
        const out = materialise(input);
        const path = collectByType(out, 'path')[0];
        expect(anim(path).strokeDashoffset.loop).toBe(true);

        // Full pipeline: the SAME materialiseInternalLoops code that expands
        // node.animate loops consumes it — loop gone, kfs fill the 2000ms doc.
        const full = materialiseEngine(input, PxAnimatorEngine.frames);
        const fullPath = collectByType(full, 'path')[0];
        const block = anim(fullPath).strokeDashoffset;
        const kfs = block.kfs ?? block.keyframes;
        expect(block.loop).toBeUndefined();
        expect(kfs.length).toBeGreaterThan(2);
        expect(kfs[kfs.length - 1].t ?? kfs[kfs.length - 1].time).toBe(2000);
    });

    it('transformBy.rotate — kfs alias + loop are read like long-form keyframes', () => {
        const out = materialise(doc({
            type: 'rect', width: 100, height: 50,
            effects: { transformBy: {
                rotate: { kfs: [{ t: 0, v: 0 }, { t: 1000, v: 90 }], loop: { alternate: true } },
            } },
        }));
        const wrapper = collectByType(out, 'g')[0];
        const tr = anim(wrapper).transform;
        expect(tr.keyframes.map((k: any) => k.value.rotate)).toEqual([0, 90]);
        expect(tr.loop).toEqual({ alternate: true });
    });

    it('textPath.startOffset — kfs alias + loop + static first-kf baseline', () => {
        const out = materialise(doc({
            type: 'text', children: [{ type: 'tspan', textContent: 'hi' }],
            effects: { textPath: {
                path: 'M0,0 L100,0', pathOverflow: 'clip',
                startOffset: { kfs: [{ t: 0, v: 5 }, { t: 1000, v: 50 }], loop: true },
            } },
        }));
        const tp = collectByType(out, 'textPath')[0] as any;
        expect(tp.animate.startOffset.keyframes.map((k: any) => k.value)).toEqual([5, 50]);
        expect(tp.animate.startOffset.loop).toBe(true);
        expect(tp.startOffset).toBe('5'); // pre-tick baseline, shared writer
    });

    it('repeater.translate — kfs alias gets the ×i per-copy scaling (was silently skipped)', () => {
        const out = materialise(doc({
            type: 'rect', width: 10, height: 10,
            effects: { repeater: {
                copies: 3,
                translate: { kfs: [{ t: 0, v: [0, 0] }, { t: 1000, v: [10, 0] }] },
            } },
        }));
        // Copies 1..2 are wrapped with a per-copy transformation; copy 2 moves ×2.
        const wrappers = collectByType(out, 'g').filter(g => anim(g).transform);
        const lastCopy = anim(wrappers[wrappers.length - 1]).transform;
        expect(lastCopy.keyframes.map((k: any) => k.value.translate)).toEqual([[0, 0], [20, 0]]);
    });

    it('gradient stops — {value: […]} structured static and kfs alias both read', () => {
        const stops = [{ offset: 0, color: '#f00' }, { offset: 1, color: '#00f' }];
        const staticOut = materialise(doc({
            type: 'rect', width: 10, height: 10,
            effects: { fillGradient: { type: 'linear', p1: [0, 0], p2: [10, 0], stops: { value: stops } } },
        }));
        expect(collectByType(staticOut, 'stop').map((s: any) => s.stopColor)).toEqual(['#f00', '#00f']);

        const animOut = materialise(doc({
            type: 'rect', width: 10, height: 10,
            effects: { fillGradient: { type: 'linear', p1: [0, 0], p2: [10, 0],
                stops: { kfs: [{ t: 0, v: stops }, { t: 1000, v: [{ offset: 0, color: '#0f0' }, { offset: 1, color: '#00f' }] }], loop: true } } },
        }));
        const stopNodes = collectByType(animOut, 'stop');
        expect(anim(stopNodes[0]).stopColor.keyframes.map((k: any) => k.value)).toEqual(['#f00', '#0f0']);
        expect(anim(stopNodes[0]).stopColor.loop).toBe(true);
    });
});


describe('grammar-1 geometry slots (were sibling `animate` buckets)', () => {

    it('clipPath.d — static string', () => {
        const out = materialise(doc({
            type: 'rect', width: 10, height: 10,
            effects: { clipPath: { d: 'M0,0 L10,0 L10,10 Z' } },
        }));
        const clipPath = collectByType(out, 'clipPath')[0] as any;
        expect(clipPath.children[0].d).toBe('M0,0 L10,0 L10,10 Z');
    });

    it('clipPath.d — animated slot ({path} kf values) + baseline d', () => {
        const out = materialise(doc({
            type: 'rect', width: 10, height: 10,
            effects: { clipPath: { d: { keyframes: [
                { time: 0, value: { path: 'M0,0 L10,0 L10,10 Z' } },
                { time: 1000, value: { path: 'M0,0 L20,0 L20,20 Z' } } ], loop: true } } },
        }));
        const path = (collectByType(out, 'clipPath')[0] as any).children[0];
        expect(path.animate.d.keyframes).toHaveLength(2);
        expect(path.animate.d.loop).toBe(true);
        expect(path.d).toBe('M0,0 L10,0 L10,10 Z'); // baseline unwrapped from {path}
    });

    it('clipPath — LEGACY sibling animate is still read (folded onto animate.d)', () => {
        const legacyBlock = { keyframes: [
            { time: 0, value: { path: 'M0,0 L10,0 L10,10 Z' } },
            { time: 1000, value: { path: 'M0,0 L20,0 L20,20 Z' } } ] };
        const out = materialise(doc({
            type: 'rect', width: 10, height: 10,
            effects: { clipPath: { d: 'M0,0 L10,0 L10,10 Z', animate: legacyBlock } },
        }));
        const path = (collectByType(out, 'clipPath')[0] as any).children[0];
        expect(path.animate.d).toEqual(legacyBlock);
        expect(path.d).toBe('M0,0 L10,0 L10,10 Z');
    });

    it('gradient p1/r — animated slots split into the def\'s axis channels + baselines', () => {
        const out = materialise(doc({
            type: 'circle', r: 5,
            effects: { fillGradient: {
                type: 'radial',
                c: { keyframes: [
                    { time: 0, value: [50, 40], easing: [0.4, 0, 0.6, 1] },
                    { time: 1000, value: [10, 0] } ], loop: true },
                r: { keyframes: [{ time: 0, value: 5 }, { time: 1000, value: 50 }] },
                stops: [{ offset: 0, color: '#f00' }, { offset: 1, color: '#00f' }],
            } },
        }));
        const def = collectByType(out, 'radialGradient')[0] as any;
        expect(def.animate.cx.keyframes.map((k: any) => k.value)).toEqual([50, 10]);
        expect(def.animate.cy.keyframes.map((k: any) => k.value)).toEqual([40, 0]);
        expect(def.animate.cx.keyframes[0].easing).toEqual([0.4, 0, 0.6, 1]); // easing preserved per axis
        expect(def.animate.cx.loop).toBe(true);
        expect(def.animate.r.keyframes.map((k: any) => k.value)).toEqual([5, 50]);
        expect(def.cx).toBe('50'); // static baselines from the first kf
        expect(def.cy).toBe('40');
        expect(def.r).toBe('5');
    });

    it('gradient — REMOVED legacy per-scalar animate channels are ignored', () => {
        const out = materialise(doc({
            type: 'rect', width: 10, height: 10,
            effects: { fillGradient: {
                type: 'linear', p1: [0, 40], p2: [200, 40],
                animate: { gradientY1: { keyframes: [{ time: 0, value: 40 }, { time: 1000, value: 0 }] } },
                stops: [{ offset: 0, color: '#f00' }, { offset: 1, color: '#00f' }],
            } },
        }));
        const def = collectByType(out, 'linearGradient')[0] as any;
        expect(def.animate).toBeUndefined(); // legacy channels dropped — statics only
        expect(def.x1).toBe('0');
    });
});
