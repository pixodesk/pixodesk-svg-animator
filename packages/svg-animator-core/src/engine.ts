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
export { applyPlaybackOverride, withActions, withoutTriggerDriver, withStaticPicture, withControlMode } from './playback/PxAnimatorConfigPatch';

// ONE control-mode rule for react / vue / rn (API review §1, §7) — logic + warning text
export { PxControlMode, resolveControlMode, controlModeTakesOverTrigger } from './format/PxAnimatorConstants';
export type { PxAnyControlProps, PxControlProps, PxResolvedControlMode } from './format/PxAnimatorConstants';
export { PxPlaybackWorld, PxDeclarativeAction, resolvePlaybackWorld, resolveDeclarativePlayback, applyDeclarativeAction, createPlayExecutor, ensurePlayExecutor, executorConfigOf, composeApiExtras, forwardPlaybackControls, forwardFlowControls, PxPlaybackWrite } from './playback/PxDeclarativePlayback';
export type { PxDeclarativeProps, PxDeclarativeArgs, PxDeclarativeTarget, PxPlayTarget, PxPlayExecutorConfig, PxApiExtrasConfig, PxApiExtrasTarget, PxApiExtras, PxComposedAnimationPlayerApi } from './playback/PxDeclarativePlayback';

// The engine's runtime form — one typed channel per animated property
export { calcAnimationValues, normalizeBindings } from './animation/PxDefinitions';
export { PxValueKind } from './format/PxAnimatorConstants';
export type { PxNormalizedBinding, PxRuntimeAnimation } from './animation/PxRuntimeChannel';

// Which trigger, which engine
export { actionRulesOf, actionEntryOf, conditionRulesOf, conditionEntryOf, flowStepViewsOf, initialFlowStepsOf, resolveTriggers, resolveActions, resolveGate, fromStepsOf, isPageEvent, isPageEventRule, ruleSpecOf, triggerEventList, triggerIssues, derivedResume, ruleEventEntry, ruleEntriesOf, rulesOfEntries, isPlaybackAction, defaultTimelineOf, isOnDefaultTimeline, allowedTriggerEvents, counterpartTriggerEvent, triggerListsEvent, triggerActionFor, triggerKeys, triggerKeyOf, triggerSpecOf, triggerEventOf, isTriggerEvents, PX_ALL_TRIGGER_EVENTS, PX_FLOW_ACTION_EVENTS, PX_ACTION_NAMES, isFlowAction, flowStepMoveOf, flowStepIndexAfter, type PxFlowStepMove, fillModeOf, resolveTimelineEngine, isNativeForced, mayUseNativeScrollTimeline } from './format/PxAnimatorConstants';

// Adapter-driven frame-loop engine (platform-neutral playback) + the node props every renderer shares
export { createAdapterSvgAnimationPlayer } from './playback/PxFrameLoop';
export type { PxPlatformAdapter } from './playback/PxFrameLoop';
export type { PxEngineAnimationPlayerApi } from './format/PxAnimatorTypes';
export { shouldWireOwnTriggers } from './format/PxAnimatorTypes';
export { toDomProps } from './util/PxNodeProps';

export type { PxConditionSources } from './format/PxAnimatorTypes';
export type { PxResolvedTriggers, PxResolvedActions, PxResolvedGate, PxTriggerIssue, PxTriggerEventSpec, PxFlowTrigger } from './format/PxAnimatorConstants';
// states (2026-11-20; segments 2026-11-15): the engine's view of a document with states, the states in their settings form
export { flowStepReferenceIssues, duplicateFlowStepIds, isFlowStepEntry } from './playback/PxFlows';
export { createFlowSwitch } from './playback/PxFlowSwitch';
export type { PxFlowSwitch, PxFlowSwitchOptions, PxFlowSwitchStep, PxFlowStepPlayer } from './playback/PxFlowSwitch';
export { timelineIssues, PxTimelineIssueKind, type PxTimelineIssue } from './playback/PxTimelineChecks';
export type { PxFlowRuntime, PxFlowStepReferenceIssue } from './playback/PxFlows';
// several timelines (2026-11-20): the units a player binds side by side, each a one-timeline document
export { planUnits, stepDocumentOf, unitConfigOf, attributeOwnersOf, switchStepsOf, unknownRunNames } from './playback/PxUnits';
export { showInTargetsOf, isShownIn, currentFlowStepsOf, flowNameOfUnit, showOneOfTargetsOf, shownOptionOf, type PxShowInTarget, type PxShowOneOfTarget } from './playback/PxShowIn';
export { timelineWindowsOf } from './playback/PxTimelineWindows';
export type { PxUnit, PxUnitPlan, PxPlannedStep, PxAttributeClaim, PxRunLists } from './playback/PxUnits';

// Variables (schema 1.27) — one player's values, and the binding grammar (docs/library/variables.md)
export { PxVariablesRuntime, applyVariablesProp } from './variables/PxVariablesRuntime';
export type { PxVariableChanges } from './variables/PxVariablesRuntime';
export { PxVariableBinding, PxFormulaNode, PxFormulaNumber, PxFormulaBoolean, PxFormulaText, PxFormulaVariable, PxFormulaNegate, PxFormulaNot, PxFormulaBinary, PxFormulaChoice,
    PxFormulaOperator, PxFormulaResultType, formulaResultTypeOfValue, renameInBinding, isVariableReadName, isConditionTrue } from './variables/PxFormula';
export type { PxVariableBindingParseResult, PxVariableReader, PxFormulaTypeReader } from './variables/PxFormula';
export { collectBindingSites, formulaResultTypeOf, isPredefinedVariableName } from './variables/PxVariableBindings';
export type { PxBindingSite } from './variables/PxVariableBindings';
