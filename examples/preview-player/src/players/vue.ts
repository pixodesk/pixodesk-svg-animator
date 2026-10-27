import { createApp, h, onMounted, ref } from 'vue';
import { SvgAnimationPlayer, type PxAnimationPlayerHandle } from '@pixodesk/svg-animator-vue';
import type { PxDocument } from '@pixodesk/svg-animator-web';
import { playOnTriggerFor, type PlayerHandle, type PlayerOptions } from './types';

/** Mounts the Vue `<SvgAnimationPlayer/>` component into `container`. */
export function createVuePlayer(
  container: HTMLElement,
  doc: PxDocument,
  opts?: PlayerOptions,
): PlayerHandle {
  // The component `expose()`s its imperative API; a template ref captures it.
  let api: PxAnimationPlayerHandle | null = null;

  const app = createApp({
    setup() {
      const animRef = ref<PxAnimationPlayerHandle | null>(null);
      onMounted(() => {
        api = animRef.value;
      });
      return () =>
        h(SvgAnimationPlayer as any, {
          doc,
          ref: animRef,
          // The Loop picker and the visibility gate, merged over the document's own
          // timeline; leaving it `undefined` (auto) keeps the document's own values.
          timeline: opts?.timeline,
          // Trigger handling (programmatic / from-file / custom).
          playOnTrigger: playOnTriggerFor(opts),
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
    setPlaybackRate: (rate) => api?.setPlaybackRate(rate),
    destroy: () => app.unmount(),
  };
}
