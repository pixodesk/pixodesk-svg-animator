import type { PxAnimatedSvgDocument } from '@pixodesk/svg-animator-web';

/**
 * A framework-agnostic handle over a mounted animation player.
 *
 * The Web (`@pixodesk/svg-animator-web`), React (`@pixodesk/svg-animator-react`)
 * and Vue (`@pixodesk/svg-animator-vue`) packages all expose the same imperative
 * surface (`play` / `pause` / `cancel` / `finish` / `getCurrentTime` /
 * `setCurrentTime`). Each adapter wraps one of them behind this interface so the
 * UI can drive any of them uniformly.
 */
export interface PlayerHandle {
  /** Starts or resumes playback. */
  play(): void;
  /** Pauses at the current frame. */
  pause(): void;
  /** Stops and resets to the initial state. */
  cancel(): void;
  /** Jumps to the end and holds the final frame. */
  finish(): void;
  /** Whether the animation is currently running. */
  isPlaying(): boolean;
  /** Current playback time in milliseconds, or null if unavailable. */
  getCurrentTime(): number | null;
  /** Seeks to a specific time in milliseconds. */
  setCurrentTime(ms: number): void;
  /** Changes playback speed (1 = normal). Only the Web player supports this. */
  setPlaybackRate?(rate: number): void;
  /** Tears down the player and removes it from the DOM. */
  destroy(): void;
}

export type PlayerKind = 'web' | 'react' | 'vue';

/**
 * Loop choice for the preview UI.
 * - `auto`    — use whatever `iterations` the JSON document declares.
 * - `loop`    — force endless looping (`iterations: 'infinite'`).
 * - `no-loop` — force a single play, overriding the document (`iterations: 1`).
 */
export type LoopMode = 'auto' | 'loop' | 'no-loop';

/** Per-mount options applied as overrides on top of the document. */
export interface PlayerOptions {
  /**
   * Overrides the document's `iterations`. When omitted (`auto`), the value
   * declared in the document is used unchanged.
   */
  iterations?: number | 'infinite';
}

/** Translates a {@link LoopMode} into an `iterations` override (or `undefined` for `auto`). */
export function loopModeToIterations(mode: LoopMode): number | 'infinite' | undefined {
  switch (mode) {
    case 'loop':
      return 'infinite';
    case 'no-loop':
      return 1;
    case 'auto':
    default:
      return undefined;
  }
}

/** Factory signature shared by all three player adapters. */
export type PlayerFactory = (
  container: HTMLElement,
  doc: PxAnimatedSvgDocument,
  opts?: PlayerOptions,
) => PlayerHandle;
