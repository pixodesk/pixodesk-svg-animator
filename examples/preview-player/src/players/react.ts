import { createElement, type RefObject } from 'react';
import { createRoot } from 'react-dom/client';
import { SvgAnimationPlayer, type PxAnimationPlayerHandle } from '@pixodesk/svg-animator-react';
import type { PxDocument } from '@pixodesk/svg-animator-web';
import { playOnTriggerFor, type PlayerHandle, type PlayerOptions } from './types';

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
      doc,
      playerRef,
      // The Loop picker and the visibility gate, merged over the document's own timeline;
      // leaving it `undefined` (auto) keeps the document's own values.
      timeline: opts?.timeline,
      // The gate's `suspend` transition, merged over the document's own actions.
      actions: opts?.actions,
      // Trigger handling (programmatic / from-file / custom).
      playOnTrigger: playOnTriggerFor(opts),
      style: { width: '100%', height: '100%' },
    }),
  );

  const api = () => playerRef.current;
  return {
    play: () => api()?.play(),
    pause: () => api()?.pause(),
    cancel: () => api()?.cancel(),
    finish: () => api()?.finish(),
    isPlaying: () => api()?.isPlaying() ?? false,
    getCurrentTime: () => api()?.getCurrentTime() ?? null,
    setCurrentTime: (ms) => api()?.setCurrentTime(ms),
    setPlaybackRate: (rate) => api()?.setPlaybackRate(rate),
    destroy: () => root.unmount(),
  };
}
