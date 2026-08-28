# React Native — `@pixodesk/svg-animator-rn` 🧪

[← Vue](./09-player--vue.md) · [Contents](./README.md) · Next: [Static sites & CMS →](./11-player--static-sites-and-cms.md)

> **Experimental.** The API may change without a major version bump, and a few things are
> unimplemented or unverified on real devices — see [Feature support](#feature-support) and
> [Known limitations](#known-limitations).

`<PixodeskSvgAnimator doc={…} />` takes the **same JSON the web player uses** and renders it
as native SVG (`react-native-svg`), driven on the UI thread by `react-native-reanimated`.
There is no JavaScript frame loop: once a document is compiled, the JS thread stays idle while
it plays. Props mirror the [React component](./08-player--react.md).

## Install

```bash
npm install @pixodesk/svg-animator-rn
# peers, if you don't have them already:
npx expo install react-native-svg react-native-reanimated
```

Peer dependencies: `react >= 18`, `react-native >= 0.76`, `react-native-svg >= 15`,
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
> must be a function` at runtime. See [Monorepo setup](#monorepo-setup).

## Quick start

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

The component is **sized by its container** — wrap it in a `View` with the dimensions you want.

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
<PixodeskSvgAnimator doc={doc} autoplay />
```

**Declarative play / pause:**

```tsx
<PixodeskSvgAnimator doc={doc} play={play} pause={pause} />
```

**Imperative API:**

```tsx
import { useRef } from 'react';
import type { RnAnimatorApi } from '@pixodesk/svg-animator-rn';

const api = useRef<RnAnimatorApi>(null);
<PixodeskSvgAnimator doc={doc} apiRef={api} />
<Button title="Play" onPress={() => api.current?.play()} />
```

`RnAnimatorApi`: `play()`, `pause()`, `cancel()`, `finish()`, `isPlaying()`,
`setPlaybackRate(rate)` (negative = reverse), `getCurrentTime()`, `setCurrentTime(ms)` — seeking
while playing continues from the new position.

**Controlled time:**

```tsx
<PixodeskSvgAnimator doc={doc} timeMs={timeMs} />
<Slider minimumValue={0} maximumValue={2000} value={timeMs} onValueChange={setTimeMs} />
```

## Props

| Prop | Type | Description |
|---|---|---|
| `doc` | `PxAnimatedSvgDocument` | **required** |
| `autoplay` | `boolean` | use the document's trigger |
| `play` | `boolean` | play unconditionally |
| `pause` | `boolean` | pause |
| `apiRef` | `RefObject<RnAnimatorApi>` | imperative control |
| `time` | `number` | seek to a fraction 0–1 of the whole timeline |
| `timeMs` | `number` | seek to ms |
| `duration` · `delay` | `number` | ms overrides |
| `iterations` | `number \| 'infinite'` | |
| `fill` | `'forwards' \| 'backwards' \| 'both' \| 'none'` | |
| `direction` | `'normal' \| 'reverse' \| 'alternate' \| 'alternate-reverse'` | |
| `resetOnFinish` | `boolean` | snap back to the start after a natural finish |
| `outAction` | `'continue' \| 'pause' \| 'reset' \| 'reverse'` | what a second tap does with the `click` trigger (default: the document's, else `pause`) |
| `onPlay` · `onPause` · `onFinish` · `onCancel` · `onStop` | `() => void` | lifecycle; `onStop` fires with any halt |
| `onError` | `(error, componentStack?) => void` | the document could not be compiled or rendered |
| `fallback` | `(error) => ReactElement \| null` | rendered in place of a failed animation (default: nothing) |

With none of `autoplay` / `play` / `pause` / `time` / `timeMs` set, the first frame renders
statically.

### Differences from the React package

| Prop | Why it differs |
|---|---|
| `mode` | not accepted — there is no Web Animations API on RN; playback is always native-driven |
| `frameRate` | not accepted — reanimated runs at the display refresh rate; the analogous knob is sampling density (`compileTracks({ sampleRate })`) |
| `startOn` | not accepted — the document's trigger is honoured via `autoplay` (`load`, `click`, `scrollIntoView`, `programmatic`); `mouseOver` has no touch equivalent |
| `className` / `style` | not accepted — size with the container `View` (`node.style` *inside* the document is supported) |
| `onRemove` | not emitted — use React's own unmount cleanup |

### Failure handling

The component never throws for a bad document: compilation and rendering run in `try/catch`
and behind an error boundary, so a failure reaches `onError` and shows `fallback` while the
rest of the screen keeps working.

```tsx
<PixodeskSvgAnimator
  doc={doc}
  autoplay
  onError={e => console.warn('animation failed:', e.message)}
  fallback={() => <Text>could not play this animation</Text>}
/>
```

A crash inside `react-native-svg`'s **native** renderer never reaches JavaScript and cannot be
caught — see the limitations below.

## How playback works

1. **Once per document:** the shared core flattens it (`materialiseAllInTree` → effects,
   loops, motion-path sampling, animated `<use>` inlining), then every animated property is
   densely sampled into a track with the same `calcAnimationValues` the web frame loop uses —
   so values match the web player exactly.
2. **Per frame:** one reanimated progress value (`withTiming` / `withRepeat` on the UI thread)
   and a tiny worklet per animated element that indexes its precompiled track.

Where `react-native-svg` cannot express something directly (motion along a path, text on a
path), the core converts it into plain values ahead of time instead of fighting the platform.

## Feature support

Every row was verified by running a document through the real pipeline and checking that the
element maps to a `react-native-svg` component and that its animated properties change over
time.

**Elements** — `svg`, `g`, `defs`, `rect`, `circle`, `ellipse`, `line`, `path`, `polygon`,
`polyline`, `text`, `tspan`, `textPath`, `image` (`data:` URIs; remote URLs are blocked by the
sanitiser), `use`/`symbol` (animated targets are inlined into real clones), gradients and
`stop`, `pattern`, `marker` (static verified; complex cases unverified on device), `mask`,
`clipPath`, `filter` + all 22 `fe*` primitives (needs the New Architecture; visual parity
unverified on device). Blocked: `foreignObject`, `script`.

**Animatable attributes** — opacity and the fill/stroke opacities; `fill`, `stroke`,
`stop-color` (RGBA interpolation); `stroke-width`, `stroke-dasharray`, `stroke-dashoffset`;
`x`, `y`, `width`, `height`, `cx`, `cy`, `r`, `rx`, `ry`; `d` (path morphing — keyframes must
share command structure); `transform` (unified parts record) and the legacy per-key
`translate` / `rotate` / `scale`; gradient stop `offset` / `stop-color`; filter primitive attrs
(compiles; on-device rendering unverified); `font-size`; any other numeric attribute.

**Effects** — all of them: `transformBy`, `repeater`, `maskedBy`, `clipPath`, `strokeTrim`
(incl. `offset` and `subPaths: 'combined'`), `clone` + `retime` (incl. `timeCrop`),
`fillGradient` / `strokeGradient` (animated stops **and** geometry; `gradientTransform` static),
`textPath` (incl. animated `startOffset`), `text.useGlyphs`.

**Motion, timing, references** — motion along a path + `autoOrient` (sampled by the core);
text along a path two ways (native `textPath`, or per-letter motion paths for smooth results —
the example app uses the latter, since animating native `startOffset` is janky in
`react-native-svg`); per-property `loop` incl. ping-pong; cubic-bezier and named easings;
`definitions.animations` / `easings` / `styles` / `glyphs`; `node.style`.

**Playback and triggers** — `duration`, `delay`, `iterations` (incl. infinite), all four
`direction` values, all `fill` values, `resetOnFinish`, play/pause/cancel/finish, seeking
(also while playing), playback rate (faster, slower, reverse), triggers `load` / `programmatic`
/ `click` / `scrollIntoView` (incl. `scrollIntoViewThreshold` and `outAction`). Not supported:
`mouseOver` (no touch equivalent), `frameRate`, `mode`, scroll-driven playback
(`timelineSource: 'scroll'`).

## Known limitations

- **On-device verification is incomplete.** The pipeline, prop mapping and driving logic are
  unit-tested and were exercised end-to-end through `react-native-web`; the native reanimated ↔
  `react-native-svg` prop bridge (notably filters and `strokeDasharray`) still needs checking on
  real iOS/Android.
- **Animated `gradientTransform`** is unimplemented core-wide, so it is unavailable here too.
- **`mouseOver`** has no touch analogue and will not be implemented.
- **Text on a closed path is worked around, not fixed.** `react-native-svg`'s native
  text-on-path layout crashes (an `NSRangeException` on iOS) when a `<textPath>` has a non-zero
  `startOffset` on a *closed* path. On native the player gives such a `<textPath>` its own open
  copy of the path (`openClosedTextPathTargets`); text that would have wrapped past the end of
  the loop is clipped instead. Web is unaffected.

## Monorepo setup

pnpm and yarn workspaces can install **two physical copies** of a native package when peer
versions differ even slightly. Two things prevent it:

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
| `compileTracks(doc, { sampleRate, maxSamples, native })` | build the sampled tracks yourself; `sampleRate` trades memory for temporal precision (default 60/s); `native: true` yields the value form native views want (a `transform` becomes a 6-number matrix) |
| `sampleProps(tracks, tMs, stepMs, sampleCount, native)` | the worklet-safe track lookup |
| `openClosedTextPathTargets(doc, warnings?)` | the closed-path `<textPath>` workaround |
| `PxRnErrorBoundary` | the boundary the component wraps itself in |
| `RN_SVG_COMPONENTS`, `toRnPropName` | the tag and attribute maps |

## Example apps

```bash
pnpm example:rn            # preview player with six animations and transport controls
pnpm example:rn:web        # quickest look — runs via react-native-web
pnpm example:rn:explorer   # every feature fixture from the test corpus
```

See [`examples/react-native-preview-player`](../examples/react-native-preview-player).

[← Vue](./09-player--vue.md) · [Contents](./README.md) · Next: [Static sites & CMS →](./11-player--static-sites-and-cms.md)
