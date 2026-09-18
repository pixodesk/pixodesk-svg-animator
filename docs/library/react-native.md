# React Native — `@pixodesk/svg-animator-rn` 🧪 (in development)

[← Vue](./vue.md) · [Contents](../../README.md#documentation) · Next: [Playback settings & triggers →](./playback-and-triggers.md)

> **In development.** This player is not finished yet. The API may change without a major
> version change, and some things are unimplemented or not yet verified on real devices — see
> [Feature support](#feature-support). Use it to evaluate and prototype; expect to adjust your
> code as new versions come out.

Use this in a React Native or Expo app. Give `<PixodeskSvgAnimator doc={…} />` the **same
JSON the web player uses** and it renders native SVG (`react-native-svg`), driven on the UI
thread by `react-native-reanimated`. There is no JavaScript frame loop: once a document is
compiled, the JS thread stays idle while it plays, so your app stays responsive. The props are
the same as on the [React web component](./react.md), so a component you wrote for
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
<PixodeskSvgAnimator doc={doc} autoplay iterations={1} timeline={{ fillMode: 'forwards' }} />

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

Three control modes, plus a handle that is not one. Set more than one control prop and the
highest-priority one wins — `progress` / `time` → `play` / `pause` → `autoplay` — and the
component warns, naming both props and the winner; set none of them and the first frame renders
statically. `apiRef` is filled in every mode and never changes which one you are in. React, Vue
and React Native all resolve this the same way, from one rule in core.

**Autoplay** — honors the document's trigger (`load` plays on mount; `click` wraps the
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
`setPlaybackRate(rate)` (negative = reverse; `0` is rejected with a warning — use `pause()`),
`getCurrentTime()`, `setCurrentTime(ms)`, `getCurrentProgress()`, `setCurrentProgress(p)` —
jumping to a time while playing continues from there.

`getCurrentTime()` is ms from the start of the whole run, every iteration included — the same
as the web players. It used to be ms within the *current* iteration here, so a slider built on
it jumped back to zero each time the animation repeated.

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

Mirrors the React component on `react-native-svg` + `reanimated`: the document is materialized
once, sampled into per-element tracks, and played on the UI thread. No CSS-flavor component, no
`className` / `style`, and a `fallback` element instead of a DOM.

<!-- px-check signature pkg=rn -->
```typescript
// The component — a plain function, also the default export.
function PixodeskSvgAnimator(props: PixodeskSvgAnimatorProps): ReactElement | null;

interface PixodeskSvgAnimatorProps {
    doc: PxAnimatedSvgDocument;           // required — the animation, as saved by the editor

    // Playback override — the same object as React (Playback overrides below). `timeline.engine`
    // is accepted but ignored: React Native always uses the `native` materialization.
    timeline?: PxTimelinePatch | string;
    resetTimeline?: boolean;              // start from the player's defaults, `timeline` on top

    duration?: number; delay?: number;    // shortcuts, ms: one iteration, and the wait before it
    iterations?: number | 'infinite';     // 'infinite' never stops
    start?: PxTriggerStart;                  // 'mouseOver' has no touch equivalent and is ignored;
                                          //   'click' = tap (a second tap applies mouseOut);
                                          //   'scrollIntoView' = measured every 200 ms

    // Control — the highest-priority one that is set picks the mode (Control modes above)
    autoplay?: boolean;                   // honor the document trigger — the same defaults as the
                                          //   web: start 'load', mouseOut 'continue'
    play?: boolean; pause?: boolean;      // unconditional control; play={false} holds where it is
    progress?: number;                    // 0–1 of duration × iterations (one iteration when 'infinite')
    time?: number;                        // ms from the start

    apiRef?: React.RefObject<RnAnimatorApi | null>;   // the same methods as ReactAnimatorApi, and the
                                          //   same meanings: whole-run time, clamped seeks, rate 0 rejected

    // Lifecycle — no arguments; the same meanings as on the web
    onPlay?: () => void; onStop?: () => void; onPause?: () => void;
    onCancel?: () => void; onFinish?: () => void;
    onRemove?: () => void;                // unmount, or a `doc` swap

    // Diagnostics — the shared channel (the API at a glance): onError means THIS INSTANCE WILL NOT
    // PLAY — the compile or the render threw; d.error is the Error, and d.data carries the
    // component stack when the error boundary caught it — and `fallback` is what shows instead.
    // Only JavaScript failures reach it; a crash inside the native renderer does not.
    onWarn?: (d: PxDiagnostic) => void;
    onError?: (d: PxDiagnostic) => void;
    muteWarn?: boolean; muteError?: boolean;
    fallback?: (error: Error) => ReactElement | null;   // rendered in place of a failed animation
}
```

The package exports the component, its props (`PixodeskSvgAnimatorProps`) and its handle
(`RnAnimatorApi`); nothing else.

With none of `autoplay` / `play` / `pause` / `progress` / `time` set, the first frame renders
statically.

### Playback overrides

The same document can play differently on each screen. `timeline` takes an object shaped exactly
like the file's own `animator` block and deep-merges it over what the file says — the document
you passed is never modified.

```tsx
// The file loops twice and starts on mount; here it loops forever and holds the last frame.
<PixodeskSvgAnimator
  doc={doc}
  autoplay
  timeline={{ iterations: 'infinite', fillMode: 'forwards' }}
/>
```

Objects merge key by key, values replace, and `null` **deletes** a key so the default its
absence means comes back. `duration`, `delay`, `iterations` and `start` are also plain props,
and win over the same key inside `timeline`. To ignore the file's playback settings entirely,
add `resetTimeline`.

`timeline` is where the settings that used to be their own props now live —
`{ timeline: { fillMode, direction, trigger: { mouseOut, finish } } }`. Full merge rules
are in [Playback & triggers → Overriding from a player](./playback-and-triggers.md#overriding-from-a-player).

### Differences from the React package

<!-- px-check off differences from React, prose -->
| Prop | Why it differs |
|---|---|
| `timeline.engine` | accepted inside `timeline` but ignored — there is no Web Animations API on React Native; playback is always native-driven |
| `timeline.frameRate` | ignored — the screen's own refresh rate is used. On React Native the player does not compute values frame by frame; when the document loads it works out the animated values in advance, as a list of snapshots — 60 per second of animation — and while playing, each screen refresh shows the nearest one. The closest thing to a frame rate is how many snapshots per second are prepared, which the player fixes at 60 |
| `start: 'mouseOver'` | has no touch equivalent, so it is not honored. The other four values (`load`, `click`, `scrollIntoView`, `programmatic`) work as they do on the web, from the file or from the prop |
| `className` / `style` | not accepted — you cannot style the component itself. It fills whatever `View` you put it in, so to set its size, give that `View` a `width` and `height` (see [Quick start](#quick-start)). Styling *inside* the document — `style` on an element in the JSON — is supported |

### Failure handling

The component never throws errors for a bad document: compilation and rendering run in `try/catch`
and behind an error boundary, so a failure reaches `onError` — the shared diagnostic, exactly as
on the web: **this instance will not play** — and shows `fallback` while the rest of the screen
keeps working. It is reported once, as an error; nothing else is logged for it.

```tsx
import { Text } from 'react-native';
import { PixodeskSvgAnimator } from '@pixodesk/svg-animator-rn';
import doc from './animation.json';

export function Safe() {
  return (
    <PixodeskSvgAnimator
      doc={doc}
      autoplay
      onError={d => console.warn('animation failed:', d.message)}
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

<!-- px-check off support matrix, prose -->
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

<!-- px-check off support matrix, prose -->
| Attribute | Supported | Notes |
|---|---|---|
| `opacity`, `fillOpacity`, `strokeOpacity` | ✅ | |
| `fill`, `stroke`, `stopColor` | ✅ | colors blend through RGBA |
| `strokeWidth`, `strokeDashoffset` | ✅ | |
| `strokeDasharray` | ⚠️ | animates; the native value bridge not yet checked on a device |
| `x`, `y`, `width`, `height`, `cx`, `cy`, `r`, `rx`, `ry` | ✅ | |
| `d` (path morphing) | ✅ | keyframes must share the same command structure |
| `transform` (an object holding all the parts: translate, rotate, scale, …) and per-key `translate` / `rotate` / `scale` | ✅ | |
| gradient stop `offset`, `stopColor` | ✅ | |
| `fontSize` and any other numeric attribute | ✅ | |
| filter primitive attributes | ⚠️ | compiles; on-device rendering not yet checked |

### Effects

<!-- px-check schema PxEffectsSchema -->
| Effect | Supported | Notes |
|---|---|---|
| `transformBy` | ✅ | |
| `repeater` | ✅ | |
| `maskedBy` | ✅ | |
| `clipPath` | ✅ | |
| `strokeTrim` | ✅ | incl. `offset` and `subPaths: 'combined'` |
| `clone` + `retime` | ✅ | incl. `timeCrop` |
| `fillGradient` / `strokeGradient` | ✅ | animated stops **and** geometry | <!-- px names=fillGradient,strokeGradient -->
| Animated `gradientTransform` | ❌ | not implemented in the shared core, so unavailable on every player; a static `gradientTransform` works | <!-- px skip -->
| `textPath` | ✅ | incl. animated `startOffset` |
| `text.useGlyphs` | ✅ | |

### Motion, timing, references

<!-- px-check off support matrix, prose -->
| Feature | Supported | Notes |
|---|---|---|
| Motion along a path, `autoOrient` | ✅ | positions worked out in advance by the core |
| Text along a path | ✅ | two ways: native `textPath`, or one motion path per letter. The example app uses the latter — animating native `startOffset` stutters in `react-native-svg` |
| Text on a *closed* path with a non-zero `startOffset` | ⚠️ | worked around, not fixed: `react-native-svg`'s own text-on-path layout crashes on this (iOS), so the player gives such text its own *open* copy of the path; text that would wrap past the end of the loop is cut off instead. The web player is unaffected |
| Per-property `loop`, incl. ping-pong | ✅ | |
| Cubic-bezier and named easings | ✅ | |
| `definitions.animations` / `easings` / `fonts` | ✅ | |
| `node.style` (inline record) | ✅ | |

### Playback and triggers

<!-- px-check off support matrix, prose -->
| Feature | Supported | Notes |
|---|---|---|
| `duration`, `delay`, `iterations` (incl. infinite) | ✅ | |
| All four `direction` values, all `fillMode` values, `trigger.finish` | ✅ | through `timeline` — see [Playback overrides](#playback-overrides) |
| play / pause / cancel / finish | ✅ | |
| Jumping to any time, also while playing | ✅ | |
| Playback rate: faster, slower, reverse | ✅ | |
| Triggers `load`, `programmatic`, `click`, `scrollIntoView` | ✅ | incl. `visibilityThreshold` and `mouseOut` |
| Trigger `mouseOver` | ❌ | no touch equivalent; will not be added |
| `timeline.frameRate`, `timeline.engine` | ❌ | see [Differences from the React package](#differences-from-the-react-package) |
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
[`examples/react-native-preview-player/metro.config.js`](../../examples/react-native-preview-player/metro.config.js).

## Example apps

Two Expo apps in the repository show the player running on a device. Each is one command from
the repository root:

```bash
pnpm example:rn            # preview player with several animations and controls
pnpm example:rn:web        # quickest look — runs via react-native-web
pnpm example:rn:explorer   # feature explorer
```

See [`examples/react-native-preview-player`](../../examples/react-native-preview-player).

[← Vue](./vue.md) · [Contents](../../README.md#documentation) · Next: [Playback settings & triggers →](./playback-and-triggers.md)
