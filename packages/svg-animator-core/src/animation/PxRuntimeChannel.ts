// @px-area keyframes
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

/**
 * THE ENGINE'S CHANNELS — a document's compiled animations ({@link PxCompiledAnimation}, the format's low
 * layer) as the engines play them: shifted into window ms by `normalizeBindings`.
 *
 * What a property's values ARE is decided ONCE, when it is compiled (`channelKindOf`), and carried as
 * its `kind`; every engine — the frame loop, the WAAPI keyframes, the React Native tracks, the rest
 * pose, the loop expansion — switches on that kind and reads typed values.
 */

import { PxValueKind } from '../format/PxAnimatorConstants';
import type { PxCompiledAnimation, PxCompiledKeyframe, PxPathValue, PxRgba, PxTransformParts, PxVec2 } from '../format/PxAnimatorTypes';
import { camelCaseToKebabWordIfNeeded, interpolateBeziers, interpolateColor, interpolateNum, interpolateVec, isCamelCaseWord, parseColor, PX_COLOR_ATTR_NAMES, PX_PCT_BASED_ATTR_NAMES } from '../util/PxAnimatorUtil';

/** An element's channels: its compiled animations in window ms, keyed by the property name as written. @public @advanced */
export type PxRuntimeAnimation = Record<string, PxCompiledAnimation>;

/**
 * RUNTIME VIEW ONLY (not wire) — a binding once `normalizeBindings` has resolved it: the bare DOM id
 * and the merged channels. A self-contained document yields the same shape from every animated node,
 * so the engines never see which kind of document they play.
 * @public @advanced
 */
export interface PxNormalizedBinding {
    id: string;
    channels: PxRuntimeAnimation;
}

/** Blends two values of one kind at `p` (0..1). @internal */
export type PxChannelLerp<V> = (a: V, b: V, p: number) => V;

const NUMBER_WITH_UNIT = /^\s*(-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)\s*([a-z%]*)\s*$/i;
/** A number's unit: `''` for a plain number (or a unitless numeric string), `'%'` for `"20%"`, … — `undefined` when not a number. @internal */
export function numericUnitOf(v: unknown): string | undefined {
    if (v === null || typeof v === 'number') return '';
    if (typeof v !== 'string') return undefined;
    const m = NUMBER_WITH_UNIT.exec(v);
    return m ? m[2].toLowerCase() : undefined;
}
const isNumeric = (v: unknown): boolean => numericUnitOf(v) === '';
const isNumberList = (v: unknown): boolean => Array.isArray(v) && v.every(x => typeof x === 'number');
const isColorValue = (v: unknown): boolean => parseColor(v) !== undefined;
/** A parts record (repaired part by part on conversion) — or a bare `[x, y]`, the per-part translate a motion path may carry. */
const isPartsValue = (v: unknown): boolean =>
    (typeof v === 'object' && v !== null && !Array.isArray(v)) || (isNumberList(v) && Array.isArray(v) && v.length >= 2);

/** The ONE unit every value of a numeric channel shares (`''` = plain numbers); `undefined` when they disagree or one is no number. @internal */
export function sharedUnitOf(values: ReadonlyArray<unknown>): string | undefined {
    let unit: string | undefined;
    for (const v of values) {
        if (v === undefined) continue;
        const u = numericUnitOf(v);
        if (u === undefined || (unit !== undefined && u !== unit)) return undefined;
        unit = u;
    }
    return unit ?? '';
}

/**
 * THE decision: what a property's values are, from its name and its authored keyframe values. A named
 * kind whose values do not fit it (a colour channel animating `url(#a)` → `url(#b)`) is `discrete`.
 * @internal
 */
export function channelKindOf(propName: string, values: ReadonlyArray<unknown>): PxValueKind {
    const name = isCamelCaseWord(propName) ? camelCaseToKebabWordIfNeeded(propName) : propName;
    const all = (fits: (v: unknown) => boolean): boolean => values.every(v => v === undefined || fits(v));
    if (name === 'd') return PxValueKind.path;
    if (PX_COLOR_ATTR_NAMES.has(name)) return all(isColorValue) ? PxValueKind.color : PxValueKind.discrete;
    if (name === 'transform') return all(isPartsValue) ? PxValueKind.transform : PxValueKind.discrete;
    if (name === 'translate') return all(isNumberList) ? PxValueKind.translate : PxValueKind.discrete;
    if (name === 'scale') return all(isNumberList) ? PxValueKind.scale : PxValueKind.discrete;
    if (name === 'rotate') return all(isNumeric) ? PxValueKind.rotate : PxValueKind.discrete;
    if (name === 'skew') return all(isNumeric) ? PxValueKind.skew : PxValueKind.discrete;
    if (name === 'stroke-dasharray') return all(isNumberList) ? PxValueKind.numberList : PxValueKind.discrete;
    if (PX_PCT_BASED_ATTR_NAMES.has(name) && all(isNumeric)) return PxValueKind.percent;
    return sharedUnitOf(values) !== undefined ? PxValueKind.number : PxValueKind.discrete;
}

/** A compiled `transform` the frame loop evaluates along a curve. */
interface MotionPathChannel {
    readonly autoOrient?: boolean;
    readonly keyframes: ReadonlyArray<{ readonly tangentIn?: PxVec2; readonly tangentOut?: PxVec2 }>;
}
/** Whether a compiled `transform` moves along a path: `autoOrient`, or a keyframe with a tangent (the authored
 *  rule). A scan of the keyframes, like the pair lookup beside it — no cache (review §17b). @internal */
export function movesAlongPath(ch: MotionPathChannel): boolean {
    return !!ch.autoOrient || ch.keyframes.some(kf => kf.tangentIn !== undefined || kf.tangentOut !== undefined);
}

/** Per-part blend of two parts records (unknown parts are not blended). @internal */
export function interpolateTransformParts(a: PxTransformParts, b: PxTransformParts, t: number): PxTransformParts {
    const out: PxTransformParts = {};
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
        if (k === 'rotate' || k === 'skew') {
            out[k] = interpolateNum(a[k] ?? 0, b[k] ?? 0, t);
        } else if (k === 'translate' || k === 'scale' || k === 'origin') {
            const fallback: PxVec2 = k === 'scale' ? [1, 1] : [0, 0];
            const [x, y] = interpolateVec(a[k] ?? fallback, b[k] ?? fallback, t);
            out[k] = [x, y];
        }
    }
    return out;
}

const blendPaths: PxChannelLerp<PxPathValue> = (a, b, p) => ({ paths: interpolateBeziers(a.paths, b.paths, p) });
const blendColors: PxChannelLerp<PxRgba> = (a, b, p) => {
    const [r, g, bl, al] = interpolateColor(a, b, p);
    return [r, g, bl, al];
};
const switchAtHalf: PxChannelLerp<string> = (a, b, p) => (p < 0.5 ? a : b);

/**
 * Runs `fn` over a channel's keyframes with the blend of its kind, and returns the same kind of
 * channel — so generic keyframe work (loop expansion, clipping, the window shift) stays typed. @internal
 */
export function mapChannelKeyframes(
    ch: PxCompiledAnimation,
    fn: <V>(keyframes: Array<PxCompiledKeyframe<V>>, lerp: PxChannelLerp<V>) => Array<PxCompiledKeyframe<V>>,
): PxCompiledAnimation {
    switch (ch.kind) {
        case PxValueKind.number: case PxValueKind.percent: case PxValueKind.rotate: case PxValueKind.skew:
            return { ...ch, keyframes: fn(ch.keyframes, interpolateNum) };
        case PxValueKind.color: return { ...ch, keyframes: fn(ch.keyframes, blendColors) };
        case PxValueKind.path: return { ...ch, keyframes: fn(ch.keyframes, blendPaths) };
        case PxValueKind.transform: return { ...ch, keyframes: fn(ch.keyframes, interpolateTransformParts) };
        case PxValueKind.numberList: case PxValueKind.translate: case PxValueKind.scale:
            return { ...ch, keyframes: fn(ch.keyframes, interpolateVec) };
        case PxValueKind.discrete: return { ...ch, keyframes: fn(ch.keyframes, switchAtHalf) };
    }
}
