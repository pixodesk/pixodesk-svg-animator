// @px-area keyframes
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

/**
 * COMPILED → AUTHORED — the format's low layer read back as the authored form that plays the same:
 * explicit keyframes, colours as `rgb()` / `rgba()` strings, paths as `{ pathData }`, a unit written
 * back onto its numbers. For a reader that edits (the editor never writes the compiled form). A loop or
 * a named easing is not recovered — the compiled keyframes are already explicit.
 */

import { PxValueKind } from '../format/PxAnimatorConstants';
import { PxDocumentSchema, PxAnimatorConfigSchema, PxCompiledAnimationSchema, PxDefinitionsSchema, type PxCompiledAnimation, type PxCompiledKeyframe, type PxKeyframe, type PxKeyframeValue, type PxPropertyAnimation } from '../format/PxAnimatorTypes';
import { isRecord, schemaKeys } from '../schema/PxSchema';
import { bezierToSvgPath, toRGBA } from '../util/PxAnimatorUtil';

const DOC = schemaKeys(PxDocumentSchema);
const ANIMATOR = schemaKeys(PxAnimatorConfigSchema);
const DEFS = schemaKeys(PxDefinitionsSchema);

/** One authored keyframe: the compiled one's time, easing and tangents, with its value as written. */
function authoredKeyframe<V>(kf: PxCompiledKeyframe<V>, value: PxKeyframeValue): PxKeyframe<PxKeyframeValue> {
    const out: PxKeyframe<PxKeyframeValue> = { time: kf.time, value };
    if (kf.easing) out.easing = kf.easing;
    if (kf.tangentIn) out.tangentIn = kf.tangentIn;
    if (kf.tangentOut) out.tangentOut = kf.tangentOut;
    return out;
}

/** A compiled animation → the authored form that plays the same. @internal */
export function toAuthoredAnimation(anim: PxCompiledAnimation): PxPropertyAnimation {
    switch (anim.kind) {
        case PxValueKind.number: {
            const unit = anim.unit;
            return { keyframes: anim.keyframes.map(kf => authoredKeyframe(kf, unit ? kf.value + unit : kf.value)) };
        }
        case PxValueKind.color:
            return { keyframes: anim.keyframes.map(kf => authoredKeyframe(kf, toRGBA(kf.value))) };
        case PxValueKind.path:
            return { keyframes: anim.keyframes.map(kf => authoredKeyframe(kf, { pathData: kf.value.paths.map(p => bezierToSvgPath(p)).join('') })) };
        case PxValueKind.transform: {
            const out: PxPropertyAnimation = { keyframes: anim.keyframes.map(kf => authoredKeyframe(kf, kf.value)) };
            if (anim.autoOrient) out.autoOrient = true;
            return out;
        }
        case PxValueKind.percent: case PxValueKind.rotate: case PxValueKind.skew:
            return { keyframes: anim.keyframes.map(kf => authoredKeyframe(kf, kf.value)) };
        case PxValueKind.numberList: case PxValueKind.translate: case PxValueKind.scale:
            return { keyframes: anim.keyframes.map(kf => authoredKeyframe(kf, kf.value)) };
        case PxValueKind.discrete:
            return { keyframes: anim.keyframes.map(kf => authoredKeyframe(kf, kf.value)) };
    }
}

/** `items` mapped by `fn` — the same array when no item changed. */
function mapSame(items: ReadonlyArray<unknown>, fn: (item: unknown) => unknown): ReadonlyArray<unknown> {
    const out = items.map(fn);
    return out.some((item, i) => item !== items[i]) ? out : items;
}

/** One definition (`{ property: entry }`) with its compiled entries authored — the same object when it has none. */
function authorDefinition(def: unknown): unknown {
    if (!isRecord(def)) return def;
    let out: Record<string, unknown> | undefined;
    for (const [property, entry] of Object.entries(def)) {
        const compiled = PxCompiledAnimationSchema.castOrNull(entry);
        if (!compiled) continue;
        out ??= { ...def };
        out[property] = toAuthoredAnimation(compiled);
    }
    return out ?? def;
}

/** A node and its subtree, `animate` authored (a definition, or an array of names and definitions). */
function authorNode(node: unknown): unknown {
    if (!isRecord(node)) return node;
    const animate = node[DOC.animate];
    const children = node[DOC.children];
    const newAnimate = Array.isArray(animate) ? mapSame(animate, authorDefinition) : authorDefinition(animate);
    const newChildren = Array.isArray(children) ? mapSame(children, authorNode) : children;
    if (newAnimate === animate && newChildren === children) return node;
    const out: Record<string, unknown> = { ...node };
    if (newAnimate !== animate) out[DOC.animate] = newAnimate;
    if (newChildren !== children) out[DOC.children] = newChildren;
    return out;
}

/** An animator block with `definitions.animations` authored. */
function authorAnimator(animator: unknown): unknown {
    if (!isRecord(animator)) return animator;
    const defs = animator[ANIMATOR.definitions];
    const animations = isRecord(defs) ? defs[DEFS.animations] : undefined;
    if (!isRecord(defs) || !isRecord(animations)) return animator;
    let out: Record<string, unknown> | undefined;
    for (const [name, def] of Object.entries(animations)) {
        const authored = authorDefinition(def);
        if (authored === def) continue;
        out ??= { ...animations };
        out[name] = authored;
    }
    return out ? { ...animator, [ANIMATOR.definitions]: { ...defs, [DEFS.animations]: out } } : animator;
}

/**
 * A document with every compiled `animate` entry — on its nodes, and in `definitions.animations` of the
 * animator block at the root or under `meta` (a pre-rendered SVG's) — read back as its authored form.
 * For a reader that edits; the same object when there is nothing compiled.
 * @internal
 */
export function authorCompiledAnimations(doc: unknown): unknown {
    const withNodes = authorNode(doc);
    if (!isRecord(withNodes)) return withNodes;
    const animator = withNodes[DOC.animator];
    const meta = withNodes[DOC.meta];
    const metaAnimator = isRecord(meta) ? meta[DOC.animator] : undefined;
    const newAnimator = authorAnimator(animator);
    const newMetaAnimator = authorAnimator(metaAnimator);
    if (newAnimator === animator && newMetaAnimator === metaAnimator) return withNodes;
    const out: Record<string, unknown> = { ...withNodes };
    if (newAnimator !== animator) out[DOC.animator] = newAnimator;
    if (isRecord(meta) && newMetaAnimator !== metaAnimator) out[DOC.meta] = { ...meta, [DOC.animator]: newMetaAnimator };
    return out;
}
