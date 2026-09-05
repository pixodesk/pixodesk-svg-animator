/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// Materialises `animate.transform` bindings marked `alongPathMode: 'offsetPath'` into
// CSS Motion Path form:
//
//   style: { offsetPath: "path('M…C…')", offsetAnchor: '0 0',
//            offsetRotate: 'auto' | '0deg', offsetDistance: '0%' }
//   animate.offsetDistance: { keyframes: [{ time, value: 0..1 arc-length fraction }] }
//
// Lightweight JSON is the DESIGN format — it carries only the tangented transform plus
// the mode flag, exactly like `effects` carry recipes. The offset infrastructure the
// Editor bakes into PRE-RENDERED SVG does not exist here, so the player must derive it,
// the same way it derives effects. Without this stage the mode flag was silently ignored
// (or, worse, the binding skipped) and a lightweight `offsetPath` document lost or
// mis-rendered its motion.
//
// Mirrors the Editor's `TPositionVecValue.getOffsetAlongPathForCss`: same inline
// `path('…')` syntax (the original Motion Path syntax — widest support), same
// arc-length-fraction keyframe values, easing and loop carried over.

import type { PxAnimatedSvgDocument, PxKeyframe, PxNode, PxPropertyAnimation } from './PxAnimatorTypes';

type Vec2 = [number, number];

const kfTime = (kf: PxKeyframe): number => (kf.t ?? kf.time ?? 0) as number;
const kfValue = (kf: PxKeyframe): { translate?: Vec2 } | undefined => (kf.v ?? kf.value) as never;
const kfEasing = (kf: PxKeyframe): unknown => kf.e ?? kf.easing;
const kfTangentIn = (kf: PxKeyframe): Vec2 | undefined => (kf.tangentIn ?? kf.ti) as never;
const kfTangentOut = (kf: PxKeyframe): Vec2 | undefined => (kf.tangentOut ?? kf.to) as never;

/** Cubic-bezier point at parameter t. */
function cubicAt(p0: Vec2, c1: Vec2, c2: Vec2, p1: Vec2, t: number): Vec2 {
    const u = 1 - t;
    const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
    return [a * p0[0] + b * c1[0] + c * c2[0] + d * p1[0],
            a * p0[1] + b * c1[1] + c * c2[1] + d * p1[1]];
}

/** Approximate cubic segment length by dense polyline sampling. */
function cubicLength(p0: Vec2, c1: Vec2, c2: Vec2, p1: Vec2, steps = 64): number {
    let len = 0;
    let prev = p0;
    for (let i = 1; i <= steps; i++) {
        const pt = cubicAt(p0, c1, c2, p1, i / steps);
        len += Math.hypot(pt[0] - prev[0], pt[1] - prev[1]);
        prev = pt;
    }
    return len;
}

const fmt = (n: number): string => {
    const r = Math.round(n * 10000) / 10000;
    return Object.is(r, -0) ? '0' : String(r);
};

/**
 * Attempts the rewrite for one transform binding. Returns undefined when this binding is
 * not an offset-path candidate (no explicit mode, no curve, or parts the encoding cannot
 * express) — the caller then leaves the binding for the ordinary pipeline.
 */
function buildOffsetPath(propAnim: PxPropertyAnimation): {
    pathStr: string; distanceKfs: Array<PxKeyframe>; autoOrient: boolean; anchor: Vec2;
} | undefined {
    if ((propAnim as { alongPathMode?: string }).alongPathMode !== 'offsetPath') return undefined;

    const kfs = propAnim.keyframes as Array<PxKeyframe> | undefined;
    if (!kfs || kfs.length < 2) return undefined;

    // Every keyframe must supply a translate; other ANIMATED parts (rotate/scale
    // varying per keyframe) cannot ride the offset encoding — bail to the ordinary
    // pipeline rather than render them wrong. Static `origin` is tolerated: alone (no
    // rotate/scale around it) it composes to identity.
    // GEOMETRY: the model composes translate(t)·translate(o)·rotate·translate(-o), so the
    // point that RIDES the path — and the pivot `autoOrient` rotates about — is the ORIGIN
    // point of the element, located at t+o. Encode exactly that: the path traces t_i+o and
    // `offset-anchor` pins the element's own origin point (o, in its box) to the path.
    // Anchoring 0 0 on the raw translates put the element's CORNER on a corner-trajectory
    // and pivoted rotation about the corner — visibly off the path for centred origins.
    const first = kfValue(kfs[0]) as { origin?: Vec2 } | undefined;
    const anchor: Vec2 = first?.origin && first.origin.length >= 2
        ? [first.origin[0], first.origin[1]] : [0, 0];

    const points: Array<Vec2> = [];
    for (const kf of kfs) {
        const v = kfValue(kf) as { translate?: Vec2; origin?: Vec2 } | undefined;
        const tr = v?.translate;
        if (!tr || tr.length < 2) return undefined;
        const parts = Object.keys(v as object);
        if (parts.some(p => p !== 'translate' && p !== 'origin')) return undefined;
        // An origin ANIMATED across keyframes shifts the pivot mid-flight — inexpressible
        // as a single offset-anchor; bail to the sampled pipeline.
        const o = v?.origin ?? [0, 0];
        if (o[0] !== anchor[0] || o[1] !== anchor[1]) return undefined;
        points.push([tr[0] + anchor[0], tr[1] + anchor[1]]);
    }
    // No tangent anywhere ⇒ straight lines ⇒ a plain translate animation renders this
    // everywhere with no support floor; the offset encoding buys nothing.
    if (!kfs.some(kf => kfTangentIn(kf) || kfTangentOut(kf))) return undefined;

    // Path string + per-segment arc lengths, in one pass.
    let d = 'M' + fmt(points[0][0]) + ',' + fmt(points[0][1]);
    const segLens: Array<number> = [];
    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i], p1 = points[i + 1];
        const to = kfTangentOut(kfs[i]) ?? [0, 0];
        const ti = kfTangentIn(kfs[i + 1]) ?? [0, 0];
        const c1: Vec2 = [p0[0] + to[0], p0[1] + to[1]];
        const c2: Vec2 = [p1[0] + ti[0], p1[1] + ti[1]];
        d += 'C' + fmt(c1[0]) + ',' + fmt(c1[1]) + ',' + fmt(c2[0]) + ',' + fmt(c2[1]) + ',' + fmt(p1[0]) + ',' + fmt(p1[1]);
        segLens.push(cubicLength(p0, c1, c2, p1));
    }
    const total = segLens.reduce((a, b) => a + b, 0);
    if (!(total > 0)) return undefined;

    // `offset-distance` percentages are ARC-LENGTH fractions — each keyframe lands at its
    // cumulative share of the path length (mirrors the Editor's `segments.endPct`).
    const distanceKfs: Array<PxKeyframe> = [];
    let cum = 0;
    for (let i = 0; i < kfs.length; i++) {
        if (i > 0) cum += segLens[i - 1];
        const out: PxKeyframe = { t: kfTime(kfs[i]), v: cum / total } as never;
        const e = kfEasing(kfs[i]);
        if (e !== undefined) (out as { e?: unknown }).e = e;
        distanceKfs.push(out);
    }

    return { pathStr: d, distanceKfs, autoOrient: !!propAnim.autoOrient, anchor };
}

/**
 * Walks the tree and rewrites every `offsetPath`-marked transform binding into
 * offset-path styles + an `offsetDistance` binding. Non-candidates are left untouched.
 * Runs BEFORE loop expansion so a carried `loop` expands on the new binding.
 */
export function materialiseOffsetPathsInTree(root: PxAnimatedSvgDocument): PxAnimatedSvgDocument {
    const walk = (node: PxNode): PxNode => {
        let out = node;
        const anim = node.animate as Record<string, PxPropertyAnimation> | undefined;
        const transform = anim?.['transform'];
        if (transform) {
            const built = buildOffsetPath(transform);
            if (built) {
                const newAnimate: Record<string, PxPropertyAnimation> = { ...anim };
                delete newAnimate['transform'];
                const distance: PxPropertyAnimation = { keyframes: built.distanceKfs as never } as never;
                if (transform.loop !== undefined) distance.loop = transform.loop;
                newAnimate['offsetDistance'] = distance;

                // The element's position now comes from the path — a remaining static
                // `translate` (the design base value) would ADD to it. Other static parts
                // (rotate/scale/origin) survive; the candidate check above guarantees the
                // animation itself carried none.
                const staticTr = node.transform as Record<string, unknown> | string | undefined;
                let newTransform = staticTr;
                if (staticTr && typeof staticTr === 'object') {
                    const t = { ...staticTr };
                    delete t['translate'];
                    delete t['origin'];   // pivot is offset-anchor now; alone it is identity
                    newTransform = Object.keys(t).length ? t : undefined;
                }

                out = {
                    ...node,
                    animate: newAnimate,
                    style: {
                        ...(node.style as Record<string, unknown> | undefined),
                        offsetPath: "path('" + built.pathStr + "')",
                        offsetAnchor: fmt(built.anchor[0]) + 'px ' + fmt(built.anchor[1]) + 'px',
                        offsetRotate: built.autoOrient ? 'auto' : '0deg',
                        offsetDistance: '0%',
                    },
                } as PxNode;
                if (newTransform !== undefined) (out as { transform?: unknown }).transform = newTransform;
                else delete (out as { transform?: unknown }).transform;
            }
        }
        if (out.children?.length) {
            const children = out.children.map(walk);
            if (children.some((c, i) => c !== out.children![i])) out = { ...out, children };
        }
        return out;
    };
    return walk(root) as PxAnimatedSvgDocument;
}
