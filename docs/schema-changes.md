# Player schema changes

<!-- GENERATED from packages/svg-animator-core/src/version/PxSchemaChangeCode.ts by scripts/gen-schema-changes-md.mjs — edit the enum, not this file. -->

Every step of the file format carries a **number**, not a sentence: the player converts an
older file forward through these steps and ships only the numbers; the words are here. A
step's number is `step.code` in `PX_WIRE_STEPS`, printed `PXS<n>` — separate from the
[diagnostic codes](./diagnostics.md) (`PX<n>`), which are what a player reports.

A number is permanent: it is never reused, and new steps only take higher ones. A
description may be reworded or extended; its number stays.

## <a id="pxs1"></a>PXS1 · 1.1 → 1.2

The trigger block became two axes: `start` says what STARTS an animation, `offScreen` + `visibilityThreshold` + `visibilityDebounce` say whether it may RUN. `scrollIntoView` is no longer a start value — it is what `start: 'load'` behind the default gate already means — and `outAction` split into `offScreen` (scroll) and `mouseOut` (hover), because one field meant three things.

## <a id="pxs2"></a>PXS2 · 1.2 → 1.3

The timeline's one length became a content WINDOW (first-use review §4): `duration` is renamed `outTime`, and `inTime` (window start, default 0) and `playDuration` (the window remapped to wall ms) join it. `duration` read as the CSS word for speed, which it never was.

## <a id="pxs3"></a>PXS3 · 1.3 → 1.4

What is shown after the end was decided in two places (first-use review §13): `trigger.finish` moves OUT of the trigger — the only trigger key about neither starting nor running — and next to `fillMode` as `timeline.finish`, because the two answer the same question and must document how they combine.

## <a id="pxs4"></a>PXS4 · 1.4 → 1.5

`animator.debugGlobalName` is removed: it let a FILE write any `window` property of the page playing it (`fetch`, `location`, …). Reaching a live animator from the console is the page registry's job — `getAllSvgAnimationPlayers()`.

## <a id="pxs5"></a>PXS5 · 1.5 → 1.6

An `animate` entry may be COMPILED — `{ kind, keyframes }` with explicit values typed by `kind`, no `loop`, no named easing — the low layer the player lowers a document to before playing it (dev-docs/plans/compiled-animation-layer.md). Authored entries are unchanged.

## <a id="pxs6"></a>PXS6 · 1.6 → 1.7

Trigger words name the event each key is about (first-use review §21): `start: 'mouseOver'` becomes `'hover'` and `'none'` becomes `'manual'`; `mouseOut` becomes `hoverEnd`; the visibility gate is one "view" family — `visibilityThreshold` / `visibilityDebounce` (its opening edge) become `inViewThreshold` / `inViewDebounce`, and `offScreen` (its closing edge) becomes `outOfView`.

## <a id="pxs7"></a>PXS7 · 1.7 → 1.8

Every value the format defines is camelCase (first-use review §25): `timeline.direction: 'alternate-reverse'` becomes `'alternateReverse'`, and the scroll range phases `'entry-crossing'` / `'exit-crossing'` become `'entryCrossing'` / `'exitCrossing'`. The players spell them the CSS way only where they hand them to the browser.

## <a id="pxs8"></a>PXS8 · 1.8 → 1.9

The trigger says only WHEN (dev-docs/plans/component-api.md D5): `start` / `hoverEnd` become the event lists `playStart` / `playStop` / `pauseStart` / `pauseStop`; HOW is the timeline's own — `fillMode` + `finish` become `playFinishAction` (+ `showFirstFrameBeforePlayStart`), `direction` becomes `iterationDirection`, the gate keys move up (`outOfView` → `outOfViewAction`), and `playStartAction` / `playStopAction` / `completeIterationOnPlayStop` are new.

## <a id="pxs9"></a>PXS9 · 1.9 → 1.10

Triggers and actions (dev-docs/plans/playback-layers.md, layers 0–1): `trigger` becomes `triggers` with the lists `start` / `stop` / `pause` / `resume` (+ the new `togglePlay`; each list names only the events it can use, and `resume` is derived for the built-in events); the play keys become one `actions` block — `start` / `stop` / `finish` / `suspend`, each `{ transition }` (`resume` → `continue`, `jumpToEnd` → `jumpToFinished`, `outOfViewAction` → `suspend`, `completeIterationOnPlayStop` → `stop.completeIteration`) — and `showFirstFrameBeforePlayStart: true` becomes `beforeStart: 'firstFrame'`.

## <a id="pxs10"></a>PXS10 · 1.10 → 1.11

The names say the link (dev-docs/reviews/react-props-review.md): `timeline.triggers` becomes `actionTriggers` — a key names the action it fires, the same key in `actions` says how that action looks — and an action's `transition` becomes `do`, written as the word itself when it is the only setting (`stop: 'rewind'`).

## <a id="pxs11"></a>PXS11 · 1.11 → 1.12

`actionTriggers.togglePlay` is gone (dev-docs/reviews/schema-and-props-review-fix-plan.md §2.3): it only ever meant `click` under both `start` and `stop`, and read as a play/pause toggle to everyone — the two lists say it as it is.

## <a id="pxs12"></a>PXS12 · 1.12 → 1.13

`actions.suspend` becomes `actions.outOfView` (dev-docs/reviews/schema-and-props-review-fix-plan.md §2.4): the key names the condition — none of it on screen — in the words `inViewThreshold` / `inViewDebounce` already use; `suspend` made readers ask "suspended by what?".

## <a id="pxs13"></a>PXS13 · 1.13 → 1.14

An action's `do` becomes `behavior` (dev-docs/reviews/schema-and-props-review-fix-plan.md §2.6): "stop behavior: rewind" says what kind of thing the value is, `do` did not. The word form (`stop: 'rewind'`) is unchanged.

## <a id="pxs14"></a>PXS14 · 1.14 → 1.15

`timeline.beforeStart` becomes `timeline.showWhenStopped` (dev-docs/reviews/schema-and-props-review-fix-plan.md §3.1): the key governs the whole STOPPED state — after a reset or a rewind too, not only before the first start — and takes the `show…` verb of the components' `showAtProgress` / `showAtTime`. The values `static` / `firstFrame` are unchanged.

## <a id="pxs15"></a>PXS15 · 1.15 → 1.16

`timeline.playDuration` (wall ms of one pass) becomes `timeline.playSpeed` (a factor, 1 = content ms pass as real ms; dev-docs/reviews/schema-and-props--manual-review.md A2): every player spells speed as a factor, a factor needs no knowledge of the content's length, and with it no key on the API is wall time. `playSpeed = (outTime − inTime) / playDuration`; a file without `outTime` gets it written (the derived max keyframe time) so the conversion is exact.

## <a id="pxs16"></a>PXS16 · 1.16 → 1.17

An absent `actionTriggers` block no longer means `start: 'load'` — absent and `{}` are the same, nothing starts it (dev-docs/reviews/schema-and-props--manual-review.md B2): a default nobody wrote is a guess, and two spellings with two meanings trapped merge patches and hand edits. A time timeline without the block gets `{ start: 'load' }` written, so every file keeps playing as it did.

## <a id="pxs17"></a>PXS17 · 1.17 → 1.18

`actions.start: 'jumpToFinished'` becomes `'jumpToEnd'` (dev-docs/reviews/schema-and-props--manual-review.md A4): its siblings name positions and motion (`restart`, `rewind`, `reset`), while `finished` is a state.

## <a id="pxs18"></a>PXS18 · 1.18 → 1.19

`timeline.showWhenStopped` becomes `timeline.whenIdle` (dev-docs/reviews/schema-and-props--manual-review.md B3): `idle` is WAAPI's word for the state it governs and carries no VCR reading — "stopped" read as played-then-stopped. The values `static` / `firstFrame` are unchanged.

## <a id="pxs19"></a>PXS19 · 1.19 → 1.20

`effects.clone.without` becomes `effects.clone.omit` (dev-docs/reviews/schema-and-props--manual-review.md B4): TypeScript's `Omit<T, K>` and lodash's `_.omit` mean exactly this, a copy without these keys. The value `translate` is unchanged.

## <a id="pxs20"></a>PXS20 · 1.20 → 1.21

`effects.clone.retime` spells its window like the timeline does (dev-docs/reviews/schema-and-props--manual-review.md B5): `timeCrop: [a, b]` becomes `inTime: a, outTime: b` (Lottie's own `ip` / `op`; tuples are for vectors and points, a window is two named points everywhere else), and `start` becomes `offset` (`start` is a trigger list and an action elsewhere). `stretch` is unchanged.

## <a id="pxs21"></a>PXS21 · 1.21 → 1.22

`timeline.playSpeed` becomes `timeline.playbackSpeed` (dev-docs/reviews/schema-and-props--improvements.md §0): "playback speed" is how media players say it, and the handle's family reads the same (`getPlaybackSpeed()`, `getPlaybackDuration()`, `getCurrentPlaybackTime()`). The value is unchanged.

## <a id="pxs22"></a>PXS22 · 1.22 → 1.23

The action words name WHERE a move goes and HOW (dev-docs/reviews/schema-and-props--improvements.md §0): `reset` → `jumpToStart`, `rewind` → `animateToStart`, `actions.start: 'restart'` → `'jumpToStart'`; `actions.stop` gains `jumpToEnd` / `animateToEnd`, and arriving at the end runs `finish` — so `stop.completeIteration: true` becomes `stop: 'animateToEnd'` (an endless timeline takes the old stop word as its `finish`, which only a stop could reach; a finite one keeps its `finish`).

## <a id="pxs23"></a>PXS23 · 1.23 → 1.24

The run model (dev-docs/plans/animation-state.brainstorm.md §0): the four buttons of the player box name the trigger lists and the actions — `start` → `startRun`, `stop` → `stopRun`, `pause` → `pauseRun`, `resume` → `resumeRun` (the handle's methods and the `playRun` prop's edges say the same) — and `actions.finish` moves beside `whenIdle` as `timeline.atEnd`: the clock's rule, not a button's. Every value is unchanged.

## <a id="pxs24"></a>PXS24 · 1.24 → 1.25

Playback is the noun, and a built-in action is named `<state variable>.<verb>` (dev-docs/plans/animation-state.playback-noun.md, animation-state.playback-namespace.md): "start / stop / pause / resume playback" are the phrases of every media player, where "run" read as a verb — `startRun` → `playback.start`, `stopRun` → `playback.stop`, `pauseRun` → `playback.pause`, `resumeRun` → `playback.resume`, in the trigger lists and the action slots (the handle says `player.playback.start()`). The dot reserves the built-in names against custom ones. Every value is unchanged.

## <a id="pxs25"></a>PXS25 · 1.25 → 1.26

State words and move words (dev-docs/plans/animation-state.feedback.2026-11-12.md): `playback.start` always plays from the start, so `actions["playback.start"]` leaves the file — its default `continue` becomes the new `playback.play` list for the events where the two differ (hover, click; `load` stays a start), and `jumpToStart` / `jumpToEnd` become plain starts. `timeline.atEnd` → `timeline.whenFinished` (the playback stays finished whatever it then shows), `actions.outOfView: jumpToStart` → `stop`, and the stop gains `animateToEndAndBack`.

## <a id="pxs26"></a>PXS26 · 1.26 → 1.27

Variables (docs/library/variables.md): `definitions.variables` declares named, typed values with a default, `definitions.variableVariants` names sets of defaults, and a static value anywhere may be written `"var(name)"` or `"calc(…)"` instead of the value. Nothing older has any of it, so there is nothing to convert up.

## <a id="pxs27"></a>PXS27 · 1.27 → 1.28

One scroll timeline in plain words (docs/library/playback-and-triggers.md, "Following the scroll"): `type: "view"` and `"scroll"` become `type: "scroll"` with `follows` (`thisElement`, `parentElement`, `pageElement` + `selector`, `pageScroll`, `containerScroll`) in place of `source` and `subject`; `range` becomes `firstFrameWhen` / `lastFrameWhen` — one of seven words (`appears` … `gone`, the old range names at 0, 50 and 100 %), an exact place `{ element, screen }`, or `{ scrolled }`; `pin` becomes `holdOnScreen` (`at`, `forScreens`, `offset`), which follows its own held stretch; `axis` says `vertical` / `horizontal`; `frameRate` leaves the scroll timeline. Amended before release (2026-11-15, the segments design): the page's elements are DOM elements — `thisDomElement`, `parentDomElement`, `pageDomElement`, an exact place `{ domElement, screen }` — so that `element` can mean one of the file's own: a binding's `target` becomes `element`, an effect's `source` (`maskedBy`, `clone`) becomes `sourceElement`. The timeline is the thing that plays: `playback.start` … `playback.resume` become `timeline.start` … `timeline.resume` (the trigger lists and the action slots), and `actionTriggers` moves out of `timeline` to the root of `animator`. New in the same step: `timeline.segments` (a list of named parts of the timeline, played one at a time; `timeline.segment.next` / `.previous` / `.goTo(‹name›)` in `actionTriggers` and a segment's `whenFinished`), and an event can be an object `{ event, element | selector, with }` — `pointerDown`, `pointerUp`, `keyDown`, `keyUp` among the events. Amended again before release (2026-11-20, the timelines-and-states design): `timeline` becomes `timelines`, a list whose first entry is the default; the segments leave their timeline as `states` (a segment's `name` is a state's `id`), beside `stateMachines`; `actionTriggers` becomes a list of rules `{ action, event, … }` — a `timeline.segment.goTo(‹name›)` key a rule `{ "action": "state.goTo", "state": "‹name›" }`, `timeline.segment.next` / `.previous` the actions `state.next` / `state.previous`, in a `whenFinished` too, as an object; an animated value may say what it does on the other timelines (`byTimeline`). Amended a third time before release (2026-11-22, the flows): `states` become `flowSteps` and `stateMachines` become `flows`; a step's and a rule's `stateMachine` becomes `flow`, a rule's and a `whenFinished`'s `state` becomes `flowStep`, and the actions `state.goTo` / `state.next` / `state.previous` become `flow.goTo` / `flow.next` / `flow.previous`. The default timeline is the one with no id, wherever it stands, and keyframes that name no timeline are its; a timeline no step names is a step of the flow `default`; a `byTimeline` entry holds keyframes only.

## <a id="pxs28"></a>PXS28 · 1.28 → 1.29

One list says what happens on an event, a timeline's own keys say what it does by itself (2026-11-22, docs/library/playback-and-triggers.md): `animator.actionTriggers` becomes `animator.actions`; a timeline's `actions` block goes — `actions["timeline.stop"]` becomes `whenStopped`, `actions.outOfView` becomes `whenOutOfView`; a step's `whenFinished` that goes on (`flow.goTo`, `flow.next`, `flow.previous`) becomes an entry `{ "event": "finished", "from": "‹step›", … }` of the list. An entry may say `from` (only while a flow is at those steps) and `behavior` (a stop's manner, a go-to's way of leaving).

## <a id="pxs29"></a>PXS29 · 1.29 → 1.30

Next and previous stop at the ends of a flow (2026-11-23, docs/library/playback-and-triggers.md): `flow.next` on the last step and `flow.previous` on the first do nothing; the new `flow.nextOrWrap` and `flow.previousOrWrap` go round to the first or the last step, as `flow.next` and `flow.previous` did. A file from before keeps its meaning: its `flow.next` becomes `flow.nextOrWrap`, its `flow.previous` `flow.previousOrWrap`.

## <a id="pxs30"></a>PXS30 · 1.30 → 1.31

An element can be shown only in some flow steps (2026-11-23, docs/library/playback-and-triggers.md): `"effects": { "showIn": { "flowSteps": ["swimming", "resting"] } }` — shown while one of them is current, hidden otherwise, at once. A pre-rendered SVG carries the same object on the element's binding.

## <a id="pxs31"></a>PXS31 · 1.31 → 1.32

A group can show one of its children (2026-11-24, docs/format/README.md): `"effects": { "showOneOf": { "which": 1 } }` shows the second child and hides the others, at once; `which` may be a variable (`var(mood)`) or a formula. The same release writes a variable as `var(name)` (it was `variable(name)`; an older file reads it as text).

## <a id="pxs32"></a>PXS32 · 1.32 → 1.33

Fewer words and structures for actions, flows and steps (2026-11-24, docs/library/playback-and-triggers.md). An entry of `actions` reads in three parts — `{ "name": "flow.goTo", "with": { "flowStep": "save" }, "triggers": [ { "event": "click" } ], "when": { "flowSteps": ["idle"] } }`: its `action` is `name`; what it acts on and how (`timeline`, `flow`, `flowStep`, `behavior`) is its arguments' object `with` — `behavior` becomes `whenStopped` or `whenLeaving`; its event (`event`, `element`, `selector`, `with`) is one object of the list `triggers`; `from` is `when.flowSteps`, always a list; `when.condition` is new. The event `finished` is `flowStep.finished`. A step's timeline keys (`inTime`, `outTime`, `iterations`, `iterationDirection`, `playbackSpeed`, `whenFinished`, `whenLeaving`) move into its `timelineOptions`, which also takes `delay` and `whenStopped`; a timeline has `whenLeaving` too. Where a flow starts is its `initialFlowStep` (a step's `initial: true` until then). Timelines, flows and steps have no `name` — the id is the name. `effects.showIn: { flowSteps }` is `effects.show: { when: { flowSteps } }`, `effects.showOneOf: { which }` is `effects.showOneChild: { when: { index } }` — on a pre-rendered binding too. A formula (`calc(…)`) may compare, join conditions with `and` · `or` · `not` and pick one of two values (`a ? b : c`).

## <a id="pxs33"></a>PXS33 · 1.33 → 1.34

Transitions between flow steps (2026-11-26, docs/library/playback-and-triggers.md). A step's `timeline` and `timelineOptions` become one object, its `segment` — `{ "id": "card", "segment": { "timeline": "card", "inTime": 600, "outTime": 2600 } }`. A step may also have an `inTransitionSegment`, played once each time it is entered, and an `outTransitionSegment`, played once each time it is left (`timeline`, `inTime`, `outTime`, `playbackSpeed`, `iterationDirection`). How two steps hand over is the arrow's: `with.transition` of `flow.goTo`, `flow.next`, `flow.previous` and the `…OrWrap` actions — `{ "overlap": 200, "mix": "crossfade", "leavingStep": "playsOn", "easing": [0.42, 0, 0.58, 1] }` — and a flow's `transition` is the default of every change in it.
