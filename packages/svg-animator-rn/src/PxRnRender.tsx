/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import {
    getNormalizedProps,
    sanitiseAttributeValue,
    DISALLOWED_SVG_TAGS_LOWER,
    TEXT_ATTR,
    TEXT_CONTENT_ATTR,
    type PxNode,
} from '@pixodesk/svg-animator-core';
import { createElement, type ComponentType, type ReactElement, type ReactNode } from 'react';
import { RN_SVG_COMPONENTS } from './PxRnTypeMap';
import { toRnPropName, toRnPropValue } from './PxRnPropNames';

export interface RenderRnNodeOptions {
    /** Collects non-fatal issues (unsupported tags, dropped attrs). */
    warnings?: Array<string>;
    /**
     * Wraps the created element for animated nodes: receives the resolved
     * component + static props and returns the element to mount (the animator
     * substitutes an Animated component wired to its tracks). Return undefined
     * to keep the plain static element.
     */
    decorate?: (
        node: PxNode,
        Component: ComponentType<any>,
        props: Record<string, any>,
        children: ReactNode
    ) => ReactElement | undefined;
}

/**
 * Converts core-normalised wire props into react-native-svg props: RN prop
 * naming, sanitisation (same security rules as the web renderer), numeric
 * coercion where possible.
 */
export function toRnProps(props: Record<string, any>, warnings?: Array<string>): Record<string, any> {
    const normalised = getNormalizedProps(props);
    const out: Record<string, any> = {};
    for (const key of Object.keys(normalised)) {
        const sanitised = sanitiseAttributeValue(key, normalised[key]);
        if (sanitised === undefined) continue;
        const rnKey = toRnPropName(key);
        if (!rnKey) continue;
        out[rnKey] = toRnPropValue(rnKey, String(sanitised));
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

    if (DISALLOWED_SVG_TAGS_LOWER.has(tag.toLowerCase())) {
        opts.warnings?.push('tag blocked (dangerous): ' + tag);
        return null;
    }

    const Component = RN_SVG_COMPONENTS[tag];
    if (!Component) {
        opts.warnings?.push('tag not supported in react-native-svg mapping: ' + tag);
        return null;
    }

    const rnProps = toRnProps(props, opts.warnings);
    if (key !== undefined) rnProps.key = key;

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

    const decorated = opts.decorate?.(node, Component, rnProps, childElements);
    if (decorated !== undefined) return decorated;

    return createElement(Component, rnProps, childElements);
}
