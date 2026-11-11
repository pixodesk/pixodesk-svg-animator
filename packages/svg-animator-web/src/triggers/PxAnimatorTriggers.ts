// @px-area control
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import {
    PxDiagnosticCode,
    PxDiagnosticKind,
    PxTriggerAction,
    PxTriggerEvent,
    PxTriggerIssueKind,
    type PxAnimatorRuntimeConfig,
    type PxDiagnostics,
    type PxRunListeners,
} from '@pixodesk/svg-animator-core';
import { ensurePlayExecutor, resolveGate, resolveTriggers, triggerActionFor, triggerIssues, triggerListsEvent } from '@pixodesk/svg-animator-core/engine';
import { createDiagnostics } from '@pixodesk/svg-animator-core/internal';
import type { PxEngineAnimationPlayerApi } from '../shared/PxAnimatorWebTypes';
import { webRaf } from '../shared/PxWebRaf';
import { createVisibilityGate } from './PxVisibilityGate';

/** The diagnostic each kind of trigger problem is reported as. */
function triggerIssueCode(kind: PxTriggerIssueKind): PxDiagnosticCode {
    switch (kind) {
        case PxTriggerIssueKind.collision: return PxDiagnosticCode.triggerEventConflict;
        case PxTriggerIssueKind.eventNotAllowed: return PxDiagnosticCode.triggerEventNotAllowed;
        case PxTriggerIssueKind.resumeExtra:
        case PxTriggerIssueKind.resumeMissing: return PxDiagnosticCode.triggerResumeDiffers;
    }
}

/**
 * Wires a document's triggers to its root element (dev-docs/plans/playback-layers.md, layer 0).
 *
 * The triggers say only WHEN: event lists — the four buttons `startRun`, `stopRun`, `pauseRun`, and `resumeRun`
 * (derived unless the file names it) — over the events `load`, `hoverIn`, `hoverOut`, `click`, each list naming only
 * the events it can use. Which list an event is read from is the STATE RULE: `startRun` acts when off, finished or
 * returning, `pauseRun` when playing, `resumeRun` when paused (derived: the counterpart of each `pauseRun` event, plus
 * the `startRun` events that do not stop), `stopRun` when playing, paused or finished. Every problem `triggerIssues`
 * finds is reported — a disallowed event (ignored), a named `resumeRun` list that differs from the derivation
 * (honoured), two lists reacting to one event in the same state (the pause or the resume wins). An absent triggers
 * block plays on load; an EMPTY one lists nothing — only the api drives it.
 *
 * HOW is the timeline's `actions` block, performed by the player's one executor, shared with the api's
 * `startRun()` / `stopRun()`, so a click and a `player.startRun()` do exactly the same thing. The visibility gate
 * (`actions.outOfView`, `inViewThreshold`, `inViewDebounce`) decides whether it may RUN, whatever
 * started it; only `load` waits for it — a hover or a click is aimed at something the reader sees.
 *
 * @param api The engine api to wire; the executor is attached to it as `playExecutor`.
 * @param config The document's runtime view (`getAnimatorConfig(doc)`): the action triggers, the actions and the gate numbers.
 * @returns A disposer that detaches every listener, observer and timer this call attached
 *   (review §14). `createSvgAnimationPlayer` ties it to `destroy()`. Call it yourself before re-arming an
 *   element you wired by hand — otherwise the old listeners stay live next to the new ones.
 * @public
 */
export function setupAnimationTriggers(
    api: PxEngineAnimationPlayerApi,
    config: PxAnimatorRuntimeConfig,
    diag?: PxDiagnostics,
    runListeners?: PxRunListeners
): () => void {
    // Public export, so the channel is optional and falls back to the console (review §5).
    const report = diag ?? createDiagnostics(undefined, '[PxAnimator]');

    // Everything attached below registers its own undo here, so one call detaches it all.
    const cleanups: Array<() => void> = [];
    const dispose = (): void => { for (const undo of cleanups.splice(0)) undo(); };

    const trigger = resolveTriggers(config.actionTriggers);
    for (const issue of triggerIssues(config.actionTriggers)) report.warn(PxDiagnosticKind.usage, triggerIssueCode(issue.kind), issue);

    const root = api.getRootElement();
    if (!root) {
        report.warn(PxDiagnosticKind.host, PxDiagnosticCode.triggersNoRoot);
        return dispose;
    }

    const executor = ensurePlayExecutor(api, config, webRaf);
    // attached BEFORE anything below can press a button: a `load` trigger fires right here when the document is complete
    if (runListeners) executor.setListeners(runListeners);

    // Permission to run, for every document and whatever starts it. The gate's own hold and
    // release are the ENGINE's — a hold is not a user pause.
    const gate = createVisibilityGate(root, resolveGate(config), {
        isPlaying: () => api.isPlaying(),
        start: () => executor.startRun(),
        hold: () => api.pause(),
        release: () => api.play(),
        jumpToStart: () => executor.jumpToStart(),
    });
    cleanups.push(() => gate.dispose());

    const listed = (event: PxTriggerEvent): boolean => triggerListsEvent(trigger, event);

    /** The state rule (core's `triggerActionFor`): the player's state picks the list an event is read
     *  from — off · playing · paused · finished · returning. `direct` is a pointer interaction — it never waits out
     *  the gate; a resume never does either (a paused run was seen). */
    const fire = (event: PxTriggerEvent, direct: boolean): void => {
        switch (triggerActionFor(trigger, executor.state(), event)) {
            case PxTriggerAction.startRun: gate.requestStart(direct); break;
            case PxTriggerAction.resumeRun: executor.resumeRun(); break;
            case PxTriggerAction.pauseRun: executor.pauseRun(); break;
            case PxTriggerAction.stopRun: executor.stopRun(); break;
        }
    };

    if (listed(PxTriggerEvent.load)) {
        // The document being ready. The only event the gate may hold: nobody interacted, so there is
        // nothing to honour at once — the gate plays when enough is on screen (after the debounce).
        const onLoad = (): void => fire(PxTriggerEvent.load, false);
        if (document.readyState === 'complete') {
            onLoad();
        } else {
            window.addEventListener('load', onLoad, { once: true });
            cleanups.push(() => window.removeEventListener('load', onLoad));
        }
    }

    const usesHoverOut = listed(PxTriggerEvent.hoverOut);
    if (listed(PxTriggerEvent.hoverIn) || usesHoverOut) {
        // An OUT may only follow an IN. A `mouseleave` with no preceding `mouseenter` happens when the
        // pointer is already over the element at load and then moves away — and a `stop: 'hoverOut'`
        // with a rewinding stop would start the animation running backwards.
        let enteredOnce = false;
        const onEnter = (): void => { enteredOnce = true; fire(PxTriggerEvent.hoverIn, true); };
        root.addEventListener('mouseenter', onEnter);
        cleanups.push(() => root.removeEventListener('mouseenter', onEnter));
        if (usesHoverOut) {
            const onLeave = (): void => { if (enteredOnce) fire(PxTriggerEvent.hoverOut, true); };
            root.addEventListener('mouseleave', onLeave);
            cleanups.push(() => root.removeEventListener('mouseleave', onLeave));
        }
    }

    if (listed(PxTriggerEvent.click)) {
        const onClick = (): void => fire(PxTriggerEvent.click, true);
        root.addEventListener('click', onClick);
        cleanups.push(() => root.removeEventListener('click', onClick));
    }

    return dispose;
}
