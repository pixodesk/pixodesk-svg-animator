import { createApp, h, ref } from 'vue';
import { SvgAnimationPlayer } from '@pixodesk/svg-animator-vue';
import animation from '../../../fixtures/animation.json';

createApp({
  setup() {
    const playing = ref(false);
    const paused = ref(false);
    return () => [
      h('div', { class: 'controls' }, [
        h('button', { id: 'play', onClick: () => { playing.value = !playing.value; } }, `playWhile = ${playing.value}`),
        h('button', { id: 'pause', onClick: () => { paused.value = !paused.value; } }, `pauseWhile = ${paused.value}`),
      ]),
      h('div', { class: 'stage' }, [
        // two LEVELS: plays while `playWhile` holds, frozen while `pauseWhile` holds — or one word: playState
        h(SvgAnimationPlayer as any, { doc: animation, playWhile: playing.value, pauseWhile: paused.value }),
      ]),
    ];
  },
}).mount('#app');
