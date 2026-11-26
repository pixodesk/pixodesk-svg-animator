# Troubleshooting & FAQ

[← Minification](./minification.md) · [Contents](../../README.md#documentation) · Next: [Pre-rendered SVG on the web →](https://pixodesk.com/docs/svga/prerendered-svg/on-the-web)


Player-library troubleshooting — find your symptom below; each entry says what to check and
what to change. For pre-rendered SVG issues (a flavor that shows a static frame, `<script>`
stripped on import, the same file inlined twice on one page) see
[Pre-rendered SVG on the web](https://pixodesk.com/docs/svga/prerendered-svg/on-the-web); for what each engine can and
cannot animate per browser, see [Choosing a format](https://pixodesk.com/docs/svga/editor/choosing-a-format). If yours
is not here, go to [Still stuck?](#still-stuck) at the end.

## Nothing plays

**No entry starts it on `load`.** Check the file's `animator.actions` for an entry
`{ "name": "timeline.start", "triggers": [{ "event": "load" }] }` (or `"timeline.play"`) (or *Play on* in the editor). `click`, `hoverIn`
and `hoverOut` wait for the user; an absent or empty list (`[]`) waits for you to call `timeline.start()` — since
schema 1.17 a file that plays by itself says so, an absent block no longer means load (stamped files were migrated; a hand-written file without a
version stamp has to say it). Even `load` waits until enough of the animation is on screen, and pauses
while it is scrolled out of view (`whenOutOfView: 'pause'`, the default) — see
[Triggers](./playback-and-triggers.md#triggers--when-it-plays). Remember that every control prop or option
but `actions` switches the document's triggers off — with `showAsStatic`, `disableActions`,
`playback`, `showAtProgress` or `showAtTime` the file's triggers are ignored. Passing `playerRef` does **not**
change the mode.

**`showAsStatic` is set.** It shows the picture as drawn and nothing else: no triggers, no scroll, and every
playback call is ignored with a warning ([PX1506](../diagnostics.md#the-props-a-component-was-given)). It
beats every other control prop, so a `playback` or `actions` beside it does nothing (PX1501).

**`createSvgAnimationPlayersFromPage()` ran before the elements existed.** Call it after the DOM is ready (end of
`<body>`, `DOMContentLoaded`), and call it again after inserting content dynamically — it only
creates players for elements that do not have a player yet.

**`createSvgAnimationPlayer({ document: url })` — the file did not load.** Look in the console: the player logs
`PX1003` when the request failed — a network or CORS error is the usual cause — or `PX1002` when the
file loaded but is not an animation document: the JSON must have `"type": "svg"` at the root (both on
[the codes page](../diagnostics.md#building-a-player)). Calls made before the load finishes are
queued, so `timeline.start()` is not lost.

**Scroll trigger never fires.** The element may already be fully in view at load (then it
starts immediately), or `inViewThreshold` may be higher than the element can ever
reach on a small viewport. Inside an `<iframe>`, visibility is measured relative to the iframe.

## React

**The animation restarts when the parent re-renders.** The player is recreated only when the
`document` *content* changes (the comparison is deep — Vue and React Native compare the same way), so a
re-created but identical object is fine.
Restarts usually come from a `document` that really is different each render — for example built
inline with a changing value. Build the document once (module level or `useMemo`).

**Console: `setAttribute: No elements found for selector "#…"` on unmount.** Cosmetic — a
late frame after teardown. Safe to ignore.

**`onDestroy` fires when I pass a different `document`.** Expected: a new
document means a new player; the old one is thrown away and reports it on its way out.

**Next.js: "useRef is not a function" / hooks error.** The component must be used from a client
component — add `'use client'` at the top of the file that renders it.

## TypeScript

**A step's `timeline` or `timelineOptions` is not read; `PxFlowStepTimelineOptions` is not exported.** Changed in
1.34 (2026-11-26): a step's timeline and its options are one object, its `segment` — and a step may play an
in-transition and an out-transition, and two steps may overlap while they hand over
([Transitions between steps](./playback-and-triggers.md#transitions-between-steps)).

<!-- px-check off old and new spelling, prose -->
| Was | Is |
|---|---|
| `{ "id": "hover", "timeline": "grow", "timelineOptions": { "whenLeaving": "animateToStart" } }` | `{ "id": "hover", "segment": { "timeline": "grow", "whenLeaving": "animateToStart" } }` — the same keys, `timeline` among them |
| a step that names no `timeline` | a `segment` that names none — the default timeline, as before |
| (new) | `"inTransitionSegment": { "inTime": 0, "outTime": 600 }` · `"outTransitionSegment": { … }` — played once on the way in and on the way out |
| (new) | `"with": { "flowStep": "done", "transition": { "overlap": 200 } }` on `flow.goTo`, `flow.next`, `flow.previous` and the `…OrWrap` actions · `"flows": [{ "id": "menu", "transition": { … } }]` — the default of every change in a flow · `player.flow.goTo({ flowStep: 'done', transition: { overlap: 200 } })` |
| `PxFlowStepTimelineOptions` · `PxFlowStepTimelineOptionsSchema` | `PxFlowStepSegment` · `PxFlowStepSegmentSchema`; new: `PxTransitionSegment`, `PxStepTransition` and their schemas, `PxTransitionMix`, `PxLeavingStep` |

Stamped 1.33 files are converted on read; there is no way back to 1.33 — it cannot say a transition.

**An entry of `actions` with `action`, `event`, `from` or `behavior`, a step's `inTime` or `initial`, a `name`,
`showIn` or `showOneOf` is not read; `player.flow.goTo('open')` does not compile.** Changed in 1.33 (2026-11-24): an
entry of `actions` reads in three parts — what (`name` + `with`), set off by (`triggers`), only when (`when`); a step's
timeline keys sit in its `timelineOptions` (in its `segment` since 1.34); the page's flow calls take the entry's `with`
object.

<!-- px-check off old and new spelling, prose -->
| Was | Is |
|---|---|
| `{ "action": "timeline.start", "event": "load" }` | `{ "name": "timeline.start", "triggers": [{ "event": "load" }] }` — `triggers` is a list, each trigger an object; an entry with two triggers is set off by either |
| a rule's `"timeline"` · `"flowStep"` · `"flow"` | in `with`: `"with": { "timeline": "spin" }` · `{ "flowStep": "open" }` · `{ "flow": "menu" }` |
| a rule's `"element"` · `"selector"` · `"with"` (the event's fields) | on its trigger: `{ "event": "click", "element": "#lens" }` · `{ "event": "keyDown", "with": { "key": "Enter" } }` |
| `"from": "closed"` (one id or a list) | `"when": { "flowSteps": ["closed"] }` — always a list; `when.condition` is new |
| a stop's `"behavior": "animateToStart"` · a go-to's `"behavior": "animateToEnd"` | `"with": { "whenStopped": "animateToStart" }` · `"with": { "flowStep": "…", "whenLeaving": "animateToEnd" }` |
| the event `"finished"` | `"flowStep.finished"` |
| a step's `inTime` · `outTime` · `iterations` · `iterationDirection` · `playbackSpeed` · `whenFinished` · `whenLeaving` | the same keys in its `"timelineOptions": { … }` — which also takes `delay` and `whenStopped`; a timeline may say `whenLeaving` too |
| a step's `"initial": true` | its flow's `"initialFlowStep": "‹the step›"` — for the flow `default`, an entry `{ "id": "default", "initialFlowStep": "…" }` in `flows` |
| `"name"` on a timeline, a flow or a step | gone — the `id` is the name |
| `"effects": { "showIn": { "flowSteps": ["a"] } }` | `"effects": { "show": { "when": { "flowSteps": ["a"] } } }` — on a pre-rendered binding too |
| `"effects": { "showOneOf": { "which": 2 } }` | `"effects": { "showOneChild": { "when": { "index": 2 } } }` |
| `player.flow.goTo('open', 'animateToEnd')` · `.next('menu')` | `player.flow.goTo({ flowStep: 'open', whenLeaving: 'animateToEnd' })` · `.next({ flow: 'menu' })` — the same on the React, Vue and React Native handles |
| `PxActionTriggers` · `PxActionTriggerRule` · `PxActionTriggersInput` · `PxActionTriggersSchema` · `PxActionTriggerRuleSchema` | `PxActions` · `PxActionEntry` · `PxActionsInput` · `PxActionsSchema` · `PxActionEntrySchema` |
| `PxShowInEffect` · `PxShowOneOfEffect` · `PxActionObject` · `isFlowActionObject` | `PxShowEffect` · `PxShowOneChildEffect` · gone — a step goes on by a `flowStep.finished` entry |

Stamped 1.32 files are converted on read, one entry per old rule; there is no way back to 1.32 — see
[Triggers](./playback-and-triggers.md#triggers--when-it-plays).

**Next no longer goes round from the last step; Previous does nothing on the first.** Changed in 1.30
(2026-11-23): `flow.next` / `flow.previous` stop at the ends of a flow. For a carousel or a toggle that goes round, use
`flow.nextOrWrap` / `flow.previousOrWrap` — `player.flow.nextOrWrap()` from code. A file stamped before 1.30 is
converted on read and keeps going round.

**`actionTriggers` or `disableActionTriggers` is not an option or prop; the `actions` prop rejects an object; a
timeline's `actions` block or a step's `whenFinished` object is not read.** Changed in 1.29 (2026-11-22): one list
says what happens on an event, and a timeline's own keys say what it does by itself.

<!-- px-check off old and new spelling, prose -->
| Was | Is |
|---|---|
| `"animator": { "actionTriggers": [ … ] }` | `"animator": { "actions": [ … ] }` — the same rules |
| a timeline's `"actions": { "timeline.stop": "animateToStart" }` | `"whenStopped": "animateToStart"` on the timeline |
| a timeline's `"actions": { "outOfView": "continue" }` | `"whenOutOfView": "continue"` on the timeline |
| a step's `"whenFinished": { "action": "flow.next" }` | an entry `{ "name": "flow.nextOrWrap", "triggers": [{ "event": "flowStep.finished" }], "when": { "flowSteps": ["‹the step›"] } }` (`flow.next` since 1.30 stops on the last step) — the step's `whenFinished` takes only the picture words |
| the `actionTriggers` prop / option · `disableActionTriggers` | `actions` · `disableActions` |
| the `actions` prop `{ 'timeline.stop': 'animateToEnd' }` | `timelineOptions={{ whenStopped: 'animateToEnd' }}` — merged, like the rest of the timing |
| the `actions` prop `{ outOfView: 'continue' }` | `timelineOptions={{ whenOutOfView: 'continue' }}` |
| `PxActions` · `PxActionsInput` · `PxActionsSchema` (the timeline's block) · `withActionTriggers(doc, rules)` | gone · `PxActionTriggersInput` (the list — `PxActionsInput` again since 1.33) · the timeline schema's two keys · `withActions(doc, entries)`. Since 1.33 `PxActions` and `PxActionsSchema` name the `actions` list |
| `PxControlMode.actionTriggers` | `PxControlMode.actions` |

New in the same step: a rule could say `from` (only while a flow is at those steps) and `behavior` (its own manner of
stopping or leaving) — since 1.33 an entry's `when.flowSteps` and `with.whenStopped` / `with.whenLeaving`:
[Only at some steps](./playback-and-triggers.md#only-at-some-steps--whenflowsteps),
[An entry's own manner](./playback-and-triggers.md#an-entrys-own-manner--whenstopped-and-whenleaving). Stamped 1.28
files are converted on read.

**`animator.timeline`, `segments` or `states`, the `segment` or `state` prop, `onSegmentChange` / `onStateChange`,
`player.timeline.segment` or `player.state` is not there; `actionTriggers` is not an object.** Changed on 2026-11-20
and 2026-11-22 (schema 1.28, amended): a file can hold several timelines, flows and flow steps.

<!-- px-check off old and new spelling, prose -->
| Was | Is |
|---|---|
| `"timeline": { … }` | `"timelines": [ { … } ]` — the one with no `id` is the default |
| `timeline.segments: [{ "name": "intro", … }]` | `"flowSteps": [{ "id": "intro", … }]` beside `timelines` — the `id` is the handle and the name |
| `"actionTriggers": { "timeline.start": "load" }` | `"actions": [{ "name": "timeline.start", "triggers": [{ "event": "load" }] }]` (1.33) |
| `"timeline.segment.goTo(intro)"` · `"timeline.segment.next"` · `.previous` | `{ "name": "flow.goTo", "with": { "flowStep": "intro" } }` · `{ "name": "flow.nextOrWrap" }` · `flow.previousOrWrap` (they went round; `flow.next` since 1.30 stops at the ends) |
| a segment's `"whenFinished": "timeline.segment.next"` | an entry `{ "name": "flow.nextOrWrap", "triggers": [{ "event": "flowStep.finished" }], "when": { "flowSteps": ["‹the step›"] } }` |
| `player.timeline.segment.goTo()` · `.next()` · `.get()` | `player.flow.goTo({ flowStep })` · `.nextOrWrap()` · `.get()` — `get()` is a list, one id per flow |
| the `segment` prop · `onSegmentChange` · Vue `segmentChange` | the `flowStep` prop · `onFlowStepChange` · Vue `flowStepChange` |
| a `"timeline.resume"` key with an empty list | not possible any more: with no `timeline.resume` entry, the resume is derived |
| `"states"` · `"stateMachines"` · a rule's `"state"` / `"stateMachine"` · `state.goTo` (2026-11-20) | `"flowSteps"` · `"flows"` · `with.flowStep` / `with.flow` · `flow.goTo` |
| `player.state` · the `state` prop · `onStateChange` · Vue `stateChange` | `player.flow` · the `flowStep` prop · `onFlowStepChange` · Vue `flowStepChange` |
| two timelines played side by side by themselves | one flow of two steps — give the second a flow of its own (a step `{ "id": "…", "flow": "…", "segment": { "timeline": "…" } }`), or name both in the `timelines` prop |

The `actionTriggers` prop and option take the list too. Stamped 1.28 files are converted on read — see
[Flows](./playback-and-triggers.md#flows--named-steps-of-the-animation).

**`playback.playOnce()` / `playback.jumpToStart()` / `playback.jumpToEnd()` is not a function; `src`, `doc`,
`playUsingActionTriggers` or `onFinish` is not an option; `timeline.atEnd` is not read.** Changed in 1.26: the
animation is ONE option, `document` — a URL or the document itself (`createSvgAnimationPlayer({ document: '/ball.json' })`,
`<SvgAnimationPlayer document={animation} />`, Vue `:document`; the pre-rendered `bind` takes it too), and the page
tag is `<div data-px-document="/ball.json">` (was `data-px-animation-src`); `playUsingActionTriggers` is gone
(and the short-lived `playerActionTriggers` of pre-release builds): with no control prop a player plays the file's
own triggers — drop a bare `playUsingActionTriggers`; an object is now `actionTriggers`,
and a mount that relied on "no prop = nothing plays" adds `disableActionTriggers` (your code drives) or
`showAsStatic` (a still). The `actions` prop now REPLACES the file's `actions` block instead of merging over it
(the type `PxActionsOptions` is `PxActionsInput`) — pass every setting you want; `onFinish` is `onPlaybackFinish` (the Vue event `playbackFinish`, the registry event
`playbackFinish`); `timeline.atEnd` is `timeline.whenFinished` and `PxAtEndBehavior` is `PxWhenFinished`. The three
calls are gone: back to the rest pose is `timeline.stop()`, a frame is `timeline.setCurrentProgress(p)` /
`timeline.setCurrentTime(ms)`, one pass is `timelineOptions: { iterations: 1 }` and `timeline.start()`.
`actions["timeline.start"]` is gone with `PxStartPlaybackBehavior`: `timeline.start()` always plays from the start,
and `timeline.play()` — or the `"timeline.play"` trigger list — starts or carries on. `actions.outOfView: 'jumpToStart'`
is `'stop'`. Stamped 1.25 files are converted on read; a start that used the default `continue` gets its hover and
click events moved to `"timeline.play"`.

**`type: 'view'`, `source`, `subject`, `range` or `pin` is not a timeline key; `PxScroll`, `PxScrollKind`,
`PxScrollPhase`, `PxScrollSource` or `PxPinAlign` is not exported.** Changed in 1.28: one scroll timeline in plain
words — `{ type: 'scroll' }` with `follows` (`thisDomElement` · `parentDomElement` · `pageDomElement` + `selector` ·
`pageScroll` · `containerScroll`) for `type` + `source` + `subject`; `firstFrameWhen` / `lastFrameWhen` (a moment
word such as `fullyIn`, an exact place `{ domElement, screen }`, or `{ scrolled }`) for `range`; `holdOnScreen`
(`at`, `forScreens`, `offset`) for `pin`; `axis: 'vertical' | 'horizontal'` for `block` · `inline` · `x` · `y`;
no `frameRate`. The types are `PxScrollFollows`, `PxScrollMoment`, `PxScrollLine`, `PxScrollAxis`, `PxHoldAt`,
`PxScrollMomentWire` and `PxHoldOnScreen`. Stamped 1.27 files are converted on read — see
[Following the scroll](./playback-and-triggers.md#following-the-scroll).

**`player.startPlayback()` / `player.play()` / `player.getCurrentTime()` is not a function.** Since 1.25 everything a page
does to the animation sits on ONE object, `player.timeline` (`PxTimelineControls`) — on the web player and on every
component's `playerRef`: `startPlayback()` → `timeline.start()`, `stopPlayback()` → `timeline.stop()`, `pausePlayback()`
→ `timeline.pause()`, `resumePlayback()` → `timeline.resume()`, `getPlaybackState()` → `timeline.getState()`,
`isPlaybackActive()` → `timeline.isActive()`, `isPlaying()` → `timeline.isPlaying()` (`playOnce()`, `jumpToStart()`
and `jumpToEnd()` are gone since 1.26 — above); the
content-time reads and seeks keep their names under `playback.` (`timeline.getDuration()`, `timeline.getCurrentTime()`,
`timeline.setTotalTime(ms)` …); the speed is `timeline.getSpeed()` / `timeline.setSpeed(s)`, and the speed-adjusted
reads say so: `getPlaybackDuration()` → `timeline.getDurationAtSpeed()`, `setPlaybackDuration(ms)` →
`timeline.setDurationAtSpeed(ms)`, `getTotalPlaybackDuration()` → `timeline.getTotalDurationAtSpeed()`,
`getCurrentPlaybackTime()` → `timeline.getCurrentTimeAtSpeed()`, `getTotalPlaybackTime()` → `timeline.getTotalTimeAtSpeed()`.
`player.play()` / `player.pause()` are gone — `timeline.play()` starts or carries on (it resumes a pause), and
`timeline.pause()` freezes. The player keeps only `isReady()`, `getRootElement()` and `destroy()`.

**`'startPlayback'` / `'startRun'` / `'start'` is not a key of `actionTriggers`.** Since 1.25 the built-in action names
are dotted — `"timeline.start"`, `"timeline.stop"`, `"timeline.pause"`, `"timeline.resume"` — in `actionTriggers` and in
`actions` (`"actionTriggers": [{ "action": "timeline.start", "event": "load" }]`, `actions={{ 'timeline.stop': 'animateToStart' }}`);
a dot marks a built-in action, so from JavaScript an `actions` key needs quotes. Stamped files are migrated on read (`start` until
1.23, `startRun` in 1.24).

**`play` / `pause` / `playState` is not a prop; `stop()` / `getPlayState()` is not a function; `onPlay` / `onStop`
never fires; `actions.finish` is dropped; `playRun` / `onRunStart` are gone.** Renamed in 1.24 (the run model) and 1.25
(playback is the noun — `playRun` is `playback`, `onRunStart` is `onPlaybackStart`; `runOnce()` is gone — one pass
is `timelineOptions: { iterations: 1 }` and `timeline.start()`): the three props are ONE lever, `playback="off" | "on" | "paused"` (a change of position presses
one button); the buttons are `timeline.start()` · `timeline.stop()` · `timeline.pause()` · `timeline.resume()`; the
state read is `timeline.getState()` — `off` · `playing` · `paused` · `finished` · `returning` · `destroyed` (`idle` is
`off`) — plus `timeline.isActive()`; the callbacks are `onPlaybackStart` / `onPlaybackResume` (both were `onPlay`),
`onPlaybackPause` (the out-of-view gate's pause reports it too since 1.26), `onPlaybackStop`; the Vue events `playbackStart` ·
`playbackResume` · `playbackPause` · `playbackStop`; the registry events likewise. `actions.finish` is the timeline key
`whenFinished` (`"timelines": [{ "whenFinished": "hold" }]`; `atEnd` until 1.25). Types: `PxPlayState` → `PxPlaybackState`,
`PxStopBehavior` / `PxFinishBehavior` → `PxStopPlaybackBehavior` / `PxWhenFinished` (`PxStartBehavior` is gone),
`PxPlayStateRequest` → `PxPlayback` (1.24 spelt them `PxRunState`, `PxStartRunBehavior`, `PxStopRunBehavior`,
`PxPlayRun`). Stamped files are migrated on read.

**`setPlaySpeed` / `reset` / `onReset` is not there; `playWhile` is not a prop.** Renamed in 1.22 / 1.23:
`timeline.setSpeed(s)` (with `timeline.getSpeed()`), `timeline.getDurationAtSpeed()` / `timeline.setDurationAtSpeed()`, `timeline.getTotalDurationAtSpeed()`,
`timeline.getCurrentTimeAtSpeed()`; `reset()` is gone — `timeline.stop()` goes back to the rest pose (`onReset` is gone; the
state is `timeline.getState() === 'off'`); `onWarn` is `onWarning`; the component props `playWhile` /
`pauseWhile` went back to `play` / `pause` (or one `playState`) — one lever since 1.24 (`playRun`; `playback` since 1.25); `timelineOptions.playSpeed` is
`playbackSpeed`; the action words `reset` / `rewind` are `jumpToStart` / `animateToStart` (`restart` needs no word:
`timeline.start` always plays from the start), and `stop.completeIteration: true` is `'timeline.stop': 'animateToEnd'`
(`'animateToEndAndBack'` with `rewind`); the types `PxPatch` /
`PxTimelinePatch` / `PxActionsPatch` are `PxRecursivePartial` / `PxTimelineOptions` / `PxActionsOptions` (`PxActionsInput` since 1.26),
and `null` no longer deletes a key — set the value you want. Stamped files are migrated on read.

**`setPlaybackRate` / `jumpToFinished` is not a function.** Renamed in 1.21: `setPlaybackRate` became
the speed (now `timeline.setSpeed(s)`), `jumpToFinished()` is gone (`timeline.setCurrentProgress(p)` shows a frame);
the type `PxDocumentInput` is `PxDocumentJson`. `timeline.getCurrentTime()` / `timeline.setCurrentTime()` mean the
position INSIDE the current iteration — the playback is `timeline.getTotalTime()` / `timeline.getTotalDuration()`;
`timeline.getCurrentProgress()` counts iterations since 1.26 (`1.2` = 20 % into the second).

**Two control props do not compile together.** Expected: `PxControlProps` takes ONE driver family at a
time — `showAsStatic` · `showAtProgress` · `showAtTime` · `playback` · `disableActions` · `actions`.
Pick the one that drives; from JavaScript the highest-priority family wins with a warning (PX1501).

**A JSON import is flagged on `document`.** It shouldn't be: `document` is typed `PxDocumentJson`,
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

**Hover does nothing.** `hoverIn` / `hoverOut` have no touch equivalent; use `click`, or drive it yourself
(the `playback` prop, or `playerRef`).

## Playback behavior

**It plays, but I wanted it still.** Since 1.26 a player plays the file the way it was saved, with no prop.
For a still picture pass `showAsStatic`; for a player your code starts, `disableActionTriggers` (and
`playerRef`, or the web player's returned api).

**It holds the last frame — I want it to go back to the start.** Set `timeline.whenFinished: "jumpToStart"` —
once finished the animation jumps back to the rest pose (`"animateToStart"` plays back to it instead; the
default `"hold"` keeps the last frame). Only the picture moves: the state reads `finished` either way, until the
next start or stop. The rest pose is the SVG as authored; a hand-authored
file whose static attributes differ from its first keyframe can show the first frame instead with
`timeline.whenIdle: "firstFrame"`
(see [Once finished](./playback-and-triggers.md#once-finished--whenfinished)).
For one mount only, pass the same thing as an override: `timelineOptions={{ whenFinished: 'jumpToStart' }}`.

**How do I stop after the current pass, not mid-beat?** `whenStopped: 'animateToEnd'` on the timeline — a stop
plays on to the end of the pass; there the playback is `finished` and `whenFinished` applies (`hold` rests there).
To play back to the start after that pass, `whenStopped: 'animateToEndAndBack'`.

**A hover or a click restarts the animation.** Since 1.26 `timeline.start` always plays from the start — also
while the animation is playing, paused or on its way back. To carry on instead (resume a pause, turn a return
around, do nothing while playing), list the event under `"timeline.play"` — or call `timeline.play()` — rather
than `timeline.start`.

**How do I play backwards?** `player.timeline.setSpeed(-1); player.timeline.start();` (on a `reverse` pass the two
multiply, so it plays forwards) — or let a stop play back by itself: `whenStopped: 'animateToStart'`
in the timeline, with an entry for the event that stops it (`{ "name": "timeline.stop", "triggers": [{ "event": "hoverOut" }] }`); `timeline.stop()` and
`playback="off"` play back the same way (the state reads `returning` on the way).

**How do I play faster or slower?** `timeline.playbackSpeed` in the file (`2` = twice as fast), the same
key in `timelineOptions`, or `timeline.setSpeed(2)` on the handle — `timeline.setDurationAtSpeed(ms)` asks for the same
thing as a length. A speed of `0` is rejected: `timeline.pause()` is how you stop. On a scroll timeline
the scroll owns the playhead, so the playback calls do nothing there (PX1505).

**A scroll-driven file ignores `timeline.start()`, `timeline.setCurrentProgress()` or `showAtProgress`.** Expected:
on a scroll timeline only the scrolling moves the playhead — the buttons and the seeks are ignored with a warning
(PX1505), `timeline.getState()` reads `scrubbing` and no playback callback fires. To drive the file from your own
code, make it a clock timeline: `timelineOptions={{ type: 'time' }}` beside `showAtProgress` — see
[Following the scroll → From page code](./playback-and-triggers.md#from-page-code).

**A scroll-driven animation starts too early or too late.** Its two moments decide where on the screen the
first and the last frame are shown — `firstFrameWhen` / `lastFrameWhen`, from `appears` to `gone` by default.
`"lastFrameWhen": "fullyIn"` finishes once all of it is in; an exact place such as
`"firstFrameWhen": { "domElement": "top", "screen": 0.8 }` starts when its top is 80 % down the screen — see
[The two moments](./playback-and-triggers.md#the-two-moments).

**A trigger event does nothing, or the console warns about the triggers.** Each action names only
the events that make sense for it — `timeline.start` and `timeline.play` never `hoverOut`, `timeline.stop` never `load` or `hoverIn`,
`timeline.pause` and `timeline.resume` never `load` — and a trigger with any other event is dropped (PX1110). A
`flow.goTo` naming a step the file does not have is ignored (PX1114), and so is an entry whose `with.timeline` or
`with.flow` names nothing (PX1116). What resumes a
pause is derived unless the file names it (the counterpart of the `timeline.pause` event, plus the `timeline.start`
events that do not stop it); named `timeline.resume` entries are honoured as written, and the player notes
where it differs from that derivation (PX1111); `timeline.stop` on the
same event as `timeline.pause`, or on its counterpart, collides, and so does `timeline.start` on the same event as
`timeline.play` (PX1109) — all three on
[the codes page](../diagnostics.md#what-the-document-says). See
[Which events each action may name](./playback-and-triggers.md#which-events-each-action-may-name).

**Jumping to a time while playing.** `timeline.setCurrentTime(ms)` works while playing (the animation
continues from the new point); in every other state — off, paused, finished — the playback becomes `paused`
at that frame, and `timeline.resume()` (or `timeline.play()`) carries on from it. A seek reports no callback. It
seeks inside the current iteration, `0..getDuration()`; `timeline.setTotalTime(ms)` seeks on the whole playback,
`timeline.setCurrentProgress(p)` by iterations (`1.2` = 20 % into the second) — see
[Moving the playhead](./playback-and-triggers.md#moving-the-playhead).

**My slider wraps on every iteration.** `timeline.getCurrentTime()` is the frame inside the current iteration
(since 1.21, on every player) — the slider every animation player shows for a loop; a 0–1 bar for every pass is
`getCurrentTime() / getDuration()`. `timeline.getCurrentProgress()` does not wrap: since 1.26 it counts iterations.
For a slider across a finite playback use `timeline.getTotalTime()` with `timeline.getTotalDuration()` as the maximum
(`null` when `iterations` is `'infinite'`).

**`onPlaybackFinish` never fires.** It fires when the last pass ends by playing — never on a loop without end,
never for a stop that goes to the end (`whenStopped: 'animateToEnd'` reports `onPlaybackStop`, though the
state then reads `finished` too), and never on a scroll timeline, which never starts or finishes.

**`onPlaybackPause` fires, but nobody paused it.** The out-of-view gate pauses for real since 1.26: scrolled out
of view (or in a hidden tab) the playback reads `paused` and reports `onPlaybackPause`, then `onPlaybackResume` when
it is seen again. `whenOutOfView: 'continue'` keeps it playing; `'stop'` stops it at once
(`onPlaybackStop`) and starts it again when seen.

**Frame rate.** `timeline.frameRate` applies only to the player's own frame loop (`engine: 'js'`,
or `'auto'` after falling back to it); WAAPI runs at the display rate.
React Native always runs at the display rate. A scroll timeline has no `frameRate`: it draws a frame when the
scroll moves.

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
