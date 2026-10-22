/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// The ONE animatable grammar (SCHEMA-DESIGN §4 E-1/E-2):
//   T | {value: T} | PxPropertyAnimation ({value?, keyframes|kfs, loop?, autoOrient?})
// Every effect slot reads through `readAnimatable` and emits through the shared
// channel writer, so `loop` / the `kfs` alias / the `{value}` base behave the same
// in every effect as they do on `node.animate` channels — including the shared
// loop materialization. These tests pin that contract per applier.

import { describe, expect, it } from 'vitest';
import { PxTransformPartsSchema, type PxAnimatedSvgDocument, type PxClipPathEffect, type PxFillGradientEffect, type PxKeyframe, type PxKeyframeValue, type PxNode, type PxTimeline } from '../format/PxAnimatorTypes';
import { authoredEntry, collectByType, compiledEntry, entryOf, materialize, materializeEngine, PxTimelineEngine, untyped } from './effectTestKit';

const doc = (child: PxNode): PxAnimatedSvgDocument =>
    // `timeline.duration` is the pre-1.3 spelling: not in the type, still read for old files
    ({ type: 'svg', animator: { timeline: untyped<PxTimeline>({ duration: 2000 }) }, children: [child] });

/** Short `{t, v}` keyframes — not in the type, still read by effect slots (`readAnimatable`). */
const shortKfs = (kfs: Array<{ t: number; v: PxKeyframeValue }>): Array<PxKeyframe<PxKeyframeValue>> => untyped(kfs);


describe('unified animatable grammar — loop / value base in effect slots', () => {

    it('strokeTrim.offset — loop rides into animate.strokeDashoffset and expands via the SHARED loop code', () => {
        const input = doc({
            type: 'path', id: 'p', d: 'M0,0 L100,0', stroke: '#000', fill: 'none',
            effects: { strokeTrim: {
                range: [0, 0.5],
                offset: { keyframes: [{ time: 0, value: 0 }, { time: 500, value: -1 }], loop: true },
            } },
        });

        // Effects-only: the synthesized channel carries the loop verbatim.
        const out = materialize(input);
        const path = collectByType(out, 'path')[0];
        expect(authoredEntry(path, 'strokeDashoffset').loop).toBe(true);

        // Full pipeline: the compile step that expands node.animate loops
        // consumes it — loop gone, kfs fill the 2000ms doc.
        const full = materializeEngine(input, PxTimelineEngine.js);
        const fullPath = collectByType(full, 'path')[0];
        const block = compiledEntry(fullPath, 'strokeDashoffset');
        const kfs = block.keyframes;
        expect('loop' in block).toBe(false);
        expect(kfs.length).toBeGreaterThan(2);
        expect(kfs[kfs.length - 1].time).toBe(2000);
    });

    it('transformBy.rotate — short-form keyframes + loop are read in an effect slot', () => {
        const out = materialize(doc({
            type: 'rect', width: 100, height: 50,
            effects: { transformBy: {
                rotate: { keyframes: shortKfs([{ t: 0, v: 0 }, { t: 1000, v: 90 }]), loop: { direction: 'alternate' } },
            } },
        }));
        const wrapper = collectByType(out, 'g')[0];
        const tr = authoredEntry(wrapper, 'transform');
        expect(tr.keyframes?.map(k => PxTransformPartsSchema.cast(k.value).rotate)).toEqual([0, 90]);
        expect(tr.loop).toEqual({ direction: 'alternate' });
    });

    it('textPath.startOffset — keyframes + loop + static first-kf baseline', () => {
        const out = materialize(doc({
            type: 'text', children: [{ type: 'tspan', textContent: 'hi' }],
            effects: { textPath: {
                pathData: 'M0,0 L100,0', pathOverflow: 'clip',
                startOffset: { keyframes: shortKfs([{ t: 0, v: 5 }, { t: 1000, v: 50 }]), loop: true },
            } },
        }));
        const tp = collectByType(out, 'textPath')[0];
        expect(authoredEntry(tp, 'startOffset').keyframes?.map(k => k.value)).toEqual([5, 50]);
        expect(authoredEntry(tp, 'startOffset').loop).toBe(true);
        expect(tp.startOffset).toBe('5'); // pre-tick baseline, shared writer
    });

    it('repeater.translate — keyframes get the ×i per-copy scaling (was silently skipped)', () => {
        const out = materialize(doc({
            type: 'rect', width: 10, height: 10,
            effects: { repeater: {
                copies: 3,
                translate: { keyframes: shortKfs([{ t: 0, v: [0, 0] }, { t: 1000, v: [10, 0] }]) },
            } },
        }));
        // Copies 1..2 are wrapped with a per-copy transformation; copy 2 moves ×2.
        const wrappers = collectByType(out, 'g').filter(g => entryOf(g, 'transform'));
        const lastCopy = authoredEntry(wrappers[wrappers.length - 1], 'transform');
        expect(lastCopy.keyframes?.map(k => PxTransformPartsSchema.cast(k.value).translate)).toEqual([[0, 0], [20, 0]]);
    });

    it('gradient stops — {value: […]} structured static and keyframes both read', () => {
        const stops = [{ offset: 0, color: '#f00' }, { offset: 1, color: '#00f' }];
        const staticOut = materialize(doc({
            type: 'rect', width: 10, height: 10,
            effects: { fillGradient: { type: 'linear', start: [0, 0], end: [10, 0], stops: { value: stops } } },
        }));
        expect(collectByType(staticOut, 'stop').map(s => s.stopColor)).toEqual(['#f00', '#00f']);

        const animOut = materialize(doc({
            type: 'rect', width: 10, height: 10,
            effects: { fillGradient: { type: 'linear', start: [0, 0], end: [10, 0],
                stops: { keyframes: shortKfs([{ t: 0, v: stops }, { t: 1000, v: [{ offset: 0, color: '#0f0' }, { offset: 1, color: '#00f' }] }]), loop: true } } },
        }));
        const stopNodes = collectByType(animOut, 'stop');
        expect(authoredEntry(stopNodes[0], 'stopColor').keyframes?.map(k => k.value)).toEqual(['#f00', '#0f0']);
        expect(authoredEntry(stopNodes[0], 'stopColor').loop).toBe(true);
    });
});


describe('grammar-1 geometry slots (were sibling `animate` buckets)', () => {

    it('clipPath.d — static string', () => {
        const out = materialize(doc({
            type: 'rect', width: 10, height: 10,
            effects: { clipPath: { pathData: 'M0,0 L10,0 L10,10 Z' } },
        }));
        const clipPath = collectByType(out, 'clipPath')[0];
        expect(clipPath.children?.[0].d).toBe('M0,0 L10,0 L10,10 Z');
    });

    it('clipPath.d — animated slot ({path} kf values) + baseline d', () => {
        const out = materialize(doc({
            type: 'rect', width: 10, height: 10,
            effects: { clipPath: { pathData: { keyframes: [
                { time: 0, value: { pathData: 'M0,0 L10,0 L10,10 Z' } },
                { time: 1000, value: { pathData: 'M0,0 L20,0 L20,20 Z' } } ], loop: true } } },
        }));
        const path = collectByType(out, 'clipPath')[0].children?.[0];
        expect(authoredEntry(path, 'd').keyframes).toHaveLength(2);
        expect(authoredEntry(path, 'd').loop).toBe(true);
        expect(path?.d).toBe('M0,0 L10,0 L10,10 Z'); // baseline unwrapped from {path}
    });

    it('clipPath — the legacy sibling `animate` key is GONE (removed outright, read included)', () => {
        // Review §4.1: one grammar-1 `d` slot like every other effect. A leftover
        // sibling `animate` is ignored by the applier and flagged by strict validation.
        const legacyBlock = { keyframes: [
            { time: 0, value: { pathData: 'M0,0 L10,0 L10,10 Z' } },
            { time: 1000, value: { pathData: 'M0,0 L20,0 L20,20 Z' } } ] };
        const out = materialize(doc({
            type: 'rect', width: 10, height: 10,
            effects: { clipPath: untyped<PxClipPathEffect>({ pathData: 'M0,0 L10,0 L10,10 Z', animate: legacyBlock }) },
        }));
        const path = collectByType(out, 'clipPath')[0].children?.[0];
        expect(path?.animate).toBeUndefined();          // NOT folded any more
        expect(path?.d).toBe('M0,0 L10,0 L10,10 Z');    // static clip still applies
    });

    it('gradient start/radius — animated slots split into the def\'s axis channels + baselines', () => {
        const out = materialize(doc({
            type: 'circle', r: 5,
            effects: { fillGradient: {
                type: 'radial',
                center: { keyframes: [
                    { time: 0, value: [50, 40], easing: [0.4, 0, 0.6, 1] },
                    { time: 1000, value: [10, 0] } ], loop: true },
                radius: { keyframes: [{ time: 0, value: 5 }, { time: 1000, value: 50 }] },
                stops: [{ offset: 0, color: '#f00' }, { offset: 1, color: '#00f' }],
            } },
        }));
        const def = collectByType(out, 'radialGradient')[0];
        expect(authoredEntry(def, 'cx').keyframes?.map(k => k.value)).toEqual([50, 10]);
        expect(authoredEntry(def, 'cy').keyframes?.map(k => k.value)).toEqual([40, 0]);
        expect(authoredEntry(def, 'cx').keyframes?.[0].easing).toEqual([0.4, 0, 0.6, 1]); // easing preserved per axis
        expect(authoredEntry(def, 'cx').loop).toBe(true);
        expect(authoredEntry(def, 'r').keyframes?.map(k => k.value)).toEqual([5, 50]);
        expect(def.cx).toBe('50'); // static baselines from the first kf
        expect(def.cy).toBe('40');
        expect(def.r).toBe('5');
    });

    it('gradient — REMOVED legacy per-scalar animate channels are ignored', () => {
        const out = materialize(doc({
            type: 'rect', width: 10, height: 10,
            effects: { fillGradient: untyped<PxFillGradientEffect>({
                type: 'linear', start: [0, 40], end: [200, 40],
                animate: { gradientY1: { keyframes: [{ time: 0, value: 40 }, { time: 1000, value: 0 }] } },
                stops: [{ offset: 0, color: '#f00' }, { offset: 1, color: '#00f' }],
            }) },
        }));
        const def = collectByType(out, 'linearGradient')[0];
        expect(def.animate).toBeUndefined(); // legacy channels dropped — statics only
        expect(def.x1).toBe('0');
    });
});
