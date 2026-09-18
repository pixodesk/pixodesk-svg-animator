# animator-vue

> 📖 Full user guide: [docs/library/vue.md](../../docs/library/vue.md) · [all docs](../../README.md#documentation)

[![CI](https://github.com/pixodesk/pixodesk-svg-animator/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/pixodesk/pixodesk-svg-animator/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Vue component for rendering and controlling Pixodesk SVG animations.


# 🚧 **Status - This project is currently under development.**

## Usage

```vue
<script setup lang="ts">
import { PixodeskSvgAnimator } from '@pixodesk/svg-animator-vue';
import animationDoc from './animation.json';
</script>
```

### Autoplay

Uses triggers defined in the animation document (load, click, hover, scroll):

```vue
<template>
  <PixodeskSvgAnimator :doc="animationDoc" autoplay />
</template>
```

### Declarative play/pause

Control playback with boolean props:

```vue
<script setup lang="ts">
import { ref } from 'vue';
const paused = ref(false);
</script>

<template>
  <PixodeskSvgAnimator :doc="animationDoc" play :pause="paused" />
  <button @click="paused = !paused">Toggle</button>
</template>
```

### Imperative API

Use a template ref for full programmatic control:

```vue
<script setup lang="ts">
import { ref } from 'vue';
import type { VueAnimatorApi } from '@pixodesk/svg-animator-vue';

const animator = ref<VueAnimatorApi | null>(null);
</script>

<template>
  <PixodeskSvgAnimator :doc="animationDoc" ref="animator" />
  <button @click="animator?.play()">Play</button>
  <button @click="animator?.pause()">Pause</button>
</template>
```

<!-- px-check members VueAnimatorApi pkg=vue -->
`VueAnimatorApi` methods: `play()`, `pause()`, `cancel()`, `finish()`, `isPlaying()`, `setPlaybackRate(rate)`, `getCurrentTime()`, `setCurrentTime(ms)`, `getCurrentProgress()`, `setCurrentProgress(p)`.

### Controlled time

Render a single frame — by time in milliseconds, or by fraction of the whole timeline:

```vue
<template>
  <PixodeskSvgAnimator :doc="animationDoc" :time="500" />      <!-- 500 ms in -->
  <PixodeskSvgAnimator :doc="animationDoc" :progress="0.5" />  <!-- halfway through -->
</template>
```

## Props

<!-- px-check props PixodeskSvgAnimator pkg=vue -->
| Prop | Type | Description |
|---|---|---|
| `doc` | `PxAnimatedSvgDocument` | The animation document to render (required) |
| `autoplay` | `boolean` | Use triggers from the document |
| `play` | `boolean` | Start playback, ignoring document triggers |
| `pause` | `boolean` | Pause current playback |
| `progress` | `number` | show the frame at this position in the whole timeline (duration × iterations): `0` is the first frame, `0.5` the middle, `1` the last |
| `time` | `number` | show the frame at that time, in milliseconds from the start |
| `timeline` | `object \| string` | per-instance override of the document's `timeline` block, deep-merged over it — same shape as the file; `null` at any slot deletes that key. A JSON string is accepted too. See [Playback overrides](#playback-overrides) |
| `resetTimeline` | `boolean` | ignore the document's own timeline and start from the player's default timeline, with `timeline` on top |
| `duration` | `number` | Shortcut for `timeline.duration` (ms) |
| `delay` | `number` | Shortcut for `timeline.delay` (ms) |
| `iterations` | `number \| 'infinite'` | Shortcut for `timeline.iterations` |
| `start` | `'load' \| 'mouseOver' \| 'click' \| 'none'` | Shortcut for `timeline.trigger.start` |
| `onWarn` | `(diagnostic) => void` | it plays, but something was ignored, degraded or misspelled; without it → `console.warn` (a prop, not an event — see below) |
| `onError` | `(diagnostic) => void` | this instance will not play — failed to load, parse or build, or the render threw; without it → `console.error` |
| `muteWarn` | `boolean` | switch the `console.warn` fallback off — for when you know the player has something to say about this document and are prepared to tolerate it. `onWarn`, if you gave it, still fires: mute is about the console, not about you |
| `muteError` | `boolean` | the same switch for `console.error` |

With none of `autoplay` / `play` / `pause` / `progress` / `time` set, the component renders the animation statically (initial state, no playback); use the template ref for imperative control.

Note: passing a different `doc` (or unmounting) throws the old animator away and builds a new one; the old instance emits `cancel`, `remove`, and `stop` on its way out. Changing `progress` / `time` does **not** recreate the animator — it just jumps the existing one to the new time.

## Events

<!-- px-check emits PixodeskSvgAnimator pkg=vue -->
| Event | Description |
|---|---|
| `play` | Animation started or resumed |
| `pause` | Animation paused |
| `cancel` | Animation canceled |
| `finish` | Animation reached its end — every iteration played, or `finish()` was called |
| `remove` | Animation cleaned up (e.g. on unmount) |
| `stop` | Fired alongside any event that halts playback (`pause` / `cancel` / `finish` / `remove`) |