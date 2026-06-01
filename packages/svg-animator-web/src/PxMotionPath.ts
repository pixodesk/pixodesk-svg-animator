/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

/**
 * Motion-along-path → plain transform keyframes.
 *
 * Editor wire format for a curved-translation (and/or `autoOrient`) animation
 * carries per-kf `tangentIn` / `tangentOut` plus an animation-level `autoOrient`
 * flag — a parametric representation that any consumer must evaluate per frame.
 *
 * This module DESUGARS that shape into a regular unified-transform animation:
 * extra `{ translate, rotate? }` keyframes are inserted at curve extrema and
 * adaptive bisection points so the linear chord between adjacent samples stays
 * within `flatnessTolerance` of the true Bezier, and the original easing is
 * SPLIT (via De Casteljau, `splitEasing` in `PxAnimatorUtil`) across the
 * sub-segments so the combined timing reproduces the input easing exactly.
 *
 * Output kfs have no tangents and no `autoOrient` — both engines (`frames` and
 * `webapi`) and any future renderer (e.g. react-native-svg) consume them via
 * their normal unified-transform code path.
 *
 * The plan + rationale (extremes-aware sampling, easing-split, full pipeline
 * order) is in `motion-along-path-waapi-rework.md`.
 */


import { bezier2D_arcAtT, bezier2D_arcLengthLUT, bezier2D_derivativeAt, bezier2D_pointAt, clamp, invertEasing, splitEasing } from './PxAnimatorUtil';
import type { ArcLengthLUT } from './PxAnimatorUtil';
import type { PxKeyframe, PxNode, PxPropertyAnimation, PxTransformParts } from './PxAnimatorTypes';


type Point2 = [number, number];
type Easing = [number, number, number, number];


function getKfTranslate(kf: PxKeyframe): Point2 | undefined {
    const v = kf.value ?? kf.v;
    if (!v) return undefined;
    if (Array.isArray(v) && v.length >= 2 && typeof v[0] === 'number' && typeof v[1] === 'number') {
        // Composite per-part shape: `value: [x, y]` directly.
        return [v[0], v[1]];
    }
    const tr = (v as PxTransformParts).translate;
    if (Array.isArray(tr) && tr.length >= 2) return [tr[0], tr[1]];
    return undefined;
}

function getKfTime(kf: PxKeyframe): number {
    return (kf.time ?? kf.t ?? 0) as number;
}

function getKfEasing(kf: PxKeyframe): Easing | undefined {
    return (kf.easing ?? kf.e) as Easing | undefined;
}


/**
 * True when `anim` is a motion-along-path animation — at least one keyframe
 * carries spatial tangents (`tangentIn` / `tangentOut`) and/or the animation
 * has `autoOrient` set. Animation-level helper; works for either the body
 * `transform` slot or a composite per-part `translate` slot.
 */
export function propAnimIsMotionPath(anim: PxPropertyAnimation): boolean {
    const kfs: Array<PxKeyframe> | undefined = anim.keyframes ?? anim.kfs;
    if (!Array.isArray(kfs)) return false;
    if (anim.autoOrient) return true;
    for (const kf of kfs) {
        if ((kf.tangentIn ?? kf.ti) || (kf.tangentOut ?? kf.to)) return true;
    }
    return false;
}


// ─────────────────────────────────────────────────────────────────────────────
//  Segment cache — shared by `evaluateMotionPathSegment` (frames-mode kernel)
//  and the materialiser. Keyed by FROM-keyframe identity (WeakMap), so cache
//  entries vanish automatically when keyframes are replaced.
// ─────────────────────────────────────────────────────────────────────────────


interface MotionPathSegmentCache {
    readonly P0: Point2;
    readonly P1: Point2;
    readonly P2: Point2;
    readonly P3: Point2;
    readonly lut: ArcLengthLUT;
    readonly totalArc: number;
}

const _segmentCache = new WeakMap<PxKeyframe, MotionPathSegmentCache>();

function getSegmentCache(
    prevKf: PxKeyframe,
    nextKf: PxKeyframe,
    prevPos: Point2,
    nextPos: Point2,
): MotionPathSegmentCache {
    const existing = _segmentCache.get(prevKf);
    if (existing) return existing;
    const to = prevKf.tangentOut ?? prevKf.to;
    const ti = nextKf.tangentIn ?? nextKf.ti;
    const P1: Point2 = [prevPos[0] + (to ? to[0] : 0), prevPos[1] + (to ? to[1] : 0)];
    const P2: Point2 = [nextPos[0] + (ti ? ti[0] : 0), nextPos[1] + (ti ? ti[1] : 0)];
    const lut = bezier2D_arcLengthLUT(prevPos, P1, P2, nextPos);
    const entry: MotionPathSegmentCache = {
        P0: prevPos, P1, P2, P3: nextPos,
        lut,
        totalArc: lut.ds[lut.ds.length - 1],
    };
    _segmentCache.set(prevKf, entry);
    return entry;
}

/** Test helper. No-op in production (WeakMap; entries self-evict). Tests
 *  should use fresh keyframe objects to force cache misses. */
export function _resetMotionPathSegmentCache(): void {
    // Intentionally empty — kept for backwards-compat with any callers.
}


// ─────────────────────────────────────────────────────────────────────────────
//  Frames-mode kernel — preserved for any caller that still wants parametric
//  evaluation. The binding pipeline no longer needs it (motion-path is
//  materialised at `getNormalisedBindings` time), but it's a useful primitive
//  on its own.
// ─────────────────────────────────────────────────────────────────────────────


export interface MotionPathSample {
    /** Translate at the current time (motion-path arc-length-parametrised). */
    readonly translate: Point2;
    /** Auto-orient rotation in degrees (only when `autoOrient` is set). */
    readonly rotateDeg?: number;
}

/**
 * Evaluates the motion-path position (and optional auto-orient rotation) for a
 * single segment kf[i] → kf[i+1], given local progress already remapped to
 * `[0, 1]` and eased. Builds (or reuses cached) Bezier control points
 * `P1 = P0 + tangentOut`, `P2 = P3 + tangentIn`, maps `localProgress` to arc
 * length, then to curve parameter `t` via the arc-length LUT.
 */
export function evaluateMotionPathSegment(
    prevKf: PxKeyframe,
    nextKf: PxKeyframe,
    prevPos: Point2,
    nextPos: Point2,
    localProgress: number,
    autoOrient: boolean,
): MotionPathSample {
    const seg = getSegmentCache(prevKf, nextKf, prevPos, nextPos);
    const t = seg.totalArc === 0
        ? localProgress
        : tFromArcFraction(seg.lut, localProgress);
    const point = bezier2D_pointAt(seg.P0, seg.P1, seg.P2, seg.P3, t);
    if (!autoOrient) return { translate: point };
    const tan = bezier2D_derivativeAt(seg.P0, seg.P1, seg.P2, seg.P3, t);
    const rotateDeg = Math.atan2(tan[1], tan[0]) * 180 / Math.PI;
    return { translate: point, rotateDeg };
}

function tFromArcFraction(lut: ArcLengthLUT, arcFrac: number): number {
    const total = lut.ds[lut.ds.length - 1];
    // Binary search on `ds` for `arcFrac * total` (mirrors bezier2D_tForDistance).
    const target = arcFrac * total;
    const { ts, ds } = lut;
    const last = ds.length - 1;
    if (target <= 0)        return ts[0];
    if (target >= ds[last]) return ts[last];
    let lo = 1, hi = last;
    while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (ds[mid] < target) lo = mid + 1;
        else                  hi = mid;
    }
    const dPrev = ds[hi - 1];
    const span  = ds[hi] - dPrev;
    const frac  = span > 0 ? (target - dPrev) / span : 0;
    return ts[hi - 1] + frac * (ts[hi] - ts[hi - 1]);
}


// ─────────────────────────────────────────────────────────────────────────────
//  Public API — materialise parametric motion-path into plain transform kfs
// ─────────────────────────────────────────────────────────────────────────────


/** Sampling configuration shared by `materialiseMotionPathInPropAnim` + `materialiseMotionPathsInTree`. */
export interface MotionPathMaterialisationOptions {
    /** Max chord-to-curve deviation per sub-interval, in user units (default 0.5). */
    flatnessTolerance?: number;
    /** Max rotation delta (in degrees) between adjacent samples when `autoOrient`
     *  is set (default 5). */
    rotationTolerance?: number;
    /** Hard cap on samples per original segment; prevents runaway recursion on
     *  pathological inputs (default 32). */
    maxSamplesPerSegment?: number;
}

const DEFAULT_FLATNESS_TOL = 0.5;
const DEFAULT_ROTATION_TOL = 5;
const DEFAULT_MAX_SAMPLES  = 32;


/**
 * Converts ONE animated property to sampled transform kfs.
 *
 * Returns a NEW `PxPropertyAnimation` whose `kfs` are flat
 * `{ translate, rotate? }` records placed at curve extrema and adaptive
 * bisection points. Positions are arc-length-parametrised; easing is split via
 * De Casteljau so per-sub-segment easings reproduce the input easing exactly.
 * Original `loop` is carried across; `autoOrient` and per-kf `tangentIn` /
 * `tangentOut` are consumed.
 *
 * Returns the input unchanged (by reference) when it's not a motion-path
 * animation — callers can blindly run it through every propAnim.
 */
export function materialiseMotionPathInPropAnim(
    anim: PxPropertyAnimation,
    opts?: MotionPathMaterialisationOptions,
): PxPropertyAnimation {
    if (!propAnimIsMotionPath(anim)) return anim;
    const kfs = (anim.keyframes ?? anim.kfs) as Array<PxKeyframe> | undefined;
    if (!Array.isArray(kfs) || kfs.length < 2) return anim;

    const autoOrient   = !!anim.autoOrient;
    const flatnessTol  = opts?.flatnessTolerance  ?? DEFAULT_FLATNESS_TOL;
    const rotationTol  = opts?.rotationTolerance  ?? DEFAULT_ROTATION_TOL;
    const maxSamples   = opts?.maxSamplesPerSegment ?? DEFAULT_MAX_SAMPLES;

    const out: Array<PxKeyframe> = [];

    // First output kf — translate from input; rotate from segment-0 derivative
    // at t=0 if autoOrient. All other transform parts (`origin`, `scale`, an
    // explicit `rotate` when `autoOrient` is false, …) come from kfs[0].value.
    const firstPos = getKfTranslate(kfs[0]);
    if (!firstPos) return anim;
    const firstRotate = autoOrient ? derivAngleForFirstKf(kfs[0], kfs[1]) : undefined;
    out.push(makeOutKf(
        getKfTime(kfs[0]),
        buildOutKfValue(getKfValueParts(kfs[0]), getKfValueParts(kfs[0]), 0, firstPos, firstRotate, autoOrient),
    ));

    for (let i = 0; i < kfs.length - 1; i++) {
        const prevKf = kfs[i];
        const nextKf = kfs[i + 1];
        const prevPos = getKfTranslate(prevKf);
        const nextPos = getKfTranslate(nextKf);
        if (!prevPos || !nextPos) {
            // Skip undefined translate kfs — just push next as-is.
            out.push(makeOutKf(
                getKfTime(nextKf),
                buildOutKfValue(getKfValueParts(nextKf), getKfValueParts(nextKf), 1, nextPos ?? [0, 0], undefined, autoOrient),
            ));
            continue;
        }

        materialiseSegment(out, prevKf, nextKf, prevPos, nextPos, autoOrient, flatnessTol, rotationTol, maxSamples);
    }

    // The very last out-kf inherits the original last kf's `easing` (which
    // applies to the NEXT segment after this animation, or nothing — but the
    // wire format preserves it regardless).
    const lastInE = getKfEasing(kfs[kfs.length - 1]);
    if (lastInE) out[out.length - 1].e = lastInE;

    // Unwrap autoOrient rotations so linear interp between samples doesn't
    // take the long way around the circle. atan2 returns in (-180°, 180°];
    // a tangent rotating slowly across the +X axis (e.g. -179° → +179°)
    // would otherwise be lerp'd as a ~358° spin instead of a ~2° step.
    if (autoOrient) unwrapAutoOrientRotations(out);

    const result: PxPropertyAnimation = { kfs: out } as PxPropertyAnimation;
    if (anim.loop !== undefined) (result as { loop?: unknown }).loop = anim.loop;
    return result;
}


/** Walks `kfs` in order; for each kf with a `rotate` value, shifts it by ±360°
 *  multiples so the delta from the previous kf's rotate stays within ±180°.
 *  Linear interpolation between consecutive samples then always takes the
 *  shorter arc. The accumulated shift means a continuously-rotating element
 *  may end up with rotate values well outside [-180°, 180°], which is fine —
 *  CSS / SVG rotation accepts any range. */
function unwrapAutoOrientRotations(kfs: Array<PxKeyframe>): void {
    let prev: number | undefined;
    for (const kf of kfs) {
        const v = (kf.v ?? kf.value) as { rotate?: number } | undefined;
        if (!v || typeof v.rotate !== 'number') continue;
        if (prev === undefined) { prev = v.rotate; continue; }
        let r = v.rotate;
        while (r - prev > 180)  r -= 360;
        while (r - prev < -180) r += 360;
        v.rotate = r;
        prev = r;
    }
}


function makeOutKf(time: number, value: PxTransformParts): PxKeyframe {
    return { t: time, v: value } as PxKeyframe;
}

/** Reads the kf's value-as-parts (object form). Returns `undefined` if the kf
 *  has no value or it's an array form (single-part composite). */
function getKfValueParts(kf: PxKeyframe): PxTransformParts | undefined {
    const v = kf.value ?? kf.v;
    if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
    return v as PxTransformParts;
}

/** Linearly interpolates one transform-part value (number / Vec2). Returns the
 *  non-undefined input when only one side is present, falls back to `prev`
 *  for unsupported types. */
function interpolatePart(prev: unknown, next: unknown, p: number): unknown {
    if (prev === undefined) return next;
    if (next === undefined) return prev;
    if (typeof prev === 'number' && typeof next === 'number') {
        return prev + (next - prev) * p;
    }
    if (Array.isArray(prev) && Array.isArray(next) && prev.length === next.length) {
        const out: Array<number> = new Array(prev.length);
        for (let i = 0; i < prev.length; i++) {
            const a = typeof prev[i] === 'number' ? prev[i] : 0;
            const b = typeof next[i] === 'number' ? next[i] : 0;
            out[i] = a + (b - a) * p;
        }
        return out;
    }
    return p < 0.5 ? prev : next;
}

/** Builds the value-record for one sampled output kf. `translate` overrides
 *  whatever the per-part interpolation would have produced (motion path is the
 *  source of truth for position); `rotateDegFromAutoOrient`, when defined,
 *  overrides any animated `rotate`. All OTHER parts present on `prevV` /
 *  `nextV` (origin, scale, etc.) are interpolated at the eased arc-progress
 *  `p` — mirroring the frames-mode `calcPropertyValue` loop. */
function buildOutKfValue(
    prevV: PxTransformParts | undefined,
    nextV: PxTransformParts | undefined,
    p: number,
    translate: Point2,
    rotateDegFromAutoOrient: number | undefined,
    autoOrient: boolean,
): PxTransformParts {
    const value: { [k: string]: unknown } = { translate };
    const keys = new Set<string>();
    if (prevV) for (const k of Object.keys(prevV)) keys.add(k);
    if (nextV) for (const k of Object.keys(nextV)) keys.add(k);
    for (const k of keys) {
        if (k === 'translate') continue;                            // overridden by motion path
        if (k === 'rotate' && autoOrient) continue;                 // overridden by autoOrient
        const pv = (prevV as Record<string, unknown> | undefined)?.[k];
        const nv = (nextV as Record<string, unknown> | undefined)?.[k];
        if (pv === undefined && nv === undefined) continue;
        value[k] = interpolatePart(pv, nv, p);
    }
    if (rotateDegFromAutoOrient !== undefined) value.rotate = rotateDegFromAutoOrient;
    return value as PxTransformParts;
}


/** Derivative angle at t=0 of segment kf[0] → kf[1]. Used to seed the first
 *  output kf's rotation; without this the very first frame would render with
 *  no rotation while every subsequent sample has one. */
function derivAngleForFirstKf(kf0: PxKeyframe, kf1: PxKeyframe): number {
    const p0 = getKfTranslate(kf0);
    const p1 = getKfTranslate(kf1);
    if (!p0 || !p1) return 0;
    const seg = getSegmentCache(kf0, kf1, p0, p1);
    const tan = bezier2D_derivativeAt(seg.P0, seg.P1, seg.P2, seg.P3, 0);
    return Math.atan2(tan[1], tan[0]) * 180 / Math.PI;
}


/** Materialises a single segment into `out`. Appends one kf per sample (interior
 *  critical/adaptive points + the next-kf endpoint), with positions, optional
 *  rotations, and split easings. */
function materialiseSegment(
    out: Array<PxKeyframe>,
    prevKf: PxKeyframe, nextKf: PxKeyframe,
    prevPos: Point2, nextPos: Point2,
    autoOrient: boolean,
    flatnessTol: number, rotationTol: number, maxSamples: number,
): void {
    const seg = getSegmentCache(prevKf, nextKf, prevPos, nextPos);
    const prevTime = getKfTime(prevKf);
    const nextTime = getKfTime(nextKf);
    const prevEasing = getKfEasing(prevKf);
    const invertFn = invertEasing(prevEasing);
    const prevV = getKfValueParts(prevKf);
    const nextV = getKfValueParts(nextKf);

    // 1. Critical t-values: axis extrema + endpoints.
    const interiorTs = computeSampleTs(seg, autoOrient, flatnessTol, rotationTol, maxSamples);
    // `interiorTs` is the list of t in (0, 1] in ascending order, ending with t=1.

    // 2. For each sample t, compute position, rotation, the eased arc-fraction
    //    `p` (= the value frames-mode would use for non-translate part interp),
    //    and the linear-time fraction `u` (via invertEasing of `p`).
    interface Sample { u: number; p: number; pos: Point2; rotateDeg?: number; }
    const samples: Array<Sample> = [];
    for (const t of interiorTs) {
        const arc = bezier2D_arcAtT(seg.lut, t);
        const p = clamp(seg.totalArc > 0 ? arc / seg.totalArc : t, 0, 1);
        const u = clamp(invertFn(p), 0, 1);
        const pos = bezier2D_pointAt(seg.P0, seg.P1, seg.P2, seg.P3, t);
        const sample: Sample = { u, p, pos };
        if (autoOrient) {
            const tan = bezier2D_derivativeAt(seg.P0, seg.P1, seg.P2, seg.P3, t);
            sample.rotateDeg = Math.atan2(tan[1], tan[0]) * 180 / Math.PI;
        }
        samples.push(sample);
    }

    // 3. Sequential easing split. The easing for sub-segment k (out[L+k-1] → out[L+k])
    //    is the `left` half of splitting the still-unconsumed easing at
    //    `(u_k - u_{k-1}) / (1 - u_{k-1})`.
    let remaining = prevEasing;
    let prevU = 0;
    const startIdx = out.length - 1;  // out[startIdx] is the prev kf — it owns the FIRST sub-easing.
    for (let i = 0; i < samples.length; i++) {
        const s = samples[i];
        const xFrac = prevU < 1 ? clamp((s.u - prevU) / (1 - prevU), 0, 1) : 1;
        const { left, right } = splitEasing(remaining, xFrac);

        // Assign `left` as the outgoing easing of the kf at the end of `out`
        // (which is the kf that PRECEDES this sub-kf — the prev kf for i=0,
        // or the previously-emitted sub-kf for i>0).
        const ownerIdx = i === 0 ? startIdx : out.length - 1;
        if (left) out[ownerIdx].e = left;
        else delete out[ownerIdx].e;

        const tGlobal = prevTime + s.u * (nextTime - prevTime);
        const value = buildOutKfValue(prevV, nextV, s.p, s.pos, s.rotateDeg, autoOrient);
        out.push(makeOutKf(tGlobal, value));

        remaining = right;
        prevU = s.u;
    }
}


/** Returns t-values in (0, 1], sorted ascending, ending with t=1. The list
 *  always includes the input segment's axis extrema interior to (0, 1), plus
 *  adaptive bisection samples wherever the chord deviates from the curve by
 *  more than `flatnessTol` (or the rotation delta exceeds `rotationTol` for
 *  autoOrient). Capped at `maxSamples`. */
function computeSampleTs(
    seg: MotionPathSegmentCache, autoOrient: boolean,
    flatnessTol: number, rotationTol: number, maxSamples: number,
): Array<number> {
    // Axis extrema (interior to (0, 1)).
    const extremes: Array<number> = [];
    addAxisExtremes(seg.P0[0], seg.P1[0], seg.P2[0], seg.P3[0], extremes);
    addAxisExtremes(seg.P0[1], seg.P1[1], seg.P2[1], seg.P3[1], extremes);
    extremes.sort((a, b) => a - b);

    const critical: Array<number> = [0];
    for (const t of extremes) {
        if (t > critical[critical.length - 1] + 1e-6 && t < 1 - 1e-6) {
            critical.push(t);
        }
    }
    critical.push(1);

    const out: Array<number> = [];
    const budget = { remaining: maxSamples - critical.length };  // already-committed critical points count against the budget
    for (let i = 0; i < critical.length - 1; i++) {
        bisect(critical[i], critical[i + 1], out, seg, autoOrient, flatnessTol, rotationTol, budget);
    }
    return out;
}


/** Solves `P'(t).axis = 0` for one axis (a quadratic in t). Pushes any real
 *  roots in `(0, 1)` into `out`. Coefficients via standard cubic Bezier
 *  derivative: with `a = p1 − p0, b = p2 − p1, c = p3 − p2`, the equation is
 *      `(a − 2b + c)·t² + 2(b − a)·t + a = 0`. */
function addAxisExtremes(p0: number, p1: number, p2: number, p3: number, out: Array<number>): void {
    const a = p1 - p0;
    const b = p2 - p1;
    const c = p3 - p2;
    const A = a - 2 * b + c;
    const B = 2 * (b - a);
    const C = a;
    if (Math.abs(A) < 1e-10) {
        if (Math.abs(B) > 1e-10) {
            const t = -C / B;
            if (t > 1e-6 && t < 1 - 1e-6) out.push(t);
        }
        return;
    }
    const disc = B * B - 4 * A * C;
    if (disc < 0) return;
    const sq = Math.sqrt(disc);
    const t1 = (-B - sq) / (2 * A);
    const t2 = (-B + sq) / (2 * A);
    if (t1 > 1e-6 && t1 < 1 - 1e-6) out.push(t1);
    if (t2 > 1e-6 && t2 < 1 - 1e-6) out.push(t2);
}


/** Adaptive bisection between `tA` and `tB`. Always appends `tB` exactly once
 *  (either directly when the chord is flat enough, or via recursion).
 *
 *  Flatness is tested at THREE interior points (t = 0.25, 0.5, 0.75 of the
 *  sub-interval), not just the midpoint. Symmetric Bezier segments often have
 *  the curve crossing the chord exactly at t=0.5 — a single-midpoint check
 *  would mistake that for flatness and skip subdivision, leaving visible
 *  chord deviation between samples. */
function bisect(
    tA: number, tB: number,
    out: Array<number>,
    seg: MotionPathSegmentCache,
    autoOrient: boolean,
    flatnessTol: number, rotationTol: number,
    budget: { remaining: number },
): void {
    const tMid = (tA + tB) / 2;
    const pA = bezier2D_pointAt(seg.P0, seg.P1, seg.P2, seg.P3, tA);
    const pB = bezier2D_pointAt(seg.P0, seg.P1, seg.P2, seg.P3, tB);
    const span = tB - tA;
    const p25 = bezier2D_pointAt(seg.P0, seg.P1, seg.P2, seg.P3, tA + span * 0.25);
    const p50 = bezier2D_pointAt(seg.P0, seg.P1, seg.P2, seg.P3, tMid);
    const p75 = bezier2D_pointAt(seg.P0, seg.P1, seg.P2, seg.P3, tA + span * 0.75);

    const dev = Math.max(
        perpDist(p25, pA, pB),
        perpDist(p50, pA, pB),
        perpDist(p75, pA, pB),
    );
    let rotOk = true;
    if (autoOrient) {
        const tanA = bezier2D_derivativeAt(seg.P0, seg.P1, seg.P2, seg.P3, tA);
        const tanB = bezier2D_derivativeAt(seg.P0, seg.P1, seg.P2, seg.P3, tB);
        const angA = Math.atan2(tanA[1], tanA[0]) * 180 / Math.PI;
        const angB = Math.atan2(tanB[1], tanB[0]) * 180 / Math.PI;
        let delta = Math.abs(angA - angB);
        if (delta > 180) delta = 360 - delta;
        if (delta > rotationTol) rotOk = false;
    }

    if ((dev <= flatnessTol && rotOk) || budget.remaining <= 0 || span < 1e-6) {
        out.push(tB);
        return;
    }

    budget.remaining -= 1;
    bisect(tA, tMid, out, seg, autoOrient, flatnessTol, rotationTol, budget);
    bisect(tMid, tB, out, seg, autoOrient, flatnessTol, rotationTol, budget);
}


function perpDist(q: Point2, pA: Point2, pB: Point2): number {
    const dx = pB[0] - pA[0];
    const dy = pB[1] - pA[1];
    const len2 = dx * dx + dy * dy;
    if (len2 < 1e-20) {
        const qdx = q[0] - pA[0];
        const qdy = q[1] - pA[1];
        return Math.sqrt(qdx * qdx + qdy * qdy);
    }
    const cross = (q[0] - pA[0]) * dy - (q[1] - pA[1]) * dx;
    return Math.abs(cross) / Math.sqrt(len2);
}


// ─────────────────────────────────────────────────────────────────────────────
//  Tree walker — applies `materialiseMotionPathInPropAnim` to every `node.animate.transform`
//  whose propAnim is a motion-path. Immutable: returns the input by reference
//  when no changes were needed; otherwise clones along the path to each
//  converted node and shares all other sub-trees.
// ─────────────────────────────────────────────────────────────────────────────


export function materialiseMotionPathsInTree(
    root: PxNode,
    opts?: MotionPathMaterialisationOptions,
): PxNode {
    const out = walkAndMaterialise(root, opts);
    return out ?? root;
}

function walkAndMaterialise(node: PxNode, opts?: MotionPathMaterialisationOptions): PxNode | null {
    let newChildren: Array<PxNode> | undefined;
    if (node.children) {
        for (let i = 0; i < node.children.length; i++) {
            const ch = node.children[i];
            const ret = walkAndMaterialise(ch, opts);
            if (ret !== null) {
                if (!newChildren) newChildren = node.children.slice();
                newChildren[i] = ret;
            }
        }
    }

    let newAnimate: Record<string, PxPropertyAnimation> | undefined;
    const animBucket = node.animate;
    if (animBucket && typeof animBucket === 'object' && !Array.isArray(animBucket)) {
        const animDef = animBucket as Record<string, PxPropertyAnimation>;
        const transformAnim = animDef.transform;
        if (transformAnim && typeof transformAnim === 'object' && propAnimIsMotionPath(transformAnim)) {
            const materialised = materialiseMotionPathInPropAnim(transformAnim, opts);
            if (materialised !== transformAnim) {
                newAnimate = { ...animDef, transform: materialised };
            }
        }
    }

    if (!newChildren && !newAnimate) return null;
    const cloned: PxNode = { ...node };
    if (newChildren) cloned.children = newChildren;
    if (newAnimate)  cloned.animate  = newAnimate as PxNode['animate'];
    return cloned;
}
