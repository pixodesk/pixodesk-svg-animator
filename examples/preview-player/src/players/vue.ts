import { createApp, h, onMounted, ref } from 'vue';
import { PixodeskSvgAnimator, type VueAnimatorApi } from '@pixodesk/svg-animator-vue';
import type { PxAnimatedSvgDocument } from '@pixodesk/svg-animator-web';
import type { PlayerHandle, PlayerOptions } from './types';

/** Mounts the Vue `<PixodeskSvgAnimator/>` component into `container`. */
export function createVuePlayer(
  container: HTMLElement,
  doc: PxAnimatedSvgDocument,
  opts?: PlayerOptions,
): PlayerHandle {
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
          // The component overrides the document's iterations when this prop is
          // set; leaving it `undefined` (auto) keeps the document's own value.
          iterations: opts?.iterations,
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
