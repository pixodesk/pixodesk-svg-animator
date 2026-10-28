# animator-vue

> 📖 Full user guide: [docs/library/vue.md](../../docs/library/vue.md) · [all docs](../../README.md#documentation)

[![CI](https://github.com/pixodesk/pixodesk-svg-animator/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/pixodesk/pixodesk-svg-animator/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Vue component for rendering and controlling Pixodesk SVG animations.


# 🚧 **Status - This project is currently under development.**

## Usage

```vue
<script setup lang="ts">
import { SvgAnimationPlayer } from '@pixodesk/svg-animator-vue';
import animationDoc from './animation.json';
</script>
```

### Autoplay

Uses the triggers defined in the animation document (load, hover, click — behind the visibility
gate), or the triggers object you bind instead of `true`:

```vue
<template>
  <SvgAnimationPlayer :doc="animationDoc" playOnTrigger />
  <SvgAnimationPlayer :doc="animationDoc" :playOnTrigger="{ start: 'hoverIn', pause: 'hoverOut' }" />
  <!-- a click starts it, the next click stops it -->
  <SvgAnimationPlayer :doc="animationDoc" :playOnTrigger="{ togglePlay: 'click' }" />
</template>
```

### Declarative play/pause

Control playback with boolean props — `play` is the state (`true` calls the built-in `start`,
`false` the built-in `stop`); how each looks is the file's `timeline.actions`, adjusted through the
`actions` prop:

```vue
<script setup lang="ts">
import { ref } from 'vue';
const paused = ref(false);
</script>

<template>
  <SvgAnimationPlayer :doc="animationDoc" play :pause="paused" />
  <button @click="paused = !paused">Toggle</button>
</template>
```

### Imperative API

Use a template ref for full programmatic control:

```vue
<script setup lang="ts">
import { ref } from 'vue';
import type { PxAnimationPlayerHandle } from '@pixodesk/svg-animator-vue';

const player = ref<PxAnimationPlayerHandle | null>(null);
</script>

<template>
  <SvgAnimationPlayer :doc="animationDoc" ref="player" />
  <button @click="player?.play()">Play</button>
  <button @click="player?.pause()">Pause</button>
  <button @click="player?.stop()">Stop</button>
</template>
```

<!-- px-check members PxAnimationPlayerHandle pkg=vue -->
`PxAnimationPlayerHandle` methods: `getDuration()` (one pass, ms — the slider maximum), `play()` (paused → resume, otherwise the configured start), `pause()`, `stop()` (the configured stop — after the current iteration when the file asks for that), `cancel()` (reset now, unconditionally), `finish()`, `playOnce()` (one fresh pass from the start, whatever the file's iterations say), `isPlaying()`, `setPlaybackRate(rate)`, `getCurrentTime()`, `setCurrentTime(ms)`, `getCurrentProgress()`, `setCurrentProgress(p)`.

### Controlled time

Render a single frame — by time in milliseconds, or by fraction of the whole timeline:

```vue
<template>
  <SvgAnimationPlayer :doc="animationDoc" :playCurrentTime="500" />      <!-- 500 ms in -->
  <SvgAnimationPlayer :doc="animationDoc" :playCurrentProgress="0.5" />  <!-- halfway through -->
</template>
```

## Props

<!-- px-check props SvgAnimationPlayer pkg=vue -->
| Prop | Type | Description |
|---|---|---|
| `doc` | `PxDocumentInput` | The animation document to render (required); a `.json` import passes as-is |
| `playOnTrigger` | `boolean \| PxTriggers` | `true`: play on the document's own triggers; an object: these triggers instead — `{ start, stop, pause, resume, togglePlay, togglePause }`, each one event or a list of `'load' \| 'hoverIn' \| 'hoverOut' \| 'click'`. See [Triggers](../../docs/library/playback-and-triggers.md#triggers--when-it-plays) |
| `play` | `boolean` | The state: `true` calls the built-in `start`, `false` the built-in `stop`. How each looks is the file's `actions` (and the `actions` prop) — see [Actions](../../docs/library/playback-and-triggers.md#actions--how-start-stop-and-finish-look) |
| `pause` | `boolean` | Freeze the current frame / resume; only while `play` is true |
| `playCurrentProgress` | `number` | show the frame at this position in the whole timeline (duration × iterations): `0` is the first frame, `0.5` the middle, `1` the last |
| `playCurrentTime` | `number` | show the frame at that time, in milliseconds from the start |
| `timeline` | `PxTimelinePatch` | per-instance override of the document's `timeline` block, minus its `triggers` and `actions`, deep-merged over it — same shape as the file; `null` at any slot deletes that key. See [Overriding from a player](../../docs/library/playback-and-triggers.md#overriding-from-a-player) |
| `actions` | `PxActionsPatch` | per-instance override of how the built-in actions look — `{ stop: { transition: 'rewind' } }` — deep-merged over the document's `timeline.actions`; `null` at any slot deletes it. See [Overriding from a player](../../docs/library/playback-and-triggers.md#overriding-from-a-player) |
| `onWarn` | `(diagnostic) => void` | it plays, but something was ignored, degraded or misspelled; without it → `console.warn` (a prop, not an event — see below) |
| `onError` | `(diagnostic) => void` | this instance will not play — failed to load, parse or build, or the render threw; without it → `console.error` |
| `muteWarn` | `boolean` | switch the `console.warn` fallback off — for when you know the player has something to say about this document and are prepared to tolerate it. `onWarn`, if you gave it, still fires: mute is about the console, not about you |
| `muteError` | `boolean` | the same switch for `console.error` |

With none of `playOnTrigger` / `play` / `pause` / `playCurrentProgress` / `playCurrentTime` set, the component renders the animation statically (initial state, no playback); use the template ref for imperative control.

Note: passing a different `doc` (or unmounting) throws the old player away and builds a new one; the old instance emits `cancel`, `destroy`, and `stop` on its way out. Changing `playCurrentProgress` / `playCurrentTime` does **not** recreate the animator — it just jumps the existing one to the new position.

## Events

<!-- px-check emits SvgAnimationPlayer pkg=vue -->
| Event | Description |
|---|---|
| `ready` | The player exists and the SVG is rendered (once, async) |
| `play` | Animation started or resumed |
| `pause` | Animation paused |
| `cancel` | Animation canceled |
| `finish` | Animation reached its end — every iteration played, or `finish()` was called |
| `destroy` | The player was torn down (e.g. on unmount) |
| `stop` | "No longer playing, whatever the reason" — fired alongside `pause` / `cancel` / `finish` / `destroy` |