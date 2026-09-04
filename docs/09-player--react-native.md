# React Native — `@pixodesk/svg-animator-rn` 🧪 (in development)

[← Vue](./08-player--vue.md) · [Contents](./README.md) · Next: [Playback settings & triggers →](./10-player--playback-and-triggers.md)

> **In development.** This player is not finished yet. The API may change without a major
> version change, and some things are unimplemented or not yet verified on real devices — see
> [Feature support](#feature-support). Use it to evaluate and prototype; expect to adjust your
> code as new versions come out.

Use this in a React Native or Expo app. Give `<PixodeskSvgAnimator doc={…} />` the **same
JSON the web player uses** and it renders native SVG (`react-native-svg`), driven on the UI
thread by `react-native-reanimated`. There is no JavaScript frame loop: once a document is
compiled, the JS thread stays idle while it plays, so your app stays responsive. The props are
the same as on the [React web component](./07-player--react.md), so a component you wrote for
a React website works in the React Native app with little change — and the other way round.

## Install

One package, plus the two native libraries it renders and animates with:

```bash
npm install @pixodesk/svg-animator-rn
# also needed, if your app does not have them yet:
npx expo install react-native-svg react-native-reanimated
# Reanimated 4 and later also needs its worklets runtime:
npx expo install react-native-worklets
```

Required alongside it: `react >= 18`, `react-native >= 0.76`, `react-native-svg >= 15`,
`react-native-reanimated >= 3.16`. Reanimated needs its Babel plugin, last in the list:

```js
// babel.config.js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-reanimated/plugin'], // must be last
  };
};
```

> **Monorepo users:** `react-native-svg`, `react-native-reanimated` and `react` must resolve to
> a **single copy** each, or you get `View config getter callback for component 'RNSVGLine'
> must be a function` at runtime. This is a general React Native issue with pnpm / yarn
> workspaces, not something this package causes — you would hit it with any library that uses
> `react-native-svg`. We mention it because the error message gives no hint of the cause; the
> fix is in [Monorepo setup](#monorepo-setup).

## Quick start

The whole common case — an animation that plays on mount and loops if the document says so:

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

The component has no size of its own: it fills whatever `View` you put it in. To set its size,
give that `View` a `width` and `height`, as in the example above.

Common variations. Each line is the `<PixodeskSvgAnimator>` element inside a component like
`Logo` above; `isPlaying`, `scrollProgress` and `setDone` stand for your own state:

```tsx
// Play once when a screen opens, then hold the last frame
<PixodeskSvgAnimator doc={doc} autoplay iterations={1} fill="forwards" />

// Loop forever regardless of what the document says
<PixodeskSvgAnimator doc={doc} autoplay iterations="infinite" />

// Static — first frame only
<PixodeskSvgAnimator doc={doc} />

// Toggle from your own state
<PixodeskSvgAnimator doc={doc} play={isPlaying} />

// Tie progress to a gesture / slider (no playback, just a frame)
<PixodeskSvgAnimator doc={doc} time={scrollProgress} />

// Override the document's timing
<PixodeskSvgAnimator doc={doc} autoplay duration={4000} delay={500} />

// Do something when it finishes
<PixodeskSvgAnimator doc={doc} autoplay onFinish={() => setDone(true)} />
```

TypeScript: `import animation from './animation.json'` gives a plain object; cast it if your
`tsconfig` complains:

```tsx
import type { PxAnimatedSvgDocument } from '@pixodesk/svg-animator-core';
const doc = animation as PxAnimatedSvgDocument;
```

## Control modes

Four ways to drive playback — pick one, they are mutually exclusive.

**Autoplay** — honours the document's trigger (`load` plays on mount; `click` wraps the
animation in a `Pressable`; `scrollIntoView` measures visibility against the window):

```tsx
import { PixodeskSvgAnimator } from '@pixodesk/svg-animator-rn';
import doc from './animation.json';

export function Intro() {
  return <PixodeskSvgAnimator doc={doc} autoplay />;
}
```

**Declarative play / pause:**

```tsx
import { useState } from 'react';
import { Button, View } from 'react-native';
import { PixodeskSvgAnimator } from '@pixodesk/svg-animator-rn';
import doc from './animation.json';

export function Controlled() {
  const [play, setPlay] = useState(false);
  const [pause, setPause] = useState(false);
  return (
    <View>
      <PixodeskSvgAnimator doc={doc} play={play} pause={pause} />
      <Button title="Play" onPress={() => { setPlay(true); setPause(false); }} />
      <Button title="Pause" onPress={() => setPause(true)} />
    </View>
  );
}
```

**Imperative API:**

```tsx
import { useRef } from 'react';
import { Button, View } from 'react-native';
import { PixodeskSvgAnimator, type RnAnimatorApi } from '@pixodesk/svg-animator-rn';
import doc from './animation.json';

export function Imperative() {
  const api = useRef<RnAnimatorApi>(null);
  return (
    <View>
      <PixodeskSvgAnimator doc={doc} apiRef={api} />
      <Button title="Play" onPress={() => api.current?.play()} />
      <Button title="Pause" onPress={() => api.current?.pause()} />
    </View>
  );
}
```

`RnAnimatorApi`: `play()`, `pause()`, `cancel()`, `finish()`, `isPlaying()`,
`setPlaybackRate(rate)` (negative = reverse), `getCurrentTime()`, `setCurrentTime(ms)` — jumping to a time
while playing continues from there.

**Controlled time:**

```tsx
import { useState } from 'react';
import { View } from 'react-native';
import Slider from '@react-native-community/slider';   // any slider works — this one is `npm install @react-native-community/slider`
import { PixodeskSvgAnimator } from '@pixodesk/svg-animator-rn';
import doc from './animation.json';

export function Scrubber() {
  const [time, setTime] = useState(0);
  return (
    <View>
      <PixodeskSvgAnimator doc={doc} time={time} />
      <Slider minimumValue={0} maximumValue={2000} value={time} onValueChange={setTime} />
    </View>
  );
}
```

## Props

Only `doc` is required. The file already carries the timing and the trigger you set in the
editor; every other prop is optional and, when passed, replaces the file's value for this one
component.

| Prop | Type | Description |
|---|---|---|
| `doc` | `PxAnimatedSvgDocument` | **required** — the animation, as saved by the editor |
| `autoplay` | `boolean` | start the way the file says — the *Start* trigger you chose in the editor: at once, on tap, or when scrolled into view |
| `play` | `boolean` | play now, whatever the file's trigger says |
| `pause` | `boolean` | pause the current playback; set it back to `false` to resume |
| `apiRef` | `RefObject<RnAnimatorApi>` | imperative control |
| `progress` | `number` | show the frame at this position in the whole timeline (duration × iterations): `0` is the first frame, `0.5` the middle, `1` the last |
| `time` | `number` | show the frame at that time, in milliseconds from the start |
| `duration` · `delay` | `number` | length of one iteration, and the wait before it starts, both in ms. The file already carries the values you set in the editor — pass these only to change them for this one component |
| `iterations` | `number \| 'infinite'` | how many times to play; `'infinite'` never stops |
| `fill` | `'forwards' \| 'backwards' \| 'both' \| 'none'` | what shows before the start / after the end |
| `direction` | `'normal' \| 'reverse' \| 'alternate' \| 'alternate-reverse'` | play forward, backward, or turn around on every iteration (starting forward or backward) |
| `resetOnFinish` | `boolean` | snap back to the start after a natural finish (the file spells it `timeline.trigger.onFinish: "reset"`) |
| `outAction` | `'continue' \| 'pause' \| 'reset' \| 'reverse'` | what happens when the trigger ends — a second tap with the `click` trigger, or scrolling out of view with `scrollIntoView`: keep playing, pause, go back to the start, or play backwards. If you don't pass it, the value saved in the file is used (set in the editor as *When the trigger ends*); if the file has none either, `pause` |
| `onPlay` · `onPause` · `onFinish` · `onCancel` · `onStop` | `() => void` | called when the animation starts or resumes (`onPlay`), pauses (`onPause`), reaches its end (`onFinish`), or is stopped and reset to the start (`onCancel`) — same meanings as in the [React component](./07-player--react.md#props). `onStop` fires *in addition to* any of the others that halt playback — use it when you only care that the animation is no longer playing |
| `onError` | `(error, componentStack?) => void` | the document could not be compiled or rendered |
| `fallback` | `(error) => ReactElement \| null` | rendered in place of a failed animation (default: renders nothing) |

With none of `autoplay` / `play` / `pause` / `progress` / `time` set, the first frame renders
statically.

### Differences from the React package

| Prop | Why it differs |
|---|---|
| `mode` | not accepted — there is no Web Animations API on React Native; playback is always native-driven |
| `frameRate` | not accepted — the screen's own refresh rate is used. On React Native the player does not compute values frame by frame; when the document loads it works out the animated values in advance, as a list of snapshots — 60 per second of animation — and while playing, each screen refresh shows the nearest one. The closest thing to a frame rate is how many snapshots per second are prepared, and that can only be changed when you call the lower-level `compileTracks({ sampleRate })` yourself instead of using the component |
| `startOn` | not accepted — the document's trigger is honoured via `autoplay` (`load`, `click`, `scrollIntoView`, `programmatic`); `mouseOver` has no touch equivalent |
| `className` / `style` | not accepted — you cannot style the component itself. It fills whatever `View` you put it in, so to set its size, give that `View` a `width` and `height` (see [Quick start](#quick-start)). Styling *inside* the document — `style` on an element in the JSON — is supported |
| `onRemove` | never called. On the web it tells you the animator was thrown away; here there is nothing to tell — when the component leaves the screen, React removes it and everything it created. If you need to run code at that moment, use a `useEffect` cleanup function in your own component |

### Failure handling

The component never throws errors for a bad document: compilation and rendering run in `try/catch`
and behind an error boundary, so a failure reaches `onError` and shows `fallback` while the
rest of the screen keeps working.

```tsx
import { Text } from 'react-native';
import { PixodeskSvgAnimator } from '@pixodesk/svg-animator-rn';
import doc from './animation.json';

export function Safe() {
  return (
    <PixodeskSvgAnimator
      doc={doc}
      autoplay
      onError={e => console.warn('animation failed:', e.message)}
      fallback={() => <Text>could not play this animation</Text>}
    />
  );
}
```

A crash inside `react-native-svg`'s **native** renderer never reaches JavaScript and cannot be
caught — see the limitations below.

## How playback works

The work is split into two stages: a heavier one done once, when the document loads, and a
very light one repeated on every screen refresh while it plays.

1. **Once, when the document loads.** The shared core (the same code the web player uses)
   first turns everything special in the document into plain SVG elements and attributes —
   effects, property loops, motion along a path, animated `<use>` copies. Then, for every
   animated property, it works out the value at each moment of the animation in advance and
   stores them as a list of snapshots, 60 per second of animation. It uses the same value
   calculation as the web player's frame loop, so the animation looks exactly the same as on
   the web.
2. **On every screen refresh while playing.** A single number — how far along the animation
   is — is advanced by `react-native-reanimated` directly on the UI thread, the part of the app
   that draws the screen. Each animated element runs a tiny piece of code there that picks the
   snapshot for the current moment and applies it. No JavaScript in your app runs per frame,
   which is why playback stays smooth even while your app is busy.

Anything `react-native-svg` cannot draw directly — motion along a path, text on a path — is
converted into plain positions and values in stage 1, so stage 2 never has to deal with it.

## Feature support

Every ✅ row was verified by running a document through the real pipeline and checking that
the element maps to a `react-native-svg` component and that its animated properties change
over time. The code is unit-tested and was run end-to-end through `react-native-web`; ⚠️
marks what works there but has not yet been checked on a real iOS / Android device; ❌ is
not supported.

### Elements

| Element | Supported | Notes |
|---|---|---|
| `svg`, `g`, `defs` | ✅ | |
| `rect`, `circle`, `ellipse`, `line`, `path`, `polygon`, `polyline` | ✅ | |
| `text`, `tspan`, `textPath` | ✅ | |
| `image` | ✅ | `data:` URIs only — the player has a built-in safety check that removes remote image URLs |
| `use`, `symbol` | ✅ | an animated target is copied into a real clone before rendering |
| `linearGradient`, `radialGradient`, `stop` | ✅ | |
| `mask`, `clipPath` | ✅ | |
| `pattern`, `marker` | ⚠️ | static use verified; complex cases not yet checked on a device |
| `filter` and all 22 `fe*` primitives | ⚠️ | compiles and renders; visual result not yet checked on a device |
| `foreignObject`, `script` | ❌ | removed |

### Animatable attributes

| Attribute | Supported | Notes |
|---|---|---|
| `opacity`, `fill-opacity`, `stroke-opacity` | ✅ | |
| `fill`, `stroke`, `stop-color` | ✅ | colours blend through RGBA |
| `stroke-width`, `stroke-dashoffset` | ✅ | |
| `stroke-dasharray` | ⚠️ | animates; the native value bridge not yet checked on a device |
| `x`, `y`, `width`, `height`, `cx`, `cy`, `r`, `rx`, `ry` | ✅ | |
| `d` (path morphing) | ✅ | keyframes must share the same command structure |
| `transform` (an object holding all the parts: translate, rotate, scale, …) and per-key `translate` / `rotate` / `scale` | ✅ | |
| gradient stop `offset`, `stop-color` | ✅ | |
| `font-size` and any other numeric attribute | ✅ | |
| filter primitive attributes | ⚠️ | compiles; on-device rendering not yet checked |

### Effects

| Effect | Supported | Notes |
|---|---|---|
| `transformBy` | ✅ | |
| `repeater` | ✅ | |
| `maskedBy` | ✅ | |
| `clipPath` | ✅ | |
| `strokeTrim` | ✅ | incl. `offset` and `subPaths: 'combined'` |
| `clone` + `retime` | ✅ | incl. `timeCrop` |
| `fillGradient` / `strokeGradient` | ✅ | animated stops **and** geometry |
| Animated `gradientTransform` | ❌ | not implemented in the shared core, so unavailable on every player; a static `gradientTransform` works |
| `textPath` | ✅ | incl. animated `startOffset` |
| `text.useGlyphs` | ✅ | |

### Motion, timing, references

| Feature | Supported | Notes |
|---|---|---|
| Motion along a path, `autoOrient` | ✅ | positions worked out in advance by the core |
| Text along a path | ✅ | two ways: native `textPath`, or one motion path per letter. The example app uses the latter — animating native `startOffset` stutters in `react-native-svg` |
| Text on a *closed* path with a non-zero `startOffset` | ⚠️ | worked around, not fixed: `react-native-svg`'s own text-on-path layout crashes on this (iOS), so the player gives such text its own *open* copy of the path; text that would wrap past the end of the loop is cut off instead. The web player is unaffected |
| Per-property `loop`, incl. ping-pong | ✅ | |
| Cubic-bezier and named easings | ✅ | |
| `definitions.animations` / `easings` / `styles` / `glyphs` | ✅ | |
| `node.style` | ✅ | |

### Playback and triggers

| Feature | Supported | Notes |
|---|---|---|
| `duration`, `delay`, `iterations` (incl. infinite) | ✅ | |
| All four `direction` values, all `fill` values, `resetOnFinish` | ✅ | |
| play / pause / cancel / finish | ✅ | |
| Jumping to any time, also while playing | ✅ | |
| Playback rate: faster, slower, reverse | ✅ | |
| Triggers `load`, `programmatic`, `click`, `scrollIntoView` | ✅ | incl. `scrollIntoViewThreshold` and `outAction` |
| Trigger `mouseOver` | ❌ | no touch equivalent; will not be added |
| `frameRate`, `mode` | ❌ | see [Differences from the React package](#differences-from-the-react-package) |
| Scroll-driven playback (`timeline.type: 'scroll' / 'view'`) | ❌ | |

## Monorepo setup

This section is about a general React Native problem, not one this package causes; it is
here in case you hit it. A plain Expo or React Native app with a single `node_modules` never
does. pnpm and yarn workspaces, however, can install **two physical copies** of a native
package when peer versions differ even slightly — and then the copy of `react-native-svg` the
player imports is not the one whose native views were registered, which fails at runtime with
`View config getter callback for component 'RNSVGLine' must be a function`. Two things
prevent it:

1. Keep `@types/react`, `react` and `react-native` versions aligned across every workspace
   package.
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
[`examples/react-native-preview-player/metro.config.js`](../examples/react-native-preview-player/metro.config.js).

## Advanced exports

For custom rendering or diagnostics:

| Export | Purpose |
|---|---|
| `renderRnNode(node, opts)` | render a document tree to `react-native-svg` elements, with a `decorate` hook for wrapping animated elements |
| `compileTracks(doc, { sampleRate, maxSamples, native })` | build the sampled tracks yourself; `sampleRate` is how many snapshots per second of animation are prepared — more make fast movement smoother but take more memory (default 60/s); `native: true` yields the value form native views want (a `transform` becomes a 6-number matrix) |
| `sampleProps(tracks, tMs, stepMs, sampleCount, native)` | the worklet-safe track lookup |
| `openClosedTextPathTargets(doc, warnings?)` | the closed-path `<textPath>` workaround |
| `PxRnErrorBoundary` | the boundary the component wraps itself in |
| `RN_SVG_COMPONENTS`, `toRnPropName` | the tag and attribute maps |

## Example apps

Two Expo apps in the repository show the player running on a device. Each is one command from
the repository root:

```bash
pnpm example:rn            # preview player with several animations and controls
pnpm example:rn:web        # quickest look — runs via react-native-web
pnpm example:rn:explorer   # feature explorer
```

See [`examples/react-native-preview-player`](../examples/react-native-preview-player).

[← Vue](./08-player--vue.md) · [Contents](./README.md) · Next: [Playback settings & triggers →](./10-player--playback-and-triggers.md)
