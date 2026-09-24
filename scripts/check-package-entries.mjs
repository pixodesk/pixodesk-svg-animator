#!/usr/bin/env node
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// Fails when a published package would hand a bundler its UMD build.
//
//   node scripts/check-package-entries.mjs
//
// `pnpm build` runs it, so a bad entry cannot reach npm.
//
// WHY THIS EXISTS
// The UMD/IIFE bundle is for a `<script>` tag: it takes React / Vue / the web player from
// `window.*` and assigns one global. It exports nothing a bundler can read. So a bundler that
// picks it gets an EMPTY module — `import { PixodeskSvgAnimator }` is then `undefined`, and the
// app fails at render with a bare "element type is invalid", far from the cause.
//
// `browser` is the trap. It is meant for swapping a Node-only file for a browser-safe one, but
// bundlers targeting the web rank it ABOVE `module`/`main`, and it is consulted whenever `exports`
// is bypassed — which webpack does for any `resolve.alias` pointing at a package directory. The
// react and vue players shipped `browser: dist/index.umd.js` and broke exactly that way
// (Pixodesk Animator Studio 1.8.123, every export).
//
// The UMD still ships; it is advertised through `unpkg` / `jsdelivr`, which is what CDNs read and
// what no bundler resolves through.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGES_DIR = join(ROOT, 'packages');

/** Fields a bundler or Node resolves a bare import through. None may be a UMD build. */
const RESOLUTION_FIELDS = ['main', 'module', 'browser', 'types'];

/** Fields that exist to point a CDN at the `<script>` build. These SHOULD be the UMD. */
const CDN_FIELDS = ['unpkg', 'jsdelivr'];

const isUmd = value => typeof value === 'string' && /\.umd(\.min)?\.js$/.test(value);

/** Every string leaf of an `exports` map, with the condition path that reaches it. */
function* exportTargets(node, path = 'exports') {
    if (typeof node === 'string') {
        yield [path, node];
    } else if (node && typeof node === 'object') {
        for (const [key, value] of Object.entries(node)) yield* exportTargets(value, `${path}.${key}`);
    }
}

const problems = [];

for (const name of readdirSync(PACKAGES_DIR)) {
    const pkgPath = join(PACKAGES_DIR, name, 'package.json');
    if (!existsSync(pkgPath)) continue;

    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    if (pkg.private) continue;
    const where = `packages/${name}/package.json`;

    for (const field of RESOLUTION_FIELDS) {
        if (isUmd(pkg[field])) {
            problems.push(
                `${where}: "${field}": "${pkg[field]}" — a resolution field must never be the UMD build.\n` +
                `    The UMD exports nothing to a bundler, so consumers get undefined imports.\n` +
                `    Point it at the ESM/CJS build; advertise the UMD through "unpkg" / "jsdelivr".`
            );
        }
    }

    for (const [conditionPath, target] of exportTargets(pkg.exports)) {
        if (isUmd(target)) {
            problems.push(`${where}: "${conditionPath}": "${target}" — the UMD build must not be reachable through "exports".`);
        }
    }

    // A CDN field that points anywhere else is almost certainly a mistake (it would serve the
    // bundler-facing build to `<script>` users, who then get no global).
    for (const field of CDN_FIELDS) {
        if (pkg[field] !== undefined && !isUmd(pkg[field])) {
            problems.push(`${where}: "${field}": "${pkg[field]}" — a CDN field should point at the UMD build.`);
        }
    }
}

if (problems.length) {
    console.error('Package entry check FAILED:\n');
    for (const problem of problems) console.error('  - ' + problem + '\n');
    process.exit(1);
}

console.log('Package entry check passed — no package resolves to a UMD build.');
