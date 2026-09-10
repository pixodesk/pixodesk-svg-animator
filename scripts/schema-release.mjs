#!/usr/bin/env node
// PLAYER SCHEMA RELEASE (tasks 5.3 / 5.4) — decides whether this release moves the schema
// version, refuses to release when it should have and did not, and on --apply writes the new
// field-inventory snapshot, the dated changelog entry, and SCHEMA.json.
//
//   node scripts/schema-release.mjs                      dry run: the diff and the bump it requires
//   node scripts/schema-release.mjs --apply              write snapshot + changelog + SCHEMA.json
//   node scripts/schema-release.mjs --apply --lib-version 1.0.35   also set the core npm version
//
// Build the core first (`pnpm --filter @pixodesk/svg-animator-core build`): this reads dist, the
// same code a user runs. The RULE lives in `PxSchemaRelease.ts`; this file only does I/O.
//
// The LIBRARY version and the SCHEMA version are independent numbers — the library ships far
// more often than the format changes. --lib-version never touches PX_PLAYER_SCHEMA_VERSION.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as core from '../packages/svg-animator-core/dist/index.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CORE = resolve(ROOT, 'packages/svg-animator-core');
const SNAPSHOT = resolve(CORE, 'src/version/schema-field-universe.player.json');
const RELEASES = resolve(CORE, 'src/version/schema-releases.player.json');
const PACKAGE = resolve(CORE, 'package.json');

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const libAt = args.indexOf('--lib-version');
const libVersion = libAt >= 0 ? args[libAt + 1] : undefined;

const live = core.schemaFieldUniverse(core.PxAnimatedSvgDocumentSchema);
const snapshot = JSON.parse(readFileSync(SNAPSHOT, 'utf8'));
const releases = JSON.parse(readFileSync(RELEASES, 'utf8'));
const last = releases[releases.length - 1];
const { added, removed } = core.diffFieldUniverse(snapshot, live);
const declared = core.PX_PLAYER_SCHEMA_VERSION;
const plan = core.planSchemaRelease({ added, removed, declared, lastReleased: last.version, steps: core.PLAYER_WIRE_STEPS });

console.log('Player schema: declared ' + declared + ', last released ' + last.version + ' (' + last.date + ').');
if (added.length) console.log('  added:   ' + added.join(', '));
if (removed.length) console.log('  removed: ' + removed.join(', '));

if (plan.refuse) {
    console.error('\nREFUSED: ' + plan.refuse);
    process.exit(1);
}

const logProblems = core.releaseLogProblems(releases, core.PLAYER_WIRE_STEPS, plan.changed ? last.version : declared, core.BASELINE_PLAYER_VERSION);
if (!plan.changed && declared === last.version) {
    console.log('No player schema change since ' + last.version + ' — no schema bump.');
} else {
    console.log((plan.changed ? 'Schema change' : 'Semantic step') + ' → release as ' + declared
        + (plan.requiredKind ? ' (' + plan.requiredKind + ')' : '') + '.');
}
if (logProblems.length) console.log('Release-log notes: ' + logProblems.join(' '));

if (!apply) {
    console.log('\nDry run. Re-run with --apply to write.');
    process.exit(0);
}

if (plan.changed || declared !== last.version) {
    const step = core.PLAYER_WIRE_STEPS.find(s => s.to === declared);
    releases.push({
        version: declared, date: new Date().toISOString().slice(0, 10),
        added, removed, note: step ? step.reason : undefined,
    });
    writeFileSync(RELEASES, JSON.stringify(releases, null, 1) + '\n');
    writeFileSync(SNAPSHOT, JSON.stringify(live, null, 1) + '\n');
    console.log('Wrote the ' + declared + ' changelog entry and the field-inventory snapshot.');
}
execFileSync(process.execPath, [resolve(ROOT, 'scripts/gen-schema-json.mjs')], { stdio: 'inherit' });
if (libVersion) {
    const pkg = JSON.parse(readFileSync(PACKAGE, 'utf8'));
    pkg.version = libVersion;
    writeFileSync(PACKAGE, JSON.stringify(pkg, null, 2) + '\n');
    console.log('Library version set to ' + libVersion + ' (schema version unchanged).');
}
