import { createApp, h, ref } from 'vue';
import { SvgAnimationPlayer, type PxAnimationPlayerHandle } from '@pixodesk/svg-animator-vue';
import animation from '../../../fixtures/animation.json';

createApp({
  setup() {
    const api = ref<PxAnimationPlayerHandle | null>(null);
    return () => [
      h('div', { class: 'controls' }, [
        h('button', { onClick: () => api.value?.timeline.start() }, 'timeline.start()'),
        h('button', { onClick: () => api.value?.timeline.pause() }, 'timeline.pause()'),
        h('button', { onClick: () => api.value?.timeline.play() }, 'timeline.play()'),
        h('button', { onClick: () => api.value?.timeline.stop() }, 'timeline.stop()'),
        h('button', { onClick: () => api.value?.timeline.setCurrentProgress(1) }, 'timeline.setCurrentProgress(1)'),
      ]),
      h('div', { class: 'stage' }, [
        // disableActionTriggers: the file's own trigger is off, so only these buttons start it
        h(SvgAnimationPlayer as any, { document: animation, disableActionTriggers: true, ref: api }),
      ]),
    ];
  },
}).mount('#app');
