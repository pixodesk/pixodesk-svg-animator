import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import svgLoader from 'vite-svg-loader';

export default defineConfig({
  plugins: [
    vue(),
    svgLoader({ 
      // SVGO's inlineStyles plugin moves class-based CSS rules from <style> to inline attributes,
      // which breaks the dynamic class toggling used by PixodeskSvgCssAnimator.
      svgo: false                 
    })
  ],
  server: {
    port: 5174,
  }
});
