import { createApp, h } from 'vue';
import { SvgAnimator } from '@pixodesk/svg-animator-vue';
import animation from '../../../fixtures/animation.json';

createApp({
  render: () => h('div', { class: 'stage' }, [
    h(SvgAnimator as any, { doc: animation, autoplay: true }),
  ]),
}).mount('#app');
