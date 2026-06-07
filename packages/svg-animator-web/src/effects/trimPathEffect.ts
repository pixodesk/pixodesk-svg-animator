/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/


import type { PxAnimatable, PxBezierPath, PxKeyframe, PxLoop, PxNode, Vec2, _PxTrimPathEffect } from '../PxAnimatorTypes';
import { bezier2D_arcLengthLUT, bezierToSvgPath, clamp } from '../PxAnimatorUtil';
import { parseSvgPathToBezier } from '../PxDefinitions';
import { ReadKind, readAnimatable, type ReadPart } from './transformParts';
import type { ApplyContext } from './types';


/**
 * Mirrors the Editor's `TSvgTrimPathEffect.applyEffect` (see
 * `app/src/svgeditor/model/elements/shape/trimpath/TSvgTrimPathEffect.tsx`):
 * collects every descendant shape leaf, slices each leaf's `d` into
 * sub-paths, measures each in px, and converts the parametric `offset` +
 * `range` to per-sub-path `stroke-dasharray` / `stroke-dashoffset` (and
 * `opacity` for empty-range hide).
 *
 *   - `trimAllAsOne` chains every sub-path's length end-to-end so the
 *     window slides across siblings (a flag of TRUE keeps a single trim
 *     window — see the editor's `getShapeEls` / chained `totalLength`).
 *   - Animated `offset` becomes `animate.strokeDashoffset.keyframes`;
 *     animated `range` becomes `animate.strokeDasharray.keyframes`.
 *   - The dasharray emits the same repeated pattern as the editor's
 *     `getTrimPathToDasharrayFn` so any dashoffset shift lands on a valid
 *     dash segment.
 *   - Empty-range moments are hidden with `stroke-opacity` 0 (STROKE only — the
 *     fill stays visible, matching the editor's `trimOpacity` → `stroke-opacity`).
 *
 * COLLAPSE: when the trim host is itself a single shape leaf with exactly ONE
 * sub-path, the trim materialises directly onto that leaf's own `<path>` (no
 * `<g>` split) — mirroring the editor's
 * `TSvgShapeElement.collapsibleSingleSubpathTrimPart`. Multi-subpath (or
 * group/descendant) trims still expand to `<g>` + one bare `<path>` per sub-path.
 */
export function applyTrimPathEffect(
    node: PxNode,
    trimPath: _PxTrimPathEffect | undefined,
    isCombinedShape: boolean | undefined,
    ctx: ApplyContext,
): PxNode {
    if (!trimPath) return node;

    const trimAllAsOne = !!trimPath.trimAllAsOne;

    // Pass 1a — collect leaves with subpath lengths (no chain offset yet).
    const leafEntries: Array<LeafEntry> = [];
    const measure = (n: PxNode): void => {
        if (Array.isArray(n.children) && n.children.length > 0) {
            for (const ch of n.children) measure(ch);
            return;
        }
        const d = typeof n.d === 'string' ? n.d : rectToPathD(n);
        if (d === undefined) return;
        const subpaths = parseSvgPathToBezier(d);
        if (!subpaths.length) return;
        const entry: LeafEntry = { leaf: n, subpaths: [] };
        for (const sp of subpaths) {
            const lengthPx = pxBezierPathLength(sp);
            entry.subpaths.push({ subpath: sp, lengthPx, startOffsetPx: 0 });
        }
        leafEntries.push(entry);
    };
    measure(node);

    if (!leafEntries.length) return node;

    // Pass 1b — assign chain offsets.
    // `trimAllAsOne=true`: walk leaves in REVERSE doc order so the chain
    // starts at the visually-topmost leaf (the editor's convention — see
    // `TSvgTrimPathEffect.applyEffect` which iterates `els.reverse()`). Within
    // each leaf, subpaths keep their `d`-attribute order. This matches the
    // editor's dashoffsets exactly — without the reverse, a multi-leaf group
    // emits the leaves' dashoffsets SWAPPED, which renders the visible trim
    // window on the wrong subpath.
    // `trimAllAsOne=false`: each subpath gets its own independent chain
    // (offset 0), so the leaf iteration order doesn't matter.
    let acc = 0;
    const iterOrder = trimAllAsOne ? [...leafEntries].reverse() : leafEntries;
    for (const entry of iterOrder) {
        for (const sp of entry.subpaths) {
            if (!trimAllAsOne) acc = 0;
            sp.startOffsetPx = acc;
            acc += sp.lengthPx;
        }
    }

    const chainLengthPx = acc;
    if (trimAllAsOne && chainLengthPx < 0.001) return node;

    // Offset / range readers. Range is post-processed for cross-overs so the
    // dasharray emitter never sees `range[0] > range[1]` (matches editor's
    // `getFixedRangeForCss`).
    //
    // Editor defaults: `offset = 0` and `range = [0, 1]`. Treating absent
    // inputs as those statics (rather than skipping the emit) keeps the
    // `+ SMALL_PADDING_PX` shift active — that 1-px buffer is what stops
    // `stroke-linecap="round"` from painting a round dot at the zero-length
    // first dash. Missing-emit means no `stroke-dashoffset`, no shift, and
    // the dot reappears.
    const offsetReadRaw = readAnimatable<number>(trimPath.offset);
    const offsetRead: ReadPart<number> = offsetReadRaw.kind === ReadKind.Absent
        ? { kind: ReadKind.Static, value: 0 }
        : offsetReadRaw;
    const rangeReadRaw = readRangeWithCrossings(trimPath.range);
    const rangeRead: ReadPart<Vec2> = rangeReadRaw.kind === ReadKind.Absent
        ? { kind: ReadKind.Static, value: [0, 1] }
        : rangeReadRaw;

    const offsetValues = readScalarValues(offsetRead);
    const minOffset = offsetValues.length ? Math.min(...offsetValues) : 0;
    const maxOffset = offsetValues.length ? Math.max(...offsetValues) : 0;
    const minMaxOffset: [number, number] = [minOffset, maxOffset];

    // COLLAPSE: the trim host is a single shape leaf with exactly one sub-path
    // → no `<g>` split. The trim stroke attrs go directly on the leaf's own
    // `<path>` (its `fill` / `stroke` / `transform` / `id` stay put). Mirrors the
    // editor's `TSvgShapeElement.collapsibleSingleSubpathTrimPart`.
    if (leafEntries.length === 1 && leafEntries[0].leaf === node && leafEntries[0].subpaths.length === 1) {
        const entry = leafEntries[0];
        const sp = entry.subpaths[0];
        const pathLengthPx = trimAllAsOne ? chainLengthPx : sp.lengthPx;
        if (pathLengthPx < 0.001) return node;
        const startOffsetPct = trimAllAsOne ? sp.startOffsetPx / pathLengthPx : 0;
        return collapseLeafWithTrim(entry.leaf, pathLengthPx, startOffsetPct, minMaxOffset, offsetRead, rangeRead);
    }

    // Pass 2 — walk the tree and replace each measured leaf with a <g>
    // containing one bare <path> per sub-path.
    const replacements = new Map<PxNode, PxNode>();
    for (const entry of leafEntries) {
        const newChildren: Array<PxNode> = [];
        for (const sp of entry.subpaths) {
            const pathLengthPx = trimAllAsOne ? chainLengthPx : sp.lengthPx;
            if (pathLengthPx < 0.001) continue;
            const startOffsetPct = trimAllAsOne ? sp.startOffsetPx / pathLengthPx : 0;
            newChildren.push(...buildSubpathNodes(entry.leaf, sp.subpath, pathLengthPx, startOffsetPct, minMaxOffset, offsetRead, rangeRead, ctx));
        }
        replacements.set(entry.leaf, wrapLeafAsGroup(entry.leaf, newChildren));
    }

    const swap = (n: PxNode): PxNode => {
        const r = replacements.get(n);
        if (r) return r;
        if (Array.isArray(n.children) && n.children.length > 0) {
            return { ...n, children: n.children.map(swap) };
        }
        return n;
    };
    return swap(node);
}


// ============================================================================
// Leaf -> sub-path table
// ============================================================================

interface LeafEntry {
    leaf: PxNode;
    subpaths: Array<{ subpath: PxBezierPath; lengthPx: number; startOffsetPx: number }>;
}

/** Wraps a leaf as a `<g>` with new sub-path children. Outer attrs of the leaf
 *  move onto the wrapper (so its `id` / style anchors are preserved); `d`,
 *  `strokeDasharray`, `strokeDashoffset`, and `effects` are stripped. */
function wrapLeafAsGroup(leaf: PxNode, children: Array<PxNode>): PxNode {
    const wrapper: PxNode = { ...leaf, type: 'g', children };
    delete wrapper.d;
    delete wrapper.strokeDasharray;
    delete wrapper.strokeDashoffset;
    delete wrapper.effects;
    return wrapper;
}


// ============================================================================
// Sub-path node builder
// ============================================================================

function buildSubpathNodes(
    leaf: PxNode,
    subpath: PxBezierPath,
    pathLengthPx: number,
    startOffsetPct: number,
    minMaxOffset: [number, number],
    offsetRead: ReadPart<number>,
    rangeRead: ReadPart<Vec2>,
    ctx: ApplyContext,
): Array<PxNode> {
    const offsetToDashOffset = makeOffsetToDashOffset(startOffsetPct, pathLengthPx, minMaxOffset);
    const rangeToDasharray = makeRangeToDasharray(pathLengthPx, minMaxOffset);

    const dashOffsetAttr = computeAnimAttr(offsetRead, offsetToDashOffset);
    const dashArrayAttr = computeAnimAttr(rangeRead, rangeToDasharray);
    const strokeOpacityAttr = computeOpacityFromRange(rangeRead);

    const dStr = bezierToSvgPath(subpath);

    // Bare sub-path under the trim wrapper — fill / stroke / stroke-width are
    // inherited from the wrapper <g>. The empty-range hide uses `stroke-opacity`
    // (STROKE only), so the fill stays visible without a fill-only twin.
    const base = makeBareSubpath(dStr);
    applyAttr(base, 'strokeDasharray', dashArrayAttr);
    applyAttr(base, 'strokeDashoffset', dashOffsetAttr);
    applyAttr(base, 'strokeOpacity', strokeOpacityAttr);

    return [base];
}

/** Collapsed single-subpath form: the trim host stays a single `<path>` (its own
 *  `fill` / `stroke` / `transform` / `id` preserved); the trim stroke attrs are
 *  applied directly. Mirrors the editor's collapsed `<path>` output. */
function collapseLeafWithTrim(
    leaf: PxNode,
    pathLengthPx: number,
    startOffsetPct: number,
    minMaxOffset: [number, number],
    offsetRead: ReadPart<number>,
    rangeRead: ReadPart<Vec2>,
): PxNode {
    const offsetToDashOffset = makeOffsetToDashOffset(startOffsetPct, pathLengthPx, minMaxOffset);
    const rangeToDasharray = makeRangeToDasharray(pathLengthPx, minMaxOffset);

    const node: PxNode = { ...leaf };
    delete node.effects;
    applyAttr(node, 'strokeDasharray', computeAnimAttr(rangeRead, rangeToDasharray));
    applyAttr(node, 'strokeDashoffset', computeAnimAttr(offsetRead, offsetToDashOffset));
    applyAttr(node, 'strokeOpacity', computeOpacityFromRange(rangeRead));
    return node;
}

/** Fresh `<path>` carrying only the sub-path geometry. Presentation attrs
 *  (`fill`, `stroke`, `stroke-width`, `transform`, `id`, …) stay on the wrapper
 *  `<g>` and are inherited — matches the editor's `renderCompositePathIfHasTrim`
 *  which emits bare `<path>`s under a single attrs-bearing `<g>`. */
function makeBareSubpath(dStr: string): PxNode {
    return { type: 'path', d: dStr };
}


// ============================================================================
// Math (mirrors the editor's TSvgTrimPathEffect helpers exactly)
// ============================================================================

const SMALL_PADDING_PX = 1;

/** Editor's `getFromTrimToDashOffsetFn` — produces a px dashoffset. */
function makeOffsetToDashOffset(
    startOffsetPct: number,
    pathLengthPx: number,
    minMaxOffset: [number, number],
): (offsetVal: number) => number {
    const [minIdx] = getOffsetIndexRange(minMaxOffset);
    return offsetVal => pathLengthPx * (-offsetVal - minIdx + startOffsetPct) + SMALL_PADDING_PX;
}

/** Editor's `getTrimPathToDasharrayFn` — produces a px dash pattern of the
 *  form `[0, gap, dash, gap, dash, ..., gap]` repeated so the offset can wrap. */
function makeRangeToDasharray(
    pathLengthPx: number,
    minMaxOffset: [number, number],
): (rangeVal: Vec2) => Array<number> {
    const [minIdx, maxIdx] = getOffsetIndexRange(minMaxOffset);
    const repeats = maxIdx - minIdx + 1;
    return (rangeVal: Vec2) => {
        const a = clamp(rangeVal[0], 0, 1);
        const b = clamp(rangeVal[1], 0, 1);
        const minR = Math.min(a, b);
        const maxR = Math.max(a, b);
        const out: Array<number> = [0];
        let gap = SMALL_PADDING_PX;
        for (let i = 0; i < repeats; i++) {
            out.push(gap + minR * pathLengthPx);            // GAP
            out.push((maxR - minR) * pathLengthPx);          // DASH
            gap = (1 - maxR) * pathLengthPx;
        }
        out.push(gap + SMALL_PADDING_PX);                    // closing GAP
        return out;
    };
}

/** Editor's `getMinMaxOffsetIndex`. */
function getOffsetIndexRange(minMaxOffset: [number, number]): [number, number] {
    return [
        Math.floor(Math.min(-minMaxOffset[0], -minMaxOffset[1])),
        Math.ceil(Math.max(-minMaxOffset[0], -minMaxOffset[1])),
    ];
}


// ============================================================================
// Animatable plumbing
// ============================================================================

type AnimAttrResult<TOut> =
    | { kind: ReadKind.Static; value: TOut }
    | { kind: ReadKind.Animated; keyframes: Array<PxKeyframe>; loop?: PxLoop | boolean }
    | undefined;

function readScalarValues(r: ReadPart<number>): Array<number> {
    if (r.kind === ReadKind.Absent) return [];
    if (r.kind === ReadKind.Static) return [r.value];
    const out: Array<number> = [];
    for (const kf of r.keyframes) {
        const v = kf.value ?? kf.v;
        if (typeof v === 'number') out.push(v);
    }
    return out;
}

function computeAnimAttr<TIn, TOut>(read: ReadPart<TIn>, map: (v: TIn) => TOut): AnimAttrResult<TOut> {
    if (read.kind === ReadKind.Absent) return undefined;
    if (read.kind === ReadKind.Static) return { kind: ReadKind.Static, value: map(read.value) };
    return {
        kind: ReadKind.Animated,
        keyframes: read.keyframes.map(kf => ({
            time: kf.time ?? kf.t ?? 0,
            value: map((kf.value ?? kf.v) as TIn),
            easing: kf.easing ?? kf.e,
        })),
        loop: read.loop,
    };
}

function applyAttr<T>(node: PxNode, attrName: string, attr: AnimAttrResult<T>): void {
    if (!attr) return;
    if (attr.kind === ReadKind.Static) {
        node[attrName] = attr.value;
        return;
    }
    const prevAnimate = node.animate && typeof node.animate === 'object' && !Array.isArray(node.animate) ? node.animate : undefined;
    const animate: Record<string, any> = { ...(prevAnimate || {}) };
    const block: { keyframes: Array<PxKeyframe>, loop?: PxLoop | boolean } = { keyframes: attr.keyframes };
    if (attr.loop !== undefined) block.loop = attr.loop;
    animate[attrName] = block;
    node.animate = animate;
    // ALSO write the first kf's value as a STATIC attribute. The animator only
    // pushes the animated value to the DOM on its first rAF tick — if a caller
    // snapshots the DOM in the window between `play()` and that first tick
    // (e.g. visual-tests live-mode sample at t=0), the element renders with
    // DEFAULT stroke styling (no dash, full opacity), which would expose the
    // entire stroked path even when the t=0 kf says it should be hidden /
    // mostly-dashed. Mirroring the SVG convention of "static baseline +
    // animation" makes the pre-tick DOM render match the kf-at-time-0 value.
    const firstKf = attr.keyframes[0];
    if (firstKf && (firstKf.value ?? (firstKf as any).v) !== undefined) {
        node[attrName] = firstKf.value ?? (firstKf as any).v;
    }
}

/** Width (ms) of the opacity transition emitted at each hide↔show boundary.
 *  Matches the editor's "+1 SVGA frame" (= 10 ms at the 100 fps SVGA grid). */
const OPACITY_STEP_MS = 10;

/** Editor's empty-range opacity (`shouldHide(startEnd) = startEnd[0] === startEnd[1]`).
 *  Static: single 0 if hide always; undefined otherwise.
 *  Animated: step-jump kfs at each hide↔show transition (~one SVGA frame
 *  wide so the renderer doesn't briefly show the stroke between an empty
 *  range and the first non-empty kf at wall-clock t≈0). */
function computeOpacityFromRange(rangeRead: ReadPart<Vec2>): AnimAttrResult<number> {
    const hide = (v: Vec2): boolean => v[0] === v[1];

    if (rangeRead.kind === ReadKind.Absent) return undefined;
    if (rangeRead.kind === ReadKind.Static) return hide(rangeRead.value) ? { kind: ReadKind.Static, value: 0 } : undefined;

    const kfs = rangeRead.keyframes;
    let anyHide = false;
    let allHide = true;
    for (const kf of kfs) {
        if (hide((kf.value ?? kf.v) as Vec2)) anyHide = true;
        else allHide = false;
    }
    if (!anyHide) return undefined;
    if (allHide) return { kind: ReadKind.Static, value: 0 };

    // Matches the editor's prev/next-aware emitter — only inserts kfs at the
    // transitions to keep the wire compact.
    const out: Array<PxKeyframe> = [];
    for (let i = 0; i < kfs.length; i++) {
        const kf = kfs[i];
        const prevKf = i > 0 ? kfs[i - 1] : undefined;
        const nextKf = i < kfs.length - 1 ? kfs[i + 1] : undefined;
        const t = kf.time ?? kf.t ?? 0;
        const thisHide = hide((kf.value ?? kf.v) as Vec2);
        const prevHide = prevKf ? thisHide && hide((prevKf.value ?? prevKf.v) as Vec2) : thisHide;
        const nextHide = nextKf ? thisHide && hide((nextKf.value ?? nextKf.v) as Vec2) : thisHide;

        if (prevHide && !nextHide) {
            out.push({ time: t, value: 0 });
            out.push({ time: t + OPACITY_STEP_MS, value: 1 });
        } else if (!prevHide && nextHide) {
            out.push({ time: t - OPACITY_STEP_MS, value: 1 });
            out.push({ time: t, value: 0 });
        }
    }
    if (out.length <= 1) return undefined;
    return { kind: ReadKind.Animated, keyframes: out };
}


// ============================================================================
// Range cross-over (editor's `getFixedRangeForCss`)
// ============================================================================

interface SimpleKf { time: number; value: Vec2; easing?: any; }

/** Reads `range` and, when the kf sequence has `value[0] > value[1]` anywhere,
 *  inserts crossing-point keyframes (bisection-located) and swaps any
 *  remaining reversed kfs so every emitted range satisfies `range[0] ≤ range[1]`. */
function readRangeWithCrossings(raw: PxAnimatable<Vec2> | undefined): ReadPart<Vec2> {
    const r = readAnimatable<Vec2>(raw);
    if (r.kind !== ReadKind.Animated) return r;

    const kfs: Array<SimpleKf> = r.keyframes.map(kf => ({
        time: kf.time ?? kf.t ?? 0,
        value: (kf.value ?? kf.v) as Vec2,
        easing: kf.easing ?? kf.e,
    }));

    const hasReverse = kfs.some(kf => kf.value[0] > kf.value[1]);
    if (!hasReverse) {
        return {
            kind: ReadKind.Animated,
            keyframes: kfs.map(kf => ({ time: kf.time, value: kf.value, easing: kf.easing })),
        };
    }

    const crossingTimes: Array<number> = [];
    for (let i = 1; i < kfs.length; i++) {
        const prev = kfs[i - 1];
        const cur = kfs[i];
        const dPrev = prev.value[1] - prev.value[0];
        const dCur = cur.value[1] - cur.value[0];
        if (dPrev * dCur < 0) {
            const t = bisectionForRangeCrossing(prev, cur);
            if (t !== null && t > prev.time && t < cur.time) {
                crossingTimes.push(Math.round(t));
            }
        }
    }
    const uniqueTs = Array.from(new Set(crossingTimes)).sort((a, b) => a - b);

    const out: Array<SimpleKf> = [];
    let j = 0;
    for (const kf of kfs) {
        while (j < uniqueTs.length && uniqueTs[j] < kf.time) {
            const t = uniqueTs[j++];
            const v = interpolateRangeAt(kfs, t);
            const m = (v[0] + v[1]) / 2;
            out.push({ time: t, value: [m, m] });
        }
        const v: Vec2 = kf.value[0] > kf.value[1] ? [kf.value[1], kf.value[0]] : kf.value;
        out.push({ time: kf.time, value: v, easing: kf.easing });
    }
    while (j < uniqueTs.length) {
        const t = uniqueTs[j++];
        const v = interpolateRangeAt(kfs, t);
        const m = (v[0] + v[1]) / 2;
        out.push({ time: t, value: [m, m] });
    }

    return { kind: ReadKind.Animated, keyframes: out };
}

function bisectionForRangeCrossing(prev: SimpleKf, cur: SimpleKf): number | null {
    const f = (t: number): number => {
        const a = (t - prev.time) / (cur.time - prev.time);
        const v0 = prev.value[0] + (cur.value[0] - prev.value[0]) * a;
        const v1 = prev.value[1] + (cur.value[1] - prev.value[1]) * a;
        return v1 - v0;
    };
    let lo = prev.time, hi = cur.time;
    let fLo = f(lo);
    if (fLo === 0) return lo;
    const fHi = f(hi);
    if (fHi === 0) return hi;
    if (fLo * fHi > 0) return null;
    for (let i = 0; i < 100; i++) {
        const mid = (lo + hi) / 2;
        const fMid = f(mid);
        if (fMid === 0 || Math.abs(hi - lo) < 0.0001) return mid;
        if (fLo * fMid < 0) { hi = mid; }
        else { lo = mid; fLo = fMid; }
    }
    return (lo + hi) / 2;
}

function interpolateRangeAt(kfs: Array<SimpleKf>, t: number): Vec2 {
    if (t <= kfs[0].time) return kfs[0].value;
    if (t >= kfs[kfs.length - 1].time) return kfs[kfs.length - 1].value;
    for (let i = 1; i < kfs.length; i++) {
        if (t <= kfs[i].time) {
            const prev = kfs[i - 1];
            const cur = kfs[i];
            const a = (t - prev.time) / (cur.time - prev.time);
            return [
                prev.value[0] + (cur.value[0] - prev.value[0]) * a,
                prev.value[1] + (cur.value[1] - prev.value[1]) * a,
            ];
        }
    }
    return kfs[kfs.length - 1].value;
}


// ============================================================================
// Geometry helpers
// ============================================================================

/** Total arc length of a `PxBezierPath` (sum of per-segment LUT lengths). */
function pxBezierPathLength(path: PxBezierPath): number {
    const v = path.v;
    if (!v || v.length < 2) return 0;
    let total = 0;
    for (let i = 0; i < v.length - 1; i++) {
        total += segmentLength(path, i, i + 1);
    }
    if (path.c && v.length > 1) {
        total += segmentLength(path, v.length - 1, 0);
    }
    return total;
}

function segmentLength(path: PxBezierPath, from: number, to: number): number {
    const v = path.v;
    const p0 = v[from] as [number, number];
    const p3 = v[to] as [number, number];
    const p1 = (path.o?.[from] ?? p0) as [number, number];
    const p2 = (path.i?.[to] ?? p3) as [number, number];
    const lut = bezier2D_arcLengthLUT(p0, p1, p2, p3);
    return lut.ds[lut.ds.length - 1];
}

/** `<rect>` -> outline path `d`. Emits the explicit closing-line vertex
 *  (`L x0,y0`) before `z` so the resulting string matches the editor's
 *  `SimpleBezierPath.writeToSvg` output (which always adds the closing segment
 *  unless `start===end`). Returns undefined for unsupported types. */
function rectToPathD(node: PxNode): string | undefined {
    if (node.type !== 'rect') return undefined;
    const x = Number(node.x ?? 0), y = Number(node.y ?? 0);
    const w = Number(node.width ?? 0), h = Number(node.height ?? 0);
    return 'M' + (x + w) + ',' + y +
        'L' + (x + w) + ',' + (y + h) +
        'L' + x + ',' + (y + h) +
        'L' + x + ',' + y +
        'L' + (x + w) + ',' + y + 'z';
}
