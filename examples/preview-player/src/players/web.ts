import { createAnimator, type PxAnimatedSvgDocument } from '@pixodesk/svg-animator-web';
import { applyTriggerOverride, type PlayerHandle, type PlayerOptions } from './types';

/**
 * Returns a copy of the document with playback forced to `programmatic` (so the
 * UI is in full control of start), and `iterations` overridden when requested.
 */
function withOverrides(doc: PxAnimatedSvgDocument, opts?: PlayerOptions): PxAnimatedSvgDocument {
  // Trigger handling (programmatic / from-file / custom) is shared across all players.
  const withTrigger = applyTriggerOverride(doc, opts);
  const cfg = withTrigger.animator ?? {};
  return {
    ...withTrigger,
    animator: {
      ...cfg,
      // `auto` leaves the document's iterations untouched; `loop`/`no-loop`
      // pass 'infinite'/1 here and override it.
      iterations: opts?.iterations !== undefined ? opts.iterations : cfg.iterations,
    },
  };
}

/** Mounts the vanilla Web player (`createAnimator`) into `container`. */
export function createWebPlayer(
  container: HTMLElement,
  doc: PxAnimatedSvgDocument,
  opts?: PlayerOptions,
): PlayerHandle {
  const api = createAnimator({ data: withOverrides(doc, opts), container });

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
