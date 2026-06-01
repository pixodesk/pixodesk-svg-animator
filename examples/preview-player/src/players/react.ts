import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { PixodeskSvgAnimator, type ReactAnimatorApi } from '@pixodesk/svg-animator-react';
import type { PxAnimatedSvgDocument } from '@pixodesk/svg-animator-web';
import type { PlayerHandle, PlayerOptions } from './types';

/** Mounts the React `<PixodeskSvgAnimator/>` component into `container`. */
export function createReactPlayer(
  container: HTMLElement,
  doc: PxAnimatedSvgDocument,
  opts?: PlayerOptions,
): PlayerHandle {
  // `apiRef.current` is populated by the component's `useImperativeHandle` after
  // it commits — i.e. on the next frame, by which time the UI calls into it.
  const apiRef: React.RefObject<ReactAnimatorApi | null> = { current: null };

  const root = createRoot(container);
  root.render(
    createElement(PixodeskSvgAnimator, {
      doc,
      apiRef,
      // The component overrides the document's iterations when this prop is set;
      // leaving it `undefined` (auto) keeps the document's own value.
      iterations: opts?.iterations,
      style: { width: '100%', height: '100%' },
    }),
  );

  const api = () => apiRef.current;
  return {
    play: () => api()?.play(),
    pause: () => api()?.pause(),
    cancel: () => api()?.cancel(),
    finish: () => api()?.finish(),
    isPlaying: () => api()?.isPlaying() ?? false,
    getCurrentTime: () => api()?.getCurrentTime() ?? null,
    setCurrentTime: (ms) => api()?.setCurrentTime(ms),
    destroy: () => root.unmount(),
  };
}
