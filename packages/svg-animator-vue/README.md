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

`VueAnimatorApi` methods: `play()`, `pause()`, `cancel()`, `finish()`, `isPlaying()`, `setPlaybackRate(rate)`, `getCurrentTime()`, `setCurrentTime(ms)`.

### Controlled time

Render a single frame at a specific point in time:

```vue
<template>
  <PixodeskSvgAnimator :doc="animationDoc" :time="0.5" />
  <PixodeskSvgAnimator :doc="animationDoc" :time="500" />
</template>
```

## Props

| Prop | Type | Description |
|---|---|---|
| `doc` | `PxAnimatedSvgDocument` | The animation document to render (required) |
| `autoplay` | `boolean` | Use triggers from the document |
| `play` | `boolean` | Start playback, ignoring document triggers |
| `pause` | `boolean` | Pause current playback |
| `progress` | `number` | show the frame at this position in the whole timeline (duration × iterations): `0` is the first frame, `0.5` the middle, `1` the last |
| `time` | `number` | show the frame at that time, in milliseconds from the start |
| `mode` | `'auto' \| 'waapi' \| 'frames'` | Animation engine |
| `duration` | `number` | Duration override (ms) |
| `delay` | `number` | Delay before start (ms) |
| `iterations` | `number \| 'infinite'` | Loop count |
| `fill` | `FillMode` | Fill behaviour |
| `direction` | `PlaybackDirection` | Playback direction |
| `frameRate` | `number` | Target FPS |
| `startOn` | `'load' \| 'mouseOver' \| 'click' \| 'scrollIntoView' \| 'programmatic'` | Trigger event override |
| `outAction` | `'continue' \| 'pause' \| 'reset' \| 'reverse'` | Behaviour when trigger ends |

With none of `autoplay` / `play` / `pause` / `progress` / `time` set, the component renders the animation statically (initial state, no playback); use the template ref for imperative control.

Note: passing a different `doc` (or unmounting) throws the old animator away and builds a new one; the old instance emits `cancel`, `remove`, and `stop` on its way out. Changing `progress` / `time` does **not** recreate the animator — it just jumps the existing one to the new time.

## Events

| Event | Description |
|---|---|
| `play` | Animation started or resumed |
| `pause` | Animation paused |
| `cancel` | Animation cancelled |
| `finish` | Animation finished naturally |
| `remove` | Animation cleaned up (e.g. on unmount) |
| `stop` | Fired alongside any event that halts playback (`pause` / `cancel` / `finish` / `remove`) |