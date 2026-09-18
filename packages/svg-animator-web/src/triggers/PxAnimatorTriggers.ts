/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { PxDiagnosticCode, PxDiagnosticKind, PxMouseOutAction, PxTriggerStart, resolveTrigger,
    type PxDiagnostics, type PxTrigger } from '@pixodesk/svg-animator-core';
import { createDiagnostics } from '@pixodesk/svg-animator-core/internal';
import type { PxAnimatorApi } from '../shared/PxAnimatorWebTypes';
import { createVisibilityGate } from './PxVisibilityGate';


/**
 * Wires a document's trigger block to its root element.
 *
 * TWO INDEPENDENT AXES, which is why there is no `scrollIntoView` here:
 *  - `start` — what STARTS the animation: 'load' (default), 'mouseOver', 'click', or 'none'
 *    (nothing but the API does).
 *  - `offScreen` + `visibilityThreshold` + `visibilityDebounce` — whether it may RUN, whatever
 *    started it. Owned by {@link createVisibilityGate}, wired for every document.
 *
 * `start: 'load'` behind the default gate is what `startOn: 'scrollIntoView'` used to mean: hold
 * at frame 0 until enough is on screen, play, pause when it leaves, resume when it returns. The
 * difference is that the same gate now also applies to a document started by a click or a hover.
 *
 * `mouseOut` is what happens when the pointer LEAVES ('continue' by default, or pause / reset /
 * reverse); it is read only for `start: 'mouseOver'`. A `click` document is a plain play/pause
 * toggle with nothing to configure.
 *
 * @param api The animator API instance to control.
 * @param trigger The trigger configuration. `finish` belongs to the PLAYER (what happens after a
 *   natural end), not to the trigger wiring, and is not read here.
 * @returns A disposer that detaches every listener, observer and timer this call attached
 *   (review §14). `createAnimator` ties it to `destroy()`. Call it yourself before re-arming an
 *   element you wired by hand — otherwise the old listeners stay live next to the new ones.
 * @public
 */
export function setupAnimationTriggers(
    api: PxAnimatorApi,
    trigger: PxTrigger,
    diag?: PxDiagnostics
): () => void {
    // Public export, so the channel is optional and falls back to the console (review §5).
    const report = diag ?? createDiagnostics(undefined, '[PxAnimator]');

    // Everything attached below registers its own undo here, so one call detaches it all.
    const cleanups: Array<() => void> = [];
    const dispose = (): void => { for (const undo of cleanups.splice(0)) undo(); };
    // The defaults come from core's one table, shared with every player (`PX_TRIGGER_DEFAULTS`):
    // no `start` = 'load', no `offScreen` = 'pause', no `mouseOut` = 'continue', no threshold
    // = 0.5, no debounce = 150ms. The threshold default must match the editor model's
    // (TSvgSvgAnimationAttr.visibilityThreshold), which OMITS the value on the wire when it equals it.
    const resolved = resolveTrigger(trigger);

    const root = api.getRootElement();

    if (!root) {
        report.warn(PxDiagnosticKind.host, PxDiagnosticCode.triggersNoRoot);
        return dispose;
    }

    // Tracks whether the LAST mouse-out action put the animation into reverse, so the next start
    // can restore forward playback without clobbering a custom playback rate set through the API.
    let reversed = false;

    /** Ensures forward playback and starts or resumes the animation. */
    const start = (): void => {
        if (reversed) {
            reversed = false;
            api.setPlaybackRate(1);
        }
        api.play();
    };

    // Permission to run, for every document and whatever starts it.
    const gate = createVisibilityGate(root, resolved, {
        isPlaying: () => api.isPlaying(),
        play: start,
        pause: () => api.pause(),
        cancel: () => api.cancel(),
    });
    cleanups.push(() => gate.dispose());

    /** What to do when the pointer leaves — `start: 'mouseOver'` only. */
    const handleMouseOut = (): void => {
        switch (resolved.mouseOut) {
            case PxMouseOutAction.pause:
                api.pause();
                break;
            case PxMouseOutAction.reset:
                api.cancel();
                break;
            case PxMouseOutAction.reverse:
                // Play the animation backwards from its current position.
                reversed = true;
                api.setPlaybackRate(-1);
                api.play();
                break;
            case PxMouseOutAction.continue:
            default:
                // Do nothing
                break;
        }
    };

    // ---- What starts it ----
    switch (resolved.start) {
        case PxTriggerStart.load: {
            // The only start that the gate may hold: nobody interacted, so there is nothing to
            // honour immediately. `requestStart(false)` plays now if enough is already on screen
            // (after the debounce), and otherwise waits for it to be.
            const startHandler = () => gate.requestStart(false);
            if (document.readyState === 'complete') {
                startHandler();
            } else {
                window.addEventListener('load', startHandler, { once: true });
                cleanups.push(() => window.removeEventListener('load', startHandler));
            }
            break;
        }

        case PxTriggerStart.mouseOver: {
            // An OUT may only follow an IN. A `mouseleave` with no preceding `mouseenter` happens
            // when the pointer is already over the element at load and then moves away — and for
            // `mouseOut: 'reverse'` the out action PLAYS (`setPlaybackRate(-1); play()`), so an
            // untriggered leave would start the animation running backwards.
            let enteredOnce = false;
            const mouseOverHandler = () => { enteredOnce = true; gate.requestStart(true); };
            const mouseOutHandler = () => { if (enteredOnce) handleMouseOut(); };

            root.addEventListener('mouseenter', mouseOverHandler);
            root.addEventListener('mouseleave', mouseOutHandler);
            cleanups.push(() => {
                root.removeEventListener('mouseenter', mouseOverHandler);
                root.removeEventListener('mouseleave', mouseOutHandler);
            });
            break;
        }

        case PxTriggerStart.click: {
            // A plain toggle. The reader is pointing at it, so a start never waits for the gate.
            const clickHandler = () => {
                if (api.isPlaying()) api.pause();
                else gate.requestStart(true);
            };
            root.addEventListener('click', clickHandler);
            cleanups.push(() => root.removeEventListener('click', clickHandler));
            break;
        }

        case PxTriggerStart.none:
            // No auto-start; external code must call play(). The gate still applies afterwards,
            // so an API-started animation pauses when it scrolls out of view.
            break;
    }

    return dispose;
}
