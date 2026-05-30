/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/


/**
 * Shared types for the lightweight player-effects applier.
 *
 * The node keys used across these files (`type`, `children`, `transform`,
 * `animate`, `href`, …) are the stable on-disk WIRE keys — accessed by literal
 * dot-notation on purpose. Nothing here imports anything but plain TS, so the
 * whole `effects/` folder can move into the Player codebase verbatim.
 */

/** A serialised SVGA node. Loose by design — this is parsed wire JSON. */
export interface PxNode {
    type?: string;
    children?: Array<PxNode>;
    effects?: PxEffects;
    [attr: string]: any;
}

/** The `node.effects` bucket the player-effects writer emits (render effects only). */
export interface PxEffects {
    transformation?: PxTransformationEffect;
    repeater?: PxRepeaterEffect;
    maskedBy?: PxMaskedByEffect;
    trimPath?: object;
    retime?: PxRetimeEffect;
    isCombinedShape?: boolean;
    ref?: PxRefEffect;
}

/** `<use>` retime effect: `baseId` = source symbol/element; `start`/`timeCrop` in ms
 *  (no frame rate in the Player). The source's keyframe times are remapped
 *  `t' = start + t·stretch`. */
export interface PxRetimeEffect {
    baseId?: string;
    start?: number;
    stretch?: number;
    timeCrop?: [number, number];
}

/** `<use>` reference effect: `baseId` = source element id; `type` = sub-ref mode
 *  (`content` = exclude object-translate, the former `noRefTranslate`). */
export interface PxRefEffect {
    baseId?: string;
    type?: string;
}

export type Vec2 = [number, number];

/** An animatable value: a raw static value, a `{value}` static, or `{keyframes}`.
 *  Animated translate may additionally carry `autoOrient` (motion-path rotation
 *  derived from the curve tangent) at the animation level, and `tangentOut` /
 *  `tangentIn` on individual keyframes (curve handles). */
export type PxAnimatable<T> = T | { value: T } | { keyframes: Array<PxKeyframe<T>>; autoOrient?: boolean };
export interface PxKeyframe<T> {
    time?: number;
    value?: T;
    easing?: Array<number>;
    tangentOut?: Vec2;
    tangentIn?: Vec2;
}

export interface PxTransformationEffect {
    translate?: PxAnimatable<Vec2>;
    rotate?: PxAnimatable<number>;
    scale?: PxAnimatable<Vec2>;
    skew?: PxAnimatable<Vec2>;
    origin?: PxAnimatable<Vec2>;
}

export interface PxRepeaterEffect {
    copies?: number;
    translate?: Vec2;
    rotate?: number;
    scale?: Vec2;     // per-copy scale, stored as PERCENT (85 → 0.85)
    origin?: Vec2;
}

export interface PxMaskedByEffect {
    href?: string;
    maskType?: string;
    maskUnits?: string;
    maskContentUnits?: string;
}

/** Collected diagnostics + new <defs> nodes accumulated during a run. */
export interface ApplyResult {
    root: PxNode;
    defs: Array<PxNode>;
    warnings: Array<string>;
    errors: Array<string>;
}

/** Mutable per-run state threaded through every effect. */
export interface ApplyContext {
    defs: Array<PxNode>;
    warnings: Array<string>;
    errors: Array<string>;
    idMap: Map<string, PxNode>;
    nextId: number;
    /**
     * For every element id referenced by a `<use>` with `ref:{type:'content'}`,
     * the fresh id of the INNER (no-translate) wrapper produced by
     * `splitForContentRef`. The use's `href` is rewritten to point at this
     * inner id — mirrors the editor's heavy materialisation, where the source
     * is split into outer-translate + inner-content layers and the use targets
     * the inner one. Populated by `identifyContentRefTargets` before pass 1.
     */
    contentRefInnerIds: Map<string, string>;
}
