import { createApp, h, ref } from 'vue';
import { SvgAnimationPlayer } from '@pixodesk/svg-animator-vue';
import animation from '../../../fixtures/animation.json';

createApp({
  setup() {
    const playing = ref(false);
    const paused = ref(false);
    return () => [
      h('div', { class: 'controls' }, [
        h('button', { id: 'play', onClick: () => { playing.value = !playing.value; } }, `play = ${playing.value}`),
        h('button', { id: 'pause', onClick: () => { paused.value = !paused.value; } }, `pause = ${paused.value}`),
      ]),
      h('div', { class: 'stage' }, [
        // two LEVELS: plays while `play` holds, frozen while `pause` holds — or one word: playState
        h(SvgAnimationPlayer as any, { doc: animation, play: playing.value, pause: paused.value }),
      ]),
    ];
  },
}).mount('#app');
