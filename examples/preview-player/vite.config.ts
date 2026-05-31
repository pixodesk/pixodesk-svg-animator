import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the production build in `dist/` can be opened/hosted from any
  // path (including straight from the filesystem or a sub-folder on a static host).
  base: './',
  server: {
    port: 5175,
  },
});
