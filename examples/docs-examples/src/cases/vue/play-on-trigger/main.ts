import { createApp, h } from 'vue';
import { SvgAnimationPlayer } from '@pixodesk/svg-animator-vue';
import animation from '../../../fixtures/animation.json';

createApp({
  render: () => h('div', { class: 'stage' }, [
    h(SvgAnimationPlayer as any, { doc: animation, playOnTrigger: true }),
  ]),
}).mount('#app');
