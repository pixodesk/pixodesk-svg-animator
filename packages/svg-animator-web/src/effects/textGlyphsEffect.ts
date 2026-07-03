/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/


/**
 * `effects.text.useGlyphs` materialiser.
 *
 * Replaces a `<text>`/`<tspan>` subtree with `<path>` outlines taken from
 * `definitions.glyphs`, so the text renders with no external font. Two layouts:
 *
 *  - HORIZONTAL ({@link applyTextGlyphsEffect}) — characters laid out
 *    left-to-right by advance width; honours font-size, text-anchor,
 *    letter/word-spacing, per-tspan x/y/dx/dy, fill/stroke, nested tspans.
 *  - ALONG-PATH ({@link applyTextGlyphsAlongPath}) — each glyph placed and
 *    rotated to the tangent of the referenced path (SVG `<textPath>` look),
 *    with a static `startOffset`. Ignores per-tspan positioning (a single run).
 *
 * Both bake each glyph's outline into absolute coordinates, so a run sharing
 * fill/stroke merges into ONE `<path d>` (rotation bakes in too — along-path
 * static text is still a single path). The `<text>` node becomes a `<g>` that
 * keeps its transform / id / animate / opacity.
 *
 * v1 scope (see svga.text.design.md): animated `startOffset`, kerning/ligatures,
 * per-tspan opacity and text-level animated fill are out of scope.
 */

import { TEXT_ATTR, TEXT_CONTENT_ATTR, type PxAnimatable, type PxGlyphFont, type PxKeyframe, type PxNode, type PxTextEffect } from '../PxAnimatorTypes';
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
    'fill', 'stroke', 'strokeWidth',
    TEXT_ATTR, TEXT_CONTENT_ATTR, 'xml:space',
];

interface Paint {
    fill?: string;
    stroke?: string;
    strokeWidth?: string;
}

interface Style extends Paint {
    fontFamily?: string;
    fontSize: number;
    letterSpacing: number;
    wordSpacing: number;
}

/** A glyph ready to emit: its em-unit outline + the affine placing it in the
 *  document (scale+translate for horizontal, scale+rotate+translate along path). */
interface Placement {
    glyphD: string;
    m: Affine;
    paint: Paint;
}


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
        fill: str(node.fill) ?? parent.fill,
        stroke: str(node.stroke) ?? parent.stroke,
        strokeWidth: str(node.strokeWidth) ?? parent.strokeWidth,
        letterSpacing: parseLen(node.letterSpacing) ?? parent.letterSpacing,
        wordSpacing: parseLen(node.wordSpacing) ?? parent.wordSpacing,
    };
}

function rootStyleOf(node: PxNode): Style {
    return {
        fontFamily: str(node.fontFamily),
        fontSize: parseLen(node.fontSize) ?? DEFAULT_FONT_SIZE,
        fill: str(node.fill),
        stroke: str(node.stroke),
        strokeWidth: str(node.strokeWidth),
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

function glyphFontFor(s: Style, glyphs: Record<string, PxGlyphFont>, soleFont: PxGlyphFont | undefined, ctx: ApplyContext): PxGlyphFont | undefined {
    const gf = s.fontFamily ? glyphs[s.fontFamily] : soleFont;
    if (!gf) ctx.warnings.push('textGlyphs: no glyphs for font "' + (s.fontFamily ?? '') + '"');
    return gf;
}


// ── HORIZONTAL ──────────────────────────────────────────────────────────────

export function applyTextGlyphsEffect(node: PxNode, fx: PxTextEffect | undefined, ctx: ApplyContext): PxNode {
    if (!fx?.useGlyphs) return node;
    const glyphs = ctx.glyphs;
    if (!glyphs) { ctx.warnings.push('textGlyphs: no definitions.glyphs — left as native <text>'); return node; }

    const fontNames = Object.keys(glyphs);
    const soleFont = fontNames.length === 1 ? glyphs[fontNames[0]] : undefined;

    const pen = { x: parseLen(node.x) ?? 0, y: parseLen(node.y) ?? 0 };
    const placements: Array<Placement & { line: number; x: number; y: number; scale: number }> = [];
    const lines: Array<{ start: number; end: number }> = [{ start: pen.x, end: pen.x }];
    let line = 0;

    const renderChars = (content: string, s: Style): void => {
        const gf = glyphFontFor(s, glyphs, soleFont, ctx);
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
        if (content) renderChars(content, s);
        if (el.children) for (const ch of el.children) walk(ch, s);
    };

    const rootStyle = rootStyleOf(node);
    if (node.children) for (const ch of node.children) walk(ch, rootStyle);
    const rootContent = str(node[TEXT_ATTR]) ?? str(node[TEXT_CONTENT_ATTR]);
    if (rootContent) renderChars(rootContent, rootStyle);

    // text-anchor: shift each line by its own advance width, then rebuild `m`.
    const anchor = str(node.textAnchor);
    if (anchor === 'middle' || anchor === 'end') {
        for (const p of placements) {
            const w = lines[p.line].end - lines[p.line].start;
            const shift = anchor === 'middle' ? -w / 2 : -w;
            p.m = [p.scale, 0, 0, p.scale, p.x + shift, p.y];
        }
    }

    return toGroup(node, buildPaths(placements, ctx));
}


// ── ALONG-PATH ──────────────────────────────────────────────────────────────

/** One glyph in path order: its outline + geometry, and `midBase` = the arc-
 *  distance from the text start (startOffset 0) to the glyph's advance midpoint. */
interface AlongCell { glyphD: string; widthEm: number; scale: number; paint: Paint; midBase: number; }

/** Walks the tspans in reading order, accumulating advance (whitespace included)
 *  so each rendered glyph gets its `midBase`. Positioning attrs are ignored —
 *  along-path text is a single run. */
function collectAlongPathCells(node: PxNode, glyphs: Record<string, PxGlyphFont>, soleFont: PxGlyphFont | undefined, ctx: ApplyContext): Array<AlongCell> {
    const cells: Array<AlongCell> = [];
    let adv = 0;
    const walk = (el: PxNode, parentStyle: Style): void => {
        const s = resolveStyle(el, parentStyle);
        const content = str(el[TEXT_ATTR]) ?? str(el[TEXT_CONTENT_ATTR]);
        if (content) {
            const gf = glyphFontFor(s, glyphs, soleFont, ctx);
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
    return cells;
}

/** Affine placing a glyph so its mid-advance baseline sits at path-distance
 *  `dist`, rotated to the tangent (scale baked in). */
function alongAffine(sampler: PathSampler, dist: number, scale: number, widthEm: number): Affine {
    const { x, y, angle } = sampler.sampleAtDistance(dist);
    const cos = Math.cos(angle), sin = Math.sin(angle), hw = widthEm / 2;
    return [scale * cos, scale * sin, -scale * sin, scale * cos, x - scale * cos * hw, y - scale * sin * hw];
}

export function applyTextGlyphsAlongPath(
    node: PxNode,
    ctx: ApplyContext,
    pathD: string | undefined,
    startOffset: PxAnimatable<number> | undefined,
): PxNode | null {
    const glyphs = ctx.glyphs;
    if (!glyphs) { ctx.warnings.push('textGlyphs: no definitions.glyphs'); return null; }
    const sampler = pathD ? createPathSampler(pathD) : null;
    if (!sampler) { ctx.warnings.push('textGlyphs: unparsable along-path geometry'); return null; }

    const fontNames = Object.keys(glyphs);
    const soleFont = fontNames.length === 1 ? glyphs[fontNames[0]] : undefined;

    const cells = collectAlongPathCells(node, glyphs, soleFont, ctx);
    if (!cells.length) return toGroup(node, buildPaths([], ctx));

    const so = readAnimatable<number>(startOffset);
    if (so.kind === ReadKind.Animated && so.keyframes.length >= 2) {
        // startOffset animates → each glyph slides along the path: its own
        // <path> with sampled translate+rotate keyframes (no merge).
        return toGroup(node, buildAnimatedAlongPath(cells, sampler, so.keyframes, so.loop, ctx));
    }

    // Static (or single-keyframe): place + bake; glyphs sharing paint still merge.
    const base = so.kind === ReadKind.Animated ? (Number(so.keyframes[0]?.value) || 0)
        : so.kind === ReadKind.Static ? (Number(so.value) || 0) : 0;
    const placements: Array<Placement> = cells.map(c => ({
        glyphD: c.glyphD, paint: c.paint,
        m: alongAffine(sampler, base + c.midBase, c.scale, c.widthEm),
    }));
    return toGroup(node, buildPaths(placements, ctx));
}


// Sampling density for a glyph's motion-path keyframes: aim for ~≤ this many
// steps across the whole path so linear interpolation follows the curve.
const ALONG_PATH_MAX_STEPS = 48;
const ALONG_PATH_MAX_STEPS_PER_SEGMENT = 64;

function roundN(v: number, n: number): number {
    const f = 10 ** n;
    return Math.round(v * f) / f;
}

/** Builds a separate `<path>` per glyph, its outline baked centred at the origin
 *  (mid-advance baseline) so the `animate.transform` translate+rotate places it
 *  along the path over time. Sub-samples each startOffset keyframe interval so
 *  the glyph tracks a curved path (a 2-keyframe straight interp would chord it).
 *  Interpolation between original keyframes is treated as linear (per-keyframe
 *  easing shaping isn't reproduced — a v1 limitation). */
function buildAnimatedAlongPath(
    cells: Array<AlongCell>,
    sampler: PathSampler,
    sokfs: Array<PxKeyframe<number>>,
    loop: unknown,
    _ctx: ApplyContext,
): Array<PxNode> {
    const step = Math.max(sampler.totalLength / ALONG_PATH_MAX_STEPS, 0.5);
    const timeOf = (kf: PxKeyframe<number>): number => Number(kf.time) || 0;
    const offOf = (kf: PxKeyframe<number>): number => Number(kf.value) || 0;

    const paths: Array<PxNode> = [];
    for (const c of cells) {
        // Bake outline centred on its mid-advance baseline (scale only).
        const centred: Affine = [c.scale, 0, 0, c.scale, -c.scale * (c.widthEm / 2), 0];
        const d = transformPathData(c.glyphD, centred);

        const sampleKf = (dist: number, time: number): PxKeyframe<any> => {
            const { x, y, angle } = sampler.sampleAtDistance(dist);
            return {
                time,
                value: {
                    [TransformPart.Translate]: [roundN(x, 3), roundN(y, 3)],
                    [TransformPart.Rotate]: roundN(angle * 180 / Math.PI, 3),
                },
            };
        };

        const kfs: Array<PxKeyframe<any>> = [sampleKf(offOf(sokfs[0]) + c.midBase, timeOf(sokfs[0]))];
        for (let k = 1; k < sokfs.length; k++) {
            const t0 = timeOf(sokfs[k - 1]), t1 = timeOf(sokfs[k]);
            const o0 = offOf(sokfs[k - 1]), o1 = offOf(sokfs[k]);
            const n = Math.min(ALONG_PATH_MAX_STEPS_PER_SEGMENT, Math.max(1, Math.ceil(Math.abs(o1 - o0) / step)));
            for (let s = 1; s <= n; s++) {
                const f = s / n;
                kfs.push(sampleKf(o0 + f * (o1 - o0) + c.midBase, t0 + f * (t1 - t0)));
            }
        }

        const transform: { keyframes: Array<PxKeyframe<any>>; loop?: unknown } = { keyframes: kfs };
        if (loop !== undefined) transform.loop = loop;

        const path: PxNode = { type: 'path', d, animate: { transform } };
        if (c.paint.fill !== undefined) path.fill = c.paint.fill;
        if (c.paint.stroke !== undefined) path.stroke = c.paint.stroke;
        if (c.paint.strokeWidth !== undefined) path.strokeWidth = c.paint.strokeWidth;
        paths.push(path);
    }
    return paths;
}


// ── shared emit ───────────────────────────────────────────────────────────────

/** Merges placements sharing paint into baked `<path>` nodes. */
function buildPaths(placements: Array<Placement>, ctx: ApplyContext): Array<PxNode> {
    if (!placements.length) { ctx.warnings.push('textGlyphs: nothing to render'); return []; }

    const byPaint = new Map<string, { paint: Paint; d: string }>();
    for (const p of placements) {
        const key = (p.paint.fill ?? '') + '|' + (p.paint.stroke ?? '') + '|' + (p.paint.strokeWidth ?? '');
        const baked = transformPathData(p.glyphD, p.m);
        const entry = byPaint.get(key);
        if (entry) entry.d += baked;
        else byPaint.set(key, { paint: p.paint, d: baked });
    }

    const paths: Array<PxNode> = [];
    for (const { paint, d } of byPaint.values()) {
        const path: PxNode = { type: 'path', d };
        if (paint.fill !== undefined) path.fill = paint.fill;
        if (paint.stroke !== undefined) path.stroke = paint.stroke;
        if (paint.strokeWidth !== undefined) path.strokeWidth = paint.strokeWidth;
        paths.push(path);
    }
    return paths;
}

/** Turns the `<text>` node into a `<g>` holding the glyph paths, dropping
 *  text-specific attributes but keeping transform / id / animate / opacity. */
function toGroup(node: PxNode, paths: Array<PxNode>): PxNode {
    const g: PxNode = { ...node, type: 'g', children: paths };
    for (const key of TEXT_ATTR_KEYS) delete g[key];
    if (g.style && typeof g.style === 'object') {
        const style = { ...(g.style as Record<string, unknown>) };
        delete style['white-space'];
        if (Object.keys(style).length) g.style = style; else delete g.style;
    }
    return g;
}
