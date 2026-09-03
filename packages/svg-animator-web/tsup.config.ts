import { defineConfig } from 'tsup';
import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

// Two entries, on purpose (see BUNDLE-SIZE-PLAN.md §1):
//   src/index.ts        -> esm + cjs. Full ~96-name surface; consumers tree-shake.
//   src/index.player.ts -> iife/UMD. Playback surface only, because iife CANNOT
//                          tree-shake at the consumer, so every exported name
//                          drags its transitive closure into every <script> tag.
// The `{ 'pixodesk-svg-animator': … }` entry object names the UMD outputs
// (pixodesk-svg-animator.umd.js / .umd.min.js) — the file users copy to their own
// site, so it carries the library's name instead of `index`.

// Bundle the core package into this dist so every output format — including the
// UMD injected into iframes — stays fully self-contained.
const NO_EXTERNAL = ['@pixodesk/svg-animator-core'];
const GLOBAL_NAME = 'PixodeskAnimator';

// --- lever 2: build the UMD from core's SOURCE rather than its prebuilt dist.
// esbuild then sees ~40 individual modules instead of one pre-bundled file, and the
// UMD can never be built against a stale core dist. Worth ~460 B at the current
// compile target. Applied to the iife builds only: esm/cjs stay on the published
// dist so npm consumers get exactly the core build that was published.
const CORE_SRC = path.resolve('../svg-animator-core/src/index.ts');
const umdAlias = (o: { alias?: Record<string, string> }) => {
    o.alias = { ...(o.alias || {}), '@pixodesk/svg-animator-core': CORE_SRC };
};

// --- lever 4: mangle the property names that are provably ours and internal.
// The allowlist is regenerated from the TypeScript AST on every build by
// `scripts/collect-identifiers.mjs` (see the `build` script). Regenerating rather than
// committing the list is the safe direction: if someone later spells one of these names
// as a string literal, the next build DROPS it from the list instead of silently
// renaming a property that is now reached by string.
//
// Applied to the UMD only. The UMD is self-contained — nothing outside it can reach
// these internals. esm/cjs are left alone because the editor app imports from them and
// mangled internals could surprise it.
const IDENTS = path.resolve('../../scripts/.identifiers.json');
function internalPropsRegex(): RegExp | undefined {
    if (!existsSync(IDENTS)) return undefined;   // bare `tsup` without the prebuild step
    const { safeToMangle } = JSON.parse(readFileSync(IDENTS, 'utf8'));
    if (!safeToMangle?.length) return undefined;
    return new RegExp(`^(${safeToMangle.join('|')})$`);
}

// --- lever 3: terser's compress runs its rules in a loop; each pass can expose work for
// the next (inline a constant -> a branch is dead -> its callee is unused). Default is 1.
const COMPRESS_PASSES = 3;

const terserFor = (mangleProps: boolean) => {
    const regex = mangleProps ? internalPropsRegex() : undefined;
    return {
        compress: { passes: COMPRESS_PASSES },
        ...(regex ? { mangle: { properties: { regex } } } : {}),
    };
};

// --- pre-rendered UMD builds (PRERENDERED-PLAYER-BUILDS.md).
// Inlined by the Editor into SVG+JS exports instead of the full player. Same iife shape
// and same global name, so the emitted <script> is unchanged; only the code behind
// `createAnimator` is narrower.
const prerenderedBuild = (name: string, minified: boolean) => ({
    entry: { [`index.${name}`]: `src/index.${name}.ts` },
    format: ['iife' as const],
    globalName: GLOBAL_NAME,
    noExternal: NO_EXTERNAL,
    dts: false,
    clean: false,
    sourcemap: !minified,
    minify: (minified ? 'terser' : false) as 'terser' | false,
    ...(minified ? { terserOptions: terserFor(true) } : {}),
    esbuildOptions: umdAlias,
    outExtension: () => ({ js: minified ? '.umd.min.js' : '.umd.js' }),
});

export default defineConfig((opts) => [
    // ---- esm + cjs, non-minified (with source maps + the package's .d.ts) ----
    {
        entry: ['src/index.ts'],
        format: ['esm', 'cjs'],
        noExternal: NO_EXTERNAL,
        dts: true,
        clean: !opts.watch,   // watch mode must not wipe dist: dependents (and the examples' copy-umd) resolve files from it
        sourcemap: true,
        minify: false,
        outExtension({ format }) {
            return { js: format === 'cjs' ? '.cjs' : '.js' };
        },
    },
    // ---- UMD, non-minified (used by the e2e fixtures) ----
    {
        entry: { 'pixodesk-svg-animator': 'src/index.player.ts' },
        format: ['iife'],
        globalName: GLOBAL_NAME,
        noExternal: NO_EXTERNAL,
        dts: false,
        clean: false,
        sourcemap: true,
        minify: false,
        esbuildOptions: umdAlias,
        outExtension() {
            return { js: '.umd.js' };
        },
    },
    // ---- esm + cjs, minified ----
    {
        entry: ['src/index.ts'],
        format: ['esm', 'cjs'],
        noExternal: NO_EXTERNAL,
        dts: false,
        clean: false,
        sourcemap: false,
        minify: 'terser',
        terserOptions: terserFor(false),
        outExtension({ format }) {
            return { js: format === 'cjs' ? '.min.cjs' : '.min.js' };
        },
    },
    // ---- UMD, minified — the artifact all of this exists for ----
    {
        entry: { 'pixodesk-svg-animator': 'src/index.player.ts' },
        format: ['iife'],
        globalName: GLOBAL_NAME,
        noExternal: NO_EXTERNAL,
        dts: false,
        clean: false,
        sourcemap: false,
        minify: 'terser',
        terserOptions: terserFor(true),
        esbuildOptions: umdAlias,
        outExtension() {
            return { js: '.umd.min.js' };
        },
    },
    // ---- pre-rendered UMDs: index.prerendered[-waapi].umd[.min].js ----
    prerenderedBuild('prerendered', false),
    prerenderedBuild('prerendered', true),
    prerenderedBuild('prerendered-waapi', false),
    prerenderedBuild('prerendered-waapi', true),
]);
