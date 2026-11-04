import { createSvgAnimationPlayer, type PxDocument } from '@pixodesk/svg-animator-web';
import { playUsingActionTriggersFor, type PlayerHandle, type PlayerOptions } from './types';

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
    playUsingActionTriggers: playUsingActionTriggersFor(opts),
    // The Loop picker and the visibility gate, merged over the document's own timeline;
    // `undefined` keeps the document's values — the same option the React and Vue
    // components take.
    timelineOptions: opts?.timelineOptions,
    // The gate's `outOfView` behavior, merged over the document's own actions.
    actions: opts?.actions,
  });

  return {
    play: () => api.play(),
    pause: () => api.pause(),
    reset: () => api.reset(),
    finish: () => api.jumpToEnd(),
    isPlaying: () => api.isPlaying(),
    getCurrentTime: () => api.getCurrentTime(),
    setCurrentTime: (ms) => api.setCurrentTime(ms),
    setPlaySpeed: (speed) => api.setPlaySpeed(speed),
    destroy: () => api.destroy(),
  };
}
