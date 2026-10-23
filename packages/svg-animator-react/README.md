# animator-react

> 📖 Full user guide: [docs/library/react.md](../../docs/library/react.md) · [all docs](../../README.md#documentation)

[![CI](https://github.com/pixodesk/pixodesk-svg-animator/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/pixodesk/pixodesk-svg-animator/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

React component for rendering and controlling Pixodesk SVG animations.


# 🚧 **Status - This project is currently under development.**

## Usage

```tsx
import { SvgAnimationPlayer } from '@pixodesk/svg-animator-react';
import { PxDocument } from '@pixodesk/svg-animator-web';
import _animation from './animation.json';

const animation: PxDocument = _animation;
```

### Autoplay

Uses triggers defined in the animation document (load, click, hover, scroll):

```tsx
<SvgAnimationPlayer doc={animation} playOnTrigger />
```

### Declarative play/pause

Control playback with boolean props:

```tsx
const [play, setPlay] = useState(false);
const [pause, setPause] = useState(false);

<SvgAnimationPlayer doc={animation} play={play} pause={pause} />
<button onClick={() => setPlay(p => !p)}>
  {play ? 'Play (on)' : 'Play (off)'}
</button>
<button onClick={() => setPause(p => !p)}>
  {pause ? 'Pause (on)' : 'Pause (off)'}
</button>
```

### Imperative API

Use a ref for full programmatic control:

```tsx
import { useRef } from 'react';
import type { PxAnimationPlayerHandle } from '@pixodesk/svg-animator-react';

const playerRef = useRef<PxAnimationPlayerHandle>(null);

<SvgAnimationPlayer doc={animation} apiRef={playerRef} />
<button onClick={() => playerRef.current?.play()}>Play</button>
<button onClick={() => playerRef.current?.pause()}>Pause</button>
<button onClick={() => playerRef.current?.cancel()}>Cancel</button>
<button onClick={() => playerRef.current?.finish()}>Finish</button>
```

<!-- px-check members PxAnimationPlayerHandle pkg=react -->
`PxAnimationPlayerHandle` methods: `getDuration()` (one pass, ms — the slider maximum), `play()`, `pause()`, `cancel()`, `finish()`, `playOnce()` (one fresh pass from the start, whatever the file's iterations say), `isPlaying()`, `setPlaybackRate(rate)`, `getCurrentTime()`, `setCurrentTime(ms)`, `getCurrentProgress()`, `setCurrentProgress(p)`.

### Controlled time

Move through the animation with a slider, or show one fixed frame:

```tsx
const [time, setTime] = useState(0);

<SvgAnimationPlayer doc={animation} time={time} />
<input
  type="range"
  min={0}
  max={2000}
  value={time}
  onChange={e => setTime(Number(e.target.value))}
/>
```


## Props

<!-- px-check props SvgAnimationPlayerProps pkg=react -->
| Prop | Type | Description |
|---|---|---|
| `doc` | `PxDocumentInput` | The animation document to render (required); a `.json` import passes as-is |
| `playOnTrigger` | `boolean` | Use triggers from the document |
| `play` | `boolean` | Start playback, ignoring document triggers |
| `pause` | `boolean` | Pause current playback |
| `playMode` | `'none' \| 'forwards' \| 'backwards' \| 'both'` | One-shot documents: which pose changes PLAY vs snap (default `forwards` — plays there, snaps back) |
| `completeIteration` | `boolean` | Looping documents: `play={false}` finishes the current iteration, then rests |
| `apiRef` | `RefObject<PxAnimationPlayerHandle>` | Ref for imperative control |
| `progress` | `number` | show the frame at this position in the whole timeline (duration × iterations): `0` is the first frame, `0.5` the middle, `1` the last |
| `time` | `number` | show the frame at that time, in milliseconds from the start |
| `timeline` | `object \| string` | per-instance override of the document's `timeline` block, deep-merged over it — same shape as the file; `null` at any slot deletes that key. A JSON string is accepted too. See [Overriding from a player](../../docs/library/playback-and-triggers.md#overriding-from-a-player) |
| `resetTimeline` | `boolean` | ignore the document's own timeline and start from the player's default timeline, with `timeline` on top |
| `inTime` / `outTime` | `number` | Shortcuts for the content window, `timeline.inTime` / `.outTime` (ms) | <!-- px names=inTime,outTime -->
| `playDuration` | `number` | Shortcut for `timeline.playDuration` — the window in wall ms |
| `delay` | `number` | Shortcut for `timeline.delay` (ms) |
| `iterations` | `number \| 'infinite'` | Shortcut for `timeline.iterations` |
| `start` | `'load' \| 'hover' \| 'click' \| 'manual'` | Shortcut for `timeline.trigger.start` |
| `outOfView` | `PxOutOfViewAction` | Shortcut for `timeline.trigger.outOfView` |
| `hoverEnd` | `PxHoverEndAction` | Shortcut for `timeline.trigger.hoverEnd` |
| `inViewThreshold` | `number` | Shortcut for `timeline.trigger.inViewThreshold` |
| `inViewDebounce` | `number` | Shortcut for `timeline.trigger.inViewDebounce` |
| `onReady` | `() => void` | The player exists and the SVG is rendered — once, async |
| `onPlay` | `() => void` | Called on play/resume |
| `onPause` | `() => void` | Called on pause |
| `onFinish` | `() => void` | Called when the animation reaches its end — every iteration played, or `finish()` was called |
| `onCancel` | `() => void` | Called on cancel |
| `onDestroy` | `() => void` | Called when the animation is destroyed (e.g. unmount) |
| `onStop` | `() => void` | "No longer playing, whatever the reason" — fires after any of pause / cancel / finish / destroy |
| `onWarn` | `(diagnostic) => void` | it plays, but something was ignored, degraded or misspelled; without it → `console.warn` |
| `onError` | `(diagnostic) => void` | this instance will not play — failed to load, parse or build, or the render threw; without it → `console.error` |
| `muteWarn` | `boolean` | switch the `console.warn` fallback off — for when you know the player has something to say about this document and are prepared to tolerate it. `onWarn`, if you gave it, still fires: mute is about the console, not about you |
| `muteError` | `boolean` | the same switch for `console.error` |
| `className` | `string` | CSS class applied to the rendered root `<svg>` |
| `style` | `CSSProperties` | Inline styles applied to the rendered root `<svg>` |

With none of `playOnTrigger` / `play` / `pause` / `apiRef` / `progress` / `time` set, the component renders the animation statically (initial state, no playback).

Note: passing a different `doc` (or unmounting) throws the old player away and builds a new one; the old instance emits `onCancel`, `onDestroy`, and `onStop` on its way out. Changing `progress` / `time` does **not** recreate the animator — it just jumps the existing one to the new time.