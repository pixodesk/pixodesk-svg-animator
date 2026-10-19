import { createApp, h } from 'vue';
import { SvgCssAnimator } from '@pixodesk/svg-animator-vue';
import AnimationSvg from '../../../fixtures/ball-css-manual.svg?component';   // vite-svg-loader

createApp({
  render: () => h(SvgCssAnimator as any, { start: 'click', mouseOut: 'pause', class: 'stage' },
    { default: () => h(AnimationSvg) }),
}).mount('#app');
