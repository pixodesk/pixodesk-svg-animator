/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { convertToWebApiKeyframes } from './PxAnimatorWebApi';
import type { PxAnimationDefinition, PxAnimatorConfig, PxBezierPath } from '@pixodesk/svg-animator-core';

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

const CONFIG: PxAnimatorConfig = { duration: 320 };

/** jsdom has no CSS.supports; stub a REALISTIC one — `d` is supported only as `path("…")`, so the
 *  old "[object Object]" value would (correctly) be reported unsupported. */
beforeEach(() => {
    (globalThis as unknown as { CSS: { supports: (k: string, v: string) => boolean } }).CSS = {
        supports: (k: string, v: string) => (k === 'd' ? /^path\(".*"\)$/.test(v) : true),
    };
});
afterEach(() => {
    delete (globalThis as unknown as { CSS?: unknown }).CSS;
});

describe('convertToWebApiKeyframes — animated `d` path', () => {

    function build(): Map<string, Keyframe[]> {
        const animDef = {
            d: { keyframes: [{ t: 0, v: { paths: [triangle(0)] } }, { t: 320, v: { paths: [triangle(20)] } }] },
        } as unknown as PxAnimationDefinition;
        return convertToWebApiKeyframes(animDef, new Set<string>(), CONFIG);
    }

    it('emits a real `path("…")` string, not "[object Object]"', () => {
        const kfs = build().get('d');
        expect(kfs).toBeDefined();
        expect(kfs!.length).toBeGreaterThan(0);
        for (const kf of kfs!) {
            const d = (kf as unknown as { d: string }).d;
            expect(typeof d).toBe('string');
            expect(d).toMatch(/^path\("M/);          // proper CSS `d` syntax
            expect(d).not.toContain('[object Object]');
        }
    });

    it('carries the actual interpolated geometry (both keyframes distinct)', () => {
        const kfs = build().get('d')!;
        const first = (kfs[0] as unknown as { d: string }).d;
        const last = (kfs[kfs.length - 1] as unknown as { d: string }).d;
        expect(first).toContain('M0,0');             // triangle(0)
        expect(last).toContain('M20,0');             // triangle(20)
    });

    it('a straight corner at one keyframe and a curved one at another emit EQUAL command sequences', () => {
        // WAAPI interpolates `path()` only across identical command lists — forceCurves in
        // the `d` branch keeps a zero-tangent (straight) keyframe structurally equal to a
        // curved sibling, so the animation tweens instead of flipping at 50%.
        const straight = { v: [[0, 0], [100, 0], [100, 100]], c: true };                  // sharp corners
        const curved = { v: [[0, 0], [100, 0], [100, 100]], o: [[40, -20], [100, 40], [60, 100]], i: [[60, -20], [100, 60], [40, 100]], c: true };
        const animDef = {
            d: { keyframes: [{ t: 0, v: { paths: [straight] } }, { t: 320, v: { paths: [curved] } }] },
        } as unknown as PxAnimationDefinition;
        const kfs = convertToWebApiKeyframes(animDef, new Set<string>(), CONFIG).get('d')!;
        const seqs = new Set(kfs.map(kf => ((kf as unknown as { d: string }).d).replace(/[^MLCZmlcz]/g, '')));
        expect([...seqs]).toHaveLength(1);
        expect([...seqs][0]).not.toContain('L');
    });

    it('does NOT flag `d` as an unsupported attr (it is emitted as animatable path())', () => {
        const unsupported = new Set<string>();
        const animDef = {
            d: { keyframes: [{ t: 0, v: { paths: [triangle(0)] } }, { t: 320, v: { paths: [triangle(20)] } }] },
        } as unknown as PxAnimationDefinition;
        convertToWebApiKeyframes(animDef, unsupported, CONFIG);
        expect(unsupported.has('d')).toBe(false);
    });
});
