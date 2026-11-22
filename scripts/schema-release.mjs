#!/usr/bin/env node
// PLAYER SCHEMA RELEASE (tasks 5.3 / 5.4) — decides whether this release moves the schema
// version, refuses to release when it should have and did not, and on --apply writes the new
// field-inventory snapshot, the dated changelog entry, and SCHEMA.json.
//
//   node scripts/schema-release.mjs                      dry run: the diff and the bump it requires
//   node scripts/schema-release.mjs --apply              write snapshot + changelog + SCHEMA.json
//   node scripts/schema-release.mjs --apply --lib-version 1.0.35   also set the core npm version
//   node scripts/schema-release.mjs --amend              fold a change into the LAST release (an unpublished version
//                                                        amended again): its added / removed are moved by what changed
//                                                        since the committed field-inventory snapshot (git HEAD)
//
// Build the core first (`pnpm --filter @pixodesk/svg-animator-core build`): this reads dist, the
// same code a user runs. The RULE lives in `PxSchemaRelease.ts`; this file only does I/O.
//
// The LIBRARY version and the SCHEMA version are independent numbers — the library ships far
// more often than the format changes. --lib-version never touches PX_WIRE_SCHEMA_VERSION.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as core from '../packages/svg-animator-core/dist/index.js';
import { parseSchemaChangeCodes } from './lib/schema-change-codes.mjs';
// the field inventory and the bump rule are @internal — see dev-docs/reviews/api-surface-review.md §4
import * as coreInternal from '../packages/svg-animator-core/dist/internal.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CORE = resolve(ROOT, 'packages/svg-animator-core');
const SNAPSHOT = resolve(CORE, 'src/version/schema-field-universe.player.json');
const RELEASES = resolve(CORE, 'src/version/schema-releases.player.json');
const PACKAGE = resolve(CORE, 'package.json');

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const amend = args.includes('--amend');
const libAt = args.indexOf('--lib-version');
const libVersion = libAt >= 0 ? args[libAt + 1] : undefined;

const live = coreInternal.schemaFieldUniverse(core.PxDocumentSchema);
const snapshot = JSON.parse(readFileSync(SNAPSHOT, 'utf8'));
const releases = JSON.parse(readFileSync(RELEASES, 'utf8'));
const last = releases[releases.length - 1];

if (amend) {
    // the snapshot as committed: what the last release record was written against
    const base = JSON.parse(execFileSync('git', ['show', 'HEAD:packages/svg-animator-core/src/version/schema-field-universe.player.json'], { cwd: ROOT }).toString());
    const declaredNow = coreInternal.PX_WIRE_SCHEMA_VERSION;
    if (declaredNow !== last.version) {
        console.error('REFUSED: --amend folds into the last release (' + last.version + '), but the schema declares ' + declaredNow + '.');
        process.exit(1);
    }
    const change = coreInternal.diffFieldUniverse(base, live);
    const wasAdded = new Set(last.added ?? []);
    const wasRemoved = new Set(last.removed ?? []);
    // a key added now that the release had removed: no longer removed; a key removed now that it had added: no longer added
    for (const key of change.added) { if (wasRemoved.has(key)) wasRemoved.delete(key); else wasAdded.add(key); }
    for (const key of change.removed) { if (wasAdded.has(key)) wasAdded.delete(key); else wasRemoved.add(key); }
    last.added = [...wasAdded].sort();
    last.removed = [...wasRemoved].sort();
    const today = new Date().toISOString().slice(0, 10);
    const before = Array.isArray(last.amended) ? last.amended : last.amended ? [last.amended] : [];
    last.amended = before.includes(today) ? before : [...before, today];
    const step = core.PX_WIRE_STEPS.find(st => st.to === last.version);
    if (step) last.note = 'PXS' + step.code + ' — ' + parseSchemaChangeCodes().find(c => c.value === step.code).paragraphs.join(' ');
    console.log('Amending ' + last.version + ': +' + change.added.length + ' −' + change.removed.length + ' keys since the committed snapshot.');
    writeFileSync(RELEASES, JSON.stringify(releases, null, 1) + '\n');
    writeFileSync(SNAPSHOT, JSON.stringify(live, null, 1) + '\n');
    execFileSync(process.execPath, [resolve(ROOT, 'scripts/gen-schema-json.mjs')], { stdio: 'inherit' });
    process.exit(0);
}
const { added, removed } = coreInternal.diffFieldUniverse(snapshot, live);
const declared = coreInternal.PX_WIRE_SCHEMA_VERSION;
const plan = coreInternal.planSchemaRelease({ added, removed, declared, lastReleased: last.version, steps: core.PX_WIRE_STEPS });

console.log('Player schema: declared ' + declared + ', last released ' + last.version + ' (' + last.date + ').');
if (added.length) console.log('  added:   ' + added.join(', '));
if (removed.length) console.log('  removed: ' + removed.join(', '));

if (plan.refuse) {
    console.error('\nREFUSED: ' + plan.refuse);
    process.exit(1);
}

const logProblems = coreInternal.releaseLogProblems(releases, core.PX_WIRE_STEPS, plan.changed ? last.version : declared, core.PX_WIRE_BASELINE_VERSION);
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
    const step = core.PX_WIRE_STEPS.find(s => s.to === declared);
    releases.push({
        version: declared, date: new Date().toISOString().slice(0, 10),
        // the log keeps the words: the step's code, described as on docs/schema-changes.md
        added, removed, note: step ? 'PXS' + step.code + ' — ' + parseSchemaChangeCodes().find(c => c.value === step.code).paragraphs.join(' ') : undefined,
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
