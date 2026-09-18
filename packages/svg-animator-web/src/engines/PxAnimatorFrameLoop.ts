/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { createAdapterAnimator, getAnimatorConfig, PxDiagnosticCode, PxDiagnosticKind, type PxAnimatedSvgDocument, type PxEngineCallbacks, type PxDiagnostics, type PxPlatformAdapter } from '@pixodesk/svg-animator-core';
import { camelCaseToKebabWordIfNeeded, createDiagnostics, isScrollTimeline, PX_STYLE_ATTR_NAMES } from '@pixodesk/svg-animator-core/internal';
import { setupAnimationTriggers } from '../triggers/PxAnimatorTriggers';
import type { PxAnimatorApi } from '../shared/PxAnimatorWebTypes';

// Re-export the platform-neutral pieces from their historical home so the
// package surface is unchanged by the core extraction.
export { createAdapterAnimator };
export type { PxPlatformAdapter };

/**
 * An id as a CSS id-selector, ESCAPED.
 *
 * `'#' + id` is not valid CSS whenever the id starts with a digit — and editor ids often do
 * (`2kjrlj4l`), because SVG and HTML both allow it where CSS does not. `querySelector` then
 * THROWS a SyntaxError rather than returning null, so the animation never starts and the
 * document looks broken for a reason nothing in it explains. Punctuation has the same problem.
 */
export function getSelector(id: string) {
    // return `[data-px-id="${id}"]`; FIXME
    return '#' + escapeCssId(id);
}

/** `CSS.escape` where the engine has it; otherwise the two rules that actually bite. */
function escapeCssId(id: string): string {
    const css = (globalThis as { CSS?: { escape?: (value: string) => string } }).CSS;
    if (typeof css?.escape === 'function') return css.escape(id);
    return id
        // A leading digit is spelled as its hex code point plus a separating space.
        .replace(/^([0-9])/, (_all, digit: string) => '\\3' + digit + ' ')
        // Anything outside the CSS identifier set is backslash-escaped.
        .replace(/([^\w\-\\ ])/g, '\\$1');
}


////////////////////////////////////////////////////////////////
// Browser DOM implementation
////////////////////////////////////////////////////////////////



/**
 * Creates an animator instance that uses a requestAnimationFrame loop for animations.
 * This is the browser DOM-specific version.
 *
 * @param {PxEngineCallbacks=} callbacks Optional lifecycle callbacks.
 * @param {Element=} rootElement Optional pre-rendered root element.
 * @returns {PxAnimatorApi} A PxAnimatorApi instance.
 * @internal
 */
export function createFrameLoopAnimator(
    doc: PxAnimatedSvgDocument,
    adapter?: PxPlatformAdapter,
    callbacks?: PxEngineCallbacks,
    rootElement?: Element | null
): PxAnimatorApi {

    const config = getAnimatorConfig(doc) || {};

    // One channel for everything this engine has to say (API review §5).
    const diag = createDiagnostics(callbacks, '[PxAnimator]');

    // Use provided root element or try to find by selector
    if (!rootElement) {
        if (doc.id) {
            const rootSelector = getSelector(doc.id);
            rootElement = document.querySelector(rootSelector);
            if (!rootElement) diag.warn(PxDiagnosticKind.host, PxDiagnosticCode.noRootForSelector, rootSelector);
        } else {
            diag.warn(PxDiagnosticKind.host, PxDiagnosticCode.noRootElement);
        }
    }

    const basicApi = createAdapterAnimator(
        doc,
        adapter || createDomAdapter(rootElement, diag),
        callbacks
    );

    // Specialize the platform-neutral API to the DOM: the root is an Element.
    const api: PxAnimatorApi = {
        ...basicApi,
        "getRootElement": () => rootElement || null
    };
    // D3 (scroll-timeline.design.md): triggers are meaningless when the playhead is
    // scroll-driven — writers must not emit them, and a document that carries them
    // anyway gets a warning, not behavior.
    // Every time-driven document IS wired: no `trigger` means the defaults (`start` 'load',
    // `offScreen` 'pause' — so an unseen animation does not run).
    if (isScrollTimeline(config)) {
        if (config.trigger) diag.warn(PxDiagnosticKind.usage, PxDiagnosticCode.scrollTriggerIgnored);
    } else {
        // The disposer rides on destroy(), so the listeners go when the animator does (§14).
        const detachTriggers = setupAnimationTriggers(api, config.trigger ?? {}, diag);
        const destroyEngine = api.destroy.bind(api);
        api.destroy = () => { detachTriggers(); destroyEngine(); };
    }
    return api;
}

export function createDomAdapter(rootElement?: Element | null, diag?: PxDiagnostics) {
    // Track warnings to avoid spamming console
    const warnedSelectors = new Set<string>();
    // Called directly by consumers too, so the channel is optional and defaults to the console.
    const report = diag ?? createDiagnostics(undefined, '[PxAnimator]');

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
                report.warn(PxDiagnosticKind.host, PxDiagnosticCode.setAttributeNoElement, selector);
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
                if (PX_STYLE_ATTR_NAMES.has(attrName)) {
                    (element as HTMLElement).style[attrName as any] = value;
                }
            }
        },
    };
    return adapter;
}