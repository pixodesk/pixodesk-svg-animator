# Vue — `@pixodesk/svg-animator-vue`

[← React](./react.md) · [Contents](../README.md) · Next: [React Native →](./react-native.md)

Use this in a Vue 3 or Nuxt app: drop in the component, pass it the JSON, and it renders the
animation and controls its playback. It wraps the [web player](./web-player.md) and
renders the SVG through Vue's virtual DOM, so it is SSR-safe and Nuxt-ready. It mirrors the
[React component](./react.md) feature for feature, so the two guides read the same.

```bash
npm install @pixodesk/svg-animator-vue
```

```vue
<script setup lang="ts">
import { PixodeskSvgAnimator } from '@pixodesk/svg-animator-vue';
import animation from './animation.json';
</script>

<template>
  <PixodeskSvgAnimator :doc="animation" autoplay />
</template>
```

The component renders the document's root `<svg>` directly — there is no wrapper element. To
set its size, give the element that contains it a width and height (or put `style` on the
component itself — see the props table); the SVG keeps its proportions.

## Control modes

Pick one — they are mutually exclusive, and take precedence in the order listed.

### 1 · Autoplay

> **Example:** [`vue/autoplay`](../../examples/docs-examples/src/cases/vue/autoplay/) — `pnpm example:docs`, then open `#vue/autoplay`.

The simplest mode: the component starts the animation the way the file says it should — on
load, on hover, on click, or when scrolled into view.

```vue
<script setup lang="ts">
import { PixodeskSvgAnimator } from '@pixodesk/svg-animator-vue';
import animation from './animation.json';
</script>

<template>
  <PixodeskSvgAnimator :doc="animation" autoplay />
</template>
```

Uses the trigger saved in the document (load / hover / click / scroll into view) and its out
action. Override with `startOn` / `outAction` / `scrollIntoViewThreshold`.

### 2 · Controlled time (`progress` / `time`)

> **Example:** [`vue/controlled-time`](../../examples/docs-examples/src/cases/vue/controlled-time/) — `pnpm example:docs`, then open `#vue/controlled-time`.

Use these when your code owns the position — a slider, a scroll offset, a step in a
walkthrough. The component renders exactly that frame and never plays on its own.

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { PixodeskSvgAnimator } from '@pixodesk/svg-animator-vue';
import animation from './animation.json';
const time = ref(0);
</script>

<template>
  <PixodeskSvgAnimator :doc="animation" :time="time" />
  <input type="range" min="0" max="2000" v-model.number="time" />

  <!-- or a fixed frame: 0.5 = the middle of the whole timeline -->
  <PixodeskSvgAnimator :doc="animation" :time="0.5" />
</template>
```

Changing the value moves the existing animator to the new time — nothing is recreated.

### 3 · Declarative play / pause

> **Example:** [`vue/declarative`](../../examples/docs-examples/src/cases/vue/declarative/) — `pnpm example:docs`, then open `#vue/declarative`.

Drive playback from your own state with two booleans — handy when play/pause is already part
of your component's state (a toggle, a visibility flag) and you would rather not hold a ref.

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { PixodeskSvgAnimator } from '@pixodesk/svg-animator-vue';
import animation from './animation.json';
const paused = ref(false);
</script>

<template>
  <PixodeskSvgAnimator :doc="animation" play :pause="paused" />
  <button @click="paused = !paused">Toggle</button>
</template>
```

`play && !pause` plays; `pause` pauses; `play === false` jumps to the end state.

### 4 · Imperative API (template ref)

> **Example:** [`vue/imperative`](../../examples/docs-examples/src/cases/vue/imperative/) — `pnpm example:docs`, then open `#vue/imperative`.

The component exposes the playback API on its template ref, so it is available in every mode:

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { PixodeskSvgAnimator, type VueAnimatorApi } from '@pixodesk/svg-animator-vue';
import animation from './animation.json';
const animator = ref<VueAnimatorApi | null>(null);
</script>

<template>
  <PixodeskSvgAnimator :doc="animation" ref="animator" />
  <button @click="animator?.play()">Play</button>
  <button @click="animator?.pause()">Pause</button>
  <button @click="animator?.setPlaybackRate(-1)">Reverse</button>
</template>
```

`VueAnimatorApi`: `play()`, `pause()`, `cancel()`, `finish()`, `isPlaying()`,
`setPlaybackRate(rate)`, `getCurrentTime()`, `setCurrentTime(ms)`.

With none of `autoplay` / `progress` / `time` / `play` / `pause` set, the first frame renders
statically and the ref is your only control.

## Props

Only `doc` is required. The file already carries the timing and the trigger you set in the
editor; every other prop is optional and, when passed, replaces the file's value for this one
component.

| Prop | Type | Description |
|---|---|---|
| `doc` | `PxAnimatedSvgDocument` | **required** — the animation, as saved by the editor |
| `autoplay` | `boolean` | start the way the file says — the *Start* trigger you chose in the editor: at once, on hover, on click, or when scrolled into view |
| `play` | `boolean` | play now, whatever the file's trigger says |
| `pause` | `boolean` | pause the current playback; set it back to `false` to resume |
| `progress` | `number` | show the frame at this position in the whole timeline (duration × iterations): `0` is the first frame, `0.5` the middle, `1` the last |
| `time` | `number` | show the frame at that time, in milliseconds from the start |
| `duration` · `delay` | `number` | length of one iteration, and the wait before it starts, both in ms. The file already carries the values you set in the editor — pass these only to change them for this one component |
| `iterations` | `number \| 'infinite'` | how many times to play; `'infinite'` never stops |
| `direction` | `'normal' \| 'reverse' \| 'alternate' \| 'alternate-reverse'` | play forward, backward, or turn around on every iteration (starting forward or backward) |
| `fill` | `'forwards' \| 'backwards' \| 'both' \| 'none'` | what shows before the start / after the end |
| `mode` | `'auto' \| 'waapi' \| 'frames'` | engine — see [Web player → Engine modes](./web-player.md#engine-modes) |
| `frameRate` | `number` | target fps (frames engine) |
| `startOn` | `'load' \| 'mouseOver' \| 'click' \| 'scrollIntoView' \| 'programmatic'` | what starts the animation: at once, on hover, on click, when scrolled into view, or only a `play()` call from code |
| `outAction` | `'continue' \| 'pause' \| 'reset' \| 'reverse'` | when the trigger ends (mouse out, second click, scrolled out) |
| `scrollIntoViewThreshold` | `number` | how much of the animation must be on screen before it starts, as a share of its area: `0` (default) starts as soon as any part of it shows, `0.5` waits until half of it is visible, `1` until all of it is |
| `class` · `style` · any other attribute | | anything else you put on `<PixodeskSvgAnimator>` ends up on the `<svg>` element it renders (standard Vue attribute inheritance). So to set the animation's size, either put `style="width: 300px; height: 300px"` on the component itself, or give those dimensions to the element that contains it — the SVG keeps its proportions either way |

## Events

| Event | When |
|---|---|
| `play` | the animation started playing — for the first time, or resumed after a pause |
| `pause` | playback paused at the current frame — via the `pause` prop, the API's `pause()`, or a trigger's *out action* |
| `cancel` | playback stopped and the animation went back to its start state |
| `finish` | the animation reached its end — it played all its iterations, or `finish()` was called. Does not fire when playback is stopped early |
| `remove` | the animator was thrown away: the component unmounted, or you passed a different `doc` and a new animator was built for it |
| `stop` | fires *in addition to* whichever of `pause`, `cancel`, `finish` or `remove` just fired. Listen to this one event when you only care that the animation is no longer playing, whatever the reason |

```vue
<script setup lang="ts">
import { PixodeskSvgAnimator } from '@pixodesk/svg-animator-vue';
import animation from './animation.json';
const onDone = () => console.log('finished');
const onStop = () => console.log('stopped');
</script>

<template>
  <PixodeskSvgAnimator :doc="animation" autoplay @finish="onDone" @stop="onStop" />
</template>
```

Passing a different `doc` throws the old animator away and builds a new one; the old instance
emits `cancel`, `remove` and `stop` on its way out.

## CSS-flavour SVGs — `PixodeskSvgCssAnimator`

> **Example:** [`vue/css-loader`](../../examples/docs-examples/src/cases/vue/css-loader/) — `pnpm example:docs`, then open `#vue/css-loader`.

For a **pre-rendered SVG + CSS animation** file imported with
[`vite-svg-loader`](https://github.com/jpkleemans/vite-svg-loader) (or any loader that yields a
component), this wrapper adds hover / click / scroll triggers. It renders a `<div>` of its own
around your SVG component — that is what `PixodeskSvgCssAnimator` becomes on the page — and
starts, pauses or resets the animation by switching the file's CSS classes on that `<div>`:

```vue
<script setup>
import { PixodeskSvgCssAnimator } from '@pixodesk/svg-animator-vue';
import AnimationSvg from './animation.svg';   // vite-svg-loader
</script>

<template>
  <PixodeskSvgCssAnimator startOn="mouseOver" outAction="pause" style="width: 400px; height: 400px">
    <AnimationSvg />
  </PixodeskSvgCssAnimator>
</template>
```

| Prop | Type | Default |
|---|---|---|
| `startOn` | `'load' \| 'mouseOver' \| 'click' \| 'scrollIntoView'` | `'load'` |
| `outAction` | `'continue' \| 'pause' \| 'reset'` | `'continue'` |
| other attrs (`class`, `style`, …) | forwarded to the wrapper `<div>` | — |

> ⚠️ **Don't put the same SVG file on a page twice.** You can have as many
> `<PixodeskSvgCssAnimator>` on a page as you like, each with a *different* file. What does not
> work is the *same* file twice: the imported component is the file's markup, element ids
> included, so two copies share the same ids and their masks and gradients cross over. To show
> one animation several times, use the JSON component instead — the player gives every copy
> its own ids ([read more](https://pixodesk.com/docs/svga/prerendered-svg/on-the-web#one-copy-of-a-file-per-page)).

Only the pure CSS flavour works this way (loaders strip or refuse `<script>`); flavours with
scripts should be inlined as raw HTML, or use JSON.

## Nuxt

The component is SSR-safe: the SVG is rendered on the server, the animator is created on
mount. Nothing special is required beyond importing the component; for a CSS-flavour SVG add
`vite-svg-loader` to your Nuxt/Vite config.

## Example

Every section above links to its running example in
[`examples/docs-examples`](../../examples/docs-examples/). Each example is a small standalone
page, and they are all collected in one app: a list of every example down the side, with the
selected one running next to it. Run `pnpm example:docs` from the repository root to open it,
then pick an example from the list — or jump straight to one by its address in the URL, like
`#vue/autoplay`. Each example has a test that runs on every build.

[← React](./react.md) · [Contents](../README.md) · Next: [React Native →](./react-native.md)
