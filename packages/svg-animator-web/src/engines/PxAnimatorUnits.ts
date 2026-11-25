// @px-area engine
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// ============================================================================
// FLOWS ON THE WEB (2026-11-22; units 2026-11-20) — the units of core's `planUnits`, side by side over the same rendered
// picture. Each unit is ONE flow switch (core `createFlowSwitch`): its current step is bound like a one-timeline file
// (`bindWithEngineChoice`, its own triggers off), and the flow wires the unit's triggers and gate ONCE over the switch.
//
// | the player's | does |
// |---|---|
// | `timeline` buttons and speed | every unit a clock drives — the whole picture |
// | `timeline` reads and seeks | the FIRST unit (in run order) — its current step's playback |
// | `getTimeline(id)` | the unit that plays that timeline (`PX_DEFAULT_TIMELINE`, "": the timeline with no id) |
// | `flow` | `goTo` — the step's unit; `next` / `previous` — its flow's (none: `default`, else the first); `get` — each flow's current |
// | playback events | the first unit's only; every unit tells `onFlowStepChange` |
// | `effects.showIn` (1.31) | `PxShowInWeb`: applied at bind and on every change of step, in any unit |
// ============================================================================

import { PX_DEFAULT_ID, PxDiagnosticCode, PxDiagnosticKind, getAnimatorConfig, type PxDocument, type PxFlowControls, type PxTimelineControls } from '@pixodesk/svg-animator-core';
import {
    attributeOwnersOf, createFlowSwitch, duplicateFlowStepIds, flowNameOfUnit, flowStepReferenceIssues, forwardPlaybackControls, planUnits, showInTargetsOf, stepDocumentOf, switchStepsOf, unitConfigOf, unknownRunNames,
    type PxAttributeClaim, type PxFlowSwitch, type PxRunLists, type PxUnitPlan,
} from '@pixodesk/svg-animator-core/engine';
import { createDiagnostics } from '@pixodesk/svg-animator-core/internal';
import type { PxPlayerCallbacks } from '../shared/PxAnimatorCallbacks';
import type { PxBoundPlayerApi, PxPlayerEngineApi } from '../shared/PxAnimatorWebTypes';
import { reportTriggerProblems, wireTriggers } from '../triggers/PxAnimatorTriggers';
import { webRaf } from '../shared/PxWebRaf';
import { createShowInWeb, type PxShowInWeb } from './PxShowInWeb';
import { createHider, type PxHider } from './PxHideWeb';
import { createShowOneOfWeb } from './PxShowOneOfWeb';
import type { PxVariableValue } from '@pixodesk/svg-animator-core';

/** Binds one document — a step's, or a whole one-timeline file — to an engine: the full player's choice of engine, or
 *  a pre-rendered build's own. `followed`: what a scroll timeline follows; `triggersByFlow`: a flow wires its triggers. */
export type PxStepBinder = (doc: PxDocument, callbacks: PxPlayerCallbacks | undefined, followed: Element | undefined, triggersByFlow: boolean) => PxBoundPlayerApi;

// @px-importance important
/** The player of a document as the page runs it (2026-11-22): the document as it is when it is its default timeline
 *  alone, else its units side by side (`planUnits`). The full player and the pre-rendered builds both bind here. */
export function bindPlanned(doc: PxDocument, binder: PxStepBinder, callbacks: PxPlayerCallbacks | undefined, followed: Element | undefined, run?: PxRunLists,
    variables?: PxPrerenderedVariables): PxPlayerEngineApi {
    const plan = planUnits(doc, run);
    const diag = createDiagnostics(callbacks, '[PxAnimator]');
    for (const unknown of unknownRunNames(doc, run)) diag.warn(PxDiagnosticKind.usage, PxDiagnosticCode.runListNameUnknown, unknown.list, unknown.name);
    const hider = createHider();
    if (!plan) {
        const api = binder(doc, callbacks, followed, false);
        createShowInWeb(doc, () => api.getRootElement(), () => new Map(), hider);   // `showIn` (1.31): no flow — every list's steps are absent
        watchShowOneOf(doc, () => api.getRootElement(), hider, variables);
        return api;
    }
    // the step checks, once for the whole file — a unit wires only its own steps and rules
    const config = getAnimatorConfig(doc);
    for (const id of duplicateFlowStepIds(config?.flowSteps)) diag.warn(PxDiagnosticKind.document, PxDiagnosticCode.flowStepIdDuplicate, id);
    const showInSteps = showInTargetsOf(doc).flatMap(t => t.flowSteps);
    if (config) for (const issue of flowStepReferenceIssues(config, plan.timelines.map(t => t.stepId), showInSteps)) diag.warn(PxDiagnosticKind.document, PxDiagnosticCode.flowStepNotFound, issue);
    const api = bindUnits(doc, plan, binder, callbacks, followed, hider);
    watchShowOneOf(doc, () => api.getRootElement(), hider, variables);
    return api;
}

/** A pre-rendered player's variables — `showOneOf` reads a bound `which` from them, again on every change; the
 *  conditions of `actions` read them too (1.33). */
export interface PxPrerenderedVariables {
    read(name: string): PxVariableValue | undefined;
    /** Told (on the next frame) when a value changes; returns the undo. */
    onChange(listener: () => void): () => void;
}

/** `showOneOf` (1.32): applied now, and again whenever a pre-rendered player's variable changes. */
function watchShowOneOf(doc: PxDocument, root: () => Element | null, hider: PxHider, variables: PxPrerenderedVariables | undefined): void {
    const oneOf = createShowOneOfWeb(doc, root, hider, variables ? name => variables.read(name) : undefined);
    if (oneOf && variables) variables.onChange(() => oneOf.update());
}

/** The callbacks a unit other than the first gets: its diagnostics and its changes of step, no playback events. */
function secondaryCallbacks(callbacks: PxPlayerCallbacks | undefined): PxPlayerCallbacks | undefined {
    if (!callbacks) return undefined;
    const { onWarning, onError, suppressWarnings, suppressErrors, onFlowStepChange, conditionSources } = callbacks;
    return { onWarning, onError, suppressWarnings, suppressErrors, onFlowStepChange, conditionSources };
}

/** One unit at work: its switch, and what the flow wired. */
interface PxBoundUnit {
    readonly flowSwitch: PxFlowSwitch<PxBoundPlayerApi>;
    readonly scroll: boolean;
    destroy(): void;
}

/** One unit's flow switch — every step's playback bound on demand, the unit's triggers wired once over it. */
function bindUnit(
    doc: PxDocument,
    plan: PxUnitPlan,
    unitIndex: number,
    claims: ReadonlyArray<PxAttributeClaim>,
    binder: PxStepBinder,
    callbacks: PxPlayerCallbacks | undefined,
    followed: Element | undefined,
    onStepChanged: () => void,
): PxBoundUnit {
    const unit = plan.units[unitIndex];
    const { onPlaybackFinish, onFlowStepChange, conditionSources, ...stepCallbacks } = callbacks ?? {};
    // told after the flow moves — what a condition entry's `when.flowSteps` reads (1.33)
    const stepListeners = new Set<() => void>();
    const onStepChange = (listener: () => void): (() => void) => { stepListeners.add(listener); return () => { stepListeners.delete(listener); }; };
    const flowSwitch = createFlowSwitch<PxBoundPlayerApi>({
        flow: flowNameOfUnit(plan, unit),
        steps: switchStepsOf(unit, plan, getAnimatorConfig(doc)?.actionRules ?? []),
        raf: webRaf,
        onChange: (flowStep, previous, flow) => {
            onStepChanged();
            onFlowStepChange?.(flowStep, previous, flow);
            for (const listener of [...stepListeners]) listener();
        },
        onPlaybackFinish: () => onPlaybackFinish?.(),
        bind: (stepIndex, events) => {
            const stepDoc = stepDocumentOf(doc, plan, unitIndex, stepIndex, claims);
            const scroll = plan.timelines[unit.steps[stepIndex].timeline].scroll;
            return binder(stepDoc, { ...stepCallbacks, onPlaybackFinish: events.onPlaybackFinish }, scroll ? followed : undefined, true);
        },
    });
    // the unit's triggers and gate, once — over the switch's executor (the current step's playback)
    let detach = (): void => {};
    const root = flowSwitch.currentPlayer().getRootElement();
    if (!unit.scroll && root) {
        const config = getAnimatorConfig(unitConfigOf(doc, unit, plan)) ?? {};
        const report = createDiagnostics(callbacks, '[PxAnimator]');
        reportTriggerProblems(config, report);
        detach = wireTriggers(root, flowSwitch.executor, unit.flow !== undefined ? flowSwitch : undefined, config, report, conditionSources, onStepChange);
    }
    return {
        flowSwitch,
        scroll: unit.scroll,
        destroy: () => { detach(); flowSwitch.dispose(); },
    };
}

/** One player over the units of `plan` — see the top of the file. `doc` is the plain document the picture was
 *  rendered from. */
function bindUnits(
    doc: PxDocument,
    plan: PxUnitPlan,
    binder: PxStepBinder,
    callbacks: PxPlayerCallbacks | undefined,
    followed: Element | undefined,
    hider: PxHider,
): PxPlayerEngineApi {
    const claims = attributeOwnersOf(doc, plan);
    let showIn: PxShowInWeb | undefined;
    const units = plan.units.map((_, i) => bindUnit(doc, plan, i, claims, binder, i === 0 ? callbacks : secondaryCallbacks(callbacks), followed,
        () => showIn?.update()));
    const first = units[0];
    // `showIn` (1.31): shown while one of its steps is current — each running flow's, by its name
    showIn = createShowInWeb(doc, () => first?.flowSwitch.currentPlayer().getRootElement() ?? null,
        () => new Map(plan.units.map((unit, i) => [flowNameOfUnit(plan, unit), units[i].flowSwitch.controls.get()[0]])), hider);
    const clocks = units.filter(u => !u.scroll);
    const each = (run: (t: PxTimelineControls) => void) => (): void => { for (const u of clocks) run(u.flowSwitch.timeline); };

    const timeline: PxTimelineControls = {
        ...(first?.flowSwitch.timeline ?? forwardPlaybackControls(() => undefined, () => {})),
        "start": each(t => t.start()),
        "play": each(t => t.play()),
        "stop": each(t => t.stop()),
        "pause": each(t => t.pause()),
        "resume": each(t => t.resume()),
        "setSpeed": (speed) => { for (const u of clocks) u.flowSwitch.timeline.setSpeed(speed); },
    };

    const flows = plan.units.map((unit, i) => ({ unit, bound: units[i] })).filter(x => x.unit.flow !== undefined);
    const flowOf = (flow: string | undefined) => flow === undefined
        ? flows.find(x => x.unit.flow === PX_DEFAULT_ID) ?? flows[0]
        : flows.find(x => x.unit.flow === flow);
    const ownerOf = (flowStep: string) => flows.find(x => x.unit.steps.some(s => s.id === flowStep));
    const flow: PxFlowControls = {
        "goTo": (args) => ownerOf(args.flowStep)?.bound.flowSwitch.controls.goTo(args),
        "next": (args) => flowOf(args?.flow)?.bound.flowSwitch.controls.next(),
        "previous": (args) => flowOf(args?.flow)?.bound.flowSwitch.controls.previous(),
        "nextOrWrap": (args) => flowOf(args?.flow)?.bound.flowSwitch.controls.nextOrWrap(),
        "previousOrWrap": (args) => flowOf(args?.flow)?.bound.flowSwitch.controls.previousOrWrap(),
        "get": (name) => name === undefined ? flows.flatMap(x => x.bound.flowSwitch.controls.get()) : flowOf(name)?.bound.flowSwitch.controls.get() ?? [],
        "getAll": () => flows.flatMap(x => x.bound.flowSwitch.controls.getAll()),
    };

    const unitOfTimeline = (name: string): PxBoundUnit | undefined => {
        const at = plan.timelines.findIndex(t => t.name === name);
        if (at < 0) return undefined;
        const index = plan.units.findIndex(u => u.timelines.includes(at));
        return index < 0 ? undefined : units[index];
    };

    return {
        timeline,
        flow,
        getTimeline: (name) => unitOfTimeline(name)?.flowSwitch.timeline,
        flowHolder: {
            hold: (id, mount) => ownerOf(id)?.bound.flowSwitch.hold(id, mount),
            release: () => { for (const x of flows) x.bound.flowSwitch.release(); },
        },
        isReady: () => units.every(u => u.flowSwitch.currentPlayer().isReady()),
        getRootElement: () => first?.flowSwitch.currentPlayer().getRootElement() ?? null,
        destroy: () => { for (const u of units) u.destroy(); },
    };
}
