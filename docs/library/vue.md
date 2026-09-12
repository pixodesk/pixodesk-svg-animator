# Vue — `@pixodesk/svg-animator-vue`

[← React](./react.md) · [Contents](../../README.md#documentation) · Next: [React Native →](./react-native.md)

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

Three control modes, plus a template ref that is not one. Set more than one control prop and the
highest-priority one wins — `progress` / `time` → `play` / `pause` → `autoplay` — and the
component warns, naming both props and the winner. The ref is available in every mode and never
changes which one you are in. React, Vue and React Native all resolve this the same way, from one
rule in core.

### Autoplay

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
action. Override it for this one mount with the `startOn` prop, or with
`:config="{ timeline: { trigger: { … } } }"` for the rest of the trigger — see
[Playback overrides](#playback-overrides).

### Controlled time (`progress` / `time`)

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

  <!-- a fixed frame by FRACTION of the whole timeline — that is `progress`, not `time`
       (`time` is milliseconds, so `:time="0.5"` would be half a millisecond in) -->
  <PixodeskSvgAnimator :doc="animation" :progress="0.5" />
</template>
```

Changing the value moves the existing animator to the new time — nothing is recreated.

### Declarative play / pause

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

### Imperative API (template ref)

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
`setPlaybackRate(rate)`, `getCurrentTime()`, `setCurrentTime(ms)`,
`getCurrentProgress()`, `setCurrentProgress(p)`.

Time is ms from the start of the whole run, seeks are clamped to it, and a rate of `0` is
rejected with a warning — the same on every player. `getCurrentProgress()` is the same position
as 0–1, the read twin of the `progress` prop.

With none of `autoplay` / `progress` / `time` / `play` / `pause` set, the first frame renders
statically and the ref is your only control.

## Playback overrides

The same document can play differently in each place you mount it. `config` takes an object
shaped exactly like the file's own `animator` block and deep-merges it over what the file says
— the document you passed is never modified.

```vue
<template>
  <!-- The file loops twice and starts on load; here it loops forever and waits for play(). -->
  <PixodeskSvgAnimator
    :doc="animation"
    :config="{ timeline: { iterations: 'infinite', trigger: { startOn: 'programmatic' } } }"
    ref="anim"
  />
</template>
```

Objects merge key by key, values replace, and `null` **deletes** a key so the default its
absence means comes back (`:config="{ timeline: { delay: null } }"`).

`duration`, `delay`, `iterations` and `startOn` are also plain props, because `:duration="2000"`
reads better than a nested object; a prop wins over the same key inside `config`. To ignore the
file's playback settings entirely and start from the player's defaults, add `resetDocDefaults`.

Full merge rules — including what happens when the override changes the kind of timeline — are
in [Playback & triggers → Overriding from a player](./playback-and-triggers.md#overriding-from-a-player).

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
| `config` | `object \| string` | per-instance override of the document's `animator` block, deep-merged over it — same shape as the file; `null` at any slot deletes that key. A JSON string is accepted too. See [Playback overrides](#playback-overrides) |
| `resetDocDefaults` | `boolean` | ignore the document's playback settings and start from the player's defaults, with `config` on top |
| `duration` · `delay` | `number` | shortcuts for `config.timeline.duration` / `config.timeline.delay`: length of one iteration, and the wait before it starts, both in ms. The file already carries the values you set in the editor — pass these only to change them for this one component |
| `iterations` | `number \| 'infinite'` | shortcut for `config.timeline.iterations`; `'infinite'` never stops |
| `startOn` | `'load' \| 'mouseOver' \| 'click' \| 'scrollIntoView' \| 'programmatic'` | shortcut for `config.timeline.trigger.startOn`: at once, on hover, on click, when scrolled into view, or only a `play()` call from code |
| `onWarn` | `(diagnostic) => void` | something is off but the animation still plays — an unknown easing, a config key that could not be applied, two control props at once. Without this it goes to `console.warn` |
| `onError` | `(diagnostic) => void` | the animation could not be produced at all — a document that failed to parse or render. Without this it goes to `console.error` |
| `silent` | `boolean \| PxDiagnosticKind[]` | silences the console *fallback* above — everything, or just the kinds you list. `onWarn` / `onError` still fire if you gave them — it is not a mute button |
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

`onWarn` and `onError` are **props**, not events, on purpose. An event handler exists whether or
not you listen, so wiring them to `emit` would have silenced the console fallback for everyone
who never subscribed. As props, leaving them out really does mean "not given" — and the console
still speaks by default.

Each diagnostic is `{ kind, message, detail?, error? }`, where `kind` says **who can act on it**:
`document` (repair the file) · `host` (fix the page) · `platform` (the browser could not do it;
the player degraded) · `usage` (fix the props you passed) · `internal` (report it to us). So you
can route rather than just log — surface `document` problems in a build check, and quiet the
rest with `:silent="['platform']"`.

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

[← React](./react.md) · [Contents](../../README.md#documentation) · Next: [React Native →](./react-native.md)
