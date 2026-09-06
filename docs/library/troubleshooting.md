# Troubleshooting & FAQ

[← Playback settings & triggers](./playback-and-triggers.md) · [Contents](./README.md)

Player-library troubleshooting — find your symptom below; each entry says what to check and
what to change. For pre-rendered SVG issues (a flavour that shows a static frame, `<script>`
stripped on import, two inlined copies interfering) see
[Pre-rendered SVG on the web](https://pixodesk.com/docs/svga/prerendered-svg/on-the-web); for what each engine can and
cannot animate per browser, see [Choosing a format](https://pixodesk.com/docs/svga/editor/choosing-a-format). If yours
is not here, go to [Still stuck?](#still-stuck) at the end.

## Nothing plays

**The trigger is not "on load".** Check `animator.timeline.trigger.startOn` in the file (or the *Start*
setting in the editor). `click` / `mouseOver` / `scrollIntoView` wait for the user;
`programmatic` waits for you to call `play()`. In React/Vue, remember that `autoplay` is the
only mode that uses the document's trigger — with `play`, `apiRef`, `time` etc. the trigger is
switched to programmatic.

**React / Vue component with no control prop.** With none of `autoplay` / `play` / `pause` /
`apiRef` / `progress` / `time` set, the component deliberately renders the first frame and does
nothing. Add `autoplay`.

**`loadTagAnimators()` ran before the elements existed.** Call it after the DOM is ready (end of
`<body>`, `DOMContentLoaded`), and call it again after inserting content dynamically — it only
creates animators for elements that do not have an animator yet.

**`createAnimator({ src })` — the file did not load.** Look in the console: the player logs
`createAnimator: failed to load "…"` or `invalid animation document format`. The JSON must have
`"type": "svg"` at the root. Calls made before the load finishes are queued, so `play()` is
not lost — a network or CORS error is the usual cause.

**Scroll trigger never fires.** The element may already be fully in view at load (then it
starts immediately), or `scrollIntoViewThreshold` may be higher than the element can ever
reach on a small viewport. Inside an `<iframe>`, visibility is measured relative to the iframe.

## React

**The animation restarts when the parent re-renders.** The animator is recreated only when the
`doc` *content* changes (the comparison is deep), so a re-created but identical object is fine.
Restarts usually come from a `doc` that really is different each render — for example built
inline with a changing value. Build the document once (module level or `useMemo`).

**Console: `setAttribute: No elements found for selector "#…"` on unmount.** Cosmetic — a
late frame after teardown. Safe to ignore.

**`onCancel` / `onRemove` / `onStop` fire when I pass a different `doc`.** Expected: a new
document means a new animator; the old one is thrown away and reports it on its way out.

**Next.js: "useRef is not a function" / hooks error.** The component must be used from a client
component — add `'use client'` at the top of the file that renders it.

## TypeScript

**`Type '…' is not assignable to type 'PxAnimatedSvgDocument'` when importing JSON.** Cast
once: `const doc = animation as PxAnimatedSvgDocument;` — JSON imports are typed structurally
and a string field such as `"mode": "auto"` widens to `string`. Enable `resolveJsonModule`.

## React Native

**`View config getter callback for component 'RNSVGLine' must be a function`.** Two copies of
`react-native-svg` (or reanimated / react) in your node_modules — see
[Monorepo setup](./react-native.md#monorepo-setup).

**Nothing renders, no error.** Pass `onError` — a document that fails to compile is reported
there and replaced by `fallback` (nothing by default).

**The app crashes on text along a closed path.** A native `react-native-svg` bug the player
works around on device; if you hit it, keep `startOffset` at 0 on closed paths or use an open
path. Details in [React Native → Feature support](./react-native.md#motion-timing-references).

**Hover does nothing.** `mouseOver` has no touch equivalent; use `click` or drive `play`
yourself.

## Playback behaviour

**It holds the last frame — I want it to reset.** Set `timeline.trigger.onFinish: "reset"`
in the file (as a component prop it is `resetOnFinish: true`), or `fill: 'none'` (see
[Playback settings](./playback-and-triggers.md#timing)).

**How do I play backwards?** `animator.setPlaybackRate(-1); animator.play();` — also as a
trigger out action (`outAction: 'reverse'`).

**Jumping to a time while playing.** `setCurrentTime(ms)` works while playing (the animation
continues from the new point) and while paused (it shows that frame and stays there).

**Frame rate.** `frameRate` applies only to the frames engine; WAAPI runs at the display rate.
React Native always runs at the display rate.

**A property does not animate under `mode: 'waapi'`.** WAAPI cannot drive it (the console
says which); leave `mode` on `auto` so the document switches to the frame loop.

## Still stuck?

- [Repository issues](https://github.com/pixodesk/pixodesk-svg-animator/issues) — include the
  JSON (or the SVG), the package version and the browser / platform.
- The [runnable examples](../../examples/docs-examples/) show every documented case working end to end — one page per case, each tested on every build.

[← Playback settings & triggers](./playback-and-triggers.md) · [Contents](./README.md)
