#!/usr/bin/env node
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// Compiles PxDiagnosticCode into docs/diagnostics.md — the page every diagnostic links to.
//
//   node scripts/gen-diagnostics-md.mjs          write the page
//   node scripts/gen-diagnostics-md.mjs --check   fail if the page is out of date (CI / build)
//
// `pnpm build` runs it, so the page cannot drift from the enum: the code ships the number, the
// page carries the words, and this is the one step that keeps them the same thing.
//
// The enum is parsed line by line rather than through the TypeScript compiler API: this script
// runs from the repo root, where `typescript` is not a dependency, and the file's shape is ours
// and deliberately plain (a JSDoc block, then `name = 1234,`). A member without a description is
// an error rather than a blank row — an undocumented code is exactly what this page exists to
// prevent.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = 'packages/svg-animator-core/src/playback/PxDiagnosticCode.ts';
const TARGET = 'docs/diagnostics.md';

/** `@data a · b` → the values a call site passes after the code. */
const DATA_TAG = /^@data\s+(.*)$/;

/** Every member of the enum: its number, its first-line description, its `@data`, its section. */
function parseCodes(text) {
    const out = [];
    const lines = text.split(/\r?\n/);
    let doc = [];
    let section = '';
    let inDoc = false;

    for (const raw of lines) {
        const line = raw.trim();

        // ── 1200 · the mount ──  → a section heading on the page
        const sec = /^\/\/\s*─+\s*\d+\s*·\s*(.+?)\s*─+\s*$/.exec(line);
        if (sec) { section = sec[1]; continue; }

        if (line.startsWith('/**')) { doc = []; inDoc = true; }
        if (inDoc) {
            const body = line.replace(/^\/\*\*|^\*\/|^\*/g, '').replace(/\*\/$/, '').trim();
            if (body) doc.push(body);
            if (line.endsWith('*/')) inDoc = false;
            continue;
        }

        const member = /^([A-Za-z_][\w]*)\s*=\s*(\d+)\s*,?\s*$/.exec(line);
        if (!member) continue;

        const [name, value] = [member[1], Number(member[2])];
        const data = doc.filter(d => DATA_TAG.test(d)).map(d => DATA_TAG.exec(d)[1]).join(' · ');
        const description = doc.filter(d => !DATA_TAG.test(d) && !d.startsWith('@')).join(' ');
        if (!description) throw new Error(`${name} (${value}) has no description — every code needs one`);
        out.push({ name, value, description, data, section, deprecated: doc.some(d => d.startsWith('@deprecated')) });
        doc = [];
    }
    return out;
}

function render(codes) {
    const bySection = new Map();
    for (const c of codes) {
        if (!bySection.has(c.section)) bySection.set(c.section, []);
        bySection.get(c.section).push(c);
    }
    const rows = [];
    rows.push('# Diagnostic codes');
    rows.push('');
    rows.push('<!-- GENERATED from ' + SOURCE + ' by scripts/gen-diagnostics-md.mjs — edit the enum, not this file. -->');
    rows.push('');
    rows.push('Every warning and error a player reports carries a **number**, not a sentence. The player');
    rows.push('ships the number; the words are here. That keeps the library small, and gives each');
    rows.push('diagnostic a stable identity you can switch on in code and search for.');
    rows.push('');
    rows.push('```js');
    rows.push('createAnimator({');
    rows.push('  src: \'/animation.json\',');
    rows.push('  container: \'#stage\',');
    rows.push('  onWarn:  d => console.log(d.code, d.data),   // 1204, [\'#missing\']');
    rows.push('  onError: d => report(d.code, d.error),');
    rows.push('});');
    rows.push('```');
    rows.push('');
    rows.push('Without a handler the player prints the code, the data and a link to this page. The');
    rows.push('`kind` beside it says **who can act**: `document` repair the file · `host` fix the page ·');
    rows.push('`platform` the browser could not do it · `usage` fix what you passed · `internal` report it.');
    rows.push('');
    rows.push('A code is permanent: numbers are never reused, and a retired one stays listed.');
    rows.push('');

    for (const [section, list] of bySection) {
        rows.push('## ' + (section || 'Codes').replace(/^./, s => s.toUpperCase()));
        rows.push('');
        rows.push('<!-- px-check off generated from the PxDiagnosticCode enum -->');
        rows.push('| Code | What it means | Data |');
        rows.push('|---|---|---|');
        for (const c of list) {
            const desc = (c.deprecated ? '**Retired.** ' : '') + c.description;
            rows.push(`| **${c.value}** | ${desc} | ${c.data || '—'} |`);
        }
        rows.push('');
    }
    return rows.join('\n') + '\n';
}

const source = readFileSync(resolve(ROOT, SOURCE), 'utf8');
const codes = parseCodes(source);
if (!codes.length) throw new Error('no codes parsed from ' + SOURCE);

const seen = new Map();
for (const c of codes) {
    if (seen.has(c.value)) throw new Error(`code ${c.value} is used twice: ${seen.get(c.value)} and ${c.name}`);
    seen.set(c.value, c.name);
}

const page = render(codes);
const target = resolve(ROOT, TARGET);
const current = (() => { try { return readFileSync(target, 'utf8'); } catch { return null; } })();

if (process.argv.includes('--check')) {
    if (current !== page) {
        console.error(TARGET + ' is out of date — run `node scripts/gen-diagnostics-md.mjs`');
        process.exit(1);
    }
    console.log(TARGET + ' is up to date (' + codes.length + ' codes)');
} else {
    if (current === page) console.log(TARGET + ' unchanged (' + codes.length + ' codes)');
    else {
        writeFileSync(target, page);
        console.log(TARGET + ' written: ' + codes.length + ' codes');
    }
}
