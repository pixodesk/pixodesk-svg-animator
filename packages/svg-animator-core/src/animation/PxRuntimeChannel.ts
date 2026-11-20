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

// ============================================================================
// TRACKS ON OTHER TIMELINES (2026-11-20) — a compiled entry carries what the attribute does on the file's other
// timelines (`byTimeline`): the same kind, each compiled with its own timeline's window. The player splits them out
// per unit (`PxUnits`). One case per kind, so every value keeps its type.
// ============================================================================

/** The entry with `track`'s keyframes added as its track on `timeline` — the same kind only (another kind cannot
 *  ride it: the entry is returned as it is). @internal */
export function withTimelineTrack(host: PxCompiledAnimation, timeline: string, track: PxCompiledAnimation): PxCompiledAnimation {
    switch (host.kind) {
        case PxValueKind.number: return track.kind === host.kind ? { ...host, byTimeline: [...(host.byTimeline ?? []), { timeline, keyframes: track.keyframes }] } : host;
        case PxValueKind.percent: return track.kind === host.kind ? { ...host, byTimeline: [...(host.byTimeline ?? []), { timeline, keyframes: track.keyframes }] } : host;
        case PxValueKind.rotate: return track.kind === host.kind ? { ...host, byTimeline: [...(host.byTimeline ?? []), { timeline, keyframes: track.keyframes }] } : host;
        case PxValueKind.skew: return track.kind === host.kind ? { ...host, byTimeline: [...(host.byTimeline ?? []), { timeline, keyframes: track.keyframes }] } : host;
        case PxValueKind.color: return track.kind === host.kind ? { ...host, byTimeline: [...(host.byTimeline ?? []), { timeline, keyframes: track.keyframes }] } : host;
        case PxValueKind.path: return track.kind === host.kind ? { ...host, byTimeline: [...(host.byTimeline ?? []), { timeline, keyframes: track.keyframes }] } : host;
        case PxValueKind.transform: return track.kind === host.kind ? { ...host, byTimeline: [...(host.byTimeline ?? []), { timeline, keyframes: track.keyframes }] } : host;
        case PxValueKind.numberList: return track.kind === host.kind ? { ...host, byTimeline: [...(host.byTimeline ?? []), { timeline, keyframes: track.keyframes }] } : host;
        case PxValueKind.translate: return track.kind === host.kind ? { ...host, byTimeline: [...(host.byTimeline ?? []), { timeline, keyframes: track.keyframes }] } : host;
        case PxValueKind.scale: return track.kind === host.kind ? { ...host, byTimeline: [...(host.byTimeline ?? []), { timeline, keyframes: track.keyframes }] } : host;
        case PxValueKind.discrete: return track.kind === host.kind ? { ...host, byTimeline: [...(host.byTimeline ?? []), { timeline, keyframes: track.keyframes }] } : host;
    }
}

/** The entry as it plays on `timeline`: its track there as the plain keyframes, no tracks left; `undefined` when it
 *  has none there. `timeline` undefined: the plain keyframes themselves (the first timeline). @internal */
export function timelineTrackOf(ch: PxCompiledAnimation, timeline: string | undefined): PxCompiledAnimation | undefined {
    if (timeline === undefined) {
        if (!ch.byTimeline) return ch.keyframes.length ? ch : undefined;
        const { byTimeline: _tracks, ...plain } = ch;
        return plain.keyframes.length ? plain : undefined;
    }
    switch (ch.kind) {
        case PxValueKind.number: { const t = ch.byTimeline?.find(x => x.timeline === timeline); const { byTimeline: _t, ...rest } = ch; return t ? { ...rest, keyframes: t.keyframes } : undefined; }
        case PxValueKind.percent: { const t = ch.byTimeline?.find(x => x.timeline === timeline); const { byTimeline: _t, ...rest } = ch; return t ? { ...rest, keyframes: t.keyframes } : undefined; }
        case PxValueKind.rotate: { const t = ch.byTimeline?.find(x => x.timeline === timeline); const { byTimeline: _t, ...rest } = ch; return t ? { ...rest, keyframes: t.keyframes } : undefined; }
        case PxValueKind.skew: { const t = ch.byTimeline?.find(x => x.timeline === timeline); const { byTimeline: _t, ...rest } = ch; return t ? { ...rest, keyframes: t.keyframes } : undefined; }
        case PxValueKind.color: { const t = ch.byTimeline?.find(x => x.timeline === timeline); const { byTimeline: _t, ...rest } = ch; return t ? { ...rest, keyframes: t.keyframes } : undefined; }
        case PxValueKind.path: { const t = ch.byTimeline?.find(x => x.timeline === timeline); const { byTimeline: _t, ...rest } = ch; return t ? { ...rest, keyframes: t.keyframes } : undefined; }
        case PxValueKind.transform: { const t = ch.byTimeline?.find(x => x.timeline === timeline); const { byTimeline: _t, ...rest } = ch; return t ? { ...rest, keyframes: t.keyframes } : undefined; }
        case PxValueKind.numberList: { const t = ch.byTimeline?.find(x => x.timeline === timeline); const { byTimeline: _t, ...rest } = ch; return t ? { ...rest, keyframes: t.keyframes } : undefined; }
        case PxValueKind.translate: { const t = ch.byTimeline?.find(x => x.timeline === timeline); const { byTimeline: _t, ...rest } = ch; return t ? { ...rest, keyframes: t.keyframes } : undefined; }
        case PxValueKind.scale: { const t = ch.byTimeline?.find(x => x.timeline === timeline); const { byTimeline: _t, ...rest } = ch; return t ? { ...rest, keyframes: t.keyframes } : undefined; }
        case PxValueKind.discrete: { const t = ch.byTimeline?.find(x => x.timeline === timeline); const { byTimeline: _t, ...rest } = ch; return t ? { ...rest, keyframes: t.keyframes } : undefined; }
    }
}

/** One stretch of a concatenated channel (2026-11-20, a state machine whose states are on several timelines): the
 *  track that plays there, shifted, or — where the attribute has no track — its static value held. @internal */
export interface PxConcatRegion {
    /** The track that plays in this stretch; absent — `hold` is held. */
    readonly track?: PxCompiledAnimation;
    /** The attribute's static value as a compiled channel (its first keyframe is the value); absent — nothing is held. */
    readonly hold?: PxCompiledAnimation;
    /** The stretch on the concatenated clock, ms. */
    readonly from: number;
    readonly to: number;
    /** What is added to the track's times to place it there. */
    readonly shift: number;
}

interface PxTypedRegion<V> { readonly keyframes?: Array<PxCompiledKeyframe<V>>; readonly hold?: V; readonly from: number; readonly to: number; readonly shift: number }

/** The value of `keyframes` at `t` — a straight blend between the two around it (the easing is not applied at the cut). */
function sampleKeyframesAt<V>(keyframes: ReadonlyArray<PxCompiledKeyframe<V>>, t: number, lerp: PxChannelLerp<V>): V {
    if (t <= keyframes[0].time) return keyframes[0].value;
    for (let i = 1; i < keyframes.length; i++) {
        const b = keyframes[i];
        if (t <= b.time) {
            const a = keyframes[i - 1];
            const span = b.time - a.time;
            return span > 0 ? lerp(a.value, b.value, (t - a.time) / span) : b.value;
        }
    }
    return keyframes[keyframes.length - 1].value;
}

/** The stretches laid end to end: in each, the track's keyframes inside it with an exact value at both ends, or the
 *  held value at both ends. Between two stretches the clock is never shown. */
function concatKeyframes<V>(regions: ReadonlyArray<PxTypedRegion<V>>, lerp: PxChannelLerp<V>): Array<PxCompiledKeyframe<V>> {
    const out: Array<PxCompiledKeyframe<V>> = [];
    for (const r of regions) {
        if (r.keyframes && r.keyframes.length) {
            const shifted = r.keyframes.map(kf => ({ ...kf, time: kf.time + r.shift }));
            const inside = shifted.filter(kf => kf.time > r.from && kf.time < r.to);
            const startsHere = shifted.find(kf => kf.time === r.from);
            out.push(startsHere ?? { time: r.from, value: sampleKeyframesAt(shifted, r.from, lerp) });
            out.push(...inside);
            out.push({ time: r.to, value: sampleKeyframesAt(shifted, r.to, lerp) });
        } else if (r.hold !== undefined) {
            out.push({ time: r.from, value: r.hold }, { time: r.to, value: r.hold });
        }
    }
    return out;
}

/** `regions` as `V`'s regions — `get` reads a channel's keyframes when it is of the kind, `undefined` otherwise. */
function typedRegions<V>(regions: ReadonlyArray<PxConcatRegion>, get: (ch: PxCompiledAnimation) => Array<PxCompiledKeyframe<V>> | undefined): Array<PxTypedRegion<V>> {
    return regions.map(r => {
        const hold = r.hold ? get(r.hold)?.[0]?.value : undefined;
        return { keyframes: r.track ? get(r.track) : undefined, hold, from: r.from, to: r.to, shift: r.shift };
    });
}

/** The regions laid end to end as one channel of `template`'s kind (its unit, its auto-orient kept; no tracks). @internal */
export function concatChannels(template: PxCompiledAnimation, regions: ReadonlyArray<PxConcatRegion>): PxCompiledAnimation {
    switch (template.kind) {
        case PxValueKind.number: { const { byTimeline: _t, ...base } = template; return { ...base, keyframes: concatKeyframes(typedRegions(regions, ch => ch.kind === PxValueKind.number ? ch.keyframes : undefined), interpolateNum) }; }
        case PxValueKind.percent: { const { byTimeline: _t, ...base } = template; return { ...base, keyframes: concatKeyframes(typedRegions(regions, ch => ch.kind === PxValueKind.percent ? ch.keyframes : undefined), interpolateNum) }; }
        case PxValueKind.rotate: { const { byTimeline: _t, ...base } = template; return { ...base, keyframes: concatKeyframes(typedRegions(regions, ch => ch.kind === PxValueKind.rotate ? ch.keyframes : undefined), interpolateNum) }; }
        case PxValueKind.skew: { const { byTimeline: _t, ...base } = template; return { ...base, keyframes: concatKeyframes(typedRegions(regions, ch => ch.kind === PxValueKind.skew ? ch.keyframes : undefined), interpolateNum) }; }
        case PxValueKind.color: { const { byTimeline: _t, ...base } = template; return { ...base, keyframes: concatKeyframes(typedRegions(regions, ch => ch.kind === PxValueKind.color ? ch.keyframes : undefined), blendColors) }; }
        case PxValueKind.path: { const { byTimeline: _t, ...base } = template; return { ...base, keyframes: concatKeyframes(typedRegions(regions, ch => ch.kind === PxValueKind.path ? ch.keyframes : undefined), blendPaths) }; }
        case PxValueKind.transform: { const { byTimeline: _t, ...base } = template; return { ...base, keyframes: concatKeyframes(typedRegions(regions, ch => ch.kind === PxValueKind.transform ? ch.keyframes : undefined), interpolateTransformParts) }; }
        case PxValueKind.numberList: { const { byTimeline: _t, ...base } = template; return { ...base, keyframes: concatKeyframes(typedRegions(regions, ch => ch.kind === PxValueKind.numberList ? ch.keyframes : undefined), interpolateVec) }; }
        case PxValueKind.translate: { const { byTimeline: _t, ...base } = template; return { ...base, keyframes: concatKeyframes(typedRegions(regions, ch => ch.kind === PxValueKind.translate ? ch.keyframes : undefined), interpolateVec) }; }
        case PxValueKind.scale: { const { byTimeline: _t, ...base } = template; return { ...base, keyframes: concatKeyframes(typedRegions(regions, ch => ch.kind === PxValueKind.scale ? ch.keyframes : undefined), interpolateVec) }; }
        case PxValueKind.discrete: { const { byTimeline: _t, ...base } = template; return { ...base, keyframes: concatKeyframes(typedRegions(regions, ch => ch.kind === PxValueKind.discrete ? ch.keyframes : undefined), switchAtHalf) }; }
    }
}
