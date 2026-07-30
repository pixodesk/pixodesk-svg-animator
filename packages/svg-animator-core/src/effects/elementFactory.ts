/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/


/**
 * Element-creation factory — abstracts WHAT an "element" is so the same
 * geometry/layout code (e.g. the glyph text materialiser) can emit plain wire
 * nodes here, or the editor's React / px elements when called from the editor.
 *
 * The signature intentionally mirrors the editor's `createPxElement(type,
 * props, children, fixReactKeysIfNeeded?)` so the editor's own factory drops in
 * unchanged.
 */
export type PxCreateElement<E = any> = (
    type: string,
    props: { [k: string]: any },
    children?: Array<E> | E | null,
    fixReactKeysIfNeeded?: boolean,
) => E;


/**
 * Default factory → a plain wire node `{ type, ...props, children? }`.
 * Drops `undefined` props and empty `children` so output matches the shape the
 * effects pipeline (and `JSON.stringify`) expects.
 */
export const jsonElementFactory: PxCreateElement<any> = (type, props, children) => {
    const node: { [k: string]: any } = { type };
    for (const k in props) if (props[k] !== undefined) node[k] = props[k];
    const arr = Array.isArray(children) ? children.filter(c => c != null) : (children != null ? [children] : []);
    if (arr.length) node.children = arr;
    return node;
};
