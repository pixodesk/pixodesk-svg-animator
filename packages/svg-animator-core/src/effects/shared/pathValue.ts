/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// An animatable PATH slot (`clipPath.pathData`, `textPath.pathData`): static = an SVG `d`
// string, animated = `{keyframes}` whose values are `{pathData:"M…"}` — the one wire form
// for animated geometry (@see PxKeyframeValueSchema).

import type { PxAnimatable, PxBezierPath } from '../../format/PxAnimatorTypes';
import { parseSvgPathToBezier } from '../../animation/PxDefinitions';
import { bezierToSvgPath, interpolateBeziers } from '../../util/PxAnimatorUtil';
import { ReadKind, readAnimatable } from './transformParts';


/** Unwraps a `{pathData: "M…"}` keyframe-value object to its string; passes strings through. */
export function pathString(v: unknown): string | undefined {
    if (typeof v === 'string') return v;
    if (v && typeof v === 'object' && typeof (v as { pathData?: unknown }).pathData === 'string') return (v as { pathData: string }).pathData;
    return undefined;
}


/**
 * An animatable path slot as GEOMETRY OVER TIME — what a layout that must follow a moving
 * path (glyph text along it) samples from. Static: the one path at every time. Animated:
 * the keyframes' paths, interpolated linearly per interval and clamped at the ends (the
 * same linear-per-interval reading the along-path baking gives its other drivers).
 */
export interface PathTrack {
    animated: boolean;
    /** Keyframe times — empty when static. */
    times: Array<number>;
    loop?: unknown;
    /** The path's `d` at time `t`. */
    dAt(t: number): string;
    /** The longest path across the keyframes — a sampling step derived from it suits every time. */
    maxLength(lengthOf: (d: string) => number): number;
    /** How far the geometry moved between two times: the largest control-point displacement. */
    moveBetween(t0: number, t1: number): number;
}

/** `undefined` when the slot is absent or holds no usable path. */
export function pathTrackOf(raw: PxAnimatable<string> | undefined): PathTrack | undefined {
    const r = readAnimatable<string>(raw);
    if (r.kind === ReadKind.Absent) return undefined;

    if (r.kind === ReadKind.Static || r.keyframes.length < 2) {
        const d = pathString(r.kind === ReadKind.Static ? r.value : r.keyframes[0]?.value);
        if (!d) return undefined;
        return {
            animated: false, times: [],
            dAt: () => d,
            maxLength: lengthOf => lengthOf(d),
            moveBetween: () => 0,
        };
    }

    const kfs = [...r.keyframes]
        .map(kf => ({ time: Number(kf.time) || 0, d: pathString(kf.value) }))
        .filter((kf): kf is { time: number, d: string } => !!kf.d)
        .sort((a, b) => a.time - b.time);
    if (kfs.length < 2) return pathTrackOf(kfs[0]?.d);

    const times = kfs.map(kf => kf.time);
    const beziers = kfs.map(kf => parseSvgPathToBezier(kf.d));   // parsed once per keyframe

    /** The geometry at `t` (clamped), as bezier sub-paths. */
    const at = (t: number): Array<PxBezierPath> => {
        if (t <= times[0]) return beziers[0];
        for (let i = 1; i < times.length; i++) {
            if (t <= times[i]) {
                const span = times[i] - times[i - 1];
                const f = span > 0 ? (t - times[i - 1]) / span : 1;
                return interpolateBeziers(beziers[i - 1], beziers[i], f);
            }
        }
        return beziers[beziers.length - 1];
    };

    return {
        animated: true, times, loop: r.loop,
        dAt: t => at(t).map(bz => bezierToSvgPath(bz)).join(''),
        maxLength: lengthOf => Math.max(...kfs.map(kf => lengthOf(kf.d))),
        moveBetween: (t0, t1) => maxPointMove(at(t0), at(t1)),
    };
}

/** The largest displacement of any vertex or control point between two geometries. */
function maxPointMove(a: Array<PxBezierPath>, b: Array<PxBezierPath>): number {
    let max = 0;
    const n = Math.min(a.length, b.length);
    for (let p = 0; p < n; p++) {
        const pa = a[p], pb = b[p];
        const count = Math.min(pa.v.length, pb.v.length);
        for (let k = 0; k < count; k++) {
            max = Math.max(max,
                dist(pa.v[k], pb.v[k]),
                dist(pa.i?.[k] ?? pa.v[k], pb.i?.[k] ?? pb.v[k]),
                dist(pa.o?.[k] ?? pa.v[k], pb.o?.[k] ?? pb.v[k]),
            );
        }
    }
    return max;
}

function dist(p: Array<number>, q: Array<number>): number {
    return Math.hypot((q[0] ?? 0) - (p[0] ?? 0), (q[1] ?? 0) - (p[1] ?? 0));
}
