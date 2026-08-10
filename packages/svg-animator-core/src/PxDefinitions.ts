/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { type PxAnimatedSvgDocument, type PxAnimationDefinition, type PxBezierPath, type PxBinding, type PxDefs, type PxElementAnimation, type PxKeyframe, type PxLoop, type PxNode, type PxPropertyAnimation, type PxTransformParts } from './PxAnimatorTypes';
import { getBindings, getDefs } from './PxAnimatorConstants';
import { getAnimatorConfig, PxAnimatorEngine, PxLoopExtend } from './PxAnimatorConstants';
import { bezierToSvgPath, camelCaseToKebabWordIfNeeded, clamp, COLOUR_ATTR_NAMES, composeTransformParts, cubicBezier, interpolateBeziers, interpolateColor, interpolateNum, interpolateVec, isCamelCaseWord, parseColor, PCT_BASED_ATTR_NAMES, remap, reverseEasing, splitEasing, toRGBA, TRANSFORM_FN_NAMES } from './PxAnimatorUtil';
import { evaluateMotionPathSegment, materialiseMotionPathInPropAnim, propAnimIsMotionPath } from './PxMotionPath';

/**
 * Time separation between a cycle's snap-back keyframe and the previous repetition's
 * end, in ms.
 *
 * SINGLE SOURCE OF TRUTH — the editor imports this and converts to its own frame unit
 * (`TLoop.smallFrameShift = LOOP_JUMP_SHIFT_MS / FRAME_DURATION_MS`), so the two sides
 * cannot drift apart and materialise different keyframes (B7).
 *
 * 1ms, not one 10ms editor frame: a 10ms snap-back is long enough to read as a visible
 * jump in a looping animation (confirmed visually). The gap only has to be non-zero — it
 * exists so the snap-back is a discontinuity rather than an interpolated tween.
 *
 * ⚠️ The editor works in FRAMES (`FRAME_DURATION_MS = 10`), so this is a sub-frame shift
 * there. `TKeyframeGroup` rounds keyframe times to integer frames in some paths; the
 * editor side keeps the fractional value and must not be re-clamped to a whole frame.
 */
export const LOOP_JUMP_SHIFT_MS = 1;

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
function isPathString(value: any): value is string {
    return typeof value === 'string' && extractPathData(value) !== undefined;
}

/**
 * Normalizes a 'd' attribute value to { paths: PxBezierPath[] } format.
 * Handles:
 * - { path: "M..." } / { path: "path(...)" } -> { paths: [PxBezierPath] }  (unified single-string form)
 * - { paths: ["path(...)"] } -> { paths: [PxBezierPath] }
 * - { paths: ["M..."] } -> { paths: [PxBezierPath] }
 * - ["path(...)"] -> { paths: [PxBezierPath] }
 * - ["M..."] -> { paths: [PxBezierPath] }
 * - "path(...)" -> { paths: [PxBezierPath] }
 * - "M..." -> { paths: [PxBezierPath] }
 * - { paths: [PxBezierPath] } -> as-is
 */
function normalizePathValue(value: any): { paths: Array<PxBezierPath> } | any {
    // Unified single-string form: { path: "M..." } (compound = multiple `M…` sub-paths in one string).
    if (value && typeof value === 'object' && typeof value.path === 'string') {
        const d = extractPathData(value.path);
        return d ? { paths: parseSvgPathToBezier(d) } : value;
    }

    // If already in { paths: [...] } format
    if (value && typeof value === 'object' && 'paths' in value) {
        const pathsArray = value.paths;
        if (Array.isArray(pathsArray) && pathsArray.length > 0) {
            // Check if paths contain path strings that need parsing
            if (isPathString(pathsArray[0])) {
                const paths: Array<PxBezierPath> = [];
                for (const pathStr of pathsArray) {
                    const d = extractPathData(pathStr);
                    if (d) {
                        paths.push(...parseSvgPathToBezier(d));
                    }
                }
                return { paths };
            }
        }
        // Already in correct format
        return value;
    }

    // If it's an array of path strings
    if (Array.isArray(value)) {
        if (value.length > 0 && isPathString(value[0])) {
            const paths: Array<PxBezierPath> = [];
            for (const pathStr of value) {
                const d = extractPathData(pathStr);
                if (d) {
                    paths.push(...parseSvgPathToBezier(d));
                }
            }
            return { paths };
        }
        // Already an array of PxBezierPath - wrap in { paths: }
        return { paths: value };
    }

    // If it's a single path string
    if (isPathString(value)) {
        const d = extractPathData(value)!;
        return { paths: parseSvgPathToBezier(d) };
    }

    return value;
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
    defs?: PxDefs
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
    defs?: PxDefs
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
    defs?: PxDefs
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

/**
 * Interpolates between two keyframe values based on property type.
 * Returns the raw interpolated value (not a CSS string).
 *
 * Dispatch order matters — the unified-transform-record branch must run
 * BEFORE the standalone-`rotate` branch, otherwise a `transform`-named
 * animation whose kfs are number-typed (rare but valid) would be routed
 * through the vec path.
 */
export function interpolateValue(propName: string, a: any, b: any, t: number): any {
    if (propName === 'd') {
        const aPaths = a?.paths ?? (Array.isArray(a) ? a : []);
        const bPaths = b?.paths ?? (Array.isArray(b) ? b : []);
        return { paths: interpolateBeziers(aPaths, bPaths, t) };
    }
    if (COLOUR_ATTR_NAMES.has(propName)) {
        return interpolateColor(a || [0, 0, 0, 1], b || [0, 0, 0, 1], t);
    }
    // Unified-transform record (`{translate, rotate, scale, origin}`) — the
    // most common animated `propName === 'transform'` shape. Per-part interp
    // so `+({}) = NaN` (the old fall-through) doesn't poison the boundary kf
    // at a loop seam.
    if (propName === 'transform'
        && typeof a === 'object' && a !== null && !Array.isArray(a)
        && typeof b === 'object' && b !== null && !Array.isArray(b)
    ) {
        return interpolateTransformParts(a as PxTransformParts, b as PxTransformParts, t);
    }
    // Standalone `rotate` as a propAnim — value is a NUMBER, not a vector.
    // The general TRANSFORM_FN_NAMES branch below would route it through
    // `interpolateVec`, which on a scalar returns `[]` (length NaN → no loop)
    // — wrong CSS output.
    if (propName === 'rotate' && typeof a === 'number' && typeof b === 'number') {
        return interpolateNum(a, b, t);
    }
    if (TRANSFORM_FN_NAMES.has(propName) || propName === 'stroke-dasharray' || propName === 'strokeDasharray') {
        return interpolateVec(a || [], b || [], t);
    }
    return interpolateNum(+(a || 0), +(b || 0), t);
}

/** Per-part interpolation for a unified-transform parts record. Mirrors the
 *  inline logic in `calcPropertyValue`'s transform branch. */
function interpolateTransformParts(a: PxTransformParts, b: PxTransformParts, t: number): PxTransformParts {
    const keys = new Set<string>([...Object.keys(a ?? {}), ...Object.keys(b ?? {})]);
    const out: { [k: string]: unknown } = {};
    for (const k of keys) {
        const av = (a as { [k: string]: unknown })?.[k];
        const bv = (b as { [k: string]: unknown })?.[k];
        if (k === 'rotate' || k === 'skew') {
            out[k] = interpolateNum(+(av ?? 0), +(bv ?? 0), t);
        } else if (k === 'translate' || k === 'scale' || k === 'origin') {
            const fallback: Array<number> = k === 'scale' ? [1, 1] : [0, 0];
            out[k] = interpolateVec((av as Array<number>) || fallback, (bv as Array<number>) || fallback, t);
        } else {
            // Unknown part — prefer next if present, otherwise prev.
            out[k] = bv ?? av;
        }
    }
    return out as PxTransformParts;
}

interface LoopTemplateEntry {
    relT: number; // 0..1 relative position within segment
    v: any;
    e: [number, number, number, number] | undefined;
    // Per-vertex spatial tangents (motion-along-path). Carried so repeated
    // segments keep their curvature; reversed reps swap in<->out (see appendRep).
    tangentIn?: [number, number];
    tangentOut?: [number, number];
}

/**
 * Expands keyframes by repeating a segment to fill the gap between the keyframe
 * range and the global animation duration, implementing PxLoop "local loop" behavior.
 */
function expandLoopKeyframes(
    propName: string,
    keyframes: PxKeyframe[],
    loop: PxLoop,
    duration: number
): PxKeyframe[] {
    const totalIntervals = keyframes.length - 1;
    const segCount = clamp(loop.segmentCount ?? totalIntervals, 1, totalIntervals);

    // Extract segment keyframes
    let segKfs: PxKeyframe[];
    if (loop.extend === PxLoopExtend.before) {
        segKfs = keyframes.slice(0, segCount + 1);
    } else {
        segKfs = keyframes.slice(totalIntervals - segCount);
    }

    // Determine fill region
    const firstT = keyframes[0].t ?? 0;
    const lastT = keyframes[keyframes.length - 1].t ?? 0;

    let fillStart: number, fillEnd: number;
    if (loop.extend === PxLoopExtend.before) {
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
    const template: LoopTemplateEntry[] = segKfs.map(kf => ({
        relT: (kf.t! - segStartT) / segDuration,
        v: kf.v,
        e: kf.e as [number, number, number, number] | undefined,
        tangentIn: (kf.tangentIn ?? kf.ti) as [number, number] | undefined,
        tangentOut: (kf.tangentOut ?? kf.to) as [number, number] | undefined
    }));

    const fullReps = Math.floor(fillDuration / segDuration);
    const remainder = fillDuration - fullReps * segDuration;
    const partialFraction = remainder / segDuration;

    const looped: PxKeyframe[] = [];

    // A cycle's first keyframe lands at the SAME time as the previous repetition's
    // last one. Emitting both at that time makes the value at that instant depend on
    // the sampler's tie-break, and left the player disagreeing with the editor (B7).
    // Mirror `TLoop.toKeyframes` exactly:
    //   - values EQUAL (pingpong turn, closed loop) → the duplicate says nothing, skip it;
    //   - values DIFFER (a real cycle snap)         → separate them by LOOP_JUMP_SHIFT_MS.
    // The editor's shift is one 10ms frame (`smallFrameShift`), so the two sides
    // materialise identical keyframes. Anything smaller is blocked editor-side: a
    // fractional-frame shift was tried there and reverted (TKeyframeGroup mishandles it).
    // SCOPE: loopOut (`after`) only — see the note above. For loopIn the pair sits in
    // the opposite order in the array, so separating it means moving the EARLIER
    // keyframe earlier; done naively it inverts keyframe order and re-breaks the
    // loopIn `f0` regression (`appendRepTail`). Left as-is until it has its own
    // editor-CSS evidence; the two sides may still differ at a loopIn boundary.
    const separateBoundary = loop.extend !== PxLoopExtend.before;
    // The keyframe the FIRST repetition butts up against: loopOut tiles forward from
    // the last original keyframe (the originals are concatenated only at assembly).
    const originalTerminalKf: PxKeyframe | undefined = keyframes[keyframes.length - 1];

    // Easing that a skipped boundary keyframe hands to the ORIGINAL terminal keyframe.
    // Easing describes the interval that FOLLOWS a keyframe, so when a pingpong turn's
    // duplicate is dropped (same value, nothing to say about position) its easing is NOT
    // redundant — it owns the return leg. Without this hand-off the return leg renders
    // LINEAR while the outbound is eased. The originals belong to the caller, so it is
    // applied by replacing the terminal with a copy at assembly, never by mutation.
    let terminalEasingOverride: PxKeyframe['e'] | undefined;
    let hasTerminalEasingOverride = false;

    // Helper: append one full or partial repetition
    function appendRep(repStart: number, isReversed: boolean, partial?: number) {
        let entries: LoopTemplateEntry[];
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
                const cutValue = interpolateValue(propName, prev.v, entry.v, easedFrac);

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

            const pushed: PxKeyframe = {
                t: repStart + entry.relT * segDuration + (isBoundary ? LOOP_JUMP_SHIFT_MS : 0),
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
        let entries: LoopTemplateEntry[];
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
                const startValue = interpolateValue(propName, prev.v, entry.v, easedFrac);
                const { right: rightEasing } = splitEasing(prev.e, localFrac);
                looped.push({ t: repStart, v: startValue, e: rightEasing });
            }

            const pushed: PxKeyframe = {
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
    if (loop.extend === PxLoopExtend.before) {
        // loopIn — the fill must END exactly at the first keyframe (firstT), so the
        // reps tile BACKWARD from that boundary: the leftover (partial) rep sits at
        // fillStart showing the segment's tail, then `fullReps` full reps run up to
        // firstT. (Forward-tiling — as loopOut does — would push the partial next to
        // firstT and desync the fill: the loopIn `f0` regression.)
        if (partialFraction > 1e-9) {
            const isReversed = !!loop.alternate && (fullReps % 2 === 0);
            appendRepTail(fillStart, isReversed, partialFraction);
        }
        for (let rep = 0; rep < fullReps; rep++) {
            const distFromBoundary = fullReps - 1 - rep;
            const isReversed = !!loop.alternate && (distFromBoundary % 2 === 0);
            const repStart = fillStart + remainder + rep * segDuration;
            appendRep(repStart, isReversed);
        }
    } else {
        // loopOut — boundary is at fillStart (lastT); tile forward, partial at the end.
        for (let rep = 0; rep < fullReps; rep++) {
            const isReversed = !!loop.alternate && (rep % 2 === 0);
            const repStart = fillStart + rep * segDuration;
            appendRep(repStart, isReversed);
        }
        if (partialFraction > 1e-9) {
            const isReversed = !!loop.alternate && (fullReps % 2 === 0);
            const repStart = fillStart + fullReps * segDuration;
            appendRep(repStart, isReversed, partialFraction);
        }
    }

    // Assemble: looped keyframes go before or after the original keyframes.
    // No junction deduplication — cycle mode relies on value jumps at boundaries.
    if (loop.extend === PxLoopExtend.before) {
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

/**
 * Normalizes keyframes from the new API format (time in ms) to internal format (time as 0-1 fraction).
 * Resolves easing references, normalizes times, and converts path strings for 'd' attribute.
 * If a loop configuration is present, expands the keyframes to fill the global duration.
 * @param propName The property name (e.g., 'd' for path)
 * @param propAnim The property animation with keyframes
 * @param duration The total animation duration in ms
 * @param defs The definitions containing named easings
 * @returns Array of normalized keyframes (same structure, resolved refs, normalized times)
 */
function normalizeKeyframes(
    propName: string,
    propAnim: PxPropertyAnimation,
    duration: number,
    defs?: PxDefs
): PxKeyframe[] {
    const keyframes = propAnim.keyframes || propAnim.kfs || [];

    const normalized: PxKeyframe[] = [];

    for (const kf of keyframes) {
        const timePct = kf.time ?? kf.t ?? 0;
        let value = kf.value ?? kf.v;
        const easing = kf.easing ?? kf.e;

        // Normalize path values for 'd' attribute
        if (propName === 'd') {
            value = normalizePathValue(value);
        }

        // Normalize color values (hex/rgb/rgba strings to [0-1] vectors).
        // `COLOUR_ATTR_NAMES` is keyed in kebab-case (`stop-color`, `flood-color`,
        // `lighting-color`); the wire format uses both kebab AND camelCase
        // (`stopColor`) for these props. Without converting, frames-mode would
        // call `interpolateColor` on the raw strings and produce `NaN` channels
        // — the visible "rgba(NaN,NaN,NaN,…)" bug on stop-color animations.
        const propNameKebab = isCamelCaseWord(propName) ? camelCaseToKebabWordIfNeeded(propName) : propName;
        if (COLOUR_ATTR_NAMES.has(propNameKebab)) {
            value = parseColor(value) ?? value;
        }

        const normKf: PxKeyframe = {
            t: timePct,
            v: value,
            e: resolveEasing(easing, defs)
        };
        // Motion-along-path: keep the spatial tangents so the downstream
        // `materialiseMotionPathInPropAnim` (called in `normalizeAnimationDefinition`) can
        // sample them into transform kfs. Short aliases `ti` / `to` collapse
        // into their canonical names.
        const tIn = kf.tangentIn ?? kf.ti;
        const tOut = kf.tangentOut ?? kf.to;
        if (tIn) normKf.tangentIn = tIn;
        if (tOut) normKf.tangentOut = tOut;

        normalized.push(normKf);
    }

    // Sort by time
    normalized.sort((a, b) => (a.t ?? 0) - (b.t ?? 0));

    // Expand loop if configured (loop:true is shorthand for default PxLoop)
    const loopRaw = propAnim.loop;
    const loop: PxLoop | undefined = loopRaw === true ? {} : loopRaw || undefined;
    if (loop && normalized.length >= 2) {
        return expandLoopKeyframes(propName, normalized, loop, duration);
    }

    return normalized;
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
//  Public loop-materialisation API
//
//  Used internally by `normalizeKeyframes` (where `expandLoopKeyframes` is
//  already called at the tail of normalisation). Exposed here at the propAnim
//  and tree levels so the Editor (or any external caller) can compose:
//      root = applyPlayerEffects(root).root;
//      root = materialiseInternalLoopsInTree(root, duration);
//      root = materialiseMotionPathsInTree(root);
//  to produce a fully-flat document with no `loop`, no `effects`, no tangents.
// ─────────────────────────────────────────────────────────────────────────────


/**
 * Replaces `propAnim.loop` with explicit repeated keyframes via
 * `expandLoopKeyframes`. Returns the input by reference when no loop is
 * configured (no-op). Output drops the `loop` field (consumed).
 */
export function materialiseInternalLoopsInPropAnim(
    propName: string,
    propAnim: PxPropertyAnimation,
    duration: number,
): PxPropertyAnimation {
    const loopRaw = propAnim.loop;
    if (loopRaw === undefined || loopRaw === null || loopRaw === false) return propAnim;
    const loop: PxLoop = loopRaw === true ? {} : (loopRaw as PxLoop);
    const rawKfs = (propAnim.keyframes ?? propAnim.kfs) as PxKeyframe[] | undefined;
    if (!Array.isArray(rawKfs) || rawKfs.length < 2) return propAnim;

    // `expandLoopKeyframes` reads kf.t / kf.v / kf.e (short form). When this
    // function is called from the materialisation pipeline OUTSIDE the
    // binding-normalisation path (e.g. by `materialiseAllInTree`), the input
    // kfs may still be in long form (`time` / `value` / `easing`) AND the
    // values may be unparsed (hex colour strings, raw path-`d`). Normalise
    // both here so `interpolateValue` (called by `expandLoopKeyframes` at the
    // loop seam) sees structured data — without this, a colour boundary kf
    // ends up `[NaN,NaN,NaN,NaN]` and the bug stays visible until the
    // animation cycle restarts.
    const propNameKebab = isCamelCaseWord(propName) ? camelCaseToKebabWordIfNeeded(propName) : propName;
    const isColour = COLOUR_ATTR_NAMES.has(propNameKebab);
    const kfs: PxKeyframe[] = rawKfs.map(kf => {
        const t = kf.t ?? kf.time;
        let v: unknown = kf.v ?? kf.value;
        if (propName === 'd') v = normalizePathValue(v);
        if (isColour) v = parseColor(v) ?? v;
        const e = kf.e ?? kf.easing;
        const out: PxKeyframe = { t, v, e } as PxKeyframe;
        if (kf.tangentIn ?? kf.ti) out.tangentIn = (kf.tangentIn ?? kf.ti) as [number, number];
        if (kf.tangentOut ?? kf.to) out.tangentOut = (kf.tangentOut ?? kf.to) as [number, number];
        return out;
    });

    const expanded = expandLoopKeyframes(propName, kfs, loop, duration);
    const out: PxPropertyAnimation = { kfs: expanded } as PxPropertyAnimation;
    if (propAnim.autoOrient !== undefined) (out as { autoOrient?: unknown }).autoOrient = propAnim.autoOrient;
    return out;
}


/**
 * Walks `root` and materialises every animated property's `loop` via
 * `materialiseInternalLoopsInPropAnim`. Immutable — returns the input by
 * reference when no loop was found anywhere; otherwise clones along the path
 * to each affected node, sharing untouched sub-trees.
 */
export function materialiseInternalLoopsInTree(
    root: PxNode,
    duration: number,
): PxNode {
    const ret = walkAndMaterialiseLoops(root, duration);
    return ret ?? root;
}

function walkAndMaterialiseLoops(node: PxNode, duration: number): PxNode | null {
    let newChildren: Array<PxNode> | undefined;
    if (node.children) {
        for (let i = 0; i < node.children.length; i++) {
            const ret = walkAndMaterialiseLoops(node.children[i], duration);
            if (ret !== null) {
                if (!newChildren) newChildren = node.children.slice();
                newChildren[i] = ret;
            }
        }
    }
    let newAnimate: Record<string, PxPropertyAnimation> | undefined;
    const animBucket = node.animate;
    if (animBucket && typeof animBucket === 'object' && !Array.isArray(animBucket)) {
        const animDef = animBucket as Record<string, PxPropertyAnimation>;
        for (const propName of Object.keys(animDef)) {
            const propAnim = animDef[propName];
            const materialised = materialiseInternalLoopsInPropAnim(propName, propAnim, duration);
            if (materialised !== propAnim) {
                if (!newAnimate) newAnimate = { ...animDef };
                newAnimate[propName] = materialised;
            }
        }
    }
    if (!newChildren && !newAnimate) return null;
    const cloned: PxNode = { ...node };
    if (newChildren) cloned.children = newChildren;
    if (newAnimate)  cloned.animate  = newAnimate as PxNode['animate'];
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
 * Normalizes an animation definition by resolving easing references and normalizing keyframe times.
 * Keeps the key/value mapping structure. `engine` controls motion-along-path
 * handling — see {@link PxAnimatorEngine}.
 */
function normalizeAnimationDefinition(
    animDef: PxAnimationDefinition,
    duration: number,
    defs?: PxDefs,
    engine: PxAnimatorEngine = PxAnimatorEngine.waapi,
): PxAnimationDefinition {
    const normalized: PxAnimationDefinition = {};

    for (const [propName, propAnim] of Object.entries(animDef)) {
        // `alongPathMode: 'offsetPath'` — this transform's motion is rendered by CSS
        // Motion Path (`offset-path` style on the element + an `offsetDistance` track in
        // the same dict). The tangented keyframes stay on the wire as the DESIGN source
        // (the editor round-trip reads them back), but the player must not ALSO drive
        // them: doing both moved the element to the path position and then translated it
        // again (double position). Skip the binding; `offsetDistance` owns the motion.
        if (propName === 'transform'
            && (propAnim as { alongPathMode?: string }).alongPathMode === 'offsetPath'
            // …but ONLY when the offset infrastructure actually exists (an `offsetDistance`
            // track in the same definition — the pre-rendered dict shape, or a lightweight
            // doc the offset materialiser rewrote). A marked transform the materialiser
            // BAILED on (e.g. rotate animated in the same keyframes — inexpressible as
            // offset-path) must fall through to the ordinary sampled pipeline; skipping it
            // unconditionally froze those elements at their base pose.
            && (animDef as Record<string, unknown>)['offsetDistance'] !== undefined) {
            continue;
        }
        const normalizedKfs = normalizeKeyframes(propName, propAnim, duration, defs);
        if (normalizedKfs.length > 0) {
            const out: PxPropertyAnimation = { kfs: normalizedKfs };
            // Carry top-level animation flags through normalization — `materialiseMotionPathInPropAnim`
            // and the runtime evaluators need `autoOrient` / `loop` to be present
            // alongside the kfs.
            if (propAnim.autoOrient !== undefined) out.autoOrient = propAnim.autoOrient;
            if (propAnim.loop !== undefined) out.loop = propAnim.loop;

            // Pipeline: loops are already expanded by `normalizeKeyframes` above.
            // For the `waapi` engine ONLY, materialise motion-along-path
            // (tangented `transform` kfs + autoOrient) into plain sampled
            // `{ translate, rotate? }` kfs — CSS WAAPI can't evaluate parametric
            // tangents at runtime. Frames-mode keeps the parametric form so the
            // frame-loop kernel `evaluateMotionPathSegment` can sample per frame
            // (better spatial fidelity than any finite sampling).
            // `materialiseMotionPathInPropAnim` is a no-op for non-motion-path
            // animations, so non-transform props pay zero cost.
            normalized[propName] = (engine === PxAnimatorEngine.waapi && propName === 'transform')
                ? materialiseMotionPathInPropAnim(out)
                : out;
        }
    }

    return normalized;
}

/**
 * Normalizes a PxAnimatedSvgDocument to a PxAnimatorConfig for the animation engines.
 * This is the main entry point for converting the new API format to internal format.
 * Resolves animation/easing references. `engine` controls motion-along-path
 * handling — see {@link PxAnimatorEngine}.
 */
export function getNormalisedBindings(
    doc: PxAnimatedSvgDocument,
    engine: PxAnimatorEngine = PxAnimatorEngine.waapi,
): PxBinding[] {
    const animatorConfig = getAnimatorConfig(doc) || {};
    const defs = getDefs(doc);
    const duration = animatorConfig.duration || 1000; // FIXME - get rid of 1000 here

    const bindings: PxBinding[] = [];

    // Helper to resolve and normalize animation for a binding
    const processAnimation = (
        id: string,
        animate: PxElementAnimation | undefined
    ): PxBinding | null => {
        if (!animate) return null;

        const animDefs = resolveElementAnimation(animate, defs);
        if (animDefs.length === 0) return null;

        const merged = mergeAnimationDefinitions(animDefs);
        const normalizedAnim = normalizeAnimationDefinition(merged, duration, defs, engine);

        if (Object.keys(normalizedAnim).length === 0) return null;

        return {
            id,
            animate: normalizedAnim
        };
    };

    // Process bindings (for pre-rendered DOM)
    const docBindings = getBindings(doc);
    if (docBindings) {
        for (const binding of docBindings) {
            const normalized = processAnimation(binding.id, binding.animate);
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
            const normalized = processAnimation(nodeId, inlineAnim);
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
function getKeyframesPair(keyframes: PxKeyframe[], progress: number) {
    // Outside the keyframe range, clamp to the NEAREST REAL segment (the caller clamps
    // `localProgress` to 0/1, so that holds the boundary pose). Spanning first→last
    // instead would invent a segment that exists nowhere in the animation: for keyframes
    // that start part-way into the timeline, the pre-start frames used to interpolate
    // straight from the first to the LAST keyframe — skipping everything between, and
    // handing motion-path evaluation a chord it then cached (see `getSegmentCache`).
    const last = keyframes.length - 1;
    let prevKf = keyframes[0];
    let nextKf = keyframes[last > 0 ? 1 : 0];

    for (let j = 0; j < last; j++) {
        const aOff = (keyframes[j].t ?? 0);
        const bOff = (keyframes[j + 1].t ?? 0);
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

/**
 * Calculates interpolated value for a single property animation.
 */
function calcPropertyValue(
    propName: string,
    propAnim: PxPropertyAnimation,
    progress: number
): { k: string, v: string } | null {
    const keyframes = propAnim.kfs || propAnim.keyframes || [];
    if (keyframes.length === 0) return null;

    const { prevKf, nextKf } = getKeyframesPair(keyframes, progress);

    // remap to local 0..1 within prevKf..nextKf
    let localProgress = (prevKf === nextKf) ? 0 : remap(progress, prevKf.t ?? 0, nextKf.t ?? 0, 0, 1);
    localProgress = clamp(localProgress, 0, 1);
    const easing = prevKf.e ?? prevKf.easing; // e is on the source keyframe: applied from this KF to the next
    if (easing && Array.isArray(easing)) {
        try {
            localProgress = cubicBezier(easing as [number, number, number, number])(localProgress);
        } catch (e) {
            // fallback: ignore easing if parsing fails
        }
    }

    let cssAttrName = isCamelCaseWord(propName) ? camelCaseToKebabWordIfNeeded(propName) : propName;
    let cssValue: string | number | null = null;

    const prevV = prevKf?.v ?? prevKf?.value;
    const nextV = nextKf?.v ?? nextKf?.value;

    if (cssAttrName === 'd') {
        // Extract paths from { paths: [...] } format
        const prevPaths = prevV?.paths ?? (Array.isArray(prevV) ? prevV : []);
        const nextPaths = nextV?.paths ?? (Array.isArray(nextV) ? nextV : []);
        cssValue = interpolateBeziers(
            prevPaths,
            nextPaths,
            localProgress
        ).map(bz => bezierToSvgPath(bz)).join('');
    } else if (COLOUR_ATTR_NAMES.has(cssAttrName)) {
        cssValue = toRGBA(interpolateColor(
            prevV || [0, 0, 0, 1],
            nextV || [0, 0, 0, 1],
            localProgress
        ));
        cssAttrName = propName;
    } else if (cssAttrName === 'stroke-dasharray') {
        cssValue = interpolateVec(
            prevV || [],
            nextV || [],
            localProgress
        ).join(' ');
        cssAttrName = propName;
    } else if (
        cssAttrName === 'transform' &&
        prevV !== null && typeof prevV === 'object' && !Array.isArray(prevV)
    ) {
        // Unified transform: keyframe values are PxTransformParts records.
        // Interpolate each present part separately, then compose into a transform
        // string for the SVG `transform` attribute (no units).
        const partKeys = new Set<string>([
            ...(prevV ? Object.keys(prevV) : []),
            ...(nextV ? Object.keys(nextV) : []),
        ]);
        const partsResult: PxTransformParts = {};
        for (const partKey of partKeys) {
            const prevPart = prevV?.[partKey];
            const nextPart = nextV?.[partKey];
            if (partKey === 'rotate' || partKey === 'skew') {
                partsResult[partKey] = interpolateNum(+(prevPart ?? 0), +(nextPart ?? 0), localProgress);
            } else if (partKey === 'translate' || partKey === 'scale' || partKey === 'origin') {
                const fallback = partKey === 'scale' ? [1, 1] : [0, 0];
                const interp = interpolateVec(prevPart || fallback, nextPart || fallback, localProgress);
                (partsResult as any)[partKey] = interp;
            }
        }
        // Motion-along-path override (frames-mode only). The WAAPI binding
        // pipeline materialises tangents + autoOrient into sampled
        // `{translate, rotate}` kfs upstream (in `normalizeAnimationDefinition`),
        // so for WAAPI this branch is a no-op (`propAnimIsMotionPath` returns
        // false on already-materialised kfs). Frames-mode preserves the
        // parametric form and we evaluate the Bezier per frame here — gives
        // exact spatial fidelity vs. any finite sampling.
        if (propAnimIsMotionPath(propAnim)) {
            const prevTr = (prevV as { translate?: [number, number] }).translate;
            const nextTr = (nextV as { translate?: [number, number] }).translate;
            if (Array.isArray(prevTr) && Array.isArray(nextTr)) {
                const sample = evaluateMotionPathSegment(
                    prevKf, nextKf,
                    [+prevTr[0], +prevTr[1]],
                    [+nextTr[0], +nextTr[1]],
                    localProgress,
                    !!propAnim.autoOrient,
                );
                partsResult.translate = [sample.translate[0], sample.translate[1]];
                if (sample.rotateDeg !== undefined) partsResult.rotate = sample.rotateDeg;
            }
        }
        cssValue = composeTransformParts(partsResult, { withUnits: false });
        cssAttrName = 'transform';
    } else if (cssAttrName === 'translate') {
        const v = interpolateVec(
            prevV || [0, 0],
            nextV || [0, 0],
            localProgress
        );
        cssValue = 'translate(' + v.join(',') + ')';
        cssAttrName = 'transform';
    } else if (cssAttrName === 'rotate') {
        const v = interpolateNum(
            +(prevV || 0),
            +(nextV || 0),
            localProgress
        );
        cssValue = 'rotate(' + v + ')';
        cssAttrName = 'transform';
    } else if (cssAttrName === 'scale') {
        const v = interpolateVec(
            prevV || [1, 1],
            nextV || [1, 1],
            localProgress
        );
        cssValue = 'scale(' + v.join(',') + ')';
        cssAttrName = 'transform';
    } else {
        // numeric attr
        const num = interpolateNum(
            +(prevV || 0),
            +(nextV || 0),
            localProgress
        );
        cssValue = num;
    }

    if (PCT_BASED_ATTR_NAMES.has(cssAttrName) && typeof cssValue === 'number') {
        cssValue = (cssValue * 100) + '%';
    }

    return { k: cssAttrName, v: cssValue === null ? '' : '' + cssValue };
}

/**
 * Calculates interpolated attribute values for an animation definition.
 * @param animDef The animation definition (with resolved refs and normalized times)
 * @param progress The current animation progress (0-1)
 * @returns Object with computed attribute name/value pairs
 */
export function calcAnimationValues(
    animDef: PxAnimationDefinition,
    progress: number
): Record<string, string> {
    const result: Record<string, string> = {};

    for (const [propName, propAnim] of Object.entries(animDef)) {        
        const computed = calcPropertyValue(propName, propAnim, progress);
        if (computed) {
            result[computed.k] = computed.v;
        }
    }

    return result;
}
