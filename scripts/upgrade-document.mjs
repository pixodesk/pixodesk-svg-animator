#!/usr/bin/env node
// DOCUMENT UPGRADER (task 6.8) — for someone with a file and NO editor: brings a JSON animation
// document written for an older player schema up to this player's, or down to an older one.
//
//   node scripts/upgrade-document.mjs <in.json>                 → <in>.upgraded.json
//   node scripts/upgrade-document.mjs <in.json> --out <file>
//   node scripts/upgrade-document.mjs <in.json> --in-place
//   node scripts/upgrade-document.mjs <in.json> --to 1.1        down-convert (refused unless every step can be undone)
//
// It runs the SAME engine the player runs on open (`convertPlayerDocument`) — so a file this
// tool upgrades is exactly the file the player would have seen. A web page can call the same
// exported functions; this is the command-line front for them.
import { readFileSync, writeFileSync } from 'node:fs';
import * as core from '../packages/svg-animator-core/dist/index.js';

const args = process.argv.slice(2);
const input = args.find(a => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--out' && args[args.indexOf(a) - 1] !== '--to');
if (!input) {
    console.error('usage: node scripts/upgrade-document.mjs <in.json> [--out <file> | --in-place] [--to <a.b>]');
    process.exit(2);
}
if (!input.toLowerCase().endsWith('.json')) {
    console.error('Only the JSON document is converted here. A pre-rendered .svg is an export: re-export it from the editor.');
    process.exit(2);
}
const at = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };
const doc = JSON.parse(readFileSync(input, 'utf8'));
const to = at('--to');

let result;
if (to) {
    const target = core.parseWireVersion(to);
    if (!target) { console.error('Unparseable --to version: ' + to); process.exit(2); }
    result = core.downgradePlayerDocument(doc, target);
    if (!result.ok) { console.error('REFUSED: ' + result.reason); process.exit(1); }
} else {
    result = core.convertPlayerDocument(doc);
    const from = result.from ? core.formatWireVersion(result.from) : 'unstamped';
    console.log('File schema: ' + from + ' — ' + result.relation + ' relative to this player (' + core.PX_PLAYER_SCHEMA_VERSION + ').');
    if (result.advice) console.log(result.advice);
}
for (const step of result.applied) console.log('  applied ' + step.from + ' → ' + step.to + ': ' + step.reason);
if (!result.applied.length) {
    console.log('Nothing to convert — no file written.');
    process.exit(0);
}
const out = args.includes('--in-place') ? input : (at('--out') ?? input.replace(/\.json$/i, '.upgraded.json'));
writeFileSync(out, JSON.stringify(result.doc, null, 2) + '\n');
console.log('Wrote ' + out);
