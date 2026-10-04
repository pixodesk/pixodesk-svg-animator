#!/usr/bin/env node
// Installs and builds every project under examples/get-started — the way a user gets them:
// with npm, from the PUBLISHED packages, each on its own. They are outside the pnpm workspace
// on purpose, so nothing else in this repository exercises them; this is what CI runs.
//
//   node scripts/check-get-started-examples.mjs            # every project
//   node scripts/check-get-started-examples.mjs react vue  # some of them
//
// A project with a `build` script is built; one without (the no-build pages, the Expo app) is
// only installed — for the no-build pages that already proves the player file is where their
// `postinstall` copies it from. Install artifacts (node_modules, dist, js/, package-lock.json)
// are gitignored.
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'examples', 'get-started');
const wanted = process.argv.slice(2);
const projects = readdirSync(ROOT, { withFileTypes: true })
    .filter(e => e.isDirectory() && existsSync(join(ROOT, e.name, 'package.json')))
    .map(e => e.name)
    .filter(name => !wanted.length || wanted.includes(name));

if (!projects.length) {
    console.error(`no project found under ${ROOT}${wanted.length ? ` matching ${wanted.join(', ')}` : ''}`);
    process.exit(1);
}

const run = (cmd, cwd) => execSync(cmd, { cwd, stdio: 'inherit', env: { ...process.env, CI: 'true' } });
const failed = [];
for (const name of projects) {
    const dir = join(ROOT, name);
    const scripts = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).scripts ?? {};
    const steps = ['npm install --no-audit --no-fund', ...(scripts.build ? ['npm run build'] : [])];
    console.log(`\n=== ${name}: ${steps.join(' && ')}`);
    try {
        for (const step of steps) run(step, dir);
    } catch {
        failed.push(name);
    }
}

console.log(`\n${projects.length - failed.length} of ${projects.length} get-started projects install${failed.length ? '' : ' and build'}` +
    (failed.length ? ` — FAILED: ${failed.join(', ')}` : ''));
process.exit(failed.length ? 1 : 0);
