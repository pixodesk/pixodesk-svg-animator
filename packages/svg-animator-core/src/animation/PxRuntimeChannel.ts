// @px-area keyframes
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

/**
 * THE ENGINE'S RUNTIME FORM — what a document's animated property becomes once its keyframes are
 * converted for playback (`normalizeBindings`): times in window ms, easings resolved, values in the
 * representation the engines blend (a colour as RGBA numbers, `d` as bezier paths, …).
 *
 * What a property's values ARE is decided ONCE, here (`channelKindOf`), and carried with the channel
 * as its `kind`; every engine — the frame loop, the WAAPI keyframes, the React Native tracks, the
 * rest pose, the loop expansion — switches on that kind and reads typed values. (The document keeps
 * its own unions; this is the engine's representation after conversion.)
 */

import type { PxBezierPath, PxTransformParts, PxVec2 } from '../format/PxAnimatorTypes';
import { camelCaseToKebabWordIfNeeded, interpolateBeziers, interpolateColor, interpolateNum, interpolateVec, isCamelCaseWord, parseColor, PX_COLOR_ATTR_NAMES, PX_PCT_BASED_ATTR_NAMES } from '../util/PxAnimatorUtil';

/** A resolved cubic-bezier easing `[x1, y1, x2, y2]`. @public @advanced */
export type PxCubicBezier = [number, number, number, number];

/** How a channel's values are represented, blended and written — decided once per channel. @public @advanced */
export enum PxValueKind {
    /** A number — opacity, r, stroke width, … */
    number = 'number',
    /** A 0..1 number written as a percentage — `offset-distance`. */
    percent = 'percent',
    /** RGBA 0..1 — fill, stroke, stop-color, … */
    color = 'color',
    /** Bezier paths — `d`. */
    path = 'path',
    /** A transform parts record — `transform`. */
    parts = 'parts',
    /** A number list — `stroke-dasharray`. */
    numberList = 'numberList',
    /** The per-part channels (`translate` / `scale` / `rotate` / `skew`) — written into `transform`. */
    translate = 'translate',
    scale = 'scale',
    rotate = 'rotate',
    skew = 'skew',
    /** Anything else (a string that is no number or colour, `url(#…)`, `none`, …): switches, never blends. */
    discrete = 'discrete',
}

/** One converted keyframe. @public @advanced */
export interface PxRuntimeKeyframe<V> {
    /** Time in window ms. */
    t: number;
    v: V;
    /** The resolved easing of the interval that FOLLOWS this keyframe. */
    e?: PxCubicBezier;
    /** Motion-along-path tangent handles (a `parts` channel). */
    tangentIn?: PxVec2;
    tangentOut?: PxVec2;
}

/** A `d` value at runtime: the parsed bezier paths. @public @advanced */
export interface PxPathValue { paths: Array<PxBezierPath> }

interface ChannelOf<K extends PxValueKind, V> {
    kind: K;
    keyframes: Array<PxRuntimeKeyframe<V>>;
}

/** One animated property at runtime, typed by its kind. @public @advanced */
export type PxRuntimeChannel =
    | (ChannelOf<PxValueKind.number | PxValueKind.percent | PxValueKind.rotate | PxValueKind.skew, number> & {
        /** A `number` channel whose values carry one unit (`"20%"` → `"80%"`): written back with it. */
        unit?: string;
    })
    | ChannelOf<PxValueKind.color, Array<number>>
    | ChannelOf<PxValueKind.path, PxPathValue>
    | (ChannelOf<PxValueKind.parts, PxTransformParts> & {
        /** Set for the frames engine when the keyframes carry tangents / `autoOrient`: evaluated per frame. */
        motionPath?: { autoOrient: boolean };
    })
    | ChannelOf<PxValueKind.numberList | PxValueKind.translate | PxValueKind.scale, Array<number>>
    | ChannelOf<PxValueKind.discrete, string>;

/** An element's animated properties at runtime, keyed by the property name as written. @public @advanced */
export type PxRuntimeAnimation = Record<string, PxRuntimeChannel>;

/**
 * RUNTIME VIEW ONLY (not wire) — a binding once `normalizeBindings` has resolved it: the bare DOM id
 * and the merged, converted animation. A self-contained document yields the same shape from every
 * animated node, so the engines never see which kind of document they play.
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
 * THE decision: what a property's values are, from its name and its keyframe values. A named kind
 * whose values do not fit it (a colour channel animating `url(#a)` → `url(#b)`) is `discrete`.
 * @internal
 */
export function channelKindOf(propName: string, values: ReadonlyArray<unknown>): PxValueKind {
    const name = isCamelCaseWord(propName) ? camelCaseToKebabWordIfNeeded(propName) : propName;
    const all = (fits: (v: unknown) => boolean): boolean => values.every(v => v === undefined || fits(v));
    if (name === 'd') return PxValueKind.path;
    if (PX_COLOR_ATTR_NAMES.has(name)) return all(isColorValue) ? PxValueKind.color : PxValueKind.discrete;
    if (name === 'transform') return all(isPartsValue) ? PxValueKind.parts : PxValueKind.discrete;
    if (name === 'translate') return all(isNumberList) ? PxValueKind.translate : PxValueKind.discrete;
    if (name === 'scale') return all(isNumberList) ? PxValueKind.scale : PxValueKind.discrete;
    if (name === 'rotate') return all(isNumeric) ? PxValueKind.rotate : PxValueKind.discrete;
    if (name === 'skew') return all(isNumeric) ? PxValueKind.skew : PxValueKind.discrete;
    if (name === 'stroke-dasharray') return all(isNumberList) ? PxValueKind.numberList : PxValueKind.discrete;
    if (PX_PCT_BASED_ATTR_NAMES.has(name) && all(isNumeric)) return PxValueKind.percent;
    return sharedUnitOf(values) !== undefined ? PxValueKind.number : PxValueKind.discrete;
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
const switchAtHalf: PxChannelLerp<string> = (a, b, p) => (p < 0.5 ? a : b);

/**
 * Runs `fn` over a channel's keyframes with the blend of its kind, and returns the same kind of
 * channel — so generic keyframe work (loop expansion, clipping) stays typed. @internal
 */
export function mapChannelKeyframes(
    ch: PxRuntimeChannel,
    fn: <V>(keyframes: Array<PxRuntimeKeyframe<V>>, lerp: PxChannelLerp<V>) => Array<PxRuntimeKeyframe<V>>,
): PxRuntimeChannel {
    switch (ch.kind) {
        case PxValueKind.number: case PxValueKind.percent: case PxValueKind.rotate: case PxValueKind.skew:
            return { ...ch, keyframes: fn(ch.keyframes, interpolateNum) };
        case PxValueKind.color: return { ...ch, keyframes: fn(ch.keyframes, interpolateColor) };
        case PxValueKind.path: return { ...ch, keyframes: fn(ch.keyframes, blendPaths) };
        case PxValueKind.parts: return { ...ch, keyframes: fn(ch.keyframes, interpolateTransformParts) };
        case PxValueKind.numberList: case PxValueKind.translate: case PxValueKind.scale:
            return { ...ch, keyframes: fn(ch.keyframes, interpolateVec) };
        case PxValueKind.discrete: return { ...ch, keyframes: fn(ch.keyframes, switchAtHalf) };
    }
}
