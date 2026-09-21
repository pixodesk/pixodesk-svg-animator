/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { toDomProps, type PxDefinitions, type PxDiagnostics, type PxNode } from '@pixodesk/svg-animator-core';
import { renderPxTree, type PxElementFactory } from '@pixodesk/svg-animator-core/internal';

// Re-export from the historical home so the package surface is unchanged.
export { toDomProps };


const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * The web player's element factory — the ONLY web-specific part of rendering. Every decision
 * about the document (tags, attribute names and values, sanitization, styles, text) is made by
 * core's `renderPxTree`, which the React and Vue components call with their own factories. So
 * the three cannot disagree about a document: they differ only in how an element is created.
 */
const createDomElement: PxElementFactory<Element> = ({ tag, attrs, style, children, text }) => {
    const element = document.createElementNS(SVG_NS, tag);

    for (const name of Object.keys(attrs)) element.setAttribute(name, attrs[name]);

    if (style) {
        const target = element.style as unknown as Record<string, string>;
        for (const prop of Object.keys(style)) target[prop] = style[prop];
    }

    // Children, or the node's own text — never both (assigning `textContent` would REPLACE
    // children already appended). `renderPxTree` has already decided which.
    for (const child of children) element.appendChild(child);
    if (text !== undefined) element.textContent = text;

    return element;
};


/**
 * Renders a PxNode tree to DOM elements.
 * @public @advanced
 */
export function renderNode(node: PxNode, _defs?: PxDefinitions, diag?: PxDiagnostics): Element | null {
    return renderPxTree(node, createDomElement, diag);
}
