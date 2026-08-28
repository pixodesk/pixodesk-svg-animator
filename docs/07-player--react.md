# React — `@pixodesk/svg-animator-react`

[← Web player](./06-player--web-player.md) · [Contents](./README.md) · Next: [Vue →](./08-player--vue.md)

A React component that renders a JSON animation document and controls its playback. It wraps
the [web player](./06-player--web-player.md), renders the SVG with React (so it is SSR-safe and works
in Next.js), and exposes four control styles: autoplay, declarative props, an imperative ref,
and controlled time.

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

Pick one — they are mutually exclusive, and take precedence in the order listed.

### 1 · Imperative API (`apiRef`)

```tsx
import { useRef } from 'react';
import type { ReactAnimatorApi } from '@pixodesk/svg-animator-react';

const api = useRef<ReactAnimatorApi>(null);

<PixodeskSvgAnimator doc={animation} apiRef={api} />
<button onClick={() => api.current?.play()}>Play</button>
<button onClick={() => api.current?.pause()}>Pause</button>
<button onClick={() => api.current?.setPlaybackRate(-1)}>Reverse</button>
```

`ReactAnimatorApi`:

| Method | Description |
|---|---|
| `play()` · `pause()` · `cancel()` · `finish()` | start/resume · pause · stop and reset · jump to the end |
| `setPlaybackRate(rate)` | `1` normal, `2` double, negative = reverse |
| `getCurrentTime()` | ms, or `null` before mount |
| `setCurrentTime(ms)` | seek |
| `isPlaying()` | |

### 2 · Autoplay

```tsx
<PixodeskSvgAnimator doc={animation} autoplay />
```

Uses the trigger saved in the document — on load, on hover, on click, when scrolled into view
— and its out action. Override with `startOn` / `outAction` / `scrollIntoViewThreshold`.

### 3 · Controlled time (`time` / `timeMs`)

Render one frame, and scrub by changing the prop. The animator is **not** recreated on change —
it just seeks.

```tsx
const [timeMs, setTimeMs] = useState(0);

<PixodeskSvgAnimator doc={animation} timeMs={timeMs} />
<input type="range" min={0} max={2000} value={timeMs} onChange={e => setTimeMs(+e.target.value)} />
```

`time` is a fraction 0–1 of the whole timeline (duration × iterations); `timeMs` is absolute.

### 4 · Declarative play / pause

```tsx
const [play, setPlay] = useState(false);
const [pause, setPause] = useState(false);

<PixodeskSvgAnimator doc={animation} play={play} pause={pause} />
```

`play && !pause` plays; `pause` pauses; `play === false` jumps to the end state; a pause that is
switched back off resumes.

With none of `apiRef` / `autoplay` / `time` / `timeMs` / `play` / `pause` set, the component
renders the first frame statically.

## Props

| Prop | Type | Description |
|---|---|---|
| `doc` | `PxAnimatedSvgDocument` | **required** — the animation document |
| `className` | `string` | class on the rendered root `<svg>` |
| `style` | `CSSProperties` | inline style on the root `<svg>` |
| **Control** | | |
| `autoplay` | `boolean` | use the document's trigger |
| `play` | `boolean` | play unconditionally (ignores document triggers) |
| `pause` | `boolean` | pause current playback |
| `apiRef` | `RefObject<ReactAnimatorApi>` | imperative control |
| `time` | `number` | seek to a fraction 0–1 of the whole timeline |
| `timeMs` | `number` | seek to a time in ms |
| **Timing overrides** | | *(each replaces the document's `animator` value)* |
| `duration` | `number` | ms for one iteration |
| `delay` | `number` | ms before start (negative = start part-way through) |
| `iterations` | `number \| 'infinite'` | |
| `direction` | `'normal' \| 'reverse' \| 'alternate' \| 'alternate-reverse'` | |
| `fill` | `'forwards' \| 'backwards' \| 'both' \| 'none'` | what shows before start / after the end |
| `mode` | `'auto' \| 'waapi' \| 'frames'` | engine — see [Web player → Engine modes](./06-player--web-player.md#engine-modes) |
| `frameRate` | `number` | target fps (frames engine) |
| **Trigger overrides** | | |
| `startOn` | `'load' \| 'mouseOver' \| 'click' \| 'scrollIntoView' \| 'programmatic'` | |
| `outAction` | `'continue' \| 'pause' \| 'reset' \| 'reverse'` | when the trigger ends (mouse out, second click, scrolled out) |
| `scrollIntoViewThreshold` | `number` | visible fraction 0–1 required to start (default 0 = any pixel) |
| **Callbacks** | | |
| `onPlay` | `() => void` | started or resumed |
| `onPause` | `() => void` | |
| `onCancel` | `() => void` | |
| `onFinish` | `() => void` | finished naturally (or `finish()`) |
| `onRemove` | `() => void` | destroyed — unmount or `doc` swap |
| `onStop` | `() => void` | fires alongside **any** halt: pause, cancel, finish, remove |

Swapping `doc` (or `className` / `style` / the control mode) recreates the animator; the
torn-down instance emits `onCancel`, `onRemove` and `onStop`. Scrubbing `time` / `timeMs` does
not recreate anything.

## CSS-flavour SVGs — `PixodeskSvgCssAnimator`

For a **pre-rendered SVG + CSS animation** file imported as a component with
[SVGR](https://react-svgr.com/) (`@svgr/webpack`, `vite-plugin-svgr`), this small wrapper adds
the hover / click / scroll triggers by toggling the animation classes on a `<div>`:

```tsx
import { PixodeskSvgCssAnimator } from '@pixodesk/svg-animator-react';
import AnimationSvg from './animation.svg?react';   // vite-plugin-svgr

<PixodeskSvgCssAnimator startOn="mouseOver" outAction="pause" style={{ width: 400, height: 400 }}>
  <AnimationSvg />
</PixodeskSvgCssAnimator>
```

| Prop | Type | Default |
|---|---|---|
| `children` | the SVGR component | |
| `startOn` | `'load' \| 'mouseOver' \| 'click' \| 'scrollIntoView'` | `'load'` |
| `outAction` | `'continue' \| 'pause' \| 'reset'` | `'continue'` |
| `className` · `style` | on the wrapper `<div>` | |

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

## Example

`examples/react` in the repository shows all four control modes side by side plus the SVGR
wrapper with every trigger — run it with `pnpm example:react`.

[← Web player](./06-player--web-player.md) · [Contents](./README.md) · Next: [Vue →](./08-player--vue.md)
