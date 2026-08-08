/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/


import type { PxAnimatable, PxFillGradientEffect, PxGradientStop, PxKeyframe, PxLoop, PxNode, PxStrokeGradientEffect, Vec2 } from '../PxAnimatorTypes';
import { PxGradientType } from '../PxAnimatorConstants';
import { ReadKind, readAnimatable, writeAnimatableChannel } from './transformParts';
import type { ApplyContext } from './types';
import { genId } from './util';


/**
 * `effects.fillGradient` / `effects.strokeGradient` materialiser.
 *
 * WHY AN EFFECT (not a `fill` value): no value of `fill` IS a gradient — the
 * browser can only render one through a `<linearGradient>`/`<radialGradient>`
 * def with `<stop>` children plus a `url(#id)` indirection. Per the format's
 * attribute-vs-effect law (see `_PxEffects`), anything that requires minting
 * structure is an effect; flat `fill` colours stay plain animated attributes.
 *
 * Mirrors `maskedByEffect`: mint a `<linearGradient>` or `<radialGradient>`
 * def into `ctx.defs`, push the host element's `fill` / `stroke` to
 * `url(#auto-id)`. Same shape used for both fill and stroke — the only
 * difference is which host attribute is rewritten.
 *
 * The wire shape is a gradient as one animatable stop timeline + static geometry
 * (see `_PxFillGradientEffect`). When materialising:
 *   - geometry parts (`p1`, `p2`, `c`, `r`, `fp`) become static body attrs
 *     on the gradient def;
 *   - the stops array is either static (each `<stop>` is bare) or animated
 *     (each `<stop>` gets `animate.stopColor.keyframes` derived from the
 *     single source timeline by SLICING each kf's full snapshot at this
 *     stop's index).
 *
 * The per-stop slicing produces the standard `<linearGradient>` + `<stop>`
 * def chain, so the materialised tree round-trips through the usual reader.
 */
export function applyFillGradientEffect(node: PxNode, fx: PxFillGradientEffect | undefined, ctx: ApplyContext): PxNode {
    return applyGradient(node, fx, ctx, 'fill');
}

export function applyStrokeGradientEffect(node: PxNode, fx: PxStrokeGradientEffect | undefined, ctx: ApplyContext): PxNode {
    return applyGradient(node, fx, ctx, 'stroke');
}


// ─────────────────────────────────────────────────────────────────────────────
//  Internals
// ─────────────────────────────────────────────────────────────────────────────

function applyGradient(node: PxNode, fx: PxFillGradientEffect | undefined, ctx: ApplyContext, attr: 'fill' | 'stroke'): PxNode {
    if (!fx) return node;

    const id = genId(ctx, 'grad');
    const def = synthesiseGradientDef(fx, id, ctx);
    ctx.defs.push(def);
    node[attr] = 'url(#' + id + ')';
    return node;
}

function synthesiseGradientDef(fx: PxFillGradientEffect, id: string, ctx: ApplyContext): PxNode {
    const out: PxNode = {
        type: fx.type === PxGradientType.radial ? 'radialGradient' : 'linearGradient',
        id,
    };

    // Geometry — standard animatable slots. Static → body attrs; animated → the
    // def node's own `animate` channels under the real SVG attr names (a vec slot
    // splits into its two axis channels here, in the applier — the wire stays
    // `p1: {keyframes:[{value:[x,y]}…]}`). The frames engine then drives the
    // def's attrs exactly like the stops' `stopColor` (CSS/WAAPI can't animate
    // gradient geometry, but this materialiser feeds the JS frame loop).
    if (fx.type === PxGradientType.linear) {
        applyGeomVec(out, 'x1', 'y1', fx.p1);
        applyGeomVec(out, 'x2', 'y2', fx.p2);
    } else {
        applyGeomVec(out, 'cx', 'cy', fx.c);
        applyGeomNumber(out, 'r', fx.r);
        applyGeomVec(out, 'fx', 'fy', fx.fp);
    }
    if (fx.gradientUnits)     out.gradientUnits = fx.gradientUnits;
    if (fx.spreadMethod)      out.spreadMethod = fx.spreadMethod;
    if (fx.gradientTransform) out.gradientTransform = fx.gradientTransform;

    // (The old per-scalar `fx.animate.gradientX1…` channels are NOT read any
    // more — geometry animates on the slots above. Backward compat dropped
    // deliberately; a leftover `animate` key is flagged by strict validation.)

    out.children = buildStopChildren(fx.stops, ctx);
    return out;
}

/** Animatable Vec2 geometry slot → static `xAttr`/`yAttr` body attrs, or two
 *  per-axis `animate` channels (times/easings preserved, `loop` carried) plus
 *  static baseline attrs from the base/first kf. */
function applyGeomVec(out: PxNode, xAttr: string, yAttr: string, raw: PxAnimatable<Vec2> | undefined): void {
    const read = readAnimatable<Vec2>(raw);
    if (read.kind === ReadKind.Absent) return;
    if (read.kind === ReadKind.Static) {
        out[xAttr] = String(read.value[0]);
        out[yAttr] = String(read.value[1]);
        return;
    }
    const axisChannel = (idx: 0 | 1): { keyframes: Array<PxKeyframe>; loop?: PxLoop | boolean } => {
        const block: { keyframes: Array<PxKeyframe>; loop?: PxLoop | boolean } = {
            keyframes: read.keyframes.map(kf => {
                const axisKf: PxKeyframe = { time: kf.time, value: Array.isArray(kf.value) ? kf.value[idx] : undefined };
                if (kf.easing !== undefined) axisKf.easing = kf.easing;
                return axisKf;
            }),
        };
        if (read.loop !== undefined) block.loop = read.loop;
        return block;
    };
    const animate = (out.animate as Record<string, unknown> | undefined) ?? {};
    animate[xAttr] = axisChannel(0);
    animate[yAttr] = axisChannel(1);
    out.animate = animate as PxNode['animate'];
    const baseline = read.base ?? read.keyframes[0]?.value;
    if (Array.isArray(baseline)) {
        out[xAttr] = String(baseline[0]);
        out[yAttr] = String(baseline[1]);
    }
}

/** Animatable number geometry slot (radial `r`) → static attr or `animate` channel. */
function applyGeomNumber(out: PxNode, attrName: string, raw: PxAnimatable<number> | undefined): void {
    const read = readAnimatable<number>(raw);
    if (read.kind === ReadKind.Absent) return;
    writeAnimatableChannel(out, attrName, read, { asString: true });
}

/** Emits one `<stop>` per gradient stop. Stops come from EITHER the static
 *  array form (`stops: [{offset, color}, …]`) or the animated form
 *  (`stops: {keyframes:[{time, value:[stops], easing?}]}`). For the
 *  animated form, each emitted `<stop>` gets `animate.stopColor.keyframes`
 *  whose values are sliced out of the source timeline at this stop's
 *  index — the standard `<stop>` def chain. */
function buildStopChildren(stops: PxAnimatable<Array<PxGradientStop>> | undefined, ctx: ApplyContext): Array<PxNode> {
    if (!stops) return [];

    // Shared reader — bare array / `{value: […]}` statics, `{keyframes|kfs, loop?}` animated.
    const read = readAnimatable<Array<PxGradientStop>>(stops);
    if (read.kind === ReadKind.Absent) return [];
    if (read.kind === ReadKind.Static) return Array.isArray(read.value) ? read.value.map(staticStopNode) : [];

    const kfs = read.keyframes as Array<PxKeyframe>;
    if (!kfs.length) return [];
    // Per-stop animations inherit the timeline-level `loop` (alternate/cycle/etc.).
    // Without forwarding it, animating a gradient with `loop.alternate:true`
    // would slice each stop's colours into separate `animate.stopColor`
    // entries that lose the loop config → no reversal past the last kf,
    // even though every non-gradient animatable property loops fine. See
    // also: the gradient stop "slice" docstring above.
    const loopFromSource = read.loop;

    // Stop count: take the LARGEST across kfs (constraint says constant
    // count, but defensive — when missing, hold the last value).
    let stopCount = 0;
    for (const kf of kfs) {
        const v = (kf.value ?? kf.v) as Array<PxGradientStop> | undefined;
        if (Array.isArray(v) && v.length > stopCount) stopCount = v.length;
    }
    if (!stopCount) return [];

    // Baseline stop info from kf[0] — offsets stay fixed across kfs, only
    // colours animate; offset rarely animates but if it does we sample at
    // each kf.
    const firstKfValue = (kfs[0].value ?? kfs[0].v) as Array<PxGradientStop> | undefined;
    const baselineStops: Array<PxGradientStop> = [];
    for (let i = 0; i < stopCount; i++) {
        const s = firstKfValue?.[i] ?? prevDefinedStop(kfs, 0, i) ?? { offset: i / Math.max(1, stopCount - 1), color: '#000000' };
        baselineStops.push({ offset: s.offset, color: s.color });
    }

    return baselineStops.map((bs, i) => animatedStopNode(bs, kfs, i, ctx, loopFromSource));
}

function staticStopNode(s: PxGradientStop): PxNode {
    return {
        type: 'stop',
        offset: formatOffset(s.offset),
        stopColor: s.color,
    };
}

function animatedStopNode(baseline: PxGradientStop, kfs: Array<PxKeyframe>, stopIdx: number, _ctx: ApplyContext, loop: PxLoop | boolean | undefined): PxNode {
    const colorKfs: Array<PxKeyframe> = [];
    const offsetKfs: Array<PxKeyframe> = [];
    // Only emit an `offset` timeline when the offset actually moves across
    // kfs — most gradients animate colour only, and a static offset attr is
    // cheaper than a runtime binding that recomputes the same value.
    let offsetVaries = false;
    for (const kf of kfs) {
        const t = kf.time ?? kf.t ?? 0;
        const arr = (kf.value ?? kf.v) as Array<PxGradientStop> | undefined;
        const sliced = arr?.[stopIdx] ?? prevDefinedStop(kfs, kfs.indexOf(kf), stopIdx);
        if (!sliced) continue;
        const easing = kf.easing ?? kf.e;

        const colorOut: PxKeyframe = { time: t, value: sliced.color };
        if (easing !== undefined) colorOut.easing = easing;
        colorKfs.push(colorOut);

        // Offset is a unitless 0..1 fraction (SVG `<stop offset>` accepts it
        // bare); the runtime interpolates it as a numeric attr.
        const offsetOut: PxKeyframe = { time: t, value: sliced.offset };
        if (easing !== undefined) offsetOut.easing = easing;
        offsetKfs.push(offsetOut);
        if (sliced.offset !== baseline.offset) offsetVaries = true;
    }

    const stop: PxNode = {
        type: 'stop',
        offset: formatOffset(baseline.offset),
        stopColor: baseline.color,
    };
    const animate: { [k: string]: { keyframes: Array<PxKeyframe>, loop?: PxLoop | boolean } } = {};
    if (colorKfs.length) {
        animate.stopColor = { keyframes: colorKfs };
        if (loop !== undefined) animate.stopColor.loop = loop;
    }
    if (offsetVaries && offsetKfs.length) {
        animate.offset = { keyframes: offsetKfs };
        if (loop !== undefined) animate.offset.loop = loop;
    }
    if (Object.keys(animate).length) stop.animate = animate;
    return stop;
}

/** Walks backwards from `fromIdx` looking for a kf whose stops array has
 *  an entry at `stopIdx`. Used when a kf's stops array is shorter than the
 *  global stop count (shouldn't happen if writer respects the constraint,
 *  but degrades gracefully). */
function prevDefinedStop(kfs: Array<PxKeyframe>, fromIdx: number, stopIdx: number): PxGradientStop | undefined {
    for (let i = fromIdx; i >= 0; i--) {
        const arr = (kfs[i].value ?? kfs[i].v) as Array<PxGradientStop> | undefined;
        if (arr?.[stopIdx]) return arr[stopIdx];
    }
    for (let i = fromIdx + 1; i < kfs.length; i++) {
        const arr = (kfs[i].value ?? kfs[i].v) as Array<PxGradientStop> | undefined;
        if (arr?.[stopIdx]) return arr[stopIdx];
    }
    return undefined;
}

/** `0.5` → `"50%"`; `1` → `"100%"`; `0.123` → `"12.3%"`. Matches SVG
 *  convention for `<stop offset>`. */
function formatOffset(o: number): string {
    const pct = Math.round(o * 1000) / 10;
    return pct + '%';
}
