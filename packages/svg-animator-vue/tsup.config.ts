import { defineConfig } from 'tsup';

// ESM + CJS only: Vue users always have a bundler. A page without one uses the web player's
// `<script>` build (`Pixodesk.SvgAnimator`) — the former Vue IIFE build bundled its own Vue.
export default defineConfig((opts) => ({
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    clean: !opts.watch,   // watch mode must not wipe dist: dependents (and the examples' copy-umd) resolve files from it
    sourcemap: true,
    minify: false,
    external: ['vue', '@pixodesk/svg-animator-web'],
    outExtension({ format }) {
        if (format === 'esm') return { js: '.js' };
        if (format === 'cjs') return { js: '.cjs' };
        return { js: '.js' };
    },
}));
