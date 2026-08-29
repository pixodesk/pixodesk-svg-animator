import { createApp, h } from 'vue';
import { PixodeskSvgCssAnimator } from '@pixodesk/svg-animator-vue';
import AnimationSvg from '../../../fixtures/ball-css-manual.svg?component';   // vite-svg-loader

createApp({
  render: () => h(PixodeskSvgCssAnimator as any, { startOn: 'click', outAction: 'pause', class: 'stage' },
    { default: () => h(AnimationSvg) }),
}).mount('#app');
