/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { PxTrigger } from '@pixodesk/svg-animator-core';
import type { PxAnimatorAPI } from './PxAnimatorWebTypes';


/**
 * Sets up event-based triggers for an animation.
 *
 * This function attaches event listeners to the animation's root element based on the
 * provided configuration, allowing animations to be started by user interactions
 * or visibility changes.
 *
 * ### Trigger Options (startOn):
 * - 'load': Starts after the page loads.
 * - 'mouseOver': Starts on mouse enter.
 * - 'click': Toggles play/end action on click.
 * - 'scrollIntoView': Starts when the element scrolls into the viewport.
 * - 'programmatic': No automatic start. Must be controlled via the API.
 *
 * ### End Action Options (outAction):
 * Defines behavior when the trigger condition ends (e.g., mouse leave).
 * - 'continue': Animation continues playing.
 * - 'pause': Pauses the animation.
 * - 'reset': Cancels the animation, resetting it to the start.
 * - 'reverse': Reverses the animation playback.
 *
 * @param {!PxAnimatorAPI} api The animator API instance to control.
 * @param {!PxTrigger} config The trigger configuration object.
 * @returns {!PxAnimatorAPI} The same animator API instance, for chaining.
 */
export function setupAnimationTriggers(
    api: PxAnimatorAPI,
    config: PxTrigger
): PxAnimatorAPI {
    // Threshold default 0 — "any pixel visible starts it". Keep in sync with the editor
    // model's default (TSvgSvgAnimationAttr.scrollIntoViewThreshold), which OMITS the
    // value on the wire when it equals this default.
    const { startOn, outAction = 'continue', scrollIntoViewThreshold = 0 } = config;

    const root = api.getRootElement();

    if (!root) {
        console.warn('setupAnimationTriggers: No root element found for animation.');
        return api;
    }

    // Tracks whether the LAST out-action put the animation into reverse, so the
    // next trigger start can restore forward playback without clobbering a
    // custom playback rate the user may have set through the API.
    let reversed = false;

    /** Ensures forward playback and starts or resumes the animation. */
    const start = () => {
        if (reversed) {
            reversed = false;
            api.setPlaybackRate(1);
        }
        api.play();
    };

    /** Handles what to do when the element leaves the active trigger condition. */
    const handleEndAction = () => {
        switch (outAction) {
            case 'pause':
                api.pause();
                break;
            case 'reset':
                api.cancel();
                break;
            case 'reverse':
                // Play the animation backwards from its current position.
                reversed = true;
                api.setPlaybackRate(-1);
                api.play();
                break;
            case 'continue':
            default:
                // Do nothing
                break;
        }
    };

    // ---- Setup event-based start logic ----
    switch (startOn) {
        case 'load': {
            const startHandler = () => start();
            if (document.readyState === 'complete') {
                startHandler();
            } else {
                window.addEventListener('load', startHandler, { once: true });
            }
            break;
        }

        case 'mouseOver': {
            // An OUT may only follow an IN. A `mouseleave` with no preceding `mouseenter` happens
            // when the pointer is already over the element at load and then moves away — and for
            // `outAction: 'reverse'` the out action PLAYS (`setPlaybackRate(-1); play()`), so an
            // untriggered leave would start the animation running backwards. Same class of bug as
            // the scrollIntoView initial-intersection case handled below.
            let enteredOnce = false;
            const mouseOverHandler = () => { enteredOnce = true; start(); };
            const mouseOutHandler = () => { if (enteredOnce) handleEndAction(); };

            root.addEventListener('mouseenter', mouseOverHandler);
            root.addEventListener('mouseleave', mouseOutHandler);
            break;
        }

        case 'click': {
            const clickHandler = () => {
                if (api.isPlaying()) {
                    handleEndAction();
                } else {
                    start();
                }
            };
            root.addEventListener('click', clickHandler);
            break;
        }

        case 'scrollIntoView': {
            // `observe()` delivers an INITIAL entry describing the CURRENT state, which is how an
            // element that is already on screen starts without any scrolling. But that same initial
            // entry also reports "not intersecting" for an element merely below the fold — and
            // treating that as an out-action ran it before anything had ever played. For `reverse`
            // that meant `setPlaybackRate(-1)` + `play()`, i.e. the animation started running
            // BACKWARDS on page load. An OUT is only meaningful after an IN, so require one.
            // A target TALLER than the viewport can never reach a high ratio (ratio is measured
            // against the TARGET's own size), so a 0.5/0.9 threshold would be unsatisfiable and the
            // animation would never play. Normalise by what could possibly be visible, and register
            // a granular threshold list — registering the raw threshold would mean the callback
            // never fires at all for such a target.
            const effectiveRatio = (entry: IntersectionObserverEntry): number => {
                const target = entry.boundingClientRect;
                const visible = entry.intersectionRect;
                // Simplified entries (tests, older engines) may omit the rects — fall back to the
                // browser's own ratio rather than inventing one.
                if (!target?.height || !visible) return entry.intersectionRatio;
                // Use the SMALLER of `rootBounds` and the live viewport. `rootBounds` can be null
                // (implicit root in some embeddings) and can also report a box LARGER than the
                // actual viewport — trusting it then reinstates the very cap this normalisation
                // exists to remove. `intersectionRect` is already clipped to the real viewport, so
                // the denominator must be too.
                const live = typeof window !== 'undefined' && window.innerHeight ? window.innerHeight : Infinity;
                const declared = entry.rootBounds?.height ?? Infinity;
                const viewport = Math.min(live, declared);
                const denom = Math.min(target.height, Number.isFinite(viewport) ? viewport : target.height);
                return denom > 0 ? visible.height / denom : entry.intersectionRatio;
            };
            const thresholdSteps = Array.from({ length: 21 }, (_, i) => i / 20);
            let wasIntersecting = false;
            const observer = new IntersectionObserver(
                entries => {
                    entries.forEach(entry => {
                        // If the element is at least partially visible
                        if (entry.isIntersecting && effectiveRatio(entry) >= scrollIntoViewThreshold) {
                            wasIntersecting = true;
                            start();
                        } else if (wasIntersecting) {
                            // Element scrolled OFF screen after having been on it -> out action
                            wasIntersecting = false;
                            handleEndAction();
                        }
                    });
                },
                { threshold: thresholdSteps }
            );
            observer.observe(root);
            break;
        }

        case 'programmatic':
            // No auto-start; external code must call play()
            break;
    }

    return api;
}
