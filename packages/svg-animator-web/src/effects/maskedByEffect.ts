/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/


import type { PxAnimatable, PxMaskedByEffect, PxNode, PxTransformationEffect, Vec2 } from '../PxAnimatorTypes';
import { keyframeWith, partsRecord, ReadKind, readAnimatable, readStaticOrigin, TransformPart } from './transformParts';
import type { ApplyContext, MaskAncestorTransform } from './types';
import { genId } from './util';


/**
 * MASKED-BY → a `<mask>` in defs holding the source `<use>` wrapped in
 *   (forward of mask source's ancestors) · (inverse of masked element's full
 *    transform chain) · (inverse of masked element's own `effects.transformation`)
 *
 * The mask source must paint at its ORIGINAL world position, but
 * `maskUnits="userSpaceOnUse"` (default) interprets the mask in the masked
 * element's local coord system. The wrapper sequence above first cancels
 * out the masked element's accumulated ancestor / own transforms, then
 * re-applies the mask source's ancestor transforms so the `<use>` ends up
 * at the same world matrix it would have if rendered in place.
 *
 * Mirrors the editor's `TSvgMaskEffectAttr.writeAttrsToMainElementAndRender`
 * (pathToThis + pathToMask) — see `app/.../containers/TSvgMaskEffectAttr.tsx`.
 *
 * Implementation note — this first cut only composes TRANSLATE parts (static
 * and animated). Rotate / scale on the ancestor chains aren't supported yet
 * and will warn if present. Editor-side `effects.transformation` on the
 * masked element keeps working (passed in as `transformation` and inverted
 * separately).
 */
export function applyMaskedByEffect(
    node: PxNode,
    fx: PxMaskedByEffect | undefined,
    transformation: PxTransformationEffect | undefined,
    ctx: ApplyContext,
): PxNode {
    if (!fx) return node;
    if (!fx.href) { ctx.errors.push('maskedBy.href missing — cannot build mask'); return node; }

    const maskId = genId(ctx, 'mask');

    let content: PxNode = { type: 'use', href: '#' + fx.href };
    // `effects.transformation` (split-timing form) gets full per-part inversion
    // through `wrapInverseTransform`. With no `effects.transformation` the
    // masked element's transform lives on the body — invert the STATIC part
    // (`node.transform` string) via the same per-part machinery, then on top
    // emit an animated inverse wrapper for `node.animate.transform.keyframes`
    // (per-kf parts-record inversion). Either way, the ancestor-chain
    // compensation runs on top with translate-only composition for now.
    if (transformation) {
        content = wrapInverseTransform(content, transformation, ctx);
    } else if (hasAnimateTransform(node)) {
        // `animate.transform` overrides `node.transform` per-frame in the
        // visualModel, so inverting BOTH would double-count. Animated wins.
        content = wrapInverseAnimatedBodyTransform(content, node, ctx);
    } else {
        const bodyStatic = readTransformationFromBody(node);
        if (bodyStatic) content = wrapInverseTransform(content, bodyStatic, ctx);
    }
    // Skip `targetOwn` translate when we already inverted the body (otherwise
    // the translate would be subtracted twice).
    const includeTargetOwn = transformation === undefined && !nodeHasBodyTransform(node);
    content = wrapAncestorChainCompensation(content, node, fx.href, ctx, includeTargetOwn);

    const mask: PxNode = { type: 'mask', id: maskId, children: [content] };
    if (fx.maskType) mask.maskType = fx.maskType;
    if (fx.maskUnits) mask.maskUnits = fx.maskUnits;
    if (fx.maskContentUnits) mask.maskContentUnits = fx.maskContentUnits;
    ctx.defs.push(mask);

    node.mask = 'url(#' + maskId + ')';
    return node;
}

/** Wraps `inner` in inverse-transform `<g>`s built from the masked element's
 *  own `effects.transformation` payload (translate / rotate / scale). The
 *  ancestor-chain wrappers are added separately by
 *  `wrapAncestorChainCompensation`. */
function wrapInverseTransform(inner: PxNode, fx: PxTransformationEffect | undefined, ctx: ApplyContext): PxNode {
    if (!fx) return inner;
    const origin = readStaticOrigin(fx.origin, ctx);

    let n = inner;
    n = wrapInversePart(n, TransformPart.Translate, fx.translate, undefined, ctx);
    n = wrapInversePart(n, TransformPart.Rotate, fx.rotate, origin, ctx);
    n = wrapInversePart(n, TransformPart.Scale, fx.scale, origin, ctx);
    return n;
}

function wrapInversePart(
    inner: PxNode, part: TransformPart,
    raw: PxAnimatable<any> | undefined, origin: Vec2 | undefined, ctx: ApplyContext
): PxNode {
    if (raw === undefined) return inner;
    // `fx.scale` in BARE-ARRAY form is PERCENT (150 = 1.5×), matching
    // `applyTransformationEffect`'s forward `normalizeScale`. Convert to
    // 1.0-units before reading, so `invertPartValue([1.5,1.5])` produces
    // the right `[2/3, 2/3]` instead of `[1/150, 1/150]`. Keyframe / {value}
    // forms already use 1.0-units per the wire convention.
    const normalisedRaw: PxAnimatable<any> | undefined = (part === TransformPart.Scale && Array.isArray(raw))
        ? [raw[0] / 100, raw[1] / 100] as unknown as PxAnimatable<any>
        : raw;
    const v = readAnimatable<any>(normalisedRaw);
    if (v.kind === ReadKind.Static) {
        return { type: 'g', transform: { value: partsRecord(part, invertPartValue(part, v.value), origin) }, children: [inner] };
    }
    if (v.kind === ReadKind.Animated) {
        return {
            type: 'g',
            animate: { transform: { keyframes: v.keyframes.map(kf => keyframeWith(kf, partsRecord(part, invertPartValue(part, kf.value), origin))) } },
            children: [inner],
        };
    }
    return inner;
}

function invertPartValue(part: TransformPart, value: any): any {
    if (part === TransformPart.Translate) return [-value[0], -value[1]];
    if (part === TransformPart.Rotate) return -value;
    return [1 / value[0], 1 / value[1]];   // scale
}


/**
 * Wraps `inner` with the per-part INVERSE of the masked element's
 * `node.animate.transform.keyframes` records. Each kf carries a parts record
 * `{translate?, rotate?, scale?, origin?}` with matrix
 * `T(t)·T(o)·R·S·T(-o)`. The matrix inverse is
 * `T(o)·S^-1·R^-1·T(-o)·T(-t)` — which can't be expressed as ONE parts
 * record when both rotate and scale are present (S would have to precede R).
 *
 * Split into separate per-part wrappers, layered from innermost (translate)
 * outwards (rotate, then scale), so the overall composition matches the
 * matrix-level inverse:
 *
 *     <g scale^-1> <g rotate^-1> <g translate^-1> {use} </g></g></g>
 *
 * Each wrapper carries an animated parts record over the input kf times.
 * The `origin` for rotate / scale wrappers comes from each kf (the editor
 * emits it alongside whenever rotate or scale is present), so an animated
 * origin sandwich pivots correctly per frame.
 */
function wrapInverseAnimatedBodyTransform(inner: PxNode, node: PxNode, _ctx: ApplyContext): PxNode {
    const animate = node.animate && typeof node.animate === 'object' && !Array.isArray(node.animate)
        ? (node.animate as Record<string, any>) : undefined;
    const animTr = animate?.transform;
    const kfs = animTr && typeof animTr === 'object' && Array.isArray((animTr as Record<string, any>).keyframes)
        ? ((animTr as Record<string, any>).keyframes as Array<Record<string, any>>)
        : undefined;
    if (!kfs || !kfs.length) return inner;

    const translateKfs: Array<Record<string, any>> = [];
    const rotateKfs: Array<Record<string, any>> = [];
    const scaleKfs: Array<Record<string, any>> = [];

    for (const kf of kfs) {
        const v = (kf.value ?? kf.v) || {};
        const baseKf = keyframeWith(kf as any, undefined);   // copies time / easing / tangents
        if (Array.isArray(v.translate)) {
            translateKfs.push({ ...baseKf, value: { translate: [-v.translate[0], -v.translate[1]] } });
        }
        if (typeof v.rotate === 'number') {
            const rec: Record<string, any> = { rotate: -v.rotate };
            if (Array.isArray(v.origin)) rec.origin = [v.origin[0], v.origin[1]];
            rotateKfs.push({ ...baseKf, value: rec });
        }
        if (Array.isArray(v.scale)) {
            const rec: Record<string, any> = { scale: [1 / v.scale[0], 1 / v.scale[1]] };
            if (Array.isArray(v.origin)) rec.origin = [v.origin[0], v.origin[1]];
            scaleKfs.push({ ...baseKf, value: rec });
        }
    }

    let n = inner;
    // Innermost = translate (matches `wrapInverseTransform`'s order).
    if (translateKfs.length) n = { type: 'g', animate: { transform: { keyframes: translateKfs } }, children: [n] };
    if (rotateKfs.length)    n = { type: 'g', animate: { transform: { keyframes: rotateKfs    } }, children: [n] };
    if (scaleKfs.length)     n = { type: 'g', animate: { transform: { keyframes: scaleKfs     } }, children: [n] };
    return n;
}


/** True when the node carries any body-side transform (the static `transform`
 *  string OR an `animate.transform` block). */
function nodeHasBodyTransform(node: PxNode): boolean {
    if (typeof node.transform === 'string') return true;
    if (node.transform && typeof node.transform === 'object') return true;
    return hasAnimateTransform(node);
}

/** True when the node carries an `animate.transform` block (per-frame
 *  override of `node.transform`). */
function hasAnimateTransform(node: PxNode): boolean {
    const animate = node.animate && typeof node.animate === 'object' && !Array.isArray(node.animate)
        ? (node.animate as Record<string, any>) : undefined;
    return !!(animate && animate.transform);
}

/** Parses the masked element's body transform (`node.transform` string) into a
 *  `PxTransformationEffect`-like static parts record so the existing
 *  `wrapInverseTransform` machinery can produce its inverse `<g>` wrappers.
 *
 *  ANIMATED body transforms (`node.animate.transform.keyframes`) aren't
 *  supported yet — they'd require splitting a parts-record keyframe stream
 *  into per-part animations to feed into `wrapInversePart`. Falls back with a
 *  warning. (In practice the editor's writer emits `effects.transformation`
 *  whenever the masked element is animated, so this caller path is reached
 *  only for static cases anyway.) */
function readTransformationFromBody(node: PxNode): PxTransformationEffect | undefined {
    if (typeof node.transform === 'string') {
        const parts = parseTransformStringToParts(node.transform);
        if (!parts) return undefined;
        const out: PxTransformationEffect = {};
        if (parts.translate) out.translate = parts.translate;
        if (parts.rotate !== undefined) out.rotate = parts.rotate;
        // Scale parsed from the string is in 1.0-units (e.g. `scale(1.5)`).
        // Pass it through the `{value}` form so `wrapInversePart`'s
        // bare-array → percent normalisation doesn't re-divide by 100.
        if (parts.scale) out.scale = { value: parts.scale };
        if (parts.origin) out.origin = parts.origin;
        return Object.keys(out).length ? out : undefined;
    }
    return undefined;
}

/** Parses the editor's canonical body-transform string — the exact form
 *  emitted by `composeTransformParts`:
 *      `translate(t)? translate(o)? rotate? scale? translate(-o)?`
 *  — back into a `PxTransformParts`-style record. The origin sandwich
 *  (`translate(o) … translate(-o)`) is recovered as `origin: o`; the leading
 *  translate (if any) becomes `translate: t`. Returns `undefined` when no
 *  recognised ops are found. */
function parseTransformStringToParts(s: string): { translate?: Vec2; rotate?: number; scale?: Vec2; origin?: Vec2 } | undefined {
    interface Op { name: string; args: Array<number>; }
    const re = /([a-zA-Z]+)\s*\(([^)]*)\)/g;
    let m: RegExpExecArray | null;
    const ops: Array<Op> = [];
    while ((m = re.exec(s)) !== null) {
        const args = m[2].split(/[\s,]+/).filter(a => a.length > 0).map(Number);
        ops.push({ name: m[1], args });
    }
    if (!ops.length) return undefined;

    // Detect origin sandwich: a trailing `translate(-ox,-oy)` matching an
    // earlier `translate(+ox,+oy)`. Recover origin / inner rotate / scale.
    const last = ops[ops.length - 1];
    if (last.name === 'translate') {
        for (let j = ops.length - 2; j >= 0; j--) {
            const cand = ops[j];
            if (cand.name !== 'translate') continue;
            const ox = cand.args[0] ?? 0;
            const oy = cand.args[1] ?? 0;
            const lx = last.args[0] ?? 0;
            const ly = last.args[1] ?? 0;
            if (lx !== -ox || ly !== -oy) continue;
            // `cand` = +origin, `last` = −origin. Anything BEFORE `cand` may
            // be a body translate; anything BETWEEN them is rotate / scale.
            const out: { translate?: Vec2; rotate?: number; scale?: Vec2; origin?: Vec2 } = {};
            out.origin = [ox, oy];
            for (let k = 0; k < j; k++) {
                if (ops[k].name === 'translate') {
                    const tx = ops[k].args[0] ?? 0;
                    const ty = ops[k].args[1] ?? 0;
                    out.translate = out.translate ? [out.translate[0] + tx, out.translate[1] + ty] : [tx, ty];
                }
            }
            for (let k = j + 1; k < ops.length - 1; k++) {
                const op = ops[k];
                if (op.name === 'rotate') out.rotate = (out.rotate ?? 0) + (op.args[0] ?? 0);
                else if (op.name === 'scale') {
                    const sx = op.args[0] ?? 1;
                    const sy = op.args.length > 1 ? op.args[1] : sx;
                    out.scale = out.scale ? [out.scale[0] * sx, out.scale[1] * sy] : [sx, sy];
                }
            }
            return out;
        }
    }

    // No sandwich — flat sequence. `translate`s sum, `rotate`s sum, `scale`s
    // multiply. Order isn't preserved but it works for the cases the editor
    // emits without origin (translates commute; only one rotate or scale).
    let translate: Vec2 | undefined;
    let rotate: number | undefined;
    let scale: Vec2 | undefined;
    for (const op of ops) {
        if (op.name === 'translate') {
            const dx = op.args[0] ?? 0;
            const dy = op.args[1] ?? 0;
            translate = translate ? [translate[0] + dx, translate[1] + dy] : [dx, dy];
        } else if (op.name === 'rotate') {
            rotate = (rotate ?? 0) + (op.args[0] ?? 0);
        } else if (op.name === 'scale') {
            const sx = op.args[0] ?? 1;
            const sy = op.args.length > 1 ? op.args[1] : sx;
            scale = scale ? [scale[0] * sx, scale[1] * sy] : [sx, sy];
        }
    }
    const out: { translate?: Vec2; rotate?: number; scale?: Vec2 } = {};
    if (translate) out.translate = translate;
    if (rotate !== undefined) out.rotate = rotate;
    if (scale) out.scale = scale;
    return Object.keys(out).length ? out : undefined;
}


// ─────────────────────────────────────────────────────────────────────────────
//  Ancestor-chain compensation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wraps `inner` in a single `<g>` that carries
 *   translate = sum(maskSource.ancestors) − sum(maskedElement.ancestors)
 * (separately for the static baseline + every keyframe time observed on any
 *  animated ancestor in either chain).
 *
 * Translations commute, so a single wrapper suffices for the translate-only
 * case. When any chain entry has a non-translate part, this function emits a
 * warning and falls back to translate-only — visually wrong but a graceful
 * degradation until the rotate/scale composition is implemented.
 */
function wrapAncestorChainCompensation(inner: PxNode, maskedNode: PxNode, sourceId: string, ctx: ApplyContext, includeTargetOwn: boolean): PxNode {
    const sourceNode = ctx.idMap.get(sourceId);

    // M_target = (ancestors) · (target's own). When `effects.transformation`
    // is present, `wrapInverseTransform` already covers target's own; pass
    // `includeTargetOwn=false` to skip the duplicate. With no `effects.
    // transformation`, the baseline `node.transform` string is the element's
    // only transform — include it.
    const targetAncestors = ctx.maskAncestorChains.get(maskedNode) || [];
    const targetOwn = includeTargetOwn ? extractTranslateOnly(maskedNode, ctx) : undefined;
    const targetChain = targetOwn ? [...targetAncestors, targetOwn] : targetAncestors;
    const sourceChain = (sourceNode && ctx.maskAncestorChains.get(sourceNode)) || [];

    if (!targetChain.length && !sourceChain.length) return inner;

    // Union of all keyframe times across both chains. Static-only chains end
    // up with `times = []`, which short-circuits below to a static wrapper.
    const times = new Set<number>();
    for (const a of targetChain) if (a.translateKeyframes) for (const kf of a.translateKeyframes) times.add(kf.time);
    for (const a of sourceChain) if (a.translateKeyframes) for (const kf of a.translateKeyframes) times.add(kf.time);
    const animated = times.size > 0;

    if (!animated) {
        const tgt = sumStaticTranslate(targetChain);
        const src = sumStaticTranslate(sourceChain);
        const dx = src[0] - tgt[0];
        const dy = src[1] - tgt[1];
        if (dx === 0 && dy === 0) return inner;
        return { type: 'g', transform: 'translate(' + dx + ',' + dy + ')', children: [inner] };
    }

    const sortedTimes = Array.from(times).sort((a, b) => a - b);
    const keyframes = sortedTimes.map(t => {
        const tgt = sumTranslateAt(targetChain, t);
        const src = sumTranslateAt(sourceChain, t);
        return { time: t, value: { translate: [src[0] - tgt[0], src[1] - tgt[1]] as [number, number] } };
    });
    return { type: 'g', animate: { transform: { keyframes } }, children: [inner] };
}

/** Sums every translate (baseline) entry in the chain. Ignores animated kfs. */
function sumStaticTranslate(chain: Array<MaskAncestorTransform>): [number, number] {
    let x = 0, y = 0;
    for (const a of chain) {
        if (a.translate) { x += a.translate[0]; y += a.translate[1]; }
    }
    return [x, y];
}

/** Sums every translate at time `t` in the chain. Animated entries are sampled
 *  via linear interpolation between their kfs; static entries contribute their
 *  baseline. */
function sumTranslateAt(chain: Array<MaskAncestorTransform>, t: number): [number, number] {
    let x = 0, y = 0;
    for (const a of chain) {
        if (a.translateKeyframes && a.translateKeyframes.length) {
            const v = interpKfs(a.translateKeyframes, t);
            x += v[0]; y += v[1];
        } else if (a.translate) {
            x += a.translate[0]; y += a.translate[1];
        }
    }
    return [x, y];
}

function interpKfs(kfs: Array<{ time: number; value: [number, number] }>, t: number): [number, number] {
    if (t <= kfs[0].time) return kfs[0].value;
    if (t >= kfs[kfs.length - 1].time) return kfs[kfs.length - 1].value;
    for (let i = 1; i < kfs.length; i++) {
        if (t <= kfs[i].time) {
            const prev = kfs[i - 1];
            const cur = kfs[i];
            const a = (t - prev.time) / (cur.time - prev.time);
            return [prev.value[0] + (cur.value[0] - prev.value[0]) * a, prev.value[1] + (cur.value[1] - prev.value[1]) * a];
        }
    }
    return kfs[kfs.length - 1].value;
}


// ─────────────────────────────────────────────────────────────────────────────
//  Pre-pass: walk tree, record ancestor chains for every (target, source) pair
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Walks `root` top-down and records — for every element involved in an
 * `effects.maskedBy` pair (the masked element AND the mask source it
 * references) — the chain of translate transforms on its `<g>` ancestors.
 * Results land in `ctx.maskAncestorChains`.
 *
 * The walk runs BEFORE pass 1 so it sees the untouched lightweight tree:
 * ancestor `<g transform="...">` strings + `animate.transform` kfs are still
 * intact and easy to parse.
 */
export function collectMaskAncestorChains(root: PxNode, ctx: ApplyContext): void {
    // Two-pass: first find the actual NODE references that are masked elements
    // or mask source elements (the source via idMap, the masked element by
    // walking the tree). Then on a second walk, store ancestor chains for
    // those nodes.
    const interestingNodes = new Set<PxNode>();
    const collectInterestingNodes = (n: PxNode): void => {
        const href = n.effects?.maskedBy?.href;
        if (typeof href === 'string') {
            interestingNodes.add(n);                          // masked element
            const sourceNode = ctx.idMap.get(href);
            if (sourceNode) interestingNodes.add(sourceNode); // mask source
        }
        if (Array.isArray(n.children)) for (const ch of n.children) collectInterestingNodes(ch);
    };
    collectInterestingNodes(root);
    if (interestingNodes.size === 0) return;

    const walk = (node: PxNode, chain: Array<MaskAncestorTransform>): void => {
        if (interestingNodes.has(node)) ctx.maskAncestorChains.set(node, chain);
        if (Array.isArray(node.children)) {
            const own = extractTranslateOnly(node, ctx);
            const next = own ? [...chain, own] : chain;
            for (const ch of node.children) walk(ch, next);
        }
    };
    walk(root, []);
}

/** Extracts only the TRANSLATE part from a node's `transform` + `animate.transform`.
 *  Returns `undefined` when the node has no transform OR carries only
 *  non-translate parts. Pushes a warning when a non-translate part is dropped. */
function extractTranslateOnly(node: PxNode, ctx: ApplyContext): MaskAncestorTransform | undefined {
    const tr = node.transform;
    const animateBlock = node.animate && typeof node.animate === 'object' && !Array.isArray(node.animate)
        ? (node.animate as Record<string, any>).transform : undefined;
    if (tr === undefined && !animateBlock) return undefined;

    const out: MaskAncestorTransform = {};

    if (typeof tr === 'string') {
        const parts = parseTranslateOnlyFromString(tr, ctx);
        if (parts) out.translate = parts;
    } else if (tr && typeof tr === 'object') {
        const value = (tr as Record<string, any>).value;
        if (value && typeof value === 'object' && Array.isArray(value.translate)) {
            out.translate = [value.translate[0] || 0, value.translate[1] || 0];
        }
        if (value && (value.rotate !== undefined || value.scale !== undefined || value.skew !== undefined)) {
            ctx.warnings.push('maskedBy ancestor: non-translate transform parts ignored (rotate/scale not yet supported)');
        }
    }

    if (animateBlock && Array.isArray((animateBlock as Record<string, any>).keyframes)) {
        const kfs = (animateBlock as Record<string, any>).keyframes as Array<Record<string, any>>;
        const translateKfs: Array<{ time: number; value: [number, number] }> = [];
        for (const kf of kfs) {
            const v = kf.value ?? kf.v;
            const t = (kf.time ?? kf.t ?? 0) as number;
            if (v && typeof v === 'object' && Array.isArray(v.translate)) {
                translateKfs.push({ time: t, value: [v.translate[0] || 0, v.translate[1] || 0] });
                if (v.rotate !== undefined || v.scale !== undefined || v.skew !== undefined) {
                    ctx.warnings.push('maskedBy ancestor: animated non-translate parts ignored');
                }
            }
        }
        if (translateKfs.length) out.translateKeyframes = translateKfs;
    }

    return (out.translate || out.translateKeyframes) ? out : undefined;
}

/** Parses ONLY `translate(x[, y])` ops out of an SVG transform string, summing
 *  multiple translates and ignoring anything else (with a one-shot warning).
 *  The lightweight writer emits the masked / source ancestors' transforms as
 *  these simple strings, so this stays a tiny single-purpose parser. */
function parseTranslateOnlyFromString(s: string, ctx: ApplyContext): [number, number] | undefined {
    const re = /([a-zA-Z]+)\s*\(([^)]*)\)/g;
    let m: RegExpExecArray | null;
    let x = 0, y = 0;
    let seen = false;
    let droppedNonTranslate = false;
    while ((m = re.exec(s)) !== null) {
        const name = m[1];
        const args = m[2].split(/[\s,]+/).filter(a => a.length > 0).map(Number);
        if (name === 'translate') {
            x += args[0] || 0;
            y += args[1] || 0;
            seen = true;
        } else {
            droppedNonTranslate = true;
        }
    }
    if (droppedNonTranslate) ctx.warnings.push('maskedBy ancestor: non-translate transform in string ignored: ' + s);
    return seen ? [x, y] : undefined;
}
