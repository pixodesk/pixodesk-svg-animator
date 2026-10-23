import { createApp, h, ref } from 'vue';
import { SvgAnimationPlayer, type PxAnimationPlayerHandle } from '@pixodesk/svg-animator-vue';
import animation from '../../../fixtures/animation.json';

createApp({
  setup() {
    const api = ref<PxAnimationPlayerHandle | null>(null);
    return () => [
      h('div', { class: 'controls' }, [
        h('button', { onClick: () => api.value?.play() }, 'play()'),
        h('button', { onClick: () => api.value?.pause() }, 'pause()'),
        h('button', { onClick: () => api.value?.cancel() }, 'cancel()'),
        h('button', { onClick: () => api.value?.finish() }, 'finish()'),
      ]),
      h('div', { class: 'stage' }, [
        h(SvgAnimationPlayer as any, { doc: animation, ref: api }),
      ]),
    ];
  },
}).mount('#app');
