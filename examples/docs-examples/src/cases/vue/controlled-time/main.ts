import { createApp, h, ref } from 'vue';
import { PixodeskSvgAnimator } from '@pixodesk/svg-animator-vue';
import animation from '../../../fixtures/animation.json';

createApp({
  setup() {
    const timeMs = ref(0);
    return () => [
      h('div', { class: 'controls' }, [
        h('label', ['timeMs ',
          h('input', { id: 'seek', type: 'range', min: 0, max: 2000, value: timeMs.value,
                       onInput: (e: Event) => { timeMs.value = Number((e.target as HTMLInputElement).value); } }),
          ' ', h('span', { id: 'ms' }, String(timeMs.value)), ' ms']),
      ]),
      h('div', { class: 'stage' }, [
        h(PixodeskSvgAnimator as any, { doc: animation, timeMs: timeMs.value }),
      ]),
    ];
  },
}).mount('#app');
