/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { createDiagnostics, getDefs, getNormalizedProps, resolveStyle, sanitizeAttributeValue, camelCaseToKebabWordIfNeeded, CSS_ONLY_STYLE_PROPS, DISALLOWED_SVG_TAGS_LOWER, PxDiagnosticKind, TEXT_CONTENT_ATTR, type PxAnimatedSvgDocument, type PxDefs, type PxDiagnostics, type PxNode } from '@pixodesk/svg-animator-core';

// Re-export from the historical home so the package surface is unchanged.
export { getNormalizedProps };


const SVG_NS = 'http://www.w3.org/2000/svg';

function createElement(
    tagName: string,
    normalizedProps: { [k: string]: string },
    style: Record<string, string | number> | undefined,
    children: Array<Element> | undefined,
    textContent?: string,
    diag?: PxDiagnostics
): SVGElement | null {
    if (DISALLOWED_SVG_TAGS_LOWER.has(tagName.toLowerCase())) {
        // `document`: a blocked tag is content the FILE asked for, so the file is what changes.
        (diag ?? createDiagnostics(undefined, '[PxAnimator]'))
            .warn(PxDiagnosticKind.document, 'SVG tag blocked (dangerous): ' + tagName);
        return null;
    }

    const element = document.createElementNS(SVG_NS, tagName);

    for (const propName in normalizedProps) {
        // `sanitizeAttributeValue` returns `undefined` to mean "do not emit"
        // (whitelist miss, blocked dangerous value, …). Browsers coerce
        // `undefined` to the literal string `"undefined"` at `setAttribute`,
        // which is exactly the bug we keep hitting — skip instead.
        const sanitized = sanitizeAttributeValue(propName, normalizedProps[propName]);
        if (sanitized === undefined) continue;
        // CSS-only properties (mix-blend-mode, isolation) aren't SVG presentation
        // attributes — the browser ignores them via setAttribute, so route them
        // through `element.style` (camelCase key) instead.
        if (CSS_ONLY_STYLE_PROPS.has(propName)) {
            (element as unknown as { style: Record<string, string> }).style[propName] = String(sanitized);
            continue;
        }
        element.setAttribute(camelCaseToKebabWordIfNeeded(propName), sanitized);
    }

    // Apply style properties directly (avoids kebab-case issues)
    if (style) {
        for (const styleProp in style) {
            (element as any).style[styleProp] = String(style[styleProp]);
        }
    }

    // Children first, and a node's own `textContent` ONLY when it has none: a line <tspan> can
    // carry both, and then the styled child spans are what renders. Assigning `textContent` with
    // children already appended REPLACES them (DOM semantics), so the spans were added and
    // immediately dropped — every other player keeps the children.
    if (children?.length) {
        for (const child of children) {
            element.appendChild(child);
        }
    } else if (textContent) {
        element.textContent = textContent;
    }

    return element;
}


/**
 * Renders a PxNode tree to DOM elements.
 */
export function renderNode(node: PxNode, defs?: PxDefs, diag?: PxDiagnostics): Element | null {
    if (!node) return null;

    const { type, children, style, ...props } = node;

    // ESCAPE KEY (S2): an element whose SVG `type` ATTRIBUTE collides with the
    // reserved node-tag key carries it as `domType` instead — `feColorMatrix`
    // (matrix/saturate/…), `feTurbulence` (fractalNoise/turbulence), `feFunc*`
    // (identity/table/…). Written by the editor at one choke point
    // (`TDomElement.createJsonWithPlayerEffects`); `type` itself is an
    // INTERNAL_ATTR that `getNormalizedProps` drops, so re-apply it here onto the
    // created element. Without this the primitive is lost and an EMPTY `<filter>`
    // paints its target transparent black.
    const domType = (props as { domType?: string }).domType;
    if (domType !== undefined) delete (props as { domType?: string }).domType;

    // Extract defs from root svg node
    const nodeDefs = getDefs(node as PxAnimatedSvgDocument) || defs;

    // Resolve style reference
    const resolvedStyle = resolveStyle(style, nodeDefs);

    // Process children
    let childElements: Array<Element> | undefined;
    if (children) {
        for (const ch of children) {
            const child = renderNode(ch, nodeDefs, diag);
            if (child) {
                if (!childElements) childElements = [];
                childElements.push(child);
            }
        }
    }

    const element = createElement(
        type || 'g',
        getNormalizedProps(props),
        resolvedStyle,
        childElements,
        props[TEXT_CONTENT_ATTR],
        diag
    );

    // `type` is an INTERNAL_ATTR (reserved for the node tag), so the value relayed
    // via `domType` must be applied to the real attribute here.
    if (element && domType !== undefined) element.setAttribute('type', domType);

    return element;
}