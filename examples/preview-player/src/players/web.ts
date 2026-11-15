import { createSvgAnimationPlayer, type PxDocument } from '@pixodesk/svg-animator-web';
import { controlOptionsFor, type PlayerHandle, type PlayerOptions } from './types';

/** Mounts the vanilla Web player (`createSvgAnimationPlayer`) into `container`. */
export function createWebPlayer(
  container: HTMLElement,
  doc: PxDocument,
  opts?: PlayerOptions,
): PlayerHandle {
  const api = createSvgAnimationPlayer({
    document: doc,
    container,
    // Trigger handling (programmatic / from-file / custom) is shared across all players.
    ...controlOptionsFor(opts),
    // The Loop picker and the visibility gate, merged over the document's own timeline;
    // `undefined` keeps the document's values — the same option the React and Vue
    // components take.
    timelineOptions: opts?.timelineOptions,
    // The gate's `outOfView` behavior — an actions block instead of the document's own.
    actions: opts?.actions,
  });

  return {
    start: () => api.timeline.start(),
    play: () => api.timeline.play(),
    pause: () => api.timeline.pause(),
    stop: () => api.timeline.stop(),
    isPlaying: () => api.timeline.isPlaying(),
    getCurrentTime: () => api.timeline.getCurrentTime(),
    setCurrentTime: (ms) => api.timeline.setCurrentTime(ms),
    setSpeed: (speed) => api.timeline.setSpeed(speed),
    destroy: () => api.destroy(),
  };
}
