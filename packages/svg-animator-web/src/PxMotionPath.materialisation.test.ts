/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

/**
 * Parity tests — `webapi` materialisation must match `frames` parametric output.
 *
 * The frames engine evaluates motion-along-path parametrically per frame via
 * `evaluateMotionPathSegment` — that's the reference. The webapi engine
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
import { PxAnimatorEngine } from './PxAnimatorTypes';
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
    return calcAnimationValues(animatedBinding.animate!, time);
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


/** Compares engines at N sample times across `[0, duration]`. For each sample,
 *  asserts that the WAAPI engine's rendered position of each probe point is
 *  within `tolerance` of the frames engine's reference position. */
function expectParity(
    doc: PxAnimatedSvgDocument,
    opts: {
        duration: number;
        samples?: number;          // default 40
        probes?: Array<[number, number]>;  // default [[0,0]]
        tolerance?: number;        // default 2 px (chord error)
    },
): void {
    const samples = opts.samples ?? 40;
    const probes = opts.probes ?? [[0, 0]];
    const tol = opts.tolerance ?? 2;

    const diffs: Array<{ time: number; probe: [number, number]; frames: [number, number]; webapi: [number, number]; delta: number }> = [];

    for (let i = 0; i <= samples; i++) {
        const t = (i / samples) * opts.duration;
        for (const probe of probes) {
            const f = worldPos(doc, PxAnimatorEngine.frames, t, probe);
            const w = worldPos(doc, PxAnimatorEngine.webapi, t, probe);
            if (!f || !w) continue;
            const delta = Math.hypot(f[0] - w[0], f[1] - w[1]);
            if (delta > tol) diffs.push({ time: t, probe, frames: f, webapi: w, delta });
        }
    }

    if (diffs.length > 0) {
        const summary = diffs.slice(0, 5).map(d =>
            `  t=${d.time.toFixed(0)} probe=(${d.probe[0]},${d.probe[1]})  frames=(${d.frames[0].toFixed(2)},${d.frames[1].toFixed(2)})  webapi=(${d.webapi[0].toFixed(2)},${d.webapi[1].toFixed(2)})  Δ=${d.delta.toFixed(2)}`
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


// ─────────────────────────────────────────────────────────────────────────────
//  Tests
// ─────────────────────────────────────────────────────────────────────────────


describe('motion-along-path materialisation parity (webapi vs frames)', () => {

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
        expectParity(closedLoopOrbitFixture(), {
            duration: 2836,
            probes: [[0, 0], [59.0992, 27.1254], [118.1984, 54.2508]],
            tolerance: 3,
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
});
