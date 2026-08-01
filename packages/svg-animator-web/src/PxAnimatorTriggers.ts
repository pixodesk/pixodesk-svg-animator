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
            const mouseOverHandler = () => start();
            const mouseOutHandler = () => handleEndAction();

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
            let wasIntersecting = false;
            const observer = new IntersectionObserver(
                entries => {
                    entries.forEach(entry => {
                        // If the element is at least partially visible
                        if (entry.isIntersecting && entry.intersectionRatio >= scrollIntoViewThreshold) {
                            wasIntersecting = true;
                            start();
                        } else if (wasIntersecting) {
                            // Element scrolled OFF screen after having been on it -> out action
                            wasIntersecting = false;
                            handleEndAction();
                        }
                    });
                },
                { threshold: scrollIntoViewThreshold }
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
