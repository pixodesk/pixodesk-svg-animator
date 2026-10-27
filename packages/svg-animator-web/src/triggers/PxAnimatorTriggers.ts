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
    type PxAnimatorRuntimeConfig,
    type PxDiagnostics,
} from '@pixodesk/svg-animator-core';
import { ensurePlayExecutor, resolveGate, resolveTrigger, triggerActionFor, triggerConflicts, triggerListsEvent } from '@pixodesk/svg-animator-core/engine';
import { createDiagnostics } from '@pixodesk/svg-animator-core/internal';
import type { PxEngineAnimationPlayerApi } from '../shared/PxAnimatorWebTypes';
import { webRaf } from '../shared/PxWebRaf';
import { createVisibilityGate } from './PxVisibilityGate';

/**
 * Wires a document's trigger to its root element (dev-docs/plans/component-api.md D5).
 *
 * The trigger says only WHEN: four event lists — `playOn`, `playOff`, `pauseOn`, `pauseOff` — over
 * the events `load`, `hoverIn`, `hoverOut`, `click`. Which list an event is read from is the STATE
 * RULE: `playOn` acts when stopped, `pauseOn` when playing, `pauseOff` when paused (an omitted
 * `pauseOff` is a copy of `playOn`), `playOff` when playing or paused. An event in both `playOff`
 * and `pauseOn` is a contradiction that is reported; `pauseOn` wins. An absent trigger block plays
 * on load; an EMPTY one lists nothing — only the api drives it.
 *
 * HOW is the timeline's own and performed by the player's one executor (`playOnAction`,
 * `playOffAction`, `completeIterationOnPlayOff`), shared with the api's `play()` / `stop()`, so a
 * click and a `player.play()` do exactly the same thing. The visibility gate (`outOfViewAction`,
 * `inViewThreshold`, `inViewDebounce`, timeline keys too) decides whether it may RUN, whatever
 * started it; only `load` waits for it — a hover or a click is aimed at something the reader sees.
 *
 * @param api The engine api to wire; the executor is attached to it as `playExecutor`.
 * @param config The document's runtime view (`getAnimatorConfig(doc)`): the trigger, the gate and the play keys.
 * @returns A disposer that detaches every listener, observer and timer this call attached
 *   (review §14). `createSvgAnimationPlayer` ties it to `destroy()`. Call it yourself before re-arming an
 *   element you wired by hand — otherwise the old listeners stay live next to the new ones.
 * @public
 */
export function setupAnimationTriggers(
    api: PxEngineAnimationPlayerApi,
    config: PxAnimatorRuntimeConfig,
    diag?: PxDiagnostics
): () => void {
    // Public export, so the channel is optional and falls back to the console (review §5).
    const report = diag ?? createDiagnostics(undefined, '[PxAnimator]');

    // Everything attached below registers its own undo here, so one call detaches it all.
    const cleanups: Array<() => void> = [];
    const dispose = (): void => { for (const undo of cleanups.splice(0)) undo(); };

    const trigger = resolveTrigger(config.trigger);
    for (const event of triggerConflicts(trigger)) report.warn(PxDiagnosticKind.usage, PxDiagnosticCode.triggerEventConflict, event);

    const root = api.getRootElement();
    if (!root) {
        report.warn(PxDiagnosticKind.host, PxDiagnosticCode.triggersNoRoot);
        return dispose;
    }

    const executor = ensurePlayExecutor(api, config, webRaf);

    // Permission to run, for every document and whatever starts it. The gate's own hold and
    // release are the ENGINE's — a hold is not a user pause.
    const gate = createVisibilityGate(root, resolveGate(config), {
        isPlaying: () => api.isPlaying(),
        start: () => executor.play(),
        hold: () => api.pause(),
        release: () => api.play(),
        reset: () => executor.cancel(),
    });
    cleanups.push(() => gate.dispose());

    const listed = (event: PxTriggerEvent): boolean => triggerListsEvent(trigger, event);

    /** The state rule (core's `triggerActionFor`): the player's state picks the list an event is read
     *  from. `direct` is a pointer interaction — it never waits out the gate. */
    const fire = (event: PxTriggerEvent, direct: boolean): void => {
        switch (triggerActionFor(trigger, executor.state(), event)) {
            case PxTriggerAction.play: gate.requestStart(direct); break;
            case PxTriggerAction.pause: executor.pause(); break;
            case PxTriggerAction.off: executor.off(); break;
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
        // pointer is already over the element at load and then moves away — and a `playOff: 'hoverOut'`
        // with `playOffAction: 'rewind'` would start the animation running backwards.
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
