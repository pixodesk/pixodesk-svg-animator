import { createApp, h } from 'vue';
import { SvgCssAnimationPlayer } from '@pixodesk/svg-animator-vue';
import AnimationSvg from '../../../fixtures/ball-css-manual.svg?component';   // vite-svg-loader

createApp({
  render: () => h(SvgCssAnimationPlayer as any, { start: 'click', hoverEnd: 'pause', class: 'stage' },
    { default: () => h(AnimationSvg) }),
}).mount('#app');
