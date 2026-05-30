/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/


/**
 * "Equal-in-effect" comparator for SVGA node trees.
 *
 * Two trees can render identically while differing structurally — extra `<g>`
 * wrappers, different ids, `<use>` clones vs inline copies, a transform expressed
 * as a baked string vs a parts record. This module reduces a tree to what is
 * actually painted: every drawable leaf, with its CUMULATIVE transform matrix
 * (resolved at a given time) and key visual attributes. Comparing those leaf
 * sets ignores representation and catches genuine visual differences.
 *
 * It is a deterministic function applied identically to both trees, so equal
 * inputs (in effect) yield equal output regardless of how each was encoded.
 *
 * Dependency-free on purpose (mirrors the applier's isolation). Scope: the node
 * types and transform forms the player-effects / heavy serialisers emit. Colour
 * animation is not interpolated — leaves are compared at keyframe instants where
 * sampled values are exact.
 */

type Mat = [number, number, number, number, number, number];

interface VmNode {
    type?: string;
    children?: Array<VmNode>;
    [attr: string]: any;
}


// ─────────────────────────────────────────────────────────────────────────────
//  MATRIX MATH  (2x3 affine, SVG order: [a b c d e f])
// ─────────────────────────────────────────────────────────────────────────────

const IDENTITY: Mat = [1, 0, 0, 1, 0, 0];

function mul(m: Mat, n: Mat): Mat {
    return [
        m[0] * n[0] + m[2] * n[1],
        m[1] * n[0] + m[3] * n[1],
        m[0] * n[2] + m[2] * n[3],
        m[1] * n[2] + m[3] * n[3],
        m[0] * n[4] + m[2] * n[5] + m[4],
        m[1] * n[4] + m[3] * n[5] + m[5],
    ];
}

const translateM = (x: number, y: number): Mat => [1, 0, 0, 1, x, y];
const scaleM = (sx: number, sy: number): Mat => [sx, 0, 0, sy, 0, 0];
function rotateM(deg: number): Mat {
    const r = (deg * Math.PI) / 180;
    return [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0];
}
const skewXM = (deg: number): Mat => [1, 0, Math.tan((deg * Math.PI) / 180), 1, 0, 0];
const skewYM = (deg: number): Mat => [1, Math.tan((deg * Math.PI) / 180), 0, 1, 0, 0];


// ─────────────────────────────────────────────────────────────────────────────
//  TRANSFORM EVALUATION
// ─────────────────────────────────────────────────────────────────────────────

/** Parses an SVG transform string ("translate(..)rotate(..)…") into a matrix. */
function parseTransformString(s: string): Mat {
    let m = IDENTITY;
    const re = /(translate|rotate|scale|matrix|skewX|skewY)\(([^)]*)\)/g;
    let hit: RegExpExecArray | null;
    while ((hit = re.exec(s))) {
        const fn = hit[1];
        const a = hit[2].split(/[\s,]+/).filter(Boolean).map(Number);
        if (fn === 'translate') m = mul(m, translateM(a[0] || 0, a[1] || 0));
        else if (fn === 'scale') m = mul(m, scaleM(a[0], a.length > 1 ? a[1] : a[0]));
        else if (fn === 'rotate') m = mul(m, rotateM(a[0]));
        else if (fn === 'skewX') m = mul(m, skewXM(a[0]));
        else if (fn === 'skewY') m = mul(m, skewYM(a[0]));
        else if (fn === 'matrix') m = mul(m, [a[0], a[1], a[2], a[3], a[4], a[5]]);
    }
    return m;
}

interface Parts { translate?: [number, number]; rotate?: number; scale?: [number, number]; origin?: [number, number]; }

/** Composes a `PxTransformParts` record (player canonical order, origin-pivoted). */
function partsToMatrix(p: Parts): Mat {
    let m = IDENTITY;
    if (p.translate) m = mul(m, translateM(p.translate[0], p.translate[1]));
    const pivot = p.origin && (p.rotate !== undefined || p.scale);
    if (pivot) m = mul(m, translateM(p.origin![0], p.origin![1]));
    if (p.rotate !== undefined) m = mul(m, rotateM(p.rotate));
    if (p.scale) m = mul(m, scaleM(p.scale[0], p.scale[1]));
    if (pivot) m = mul(m, translateM(-p.origin![0], -p.origin![1]));
    return m;
}

function lerp(a: number, b: number, f: number): number { return a + (b - a) * f; }

/** Linear-interpolates a parts record between keyframes at time `t` (ms). */
function interpParts(kfs: Array<any>, t: number): Parts {
    if (!kfs.length) return {};
    if (t <= (kfs[0].time ?? 0)) return kfs[0].value || {};
    if (t >= (kfs[kfs.length - 1].time ?? 0)) return kfs[kfs.length - 1].value || {};

    let i = 0;
    while (i < kfs.length - 1 && (kfs[i + 1].time ?? 0) < t) i++;
    const a = kfs[i], b = kfs[i + 1];
    const f = (t - (a.time ?? 0)) / ((b.time ?? 0) - (a.time ?? 0) || 1);
    const va: Parts = a.value || {}, vb: Parts = b.value || {};

    const out: Parts = {};
    if (va.translate && vb.translate) out.translate = [lerp(va.translate[0], vb.translate[0], f), lerp(va.translate[1], vb.translate[1], f)];
    else out.translate = va.translate || vb.translate;
    if (va.rotate !== undefined && vb.rotate !== undefined) out.rotate = lerp(va.rotate, vb.rotate, f);
    else out.rotate = va.rotate ?? vb.rotate;
    if (va.scale && vb.scale) out.scale = [lerp(va.scale[0], vb.scale[0], f), lerp(va.scale[1], vb.scale[1], f)];
    else out.scale = va.scale || vb.scale;
    out.origin = va.origin || vb.origin;
    return out;
}

/** Resolves any transform-slot form (string | {value} | {keyframes}) to a matrix at `t`. */
function evalTransformValue(v: any, t: number): Mat {
    if (v === undefined || v === null) return IDENTITY;
    if (typeof v === 'string') return parseTransformString(v);
    if (v.keyframes) return partsToMatrix(interpParts(v.keyframes, t));
    if (v.value) return partsToMatrix(v.value);
    return IDENTITY;
}

/** The node's own transform at `t`: animated slot wins over the static baseline. */
function nodeMatrix(node: VmNode, t: number): Mat {
    if (node.animate && node.animate.transform) return evalTransformValue(node.animate.transform, t);
    if (node.transform !== undefined) return evalTransformValue(node.transform, t);
    return IDENTITY;
}

/** Linear-interpolates a scalar animation (e.g. opacity); falls back to static / default. */
function evalScalar(animated: any, staticVal: any, fallback: number, t: number): number {
    if (animated && animated.keyframes && animated.keyframes.length) {
        const kfs = animated.keyframes;
        if (t <= (kfs[0].time ?? 0)) return kfs[0].value;
        if (t >= (kfs[kfs.length - 1].time ?? 0)) return kfs[kfs.length - 1].value;
        let i = 0;
        while (i < kfs.length - 1 && (kfs[i + 1].time ?? 0) < t) i++;
        const a = kfs[i], b = kfs[i + 1];
        const f = (t - (a.time ?? 0)) / ((b.time ?? 0) - (a.time ?? 0) || 1);
        return lerp(a.value, b.value, f);
    }
    return staticVal !== undefined ? Number(staticVal) : fallback;
}


// ─────────────────────────────────────────────────────────────────────────────
//  FLATTEN  →  multiset of painted primitives
// ─────────────────────────────────────────────────────────────────────────────

const CONTAINER_TYPES = new Set(['svg', 'g', 'symbol']);
const SKIP_TYPES = new Set(['defs', 'mask', 'clipPath', 'title']);

function buildIdMap(node: VmNode, map: Map<string, VmNode>): void {
    if (typeof node.id === 'string') map.set(node.id, node);
    node.children?.forEach(c => buildIdMap(c, map));
}

function num(v: any): number { return v === undefined || v === null ? 0 : Number(v); }

// 2-decimal rounding (sub-pixel). The heavy path bakes matrices into strings
// rounded to ~4 decimals; comparing at 2 decimals avoids straddling a rounding
// boundary against the applier's full-precision values, while staying visually exact.
function round(n: number): number { return Math.round(n * 100) / 100 + 0; }

function geomKey(node: VmNode): string {
    switch (node.type) {
        case 'rect': return num(node.width) + ',' + num(node.height) + ',' + num(node.x) + ',' + num(node.y);
        case 'ellipse': return num(node.rx) + ',' + num(node.ry) + ',' + num(node.cx) + ',' + num(node.cy);
        case 'circle': return num(node.r) + ',' + num(node.cx) + ',' + num(node.cy);
        case 'path': return String(node.d ?? '');
        default: return '';
    }
}

function describePrimitive(node: VmNode, m: Mat, t: number): string {
    const fill = node.fill ?? '';
    const stroke = node.stroke ?? '';
    const sw = node['stroke-width'] ?? node.strokeWidth ?? '';
    const opacity = round(evalScalar(node.animate?.opacity, node.opacity, 1, t));
    const masked = node.mask ? 1 : 0;
    const mat = m.map(round).join(',');
    return node.type + '|' + geomKey(node) + '|[' + mat + ']|f:' + fill + '|s:' + stroke + '|sw:' + (num(sw) || '') + '|o:' + opacity + '|m:' + masked;
}

function flatten(node: VmNode, parent: Mat, t: number, idMap: Map<string, VmNode>, out: Array<string>): void {
    const type = node.type || '';
    if (SKIP_TYPES.has(type)) return;

    const m = mul(parent, nodeMatrix(node, t));

    if (type === 'use') {
        const targetId = typeof node.href === 'string' ? node.href.replace(/^#/, '') : '';
        const target = idMap.get(targetId);
        const useM = mul(m, translateM(num(node.x), num(node.y)));
        if (target) flatten(target, useM, t, idMap, out);
        else out.push('UNRESOLVED_USE:#' + targetId);
        return;
    }

    if (CONTAINER_TYPES.has(type)) {
        node.children?.forEach(c => flatten(c, m, t, idMap, out));
        return;
    }

    out.push(describePrimitive(node, m, t));
}


// ─────────────────────────────────────────────────────────────────────────────
//  PUBLIC: sample times + visual model + comparison
// ─────────────────────────────────────────────────────────────────────────────

/** Every keyframe `time` found anywhere in the tree, plus 0. */
export function collectSampleTimes(node: VmNode, into: Set<number>): void {
    into.add(0);
    const scanAnim = (anim: any) => {
        if (!anim || typeof anim !== 'object') return;
        for (const key of Object.keys(anim)) {
            const kfs = anim[key]?.keyframes;
            if (Array.isArray(kfs)) kfs.forEach(kf => into.add(kf.time ?? 0));
        }
    };
    scanAnim(node.animate);
    if (node.transform && typeof node.transform === 'object' && (node.transform as any).keyframes) {
        (node.transform as any).keyframes.forEach((kf: any) => into.add(kf.time ?? 0));
    }
    node.children?.forEach(c => collectSampleTimes(c, into));
}

/** Sorted, painted-primitive multiset for the tree at time `t`. */
export function visualModelAt(root: VmNode, t: number): Array<string> {
    const idMap = new Map<string, VmNode>();
    buildIdMap(root, idMap);
    const out: Array<string> = [];
    flatten(root, IDENTITY, t, idMap, out);
    return out.sort();
}

export interface EffectDiff {
    time: number;
    onlyInA: Array<string>;
    onlyInB: Array<string>;
}

/**
 * Compares two trees "in effect" across all keyframe instants found in either.
 * Returns one entry per time where the painted-primitive multisets differ.
 */
export function diffInEffect(a: VmNode, b: VmNode): Array<EffectDiff> {
    const times = new Set<number>();
    collectSampleTimes(a, times);
    collectSampleTimes(b, times);

    const diffs: Array<EffectDiff> = [];
    for (const t of Array.from(times).sort((x, y) => x - y)) {
        const ma = visualModelAt(a, t);
        const mb = visualModelAt(b, t);
        const onlyInA = subtractMultiset(ma, mb);
        const onlyInB = subtractMultiset(mb, ma);
        if (onlyInA.length || onlyInB.length) diffs.push({ time: t, onlyInA, onlyInB });
    }
    return diffs;
}

/** Items in `a` not matched one-for-one in `b` (multiset difference). */
function subtractMultiset(a: Array<string>, b: Array<string>): Array<string> {
    const counts = new Map<string, number>();
    for (const x of b) counts.set(x, (counts.get(x) || 0) + 1);
    const extra: Array<string> = [];
    for (const x of a) {
        const c = counts.get(x) || 0;
        if (c > 0) counts.set(x, c - 1);
        else extra.push(x);
    }
    return extra;
}
