// @px-area util
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

/**
 * Structural equality of two JSON-like values (key order ignored) — how the React, Vue and React
 * Native components tell a re-created but identical `doc` from a changed one. An object reused in
 * several places compares like any other; only a true cycle throws.
 * @internal
 */
export function deepEquals(a: unknown, b: unknown): boolean {
    // the objects on the CURRENT descent — a shared object leaves it once compared, a cycle never does
    const path = new Set<object>();

    function equals(x: unknown, y: unknown): boolean {
        if (x === y) return true;
        if (typeof x !== 'object' || typeof y !== 'object' || x === null || y === null) return false;
        if (path.has(x)) throw new Error('Circular reference detected');
        path.add(x);
        try {
            if (Array.isArray(x) || Array.isArray(y)) {
                if (!Array.isArray(x) || !Array.isArray(y) || x.length !== y.length) return false;
                const xs: ReadonlyArray<unknown> = x;
                const ys: ReadonlyArray<unknown> = y;
                return xs.every((v, i) => equals(v, ys[i]));
            }
            const xEntries = Object.entries(x);
            const yValues = new Map(Object.entries(y));
            return xEntries.length === yValues.size
                && xEntries.every(([key, v]) => yValues.has(key) && equals(v, yValues.get(key)));
        } finally {
            path.delete(x);
        }
    }

    return equals(a, b);
}
