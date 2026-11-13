import type { PxActionsOptions, PxDocument, PxTimelineOptions, PxActionTriggers } from '@pixodesk/svg-animator-web';

/**
 * A framework-agnostic handle over a mounted animation player.
 *
 * The Web (`@pixodesk/svg-animator-web`), React (`@pixodesk/svg-animator-react`)
 * and Vue (`@pixodesk/svg-animator-vue`) packages all expose the same imperative
 * surface, `player.playback` (`start` / `play` / `pause` / `stop` / `getCurrentTime` /
 * `setCurrentTime` / `setSpeed`). Each adapter wraps one of them behind this interface so the
 * UI can drive any of them uniformly.
 */
export interface PlayerHandle {
  /** Plays from the start, in every state — a restart while playing or paused (`playback.start()`). */
  start(): void;
  /** Start or carry on: resumes a pause, does nothing while playing, otherwise starts (`playback.play()`). */
  play(): void;
  /** Freezes the playback at the current frame (`playback.pause()`). */
  pause(): void;
  /** Ends the playback as the document's stop action says — back to the rest pose by default (`playback.stop()`). */
  stop(): void;
  /** Whether the animation is currently running. */
  isPlaying(): boolean;
  /** The frame on screen: ms inside the current iteration (0..duration), or null if unavailable. */
  getCurrentTime(): number | null;
  /** Seeks inside the current iteration, ms — while not playing, the playback is then paused at that frame. */
  setCurrentTime(ms: number): void;
  /** Changes the play speed (1 = normal, 2 = double, negative = backwards). Wired for the Web player only in this UI. */
  setSpeed?(speed: number): void;
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

/** Per-mount options applied as overrides on top of the document — the same three every player takes. */
export interface PlayerOptions {
  /**
   * A merge over the document's `animator.timeline`: the Loop picker's `iterations`, and the
   * visibility numbers (`inViewThreshold`, `inViewDebounce`) of custom triggers.
   * When omitted, the values declared in the document are used unchanged.
   */
  timelineOptions?: PxTimelineOptions;
  /**
   * A merge over the document's `animator.timeline.actions`: the gate's `outOfView` behavior of
   * custom triggers. When omitted, the document's own actions are used unchanged.
   */
  actions?: PxActionsOptions;
  /**
   * Trigger handling:
   *  - `undefined`  → programmatic (the UI transport owns start; default);
   *  - `'file'`     → use the document's own `animator.timeline.actionTriggers` unchanged;
   *  - `PxActionTriggers` → these triggers instead of the document's — the WHOLE block.
   */
  actionTriggers?: 'file' | PxActionTriggers;
}

/**
 * The `playerActionTriggers` option / prop every player takes, from the {@link PlayerOptions.actionTriggers}
 * choice. Shared by all three player adapters so "Use trigger" behaves identically everywhere:
 *  - default (no `actionTriggers`) → absent: the player builds STILL and the transport buttons own
 *    start — the document's own triggers are replaced by an empty block, so nothing starts it by
 *    itself (the web player's rule for a missing `playerActionTriggers`, and the components' static mode);
 *  - `'file'`                → `true`: the document's own triggers drive;
 *  - a config object         → those triggers, as a whole, instead of the document's.
 */
export function playerActionTriggersFor(opts?: PlayerOptions): boolean | PxActionTriggers | undefined {
  const t = opts?.actionTriggers;
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
