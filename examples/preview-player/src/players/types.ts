import type { PxDocument, PxTimelinePatch, PxTrigger } from '@pixodesk/svg-animator-web';

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

/** Per-mount options applied as overrides on top of the document — the same two every player takes. */
export interface PlayerOptions {
  /**
   * A merge over the document's `animator.timeline`: the Loop picker's `iterations`, and the
   * visibility gate (`outOfViewAction`, `inViewThreshold`, `inViewDebounce`) of a custom trigger.
   * When omitted, the values declared in the document are used unchanged.
   */
  timeline?: PxTimelinePatch;
  /**
   * Trigger handling:
   *  - `undefined` → programmatic (the UI transport owns start; default);
   *  - `'file'`    → use the document's own `animator.timeline.trigger` unchanged;
   *  - `PxTrigger` → this trigger instead of the document's — the WHOLE block.
   */
  trigger?: 'file' | PxTrigger;
}

/**
 * The `playOnTrigger` option / prop every player takes, from the {@link PlayerOptions.trigger}
 * choice. Shared by all three player adapters so "Use trigger" behaves identically everywhere:
 *  - default (no `trigger`)  → absent: the player builds STILL and the transport buttons own
 *    start — the document's own trigger is replaced by an empty one, so nothing starts it by
 *    itself (the web player's rule for a missing `playOnTrigger`, and the components' static mode);
 *  - `'file'`                → `true`: the document's own trigger drives;
 *  - a config object         → that trigger, as a whole, instead of the document's.
 */
export function playOnTriggerFor(opts?: PlayerOptions): boolean | PxTrigger | undefined {
  const t = opts?.trigger;
  return t === undefined ? undefined : t === 'file' ? true : t;
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
  doc: PxDocument,
  opts?: PlayerOptions,
) => PlayerHandle;
