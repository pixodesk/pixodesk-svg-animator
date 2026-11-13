import { createApp, h, onMounted, ref } from 'vue';
import { SvgAnimationPlayer, type PxAnimationPlayerHandle } from '@pixodesk/svg-animator-vue';
import type { PxDocument } from '@pixodesk/svg-animator-web';
import { controlOptionsFor, type PlayerHandle, type PlayerOptions } from './types';

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
          document: doc,
          ref: animRef,
          // The Loop picker and the visibility gate, merged over the document's own
          // timeline; leaving it `undefined` (auto) keeps the document's own values.
          timelineOptions: opts?.timelineOptions,
          // The gate's `outOfView` behavior — an actions block instead of the document's own.
          actions: opts?.actions,
          // Trigger handling (programmatic / from-file / custom).
          ...controlOptionsFor(opts),
          style: { width: '100%', height: '100%' },
        });
    },
  });
  app.mount(container);

  return {
    start: () => api?.playback.start(),
    play: () => api?.playback.play(),
    pause: () => api?.playback.pause(),
    stop: () => api?.playback.stop(),
    isPlaying: () => api?.playback.isPlaying() ?? false,
    getCurrentTime: () => api?.playback.getCurrentTime() ?? null,
    setCurrentTime: (ms) => api?.playback.setCurrentTime(ms),
    setSpeed: (speed) => api?.playback.setSpeed(speed),
    destroy: () => app.unmount(),
  };
}
