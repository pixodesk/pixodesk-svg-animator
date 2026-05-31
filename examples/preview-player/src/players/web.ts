import { createAnimator, type PxAnimatedSvgDocument } from '@pixodesk/svg-animator-web';
import type { PlayerHandle } from './types';

/**
 * Returns a copy of the document whose start trigger is `programmatic`, so the
 * animator does not auto-start on load and the UI is in full control.
 */
function programmatic(doc: PxAnimatedSvgDocument): PxAnimatedSvgDocument {
  const cfg = doc.animator ?? {};
  return {
    ...doc,
    animator: {
      ...cfg,
      trigger: { ...(cfg.trigger ?? {}), startOn: 'programmatic' },
    },
  };
}

/** Mounts the vanilla Web player (`createAnimator`) into `container`. */
export function createWebPlayer(container: HTMLElement, doc: PxAnimatedSvgDocument): PlayerHandle {
  const api = createAnimator({ data: programmatic(doc), container });

  return {
    play: () => api.play(),
    pause: () => api.pause(),
    cancel: () => api.cancel(),
    finish: () => api.finish(),
    isPlaying: () => api.isPlaying(),
    getCurrentTime: () => api.getCurrentTime(),
    setCurrentTime: (ms) => api.setCurrentTime(ms),
    setPlaybackRate: (rate) => api.setPlaybackRate(rate),
    destroy: () => api.destroy(),
  };
}
