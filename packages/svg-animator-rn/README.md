# animator-rn

> 📖 Full user guide: [docs/library/react-native.md](../../docs/library/react-native.md) · [all docs](../../README.md#documentation)

[![CI](https://github.com/pixodesk/pixodesk-svg-animator/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/pixodesk/pixodesk-svg-animator/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

React Native component for rendering and controlling Pixodesk SVG animations,
built on `react-native-svg` and `react-native-reanimated`. Props mirror
[`@pixodesk/svg-animator-react`](../svg-animator-react/README.md).

# 🧪 **Status — EXPERIMENTAL**

- API may change without a major version bump.
- A few things are unimplemented or unverified — see [Feature support](#feature-support).

## What it does

`<SvgAnimationPlayer document={…} />` takes an animation document exported from the
Pixodesk editor — the **same `.json` the web player uses** — and renders it as
native SVG, driven on the UI thread.

- **One prop to render:** put the `.json` next to your component, import it, pass
  it as `document`.
- **Playback control:** declarative props (`playerActionTriggers`, `playback`, `showAtTime`) or an
  imperative ref (`playback.play()`, `playback.pause()`, `playback.stop()`, `playback.setCurrentTime()`, …).
- **No size of its own:** it fills whatever `View` you put it in — give that `View` a `width` and `height`.

## Quick start

Drop `animation.json` next to your component and render it:

```tsx
import { View } from 'react-native';
import { SvgAnimationPlayer } from '@pixodesk/svg-animator-rn';
import animation from './animation.json';

export function Logo() {
    return (
        <View style={{ width: 200, height: 200 }}>
            <SvgAnimationPlayer document={animation} playerActionTriggers />
        </View>
    );
}
```

That's the whole common case: an animation that plays on mount and loops if the
document says so.

### Typical cases

```tsx
// Play once when a screen opens, then hold the last frame (one pass; `whenFinished: 'hold'` is the default)
<SvgAnimationPlayer document={animation} playerActionTriggers timelineOptions={{ iterations: 1 }} />

// Loop forever regardless of what the document says
<SvgAnimationPlayer document={animation} playerActionTriggers timelineOptions={{ iterations: 'infinite' }} />

// Static — first frame only, no playback
<SvgAnimationPlayer document={animation} />

// Toggle from your own state — the `playback` lever: 'off' · 'on' · 'paused'
<SvgAnimationPlayer document={animation} playback={isPlaying ? 'on' : 'off'} />

// Tie the position to a gesture / slider (no playback, just a frame)
<SvgAnimationPlayer document={animation} showAtProgress={scrollProgress} />

// Override the document's timing (window end in ms, delay before start)
<SvgAnimationPlayer document={animation} playerActionTriggers timelineOptions={{ outTime: 4000, delay: 500 }} />

// Do something when it finishes
<SvgAnimationPlayer document={animation} playerActionTriggers onPlaybackFinish={() => setDone(true)} />
```

TypeScript: `document` accepts `import animation from './animation.json'` as-is (it is typed
`PxDocumentJson` — the shape a JSON import produces); enable `"resolveJsonModule"` in
`tsconfig.json`.

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

Four ways to drive playback. Pick one — they are mutually exclusive; `playerRef` is filled in
every one of them.

### Player action triggers

Uses the triggers defined in the animation document (`'playback.start': 'load'` plays once enough of it is
on screen; `click` is a tap; `hoverIn` / `hoverOut` never fire — there is no hover on a touch
screen), or the triggers object you pass instead of `true`:

```tsx
<SvgAnimationPlayer document={animation} playerActionTriggers />
<SvgAnimationPlayer document={animation} playerActionTriggers={{ 'playback.play': 'click', 'playback.pause': 'click' }} />   {/* tap plays, tap again pauses */}
<SvgAnimationPlayer document={animation} playerActionTriggers={{ 'playback.start': 'click', 'playback.stop': 'click' }} />  {/* tap plays, tap again stops */}
```

### Declarative playback — `playback`

Control playback with one lever — `playback` holds a position, `'off'` (no playback) · `'on'` (a playback) ·
`'paused'` (the playback, frozen); a change of position presses one built-in button (`playback.start` · `playback.pause` ·
`playback.resume` · `playback.stop`), and how a stop looks is the file's `timeline.actions`, adjusted
through the `actions` prop:

```tsx
const [playing, setPlaying] = useState(false);
const [paused, setPaused] = useState(false);

<SvgAnimationPlayer document={animation} playback={paused ? 'paused' : playing ? 'on' : 'off'} />
<Button title={playing ? 'Playback (on)' : 'Playback (off)'} onPress={() => setPlaying(p => !p)} />
<Button title={paused ? 'Frozen' : 'Freeze'} onPress={() => setPaused(p => !p)} />
```

### Imperative API

Use a ref for full programmatic control:

```tsx
import { useRef } from 'react';
import type { PxAnimationPlayerHandle } from '@pixodesk/svg-animator-rn';

const playerRef = useRef<PxAnimationPlayerHandle>(null);

<SvgAnimationPlayer document={animation} playerRef={playerRef} />
<Button title="Play"    onPress={() => playerRef.current?.playback.play()} />
<Button title="Pause"   onPress={() => playerRef.current?.playback.pause()} />
<Button title="Stop"    onPress={() => playerRef.current?.playback.stop()} />
<Button title="Restart" onPress={() => playerRef.current?.playback.start()} />
```

`PxAnimationPlayerHandle` is `{ playback }` — the same `PxPlaybackControls` as the web player: the five buttons
`playback.start()` (always from the start, in every state), `playback.play()` (start, or carry on — a paused
playback resumes, a picture on its way back turns around, nothing while playing), `playback.stop()` (the configured
stop, `actions["playback.stop"]` — `animateToEnd` stops after the current pass), `playback.pause()`,
`playback.resume()`; the state `playback.getState()` (off · playing · paused · finished · returning · destroyed),
`playback.isActive()`, `playback.isPlaying()`; one iteration — `playback.getDuration()`, `playback.getCurrentTime()` /
`playback.setCurrentTime(ms)` (the frame inside the current iteration), `playback.getCurrentProgress()` /
`playback.setCurrentProgress(p)` (counted in iterations — `1.2` is 20 % into the second), `playback.getCurrentIteration()`; the whole playback — `playback.getTotalDuration()`
(`null` when infinite), `playback.getTotalTime()` / `playback.setTotalTime(ms)`, `playback.getTotalProgress()`; the
speed — `playback.getSpeed()` / `playback.setSpeed(speed)` and the same values at it, `playback.getDurationAtSpeed()` /
`playback.setDurationAtSpeed(ms)`, `playback.getTotalDurationAtSpeed()`, `playback.getCurrentTimeAtSpeed()`,
`playback.getTotalTimeAtSpeed()`. A seek while playing keeps playing; in any other state the playback becomes
`paused` at that frame. One spelling per act (until 1.25 the methods sat flat on the handle, and `playOnce()`,
`jumpToStart()` and `jumpToEnd()` existed — a one-iteration timeline and `start()`, `stop()` and
`setCurrentProgress()` say the same). The same contract as the web players
([Two clocks](../../docs/library/playback-and-triggers.md#two-clocks)).

### Controlled time

Move through the animation with a slider, or show one fixed frame:

```tsx
const [time, setTime] = useState(0);

<SvgAnimationPlayer document={animation} showAtTime={time} />
<Slider minimumValue={0} maximumValue={2000} value={time} onValueChange={setTime} />
```

## Props

<!-- px-check props SvgAnimationPlayerProps pkg=rn -->
| Prop | Type | Description |
|---|---|---|
| `document` | `PxDocumentJson` | The animation document to render (required); a `.json` import passes as-is (inline only, no URL form yet) |
| `playerActionTriggers` | `boolean \| PxActionTriggersInput` | `true`: play on the document's own triggers; an object: these triggers instead — `{ "playback.start", "playback.play", "playback.stop", "playback.pause", "playback.resume" }`, each one event or a list of the events that list may name (`'load' \| 'hoverIn' \| 'hoverOut' \| 'click'`; `playback.resume` is derived when left out). `click` is a tap; `hoverIn` / `hoverOut` never fire. See [Triggers](../../docs/library/playback-and-triggers.md#triggers--when-it-plays) |
| `playback` | `'off' \| 'on' \| 'paused'` | A lever (`PxPlayback`): its position is held, and a change presses one button — `off` → `on` `playback.start()`, `on` → `paused` `playback.pause()`, `paused` → `on` `playback.resume()`, → `off` `playback.stop()`. How a stop looks is the file's `actions` (and the `actions` prop) — see [Actions](../../docs/library/playback-and-triggers.md#actions--how-a-stop-looks); `'on'` always plays from the start. A mount with `'off'` presses nothing; with `'paused'` starts the playback frozen |
| `playerRef` | `RefObject<PxAnimationPlayerHandle \| null>` | Ref for imperative control; filled in every mode |
| `showAtProgress` | `number` | show the frame at this position, counted in iterations: `0` is the first frame, `0.5` the middle of the first iteration, `1` its last frame, `1.2` 20 % into the second |
| `showAtTime` | `number` | show the frame at that time, in milliseconds inside one iteration (`0` to `playback.getDuration()`) |
| `timelineOptions` | `PxTimelineOptions` | per-instance override of the document's `timeline` block, minus its `actionTriggers` and `actions`, deep-merged over it — same shape as the file; a key left out keeps the file's value. `engine` and `frameRate` are ignored here. See [Overriding from a player](../../docs/library/playback-and-triggers.md#overriding-from-a-player) |
| `actions` | `PxActionsOptions` | per-instance override of how a stop looks — `{ 'playback.stop': 'animateToStart' }` — and of `outOfView`, deep-merged over the document's `timeline.actions` (what shows once finished, `whenFinished`, is a timeline key: `timelineOptions`). See [Overriding from a player](../../docs/library/playback-and-triggers.md#overriding-from-a-player) |
| `onReady` | `() => void` | The player exists and the tree is rendered — once, async |
| `onPlaybackStart` | `() => void` | A playback began — `playback.start()`, `playback.play()` from rest, a `playback.start` / `playback.play` trigger, `playback` to `'on'` / `'paused'` from `'off'`, the visibility gate starting it again |
| `onPlaybackResume` | `() => void` | The playback carried on after a freeze — `playback.resume()`, `playback.play()`, a `playback.resume` trigger, `playback` back to `'on'`, the visibility gate when it is seen again |
| `onPlaybackPause` | `() => void` | The playback was frozen — `playback.pause()`, a `playback.pause` trigger, `playback` `'paused'`, or the visibility gate's `pause` when it left the screen |
| `onPlaybackFinish` | `() => void` | The last pass ended by playing — the state is `finished`, whatever `whenFinished` then shows. Never for a stop that goes to the end (that is `onPlaybackStop`), never for a loop without end |
| `onDestroy` | `() => void` | Called when the player is thrown away — the component unmounted, or a new `document` replaced it |
| `onPlaybackStop` | `() => void` | The playback was stopped — a `playback.stop` trigger, `playback` `'off'`, `playback.stop()` or the visibility gate's `stop`; at once, or on arrival for the stops that finish the pass first. A pause, the end and a destroy each fire their own; a seek reports nothing |
| `onError` | `(diagnostic) => void` | this instance will not play — the document could not be compiled or rendered; `fallback` shows instead. `diagnostic.error` is the Error, `diagnostic.detail.componentStack` when the error boundary caught it |
| `onWarning` | `(diagnostic) => void` | it plays, but something was ignored, degraded or misspelled; without it → `console.warn` |
| `suppressWarnings` | `boolean` | switch the `console.warn` fallback off — for when you know the player has something to say about this document and are prepared to tolerate it. `onWarning`, if you gave it, still fires: this is about the console, not about you |
| `suppressErrors` | `boolean` | the same switch for `console.error` |
| `fallback` | `(error) => ReactElement \| null` | Rendered in place of a failed animation (default: nothing) |

With none of `playerActionTriggers` / `playback` / `showAtProgress` / `showAtTime` set, the component
renders the animation statically (initial state, no playback). TypeScript accepts one driver family at a time
(`PxControlProps` is a union).

### Failure handling

The component never throws for a bad document. Compilation and rendering both
run inside `try`/`catch`, and the rendered tree sits behind an error boundary,
so a failure is reported through `onError` — the shared diagnostic (`diagnostic.error` is the
Error), exactly as on the web — and shows `fallback` while the surrounding screen keeps working.

```tsx
<SvgAnimationPlayer
    document={animation}
    playerActionTriggers
    onError={d => console.warn('animation failed:', d.message)}
    fallback={() => <Text>could not play this animation</Text>}
/>
```

This covers JavaScript errors. A crash inside react-native-svg's **native**
renderer never reaches JavaScript and cannot be caught — see
[Known limitations](#known-limitations).

### Differences from the React package

<!-- px-check off differences from React, prose -->
| Prop | Why it differs |
|---|---|
| `timeline.engine` | Accepted inside `timeline` but ignored. There is no Web Animations API on React Native; playback is always native-driven. |
| `timeline.frameRate` | Ignored. The screen's own refresh rate is used. The player does not compute values frame by frame: when the document loads it works out the animated values in advance, as a list of snapshots (60 per second of animation), and each screen refresh shows the nearest one. The closest thing to a frame rate is how many snapshots per second are prepared, which the player fixes at 60. |
| `hoverIn` / `hoverOut` | Have no touch equivalent, so they never fire. `load` and `click` (a tap) work as they do on the web, from the file or from `playerActionTriggers`. |
| `className` / `style` | Not accepted — you cannot style the component itself. It fills whatever `View` you put it in, so to set its size, give that `View` a `width` and `height`. Styling *inside* the document (`style` on an element in the JSON) is supported. |
| `onDestroy` | Never called. On the web it tells you the player was thrown away; here there is nothing to tell — when the component leaves the screen, React removes it and everything it created. To run code at that moment, use a `useEffect` cleanup function in your own component. |

## How playback works

There is **no JavaScript frame loop** — the JS thread is idle while an
animation runs.

1. **Once per document:** the shared core flattens it
   (`materializeAllInTree` → effects, loops, motion-path sampling, animated
   `<use>` inlining), then a track compiler densely samples every animated
   property with `calcAnimationValues` — the same function the web frame-loop engine
   renders with, so values match the web player exactly.
2. **Per frame:** one reanimated progress value, driven by
   `withTiming`/`withRepeat` on the UI thread, and a tiny worklet per animated
   element that indexes its precompiled track.

This is why sampling appears so often below: where `react-native-svg` cannot
express something directly (motion along a path, text on a path), the core
converts it into plain values ahead of time instead of fighting the platform.

## Feature support

Every row below was verified by running the document through the real
pipeline (`materializeAllInTree` → track compilation) and checking that the
element maps to a `react-native-svg` component and that its animated
properties actually change over time.

### Elements

<!-- px-check off support matrix, prose -->
| Element | Renders | Notes |
|---|---|---|
| `svg`, `g`, `defs` | ✅ | |
| `rect`, `circle`, `ellipse`, `line`, `path`, `polygon`, `polyline` | ✅ | |
| `text`, `tspan` | ✅ | content via `textContent` |
| `textPath` | ✅ | see *Text along a path* below |
| `image` | ✅ | `href` accepts `data:` URIs; remote URLs are blocked by the sanitizer |
| `use`, `symbol` | ✅ | animated targets are **inlined into real clones** before render — `<use>` does not propagate animation natively in React Native |
| `linearGradient`, `radialGradient`, `stop` | ✅ | |
| `pattern`, `marker` | ✅ | static geometry verified; complex cases unverified on device |
| `mask`, `clipPath` | ✅ | |
| `filter` + all 22 `fe*` primitives | ✅ | `feGaussianBlur`, `feDropShadow`, `feColorMatrix`, `feMerge`, `feComponentTransfer` + `feFunc*`, … **The visual result has not yet been checked on a real device** |
| `foreignObject` | ❌ | blocked by the shared sanitizer (embeds arbitrary host content) |
| `script` | ❌ | blocked by the shared sanitizer |

### Animatable attributes

<!-- px-check off support matrix, prose -->
| Attribute | Animates | Notes |
|---|---|---|
| `opacity`, `fillOpacity`, `strokeOpacity` | ✅ | |
| `fill`, `stroke`, `stopColor` | ✅ | interpolated as RGBA |
| `strokeWidth`, `strokeDasharray`, `strokeDashoffset` | ✅ | dash arrays are converted to the numeric form React Native expects |
| `x`, `y`, `width`, `height`, `cx`, `cy`, `r`, `rx`, `ry` | ✅ | |
| `d` (**path morphing**) | ✅ | keyframes must share command structure |
| `transform` (unified parts record) | ✅ | `translate`, `rotate`, `skew`, `scale`, `origin` |
| `translate` / `rotate` / `scale` (legacy per-key form) | ✅ | |
| `offset` and `stopColor` on gradient stops | ✅ | |
| filter primitive attrs (e.g. `stdDeviation`) | ✅ | compiles correctly; on-device rendering unverified |
| `fontSize` | ✅ | |
| Any other numeric SVG attribute | ✅ | interpolated numerically and written straight through |

### Effects (`node.effects`)

All effects are materialized by the shared core before rendering, so the React Native
player sees plain nodes. **All are supported:**

<!-- px-check schema PxEffectsSchema -->
| Effect | Status | Notes |
|---|---|---|
| `transformBy` | ✅ | all parts animatable, including `skew` |
| `repeater` | ✅ | copies materialized as real elements; per-copy params animatable |
| `maskedBy` | ✅ | including an animated mask source |
| `clipPath` | ✅ | including animated clip geometry |
| `strokeTrim` | ✅ | incl. `offset` and `subPaths: 'combined'` |
| `clone` + `retime` | ✅ | each clone keeps its own time shift, incl. the `retime.inTime` / `outTime` window (visibility on the document timeline) |
| `fillGradient` / `strokeGradient` | ✅ | animated stops **and animated geometry** (`animate.gradientX1`/`Cx`/`R`, …); `gradientTransform` is static (core-wide) | <!-- px names=fillGradient,strokeGradient -->
| `textPath` | ✅ | incl. animated `startOffset` |
| `text.useGlyphs` | ✅ | text becomes `<path>` outlines from `definitions.fonts` — no font needed |

### Motion, timing and references

<!-- px-check off support matrix, prose -->
| Feature | Status | Notes |
|---|---|---|
| **Motion along a path** + `autoOrient` | ✅ | **sampled** by the core into plain transform keyframes — `react-native-svg` has no native path motion |
| **Text along a path** | ✅ two ways | native `textPath` (incl. animated `startOffset`), or **per-letter motion paths** for smooth results — the example app uses the latter, since animating native `startOffset` is janky in `react-native-svg` |
| Per-property `loop` (incl. `alternate` pingpong) | ✅ | expanded before playback |
| Easing (cubic-bezier and named refs) | ✅ | baked into the sampled tracks |
| `definitions.animations` / `easings` / `fonts` | ✅ | named refs resolved |
| `node.style` (inline record) | ✅ | applied as props — React Native has no CSS, so explicit attributes win |

### Playback and triggers

<!-- px-check off support matrix, prose -->
| Feature | Status | Notes |
|---|---|---|
| `inTime` / `outTime` / `playbackSpeed`, `delay`, `iterations` (incl. `'infinite'`) | ✅ | |
| `iterationDirection` — all four values | ✅ | |
| `actions` — the stop behaviors, `whenFinished` | ✅ | `animateToStart` plays back natively; the run clock behind `playback.getTotalTime()` / `playback.getCurrentTime()` is approximate while it plays back |
| `playback.start` / `playback.play` / `playback.stop` / `playback.pause` / `playback.resume` | ✅ | |
| `setCurrentTime` — jump to a time, including **while playing** | ✅ | playback continues from the new point; in any other state it holds that frame, paused |
| `playback.setSpeed` — faster, slower and **reverse** (negative) | ✅ | multiplies with `iterationDirection`; `timeline.playbackSpeed` is the initial value |
| Trigger event `load` | ✅ | |
| Trigger event `click` | ✅ | a tap — the animation is wrapped in a `Pressable`; listed in `playback.pause` too, a second tap pauses |
| The gate — `actions.outOfView`, `inViewThreshold`, `inViewDebounce` | ✅ | visibility sampled by measuring against the window (React Native has no `IntersectionObserver`) |
| Trigger events `hoverIn` / `hoverOut` | ❌ | no touch equivalent — use `click`, or drive `playback` yourself |
| `timeline.frameRate` | n/a | reanimated runs at the display refresh rate; the player prepares 60 snapshots per second of animation |
| `timeline.engine` (`auto` / `native` / `js`) | n/a | there is no Web Animations API on React Native — playback is always native-driven |

### Known limitations

- **On-device verification is incomplete.** The pipeline, prop mapping and
  driving logic are covered by unit tests and were exercised end-to-end
  through `react-native-web`; the native reanimated ↔ `react-native-svg` prop
  bridge (notably filters and `strokeDasharray`) still needs checking on real
  iOS/Android.
- **animated `gradientTransform`** is unimplemented
  in the core, so they are unavailable here too.
- **`hoverIn` / `hoverOut`** have no touch analogue and will not be implemented.
- **Text on a closed path is worked around, not fixed.** react-native-svg's
  native text-on-path layout crashes the app (an `NSRangeException` on iOS) when
  a `<textPath>` has a non-zero `startOffset` on a *closed* path: it bounds
  glyph placement by `startOffset … startOffset + pathLength` instead of
  `0 … pathLength`, so glyphs past the end of the path reach a lookup that
  returns `NSNotFound`. On native the player gives such a `<textPath>` its own
  open copy of the path, which restores the
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

## Example app

A full preview player with six animations and transport controls:

```bash
pnpm example:rn          # or: cd examples/react-native-preview-player && npx expo start
```

See [`examples/react-native-preview-player`](../../examples/react-native-preview-player).

## License

[MIT](../../LICENSE) © [Pixodesk](https://pixodesk.com)
