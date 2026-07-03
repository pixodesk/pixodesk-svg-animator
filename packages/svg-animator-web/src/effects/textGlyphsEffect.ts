/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/


/**
 * `effects.text.useGlyphs` materialiser (horizontal text).
 *
 * Replaces a `<text>`/`<tspan>` subtree with `<path>` outlines taken from
 * `definitions.glyphs`, so the text renders with no external font. Characters
 * are laid out left-to-right using each glyph's advance width; a run of glyphs
 * that share fill/stroke merges into ONE `<path d>`, so a static single-colour
 * text becomes a single path. The `<text>` node becomes a `<g>` that keeps its
 * transform / id / animate / opacity.
 *
 * v1 scope (see svga.text.design.md): the attributes the editor models —
 * font-size, text-anchor, letter/word-spacing, per-tspan x/y/dx/dy, fill,
 * stroke, stroke-width — and nested tspans. Along-path (`effects.textAlongPath`)
 * glyphs and per-character animation are a later step; kerning/ligatures and
 * per-tspan opacity/animated fill are out of scope.
 */

import { TEXT_ATTR, TEXT_CONTENT_ATTR, type PxGlyphFont, type PxNode, type PxTextEffect } from '../PxAnimatorTypes';
import { transformPathData, type Affine } from './glyphPathBake';
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

interface Placement {
    d: string;
    scale: number;
    x: number;
    y: number;
    line: number;
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

function paintOf(s: Style): Paint {
    const p: Paint = {};
    if (s.fill !== undefined) p.fill = s.fill;
    if (s.stroke !== undefined) p.stroke = s.stroke;
    if (s.strokeWidth !== undefined) p.strokeWidth = s.strokeWidth;
    return p;
}


export function applyTextGlyphsEffect(node: PxNode, fx: PxTextEffect | undefined, ctx: ApplyContext): PxNode {
    if (!fx?.useGlyphs) return node;

    const glyphs = ctx.glyphs;
    if (!glyphs) { ctx.warnings.push('textGlyphs: no definitions.glyphs — left as native <text>'); return node; }

    // When a run has no font-family and there's exactly one embedded font, use it.
    const fontNames = Object.keys(glyphs);
    const soleFont = fontNames.length === 1 ? glyphs[fontNames[0]] : undefined;

    const pen = { x: parseLen(node.x) ?? 0, y: parseLen(node.y) ?? 0 };
    const placements: Array<Placement> = [];
    const lines: Array<{ start: number; end: number }> = [{ start: pen.x, end: pen.x }];
    let line = 0;

    const rootStyle: Style = {
        fontFamily: str(node.fontFamily),
        fontSize: parseLen(node.fontSize) ?? DEFAULT_FONT_SIZE,
        fill: str(node.fill),
        stroke: str(node.stroke),
        strokeWidth: str(node.strokeWidth),
        letterSpacing: parseLen(node.letterSpacing) ?? 0,
        wordSpacing: parseLen(node.wordSpacing) ?? 0,
    };

    const renderChars = (content: string, s: Style): void => {
        const gf: PxGlyphFont | undefined = s.fontFamily ? glyphs[s.fontFamily] : soleFont;
        if (!gf) { ctx.warnings.push('textGlyphs: no glyphs for font "' + (s.fontFamily ?? '') + '"'); return; }
        const scale = s.fontSize / gf.unitsPerEm;
        const paint = paintOf(s);
        // UTF-16 units — matches how the editor keys glyphs (`readAllChars`).
        for (let i = 0; i < content.length; i++) {
            const ch = content.charAt(i);
            const g = gf.glyphs[ch];
            if (g && g.d) placements.push({ d: g.d, scale, x: pen.x, y: pen.y, line, paint });
            const adv = (g ? g.width : 0) * scale + s.letterSpacing + (ch === ' ' ? s.wordSpacing : 0);
            pen.x += adv;
            lines[line].end = pen.x;
        }
    };

    const walk = (el: PxNode, parentStyle: Style): void => {
        const s = resolveStyle(el, parentStyle);

        // A tspan that sets an absolute x starts a new line; y/dx/dy shift the pen.
        const x = parseLen(el.x);
        const y = parseLen(el.y);
        if (x !== undefined) {
            pen.x = x;
            line = lines.length;
            lines.push({ start: pen.x, end: pen.x });
        }
        if (y !== undefined) pen.y = y;
        pen.x += parseLen(el.dx) ?? 0;
        pen.y += parseLen(el.dy) ?? 0;

        const content = str(el[TEXT_ATTR]) ?? str(el[TEXT_CONTENT_ATTR]);
        if (content) renderChars(content, s);

        if (el.children) for (const ch of el.children) walk(ch, s);
    };

    // The <text> node's own positioning is already seeded into `pen`; walk its children.
    if (node.children) for (const ch of node.children) walk(ch, rootStyle);
    const rootContent = str(node[TEXT_ATTR]) ?? str(node[TEXT_CONTENT_ATTR]);
    if (rootContent) renderChars(rootContent, rootStyle);

    if (!placements.length) { ctx.warnings.push('textGlyphs: nothing to render'); return toGroup(node, []); }

    // text-anchor: shift each line by its own advance width.
    const anchor = str(node.textAnchor);
    if (anchor === 'middle' || anchor === 'end') {
        for (const p of placements) {
            const w = lines[p.line].end - lines[p.line].start;
            p.x += anchor === 'middle' ? -w / 2 : -w;
        }
    }

    // Merge glyphs sharing paint into one baked <path>.
    const byPaint = new Map<string, { paint: Paint; d: string }>();
    for (const p of placements) {
        const key = (p.paint.fill ?? '') + '|' + (p.paint.stroke ?? '') + '|' + (p.paint.strokeWidth ?? '');
        const m: Affine = [p.scale, 0, 0, p.scale, p.x, p.y];
        const baked = transformPathData(p.d, m);
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

    return toGroup(node, paths);
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
