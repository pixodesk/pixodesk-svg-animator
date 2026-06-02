/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/


import type { PxAnimatable, PxFillGradientEffect, PxGradientStop, PxKeyframe, PxNode, PxStrokeGradientEffect } from '../PxAnimatorTypes';
import { PxGradientType } from '../PxAnimatorTypes';
import type { ApplyContext } from './types';
import { genId } from './util';


/**
 * `effects.fillGradient` / `effects.strokeGradient` materialiser.
 *
 * Mirrors `maskedByEffect`: mint a `<linearGradient>` or `<radialGradient>`
 * def into `ctx.defs`, push the host element's `fill` / `stroke` to
 * `url(#auto-id)`. Same shape used for both fill and stroke — the only
 * difference is which host attribute is rewritten.
 *
 * The editor's `TSvgColorAttr` stores a gradient as one animatable stop
 * timeline + static geometry. The wire shape mirrors that 1:1 (see
 * `_PxFillGradientEffect`). When materialising:
 *   - geometry parts (`p1`, `p2`, `c`, `r`, `fp`) become static body attrs
 *     on the gradient def;
 *   - the stops array is either static (each `<stop>` is bare) or animated
 *     (each `<stop>` gets `animate.stopColor.keyframes` derived from the
 *     single source timeline by SLICING each kf's full snapshot at this
 *     stop's index).
 *
 * The per-stop slicing matches the legacy `<linearGradient>` + `<stop>`
 * wire format that `SvgGradientElements.readGradientColor` reads on the
 * editor side, so the materialised tree round-trips through the editor's
 * existing reader.
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

    // Geometry — static-only in v1 per the design doc.
    if (fx.type === PxGradientType.linear) {
        if (fx.p1) { out.x1 = String(fx.p1[0]); out.y1 = String(fx.p1[1]); }
        if (fx.p2) { out.x2 = String(fx.p2[0]); out.y2 = String(fx.p2[1]); }
    } else {
        if (fx.c)  { out.cx = String(fx.c[0]);  out.cy = String(fx.c[1]); }
        if (fx.r !== undefined) out.r = String(fx.r);
        if (fx.fp) { out.fx = String(fx.fp[0]); out.fy = String(fx.fp[1]); }
    }
    if (fx.gradientUnits)     out.gradientUnits = fx.gradientUnits;
    if (fx.spreadMethod)      out.spreadMethod = fx.spreadMethod;
    if (fx.gradientTransform) out.gradientTransform = fx.gradientTransform;

    out.children = buildStopChildren(fx.stops, ctx);
    return out;
}

/** Emits one `<stop>` per gradient stop. Stops come from EITHER the static
 *  array form (`stops: [{offset, color}, …]`) or the animated form
 *  (`stops: {keyframes:[{time, value:[stops], easing?}]}`). For the
 *  animated form, each emitted `<stop>` gets `animate.stopColor.keyframes`
 *  whose values are sliced out of the source timeline at this stop's
 *  index — that's the legacy wire shape the editor's `SvgGradientElements`
 *  reader already understands. */
function buildStopChildren(stops: PxAnimatable<Array<PxGradientStop>> | undefined, ctx: ApplyContext): Array<PxNode> {
    if (!stops) return [];

    // Static shapes — bare array or `{value: […]}`.
    if (Array.isArray(stops)) return stops.map(staticStopNode);
    if (typeof stops === 'object' && Array.isArray((stops as { value?: any }).value)) {
        return (stops as { value: Array<PxGradientStop> }).value.map(staticStopNode);
    }

    // Animated — `{keyframes: [{time, value: [stops], easing?}]}`.
    const animBlock = stops as { keyframes?: Array<PxKeyframe> };
    const kfs = animBlock.keyframes;
    if (!Array.isArray(kfs) || !kfs.length) return [];

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

    return baselineStops.map((bs, i) => animatedStopNode(bs, kfs, i, ctx));
}

function staticStopNode(s: PxGradientStop): PxNode {
    return {
        type: 'stop',
        offset: formatOffset(s.offset),
        stopColor: s.color,
    };
}

function animatedStopNode(baseline: PxGradientStop, kfs: Array<PxKeyframe>, stopIdx: number, _ctx: ApplyContext): PxNode {
    const colorKfs: Array<PxKeyframe> = [];
    for (const kf of kfs) {
        const t = kf.time ?? kf.t ?? 0;
        const arr = (kf.value ?? kf.v) as Array<PxGradientStop> | undefined;
        const sliced = arr?.[stopIdx] ?? prevDefinedStop(kfs, kfs.indexOf(kf), stopIdx);
        if (!sliced) continue;
        const out: PxKeyframe = { time: t, value: sliced.color };
        const easing = kf.easing ?? kf.e;
        if (easing !== undefined) out.easing = easing;
        colorKfs.push(out);
    }

    const stop: PxNode = {
        type: 'stop',
        offset: formatOffset(baseline.offset),
        stopColor: baseline.color,
    };
    if (colorKfs.length) {
        stop.animate = { stopColor: { keyframes: colorKfs } };
    }
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
