import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { defineConfig } from 'tsup';
import { globalModule, umdGlobalsPlugin } from '../../scripts/umd-globals';

const LIB_LABEL = '@pixodesk/svg-animator-vue';
const RUNTIME_DIR = 'dist-runtime';

// UMD: Vue comes from the page (`window.Vue`, e.g. dist-runtime/vue.global.prod.js). The web
// player stays bundled — its UMD's playback-only surface lacks `toDomProps` / `PxDiagnosticKind`.
const UMD_GLOBALS: ReadonlyMap<string, string> = new Map([
    ['vue', globalModule('Vue', LIB_LABEL)],
]);

const umdBuild = (minified: boolean) => ({
    entry: ['src/index.ts'],
    format: ['iife' as const],
    globalName: 'PixodeskAnimatorVue',
    dts: false,
    clean: false,
    sourcemap: !minified,
    minify: minified,
    esbuildPlugins: [umdGlobalsPlugin(UMD_GLOBALS)],
    outExtension: () => ({ js: minified ? '.umd.min.js' : '.umd.js' }),
});

/** Vue's own global build next to the UMD, for <script>-tag pages (not published: `files` is `dist`). */
function copyVueRuntime() {
    const require = createRequire(path.resolve('package.json'));
    mkdirSync(RUNTIME_DIR, { recursive: true });
    copyFileSync(require.resolve('vue/dist/vue.global.prod.js'), path.join(RUNTIME_DIR, 'vue.global.prod.js'));
}

export default defineConfig((opts) => [
    // ESM and CJS builds (unchanged: same externals and banner as before the UMD split)
    {
        entry: ['src/index.ts'],
        format: ['esm', 'cjs'],
        dts: true,
        clean: !opts.watch,   // watch mode must not wipe dist: dependents (and the examples' copy-umd) resolve files from it
        sourcemap: true,
        minify: false,
        external: ['vue', '@pixodesk/svg-animator-web'],
        esbuildOptions(options) {
            options.banner = {
                js: `var Vue = window.Vue; var PixodeskAnimatorWeb = window.PixodeskAnimator;`,
            };
        },
        outExtension({ format }) {
            if (format === 'esm') return { js: '.js' };
            if (format === 'cjs') return { js: '.cjs' };
            return { js: '.js' };
        },
    },
    // IIFE/UMD builds - Vue from window globals: index.umd.js / index.umd.min.js
    umdBuild(false),
    { ...umdBuild(true), onSuccess: async () => copyVueRuntime() },
]);
