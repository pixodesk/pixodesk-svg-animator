/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { PxAnimatedSvgDocument } from './PxAnimatorTypes';


/**
 * Generates a unique ID with a random suffix.
 * Format: _px_{random base36 string}
 */
let _idCounter = 0;
export function generateUniqueId(): string {
    const timestamp = Date.now().toString(36);
    const counter = (++_idCounter).toString(36);
    const random = Math.random().toString(36).substring(2, 6);
    return '_px_' + timestamp + counter + random;
}

/**
 * Deep clones a JSON-like value (objects, arrays, primitives).
 * Does not handle special types like Date, Map, Set, functions, etc.
 */
export function deepClone<T>(value: T): T {
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(item => deepClone(item)) as T;

    const obj = value as Record<string, unknown>;

    const cloned: Record<string, unknown> = {};
    for (const key of Object.keys(obj)) {
        cloned[key] = deepClone(obj[key]);
    }
    return cloned as T;
}

/**
 * Regenerates all IDs in the document and updates references.
 *
 * This function:
 * 1. Deep clones the document to avoid mutating the original
 * 2. Traverses all nodes and regenerates IDs, keeping a mapping of old → new
 * 3. Updates all references to old IDs in attributes:
 *    - Hash references: "#old-id" → "#new-id" (href, xlink:href)
 *    - URL references: "url(#old-id)" → "url(#new-id)" (fill, clip-path, mask, marker, etc.)
 *    - Style URL references: { offsetPath: "url(#old-id)" }
 *
 * @param doc - The animated SVG document to process
 * @returns A new document with regenerated IDs
 */
export function generateNewIds(doc: PxAnimatedSvgDocument): PxAnimatedSvgDocument {
    // Deep clone the document
    const cloned: PxAnimatedSvgDocument = deepClone(doc);

    // Map of old ID → new ID
    const idMap = new Map<string, string>();

    // Attributes that contain hash references (#id)
    const hashRefAttrs = new Set(['href', 'xlink:href']);

    // Attributes that contain url(#id) references
    const urlRefAttrs = new Set([
        'fill', 'stroke', 'clip-path', 'clipPath', 'mask',
        'marker', 'marker-start', 'marker-mid', 'marker-end',
        'filter', 'flood-color', 'lighting-color'
    ]);

    // Attributes that contain direct ID references (no # or url())
    const directIdRefAttrs = new Set(['baseId', 'targetId', 'boundElementId']);

    // Phase 1: Collect all IDs and generate new ones
    function collectIds(node: any): void {
        if (!node || typeof node !== 'object') return;

        if (node.id && typeof node.id === 'string') {
            const oldId = node.id;
            const newId = generateUniqueId();
            idMap.set(oldId, newId);
            node.id = newId;
        } else if (node.animate) {
            // An animated node needs an id so the animation can bind to its rendered element.
            node.id = generateUniqueId();
        }

        // Process children
        if (Array.isArray(node.children)) {
            for (const child of node.children) {
                collectIds(child);
            }
        }
    }

    // Phase 2: Update all references to old IDs
    function updateRefs(node: any): void {
        if (!node || typeof node !== 'object') return;

        for (const [key, value] of Object.entries(node)) {
            if (key === 'children') {
                if (Array.isArray(value)) {
                    for (const child of value) {
                        updateRefs(child);
                    }
                }
                continue;
            }

            if (typeof value === 'string') {
                // Check for hash references: href="#old-id"
                if (hashRefAttrs.has(key) && value.startsWith('#')) {
                    const oldId = value.slice(1);
                    const newId = idMap.get(oldId);
                    if (newId) {
                        node[key] = '#' + newId;
                    }
                }
                // Check for url() references: fill="url(#old-id)"
                else if (urlRefAttrs.has(key)) {
                    node[key] = replaceUrlRefs(value, idMap);
                }
                // Check for direct ID references: baseId="_px_xxx"
                else if (directIdRefAttrs.has(key)) {
                    const newId = idMap.get(value);
                    if (newId) {
                        node[key] = newId;
                    }
                }
                // Check for url() in any string value (e.g., in style strings)
                else if (value.includes('url(#')) {
                    node[key] = replaceUrlRefs(value, idMap);
                }
            }
            // Check style object for url() references
            else if (key === 'style' && typeof value === 'object' && value !== null) {
                for (const [styleProp, styleValue] of Object.entries(value)) {
                    if (typeof styleValue === 'string') {
                        (value as any)[styleProp] = replaceUrlRefs(styleValue, idMap);
                    }
                }
            }
            // Recursively process nested objects (meta contains baseId/targetId refs;
            // in-place animated values like { keyframes: [{ value: "url(#grad)" }] }
            // also need ref rewriting on string values they contain).
            else if (typeof value === 'object' && value !== null) {
                updateRefs(value);
            }
        }
    }

    collectIds(cloned);
    updateRefs(cloned);

    // Update IDs in animator.animate map
    const docAnimate = cloned.animator?.animate;
    if (docAnimate && typeof docAnimate === 'object') {
        const updatedAnimate: Record<string, any> = {};
        for (const [id, anim] of Object.entries(docAnimate)) {
            const newId = idMap.get(id) ?? id;
            updatedAnimate[newId] = anim;
        }
        cloned.animator = { ...cloned.animator, animate: updatedAnimate };
    }

    return cloned;
}

/**
 * Replaces url(#old-id) references in a string with new IDs from the map.
 */
function replaceUrlRefs(value: string, idMap: Map<string, string>): string {
    return value.replace(/url\(#([^)]+)\)/g, (match, oldId) => {
        const newId = idMap.get(oldId);
        return newId ? 'url(#' + newId + ')' : match;
    });
}
