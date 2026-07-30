import { defineConfig } from 'tsup';

export default defineConfig([
    // Non-minified build (with source maps)
    {
        entry: ['src/index.ts'],
        format: ['esm', 'cjs'],
        dts: true,
        clean: true,
        sourcemap: true,
        minify: false,
        outExtension({ format }) {
            if (format === 'esm') return { js: '.js' };
            if (format === 'cjs') return { js: '.cjs' };
            return { js: '.js' };
        },
    },
    // Minified build (no source maps)
    {
        entry: ['src/index.ts'],
        format: ['esm', 'cjs'],
        dts: false,
        clean: false,
        sourcemap: false,
        minify: 'terser',
        outExtension({ format }) {
            if (format === 'esm') return { js: '.min.js' };
            if (format === 'cjs') return { js: '.min.cjs' };
            return { js: '.min.js' };
        },
    },
]);
