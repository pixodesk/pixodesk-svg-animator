import { createApp, h } from 'vue';
import { SvgCssAnimationPlayer } from '@pixodesk/svg-animator-vue';
import AnimationSvg from '../../../fixtures/ball-css-manual.svg?component';   // vite-svg-loader

createApp({
  render: () => h(SvgCssAnimationPlayer as any, { actions: [{ name: 'timeline.start', triggers: [{ event: 'click' }] }, { name: 'timeline.pause', triggers: [{ event: 'click' }] }], class: 'stage' },
    { default: () => h(AnimationSvg) }),
}).mount('#app');
