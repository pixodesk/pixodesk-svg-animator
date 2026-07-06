/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/


/**
 * Glyph text materialiser — turns a `<text>`/`<tspan>` subtree into `<path>`
 * outlines from `definitions.glyphs`, so the text renders with no external font.
 *
 *  - HORIZONTAL ({@link materialiseGlyphTextHorizontal}) — left-to-right by
 *    advance width; honours font-size, text-anchor, letter/word-spacing,
 *    per-tspan x/y/dx/dy, fill/stroke, nested tspans.
 *  - ALONG-PATH ({@link materialiseGlyphTextAlongPath}) — each glyph placed and
 *    rotated to the referenced path's tangent. Static `startOffset` → glyphs
 *    bake+merge; animated `startOffset` → per-glyph `<path>` with sampled
 *    `animate.transform`. Ignores per-tspan positioning (a single run).
 *
 * Element creation goes through an injected {@link PxCreateElement} factory, so
 * the SAME layout produces plain wire nodes here (the effects pipeline) or the
 * editor's React/px elements when the editor calls it — see
 * {@link materialiseGlyphText}.
 *
 * v1 scope (see svga.text.design.md): keyframe-interval easing is linear;
 * kerning/ligatures, per-tspan opacity, text-level animated fill are out of scope.
 */

import { TEXT_ATTR, TEXT_CONTENT_ATTR, type PxAnimatable, type PxGlyphFont, type PxNode, type PxTextEffect } from '../PxAnimatorTypes';
import { jsonElementFactory, type PxCreateElement } from './elementFactory';
import { transformPathData, type Affine } from './glyphPathBake';
import { createPathSampler, type PathSampler } from './pathSampler';
import { ReadKind, readAnimatable, TransformPart } from './transformParts';
import type { ApplyContext } from './types';


const DEFAULT_FONT_SIZE = 16;

/** Text/tspan attribute keys that don't belong on the materialised `<g>`. */
const TEXT_ATTR_KEYS: ReadonlyArray<string> = [
    'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'textAnchor',
    'letterSpacing', 'wordSpacing', 'textDecoration', 'textTransform',
    'whiteSpace', 'x', 'y', 'dx', 'dy', 'lengthAdjust',
    'fill', 'stroke', 'strokeWidth', 'effects',
    TEXT_ATTR, TEXT_CONTENT_ATTR, 'xml:space',
];

/** Inputs for a glyph materialisation, decoupled from the effects `ApplyContext`
 *  so the editor can call the materialiser directly. */
export interface GlyphMaterialiseOpts<E = any> {
    /** Embedded glyph fonts, keyed by `font-family`. */
    glyphs: Record<string, PxGlyphFont>;
    /** Element factory — defaults to plain wire nodes ({@link jsonElementFactory}). */
    create?: PxCreateElement<E>;
    /** Optional diagnostics sink. */
    warnings?: Array<string>;
}

// fill/stroke/strokeWidth are OPAQUE pass-throughs — copied verbatim onto the
// emitted element. The wire uses strings (hex); the editor threads its own
// colour VALUES through unchanged (the factory maps them back to shape paint).
interface Paint { fill?: any; stroke?: any; strokeWidth?: any; }
interface Style extends Paint { fontFamily?: string; fontSize: number; letterSpacing: number; wordSpacing: number; }
/** A glyph ready to emit: its em outline + the affine placing it in the doc. */
interface Placement { glyphD: string; m: Affine; paint: Paint; }
/** Minimal keyframe shape (avoids `PxKeyframe`'s non-generic type). Input
 *  `startOffset` kfs carry a number `value`; emitted kfs carry transform parts. */
interface TransformKeyframe<V = any> { time?: number; value: V; }


function parseLen(v: unknown): number | undefined {
    if (typeof v === 'number') return v;
    if (typeof v === 'string') { const n = parseFloat(v); return isNaN(n) ? undefined : n; }
    return undefined;
}

function str(v: unknown): string | undefined {
    return typeof v === 'string' ? v : undefined;
}

function resolveStyle(node: PxNode, parent: Style): Style {
    return {
        fontFamily: str(node.fontFamily) ?? parent.fontFamily,
        fontSize: parseLen(node.fontSize) ?? parent.fontSize,
        fill: node.fill ?? parent.fill,
        stroke: node.stroke ?? parent.stroke,
        strokeWidth: node.strokeWidth ?? parent.strokeWidth,
        letterSpacing: parseLen(node.letterSpacing) ?? parent.letterSpacing,
        wordSpacing: parseLen(node.wordSpacing) ?? parent.wordSpacing,
    };
}

function rootStyleOf(node: PxNode): Style {
    return {
        fontFamily: str(node.fontFamily),
        fontSize: parseLen(node.fontSize) ?? DEFAULT_FONT_SIZE,
        fill: node.fill,
        stroke: node.stroke,
        strokeWidth: node.strokeWidth,
        letterSpacing: parseLen(node.letterSpacing) ?? 0,
        wordSpacing: parseLen(node.wordSpacing) ?? 0,
    };
}

function paintOf(s: Style): Paint {
    const p: Paint = {};
    if (s.fill !== undefined) p.fill = s.fill;
    if (s.stroke !== undefined) p.stroke = s.stroke;
    if (s.strokeWidth !== undefined) p.strokeWidth = s.strokeWidth;
    return p;
}

function glyphFontFor(s: Style, glyphs: Record<string, PxGlyphFont>, soleFont: PxGlyphFont | undefined, warnings?: Array<string>): PxGlyphFont | undefined {
    const gf = s.fontFamily ? glyphs[s.fontFamily] : soleFont;
    if (!gf) warnings?.push('textGlyphs: no glyphs for font "' + (s.fontFamily ?? '') + '"');
    return gf;
}

function soleFontOf(glyphs: Record<string, PxGlyphFont>): PxGlyphFont | undefined {
    const names = Object.keys(glyphs);
    return names.length === 1 ? glyphs[names[0]] : undefined;
}


// ── HORIZONTAL ──────────────────────────────────────────────────────────────

export function materialiseGlyphTextHorizontal<E = any>(node: PxNode, opts: GlyphMaterialiseOpts<E>): E {
    const { glyphs, create = jsonElementFactory as PxCreateElement<E>, warnings } = opts;
    const soleFont = soleFontOf(glyphs);

    const pen = { x: parseLen(node.x) ?? 0, y: parseLen(node.y) ?? 0 };
    const placements: Array<Placement & { line: number; x: number; y: number; scale: number }> = [];
    const lines: Array<{ start: number; end: number }> = [{ start: pen.x, end: pen.x }];
    let line = 0;

    const renderChars = (content: string, s: Style): void => {
        const gf = glyphFontFor(s, glyphs, soleFont, warnings);
        if (!gf) return;
        const scale = s.fontSize / gf.unitsPerEm;
        const paint = paintOf(s);
        for (let i = 0; i < content.length; i++) {
            const ch = content.charAt(i);
            const g = gf.glyphs[ch];
            if (g && g.d) placements.push({ glyphD: g.d, m: [scale, 0, 0, scale, pen.x, pen.y], paint, line, x: pen.x, y: pen.y, scale });
            pen.x += (g ? g.width : 0) * scale + s.letterSpacing + (ch === ' ' ? s.wordSpacing : 0);
            lines[line].end = pen.x;
        }
    };

    const walk = (el: PxNode, parentStyle: Style): void => {
        const s = resolveStyle(el, parentStyle);
        const x = parseLen(el.x);
        const y = parseLen(el.y);
        if (x !== undefined) { pen.x = x; line = lines.length; lines.push({ start: pen.x, end: pen.x }); }
        if (y !== undefined) pen.y = y;
        pen.x += parseLen(el.dx) ?? 0;
        pen.y += parseLen(el.dy) ?? 0;
        const content = str(el[TEXT_ATTR]) ?? str(el[TEXT_CONTENT_ATTR]);
        // Render a node's OWN text only when it has no element children. In the glyph
        // text model text lives on leaf spans; a container that ALSO carries folded
        // text — a single-span line collapsed onto its line-`<tspan>` — would
        // otherwise render its run twice (the fold AND the child span).
        if (content && !el.children?.length) renderChars(content, s);
        if (el.children) for (const ch of el.children) walk(ch, s);
    };

    const rootStyle = rootStyleOf(node);
    if (node.children) for (const ch of node.children) walk(ch, rootStyle);
    const rootContent = str(node[TEXT_ATTR]) ?? str(node[TEXT_CONTENT_ATTR]);
    if (rootContent && !node.children?.length) renderChars(rootContent, rootStyle);

    // text-anchor: shift each line by its own advance width, then rebuild `m`.
    const anchor = str(node.textAnchor);
    if (anchor === 'middle' || anchor === 'end') {
        for (const p of placements) {
            const w = lines[p.line].end - lines[p.line].start;
            const shift = anchor === 'middle' ? -w / 2 : -w;
            p.m = [p.scale, 0, 0, p.scale, p.x + shift, p.y];
        }
    }

    return toGroup(node, buildPaths(placements, create, warnings), create);
}


// ── ALONG-PATH ──────────────────────────────────────────────────────────────

/** One glyph in path order: its outline + geometry, and `midBase` = the arc-
 *  distance from the text start (startOffset 0) to the glyph's advance midpoint. */
interface AlongCell { glyphD: string; widthEm: number; scale: number; paint: Paint; midBase: number; }

/** Walks the tspans in reading order, accumulating advance (whitespace included)
 *  so each rendered glyph gets its `midBase`. Positioning attrs are ignored —
 *  along-path text is a single run. */
function collectAlongPathCells(node: PxNode, glyphs: Record<string, PxGlyphFont>, soleFont: PxGlyphFont | undefined, warnings?: Array<string>): { cells: Array<AlongCell>; width: number } {
    const cells: Array<AlongCell> = [];
    let adv = 0;
    const walk = (el: PxNode, parentStyle: Style): void => {
        const s = resolveStyle(el, parentStyle);
        const content = str(el[TEXT_ATTR]) ?? str(el[TEXT_CONTENT_ATTR]);
        // Only leaf text (no children) — a single-span line folds its text onto the
        // line-`<tspan>` AND keeps the child span; rendering both would duplicate it.
        if (content && !el.children?.length) {
            const gf = glyphFontFor(s, glyphs, soleFont, warnings);
            if (gf) {
                const scale = s.fontSize / gf.unitsPerEm;
                const paint = paintOf(s);
                for (let i = 0; i < content.length; i++) {
                    const ch = content.charAt(i);
                    const g = gf.glyphs[ch];
                    const glyphAdv = (g ? g.width : 0) * scale;
                    if (g && g.d) cells.push({ glyphD: g.d, widthEm: g.width, scale, paint, midBase: adv + glyphAdv / 2 });
                    adv += glyphAdv + s.letterSpacing + (ch === ' ' ? s.wordSpacing : 0);
                }
            }
        }
        if (el.children) for (const ch of el.children) walk(ch, s);
    };
    walk(node, rootStyleOf(node));
    return { cells, width: adv };
}

/** Affine placing a glyph so its mid-advance baseline sits at path-distance
 *  `dist`, rotated to the tangent (scale baked in). */
function alongAffine(sampler: PathSampler, dist: number, scale: number, widthEm: number): Affine {
    const { x, y, angle } = sampler.sampleAtDistance(dist);
    const cos = Math.cos(angle), sin = Math.sin(angle), hw = widthEm / 2;
    return [scale * cos, scale * sin, -scale * sin, scale * cos, x - scale * cos * hw, y - scale * sin * hw];
}

export function materialiseGlyphTextAlongPath<E = any>(
    node: PxNode,
    pathD: string | undefined,
    startOffset: PxAnimatable<number> | undefined,
    opts: GlyphMaterialiseOpts<E>,
    textLength?: number,
): E | null {
    const { glyphs, create = jsonElementFactory as PxCreateElement<E>, warnings } = opts;
    const sampler = pathD ? createPathSampler(pathD) : null;
    if (!sampler) { warnings?.push('textGlyphs: unparsable along-path geometry'); return null; }

    const soleFont = soleFontOf(glyphs);
    const { cells, width } = collectAlongPathCells(node, glyphs, soleFont, warnings);
    if (!cells.length) return toGroup(node, [], create);

    // textLength (lengthAdjust=spacing): scale each glyph's position along the path
    // so the run spans `textLength` (glyph outlines keep their natural size).
    if (textLength && textLength > 0 && width > 0) {
        const k = textLength / width;
        for (const c of cells) c.midBase *= k;
    }

    const so = readAnimatable<number>(startOffset);
    if (so.kind === ReadKind.Animated && so.keyframes.length >= 2) {
        // startOffset animates → each glyph slides along the path: its own
        // <path> with sampled translate+rotate keyframes (no merge).
        return toGroup(node, buildAnimatedAlongPath(cells, sampler, so.keyframes as Array<TransformKeyframe<number>>, so.loop, create), create);
    }

    // Static (or single-keyframe): place + bake; glyphs sharing paint still merge.
    const base = so.kind === ReadKind.Animated ? (Number(so.keyframes[0]?.value) || 0)
        : so.kind === ReadKind.Static ? (Number(so.value) || 0) : 0;
    const placements: Array<Placement> = cells.map(c => ({
        glyphD: c.glyphD, paint: c.paint,
        m: alongAffine(sampler, base + c.midBase, c.scale, c.widthEm),
    }));
    return toGroup(node, buildPaths(placements, create, warnings), create);
}


// Sampling density for a glyph's motion-path keyframes: aim for ~≤ this many
// steps across the whole path so linear interpolation follows the curve.
const ALONG_PATH_MAX_STEPS = 48;
const ALONG_PATH_MAX_STEPS_PER_SEGMENT = 64;

function roundN(v: number, n: number): number {
    const f = 10 ** n;
    return Math.round(v * f) / f;
}

/** Builds a separate glyph element per glyph, its outline baked centred at the
 *  origin (mid-advance baseline) so `animate.transform` translate+rotate places
 *  it along the path over time. Sub-samples each startOffset keyframe interval
 *  so the glyph tracks a curved path. Interval interp is linear (per-keyframe
 *  easing shaping isn't reproduced — a v1 limitation). */
function buildAnimatedAlongPath<E>(
    cells: Array<AlongCell>,
    sampler: PathSampler,
    sokfs: Array<TransformKeyframe<number>>,
    loop: unknown,
    create: PxCreateElement<E>,
): Array<E> {
    const step = Math.max(sampler.totalLength / ALONG_PATH_MAX_STEPS, 0.5);
    const timeOf = (kf: TransformKeyframe<number>): number => Number(kf.time) || 0;
    const offOf = (kf: TransformKeyframe<number>): number => Number(kf.value) || 0;

    const out: Array<E> = [];
    for (const c of cells) {
        const centred: Affine = [c.scale, 0, 0, c.scale, -c.scale * (c.widthEm / 2), 0];
        const d = transformPathData(c.glyphD, centred);

        const sampleKf = (dist: number, time: number): TransformKeyframe => {
            const { x, y, angle } = sampler.sampleAtDistance(dist);
            return {
                time,
                value: {
                    [TransformPart.Translate]: [roundN(x, 3), roundN(y, 3)],
                    [TransformPart.Rotate]: roundN(angle * 180 / Math.PI, 3),
                },
            };
        };

        const kfs: Array<TransformKeyframe> = [sampleKf(offOf(sokfs[0]) + c.midBase, timeOf(sokfs[0]))];
        for (let k = 1; k < sokfs.length; k++) {
            const t0 = timeOf(sokfs[k - 1]), t1 = timeOf(sokfs[k]);
            const o0 = offOf(sokfs[k - 1]), o1 = offOf(sokfs[k]);
            const n = Math.min(ALONG_PATH_MAX_STEPS_PER_SEGMENT, Math.max(1, Math.ceil(Math.abs(o1 - o0) / step)));
            for (let s = 1; s <= n; s++) {
                const f = s / n;
                kfs.push(sampleKf(o0 + f * (o1 - o0) + c.midBase, t0 + f * (t1 - t0)));
            }
        }

        const transform: { keyframes: Array<TransformKeyframe>; loop?: unknown } = { keyframes: kfs };
        if (loop !== undefined) transform.loop = loop;

        out.push(create('path', { d, ...paintProps(c.paint), animate: { transform } }, []));
    }
    return out;
}


// ── shared emit ───────────────────────────────────────────────────────────────

function paintProps(paint: Paint): { [k: string]: any } {
    const p: { [k: string]: any } = {};
    if (paint.fill !== undefined) p.fill = paint.fill;
    if (paint.stroke !== undefined) p.stroke = paint.stroke;
    if (paint.strokeWidth !== undefined) p.strokeWidth = paint.strokeWidth;
    return p;
}

/** Merges placements sharing paint into baked `<path>` elements. */
function buildPaths<E>(placements: Array<Placement>, create: PxCreateElement<E>, warnings?: Array<string>): Array<E> {
    if (!placements.length) { warnings?.push('textGlyphs: nothing to render'); return []; }

    const byPaint = new Map<string, { paint: Paint; d: string }>();
    for (const p of placements) {
        // Stable key across any paint value type (hex string, [r,g,b], gradient object).
        const key = JSON.stringify([p.paint.fill ?? null, p.paint.stroke ?? null, p.paint.strokeWidth ?? null]);
        const baked = transformPathData(p.glyphD, p.m);
        const entry = byPaint.get(key);
        if (entry) entry.d += baked;
        else byPaint.set(key, { paint: p.paint, d: baked });
    }

    const out: Array<E> = [];
    for (const { paint, d } of byPaint.values()) out.push(create('path', { d, ...paintProps(paint) }, []));
    return out;
}

/** Builds the `<g>` that replaces the `<text>`: keeps its transform / id /
 *  animate / opacity, drops text-specific attributes, holds the glyph elements. */
function toGroup<E>(node: PxNode, children: Array<E>, create: PxCreateElement<E>): E {
    const gProps: { [k: string]: any } = {};
    for (const k of Object.keys(node)) {
        if (k === 'type' || k === 'children' || TEXT_ATTR_KEYS.indexOf(k) !== -1) continue;
        gProps[k] = (node as { [k: string]: any })[k];
    }
    if (gProps.style && typeof gProps.style === 'object') {
        const style = { ...(gProps.style as Record<string, unknown>) };
        delete style['white-space'];
        if (Object.keys(style).length) gProps.style = style; else delete gProps.style;
    }
    return create('g', gProps, children);
}


// ── editor-facing convenience + pipeline adapters ──────────────────────────────

/** Single entry the EDITOR calls: materialises a glyph `<text>` node into the
 *  factory's element type, choosing along-path when `alongPath` is given. */
export function materialiseGlyphText<E = any>(
    node: PxNode,
    opts: GlyphMaterialiseOpts<E> & { alongPath?: { pathD?: string; startOffset?: PxAnimatable<number>; textLength?: number } },
): E | null {
    if (opts.alongPath) return materialiseGlyphTextAlongPath(node, opts.alongPath.pathD, opts.alongPath.startOffset, opts, opts.alongPath.textLength);
    return materialiseGlyphTextHorizontal(node, opts);
}

/** Pipeline adapter (plain wire nodes) — `effects.text.useGlyphs`, horizontal. */
export function applyTextGlyphsEffect(node: PxNode, fx: PxTextEffect | undefined, ctx: ApplyContext): PxNode {
    if (!fx?.useGlyphs) return node;
    if (!ctx.glyphs) { ctx.warnings.push('textGlyphs: no definitions.glyphs — left as native <text>'); return node; }
    return materialiseGlyphTextHorizontal<PxNode>(node, { glyphs: ctx.glyphs, warnings: ctx.warnings });
}

/** Pipeline adapter (plain wire nodes) — glyph text along a referenced path. */
export function applyTextGlyphsAlongPath(node: PxNode, ctx: ApplyContext, pathD: string | undefined, startOffset: PxAnimatable<number> | undefined, textLength?: number): PxNode | null {
    if (!ctx.glyphs) { ctx.warnings.push('textGlyphs: no definitions.glyphs'); return null; }
    return materialiseGlyphTextAlongPath<PxNode>(node, pathD, startOffset, { glyphs: ctx.glyphs, warnings: ctx.warnings }, textLength);
}
