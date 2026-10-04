#!/usr/bin/env node
// Proves that the projects under examples/get-started work end to end — the way a user gets
// them: installed with npm, each on its own, then opened in a browser.
//
//   node scripts/check-get-started-examples.mjs [--local] [--no-run] [names…]
//
//   (default)  installs the PUBLISHED packages from the npm registry — what a user downloads today.
//              The CI job `get-started-examples` runs this.
//   --local    packs the WORKSPACE packages (`pnpm pack`: the very tarballs `pnpm publish` would
//              ship, built dist included) and installs those instead — the release about to go
//              out, code and packaging alike. Part of `pnpm build`, so a breaking change fails
//              the build before it is published. Needs the packages built first.
//   --no-run   install and build only; no browser.
//   names…     only these projects (folder names), e.g. `react vue`.
//
// Every project is copied to a temp folder first, so the sources in the repo stay exactly what
// a user downloads: in `--local` mode the copy's dependencies are rewritten to the tarballs
// (`file:` paths) before the same plain `npm install` a user runs — plain on purpose, since
// `npm install <args>` skips the project's own `postinstall`, which the no-build pages rely on.
// A project with a `build` script is built; a project without one (the no-build pages, the Expo
// app) is only installed — the no-build pages' `postinstall` already proves the player file is
// where they copy it from. The web projects are then served and opened in headless Chromium:
// an <svg> must appear, something in it must move, and nothing may error.
import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, createReadStream, writeFileSync } from 'node:fs';
import http from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EXAMPLES = join(REPO, 'examples', 'get-started');
const PACKAGES = join(REPO, 'packages');
const PKG_PREFIX = '@pixodesk/svg-animator-';
/** The pixodesk dependencies each package pulls in — all of them have to come from tarballs too. */
const PKG_DEPS = { core: [], web: ['core'], react: ['web', 'core'], vue: ['web', 'core'], rn: ['core'] };
/** Projects the browser cannot open. */
const NO_BROWSER = new Set(['react-native']);

const args = process.argv.slice(2);
const LOCAL = args.includes('--local');
const RUN = !args.includes('--no-run');
const wanted = args.filter(a => !a.startsWith('--'));

const projects = readdirSync(EXAMPLES, { withFileTypes: true })
    .filter(e => e.isDirectory() && existsSync(join(EXAMPLES, e.name, 'package.json')))
    .map(e => e.name)
    .filter(name => !wanted.length || wanted.includes(name));
if (!projects.length) {
    console.error(`no project found under ${EXAMPLES}${wanted.length ? ` matching ${wanted.join(', ')}` : ''}`);
    process.exit(1);
}

const sh = (cmd, cwd) => execSync(cmd, { cwd, stdio: 'inherit', env: { ...process.env, CI: 'true' } });
const readJson = p => JSON.parse(readFileSync(p, 'utf8'));
const work = mkdtempSync(join(tmpdir(), 'get-started-check-'));

// ---- --local: pack the workspace packages ---------------------------------------------------

/** short name → { version, tarball } */
const packed = new Map();
if (LOCAL) {
    const dest = join(work, 'tarballs');
    for (const short of Object.keys(PKG_DEPS)) {
        const dir = join(PACKAGES, `svg-animator-${short}`);
        if (!existsSync(join(dir, 'dist'))) {
            console.error(`${PKG_PREFIX}${short} has no dist/ — build the packages first (pnpm build)`);
            process.exit(1);
        }
        const out = join(dest, short);
        sh(`pnpm pack --pack-destination "${out}"`, dir);
        const tgz = readdirSync(out).find(f => f.endsWith('.tgz'));
        packed.set(short, { version: readJson(join(dir, 'package.json')).version, tarball: join(out, tgz) });
    }
    console.log(`\npacked: ${[...packed].map(([s, p]) => `${s}@${p.version}`).join(', ')}`);
}

/** The pixodesk packages a project depends on directly, by short name. */
function pixodeskDeps(pkg) {
    return Object.keys(pkg.dependencies ?? {}).filter(n => n.startsWith(PKG_PREFIX)).map(n => n.slice(PKG_PREFIX.length));
}

/** `^a.b.c` → a; anything else → undefined. The examples pin a caret range on purpose. */
const caretMajor = range => /^\^(\d+)\.\d+\.\d+$/.exec(range)?.[1];

// ---- the browser ------------------------------------------------------------------------------

// Playwright lives in examples/docs-examples (the one package here that has it; CI installs its
// Chromium for that package), so it is borrowed from there rather than added to the root.
const chromiumOf = () => createRequire(join(REPO, 'examples/docs-examples/package.json'))('@playwright/test').chromium;

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml' };
function serve(dir) {
    return new Promise(done => {
        const server = http.createServer((req, res) => {
            let p = join(dir, decodeURIComponent(req.url.split('?')[0]));
            if (existsSync(p) && statSync(p).isDirectory()) p = join(p, 'index.html');
            if (!existsSync(p)) { res.writeHead(404); res.end(); return; }
            res.writeHead(200, { 'content-type': MIME[extname(p)] ?? 'application/octet-stream' });
            createReadStream(p).pipe(res);
        });
        server.listen(0, '127.0.0.1', () => done({ server, port: server.address().port }));
    });
}

/** Everything that can visibly change inside the SVGs: animated attributes and computed transforms. */
const SNAPSHOT = () => Array.from(document.querySelectorAll('svg *')).map(el =>
    [el.getAttribute('transform'), el.getAttribute('cx'), el.getAttribute('cy'), el.getAttribute('opacity'), getComputedStyle(el).transform].join('|')).join('\n');

/** Opens the served folder and returns what went wrong, or '' when the animation plays. */
async function plays(browser, dir) {
    const { server, port } = await serve(dir);
    const page = await browser.newPage();
    const errors = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', e => errors.push(e.message));
    try {
        await page.goto(`http://127.0.0.1:${port}/`);
        await page.waitForSelector('svg', { timeout: 10000 });
        const a = await page.evaluate(SNAPSHOT);
        await page.waitForTimeout(500);
        const b = await page.evaluate(SNAPSHOT);
        if (!a.length) return 'the <svg> is empty';
        if (a === b) return 'nothing moves in the <svg>';
        if (errors.length) return 'errors: ' + errors.join(' / ');
        return '';
    } catch (e) {
        return `${e.message.split('\n')[0]}${errors.length ? ' — errors: ' + errors.join(' / ') : ''}`;
    } finally {
        await page.close();
        server.close();
    }
}

// ---- the projects -----------------------------------------------------------------------------

const browser = RUN ? await chromiumOf().launch() : undefined;
const failed = [];
for (const name of projects) {
    const src = join(EXAMPLES, name);
    const dir = join(work, name);
    cpSync(src, dir, { recursive: true, filter: p => !/\/(node_modules|dist|js|package-lock\.json)(\/|$)/.test(p.slice(src.length)) });
    const pkg = readJson(join(dir, 'package.json'));
    const direct = pixodeskDeps(pkg);
    console.log(`\n=== ${name} (${LOCAL ? 'packed workspace packages' : 'published packages'})`);
    try {
        if (LOCAL) {
            // The example's ranges must still cover the version about to ship — else a user who
            // downloads the example after the release gets an old major.
            for (const short of direct) {
                const range = pkg.dependencies[PKG_PREFIX + short];
                const major = packed.get(short).version.split('.')[0];
                if (caretMajor(range) !== major) throw new Error(`${name} depends on ${PKG_PREFIX}${short} "${range}", but the workspace version is ${packed.get(short).version} — bump the example's range`);
            }
            // Every pixodesk package the project pulls in, direct or through another one, becomes a
            // top-level `file:` dependency, so npm takes the tarball and never asks the registry.
            const set = new Set(direct.flatMap(short => [short, ...PKG_DEPS[short]]));
            for (const short of set) pkg.dependencies[PKG_PREFIX + short] = `file:${packed.get(short).tarball}`;
            writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
            sh('npm install --no-audit --no-fund', dir);
            for (const short of set) {
                const installed = readJson(join(dir, 'node_modules', `${PKG_PREFIX}${short}`, 'package.json')).version;
                if (installed !== packed.get(short).version) throw new Error(`${PKG_PREFIX}${short}: installed ${installed}, expected the packed ${packed.get(short).version}`);
            }
        } else {
            sh('npm install --no-audit --no-fund', dir);
        }
        if (pkg.scripts?.build) sh('npm run build', dir);
        if (browser && !NO_BROWSER.has(name)) {
            const problem = await plays(browser, pkg.scripts?.build ? join(dir, 'dist') : dir);
            if (problem) throw new Error(`does not play — ${problem}`);
            console.log(`${name}: plays`);
        }
    } catch (e) {
        console.error(`${name}: FAILED — ${e.message}`);
        failed.push(name);
    }
}
await browser?.close();
rmSync(work, { recursive: true, force: true });

const what = `${RUN ? 'install, build and play' : 'install and build'} with the ${LOCAL ? 'packed workspace' : 'published'} packages`;
console.log(`\n${projects.length - failed.length} of ${projects.length} get-started projects ${what}${failed.length ? ` — FAILED: ${failed.join(', ')}` : ''}`);
process.exit(failed.length ? 1 : 0);
