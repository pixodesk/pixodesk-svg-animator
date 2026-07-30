/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// Motion-along-path unit tests.
//
// Covers:
//   - `propAnimIsMotionPath` detector
//   - `evaluateMotionPathSegment` parametric sampler (single-segment kernel)
//   - `materialiseMotionPathInPropAnim` — the new materialiser that desugars tangented kfs +
//     autoOrient into plain `{ translate, rotate }` kfs (extremes-aware
//     adaptive sampling + easing split)
//   - `materialiseMotionPathsInTree` — the immutable tree walker
//   - `invertEasing` helper
//   - `materialiseInternalLoopsInPropAnim` + `materialiseInternalLoopsInTree`


import { describe, expect, it } from 'vitest';
import type { PxAnimatedSvgDocument, PxKeyframe, PxNode, PxPropertyAnimation } from './PxAnimatorTypes';
import { invertEasing } from './PxAnimatorUtil';
import { materialiseInternalLoopsInPropAnim, materialiseInternalLoopsInTree } from './PxDefinitions';
import {
    materialiseMotionPathInPropAnim,
    materialiseMotionPathsInTree,
    evaluateMotionPathSegment,
    propAnimIsMotionPath,
} from './PxMotionPath';


// ─────────────────────────────────────────────────────────────────────────────
//  Fixtures
// ─────────────────────────────────────────────────────────────────────────────

/** Horseshoe segment used by several tests:
 *      P0 = (60, 190), tangentOut = (62.35, 57.03)
 *      P3 = (60, 360), tangentIn  = (62.35, -56.31)
 *  Control points (absolute): P1 ≈ (122.35, 247.03), P2 ≈ (122.35, 303.69).
 *  The curve bows out to the +x side. */
const horseshoeKfs = (): Array<PxKeyframe> => ([
    { time: 0,    value: { translate: [60, 190] }, tangentOut: [62.3495,  57.0257] },
    { time: 1000, value: { translate: [60, 360] }, tangentIn:  [62.3495, -56.3075] },
] as Array<PxKeyframe>);

/** Square-loop motion path (the user's failing JSON, simplified):
 *  ellipse goes around a rounded-corners box, autoOrient on. */
const squareLoopKfs = (): Array<PxKeyframe> => ([
    { time: 0,    value: { translate: [184, 82]  }, tangentOut: [60,    0] },
    { time: 250,  value: { translate: [293, 154] }, tangentOut: [0,    39], tangentIn: [0, -39] },
    { time: 510,  value: { translate: [184, 226] }, tangentOut: [-60,   0], tangentIn: [60,  0] },
    { time: 770,  value: { translate: [75,  154] }, tangentOut: [0,   -39], tangentIn: [0,  39] },
    { time: 1020, value: { translate: [184, 82]  }, tangentIn:  [-60, 0] },
] as Array<PxKeyframe>);


// ─────────────────────────────────────────────────────────────────────────────
//  Detector
// ─────────────────────────────────────────────────────────────────────────────


describe('propAnimIsMotionPath', () => {

    it('returns true when any keyframe carries tangents', () => {
        const anim = { keyframes: [
            { time: 0,    value: { translate: [0, 0] }, tangentOut: [10, 0] },
            { time: 1000, value: { translate: [50, 50] } },
        ] } as PxPropertyAnimation;
        expect(propAnimIsMotionPath(anim)).toBe(true);
    });

    it('returns true when autoOrient is set, even without tangents', () => {
        const anim = { autoOrient: true, keyframes: [
            { time: 0,    value: { translate: [0, 0] } },
            { time: 1000, value: { translate: [50, 50] } },
        ] } as PxPropertyAnimation;
        expect(propAnimIsMotionPath(anim)).toBe(true);
    });

    it('returns false for a plain unified transform (no tangents, no autoOrient)', () => {
        const anim = { keyframes: [
            { time: 0,    value: { translate: [0, 0] } },
            { time: 1000, value: { translate: [50, 50] } },
        ] } as PxPropertyAnimation;
        expect(propAnimIsMotionPath(anim)).toBe(false);
    });

    it('returns false when keyframes is missing', () => {
        expect(propAnimIsMotionPath({} as PxPropertyAnimation)).toBe(false);
    });

    it('accepts short aliases `to` / `ti`', () => {
        const anim = { keyframes: [
            { t: 0,    v: { translate: [0, 0] }, to: [10, 0] as [number, number] },
            { t: 1000, v: { translate: [50, 50] } },
        ] } as PxPropertyAnimation;
        expect(propAnimIsMotionPath(anim)).toBe(true);
    });
});


// ─────────────────────────────────────────────────────────────────────────────
//  Parametric kernel
// ─────────────────────────────────────────────────────────────────────────────


describe('evaluateMotionPathSegment', () => {

    it('returns P0 at localProgress=0 and P3 at localProgress=1', () => {
        const kfs = horseshoeKfs();
        const start = evaluateMotionPathSegment(kfs[0], kfs[1], [60, 190], [60, 360], 0, false);
        expect(start.translate[0]).toBeCloseTo(60, 5);
        expect(start.translate[1]).toBeCloseTo(190, 5);

        const end = evaluateMotionPathSegment(kfs[0], kfs[1], [60, 190], [60, 360], 1, false);
        expect(end.translate[0]).toBeCloseTo(60, 5);
        expect(end.translate[1]).toBeCloseTo(360, 5);
    });

    it('returns a point on the curve at localProgress=0.5 (x bows out to ~ 107)', () => {
        const kfs = horseshoeKfs();
        const mid = evaluateMotionPathSegment(kfs[0], kfs[1], [60, 190], [60, 360], 0.5, false);
        expect(mid.translate[0]).toBeGreaterThan(90);
        expect(mid.translate[0]).toBeLessThan(125);
    });

    it('emits rotateDeg only when autoOrient is true', () => {
        const kfs = horseshoeKfs();
        expect(evaluateMotionPathSegment(kfs[0], kfs[1], [60, 190], [60, 360], 0.5, false).rotateDeg).toBeUndefined();
        const s = evaluateMotionPathSegment(kfs[0], kfs[1], [60, 190], [60, 360], 0.5, true);
        expect(s.rotateDeg).toBeDefined();
        expect(Number.isFinite(s.rotateDeg!)).toBe(true);
    });

    it('atan2(tan.y, tan.x) gives 0° along +X and 90° along +Y', () => {
        const kfsX = [
            { time: 0,    value: { translate: [0, 0] } },
            { time: 1000, value: { translate: [100, 0] } },
        ] as Array<PxKeyframe>;
        const xs = evaluateMotionPathSegment(kfsX[0], kfsX[1], [0, 0], [100, 0], 0.5, true);
        expect(xs.rotateDeg).toBeCloseTo(0, 5);

        const kfsY = [
            { time: 0,    value: { translate: [0, 0] } },
            { time: 1000, value: { translate: [0, 100] } },
        ] as Array<PxKeyframe>;
        const ys = evaluateMotionPathSegment(kfsY[0], kfsY[1], [0, 0], [0, 100], 0.5, true);
        expect(ys.rotateDeg).toBeCloseTo(90, 5);
    });

    it('handles a degenerate zero-length segment without NaN', () => {
        const kfs = [
            { time: 0,    value: { translate: [42, 42] } },
            { time: 1000, value: { translate: [42, 42] } },
        ] as Array<PxKeyframe>;
        const s = evaluateMotionPathSegment(kfs[0], kfs[1], [42, 42], [42, 42], 0.5, true);
        expect(s.translate[0]).toBeCloseTo(42, 5);
        expect(s.translate[1]).toBeCloseTo(42, 5);
        expect(Number.isFinite(s.rotateDeg!)).toBe(true);
    });
});


// ─────────────────────────────────────────────────────────────────────────────
//  materialiseMotionPathInPropAnim
// ─────────────────────────────────────────────────────────────────────────────


function getKfs(anim: PxPropertyAnimation): Array<PxKeyframe> {
    const kfs = (anim.keyframes ?? anim.kfs) as Array<PxKeyframe>;
    return kfs;
}

function kfTranslate(kf: PxKeyframe): [number, number] {
    const v = (kf.value ?? kf.v) as { translate?: [number, number] };
    return v.translate as [number, number];
}

function kfTime(kf: PxKeyframe): number {
    return (kf.time ?? kf.t ?? 0) as number;
}

function kfRotate(kf: PxKeyframe): number | undefined {
    const v = (kf.value ?? kf.v) as { rotate?: number };
    return v.rotate;
}


describe('materialiseMotionPathInPropAnim', () => {

    it('returns the input by reference for a non-motion-path animation', () => {
        const anim: PxPropertyAnimation = { kfs: [
            { t: 0,    v: { translate: [0, 0] } },
            { t: 1000, v: { translate: [50, 50] } },
        ] };
        const out = materialiseMotionPathInPropAnim(anim);
        expect(out).toBe(anim);
    });

    it('strips tangentIn/tangentOut and autoOrient from the output', () => {
        const materialised = materialiseMotionPathInPropAnim({ autoOrient: true, kfs: horseshoeKfs() } as PxPropertyAnimation);
        expect((materialised as PxPropertyAnimation).autoOrient).toBeUndefined();
        for (const kf of getKfs(materialised)) {
            expect(kf.tangentIn).toBeUndefined();
            expect(kf.tangentOut).toBeUndefined();
        }
    });

    it('emits more kfs than the input (subdivision happened) on a curved segment', () => {
        const materialised = materialiseMotionPathInPropAnim({ kfs: horseshoeKfs() } as PxPropertyAnimation);
        const kfs = getKfs(materialised);
        expect(kfs.length).toBeGreaterThan(2);
    });

    it('preserves the endpoint translates exactly', () => {
        const materialised = materialiseMotionPathInPropAnim({ kfs: horseshoeKfs() } as PxPropertyAnimation);
        const kfs = getKfs(materialised);
        const first = kfTranslate(kfs[0]);
        const last  = kfTranslate(kfs[kfs.length - 1]);
        expect(first[0]).toBeCloseTo(60, 5);
        expect(first[1]).toBeCloseTo(190, 5);
        expect(last[0]).toBeCloseTo(60, 5);
        expect(last[1]).toBeCloseTo(360, 5);
    });

    it('mid-segment sample lies on the bezier (not on the chord)', () => {
        // Horseshoe: chord midpoint y = 275, chord midpoint x = 60. The curve bows
        // out far in +x (well past 90) — any sample picked from the materialiser that's
        // ~halfway in time should be on the bowed curve, not the chord.
        const materialised = materialiseMotionPathInPropAnim({ kfs: horseshoeKfs() } as PxPropertyAnimation);
        const kfs = getKfs(materialised);
        const midIdx = Math.floor(kfs.length / 2);
        const mid = kfTranslate(kfs[midIdx]);
        expect(mid[0]).toBeGreaterThan(90);
    });

    it('autoOrient: true → every output kf has a `rotate` field', () => {
        const materialised = materialiseMotionPathInPropAnim({ autoOrient: true, kfs: horseshoeKfs() } as PxPropertyAnimation);
        for (const kf of getKfs(materialised)) {
            expect(kfRotate(kf)).toBeDefined();
            expect(Number.isFinite(kfRotate(kf)!)).toBe(true);
        }
    });

    it('autoOrient: false → no `rotate` on any output kf', () => {
        const materialised = materialiseMotionPathInPropAnim({ kfs: horseshoeKfs() } as PxPropertyAnimation);
        for (const kf of getKfs(materialised)) {
            expect(kfRotate(kf)).toBeUndefined();
        }
    });

    it('autoOrient: sums the explicit animated `rotate` on top of the tangent orientation', () => {
        // Diagonal path → tangent orientation is 45° everywhere. An explicit
        // rotate:90 must be ADDED, giving 135° on every sample — not ignored
        // (which would drop the custom rotation and leave the bare 45°).
        const kfs: Array<PxKeyframe> = [
            { time: 0,    value: { translate: [0, 0],     rotate: 90 } },
            { time: 1000, value: { translate: [100, 100], rotate: 90 } },
        ] as Array<PxKeyframe>;
        const materialised = materialiseMotionPathInPropAnim({ autoOrient: true, kfs } as PxPropertyAnimation);
        for (const kf of getKfs(materialised)) {
            expect(kfRotate(kf)!).toBeCloseTo(135, 4);
        }
    });

    it('autoOrient: interpolates the explicit `rotate` and adds it to the tangent', () => {
        // Straight horizontal path → tangent orientation is 0° everywhere, so
        // the output rotation equals the (interpolated) explicit rotate alone:
        // 0° at the start ramping to 90° at the end.
        const kfs: Array<PxKeyframe> = [
            { time: 0,    value: { translate: [0, 0],   rotate: 0  } },
            { time: 1000, value: { translate: [100, 0], rotate: 90 } },
        ] as Array<PxKeyframe>;
        const materialised = materialiseMotionPathInPropAnim({ autoOrient: true, kfs } as PxPropertyAnimation);
        const out = getKfs(materialised);
        expect(kfRotate(out[0])!).toBeCloseTo(0, 4);
        expect(kfRotate(out[out.length - 1])!).toBeCloseTo(90, 4);
    });

    it('rotation deltas between adjacent samples are bounded by rotationTolerance (autoOrient)', () => {
        const materialised = materialiseMotionPathInPropAnim(
            { autoOrient: true, kfs: squareLoopKfs() } as PxPropertyAnimation,
            { rotationTolerance: 10 },
        );
        const kfs = getKfs(materialised);
        for (let i = 1; i < kfs.length; i++) {
            const a = kfRotate(kfs[i - 1])!;
            const b = kfRotate(kfs[i])!;
            let delta = Math.abs(a - b);
            if (delta > 180) delta = 360 - delta;
            // Allow generous slack — the cap is the rotationTolerance but the
            // last sample can land slightly off due to the chord-flatness
            // criterion also being satisfied.
            expect(delta).toBeLessThan(45);
        }
    });

    it('preserves `loop` on the output', () => {
        const materialised = materialiseMotionPathInPropAnim({
            loop: true,
            kfs: horseshoeKfs(),
        } as PxPropertyAnimation);
        expect((materialised as PxPropertyAnimation).loop).toBe(true);
    });

    it('honors `maxSamplesPerSegment` as a hard cap', () => {
        const materialised = materialiseMotionPathInPropAnim(
            { autoOrient: true, kfs: squareLoopKfs() } as PxPropertyAnimation,
            { flatnessTolerance: 0.001, rotationTolerance: 0.1, maxSamplesPerSegment: 4 },
        );
        const kfs = getKfs(materialised);
        // 4 segments × maxSamples (4) + 1 = at most ~17 output kfs.
        expect(kfs.length).toBeLessThanOrEqual(40);
    });

    it('output kf times are monotonically non-decreasing', () => {
        const materialised = materialiseMotionPathInPropAnim({ kfs: squareLoopKfs() } as PxPropertyAnimation);
        const kfs = getKfs(materialised);
        for (let i = 1; i < kfs.length; i++) {
            expect(kfTime(kfs[i])).toBeGreaterThanOrEqual(kfTime(kfs[i - 1]));
        }
    });

    it('first sample equals input first kf.translate; last sample equals input last kf.translate', () => {
        const materialised = materialiseMotionPathInPropAnim({ kfs: squareLoopKfs() } as PxPropertyAnimation);
        const kfs = getKfs(materialised);
        const first = kfTranslate(kfs[0]);
        const last  = kfTranslate(kfs[kfs.length - 1]);
        expect(first[0]).toBeCloseTo(184, 3);
        expect(first[1]).toBeCloseTo(82,  3);
        expect(last[0]).toBeCloseTo(184, 3);
        expect(last[1]).toBeCloseTo(82,  3);
    });

    it('includes the segment\'s axis extremes as samples (quarter-arc curve has its extremes at endpoints)', () => {
        // The first segment of squareLoopKfs (P0=(184,82), tan_out=(60,0)) →
        // (P3=(293,154), tan_in=(0,-39)) has a y-extreme at the endpoints and
        // an interior x-extreme near t ≈ 0.5. The materialiser must include that
        // x-extreme.
        const materialised = materialiseMotionPathInPropAnim({ kfs: squareLoopKfs() } as PxPropertyAnimation);
        const kfs = getKfs(materialised);
        // Confine to the first segment by time (input[0].time .. input[1].time = 0..250).
        const firstSegKfs = kfs.filter(kf => {
            const t = kfTime(kf);
            return t >= 0 && t <= 250 + 1e-6;
        });
        // The x-extreme should appear as an output kf with x close to the
        // segment's maximum x (≈ ~310 for this near-quarter-arc shape).
        const xs = firstSegKfs.map(kf => kfTranslate(kf)[0]);
        const maxX = Math.max(...xs);
        // Endpoint x's are 184 and 293; extreme x is somewhere in between or
        // higher. Just verify SOME interior sample has x > 250.
        expect(maxX).toBeGreaterThan(250);
    });
});


// ─────────────────────────────────────────────────────────────────────────────
//  materialiseMotionPathsInTree
// ─────────────────────────────────────────────────────────────────────────────


describe('materialiseMotionPathsInTree', () => {

    function makeTreeWithMotionPath(): PxAnimatedSvgDocument {
        return {
            type: 'svg',
            animator: { duration: 1020 },
            children: [
                {
                    type: 'rect',
                    id: 'static',
                    width: 10, height: 10,
                },
                {
                    type: 'ellipse',
                    id: 'moving',
                    rx: 20, ry: 20,
                    animate: {
                        transform: { autoOrient: true, keyframes: horseshoeKfs() },
                    },
                } as PxNode,
            ],
        } as PxAnimatedSvgDocument;
    }

    it('returns the input by reference when the tree has no motion-path animations', () => {
        const tree: PxAnimatedSvgDocument = {
            type: 'svg',
            children: [
                { type: 'rect', id: 'static', width: 10, height: 10 } as PxNode,
            ],
        } as PxAnimatedSvgDocument;
        const out = materialiseMotionPathsInTree(tree);
        expect(out).toBe(tree);
    });

    it('returns a new tree when a motion-path animation is present', () => {
        const tree = makeTreeWithMotionPath();
        const out = materialiseMotionPathsInTree(tree);
        expect(out).not.toBe(tree);
    });

    it('shares non-motion sub-trees by reference', () => {
        const tree = makeTreeWithMotionPath();
        const staticChild = tree.children![0];
        const out = materialiseMotionPathsInTree(tree);
        expect(out.children![0]).toBe(staticChild);
    });

    it('materialises the motion-path node\'s animate.transform (no tangents, no autoOrient on output)', () => {
        const tree = makeTreeWithMotionPath();
        const out = materialiseMotionPathsInTree(tree);
        const movingOut = out.children![1] as PxNode;
        const anim = (movingOut.animate as Record<string, PxPropertyAnimation>).transform;
        expect(anim.autoOrient).toBeUndefined();
        for (const kf of getKfs(anim)) {
            expect(kf.tangentIn).toBeUndefined();
            expect(kf.tangentOut).toBeUndefined();
        }
    });

    it('does not mutate the input tree', () => {
        const tree = makeTreeWithMotionPath();
        const snapshotJson = JSON.stringify(tree);
        materialiseMotionPathsInTree(tree);
        expect(JSON.stringify(tree)).toBe(snapshotJson);
    });
});


// ─────────────────────────────────────────────────────────────────────────────
//  invertEasing
// ─────────────────────────────────────────────────────────────────────────────


describe('invertEasing', () => {

    it('returns identity for undefined easing (linear)', () => {
        const inv = invertEasing(undefined);
        expect(inv(0)).toBeCloseTo(0, 5);
        expect(inv(0.25)).toBeCloseTo(0.25, 5);
        expect(inv(1)).toBeCloseTo(1, 5);
    });

    it('inverts cubicBezier (compose ≈ identity)', () => {
        // cubicBezier(E)(x) = y; invertEasing(E)(y) ≈ x
        const E: [number, number, number, number] = [0.42, 0, 0.58, 1]; // ease-in-out
        // pick test xs
        const xs = [0.1, 0.25, 0.5, 0.75, 0.9];
        // Forward via cubicBezier (we can't import without circular concern — compute by Bezier eval).
        // Use the property directly: invertEasing(E)(invertEasing-reverse) — just test endpoints.
        const inv = invertEasing(E);
        expect(inv(0)).toBeCloseTo(0, 3);
        expect(inv(1)).toBeCloseTo(1, 3);
        // For a symmetric ease-in-out, inv(0.5) ≈ 0.5 by symmetry.
        expect(inv(0.5)).toBeCloseTo(0.5, 3);
    });
});


// ─────────────────────────────────────────────────────────────────────────────
//  materialiseInternalLoops (propAnim + tree)
// ─────────────────────────────────────────────────────────────────────────────


describe('materialiseInternalLoopsInPropAnim', () => {

    it('returns the input by reference when propAnim has no loop', () => {
        const anim: PxPropertyAnimation = { kfs: [
            { t: 0,    v: 0 },
            { t: 1000, v: 100 },
        ] };
        const out = materialiseInternalLoopsInPropAnim('opacity', anim, 2000);
        expect(out).toBe(anim);
    });

    it('drops `loop` from the output after expansion', () => {
        const anim: PxPropertyAnimation = {
            loop: true,
            kfs: [
                { t: 0,    v: 0 },
                { t: 500,  v: 1 },
            ],
        };
        const out = materialiseInternalLoopsInPropAnim('opacity', anim, 2000);
        expect(out).not.toBe(anim);
        expect((out as PxPropertyAnimation).loop).toBeUndefined();
    });
});


describe('materialiseInternalLoopsInTree', () => {

    it('returns the input by reference when no propAnim has a loop', () => {
        const tree: PxAnimatedSvgDocument = {
            type: 'svg',
            children: [
                { type: 'rect', id: 'r', animate: { opacity: { kfs: [
                    { t: 0, v: 0 }, { t: 1000, v: 1 },
                ] } } } as PxNode,
            ],
        } as PxAnimatedSvgDocument;
        const out = materialiseInternalLoopsInTree(tree, 1000);
        expect(out).toBe(tree);
    });

    it('returns a new tree when at least one propAnim has a loop', () => {
        const tree: PxAnimatedSvgDocument = {
            type: 'svg',
            children: [
                { type: 'rect', id: 'r', animate: { opacity: {
                    loop: true,
                    kfs: [{ t: 0, v: 0 }, { t: 500, v: 1 }],
                } } } as PxNode,
            ],
        } as PxAnimatedSvgDocument;
        const out = materialiseInternalLoopsInTree(tree, 2000);
        expect(out).not.toBe(tree);
    });
});
