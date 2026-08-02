/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/


import type { PxAnimatable, PxKeyframe, PxLoop, PxNode, PxTextPathEffect } from '../PxAnimatorTypes';
import type { ApplyContext } from './types';
import { createPathSampler } from './pathSampler';
import { ReadKind, readAnimatable, writeAnimatableChannel } from './transformParts';
import { genId } from './util';


const EXTEND_MARGIN_FRAC = 0.15; // slack (× path length) to absorb sampling/measure error


/** {min,max} over a `PxAnimatable<number>`'s keyframe values (or its single static
 *  value; {0,0} when absent). The tangent extension must cover the FULL animation
 *  range: the MOST-NEGATIVE startOffset drives the START extension, and the LARGEST
 *  startOffset(+textLength) drives the END — using only one value (e.g. the max)
 *  misses the other end when startOffset is animated. */
function numRange(v: PxAnimatable<number> | undefined): { min: number; max: number } {
    const read = readAnimatable<number>(v);
    if (read.kind === ReadKind.Static && typeof read.value === 'number') return { min: read.value, max: read.value };
    if (read.kind === ReadKind.Animated && read.keyframes.length) {
        const vals = read.keyframes.map(k => Number(k.value) || 0);
        return { min: Math.min(...vals), max: Math.max(...vals) };
    }
    return { min: 0, max: 0 };
}

/** Generous upper bound on the text's advance width: char-count × largest font
 *  (~1em/char). Over-estimating is safe — the extension is an invisible tail of the
 *  reference `<path>`, so extra length just goes unused. */
function estimateTextAdvance(node: PxNode): number {
    let chars = 0, maxFont = 16;
    const walk = (el: PxNode): void => {
        const fs = parseFloat(String((el as any).fontSize ?? '')) || 0;
        if (fs) maxFont = Math.max(maxFont, fs);
        const t = (el as any).text ?? (el as any).textContent;
        if (typeof t === 'string') chars += t.length;
        if (el.children) for (const c of el.children) walk(c);
    };
    walk(node);
    return chars * maxFont;
}

const r3 = (n: number): number => Math.round(n * 1000) / 1000;

/** Inputs for {@link extendedPathForBrowser}. `advance` = the text run-width used to
 *  size the end extension (caller-measured; the player estimates it from the node,
 *  the editor from its text model — browser fonts have no glyph metrics available). */
export interface ExtendPathOpts {
    pathOverflow?: string;
    startOffset?: PxAnimatable<number>;
    textLength?: PxAnimatable<number>;
    advance?: number;
}

/** Result of {@link extendedPathForBrowser}: the (possibly) extended `d`, plus
 *  `startShift` — the length of the prepended START lead-in. Because that lead-in
 *  moves the `<textPath>` origin back by `startShift`, EVERY `startOffset` (all
 *  keyframes) MUST be shifted by `+startShift` so the text lands where it would on
 *  the un-extended path (`extend` only adds a tail, it must never move the text). */
export interface ExtendedPath {
    d: string;
    startShift: number;
}

/** Shift a `PxAnimatable<number>` by a constant (base + all keyframes). No-op for `0`.
 *  Reads via the shared `readAnimatable` (kfs/loop aliases handled), emits the
 *  normalised long form. */
export function shiftAnimatable(v: PxAnimatable<number> | undefined, by: number): PxAnimatable<number> | undefined {
    if (!by || v === undefined || v === null) return v;
    const read = readAnimatable<number>(v);
    if (read.kind === ReadKind.Absent) return v;
    if (read.kind === ReadKind.Static) return typeof v === 'number' ? read.value + by : { value: read.value + by };
    const out: { keyframes: Array<PxKeyframe<number>>; loop?: PxLoop | boolean; autoOrient?: boolean; value?: number } = {
        keyframes: read.keyframes.map(k => ({ ...k, value: (Number(k.value) || 0) + by })),
    };
    if (read.loop !== undefined) out.loop = read.loop;
    if (read.autoOrient !== undefined) out.autoOrient = read.autoOrient;
    if (read.base !== undefined) out.value = read.base + by;
    return out;
}

/** For `pathOverflow:'extend'` (browser-font): extend an OPEN path along its endpoint
 *  tangents so the browser lays overflow glyphs onto the straight extension (matching
 *  glyph-mode's tangent behavior) instead of dropping them. `'clip'`/closed paths are
 *  returned unchanged (browser clips natively). Shared by the player's browser-font
 *  applier and the editor's live/heavy `<textPath>` def mint (single source of truth).
 *  Returns the extended `d` AND `startShift` — see {@link ExtendedPath}. */
export function extendedPathForBrowser(pathD: string, opts: ExtendPathOpts): ExtendedPath {
    if (opts.pathOverflow === 'clip') return { d: pathD, startShift: 0 };
    const sampler = createPathSampler(pathD);
    if (!sampler || sampler.closed || sampler.totalLength <= 0) return { d: pathD, startShift: 0 };

    const L = sampler.totalLength;
    const margin = EXTEND_MARGIN_FRAC * L;
    const so = numRange(opts.startOffset);
    const runWidth = numRange(opts.textLength).max || (opts.advance ?? 0);
    // START: how far the EARLIEST (most-negative) startOffset reaches before the path
    // start. END: how far the LATEST run (max startOffset + run width) reaches past the
    // path end. Only add the slack `margin` when actually extending, so a non-negative
    // startOffset that fits leaves the corresponding end alone (no phantom shift).
    const startOverflow = Math.max(0, -so.min);
    const endOverflow = Math.max(0, so.max + runWidth - L);
    const startExt = startOverflow > 0 ? startOverflow + margin : 0;
    const endExt = endOverflow > 0 ? endOverflow + margin : 0;
    if (endExt <= 0 && startExt <= 0) return { d: pathD, startShift: 0 };

    const s = sampler.sampleAtDistance(0);
    const e = sampler.sampleAtDistance(L);
    let d = pathD;
    if (startExt > 0) {
        const sx = s.x - Math.cos(s.angle) * startExt, sy = s.y - Math.sin(s.angle) * startExt;
        // Prepend a lead-in: M(extended start) L(original start) + the original path
        // minus its own leading `M x y` (we've re-stated the start via the `L`).
        const rest = pathD.replace(/^\s*[Mm]\s*-?[\d.]+[\s,]+-?[\d.]+/, '');
        d = 'M' + r3(sx) + ',' + r3(sy) + 'L' + r3(s.x) + ',' + r3(s.y) + rest;
    }
    if (endExt > 0) {
        const ex = e.x + Math.cos(e.angle) * endExt, ey = e.y + Math.sin(e.angle) * endExt;
        d += 'L' + r3(ex) + ',' + r3(ey);
    }
    // The `<textPath>` distance origin moved back by exactly the start lead-in length.
    return { d, startShift: startExt };
}


/**
 * `effects.textPath` materialiser (browser-font / non-glyph path).
 *
 * The path geometry is carried INLINE on the effect as `path` (an SVG `d`). SVG's
 * native rendering requires a `<textPath href="#…">` wrapper referencing a `<path>`
 * def, so this applier mints that `<path>` def from the inline geometry, wraps the
 * text node's children in the `<textPath>`, and forwards the textPath SVG attrs
 * (`lengthAdjust`, `method`, `spacing`, `startOffset`, `textLength`).
 *
 * `startOffset` / `textLength` accept the full `PxAnimatable<number>` shape: a static
 * number is set as an attribute; the `{keyframes}` form is forwarded to
 * `<textPath>.animate.<attr>`; `{value}` is unwrapped to the static shape.
 *
 * `pathOverflow:'extend'` tangent-extends the minted `<path>` (see
 * {@link extendedPathForBrowser}) so the browser lays overflow glyphs onto the straight
 * extension; `'clip'` mints the geometry as-is and native `<textPath>` drops overflow.
 */
export function applyTextPathEffect(
    node: PxNode,
    fx: PxTextPathEffect | undefined,
    ctx: ApplyContext,
): PxNode {
    if (!fx || typeof fx.path !== 'string' || !fx.path) return node;

    const pathId = genId(ctx, 'tpath');
    const { d, startShift } = extendedPathForBrowser(fx.path, {
        pathOverflow: fx.pathOverflow, startOffset: fx.startOffset,
        textLength: fx.textLength, advance: estimateTextAdvance(node),
    });
    ctx.defs.push({ type: 'path', id: pathId, d });

    const textPath: PxNode = {
        type: 'textPath',
        href: '#' + pathId,
        children: node.children ?? [],
    };
    if (fx.lengthAdjust !== undefined) textPath.lengthAdjust = fx.lengthAdjust;
    if (fx.method !== undefined)       textPath.method = fx.method;
    if (fx.spacing !== undefined)      textPath.spacing = fx.spacing;
    // Compensate the start lead-in: shift startOffset (all keyframes) by `startShift`
    // so `extend` doesn't move the text vs the un-extended path.
    applyAnimatableNumber(textPath, 'startOffset', shiftAnimatable(fx.startOffset, startShift));
    applyAnimatableNumber(textPath, 'textLength',  fx.textLength);

    node.children = [textPath];
    return node;
}


/** Routes a `PxAnimatable<number>` onto a node via the shared reader + emit
 *  path (`readAnimatable` → `writeAnimatableChannel`): statics land as string
 *  attrs, animations as `animate[attrName]` blocks with `loop`/`autoOrient`
 *  carried through and a static first-kf baseline attr. */
function applyAnimatableNumber(node: PxNode, attrName: string, raw: PxAnimatable<number> | undefined): void {
    if (raw === undefined || raw === null) return;
    writeAnimatableChannel(node, attrName, readAnimatable<number>(raw), { asString: true });
}
