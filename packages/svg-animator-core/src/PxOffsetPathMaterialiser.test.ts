import { describe, expect, it } from 'vitest';
import { materialiseOffsetPathsInTree } from './PxOffsetPathMaterialiser';
import type { PxAnimatedSvgDocument, PxNode } from './PxAnimatorTypes';

const doc = (node: PxNode): PxAnimatedSvgDocument => ({
    type: 'svg', viewBox: '0 0 200 200',
    animator: { duration: 1000 },
    children: [node],
} as never);

const curvedTransform = (extra?: object) => ({
    alongPathMode: 'offsetPath',
    keyframes: [
        { time: 0, value: { translate: [20, 120] }, tangentOut: [28, -48] },
        { time: 1000, value: { translate: [80, 120] } },
    ],
    ...extra,
} as never);

describe('offset-path materialiser (lightweight JSON → player)', () => {

    it('rewrites a marked curved transform into offset styles + an offsetDistance binding', () => {
        const out = materialiseOffsetPathsInTree(doc({
            type: 'rect', width: 26, height: 8,
            transform: { translate: [20, 120] },
            animate: { transform: curvedTransform() },
        } as never));
        const n = out.children![0] as never as { style: Record<string, string>; animate: Record<string, unknown>; transform?: unknown };
        expect(n.style.offsetPath).toBe("path('M20,120C48,72,80,120,80,120')");
        expect(n.style.offsetRotate).toBe('0deg');
        expect(n.style.offsetDistance).toBe('0%');
        expect(n.animate.transform).toBeUndefined();
        const dist = n.animate.offsetDistance as { keyframes: Array<{ t: number; v: number }> };
        expect(dist.keyframes.map(k => k.t)).toEqual([0, 1000]);
        expect(dist.keyframes[0].v).toBe(0);
        expect(dist.keyframes[1].v).toBe(1);
        // The static translate must NOT survive — position now comes from the path.
        expect(n.transform).toBeUndefined();
    });

    it('autoOrient becomes offset-rotate:auto; multi-segment values are arc-length fractions', () => {
        const out = materialiseOffsetPathsInTree(doc({
            type: 'rect',
            animate: { transform: {
                alongPathMode: 'offsetPath', autoOrient: true,
                keyframes: [
                    { time: 0, value: { translate: [0, 0] }, tangentOut: [10, 0] },
                    { time: 500, value: { translate: [100, 0] }, tangentIn: [-10, 0], tangentOut: [10, 0] },
                    // second segment is ~3x the first — the value fraction must reflect LENGTH, not time
                    { time: 1000, value: { translate: [400, 0] }, tangentIn: [-10, 0] },
                ],
            } } as never,
        } as never));
        const n = out.children![0] as never as { style: Record<string, string>; animate: { offsetDistance: { keyframes: Array<{ t: number; v: number }> } } };
        expect(n.style.offsetRotate).toBe('auto');
        const vs = n.animate.offsetDistance.keyframes.map(k => k.v);
        expect(vs[0]).toBe(0);
        expect(vs[1]).toBeGreaterThan(0.2);
        expect(vs[1]).toBeLessThan(0.3);   // ≈100/400 by length, NOT 0.5 by time
        expect(vs[2]).toBe(1);
    });

    it('leaves non-candidates alone: no mode, straight lines, or extra animated parts', () => {
        const unmarked = { keyframes: [
            { time: 0, value: { translate: [0, 0] }, tangentOut: [5, 5] },
            { time: 1000, value: { translate: [10, 10] } }] };
        const straight = { alongPathMode: 'offsetPath', keyframes: [
            { time: 0, value: { translate: [0, 0] } },
            { time: 1000, value: { translate: [10, 10] } }] };
        const rotating = { alongPathMode: 'offsetPath', keyframes: [
            { time: 0, value: { translate: [0, 0], rotate: 0 }, tangentOut: [5, 5] },
            { time: 1000, value: { translate: [10, 10], rotate: 90 } }] };
        for (const transform of [unmarked, straight, rotating]) {
            const out = materialiseOffsetPathsInTree(doc({ type: 'rect', animate: { transform } } as never));
            const n = out.children![0] as never as { style?: unknown; animate: Record<string, unknown> };
            expect(n.animate.transform).toBeDefined();
            expect(n.animate.offsetDistance).toBeUndefined();
            expect((n.style as Record<string, unknown> | undefined)?.offsetPath).toBeUndefined();
        }
    });

    it('carries loop and easing onto the offsetDistance binding', () => {
        const out = materialiseOffsetPathsInTree(doc({
            type: 'rect',
            animate: { transform: curvedTransform({ loop: true }) },
        } as never));
        const n = out.children![0] as never as { animate: { offsetDistance: { loop?: unknown; keyframes: Array<{ e?: unknown }> } } };
        expect(n.animate.offsetDistance.loop).toBe(true);
    });

});
