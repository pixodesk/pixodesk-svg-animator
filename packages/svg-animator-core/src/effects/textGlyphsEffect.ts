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
 *    `animate.transform`. Text-level `x`/`dx` add distance ALONG the path (≈
 *    startOffset) and `dy` shifts PERPENDICULAR — matching native `<textPath>`
 *    (see {@link alongPathNodeOffsets}); `y` and per-tspan positioning are ignored
 *    (a single run).
 *
 * Element creation goes through an injected {@link PxCreateElement} factory, so
 * the SAME layout produces plain wire nodes here (the effects pipeline) or the
 * editor's React/px elements when the editor calls it — see
 * {@link materialiseGlyphText}.
 *
 * v1 scope (see svga.text.design.md): keyframe-interval easing is linear;
 * kerning/ligatures, per-tspan opacity, text-level animated fill are out of scope.
 */

import { type PxAnimatable, type PxGlyphFont, type PxNode, type PxTextEffect } from '../PxAnimatorTypes';
import { TEXT_ATTR, TEXT_CONTENT_ATTR } from '../PxAnimatorConstants';
import { jsonElementFactory, type PxCreateElement } from './elementFactory';
import { transformPathData, type Affine } from './glyphPathBake';
import { createPathSampler, type PathSampler } from './pathSampler';
import { unwrapAutoOrientRotations } from '../PxMotionPath';
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
/** A glyph ready to emit: its em outline + the affine placing it in the doc.
 *  `isMissing` marks the □ placeholder — kept out of the merged real-glyph paths so a
 *  consumer can style it (see `MISSING_GLYPH_CLASS_NAME`). */
interface Placement { glyphD: string; m: Affine; paint: Paint; isMissing?: boolean; }
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


/** Default advance (in em units) for a MISSING glyph with no known width, so its
 *  placeholder box gets a plausible letter-cell instead of collapsing to nothing. */
const MISSING_GLYPH_ADVANCE_EM = 0.6;

/**
 * Class stamped on the `<path>` holding the □ placeholders — and ONLY on it: the missing
 * boxes are emitted separately from the real glyphs so a consumer can style them on their
 * own. The editor uses it to fade them in with a delay: a freshly typed character is
 * missing for a few frames until its glyph is fetched asynchronously, and a □ that flashes
 * for that long reads as a rendering glitch.
 */
export const MISSING_GLYPH_CLASS_NAME = 'px-missing-glyph';

/**
 * A HOLLOW FRAME outline (em/glyph units, baseline at y=0 rising to y=-ascent) for a
 * MISSING glyph — so a font that can't supply a char renders a visible □ instead of
 * silently disappearing. Outer rect + a reversed inner rect → a plain nonzero `fill`
 * (the SAME paint a real glyph uses) leaves the middle empty, i.e. a thin outline (a
 * solid block reads as too brutal). Empty string for degenerate sizes.
 */
function missingGlyphBoxEm(advanceEm: number, ascentEm: number): string {
    if (advanceEm <= 0 || ascentEm <= 0) return '';
    const inset = 0.08;
    const x0 = advanceEm * inset, x1 = advanceEm * (1 - inset);
    const y1 = -ascentEm * (1 - inset);            // box top (baseline at 0)
    const bw = x1 - x0, bh = -y1;
    const t = Math.max(1, Math.min(bw, bh) * 0.12);   // frame border thickness
    const outer = 'M' + x0 + ' 0L' + x1 + ' 0L' + x1 + ' ' + y1 + 'L' + x0 + ' ' + y1 + 'Z';
    if (bw <= 2 * t || bh <= 2 * t) return outer;     // too small for a hole → solid
    const ix0 = x0 + t, ix1 = x1 - t, iyb = -t, iyt = y1 + t;
    // Inner rect wound OPPOSITE the outer → nonzero fill carves a hole (the outline).
    return outer + 'M' + ix0 + ' ' + iyb + 'L' + ix0 + ' ' + iyt + 'L' + ix1 + ' ' + iyt + 'L' + ix1 + ' ' + iyb + 'Z';
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
        const upm = gf?.unitsPerEm || 1000;
        const scale = s.fontSize / upm;
        const ascentEm = gf?.ascent ?? 0.9 * upm;
        const paint = paintOf(s);
        for (let i = 0; i < content.length; i++) {
            const ch = content.charAt(i);
            const g = gf?.glyphs[ch];
            if (g && g.d) {
                placements.push({ glyphD: g.d, m: [scale, 0, 0, scale, pen.x, pen.y], paint, line, x: pen.x, y: pen.y, scale });
                pen.x += g.width * scale;
            } else if (/\S/.test(ch)) {
                // Missing glyph (font absent, or the char has no outline) → a visible □
                // placeholder box so the text doesn't just silently vanish.
                const advEm = (g && g.width > 0) ? g.width : MISSING_GLYPH_ADVANCE_EM * upm;
                placements.push({ glyphD: missingGlyphBoxEm(advEm, ascentEm), m: [scale, 0, 0, scale, pen.x, pen.y], paint, isMissing: true, line, x: pen.x, y: pen.y, scale });
                pen.x += advEm * scale;
            } else {
                pen.x += (g ? g.width : 0) * scale;   // whitespace: advance only
            }
            pen.x += s.letterSpacing + (ch === ' ' ? s.wordSpacing : 0);
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
        const content = str(el[TEXT_CONTENT_ATTR]) ?? str(el[TEXT_ATTR]);
        // Render a node's OWN text only when it has no element children. In the glyph
        // text model text lives on leaf spans; a container that ALSO carries folded
        // text — a single-span line collapsed onto its line-`<tspan>` — would
        // otherwise render its run twice (the fold AND the child span).
        if (content && !el.children?.length) renderChars(content, s);
        if (el.children) for (const ch of el.children) walk(ch, s);
    };

    const rootStyle = rootStyleOf(node);
    if (node.children) for (const ch of node.children) walk(ch, rootStyle);
    const rootContent = str(node[TEXT_CONTENT_ATTR]) ?? str(node[TEXT_ATTR]);
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


/** Per-CHARACTER advance box (local, pre-transform coords). `x,y` = the char's baseline start,
 *  `width` = its advance, `ascent`/`fontSize` size its bbox. */
export interface GlyphCharBox {
    x: number; y: number; width: number; ascent: number; fontSize: number;
    /** Along-path only: baseline END point (leading edge of the next char). Absent for
     *  horizontal, where the end is `x + width` on the same baseline. */
    endX?: number; endY?: number;
    /** Along-path only: char rotation in DEGREES (path tangent; 0 = horizontal). */
    rotation?: number;
}

/** Optional along-path geometry for {@link layoutGlyphTextChars}: when given, chars are
 *  placed + rotated along `pathD` (mirrors {@link materialiseGlyphTextAlongPath}) at the
 *  STATIC / frame-0 startOffset, so the editor caret follows the path. */
export interface GlyphCharBoxAlongPath { pathD?: string; startOffset?: PxAnimatable<number>; textLength?: PxAnimatable<number>; pathOverflow?: string; }

/** Per-character layout boxes for a glyph text, in reading/DOM order INCLUDING spaces
 *  (a space has no glyph but advances the pen) AND one zero-width filler box per EMPTY
 *  line — the editor's edit canvas renders a zero-width filler char for an empty line
 *  (so the caret has something to measure), and DOM char indices must stay aligned.
 *  HORIZONTAL by default — mirrors `materialiseGlyphTextHorizontal`'s pen-walk exactly
 *  (same x/y/dx/dy, spacing and text-anchor). When `opts.alongPath` is given, mirrors
 *  `materialiseGlyphTextAlongPath` (each char placed + rotated to the path tangent). So
 *  an editor caret built from these lands on the rendered glyphs. Empty for a text with
 *  no glyph font / unparsable path. */
export function layoutGlyphTextChars(node: PxNode, opts: Pick<GlyphMaterialiseOpts, 'glyphs' | 'warnings'> & { alongPath?: GlyphCharBoxAlongPath }): Array<GlyphCharBox> {
    if (opts.alongPath?.pathD) return layoutGlyphTextCharsAlongPath(node, opts.alongPath.pathD, opts);
    const { glyphs, warnings } = opts;
    const soleFont = soleFontOf(glyphs);

    const pen = { x: parseLen(node.x) ?? 0, y: parseLen(node.y) ?? 0 };
    const boxes: Array<GlyphCharBox & { line: number }> = [];
    const lines: Array<{ start: number; end: number }> = [{ start: pen.x, end: pen.x }];
    let line = 0;

    const renderChars = (content: string, s: Style): void => {
        const gf = glyphFontFor(s, glyphs, soleFont, warnings);
        const upm = gf?.unitsPerEm || 1000;
        const scale = s.fontSize / upm;
        const ascent = (gf?.ascent ?? 0.9 * upm) * scale;
        for (let i = 0; i < content.length; i++) {
            const ch = content.charAt(i);
            const g = gf?.glyphs[ch];
            const advance = (g ? g.width : 0) * scale + s.letterSpacing + (ch === ' ' ? s.wordSpacing : 0);
            boxes.push({ x: pen.x, y: pen.y, width: advance, ascent, fontSize: s.fontSize, line });
            pen.x += advance;
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
        const content = str(el[TEXT_CONTENT_ATTR]) ?? str(el[TEXT_ATTR]);
        if (content && !el.children?.length) renderChars(content, s);
        if (el.children) for (const ch of el.children) walk(ch, s);
    };

    const rootStyle = rootStyleOf(node);
    if (node.children) for (const ch of node.children) {
        const before = boxes.length;
        walk(ch, rootStyle);
        // An EMPTY line (a line-tspan whose subtree yields no chars) still occupies ONE
        // DOM slot on the edit canvas — the zero-width filler the editor renders so the
        // caret has something to measure. Mirror it: one zero-width box at the line's
        // pen position, sized by the line's own resolved font (ascent for caret height,
        // and its hit quad extends the element bbox to include the empty line).
        if (boxes.length === before) {
            const s = resolveStyle(ch, rootStyle);
            const gf = glyphFontFor(s, glyphs, soleFont); // no warning — an empty line has nothing to render
            const upm = gf?.unitsPerEm || 1000;
            boxes.push({ x: pen.x, y: pen.y, width: 0, ascent: (gf?.ascent ?? 0.9 * upm) * (s.fontSize / upm), fontSize: s.fontSize, line });
        }
    }
    const rootContent = str(node[TEXT_CONTENT_ATTR]) ?? str(node[TEXT_ATTR]);
    if (rootContent && !node.children?.length) renderChars(rootContent, rootStyle);

    // text-anchor: shift each line's chars by its own advance width (matches the placement shift).
    const anchor = str(node.textAnchor);
    if (anchor === 'middle' || anchor === 'end') {
        for (const b of boxes) {
            const w = lines[b.line].end - lines[b.line].start;
            b.x += anchor === 'middle' ? -w / 2 : -w;
        }
    }
    return boxes.map(({ line: _l, ...b }) => b);
}

/** Along-path variant of {@link layoutGlyphTextChars}: one box per DOM char (spaces
 *  included), placed + rotated along `pathD` at the static / frame-0 startOffset.
 *  Mirrors `collectAlongPathCells` + `materialiseGlyphTextAlongPath`, but records EVERY
 *  char (the materialiser's cells skip glyph-less chars). `pStart`=char leading edge on
 *  the path, `end`=trailing edge, `rotation`=tangent at the char midpoint. */
function layoutGlyphTextCharsAlongPath(node: PxNode, pathD: string, opts: Pick<GlyphMaterialiseOpts, 'glyphs' | 'warnings'> & { alongPath?: GlyphCharBoxAlongPath }): Array<GlyphCharBox> {
    const { glyphs, warnings, alongPath } = opts;
    const sampler = createPathSampler(pathD);
    if (!sampler) { warnings?.push('textGlyphs: unparsable along-path geometry (caret)'); return []; }
    const soleFont = soleFontOf(glyphs);

    // Reading-order pass over leaf text (positioning attrs ignored — along-path is a
    // single run), recording each char's [advStart, advEnd], its glyph advance (WITHOUT
    // spacing) for the rotation midpoint, and bbox metrics.
    const chars: Array<{ advStart: number; advEnd: number; glyphW: number; ascent: number; fontSize: number }> = [];
    let adv = 0;
    const walk = (el: PxNode, parentStyle: Style): void => {
        const s = resolveStyle(el, parentStyle);
        const content = str(el[TEXT_CONTENT_ATTR]) ?? str(el[TEXT_ATTR]);
        if (content && !el.children?.length) {
            const gf = glyphFontFor(s, glyphs, soleFont, warnings);
            const upm = gf?.unitsPerEm || 1000;
            const scale = s.fontSize / upm;
            const ascent = (gf?.ascent ?? 0.9 * upm) * scale;
            for (let i = 0; i < content.length; i++) {
                const ch = content.charAt(i);
                const g = gf?.glyphs[ch];
                const glyphW = (g ? g.width : 0) * scale;
                const advance = glyphW + s.letterSpacing + (ch === ' ' ? s.wordSpacing : 0);
                chars.push({ advStart: adv, advEnd: adv + advance, glyphW, ascent, fontSize: s.fontSize });
                adv += advance;
            }
        }
        if (el.children) for (const ch of el.children) walk(ch, s);
    };
    walk(node, rootStyleOf(node));

    const width = adv;
    // textLength (lengthAdjust=spacing): scale positions so the run spans textLength.
    // Static / frame-0 read — the caret is a static-frame layout (like startOffset below).
    const tlr = readAnimatable<number>(alongPath?.textLength);
    const tlv = tlr.kind === ReadKind.Animated ? (Number(tlr.keyframes[0]?.value) || 0)
        : tlr.kind === ReadKind.Static ? (Number(tlr.value) || 0) : 0;
    const k = (tlv > 0 && width > 0) ? tlv / width : 1;
    // startOffset base — static or frame-0 keyframe (matches the materialiser's static place).
    // x/dx add along-path distance; dy shifts perpendicular (both mirror the materialiser).
    const so = readAnimatable<number>(alongPath?.startOffset);
    const { along: alongOffset, perp } = alongPathNodeOffsets(node);
    const base = alongOffset + (so.kind === ReadKind.Animated ? (Number(so.keyframes[0]?.value) || 0)
        : so.kind === ReadKind.Static ? (Number(so.value) || 0) : 0);

    // Shift a sampled point perpendicular to the path (left normal) by `perp`.
    const withPerp = (p: { x: number; y: number; angle: number }) => ({
        x: p.x - perp * Math.sin(p.angle), y: p.y + perp * Math.cos(p.angle), angle: p.angle,
    });

    return chars.map(c => {
        const dStart = base + c.advStart * k;
        const dEnd = base + c.advEnd * k;
        const p0 = withPerp(sampler.sampleAtDistance(dStart));
        const p1 = withPerp(sampler.sampleAtDistance(dEnd));
        // Caret rotation = tangent at the GLYPH's own midpoint (advStart + glyphW/2), which
        // DISREGARDS the char's letter/word spacing. This keeps the synthetic caret aligned
        // with the baked glyph outline (which is placed at its glyph centre), so letter
        // spacing doesn't add extra tilt to the caret.
        const glyphMid = sampler.sampleAtDistance(base + (c.advStart + c.glyphW / 2) * k);
        return {
            x: p0.x, y: p0.y,
            width: c.advEnd - c.advStart,
            ascent: c.ascent, fontSize: c.fontSize,
            endX: p1.x, endY: p1.y,
            rotation: glyphMid.angle * 180 / Math.PI,
        };
    });
}


// ── ALONG-PATH ──────────────────────────────────────────────────────────────

/** One glyph in path order: its outline + geometry, and `midBase` = the arc-
 *  distance from the text start (startOffset 0) to the glyph's advance midpoint. */
interface AlongCell { glyphD: string; widthEm: number; scale: number; paint: Paint; midBase: number; isMissing?: boolean; }

/** Walks the tspans in reading order, accumulating advance (whitespace included)
 *  so each rendered glyph gets its `midBase`. Positioning attrs are ignored —
 *  along-path text is a single run. */
function collectAlongPathCells(node: PxNode, glyphs: Record<string, PxGlyphFont>, soleFont: PxGlyphFont | undefined, warnings?: Array<string>): { cells: Array<AlongCell>; width: number } {
    const cells: Array<AlongCell> = [];
    let adv = 0;
    const walk = (el: PxNode, parentStyle: Style): void => {
        const s = resolveStyle(el, parentStyle);
        const content = str(el[TEXT_CONTENT_ATTR]) ?? str(el[TEXT_ATTR]);
        // Only leaf text (no children) — a single-span line folds its text onto the
        // line-`<tspan>` AND keeps the child span; rendering both would duplicate it.
        if (content && !el.children?.length) {
            const gf = glyphFontFor(s, glyphs, soleFont, warnings);
            if (gf) {
                const scale = s.fontSize / gf.unitsPerEm;
                const ascentEm = gf.ascent ?? 0.9 * gf.unitsPerEm;
                const paint = paintOf(s);
                for (let i = 0; i < content.length; i++) {
                    const ch = content.charAt(i);
                    const g = gf.glyphs[ch];
                    if (g && g.d) {
                        const glyphAdv = g.width * scale;
                        cells.push({ glyphD: g.d, widthEm: g.width, scale, paint, midBase: adv + glyphAdv / 2 });
                        adv += glyphAdv;
                    } else if (/\S/.test(ch)) {
                        // Missing glyph → a visible □ placeholder box (see missingGlyphBoxEm).
                        const wEm = (g && g.width > 0) ? g.width : MISSING_GLYPH_ADVANCE_EM * gf.unitsPerEm;
                        const boxAdv = wEm * scale;
                        cells.push({ glyphD: missingGlyphBoxEm(wEm, ascentEm), widthEm: wEm, scale, paint, isMissing: true, midBase: adv + boxAdv / 2 });
                        adv += boxAdv;
                    } else {
                        adv += (g ? g.width : 0) * scale;   // whitespace: advance only
                    }
                    adv += s.letterSpacing + (ch === ' ' ? s.wordSpacing : 0);
                }
            }
        }
        if (el.children) for (const ch of el.children) walk(ch, s);
    };
    walk(node, rootStyleOf(node));
    return { cells, width: adv };
}

/** Affine placing a glyph so its mid-advance baseline sits at path-distance
 *  `dist`, rotated to the tangent (scale baked in). `perp` shifts the glyph
 *  PERPENDICULAR to the path (SVG `dy` on text-on-a-path), along the left normal
 *  (−sinθ, cosθ) — in path/user units, NOT scaled by the glyph size. */
function alongAffine(sampler: PathSampler, dist: number, scale: number, widthEm: number, perp = 0): Affine {
    const { x, y, angle } = sampler.sampleAtDistance(dist);
    const cos = Math.cos(angle), sin = Math.sin(angle), hw = widthEm / 2;
    return [scale * cos, scale * sin, -scale * sin, scale * cos, x - scale * cos * hw - perp * sin, y - scale * sin * hw + perp * cos];
}

/** Text-on-a-path offsets from the `<text>`/`<tspan>` x/dx/dy attributes (horizontal
 *  writing mode; see the SVG "text on a path" layout rules):
 *   • `x` and `dx` shift ALONG the path (both add to the startpoint distance),
 *   • `dy` shifts PERPENDICULAR to the path,
 *   • `y` is IGNORED (the path, not `y`, sets the cross-axis position).
 *  Matches the browser's native `<textPath>` so our baked glyphs line up with it. */
function alongPathNodeOffsets(node: PxNode): { along: number; perp: number } {
    return {
        along: (parseLen(node.x) ?? 0) + (parseLen(node.dx) ?? 0),
        perp: parseLen(node.dy) ?? 0,
    };
}

export function materialiseGlyphTextAlongPath<E = any>(
    node: PxNode,
    pathD: string | undefined,
    startOffset: PxAnimatable<number> | undefined,
    opts: GlyphMaterialiseOpts<E>,
    textLength?: PxAnimatable<number>,
    pathOverflow?: string,
): E | null {
    const { glyphs, create = jsonElementFactory as PxCreateElement<E>, warnings } = opts;
    const sampler = pathD ? createPathSampler(pathD) : null;
    if (!sampler) { warnings?.push('textGlyphs: unparsable along-path geometry'); return null; }

    const soleFont = soleFontOf(glyphs);
    const { cells, width } = collectAlongPathCells(node, glyphs, soleFont, warnings);
    if (!cells.length) return toGroup(node, [], create);

    // x/dx → extra distance ALONG the path (added to startOffset); dy → perpendicular.
    const { along: alongOffset, perp } = alongPathNodeOffsets(node);

    // Both drivers as piecewise-linear tracks. textLength (lengthAdjust=spacing) scales
    // each glyph's position along the path so the run spans `textLength(t)` (glyph
    // outlines keep their natural size): distance(t) = startOffset(t) + k(t)·midBase.
    const soTrack = numTrackOf(startOffset);
    const tlTrack = numTrackOf(textLength);
    const kOf = (tl: number): number => (tl > 0 && width > 0) ? tl / width : 1;

    // pathOverflow 'clip' (open path): a glyph whose mid-advance point falls past an
    // end disappears (native <textPath> semantics), vs 'extend' (default) where the
    // sampler continues along the tangent. See svga.text.path-overflow.plan.md.
    const isClip = pathOverflow === 'clip' && !sampler.closed;

    if (soTrack.animated || tlTrack.animated) {
        // startOffset and/or textLength animate → each glyph slides along the path: its
        // own <path> with sampled translate+rotate keyframes (no merge). Per merged-
        // timeline interval both tracks are linear, so the glyph distance is linear too.
        const times = mergeTrackTimes(soTrack.times, tlTrack.times);
        const distOf = (c: AlongCell, t: number): number => alongOffset + soTrack.at(t) + kOf(tlTrack.at(t)) * c.midBase;
        const loop = soTrack.animated ? soTrack.loop : tlTrack.loop;
        return toGroup(node, buildAnimatedAlongPath(cells, sampler, distOf, times, loop, create, isClip, perp), create);
    }

    // Static (or single-keyframe): place + bake; glyphs sharing paint still merge.
    const k = kOf(tlTrack.at(0));
    const base = alongOffset + soTrack.at(0);
    const placeCells = isClip
        ? cells.filter(c => { const d = base + c.midBase * k; return d >= 0 && d <= sampler.totalLength; })
        : cells;
    const placements: Array<Placement> = placeCells.map(c => ({
        glyphD: c.glyphD, paint: c.paint, isMissing: c.isMissing,
        m: alongAffine(sampler, base + c.midBase * k, c.scale, c.widthEm, perp),
    }));
    return toGroup(node, buildPaths(placements, create, warnings), create);
}

/** A `PxAnimatable<number>` as a clamped piecewise-LINEAR sampler: constant for
 *  static / absent / single-keyframe, keyframe-interpolated when animated — the same
 *  linear-per-interval interpretation the along-path baking has always used. */
interface NumTrack { animated: boolean; times: Array<number>; loop?: unknown; at(t: number): number; }

function numTrackOf(raw: PxAnimatable<number> | undefined): NumTrack {
    const r = readAnimatable<number>(raw);
    if (r.kind === ReadKind.Animated && r.keyframes.length >= 2) {
        const kfs = [...r.keyframes].sort((k1, k2) => (Number(k1.time) || 0) - (Number(k2.time) || 0));
        const times = kfs.map(kf => Number(kf.time) || 0);
        const vals = kfs.map(kf => Number(kf.value) || 0);
        return {
            animated: true, times, loop: r.loop,
            at(t: number): number {
                if (t <= times[0]) return vals[0];
                for (let i = 1; i < times.length; i++) {
                    if (t <= times[i]) {
                        const span = times[i] - times[i - 1];
                        const f = span > 0 ? (t - times[i - 1]) / span : 1;
                        return vals[i - 1] + f * (vals[i] - vals[i - 1]);
                    }
                }
                return vals[vals.length - 1];
            },
        };
    }
    const v = r.kind === ReadKind.Animated ? (Number(r.keyframes[0]?.value) || 0)
        : r.kind === ReadKind.Static ? (Number(r.value) || 0) : 0;
    return { animated: false, times: [], at: () => v };
}

/** Sorted union of two keyframe-time lists (deduped) — the merged animation timeline. */
function mergeTrackTimes(a: Array<number>, b: Array<number>): Array<number> {
    const all = [...a, ...b].sort((t1, t2) => t1 - t2);
    const out: Array<number> = [];
    for (const t of all) if (!out.length || t !== out[out.length - 1]) out.push(t);
    return out;
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
 *  it along the path over time. `distOf` gives the glyph's along-path distance at a
 *  time (startOffset(t) + textLength-scale(t)·midBase + x/dx — both drivers merged
 *  into `times`); each interval is sub-sampled so the glyph tracks a curved path.
 *  Interval interp is linear (per-keyframe easing shaping isn't reproduced — a v1
 *  limitation). */
function buildAnimatedAlongPath<E>(
    cells: Array<AlongCell>,
    sampler: PathSampler,
    distOf: (c: AlongCell, t: number) => number,
    times: Array<number>,
    loop: unknown,
    create: PxCreateElement<E>,
    isClip: boolean,
    perp = 0,
): Array<E> {
    const step = Math.max(sampler.totalLength / ALONG_PATH_MAX_STEPS, 0.5);
    const onPath = (dist: number): boolean => dist >= 0 && dist <= sampler.totalLength;

    const out: Array<E> = [];
    for (const c of cells) {
        const centred: Affine = [c.scale, 0, 0, c.scale, -c.scale * (c.widthEm / 2), 0];
        const d = transformPathData(c.glyphD, centred);

        const sampleKf = (dist: number, time: number): TransformKeyframe => {
            const { x, y, angle } = sampler.sampleAtDistance(dist);
            const cos = Math.cos(angle), sin = Math.sin(angle);
            // dy shifts perpendicular to the path (left normal), in path units.
            return {
                time,
                value: {
                    [TransformPart.Translate]: [roundN(x - perp * sin, 3), roundN(y + perp * cos, 3)],
                    [TransformPart.Rotate]: roundN(angle * 180 / Math.PI, 3),
                },
            };
        };

        const kfs: Array<TransformKeyframe> = [];
        // Clip: opacity 1 while the glyph's centre is on the path, 0 off — the
        // sampling is dense (`step`), so the linear fade across one step reads as a
        // near-sharp pop (a robust stand-in for the hard native-<textPath> drop).
        const opKfs: Array<TransformKeyframe<number>> = [];
        const pushKf = (dist: number, time: number): void => {
            kfs.push(sampleKf(dist, time));
            if (isClip) opKfs.push({ time, value: onPath(dist) ? 1 : 0 });
        };

        pushKf(distOf(c, times[0]), times[0]);
        for (let k = 1; k < times.length; k++) {
            const t0 = times[k - 1], t1 = times[k];
            const d0 = distOf(c, t0), d1 = distOf(c, t1);
            const n = Math.min(ALONG_PATH_MAX_STEPS_PER_SEGMENT, Math.max(1, Math.ceil(Math.abs(d1 - d0) / step)));
            for (let s = 1; s <= n; s++) {
                const f = s / n;
                const t = t0 + f * (t1 - t0);
                pushKf(distOf(c, t), t);
            }
        }

        // Tangent angles come from atan2 and wrap at ±180° — crossing that seam (e.g.
        // the bottom of a circle) would otherwise lerp the ~358° long way between two
        // samples and visibly flip the glyph. Same fix as motion-path auto-orient.
        unwrapAutoOrientRotations(kfs);

        const transform: { keyframes: Array<TransformKeyframe>; loop?: unknown } = { keyframes: kfs };
        if (loop !== undefined) transform.loop = loop;
        const animate: { [k: string]: any } = { transform };
        // Only add an opacity track when it actually toggles (a glyph fully on-path
        // the whole time needs none).
        if (isClip && opKfs.some(k => k.value === 0)) {
            const op: { keyframes: Array<TransformKeyframe<number>>; loop?: unknown } = { keyframes: opKfs };
            if (loop !== undefined) op.loop = loop;
            animate.opacity = op;
        }

        out.push(create('path', { d, ...paintProps(c.paint), ...missingGlyphProps(c.isMissing), animate }, []));
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

/** Marks a □-placeholder `<path>` for consumers; nothing at all for real glyphs. */
function missingGlyphProps(isMissing: boolean | undefined): { [k: string]: any } {
    return isMissing ? { class: MISSING_GLYPH_CLASS_NAME } : {};
}

/** Merges placements sharing paint into baked `<path>` elements. MISSING-glyph boxes merge
 *  only with each other, so they end up in their own classed `<path>` (see
 *  `MISSING_GLYPH_CLASS_NAME`) instead of being indistinguishable subpaths of a real one. */
function buildPaths<E>(placements: Array<Placement>, create: PxCreateElement<E>, warnings?: Array<string>): Array<E> {
    if (!placements.length) { warnings?.push('textGlyphs: nothing to render'); return []; }

    const byPaint = new Map<string, { paint: Paint; d: string; isMissing?: boolean }>();
    for (const p of placements) {
        // Stable key across any paint value type (hex string, [r,g,b], gradient object).
        const key = JSON.stringify([p.paint.fill ?? null, p.paint.stroke ?? null, p.paint.strokeWidth ?? null, !!p.isMissing]);
        const baked = transformPathData(p.glyphD, p.m);
        const entry = byPaint.get(key);
        if (entry) entry.d += baked;
        else byPaint.set(key, { paint: p.paint, d: baked, isMissing: p.isMissing });
    }

    const out: Array<E> = [];
    for (const { paint, d, isMissing } of byPaint.values()) {
        out.push(create('path', { d, ...paintProps(paint), ...missingGlyphProps(isMissing) }, []));
    }
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
    opts: GlyphMaterialiseOpts<E> & { alongPath?: { pathD?: string; startOffset?: PxAnimatable<number>; textLength?: PxAnimatable<number>; pathOverflow?: string } },
): E | null {
    if (opts.alongPath) return materialiseGlyphTextAlongPath(node, opts.alongPath.pathD, opts.alongPath.startOffset, opts, opts.alongPath.textLength, opts.alongPath.pathOverflow);
    return materialiseGlyphTextHorizontal(node, opts);
}

/** Pipeline adapter (plain wire nodes) — `effects.text.useGlyphs`, horizontal. */
export function applyTextGlyphsEffect(node: PxNode, fx: PxTextEffect | undefined, ctx: ApplyContext): PxNode {
    if (!fx?.useGlyphs) return node;
    if (!ctx.glyphs) { ctx.warnings.push('textGlyphs: no definitions.glyphs — left as native <text>'); return node; }
    return materialiseGlyphTextHorizontal<PxNode>(node, { glyphs: ctx.glyphs, warnings: ctx.warnings });
}

/** Pipeline adapter (plain wire nodes) — glyph text along a referenced path. */
export function applyTextGlyphsAlongPath(node: PxNode, ctx: ApplyContext, pathD: string | undefined, startOffset: PxAnimatable<number> | undefined, textLength?: PxAnimatable<number>, pathOverflow?: string): PxNode | null {
    if (!ctx.glyphs) { ctx.warnings.push('textGlyphs: no definitions.glyphs'); return null; }
    return materialiseGlyphTextAlongPath<PxNode>(node, pathD, startOffset, { glyphs: ctx.glyphs, warnings: ctx.warnings }, textLength, pathOverflow);
}
