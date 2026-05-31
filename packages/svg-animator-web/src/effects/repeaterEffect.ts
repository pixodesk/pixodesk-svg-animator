/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/


import { applyTransformationEffect } from './transformationEffect';
import type { ApplyContext, PxAnimatable, PxNode, PxRepeaterEffect, PxTransformationEffect, Vec2 } from './types';
import { clone } from './util';


/**
 * REPEATER → N clones inside a `<g>` wrapper. Copy 0 is the unmodified base;
 * copies 1..N-1 are wrapped with a per-copy `PxTransformationEffect` synthesised
 * from the repeater parts (translate/rotate/origin × i, scale per-axis `(v/100)^i`).
 *
 * Each repeater part is independently animatable:
 *  - Static parts → emitted as structured `transform: {value:…}` on the per-copy wrapper.
 *  - Animated parts → emitted as `animate.transform.keyframes` with each kf value
 *    scaled by `i` (time/easing preserved).
 *
 * Mirrors the editor's `TSvgRepeaterElementEffectAttr.buildPerCopyTransform`.
 */
export function applyRepeaterEffect(node: PxNode, fx: PxRepeaterEffect | undefined, ctx: ApplyContext): PxNode {
    if (!fx) return node;

    const copies = fx.copies ?? 1;
    if (copies < 1) { ctx.errors.push('repeater.copies invalid: ' + fx.copies); return node; }

    // The base element's SHARED transform (static baseline + any animation) is
    // lifted onto the wrapper so the per-copy increments compose in the wrapper's
    // coordinate space. Non-transform animations (opacity, fill) stay per copy.
    const sharedTransform = node.transform;
    const sharedAnimTransform = node.animate?.transform;

    const base = clone(node);
    delete base.transform;
    if (base.animate) {
        delete base.animate.transform;
        if (Object.keys(base.animate).length === 0) delete base.animate;
    }

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
        out.translate = mapAnimatableVec2(fx.translate, v => [v[0] * i, v[1] * i]);
    }
    if (fx.rotate !== undefined) {
        out.rotate = mapAnimatableNumber(fx.rotate, v => v * i);
    }
    if (fx.scale !== undefined) {
        out.scale = synthesiseScale(fx.scale, i);
    }
    if (fx.origin !== undefined) {
        out.origin = mapAnimatableVec2(fx.origin, v => [v[0] * i, v[1] * i]);
    }

    return Object.keys(out).length ? out : undefined;
}

/** Applies `fn` to every value in an animatable Vec2 (static / `{value}` / `{keyframes}`). */
function mapAnimatableVec2(raw: PxAnimatable<Vec2>, fn: (v: Vec2) => Vec2): PxAnimatable<Vec2> {
    if (Array.isArray(raw)) return fn(raw as Vec2);
    if (raw && typeof raw === 'object') {
        const obj = raw as { value?: Vec2; keyframes?: Array<any>; autoOrient?: boolean };
        if (Array.isArray(obj.keyframes)) {
            return {
                ...obj,
                keyframes: obj.keyframes.map(kf => kf && kf.value !== undefined ? { ...kf, value: fn(kf.value) } : kf),
            } as PxAnimatable<Vec2>;
        }
        if (obj.value !== undefined) {
            return { ...obj, value: fn(obj.value) } as PxAnimatable<Vec2>;
        }
    }
    return raw;
}

/** Applies `fn` to every value in an animatable number (static / `{value}` / `{keyframes}`). */
function mapAnimatableNumber(raw: PxAnimatable<number>, fn: (v: number) => number): PxAnimatable<number> {
    if (typeof raw === 'number') return fn(raw);
    if (raw && typeof raw === 'object') {
        const obj = raw as { value?: number; keyframes?: Array<any>; autoOrient?: boolean };
        if (Array.isArray(obj.keyframes)) {
            return {
                ...obj,
                keyframes: obj.keyframes.map(kf => kf && kf.value !== undefined ? { ...kf, value: fn(kf.value) } : kf),
            } as PxAnimatable<number>;
        }
        if (obj.value !== undefined) {
            return { ...obj, value: fn(obj.value) } as PxAnimatable<number>;
        }
    }
    return raw;
}

/**
 * Per-copy scale: per-axis geometric compounding `s^i`. Always emitted in
 * **1.0-units** so it bypasses `applyTransformationEffect.normalizeScale`
 * (which only divides BARE-array static scale by 100 — `{value:…}` and
 * `{keyframes:…}` are expected to be already-1.0-units).
 *
 * Wire convention for repeater.scale is irregular:
 *  - **Bare-array static** is PERCENT (e.g. `[85, 85]` = 0.85×); needs `/100`
 *    before compounding.
 *  - **`{keyframes:…}` animated** values are already 1.0-units (the writer
 *    converts) — no `/100`.
 *  - `{value:…}` static (rare; uses same convention as bare-array → PERCENT).
 */
function synthesiseScale(raw: PxAnimatable<Vec2>, i: number): PxAnimatable<Vec2> {
    const scalePowerFromPercent = (v: Vec2): Vec2 => [Math.pow(v[0] / 100, i), Math.pow(v[1] / 100, i)];
    const scalePowerFromUnits = (v: Vec2): Vec2 => [Math.pow(v[0], i), Math.pow(v[1], i)];

    if (Array.isArray(raw)) {
        // Bare-array static (PERCENT) → emit as `{value:[…]}` in 1.0-units to
        // bypass normalizeScale.
        return { value: scalePowerFromPercent(raw as Vec2) };
    }
    if (raw && typeof raw === 'object') {
        const obj = raw as { value?: Vec2; keyframes?: Array<any>; autoOrient?: boolean };
        if (Array.isArray(obj.keyframes)) {
            // Animated values are already 1.0-units on the wire.
            return {
                ...obj,
                keyframes: obj.keyframes.map(kf => kf && kf.value !== undefined ? { ...kf, value: scalePowerFromUnits(kf.value) } : kf),
            } as PxAnimatable<Vec2>;
        }
        if (obj.value !== undefined) {
            // `{value:…}` static — treated as PERCENT like the bare-array case.
            return { ...obj, value: scalePowerFromPercent(obj.value) } as PxAnimatable<Vec2>;
        }
    }
    return raw;
}
