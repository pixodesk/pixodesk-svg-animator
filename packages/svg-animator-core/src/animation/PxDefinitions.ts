// @px-area keyframes
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { PxNormalizedPathValueSchema, PxPathDataValueSchema, PxTransformPartsSchema, type PxAnimatedSvgDocument, type PxAnimationDefinition, type PxAnyKeyframe, type PxBezierPath, type PxBinding, type PxDefinitions, type PxElementAnimation, type PxLoop, type PxNode, type PxPropertyAnimation, type PxTransformParts, keyframeTime, keyframeValue, keyframeEasing, keyframeTangentIn, keyframeTangentOut } from '../format/PxAnimatorTypes';
import { getBindings, getDefinitions } from '../format/PxAnimatorConstants';
import { getAnimatorConfig, PxTimelineEngine, PxLoopDirection, PxLoopRepeatAt } from '../format/PxAnimatorConstants';
import { bezierToSvgPath, camelCaseToKebabWordIfNeeded, clamp, composeTransformParts, cubicBezier, interpolateBeziers, interpolateColor, interpolateNum, interpolateVec, isCamelCaseWord, parseColor, remap, reverseEasing, splitEasing, toRGBA } from '../util/PxAnimatorUtil';
import { evaluateMotionPathSegment, propAnimIsMotionPath, sampleMotionPathKeyframes, type MotionPathSegments } from '../materialize/PxMotionPath';
import { mergeStaticTransformIntoAnimDef } from './PxStaticTransformMerge';
import { channelKindOf, interpolateTransformParts, mapChannelKeyframes, PxValueKind, sharedUnitOf, type PxChannelLerp, type PxCubicBezier, type PxNormalizedBinding, type PxPathValue, type PxRuntimeAnimation, type PxRuntimeChannel, type PxRuntimeKeyframe } from './PxRuntimeChannel';

// Declared in its own leaf module so the motion-path flattener can use it too, without importing
// this one back (it is imported here). Re-exported so this module's surface is unchanged.
export { mergeStaticTransformIntoAnimDef };

/**
 * Time separation between a cycle's snap-back keyframe and the previous repetition's
 * end, in ms.
 *
 * SINGLE SOURCE OF TRUTH — the editor imports this and converts to its own frame unit
 * (`TLoop.smallFrameShift = PX_LOOP_JUMP_SHIFT_MS / FRAME_DURATION_MS`), so the two sides
 * cannot drift apart and materialize different keyframes (B7).
 *
 * 1ms, not one 10ms editor frame: a 10ms snap-back is long enough to read as a visible
 * jump in a looping animation (confirmed visually). The gap only has to be non-zero — it
 * exists so the snap-back is a discontinuity rather than an interpolated tween.
 *
 * ⚠️ The editor works in FRAMES (`FRAME_DURATION_MS = 10`), so this is a sub-frame shift
 * there. `TKeyframeGroup` rounds keyframe times to integer frames in some paths; the
 * editor side keeps the fractional value and must not be re-clamped to a whole frame.
 * @internal
 */
export const PX_LOOP_JUMP_SHIFT_MS = 1;

/** Structural equality for keyframe values (numbers, arrays, transform-part records). */
function deepEqualValue(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    const ka = Object.keys(a as object);
    const kb = Object.keys(b as object);
    if (ka.length !== kb.length) return false;
    return ka.every(k => deepEqualValue((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}



// ============================================================================
// PATH PARSING: Convert "path(...)" strings to PxBezierPath format
// ============================================================================

interface PathCommand {
    type: string;
    values: Array<number>;
}

/**
 * Parses an SVG path string into command tokens.
 * Supports M, L, C, Z commands (case-insensitive).
 */
function parsePathCommands(d: string): Array<PathCommand> {
    const tokens = d.split(/([MLCZmlcz]|[\s,]+)/).map(t => t.trim()).filter(t => t && t !== ',');

    const commands: Array<PathCommand> = [];
    let currentCommand: PathCommand | null = null;

    for (const token of tokens) {
        if (/[MLCZmlcz]/.test(token)) {
            currentCommand = { type: token, values: [] };
            commands.push(currentCommand);
        } else if (currentCommand) {
            const value = +token;
            currentCommand.values.push(Number.isNaN(value) ? 0 : value);
        }
    }

    return commands;
}

/**
 * Parses an internal SVG path string into PxBezierPath array.
 * Handles M (moveto), L (lineto), C (curveto), Z (close) commands.
 */
export function parseSvgPathToBezier(d: string): Array<PxBezierPath> {
    const res: Array<PxBezierPath> = [];
    let currentPath: PxBezierPath | undefined;

    const commands = parsePathCommands(d);

    for (const command of commands) {
        const type = command.type;
        const values = command.values;

        if (type === 'M' || type === 'm') {
            const x = values[0] || 0;
            const y = values[1] || 0;
            currentPath = {
                v: [[x, y]],
                i: [[x, y]],
                o: [[x, y]],
                c: false
            };
            res.push(currentPath);
            continue;
        }

        // Ensure we have a current path
        if (!currentPath) {
            currentPath = {
                v: [[0, 0]],
                i: [[0, 0]],
                o: [[0, 0]],
                c: false
            };
            res.push(currentPath);
        }

        if (type === 'L') {
            const x = values[0] || 0;
            const y = values[1] || 0;
            currentPath.v.push([x, y]);
            currentPath.i!.push([x, y]);
            currentPath.o!.push([x, y]);

        } else if (type === 'C') {
            const outX = values[0] || 0;
            const outY = values[1] || 0;
            const inX2 = values[2] || 0;
            const inY2 = values[3] || 0;
            const x2 = values[4] || 0;
            const y2 = values[5] || 0;

            // Update out-point of previous vertex
            currentPath.o![currentPath.o!.length - 1] = [outX, outY];

            // Add new vertex with its in-point
            currentPath.v.push([x2, y2]);
            currentPath.i!.push([inX2, inY2]);
            currentPath.o!.push([x2, y2]);

        } else if (type === 'Z' || type === 'z') {
            currentPath.c = true;

        } else {
            console.warn('Unsupported path command "' + type + '"');
        }
    }

    return res;
}

/**
 * Extracts SVG path data from a string.
 * Handles both "path(M...)" wrapper format and raw "M..." format.
 * @returns The path data string, or undefined if not a valid path string
 */
function extractPathData(str: string): string | undefined {
    if (str.startsWith('path(') && str.endsWith(')')) {
        return str.slice(5, -1); // Remove "path(" and ")"
    }
    // Raw path string starting with a path command (M, m, or other commands)
    if (/^[MmZzLlHhVvCcSsQqTtAa]/.test(str)) {
        return str;
    }
    return undefined;
}

/**
 * Checks if the value is a path string (either "path(...)" or raw "M...").
 */
function isPathString(value: unknown): value is string {
    return typeof value === 'string' && extractPathData(value) !== undefined;
}

/**
 * Normalizes a 'd' attribute value to { paths: PxBezierPath[] } format.
 * Handles:
 * - { pathData: "M..." } / { pathData: "path(...)" } -> { paths: [PxBezierPath] }  (THE wire form)
 * - { paths: ["path(...)"] } -> { paths: [PxBezierPath] }
 * - { paths: ["M..."] } -> { paths: [PxBezierPath] }
 * - ["path(...)"] -> { paths: [PxBezierPath] }
 * - ["M..."] -> { paths: [PxBezierPath] }
 * - "path(...)" -> { paths: [PxBezierPath] }
 * - "M..." -> { paths: [PxBezierPath] }
 * - { paths: [PxBezierPath] } -> as-is
 */
/** A list of parsed bezier paths — the `paths` of a runtime `d` value. */
const BEZIER_LIST_SCHEMA = PxNormalizedPathValueSchema._shape.paths;

function normalizePathValue(value: unknown): PxPathValue | undefined {
    // THE wire form: { pathData: "M..." } (compound = multiple `M…` sub-paths in one string).
    // The `{ paths: [...] }` shapes below are this function's OWN output, not wire spellings.
    const pathData = PxPathDataValueSchema.castOrNull(value);
    if (pathData) {
        const d = extractPathData(pathData.pathData);
        return d ? { paths: parseSvgPathToBezier(d) } : undefined;
    }
    const parseAll = (strings: ReadonlyArray<unknown>): PxPathValue => {
        const paths: Array<PxBezierPath> = [];
        for (const pathStr of strings) {
            const d = isPathString(pathStr) ? extractPathData(pathStr) : undefined;
            if (d) paths.push(...parseSvgPathToBezier(d));
        }
        return { paths };
    };
    // Already { paths: [...] } — of path strings to parse, or of parsed beziers
    if (typeof value === 'object' && value !== null && 'paths' in value) {
        const pathsArray = value.paths;
        if (Array.isArray(pathsArray) && pathsArray.length > 0 && isPathString(pathsArray[0])) return parseAll(pathsArray);
        return PxNormalizedPathValueSchema.castOrNull(value) ?? undefined;
    }
    // An array of path strings, or of parsed beziers
    if (Array.isArray(value)) {
        if (value.length > 0 && isPathString(value[0])) return parseAll(value);
        const beziers = BEZIER_LIST_SCHEMA.castOrNull(value);
        return beziers ? { paths: beziers } : undefined;
    }
    if (isPathString(value)) return parseAll([value]);
    return undefined;
}


// ============================================================================
// NORMALIZATION: Convert new API format to internal normalized format
// ============================================================================

/**
 * Resolves an easing reference to a cubic-bezier array.
 * @param easing The easing reference (string name or bezier array)
 * @param defs The definitions containing named easings
 * @returns The resolved cubic-bezier array or undefined
 */
function resolveEasing(
    easing: string | [number, number, number, number] | undefined,
    defs?: PxDefinitions
): [number, number, number, number] | undefined {
    if (!easing) return undefined;

    if (Array.isArray(easing)) {
        return easing;
    }

    // Look up named easing in defs
    if (defs?.easings?.[easing]) {
        return defs.easings[easing];
    }

    // Unknown easing name - return undefined
    console.warn('Unknown easing name: ' + easing);
    return undefined;
}

/**
 * Resolves an animation reference to an AnimationDefinition.
 * @param animRef The animation reference (string name or inline definition)
 * @param defs The definitions containing named animations
 * @returns The resolved animation definition
 */
function resolveAnimation(
    animRef: string | PxAnimationDefinition,
    defs?: PxDefinitions
): PxAnimationDefinition | undefined {
    if (typeof animRef === 'string') {
        // Look up named animation in defs
        const resolved = defs?.animations?.[animRef];
        if (!resolved) {
            console.warn('Unknown animation name: ' + animRef);
        }
        return resolved;
    }

    // It's an inline definition
    return animRef;
}

/**
 * Resolves an element animation (which can be string, array, or inline) to an array of AnimationDefinitions.
 * @param animate The element animation specification
 * @param defs The definitions containing named animations
 * @returns Array of resolved animation definitions
 */
function resolveElementAnimation(
    animate: PxElementAnimation | undefined,
    defs?: PxDefinitions
): PxAnimationDefinition[] {
    if (!animate) return [];

    const results: PxAnimationDefinition[] = [];

    if (typeof animate === 'string') {
        const resolved = resolveAnimation(animate, defs);
        if (resolved) results.push(resolved);
    } else if (Array.isArray(animate)) {
        for (const item of animate) {
            const resolved = resolveAnimation(item, defs);
            if (resolved) results.push(resolved);
        }
    } else {
        // It's an inline AnimationDefinition
        results.push(animate);
    }

    return results;
}

// ============================================================================
// LOOP EXPANSION: Duplicate keyframe segments to fill gaps in the timeline
// ============================================================================

interface LoopTemplateEntry<V> {
    relT: number; // 0..1 relative position within segment
    v: V;
    e: PxCubicBezier | undefined;
    // Per-vertex spatial tangents (motion-along-path). Carried so repeated
    // segments keep their curvature; reversed reps swap in<->out (see appendRep).
    tangentIn?: [number, number];
    tangentOut?: [number, number];
}

/**
 * Expands keyframes by repeating a segment to fill the gap between the keyframe
 * range and the global animation duration, implementing PxLoop "local loop" behavior.
 */
function expandLoopKeyframes<V>(
    keyframes: Array<PxRuntimeKeyframe<V>>,
    loop: PxLoop,
    duration: number,
    lerp: PxChannelLerp<V>,
): Array<PxRuntimeKeyframe<V>> {
    const totalIntervals = keyframes.length - 1;
    const segCount = clamp(loop.segmentCount ?? totalIntervals, 1, totalIntervals);

    // Extract segment keyframes
    let segKfs: Array<PxRuntimeKeyframe<V>>;
    if (loop.repeatAt === PxLoopRepeatAt.start) {
        segKfs = keyframes.slice(0, segCount + 1);
    } else {
        segKfs = keyframes.slice(totalIntervals - segCount);
    }

    // Determine fill region
    const firstT = keyframes[0].t ?? 0;
    const lastT = keyframes[keyframes.length - 1].t ?? 0;

    let fillStart: number, fillEnd: number;
    if (loop.repeatAt === PxLoopRepeatAt.start) {
        fillStart = 0;
        fillEnd = firstT;
    } else {
        fillStart = lastT;
        fillEnd = duration;
    }

    const fillDuration = fillEnd - fillStart;
    if (fillDuration <= 0) return keyframes;

    // Segment timing
    const segStartT = segKfs[0].t ?? 0;
    const segEndT = segKfs[segKfs.length - 1].t ?? 0;
    const segDuration = segEndT - segStartT;
    if (segDuration <= 0) return keyframes;

    // Build template with relative offsets (0..1)
    const template: Array<LoopTemplateEntry<V>> = segKfs.map(kf => ({
        relT: (kf.t - segStartT) / segDuration,
        v: kf.v,
        e: kf.e,
        tangentIn: kf.tangentIn,
        tangentOut: kf.tangentOut,
    }));

    const fullReps = Math.floor(fillDuration / segDuration);
    const remainder = fillDuration - fullReps * segDuration;
    const partialFraction = remainder / segDuration;

    const looped: Array<PxRuntimeKeyframe<V>> = [];

    // A cycle's first keyframe lands at the SAME time as the previous repetition's
    // last one. Emitting both at that time makes the value at that instant depend on
    // the sampler's tie-break, and left the player disagreeing with the editor (B7).
    // Mirror `TLoop.toKeyframes` exactly:
    //   - values EQUAL (pingpong turn, closed loop) → the duplicate says nothing, skip it;
    //   - values DIFFER (a real cycle snap)         → separate them by PX_LOOP_JUMP_SHIFT_MS.
    // The editor's shift is one 10ms frame (`smallFrameShift`), so the two sides
    // materialize identical keyframes. Anything smaller is blocked editor-side: a
    // fractional-frame shift was tried there and reverted (TKeyframeGroup mishandles it).
    // SCOPE: loopOut (`after`) only — see the note above. For loopIn the pair sits in
    // the opposite order in the array, so separating it means moving the EARLIER
    // keyframe earlier; done naively it inverts keyframe order and re-breaks the
    // loopIn `f0` regression (`appendRepTail`). Left as-is until it has its own
    // editor-CSS evidence; the two sides may still differ at a loopIn boundary.
    const separateBoundary = loop.repeatAt !== PxLoopRepeatAt.start;
    // The keyframe the FIRST repetition butts up against: loopOut tiles forward from
    // the last original keyframe (the originals are concatenated only at assembly).
    const originalTerminalKf: PxRuntimeKeyframe<V> | undefined = keyframes[keyframes.length - 1];

    // Easing that a skipped boundary keyframe hands to the ORIGINAL terminal keyframe.
    // Easing describes the interval that FOLLOWS a keyframe, so when a pingpong turn's
    // duplicate is dropped (same value, nothing to say about position) its easing is NOT
    // redundant — it owns the return leg. Without this hand-off the return leg renders
    // LINEAR while the outbound is eased. The originals belong to the caller, so it is
    // applied by replacing the terminal with a copy at assembly, never by mutation.
    let terminalEasingOverride: PxCubicBezier | undefined;
    let hasTerminalEasingOverride = false;

    // Helper: append one full or partial repetition
    function appendRep(repStart: number, isReversed: boolean, partial?: number) {
        let entries: Array<LoopTemplateEntry<V>>;
        if (isReversed) {
            // Reverse keyframe order and reverse easings
            entries = [];
            for (let i = template.length - 1; i >= 0; i--) {
                entries.push({
                    relT: 1 - template[i].relT,
                    v: template[i].v,
                    // Easing for reversed transition: use reversed easing from the forward "from" keyframe
                    e: i > 0 ? reverseEasing(template[i - 1].e) : undefined,
                    // Reversed traversal swaps each vertex's in/out spatial tangents
                    // (geometry is identical, walked backwards), so curvature and
                    // auto-orientation survive the reversed rep.
                    tangentIn: template[i].tangentOut,
                    tangentOut: template[i].tangentIn
                });
            }
        } else {
            entries = template;
        }

        const cutRelT = partial !== undefined ? partial : 1;

        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            if (entry.relT > cutRelT + 1e-9) {
                // Past the cut point — insert interpolated keyframe
                const prev = entries[i - 1];
                const intervalSpan = entry.relT - prev.relT;
                const localFrac = (cutRelT - prev.relT) / intervalSpan;

                // Apply easing to get the eased progress for value interpolation
                const easedFrac = prev.e ? cubicBezier(prev.e)(localFrac) : localFrac;
                const cutValue = lerp(prev.v, entry.v, easedFrac);

                // Split easing — use left portion for the truncated interval
                const { left: leftEasing } = splitEasing(prev.e, localFrac);

                // Update previous keyframe's easing to the left portion
                if (looped.length > 0 && prev.relT <= cutRelT) {
                    looped[looped.length - 1].e = leftEasing;
                }

                looped.push({ t: repStart + cutRelT * segDuration, v: cutValue, e: undefined });
                return;
            }

            // Repetition boundary: this entry coincides in time with whatever precedes
            // it. For the FIRST rep that neighbour is the last ORIGINAL keyframe (the
            // originals are concatenated only at assembly time), not a `looped` entry.
            const prevKf = looped.length > 0 ? looped[looped.length - 1] : originalTerminalKf;
            const isBoundary = separateBoundary && i === 0 && prevKf !== undefined
                && Math.abs((prevKf.t ?? 0) - (repStart + entry.relT * segDuration)) < 1e-9;
            if (isBoundary) {
                if (deepEqualValue(prevKf.v, entry.v)) {
                    // Pingpong turn — the duplicate says nothing about VALUE, but it carries
                    // the easing (and out-tangent) for the interval that follows it. Hand
                    // those to the surviving neighbour instead of discarding them.
                    if (looped.length > 0) {
                        prevKf.e = entry.e;
                        prevKf.tangentOut = entry.tangentOut;
                    } else {
                        terminalEasingOverride = entry.e;
                        hasTerminalEasingOverride = true;
                    }
                    continue;
                }
                // Real snap: the jump segment must not carry motion-path tangents.
                // Only ours are safe to mutate — never the caller's originals.
                if (looped.length > 0) { delete prevKf.tangentIn; delete prevKf.tangentOut; }
            }

            const pushed: PxRuntimeKeyframe<V> = {
                t: repStart + entry.relT * segDuration + (isBoundary ? PX_LOOP_JUMP_SHIFT_MS : 0),
                v: entry.v,
                e: i < entries.length - 1 ? entry.e : undefined
            };
            // Carry per-vertex spatial tangents so the repeated segment keeps its
            // motion-path curvature (reversed reps already have in/out swapped above).
            if (entry.tangentIn) pushed.tangentIn = entry.tangentIn;
            if (entry.tangentOut) pushed.tangentOut = entry.tangentOut;
            looped.push(pushed);
        }
    }

    // Like {@link appendRep} but emits only the TAIL of the segment — relT ∈
    // [1-tailFraction, 1] — over [repStart, repStart + tailFraction*segDuration].
    // Used for the leftover (partial) rep of a `before` loop: it sits at fillStart
    // and runs UP TO the segment-end value, so the full reps after it align to end
    // exactly at the first original keyframe (firstT). A head-truncated partial here
    // (as appendRep does) would land the leftover ADJACENT to firstT and desync the
    // whole backward fill — the loopIn `f0` bug.
    function appendRepTail(repStart: number, isReversed: boolean, tailFraction: number) {
        let entries: Array<LoopTemplateEntry<V>>;
        if (isReversed) {
            entries = [];
            for (let i = template.length - 1; i >= 0; i--) {
                entries.push({
                    relT: 1 - template[i].relT,
                    v: template[i].v,
                    e: i > 0 ? reverseEasing(template[i - 1].e) : undefined,
                    tangentIn: template[i].tangentOut,
                    tangentOut: template[i].tangentIn
                });
            }
        } else {
            entries = template;
        }

        const startRelT = 1 - tailFraction;

        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            if (entry.relT < startRelT - 1e-9) continue; // wholly before the tail window
            const prev = entries[i - 1];

            // If startRelT falls strictly inside (prev, entry), the tail begins
            // mid-interval — emit an interpolated keyframe at repStart carrying the
            // RIGHT split of prev's easing.
            if (prev && prev.relT < startRelT - 1e-9 && entry.relT > startRelT + 1e-9) {
                const intervalSpan = entry.relT - prev.relT;
                const localFrac = (startRelT - prev.relT) / intervalSpan;
                const easedFrac = prev.e ? cubicBezier(prev.e)(localFrac) : localFrac;
                const startValue = lerp(prev.v, entry.v, easedFrac);
                const { right: rightEasing } = splitEasing(prev.e, localFrac);
                looped.push({ t: repStart, v: startValue, e: rightEasing });
            }

            const pushed: PxRuntimeKeyframe<V> = {
                t: repStart + (entry.relT - startRelT) * segDuration,
                v: entry.v,
                e: i < entries.length - 1 ? entry.e : undefined
            };
            if (entry.tangentIn) pushed.tangentIn = entry.tangentIn;
            if (entry.tangentOut) pushed.tangentOut = entry.tangentOut;
            looped.push(pushed);
        }
    }

    // Generate repetitions.
    // The rep closest to the original keyframes boundary must be reversed first
    // in pingpong mode (the animation just finished going forward, so the next
    // iteration goes backward).
    if (loop.repeatAt === PxLoopRepeatAt.start) {
        // loopIn — the fill must END exactly at the first keyframe (firstT), so the
        // reps tile BACKWARD from that boundary: the leftover (partial) rep sits at
        // fillStart showing the segment's tail, then `fullReps` full reps run up to
        // firstT. (Forward-tiling — as loopOut does — would push the partial next to
        // firstT and desync the fill: the loopIn `f0` regression.)
        if (partialFraction > 1e-9) {
            const isReversed = loop.direction === PxLoopDirection.alternate && (fullReps % 2 === 0);
            appendRepTail(fillStart, isReversed, partialFraction);
        }
        for (let rep = 0; rep < fullReps; rep++) {
            const distFromBoundary = fullReps - 1 - rep;
            const isReversed = loop.direction === PxLoopDirection.alternate && (distFromBoundary % 2 === 0);
            const repStart = fillStart + remainder + rep * segDuration;
            appendRep(repStart, isReversed);
        }
    } else {
        // loopOut — boundary is at fillStart (lastT); tile forward, partial at the end.
        for (let rep = 0; rep < fullReps; rep++) {
            const isReversed = loop.direction === PxLoopDirection.alternate && (rep % 2 === 0);
            const repStart = fillStart + rep * segDuration;
            appendRep(repStart, isReversed);
        }
        if (partialFraction > 1e-9) {
            const isReversed = loop.direction === PxLoopDirection.alternate && (fullReps % 2 === 0);
            const repStart = fillStart + fullReps * segDuration;
            appendRep(repStart, isReversed, partialFraction);
        }
    }

    // Assemble: looped keyframes go before or after the original keyframes.
    // No junction deduplication — cycle mode relies on value jumps at boundaries.
    if (loop.repeatAt === PxLoopRepeatAt.start) {
        return [...looped, ...keyframes];
    } else {
        if (hasTerminalEasingOverride && keyframes.length > 0) {
            const head = keyframes.slice(0, -1);
            const tail = { ...keyframes[keyframes.length - 1], e: terminalEasingOverride };
            return [...head, tail, ...looped];
        }
        return [...keyframes, ...looped];
    }
}


// ============================================================================
// KEYFRAME NORMALIZATION
// ============================================================================

const DEFAULT_RGBA: Array<number> = [0, 0, 0, 1];
/** A number — of a plain or unit-carrying value (`"20%"` → 20); `0` when absent. */
const toNumber = (v: unknown): number => (typeof v === 'string' ? parseFloat(v) : Number(v || 0));
/** A parts record, repaired part by part (a malformed part is dropped, the rest kept) — or the
 *  `{translate}` of a bare `[x, y]` (a motion path's per-part translate). */
function toParts(v: unknown): PxTransformParts {
    if (Array.isArray(v)) return typeof v[0] === 'number' && typeof v[1] === 'number' ? { translate: [v[0], v[1]] } : {};
    return PxTransformPartsSchema.castOrFix(v).value;
}
const toNumberList = (fallback: Array<number>) => (v: unknown): Array<number> =>
    Array.isArray(v) && v.every(x => typeof x === 'number') ? v : fallback;
const toText = (v: unknown): string => (v === undefined || v === null ? '' : String(v));

// @px-importance important
/**
 * ONE property's keyframes → its runtime channel: the kind decided once (`channelKindOf`), every value
 * converted to it, times shifted into window space, easings resolved (`easingOf`). The keyframes may be
 * in either spelling: a `plain` tree already carries converted ones (loops expanded there).
 */
function toRuntimeChannel(
    propName: string,
    keyframes: ReadonlyArray<PxAnyKeyframe>,
    easingOf: (kf: PxAnyKeyframe) => PxCubicBezier | undefined,
    timeShift: number,
): PxRuntimeChannel {
    const at = <V>(kf: PxAnyKeyframe, v: V): PxRuntimeKeyframe<V> => {
        const out: PxRuntimeKeyframe<V> = { t: keyframeTime(kf) - timeShift, v };
        const e = easingOf(kf);
        if (e) out.e = e;
        // Motion-along-path tangents (a `parts` channel) — sampled or evaluated downstream.
        const tIn = keyframeTangentIn(kf);
        const tOut = keyframeTangentOut(kf);
        if (tIn) out.tangentIn = tIn;
        if (tOut) out.tangentOut = tOut;
        return out;
    };
    const values = keyframes.map(keyframeValue);
    const kind = channelKindOf(propName, values);
    switch (kind) {
        case PxValueKind.number: {
            const numbers = keyframes.map(kf => at(kf, toNumber(keyframeValue(kf))));
            const unit = sharedUnitOf(values);
            return unit ? { kind, keyframes: numbers, unit } : { kind, keyframes: numbers };
        }
        case PxValueKind.percent: case PxValueKind.rotate: case PxValueKind.skew:
            return { kind, keyframes: keyframes.map(kf => at(kf, toNumber(keyframeValue(kf)))) };
        case PxValueKind.color:
            return { kind, keyframes: keyframes.map(kf => at(kf, parseColor(keyframeValue(kf)) ?? DEFAULT_RGBA)) };
        case PxValueKind.path:
            return { kind, keyframes: keyframes.map(kf => at(kf, normalizePathValue(keyframeValue(kf)) ?? { paths: [] })) };
        case PxValueKind.parts:
            return { kind, keyframes: keyframes.map(kf => at(kf, toParts(keyframeValue(kf)))) };
        case PxValueKind.numberList:
            return { kind, keyframes: keyframes.map(kf => at(kf, toNumberList([])(keyframeValue(kf)))) };
        case PxValueKind.translate:
            return { kind, keyframes: keyframes.map(kf => at(kf, toNumberList([0, 0])(keyframeValue(kf)))) };
        case PxValueKind.scale:
            return { kind, keyframes: keyframes.map(kf => at(kf, toNumberList([1, 1])(keyframeValue(kf)))) };
        case PxValueKind.discrete:
            return { kind, keyframes: keyframes.map(kf => at(kf, toText(keyframeValue(kf)))) };
    }
}

/** `loop: true` is the default loop; absent / false is none. */
const loopOf = (raw: PxLoop | boolean | undefined): PxLoop | undefined => (raw === true ? {} : raw || undefined);

/** Expands a channel's `loop` into repeated keyframes filling `duration`. */
function expandChannelLoop(ch: PxRuntimeChannel, loop: PxLoop, duration: number): PxRuntimeChannel {
    if (ch.keyframes.length < 2) return ch;
    return mapChannelKeyframes(ch, (keyframes, lerp) => expandLoopKeyframes(keyframes, loop, duration, lerp));
}

/**
 * The engine's channel for one property animation: converted, sorted, its loop expanded, and — on a
 * `parts` channel that moves along a path — either SAMPLED into plain parts keyframes (the native
 * engine: WAAPI cannot evaluate tangents) or flagged for per-frame evaluation (the frames engine).
 */
function normalizeChannel(
    propName: string,
    propAnim: PxPropertyAnimation,
    duration: number,
    defs: PxDefinitions | undefined,
    engine: PxTimelineEngine,
    inTime: number,
): PxRuntimeChannel {
    const converted = toRuntimeChannel(propName, propAnim.keyframes || [], kf => resolveEasing(keyframeEasing(kf), defs), inTime);
    const sorted = mapChannelKeyframes(converted, keyframes => [...keyframes].sort((a, b) => a.t - b.t));
    const loop = loopOf(propAnim.loop);
    const ch = loop ? expandChannelLoop(sorted, loop, duration) : sorted;
    if (ch.kind !== PxValueKind.parts) return ch;
    const moves = !!propAnim.autoOrient || ch.keyframes.some(kf => kf.tangentIn || kf.tangentOut);
    if (!moves) return ch;
    if (engine === PxTimelineEngine.native) {
        const sampled = sampleMotionPathKeyframes(ch.keyframes, !!propAnim.autoOrient);
        return sampled ? { kind: PxValueKind.parts, keyframes: sampled } : ch;
    }
    return { ...ch, motionPath: { autoOrient: !!propAnim.autoOrient } };
}

/**
 * Merges multiple animation definitions into a single combined definition.
 * Later definitions override earlier ones for the same property.
 */
function mergeAnimationDefinitions(
    animations: PxAnimationDefinition[]
): PxAnimationDefinition {
    const merged: PxAnimationDefinition = {};

    for (const anim of animations) {
        for (const [prop, propAnim] of Object.entries(anim)) {
            merged[prop] = propAnim;
        }
    }

    return merged;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Public loop-materialization API
//
//  Used internally by `normalizeKeyframes` (where `expandLoopKeyframes` is
//  already called at the tail of normalization). Exposed here at the propAnim
//  and tree levels so the Editor (or any external caller) can compose:
//      root = materializeNodeEffects(root).root;
//      root = materializeInternalLoopsInTree(root, duration);
//      root = materializeMotionPathsInTree(root);
//  to produce a fully-flat document with no `loop`, no `effects`, no tangents.
// ─────────────────────────────────────────────────────────────────────────────


// @px-importance important
/**
 * Replaces `propAnim.loop` with explicit repeated keyframes via
 * `expandLoopKeyframes`. Returns the input by reference when no loop is
 * configured (no-op). Output drops the `loop` field (consumed). The keyframes are converted
 * first (`toRuntimeChannel` — kind, values, named easings resolved through `defs`), so the
 * loop seam blends real values; the output carries them in the runtime spelling (`t` / `v` / `e`).
 * @internal
 */
export function materializeInternalLoopsInPropAnim(
    propName: string,
    propAnim: PxPropertyAnimation,
    duration: number,
    defs?: PxDefinitions,
): PxPropertyAnimation {
    const loop = loopOf(propAnim.loop);
    if (!loop) return propAnim;
    const rawKfs = propAnim.keyframes;
    if (!Array.isArray(rawKfs) || rawKfs.length < 2) return propAnim;

    const channel = toRuntimeChannel(propName, rawKfs, kf => resolveEasing(keyframeEasing(kf), defs), 0);
    const out: PxPropertyAnimation = { keyframes: expandChannelLoop(channel, loop, duration).keyframes };
    if (propAnim.autoOrient !== undefined) out.autoOrient = propAnim.autoOrient;
    return out;
}


// @px-importance important
/**
 * Walks `root` and materializes every animated property's `loop` via
 * `materializeInternalLoopsInPropAnim`. Immutable — returns the input by
 * reference when no loop was found anywhere; otherwise clones along the path
 * to each affected node, sharing untouched sub-trees.
 * @internal
 */
export function materializeInternalLoopsInTree(
    root: PxNode,
    duration: number,
    defs?: PxDefinitions,
): PxNode {
    const ret = walkAndMaterializeLoops(root, duration, defs);
    return ret ?? root;
}

function walkAndMaterializeLoops(node: PxNode, duration: number, defs: PxDefinitions | undefined): PxNode | null {
    let newChildren: Array<PxNode> | undefined;
    if (node.children) {
        for (let i = 0; i < node.children.length; i++) {
            const ret = walkAndMaterializeLoops(node.children[i], duration, defs);
            if (ret !== null) {
                if (!newChildren) newChildren = node.children.slice();
                newChildren[i] = ret;
            }
        }
    }
    let newAnimate: PxAnimationDefinition | undefined;
    const animDef = node.animate;
    if (typeof animDef === 'object' && !Array.isArray(animDef)) {
        for (const propName of Object.keys(animDef)) {
            const propAnim = animDef[propName];
            const materialized = materializeInternalLoopsInPropAnim(propName, propAnim, duration, defs);
            if (materialized !== propAnim) {
                if (!newAnimate) newAnimate = { ...animDef };
                newAnimate[propName] = materialized;
            }
        }
    }
    if (!newChildren && !newAnimate) return null;
    const cloned: PxNode = { ...node };
    if (newChildren) cloned.children = newChildren;
    if (newAnimate)  cloned.animate  = newAnimate;
    return cloned;
}


/**
 * Generates a unique element ID for internal tracking during DOM rendering.
 */
let _elementIdCounter = 0;
export function generateElementId(): string {
    return '_px_el_' + (++_elementIdCounter);
}

/**
 * Resets the element ID counter (useful for testing).
 */
export function resetElementIdCounter(): void {
    _elementIdCounter = 0;
}

/**
 * Converts an animation definition into the engine's channels (one per property). `engine`
 * controls motion-along-path handling — see {@link normalizeChannel}.
 */
function normalizeAnimationDefinition(
    animDef: PxAnimationDefinition,
    duration: number,
    defs?: PxDefinitions,
    engine: PxTimelineEngine = PxTimelineEngine.native,
    inTime = 0,
): PxRuntimeAnimation {
    const channels: PxRuntimeAnimation = {};

    for (const [propName, propAnim] of Object.entries(animDef)) {
        // `alongPathMode: 'offsetPath'` — this transform's motion is rendered by CSS
        // Motion Path (`offset-path` style on the element + an `offsetDistance` track in
        // the same dict). The tangented keyframes stay on the wire as the DESIGN source
        // (the editor round-trip reads them back), but the player must not ALSO drive
        // them: doing both moved the element to the path position and then translated it
        // again (double position). Skip the binding; `offsetDistance` owns the motion.
        if (propName === 'transform'
            && propAnim.alongPathMode === 'offsetPath'
            // …but ONLY when the offset infrastructure actually exists (an `offsetDistance`
            // track in the same definition — the pre-rendered dict shape, or a lightweight
            // doc the offset materializer rewrote). A marked transform the materializer
            // BAILED on (e.g. rotate animated in the same keyframes — inexpressible as
            // offset-path) must fall through to the ordinary sampled pipeline; skipping it
            // unconditionally froze those elements at their base pose.
            && animDef.offsetDistance !== undefined) {
            continue;
        }
        const channel = normalizeChannel(propName, propAnim, duration, defs, engine, inTime);
        if (channel.keyframes.length > 0) channels[propName] = channel;
    }

    return channels;
}

/**
 * Normalizes a PxAnimatedSvgDocument to a PxAnimatorConfig for the animation engines.
 * This is the main entry point for converting the new API format to internal format.
 * Resolves animation/easing references. `engine` controls motion-along-path
 * handling — see {@link PxTimelineEngine}.
 * @public @advanced
 */
export function normalizeBindings(
    doc: PxAnimatedSvgDocument,
    engine: PxTimelineEngine = PxTimelineEngine.native,
): PxNormalizedBinding[] {
    const animatorConfig = getAnimatorConfig(doc) || {};
    const defs = getDefinitions(doc);
    const duration = animatorConfig.duration || 1000; // FIXME - get rid of 1000 here
    // The window start (first-use review §4): keyframe times are shifted by it ONCE, here, so
    // every engine keeps sampling a [0, duration] space.
    const inTime = animatorConfig.inTime ?? 0;

    const bindings: PxNormalizedBinding[] = [];

    // Helper to merge and normalize the resolved animation definitions of one element
    const processAnimation = (
        id: string,
        animDefs: PxAnimationDefinition[],
        staticTransform?: unknown,
    ): PxNormalizedBinding | null => {
        if (animDefs.length === 0) return null;

        // CSS transform precedence (review §0.4/§1.6): the node's static transform
        // composes under the animated one — merged BEFORE normalization so both
        // engines see complete parts records.
        const merged = mergeStaticTransformIntoAnimDef(mergeAnimationDefinitions(animDefs), staticTransform);
        const normalizedAnim = normalizeAnimationDefinition(merged, duration, defs, engine, inTime);

        if (Object.keys(normalizedAnim).length === 0) return null;

        return { id, channels: normalizedAnim };
    };

    // Process bindings (for pre-rendered DOM): `target` is `#id`-spelled on the wire (every
    // element reference carries the hash — review §3.2); the engines get the bare DOM id.
    const docBindings = getBindings(doc);
    if (docBindings) {
        for (const binding of docBindings) {
            const id = binding.target.startsWith('#') ? binding.target.slice(1) : binding.target;
            const animDefs = binding.animateWith
                .map(name => resolveAnimation(name, defs))
                .filter((d): d is PxAnimationDefinition => !!d);
            const normalized = processAnimation(id, animDefs);
            if (normalized) bindings.push(normalized);
        }
    }

    // Process children (for rendered DOM).
    //
    // Per-element animations live under the node's `animate` bucket, keyed by
    // SVG/CSS property name — a PxAnimationDefinition (`{ transform: {keyframes},
    // fill: {keyframes}, … }`). The static initial value of each animated
    // property is carried separately as a plain attribute on the element body.
    // On-disk locations: top-level `node.animate` (JSON form).
    const processNode = (node: PxNode) => {
        const inlineAnim = node.animate;
        if (inlineAnim && Object.keys(inlineAnim).length > 0) {
            const nodeId = node.id || generateElementId();
            node.id = nodeId; // Ensure the node has an ID
            const normalized = processAnimation(nodeId, resolveElementAnimation(inlineAnim, defs), node.transform);
            if (normalized) bindings.push(normalized);
        }

        // Process children
        if (node.children) {
            for (let i = 0; i < node.children.length; i++) {
                processNode(node.children[i]);
            }
        }
    };

    // Process children of the root
    if (doc.children) {
        for (let i = 0; i < doc.children.length; i++) {
            processNode(doc.children[i]);
        }
    }

    return bindings;
}


// ============================================================================
// ATTRIBUTE VALUE CALCULATION (used by frame loop animator)
// ============================================================================

/**
 * Finds prev/next keyframes for a given progress.
 */
function getKeyframesPair<V>(keyframes: Array<PxRuntimeKeyframe<V>>, progress: number) {
    // Outside the keyframe range, clamp to the NEAREST REAL segment (the caller clamps
    // `localProgress` to 0/1, so that holds the boundary pose). Spanning first→last
    // instead would invent a segment that exists nowhere in the animation: for keyframes
    // that start part-way into the timeline, the pre-start frames used to interpolate
    // straight from the first to the LAST keyframe — skipping everything between, and
    // handing motion-path evaluation a chord it then cached (see `segmentOf` in PxMotionPath).
    const last = keyframes.length - 1;
    let prevKf = keyframes[0];
    let nextKf = keyframes[last > 0 ? 1 : 0];

    for (let j = 0; j < last; j++) {
        const aOff = keyframes[j].t;
        const bOff = keyframes[j + 1].t;
        if (aOff <= progress && progress <= bOff) {
            prevKf = keyframes[j];
            nextKf = keyframes[j + 1];
            break;
        }
        // Past this segment and not bracketed by any later one → hold the final segment.
        if (progress > bOff && j === last - 1) {
            prevKf = keyframes[last > 0 ? last - 1 : 0];
            nextKf = keyframes[last];
        }
    }
    return { prevKf, nextKf };
}

/** The bracketing pair at `progress` and the eased 0..1 position between them. */
function pairAt<V>(keyframes: Array<PxRuntimeKeyframe<V>>, progress: number): { prevKf: PxRuntimeKeyframe<V>; nextKf: PxRuntimeKeyframe<V>; p: number } {
    const { prevKf, nextKf } = getKeyframesPair(keyframes, progress);
    // remap to local 0..1 within prevKf..nextKf
    let p = (prevKf === nextKf) ? 0 : remap(progress, prevKf.t, nextKf.t, 0, 1);
    p = clamp(p, 0, 1);
    // e is on the source keyframe: applied from this KF to the next
    if (prevKf.e) {
        try {
            p = cubicBezier(prevKf.e)(p);
        } catch (e) {
            // fallback: ignore easing if parsing fails
        }
    }
    return { prevKf, nextKf, p };
}

// @px-importance important
/**
 * The attribute the frames engine writes for one channel at `progress`, and its value — by kind.
 */
function calcPropertyValue(
    propName: string,
    channel: PxRuntimeChannel,
    progress: number,
    segments: MotionPathSegments | undefined,
): { k: string, v: string } | null {
    if (channel.keyframes.length === 0) return null;
    const attrName = isCamelCaseWord(propName) ? camelCaseToKebabWordIfNeeded(propName) : propName;

    switch (channel.kind) {
        case PxValueKind.path: {
            const { prevKf, nextKf, p } = pairAt(channel.keyframes, progress);
            return { k: attrName, v: interpolateBeziers(prevKf.v.paths, nextKf.v.paths, p).map(bz => bezierToSvgPath(bz)).join('') };
        }
        case PxValueKind.color: {
            const { prevKf, nextKf, p } = pairAt(channel.keyframes, progress);
            return { k: propName, v: toRGBA(interpolateColor(prevKf.v, nextKf.v, p)) };
        }
        case PxValueKind.numberList: {
            const { prevKf, nextKf, p } = pairAt(channel.keyframes, progress);
            return { k: propName, v: interpolateVec(prevKf.v, nextKf.v, p).join(' ') };
        }
        case PxValueKind.parts: {
            const { prevKf, nextKf, p } = pairAt(channel.keyframes, progress);
            // Unified transform: interpolate each present part separately, then compose into a
            // transform string for the SVG `transform` attribute (no units).
            const parts = interpolateTransformParts(prevKf.v, nextKf.v, p);
            // Motion-along-path (frames engine only — the native one sampled the path at
            // normalization): evaluate the Bezier per frame — exact spatial fidelity.
            const prevTr = prevKf.v.translate;
            const nextTr = nextKf.v.translate;
            if (channel.motionPath && prevTr && nextTr) {
                const sample = evaluateMotionPathSegment(prevKf, nextKf, prevTr, nextTr, p, channel.motionPath.autoOrient, segments);
                parts.translate = [sample.translate[0], sample.translate[1]];
                // ADD the tangent angle to the element's own rotation, already interpolated into
                // `parts.rotate` above — never replace it. The native engine's flattener
                // sums the two (`buildOutKfValue` in PxMotionPath), as do the editor and Lottie;
                // overwriting here silently dropped a base rotation, so one document turned by a
                // different amount depending on which engine played it.
                if (sample.rotateDeg !== undefined) parts.rotate = sample.rotateDeg + (parts.rotate ?? 0);
            }
            return { k: 'transform', v: composeTransformParts(parts, { withUnits: false }) };
        }
        case PxValueKind.translate: case PxValueKind.scale: {
            const { prevKf, nextKf, p } = pairAt(channel.keyframes, progress);
            return { k: 'transform', v: channel.kind + '(' + interpolateVec(prevKf.v, nextKf.v, p).join(',') + ')' };
        }
        case PxValueKind.rotate: {
            const { prevKf, nextKf, p } = pairAt(channel.keyframes, progress);
            return { k: 'transform', v: 'rotate(' + interpolateNum(prevKf.v, nextKf.v, p) + ')' };
        }
        case PxValueKind.skew: {
            const { prevKf, nextKf, p } = pairAt(channel.keyframes, progress);
            return { k: 'transform', v: 'skewX(' + interpolateNum(prevKf.v, nextKf.v, p) + ')' };
        }
        case PxValueKind.percent: {
            const { prevKf, nextKf, p } = pairAt(channel.keyframes, progress);
            return { k: attrName, v: (interpolateNum(prevKf.v, nextKf.v, p) * 100) + '%' };
        }
        case PxValueKind.number: {
            const { prevKf, nextKf, p } = pairAt(channel.keyframes, progress);
            return { k: attrName, v: '' + interpolateNum(prevKf.v, nextKf.v, p) + (channel.unit ?? '') };
        }
        case PxValueKind.discrete: {
            const { prevKf, nextKf, p } = pairAt(channel.keyframes, progress);
            return { k: attrName, v: p < 0.5 ? prevKf.v : nextKf.v };
        }
    }
}

/**
 * The attribute values the frames engine writes for an element's channels at `progress` (ms).
 * @param channels The element's runtime channels (`normalizeBindings`)
 * @param progress The current time in window ms
 * @param segments Optional motion-path segment table owned by the caller (an animator keeps one for its
 *   whole life) — repeated evaluations then build each Bezier segment once; without it nothing is cached.
 * @returns Object with computed attribute name/value pairs
 * @public @advanced
 */
export function calcAnimationValues(
    channels: PxRuntimeAnimation,
    progress: number,
    segments?: MotionPathSegments,
): Record<string, string> {
    const result: Record<string, string> = {};

    for (const [propName, channel] of Object.entries(channels)) {
        const computed = calcPropertyValue(propName, channel, progress, segments);
        if (computed) {
            result[computed.k] = computed.v;
        }
    }

    return result;
}
