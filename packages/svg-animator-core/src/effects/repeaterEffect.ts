/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/


import { applyTransformationEffect } from './transformationEffect';
import type { PxAnimatable, PxAnimationDefinition, PxKeyframe, PxLoop, PxNode, PxRepeaterEffect, PxTransformationEffect, Vec2 } from '../PxAnimatorTypes';
import { ReadKind, readAnimatable } from './transformParts';
import type { ApplyContext } from './types';
import { clone } from './util';


/**
 * REPEATER → N clones inside a `<g>` wrapper. Copy 0 is the unmodified base;
 * copies 1..N-1 are wrapped with a per-copy `PxTransformationEffect` synthesised
 * from the repeater parts:
 *
 *   - translate × i
 *   - rotate    × i
 *   - skew      × i  (skewX degrees)
 *   - scale     ^ i  (per-axis geometric compound)
 *   - origin    CONSTANT — rotation/scale center stays put across copies
 *
 * The origin is the rotation/scale CENTER for the sandwich
 * `T(+o) · T(t·i) · R(r·i) · S(s^i) · T(-o)`. Scaling `o` by `i` would shift the
 * center per copy and produce a spiral instead of a repeated rotation.
 *
 * Each part is independently animatable:
 *  - Static parts → emitted as structured `transform: {value:…}` on the per-copy wrapper.
 *  - Animated parts → emitted as `animate.transform.keyframes` with each kf value
 *    scaled by the rule above (time/easing preserved).
 *
 * Uses the same per-copy matrix formula as the heavy SVG render.
 */
export function applyRepeaterEffect(node: PxNode, fx: PxRepeaterEffect | undefined, ctx: ApplyContext): PxNode {
    if (!fx) return node;

    const copies = fx.copies ?? 1;
    if (copies < 1) { ctx.errors.push('repeater.copies invalid: ' + fx.copies); return node; }

    // The base element's SHARED transform (static baseline + any animation) is
    // lifted onto the wrapper so the per-copy increments compose in the wrapper's
    // coordinate space. Non-transform animations (opacity, fill) stay per copy.
    const sharedTransform = node.transform;
    // In-place animations on a node body are always the record form here —
    // narrow the `PxElementAnimation` union accordingly.
    const sharedAnimTransform = (node.animate as PxAnimationDefinition | undefined)?.transform;

    const base = clone(node);
    delete base.transform;
    if (base.animate) {
        delete (base.animate as PxAnimationDefinition).transform;
        if (Object.keys(base.animate).length === 0) delete base.animate;
    }
    // The WRAPPER owns the source id (assigned below): a whole-element `<use>` must
    // resolve to the FULL repeated result including the shared transform. Leaving the
    // id on the base would duplicate it across every copy-clone, and href resolution
    // would land on a bare, transform-stripped copy (rendered at the use's position
    // with no body translate — visibly mis-placed).
    delete base.id;

    const children: Array<PxNode> = [base];
    for (let i = 1; i < copies; i++) {
        const baseClone = clone(base);
        const synthFx = synthesisePerCopyFx(fx, i);
        // Run through the standard transformation-effect machinery — gets
        // origin sandwich, animated kfs, etc. for free.
        const wrapped = synthFx ? applyTransformationEffect(baseClone, synthFx, ctx) : baseClone;
        children.push(wrapped);
    }

    const wrapper: PxNode = { type: 'g', children };
    if (node.id) wrapper.id = node.id;
    if (sharedTransform !== undefined) wrapper.transform = sharedTransform;
    if (sharedAnimTransform !== undefined) wrapper.animate = { transform: sharedAnimTransform };
    return wrapper;
}


// ─────────────────────────────────────────────────────────────────────────────
//  PER-COPY SYNTHESIS
// ─────────────────────────────────────────────────────────────────────────────

/** Builds a per-copy `PxTransformationEffect` for copy index `i`. */
function synthesisePerCopyFx(fx: PxRepeaterEffect, i: number): PxTransformationEffect | undefined {
    const out: PxTransformationEffect = {};

    if (fx.translate !== undefined) {
        out.translate = mapAnimatable<Vec2>(fx.translate, v => [v[0] * i, v[1] * i]);
    }
    if (fx.rotate !== undefined) {
        out.rotate = mapAnimatable<number>(fx.rotate, v => v * i);
    }
    if (fx.skew !== undefined) {
        out.skew = mapAnimatable<number>(fx.skew, v => v * i);
    }
    if (fx.scale !== undefined) {
        out.scale = synthesiseScale(fx.scale, i);
    }
    if (fx.origin !== undefined) {
        // CONSTANT — rotation/scale center stays put across copies. Scaling by `i`
        // would drift the center per copy (spiral instead of repeated rotation).
        out.origin = fx.origin;
    }

    return Object.keys(out).length ? out : undefined;
}

/**
 * Applies `fn` to every value of an animatable (base + all keyframes) via the
 * shared `readAnimatable` — one mapper for number and Vec2 parts alike (the old
 * per-type copies missed the `kfs` alias, so an alias-authored part silently
 * skipped its ×i scaling). Re-emits the normalised unified form:
 * raw static in → raw static out (or `{value}` when `wrapStatic`); animated in →
 * `{keyframes, loop?, autoOrient?, value?}` with kf values mapped and
 * time/easing/tangents preserved.
 */
function mapAnimatable<T>(raw: PxAnimatable<T>, fn: (v: T) => T, wrapStatic = false): PxAnimatable<T> {
    const read = readAnimatable<T>(raw);
    if (read.kind === ReadKind.Absent) return raw;
    if (read.kind === ReadKind.Static) {
        const mapped = fn(read.value);
        const wasRawStatic = typeof raw === 'number' || Array.isArray(raw);
        return (wasRawStatic && !wrapStatic) ? mapped : { value: mapped };
    }
    const out: { keyframes: Array<PxKeyframe<T>>; loop?: PxLoop | boolean; autoOrient?: boolean; value?: T } = {
        keyframes: read.keyframes.map(kf => kf && kf.value !== undefined ? { ...kf, value: fn(kf.value) } : kf),
    };
    if (read.loop !== undefined) out.loop = read.loop;
    if (read.autoOrient !== undefined) out.autoOrient = read.autoOrient;
    if (read.base !== undefined) out.value = fn(read.base);
    return out;
}

/**
 * Per-copy scale: per-axis geometric compounding `s^i`.
 *
 * The wire carries repeater.scale as a FACTOR (0.85 = 85%) in EVERY form — bare
 * static, `{value:…}` and `{keyframes:…}` alike (one convention, see
 * SCHEMA-DESIGN.md I-3; the old bare-static PERCENT form is gone). Output is
 * emitted as `{value:…}` / keyframes in the same 1.0-units, so it also bypasses
 * `applyTransformationEffect.normalizeScale` untouched.
 */
function synthesiseScale(raw: PxAnimatable<Vec2>, i: number): PxAnimatable<Vec2> {
    const scalePower = (v: Vec2): Vec2 => [Math.pow(v[0], i), Math.pow(v[1], i)];
    return mapAnimatable<Vec2>(raw, scalePower, true);
}
