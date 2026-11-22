// @px-area control
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// ============================================================================
// FLOWS (2026-11-22; "states" 11-20, "segments" of one timeline 11-15) — of the steps of one flow exactly one is
// current; the current step plays with the ORDINARY playback on its own timeline (ready · playing · paused · finished).
// Nothing here moves a picture: `PxFlowSwitch` keeps one step's playback live at a time.
//
// | piece | what it does |
// |---|---|
// | `PxFlowControls` | `player.flow` — `goTo` · `next` · `previous` · `get` · `getAll` |
// | the lever | a component's `flowStep` prop between the component and its player |
// | the checks | a step id used twice (PX1115), a `flow.goTo` naming no step (PX1114) |
//
// Guards (segments design §5.5): an id that does not exist is not read (PX1114); an id used twice — the first wins
// (PX1115); an automatic hop always shows a frame first (no ring of empty steps can spin); the newest request wins
// while one is leaving.
// ============================================================================

import type { PxActionObject, PxAnimatorRuntimeConfig, PxFlowStep } from '../format/PxAnimatorTypes';
import type { PxRunLists } from './PxUnits';
import { PxFlowAction } from '../format/PxAnimatorConstants';

/** The flow controls on `player.flow` (2026-11-22; `player.state` 11-20, `player.timeline.segment` 11-15). The same
 *  names as the file's actions: `flow.next` ↔ `next()`, `flow.goTo` with `flowStep: "intro"` ↔ `goTo('intro')`. @public */
export interface PxFlowControls {
    /** Goes to the next step of a flow — after the last, the first. Changes and plays. `flow`: its id; none —
     *  `default` when it runs, else the first. */
    next(flow?: string): void;
    /** Goes to the previous step — before the first, the last. */
    previous(flow?: string): void;
    /** Goes to the step; an id the file does not have is ignored. Going to the current one does nothing. */
    goTo(flowStep: string): void;
    /** The current step of each running flow, in run order; with `flow` — of that one: `[id]`. */
    get(flow?: string): Array<string>;
    /** Every step's id, flow by flow, in order. */
    getAll(): Array<string>;
}

/** The controls of a picture with no flow — nothing to go to. @internal */
export const NO_FLOW_CONTROLS: PxFlowControls = {
    next: () => {}, previous: () => {}, goTo: () => {}, get: () => [], getAll: () => [],
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** A list entry that can be a step — an object with an id. @public @advanced */
export function isFlowStepEntry(v: unknown): v is PxFlowStep {
    return isRecord(v) && typeof v.id === 'string';
}

/** A `whenFinished` that is an action — `{ action: "flow.goTo", flowStep }`, `flow.next`, `flow.previous`. @public @advanced */
export function isFlowActionObject(v: unknown): v is PxActionObject {
    return isRecord(v) && (v.action === PxFlowAction.goTo || v.action === PxFlowAction.next || v.action === PxFlowAction.previous);
}

/** The steps the player plays: in list order, an id used twice — the first wins (the later is reported, PX1115). */
function uniqueSteps(steps: ReadonlyArray<PxFlowStep>): Array<PxFlowStep> {
    const seen = new Set<string>();
    return steps.filter(st => !seen.has(st.id) && !!seen.add(st.id));
}

/** The ids a later step of the list uses again — each once; the player plays the first (PX1115). @public @advanced */
export function duplicateFlowStepIds(steps: ReadonlyArray<PxFlowStep> | undefined): Array<string> {
    const seen = new Set<string>();
    const twice = new Set<string>();
    for (const st of steps ?? []) {
        if (!isFlowStepEntry(st)) continue;
        if (seen.has(st.id)) twice.add(st.id);
        seen.add(st.id);
    }
    return [...twice];
}

/** A `flow.goTo` naming a step the file does not have — it is ignored (PX1114). @public @advanced */
export interface PxFlowStepReferenceIssue {
    /** The step it names. */
    readonly target: string;
    /** The step whose `whenFinished` holds it; absent — a rule of `actionTriggers`. */
    readonly flowStep?: string;
    /** The ids the file has. */
    readonly ids: ReadonlyArray<string>;
}

/** Every `flow.goTo` in `actionTriggers` and in the steps' `whenFinished` that names no step of the file. `extraIds`:
 *  the steps the timelines no step names are (their names). @public @advanced */
export function flowStepReferenceIssues(cfg: Pick<PxAnimatorRuntimeConfig, 'flowSteps' | 'actionTriggers'>, extraIds: ReadonlyArray<string> = []): Array<PxFlowStepReferenceIssue> {
    const steps = uniqueSteps((cfg.flowSteps ?? []).filter(isFlowStepEntry));
    const ids = [...steps.map(st => st.id), ...extraIds.filter(id => !steps.some(st => st.id === id))];
    const unknown = (target: string | undefined): target is string => target !== undefined && !ids.includes(target);
    const issues: Array<PxFlowStepReferenceIssue> = [];
    for (const rule of cfg.actionTriggers ?? []) {
        if (rule.action === PxFlowAction.goTo && unknown(rule.flowStep)) issues.push({ target: rule.flowStep, ids });
    }
    for (const st of steps) {
        const wf = st.whenFinished;
        if (isFlowActionObject(wf) && wf.action === PxFlowAction.goTo && unknown(wf.flowStep)) issues.push({ target: wf.flowStep, flowStep: st.id, ids });
    }
    return issues;
}

/** What a flow gives the composed api and the triggers: the controls, and the page's lever. @internal */
export interface PxFlowRuntime {
    readonly controls: PxFlowControls;
    /** A component's `flowStep` prop: holds the step — the file's rules for this flow are no longer read. `mount`: the
     *  first position — a step that ends is shown at its end without playing, one that repeats plays. */
    hold(id: string, mount: boolean): void;
    /** True while a component holds the step. */
    isHeld(): boolean;
    /** The component let go (its prop gone): the file's rules are read again; nothing moves. */
    release(): void;
    dispose(): void;
}

/** The runtime a lever holds — one flow, or a picture of several (each step goes to its own). @internal */
export interface PxFlowHolder {
    hold(id: string, mount: boolean): void;
    release(): void;
}

/** A component's `flowStep` prop between the component and its player (React, Vue): the id — or ids, one per flow —
 *  it holds, applied to the player built now and to every rebuild. @internal */
export interface PxFlowLever {
    /** The prop's value — a change goes to the attached player as a request (its `whenLeaving` honoured). */
    set(ids: string | ReadonlyArray<string> | undefined): void;
    /** The flow runtime of the player just built (none: destroyed, or no flow) — the held ids land as at mount. */
    attach(runtime: PxFlowHolder | undefined): void;
}

const idsOf = (ids: string | ReadonlyArray<string> | undefined): ReadonlyArray<string> =>
    ids === undefined ? [] : typeof ids === 'string' ? [ids] : ids;

/** A lever holding `initial` (the prop's first value) — nothing to hold yet when absent. @internal */
export function createFlowLever(initial?: string | ReadonlyArray<string>): PxFlowLever {
    let held = idsOf(initial);
    let runtime: PxFlowHolder | undefined;
    return {
        set: (next) => {
            const ids = idsOf(next);
            if (ids.length === held.length && ids.every((id, i) => id === held[i])) return;
            held = ids;
            if (!runtime) return;
            if (!held.length) runtime.release();
            else for (const id of held) runtime.hold(id, false);
        },
        attach: (next) => {
            runtime = next;
            if (runtime) for (const id of held) runtime.hold(id, true);
        },
    };
}

/** The components' `flows` / `timelines` props between the component and its player (2026-11-22): the lists now, and a
 *  change handed to the live player, which plans again what runs — the picture stays. @internal */
export interface PxRunLever {
    get(): PxRunLists;
    set(lists: PxRunLists): void;
    attach(rerun: ((lists: PxRunLists) => void) | undefined): void;
}

/** A lever holding `initial` (the props' first values) — a change of no consequence (the same names) is no change. @internal */
export function createRunLever(initial: PxRunLists): PxRunLever {
    let lists = initial;
    let rerun: ((lists: PxRunLists) => void) | undefined;
    const key = (l: PxRunLists): string => JSON.stringify([l.flows ?? null, l.timelines ?? null]);
    return {
        get: () => lists,
        set: (next) => { if (key(next) === key(lists)) return; lists = next; rerun?.(lists); },
        attach: (next) => { rerun = next; },
    };
}
