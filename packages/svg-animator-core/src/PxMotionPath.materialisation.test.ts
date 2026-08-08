/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

/**
 * Parity tests — `waapi` materialisation must match `frames` parametric output.
 *
 * The frames engine evaluates motion-along-path parametrically per frame via
 * `evaluateMotionPathSegment` — that's the reference. The waapi engine
 * pre-samples the parametric form into plain `{translate, rotate, …}` kfs via
 * `materialiseMotionPathInPropAnim` so CSS WAAPI can consume it. Both paths
 * should produce the SAME rendered position/orientation at any time.
 *
 * Method: for each fixture + sample time, render via both engines, compose the
 * resulting transform string into a 2D matrix, apply to known local-space
 * probe points (centre + corners of the bounding box), and compare world-space
 * positions with a tolerance equal to the materialiser's `flatnessTolerance`.
 */

import { describe, expect, it } from 'vitest';
import { calcAnimationValues, getNormalisedBindings } from './PxDefinitions';
import { PxAnimatorEngine } from './PxAnimatorConstants';
import type { PxAnimatedSvgDocument, PxKeyframe, PxNode } from './PxAnimatorTypes';


// ─────────────────────────────────────────────────────────────────────────────
//  2D matrix helpers — parse SVG transform string, apply to point
// ─────────────────────────────────────────────────────────────────────────────


type Mat = [number, number, number, number, number, number]; // [a, b, c, d, e, f] — standard SVG/CSS matrix
const IDENTITY: Mat = [1, 0, 0, 1, 0, 0];

/** `m1 ∘ m2` — apply m2 first, then m1 (standard column-vector convention). */
function multiply(m1: Mat, m2: Mat): Mat {
    return [
        m1[0] * m2[0] + m1[2] * m2[1],
        m1[1] * m2[0] + m1[3] * m2[1],
        m1[0] * m2[2] + m1[2] * m2[3],
        m1[1] * m2[2] + m1[3] * m2[3],
        m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
        m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
    ];
}

function applyToPoint(m: Mat, p: [number, number]): [number, number] {
    return [
        m[0] * p[0] + m[2] * p[1] + m[4],
        m[1] * p[0] + m[3] * p[1] + m[5],
    ];
}

/** Parse a single SVG transform function (`translate(x,y)`, `rotate(r)`, etc.). */
function parseOne(fn: string, args: Array<number>): Mat {
    if (fn === 'translate') return [1, 0, 0, 1, args[0] ?? 0, args[1] ?? 0];
    if (fn === 'rotate') {
        const rad = ((args[0] ?? 0) * Math.PI) / 180;
        return [Math.cos(rad), Math.sin(rad), -Math.sin(rad), Math.cos(rad), 0, 0];
    }
    if (fn === 'scale') {
        const sx = args[0] ?? 1;
        const sy = args[1] ?? sx;
        return [sx, 0, 0, sy, 0, 0];
    }
    if (fn === 'matrix') {
        return [args[0] ?? 1, args[1] ?? 0, args[2] ?? 0, args[3] ?? 1, args[4] ?? 0, args[5] ?? 0];
    }
    return IDENTITY;
}

/** Parse an SVG transform attribute (sequence of fn calls) into a single matrix.
 *  Handles `translate(x,y)translate(-x,-y)rotate(r)…` etc. */
function parseTransformString(s: string): Mat {
    let m: Mat = IDENTITY;
    const re = /([a-z]+)\s*\(\s*([-\d.,\s]*)\s*\)/gi;
    let match;
    while ((match = re.exec(s)) !== null) {
        const fn = match[1].toLowerCase();
        const args = match[2]
            .split(/[,\s]+/)
            .filter(t => t.length > 0)
            .map(t => parseFloat(t));
        m = multiply(m, parseOne(fn, args));
    }
    return m;
}


// ─────────────────────────────────────────────────────────────────────────────
//  Engine evaluation helpers
// ─────────────────────────────────────────────────────────────────────────────


function evaluateAt(doc: PxAnimatedSvgDocument, engine: PxAnimatorEngine, time: number): Record<string, string> | undefined {
    const bindings = getNormalisedBindings(doc, engine);
    if (bindings.length === 0) return undefined;
    // Find the binding whose id matches the animated rect/ellipse in the fixture.
    const animatedBinding = bindings.find(b => b.animate && Object.keys(b.animate).length > 0);
    if (!animatedBinding) return undefined;
    return calcAnimationValues(animatedBinding.animate as any, time);
}


/** For a given doc, returns the world-space position of `localPoint` (a probe
 *  point in the element's local coordinate space) after applying the animated
 *  transform at `time`. Engine is the comparison axis. */
function worldPos(
    doc: PxAnimatedSvgDocument,
    engine: PxAnimatorEngine,
    time: number,
    localPoint: [number, number],
): [number, number] | undefined {
    const out = evaluateAt(doc, engine, time);
    if (!out) return undefined;
    const tStr = out['transform'];
    if (!tStr) return undefined;
    const m = parseTransformString(tStr);
    return applyToPoint(m, localPoint);
}


/** Compares engines at sample times across `[0, duration]`. For each sample,
 *  asserts that the WAAPI engine's rendered position of each probe point is
 *  within `tolerance` of the frames engine's reference position.
 *
 *  Sampling is intentionally densified around kf boundaries: the autoOrient
 *  angle from `atan2` can flip ±360° exactly at an axis-aligned tangent (e.g.
 *  tangent points in -X → returns +180°; one curve-step later it returns -180°).
 *  A coarse uniform sampler can step over the discontinuity entirely and miss
 *  the wrap-around bug.
 */
function expectParity(
    doc: PxAnimatedSvgDocument,
    opts: {
        duration: number;
        samples?: number;          // default 40 — coarse uniform sweep
        probes?: Array<[number, number]>;  // default [[0,0]]
        tolerance?: number;        // default 2 px (chord error)
        kfBoundaryTimes?: Array<number>;   // optional: extra dense samples
    },
): void {
    const samples = opts.samples ?? 40;
    const probes = opts.probes ?? [[0, 0]];
    const tol = opts.tolerance ?? 2;

    // Build the time list: uniform sweep + dense neighbourhoods around any kf
    // boundaries the caller asked for.
    const times: Array<number> = [];
    for (let i = 0; i <= samples; i++) times.push((i / samples) * opts.duration);
    for (const t of opts.kfBoundaryTimes ?? []) {
        // 1 ms / 5 ms / 20 ms after and before — every angular discontinuity
        // an autoOrient atan2 wrap could produce sits within this window.
        for (const offset of [-20, -5, -1, 1, 5, 20]) {
            const tt = t + offset;
            if (tt >= 0 && tt <= opts.duration) times.push(tt);
        }
    }
    times.sort((a, b) => a - b);

    const diffs: Array<{ time: number; probe: [number, number]; frames: [number, number]; waapi: [number, number]; delta: number }> = [];

    for (const t of times) {
        for (const probe of probes) {
            const f = worldPos(doc, PxAnimatorEngine.frames, t, probe);
            const w = worldPos(doc, PxAnimatorEngine.waapi, t, probe);
            if (!f || !w) continue;
            const delta = Math.hypot(f[0] - w[0], f[1] - w[1]);
            if (delta > tol) diffs.push({ time: t, probe, frames: f, waapi: w, delta });
        }
    }

    if (diffs.length > 0) {
        const summary = diffs.slice(0, 5).map(d =>
            `  t=${d.time.toFixed(0)} probe=(${d.probe[0]},${d.probe[1]})  frames=(${d.frames[0].toFixed(2)},${d.frames[1].toFixed(2)})  waapi=(${d.waapi[0].toFixed(2)},${d.waapi[1].toFixed(2)})  Δ=${d.delta.toFixed(2)}`
        ).join('\n');
        throw new Error(`Frames vs WAAPI parity broken at ${diffs.length} sample(s) (tolerance ${tol}px):\n${summary}`);
    }
}


// ─────────────────────────────────────────────────────────────────────────────
//  Fixtures
// ─────────────────────────────────────────────────────────────────────────────


/** Rect orbiting a closed path (4 kfs + closing kf), autoOrient
 *  on, every kf carries a static `origin` of [59.0992, 27.1254]. Reproduces
 *  the WAAPI bug where the materialiser dropped non-translate parts. */
const closedLoopOrbitFixture = (): PxAnimatedSvgDocument => ({
    type: 'svg',
    viewBox: '0 0 1080 1080',
    animator: { duration: 2836, mode: 'auto', direction: 'normal', timeline: 'time' },
    children: [
        {
            type: 'rect',
            id: 'rotating-rect',
            width: 118.1984, height: 54.2508,
            transform: 'matrix(1,0,0,1,461.6482,171.1107)',
            animate: {
                transform: {
                    autoOrient: true,
                    keyframes: [
                        { time: 0,    value: { translate: [461.6482, 171.1107], origin: [59.0992, 27.1254] }, tangentOut: [166.2, 0] },
                        { time: 710,  value: { translate: [762.58,   472.0425], origin: [59.0992, 27.1254] }, tangentOut: [0, 166.2], tangentIn: [0, -166.2] },
                        { time: 1420, value: { translate: [461.6482, 772.9744], origin: [59.0992, 27.1254] }, tangentOut: [-166.2, 0], tangentIn: [166.2, 0] },
                        { time: 2130, value: { translate: [160.7163, 472.0425], origin: [59.0992, 27.1254] }, tangentOut: [0, -166.2], tangentIn: [0, 166.2] },
                        { time: 2840, value: { translate: [461.6482, 171.1107], origin: [59.0992, 27.1254] }, tangentIn: [-166.2, 0] },
                    ] as Array<PxKeyframe>,
                },
            },
        } as PxNode,
    ],
} as PxAnimatedSvgDocument);


/** Simple horseshoe — no origin, no autoOrient. Sanity baseline. */
const horseshoeNoOriginFixture = (): PxAnimatedSvgDocument => ({
    type: 'svg',
    animator: { duration: 1000 },
    children: [
        {
            type: 'rect',
            id: 'r',
            animate: {
                transform: {
                    keyframes: [
                        { time: 0,    value: { translate: [60, 190] }, tangentOut: [62.3495, 57.0257] },
                        { time: 1000, value: { translate: [60, 360] }, tangentIn:  [62.3495, -56.3075] },
                    ] as Array<PxKeyframe>,
                },
            },
        } as PxNode,
    ],
} as PxAnimatedSvgDocument);


/** Horseshoe + autoOrient + static origin. The static origin should be
 *  preserved on every materialised sub-kf. */
const horseshoeAutoOrientStaticOriginFixture = (): PxAnimatedSvgDocument => ({
    type: 'svg',
    animator: { duration: 1000 },
    children: [
        {
            type: 'rect',
            id: 'r',
            animate: {
                transform: {
                    autoOrient: true,
                    keyframes: [
                        { time: 0,    value: { translate: [60, 190], origin: [25, 15] }, tangentOut: [62.3495, 57.0257] },
                        { time: 1000, value: { translate: [60, 360], origin: [25, 15] }, tangentIn:  [62.3495, -56.3075] },
                    ] as Array<PxKeyframe>,
                },
            },
        } as PxNode,
    ],
} as PxAnimatedSvgDocument);


/** S-curve with autoOrient AND an ANIMATED origin (changes between kfs).
 *  Materialised sub-kfs need to interpolate origin per-sample at the EASED
 *  progress, matching frames-mode behaviour. */
const sCurveAnimatedOriginFixture = (): PxAnimatedSvgDocument => ({
    type: 'svg',
    animator: { duration: 1000 },
    children: [
        {
            type: 'rect',
            id: 'r',
            animate: {
                transform: {
                    autoOrient: true,
                    keyframes: [
                        { time: 0,    value: { translate: [100, 100], origin: [10, 5] },  tangentOut: [60, 0] },
                        { time: 500,  value: { translate: [200, 200], origin: [20, 10] }, tangentIn: [-60, 0], tangentOut: [60, 0] },
                        { time: 1000, value: { translate: [300, 100], origin: [30, 15] }, tangentIn: [-60, 0] },
                    ] as Array<PxKeyframe>,
                },
            },
        } as PxNode,
    ],
} as PxAnimatedSvgDocument);


/** Motion path + animated SCALE (non-identity scale changes per kf).
 *  Tests that scale is interpolated correctly on sampled sub-kfs. */
const animatedScaleAlongPathFixture = (): PxAnimatedSvgDocument => ({
    type: 'svg',
    animator: { duration: 1000 },
    children: [
        {
            type: 'rect',
            id: 'r',
            animate: {
                transform: {
                    autoOrient: true,
                    keyframes: [
                        { time: 0,    value: { translate: [100, 100], origin: [50, 25], scale: [1, 1] },     tangentOut: [80, 0] },
                        { time: 1000, value: { translate: [400, 100], origin: [50, 25], scale: [2, 0.5] },   tangentIn: [-80, 0] },
                    ] as Array<PxKeyframe>,
                },
            },
        } as PxNode,
    ],
} as PxAnimatedSvgDocument);


/** Motion path with EXPLICIT rotate kfs and autoOrient FALSE. The rotate
 *  values should be interpolated normally (not overridden). */
const motionPathExplicitRotateFixture = (): PxAnimatedSvgDocument => ({
    type: 'svg',
    animator: { duration: 1000 },
    children: [
        {
            type: 'rect',
            id: 'r',
            animate: {
                transform: {
                    keyframes: [
                        { time: 0,    value: { translate: [100, 100], origin: [20, 10], rotate: 0 },  tangentOut: [80, 0] },
                        { time: 1000, value: { translate: [400, 200], origin: [20, 10], rotate: 90 }, tangentIn: [-80, 0] },
                    ] as Array<PxKeyframe>,
                },
            },
        } as PxNode,
    ],
} as PxAnimatedSvgDocument);


/** Rectangular path with autoOrient and NO tangents — sharp 90° corners at
 *  every kf. At each corner the parametric tangent direction changes
 *  instantly (90° → 180° → -90° → 0°); the autoOrient rotation MUST step at
 *  the boundary, not linearly slide across the next segment.
 *
 *  Frames-mode evaluates the curve parametrically per frame so the step is
 *  automatic. The materialiser must emit a DUPLICATE kf at each boundary
 *  carrying the next-segment entry angle, otherwise engines linearly interp
 *  toward the next-segment end angle and the element rotates wrongly through
 *  the next segment. */
const rectanglePathSharpCornersFixture = (): PxAnimatedSvgDocument => ({
    type: 'svg',
    viewBox: '0 0 400 400',
    animator: { duration: 4000, mode: 'auto', direction: 'normal', timeline: 'time' },
    children: [
        {
            type: 'rect',
            id: 'corner-rect',
            width: 31.5967, height: 19.4742,
            animate: {
                transform: {
                    autoOrient: true,
                    keyframes: [
                        { time: 0,    value: { translate: [256.0547, 122.4478], origin: [15.7984, 9.7371] } },
                        { time: 680,  value: { translate: [256.0547, 210.1343], origin: [15.7984, 9.7371] } },
                        { time: 2000, value: { translate: [84.6318,  210.1343], origin: [15.7984, 9.7371] } },
                        { time: 2680, value: { translate: [84.6318,  122.4478], origin: [15.7984, 9.7371] } },
                        { time: 4000, value: { translate: [256.0547, 122.4478], origin: [15.7984, 9.7371] } },
                    ] as Array<PxKeyframe>,
                },
            },
        } as PxNode,
    ],
} as PxAnimatedSvgDocument);


/** 180° U-turn: go right, then come back along the same line going left.
 *  Sharp corner at the midpoint with exactly opposite tangents. */
const uTurnFixture = (): PxAnimatedSvgDocument => ({
    type: 'svg',
    animator: { duration: 2000 },
    children: [
        {
            type: 'rect',
            id: 'u',
            width: 40, height: 10,
            animate: {
                transform: {
                    autoOrient: true,
                    keyframes: [
                        { time: 0,    value: { translate: [50,  100], origin: [20, 5] } },
                        { time: 1000, value: { translate: [250, 100], origin: [20, 5] } },
                        { time: 2000, value: { translate: [50,  100], origin: [20, 5] } },
                    ] as Array<PxKeyframe>,
                },
            },
        } as PxNode,
    ],
} as PxAnimatedSvgDocument);


/** Equilateral triangle path — 3 sharp corners with 60° interior angles
 *  (geometric heading change at each corner: 120° turn). */
const triangleFixture = (): PxAnimatedSvgDocument => ({
    type: 'svg',
    animator: { duration: 3000 },
    children: [
        {
            type: 'rect',
            id: 't',
            width: 30, height: 10,
            animate: {
                transform: {
                    autoOrient: true,
                    keyframes: [
                        { time: 0,    value: { translate: [100, 200], origin: [15, 5] } },
                        { time: 1000, value: { translate: [200, 200], origin: [15, 5] } },
                        { time: 2000, value: { translate: [150, 113], origin: [15, 5] } },
                        { time: 3000, value: { translate: [100, 200], origin: [15, 5] } },
                    ] as Array<PxKeyframe>,
                },
            },
        } as PxNode,
    ],
} as PxAnimatedSvgDocument);


/** Mixed: smooth curve into a sharp corner into another smooth curve.
 *  Tests that the corner-step logic doesn't insert false steps on smooth
 *  segment transitions (curve → curve, when tangents line up). */
const curveSharpCurveFixture = (): PxAnimatedSvgDocument => ({
    type: 'svg',
    animator: { duration: 3000 },
    children: [
        {
            type: 'rect',
            id: 'csc',
            width: 30, height: 10,
            animate: {
                transform: {
                    autoOrient: true,
                    keyframes: [
                        // Smooth curve from (50,200) heading +X, arriving at (200,200) heading +X (tangents balanced).
                        { time: 0,    value: { translate: [50,  200], origin: [15, 5] }, tangentOut: [80, -40] },
                        { time: 1000, value: { translate: [200, 200], origin: [15, 5] }, tangentIn:  [-80, -40] },
                        // SHARP corner here: previous exit ≈ +X (0°), next entry = -Y (-90°).
                        { time: 2000, value: { translate: [200, 50],  origin: [15, 5] } },
                        // Smooth curve from (200,50) into (350,200) — straight-ish.
                        { time: 3000, value: { translate: [350, 200], origin: [15, 5] }, tangentIn: [-60, -30] },
                    ] as Array<PxKeyframe>,
                },
            },
        } as PxNode,
    ],
} as PxAnimatedSvgDocument);


// ─────────────────────────────────────────────────────────────────────────────
//  Tests
// ─────────────────────────────────────────────────────────────────────────────


describe('motion-along-path materialisation parity (waapi vs frames)', () => {

    it('horseshoe (no origin, no autoOrient) — chord error within tolerance', () => {
        expectParity(horseshoeNoOriginFixture(), {
            duration: 1000,
            probes: [[0, 0], [10, 20], [-10, -20]],
            tolerance: 2,
        });
    });

    it('horseshoe + autoOrient + STATIC origin — origin must survive materialisation', () => {
        expectParity(horseshoeAutoOrientStaticOriginFixture(), {
            duration: 1000,
            // Probes far from origin amplify any rotation-pivot drift.
            probes: [[0, 0], [50, 30], [-50, -30], [25, 15]],
            tolerance: 2,
        });
    });

    it('rect orbiting a closed loop + autoOrient + static origin', () => {
        // The bug the user originally reported: rotation pivot lost
        // → element flies off the path. Probes at the rect's corners + its
        // centre-of-rotation amplify any drift in the origin / rotate parts.
        //
        // Densify sampling around the kf boundaries so any autoOrient atan2
        // wrap-around (±180° boundary) is caught — the wrap window is ~30 ms
        // wide and would otherwise be skipped by the coarse uniform sweep.
        expectParity(closedLoopOrbitFixture(), {
            duration: 2836,
            probes: [[0, 0], [59.0992, 27.1254], [118.1984, 54.2508]],
            tolerance: 3,
            kfBoundaryTimes: [0, 710, 1420, 2130, 2840],
        });
    });

    it('S-curve with ANIMATED origin — origin interpolates per sub-kf', () => {
        // Probes at (±40, ±20) are 44.7px from origin; with the materialiser's
        // default 5° rotation tolerance, the worst-case chord error a probe can
        // accumulate near a sample boundary is `2·sin(5°/2)·44.7 ≈ 3.9px`. The
        // 4px test tolerance matches the materialiser's own per-sample budget.
        expectParity(sCurveAnimatedOriginFixture(), {
            duration: 1000,
            probes: [[0, 0], [40, 20], [-40, -20]],
            tolerance: 4,
        });
    });

    it('animated SCALE along path — scale interpolates per sub-kf', () => {
        expectParity(animatedScaleAlongPathFixture(), {
            duration: 1000,
            probes: [[0, 0], [100, 0], [0, 50]],
            tolerance: 2,
        });
    });

    it('explicit rotate kfs (autoOrient=false) — rotate interpolates per sub-kf', () => {
        expectParity(motionPathExplicitRotateFixture(), {
            duration: 1000,
            probes: [[0, 0], [100, 0]],
            tolerance: 2,
        });
    });

    it('rectangular path with SHARP CORNERS (no tangents) — autoOrient must STEP at each corner, not linearly slide', () => {
        // Frames-mode: each segment evaluated parametrically per frame →
        // rotation is per-segment constant (90° / 180° / -90° / 0°) and steps
        // instantly at each corner. WAAPI: materialised kfs interp linearly →
        // rotation slides across the next segment, mis-orienting the rect for
        // most of it.
        expectParity(rectanglePathSharpCornersFixture(), {
            duration: 4000,
            probes: [[0, 0], [31.5967, 19.4742], [31.5967, 0], [0, 19.4742]],
            tolerance: 3,
            kfBoundaryTimes: [0, 680, 2000, 2680, 4000],
        });
    });

    it('U-turn (180° corner) — autoOrient must step instantly from 0° to 180°', () => {
        // Sharp corner with exactly opposite incoming/outgoing tangents.
        // atan2 returns 0° on segment 0 (going +X), 180° on segment 1 (going
        // -X). Without the step, the materialiser would interpolate from 0°
        // to 180° across the second 1000ms — element rotating slowly during
        // what should be a straight-line return.
        expectParity(uTurnFixture(), {
            duration: 2000,
            probes: [[0, 0], [40, 10], [40, 0], [0, 10]],
            tolerance: 3,
            kfBoundaryTimes: [0, 1000, 2000],
        });
    });

    it('triangle (3 sharp corners, 120° heading change each) — autoOrient must step at each corner', () => {
        expectParity(triangleFixture(), {
            duration: 3000,
            probes: [[0, 0], [30, 10], [30, 0], [0, 10]],
            tolerance: 3,
            kfBoundaryTimes: [0, 1000, 2000, 3000],
        });
    });

    it('curve → sharp corner → curve — step only at the sharp boundary, smooth everywhere else', () => {
        // Tests two things at once:
        //   (a) the sharp boundary in the middle must produce a clean rotation
        //       step (curve exits +X, next segment heads -Y).
        //   (b) the smooth curve-to-curve transitions (no sharp corner) must
        //       NOT produce a false step — adjacent tangent directions line up
        //       within rotationTolerance, so the materialiser must NOT emit a
        //       duplicate kf there.
        expectParity(curveSharpCurveFixture(), {
            duration: 3000,
            probes: [[0, 0], [30, 10], [30, 0], [0, 10]],
            // Curved segments accumulate chord error from extremes + flatness
            // bisection; allow a touch more slack than the pure-corner cases.
            tolerance: 4,
            kfBoundaryTimes: [0, 1000, 2000, 3000],
        });
    });
});
