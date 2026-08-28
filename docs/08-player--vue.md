# Vue — `@pixodesk/svg-animator-vue`

[← React](./07-player--react.md) · [Contents](./README.md) · Next: [React Native →](./09-player--react-native.md)

Use this in a Vue 3 or Nuxt app: drop in the component, pass it the JSON, and it renders the
animation and controls its playback. It wraps the [web player](./06-player--web-player.md) and
renders the SVG through Vue's virtual DOM, so it is SSR-safe and Nuxt-ready. It mirrors the
[React component](./07-player--react.md) feature for feature, so the two guides read the same.

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

The component renders the document's root `<svg>`; size it via its parent (the SVG keeps its
`viewBox`).

## Control modes

Pick one — they are mutually exclusive, and take precedence in the order listed.

### 1 · Autoplay

> **Example:** [`vue/autoplay`](../examples/docs-examples/src/cases/vue/autoplay/) — `pnpm example:docs`, then open `#vue/autoplay`.

```vue
<PixodeskSvgAnimator :doc="animation" autoplay />
```

Uses the trigger saved in the document (load / hover / click / scroll into view) and its out
action. Override with `startOn` / `outAction` / `scrollIntoViewThreshold`.

### 2 · Controlled time (`time` / `timeMs`)

> **Example:** [`vue/controlled-time`](../examples/docs-examples/src/cases/vue/controlled-time/) — `pnpm example:docs`, then open `#vue/controlled-time`.

```vue
<PixodeskSvgAnimator :doc="animation" :time="0.5" />     <!-- fraction of the whole timeline -->
<PixodeskSvgAnimator :doc="animation" :timeMs="500" />   <!-- absolute ms -->
```

Changing the value seeks the existing animator — nothing is recreated.

### 3 · Declarative play / pause

> **Example:** [`vue/declarative`](../examples/docs-examples/src/cases/vue/declarative/) — `pnpm example:docs`, then open `#vue/declarative`.

```vue
<script setup lang="ts">
import { ref } from 'vue';
const paused = ref(false);
</script>

<template>
  <PixodeskSvgAnimator :doc="animation" play :pause="paused" />
  <button @click="paused = !paused">Toggle</button>
</template>
```

`play && !pause` plays; `pause` pauses; `play === false` jumps to the end state.

### 4 · Imperative API (template ref)

> **Example:** [`vue/imperative`](../examples/docs-examples/src/cases/vue/imperative/) — `pnpm example:docs`, then open `#vue/imperative`.

The component exposes the playback API on its template ref, so it is available in every mode:

```vue
<script setup lang="ts">
import { ref } from 'vue';
import type { VueAnimatorApi } from '@pixodesk/svg-animator-vue';
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

With none of `autoplay` / `time` / `timeMs` / `play` / `pause` set, the first frame renders
statically and the ref is your only control.

## Props

| Prop | Type | Description |
|---|---|---|
| `doc` | `PxAnimatedSvgDocument` | **required** |
| `autoplay` | `boolean` | use the document's trigger |
| `play` | `boolean` | play unconditionally |
| `pause` | `boolean` | pause |
| `time` | `number` | seek to a fraction 0–1 of the whole timeline (duration × iterations) |
| `timeMs` | `number` | seek to ms |
| `duration` · `delay` | `number` | ms overrides |
| `iterations` | `number \| 'infinite'` | |
| `direction` | `'normal' \| 'reverse' \| 'alternate' \| 'alternate-reverse'` | |
| `fill` | `'forwards' \| 'backwards' \| 'both' \| 'none'` | |
| `mode` | `'auto' \| 'waapi' \| 'frames'` | engine |
| `frameRate` | `number` | target fps (frames engine) |
| `startOn` | `'load' \| 'mouseOver' \| 'click' \| 'scrollIntoView' \| 'programmatic'` | trigger override |
| `outAction` | `'continue' \| 'pause' \| 'reset' \| 'reverse'` | |
| `scrollIntoViewThreshold` | `number` | 0–1 |

## Events

| Event | When |
|---|---|
| `play` | started or resumed |
| `pause` | paused |
| `cancel` | cancelled (reset) |
| `finish` | finished naturally |
| `remove` | destroyed — unmount or `doc` swap |
| `stop` | alongside any halt: `pause`, `cancel`, `finish`, `remove` |

```vue
<PixodeskSvgAnimator :doc="animation" autoplay @finish="onDone" @stop="onStop" />
```

Swapping `doc` recreates the animator (the old instance emits `cancel`, `remove`, `stop`).

## CSS-flavour SVGs — `PixodeskSvgCssAnimator`

> **Example:** [`vue/css-loader`](../examples/docs-examples/src/cases/vue/css-loader/) — `pnpm example:docs`, then open `#vue/css-loader`.

For a **pre-rendered SVG + CSS animation** file imported with
[`vite-svg-loader`](https://github.com/jpkleemans/vite-svg-loader) (or any loader that yields a
component), this wrapper adds hover / click / scroll triggers by toggling the animation classes
on a `<div>`:

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
| other attrs (`class`, `style`, …) | forwarded to the wrapper `<div>` | |

Only the pure CSS flavour works this way (loaders strip or refuse `<script>`); flavours with
scripts should be inlined as raw HTML, or use JSON.

## Nuxt

The component is SSR-safe: the SVG is rendered on the server, the animator is created on
mount. Nothing special is required beyond importing the component; for a CSS-flavour SVG add
`vite-svg-loader` to your Nuxt/Vite config.

## Example

Every section above links to its case in [`examples/docs-examples`](../examples/docs-examples/)
— one standalone page per case, with a browser to step through them. `pnpm example:docs`
opens it; `#vue/autoplay` and friends select a case. Each case has a test that runs on
every build.

[← React](./07-player--react.md) · [Contents](./README.md) · Next: [React Native →](./09-player--react-native.md)
