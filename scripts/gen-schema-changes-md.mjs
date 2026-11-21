#!/usr/bin/env node
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// Compiles PxSchemaChangeCode into docs/schema-changes.md — the page every `PXS` code links to.
//
//   node scripts/gen-schema-changes-md.mjs          write the page
//   node scripts/gen-schema-changes-md.mjs --check   fail if the page is out of date (CI / build)
//
// The twin of gen-diagnostics-md.mjs: the code ships the number, the page carries the words. It also
// fails the build on a member without a description, a number used twice, a member no step uses
// (unless `@deprecated`) and a step naming a member that does not exist.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSchemaChangeCodes, parseWireStepCodes, SCHEMA_CHANGE_CODES_SOURCE } from './lib/schema-change-codes.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TARGET = 'docs/schema-changes.md';

const codes = parseSchemaChangeCodes();
const steps = parseWireStepCodes();

const byValue = new Map();
for (const c of codes) {
    if (byValue.has(c.value)) throw new Error(`PXS${c.value} is used twice: ${byValue.get(c.value)} and ${c.name}`);
    byValue.set(c.value, c.name);
}
const stepOf = new Map();
for (const s of steps) {
    if (!codes.some(c => c.name === s.name)) throw new Error(`step ${s.from} → ${s.to} names PxSchemaChangeCode.${s.name}, which does not exist`);
    if (stepOf.has(s.name)) throw new Error(`PxSchemaChangeCode.${s.name} is used by two steps`);
    stepOf.set(s.name, s);
}
for (const c of codes) {
    if (!stepOf.has(c.name) && !c.deprecated) throw new Error(`PxSchemaChangeCode.${c.name} (PXS${c.value}) is used by no step — mark it @deprecated, never delete or reuse it`);
}

function render() {
    const rows = [];
    rows.push('# Player schema changes');
    rows.push('');
    rows.push('<!-- GENERATED from ' + SCHEMA_CHANGE_CODES_SOURCE + ' by scripts/gen-schema-changes-md.mjs — edit the enum, not this file. -->');
    rows.push('');
    rows.push('Every step of the file format carries a **number**, not a sentence: the player converts an');
    rows.push('older file forward through these steps and ships only the numbers; the words are here. A');
    rows.push('step\'s number is `step.code` in `PX_WIRE_STEPS`, printed `PXS<n>` — separate from the');
    rows.push('[diagnostic codes](./diagnostics.md) (`PX<n>`), which are what a player reports.');
    rows.push('');
    rows.push('A number is permanent: it is never reused, and new steps only take higher ones. A');
    rows.push('description may be reworded or extended; its number stays.');
    rows.push('');
    for (const c of codes) {
        const s = stepOf.get(c.name);
        rows.push(`## <a id="pxs${c.value}"></a>PXS${c.value} · ` + (s ? `${s.from} → ${s.to}` : 'retired'));
        rows.push('');
        for (const p of c.paragraphs) { rows.push(p); rows.push(''); }
    }
    return rows.join('\n').replace(/\n+$/, '') + '\n';
}

const page = render();
const target = resolve(ROOT, TARGET);
const current = (() => { try { return readFileSync(target, 'utf8'); } catch { return null; } })();

if (process.argv.includes('--check')) {
    if (current !== page) {
        console.error(TARGET + ' is out of date — run `node scripts/gen-schema-changes-md.mjs`');
        process.exit(1);
    }
    console.log(TARGET + ' is up to date (' + codes.length + ' codes)');
} else if (current === page) {
    console.log(TARGET + ' unchanged (' + codes.length + ' codes)');
} else {
    writeFileSync(target, page);
    console.log(TARGET + ' written: ' + codes.length + ' codes');
}
