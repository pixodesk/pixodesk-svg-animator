/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// ============================================================================
// Wire CONSTANTS and schema-free helpers.
//
// Split out of `PxAnimatorTypes` so that code needing only an enum does not drag the
// SCHEMA ENGINE in with it. `PxAnimatorTypes` builds ~31 schema declarations at module
// scope through curried `implementsInterface<T>()(px.object(...))` calls, which no
// minifier can treat as side-effect-free — so a single value import from it pulls in
// `PxSchema` plus every declaration.
//
// That is exactly what happened: `PxDefinitions` imported `PxLoopExtend` (one small const)
// and the pre-rendered player builds ended up carrying 14 KB of validation code they never
// call. See PRERENDERED-PLAYER-BUILDS.md.
//
// RULE: nothing in this file may import a VALUE from `PxAnimatorTypes`. Type-only imports
// are fine — they are erased at build time and cannot create a runtime edge.
// ============================================================================

import type { PxAnimatedSvgDocument, PxAnimatorConfig, PxBinding, PxDefs, PxNode } from './PxAnimatorTypes';

export type FillMode = 'forwards' | 'backwards' | 'both' | 'none';

export type PlaybackDirection = 'normal' | 'reverse' | 'alternate' | 'alternate-reverse';

export const PX_ANIM_SRC_ATTR_NAME = 'data-px-animation-src';

export const PX_ANIM_ATTR_NAME = '_px_animator';

export type StartOn = 'load' | 'mouseOver' | 'click' | 'scrollIntoView';

export type OutAction = 'continue' | 'pause' | 'reset' | 'reverse';

/** Animation engine selection (config level). `auto` means "try `waapi`, fall
 *  back to `frames`"; the runtime resolves it to a concrete {@link PxAnimatorEngine}
 *  via `createAnimatorFromConfig`. Wire as a const-namespace + matching string
 *  type so call sites can use named members (`PxAnimatorMode.frames`) instead of
 *  bare string literals. */
export const PxAnimatorMode = {
    auto:   'auto',
    waapi: 'waapi',
    frames: 'frames',
} as const;

export type PxAnimatorMode = typeof PxAnimatorMode[keyof typeof PxAnimatorMode];

/** Resolved engine after `auto` dispatch — used downstream by code that always
 *  knows exactly which engine is running (e.g. `getNormalisedBindings`'s
 *  `engine` arg gates motion-along-path materialisation). Strictly a subset of
 *  {@link PxAnimatorMode} (no `auto`). */
export const PxAnimatorEngine = {
    waapi: PxAnimatorMode.waapi,
    frames: PxAnimatorMode.frames,
} as const;

export type PxAnimatorEngine = typeof PxAnimatorEngine[keyof typeof PxAnimatorEngine];

// V3 — every closed value list is a NAMED const + a strict `px.enum` slot, so a
// typo is a schema ERROR instead of silently shipping. Plain `px.string()` stays
// ONLY where SVG itself is open-ended (`gradientTransform`, `viewBox`, `path` d,
// ids/refs, `debugInstName`).

/** `loop.extend` — WHICH END of the keyframe sequence the loop segment is taken from,
 *  and therefore which side the animation is extended on. Replaced the boolean
 *  `before` (N8): a bare preposition named no subject ("before what?"), and a
 *  two-way selector reads better as a named enum — which also leaves room for a
 *  third value (e.g. both ends) that a boolean forecloses. */
export const PxLoopExtend = {
    /** Segment from the START; the animation is extended BEFORE the first keyframe
     *  (intro loops that run before the main timeline begins). */
    before: 'before',
    /** DEFAULT — segment from the END; extended AFTER the last keyframe (idle/outro
     *  loops that continue once the main timeline has finished). */
    after: 'after',
} as const;

export type PxLoopExtend = typeof PxLoopExtend[keyof typeof PxLoopExtend];

/** SVG `mask-type` — how the mask source's pixels become alpha. */
export const PxMaskType = {
    luminance: 'luminance',
    alpha:     'alpha',
} as const;

export type PxMaskType = typeof PxMaskType[keyof typeof PxMaskType];

/** SVG coordinate system for `maskUnits` / `maskContentUnits` (and the gradient twin below). */
export const PxUnits = {
    userSpaceOnUse:    'userSpaceOnUse',
    objectBoundingBox: 'objectBoundingBox',
} as const;

export type PxUnits = typeof PxUnits[keyof typeof PxUnits];

/** `clone.type` — WHAT a `<use>` clones. Absent = the whole element (a direct link);
 *  `content` excludes the target's own translate (see `contentRefSplit`). */
export const PxCloneType = {
    content: 'content',
} as const;

export type PxCloneType = typeof PxCloneType[keyof typeof PxCloneType];

/** `textPath.pathOverflow` — glyphs past the path end: hide them, or keep laying
 *  them along the tangent extension. */
export const PxPathOverflow = {
    clip:   'clip',
    extend: 'extend',
} as const;

export type PxPathOverflow = typeof PxPathOverflow[keyof typeof PxPathOverflow];

/** SVG `lengthAdjust` — what `textLength` stretches. */
export const PxLengthAdjust = {
    spacing:          'spacing',
    spacingAndGlyphs: 'spacingAndGlyphs',
} as const;

export type PxLengthAdjust = typeof PxLengthAdjust[keyof typeof PxLengthAdjust];

/** SVG `<textPath method>` — how glyphs follow curvature. */
export const PxTextPathMethod = {
    align:   'align',
    stretch: 'stretch',
} as const;

export type PxTextPathMethod = typeof PxTextPathMethod[keyof typeof PxTextPathMethod];

/** SVG `<textPath spacing>` — whether the renderer may adjust spacing. */
export const PxTextPathSpacing = {
    auto:  'auto',
    exact: 'exact',
} as const;

export type PxTextPathSpacing = typeof PxTextPathSpacing[keyof typeof PxTextPathSpacing];

/** `strokeTrim.subPaths` — what the 0..1 `range`/`offset` window is measured over.
 *  `separate` (default): each sub-path against its OWN length, all trimmed alike.
 *  `combined`: every descendant sub-path chained end-to-end into one virtual path,
 *  so the window slides across siblings (AE "Trim All As One"). */
export const PxStrokeTrimSubPaths = {
    separate: 'separate',
    combined: 'combined',
} as const;

export type PxStrokeTrimSubPaths = typeof PxStrokeTrimSubPaths[keyof typeof PxStrokeTrimSubPaths];

/** @deprecated Backwards-compatibility alias — use {@link PxAnimatorMode} for the type. */
export type JsMode = PxAnimatorMode;

// S8: `textContent` is the CANONICAL text-content key (DOM property name;
// `text` was triply overloaded: the `text` tag, the `effects.text` group, and
// this key). `text` is READ-ONLY legacy — readers accept both, writers emit
// only `textContent`.
export const TEXT_ATTR = 'text';

export const TEXT_CONTENT_ATTR = 'textContent';

// Wire keys that are NEVER DOM attributes (internal use only).
//
// `effects` is here for safety rather than necessity: `applyPlayerEffects` deletes it at
// load, so today nothing reaches the renderer with it still attached. That is a property
// of the pipeline, though, not of the contract — an effect path that returns early, or a
// document carrying an effect key the pipeline does not recognise, would otherwise leave
// the object behind and the renderer would write `effects="[object Object]"` with no error
// anywhere. Listing it makes the invariant structural (J4).
export const INTERNAL_ATTRS = new Set([
    'type', 'children', 'animator', 'meta', 'animate', 'effects', TEXT_ATTR, TEXT_CONTENT_ATTR
]);

// ============================================================================
// TRANSFORM
// ============================================================================

/**
 * Names of the transform parts that can appear inside a transform value record.
 * The unified `transform` slot replaces the earlier per-part top-level keys
 * (`translate`, `rotate`, `scale`, `origin`) — those names now live as keys
 * inside a `PxTransformParts` record.
 */
export const PX_TRANSFORM_PART_KEYS = ['translate', 'rotate', 'scale', 'origin'] as const;

/** One of the transform-part key strings. */
export type PxTransformPartKey = typeof PX_TRANSFORM_PART_KEYS[number];

// ─────────────────────────────────────────────────────────────────────────────
// Gradient paint effect — `fillGradient` / `strokeGradient`.
//
// Materialiser pattern mirrors `maskedByEffect`: at apply time the gradient
// effect generates a `<linearGradient>` / `<radialGradient>` def into `ctx.defs`,
// then sets the host element's `fill` / `stroke` to `url(#auto-id)`. The wire
// gradient is geometry parts (`p1`/`p2` linear, `c`/`r`/`fp` radial — standard
// animatable slots) + a stop sequence that is either static (bare array) or
// animated (a single `{keyframes}` block whose each kf's `value` is the FULL
// `Array<{offset, color}>` snapshot at that time). Per-stop independent
// timelines are intentionally NOT modelled — the source is a single
// stop-colour keyframe group. Animated geometry is frames-engine only
// (CSS/WAAPI cannot animate gradient endpoints; `mode: 'auto'` handles it).
//
// Stop count is constant across kfs. `gradientTransform` is captured as static
// only (animated transform is vanishingly rare).
// ─────────────────────────────────────────────────────────────────────────────

/** Loose enums for `gradientUnits` / `spreadMethod` — kept on the wire as
 *  plain strings (matches the rest of the schema's loose-enum stance) but
 *  collected here so call sites use named constants instead of bare literals. */
export const PxGradientUnits = {
    userSpaceOnUse:    'userSpaceOnUse',
    objectBoundingBox: 'objectBoundingBox',
} as const;

export type PxGradientUnits = typeof PxGradientUnits[keyof typeof PxGradientUnits];

export const PxGradientSpreadMethod = {
    pad:     'pad',
    reflect: 'reflect',
    repeat:  'repeat',
} as const;

export type PxGradientSpreadMethod = typeof PxGradientSpreadMethod[keyof typeof PxGradientSpreadMethod];

export const PxGradientType = {
    linear: 'linear',
    radial: 'radial',
} as const;

export type PxGradientType = typeof PxGradientType[keyof typeof PxGradientType];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function isPxElementFileFormat(fileJson: any): fileJson is PxAnimatedSvgDocument {
    if (!(
        fileJson &&
        typeof fileJson === 'object' &&
        !Array.isArray(fileJson)
    )) {
        return false;
    }

    // `type` is the tag, and the ONLY discriminator — it is what the schema requires
    // (`px.literal('svg')`). A `tagName` alternative was accepted here until 2026-08,
    // which meant a tagName-only document passed this gate and then failed
    // `isPxElementFileFormatDeep`; nothing ever wrote it.
    return fileJson['type'] === 'svg';
}

/**
 * The animator config, at either of its TWO canonical addresses (S4).
 *
 * `animator` is the only name. It has two addresses because the SVG form has no other
 * slot: a `.svga`/JSON document carries it at the top level, while a pre-rendered
 * `.svg` carries it inside the root element's `data-px-meta` blob — i.e. under `meta`.
 * The editor lifts/un-lifts between the two on write/read.
 *
 * The `animation` / `meta.animation` spellings were removed 2026-08: nothing wrote
 * them and they were never in the schema.
 */
export function getAnimatorConfig(doc: PxAnimatedSvgDocument): PxAnimatorConfig | undefined {
    return doc?.animator || doc?.meta?.animator;
}


export function getDefs(doc: PxAnimatedSvgDocument): PxDefs | undefined {
    if (!doc) return undefined;
    return getAnimatorConfig(doc)?.definitions;
}

export function getBindings(doc: PxAnimatedSvgDocument): PxBinding[] | undefined {
    if (!doc) return undefined;
    const animateById = getAnimatorConfig(doc)?.animateById;
    if (!animateById) return undefined;
    return Object.entries(animateById).map(([id, anim]) => ({ id, animate: anim }));
}


export function getChildren(doc: PxAnimatedSvgDocument): PxNode[] | undefined {
    return doc?.children;
}
