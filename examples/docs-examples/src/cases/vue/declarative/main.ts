import { createApp, h, ref } from 'vue';
import { PixodeskSvgAnimator } from '@pixodesk/svg-animator-vue';
import animation from '../../../fixtures/animation.json';

createApp({
  setup() {
    const play = ref(false);
    const pause = ref(false);
    return () => [
      h('div', { class: 'controls' }, [
        h('button', { id: 'play', onClick: () => { play.value = !play.value; } }, `play = ${play.value}`),
        h('button', { id: 'pause', onClick: () => { pause.value = !pause.value; } }, `pause = ${pause.value}`),
      ]),
      h('div', { class: 'stage' }, [
        h(PixodeskSvgAnimator as any, { doc: animation, play: play.value, pause: pause.value }),
      ]),
    ];
  },
}).mount('#app');
