import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import vue from '@vitejs/plugin-vue';
import svgr from 'vite-plugin-svgr';
import svgLoader from 'vite-svg-loader';
import { fileURLToPath } from 'node:url';
import { CASES, casePath } from './cases.mjs';

const root = fileURLToPath(new URL('.', import.meta.url));

// One Vite project, three frameworks. React and Vue coexist as long as each page has
// its own entry; the two SVG-as-component loaders coexist as long as they claim
// different import forms:
//   import Svg from './a.svg?react'      → vite-plugin-svgr  (React component)
//   import Svg from './a.svg?component'  → vite-svg-loader   (Vue component)
//   import url from './a.svg'            → a plain URL
export default defineConfig({
  // Relative base so dist/ works from any path — a sub-folder on a static host,
  // or opened straight from the filesystem.
  base: './',
  plugins: [
    react(),
    vue(),
    svgr({
      // SVGO's inlineStyles would move the class-based rules out of <style> onto the
      // elements, which breaks the class toggling PixodeskSvgCssAnimator relies on.
      svgrOptions: { svgo: false },
    }),
    svgLoader({ defaultImport: 'url', svgo: false }),
  ],
  build: {
    rollupOptions: {
      // Multi-page: the browser page plus every case page, straight from the manifest.
      input: Object.fromEntries([
        ['index', root + 'index.html'],
        ...CASES.map(c => [`${c.group}-${c.id}`, root + casePath(c)]),
      ]),
    },
  },
  server: { port: 5176 },
});
