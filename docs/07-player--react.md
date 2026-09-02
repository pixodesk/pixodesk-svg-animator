# React — `@pixodesk/svg-animator-react`

[← Web player](./06-player--web-player.md) · [Contents](./README.md) · Next: [Vue →](./08-player--vue.md)

Use this in a React or Next.js app: drop in the component, pass it the JSON, and it renders
the animation and controls its playback. It wraps the [web player](./06-player--web-player.md)
and renders the SVG with React itself, so it is SSR-safe and works in Next.js. Control it the
way that suits your code — autoplay, declarative props, an imperative ref, or controlled time.

```bash
npm install @pixodesk/svg-animator-react
```

```tsx
import { PixodeskSvgAnimator } from '@pixodesk/svg-animator-react';
import animation from './animation.json';

export function Logo() {
  return <PixodeskSvgAnimator doc={animation} autoplay />;
}
```

The component renders the root `<svg>` of the document; size it with `className` / `style` or
by sizing the parent (the SVG keeps its `viewBox`).

## Control modes

Pick one — they are mutually exclusive, and take precedence in the order listed. The `apiRef`
is filled in **every** mode, so you can always call `play()` / `pause()` yourself; passing
`apiRef` and nothing else is the imperative mode, where the document's trigger is switched off
and the ref is the only thing that starts playback.

### 1 · Imperative API (`apiRef`)

> **Example:** [`react/imperative`](../examples/docs-examples/src/cases/react/imperative/) — `pnpm example:docs`, then open `#react/imperative`.

Pass a ref as `apiRef`. Once the component has mounted, the ref holds the playback API, so
any button, timer or effect in your app can start, pause, or jump to any point in the animation.

```tsx
import { useRef } from 'react';
import { PixodeskSvgAnimator, type ReactAnimatorApi } from '@pixodesk/svg-animator-react';
import animation from './animation.json';

export function Player() {
  const api = useRef<ReactAnimatorApi>(null);
  return (
    <>
      <PixodeskSvgAnimator doc={animation} apiRef={api} />
      <button onClick={() => api.current?.play()}>Play</button>
      <button onClick={() => api.current?.pause()}>Pause</button>
      <button onClick={() => api.current?.setPlaybackRate(-1)}>Reverse</button>
    </>
  );
}
```

`ReactAnimatorApi`:

| Method | Description |
|---|---|
| `play()` | start, or resume from the current time |
| `pause()` | pause at the current time |
| `cancel()` | stop and reset to the start |
| `finish()` | jump to the end and hold it |
| `setPlaybackRate(rate)` | `1` normal, `2` double, negative = reverse |
| `getCurrentTime()` | ms, or `null` before mount |
| `setCurrentTime(ms)` | jump to a point in the animation, in milliseconds from its start |
| `isPlaying()` | `true` while the animation is running, `false` when paused, finished or not started |

### 2 · Autoplay

> **Example:** [`react/autoplay`](../examples/docs-examples/src/cases/react/autoplay/) — `pnpm example:docs`, then open `#react/autoplay`.

The simplest mode: the component starts the animation the way the file says it should — on
load, on hover, on click, or when scrolled into view.

```tsx
import { PixodeskSvgAnimator } from '@pixodesk/svg-animator-react';
import animation from './animation.json';

export function Intro() {
  return <PixodeskSvgAnimator doc={animation} autoplay />;
}
```

Uses the trigger saved in the document — on load, on hover, on click, when scrolled into view
— and its out action. Override with `startOn` / `outAction` / `scrollIntoViewThreshold`.

### 3 · Controlled time (`progress` / `time`)

> **Example:** [`react/controlled-time`](../examples/docs-examples/src/cases/react/controlled-time/) — `pnpm example:docs`, then open `#react/controlled-time`.

Render one frame, and move through the animation by changing the prop. The animator is **not** recreated on change —
it just jumps to the new time.

```tsx
import { useState } from 'react';
import { PixodeskSvgAnimator } from '@pixodesk/svg-animator-react';
import animation from './animation.json';

export function Scrubber() {
  const [time, setTime] = useState(0);
  return (
    <>
      <PixodeskSvgAnimator doc={animation} time={time} />
      <input type="range" min={0} max={2000} value={time} onChange={e => setTime(+e.target.value)} />
    </>
  );
}
```

`progress` is a position in the whole timeline (duration × iterations), from `0`, the first frame, to `1`, the last; `time` is a time in milliseconds from the start.

### 4 · Declarative play / pause

> **Example:** [`react/declarative`](../examples/docs-examples/src/cases/react/declarative/) — `pnpm example:docs`, then open `#react/declarative`.

Drive playback from your own state with two booleans — handy when play/pause is already part
of your component's state (a toggle, a visibility flag) and you would rather not hold a ref.

```tsx
import { useState } from 'react';
import { PixodeskSvgAnimator } from '@pixodesk/svg-animator-react';
import animation from './animation.json';

export function Controlled() {
  const [play, setPlay] = useState(false);
  const [pause, setPause] = useState(false);
  return (
    <>
      <PixodeskSvgAnimator doc={animation} play={play} pause={pause} />
      <button onClick={() => { setPlay(true); setPause(false); }}>Play</button>
      <button onClick={() => setPause(true)}>Pause</button>
    </>
  );
}
```

`play && !pause` plays; `pause` pauses; `play === false` jumps to the end state; a pause that is
switched back off resumes.

With none of `apiRef` / `autoplay` / `progress` / `time` / `play` / `pause` set, the component
renders the first frame statically.

## Props

| Prop | Type | Description |
|---|---|---|
| `doc` | `PxAnimatedSvgDocument` | **required** — the animation document |
| `className` | `string` | class on the rendered root `<svg>` |
| `style` | `CSSProperties` | inline style on the root `<svg>` |
| **Control** | | |
| `autoplay` | `boolean` | start the way the file says — the *Start* trigger you chose in the editor: at once, on hover, on click, or when scrolled into view |
| `play` | `boolean` | play unconditionally (ignores document triggers) |
| `pause` | `boolean` | pause current playback |
| `apiRef` | `RefObject<ReactAnimatorApi>` | imperative control |
| `progress` | `number` | show the frame at this position in the whole timeline (duration × iterations): `0` is the first frame, `0.5` the middle, `1` the last |
| `time` | `number` | show the frame at that time, in milliseconds from the start |
| **Timing overrides** | | *(each replaces the document's `animator` value)* |
| `duration` | `number` | ms for one iteration |
| `delay` | `number` | wait this many ms, then start. A negative value skips ahead instead: `-500` starts right away from the frame at 0.5 s, as if the animation had already been running for half a second |
| `iterations` | `number \| 'infinite'` | how many times to play; `'infinite'` never stops |
| `direction` | `'normal' \| 'reverse' \| 'alternate' \| 'alternate-reverse'` | play forward, backward, or turn around on every iteration (starting forward or backward) |
| `fill` | `'forwards' \| 'backwards' \| 'both' \| 'none'` | what shows before start / after the end |
| `mode` | `'auto' \| 'waapi' \| 'frames'` | engine — see [Web player → Engine modes](./06-player--web-player.md#engine-modes) |
| `frameRate` | `number` | target fps (frames engine) |
| **Trigger overrides** | | |
| `startOn` | `'load' \| 'mouseOver' \| 'click' \| 'scrollIntoView' \| 'programmatic'` | what starts the animation: at once, on hover, on click, when scrolled into view, or only a `play()` call from code |
| `outAction` | `'continue' \| 'pause' \| 'reset' \| 'reverse'` | when the trigger ends (mouse out, second click, scrolled out) |
| `scrollIntoViewThreshold` | `number` | how much of the animation must be on screen before it starts, as a share of its area: `0` (default) starts as soon as any part of it shows, `0.5` waits until half of it is visible, `1` until all of it is |
| **Callbacks** | | |
| `onPlay` | `() => void` | the animation started playing — for the first time, or resumed after a pause |
| `onPause` | `() => void` | playback paused at the current frame — via the `pause` prop, the API's `pause()`, or a trigger's *out action* |
| `onCancel` | `() => void` | playback stopped and the animation went back to its start state |
| `onFinish` | `() => void` | the animation reached its end — it played all its iterations, or `finish()` was called. Does not fire when playback is stopped early |
| `onRemove` | `() => void` | the animator was thrown away: the component unmounted, or you passed a different `doc` and a new animator was built for it |
| `onStop` | `() => void` | fires *in addition to* whichever of `onPause`, `onCancel`, `onFinish` or `onRemove` just fired. Use this one callback when you only care that the animation is no longer playing, whatever the reason |

Passing a different `doc` (or changing `className` / `style` / the control mode) throws the
old animator away and builds a new one; the old instance emits `onCancel`, `onRemove` and
`onStop` on its way out. Changing `progress` / `time` does not recreate anything.

## CSS-flavour SVGs — `PixodeskSvgCssAnimator`

> **Example:** [`react/css-svgr`](../examples/docs-examples/src/cases/react/css-svgr/) — `pnpm example:docs`, then open `#react/css-svgr`.

For a **pre-rendered SVG + CSS animation** file imported as a component with
[SVGR](https://react-svgr.com/) (`@svgr/webpack`, `vite-plugin-svgr`), this small wrapper adds
the hover / click / scroll triggers. It renders a `<div>` of its own around your SVG component —
that is what `PixodeskSvgCssAnimator` becomes on the page — and starts, pauses or resets the
animation by switching the file's CSS classes on that `<div>`:

```tsx
import { PixodeskSvgCssAnimator } from '@pixodesk/svg-animator-react';
import AnimationSvg from './animation.svg?react';   // vite-plugin-svgr

export function HoverLogo() {
  return (
    <PixodeskSvgCssAnimator startOn="mouseOver" outAction="pause" style={{ width: 400, height: 400 }}>
      <AnimationSvg />
    </PixodeskSvgCssAnimator>
  );
}
```

| Prop | Type | Default |
|---|---|---|
| `children` | the SVGR component | required |
| `startOn` | `'load' \| 'mouseOver' \| 'click' \| 'scrollIntoView'` | `'load'` |
| `outAction` | `'continue' \| 'pause' \| 'reset'` | `'continue'` |
| `className` · `style` | on the wrapper `<div>` | — |

> ⚠️ **Don't put the same SVG file on a page twice.** You can have as many
> `<PixodeskSvgCssAnimator>` on a page as you like, each with a *different* file. What does not
> work is the *same* file twice: the imported component is the file's markup, element ids
> included, so two copies share the same ids and their masks and gradients cross over. To show
> one animation several times, use the JSON component instead — the player gives every copy
> its own ids ([read more](./11-player--prerendered-svg.md#one-copy-of-a-file-per-page)).

SVGR strips `<script>` tags, so only the pure CSS flavour works this way. Files with scripts
(JS triggers / JS animation) should be inlined as raw HTML, or switched to JSON.

## Next.js

The component renders real SVG markup on the server and starts the animator in an effect on
the client, so it works in the App Router — mark the file that uses it as a client component:

```tsx
'use client';
import { PixodeskSvgAnimator } from '@pixodesk/svg-animator-react';
import animation from './animation.json';

export default function Hero() {
  return <PixodeskSvgAnimator doc={animation} autoplay />;
}
```

JSON imports work out of the box in Next.js; for a CSS-flavour SVG use `@svgr/webpack`.


[← Web player](./06-player--web-player.md) · [Contents](./README.md) · Next: [Vue →](./08-player--vue.md)
