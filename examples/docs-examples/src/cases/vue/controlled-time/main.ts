import { createApp, h, ref } from 'vue';
import { PixodeskSvgAnimator } from '@pixodesk/svg-animator-vue';
import animation from '../../../fixtures/animation.json';

createApp({
  setup() {
    const time = ref(0);
    return () => [
      h('div', { class: 'controls' }, [
        h('label', ['time ',
          h('input', { id: 'time-slider', type: 'range', min: 0, max: 2000, value: time.value,
                       onInput: (e: Event) => { time.value = Number((e.target as HTMLInputElement).value); } }),
          ' ', h('span', { id: 'ms' }, String(time.value)), ' ms']),
      ]),
      h('div', { class: 'stage' }, [
        h(PixodeskSvgAnimator as any, { doc: animation, time: time.value }),
      ]),
    ];
  },
}).mount('#app');
