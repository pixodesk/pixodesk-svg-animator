/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/


/**
 * CONTENT-REF SOURCE SPLIT.
 *
 * When a `<use>` references another element with `ref:{type:'content'}` it wants
 * to render the source EXCLUDING the source's own translate (and along-path
 * positioning for auto-orient). The heavy form achieves this by materialising the
 * source as a wrapper tree
 *
 *     <g translate>            ← outer, holds translate (+ along-path/origin for autoOrient)
 *       <g rotate scale +o-o>  ← inner, holds rotate/scale (origin sandwich)
 *         <element />          ← bare shape, no transform
 *       </g>
 *     </g>
 *
 * and points the `<use>` at the INNER `<g>`. The use's reference therefore
 * renders rotate/scale around the use's position — never the source's translate.
 *
 * In the lightweight format the source is emitted as a flat element (translate
 * baked onto the body or into `effects.transformBy`). The applier's
 * `splitForContentRef` re-creates the multi-layer structure on the fly:
 *   1. extract translate parts from the source body (`transform` string,
 *      `animate.transform.keyframes` PartsRecord) and from
 *      `effects.transformBy` → outer wrapper
 *   2. keep rotate / scale (with origin sandwich) on the inner wrapper
 *   3. assign the ORIGINAL id to the outer, a fresh id to the inner
 *   4. `applyRefAndTransformationEffect` then rewrites the use's `href`
 *      to the inner id (see `ctx.contentRefInnerIds`).
 *
 * Auto-orient / motion-path: when the translate animation carries tangent
 * handles (`tangentOut`/`tangentIn`) or `autoOrient`, the path tangent produces
 * a rotation at the OUTER level — so the origin moves to the outer too, so the
 * tangent rotation pivots around it (the `[+o, t_path_ao, -o]` branch).
 *
 * "Always-split" simplicity: even when a layer would be empty (e.g. source has
 * no rotate/scale), the inner wrapper is still emitted as an identity `<g>`.
 * The use needs a stable target regardless of which transform parts the source
 * carries, and an extra empty `<g>` is render-neutral.
 */

import { applyTransformByEffect } from './transformationEffect';
import type { PxAnimatable, PxAnimationDefinition, PxKeyframe, PxNode, PxTransformByEffect, Vec2 } from '../PxAnimatorTypes';
import type { ApplyContext } from './types';
import { stripHash } from './util';


/** Walks the tree and collects every id referenced by a `<use>` with `ref:{type:'content'}`. */
export function identifyContentRefTargets(node: PxNode, ctx: ApplyContext, allocator: (key: string) => string): void {
    if (node.type === 'use' && node.effects?.clone?.type === 'content') {
        const sourceId = stripHash(node.effects.clone.sourceId);  // `#id` canonical, bare legacy (E-5)
        if (typeof sourceId === 'string' && sourceId && !ctx.contentRefInnerIds.has(sourceId)) {
            ctx.contentRefInnerIds.set(sourceId, allocator(sourceId));
        }
    }
    node.children?.forEach(c => identifyContentRefTargets(c, ctx, allocator));
}


/**
 * Splits `node` into outer-translate + inner-rest + bare element. `node` is
 * mutated in place: its body translate is moved to the outer wrapper, leaving
 * the rotate/scale parts (and the element body) inside the inner wrapper.
 *
 * Outer wrapper gets `originalId` (so `idMap` and whole-element refs still
 * resolve correctly). Inner wrapper gets `innerId` (the use's `ref:content`
 * target). The returned node is the OUTER wrapper.
 */
export function splitForContentRef(
    node: PxNode,
    transformBy: PxTransformByEffect | undefined,
    originalId: string,
    innerId: string,
    ctx: ApplyContext,
): PxNode {

    // 1. Lift translate parts off the body (`transform` string + `animate.transform`)
    //    onto a fresh outer-side bag. After this, `node` no longer carries them.
    //    `transformBy` is passed in so that when its `translate` part will go to
    //    the outer wrapper, the body's baked-in translate baseline is stripped too
    //    (otherwise it'd double-up against the outer wrapper's first keyframe).
    const outerBody = liftBodyTranslate(node, transformBy);

    // Strip the bare element's `id` — the outer wrapper takes ownership of `originalId`,
    // and the inner wrapper carries `innerId`. The element itself doesn't need either;
    // leaving it would create a duplicate of `originalId` in the materialised tree.
    if (typeof node.id === 'string') delete node.id;

    // 2. Split `effects.transformBy` between outer (translate, plus origin for
    //    auto-orient/motion-path) and inner (rotate / scale, with origin sandwich).
    const { outer: outerTr, inner: innerTr } = splitTransformByEffect(transformBy);

    // 3. Inner: apply inner transformation around the original element, then wrap
    //    in an identity `<g>` with `innerId`. The extra wrapper guarantees the use
    //    has a stable target regardless of what parts were present.
    let innerNode: PxNode = node;
    innerNode = applyTransformByEffect(innerNode, innerTr, ctx);
    const innerWrapper: PxNode = { type: 'g', id: innerId, children: [innerNode] };

    // 4. Outer: build a `<g>` carrying the lifted body translate, with `innerWrapper`
    //    as its child. Then apply outer transformation (translate). Move id to the
    //    outermost so whole-element refs still resolve to the full source.
    let outerWrapper: PxNode = { type: 'g', id: originalId, children: [innerWrapper] };
    if (outerBody.transform !== undefined) outerWrapper.transform = outerBody.transform;
    if (outerBody.animate !== undefined) outerWrapper.animate = outerBody.animate;
    if (outerTr) {
        delete outerWrapper.id;
        outerWrapper = applyTransformByEffect(outerWrapper, outerTr, ctx);
        outerWrapper.id = originalId;
    }
    return outerWrapper;
}


////////////////////////////////////////////////////////////////
//// Body lifting (transform string + animate.transform)
////////////////////////////////////////////////////////////////

interface OuterBody {
    transform?: string | { value?: any; keyframes?: Array<any> };
    animate?: { transform: any };
}

/** Removes translate parts from `node.transform` (string) and from `node.animate.transform`,
 *  returning what was extracted (to live on the outer wrapper). When either
 *  animate.transform is lifted OR `effects.transformBy.translate` will be lifted
 *  via the outer wrapper, the body `transform` translate becomes a redundant t=0
 *  baseline and is stripped from `node` (otherwise it'd compose on top of the
 *  outer's first keyframe / static translate). */
function liftBodyTranslate(node: PxNode, transformBy: PxTransformByEffect | undefined): OuterBody {
    const out: OuterBody = {};

    // 1. animate.transform — extract translate from every keyframe value.
    //    `autoOrient` and `tangentOut`/`tangentIn` are motion-path metadata that
    //    belong to translate; they go to the OUTER wrapper with translate, never
    //    to the inner one (the inner has rotate/scale only).
    let didLiftAnimate = false;
    // In-place animations on a node body are always the record form
    // (`{propName: PxPropertyAnimation}`) at this point in the pipeline —
    // narrow the `PxElementAnimation` union accordingly.
    const animTr = (node.animate as PxAnimationDefinition | undefined)?.transform;
    if (animTr && typeof animTr === 'object' && Array.isArray(animTr.keyframes)) {
        const kfs: Array<PxKeyframe<any>> = animTr.keyframes;
        const hasTranslate = kfs.some(kf => kf.value && (kf.value as any).translate);
        if (hasTranslate) {
            const outerHasOrigin = needsOriginOnOuter(animTr as PxAnimatable<Vec2>);
            const outerKfs = kfs.map(kf => {
                const v = (kf.value || {}) as any;
                const newValue: any = {};
                if (v.translate !== undefined) newValue.translate = v.translate;
                if (outerHasOrigin && v.origin !== undefined) newValue.origin = v.origin;
                const outerKf: any = { value: newValue };
                if (kf.time !== undefined) outerKf.time = kf.time;
                if (kf.easing !== undefined) outerKf.easing = kf.easing;
                if ((kf as any).tangentOut !== undefined) outerKf.tangentOut = (kf as any).tangentOut;
                if ((kf as any).tangentIn !== undefined) outerKf.tangentIn = (kf as any).tangentIn;
                return outerKf;
            });
            const outerAnimTr: any = { keyframes: outerKfs };
            if ((animTr as any).autoOrient) outerAnimTr.autoOrient = true;
            // Forward `loop` so the split outer/inner halves keep the source
            // alternate/cycle semantics; otherwise lifting a transform with
            // `loop.alternate` silently drops the loop on translate side.
            const srcLoop = (animTr as any).loop;
            if (srcLoop !== undefined) outerAnimTr.loop = srcLoop;
            out.animate = { transform: outerAnimTr };

            const innerHasPivotedPart = kfs.some(kf => {
                const v = (kf.value || {}) as any;
                return v.rotate !== undefined || v.scale !== undefined;
            });
            const innerKfs = kfs.map(kf => {
                const v = (kf.value || {}) as any;
                const newValue: any = {};
                if (v.rotate !== undefined) newValue.rotate = v.rotate;
                if (v.scale !== undefined) newValue.scale = v.scale;
                // Origin lives on inner kfs whenever rotate/scale need a pivot —
                // a separate origin sandwich at the inner layer (even when origin
                // is also on outer for the auto-orient sandwich).
                if (v.origin !== undefined && (!outerHasOrigin || innerHasPivotedPart)) newValue.origin = v.origin;
                // Inner kf intentionally drops tangentOut/tangentIn (translate-only).
                const innerKf: any = { value: newValue };
                if (kf.time !== undefined) innerKf.time = kf.time;
                if (kf.easing !== undefined) innerKf.easing = kf.easing;
                return innerKf;
            });
            const allInnerEmpty = innerKfs.every(kf => Object.keys(kf.value as object).length === 0);
            if (allInnerEmpty) {
                delete (node.animate as any).transform;
                if (node.animate && Object.keys(node.animate).length === 0) delete node.animate;
            } else {
                // Inner animate keeps non-translate kfs; autoOrient flag is intentionally dropped.
                // `loop` is forwarded so the inner rotate/scale half also alternates/cycles.
                const innerAnimTr: any = { keyframes: innerKfs };
                if (srcLoop !== undefined) innerAnimTr.loop = srcLoop;
                (node.animate as any).transform = innerAnimTr;
            }
            didLiftAnimate = true;
        }
    }

    // 2. Body `transform` — the composed STRING (pre-rendered forms / legacy /
    //    foreign SVG) or the STRUCTURED STATIC `{value: partsRecord}` (the
    //    lightweight wire since SCHEMA-DESIGN S1). `{keyframes}` bodies come
    //    from the writer's transformation-effect path and are handled via
    //    `effects.transformBy`, not here.
    const transformationHasTranslate = transformBy?.translate !== undefined;
    const stripBodyTranslateOnly = didLiftAnimate || transformationHasTranslate;
    // Autoorient / motion-path lift: when the lifted animate.transform carries
    // tangents or `autoOrient`, the body baseline is the FULL t=0 matrix
    // (translate × path-tangent rotation), not just a translate. The outer
    // wrapper recomputes both at every frame (including t=0) via the lifted
    // keyframes + autoOrient, so the body baseline is redundant and would
    // double-apply on top of it.
    const liftedAnimateIsAutoOriented = didLiftAnimate && needsOriginOnOuter((node.animate as PxAnimationDefinition | undefined)?.transform as any || undefined)
        || didLiftAnimate && needsOriginOnOuter((out.animate as PxAnimationDefinition | undefined)?.transform as any || undefined);
    if (typeof node.transform === 'string') {
        const split = splitTransformString(node.transform);
        if (stripBodyTranslateOnly) {
            // Outer wrapper will carry the translate (via animate.transform or
            // effects.transformBy); the body string is just a t=0 baseline.
            // Strip body translates so they don't double-up.
            if (split.translate !== undefined) {
                if (split.rest) node.transform = split.rest;
                else delete node.transform;
            } else if (isPureTranslateBody(node.transform)) {
                // Body is a single `matrix(...)` representing pure translate — same
                // redundancy as a `translate(...)` string. Wipe.
                delete node.transform;
            } else if (liftedAnimateIsAutoOriented && isSingleMatrixBody(node.transform)) {
                // Body is a non-pure `matrix(…)` — the autoOrient-materialised t=0
                // value baked by the writer. The outer wrapper reproduces it via
                // `animate.transform` + `autoOrient`; wipe to avoid double-apply.
                delete node.transform;
            }
        } else if (split.translate) {
            out.transform = split.translate;
            if (split.rest) node.transform = split.rest;
            else delete node.transform;
        }
    } else if (node.transform && typeof node.transform === 'object' && !Array.isArray(node.transform)
               && !(node.transform as any).keyframes) {
        // STATIC RECORD — bare `{translate, …}` (canonical) or the legacy
        // `{value: {…}}` wrapper; the rewrite keeps the incoming spelling.
        const wrapped = (node.transform as { value?: Record<string, unknown> }).value;
        const isWrapped = !!(wrapped && typeof wrapped === 'object');
        const value = (isWrapped ? wrapped : node.transform) as Record<string, unknown>;
        const rewrap = (rec: Record<string, unknown>) => (isWrapped ? { value: rec } : rec) as any;
        if (Array.isArray((value as any).translate)) {
            const rest: Record<string, unknown> = { ...value };
            delete rest.translate;
            const hasRest = Object.keys(rest).length > 0;
            if (stripBodyTranslateOnly) {
                // Same redundancy rule as the string branch: the outer wrapper
                // carries the translate; drop the body's copy.
                if (hasRest) node.transform = rewrap(rest);
                else delete node.transform;
            } else {
                out.transform = rewrap({ translate: (value as any).translate });
                if (hasRest) node.transform = rewrap(rest);
                else delete node.transform;
            }
        }
    }

    return out;
}

/** True when the body string is a single `matrix(...)` op (any 6-arg matrix —
 *  pure-translate is a more specific case handled by `isPureTranslateBody`). */
function isSingleMatrixBody(s: string): boolean {
    const re = /(translate|rotate|scale|matrix|skewX|skewY)\(([^)]*)\)/g;
    let count = 0;
    let isMatrix = false;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s))) {
        count++;
        if (m[1] === 'matrix') isMatrix = true;
    }
    return count === 1 && isMatrix;
}

/** True when the body transform is a single op equivalent to pure translate
 *  (either `translate(...)` or a `matrix(1,0,0,1,e,f)`). Used to decide whether
 *  to wipe the body when `animate.transform.translate` has already been lifted. */
function isPureTranslateBody(s: string): boolean {
    const re = /(translate|rotate|scale|matrix|skewX|skewY)\(([^)]*)\)/g;
    const ops: Array<{ name: string; full: string }> = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(s))) ops.push({ name: m[1], full: m[0] });
    if (ops.length !== 1) return false;
    if (ops[0].name === 'translate') return true;
    if (ops[0].name !== 'matrix') return false;
    const args = /matrix\(([^)]*)\)/.exec(ops[0].full);
    if (!args) return false;
    const nums = args[1].split(/[\s,]+/).filter(Boolean).map(Number);
    return nums.length >= 4 && nums[0] === 1 && nums[1] === 0 && nums[2] === 0 && nums[3] === 1;
}

/**
 * Body-string lift heuristic. The body `transform=""` is the t=0 baseline that
 * the WRITER bakes in the canonical order `translate · +origin · rotate · scale · -origin`.
 *
 * Lift LEADING `translate(...)` ops ONLY when the string does NOT end with a
 * `translate(...)`. A trailing translate is the `-origin` half of an origin
 * sandwich — leaving any translate inside the sandwich would break the pivot,
 * so we leave the whole body alone in that case (the corresponding
 * `effects.transformBy` is the structured source we lift from instead).
 *
 * (`matrix(...)` and `skewX/Y` are not lifted — they don't carry "user
 * translate" semantics. If the leading op isn't `translate`, nothing is lifted.)
 */
function splitTransformString(s: string): { translate?: string; rest?: string } {
    const ops: Array<{ name: string; full: string }> = [];
    const re = /(translate|rotate|scale|matrix|skewX|skewY)\(([^)]*)\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s))) ops.push({ name: m[1], full: m[0] });

    if (!ops.length) return { rest: s || undefined };

    // All-translate string — no origin-sandwich without rotate/scale in the
    // middle. Lift everything.
    if (ops.every(o => o.name === 'translate')) {
        return { translate: ops.map(o => o.full).join('') };
    }

    const leading = ops[0];
    const trailing = ops[ops.length - 1];

    // Origin sandwich: writer's canonical order is `translate · +origin ·
    // rotate · scale · -origin`, with `translate + +origin` typically FUSED
    // into one leading translate. We can recover the user-translate by reading
    // the trailing `-origin` value and subtracting `+origin` from the leading.
    if (trailing.name === 'translate' && leading.name === 'translate') {
        const trailingVec = parseTranslateArgs(trailing.full);
        const leadingVec = parseTranslateArgs(leading.full);
        const ox = -trailingVec[0];   // -origin → +origin
        const oy = -trailingVec[1];
        const userTx = leadingVec[0] - ox;
        const userTy = leadingVec[1] - oy;

        // Pure origin sandwich (user-translate cancels to 0) — leave the body alone.
        if (userTx === 0 && userTy === 0) return { rest: s };

        // Replace the leading translate with the bare `+origin` (=ox,oy), keep
        // the rest of the sandwich unchanged, and lift `translate(userT)`.
        const middleAndTrailing = 'translate(' + ox + ',' + oy + ')' + ops.slice(1).map(o => o.full).join('');
        return { translate: 'translate(' + userTx + ',' + userTy + ')', rest: middleAndTrailing };
    }

    // Trailing translate without a matching leading translate — unusual. Be
    // conservative and don't lift.
    if (trailing.name === 'translate') return { rest: s };

    // No trailing translate → no origin sandwich; lift all leading translates.
    const lifted: Array<string> = [];
    let i = 0;
    while (i < ops.length && ops[i].name === 'translate') {
        lifted.push(ops[i].full);
        i++;
    }
    if (!lifted.length) return { rest: s };

    const rest = ops.slice(i).map(o => o.full).join('');
    return {
        translate: lifted.join(''),
        rest: rest || undefined,
    };
}

function parseTranslateArgs(translateOp: string): [number, number] {
    const m = /translate\(([^)]*)\)/.exec(translateOp);
    if (!m) return [0, 0];
    const nums = m[1].split(/[\s,]+/).filter(Boolean).map(Number);
    return [nums[0] || 0, nums[1] || 0];
}


////////////////////////////////////////////////////////////////
//// effects.transformBy split
////////////////////////////////////////////////////////////////

function splitTransformByEffect(fx: PxTransformByEffect | undefined): {
    outer?: PxTransformByEffect;
    inner?: PxTransformByEffect;
} {
    if (!fx) return {};
    const originOnOuter = needsOriginOnOuter(fx.translate);
    const innerHasPivotedPart = fx.rotate !== undefined || fx.scale !== undefined;

    const outer: PxTransformByEffect = {};
    const inner: PxTransformByEffect = {};

    if (fx.translate !== undefined) outer.translate = fx.translate;
    // Origin lives on outer when translate carries auto-orient (so the
    // path-tangent rotation pivots around origin too).
    if (originOnOuter && fx.origin !== undefined) outer.origin = fx.origin;

    if (fx.rotate !== undefined) inner.rotate = fx.rotate;
    if (fx.scale !== undefined) inner.scale = fx.scale;
    if (fx.skew !== undefined) inner.skew = fx.skew;
    // Origin also lives on inner whenever rotate/scale need a pivot — duplicate
    // origin across outer + inner is fine: two separate origin sandwiches
    // ([+o, t, -o] outer + [+o, r, s, -o] inner).
    if (fx.origin !== undefined && (!originOnOuter || innerHasPivotedPart)) inner.origin = fx.origin;

    return {
        outer: Object.keys(outer).length ? outer : undefined,
        inner: Object.keys(inner).length ? inner : undefined,
    };
}


////////////////////////////////////////////////////////////////
//// Auto-orient / motion-path detection
////////////////////////////////////////////////////////////////

/** True when the translate animation produces rotation at the outer level
 *  (tangent handles or `autoOrient`) — meaning origin must sit on the outer
 *  with translate so the path-tangent rotation pivots around it. */
function needsOriginOnOuter(translateAnim: PxAnimatable<Vec2> | undefined): boolean {
    if (!translateAnim || typeof translateAnim !== 'object') return false;
    const obj = translateAnim as { autoOrient?: boolean; keyframes?: Array<PxKeyframe<Vec2> & { tangentOut?: Vec2; tangentIn?: Vec2 }> };
    if (obj.autoOrient) return true;
    if (Array.isArray(obj.keyframes)) {
        return obj.keyframes.some(kf => kf.tangentOut || kf.tangentIn);
    }
    return false;
}
