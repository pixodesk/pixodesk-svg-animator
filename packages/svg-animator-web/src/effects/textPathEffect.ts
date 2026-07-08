/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/


import type { PxAnimatable, PxNode, PxTextPathEffect } from '../PxAnimatorTypes';
import type { ApplyContext } from './types';
import { createPathSampler } from './pathSampler';
import { genId } from './util';


const EXTEND_MARGIN_FRAC = 0.15; // slack (× path length) to absorb sampling/measure error


/** Static value of a `PxAnimatable<number>` (0 when animated/absent) — enough to
 *  size the tangent extension for the common non-animated case. */
function staticNum(v: PxAnimatable<number> | undefined): number {
    if (typeof v === 'number') return v;
    if (v && typeof v === 'object') {
        const o = v as { value?: number; keyframes?: Array<{ value?: number }> };
        if (typeof o.value === 'number') return o.value;
        if (Array.isArray(o.keyframes)) return Math.max(...o.keyframes.map(k => Number(k.value) || 0), 0);
    }
    return 0;
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

/** For `pathOverflow:'extend'` (browser-font): extend an OPEN path along its endpoint
 *  tangents so the browser lays overflow glyphs onto the straight extension (matching
 *  glyph-mode's tangent behavior) instead of dropping them. `'clip'`/closed paths are
 *  returned unchanged (browser clips natively). */
function extendedPathForBrowser(pathD: string, fx: PxTextPathEffect, node: PxNode): string {
    if (fx.pathOverflow === 'clip') return pathD;
    const sampler = createPathSampler(pathD);
    if (sampler.closed || sampler.totalLength <= 0) return pathD;

    const L = sampler.totalLength;
    const margin = EXTEND_MARGIN_FRAC * L;
    const startOff = staticNum(fx.startOffset);
    const reach = startOff + (staticNum(fx.textLength) || estimateTextAdvance(node));
    const endExt = Math.max(0, reach - L) + margin;
    const startExt = Math.max(0, -startOff) + margin;
    if (endExt <= 0 && startExt <= 0) return pathD;

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
    return d;
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
 * NOTE: `pathOverflow:'extend'` (tangent-extending the minted `<path>` so the browser
 * lays overflow glyphs onto the straight extension) is a later step — today the minted
 * path is the geometry as-is, so native rendering clips at the path end.
 */
export function applyTextPathEffect(
    node: PxNode,
    fx: PxTextPathEffect | undefined,
    ctx: ApplyContext,
): PxNode {
    if (!fx || typeof fx.path !== 'string' || !fx.path) return node;

    const pathId = genId(ctx, 'tpath');
    ctx.defs.push({ type: 'path', id: pathId, d: extendedPathForBrowser(fx.path, fx, node) });

    const textPath: PxNode = {
        type: 'textPath',
        href: '#' + pathId,
        children: node.children ?? [],
    };
    if (fx.lengthAdjust !== undefined) textPath.lengthAdjust = fx.lengthAdjust;
    if (fx.method !== undefined)       textPath.method = fx.method;
    if (fx.spacing !== undefined)      textPath.spacing = fx.spacing;
    applyAnimatableNumber(textPath, 'startOffset', fx.startOffset);
    applyAnimatableNumber(textPath, 'textLength',  fx.textLength);

    node.children = [textPath];
    return node;
}


/** Routes a `PxAnimatable<number>` onto a node:
 *   - bare `number` / `{value:number}` → `node[attrName] = String(value)`
 *   - `{keyframes:[…]}` → `node.animate[attrName] = { keyframes }`
 *  Mirrors the pattern in `trimPathEffect.applyAttr`. */
function applyAnimatableNumber(node: PxNode, attrName: string, raw: PxAnimatable<number> | undefined): void {
    if (raw === undefined || raw === null) return;

    if (typeof raw === 'number') {
        node[attrName] = String(raw);
        return;
    }
    if (typeof raw === 'object' && raw !== null) {
        const obj = raw as { value?: number; keyframes?: Array<unknown>; loop?: unknown };
        if (Array.isArray(obj.keyframes)) {
            const prevAnimate = node.animate && typeof node.animate === 'object' && !Array.isArray(node.animate) ? node.animate : undefined;
            const animate: Record<string, any> = { ...(prevAnimate || {}) };
            const block: { keyframes: Array<unknown>, loop?: unknown } = { keyframes: obj.keyframes };
            if (obj.loop !== undefined) block.loop = obj.loop;
            animate[attrName] = block;
            node.animate = animate;
            return;
        }
        if (typeof obj.value === 'number') {
            node[attrName] = String(obj.value);
            return;
        }
    }
}
