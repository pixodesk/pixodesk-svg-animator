/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

// vite-svg-loader with `?component` → a Vue component
declare module '*.svg?component' {
  import type { FunctionalComponent, SVGAttributes } from 'vue';
  const component: FunctionalComponent<SVGAttributes>;
  export default component;
}
