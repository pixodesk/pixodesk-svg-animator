import { createApp, h } from 'vue';
import { PixodeskSvgAnimator } from '@pixodesk/svg-animator-vue';
import animation from '../../../fixtures/animation.json';

createApp({
  render: () => h('div', { class: 'stage' }, [
    h(PixodeskSvgAnimator as any, { doc: animation, autoplay: true }),
  ]),
}).mount('#app');
