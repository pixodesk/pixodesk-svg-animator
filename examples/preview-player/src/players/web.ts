import { createSvgAnimationPlayer, type PxDocument } from '@pixodesk/svg-animator-web';
import { playOnTriggerFor, type PlayerHandle, type PlayerOptions } from './types';

/** Mounts the vanilla Web player (`createSvgAnimationPlayer`) into `container`. */
export function createWebPlayer(
  container: HTMLElement,
  doc: PxDocument,
  opts?: PlayerOptions,
): PlayerHandle {
  const api = createSvgAnimationPlayer({
    doc,
    container,
    // Trigger handling (programmatic / from-file / custom) is shared across all players.
    playOnTrigger: playOnTriggerFor(opts),
    // The Loop picker and the visibility gate, merged over the document's own timeline;
    // `undefined` keeps the document's values — the same option the React and Vue
    // components take.
    timeline: opts?.timeline,
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
