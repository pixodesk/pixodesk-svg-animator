/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/


/**
 * Arc-length sampler for an SVG path `d` — the geometry backing along-path glyph
 * placement. Parses the path into cubic Bézier segments (lines and quadratics
 * up-converted), builds a per-segment arc-length LUT, and answers
 * `sampleAtDistance(dist) → { x, y, angle }` (angle = path tangent, radians).
 *
 * Supported commands: M/L/H/V/C/S/Q/T/Z (absolute + relative). Arcs (A/a) are
 * approximated as a straight line to the endpoint (editor paths never emit them;
 * this only guards odd imports). Multiple subpaths are concatenated by arc
 * length (gaps between them are ignored — text flows continuously).
 */

import { bezier2D_arcLengthLUT, bezier2D_derivativeAt, bezier2D_pointAt, bezier2D_tForDistance, type ArcLengthLUT } from '../PxAnimatorUtil';

type Pt = [number, number];

interface Cubic { P0: Pt; P1: Pt; P2: Pt; P3: Pt; lut: ArcLengthLUT; len: number; }

export interface PathPoint { x: number; y: number; angle: number; }

export interface PathSampler {
    totalLength: number;
    /** True when the path loops back on itself (explicit `Z` or coincident ends) —
     *  no open tip to run off, so overflow clamps/wraps rather than clipping. */
    closed: boolean;
    sampleAtDistance(dist: number): PathPoint;
}

const LUT_STEPS = 48;
const CMD_RE = /[MmLlHhVvCcSsQqTtAaZz]/;

/** Tokenises `d` into command letters and numbers, preserving order. */
function tokenize(d: string): Array<string> {
    const tokens: Array<string> = [];
    const re = /([MmLlHhVvCcSsQqTtAaZz])|(-?\d*\.?\d+(?:[eE][-+]?\d+)?)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(d)) !== null) tokens.push(m[0]);
    return tokens;
}

function quadToCubic(P0: Pt, Qc: Pt, P3: Pt): { P1: Pt; P2: Pt } {
    return {
        P1: [P0[0] + 2 / 3 * (Qc[0] - P0[0]), P0[1] + 2 / 3 * (Qc[1] - P0[1])],
        P2: [P3[0] + 2 / 3 * (Qc[0] - P3[0]), P3[1] + 2 / 3 * (Qc[1] - P3[1])],
    };
}

/** Parses `d` into cubic segments. Returns null when nothing usable was found. */
function parseCubics(d: string): Array<Cubic> | null {
    const tokens = tokenize(d);
    const segs: Array<Cubic> = [];

    let i = 0;
    let cx = 0, cy = 0;        // current point
    let sx = 0, sy = 0;        // subpath start
    let pcx = 0, pcy = 0;      // previous cubic control point (for S)
    let pqx = 0, pqy = 0;      // previous quad control point (for T)
    let prevCmd = '';

    const num = (): number => parseFloat(tokens[i++]);
    const push = (P1: Pt, P2: Pt, P3: Pt): void => {
        const P0: Pt = [cx, cy];
        const lut = bezier2D_arcLengthLUT(P0, P1, P2, P3, LUT_STEPS);
        segs.push({ P0, P1, P2, P3, lut, len: lut.ds[lut.ds.length - 1] });
        cx = P3[0]; cy = P3[1];
    };
    // Straight line as a cubic with controls at 1/3 and 2/3 — this makes
    // `B(t) = P0 + t·(P3−P0)` EXACTLY, so arc length is linear in t and sampling
    // is precise (degenerate `P1=P0,P2=P3` controls would reparametrise it).
    const pushLine = (x: number, y: number): void => {
        push(
            [cx + (x - cx) / 3, cy + (y - cy) / 3],
            [cx + 2 * (x - cx) / 3, cy + 2 * (y - cy) / 3],
            [x, y],
        );
    };

    while (i < tokens.length) {
        let cmd = tokens[i];
        if (CMD_RE.test(cmd)) i++;
        else cmd = prevCmd === 'M' ? 'L' : prevCmd === 'm' ? 'l' : prevCmd; // implicit repeat
        const rel = cmd >= 'a';
        const U = cmd.toUpperCase();

        if (U === 'Z') { pushLine(sx, sy); cx = sx; cy = sy; prevCmd = cmd; continue; }
        if (U === 'M') {
            const x = num() + (rel ? cx : 0), y = num() + (rel ? cy : 0);
            cx = x; cy = y; sx = x; sy = y; prevCmd = cmd; continue;
        }
        if (U === 'L') {
            pushLine(num() + (rel ? cx : 0), num() + (rel ? cy : 0));
        } else if (U === 'H') {
            pushLine(num() + (rel ? cx : 0), cy);
        } else if (U === 'V') {
            pushLine(cx, num() + (rel ? cy : 0));
        } else if (U === 'C') {
            const p1: Pt = [num() + (rel ? cx : 0), num() + (rel ? cy : 0)];
            const p2: Pt = [num() + (rel ? cx : 0), num() + (rel ? cy : 0)];
            const p3: Pt = [num() + (rel ? cx : 0), num() + (rel ? cy : 0)];
            pcx = p2[0]; pcy = p2[1];
            push(p1, p2, p3);
        } else if (U === 'S') {
            const smooth = (prevCmd.toUpperCase() === 'C' || prevCmd.toUpperCase() === 'S');
            const p1: Pt = smooth ? [2 * cx - pcx, 2 * cy - pcy] : [cx, cy];
            const p2: Pt = [num() + (rel ? cx : 0), num() + (rel ? cy : 0)];
            const p3: Pt = [num() + (rel ? cx : 0), num() + (rel ? cy : 0)];
            pcx = p2[0]; pcy = p2[1];
            push(p1, p2, p3);
        } else if (U === 'Q') {
            const qc: Pt = [num() + (rel ? cx : 0), num() + (rel ? cy : 0)];
            const p3: Pt = [num() + (rel ? cx : 0), num() + (rel ? cy : 0)];
            pqx = qc[0]; pqy = qc[1];
            const { P1, P2 } = quadToCubic([cx, cy], qc, p3);
            push(P1, P2, p3);
        } else if (U === 'T') {
            const smooth = (prevCmd.toUpperCase() === 'Q' || prevCmd.toUpperCase() === 'T');
            const qc: Pt = smooth ? [2 * cx - pqx, 2 * cy - pqy] : [cx, cy];
            const p3: Pt = [num() + (rel ? cx : 0), num() + (rel ? cy : 0)];
            pqx = qc[0]; pqy = qc[1];
            const { P1, P2 } = quadToCubic([cx, cy], qc, p3);
            push(P1, P2, p3);
        } else if (U === 'A') {
            // Arc — skip rx ry rot large sweep, use endpoint as a straight line.
            i += 5;
            pushLine(num() + (rel ? cx : 0), num() + (rel ? cy : 0));
        } else { i++; continue; } // unknown — skip a token defensively

        prevCmd = cmd;
    }

    return segs.length ? segs : null;
}

function clamp(v: number, lo: number, hi: number): number {
    return v < lo ? lo : v > hi ? hi : v;
}

export function createPathSampler(d: string): PathSampler | null {
    const segs = parseCubics(d);
    if (!segs) return null;

    // Cumulative start distance per segment; cum[segs.length] === total length.
    const cum = new Float64Array(segs.length + 1);
    for (let k = 0; k < segs.length; k++) cum[k + 1] = cum[k] + segs[k].len;
    const totalLength = cum[segs.length];

    // A path is CLOSED when it returns to its start (an explicit `Z`, or coincident
    // first/last points). Open paths get straight-line extrapolation past either end
    // (below); closed paths loop back on themselves, so there's no tip to run off.
    const start = segs[0].P0, end = segs[segs.length - 1].P3;
    const closed = Math.hypot(end[0] - start[0], end[1] - start[1]) < 1e-3;

    // Sample strictly within [0, totalLength].
    const sampleOn = (dist: number): PathPoint => {
        let k = 0;
        while (k < segs.length - 1 && dist > cum[k + 1]) k++;
        const seg = segs[k];
        const local = dist - cum[k];
        const t = seg.len > 0 ? bezier2D_tForDistance(seg.lut, local) : 0;
        const [x, y] = bezier2D_pointAt(seg.P0, seg.P1, seg.P2, seg.P3, t);
        const [dx, dy] = bezier2D_derivativeAt(seg.P0, seg.P1, seg.P2, seg.P3, t);
        return { x, y, angle: Math.atan2(dy, dx) };
    };

    return {
        totalLength,
        closed,
        sampleAtDistance(dist: number): PathPoint {
            // Past an end of an OPEN path: continue in a straight line along that
            // end's tangent, so along-path motion keeps going instead of piling up
            // at the tip. (The caller only asks for distances a glyph actually
            // reaches — startOffset + text length — so this never runs off forever.)
            if (!closed && (dist < 0 || dist > totalLength)) {
                const edge = dist < 0 ? 0 : totalLength;
                const p = sampleOn(edge);
                const over = dist - edge;
                return { x: p.x + Math.cos(p.angle) * over, y: p.y + Math.sin(p.angle) * over, angle: p.angle };
            }
            return sampleOn(clamp(dist, 0, totalLength));
        },
    };
}
