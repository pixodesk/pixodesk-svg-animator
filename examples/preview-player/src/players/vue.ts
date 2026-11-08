import { createApp, h, onMounted, ref } from 'vue';
import { SvgAnimationPlayer, type PxAnimationPlayerHandle } from '@pixodesk/svg-animator-vue';
import type { PxDocument } from '@pixodesk/svg-animator-web';
import { playUsingActionTriggersFor, type PlayerHandle, type PlayerOptions } from './types';

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
          timelineOptions: opts?.timelineOptions,
          // The gate's `outOfView` behavior, merged over the document's own actions.
          actions: opts?.actions,
          // Trigger handling (programmatic / from-file / custom).
          playUsingActionTriggers: playUsingActionTriggersFor(opts),
          style: { width: '100%', height: '100%' },
        });
    },
  });
  app.mount(container);

  return {
    play: () => api?.play(),
    pause: () => api?.pause(),
    jumpToStart: () => api?.jumpToStart(),
    finish: () => api?.jumpToEnd(),
    isPlaying: () => api?.isPlaying() ?? false,
    getCurrentTime: () => api?.getCurrentTime() ?? null,
    setCurrentTime: (ms) => api?.setCurrentTime(ms),
    setPlaybackSpeed: (speed) => api?.setPlaybackSpeed(speed),
    destroy: () => app.unmount(),
  };
}
