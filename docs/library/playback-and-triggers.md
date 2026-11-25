# Playback settings & triggers

[← React Native](./react-native.md) · [Contents](../../README.md#documentation) · Next: [Variables →](./variables.md)

Change how an animation plays — its length, loops, direction, what starts and stops it, what the
end leaves behind — without going back to the editor. Everything about *when* and *how* it plays
lives in the document's `animator` block — its `timelines`, its `actions` list and, for a picture with
named steps, its [`flowSteps`](#flows--named-steps-of-the-animation) — and every player lets you
**override it at runtime** from component props or the player options. This page is the
reference for those fields and the overrides.

The editor writes the same block from its playback panels; if you only want to set the defaults
there, see
[Set default playback settings & triggers](https://pixodesk.com/docs/svga/editor/playback-settings).

A document with its `animator` block. (The comments are explanatory; JSON does not allow
comments, so a real file has none.)

```js px-player
{
  "type": "svg",
  "viewBox": "0 0 400 400",

  // Everything about WHEN and HOW the animation plays lives here
  "animator": {
    // A list — one entry is the usual file; the first is the default and needs no id
    "timelines": [
      {
        "outTime": 2000,
        "iterations": "infinite",
        "iterationDirection": "alternate",
        // Plays as soon as half of it is on screen; pauses while it is scrolled away
        "whenOutOfView": "pause", "inViewThreshold": 0.5
      }
    ],
    // A list of actions: what to do, and the events that set it off
    "actions": [ { "name": "timeline.start", "triggers": [ { "event": "load" } ] } ]
  },
  "children": [
    {
      "type": "circle",
      "id": "ball",
      "cx": 0, "cy": 0, "r": 40, "fill": "#0087ff",
      "animate": {
        "transform": {
          "keyframes": [
            { "time": 0,    "value": { "translate": [200, 60] },  "easing": [0.33, 0, 0.67, 0.33] },
            { "time": 2000, "value": { "translate": [200, 340] } }
          ]
        }
      }
    }
  ]
}
```

The same bouncing ball as in the [web player](./web-player.md#declarative--data-px-document),
now two seconds per bounce and waiting until half of it has scrolled into view.

## Requests and moments

Three things make an animation go: the **triggers** (the user hovers or clicks), a component's
**`playback` prop** (your app's state — `off` · `on` · `paused`), and the **player API**
(`timeline.start()`, `timeline.play()`, `timeline.stop()`, `timeline.pause()`, `timeline.resume()` from your code).
All three press the same five **buttons**, so the format writes down **how** a stop looks exactly once, in the
timeline's `whenStopped`, and all three honour it.

A **playback** is one instance of the animation being in effect: it begins with `timeline.start` (always from
the start) or `timeline.play` (start, or carry on), lasts while the animation is `playing`, `paused` or
`finished`, and is retired by `timeline.stop`. `timeline.pause` / `timeline.resume` are the freeze inside it;
`off` is no playback. Reaching the end makes the playback `finished`, whatever the picture then shows. The
two places are not mirror images of each other:

- the `actions` list names the **requests** an event can make, in each entry's `name` — `timeline.start`,
  `timeline.play`, `timeline.stop`, `timeline.pause` (`timeline.resume` is derived unless the file names it) —
  and the flow actions `flow.goTo`, `flow.next`, `flow.previous`, `flow.nextOrWrap`, `flow.previousOrWrap`
  ([Flows](#flows--named-steps-of-the-animation)).
- the timeline's `when…` keys say what happens at the **moments**: `whenStopped` (how every stop looks),
  `whenOutOfView` (what the [visibility gate](#whether-it-may-run--the-visibility-gate) does), `whenFinished` and
  `whenIdle` (what the picture shows once finished, and while off).
- A stop is both: `timeline.stop` is a request, and `whenStopped` says how every stop looks, whoever asked for it.
  The other buttons have one behaviour each — a start always plays from the start, a pause freezes — so there is no
  `whenStarted` or `whenPaused`; going out of view is not a page event, so no entry names it. What the picture shows
  once the playback is finished is nobody's request either — it is the clock's rule, `whenFinished`, not a button.

(Until 1.29 the moments were the timeline's `actions` block — `actions["timeline.stop"]` and `actions.outOfView` —
and the list was called `actionTriggers`; older files are converted on read.)

<!-- px-check off the overview — each key and list is checked in its own table below -->
| button / moment | does | how it looks | requested by (`actions`) |
|---|---|---|---|
| **timeline.start** | any state → playing, from the start | nothing to configure — always from the start | `timeline.start` |
| **timeline.play** | off or finished → playing, from the start; paused → resumes; a picture on its way back → turns around; playing → nothing | nothing to configure | `timeline.play` |
| **timeline.stop** | playing, paused or finished → off, or on to the end (finished) | `whenStopped`: `jumpToStart` · `animateToStart` · `jumpToEnd` · `animateToEnd` · `animateToEndAndBack` — or the entry's own `with.whenStopped` | `timeline.stop` |
| **timeline.pause** / **timeline.resume** | freeze, and carry on | nothing to configure | `timeline.pause`; `timeline.resume` — derived unless the file names it |
| **whenFinished** | the playback reached its end — the state is `finished`; this moves only the picture | `timeline.whenFinished`: `hold` · `jumpToStart` · `animateToStart` | — (the clock) |
| **out of view** / back in view | nobody can see it / seen again | `whenOutOfView`: `pause` · `continue` · `stop` | — (the view sensor: a condition, not an event) |

So `player.timeline.stop()` on a looping heartbeat with `whenStopped: 'animateToEnd'` finishes the
beat and then rests — and so does an entry `{ "name": "timeline.stop", "triggers": [ { "event": "hoverOut" } ] }`, and so does
`playback="off"` on the React component. One vocabulary, learnt once — [the action words](#the-action-words).

### Playback states

What the player reports is the **playback** state — `timeline.getState()` on every handle, the same words
on every player; `timeline.isActive()` is true while a playback exists (`playing` · `paused` · `finished`):

<!-- px-check values PxPlaybackState pkg=core -->
| `timeline.getState()` | Means |
|---|---|
| `off` | no playback: before the first start, or back at the rest pose after a stop |
| `playing` | the playback is on and the clock moves — `timeline.isPlaying()` |
| `paused` | the playback is on, frozen by `timeline.pause` — or held on a frame by a seek made while it was not playing ([Moving the playhead](#moving-the-playhead)); `timeline.resume` carries on from there |
| `finished` | the playback reached its end — whatever `whenFinished` then shows, until the next start, stop or seek; `timeline.stop` still acts on it, `timeline.start` makes a fresh playback |
| `returning` | no playback, but the picture still plays back to the rest pose — a stop with `animateToStart` (or the way back of `animateToEndAndBack`) on its way; `timeline.play()` turns it around, `timeline.start()` plays from the start |
| `scrubbing` | a scroll timeline, always: the scrolling moves the playhead, so nothing starts, pauses or finishes it — [Following the scroll](#following-the-scroll) |
| `destroyed` | after `destroy()` — every call is a no-op ([PX1504](../diagnostics.md#the-props-a-component-was-given)) |

`timeline.isPlaying()` is `timeline.getState() === 'playing'`: a picture moving back to the start is not playing —
neither a `returning` one nor a `finished` one that `whenFinished: 'animateToStart'` plays back. The
[visibility gate](#whether-it-may-run--the-visibility-gate) presses the same buttons, so a playback scrolled out
of view reads `paused` (or `off`, with `whenOutOfView: 'stop'`) and reports it.

## Timelines — what advances the playhead

`animator.timelines` is a list of time axes. One entry is the usual file. **The first is the default**: it needs
no `id`, plain keyframes ride it, and `player.timeline` reads it. Every other entry has an `id`, unique in the
list, and the attributes that move on it say so with `byTimeline`
([Several timelines](#several-timelines-and-bytimeline)). The `id` is its name too (a separate `name` label until 1.33).

A timeline says what *drives* the animation's progress, exactly like a Web Animations API timeline. Its `type`
answers one question — who moves the playhead:

<!-- px-check schema PxTimelineSchema values=type -->
| `timeline.type` | The playhead follows… |
|---|---|
| `time` (default — may be omitted) | the player's clock — something *starts* a playback (the `actions` list), and it has the playback dynamics below |
| `scroll` | the scrolling — an element on its way across the screen, or how far the page or a box is scrolled — [Following the scroll](#following-the-scroll) |

Each type carries only the fields that mean something for it — a scroll timeline has no
`whenStopped`, no `whenOutOfView`, no `delay` and no `frameRate`, and the format gives them no slot there; no action starts it. Omitting
`timelines` entirely means one time-driven timeline with every default.

## Timing

Timing, the playback dynamics, how the animated attributes get updated and at what rate ALL live
in a timeline — each entry of `timelines` has its own. Beside the timelines, `animator` keeps the `actions`
list, the [flows](#flows--named-steps-of-the-animation) and the lookup tables (`definitions`,
`bindings`). The keys of a clock timeline:

<!-- px-check schema PxTimeTimelineSchema partial -->
| Key | Values | Default | Meaning |
|---|---|---|---|
| `id` | text | — | what steps, actions and `byTimeline` tracks call it — unique in `timelines`; none: the default timeline (at most one) |
| `inTime` | ms | `0` | where the content WINDOW begins. Keyframe times are absolute content ms |
| `outTime` | ms | max keyframe time | …and where it ends — one pass plays `inTime` → `outTime`. The editor always writes it |
| `playbackSpeed` | factor | `1` | the speed one pass plays at: `2` plays one pass in half the time, `0.5` in twice. Content ms stay content ms — only the speed changes. Must be positive in a file (the direction is `iterationDirection`). The handle's `timeline.setSpeed()` replaces it at runtime; `timeline.setDurationAtSpeed(ms)` asks for the same knob as a length. WHY a speed, not a duration (`playDuration` until 1.15): every player spells speed as a factor (lottie-web `setSpeed`, WAAPI `playbackRate`, GSAP `timeScale`) and a factor needs no knowledge of the content's length. WHY `playback…` (`playSpeed` until 1.21): "playback speed" is how media players say it, and the handle's family reads the same (`timeline.getDurationAtSpeed()`, `timeline.getCurrentTimeAtSpeed()`) |
| `frameRate` | fps | uncapped | target rate for the player's frame loop only — a parameter of the engine `engine` selects, so it sits beside it. A clock timeline only: a scroll timeline draws a frame when the scroll moves |
| `engine` | `auto` · `native` · `js` | `auto` | how the animated attributes get updated — [Engine](#engine) |
| `delay` | ms | `0` | waited whenever a playback starts from the beginning — every `timeline.start`, a `timeline.play` from rest — never on a resume from a paused position. Scaled by the speed as WAAPI's `delay` is: at `playbackSpeed: 2` a `delay: 500` waits 250 ms. A **negative** value skips ahead instead: `-500` starts right away from the frame at 0.5 s |
| `iterations` | number · `"infinite"` | `1` | how many times the whole timeline repeats |
| `iterationDirection` | `normal` · `reverse` · `alternate` · `alternateReverse` | `normal` | each iteration's direction; `alternate` ping-pongs on every other iteration. `reverse` applies to a single pass too — still one iteration |

**Per-property loops vs `iterations`.** There are two kinds of repetition, and they work at
different levels. `iterations` repeats the **whole document** — every element, from the first
keyframe to the last. A single property can also `loop` on its own: a segment of *its own*
keyframes repeats until it fills the document's duration, while everything else plays through
once (see [JSON format → Per-property loops](../format/README.md#per-property-loops)). The property loop is
applied first, when the document is prepared; `iterations` then repeats the result. So both
can be used at once, and one runs inside the other: a wheel whose rotation loops, inside a
document set to infinite iterations, keeps spinning during every iteration.

### Two clocks

There are two clocks, and every time on this API is on one of them:

- **Model time** — content ms, as the keyframes are authored. `inTime` / `outTime`, a keyframe's
  `time`, the components' `showAtTime` and the handle's `timeline.getDuration()` / `timeline.getCurrentTime()` are
  model ms of **one pass**; the `total…` names span the **whole playback**, every iteration included —
  `timeline.getTotalDuration()`, `timeline.getTotalTime()`, `timeline.getTotalProgress()`.
- **Playback time** — model time ÷ the speed: the `playback…` family. `playbackSpeed` sets it;
  `timeline.getDurationAtSpeed()` is how long one pass takes, `timeline.getTotalDurationAtSpeed()` the whole playback,
  `timeline.getCurrentTimeAtSpeed()` / `timeline.getTotalTimeAtSpeed()` the playhead on the pass and on the playback.

"Total" means *including repeats* — GSAP's words exactly: `time` / `totalTime`,
`duration` / `totalDuration`, `progress` / `totalProgress`. `delay`, `inViewDebounce` and `frameRate`
are plain ms (the delay is scaled by the speed, as WAAPI's is).

**Progress counts iterations**, in the order they play: `timeline.getCurrentProgress()` is `0.5` half-way through
the first iteration and `1.2` 20 % into the second, and `timeline.setCurrentProgress(1.2)` goes there. One number
says the pass and the place in it; nothing wraps, so `1` is the last frame of the first iteration. In an
`alternate` loop the second pass runs backwards, so `1.2` is the frame at 80 %, on its way back. The value is
clamped to `0 … iterations`, with no upper bound when the playback is endless; the components' `showAtProgress`
reads the same way. A bar that runs `0 … 1` on every pass uses `timeline.getCurrentTime() / timeline.getDuration()`.
(Until 1.25 progress was `0 … 1` of the current iteration.)

### Moving the playhead

A **seek** — `timeline.setCurrentTime(ms)` (inside the current iteration), `timeline.setCurrentProgress(p)`
(counted in iterations) or `timeline.setTotalTime(ms)` (on the whole playback) — follows one rule:

<!-- px-check off the seek rule, prose -->
| State before the seek | After the seek |
|---|---|
| `playing` | the time is corrected and it keeps playing from there |
| `off`, `paused`, `finished`, `returning` | `paused` at that frame — `timeline.resume()` (or `timeline.play()`) plays on from it |
| `scrubbing` | nothing: the seek is ignored with a warning — on a scroll timeline only the scroll moves the playhead ([From page code](#from-page-code)) |

A seek reports no callback. A seek to the exact end is `paused` too: only playing to the end gives `finished`.
To show one frame with no code, the components take `showAtProgress` / `showAtTime`, which hold the frame the
same way.

## Triggers — WHEN it plays

`animator.actions` — at the root of `animator`, beside `timelines` — is a **list of entries**. Each entry
says one thing: when this happens, only when that holds, do this. It names the action (`name`), what the action is
given (`with` — by id, what it acts on), the events that set it off (`triggers`) and what must hold (`when`):

```json
"timelines": [
  { "whenStopped": "animateToEnd" }
],
"actions": [
  { "name": "timeline.play",  "triggers": [ { "event": "hoverIn" }, { "event": "click" } ] },
  { "name": "timeline.stop",  "triggers": [ { "event": "hoverOut" } ] },
  { "name": "timeline.pause", "triggers": [ { "event": "click" } ] }
]
```

Read cold: play on hover-in or click (carrying on if it is already going), stop (after the beat) on hover-out,
a click while playing pauses and the next click carries on. Any one trigger of an entry sets it off; the order of the
entries does not matter to the playback actions — the [state rule](#one-event-several-lists) decides. (Until 1.33 an
entry was one flat rule per event — `{ "action": "timeline.stop", "event": "hoverOut" }`; until 2026-11-20 the block
was a map by action, `{ "timeline.start": "load" }`, and until 1.29 the list was called `actionTriggers`; older files
are converted on read.)

<!-- px-check schema PxActionEntrySchema -->
| Field | Means |
|---|---|
| `name` | what to do — the table below |
| `with` | what the action is given — by id, what it acts on, and how — [below](#what-an-action-is-given--with). None: its defaults |
| `triggers` | the events that set it off — any one of them. Each is an object: its `event` — `load` · `hoverIn` · `hoverOut` · `click` · `pointerDown` · `pointerUp` · `keyDown` · `keyUp`, or `flowStep.finished`: a flow step reached its end ([Moving between steps](#moving-between-steps)) — and where it is heard and with which fields ([below](#an-event-on-one-element-a-page-element-or-a-key)). None: nothing sets it off yet |
| `when` | what must hold for it to act — all of it: `flowSteps`, a flow is at one of these steps ([Only at some steps](#only-at-some-steps--whenflowsteps)); `condition`, a formula on variables that must be true ([formulas](../format/README.md#bindings--varname-and-calc)). None: it always acts |

<!-- px-check schema PxActionEntrySchema values=name -->
| `name` | Does | Acts while the playback is… | Editor label |
|---|---|---|---|
| `timeline.start` | a start — always from the start | **off, finished or returning** — and **playing** or **paused** when no other entry names the event: it restarts | *Start playback on* |
| `timeline.play` | starts, or carries on: resumes a pause, turns a picture on its way back around | **off, finished, returning or paused** — nothing to do while playing | — |
| `timeline.stop` | a stop, per the timeline's `whenStopped` (or the entry's own `with.whenStopped`) | **playing, paused or finished** | *Stop playback on* |
| `timeline.pause` | freezes the current frame | **playing** | *Pause playback on* |
| `timeline.resume` | carries on from there. **Derived unless the file has such an entry** ([below](#what-resumes-a-pause--derived-unless-named)) | **paused** | *Resume playback on* (shown, not edited) |
| `flow.goTo` | goes to `with.flowStep` and plays it ([Flows](#flows--named-steps-of-the-animation)) | **any state** — read before the actions above | *Add trigger* |
| `flow.next` | the next step of a flow; on the last, nothing | **any state** | *Add trigger* |
| `flow.previous` | the previous step; on the first, nothing | **any state** | *Add trigger* |
| `flow.nextOrWrap` | the next step; after the last, the first — a carousel, a toggle | **any state** | *Add trigger* |
| `flow.previousOrWrap` | the previous step; before the first, the last | **any state** | *Add trigger* |

`timeline.start` and `timeline.play` differ only when something is already going: a start always plays from the
start, a play carries on. A hover animation that should not jump back when the pointer returns mid-way uses
`timeline.play`; a splash that replays on every click uses `timeline.start`. (Until 1.25 the start carried
on by default, as `timeline.play` does now. A 1.25 file is converted on read: with that default, its hover and
click start events move to `timeline.play`, and `load` stays a start.)

An entry that does not fit the schema keeps what does: a trigger with an event its action may not name is dropped,
and an entry whose `name` is no action is **dropped whole** — with a warning
([PX1108](../diagnostics.md#what-the-document-says)). The type of one entry is `PxActionEntry` (its `name` a
`PxActionName`, its `with` that action's `PxActionArgs`, each trigger a `PxTriggerEventObject` whose `event` is a
`PxActionEvent`, its `when` a `PxActionWhen`), the list `PxActions`.

Two clicks make two toggles — spelt with the entries themselves, no extra key:

<!-- px-check off the two click toggles, prose -->
| Click toggles | Entries on `click` | A click while… |
|---|---|---|
| start / stop | `timeline.start` · `timeline.stop` | off starts it; playing or paused stops it |
| play / pause | `timeline.play` · `timeline.pause` | off starts it; playing pauses it; paused resumes it |

<!-- px-check values PxTriggerEvent pkg=core -->
| Event | Fires when… |
|---|---|
| `load` | the document is ready — the only event the visibility gate may hold back: nobody interacted, so it plays once enough of it is on screen |
| `hoverIn` | the pointer enters the element |
| `hoverOut` | the pointer leaves it — only after it entered (a pointer already over the element at load does not count) |
| `click` | the element is clicked (a tap on React Native) |
| `pointerDown` | a pointer button goes down on it (a finger touches) — with `pointerUp`, *press and hold* |
| `pointerUp` | it is released |
| `keyDown` | a key goes down — heard on the page while the animation is in view and no text field has the focus; narrow it with `with: { key }` |
| `keyUp` | it comes up |

One more event is not the page's: `flowStep.finished` (`PxStepEvent`; `finished` until 1.33) — a flow step reached
its end. Only the flow actions take it, and `when.flowSteps` says which steps
([Moving between steps](#moving-between-steps)); a `PxActionEvent` is either kind.

The vocabulary is open: a later interaction (focus, an app event) is a new word for `event`, never a new key.
A trigger with no `element` or `selector` hears the whole picture
([An event on one element, a page element, or a key](#an-event-on-one-element-a-page-element-or-a-key)).

### What an action is given — `with`

`with` is the action's arguments — the same object the page's call takes: `{ "name": "flow.goTo", "with": {
"flowStep": "open" } }` in a file is `player.flow.goTo({ flowStep: 'open' })` on a page
([Moving between steps](#moving-between-steps)):

<!-- px-check props PxActionArgs pkg=core -->
| `name` | `with` | Left out |
|---|---|---|
| `timeline.start` · `timeline.play` · `timeline.pause` · `timeline.resume` | `timeline` — the timeline it acts on, by its `id` (`PxTimelineActionArgs`) | the whole picture — every timeline and every flow | <!-- px names=timeline.start,timeline.play,timeline.pause,timeline.resume -->
| `timeline.stop` | `timeline`, as above · `whenStopped` — how this stop looks, a `whenStopped` word ([below](#an-entrys-own-manner--whenstopped-and-whenleaving)) (`PxStopActionArgs`) | the whole picture; the timeline's `whenStopped` |
| `flow.goTo` | `flowStep` — the step it goes to, by its `id`, or a timeline's id: the step a timeline no step names is · `whenLeaving` — how the current step is left this time (`PxGoToActionArgs`) | `flowStep` is required; `whenLeaving`: the step's own |
| `flow.next` · `flow.previous` · `flow.nextOrWrap` · `flow.previousOrWrap` | `flow` — the flow it steps through, by its `id` (`PxFlowStepActionArgs`) | `default` | <!-- px names=flow.next,flow.previous,flow.nextOrWrap,flow.previousOrWrap -->

### Which events each action may name

Each playback action names only the events that make sense for it; a trigger with any other event is dropped,
with a warning ([PX1110](../diagnostics.md#what-the-document-says)).

<!-- px-check values PxTriggerList pkg=core -->
| `name` | `load` | `hoverIn` | `hoverOut` | `click` | Why |
|---|---|---|---|---|---|
| `timeline.start` | ✓ | ✓ | — | ✓ | starting when the pointer *leaves* makes no sense |
| `timeline.play` | ✓ | ✓ | — | ✓ | the same as `timeline.start` |
| `timeline.stop` | — | — | ✓ | ✓ | stopping on load, or when the pointer *arrives*, makes no sense |
| `timeline.pause` | — | ✓ | ✓ | ✓ | a marquee pauses on hover-in, a hover animation on hover-out |
| `timeline.resume` | — | ✓ | ✓ | ✓ | derived unless the file names it — see below |

The four pressed events — `pointerDown`, `pointerUp`, `keyDown`, `keyUp` — may stand with every action, and the
flow actions take any event, `flowStep.finished` included.

### What resumes a pause — derived unless named

`timeline.resume` need not be written: when no entry names it, the player derives it from the
`timeline.start`, `timeline.stop` and `timeline.pause` entries. A paused animation then resumes on

1. the **counterpart** of each `timeline.pause` event — `hoverIn` ↔ `hoverOut`, `click` → `click`,
   `pointerDown` ↔ `pointerUp`, `keyDown` ↔ `keyUp` (`load` has none), and
2. the `timeline.start` events that do not also stop it — so a click that starts *and* stops
   (`timeline.start` and `timeline.stop` on `click`) stops a paused animation, as the entries say.

<!-- px-check off worked examples of the derived resume — the actions are checked in the tables above -->
| Entries (action on event) | Resume playback on | Plays as… |
|---|---|---|
| `timeline.start` on `load` · `timeline.pause` on `hoverIn` | `hoverOut` (and `load`, which has fired by then) | a marquee: runs on load, holds while the pointer is over it, carries on when it leaves |
| `timeline.start` on `hoverIn` · `timeline.pause` on `hoverOut` | `hoverIn` | a hover animation that holds where it is when the pointer leaves |
| `timeline.start` on `click` · `timeline.pause` on `click` | `click` | the play / pause click toggle: start → pause → resume → pause … |
| `timeline.start` on `click` · `timeline.stop` on `click` | — | the start / stop click toggle: one click starts it, the next stops it — also while paused |

`timeline.resume` entries the file **does** have are honoured as written. Where they differ from the
derivation — they name an event the derivation would not, or leave out one it would (that pause
then waits for another action: `timeline.play`, `timeline.stop` or `timeline.start`) — the player notes it
([PX1111](../diagnostics.md#what-the-document-says)), so a surprising resume is no mystery. An empty resume
list cannot be written: with no `timeline.resume` entry, the resume is derived.

### One event, several lists

An event may be named by entries of several actions. The player's **state** picks the actions it is read
for, in order, and the first action with an entry on the event wins — every button checks the state **as it was
when the event arrived**. The flow actions come first, in any state:

<!-- px-check off the state rule, prose — triggerActionFor is described under "For player authors" -->
| State | Actions, first match wins |
|---|---|
| `playing` | `timeline.pause` · `timeline.stop` · `timeline.start` (a play has nothing to do) |
| `paused` | `timeline.resume` · `timeline.play` · `timeline.stop` · `timeline.start` |
| `off`, `returning` | `timeline.start` · `timeline.play` |
| `finished` | last frame held (`whenFinished: 'hold'`): `timeline.stop` · `timeline.start` · `timeline.play`; otherwise `timeline.start` · `timeline.play` · `timeline.stop` |

- `timeline.play` and `timeline.pause` on `click`: a click while off starts, while playing pauses,
  while paused resumes.
- `timeline.start` alone on `click`: every click plays from the start — also while it is playing.
- `timeline.start` and `timeline.stop` on `click`, on a one-shot: a click on the finished animation
  undoes it while its last frame is held; when `whenFinished` already took the picture back, the click plays it
  again.

Two actions that react to the same event **in the same state** are a **collision**: the players
report it ([PX1109](../diagnostics.md#what-the-document-says)) and one of them wins.

<!-- px-check off collision cases — the actions are checked in the tables above -->
| Entries (action on event) | Collision? | What happens |
|---|---|---|
| `timeline.stop` on `click` · `timeline.pause` on `click` | **yes** — `timeline.stop` with `timeline.pause` | while playing, `timeline.pause` wins |
| `timeline.start` on `load` · `timeline.pause` on `hoverIn` · `timeline.stop` on `hoverOut` | **yes** — `timeline.stop` with the counterpart of a `timeline.pause` event | while paused, `hoverOut` resumes rather than stops |
| `timeline.start` on `click` · `timeline.play` on `click` | **yes** — `timeline.start` with `timeline.play` | while off, `timeline.start` wins — the file should name one |
| `timeline.play` on `click` · `timeline.pause` on `click` | no | the normal play / pause toggle — the state decides which action a click is read for |
| `timeline.start` on `click` · `timeline.stop` on `click` | no | the start / stop click toggle — the state decides which action a click is read for |
| `timeline.play` on `hoverIn` · `timeline.stop` on `hoverOut` | no | play on hover-in, stop on hover-out |

Every warning the players give about the entries, by kind:

<!-- px-check values PxTriggerIssueKind pkg=core -->
| Kind | Example | The player… | Code |
|---|---|---|---|
| `eventNotAllowed` | `timeline.stop` on `load` | ignores the trigger (in a file, the document repair drops it first — [PX1108](../diagnostics.md#what-the-document-says)) | [PX1110](../diagnostics.md#what-the-document-says) |
| `collision` | `timeline.stop` and `timeline.pause` on `click` | lets `timeline.pause` win while playing, the resume while paused, `timeline.start` over `timeline.play` while off | [PX1109](../diagnostics.md#what-the-document-says) |
| `resumeExtra` | `timeline.start` on `load` · `timeline.pause` on `hoverIn` · `timeline.resume` on `hoverOut` and on `click` | honours the entries as written; `click` is the event the derivation would not name | [PX1111](../diagnostics.md#what-the-document-says) |
| `resumeMissing` | `timeline.start` on `load` · `timeline.pause` on `hoverIn` and on `click` · `timeline.resume` on `hoverOut` | honours the entries as written; a pause by `click` then waits for `timeline.start` or `timeline.stop` | [PX1111](../diagnostics.md#what-the-document-says) |

### Absent, or empty

An absent `actions` list and an empty one, `"actions": []`, mean the same thing:
no entry, so nothing starts the animation until something drives it — your code's
`timeline.start()`, a component's `playback` prop, or an `actions` list given to the player. A file that plays by
itself says so: `"actions": [{ "name": "timeline.start", "triggers": [{ "event": "load" }] }]`. The editor always writes
it, and files saved before schema 1.17 — when an absent block still meant `load` — get the entry written in when they are
migrated. WHY: a default nobody wrote is a guess, and an absent block meaning something other than an
empty one trapped every merge patch, hand edit and tool that drops empty objects.

**Pause and carry on need no setting.** "Pause when the pointer leaves" is a `timeline.pause` entry on
`hoverOut` (hover-in resumes it — derived); "keep playing" is no entry on `hoverOut` at all. That is
what the editor does for you: ticking *Hover in* under *Start playback on* adds *Hover out* under *Pause playback
on*, editable.

## How a stop looks — `whenStopped`

`timeline.whenStopped` says how a stop looks — every stop: a `timeline.stop` entry, `playback="off"`,
`timeline.stop()`. It is one word, a **preset**: where the move goes and how it gets there. Every setting has a
stated default, so a document that says nothing plays the way it always did: a stop jumps back to the start, a
finished playback holds its last frame (`whenFinished`, [below](#once-finished--whenfinished)), an animation scrolled
away pauses (`whenOutOfView`, [the visibility gate](#whether-it-may-run--the-visibility-gate)). One entry can stop
another way with its own `with.whenStopped` ([below](#an-entrys-own-manner--whenstopped-and-whenleaving)). A start has nothing to configure: it
always plays from the start. (Until 1.29 the timeline's `actions` block said it — `"timeline.stop": "animateToStart"`,
or `{ "behavior": "animateToStart" }`; `actions["timeline.start"]` until 1.25.)

### The action words

There are two kinds of words. **State words** change the playback state: the buttons `start`, `play`, `stop`,
`pause`, `resume`, and the gate's `pause` and `stop`. **Move words** change only the picture — **where** it goes
(`…ToStart` / `…ToEnd`) and **how** (`jump…` at once, `animate…` playing there):

<!-- px-check off the one table of action words — each slot's values are checked in its own table below -->
| Word | Means | Taken by |
|---|---|---|
| `jumpToStart` | at once to the rest pose (`whenIdle`: the file's static look, or the first frame) | `whenStopped` · `whenFinished` |
| `animateToStart` | plays backwards to the rest pose | `whenStopped` (the `returning` state) · `whenFinished` |
| `jumpToEnd` | at once to the end of the current pass (a one-shot: the playback's end) | `whenStopped` |
| `animateToEnd` | plays on to the end of the current pass | `whenStopped` |
| `animateToEndAndBack` | plays on to the end of the current pass, then backwards to the rest pose | `whenStopped` |
| `hold` | stays where it is | `whenFinished` |

**A stop that goes to the end leaves the playback `finished`** — `jumpToEnd` and `animateToEnd` arrive at the end
of the **current pass** (on a one-shot, the playback's end), the state is `finished`, and `whenFinished` then says
what the picture shows, as after a natural end. `animateToEndAndBack` does not use `whenFinished`: it finishes the
pass, then plays back to the rest pose, and the playback is `off`. WHY these words (`reset` / `rewind` / `restart`
/ `completeIteration` until 1.22): one destination word and one manner word say what a reader had to look up —
"reset to where?", "rewind how?", "complete what?".

<!-- px-check off worked examples — the words are checked in the tables below -->
| You want | `whenStopped` | What happens |
|---|---|---|
| stop after this pass — a heartbeat should not die mid-beat | `'animateToEnd'` | a stop plays on to the end of the current pass; the playback is `finished` there — `whenFinished: 'hold'` rests on that frame |
| …then snap back | `'animateToEnd'` + `whenFinished: 'jumpToStart'` | the beat completes, then the rest pose — a natural end does the same |
| …then play it back | `'animateToEndAndBack'` | the beat completes, then plays backwards to the rest pose; a natural end still does what `whenFinished` says |
| a lid that opens on hover-in and closes animated on hover-out | `'animateToStart'` | a stop plays backwards from wherever it is |

<!-- px-check schema PxTimeTimelineSchema partial -->
| Timeline key | Values | Default |
|---|---|---|
| `whenStopped` | `jumpToStart` · `animateToStart` · `jumpToEnd` · `animateToEnd` · `animateToEndAndBack` | `jumpToStart` |
| `whenOutOfView` | `pause` · `continue` · `stop` | `pause` — [the visibility gate](#whether-it-may-run--the-visibility-gate) |
| `whenLeaving` | `jump` · `animateToEnd` · `animateToStart` | `jump` — how its step is left when another step of the flow is asked for ([Flows](#flows--named-steps-of-the-animation)) |

`timeline.start`, `timeline.play`, `timeline.pause`, `timeline.resume` and the return into view have nothing to
configure.

<!-- px-check values PxStopPlaybackBehavior pkg=core -->
| `timeline.whenStopped` | A stop (a `timeline.stop` entry, `playback="off"`, `timeline.stop()`)… |
|---|---|
| `jumpToStart` (default) | jumps back to the rest pose at once (was `reset`) — `off` |
| `animateToStart` | plays backwards to the rest pose from wherever it is — the `returning` state (was `rewind`), then `off` — the trash-can lid: opens on hover-in, closes animated on hover-out |
| `jumpToEnd` | jumps to the end of the current pass — `finished`, then `whenFinished` applies |
| `animateToEnd` | plays on to the end of the current pass — `finished`, then `whenFinished` applies — "stop after this pass" (was `stop.completeIteration: true`); a one-shot runs to its end first |
| `animateToEndAndBack` | plays on to the end of the current pass, then backwards to the rest pose — `returning` on the way back, then `off`; `whenFinished` is not used |

`onPlaybackStop` fires when the stop is performed: at once, or on arrival at the end for the three that finish
the pass first. With `jumpToEnd` or `animateToEnd`, a stop on a playback that is already finished does nothing;
the other three take it back to the rest pose.

### An entry's own manner — `whenStopped` and `whenLeaving`

An entry can say in its `with` how ITS move looks, over the timeline's or the step's own setting:

```json
"actions": [
  { "name": "timeline.play", "triggers": [ { "event": "hoverIn" } ] },
  { "name": "timeline.stop", "with": { "whenStopped": "animateToStart" }, "triggers": [ { "event": "hoverOut" } ] },
  { "name": "timeline.stop", "triggers": [ { "event": "click" } ] }
]
```

Read cold: when the pointer leaves, the picture plays back; a click stops it the timeline's way — its `whenStopped`,
here the default `jumpToStart`. Two actions take a manner (until 1.33 both were a rule's `behavior`):

<!-- px-check off the two actions that take a manner, prose -->
| `name` | In `with` | Instead of |
|---|---|---|
| `timeline.stop` | `whenStopped` — a `whenStopped` word | the timeline's `whenStopped` |
| `flow.goTo` | `whenLeaving` — how the current step is left: `jump` · `animateToEnd` · `animateToStart` | the current step's `whenLeaving` |

`playback="off"` and `timeline.stop()` have no entry, so they always stop the timeline's way.

### Once finished — `whenFinished`

Nobody presses the end of the playback: the clock gets there. When the last pass ends by playing, the playback
is `finished` — and it stays `finished` until the next start, stop or seek, **whatever the picture then shows**.
`timeline.whenFinished` moves only the picture; it is a plain key beside `whenStopped` and `whenIdle`
(`atEnd` until 1.25, `actions.finish` until 1.23). It applies to every way a playback becomes finished: the
natural end, which reports `onPlaybackFinish`, and a stop that goes to the end (`jumpToEnd`, `animateToEnd`),
which reports `onPlaybackStop`:

<!-- px-check values PxWhenFinished pkg=core -->
| `timeline.whenFinished` | What the picture shows once the playback is finished |
|---|---|
| `hold` (default) | keeps the last frame showing |
| `jumpToStart` | jumps back to the rest pose (was `reset`) |
| `animateToStart` | plays backwards to the rest pose (was `rewind`); `timeline.play()` on the way turns it around |

The state is `finished` in all three, so code can always ask whether the animation finished. It changes one
trigger case: a click listed under both `timeline.start` and `timeline.stop` undoes a finished animation while its
last frame is held, and plays it again once `whenFinished` took the picture back
([One event, several lists](#one-event-several-lists)).

In a file: `"timelines": [{ "whenFinished": "hold" }]` (a step has its own — [Flows](#flows--named-steps-of-the-animation)); per mount, the same key inside `timelineOptions`
(`timelineOptions={{ whenFinished: 'jumpToStart' }}`). The schema of the key is `PxWhenFinishedSchema`.

### What shows while off — `whenIdle`

`jumpToStart` and `animateToStart` land on ONE picture wherever they appear: the **rest pose** — by
default the SVG as authored. A hand-authored file whose static attributes differ from its first
keyframe can ask for the **first frame** instead with `timeline.whenIdle`, which governs the whole
**off** state — before the first start, after a stop that went back to the start (a paused animation shows its
paused frame, a finished one whatever `whenFinished` shows).

It is CSS's `animation-fill-mode`, split in two: what shows **before** the playback is `whenIdle`, what
stays **after** it is `whenFinished`.

<!-- px-check off the fill-mode correspondence, prose -->
| CSS `animation-fill-mode` | SVGA |
|---|---|
| `backwards` | `whenIdle: 'firstFrame'` |
| `forwards` | `whenFinished: 'hold'` (the default) |
| `both` | both of the above |
| `none` | neither — `whenIdle: 'static'` and a `whenFinished` that goes back to the start |

WHY `whenIdle` (`showWhenStopped` until 1.18): "stopped" read as played-then-stopped, "before start"
as the first start only; `idle` is WAAPI's word for the state with no playback. The playback's own readout says
`off` since 1.24 (`timeline.getState()`, `PxPlaybackState` — `idle` until 1.23); the key keeps WAAPI's word for
what shows while there is no playback:

<!-- px-check values PxWhenIdle pkg=core -->
| `timeline.whenIdle` | What is shown while off |
|---|---|
| `static` (default) | the SVG as authored |
| `firstFrame` | the first frame's values. The editor never writes it: in its files the two are the same picture |

A **one-shot document** driven by a component's `playback` prop reads these settings too:
`playback="on"` is a start (it plays to the end, and the picture then follows `whenFinished` — the last frame
by default), `playback="off"` a stop (`jumpToStart` snaps back, `animateToStart` plays back). The trash-can
lid that closes animated is `timelineOptions={{ whenStopped: 'animateToStart' }}`.

### Whether it may run — the visibility gate

An animation nobody can see does not play, whatever started it. The gate is a **condition on
every driver** — the triggers, a component's `playback` prop and the API alike — not an event: once
none of it is on screen the player does what `whenOutOfView` says, and once it is seen
again it undoes what it did. The gate presses the real buttons, so `timeline.getState()` and the callbacks
tell the truth while the animation is off screen. `whenOutOfView` is a plain timeline key, and so are the
two numbers that say when the sensor counts it as seen:

<!-- px-check values PxOutOfViewBehavior pkg=core -->
| `timeline.whenOutOfView` | Effect while none of it is on screen |
|---|---|
| `pause` (default) | pauses a playing animation — `paused`, `onPlaybackPause` — and resumes it when it comes back (`onPlaybackResume`) |
| `continue` | keep playing — and start without waiting to be seen at all |
| `stop` | stops a playing or finished animation at once — `off`, `onPlaybackStop`; no animated return, `whenStopped` is not used — and starts it again from the start when it comes back (`onPlaybackStart`) (`jumpToStart` until 1.25) |

<!-- px-check off two plain numbers, not a closed value list — the schema block in the format guide carries their types -->
| Field | Default | Meaning |
|---|---|---|
| `timeline.inViewThreshold` | `0.5` | how much of the element must be on screen before it may run: `0` any part, `0.5` half of it, `1` all of it. Playback stops only at **zero** visibility, so an element resting on the boundary cannot flicker |
| `timeline.inViewDebounce` | `150` | and for how long, in ms. Scrolling straight past an animation therefore starts nothing; `0` starts the moment the threshold is met |

Coming back into view needs no setting: the gate undoes what it did — it resumes its own pause, starts again
after its own stop — and only that. A playback your page paused stays paused, and one that a button or a seek
changed while it was off screen is left as it is. A picture on its way back to the rest pose when it leaves
the screen goes there at once. (Until 1.25 the gate held the clock without pressing a button, so no callback
reported it and the state did not change.) A hidden browser tab counts as out of view. An element taller than the screen counts as fully visible once it fills the screen,
so a threshold of `0.5` or `1` can always be met. Where nothing can measure visibility — a server
render, a test environment without `IntersectionObserver` — the animation plays as if fully
visible, rather than silently never playing.

**To play an animation when it scrolls into view**, nothing has to be set: a `timeline.start` entry on `load` behind
the default gate IS that behaviour — it waits on its first frame until half of it is on screen
for 150 ms, plays, pauses when scrolled away, and carries on when it comes back.

### Where triggers work

- **Every player** — web, React, Vue and React Native — honours the `actions` entries, `whenStopped` and the
  gate, with one exception: React Native has no `hoverIn` / `hoverOut`, because there is no hover
  on a touch screen. React Native plays the first timeline only.
- **Pre-rendered SVG + CSS animation + JS triggers** honours all of them too. The editor writes a
  few lines of script into the file for this; no library is involved.
- **Pre-rendered SVG + CSS animation** (no script at all) listens for `load` and, through CSS
  `:hover`, for `hoverIn` and `hoverOut` — `hoverOut` may pause or stop, not both. `click` and the
  visibility gate cannot be done in pure CSS and are dropped from the file; `whenStopped` keeps
  its default (a class cannot jump keyframes to their start or end, or play them backwards). The editor marks every
  choice *(CSS)* or *(JS)* so you see what the script-free flavour keeps. See
  [Pre-rendered SVG](https://pixodesk.com/docs/svga/prerendered-svg/on-the-web#flavour-1--svg--css-animation).
- **The CSS components** (`SvgCssAnimationPlayer` in React and Vue) take the JS component's prop
  names, narrowed: `actions` (the list) and `timelineOptions` with the gate — the two numbers and
  `whenOutOfView` — read with the same rules. A script-free SVG carries no triggers the
  component could read, so with no `actions` nothing starts it. Accepted limits of a class toggle: a start that is not
  from rest restarts by remounting the content (a class cannot rewind keyframes), the stop is always
  `jumpToStart`, there is no `finished` state (the class toggle does not see the CSS animation end), and
  `whenIdle` / `whenFinished` are the file's own CSS.

### An event on one element, a page element, or a key

A trigger can be heard somewhere else than the whole picture, or narrowed (2026-11-15):

```json
"actions": [
  { "name": "timeline.start", "triggers": [ { "event": "load" }, { "event": "click", "element": "#lens" } ] },
  { "name": "flow.next", "triggers": [
    { "event": "click", "selector": ".next-step" },
    { "event": "keyDown", "with": { "key": "ArrowRight" } }
  ] },
  { "name": "timeline.pause", "triggers": [ { "event": "pointerDown", "with": { "button": 2 } } ] }
]
```

A trigger is an event object (`PxTriggerEventObject`) — always an object, never a bare word (1.33) — with four fields:

<!-- px-check schema PxTriggerEventObjectSchema -->
| Field | Means |
|---|---|
| `event` | one of the events — one its action may name; a flow action takes any |
| `element` | one element **of the picture**, by its id (`"#lens"`). The player renders fresh ids and follows them; a hover counts only on crossing that element's edge. An id the picture lacks is reported (PX1113) |
| `selector` | an element **of the page**, by CSS selector — a *Next* button outside the animation |
| `with` | fields the event must have — below. (The entry's own `with` is the action's arguments; a trigger's is the event's fields) |

Neither `element` nor `selector`: the whole picture. In core's helpers an event is a `PxTriggerEventEntry` — a bare
word (the whole picture) or a `PxTriggerEventObject`; `with` is a `PxTriggerEventFilter`.

<!-- px-check schema PxTriggerEventFilterSchema -->
| `with` field | The event must have… |
|---|---|
| `key` | that key, as the browser names it — `"Enter"`, `"ArrowRight"`, `"s"` |
| `code` | that physical key — `"Space"`, `"KeyS"` |
| `ctrlKey` | Ctrl down (`true`) or up (`false`) |
| `shiftKey` | Shift down or up |
| `altKey` | Alt (⌥) down or up |
| `metaKey` | ⌘ (Windows key) down or up |
| `metaOrCtrlKey` | ⌘ or Ctrl — *⌘S on a Mac, Ctrl+S elsewhere* in one entry |
| `button` | that pointer button: 0 left, 1 middle, 2 right |
| `pointerType` | `mouse` · `touch` · `pen` (`PxPointerType`) |

A key event is heard on the page — the animation has no focus of its own — while the animation is in view and no text
field has the focus. React Native hears `click` and `pointerDown` / `pointerUp` on the whole picture only.

## Flows — named steps of the animation

A **flow step** is a named piece of the animation — idle, hover, loading, success — given as **a part of one
timeline**, or the whole of it. The steps of a **flow** play one at a time: exactly one is current, and while it is
current it plays with the ordinary playback — off · playing · paused · finished — on its own timeline. Several flows
run at the same time. The page, or the file's own `actions`, moves from step to step.

```json
"animator": {
  "timelines": [ { "outTime": 3000 } ],
  "flowSteps": [
    { "id": "intro",   "timelineOptions": { "inTime": 0, "outTime": 1000 } },
    { "id": "loading", "timelineOptions": { "inTime": 1000, "outTime": 2000, "iterations": "infinite", "whenLeaving": "animateToEnd" } },
    { "id": "success", "timelineOptions": { "inTime": 2000, "outTime": 3000 } }
  ],
  "actions": [
    { "name": "timeline.start", "triggers": [ { "event": "load" } ] },
    { "name": "flow.next", "triggers": [ { "event": "flowStep.finished" } ], "when": { "flowSteps": ["intro"] } },
    { "name": "flow.goTo", "with": { "flowStep": "success" }, "triggers": [ { "event": "click", "selector": "#save" } ] }
  ]
}
```

Read cold: the intro plays once and goes on to the loading loop by itself; a click on the page's *Save* button asks
for the success — the loop first finishes its pass, then the success plays and holds its last frame. The three
steps name no `flow`, so they are the flow `default`, and no `timeline`, so they are parts of the default timeline.
(Until 1.33 a step's timeline keys stood on the step itself and an entry said `"event": "finished"`, `"from": "intro"`;
until 1.29 a step said where it goes on at its end in its own `whenFinished`; until 2026-11-22 the steps were `states`
in `stateMachines`, until 2026-11-20 the timeline's `segments`; older files are converted on read.)

**A step is its timeline with some options changed** — `timelineOptions`, the same word as the page's override: its
part, its repeats, direction, speed, delay and end, how it is stopped and how it is left. What it does not say, it takes
from the timeline (but a timeline's `delay` is waited only by the timeline's own step). While a flow is at a step,
**the playback is that step's**: `timeline.start()` plays it, `getDuration()` is its pass, a seek lands inside it. A
step of no length (`inTime` = `outTime`) holds that frame.

<!-- px-check schema PxFlowStepSchema -->
| Field | Means |
|---|---|
| `id` | what entries of `actions` (`with.flowStep`, `when.flowSteps`), `effects.show` and the page call it — unique in `flowSteps`: a later step with an id already used is ignored, with a warning ([PX1115](../diagnostics.md#what-the-document-says)). It is the step's name too (a separate `name` label until 1.33) |
| `flow` | the flow it belongs to, by its `id`. None: the flow `default` |
| `timeline` | the timeline it is a part of, by its `id`. None (or `""`): the default timeline |
| `timelineOptions` | the keys of that timeline it plays differently (`PxFlowStepTimelineOptions`) — the rows below, each optional |
| `timelineOptions.inTime` | where its part of that timeline starts, ms (default: the timeline's window) |
| `timelineOptions.outTime` | …and ends |
| `timelineOptions.iterations` | passes, or `"infinite"` (default: the timeline's) |
| `timelineOptions.iterationDirection` | as the timeline's |
| `timelineOptions.playbackSpeed` | as the timeline's, on top of the player's speed |
| `timelineOptions.delay` | waited whenever the step starts to play, ms. None: no wait — a written step never waits its timeline's `delay` |
| `timelineOptions.whenFinished` | after its last pass, what the picture shows: `hold` · `jumpToStart` · `animateToStart` (default: the timeline's, else `hold`). Going on is an entry's — [a step's end](#a-steps-end--flowstepfinished) |
| `timelineOptions.whenStopped` | how a stop looks while it is current — a `whenStopped` word (default: the timeline's) |
| `timelineOptions.whenLeaving` | how it is left when another step is asked for (`PxWhenLeaving`): `jump` at once · `animateToEnd` this pass first · `animateToStart` played back to its start (default: the timeline's `whenLeaving`, else `jump`) |

Where a flow starts is not a step's key: it is the flow's `initialFlowStep` ([Several flows](#several-flows)).

### A step's end — `flowStep.finished`

Where a step goes on at its end is an entry like any other, triggered by `flowStep.finished`; `when.flowSteps` names
the step:

<!-- px-check values PxFlowAction pkg=core -->
| Action | The entry | Goes to |
|---|---|---|
| `flow.goTo` | `{ "name": "flow.goTo", "with": { "flowStep": "hover" }, "triggers": [{ "event": "flowStep.finished" }], "when": { "flowSteps": ["intro"] } }` | that step |
| `flow.next` | `{ "name": "flow.next", "triggers": [{ "event": "flowStep.finished" }], "when": { "flowSteps": ["intro"] } }` | the next step of the step's own flow — on the last, none: it holds |
| `flow.previous` | `{ "name": "flow.previous", "triggers": [{ "event": "flowStep.finished" }], "when": { "flowSteps": ["intro"] } }` | the previous one — on the first, none |
| `flow.nextOrWrap` | `{ "name": "flow.nextOrWrap", "triggers": [{ "event": "flowStep.finished" }] }` | the next one — after the last, the first: a chain that plays round and round |
| `flow.previousOrWrap` | `{ "name": "flow.previousOrWrap", "triggers": [{ "event": "flowStep.finished" }], "when": { "flowSteps": ["intro"] } }` | the previous one — before the first, the last |

- A `flowStep.finished` entry with no `when.flowSteps` is **every** step's end: a slideshow that steps on by itself is
  one entry — with `flow.next` it stops on its last step, with `flow.nextOrWrap` it starts again.
- The first entry that fits the step wins; with none, the step holds — its `whenFinished` says what shows.
- `flowStep.finished` takes only the flow actions, and a step that goes on reports no finish.

(Until 1.29 the step's own `whenFinished` said where it goes on.)

### The flow `default` and the default timeline

**The default timeline** is the timeline with no `id` — wherever it stands in `timelines`; a file has at most one (a
second one with no id is not read). Keyframes that name no timeline are its. From outside it is called `""` — the
constant `PX_DEFAULT_TIMELINE`; `default` is an ordinary timeline id.

**The flow `default`** holds the steps that name no flow, **and one step for every timeline no step names** — the
whole of that timeline, called by the timeline's id (the default timeline's step: `default`). Such a step plays exactly as
the timeline alone does: its `delay`, its `whenIdle`. In the flow, written steps keep their order and a timeline's own
step stands at its timeline's place; the flow starts at the first unless `{ "id": "default", "initialFlowStep": "…" }`
in `flows` names another. So a file with one
timeline is a flow of one step, and plays as it always did — and **two timelines with nothing else are one flow of two
steps**, one at a time: only flows run side by side.

```json
"timelines": [ { "outTime": 2000, "iterations": "infinite" }, { "id": "hover", "outTime": 150 }, { "id": "press", "outTime": 200 } ],
"actions": [
  { "name": "timeline.start", "triggers": [ { "event": "load" } ] },
  { "name": "flow.goTo", "with": { "flowStep": "hover" }, "triggers": [ { "event": "hoverIn" } ] },
  { "name": "flow.goTo", "with": { "flowStep": "press" }, "triggers": [ { "event": "pointerDown" } ] }
]
```

A button with no step written: the flow `default` is `default` (the idle loop) · `hover` · `press`.

### Several flows

`animator.flows` lists flows by id; a flow that only steps name is a flow too. Flows do not know of each other: a
button's pointer steps and its notification badge each have their own, and both play at once.

<!-- px-check schema PxFlowSchema -->
| Field | Means |
|---|---|
| `id` | what a step's `flow`, a `flow.next`'s `with.flow` and the page call it — unique in the list; its name too (a separate `name` label until 1.33). `default` only labels the flow `default` |
| `initialFlowStep` | the step it starts at, by its `id`. None: its first step (a step's `initial: true` until 1.33) |

```json
"flowSteps": [
  { "id": "idle",    "flow": "pointer", "timeline": "grow", "timelineOptions": { "inTime": 0, "outTime": 0 } },
  { "id": "hover",   "flow": "pointer", "timeline": "grow", "timelineOptions": { "whenLeaving": "animateToStart" } },
  { "id": "calm",    "flow": "notice",  "timeline": "ring", "timelineOptions": { "inTime": 0, "outTime": 0 } },
  { "id": "ringing", "flow": "notice",  "timeline": "ring", "timelineOptions": { "inTime": 0, "outTime": 600, "iterations": 3 } },
  { "id": "unread",  "flow": "notice",  "timeline": "ring", "timelineOptions": { "inTime": 600, "outTime": 1400 } }
],
"flows": [ { "id": "pointer" }, { "id": "notice", "initialFlowStep": "ringing" } ],
"actions": [
  { "name": "flow.next", "triggers": [ { "event": "flowStep.finished" } ], "when": { "flowSteps": ["ringing"] } }
]
```

`idle` and `hover` are `pointer`; `calm`, `ringing` and `unread` are `notice`, three parts of one timeline, `ring` —
`notice` starts at `ringing`, then rests on `unread`. The default timeline, which no step names, is the flow `default`
— it plays beside both.

### Several timelines and `byTimeline`

A file can hold several timelines. The default timeline carries the plain keyframes; any other is named by its `id`,
and an attribute that moves on it says what it does there in **`byTimeline`** — its `keyframes`, counted from that
timeline's time 0. Plain `keyframes` and `byTimeline` can stand side by side. On a timeline with no keyframes for it,
the attribute has the node's own value. A node names timelines only, never a step — so cutting or regrouping steps
touches no node.

```json
"timelines": [
  { "outTime": 4000, "iterations": "infinite" },
  { "id": "grow", "outTime": 150 },
  { "id": "dip",  "outTime": 200 }
],
"children": [
  { "type": "rect", "id": "bg", "width": 200, "height": 80, "fill": "#2a7fff",
    "animate": {
      "scale": { "byTimeline": [
        { "timeline": "grow", "keyframes": [ { "time": 0, "value": 1 }, { "time": 150, "value": 1.08 } ] },
        { "timeline": "dip",  "keyframes": [ { "time": 0, "value": 1.08 }, { "time": 100, "value": 0.96 }, { "time": 200, "value": 1.08 } ] } ] } } }
]
```

`byTimeline` works wherever an animated value does — a node's `animate`, a shared animation in
`definitions.animations`, and the animatable parameters of effects. One entry is a `PxTimelineTrack`; the full shape
is on the [JSON format page](../format/README.md#timelines-flows-and-flow-steps).

### Moving between steps

<!-- px-check off the four ways to move a step, prose -->
| From | How |
|---|---|
| an entry of the file | `{ "name": "flow.goTo", "with": { "flowStep": "success" }, "triggers": [{ "event": "click" }] }`; `flow.next` / `flow.previous` (`…OrWrap` to go round) with an optional `with.flow` — any event, read before the playback actions ([Triggers](#triggers--when-it-plays)) |
| a step's end | an entry on `flowStep.finished` — [above](#a-steps-end--flowstepfinished) |
| page code | `player.flow.goTo({ flowStep: 'success' })`, `.next({ flow? })`, `.previous({ flow? })`, `.nextOrWrap({ flow? })`, `.previousOrWrap({ flow? })` — the entry's `with` object, never bare strings; `.get(flow?)` is the current step of each running flow, a list; `.getAll()` every id — [the web player](./web-player.md#the-playback-api) |
| a component | the `flowStep` prop — one id, or a list with one id per flow: `<SvgAnimationPlayer document={saveIcon} flowStep={status} />` (React, Vue) |

`onFlowStepChange(flowStep, previous, flow)` tells the page (`flow` is `default` for the flow `default`) — the Vue event
is `flowStepChange`. Going to the current step does nothing; an id the file does not have is ignored and reported
([PX1114](../diagnostics.md#what-the-document-says)); a request while a step is leaving replaces the earlier one — the
newest wins — and a next or previous then counts from the step it is heading to: two presses of *Next* while a step
finishes its pass move two steps (1.30). While the `flowStep` prop is set, the page holds that flow and the file's entries for it rest; at mount a
step that ends is shown at its end without playing, one that repeats plays. The prop's type is `PxFlowStepProps`, the
handle's `PxFlowControls` (its arguments `PxGoToActionArgs` and `PxFlowStepActionArgs` — the same objects as an
entry's `with`), the wire types `PxFlowStep`, `PxFlowStepTimelineOptions` and `PxFlow`.
`player.flow.goTo({ flowStep: 'success', whenLeaving: 'animateToEnd' })` takes a way of leaving too — a `whenLeaving`
word over the current step's. (Until 1.33 the calls took plain strings: `goTo('success', 'animateToEnd')`, `next('menu')`.)

### Content shown only in some steps — `show`

An element can be shown only while one of its steps is current — the pages of a presentation, the splash of a
fish (1.31; `showIn` until 1.33):

```json
"children": [
  { "type": "g", "id": "page1", "effects": { "show": { "when": { "flowSteps": ["intro"] } } } },
  { "type": "g", "id": "page2", "effects": { "show": { "when": { "flowSteps": ["details", "summary"] } } } },
  { "type": "g", "id": "footer" }
]
```

Any listed step of any flow counts; a flow the page does not run counts as at its start step. The element is hidden
at once with its own `display: none` (no transition yet), so it takes no clicks either; while a step finishes its
pass, its content stays until the flow lands. [The format](../format/README.md#show) has the details. Its `when` is
the same word as an entry's `when`.

### Only at some steps — `when.flowSteps`

`when.flowSteps` limits an entry to some steps: it acts only while a flow is at one of them (1.29; a rule's `from`
until 1.33).

```json
"actions": [
  { "name": "flow.goTo", "with": { "flowStep": "open" },   "triggers": [ { "event": "click" } ], "when": { "flowSteps": ["closed"] } },
  { "name": "flow.goTo", "with": { "flowStep": "closed" }, "triggers": [ { "event": "click" } ], "when": { "flowSteps": ["open"] } }
]
```

Read cold: one click opens, the next closes — each entry waits at its own step. `flowSteps` is always a list
(`["idle", "hover"]`); an entry with none acts at every step. Any action takes it — a `timeline.pause` that only the
loading loop hears is `{ "name": "timeline.pause", "triggers": [{ "event": "click" }], "when": { "flowSteps": ["loading"] } }`.
On a `flowStep.finished` entry, it names the steps whose end it is. Beside it, `when.condition` is a formula on
variables that must be true as well — `"when": { "condition": "calc(var(progress) >= 1)" }`
([formulas](../format/README.md#bindings--varname-and-calc)). Only `true` counts: a number, a text, a name with no value
or a formula that does not parse is not true. The type of `when` is `PxActionWhen`.

**An entry with no triggers** acts at the moment its `when` becomes true — the condition turns true, or the flow arrives
at one of its `flowSteps` with the condition already true; true when the player starts, it acts once then. It is checked
on the next frame after a variable or the step changes, so two entries that are always true cannot spin: one acts per
frame. A loading step that ends when the page says so:

```json
{ "name": "flow.goTo", "with": { "flowStep": "done" }, "when": { "flowSteps": ["loading"], "condition": "calc(var(progress) >= 1)" } }
```

The web player, React and Vue read it, and so does a pre-rendered SVG + JS file; React Native reads no `condition` yet.

<!-- px-check schema PxActionWhenSchema -->
| `when` field | The entry acts only… |
|---|---|
| `flowSteps` | while a flow is at one of these steps — ids of `flowSteps` |
| `condition` | while this formula on variables is true — `"var(unlocked)"`, `"calc(var(progress) >= 1)"` |

### What runs — the page's lists

With no word from the page every flow runs. The `flows` and `timelines` options and props (`PxRunListProps`) say
exactly what runs instead: `flows` — those flows; `timelines` — each of those timelines whole, by itself, side by side.
`default` names the flow `default`; `""` (`PX_DEFAULT_TIMELINE`) names the default timeline. What does not run holds nothing: its attributes show the
elements' own values and its `actions` entries are not heard. A changed list plans again over the same picture — the element stays.
A name the file does not have is ignored, with a warning ([PX1507](../diagnostics.md#the-props-a-component-was-given)).

```tsx
<SvgAnimationPlayer document={bell} flows={['notice']} />                 // only the notification
<SvgAnimationPlayer document={bird} timelines={['flap', 'glide']} />      // two timelines at once, no flow
```

### How it plays

<!-- px-check off how flows play, prose -->
| | |
|---|---|
| A step | plays with the ordinary playback on its own timeline. Going to another step stops it — it lets go of what it holds — and the next plays from its start, also when the playback was paused or off |
| `timeline.*` with no `timeline` | acts on the whole picture — every flow. With a `timeline`: on the flow that plays it |
| `player.timeline` | its buttons and speed act on the whole picture; its reads and seeks are of the first flow that runs — its current step. `player.getTimeline(id)` is the same kind of handle for the flow that plays that timeline (`""`, `PX_DEFAULT_TIMELINE`: the default timeline; `undefined` for an id the file lacks or that does not run) |
| The callbacks | `onPlaybackStart` … `onPlaybackFinish` report the first flow; `onFlowStepChange` reports every flow. A step that goes on at its end reports no finish |
| Key events | heard on the page, only while the picture is in view and not while typing in a field |
| What shows before anything plays | a timeline's own step: its `whenIdle`; a written step: its first frame; an attribute no running step moves: the node's own value |
| A timeline's `delay` | waited only by a timeline's own step — a written step waits only its own `timelineOptions.delay` |
| A scroll timeline | an entry with `"type": "scroll"`. The whole of it is a step, moved by the scrolling while the others go on; a part of it is not read |
| Two flows on one attribute | the first that runs keeps it (a node's transform parts count as one attribute) — the page's order decides |

### Checks

Each is a finding of the file check; none stops a file from playing — the player keeps the first and goes on.
Repeated step ids are [PX1115](../diagnostics.md#what-the-document-says), a `flow.goTo` naming no step
[PX1114](../diagnostics.md#what-the-document-says); every other finding is
[PX1116](../diagnostics.md#what-the-document-says), with its `kind`:

<!-- px-check values PxTimelineIssueKind pkg=core -->
| `kind` | When | What the player does |
|---|---|---|
| `idDuplicate` | two timelines (also two with no id), or two flows, share an id | the first wins |
| `referenceNotFound` | a `timeline`, `flowStep` or `flow` names nothing — on a step, an entry's `with` or a `byTimeline` entry | it is not read |
| `timelineShared` | steps of two flows are on one timeline | the first flow keeps it |
| `partOfScrollTimeline` | a step on a part of a scroll timeline | not read |
| `attributeSplit` | one attribute is moved by two flows. A node's transform parts (translate, rotate, scale, skew, origin) count as one attribute | the first wins |
| `keyframesWithoutDefault` | plain `keyframes` in a file whose timelines all have an id | they are no timeline's: not played |

### Accepted limits

<!-- px-check off accepted limits, prose -->
| Limit | The way round |
|---|---|
| One step — one timeline: two clocks of different length in one step cannot be said | two flows moved by the same event — or one timeline and a per-property `loop` |
| No blend between two timelines, no crossfade between two steps | two steps on one timeline: it plays from one part to the other — `whenLeaving` |
| An id is unique in its whole list — two steps cannot both be `open` | `eyesOpen`, `mouthOpen` — the id is the name |
| The transform parts of one node are one attribute — `scale` in one flow and `rotate` in another: the first flow keeps both | a group around the node takes the second move, as in SVG itself |
| An entry applies in every step of its flow | `when.flowSteps` — [Only at some steps](#only-at-some-steps--whenflowsteps) |
| `getState()` naming the step | `flow.get()` beside it |
| `timelineOptions` changing one step | `timelineOptions` patches the default timeline only; steps are the file's |
| Exports other than the players — SVG + CSS with no script, Lottie, video | one timeline, whole |
| React Native | one flow — the first that runs ([PX1605](../diagnostics.md#react-native)); its steps change at once (no `whenLeaving`); no `flowStep` prop yet; a tap reads no entry's `when.flowSteps`, `with.whenStopped` or `with.whenLeaving` |

## Overriding from a player

> **Example:** [`playback/override-web`](../../examples/docs-examples/src/cases/playback/override-web/) — `pnpm example:docs`, then open `#playback/override-web`.
> **Example:** [`playback/override-react`](../../examples/docs-examples/src/cases/playback/override-react/) — `pnpm example:docs`, then open `#playback/override-react`.

One document can play differently in each place you use it — the same file shown twice at two
speeds, or a file that starts by itself everywhere except inside your own play/pause UI. With no
option at all a player plays the file **the way it was saved**: its own `actions` start it and its
timeline's `whenStopped` says how a stop looks. Every player takes the **same two overrides**, and the file on disk is
never modified:

<!-- px-check off the two override props, prose — their types are checked in each player's signature block -->
| | prop / option | what it carries |
|---|---|---|
| the timing | `timelineOptions` | corrections to the file's first timeline — `iterations`, `delay`, `playbackSpeed`, `whenStopped`, `whenOutOfView`, `whenFinished`, the gate numbers — as an object shaped like the file, **merged** over it; whoever needs more edits the document |
| the triggers | `actions` | the `actions` list to use **instead** of the file's — the same entries a file can have, `timeline.resume`, the flow actions, `with` and `when` included, so the override has the file's power. An entry left out is not there, never the file's. `null` or `[]`: no triggers, the same as `disableActions` ([Control modes](#control-modes--who-drives-it)) |

(Until 1.29 there were three: the list was `actionTriggers`, and an `actions` prop replaced the timeline's `actions`
block — its stop setting is `timelineOptions.whenStopped` now, merged like every other timing key.)

Merge or replace — the one rule for the two:

<!-- px-check off merge versus replace, prose -->
| | |
|---|---|
| `timelineOptions` | **a recursive partial** — "options": objects merge key by key, values replace, a key left out keeps the file's value |
| `actions` | **a list** that replaces the file's as a whole — its entries belong together: switching hover → click wants other entries too |

So a hover file that saves `whenOutOfView: 'continue'`, mounted with
`timelineOptions={{ whenStopped: 'animateToStart' }}`, stops animated and still plays on out of view — the key left
out keeps the file's value.

The prop is `timelineOptions`, not `timeline`: it is not a timeline of the file — the `actions` sit beside the timelines —
and a prop that shares a file key's name would promise the same shape. `actions` keeps the file's name because it IS
that list. With several timelines, `timelineOptions` patches the **first** one; the others play as the file says.

**Web player**

```html
<div id="box" style="width: 300px; height: 300px"></div>
```

```js
import { createSvgAnimationPlayer } from '@pixodesk/svg-animator-web';

const a = createSvgAnimationPlayer({
  document: '/bouncing-ball.json',
  container: '#box',
  timelineOptions: { iterations: 'infinite', whenStopped: 'animateToEnd' },
  disableActions: true,   // the file's triggers off: nothing starts until a.timeline.start()
});
a.timeline.start();
a.timeline.stop();   // plays on to the end of the current pass, then rests — whenStopped said so
```

**React / Vue / React Native** — the same objects, as props:

```jsx
// the file's triggers (the default), looping forever
<SvgAnimationPlayer document={animation} timelineOptions={{ iterations: 'infinite' }} />

// these triggers instead of the file's: plays on hover-in, plays back on hover-out —
// a hover-in on the way back turns it around
<SvgAnimationPlayer document={animation}
  actions={[
    { name: 'timeline.play', triggers: [{ event: 'hoverIn' }] },
    { name: 'timeline.stop', triggers: [{ event: 'hoverOut' }] },
  ]}
  timelineOptions={{ whenStopped: 'animateToStart' }} />

// one click starts it, the next stops it
<SvgAnimationPlayer document={animation}
  actions={[
    { name: 'timeline.start', triggers: [{ event: 'click' }] },
    { name: 'timeline.stop', triggers: [{ event: 'click' }] },
  ]} />

// driven by your state — the same buttons, the same settings
<SvgAnimationPlayer document={spinner} playback={busy ? 'on' : 'off'} timelineOptions={{ whenStopped: 'animateToEnd' }} />
```

### How the merge works

`timelineOptions` is the one override that merges:

<!-- px-check off the merge rules, prose -->
| | |
| --- | --- |
| **Objects merge, key by key** | `timelineOptions: { outTime: 2000 }` changes the window end and leaves `iterations` and everything else as the file has them |
| **Values replace** | numbers, strings and arrays are taken as given, never combined |
| **A key left out changes nothing** | there is no delete: a key left out — or `null` from JavaScript — keeps the file's value. To get a default, set it: `{ timelineOptions: { delay: 0, whenFinished: 'hold' } }`. WHY no `null` delete (until 1.22): nobody resets one key to "absent" from a page — setting the value wanted is clearer, and React reads `null` as "nothing" anyway |
| **`actions` is not a timeline key** | the file keeps the `actions` beside the timelines, and so do the props: only `actions` carries them, so every key is reachable exactly one way — `timelineOptions={{ actions: … }}` is a type error. The list is set as given |
| **Changing the `type` starts over** | switching the first timeline between a clock and a scroll timeline keeps only `inTime`, `outTime`, `iterations` and `engine` — the keys both kinds share. Clock-only keys (`whenStopped`, `whenOutOfView`, `whenLeaving`, `whenIdle`, `whenFinished`, `delay`, `playbackSpeed`, `iterationDirection`, `frameRate`, the gate numbers) have no meaning on a scroll timeline and are dropped, with a console warning; so is `iterations: 'infinite'` |
| **A moment and `holdOnScreen` are one value each** | on a scroll timeline, `firstFrameWhen`, `lastFrameWhen` and `holdOnScreen` are replaced whole — a word and an object never mix: `timelineOptions: { holdOnScreen: { at: 'center' } }` over a file's `{ forScreens: 3 }` holds at the centre for the page's own tall section |

Every player uses the same code from core. `applyPlaybackOverride(doc, { timelineOptions, actions })`
is the one implementation the web player and the three components call: the timing merged
(`mergeAnimatorConfig`'s rules, above), then the `actions` list, SET as a whole when given (`actions: null` is left
to the control mode — [below](#control-modes--who-drives-it)).
Its input is a `PxPlaybackOverrideInput` (the `timelineOptions` of `PxPlaybackOverride` plus `actions`), its answer a `PxPlaybackOverrideResult`: the new document, sharing every untouched subtree,
and the merge's warnings. `applyAnimatorConfig(doc, patch)` applies a patch to a whole document;
`mergeAnimatorConfig` does the same one level down, on the `animator` block alone, and reports what it could
and could not do in a `PxAnimatorConfigMergeResult`. A patch is a `PxRecursivePartial` of the wire type —
every key optional at every depth, arrays and primitives replaced whole, no delete — so
`PxAnimatorConfigPatch` patches the `animator` block and `PxTimelineOptions` (the `timelineOptions` prop) the
timing, typed from `PxTimelineTiming` (the timeline's keys); its parameter,
`PxTimelineOptions<TFollowed>`, is what a scroll timeline's `follows` may also take from page code — an `Element`
on the web player, none by default ([From page code](#from-page-code)). `PxActionsInput`
(the `actions` prop) is the list of entries, taken as given — a `PxActions` from a file, or entries typed one by one
(`PxActionTriggersInput` until 1.33; until 1.29 `PxActionsInput` was the timeline's old block).
WHY the names (`PxPatch` · `PxTimelinePatch` · `PxActionsPatch` until 1.22; `PxActionsOptions`, a merged partial, until
1.25): `PxRecursivePartial` says what the type IS — the common `RecursivePartial`; "options" is the word
for a merge, "input" for a value taken as given. `withActions(doc, actions)` is the SET the list needs (an empty
list and a replacement that drops entries are things a merge cannot say; `withActionTriggers` until 1.29).

### Control modes — who drives it

Every player takes the same three control options — `PxCommonControlProps`: the web player's options, the
pre-rendered `bind` and the three components alike. The components add the props that hold a position.
**None of them set, the file plays the way it was saved**: its own `actions` start it, and your code
can still drive it through the handle.

<!-- px-check values PxControlMode pkg=core -->
| Mode (`PxControlMode`) | Chosen by | The file's triggers | The handle (`timeline.start()` …) |
|---|---|---|---|
| `static` | `showAsStatic` | off — and no scroll: the picture as drawn | every playback call is ignored with a warning ([PX1506](../diagnostics.md#the-props-a-component-was-given)); the reads still answer |
| `fixedTime` | `showAtProgress` / `showAtTime` (components) | off; the player seeks and holds that frame | works; a write warns ([PX1503](../diagnostics.md#the-props-a-component-was-given)) and the next prop change reasserts the frame |
| `playback` | `playback` (components) | off; the lever presses the buttons | works; a write warns (PX1503) and the next prop change reasserts the lever |
| `manual` | `disableActions` (or `actions: null`) | off — nothing starts it by itself | your code presses the buttons |
| `actions` (default) | nothing — or an `actions` list | the file's own, or the list given | works too |

When two are set at once the higher row wins — `showAsStatic` beats everything — and the player warns
once, naming both and the winner ([PX1501](../diagnostics.md#the-props-a-component-was-given)); TypeScript
rejects the mix on the components first. `actions={[]}` is the default mode with an empty list, so
it does what `disableActions` does. `playerRef` (a Vue template ref, the web player's returned api)
is not a mode: the handle is filled in every mode and never changes which one you are in, so a bare
component with `playerRef` plays as the file says AND gives you the handle — add `disableActions`
when your code alone should start it.

The `playback` prop presses the built-in buttons — a change of position is one press: `off` → `on` is
`timeline.start()`, `on` → `paused` is `timeline.pause()`, `paused` → `on` is `timeline.resume()`, anything →
`off` is `timeline.stop()` — so the timeline's `whenStopped` (the file's, or `timelineOptions`) still says how a stop looks;
a mount with `"off"` presses nothing, a mount with `"paused"` starts the playback frozen. Its positions are
`PxPlayback` (`off` · `on` · `paused`).

**One driver family at a time.** The React and React Native components type their control props as
`PxControlProps`, a union: `showAsStatic` · `showAtProgress` · `showAtTime` · `playback` ·
`disableActions` · `actions` — two families together do not compile. Vue's runtime props, the
web player's options, or a JavaScript caller can still pass any mix (`PxAnyControlProps` is every control
prop, in any mix): every player decides it with the same core function, so they always agree.
`resolveControlMode` reads the props you passed and returns a `PxResolvedControlMode` — the mode that wins
(`PxControlMode`), plus a ready-made PX1501 warning when they came from more than one family (also when both
`showAtProgress` and `showAtTime` are set: `showAtProgress` wins). `controlModeTakesOverTrigger` then says
whether that mode switches the file's triggers off — true for every mode except `actions`.
`withControlMode(doc, mode)` applies it to a document, after the override so nothing re-arms what it
switched off: `static` → `withStaticPicture(doc)` (the triggers emptied and `whenIdle: 'static'`, so the
picture is the SVG as drawn; a scroll-driven document comes back as it is — its scroll is simply not
attached), the other modes that take the triggers over → `withoutTriggerDriver(doc)` (an **empty**
`actions` list; a scroll-driven document is spared), `actions` → as it is. The web player and
the pre-rendered builds call it; the components apply their own pose rules beside it.

### For player authors — the same rules, exported

Everything above is decided by functions in `@pixodesk/svg-animator-core`, so a player you
write yourself cannot drift from the four shipped ones:

- **Defaults.** `PX_PLAYBACK_DEFAULTS` is the one table of what an absent key means
  (`stopPlaybackBehavior: 'jumpToStart'` · `whenFinished: 'hold'` · `outOfViewBehavior: 'pause'`,
  `whenIdle: 'static'`, 0.5, 150 ms — and no `timeline.start`: an absent trigger block names no event).
  `resolveTriggers(rules, stepIds?)` returns a `PxResolvedTriggers` —
  the rules grouped by playback action, each an array of the events it may name (`triggerEventList` normalises
  one), `timeline.resume` derived unless a rule names it, an absent list and an empty one both nothing.
  `resolveActions(view, whenFinished?)` returns a
  `PxResolvedActions` — `whenStopped` and `whenOutOfView` plus `whenFinished`, every one defaulted. `resolveGate(view)`
  returns a `PxResolvedGate`: the `whenOutOfView` behavior and the two sensor numbers, defaulted.
- **Entries and rules.** The engines do not read the file's entries as written: `actionRulesOf(entries)` lays the
  `actions` list flat, **one rule per trigger** (a `PxActionRule` — the action, its event, where it is heard, what it
  acts on, `from` = the entry's `when.flowSteps`, `behavior` = its `with.whenStopped` or `with.whenLeaving`, and the
  `condition`) — the runtime view's `actionRules`; `actionEntryOf(rule)` turns one rule back into an entry (a
  `PxActionEntry` with one trigger). The entries with no triggers and a `when.condition` are the runtime view's
  `conditionRules` (`conditionRulesOf(entries)`, each a `PxConditionRule`; `conditionEntryOf(rule)` turns one back);
  `isConditionTrue(condition, read)` says whether one holds now. A player gives its engines what the conditions read in
  `PxEngineCallbacks.conditionSources` (`PxConditionSources`: the variables, told when they change). Every helper below
  takes rules. `PX_ACTION_NAMES` lists every action an entry may
  name (a `PxActionName`), `isPlaybackAction(action)`
  tells the five playback actions from the five flow actions (`PxFlowAction`, `isFlowAction(action)`);
  `flowStepMoveOf(action)` is a next or previous action's move (`PxFlowStepMove`: on or back, and whether it wraps)
  and `flowStepIndexAfter(from, count, move)` the step it lands on — none past an end without wrapping. `ruleEntriesOf(rules, action)`
  gives the events of the rules that name an action, `ruleEventEntry(rule)` one rule's event as an entry (a bare word,
  or a `PxTriggerEventObject`), and `rulesOfEntries(action, entries, refs?)` turns entries back into rules —
  `PxTriggerEvents` is one entry or several, as those helpers take them.
  `resolveTriggers` keys every entry — `triggerKeys(resolved)`, `triggerKeyOf(entry)`, `triggerSpecOf(entry)` → a
  `PxTriggerEventSpec` (`triggerEventOf` gives its event) — and lists the flow rules (`flows`, each a
  `PxFlowTrigger`); `isTriggerEvents(value)` guards an open value; `PX_ALL_TRIGGER_EVENTS` is every page event and
  `PX_FLOW_ACTION_EVENTS` every event a flow action may name — `flowStep.finished` too. `isPageEvent(event)` tells a page
  event from `flowStep.finished`, `isPageEventRule(rule)` a rule the page listens for; `ruleSpecOf(rule)` is that rule's
  spec — its event, where it is heard, its `from` and `behavior`, all part of its key — and `fromStepsOf(rule)` the steps
  its `from` names (none: any step).
- **Flows.** `isFlowStepEntry(value)` recognises a list entry that can be a step. `flowStepViewsOf(steps, flows)` lays
  each step's `timelineOptions` flat on it and marks the step its flow's `initialFlowStep` names (a `PxFlowStepView`,
  the runtime view's `flowStepViews`); `initialFlowStepsOf(flows)` is where each flow starts, by flow id.
  `flowStepReferenceIssues(view, extraIds?)` lists the `flow.goTo` that name nothing
  (`PxFlowStepReferenceIssue`, PX1114), `duplicateFlowStepIds(steps)` the ids used twice (PX1115). `PX_DEFAULT_ID` is
  `default` (the default flow), `PX_DEFAULT_TIMELINE` is `""` (the default timeline); `defaultTimelineOf(view)` is the default timeline and `isOnDefaultTimeline(step)` says whether a step is a
  part of it. `forwardFlowControls(target, write)` builds the forwarding `flow` every wrapper hands out — the twin of
  `forwardPlaybackControls`. `shouldWireOwnTriggers(callbacks)` tells an engine whether to wire its document's triggers
  itself — not for a flow's step, whose flow wires them once. (`isFlowActionObject` and `PxActionObject`, a go-to
  written as a value, until 1.33.)
- **Several timelines.** `timelineIssues(doc)` returns every finding of [Checks](#checks) as a `PxTimelineIssue` —
  `{ kind, key?, id?, at?, attribute? }`, its `kind` a `PxTimelineIssueKind`; the web player reports them as PX1116.
  The players plan a file into units — one per flow that runs — and play them side by side, one step's ordinary
  playback live in each (`planUnits`, `createFlowSwitch`, internal).
- **The playback actions.** `PxTriggerList` names them (`timeline.start` · `timeline.play` · `timeline.stop` · `timeline.pause` · `timeline.resume`);
  `allowedTriggerEvents(list)` is the table of events each may name (the schema is built from it);
  `counterpartTriggerEvent(event)` is the event that undoes another (`hoverIn` ↔ `hoverOut`,
  `click` → `click`, none for `load`); `derivedResume(startPlayback, stopPlayback, pausePlayback)` is the derived resume.
- **Schemas.** `PxActionsSchema` is the `actions` list — `PxActionEntrySchema` one entry, a member per action, each
  stating its `with` (`PxTimelineActionArgsSchema`, `PxStopActionArgsSchema`, `PxGoToActionArgsSchema`,
  `PxFlowStepActionArgsSchema`) and limiting its triggers to the events it may name, so a trigger that does not fit is
  dropped and an entry naming no action is dropped whole; `PxActionWhenSchema` is its `when`. `PxFlowStepSchema` ·
  `PxFlowSchema` are a step and a flow (`PxFlowStepTimelineOptionsSchema` a step's `timelineOptions`),
  `PxTimelineTrackSchema` one `byTimeline` entry. (`PxActionTriggersSchema` · `PxActionTriggerRuleSchema` ·
  `PxActionObjectSchema` until 1.33.) `PxWhenFinishedSchema` is the `whenFinished` enum on the timeline (`hold` · `jumpToStart` ·
  `animateToStart`, default `hold`); `whenStopped` and `whenOutOfView` are enums of the timeline schema, each stating
  its default (until 1.29 the timeline's `actions` block had a schema with a sub-schema per slot).
- **The event rule.** `triggerActionFor(triggers, state, event, whenFinished)` — the playback's state (`PxPlaybackState`:
  off · playing · paused · finished · returning — and `scrubbing` and `destroyed`, which answer nothing) picks the lists, in the order of
  [One event, several lists](#one-event-several-lists) (`whenFinished` decides the order while finished), and the answer is a
  `PxTriggerAction`: `timeline.start`, `timeline.play`, `timeline.stop`, `timeline.pause` or `timeline.resume`.
  `triggerListsEvent` says which listeners to attach at all.
- **The warnings.** `triggerIssues(rules)` returns every problem with the rules as a
  `PxTriggerIssue` — `{ kind, list, event, otherList? }`, its `kind` a `PxTriggerIssueKind`
  (`eventNotAllowed` · `collision` · `resumeExtra` · `resumeMissing`); an empty array is a clean list. The web
  player reports them as PX1110, PX1109 and PX1111 (both resume kinds).
- **Where they live.** The trigger functions (`resolveTriggers` … `triggerIssues`) and their types
  (`PxResolvedTriggers`, `PxTriggerIssue`) come from `@pixodesk/svg-animator-core/engine`; the
  consts `PxTriggerList`, `PxTriggerIssueKind`, `PxPlaybackState` and `PxTriggerAction` from the main entry.
- **The executor.** One `PxPlayExecutor` per player performs every button — its own flat methods `startPlayback()`
  (from the start, in every state), `playPlayback()` (start or carry on), `stopPlayback(behavior?)` per
  `whenStopped`, or an entry's own `with.whenStopped`, `pausePlayback()` / `resumePlayback()`, `seek(totalMs)` (the seek rule),
  `leaveView(behavior)` / `returnToView()` (the visibility gate's two edges: it presses the real buttons and undoes
  only what it did), and `onNaturalFinish()`, called when the engine's clock reaches an end — the playback's
  finish (`finished`, `onPlaybackFinish`, then `whenFinished`), or the end of a return leg. It owns the states
  engines cannot report — paused versus off, finished, returning — and tells the playback events
  (`setListeners(PxPlaybackListeners)`: `onPlaybackStart` · `onPlaybackStop` · `onPlaybackPause` · `onPlaybackResume` ·
  `onPlaybackFinish` · `onFlowStepChange`, the playback subset of `PxAnimationPlayerCallbacks`); an engine's own raw end never reaches a page.
  `resolveDeclarativePlayback(args)` (`/engine`) turns a change of the `playback` prop (`PxDeclarativeProps`) into
  the buttons to press — `PxDeclarativeAction`: `startPlayback` · `stopPlayback` · `pausePlayback` · `resumePlayback` — so every
  framework component resolves `playback` the same way (a mount with `"off"` presses nothing; no position pair is
  invalid). `createPlayExecutor(api, config, raf)` builds
  one over any `PxPlayTarget` (the engine primitives it drives) from a `PxPlayExecutorConfig` (the
  playback's geometry, `whenStopped` and `whenFinished` — `executorConfigOf(view)` reads them from the runtime view, a
  `PxApiExtrasConfig`); `ensurePlayExecutor` reuses the one an engine attached. `composeApiExtras(api, cfg, raf)`
  then completes an engine's primitives (a `PxApiExtrasTarget`) with `playback` — the five buttons, the seeks,
  the state reads and every per-iteration and at-speed read — as `PxApiExtras`, so one engine keeps
  one clock and no rule can drift between engines. `forwardPlaybackControls(target, write)` builds the forwarding
  `playback` every wrapper hands out — the web player before it is ready, the React / Vue / React Native handles — so
  their tables cannot drift either. `applyDeclarativeAction` presses one of the four on a `PxDeclarativeTarget`
  (`player.timeline`, or a component's forwarder).
- **CSS.** `fillModeOf(whenIdle, whenFinished)` is the `animation-fill-mode` the two
  settings spell — (`static`, `hold`) `forwards`, (`firstFrame`, `hold`) `both`, (`static`, `jumpToStart`)
  `none`, (`firstFrame`, `jumpToStart`) `backwards` — what the CSS export and the WAAPI engine hand to the browser.

## The contract

What the names alone do not settle — each row is a test in the packages:

<!-- px-check off behaviour rules, prose -->
| Rule | What it means |
|---|---|
| `timeline.start()` always plays from the start | in every state — `playing` (it restarts), `paused` (the freeze is dropped), `returning`, `finished` — from code, from a `timeline.start` trigger and from the `playback` prop; the delay is waited again. `timeline.play()` is the start that carries on instead: nothing while playing, a resume while paused, a turn-around while the picture goes back |
| `finished` is a state, not a picture | after the last pass ends by playing, `timeline.getState()` reads `finished` under every `whenFinished` — also while `animateToStart` plays the picture back — until the next start, stop or seek |
| `onPlaybackFinish` is for playing to the end | it fires when the last pass ends by playing — never for a stop that goes to the end (`jumpToEnd`, `animateToEnd` report `onPlaybackStop`), never for the end of a return leg, never on a loop without end |
| A stop that reaches the end leaves the playback finished | `whenStopped: 'jumpToEnd'` or `'animateToEnd'` arrives at the end of the current pass: the state is `finished`, then `whenFinished` applies. `onPlaybackStop` fires when the stop is performed: at once, or on arrival for `animateToEnd` and `animateToEndAndBack` |
| The state during a stop's return leg reads `returning` | while a `whenStopped: 'animateToStart'` stop (or the way back of `animateToEndAndBack`) is on its way, `timeline.getState()` reads `returning`: the playback is over, `timeline.isActive()` and `timeline.isPlaying()` are false, the picture still moves; `timeline.play()` turns it around, `timeline.start()` plays from the start. An `animateToEnd` stop in flight is still the playback — `playing` — until it arrives |
| A seek holds the frame unless playing | `timeline.setCurrentTime()`, `timeline.setCurrentProgress()` and `timeline.setTotalTime()` while `playing` keep playing from there; in every other state the playback becomes `paused` at that frame, and `timeline.resume()` plays on from it. A seek reports no callback |
| Progress counts iterations | `timeline.getCurrentProgress()` / `timeline.setCurrentProgress()` and `showAtProgress`: `1.2` is 20 % into the second iteration, in play order; clamped to `0 … iterations`, no upper bound when endless; nothing wraps |
| A negative speed multiplies with `iterationDirection` | `timeline.setSpeed(-1)` plays a `reverse` pass forwards. A file's `playbackSpeed` must be positive — in a file the direction is `iterationDirection` |
| On a scroll timeline only the scroll moves the playhead | `timeline.getState()` reads `scrubbing` on every engine and no playback callback fires. The buttons — `timeline.start()`, `timeline.play()`, `timeline.stop()`, `timeline.pause()`, `timeline.resume()` — `timeline.setSpeed()`, `timeline.setDurationAtSpeed()` and the seeks — `timeline.setCurrentTime()`, `timeline.setCurrentProgress()`, `timeline.setTotalTime()`, the components' `showAtProgress` / `showAtTime` — are ignored with the usage warning `scrollOwnsPlayhead` ([PX1505](../diagnostics.md#the-props-a-component-was-given)); the reads still answer |
| With no control prop the file drives | no `showAsStatic`, `showAt…`, `playback`, `disableActions` or `actions`: the document's own `actions` start it, on every player — a file saved with a `timeline.start` entry on `load` plays at once, a file without triggers stays still until code calls `timeline.start()` |
| A player shown with `showAsStatic` never moves | the picture as drawn, whatever the file says: no triggers, no scroll, and `timeline.start()`, `timeline.play()`, `timeline.stop()`, `timeline.pause()`, `timeline.resume()`, every seek, `timeline.setSpeed()` and `timeline.setDurationAtSpeed()` are no-ops with the usage warning `showAsStaticIgnoresCall` ([PX1506](../diagnostics.md#the-props-a-component-was-given)); the reads still answer. It beats every other control prop |
| `playback="off"` on mount does nothing | a component mounted with `playback="off"` presses no button — there is nothing to stop yet; a change from `"on"` to `"off"` stops. A mount with `"on"` starts the playback, with `"paused"` starts it frozen |
| The gate presses the real buttons | scrolled out of view, `outOfView: 'pause'` makes the state `paused` and reports `onPlaybackPause` (`onPlaybackResume` when seen again); `'stop'` makes it `off` and reports `onPlaybackStop` (`onPlaybackStart` when it starts again). It only undoes what it did: a playback the page paused stays paused |

## Following the scroll

Instead of a clock, the **scrolling** can move the playhead: scroll on and the animation goes forward, scroll
back and it goes backward, stop and it stays on that frame. Nothing starts, pauses or finishes it — it is always
on, and where the page is scrolled decides which frame is on screen. Choose *Timeline → Scroll* in the editor's
playback panel, or set it in the file:

```js
"animator": {
  // The playhead follows this animation on its way across the screen: the first frame as it
  // appears at the bottom, the last frame as it is gone at the top. The keyframes up to
  // `outTime` are spread between those two moments.
  "timelines": [ { "type": "scroll", "outTime": 3000 } ]
}
```

A scroll timeline answers three questions, one key each. Every key has a default, so `{ "type": "scroll" }`
alone is a whole timeline:

- **what** the playhead follows — `follows`: this animation, unless it says otherwise;
- **from which moment to which** — `firstFrameWhen` and `lastFrameWhen`: from when it appears to when it is
  gone, unless they say otherwise;
- whether it is **held on screen** meanwhile — `holdOnScreen`.

The clock keys — `whenStopped`, `whenOutOfView`, `whenLeaving`, `delay`, `playbackSpeed`, `iterationDirection`, `whenIdle`,
`whenFinished`, `frameRate` and the gate numbers — have no slot on a scroll timeline, and no entry of `actions` starts it.
A scroll timeline can be the only one, or stand beside clock timelines: an entry with an `id`, and the attributes
that follow the scroll ride it through `byTimeline` ([Several timelines](#several-timelines-and-bytimeline)).

<!-- px-check schema PxScrollTimelineSchema -->
| Key | Values | Default | Meaning |
|---|---|---|---|
| `id` | text | — | what steps, actions and `byTimeline` tracks call it — unique in `timelines`; the first needs none |
| `type` | `scroll` | — | the scrolling moves the playhead |
| `follows` | `thisDomElement` · `parentDomElement` · `pageDomElement` · `pageScroll` · `containerScroll` | `thisDomElement` | what the playhead follows — [What it follows](#what-it-follows) |
| `selector` | a CSS selector **in the page** | — | the element `pageDomElement` follows, or the scrolling box `containerScroll` follows (without one: the box around the animation) |
| `firstFrameWhen` | a moment word · `{ domElement, screen }` · `{ scrolled }` | `appears` — `{ scrolled: 0 }` with a `…Scroll` word, `fullyIn` when held | when the first frame is shown — [The two moments](#the-two-moments) |
| `lastFrameWhen` | the same | `gone` — `{ scrolled: 1 }` with a `…Scroll` word, `startsToLeave` when held | when the last frame is shown |
| `holdOnScreen` | `true` · `{ at, forScreens, offset }` | not held | held in place while the page scrolls on, playing meanwhile — instead of `follows` and `selector` — [Held on screen](#held-on-screen) |
| `axis` | `vertical` · `horizontal` | the way the page scrolls | which way the scrolling goes, when it is not the page's own way |
| `smoothing` | ms | none — the playhead keeps up at once | how long the playhead takes to catch up with the scrolling — smoother under momentum scrolling; the player then measures by itself ([Engine](#engine)) |
| `inTime` · `outTime` | ms | `0` · the last keyframe | the keyframes spread between the two moments — the same window as on a clock | <!-- px names=inTime,outTime -->
| `iterations` | a number | `1` | how many times it plays between the two moments — finite only: `"infinite"` cannot be spread over a stretch of scrolling |
| `engine` | `auto` · `native` · `js` | `auto` | who measures the scroll and applies the values — [Engine](#engine) |

A file saved with schema 1.27 or earlier (`"type": "view"`, `source`, `subject`, `range`, `pin`) is converted when
it is read: `{ "type": "view" }` becomes `{ "type": "scroll" }`, a `range` the two moments, `pin` `holdOnScreen`.

### What it follows

<!-- px-check values PxScrollFollows pkg=core -->
| `follows` | The playhead follows… | In a file |
|---|---|---|
| `thisDomElement` (default) | the animation itself, on its way across the screen | `{ "type": "scroll" }` |
| `parentDomElement` | the element around it — the nearest one that really moves (sticky and fixed ones are skipped) | `{ "type": "scroll", "follows": "parentDomElement" }` |
| `pageDomElement` | an element of the page, named by `selector`, on its way across the screen | `{ "type": "scroll", "follows": "pageDomElement", "selector": "#chapter-2" }` |
| `pageScroll` | how far the page is scrolled | `{ "type": "scroll", "follows": "pageScroll" }` |
| `containerScroll` | how far the scrolling box around it is scrolled — or the box `selector` names | `{ "type": "scroll", "follows": "containerScroll", "selector": "#panel" }` |

The ending of the word says what is measured: an `…Element` word follows where an element is on the screen, a
`…Scroll` word how far something is scrolled. **The screen** is the visible area of whatever scrolls the followed
element — the browser window, or a scrolling box around it.

`selector` is a CSS selector **in the page**, not in the file. It stays in the file all the same, so the file says
everything and a pre-rendered SVG with no page code can do all of it. A selector that is not valid, or matches
nothing, is reported and the animation itself is followed instead
([the codes page](../diagnostics.md#scroll-driven-playback)). Page code can also hand over the element itself —
[From page code](#from-page-code).

### The two moments

`firstFrameWhen` is when the first frame is shown and `lastFrameWhen` when the last one is; the scrolling moves
the playhead between them. A moment is written one of three ways:

<!-- px-check off the three forms of a moment, prose -->
| `follows` | A moment is | For example |
|---|---|---|
| an `…Element` word | one of seven words — they adapt to the element's size | `"lastFrameWhen": "fullyIn"` |
| an `…Element` word | or an exact place: a line of the element at a line of the screen | `"firstFrameWhen": { "domElement": "top", "screen": 0.8 }` |
| a `…Scroll` word | a share of all there is to scroll | `"firstFrameWhen": { "scrolled": 0.2 }` |

```text
 scrolling ▶      appears    halfIn    fullyIn       centered      startsToLeave   halfOut     gone
                     │         │          │              │               │            │          │
  below the screen   │      coming in     │        fully on screen       │       going out       │   above the screen
```

**The seven words**, in the order they happen as you scroll on. They adapt to the size: for an element taller
than the screen, `fullyIn` means it fills the screen and `startsToLeave` means it stops filling it — so one file
is right on a phone and on a wide screen. When `axis` is horizontal, read left and right for top and bottom.

<!-- px-check values PxScrollMoment pkg=core -->
| Word | The moment | The element fits the screen | The element is taller than the screen |
|---|---|---|---|
| `appears` | its first pixel comes in | its top at the screen's bottom | the same |
| `halfIn` | half-way in | its center at the screen's bottom | its top at the screen's center |
| `fullyIn` | all of it is in — or it fills the screen | its bottom at the screen's bottom | its top at the screen's top |
| `centered` | it is in the middle of the screen | its center at the screen's center | the same |
| `startsToLeave` | its first pixel goes out — or it stops filling the screen | its top at the screen's top | its bottom at the screen's bottom |
| `halfOut` | half-way out | its center at the screen's top | its bottom at the screen's center |
| `gone` | its last pixel goes out | its bottom at the screen's top | the same |

**An exact place** is for a moment no word names — "when its top is 80 % down the screen". It is literal: it does
not adapt to the size.

<!-- px-check off the exact place and the share scrolled, prose -->
| Key | Values |
|---|---|
| `element` | `top` · `center` · `bottom` (`left` · `right` when `axis` is horizontal), or a share 0–1 down the element — the element `follows` names |
| `screen` | the same words, or a share 0–1 down the screen |
| `scrolled` | a share 0–1 of all there is to scroll — with `pageScroll` and `containerScroll` |

The defaults:

<!-- px-check off the default moments, prose -->
| `follows` | First frame | Last frame | In words |
|---|---|---|---|
| an `…Element` word | `appears` | `gone` | from the first pixel in to the last pixel out |
| a `…Scroll` word | `{ "scrolled": 0 }` | `{ "scrolled": 1 }` | from not scrolled to scrolled to the end |
| none — `holdOnScreen` | `fullyIn` | `startsToLeave` | the held stretch, from caught to let go — both of the section it is held in |

The player never refuses a moment; `validateDocument` reports what is off, and the player plays on:

- **A moment that does not fit what is followed is ignored** — `{ scrolled }` beside an `…Element` word, a word
  or an exact place beside a `…Scroll` word: the default is used.
- **A share is 0–1.** One outside is kept inside. A stretch cannot begin before the element appears: start the
  animation at a later frame with `inTime` instead.
- **The stretch is always taken in scroll order.** Two words in the wrong order (`"firstFrameWhen": "gone",
  "lastFrameWhen": "appears"`) are reported; two exact places that come out reversed on some screen are not an
  error. Either way scrolling on moves the playhead forward, scrolling back moves it back, and nothing jumps.
- **`pageDomElement` needs a `selector`**; a `selector` goes only with `pageDomElement` and `containerScroll`; and
  `holdOnScreen` goes with neither `follows` nor `selector`.

### Held on screen

`holdOnScreen` keeps the element in place while the page scrolls on, and the animation plays meanwhile — the
"scrollytelling" pattern in one key. It follows its own held stretch, so it takes no `follows` and no
`selector`; its moments default to `fullyIn` → `startsToLeave` **of the section it is held in**. `true` holds it
at the top, inside the page's own tall section; the object says more:

<!-- px-check schema PxHoldOnScreenSchema -->
| `holdOnScreen.` | Values | Default | Meaning |
|---|---|---|---|
| `at` | `top` · `center` · `bottom` | `top` | where on the screen it stays |
| `forScreens` | a number | the page's own tall section | how many screens of scrolling it is held for — the player makes that room |
| `offset` | px | `0` | a distance from `at` |

Moments still narrow it, and then speak of that section: `{ "type": "scroll", "holdOnScreen": true,
"firstFrameWhen": "centered", "lastFrameWhen": "gone" }` plays over the second half of its stay. A progress bar
stuck to the screen while the page scrolls is not a held element: the page's CSS sticks it (`position: sticky`),
and its file says `{ "type": "scroll", "follows": "pageScroll" }`.

### The common cases

```js
// Each line is one entry of `timelines`.

// Across the screen: the first frame as it appears, the last as it is gone (the defaults)
{ "type": "scroll" }

// Draws itself while it comes in — done once all of it is in
{ "type": "scroll", "lastFrameWhen": "fullyIn" }

// Plays out as it goes
{ "type": "scroll", "firstFrameWhen": "startsToLeave" }

// From the middle of the screen until it is half out
{ "type": "scroll", "firstFrameWhen": "centered", "lastFrameWhen": "halfOut" }

// A reading-progress bar: how far the page is scrolled, top to bottom
{ "type": "scroll", "follows": "pageScroll" }

// …over the middle of the page only: from 20 % to 80 % scrolled
{ "type": "scroll", "follows": "pageScroll",
  "firstFrameWhen": { "scrolled": 0.2 }, "lastFrameWhen": { "scrolled": 0.8 } }

// Held in the centre of the screen for three screens of scrolling, playing meanwhile
{ "type": "scroll", "holdOnScreen": { "at": "center", "forScreens": 3 } }

// An element of the page drives it: the chapter, on its way across the screen
{ "type": "scroll", "follows": "pageDomElement", "selector": "#chapter-2" }

// An exact place: the first frame when its top is 80 % down the screen
{ "type": "scroll", "firstFrameWhen": { "domElement": "top", "screen": 0.8 } }

// A horizontal strip, a soft catch-up, a window of the keyframes played twice across the stretch
{ "type": "scroll", "axis": "horizontal", "smoothing": 150,
  "inTime": 1000, "outTime": 3000, "iterations": 2 }
```

### From page code

A scroll-driven file needs nothing from the page: create the player, and the scrolling drives it. What page code
sees on a scroll timeline:

<!-- px-check off page code on a scroll timeline, prose -->
| | |
|---|---|
| `timeline.getState()` | `scrubbing`, on every engine — before the first moment, between the two and after the last, held or not. `timeline.isPlaying()` is false |
| Playback callbacks | none fire: a scroll timeline never starts and never finishes, so `onPlaybackStart` … `onPlaybackFinish` stay silent |
| The buttons | `timeline.start()`, `timeline.play()`, `timeline.stop()`, `timeline.pause()`, `timeline.resume()`, `timeline.setSpeed()`, `timeline.setDurationAtSpeed()` — ignored, with a warning ([PX1505](../diagnostics.md#the-props-a-component-was-given)) |
| The seeks | `timeline.setCurrentTime()`, `timeline.setCurrentProgress()`, `timeline.setTotalTime()`, and the components' `showAtProgress` / `showAtTime` — ignored too (PX1505): the scroll owns the playhead |
| The reads | answer as usual: `timeline.getCurrentProgress()` is where the scroll has put the playhead — at the start before the first moment, at the end after the last |

**To drive a scroll file yourself**, make it a clock timeline — then the seeks work:

```jsx
// React (Vue has the same props): your own scroll maths gives a progress 0–1
<SvgAnimationPlayer document={scrollFile} timelineOptions={{ type: 'time' }} showAtProgress={progress} />
```

**To make a clock file follow the scroll**, name the type in `timelineOptions`; its clock keys are dropped, with
a warning ([How the merge works](#how-the-merge-works)):

```js
createSvgAnimationPlayer({ container, document: ballDoc,
  timelineOptions: { type: 'scroll', holdOnScreen: true } });
```

**An element instead of a selector.** Page code can give `timelineOptions.follows` the element itself — a DOM
element to the web player, a ref to the React and Vue components — in place of the word. It is the same as
`pageDomElement` with a `selector`, and needs no id; a held element follows its own stretch and does not use it:

```js
// Web player
createSvgAnimationPlayer({ container, document: '/chart.json',
  timelineOptions: { type: 'scroll', follows: document.querySelector('#chapter-2') } });
```

```jsx
// React — in Vue, a template ref: :timeline-options="{ type: 'scroll', follows: chapterRef }"
const chapterRef = useRef(null);

<section ref={chapterRef}>…</section>
<SvgAnimationPlayer document={chart} timelineOptions={{ type: 'scroll', follows: chapterRef }} />
```

### What is measured

An `…Element` word follows **where the element is in the page's layout**. Scrolling is the usual reason that
changes, not the only one:

<!-- px-check off what moves the playhead, prose -->
| What happens | The playhead |
|---|---|
| The page scrolls | follows |
| The element moves with no scrolling — content above it grows, a new `top` | follows |
| The element moves by a CSS `transform` — a carousel, a parent's `translate` | follows only when the player measures by itself (`engine: 'js'`, `smoothing`, a browser without scroll timelines): it reads the box as drawn. The browser's own timeline does not count a transform |
| Nothing can scroll — the page fits the screen | stays on one frame, by where the element sits |

### Where it works

<!-- px-check off support by player, prose -->
| Player | Follows the scroll |
|---|---|
| The web player, every engine | ✅ |
| React and Vue | ✅ — they play through the web player |
| The editor's *SVG + JS* export (a pre-rendered SVG) | ✅ |
| React Native | ❌ — measure your scroll view and pass the progress with `showAtProgress`, on a clock timeline (`timelineOptions={{ type: 'time' }}` for a scroll file) |

### In a tool of your own

Core exports what the players read a scroll timeline with, so a tool or a player of your own reads it the same way.
`PxScrollTimelineSchema` is the scroll member of `PxTimelineSchema`. A moment is `PxScrollMomentSchema`: one of the
seven words, a `PxScrollPlaceSchema` (`element` and `screen`, each a `PxScrollLineSchema` — a named line or a share), or
a `PxScrollScrolledSchema`; `holdOnScreen` as an object is `PxHoldOnScreenSchema`. `PX_SCROLL_MOMENT_ORDER` lists
the seven words in scroll order — how two words in the wrong order are found. `followsElement(follows)` is true for
the `…Element` words, false for the `…Scroll` words. `scrollLineShare(line, fallback)` turns a line into a share
from the start edge: `top` / `left` 0, `center` 0.5, `bottom` / `right` 1, a number as it is.

### What it does not do

<!-- px-check off accepted limits, prose -->
| Not possible | Instead |
|---|---|
| A shift in px on a moment — "100 px after it appears" | an exact place on a share of the screen |
| An exact place that adapts to the element's size | the seven words adapt; an exact place is literal |
| Backwards while scrolling on, or there and back in one pass — no `iterationDirection` | scrolling back already plays it backwards |
| A seek from page code | make it a clock timeline |
| A held element that follows something else | stick it with the page's CSS and follow `pageScroll` |
| A stretch that begins before the element appears — a share outside 0–1 | `inTime` starts the animation at a later frame |
| Steps on a scroll timeline | — : a step on a part of it is not read; the whole of it may be a step |
| An `axis` across the page's writing direction (vertical lines of text) | `horizontal` on an ordinary page |

## Engine

`timeline.engine` says **how the animated attributes get updated** — the same values on every timeline type:

<!-- px-check values PxTimelineEngineSetting pkg=core -->
| Value | Time-driven timeline | Scroll timeline |
|---|---|---|
| `auto` (default) | the Web Animations API — played by the browser itself, so it stays smooth even while the page is busy — with an **automatic fallback** to the player's frame loop when the document animates something WAAPI cannot express (path morphing, gradient geometry, filters, text on a path, …) | the browser's own `ScrollTimeline` / `ViewTimeline` when both moments are words (or both `{ scrolled }`) and `smoothing` is off; otherwise the player measures the scroll itself and drives WAAPI (or the frame loop, if WAAPI declines the document) |
| `native` | Web Animations API only | the browser's own `ScrollTimeline` / `ViewTimeline` driving WAAPI; with `smoothing`, an exact place, or a browser without scroll timelines, the player measures instead — WAAPI stays |
| `js` | a `requestAnimationFrame` loop that writes attributes every frame; honors `frameRate`; universal browser support | the player measures the scroll *and* applies values through its frame loop — identical everywhere |

On a scroll timeline every moment word and every `{ scrolled }` has a browser spelling; an exact place
(`{ domElement, screen }`) has none the browser can keep in scroll order, so with one the player measures by itself.
So does `smoothing`. The player says so: PX1301 for `smoothing`, PX1307 for an exact place under `native`
([the codes page](../diagnostics.md#scroll-driven-playback)).

Leave it on `auto` unless you need a guarantee — for instance `js` for path morphing in
Safari < 18.5. React Native ignores `engine` (playback is always native-driven).

Core exports the helpers the players decide this with, so a player you write yourself gets the
same answer: `resolveTimelineEngine` turns the document's setting into
the engine that will actually run, `isNativeForced` says whether `native` was asked for outright,
and `mayUseNativeScrollTimeline` whether a scroll timeline may be handed to the browser's own
`ScrollTimeline` / `ViewTimeline`.

[← React Native](./react-native.md) · [Contents](../../README.md#documentation) · Next: [Variables →](./variables.md)
