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

Uses the trigger defined in the animation document (load, hover, click — behind the visibility
gate), or the trigger object you pass instead of `true`:

```tsx
<SvgAnimationPlayer doc={animation} playOnTrigger />
<SvgAnimationPlayer doc={animation} playOnTrigger={{ playStart: 'hoverIn', pauseStart: 'hoverOut' }} />
```

### Declarative play/pause

Control playback with boolean props — `play` is the state (`true` a play-start, `false` a play-stop);
how each looks is the timeline's `playStartAction` / `playStopAction` / `completeIterationOnPlayStop`,
adjusted through `timeline`:

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

<SvgAnimationPlayer doc={animation} playerRef={playerRef} />
<button onClick={() => playerRef.current?.play()}>Play</button>
<button onClick={() => playerRef.current?.pause()}>Pause</button>
<button onClick={() => playerRef.current?.stop()}>Stop</button>
<button onClick={() => playerRef.current?.finish()}>Finish</button>
```

<!-- px-check members PxAnimationPlayerHandle pkg=react -->
`PxAnimationPlayerHandle` methods: `getDuration()` (one pass, ms — the slider maximum), `play()` (paused → resume, otherwise the configured play-start), `pause()`, `stop()` (the configured play-stop — after the current iteration when the timeline asks for that), `cancel()` (reset now, unconditionally), `finish()`, `playOnce()` (one fresh pass from the start, whatever the file's iterations say), `isPlaying()`, `setPlaybackRate(rate)`, `getCurrentTime()`, `setCurrentTime(ms)`, `getCurrentProgress()`, `setCurrentProgress(p)`.

### Controlled time

Move through the animation with a slider, or show one fixed frame:

```tsx
const [time, setTime] = useState(0);

<SvgAnimationPlayer doc={animation} playCurrentTime={time} />
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
| `playOnTrigger` | `boolean \| PxTrigger` | `true`: play on the document's own trigger; an object: this trigger instead — `{ playStart, playStop, pauseStart, pauseStop }`, each one event or a list of `'load' \| 'hoverIn' \| 'hoverOut' \| 'click'`. See [Triggers](../../docs/library/playback-and-triggers.md#triggers--when-it-plays) |
| `play` | `boolean` | The state: `true` a play-start, `false` a play-stop. How each looks is the timeline's `playStartAction` / `playStopAction` / `completeIterationOnPlayStop` — see [Play on, play off, play end](../../docs/library/playback-and-triggers.md#play-start-play-stop-play-finish--how-a-transition-looks) |
| `pause` | `boolean` | Freeze the current frame / resume; only while `play` is true |
| `playerRef` | `RefObject<PxAnimationPlayerHandle \| null>` | Ref for imperative control; filled in every mode |
| `playCurrentProgress` | `number` | show the frame at this position in the whole timeline (duration × iterations): `0` is the first frame, `0.5` the middle, `1` the last |
| `playCurrentTime` | `number` | show the frame at that time, in milliseconds from the start |
| `timeline` | `PxTimelinePatch` | per-instance override of the document's `timeline` block, minus its `trigger`, deep-merged over it — same shape as the file; `null` at any slot deletes that key. See [Overriding from a player](../../docs/library/playback-and-triggers.md#overriding-from-a-player) |
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

With none of `playOnTrigger` / `play` / `pause` / `playCurrentProgress` / `playCurrentTime` set, the component renders the animation statically (initial state, no playback); `playerRef` on its own is such a case.

Note: passing a different `doc` (or unmounting) throws the old player away and builds a new one; the old instance emits `onCancel`, `onDestroy`, and `onStop` on its way out. Changing `playCurrentProgress` / `playCurrentTime` does **not** recreate the animator — it just jumps the existing one to the new position.