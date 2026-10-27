/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// ============================================================================
// @pixodesk/svg-animator-core/engine — for player authors.
//
// The engine wiring the web, React, Vue and React Native players share: the time contract,
// the component control rules, the runtime form of animations and the platform adapter.
// Supported, but you need it only to build a player. Documents, schemas, validation and
// conversion live on the main entry, `@pixodesk/svg-animator-core` (first-use review §23).
// ============================================================================

// The ONE time contract every engine implements (review §3)
export {
    clampSeekMs,
    createRunClock,
    isValidPlaybackRate,
    progressSpanMs,
    progressToTimeMs,
    PX_RATE_REJECTED,
    seekCeilingMs,
    timeToProgress,
} from './playback/PxPlaybackTime';

// A mount's timeline override folded into the file's; a component taking over the start
export { applyPlaybackOverride, withTrigger, withoutTriggerDriver } from './playback/PxAnimatorConfigPatch';

// ONE control-mode rule for react / vue / rn (API review §1, §7) — logic + warning text
export { PxControlMode, resolveControlMode, controlModeTakesOverTrigger } from './format/PxAnimatorConstants';
export type { PxControlProps } from './format/PxAnimatorConstants';
export { PxPlaybackWorld, PxDeclarativeAction, resolvePlaybackWorld, resolveDeclarativePlayback, applyDeclarativeAction, createPlayExecutor, ensurePlayExecutor, executorConfigOf, composeApiExtras } from './playback/PxDeclarativePlayback';
export type { PxDeclarativeProps, PxDeclarativeArgs, PxDeclarativeTarget, PxPlayTarget, PxPlayExecutorConfig, PxApiExtrasConfig, PxApiExtrasTarget, PxApiExtras } from './playback/PxDeclarativePlayback';

// The engine's runtime form — one typed channel per animated property
export { calcAnimationValues, normalizeBindings } from './animation/PxDefinitions';
export { PxValueKind } from './format/PxAnimatorConstants';
export type { PxNormalizedBinding, PxRuntimeAnimation } from './animation/PxRuntimeChannel';

// Which trigger, which engine
export { resolveTrigger, resolveGate, triggerEventList, triggerConflicts, triggerListsEvent, triggerActionFor, fillModeOf, resolveTimelineEngine, isNativeForced, mayUseNativeScrollTimeline } from './format/PxAnimatorConstants';

// Adapter-driven frame-loop engine (platform-neutral playback) + the node props every renderer shares
export { createAdapterSvgAnimationPlayer } from './playback/PxFrameLoop';
export type { PxPlatformAdapter } from './playback/PxFrameLoop';
export type { PxEngineAnimationPlayerApi } from './format/PxAnimatorTypes';
export { toDomProps } from './util/PxNodeProps';

export type { PxResolvedTrigger, PxResolvedGate } from './format/PxAnimatorConstants';
