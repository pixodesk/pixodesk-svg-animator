import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';


export default defineConfig({
  plugins: [
    react(),
    svgr({
      svgrOptions: {
        // vite-plugin-svgr does not run SVGO by default, but we explicitly disable it here
        // to prevent future versions from enabling it. SVGO's inlineStyles plugin inlines
        // class-based CSS rules from <style> onto elements, which breaks the dynamic class
        // toggling used by PixodeskSvgCssAnimator.
        svgo: false
      }
    })
  ]
});