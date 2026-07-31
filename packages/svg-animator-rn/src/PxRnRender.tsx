/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import {
    getNormalizedProps,
    resolveStyle,
    sanitiseAttributeValue,
    DISALLOWED_SVG_TAGS_LOWER,
    TEXT_ATTR,
    TEXT_CONTENT_ATTR,
    type PxDefs,
    type PxNode,
} from '@pixodesk/svg-animator-core';
import { createElement, type ComponentType, type ReactElement, type ReactNode } from 'react';
import { RN_SVG_COMPONENTS } from './PxRnTypeMap';
import { toRnPropName, toRnPropValue } from './PxRnPropNames';

export interface RenderRnNodeOptions {
    /** Collects non-fatal issues (unsupported tags, dropped attrs). */
    warnings?: Array<string>;
    /** `definitions` from the document, used to resolve named `style` presets. */
    defs?: PxDefs;
    /**
     * Wraps the created element for animated nodes: receives the resolved
     * component + static props and returns the element to mount (the animator
     * substitutes an Animated component wired to its tracks). Return undefined
     * to keep the plain static element.
     *
     * `key` is handed over SEPARATELY and is deliberately absent from `props`:
     * React 19 warns when a props object containing `key` is spread into JSX,
     * and implementations of this hook do exactly that.
     */
    decorate?: (
        node: PxNode,
        Component: ComponentType<any>,
        props: Record<string, any>,
        children: ReactNode,
        key: string | number | undefined
    ) => ReactElement | undefined;
}

/**
 * Converts core-normalised wire props into react-native-svg props: RN prop
 * naming, sanitisation (same security rules as the web renderer), numeric
 * coercion where possible.
 */
export function toRnProps(props: Record<string, any>, warnings?: Array<string>, tag?: string): Record<string, any> {
    const normalised = getNormalizedProps(props);
    const out: Record<string, any> = {};
    for (const key of Object.keys(normalised)) {
        const sanitised = sanitiseAttributeValue(key, normalised[key]);
        if (sanitised === undefined) continue;
        const rnKey = toRnPropName(key);
        if (!rnKey) continue;
        out[rnKey] = toRnPropValue(rnKey, String(sanitised), tag);
    }
    return out;
}

/**
 * Renders a (materialised) PxNode tree to react-native-svg elements.
 * Mirrors the web `renderNode` contract: unsupported/dangerous tags are
 * skipped with a warning, never a crash.
 */
export function renderRnNode(node: PxNode, opts: RenderRnNodeOptions = {}, key?: string | number): ReactElement | null {
    if (!node) return null;

    const { type, children, style, animate, meta, effects, ...props } = node as any;
    const tag = String(type || 'g');

    // `feFuncR/G/B/A` carry their SVG `type` attribute (identity/table/…) under
    // `funcType`, because the wire format reserves `type` for the node tag.
    // Restore it as a real prop, mirroring the web renderer.
    const feFuncType: string | undefined = props.funcType;
    if (feFuncType !== undefined) delete props.funcType;

    if (DISALLOWED_SVG_TAGS_LOWER.has(tag.toLowerCase())) {
        opts.warnings?.push('tag blocked (dangerous): ' + tag);
        return null;
    }

    const Component = RN_SVG_COMPONENTS[tag];
    if (!Component) {
        opts.warnings?.push('tag not supported in react-native-svg mapping: ' + tag);
        return null;
    }

    // NB: `key` is never written into this object — see `decorate` above.
    const rnProps = toRnProps(props, opts.warnings, tag);
    if (feFuncType !== undefined) rnProps.type = feFuncType;

    // `node.style` — a named preset from `definitions.styles`, or an inline
    // record. react-native-svg has no CSS, so the resolved declarations are
    // applied as ordinary props (the same names, e.g. `fill`, `strokeWidth`).
    // Explicit attributes on the node win over the style block.
    const resolved = resolveStyle(style, opts.defs);
    if (resolved) {
        for (const [k, v] of Object.entries(resolved)) {
            const rnKey = toRnPropName(k);
            if (!rnKey || rnKey in rnProps) continue;
            const sanitised = sanitiseAttributeValue(rnKey, v);
            if (sanitised === undefined) continue;
            rnProps[rnKey] = toRnPropValue(rnKey, String(sanitised), tag);
        }
    }

    // Text content: wire nodes carry it as `text` / `textContent` attr.
    const textContent: string | undefined = props[TEXT_ATTR] || props[TEXT_CONTENT_ATTR];

    let childElements: ReactNode = undefined;
    if (Array.isArray(children) && children.length > 0) {
        childElements = children
            .map((ch: PxNode, i: number) => renderRnNode(ch, opts, i))
            .filter(Boolean);
    } else if (textContent !== undefined) {
        childElements = String(textContent);
    }

    const decorated = opts.decorate?.(node, Component, rnProps, childElements, key);
    if (decorated !== undefined) return decorated;

    // `createElement` takes `key` in its config object — that path does NOT
    // trigger React's JSX-spread warning.
    return createElement(
        Component,
        key !== undefined ? { ...rnProps, key } : rnProps,
        childElements
    );
}
