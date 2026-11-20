// @px-area engine
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// ============================================================================
// SEVERAL TIMELINES ON THE WEB (2026-11-20) — the units of core's `planUnits`, each bound like a one-timeline file
// (`bindWithEngineChoice`) to the same rendered picture, and composed into ONE player:
//
// | the player's | does |
// |---|---|
// | `timeline` buttons and speed | every unit a clock drives — the whole picture |
// | `timeline` reads and seeks | the PRIMARY unit (the one with the first timeline) |
// | `getTimeline(id)` | that timeline's unit |
// | `state` | `goTo` — the state's unit; `next` / `previous` — its state machine's; `get` — each state machine's current |
// | playback events | the primary's only; every unit tells `onStateChange` |
// ============================================================================

import type { PxDocument, PxTimelineControls } from '@pixodesk/svg-animator-core';
import { unitDocumentsOf, type PxControlMode, type PxPlatformAdapter, type PxUnitPlan } from '@pixodesk/svg-animator-core/engine';
import type { PxStateControls } from '@pixodesk/svg-animator-core';
import type { PxPlayerCallbacks } from '../shared/PxAnimatorCallbacks';
import type { PxPlayerEngineApi } from '../shared/PxAnimatorWebTypes';
import { bindWithEngineChoice } from './PxAnimatorBind';

/** The callbacks a unit other than the primary gets: its diagnostics and its changes of state, no playback events. */
function secondaryCallbacks(callbacks: PxPlayerCallbacks | undefined): PxPlayerCallbacks | undefined {
    if (!callbacks) return undefined;
    const { onWarning, onError, suppressWarnings, suppressErrors, onStateChange } = callbacks;
    return { onWarning, onError, suppressWarnings, suppressErrors, onStateChange };
}

/** One player over the units of `plan` — see the top of the file. `doc` is the plain document the picture was
 *  rendered from. */
export function bindUnits(
    doc: PxDocument,
    plan: PxUnitPlan,
    adapter: PxPlatformAdapter | undefined,
    callbacks: PxPlayerCallbacks | undefined,
    rootElement: Element | null | undefined,
    mode: PxControlMode,
    followed?: Element,
): PxPlayerEngineApi {
    const docs = unitDocumentsOf(doc, plan);
    const apis = plan.units.map((unit, i) => bindWithEngineChoice(docs[i], adapter, unit.primary ? callbacks : secondaryCallbacks(callbacks),
        rootElement, mode, unit.scroll ? followed : undefined));
    const primaryAt = Math.max(0, plan.units.findIndex(u => u.primary));
    const primary = apis[primaryAt];
    const clocks = apis.filter((_, i) => !plan.units[i].scroll);
    const each = (run: (t: PxTimelineControls) => void) => (): void => { for (const api of clocks) run(api.timeline); };

    const timeline: PxTimelineControls = {
        ...primary.timeline,
        "start": each(t => t.start()),
        "play": each(t => t.play()),
        "stop": each(t => t.stop()),
        "pause": each(t => t.pause()),
        "resume": each(t => t.resume()),
        "setSpeed": (speed) => { for (const api of clocks) api.timeline.setSpeed(speed); },
    };

    const machines = plan.units.map((unit, i) => ({ unit, api: apis[i] })).filter(x => x.unit.stateMachine !== undefined);
    const machineOf = (stateMachine: string | undefined) => stateMachine === undefined
        ? machines.find(x => x.unit.stateMachine === '') ?? machines[0]
        : machines.find(x => x.unit.stateMachine === stateMachine);
    const ownerOf = (state: string) => machines.find(x => x.unit.states.some(st => st.id === state));
    const state: PxStateControls = {
        "goTo": (id) => ownerOf(id)?.api.state.goTo(id),
        "next": (stateMachine) => machineOf(stateMachine)?.api.state.next(),
        "previous": (stateMachine) => machineOf(stateMachine)?.api.state.previous(),
        "get": (stateMachine) => stateMachine === undefined ? machines.flatMap(x => x.api.state.get()) : machineOf(stateMachine)?.api.state.get() ?? [],
        "getAll": () => machines.flatMap(x => x.api.state.getAll()),
    };

    const unitOfTimeline = (id: string): PxPlayerEngineApi | undefined => {
        const at = plan.timelines.findIndex(t => t.id === id);
        if (at < 0) return undefined;
        const unit = plan.units.findIndex(u => u.timelines.includes(at));
        return unit < 0 ? undefined : apis[unit];
    };

    return {
        timeline,
        state,
        getTimeline: (id) => unitOfTimeline(id)?.timeline,
        stateHolder: {
            hold: (id, mount) => ownerOf(id)?.api.stateHolder?.hold(id, mount),
            release: () => { for (const x of machines) x.api.stateHolder?.release(); },
        },
        isReady: () => apis.every(api => api.isReady()),
        getRootElement: () => primary.getRootElement(),
        destroy: () => { for (const api of apis) api.destroy(); },
    };
}
