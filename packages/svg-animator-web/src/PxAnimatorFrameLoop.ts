/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { camelCaseToKebabWordIfNeeded, createBasicFrameLoopAnimator, getAnimatorConfig, isScrollTimeline, STYLE_ATTR_NAMES, type PxAnimatedSvgDocument, type PxAnimatorCallbacksConfig, type PxPlatformAdapter } from '@pixodesk/svg-animator-core';
import { setupAnimationTriggers } from './PxAnimatorTriggers';
import type { PxAnimatorAPI } from './PxAnimatorWebTypes';

// Re-export the platform-neutral pieces from their historical home so the
// package surface is unchanged by the core extraction.
export { createBasicFrameLoopAnimator };
export type { PxPlatformAdapter };

export function getSelector(id: string) {
    // return `[data-px-id="${id}"]`; FIXME
    return '#' + id;
}


////////////////////////////////////////////////////////////////
// Browser DOM implementation
////////////////////////////////////////////////////////////////



/**
 * Creates an animator instance that uses a requestAnimationFrame loop for animations.
 * This is the browser DOM-specific version.
 *
 * @param {PxAnimatorCallbacksConfig=} callbacks Optional lifecycle callbacks.
 * @param {Element=} rootElement Optional pre-rendered root element.
 * @returns {PxAnimatorAPI} A PxAnimatorAPI instance.
 */
export function createFrameLoopAnimator(
    doc: PxAnimatedSvgDocument,
    adapter?: PxPlatformAdapter,
    callbacks?: PxAnimatorCallbacksConfig,
    rootElement?: Element | null
): PxAnimatorAPI {

    const config = getAnimatorConfig(doc) || {};

    // Use provided root element or try to find by selector
    if (!rootElement) {
        if (doc.id) {
            const rootSelector = getSelector(doc.id);
            rootElement = document.querySelector(rootSelector);
            if (!rootElement) console.warn("createFrameLoopAnimator: No root element found for selector: ", rootSelector);
        } else {
            console.warn("createFrameLoopAnimator: No root element provided");
        }
    }

    const basicApi = createBasicFrameLoopAnimator(
        doc,
        adapter || createDomAdapter(rootElement),
        callbacks
    );

    // Specialise the platform-neutral API to the DOM: the root is an Element.
    const api: PxAnimatorAPI = {
        ...basicApi,
        "getRootElement": () => rootElement || null
    };
    // D3 (scroll-timeline.design.md): triggers are meaningless when the playhead is
    // scroll-driven — writers must not emit them, and a document that carries them
    // anyway gets a warning, not behaviour.
    if (config.trigger) {
        if (isScrollTimeline(config)) {
            console.warn('scroll timeline: `animator.trigger` is ignored (triggers do not apply to scroll-driven playback)');
        } else {
            setupAnimationTriggers(api, config.trigger);
        }
    }
    return api;
}

export function createDomAdapter(rootElement?: Element | null) {
    // Track warnings to avoid spamming console
    const warnedSelectors = new Set<string>();

    const adapter: PxPlatformAdapter = {
        isConnected: () => {
            if (!rootElement) return true; // No root element means we're always "connected"
            return rootElement.isConnected;
        },
        setAttribute: (id, attrName, value) => {

            attrName = camelCaseToKebabWordIfNeeded(attrName);

            const selector = getSelector(id);

            // Query elements by selector within root (or document if no root)
            const elements = rootElement?.querySelectorAll(selector) || document.querySelectorAll(selector);

            if (elements.length === 0 && !warnedSelectors.has(selector)) {
                warnedSelectors.add(selector);
                console.warn('setAttribute: No elements found for selector "' + selector + '"');
            }

            for (let i = 0; i < elements.length; i++) {
                const element = elements[i];
                // `<pattern>` ignores the plain `transform` ATTRIBUTE (it transforms via
                // `patternTransform`). The WAAPI engine drives the same animation through
                // CSS `transform`, which browsers do apply to patterns — remap here so the
                // frames engine animates everything WAAPI animates.
                const effectiveAttrName = attrName === 'transform' && element.tagName === 'pattern'
                    ? 'patternTransform'
                    : attrName;
                element.setAttribute(effectiveAttrName, value);
                if (STYLE_ATTR_NAMES.has(attrName)) {
                    (element as HTMLElement).style[attrName as any] = value;
                }
            }
        },
    };
    return adapter;
}