/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

/**
 * THE FIXTURES MUST USE THE WIRE FORMAT.
 *
 * `flattenAnimatorTimeline` accepts the flat runtime spelling as well as the nested wire one —
 * deliberately, so files written before 2026-09 keep playing. The cost of that tolerance is that
 * a test fixture written the old way passes without ever exercising the real format, which is
 * exactly how the per-instance-override bug survived: every override test used a flat document,
 * so nobody noticed that overrides were discarded on a modern one.
 *
 * This scans our own sources for `animator: { … }` literals whose TOP level carries a playback
 * key. On the wire those live inside `timeline`; at the animator root they are the runtime view,
 * and `validateDocument` reports each of them as an unexpected extra key.
 *
 * Excluded: `PxSchema.test.ts`, which declares its own toy schemas to unit-test the schema
 * TOOLKIT — its `animator` is a fixture of that toy format, not of ours.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PX_TIMELINE_SHARED_KEYS, PX_TIME_ONLY_TIMELINE_KEYS } from './PxAnimatorConstants';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

/** Roots that hold OUR fixtures. `dist` and `node_modules` are other people's output. */
const ROOTS = ['packages', 'examples'];
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.expo', 'coverage', 'test-results']);
const EXTS = /\.(tsx?|jsx?|mjs|json|vue)$/;

/** Files whose `animator` is NOT our wire format, with the reason. */
const EXEMPT: Record<string, string> = {
    'packages/svg-animator-core/src/schema/PxSchema.test.ts':
        'declares its own toy schemas to unit-test the schema toolkit',
    'packages/svg-animator-core/src/format/PxTimelineCompat.test.ts':
        'tests the flat/nested boundary itself — the flat spelling is the subject',
    'packages/svg-animator-core/src/playback/PxAnimatorConfigPatch.test.ts':
        'tests the merge, including its flat-base warning',
    'packages/svg-animator-core/src/format/PxDocumentDiagnostic.test.ts':
        'feeds the diagnostic a deliberately LEGACY-FLAT document — that is the case under test',
};

/** Keys that belong inside `timeline`. `debugGlobalName` and the lookup tables do not.
 *  `frameRate` joined them on 2026-09-09 — it parameterises the engine `timeline.engine` selects,
 *  so keeping it at the animator root split one decision across two levels. */
const PLAYBACK_KEYS = new Set<string>([
    ...PX_TIMELINE_SHARED_KEYS, ...PX_TIME_ONLY_TIMELINE_KEYS,
    'fill', 'resetOnFinish', 'timelineSource', 'scroll',
]);

function walk(dir: string, out: Array<string> = []): Array<string> {
    for (const name of readdirSync(dir)) {
        if (SKIP_DIRS.has(name)) continue;
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p, out);
        else if (EXTS.test(name)) out.push(p);
    }
    return out;
}

/** Index just past the `}` matching the `{` at `i`, skipping strings and line comments. */
function balanced(src: string, i: number): number {
    let depth = 0, inStr: string | null = null;
    for (let j = i; j < src.length; j++) {
        const c = src[j];
        if (inStr) {
            if (c === '\\') { j++; continue; }
            if (c === inStr) inStr = null;
            continue;
        }
        if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
        if (c === '/' && src[j + 1] === '/') { const nl = src.indexOf('\n', j); if (nl < 0) return -1; j = nl; continue; }
        if (c === '{') depth++;
        else if (c === '}' && --depth === 0) return j + 1;
    }
    return -1;
}

/** Top-level keys of an object-literal body. */
function topKeys(body: string): Array<string> {
    const keys: Array<string> = [];
    let depth = 0, inStr: string | null = null, start = 0, expectKey = true;
    for (let i = 0; i < body.length; i++) {
        const c = body[i];
        if (inStr) {
            if (c === '\\') { i++; continue; }
            if (c === inStr) inStr = null;
            continue;
        }
        if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
        if (c === '/' && body[i + 1] === '/') { const nl = body.indexOf('\n', i); if (nl < 0) break; i = nl; continue; }
        if (c === '{' || c === '[' || c === '(') depth++;
        else if (c === '}' || c === ']' || c === ')') depth--;
        else if (depth === 0 && c === ':' && expectKey) {
            const k = body.slice(start, i).trim().replace(/^["']|["']$/g, '');
            if (/^[A-Za-z_$][\w$]*$/.test(k)) keys.push(k);
            expectKey = false;
        } else if (depth === 0 && c === ',') { start = i + 1; expectKey = true; }
    }
    return keys;
}

describe('wire spelling — our own fixtures use `animator.timeline`', () => {

    it('no `animator` literal carries a playback key at its top level', () => {
        const offenders: Array<string> = [];
        for (const root of ROOTS) {
            for (const file of walk(join(REPO, root))) {
                const rel = relative(REPO, file).split('\\').join('/');
                if (EXEMPT[rel]) continue;
                const src = readFileSync(file, 'utf8');
                const re = /["']?animator["']?\s*:\s*\{/g;
                for (let m = re.exec(src); m; m = re.exec(src)) {
                    const i = src.indexOf('{', m.index);
                    const j = balanced(src, i);
                    if (j < 0) continue;
                    const bad = topKeys(src.slice(i + 1, j - 1)).filter(k => PLAYBACK_KEYS.has(k));
                    if (bad.length) {
                        const line = src.slice(0, m.index).split('\n').length;
                        offenders.push(rel + ':' + line + '  ' + bad.sort().join(', '));
                    }
                }
            }
        }
        // Named in the message so a failure says WHERE, not just that the count changed.
        expect(offenders, 'move these keys inside `animator.timeline` — see SCHEMA.md').toEqual([]);
    });

    it('scans a meaningful number of files (the guard itself is not silently empty)', () => {
        const n = ROOTS.reduce((sum, r) => sum + walk(join(REPO, r)).length, 0);
        expect(n).toBeGreaterThan(200);
    });
});
