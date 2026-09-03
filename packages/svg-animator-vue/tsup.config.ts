import { defineConfig } from 'tsup';

export default defineConfig((opts) => ({
    entry: ['src/index.ts'],
    format: ['esm', 'cjs', 'iife'],
    globalName: 'PixodeskAnimatorVue',
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
        if (format === 'iife') return { js: '.umd.js' };
        return { js: '.js' };
    },
}));
