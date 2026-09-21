/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// THE renderer — the one place a `PxNode` tree becomes elements, for EVERY DOM player.
//
// The web player, the React component and the Vue component used to carry a renderer each.
// Three copies drifted: React and Vue skipped sanitization, wrote camelCase names SVG ignores
// (`maskType`, and in Vue every presentation attribute — gradients lost their colours), wrote
// the `domType` escape key as a literal attribute (so `<feColorMatrix>` lost its `type` and the
// filter painted its target black), and put CSS-only properties out as dead attributes.
//
// So every DECISION lives here, once:
//   - which tag (`type`, default `g`) and whether it is allowed at all;
//   - the `domType` escape key → the real `type` attribute;
//   - which keys are attributes (`toDomProps`) and what their values may be
//     (`sanitizeAttributeValue`);
//   - the NAME each attribute has in SVG (`camelCaseToKebabWordIfNeeded`, `className` → `class`);
//   - which properties are CSS-only and so go to `style`, plus the node's own `style` record;
//   - children, or the node's `textContent` when it has none.
//
// A framework supplies exactly one thing — `PxElementFactory`: given the finished spec, make
// an element (DOM node / React element / Vue vnode). It decides nothing about the document.
// Platform-neutral on purpose: no DOM here, so it also runs on a server.

import { PX_TEXT_CONTENT_ATTR } from '../format/PxAnimatorConstants';
import type { PxNode } from '../format/PxAnimatorTypes';
import { PxDiagnosticCode } from '../playback/PxDiagnosticCode';
import { createDiagnostics, PxDiagnosticKind, type PxDiagnostics } from '../playback/PxDiagnostics';
import { camelCaseToKebabWordIfNeeded } from '../util/PxAnimatorUtil';
import { PX_CSS_ONLY_STYLE_PROPS, PX_DISALLOWED_SVG_TAGS_LOWER, sanitizeAttributeValue, toDomProps } from '../util/PxNodeProps';


/**
 * One element, fully decided. Everything a factory needs and nothing it has to think about.
 * @internal
 */
export interface PxElementSpec<T> {
    /** The SVG tag name. */
    tag: string;
    /** Attributes under the names SVG reads (`stroke-width`, `viewBox`, `class`), sanitized. */
    attrs: Record<string, string>;
    /** Inline style, camelCase property → value; `undefined` when there is none. */
    style: Record<string, string> | undefined;
    /** Rendered children, blocked ones already dropped. Empty when the node has none. */
    children: Array<T>;
    /** The node's text — set ONLY when `children` is empty (a line `<tspan>` can carry both,
     *  and then the styled child spans are what renders). */
    text: string | undefined;
    /** The source node — for the node's `id` (refs) and nothing about rendering. */
    node: PxNode;
    /** True for the tree's root `<svg>`. */
    isRoot: boolean;
    /** Position among its siblings — a stable list key for frameworks that want one. */
    index: number;
}

/**
 * The ONE thing a framework supplies: make an element from a finished spec.
 * @internal
 */
export type PxElementFactory<T> = (spec: PxElementSpec<T>) => T;

/** The attribute SVG calls `class`; the wire and the DOM property call it `className`. */
const CLASS_NAME_KEY = 'className';
const CLASS_ATTR = 'class';

/** The escape key for an element whose own `type` ATTRIBUTE collides with the node-tag key —
 *  `feColorMatrix`, `feTurbulence`, `feFunc*` (written by the editor at one choke point). */
const DOM_TYPE_KEY = 'domType';
const TYPE_ATTR = 'type';

const DEFAULT_TAG = 'g';


/**
 * Renders a `PxNode` tree through `factory`. Returns `null` for a missing node or a blocked
 * root tag; blocked descendants are dropped and reported.
 * @internal
 */
export function renderPxTree<T>(node: PxNode | undefined, factory: PxElementFactory<T>, diag?: PxDiagnostics): T | null {
    return node ? renderOne(node, factory, diag, true, 0) : null;
}

function renderOne<T>(node: PxNode, factory: PxElementFactory<T>, diag: PxDiagnostics | undefined, isRoot: boolean, index: number): T | null {
    const { type, children, style, ...props } = node;
    const tag = type || DEFAULT_TAG;

    if (PX_DISALLOWED_SVG_TAGS_LOWER.has(tag.toLowerCase())) {
        // `document`: a blocked tag is content the FILE asked for, so the file is what changes.
        (diag ?? createDiagnostics(undefined, '[PxAnimator]')).warn(PxDiagnosticKind.document, PxDiagnosticCode.blockedTag, tag);
        return null;
    }

    // `type` is reserved for the tag and `toDomProps` drops it, so the escaped value is lifted
    // out first and written back as the real attribute below. Without it the primitive is lost
    // and an EMPTY `<filter>` paints its target transparent black.
    const domType = props[DOM_TYPE_KEY];
    if (domType !== undefined) delete props[DOM_TYPE_KEY];

    const attrs: Record<string, string> = {};
    let inlineStyle: Record<string, string> | undefined;

    const domProps = toDomProps(props);
    for (const propName of Object.keys(domProps)) {
        // `undefined` means "do not emit" (whitelist miss, blocked dangerous value, …) — a
        // writer would otherwise coerce it to the literal string "undefined".
        const sanitized = sanitizeAttributeValue(propName, domProps[propName]);
        if (sanitized === undefined) continue;

        // CSS-only properties (mix-blend-mode, isolation) are not SVG presentation attributes;
        // as attributes the browser ignores them, so they go through `style`.
        if (PX_CSS_ONLY_STYLE_PROPS.has(propName)) {
            (inlineStyle ??= {})[propName] = String(sanitized);
            continue;
        }
        attrs[propName === CLASS_NAME_KEY ? CLASS_ATTR : camelCaseToKebabWordIfNeeded(propName)] = sanitized;
    }
    if (domType !== undefined) attrs[TYPE_ATTR] = String(domType);

    // The node's own `style` record — declarations, not attributes. Written after the CSS-only
    // properties so an explicit declaration wins over the same property given as an attribute.
    if (style) {
        for (const styleProp of Object.keys(style)) (inlineStyle ??= {})[styleProp] = String(style[styleProp]);
    }

    const rendered: Array<T> = [];
    if (children) {
        children.forEach((child, i) => {
            const el = renderOne(child, factory, diag, false, i);
            if (el !== null) rendered.push(el);
        });
    }

    const ownText = props[PX_TEXT_CONTENT_ATTR];
    const text = !rendered.length && typeof ownText === 'string' && ownText ? ownText : undefined;

    return factory({ tag, attrs, style: inlineStyle, children: rendered, text, node, isRoot, index });
}
