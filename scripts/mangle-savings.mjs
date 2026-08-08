#!/usr/bin/env node
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// Cross our OWN declared property names (scripts/collect-identifiers.mjs) with the
// shipped minified bundle, and report how many RAW bytes property-mangling would save.
//
//   node scripts/collect-identifiers.mjs && node scripts/mangle-savings.mjs
//
// Raw bytes are the metric here on purpose: this bundle is a published library whose
// on-disk size people judge it by, and it is also INLINED verbatim into exported SVG
// files, where nothing compresses it.
//
// Emits scripts/.mangle-props.json — the terser `mangle.properties.regex` allowlist,
// built from names proven safe by the AST pass, for the build to consume.

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BUNDLE = process.argv[2] || join(ROOT, 'packages/svg-animator-web/dist/index.umd.min.js');

const ids = JSON.parse(readFileSync(join(ROOT, 'scripts/.identifiers.json'), 'utf8'));
const src = readFileSync(BUNDLE, 'utf8');

/** Count identifier occurrences OUTSIDE string literals (see analyse-bundle.mjs). */
function codeOnly(s) {
    let out = '', i = 0, start = 0;
    while (i < s.length) {
        const ch = s[i];
        if (ch === '"' || ch === "'" || ch === '`') {
            out += s.slice(start, i);
            let j = i + 1;
            while (j < s.length) { if (s[j] === '\\') { j += 2; continue; } if (s[j] === quoteEnd(ch)) break; j++; }
            i = start = j + 1;
        } else i++;
    }
    return out + s.slice(start);
    function quoteEnd(c) { return c; }
}

const code = codeOnly(src);
const counts = new Map();
for (const m of code.match(/\b[A-Za-z_$][A-Za-z0-9_$]*\b/g) || []) {
    counts.set(m, (counts.get(m) || 0) + 1);
}

const MANGLED_LEN = 2;              // terser emits 1-2 char property names in practice
const rows = [];
for (const name of ids.safeToMangle) {
    const n = counts.get(name) || 0;
    if (!n) continue;                                    // declared but tree-shaken away
    const save = n * Math.max(0, name.length - MANGLED_LEN);
    rows.push({ name, n, len: name.length, raw: n * name.length, save });
}
rows.sort((a, b) => b.save - a.save);

const totalRaw = rows.reduce((s, r) => s + r.raw, 0);
const totalSave = rows.reduce((s, r) => s + r.save, 0);
const bundleLen = Buffer.byteLength(src);

console.log(`\nbundle: ${BUNDLE.split('/').pop()}  ${bundleLen.toLocaleString()} raw bytes`);
console.log(`our declared property names present in bundle : ${rows.length} of ${ids.safeToMangle.length} safe`);
console.log(`  they occupy          : ${totalRaw.toLocaleString()} B  (${(totalRaw * 100 / bundleLen).toFixed(1)}% of bundle)`);
console.log(`  mangling them saves  : ${totalSave.toLocaleString()} B  (${(totalSave * 100 / bundleLen).toFixed(1)}% of bundle)`);
console.log(`  projected size       : ${(bundleLen - totalSave).toLocaleString()} B\n`);

console.log('top contributors:');
console.log('   save   x occ   len  name');
for (const r of rows.slice(0, 40)) {
    console.log(`  ${String(r.save).padStart(5)} B  x${String(r.n).padEnd(4)} ${String(r.len).padStart(3)}  ${r.name}`);
}

// --- reserved-list sanity: names we deliberately keep, and why
const kept = ids.declared
    .filter(([n]) => !ids.safeToMangle.includes(n))
    .map(([n]) => ({ name: n, n: counts.get(n) || 0 }))
    .filter(r => r.n > 0)
    .sort((a, b) => b.n * b.name.length - a.n * a.name.length);
const keptBytes = kept.reduce((s, r) => s + r.n * r.name.length, 0);
console.log(`\nRESERVED (wire-format / string-reachable / exported): ${kept.length} names, ${keptBytes.toLocaleString()} B in bundle`);
for (const r of kept.slice(0, 12)) {
    const why = ids.wireKeys.includes(r.name) ? 'wire-format key'
        : ids.exportedNames.includes(r.name) ? 'public API' : 'appears as a string';
    console.log(`  ${String(r.n * r.name.length).padStart(5)} B  x${String(r.n).padEnd(4)} ${r.name.padEnd(24)} ${why}`);
}

writeFileSync(join(ROOT, 'scripts/.mangle-props.json'),
    JSON.stringify({ regex: `^(${rows.map(r => r.name).join('|')})$`, names: rows.map(r => r.name) }, null, 1));
console.log(`\nwrote scripts/.mangle-props.json (${rows.length} names)`);
