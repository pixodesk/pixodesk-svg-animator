/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// ============================================================================
// @pixodesk/svg-animator-web — browser player.
// The platform-neutral parts (schema, types, materializers, interpolation,
// sampling, frame-loop engine) live in @pixodesk/svg-animator-core and are
// re-exported here so this package's public surface is unchanged by the core
// extraction. Core is bundled into this package's dist (tsup `noExternal`),
// so consumers — including the UMD build — stay self-contained.
// ============================================================================

// `createAnimatorImpl` is no longer exported (review §11): six positional parameters, marked
// internal, and nothing outside this file ever called it — `createAnimator` is the door.
export { createAnimator, generateNewIds, loadTagAnimators } from './animator/PxAnimator';
export type { PxTagAnimatorOptions } from './animator/PxAnimator';
// The options of the pre-rendered builds' `createAnimator` — a type only, so the main entry can
// describe every `createAnimator` there is (docs-check reads the docs against this file).
export type { PxPrerenderedAnimatorOptions } from './engines/PxAnimatorBind';

export { px } from '@pixodesk/svg-animator-core';
export type { PxInfer, PxSchema, PxValidationContext } from '@pixodesk/svg-animator-core';

// `PxInternalAnimatorOptions` = the public options + `adapter`, for the React and Vue packages only
// (review §25.14) — a type so they can name what they pass; not an option of the public API.
export type { PxAnimatorOptions } from './animator/PxAnimator';
export type { PxTimelinePatch } from '@pixodesk/svg-animator-core';
export {
    PxAnimatorConfigSchema,
    PxTimelineEngineSetting,
    PxDefinitionsSchema,
    PxNodeBaseSchema,
    PxSvgNodeRootSchema,
    PxTriggerSchema,
} from '@pixodesk/svg-animator-core';

// Types
export type {
    PxFillMode,
    PxPlaybackDirection,
    PxAnimatedSvgDocument,
    PxEngineCallbacks,
    PxAnimatorConfig,
    PxBinding,
    PxDefinitions,
    PxNode,
    PxSvgNode,
    PxTrigger,
    PxStartOn,
} from '@pixodesk/svg-animator-core';

// DOM specializations — on the web `getRootElement()` returns a DOM Element.
export type { PxAnimatorApi, PxPlaybackApi } from './shared/PxAnimatorWebTypes';

// ONE control-mode rule for every component (API review §1, §7). React and Vue reach core
// through this package, so the resolver is forwarded here; React Native imports core directly.

// The ONE diagnostics channel every player reports through (review §5).
export { PxDiagnosticKind } from '@pixodesk/svg-animator-core';
export type { PxDiagnostic, PxDiagnostics, PxDiagnosticsConfig } from '@pixodesk/svg-animator-core';

// The shapes every framework component shares (review §9) — one definition, three aliases.
export type { PxAnimatorCallbacks, PxPlaybackOverride } from '@pixodesk/svg-animator-core';

// The time contract (review §3) and the trigger defaults, so the components map `progress` and
// thresholds with core's rule instead of re-deriving it.

// The schema-version API, `diagnoseDocument` and the timeline / pin / scroll schema values
// (review §17): a web-only install no longer needs core beside it for these.
export {
    PxScrollSchema,
} from '@pixodesk/svg-animator-core';

// Triggers
export { setupAnimationTriggers } from './triggers/PxAnimatorTriggers';

// The page-wide registry — every live animator in the window, whoever made it, plus its
// play / pause / cancel / finish announcements (also `globalThis.__pixodeskAnimators`).
export { getAllAnimators, onAnimatorsChange } from './registry/PxAnimatorRegistry';
export type { PxAnimatorRegistry, PxAnimatorsEvent, PxAnimatorsListener } from './registry/PxAnimatorRegistry';

// Normalization utilities

// Motion-along-path materializer — desugars tangented `transform` kfs + `autoOrient`
// into plain sampled `{ translate, rotate? }` kfs. Called automatically by the
// player's binding pipeline; exposed so the Editor can produce a fully-flat
// document for renderers without tangent support (e.g. react-native-svg).
// Pair with `materializeNodeEffects` + `materializeInternalLoopsInTree` for the
// full flatten pipeline (see motion-along-path-waapi-rework.md).

// `<use>` instance materializer — replaces `<use href="#anim-target">` with
// `<g>` carrying a deep clone of the target subtree (fresh ids, rewritten
// internal refs). Workaround for WAAPI / CSS animations not propagating
// through SVG `<use>` shadow trees in Chrome and Safari.

// Single-call materialization pipeline — runs `materializeNodeEffects` +
// `materializeInternalLoopsInTree` + (for waapi) `materializeMotionPathsInTree`
// + `materializeAnimatedUseInstances` in the canonical order. The player calls
// this internally from `createAnimatorImpl`; exported here so the Editor's
// flat-export path uses the EXACT same function — guarantees no pipeline
// drift between in-player and out-of-player paths.

// Low-level APIs (for advanced usage)
export { toDomProps, renderNode } from './dom/PxAnimatorDOM';

// Element-creation factory + glyph-text materializer. The materializer emits
// via an injected factory so the SAME layout produces plain wire nodes (effects
// pipeline), DOM, or the editor's React/px elements — the editor calls
// `materializeGlyphText` with its own `createPxElement` for Step 3 (static SVG
// with baked glyph outlines). See textGlyphsEffect / elementFactory.
export { createAdapterAnimator } from './engines/PxAnimatorFrameLoop';
export type { PxPlatformAdapter } from '@pixodesk/svg-animator-core';

// Player-effects materializer — turns `node.effects` (the lightweight design format
// emitted by the Editor) into a plain renderable node tree. Called automatically by
// `createAnimatorImpl` before any other normalization; exposed for the Editor's
// "equal in effect" comparison harness.

// Effects schemas + walker validator. `createAnimatorImpl` runs `validateNodeEffects`
// on the doc before materialization and logs warnings; callers can also run it
// explicitly (Editor's test harnesses do).
export {
    // One `Px*` const per wire enum (review §2.7) — forwarded so React/Vue can name values.
    // The four that are also re-exported as TYPES above (PxFillMode, PxOutAction,
    // PxPlaybackDirection, PxStartOn) must not be repeated here: same identifier, one export.
    validateDocument,
} from '@pixodesk/svg-animator-core';
