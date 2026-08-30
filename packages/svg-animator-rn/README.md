# animator-rn

> 📖 Full user guide: [docs/09-player--react-native.md](../../docs/09-player--react-native.md) · [all docs](../../docs/README.md)

[![CI](https://github.com/pixodesk/pixodesk-svg-animator/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/pixodesk/pixodesk-svg-animator/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

React Native component for rendering and controlling Pixodesk SVG animations,
built on `react-native-svg` and `react-native-reanimated`. Props mirror
[`@pixodesk/svg-animator-react`](../svg-animator-react/README.md).

# 🧪 **Status — EXPERIMENTAL**

- API may change without a major version bump.
- A few things are unimplemented or unverified — see [Feature support](#feature-support).

## What it does

`<PixodeskSvgAnimator doc={…} />` takes an animation document exported from the
Pixodesk editor — the **same `.json` the web player uses** — and renders it as
native SVG, driven on the UI thread.

- **One prop to render:** put the `.json` next to your component, import it, pass
  it as `doc`.
- **Playback control:** declarative props (`autoplay`, `play`, `pause`,
  `timeMs`) or an imperative ref (`play()`, `pause()`, `setCurrentTime()`, …).
- **No size of its own:** it fills whatever `View` you put it in — give that `View` a `width` and `height`.

## Quick start

Drop `animation.json` next to your component and render it:

```tsx
import { View } from 'react-native';
import { PixodeskSvgAnimator } from '@pixodesk/svg-animator-rn';
import animation from './animation.json';

export function Logo() {
    return (
        <View style={{ width: 200, height: 200 }}>
            <PixodeskSvgAnimator doc={animation} autoplay />
        </View>
    );
}
```

That's the whole common case: an animation that plays on mount and loops if the
document says so.

### Typical cases

```tsx
// Play once when a screen opens, then hold the last frame
<PixodeskSvgAnimator doc={doc} autoplay iterations={1} fill="forwards" />

// Loop forever regardless of what the document says
<PixodeskSvgAnimator doc={doc} autoplay iterations="infinite" />

// Static — first frame only, no playback
<PixodeskSvgAnimator doc={doc} />

// Toggle from your own state
<PixodeskSvgAnimator doc={doc} play={isPlaying} />

// Tie progress to a gesture / slider (no playback, just a frame)
<PixodeskSvgAnimator doc={doc} time={scrollProgress} />

// Override the document's timing (duration in ms, delay before start)
<PixodeskSvgAnimator doc={doc} autoplay duration={4000} delay={500} />

// Do something when it finishes
<PixodeskSvgAnimator doc={doc} autoplay onFinish={() => setDone(true)} />
```

TypeScript: `import animation from './animation.json'` gives you a plain object.
If your `tsconfig` complains, cast it:

```tsx
import type { PxAnimatedSvgDocument } from '@pixodesk/svg-animator-core';
const doc = animation as PxAnimatedSvgDocument;
```

## Install

```bash
npm install @pixodesk/svg-animator-rn
# peers, if you don't have them already:
npx expo install react-native-svg react-native-reanimated
```

Peer dependencies: `react >=18`, `react-native >=0.76`,
`react-native-svg >=15`, `react-native-reanimated >=3.16`.

Reanimated needs its Babel plugin. In `babel.config.js`:

```js
module.exports = function (api) {
    api.cache(true);
    return {
        presets: ['babel-preset-expo'],
        plugins: ['react-native-reanimated/plugin'], // must be last
    };
};
```

> **Monorepo users:** make sure `react-native-svg`, `react-native-reanimated`
> and `react` resolve to a **single copy**. Two copies produce
> `View config getter callback for component 'RNSVGLine' must be a function`
> at runtime. See [Monorepo setup](#monorepo-setup).

## Control modes

Four ways to drive playback. Pick one — they are mutually exclusive.

### Autoplay

Uses the trigger defined in the animation document (`startOn: 'load'` plays on mount):

```tsx
<PixodeskSvgAnimator doc={doc} autoplay />
```

### Declarative play/pause

Control playback with boolean props:

```tsx
const [play, setPlay] = useState(false);
const [pause, setPause] = useState(false);

<PixodeskSvgAnimator doc={doc} play={play} pause={pause} />
<Button title={play ? 'Play (on)' : 'Play (off)'} onPress={() => setPlay(p => !p)} />
<Button title={pause ? 'Pause (on)' : 'Pause (off)'} onPress={() => setPause(p => !p)} />
```

### Imperative API

Use a ref for full programmatic control:

```tsx
import { useRef } from 'react';
import type { RnAnimatorApi } from '@pixodesk/svg-animator-rn';

const api = useRef<RnAnimatorApi>(null);

<PixodeskSvgAnimator doc={doc} apiRef={api} />
<Button title="Play"   onPress={() => api.current?.play()} />
<Button title="Pause"  onPress={() => api.current?.pause()} />
<Button title="Cancel" onPress={() => api.current?.cancel()} />
<Button title="Finish" onPress={() => api.current?.finish()} />
```

`RnAnimatorApi` methods: `play()`, `pause()`, `cancel()`, `finish()`,
`isPlaying()`, `setPlaybackRate(rate)`, `getCurrentTime()`, `setCurrentTime(ms)`.

### Controlled time

Move through the animation with a slider, or show one fixed frame:

```tsx
const [timeMs, setTimeMs] = useState(0);

<PixodeskSvgAnimator doc={doc} timeMs={timeMs} />
<Slider minimumValue={0} maximumValue={2000} value={timeMs} onValueChange={setTimeMs} />
```

## Props

| Prop | Type | Description |
|---|---|---|
| `doc` | `PxAnimatedSvgDocument` | The animation document to render (required) |
| `autoplay` | `boolean` | Use the trigger from the document |
| `play` | `boolean` | Start playback, ignoring document triggers |
| `pause` | `boolean` | Pause current playback |
| `apiRef` | `RefObject<RnAnimatorApi>` | Ref for imperative control |
| `time` | `number` | show the frame at this position in the whole timeline (duration × iterations): `0` is the first frame, `0.5` the middle, `1` the last |
| `timeMs` | `number` | show the frame at that time, in milliseconds from the start |
| `duration` | `number` | Duration override (ms) |
| `delay` | `number` | Delay before start (ms) |
| `iterations` | `number \| 'infinite'` | Loop count |
| `fill` | `FillMode` | Fill behaviour |
| `direction` | `PlaybackDirection` | Playback direction |
| `resetOnFinish` | `boolean` | Snap back to the start after a natural finish |
| `outAction` | `OutAction` | What a second tap does with the `click` trigger (default: the document's, else `pause`) |
| `onPlay` | `() => void` | Called on play/resume |
| `onPause` | `() => void` | Called on pause |
| `onFinish` | `() => void` | Called on natural finish |
| `onCancel` | `() => void` | Called on cancel |
| `onStop` | `() => void` | Called whenever playback halts (pause / cancel / finish) |
| `onError` | `(error, componentStack?) => void` | Called when a document cannot be compiled or rendered |
| `fallback` | `(error) => ReactElement \| null` | Rendered in place of a failed animation (default: nothing) |

With none of `autoplay` / `play` / `pause` / `time` / `timeMs` set, the component
renders the animation statically (initial state, no playback).

### Failure handling

The component never throws for a bad document. Compilation and rendering both
run inside `try`/`catch`, and the rendered tree sits behind an error boundary,
so a failure is reported through `onError` and shows `fallback` while the
surrounding screen keeps working.

```tsx
<PixodeskSvgAnimator
    doc={doc}
    autoplay
    onError={e => console.warn('animation failed:', e.message)}
    fallback={() => <Text>could not play this animation</Text>}
/>
```

This covers JavaScript errors. A crash inside react-native-svg's **native**
renderer never reaches JavaScript and cannot be caught — see
[Known limitations](#known-limitations).

### Differences from the React package

| Prop | Why it differs |
|---|---|
| `mode` | Not accepted. There is no Web Animations API on React Native; playback is always native-driven. |
| `frameRate` | Not accepted. The screen's own refresh rate is used. The player does not compute values frame by frame: when the document loads it works out the animated values in advance, as a list of snapshots (60 per second of animation), and each screen refresh shows the nearest one. The closest thing to a frame rate is how many snapshots per second are prepared — `compileTracks({ sampleRate })`, only available when you use the lower-level API instead of the component. |
| `startOn` | Not accepted as a prop — the document's trigger is honoured via `autoplay` (`load`, `click`, `scrollIntoView`, `programmatic`). `mouseOver` has no touch equivalent. |
| `className` / `style` | Not accepted — you cannot style the component itself. It fills whatever `View` you put it in, so to set its size, give that `View` a `width` and `height`. Styling *inside* the document (`style` on an element in the JSON) is supported. |
| `onRemove` | Never called. On the web it tells you the animator was thrown away; here there is nothing to tell — when the component leaves the screen, React removes it and everything it created. To run code at that moment, use a `useEffect` cleanup function in your own component. |

## How playback works

There is **no JavaScript frame loop** — the JS thread is idle while an
animation runs.

1. **Once per document:** the shared core flattens it
   (`materialiseAllInTree` → effects, loops, motion-path sampling, animated
   `<use>` inlining), then a track compiler densely samples every animated
   property with `calcAnimationValues` — the same function the web frames engine
   renders with, so values match the web player exactly.
2. **Per frame:** one reanimated progress value, driven by
   `withTiming`/`withRepeat` on the UI thread, and a tiny worklet per animated
   element that indexes its precompiled track.

This is why sampling appears so often below: where `react-native-svg` cannot
express something directly (motion along a path, text on a path), the core
converts it into plain values ahead of time instead of fighting the platform.

## Feature support

Every row below was verified by running the document through the real
pipeline (`materialiseAllInTree` → track compilation) and checking that the
element maps to a `react-native-svg` component and that its animated
properties actually change over time.

### Elements

| Element | Renders | Notes |
|---|---|---|
| `svg`, `g`, `defs` | ✅ | |
| `rect`, `circle`, `ellipse`, `line`, `path`, `polygon`, `polyline` | ✅ | |
| `text`, `tspan` | ✅ | content via the `text` attribute |
| `textPath` | ✅ | see *Text along a path* below |
| `image` | ✅ | `href` accepts `data:` URIs; remote URLs are blocked by the sanitiser |
| `use`, `symbol` | ✅ | animated targets are **inlined into real clones** before render — `<use>` does not propagate animation natively in React Native |
| `linearGradient`, `radialGradient`, `stop` | ✅ | |
| `pattern`, `marker` | ✅ | static geometry verified; complex cases unverified on device |
| `mask`, `clipPath` | ✅ | |
| `filter` + all 22 `fe*` primitives | ✅ | `feGaussianBlur`, `feDropShadow`, `feColorMatrix`, `feMerge`, `feComponentTransfer` + `feFunc*`, … **The visual result has not yet been checked on a real device** |
| `foreignObject` | ❌ | blocked by the shared sanitiser (embeds arbitrary host content) |
| `script` | ❌ | blocked by the shared sanitiser |

### Animatable attributes

| Attribute | Animates | Notes |
|---|---|---|
| `opacity`, `fill-opacity`, `stroke-opacity` | ✅ | |
| `fill`, `stroke`, `stop-color` | ✅ | interpolated as RGBA |
| `stroke-width`, `stroke-dasharray`, `stroke-dashoffset` | ✅ | dash arrays are converted to the numeric form React Native expects |
| `x`, `y`, `width`, `height`, `cx`, `cy`, `r`, `rx`, `ry` | ✅ | |
| `d` (**path morphing**) | ✅ | keyframes must share command structure |
| `transform` (unified parts record) | ✅ | `translate`, `rotate`, `skew`, `scale`, `origin` |
| `translate` / `rotate` / `scale` (legacy per-key form) | ✅ | |
| `offset` and `stop-color` on gradient stops | ✅ | |
| filter primitive attrs (e.g. `stdDeviation`) | ✅ | compiles correctly; on-device rendering unverified |
| `font-size` | ✅ | |
| Any other numeric SVG attribute | ✅ | interpolated numerically and written straight through |

### Effects (`node.effects`)

All effects are materialised by the shared core before rendering, so the React Native
player sees plain nodes. **All are supported:**

| Effect | Status | Notes |
|---|---|---|
| `transformBy` | ✅ | all parts animatable, including `skew` |
| `repeater` | ✅ | copies materialised as real elements; per-copy params animatable |
| `maskedBy` | ✅ | including an animated mask source |
| `clipPath` | ✅ | including animated clip geometry |
| `strokeTrim` | ✅ | incl. `offset` and `subPaths: 'combined'` |
| `clone` + `retime` | ✅ | each clone keeps its own time shift, incl. `retime.timeCrop` (a visibility window on the document timeline) |
| `fillGradient` / `strokeGradient` | ✅ | animated stops **and animated geometry** (`animate.gradientX1`/`Cx`/`R`, …); `gradientTransform` is static (core-wide) |
| `textPath` | ✅ | incl. animated `startOffset` |
| `text.useGlyphs` | ✅ | text becomes `<path>` outlines from `definitions.glyphs` — no font needed |
| `isCombinedShape` | ✅ | |

### Motion, timing and references

| Feature | Status | Notes |
|---|---|---|
| **Motion along a path** + `autoOrient` | ✅ | **sampled** by the core into plain transform keyframes — `react-native-svg` has no native path motion |
| **Text along a path** | ✅ two ways | native `textPath` (incl. animated `startOffset`), or **per-letter motion paths** for smooth results — the example app uses the latter, since animating native `startOffset` is janky in `react-native-svg` |
| Per-property `loop` (incl. `alternate` pingpong) | ✅ | expanded before playback |
| Easing (cubic-bezier and named refs) | ✅ | baked into the sampled tracks |
| `definitions.animations` / `easings` / `styles` / `glyphs` | ✅ | named refs resolved; `style` presets applied as props |
| `node.style` (inline or named) | ✅ | resolved to props — React Native has no CSS, so explicit attributes win |

### Playback and triggers

| Feature | Status | Notes |
|---|---|---|
| `duration`, `delay`, `iterations` (incl. `'infinite'`) | ✅ | |
| `direction` — all four values | ✅ | |
| `fill` — `forwards` / `backwards` / `both` / `none` | ✅ | |
| `resetOnFinish` | ✅ | |
| `play` / `pause` / `cancel` / `finish` | ✅ | |
| `setCurrentTime` — jump to a time, including **while playing** | ✅ | playback continues from the new point |
| `setPlaybackRate` — faster, slower and **reverse** (negative) | ✅ | composes with `direction` |
| Trigger `load` / `programmatic` | ✅ | |
| Trigger `click` | ✅ | wrapped in a `Pressable`; a second tap applies `outAction` |
| Trigger `scrollIntoView` | ✅ | visibility sampled by measuring against the window (React Native has no `IntersectionObserver`); honours `scrollIntoViewThreshold` and `outAction` |
| Trigger `mouseOver` | ❌ | no touch equivalent — use `click`, or drive `play` yourself |
| `frameRate` | n/a | reanimated runs at the display refresh rate; use `compileTracks({sampleRate})` to trade memory for temporal precision |
| `mode` (`waapi` / `frames`) | n/a | there is no Web Animations API on React Native — playback is always native-driven |

### Known limitations

- **On-device verification is incomplete.** The pipeline, prop mapping and
  driving logic are covered by unit tests and were exercised end-to-end
  through `react-native-web`; the native reanimated ↔ `react-native-svg` prop
  bridge (notably filters and `strokeDasharray`) still needs checking on real
  iOS/Android.
- **animated `gradientTransform`** is unimplemented (`retime.timeCrop` now works — implemented 2026-08)
  in the core, so they are unavailable here too.
- **`mouseOver`** has no touch analogue and will not be implemented.
- **Text on a closed path is worked around, not fixed.** react-native-svg's
  native text-on-path layout crashes the app (an `NSRangeException` on iOS) when
  a `<textPath>` has a non-zero `startOffset` on a *closed* path: it bounds
  glyph placement by `startOffset … startOffset + pathLength` instead of
  `0 … pathLength`, so glyphs past the end of the path reach a lookup that
  returns `NSNotFound`. On native the player gives such a `<textPath>` its own
  open copy of the path (`openClosedTextPathTargets`), which restores the
  correct bounds. Text that would have wrapped around past the end of the loop
  is clipped instead. Web is unaffected and left untouched.

## Monorepo setup

pnpm and yarn workspaces can install **two physical copies** of a native package
when peer versions differ even slightly. If the copy this player imports is not
the copy the app registered natively, you get:

```
Invariant Violation: View config getter callback for component `RNSVGLine`
must be a function (received `undefined`)
```

Two things prevent it:

1. Keep `@types/react`, `react` and `react-native` versions aligned across every
   workspace package.
2. Force single instances in `metro.config.js`:

```js
const SINGLETONS = ['react', 'react-dom', 'react-native', 'react-native-svg',
                    'react-native-reanimated', 'react-native-worklets'];

const base = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (SINGLETONS.some(n => moduleName === n || moduleName.startsWith(n + '/'))) {
        return context.resolveRequest(
            { ...context, originModulePath: path.join(projectRoot, 'index.js') },
            moduleName, platform);
    }
    return (base ?? context.resolveRequest)(context, moduleName, platform);
};
```

A complete config is in
[`examples/react-native-preview-player/metro.config.js`](../../examples/react-native-preview-player/metro.config.js).

## Advanced exports

For custom rendering or diagnostics:

- `renderRnNode(node, opts)` — render a `PxNode` tree to `react-native-svg`
  elements, with a `decorate` hook for wrapping animated elements.
- `compileTracks(doc, { sampleRate, maxSamples, native })` — build the sampled
  tracks yourself; `sampleRate` trades memory for temporal precision
  (default 60/s). `native` selects the value form: the default is the SVG/DOM
  one, `true` gives what the native views want (a `transform` becomes a
  6-number matrix).
- `sampleProps(tracks, tMs, stepMs, sampleCount, native)` — the worklet-safe
  lookup. `native` renames `transform` to the native views' `matrix`; pass it
  only for values going through reanimated's animated-props path on a device.
- `openClosedTextPathTargets(doc, warnings?)` — the closed-path `<textPath>`
  workaround described under [Known limitations](#known-limitations).
- `PxRnErrorBoundary` — the boundary the component wraps itself in.
- `RN_SVG_COMPONENTS`, `toRnPropName` — the tag and attribute maps.

## Example app

A full preview player with six animations and transport controls:

```bash
pnpm example:rn          # or: cd examples/react-native-preview-player && npx expo start
```

See [`examples/react-native-preview-player`](../../examples/react-native-preview-player).

## License

[MIT](../../LICENSE) © [Pixodesk](https://pixodesk.com)
