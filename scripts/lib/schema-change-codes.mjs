/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// Reads PxSchemaChangeCode (the words behind each `PXS` code) and the step table that uses the codes,
// straight from the source — the same plain-text parse as gen-diagnostics-md.mjs, no TypeScript needed.
//
// | Export | Gives |
// |---|---|
// | `parseSchemaChangeCodes()` | every member: `{ name, value, paragraphs, deprecated }` |
// | `parseWireStepCodes()` | every step of `PX_WIRE_STEPS`: `{ from, to, name }` (`name` = the member it uses) |

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const SCHEMA_CHANGE_CODES_SOURCE = 'packages/svg-animator-core/src/version/PxSchemaChangeCode.ts';
const WIRE_STEPS_SOURCE = 'packages/svg-animator-core/src/version/PxWireVersion.ts';

/** Every member of the enum, its description as paragraphs (a blank ` *` line starts a new one). */
export function parseSchemaChangeCodes() {
    const text = readFileSync(resolve(ROOT, SCHEMA_CHANGE_CODES_SOURCE), 'utf8');
    const body = text.slice(text.indexOf('export enum PxSchemaChangeCode'));
    const out = [];
    let doc = null;
    for (const raw of body.split(/\r?\n/)) {
        const line = raw.trim();
        if (line.startsWith('/**')) { doc = []; continue; }
        if (doc && line.startsWith('*/')) continue;
        if (doc && line.startsWith('*')) { doc.push(line.replace(/^\*\s?/, '')); continue; }
        const member = /^([A-Za-z_]\w*)\s*=\s*(\d+)\s*,?$/.exec(line);
        if (!member) continue;
        const lines = doc ?? [];
        const paragraphs = lines.filter(l => !l.startsWith('@')).join('\n').split(/\n\s*\n/).map(p => p.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
        if (!paragraphs.length) throw new Error(`PxSchemaChangeCode.${member[1]} (${member[2]}) has no description — every code needs one`);
        out.push({ name: member[1], value: Number(member[2]), paragraphs, deprecated: lines.some(l => l.startsWith('@deprecated')) });
        doc = null;
    }
    if (!out.length) throw new Error('no codes parsed from ' + SCHEMA_CHANGE_CODES_SOURCE);
    return out;
}

/** Every step of `PX_WIRE_STEPS`, in table order: its versions and the member its `code` names. */
export function parseWireStepCodes() {
    const text = readFileSync(resolve(ROOT, WIRE_STEPS_SOURCE), 'utf8');
    const start = text.indexOf('export const PX_WIRE_STEPS');
    const table = text.slice(start, text.indexOf('\n];', start));
    const out = [];
    for (const m of table.matchAll(/from: '([^']+)',\s*to: '([^']+)',\s*code: PxSchemaChangeCode\.(\w+),/g)) out.push({ from: m[1], to: m[2], name: m[3] });
    const entries = (table.match(/^ {4}\{$/gm) ?? []).length;
    if (out.length !== entries) throw new Error(`${WIRE_STEPS_SOURCE}: ${entries} steps but ${out.length} read as "from, to, code" — keep the three keys first and in that order`);
    return out;
}
