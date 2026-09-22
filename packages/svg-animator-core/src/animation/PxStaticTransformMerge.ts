/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// A leaf module: imported by BOTH the binding normalizer (`PxDefinitions`) and the motion-path
// flattener (`PxMotionPath`). `PxDefinitions` imports `PxMotionPath`, so the rule could not stay
// there without an import cycle — and the flattener needs it, because a rule only one engine's
// pipeline applies is a rule the two engines disagree about.

import { TRANSFORM_ATTR } from '../format/PxAnimatorConstants';
import type { PxAnimationDefinition, PxPropertyAnimation, PxTransformParts } from '../format/PxAnimatorTypes';
import { parseTransformParts, PX_TRANSFORM_FN_NAMES } from '../util/PxAnimatorUtil';


/**
 * TRANSFORM PRECEDENCE (review §0.4/§1.6) — CSS's own composition rule, applied at READ:
 * a static `transform` on the element composes UNDER the animated transform, instead of
 * being silently clobbered by it. Implemented as a keyframe-value MERGE during
 * normalization, so both engines (and every consumer downstream) see complete parts:
 *
 *   1. `animate.transform` with PARTIAL parts records — every keyframe value (and the
 *      base `value`) inherits the static parts it does not set:
 *      static `{rotate: 45}` + kf `{translate: [80, 0]}` → kf `{rotate: 45, translate: [80, 0]}`.
 *   2. ONE individual channel (`translate` / `rotate` / `scale` / `skew`) and no
 *      `transform` channel — the channel is REWRITTEN as a unified `transform` channel
 *      whose values carry the static parts: the rect stays rotated 45° AND slides.
 *
 * The static transform may be a parts record or an attribute string (parsed by the
 * conservative {@link parseTransformParts} — unparseable strings skip the merge).
 * NOT merged (documented limitations): several individual channels animated at once
 * (they still last-write-wins against each other), and an individual channel next to an
 * animated `transform` (the `transform` channel wins, as before).
 * @internal
 */
export function mergeStaticTransformIntoAnimDef(
    animDef: PxAnimationDefinition,
    staticTransform: unknown,
): PxAnimationDefinition {
    if (!animDef) return animDef;
    const staticParts: PxTransformParts | undefined =
        staticTransform && typeof staticTransform === 'object' && !Array.isArray(staticTransform)
            ? staticTransform as PxTransformParts
            : parseTransformParts(staticTransform as string);
    if (!staticParts || !Object.keys(staticParts).length) return animDef;

    const mergeKfValue = (v: unknown): unknown =>
        v && typeof v === 'object' && !Array.isArray(v) ? { ...staticParts, ...(v as PxTransformParts) } : v;

    const transformAnim = animDef[TRANSFORM_ATTR];
    if (transformAnim && typeof transformAnim === 'object') {
        const anim = transformAnim as PxPropertyAnimation;
        if (Array.isArray(anim.keyframes)) {
            const out: PxPropertyAnimation = {
                ...anim,
                keyframes: anim.keyframes.map(kf => ({ ...kf, value: mergeKfValue(kf.value) })),
            };
            if (out.value !== undefined) out.value = mergeKfValue(out.value) as PxPropertyAnimation['value'];
            return { ...animDef, transform: out };
        }
        return animDef;
    }

    const channels = Object.keys(animDef).filter(k => PX_TRANSFORM_FN_NAMES.has(k));
    if (channels.length !== 1) return animDef; // several channels: unchanged (documented)
    const ch = channels[0];
    const chAnim = animDef[ch] as PxPropertyAnimation;
    if (!chAnim || typeof chAnim !== 'object' || !Array.isArray(chAnim.keyframes)) return animDef;
    const lifted: PxPropertyAnimation = {
        ...chAnim,
        keyframes: chAnim.keyframes.map(kf => ({ ...kf, value: { ...staticParts, [ch]: kf.value } })),
    };
    if (lifted.value !== undefined) lifted.value = { ...staticParts, [ch]: lifted.value };
    const rest: PxAnimationDefinition = { ...animDef };
    delete rest[ch];
    return { ...rest, transform: lifted };
}
