/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import {
    calcAnimationValues,
    getAnimatorConfig,
    getNormalisedBindings,
    DEFAULT_DURATION_MS,
    PxAnimatorEngine,
    type PxAnimatedSvgDocument,
    type PxAnimationDefinition,
} from '@pixodesk/svg-animator-core';
import { toRnPropName, toRnPropValue } from './PxRnPropNames';

/**
 * Sampled animation tracks for ONE element: prop name → per-sample values.
 *
 * The compiler densely samples every animated property through core's
 * `calcAnimationValues` — the exact function the web frames engine renders
 * with — so RN playback is value-identical to the web player. Easing, loops,
 * transform composition, colour interpolation and path morphing are all baked
 * into the samples at compile time; the UI-thread worklet only indexes arrays.
 */
export interface PxElementTracks {
    /** Element id (after id regeneration). */
    id: string;
    /** react-native-svg prop name → one value per sample. */
    props: Record<string, Array<string | number | Array<number>>>;
}

export interface PxCompiledTracks {
    /** Per-iteration duration, ms. */
    duration: number;
    /** Iteration count (Infinity for 'infinite'). */
    iterations: number;
    /** 'normal' | 'reverse' | 'alternate' | 'alternate-reverse' */
    direction: string;
    /** Delay before start, ms (positive = wait). */
    delay: number;
    /** WAAPI-style fill mode (default 'forwards'). */
    fill: string;
    /** Sample step, ms. */
    stepMs: number;
    /** Number of samples per iteration (>= 2; sample i is at time i*stepMs). */
    sampleCount: number;
    /** Tracks for every animated element. */
    elements: Array<PxElementTracks>;
}

export interface CompileTracksOptions {
    /** Target sample rate, samples/second. Default 60 (one per frame). */
    sampleRate?: number;
    /** Hard cap on samples per iteration (memory guard). Default 600. */
    maxSamples?: number;
}



/**
 * Compiles a MATERIALISED document (run `materialiseAllInTree(doc, 'frames')`
 * + `generateNewIds` first) into densely sampled per-element tracks.
 */
export function compileTracks(doc: PxAnimatedSvgDocument, opts?: CompileTracksOptions): PxCompiledTracks {
    const config = getAnimatorConfig(doc) || {};

    const duration = +(config.duration || DEFAULT_DURATION_MS);
    const _iterations = config.iterations;
    let iterations = 1;
    if (typeof _iterations === 'number') iterations = _iterations || 1;
    if (_iterations === 'infinite') iterations = Infinity;
    if (iterations < 1) iterations = 1;

    const sampleRate = opts?.sampleRate ?? 60;
    const maxSamples = opts?.maxSamples ?? 600;
    let sampleCount = Math.max(2, Math.round((duration / 1000) * sampleRate) + 1);
    if (sampleCount > maxSamples) sampleCount = maxSamples;
    const stepMs = duration / (sampleCount - 1);

    const bindings = getNormalisedBindings(doc, PxAnimatorEngine.frames) || [];

    const elements: Array<PxElementTracks> = [];
    for (const binding of bindings) {
        const animDef = binding.animate;
        if (!animDef || typeof animDef !== 'object' || Array.isArray(animDef)) continue;

        const props: Record<string, Array<string | number | Array<number>>> = {};
        for (let i = 0; i < sampleCount; i++) {
            const t = i === sampleCount - 1 ? duration : i * stepMs;
            const values = calcAnimationValues(animDef as PxAnimationDefinition, t);
            for (const [attr, value] of Object.entries(values)) {
                const rnProp = toRnPropName(attr);
                if (!rnProp) continue;
                let arr = props[rnProp];
                if (!arr) {
                    arr = props[rnProp] = new Array(sampleCount);
                    // A prop can appear late (e.g. attrs whose first kf is
                    // beyond t=0) — backfill earlier samples with the first
                    // computed value so the array is always fully populated.
                    for (let j = 0; j < i; j++) arr[j] = toRnPropValue(rnProp, value);
                }
                arr[i] = toRnPropValue(rnProp, value);
            }
        }
        // Forward-fill any holes (attr disappeared from a later sample).
        for (const arr of Object.values(props)) {
            for (let i = 1; i < sampleCount; i++) {
                if (arr[i] === undefined) arr[i] = arr[i - 1];
            }
        }

        if (Object.keys(props).length > 0) {
            elements.push({ id: binding.id, props });
        }
    }

    return {
        duration,
        iterations,
        direction: config.direction || 'normal',
        delay: config.delay || 0,
        fill: config.fill ?? 'forwards',
        stepMs,
        sampleCount,
        elements,
    };
}

/**
 * Worklet-safe sample lookup: returns the per-prop values at time `tMs`
 * (already mapped into a single iteration by the caller). Kept deliberately
 * trivial — runs on the UI thread every frame.
 */
export function sampleProps(
    tracks: PxElementTracks,
    tMs: number,
    stepMs: number,
    sampleCount: number
): Record<string, string | number | Array<number>> {
    'worklet';
    let idx = Math.round(tMs / stepMs);
    if (idx < 0) idx = 0;
    if (idx >= sampleCount) idx = sampleCount - 1;
    const out: Record<string, string | number | Array<number>> = {};
    for (const key in tracks.props) {
        out[key] = tracks.props[key][idx];
    }
    return out;
}
