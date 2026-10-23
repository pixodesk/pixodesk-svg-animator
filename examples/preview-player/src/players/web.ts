import { createSvgAnimationPlayer, type PxDocument } from '@pixodesk/svg-animator-web';
import { applyTriggerOverride, type PlayerHandle, type PlayerOptions } from './types';

/** Mounts the vanilla Web player (`createSvgAnimationPlayer`) into `container`. */
export function createWebPlayer(
  container: HTMLElement,
  doc: PxDocument,
  opts?: PlayerOptions,
): PlayerHandle {
  const api = createSvgAnimationPlayer({
    playOnTrigger: true,
    // Trigger handling (programmatic / from-file / custom) is shared across all players.
    doc: applyTriggerOverride(doc, opts),
    container,
    // The player overrides the document's iterations when this option is set;
    // leaving it `undefined` (auto) keeps the document's own value — the same
    // shortcut the React and Vue components take.
    iterations: opts?.iterations,
  });

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
