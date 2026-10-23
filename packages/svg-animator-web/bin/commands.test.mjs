// @vitest-environment node
// `npx @pixodesk/svg-animator-web <command>` — run against a fixture package and a temp site folder.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { main, PLAYER_LIBRARY_FILE } from './commands.mjs';

const LIBRARY = '"use strict";var Pixodesk=Pixodesk||{};Pixodesk.SvgAnimator=(()=>{})();';
let root, pkg, site, out, err;

/** A package folder like the installed one: package.json + dist/<library>. */
function fixturePackage(version, withLibrary = true) {
    fs.mkdirSync(path.join(pkg, 'dist'), { recursive: true });
    fs.writeFileSync(path.join(pkg, 'package.json'), JSON.stringify({ name: '@pixodesk/svg-animator-web', version }));
    if (withLibrary) fs.writeFileSync(path.join(pkg, 'dist', PLAYER_LIBRARY_FILE), LIBRARY);
}
const run = (...args) => main(args, { cwd: site, out: (l) => out.push(l), err: (l) => err.push(l) }, pkg);
const copy = (folder = '.') => fs.readFileSync(path.join(site, folder, PLAYER_LIBRARY_FILE), 'utf8');

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'px-cli-'));
    pkg = path.join(root, 'package');
    site = path.join(root, 'site');
    fs.mkdirSync(site);
    out = []; err = [];
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe('copy-player-library', () => {
    it('copies the library into the current folder, first line naming its version, and prints the tags', () => {
        fixturePackage('1.0.50');
        expect(run('copy-player-library')).toBe(0);
        expect(copy()).toBe(`/*! @pixodesk/svg-animator-web 1.0.50 */\n${LIBRARY}`);
        expect(out).toEqual([
            `Copied ${PLAYER_LIBRARY_FILE}`,
            '',
            'Load it in your page:',
            `  <script src="${PLAYER_LIBRARY_FILE}"></script>`,
            '  <script>Pixodesk.SvgAnimator.createSvgAnimatorsFromPage();</script>',
        ]);
    });

    it('copies into a given folder, creating it, and the tag uses that path', () => {
        fixturePackage('1.0.50');
        expect(run('copy-player-library', 'js/vendor')).toBe(0);
        expect(copy('js/vendor')).toContain(LIBRARY);
        expect(out[0]).toBe(`Copied js/vendor/${PLAYER_LIBRARY_FILE}`);
        expect(out[3]).toBe(`  <script src="js/vendor/${PLAYER_LIBRARY_FILE}"></script>`);
    });

    it('says which version an update replaced', () => {
        fixturePackage('1.0.50');
        run('copy-player-library');
        fixturePackage('1.1.0');
        out = [];
        expect(run('copy-player-library')).toBe(0);
        expect(out[0]).toBe(`Replaced ${PLAYER_LIBRARY_FILE}: version 1.0.50 → 1.1.0`);
        expect(copy()).toBe(`/*! @pixodesk/svg-animator-web 1.1.0 */\n${LIBRARY}`);
    });

    it('a re-run of the same version says so; a copy without the version line reads as unknown', () => {
        fixturePackage('1.0.50');
        run('copy-player-library');
        out = [];
        run('copy-player-library');
        expect(out[0]).toBe(`Copied ${PLAYER_LIBRARY_FILE} again (version 1.0.50)`);
        fs.writeFileSync(path.join(site, PLAYER_LIBRARY_FILE), LIBRARY);   // copied by hand, before the command existed
        out = [];
        run('copy-player-library');
        expect(out[0]).toBe(`Replaced ${PLAYER_LIBRARY_FILE}: version unknown → 1.0.50`);
    });

    it('fails clearly when the package has no library file', () => {
        fixturePackage('1.0.50', false);
        expect(run('copy-player-library')).toBe(1);
        expect(err.join('\n')).toContain('The player library is missing from this package');
        expect(fs.existsSync(path.join(site, PLAYER_LIBRARY_FILE))).toBe(false);
    });

    it('rejects options and extra arguments with the usage', () => {
        fixturePackage('1.0.50');
        expect(run('copy-player-library', '--force')).toBe(2);
        expect(run('copy-player-library', 'a', 'b')).toBe(2);
        expect(err.join('\n')).toContain('Usage: npx @pixodesk/svg-animator-web <command>');
    });
});

describe('the command line', () => {
    it('help prints the usage; no command or an unknown one is a usage error', () => {
        fixturePackage('1.0.50');
        expect(run('help')).toBe(0);
        expect(out.join('\n')).toContain('copy-player-library [folder]');
        expect(run()).toBe(2);
        expect(run('copy-player-script')).toBe(2);
        expect(err.join('\n')).toContain('Unknown command: copy-player-script');
    });
});
