// @px-area entry
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { useRef } from 'react';
import { deepEquals } from '@pixodesk/svg-animator-core/internal';


/**
 * Compares two arrays of dependencies using identity check first (===),
 * falling back to deep equality if references differ.
 * This is optimized for immutable data that may be recreated with same values.
 */
function areDepsEqual(prevDeps: ReadonlyArray<unknown>, nextDeps: ReadonlyArray<unknown>): boolean {
    if (prevDeps.length !== nextDeps.length) return false;

    for (let i = 0; i < prevDeps.length; i++) {
        // Fast path: same reference (common for immutable data)
        if (prevDeps[i] === nextDeps[i]) continue;

        // Slow path: different reference but possibly same content
        if (!deepEquals(prevDeps[i], nextDeps[i])) return false;
    }

    return true;
}

/**
 * Returns a stable numeric version ID that only increments when dependencies
 * actually change (by reference or deep equality).
 */
export function useDepsVersion(...deps: Array<unknown>): number {
    const cache = useRef<{
        versionId: number;
        deps: Array<unknown>;
    } | null>(null);

    // First render - initialize with version 1
    if (cache.current === null) {
        cache.current = {
            versionId: 1,
            deps: deps
        };
        return 1;
    }

    // Check if any dependency changed (by reference or value)
    if (!areDepsEqual(cache.current.deps, deps)) {
        // Dependencies changed - increment version and update cache
        cache.current = {
            versionId: cache.current.versionId + 1,
            deps: deps
        };
    }

    return cache.current.versionId;
}
