# Troubleshooting & FAQ

[← Minification](./minification.md) · [Contents](../../README.md#documentation) · Next: [Pre-rendered SVG on the web →](https://pixodesk.com/docs/svga/prerendered-svg/on-the-web)


Player-library troubleshooting — find your symptom below; each entry says what to check and
what to change. For pre-rendered SVG issues (a flavor that shows a static frame, `<script>`
stripped on import, the same file inlined twice on one page) see
[Pre-rendered SVG on the web](https://pixodesk.com/docs/svga/prerendered-svg/on-the-web); for what each engine can and
cannot animate per browser, see [Choosing a format](https://pixodesk.com/docs/svga/editor/choosing-a-format). If yours
is not here, go to [Still stuck?](#still-stuck) at the end.

## Nothing plays

**The triggers do not list `load`.** Check `animator.timeline.actionTriggers["playback.start"]` in the file (or *Play
on* in the editor). `click`, `hoverIn` and `hoverOut` wait for the user; an absent or empty block (`{}`)
waits for you to call `playback.start()` — since schema 1.17 a file that plays by itself says `'playback.start': 'load'`,
an absent block no longer means load (stamped files were migrated; a hand-written file without a
version stamp has to say it). Even `load` waits until enough of the animation is on screen, and pauses
while it is scrolled out of view (`actions.outOfView.behavior: 'pause'`, the default) — see
[Triggers](./playback-and-triggers.md#triggers--when-it-plays). In React/Vue/React Native, remember
that `playUsingActionTriggers` is the only mode that uses the document's triggers — with `playback`,
`showAtProgress` or `showAtTime` the triggers are ignored. Passing `playerRef` does **not**
change the mode.

**React / Vue component with no control prop.** With none of `playUsingActionTriggers` / `playback` /
`showAtProgress` / `showAtTime` set, the component deliberately renders the
first frame and does nothing. Add `playUsingActionTriggers`. `playerRef` on its own is such a case: the ref is a handle, not an
instruction, so nothing moves until you call `playback.start()` on it.

**`createSvgAnimationPlayersFromPage()` ran before the elements existed.** Call it after the DOM is ready (end of
`<body>`, `DOMContentLoaded`), and call it again after inserting content dynamically — it only
creates players for elements that do not have a player yet.

**`createSvgAnimationPlayer({ src })` — the file did not load.** Look in the console: the player logs
`PX1003` when the request failed — a network or CORS error is the usual cause — or `PX1002` when the
file loaded but is not an animation document: the JSON must have `"type": "svg"` at the root (both on
[the codes page](../diagnostics.md#building-a-player)). Calls made before the load finishes are
queued, so `playback.start()` is not lost.

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

**`onDestroy` fires when I pass a different `doc`.** Expected: a new
document means a new player; the old one is thrown away and reports it on its way out.

**Next.js: "useRef is not a function" / hooks error.** The component must be used from a client
component — add `'use client'` at the top of the file that renders it.

## TypeScript

**`player.startPlayback()` / `player.play()` / `player.getCurrentTime()` is not a function.** Since 1.25 everything a page
does to the animation sits on ONE object, `player.playback` (`PxPlaybackControls`) — on the web player and on every
component's `playerRef`: `startPlayback()` → `playback.start()`, `stopPlayback()` → `playback.stop()`, `pausePlayback()`
→ `playback.pause()`, `resumePlayback()` → `playback.resume()`, `playOnce()` → `playback.playOnce()`,
`getPlaybackState()` → `playback.getState()`, `isPlaybackActive()` → `playback.isActive()`, `isPlaying()` →
`playback.isPlaying()`, `jumpToStart()` / `jumpToEnd()` → `playback.jumpToStart()` / `playback.jumpToEnd()`; the
content-time reads and seeks keep their names under `playback.` (`playback.getDuration()`, `playback.getCurrentTime()`,
`playback.setTotalTime(ms)` …); the speed is `playback.getSpeed()` / `playback.setSpeed(s)`, and the speed-adjusted
reads say so: `getPlaybackDuration()` → `playback.getDurationAtSpeed()`, `setPlaybackDuration(ms)` →
`playback.setDurationAtSpeed(ms)`, `getTotalPlaybackDuration()` → `playback.getTotalDurationAtSpeed()`,
`getCurrentPlaybackTime()` → `playback.getCurrentTimeAtSpeed()`, `getTotalPlaybackTime()` → `playback.getTotalTimeAtSpeed()`.
The `play()` / `pause()` aliases are gone — `playback.start()` also unfreezes a paused playback (`continue`), and
`playback.pause()` freezes. The player keeps only `isReady()`, `getRootElement()` and `destroy()`.

**`'startPlayback'` / `'startRun'` / `'start'` is not a key of `actionTriggers`.** Since 1.25 the built-in action names
are dotted — `"playback.start"`, `"playback.stop"`, `"playback.pause"`, `"playback.resume"` — in `actionTriggers` and in
`actions` (`"actionTriggers": { "playback.start": "load" }`, `actions={{ 'playback.stop': 'animateToStart' }}`); a dot
marks a built-in action, so from JavaScript the keys need quotes. Stamped files are migrated on read (`start` until
1.23, `startRun` in 1.24).

**`play` / `pause` / `playState` is not a prop; `stop()` / `getPlayState()` is not a function; `onPlay` / `onStop`
never fires; `actions.finish` is dropped; `playRun` / `onRunStart` are gone.** Renamed in 1.24 (the run model) and 1.25
(playback is the noun — `playRun` is `playback`, `onRunStart` is `onPlaybackStart`, `runOnce()` is
`playback.playOnce()`): the three props are ONE lever, `playback="off" | "on" | "paused"` (a change of position presses
one button); the buttons are `playback.start()` · `playback.stop()` · `playback.pause()` · `playback.resume()`; the
state read is `playback.getState()` — `off` · `playing` · `paused` · `finished` · `returning` · `destroyed` (`idle` is
`off`) — plus `playback.isActive()`; the callbacks are `onPlaybackStart` / `onPlaybackResume` (both were `onPlay`),
`onPlaybackPause` (the gate's hold no longer reports), `onPlaybackStop`; the Vue events `playbackStart` ·
`playbackResume` · `playbackPause` · `playbackStop`; the registry events likewise. `actions.finish` is the timeline key
`atEnd` (`"timeline": { "atEnd": "hold" }`). Types: `PxPlayState` → `PxPlaybackState`, `PxStartBehavior` /
`PxStopBehavior` / `PxFinishBehavior` → `PxStartPlaybackBehavior` / `PxStopPlaybackBehavior` / `PxAtEndBehavior`,
`PxPlayStateRequest` → `PxPlayback` (1.24 spelt them `PxRunState`, `PxStartRunBehavior`, `PxStopRunBehavior`,
`PxPlayRun`). Stamped files are migrated on read.

**`setPlaySpeed` / `reset` / `onReset` is not there; `playWhile` is not a prop.** Renamed in 1.22 / 1.23:
`playback.setSpeed(s)` (with `playback.getSpeed()`), `playback.getDurationAtSpeed()` / `playback.setDurationAtSpeed()`, `playback.getTotalDurationAtSpeed()`,
`playback.getCurrentTimeAtSpeed()`; `reset()` is `playback.jumpToStart()` (it reports nothing — `onReset` is gone; the
state is `playback.getState() === 'off'`); `onWarn` is `onWarning`; the component props `playWhile` /
`pauseWhile` went back to `play` / `pause` (or one `playState`) — one lever since 1.24 (`playRun`; `playback` since 1.25); `timelineOptions.playSpeed` is
`playbackSpeed`; the action words `reset` / `rewind` / `restart` are `jumpToStart` / `animateToStart` /
`jumpToStart`, and `stop.completeIteration: true` is `'playback.stop': 'animateToEnd'`; the types `PxPatch` /
`PxTimelinePatch` / `PxActionsPatch` are `PxRecursivePartial` / `PxTimelineOptions` / `PxActionsOptions`,
and `null` no longer deletes a key — set the value you want. Stamped files are migrated on read.

**`setPlaybackRate` / `jumpToFinished` is not a function.** Renamed in 1.21: `setPlaybackRate` became
the speed (now `playback.setSpeed(s)`), `jumpToFinished()` is `playback.jumpToEnd()`; the type `PxDocumentInput`
is `PxDocumentJson`. `playback.getCurrentTime()` / `playback.setCurrentTime()` and `playback.getCurrentProgress()` now mean the
position INSIDE the current iteration — the playback is `playback.getTotalTime()` / `playback.getTotalDuration()`.

**Two control props do not compile together.** Expected: `PxControlProps` takes ONE driver family at a
time — `showAtProgress` · `showAtTime` · `playback` · `playUsingActionTriggers`.
Pick the one that drives; from JavaScript the highest-priority family wins with a warning (PX1501).

**A JSON import is flagged on `doc`.** It shouldn't be: `doc` is typed `PxDocumentJson`,
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

**Hover does nothing.** `hoverIn` / `hoverOut` have no touch equivalent; use `click` or drive `play`
yourself.

## Playback behavior

**It holds the last frame — I want it to go back to the start.** Set `timeline.atEnd: "jumpToStart"` —
at its end the animation jumps back to the rest pose (`"animateToStart"` plays back to it instead; the
default `"hold"` keeps the last frame). The rest pose is the SVG as authored; a hand-authored
file whose static attributes differ from its first keyframe can show the first frame instead with
`timeline.whenIdle: "firstFrame"`
(see [The end of the pass](./playback-and-triggers.md#the-end-of-the-pass--atend)).
For one mount only, pass the same thing as an override: `timelineOptions={{ atEnd: 'jumpToStart' }}`.

**How do I stop after the current pass, not mid-beat?** `actions: { 'playback.stop': 'animateToEnd' }` — a stop
plays on to the end of the pass, and arriving there runs `atEnd` (`hold` rests there).

**How do I play backwards?** `player.playback.setSpeed(-1); player.playback.start();` (on a `reverse` pass the two
multiply, so it plays forwards) — or let a stop play back by itself: `actions: { 'playback.stop': 'animateToStart' }`
in the timeline, with the event that stops it listed in the triggers (`'playback.stop': 'hoverOut'`); `playback.stop()` and
`playback="off"` play back the same way (the state reads `returning` on the way).

**How do I play faster or slower?** `timeline.playbackSpeed` in the file (`2` = twice as fast), the same
key in `timelineOptions`, or `playback.setSpeed(2)` on the handle — `playback.setDurationAtSpeed(ms)` asks for the same
thing as a length. A speed of `0` is rejected: `playback.pause()` is how you stop. On a scroll or view timeline
the scroll position owns the playhead, so the playback calls do nothing there (PX1505).

**A trigger event does nothing, or the console warns about the triggers.** Each list names only
the events that make sense for it — `playback.start` never `hoverOut`, `playback.stop` never `load` or `hoverIn`,
`playback.pause` and `playback.resume` never `load` — and any other event is ignored (PX1110). What resumes a
pause is derived unless the file names it (the counterpart of the `playback.pause` event, plus the `playback.start`
events that do not stop it); a named `playback.resume` list is honoured as written, and the player notes
where it differs from that derivation (PX1111); `playback.stop` on the
same event as `playback.pause`, or on its counterpart, collides (PX1109) — all three on
[the codes page](../diagnostics.md#what-the-document-says). See
[Which events each list may name](./playback-and-triggers.md#which-events-each-list-may-name).

**Jumping to a time while playing.** `playback.setCurrentTime(ms)` works while playing (the animation
continues from the new point) and while paused (it shows that frame and stays there). It seeks inside
the current iteration, `0..getDuration()`; `playback.setTotalTime(ms)` seeks on the whole playback.

**My slider wraps on every iteration.** `playback.getCurrentTime()` is the frame inside the current iteration
(since 1.21, on every player) — the slider every animation player shows for a loop. For a slider
across a finite playback use `playback.getTotalTime()` with `playback.getTotalDuration()` as the maximum (`null` when
`iterations` is `'infinite'`).

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
