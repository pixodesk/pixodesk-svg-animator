import { createApp, h, onMounted, ref } from 'vue';
import { PixodeskSvgAnimator, type VueAnimatorApi } from '@pixodesk/svg-animator-vue';
import type { PxAnimatedSvgDocument } from '@pixodesk/svg-animator-web';
import type { PlayerHandle } from './types';

/** Mounts the Vue `<PixodeskSvgAnimator/>` component into `container`. */
export function createVuePlayer(container: HTMLElement, doc: PxAnimatedSvgDocument): PlayerHandle {
  // The component `expose()`s its imperative API; a template ref captures it.
  let api: VueAnimatorApi | null = null;

  const app = createApp({
    setup() {
      const animRef = ref<VueAnimatorApi | null>(null);
      onMounted(() => {
        api = animRef.value;
      });
      return () =>
        h(PixodeskSvgAnimator as any, {
          doc,
          ref: animRef,
          style: { width: '100%', height: '100%' },
        });
    },
  });
  app.mount(container);

  return {
    play: () => api?.play(),
    pause: () => api?.pause(),
    cancel: () => api?.cancel(),
    finish: () => api?.finish(),
    isPlaying: () => api?.isPlaying() ?? false,
    getCurrentTime: () => api?.getCurrentTime() ?? null,
    setCurrentTime: (ms) => api?.setCurrentTime(ms),
    destroy: () => app.unmount(),
  };
}
