/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { afterEach, assert, beforeEach, describe, expect, it, vi } from 'vitest';
import { convertToWebApiKeyframes } from './PxAnimatorWebApi';
import { PxValueKind, type PxAnimatorRuntimeConfig, type PxBezierPath, type PxRuntimeAnimation } from '@pixodesk/svg-animator-core';

// Regression for the WAAPI `d` (animated path) builder.
//
// The value of a `d` keyframe is a `{ paths: PxBezierPath[] }` record. createCssKf had no branch
// for it, so it fell through to `'' + value` → the literal string "[object Object]". Applied as a
// WAAPI keyframe `{ d: "[object Object]" }`, the browser resolved an invalid path and the <path>
// rendered EMPTY — animated-`d` shapes (chart areas, loader arcs) vanished in forced WAAPI while
// svg-css, which emits `d: path("…")`, rendered them (79247-chart-animation, 53461, 82738, 98620,
// 99439). The builder must emit the same `path("…")` CSS-`d` syntax via bezierToSvgPath.

/** A closed triangle whose in/out tangents coincide with the vertices → straight-line segments. */
function triangle(dx: number): PxBezierPath {
    const v: Array<[number, number]> = [[dx, 0], [dx + 10, 0], [dx + 5, 10]];
    return { v, i: v.map(p => [...p] as [number, number]), o: v.map(p => [...p] as [number, number]), c: true };
}

const CONFIG: PxAnimatorRuntimeConfig = { duration: 320 };   // the FLAT view keeps `duration` (= the window length)

/** jsdom has no CSS.supports; stub a REALIZTIC one — `d` is supported only as `path("…")`, so the
 *  old "[object Object]" value would (correctly) be reported unsupported. */
beforeEach(() => {
    vi.stubGlobal('CSS', {
        supports: (k: string, v: string) => (k === 'd' ? /^path\(".*"\)$/.test(v) : true),
    });
});
afterEach(() => {
    vi.unstubAllGlobals();
});

describe('convertToWebApiKeyframes — animated `d` path', () => {

    function build(): Map<string, Keyframe[]> {
        const animDef: PxRuntimeAnimation = {
            d: { kind: PxValueKind.path, keyframes: [{ time: 0, value: { paths: [triangle(0)] } }, { time: 320, value: { paths: [triangle(20)] } }] },
        };
        return convertToWebApiKeyframes(animDef, new Set<string>(), CONFIG);
    }

    it('emits a real `path("…")` string, not "[object Object]"', () => {
        const kfs = build().get('d');
        expect(kfs).toBeDefined();
        assert(kfs, 'no `d` keyframes were built');
        expect(kfs.length).toBeGreaterThan(0);
        for (const kf of kfs) {
            const d = kf.d;
            expect(typeof d).toBe('string');
            expect(d).toMatch(/^path\("M/);          // proper CSS `d` syntax
            expect(d).not.toContain('[object Object]');
        }
    });

    it('carries the actual interpolated geometry (both keyframes distinct)', () => {
        const kfs = build().get('d');
        assert(kfs, 'no `d` keyframes were built');
        const first = kfs[0].d;
        const last = kfs[kfs.length - 1].d;
        expect(first).toContain('M0,0');             // triangle(0)
        expect(last).toContain('M20,0');             // triangle(20)
    });

    it('a straight corner at one keyframe and a curved one at another emit EQUAL command sequences', () => {
        // WAAPI interpolates `path()` only across identical command lists — forceCurves in
        // the `d` branch keeps a zero-tangent (straight) keyframe structurally equal to a
        // curved sibling, so the animation tweens instead of flipping at 50%.
        const straight: PxBezierPath = { v: [[0, 0], [100, 0], [100, 100]], c: true };                  // sharp corners
        const curved: PxBezierPath = { v: [[0, 0], [100, 0], [100, 100]], o: [[40, -20], [100, 40], [60, 100]], i: [[60, -20], [100, 60], [40, 100]], c: true };
        const animDef: PxRuntimeAnimation = {
            d: { kind: PxValueKind.path, keyframes: [{ time: 0, value: { paths: [straight] } }, { time: 320, value: { paths: [curved] } }] },
        };
        const kfs = convertToWebApiKeyframes(animDef, new Set<string>(), CONFIG).get('d');
        assert(kfs, 'no `d` keyframes were built');
        const seqs = new Set(kfs.map(kf => String(kf.d).replace(/[^MLCZmlcz]/g, '')));
        expect([...seqs]).toHaveLength(1);
        expect([...seqs][0]).not.toContain('L');
    });

    it('does NOT flag `d` as an unsupported attr (it is emitted as animatable path())', () => {
        const unsupported = new Set<string>();
        const animDef: PxRuntimeAnimation = {
            d: { kind: PxValueKind.path, keyframes: [{ time: 0, value: { paths: [triangle(0)] } }, { time: 320, value: { paths: [triangle(20)] } }] },
        };
        convertToWebApiKeyframes(animDef, unsupported, CONFIG);
        expect(unsupported.has('d')).toBe(false);
    });
});
