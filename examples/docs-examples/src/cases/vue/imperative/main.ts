import { createApp, h, ref } from 'vue';
import { SvgAnimationPlayer, type PxAnimationPlayerHandle } from '@pixodesk/svg-animator-vue';
import animation from '../../../fixtures/animation.json';

createApp({
  setup() {
    const api = ref<PxAnimationPlayerHandle | null>(null);
    return () => [
      h('div', { class: 'controls' }, [
        h('button', { onClick: () => api.value?.playback.start() }, 'playback.start()'),
        h('button', { onClick: () => api.value?.playback.pause() }, 'playback.pause()'),
        h('button', { onClick: () => api.value?.playback.play() }, 'playback.play()'),
        h('button', { onClick: () => api.value?.playback.stop() }, 'playback.stop()'),
        h('button', { onClick: () => api.value?.playback.setCurrentProgress(1) }, 'playback.setCurrentProgress(1)'),
      ]),
      h('div', { class: 'stage' }, [
        h(SvgAnimationPlayer as any, { document: animation, ref: api }),
      ]),
    ];
  },
}).mount('#app');
