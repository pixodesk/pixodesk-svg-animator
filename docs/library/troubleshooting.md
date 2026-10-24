# Troubleshooting & FAQ

[← Minification](./minification.md) · [Contents](../../README.md#documentation) · Next: [Pre-rendered SVG on the web →](https://pixodesk.com/docs/svga/prerendered-svg/on-the-web)


Player-library troubleshooting — find your symptom below; each entry says what to check and
what to change. For pre-rendered SVG issues (a flavor that shows a static frame, `<script>`
stripped on import, the same file inlined twice on one page) see
[Pre-rendered SVG on the web](https://pixodesk.com/docs/svga/prerendered-svg/on-the-web); for what each engine can and
cannot animate per browser, see [Choosing a format](https://pixodesk.com/docs/svga/editor/choosing-a-format). If yours
is not here, go to [Still stuck?](#still-stuck) at the end.

## Nothing plays

**The trigger is not "on load".** Check `animator.timeline.trigger.start` in the file (or the *Start*
setting in the editor). `click` and `hover` wait for the user; `manual` waits for you to call
`play()`. Even `load` waits until enough of the animation is on screen, and pauses while it is
scrolled out of view (`outOfView: 'pause'`, the default). In React/Vue/React Native, remember that
`playOnTrigger` is the only mode that uses the document's trigger — with `play`, `pause`, `progress`
or `time` the trigger is ignored. Passing `apiRef` does **not** change the mode.

**React / Vue component with no control prop.** With none of `playOnTrigger` / `play` / `pause` /
`progress` / `time` set, the component deliberately renders the first frame and does
nothing. Add `playOnTrigger`. `apiRef` on its own is such a case: the ref is a handle, not an
instruction, so nothing moves until you call `play()` on it.

**`createSvgAnimationPlayersFromPage()` ran before the elements existed.** Call it after the DOM is ready (end of
`<body>`, `DOMContentLoaded`), and call it again after inserting content dynamically — it only
creates players for elements that do not have a player yet.

**`createSvgAnimationPlayer({ src })` — the file did not load.** Look in the console: the player logs
`PX1003` when the request failed — a network or CORS error is the usual cause — or `PX1002` when the
file loaded but is not an animation document: the JSON must have `"type": "svg"` at the root (both on
[the codes page](../diagnostics.md#building-a-player)). Calls made before the load finishes are
queued, so `play()` is not lost.

**Scroll trigger never fires.** The element may already be fully in view at load (then it
starts immediately), or `inViewThreshold` may be higher than the element can ever
reach on a small viewport. Inside an `<iframe>`, visibility is measured relative to the iframe.

## React

**The animation restarts when the parent re-renders.** The player is recreated only when the
`doc` *content* changes (the comparison is deep — Vue and React Native compare the same way), so a
re-created but identical object is fine.
Restarts usually come from a `doc` that really is different each render — for example built
inline with a changing value. Build the document once (module level or `useMemo`).

**Console: `setAttribute: No elements found for selector "#…"` on unmount.** Cosmetic — a
late frame after teardown. Safe to ignore.

**`onCancel` / `onDestroy` / `onStop` fire when I pass a different `doc`.** Expected: a new
document means a new player; the old one is thrown away and reports it on its way out.

**Next.js: "useRef is not a function" / hooks error.** The component must be used from a client
component — add `'use client'` at the top of the file that renders it.

## TypeScript

**A JSON import is flagged on `doc`.** It shouldn't be: `doc` is typed `PxDocumentInput`,
which is exactly the shape a JSON import produces — so first enable `"resolveJsonModule"` in
`tsconfig.json` and update the player packages. Only `PxDocument` (the strict type,
for documents built in code) rejects a JSON import's widened strings.

## React Native

**`View config getter callback for component 'RNSVGLine' must be a function`.** Two copies of
`react-native-svg` (or reanimated / react) in your node_modules — see
[Monorepo setup](./react-native.md#monorepo-setup).

**Nothing renders, no error.** Pass `onError` — a document that fails to compile is reported
there and replaced by `fallback` (nothing by default).

**The app crashes on text along a closed path.** A native `react-native-svg` bug the player
works around on device; if you hit it, keep `startOffset` at 0 on closed paths or use an open
path. Details in [React Native → Feature support](./react-native.md#motion-timing-references).

**Hover does nothing.** `hover` has no touch equivalent; use `click` or drive `play`
yourself.

## Playback behavior

**It holds the last frame — I want it to reset.** Set `timeline.finish: "reset"` — the
animation CANCELS at its natural end and snaps back to the start state. Its sibling
`timeline.fillMode` answers a different question: what shows AT REST around a run —
`fillMode: 'none'` also ends on the static SVG, but only because nothing is held; during a
`delay` it shows the raw attributes too, and it never actively resets. Rule of thumb:
want a snap-back at the end → `finish: 'reset'`; want the end pose held → leave `finish`
alone and let `fillMode` (default `forwards`) hold it
(see [Playback settings](./playback-and-triggers.md#timing)).
For one mount only, pass the same thing as an override: `timeline={{ finish: 'reset' }}`.

**How do I play backwards?** `player.setPlaybackRate(-1); player.play();` — also as a
trigger out action (`hoverEnd: 'reverse'`).

**Jumping to a time while playing.** `setCurrentTime(ms)` works while playing (the animation
continues from the new point) and while paused (it shows that frame and stays there).

**Frame rate.** `timeline.frameRate` applies only to the player's own frame loop (`engine: 'js'`,
or `'auto'` after falling back to it); WAAPI runs at the display rate.
React Native always runs at the display rate.

**A property does not animate under `timeline.engine: 'native'`.** WAAPI cannot drive it (the
console says which); leave `engine` on `auto` so the document switches to the player's frame loop.

**The animation loads but nothing moves, and only in the production build.** Your bundler may be
property-mangling third-party code, which renames the keys the player reads out of the document.
See [Minification & property mangling](./minification.md); `validateDocument(doc)` will report the
unrecognized keys.

## Still stuck?

- [Repository issues](https://github.com/pixodesk/pixodesk-svg-animator/issues) — include the
  JSON (or the SVG), the package version and the browser / platform.
- The [runnable examples](../../examples/docs-examples/) show every documented case working end to end — one page per case, each tested on every build.


[← Minification](./minification.md) · [Contents](../../README.md#documentation) · Next: [Pre-rendered SVG on the web →](https://pixodesk.com/docs/svga/prerendered-svg/on-the-web)
