// Commands of `npx @pixodesk/svg-animator-web <command>`.
//   copy-player-library [folder]   copy the player library — the single-file `<script>` build — into your site
// `main` returns the exit code; `io` gives the working folder and the output streams (tests pass their own).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** The single-file build for pages without a build step: exposes the `Pixodesk.SvgAnimator` global. */
export const PLAYER_LIBRARY_FILE = 'pixodesk-svg-animator.umd.min.js';
const PACKAGE_NAME = '@pixodesk/svg-animator-web';
const PACKAGE_DIR = fileURLToPath(new URL('..', import.meta.url));
/** The first line of every copy: names its version, so an update can say what it replaced. */
const versionBanner = (version) => `/*! ${PACKAGE_NAME} ${version} */\n`;
const BANNER_VERSION = new RegExp(`^/\\*! ${PACKAGE_NAME.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')} (\\S+) \\*/`);

const USAGE = `Usage: npx ${PACKAGE_NAME} <command>

Commands:
  copy-player-library [folder]   Copy the player library (${PLAYER_LIBRARY_FILE}) into folder
                                 (default: the current folder), for pages that load it with a
                                 <script> tag. Run it again to update the copy.
  help                           Show this message.`;

/**
 * @param {Array<string>} args the command line after the command name
 * @param {{ cwd: string, out: (line: string) => void, err: (line: string) => void }} io
 * @param {string} [packageDir] the installed package (tests point it at a fixture)
 * @returns {number} the exit code
 */
export function main(args, io, packageDir = PACKAGE_DIR) {
    const [command, ...rest] = args;
    if (command === 'help' || command === '--help' || command === '-h') { io.out(USAGE); return 0; }
    if (command === 'copy-player-library') return copyPlayerLibrary(rest, io, packageDir);
    io.err(command ? `Unknown command: ${command}\n` : 'No command given.\n');
    io.err(USAGE);
    return 2;
}

function copyPlayerLibrary(args, io, packageDir) {
    if (args.length > 1 || args.some((a) => a.startsWith('-'))) {
        io.err(`copy-player-library takes one optional folder, got: ${args.join(' ')}\n`);
        io.err(USAGE);
        return 2;
    }
    const source = path.join(packageDir, 'dist', PLAYER_LIBRARY_FILE);
    if (!fs.existsSync(source)) {
        io.err(`The player library is missing from this package: ${source}\nReinstall ${PACKAGE_NAME} and try again.`);
        return 1;
    }
    const version = JSON.parse(fs.readFileSync(path.join(packageDir, 'package.json'), 'utf8')).version;
    const targetDir = path.resolve(io.cwd, args[0] ?? '.');
    const target = path.join(targetDir, PLAYER_LIBRARY_FILE);
    const previous = fs.existsSync(target) ? copiedVersion(target) : undefined;
    fs.mkdirSync(targetDir, { recursive: true });
    fs.writeFileSync(target, versionBanner(version) + fs.readFileSync(source, 'utf8'));

    // the path the page uses when it sits in the folder the command ran in (forward slashes on Windows too)
    const src = path.relative(io.cwd, target).split(path.sep).join('/');
    io.out(previous === undefined ? `Copied ${src}`
        : previous === version ? `Copied ${src} again (version ${version})`
        : `Replaced ${src}: version ${previous || 'unknown'} → ${version}`);
    io.out('');
    io.out('Load it in your page:');
    io.out(`  <script src="${src}"></script>`);
    io.out('  <script>Pixodesk.SvgAnimator.loadTagSvgAnimators();</script>');
    return 0;
}

/** The version named in an earlier copy's first line ("" when that copy has none). */
function copiedVersion(file) {
    const head = fs.readFileSync(file, 'utf8').slice(0, 200);
    const match = BANNER_VERSION.exec(head);
    return match ? match[1] : '';
}
