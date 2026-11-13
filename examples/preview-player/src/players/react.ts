import { createElement, type RefObject } from 'react';
import { createRoot } from 'react-dom/client';
import { SvgAnimationPlayer, type PxAnimationPlayerHandle } from '@pixodesk/svg-animator-react';
import type { PxDocument } from '@pixodesk/svg-animator-web';
import { controlOptionsFor, type PlayerHandle, type PlayerOptions } from './types';

/** Mounts the React `<SvgAnimationPlayer/>` component into `container`. */
export function createReactPlayer(
  container: HTMLElement,
  doc: PxDocument,
  opts?: PlayerOptions,
): PlayerHandle {
  // `playerRef.current` is populated by the component's `useImperativeHandle` after
  // it commits — i.e. on the next frame, by which time the UI calls into it.
  const playerRef: RefObject<PxAnimationPlayerHandle | null> = { current: null };

  const root = createRoot(container);
  root.render(
    createElement(SvgAnimationPlayer, {
      document: doc,
      playerRef,
      // The Loop picker and the visibility gate, merged over the document's own timeline;
      // leaving it `undefined` (auto) keeps the document's own values.
      timelineOptions: opts?.timelineOptions,
      // The gate's `outOfView` behavior — an actions block instead of the document's own.
      actions: opts?.actions,
      // Trigger handling (programmatic / from-file / custom).
      ...controlOptionsFor(opts),
      style: { width: '100%', height: '100%' },
    }),
  );

  const api = () => playerRef.current;
  return {
    start: () => api()?.playback.start(),
    play: () => api()?.playback.play(),
    pause: () => api()?.playback.pause(),
    stop: () => api()?.playback.stop(),
    isPlaying: () => api()?.playback.isPlaying() ?? false,
    getCurrentTime: () => api()?.playback.getCurrentTime() ?? null,
    setCurrentTime: (ms) => api()?.playback.setCurrentTime(ms),
    setSpeed: (speed) => api()?.playback.setSpeed(speed),
    destroy: () => root.unmount(),
  };
}
