import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    sourcemap: true,
    minify: false,
    // Keep core EXTERNAL (unlike the web package): Metro resolves workspace/npm
    // deps fine, and keeping it external lets the RN app share one core copy.
    // Peer deps (react, react-native, react-native-svg, reanimated) are
    // externalised by tsup automatically.
    outExtension({ format }) {
        if (format === 'esm') return { js: '.js' };
        if (format === 'cjs') return { js: '.cjs' };
        return { js: '.js' };
    },
});
