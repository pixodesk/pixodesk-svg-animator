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
        // ONE lever: `playRun` holds a position — 'off' · 'on' · 'paused'; each change presses one button
        h(SvgAnimationPlayer as any, { doc: animation, playRun: paused.value ? 'paused' : playing.value ? 'on' : 'off' }),
      ]),
    ];
  },
}).mount('#app');
