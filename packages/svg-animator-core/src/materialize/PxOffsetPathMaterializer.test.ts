import { assert, describe, expect, it } from 'vitest';
import { materializeOffsetPathsInTree } from './PxOffsetPathMaterializer';
import type { PxDocument, PxNode, PxPropertyAnimation } from '../format/PxAnimatorTypes';
import { authoredEntry, entryOf } from '../effects/effectTestKit';

const doc = (node: PxNode): PxDocument => ({
    type: 'svg', viewBox: '0 0 200 200',
    animator: { timeline: { outTime: 1000 } },
    children: [node],
});

const curvedTransform = (extra?: PxPropertyAnimation): PxPropertyAnimation => ({
    alongPathMode: 'offsetPath',
    keyframes: [
        { time: 0, value: { translate: [20, 120] }, tangentOut: [28, -48] },
        { time: 1000, value: { translate: [80, 120] } },
    ],
    ...extra,
});

describe('offset-path materializer (lightweight JSON → player)', () => {

    it('rewrites a marked curved transform into offset styles + an offsetDistance binding', () => {
        const out = materializeOffsetPathsInTree(doc({
            type: 'rect', width: 26, height: 8,
            transform: { translate: [20, 120] },
            animate: { transform: curvedTransform() },
        }));
        const n = out.children?.[0];
        assert(n, 'the node survives');
        expect(n.style?.offsetPath).toBe("path('M20,120C48,72,80,120,80,120')");
        expect(n.style?.offsetRotate).toBe('0deg');
        expect(n.style?.offsetDistance).toBe('0%');
        expect(entryOf(n, 'transform')).toBeUndefined();
        const dist = authoredEntry(n, 'offsetDistance').keyframes;
        assert(dist, 'offsetDistance carries keyframes');
        expect(dist.map(k => k.time)).toEqual([0, 1000]);
        expect(dist[0].value).toBe(0);
        expect(dist[1].value).toBe(1);
        // The static translate must NOT survive — position now comes from the path.
        expect(n.transform).toBeUndefined();
    });

    it('autoOrient becomes offset-rotate:auto; multi-segment values are arc-length fractions', () => {
        const out = materializeOffsetPathsInTree(doc({
            type: 'rect',
            animate: { transform: {
                alongPathMode: 'offsetPath', autoOrient: true,
                keyframes: [
                    { time: 0, value: { translate: [0, 0] }, tangentOut: [10, 0] },
                    { time: 500, value: { translate: [100, 0] }, tangentIn: [-10, 0], tangentOut: [10, 0] },
                    // second segment is ~3x the first — the value fraction must reflect LENGTH, not time
                    { time: 1000, value: { translate: [400, 0] }, tangentIn: [-10, 0] },
                ],
            } },
        }));
        const n = out.children?.[0];
        assert(n, 'the node survives');
        expect(n.style?.offsetRotate).toBe('auto');
        const vs = authoredEntry(n, 'offsetDistance').keyframes?.map(k => k.value);
        assert(vs, 'offsetDistance carries keyframes');
        expect(vs[0]).toBe(0);
        expect(vs[1]).toBeGreaterThan(0.2);
        expect(vs[1]).toBeLessThan(0.3);   // ≈100/400 by length, NOT 0.5 by time
        expect(vs[2]).toBe(1);
    });

    it('leaves non-candidates alone: no mode, straight lines, or extra animated parts', () => {
        const unmarked: PxPropertyAnimation = { keyframes: [
            { time: 0, value: { translate: [0, 0] }, tangentOut: [5, 5] },
            { time: 1000, value: { translate: [10, 10] } }] };
        const straight: PxPropertyAnimation = { alongPathMode: 'offsetPath', keyframes: [
            { time: 0, value: { translate: [0, 0] } },
            { time: 1000, value: { translate: [10, 10] } }] };
        const rotating: PxPropertyAnimation = { alongPathMode: 'offsetPath', keyframes: [
            { time: 0, value: { translate: [0, 0], rotate: 0 }, tangentOut: [5, 5] },
            { time: 1000, value: { translate: [10, 10], rotate: 90 } }] };
        for (const transform of [unmarked, straight, rotating]) {
            const out = materializeOffsetPathsInTree(doc({ type: 'rect', animate: { transform } }));
            const n = out.children?.[0];
            assert(n, 'the node survives');
            expect(entryOf(n, 'transform')).toBeDefined();
            expect(entryOf(n, 'offsetDistance')).toBeUndefined();
            expect(n.style?.offsetPath).toBeUndefined();
        }
    });

    it('a first-frame static `rotate` overridden by `rotate: 0` on every keyframe: still a candidate, and the static is dropped', () => {
        // How the Editor writes an auto-orient motion path: the static transform carries the
        // tangent at the first frame (so the REST picture matches frame 0), and every keyframe
        // carries `rotate: 0` so that pose never leaks into the animation. Under offset-path
        // the tangent comes from `offset-rotate: auto` — a surviving static rotate would ADD.
        const out = materializeOffsetPathsInTree(doc({
            type: 'rect',
            transform: { translate: [20, 120], rotate: -59.7436 },
            animate: { transform: {
                alongPathMode: 'offsetPath', autoOrient: true,
                keyframes: [
                    { time: 0, value: { translate: [20, 120], rotate: 0 }, tangentOut: [28, -48] },
                    { time: 1000, value: { translate: [80, 120], rotate: 0 } },
                ],
            } },
        }));
        const n = out.children?.[0];
        assert(n, 'the node survives');
        expect(n.style?.offsetRotate).toBe('auto');
        expect(entryOf(n, 'transform')).toBeUndefined();
        expect(entryOf(n, 'offsetDistance')).toBeDefined();
        expect(n.transform).toBeUndefined();

        // A static rotate the keyframes do NOT override is a real design rotation — it survives.
        const kept = materializeOffsetPathsInTree(doc({
            type: 'rect',
            transform: { translate: [20, 120], rotate: 30 },
            animate: { transform: curvedTransform() },
        }));
        expect(kept.children?.[0].transform).toEqual({ rotate: 30 });

        // A NON-zero rotate in a keyframe is an animated part — not a candidate.
        const turning = materializeOffsetPathsInTree(doc({
            type: 'rect',
            animate: { transform: { alongPathMode: 'offsetPath', keyframes: [
                { time: 0, value: { translate: [0, 0], rotate: 0 }, tangentOut: [5, 5] },
                { time: 1000, value: { translate: [10, 10], rotate: 10 } }] } },
        }));
        expect(entryOf(turning.children?.[0], 'transform')).toBeDefined();
    });

    it('carries loop and easing onto the offsetDistance binding', () => {
        const out = materializeOffsetPathsInTree(doc({
            type: 'rect',
            animate: { transform: curvedTransform({ loop: true }) },
        }));
        expect(authoredEntry(out.children?.[0], 'offsetDistance').loop).toBe(true);
    });

});
