import { defineConfig } from 'tsup';
import { globalModule, reactJsxRuntimeModule, umdGlobalsPlugin } from '../../scripts/umd-globals';

const LIB_LABEL = '@pixodesk/svg-animator-react';

// UMD: React + ReactDOM come from the page (`window.React` / `window.ReactDOM`, e.g.
// dist-runtime/react-runtime.umd.min.js). The web player stays bundled — its UMD's playback-only
// surface lacks `toDomProps` / `PxDiagnosticKind`, which this package imports.
const UMD_GLOBALS: ReadonlyMap<string, string> = new Map([
    ['react', globalModule('React', LIB_LABEL)],
    ['react-dom', globalModule('ReactDOM', LIB_LABEL)],
    ['react/jsx-runtime', reactJsxRuntimeModule(LIB_LABEL)],
]);

const umdBuild = (minified: boolean) => ({
    entry: ['src/index.ts'],
    format: ['iife' as const],
    globalName: 'PixodeskAnimatorReact',
    dts: false,
    clean: false,
    sourcemap: !minified,
    minify: minified,
    esbuildPlugins: [umdGlobalsPlugin(UMD_GLOBALS)],
    outExtension: () => ({ js: minified ? '.umd.min.js' : '.umd.js' }),
});

export default defineConfig((opts) => [
    // ESM and CJS builds - no banner, use proper module imports
    {
        entry: ['src/index.ts'],
        format: ['esm', 'cjs'],
        dts: true,
        clean: !opts.watch,   // watch mode must not wipe dist: dependents (and the examples' copy-umd) resolve files from it
        sourcemap: true,
        minify: false,
        // external: ['react', 'react-dom', '@pixodesk/svg-animator-web'],
        outExtension({ format }) {
            if (format === 'esm') return { js: '.js' };
            if (format === 'cjs') return { js: '.cjs' };
            return { js: '.js' };
        },
    },
    // IIFE/UMD builds - React from window globals: index.umd.js / index.umd.min.js
    umdBuild(false),
    umdBuild(true),
    // React 19 ships no UMD: React + ReactDOM as page globals, for <script>-tag pages (not published)
    {
        entry: { 'react-runtime': 'umd/react-runtime.js' },
        format: ['iife'],
        platform: 'browser',
        outDir: 'dist-runtime',
        env: { NODE_ENV: 'production' },
        dts: false,
        clean: false,
        sourcemap: false,
        minify: true,
        outExtension: () => ({ js: '.umd.min.js' }),
    },
]);
