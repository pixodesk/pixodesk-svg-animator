import { createApp, h } from 'vue';
import { SvgAnimationPlayer } from '@pixodesk/svg-animator-vue';
import animation from '../../../fixtures/animation.json';

createApp({
  render: () => h('div', { class: 'stage' }, [
    // no control prop: the document's own trigger plays it — here, start on load
    h(SvgAnimationPlayer as any, { document: animation }),
  ]),
}).mount('#app');
