// No weak-keyed caches anywhere in the player (first-use review §17a / §17b): a cache belongs to the
// thing that owns the data — the prepared document's stamp, an animator instance, one function call —
// never to a module-level WeakMap that every document on the page shares.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGES = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const WEAK = /\bnew\s+Weak(Map|Set|Ref)\b/;

function sources(dir: string, out: Array<string> = []): Array<string> {
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) { if (name !== 'node_modules' && name !== 'dist') sources(p, out); }
        else if (/\.tsx?$/.test(name) && !/\.test\.|\.d\.ts$/.test(name)) out.push(p);
    }
    return out;
}

describe('player caches', () => {
    it('no package source creates a WeakMap / WeakSet / WeakRef', () => {
        const hits: Array<string> = [];
        for (const pkg of readdirSync(PACKAGES)) {
            const src = join(PACKAGES, pkg, 'src');
            try { statSync(src); } catch { continue; }
            for (const file of sources(src)) {
                readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
                    if (WEAK.test(line) && !line.trimStart().startsWith('//')) hits.push(relative(PACKAGES, file) + ':' + (i + 1));
                });
            }
        }
        expect(hits).toEqual([]);
    });
});
