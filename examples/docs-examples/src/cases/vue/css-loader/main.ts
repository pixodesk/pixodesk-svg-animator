import { createApp, h } from 'vue';
import { SvgCssAnimationPlayer } from '@pixodesk/svg-animator-vue';
import AnimationSvg from '../../../fixtures/ball-css-manual.svg?component';   // vite-svg-loader

createApp({
  render: () => h(SvgCssAnimationPlayer as any, { actionTriggers: [{ action: 'timeline.start', event: 'click' }, { action: 'timeline.pause', event: 'click' }], class: 'stage' },
    { default: () => h(AnimationSvg) }),
}).mount('#app');
