/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { deepClone, generateUniqueId, type PxNode } from '@pixodesk/svg-animator-core';

/**
 * Workarounds for defects in react-native-svg's NATIVE renderer that would
 * otherwise take the whole app down.
 *
 * These are applied only when the native views are in use — never on the web,
 * where the DOM handles all of this correctly and the document must be left
 * exactly as the core pipeline produced it.
 */

/** True when a path's `d` contains a close-subpath command. */
function isClosedPath(d: unknown): boolean {
    return typeof d === 'string' && /[zZ]/.test(d);
}

/** Drops close-subpath commands, turning a closed outline into an open one. */
function openPath(d: string): string {
    return d.replace(/[zZ]/g, '').trimEnd();
}

/** `#foo` → `foo`. Returns undefined for anything that is not a local ref. */
function localRef(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed.startsWith('#') ? trimmed.slice(1) : undefined;
}

function forEachNode(node: PxNode | undefined, visit: (n: PxNode, parent?: PxNode) => void, parent?: PxNode): void {
    if (!node) return;
    visit(node, parent);
    for (const child of (node.children ?? [])) forEachNode(child, visit, node);
}

/**
 * Gives every `<textPath>` that follows a CLOSED path its own OPEN copy of it.
 *
 * WHY: react-native-svg's native text-on-path layout crashes the app —
 * an uncatchable `NSRangeException` on iOS — for this combination.
 * `RNSVGTSpan.mm` skips glyphs outside `[startOfRendering, endOfRendering]`,
 * but for a closed path it sets those bounds to `startOffset … startOffset +
 * pathLength` instead of `0 … pathLength`. Any glyph past the end of the path
 * therefore survives the bounds check and reaches `getPosAndTan`, whose
 * `indexOfObjectPassingTest` returns `NSNotFound` — and indexing the lengths
 * array with `NSNotFound` throws. A non-zero `startOffset` on a closed path is
 * all it takes, and animating `startOffset` guarantees hitting it.
 *
 * Opening the path restores the `0 … pathLength` bounds, so out-of-range
 * glyphs are skipped as intended. The copy is private to the `<textPath>`, so
 * anything else drawing the same path still gets the closed original. For a
 * shape whose ends already meet (a circle, the usual case) the removed segment
 * has zero length and nothing changes visually at all.
 *
 * Returns the document unchanged — the same object — when nothing matches.
 */
export function openClosedTextPathTargets(doc: PxNode, warnings?: Array<string>): PxNode {
    // Cheap pre-check: the overwhelming majority of documents have no textPath.
    let hasTextPath = false;
    forEachNode(doc, n => { if (String(n.type) === 'textPath') hasTextPath = true; });
    if (!hasTextPath) return doc;

    const result = deepClone(doc);

    const byId = new Map<string, PxNode>();
    forEachNode(result, n => {
        const id = (n as any).id;
        if (typeof id === 'string') byId.set(id, n);
    });

    /** The copy is a geometry reference, never something to draw — so it goes
     *  in `<defs>`, alongside the paths textPath targets normally live in. */
    let defs = (result.children ?? []).find(c => String(c.type) === 'defs');
    const ensureDefs = (): PxNode => {
        if (!defs) {
            defs = { type: 'defs', children: [] } as unknown as PxNode;
            (result.children ??= []).unshift(defs);
        }
        return defs;
    };

    /** Original path id → id of the open copy, so N textPaths share one copy. */
    const openCopies = new Map<string, string>();

    forEachNode(result, node => {
        if (String(node.type) !== 'textPath') return;

        const anyNode = node as any;
        const attr = anyNode.href !== undefined ? 'href' : 'xlink:href';
        const targetId = localRef(anyNode[attr]);
        if (!targetId) return;

        const target = byId.get(targetId);
        if (!target || !isClosedPath((target as any).d)) return;

        let copyId = openCopies.get(targetId);
        if (!copyId) {
            const copy = deepClone(target) as any;
            copyId = 'px_open_' + generateUniqueId();
            copy.id = copyId;
            copy.d = openPath(String(copy.d));
            // A copy that also carried animation would animate twice; the copy
            // exists purely as a geometry reference for the text.
            delete copy.animate;
            delete copy.effects;

            (ensureDefs().children ??= []).push(copy);
            openCopies.set(targetId, copyId);
            warnings?.push(
                'textPath follows a closed path (#' + targetId + '); using an open copy to ' +
                'avoid a react-native-svg native crash'
            );
        }

        anyNode[attr] = '#' + copyId;
    });

    return result;
}
