# React Native Preview Player

Expo app that plays Pixodesk animator documents with
[`@pixodesk/svg-animator-rn`](../../packages/svg-animator-rn). It mirrors the
web [preview player](../preview-player) — same transport, timeline, loop and
rate controls — but instead of drag-and-drop it ships a set of embedded
examples you pick from the top row.

## Run

From the repo root:

```bash
pnpm install
pnpm example:rn              # then press i (iOS), a (Android), or scan the QR
pnpm example:rn:web          # quickest look — runs via react-native-web
pnpm example:rn:ios          # straight to the iOS simulator
pnpm example:rn:android      # straight to the Android emulator
```

Or from this directory: `npx expo start` (plus `--web`, `--ios`, `--android`).

Note: this is a pnpm monorepo, so Metro's server root is the **workspace** root.
The simulator and Expo Go pick the right bundle URL up from the manifest
automatically; it only matters if you request a bundle by hand, where the path
is `/examples/react-native-preview-player/index.bundle`, not `/index.bundle`.

## Examples

| Example | Demonstrates |
|---|---|
| **Bouncing ball** | eased keyframes, squash & stretch (`rx`/`ry`), colour interpolation |
| **Text along path** | per-letter motion path with `autoOrient`, **sampled** by the core — the technique that replaces `<textPath startOffset>` animation, which is unusably janky in react-native-svg |
| **Trim path** | the `trimPath` effect → animated `strokeDasharray` draw-on |
| **Repeater** | the `repeater` effect (6 materialised copies) + a nested transform stack |
| **Gradient** | the `fillGradient` effect with animated colour stops |
| **Path morph** | `d` interpolation between two shapes |

Every document is the **same wire format the web player and the editor export**
— see [`src/samples.ts`](src/samples.ts). Nothing is RN-specific about them.

## Controls

- **Transport** — Play, Pause, Stop (reset), Restart, Finish
- **Timeline** — scrub to any time; scrubbing pauses playback first
- **Loop** — `Auto` (whatever the document says), `Loop`, `No loop`
- **Rate** — 0.25× … 4× (negative rates play in reverse)
- **Theme** — light/dark, following the system scheme by default

## How playback works

There is **no JavaScript frame loop**. On load the document goes through the
shared core pipeline (`materialiseAllInTree` → effects, loops, motion-path
sampling, animated-`<use>` inlining) and is then compiled into densely sampled
per-element tracks. Playback is a single reanimated progress value driven by
`withTiming`/`withRepeat` on the UI thread; each animated element reads its
track in a small `useAnimatedProps` worklet. The JS thread stays idle while the
animation runs.

The sampling step uses the *same* `calcAnimationValues` the web frames engine
renders with, so values match the web player exactly.

## Notes

- `react-native-web` + `react-dom` are dev dependencies purely so
  `expo start --web` works; the player itself does not need them.
- The seek bar is built with `PanResponder` rather than
  `@react-native-community/slider` to keep the example free of extra native
  dependencies.
