# Playback settings & triggers

[← React Native](./react-native.md) · [Contents](../../README.md#documentation) · Next: [Minification →](./minification.md)

Change how an animation plays — its length, loops, direction, what starts and stops it, what the
end leaves behind — without going back to the editor. Everything about *when* and *how* it plays
lives in one place, the document's `animator.timeline` block, and every player lets you
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
    "timeline": {
      "outTime": 2000,
      "iterations": "infinite",
      "iterationDirection": "alternate",
      // Plays as soon as half of it is on screen; pauses while it is scrolled away
      "actions": { "outOfView": "pause" }, "inViewThreshold": 0.5,
      "actionTriggers": { "playback.start": "load" }
    }
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

The same bouncing ball as in the [web player](./web-player.md#declarative--data-px-animation-src),
now two seconds per bounce and waiting until half of it has scrolled into view.

## Two blocks — requests and moments

Three things make an animation go: the **triggers** (the user hovers or clicks), a component's
**`playback` prop** (your app's state — `off` · `on` · `paused`), and the **player API**
(`playback.start()`, `playback.stop()`, `playback.pause()`, `playback.resume()` from your code). All three press the same
four **buttons**, so the format writes down **how** a start and a stop look exactly once, in the
timeline's `actions` block, and all three honour it.

A **playback** is one instance of the animation being in effect: it begins with `playback.start`, lasts while
the animation is `playing`, `paused` or `finished`, and is retired by `playback.stop` — or by the end of
the pass, when `atEnd` says to go back. `playback.start` / `playback.stop` are the playback's two buttons,
`playback.pause` / `playback.resume` the freeze inside it; `off` is no playback. The two blocks are not mirror images
of each other:

- `actionTriggers` keys are the **requests** a page event can make — `playback.start`, `playback.stop`,
  `playback.pause` (`playback.resume` is derived unless the file names it).
- `actions` keys are the **moments** whose outcome is configurable — `playback.start`, `playback.stop`,
  `outOfView`.
- `playback.start` and `playback.stop` are in both because each is both a request and a moment; `playback.pause` has
  one behaviour (freeze), so there is no `actions["playback.pause"]`; `outOfView` is not a page event, so it
  has no list. The end of the pass is nobody's request either — it is the clock's rule, the timeline
  key `atEnd` beside `whenIdle`, not a button.

<!-- px-check off the two-blocks overview — each key and list is checked in its own table below -->
| button / moment | does | how it looks | requested by (`actionTriggers`) |
|---|---|---|---|
| **playback.start** | off, finished or returning → playing | `actions["playback.start"].behavior`: `continue` · `jumpToStart` · `jumpToEnd` | `playback.start` |
| **playback.stop** | playing, paused or finished → off, or on to the end | `actions["playback.stop"].behavior`: `jumpToStart` · `animateToStart` · `jumpToEnd` · `animateToEnd` | `playback.stop` |
| **playback.pause** / **playback.resume** | freeze, and carry on | nothing to configure | `playback.pause`; `playback.resume` — derived unless the file names it |
| **atEnd** | the end of the pass is reached — by itself, or by a `…ToEnd` move | `timeline.atEnd`: `hold` · `jumpToStart` · `animateToStart` | — (the clock) |
| **outOfView** / **wake** | nobody can see it / seen again | `actions.outOfView.behavior`: `pause` · `continue` · `jumpToStart` | — (the view sensor: a condition, not an event) |

So `player.playback.stop()` on a looping heartbeat with `actions: { 'playback.stop': 'animateToEnd' }` finishes the
beat and then rests — and so does a `hoverOut` listed in `actionTriggers["playback.stop"]`, and so does
`playback="off"` on the React component. One vocabulary, learnt once — [the action words](#the-action-words).

### Playback states

What the player reports is the **playback** state — `playback.getState()` on every handle, the same words
on every player; `playback.isActive()` is true while a playback exists (`playing` · `paused` · `finished`):

<!-- px-check values PxPlaybackState pkg=core -->
| `playback.getState()` | Means |
|---|---|
| `off` | no playback: before the first `playback.start`, or back at the rest pose after a stop |
| `playing` | the playback is on and the clock moves — `playback.isPlaying()` |
| `paused` | the playback is on, frozen by `playback.pause` (`playback.resume` carries on) |
| `finished` | the playback reached its end and rests there (`atEnd: hold`); `playback.stop` still acts on it, `playback.start` makes a fresh playback |
| `returning` | no playback, but the picture still plays back to the rest pose — `'playback.stop': 'animateToStart'` or `atEnd: 'animateToStart'` on its way; `playback.start()` turns it around |
| `destroyed` | after `destroy()` — every call is a no-op ([PX1504](../diagnostics.md#the-props-a-component-was-given)) |

The gate's off-screen hold is none of these: it is the sensor's freeze, not the user's pause — it
reports no callback and `playback.getState()` does not change.

## The `timeline` — what advances the playhead

`animator.timeline` says what *drives* the animation's progress, exactly like a Web Animations
API timeline. Its `type` picks the kind, mirroring WAAPI's `DocumentTimeline` /
`ScrollTimeline` / `ViewTimeline`:

<!-- px-check schema PxTimelineSchema values=type -->
| `timeline.type` | The playhead follows… |
|---|---|
| `time` (default — may be omitted) | the player's clock — something *starts* a playback (the `actionTriggers`), and it has the playback dynamics below |
| `scroll` | a scroll container's offset — [Scroll-driven playback](#scroll-driven-playback-in-development) |
| `view` | the SVG's journey through the viewport — [Scroll-driven playback](#scroll-driven-playback-in-development) |

Each type carries only the fields that mean something for it — a scrubbed timeline has no
`actionTriggers`, no `actions` and no `delay`, and the format gives them no slot there. Omitting
`timeline` entirely means a time-driven timeline with every default.

## Timing

Timing, the playback dynamics, how the animated attributes get updated and at what rate ALL live
in the timeline. `animator` itself keeps only what is not playback: the lookup tables
(`definitions`, `bindings`).

<!-- px-check schema PxAnimatorConfigSchema partial -->
| Field | Values | Default | Meaning |
|---|---|---|---|
| `timeline.inTime` | ms | `0` | where the content WINDOW begins. Keyframe times are absolute content ms |
| `timeline.outTime` | ms | max keyframe time | …and where it ends — one pass plays `inTime` → `outTime`. The editor always writes it |
| `timeline.playbackSpeed` | factor | `1` | the speed one pass plays at: `2` plays one pass in half the time, `0.5` in twice. Content ms stay content ms — only the speed changes. Must be positive in a file (the direction is `iterationDirection`). The handle's `playback.setSpeed()` replaces it at runtime; `playback.setDurationAtSpeed(ms)` asks for the same knob as a length. WHY a speed, not a duration (`playDuration` until 1.15): every player spells speed as a factor (lottie-web `setSpeed`, WAAPI `playbackRate`, GSAP `timeScale`) and a factor needs no knowledge of the content's length. WHY `playback…` (`playSpeed` until 1.21): "playback speed" is how media players say it, and the handle's family reads the same (`playback.getDurationAtSpeed()`, `playback.getCurrentTimeAtSpeed()`) |
| `timeline.frameRate` | fps | uncapped | target rate for the player's frame loop only — a parameter of the engine `timeline.engine` selects, so it sits beside it |
| `timeline.engine` | `auto` · `native` · `js` | `auto` | how the animated attributes get updated — [Engine](#engine) |
| `timeline.delay` | ms | `0` | waited whenever a playback starts from the beginning — the first play, a `jumpToStart` start, a play after a jump back to the start or an end — never on a resume from a paused position. Scaled by the speed as WAAPI's `delay` is: at `playbackSpeed: 2` a `delay: 500` waits 250 ms. A **negative** value skips ahead instead: `-500` starts right away from the frame at 0.5 s |
| `timeline.iterations` | number · `"infinite"` | `1` | how many times the whole document timeline repeats |
| `timeline.iterationDirection` | `normal` · `reverse` · `alternate` · `alternateReverse` | `normal` | each iteration's direction; `alternate` ping-pongs on every other iteration. `reverse` applies to a single pass too — still one iteration |

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
  `time`, the components' `showAtTime` and the handle's `playback.getDuration()` / `playback.getCurrentTime()` are
  model ms of **one pass**; the `total…` names span the **whole playback**, every iteration included —
  `playback.getTotalDuration()`, `playback.getTotalTime()`, `playback.getTotalProgress()`.
- **Playback time** — model time ÷ the speed: the `playback…` family. `playbackSpeed` sets it;
  `playback.getDurationAtSpeed()` is how long one pass takes, `playback.getTotalDurationAtSpeed()` the whole playback,
  `playback.getCurrentTimeAtSpeed()` / `playback.getTotalTimeAtSpeed()` the playhead on the pass and on the playback.

"Total" means *including repeats* — GSAP's words exactly: `time` / `totalTime`,
`duration` / `totalDuration`, `progress` / `totalProgress`. `delay`, `inViewDebounce` and `frameRate`
are plain ms (the delay is scaled by the speed, as WAAPI's is).

## Triggers — WHEN it plays

The `actionTriggers` block — inside the time timeline — names the user interactions that call the
built-in buttons. One list per request — `playback.start`, `playback.stop`, `playback.pause`, and `playback.resume` when the
file names it — over one open vocabulary of events:

```json
"timeline": {
  "actions": { "playback.stop": "animateToEnd" },
  "actionTriggers": { "playback.start": ["hoverIn", "click"], "playback.stop": "hoverOut", "playback.pause": "click" }
}
```

Read cold: start on hover-in or click, stop (after the beat) on hover-out, a click while playing
pauses and the next click carries on. Each list is a single event or an array of them — the house
style of `animate`'s references — and the editor writes the shortest exact spelling.

<!-- px-check schema PxActionTriggersSchema -->
| List | Presses | Acts while the playback is… | Editor label |
|---|---|---|---|
| `playback.start` | `playback.start`, per `actions["playback.start"]` | **off** (or finished, or returning) | *Start playback on* |
| `playback.stop` | `playback.stop`, per `actions["playback.stop"]` | **playing, paused or finished** | *Stop playback on* |
| `playback.pause` | `playback.pause` — freezes the current frame | **playing** | *Pause playback on* |
| `playback.resume` | `playback.resume` — carries on from there. **Derived unless the file names it** ([below](#what-resumes-a-pause--derived-unless-named)) | **paused** | *Resume playback on* (shown, not edited) |

Two clicks make two toggles — spelt with the lists themselves, no extra key:

<!-- px-check off the two click toggles, prose -->
| Click toggles | `actionTriggers` | A click while… |
|---|---|---|
| start / stop | `{ "playback.start": "click", "playback.stop": "click" }` | off starts it; playing or paused stops it |
| play / pause | `{ "playback.start": "click", "playback.pause": "click" }` | off starts it; playing pauses it; paused resumes it |

<!-- px-check values PxTriggerEvent pkg=core -->
| Event | Fires when… |
|---|---|
| `load` | the document is ready — the only event the visibility gate may hold back: nobody interacted, so it plays once enough of it is on screen |
| `hoverIn` | the pointer enters the element |
| `hoverOut` | the pointer leaves it — only after it entered (a pointer already over the element at load does not count) |
| `click` | the element is clicked (a tap on React Native) |

The vocabulary is open: a later interaction (keyboard, focus, an app event) is a new word in
the same lists, never a new key.

### Which events each list may name

Each list names only the events that make sense for it; any other event is ignored, with a
warning ([PX1110](../diagnostics.md#what-the-document-says)).

<!-- px-check values PxTriggerList pkg=core -->
| List | `load` | `hoverIn` | `hoverOut` | `click` | Why |
|---|---|---|---|---|---|
| `playback.start` | ✓ | ✓ | — | ✓ | starting when the pointer *leaves* makes no sense |
| `playback.stop` | — | — | ✓ | ✓ | stopping on load, or when the pointer *arrives*, makes no sense |
| `playback.pause` | — | ✓ | ✓ | ✓ | a marquee pauses on hover-in, a hover animation on hover-out |
| `playback.resume` | — | ✓ | ✓ | ✓ | derived unless the file names it — see below |

### What resumes a pause — derived unless named

`playback.resume` need not be written: when the file does not name it, the player derives it from
`playback.start`, `playback.stop` and `playback.pause`. A paused animation then resumes on

1. the **counterpart** of each `playback.pause` event — `hoverIn` ↔ `hoverOut`, `click` → `click`
   (`load` has none), and
2. the `playback.start` events that do not also stop it — so a click that starts *and* stops
   (`"playback.start": "click", "playback.stop": "click"`) stops a paused animation, as the lists say.

<!-- px-check off worked examples of the derived resume — the lists are checked in the tables above -->
| `actionTriggers` | Resume playback on | Plays as… |
|---|---|---|
| `{ "playback.start": "load", "playback.pause": "hoverIn" }` | `hoverOut` (and `load`, which has fired by then) | a marquee: runs on load, holds while the pointer is over it, carries on when it leaves |
| `{ "playback.start": "hoverIn", "playback.pause": "hoverOut" }` | `hoverIn` | a hover animation that holds where it is when the pointer leaves |
| `{ "playback.start": "click", "playback.pause": "click" }` | `click` | the play / pause click toggle: start → pause → resume → pause … |
| `{ "playback.start": "click", "playback.stop": "click" }` | — | the start / stop click toggle: one click starts it, the next stops it — also while paused |

A `playback.resume` list the file **does** name is honoured as written. Where it differs from the
derivation — it names an event the derivation would not, or leaves out one it would (that pause
then waits for `playback.start` or `playback.stop`) — the player notes it
([PX1111](../diagnostics.md#what-the-document-says)), so a surprising resume is no mystery.

### One event, several lists

An event may be listed under several lists. The player's **state** picks the list it is read
from — `playback.start` when off, `playback.pause` when playing, the derived resume when paused, `playback.stop` when
playing or paused — and every button checks the state **as it was when the event arrived**.

- `{ "playback.start": "click", "playback.pause": "click" }`: a click while off starts, while playing pauses,
  while paused resumes.
- Add `actions: { 'playback.start': 'jumpToStart' }` and a click while off (or finished) starts from the
  top, while a click while paused still resumes.

Two lists that react to the same event **in the same state** are a **collision**: the players
report it ([PX1109](../diagnostics.md#what-the-document-says)) and one of them wins.

<!-- px-check off collision cases — the lists are checked in the tables above -->
| `actionTriggers` | Collision? | What happens |
|---|---|---|
| `{ "playback.stop": "click", "playback.pause": "click" }` | **yes** — `playback.stop` with `playback.pause` | while playing, `playback.pause` wins |
| `{ "playback.start": "load", "playback.pause": "hoverIn", "playback.stop": "hoverOut" }` | **yes** — `playback.stop` with the counterpart of a `playback.pause` event | while paused, `hoverOut` resumes rather than stops |
| `{ "playback.start": "click", "playback.pause": "click" }` | no | the normal play / pause toggle — each list acts in another state |
| `{ "playback.start": "click", "playback.stop": "click" }` | no | the start / stop click toggle — each list acts in another state |
| `{ "playback.start": "hoverIn", "playback.stop": "hoverOut" }` | no | start on hover-in, stop on hover-out |

Every warning the players give about a triggers block, by kind:

<!-- px-check values PxTriggerIssueKind pkg=core -->
| Kind | Example | The player… | Code |
|---|---|---|---|
| `eventNotAllowed` | `"playback.stop": "load"` | ignores the event (in a file, the document repair drops it from the list first — [PX1108](../diagnostics.md#what-the-document-says)) | [PX1110](../diagnostics.md#what-the-document-says) |
| `collision` | `"playback.stop": "click", "playback.pause": "click"` | lets `playback.pause` win while playing, the resume while paused | [PX1109](../diagnostics.md#what-the-document-says) |
| `resumeExtra` | `"playback.start": "load", "playback.pause": "hoverIn", "playback.resume": ["hoverOut", "click"]` | honours the list as written; `click` is the event the derivation would not name | [PX1111](../diagnostics.md#what-the-document-says) |
| `resumeMissing` | `"playback.start": "load", "playback.pause": ["hoverIn", "click"], "playback.resume": "hoverOut"` | honours the list as written; a pause by `click` then waits for `playback.start` or `playback.stop` | [PX1111](../diagnostics.md#what-the-document-says) |

### Absent, or empty

An absent `actionTriggers` block and an empty one, `"actionTriggers": {}`, mean the same thing:
nothing is listed, so nothing starts the animation until something drives it — your code's
`playback.start()`, a component's `playback` prop, or a `playUsingActionTriggers` object. A file that plays by
itself says so: `"actionTriggers": { "playback.start": "load" }`. The editor always writes it, and files saved before
schema 1.17 — when an absent block still meant `load` — get the line written in when they are
migrated. WHY: a default nobody wrote is a guess, and an absent block meaning something other than an
empty one trapped every merge patch, hand edit and tool that drops empty objects. A list that is
absent is simply not listed.

**Pause and carry on need no setting.** "Pause when the pointer leaves" is `hoverOut` listed under
`playback.pause` (hover-in resumes it — derived); "keep playing" is `hoverOut` not listed at all. That is
what the editor does for you: ticking *Hover in* under *Start playback on* adds *Hover out* under *Pause playback
on*, editable.

## Actions — how a start and a stop look

`timeline.actions` gives the two playback buttons their settings — one slot per moment. `behavior` names a
**preset**: one word for where the move goes and how it gets there — and a slot that says only
`behavior` is written as the word itself: `"playback.stop": "animateToStart"` is exactly
`"playback.stop": { "behavior": "animateToStart" }`. Every setting has a stated default, so a document that says
nothing plays the way it always did: a start continues, a stop jumps back to the start, the end holds
(`atEnd`, [below](#the-end-of-the-pass--atend)). A key here names a moment; `playback.start` and `playback.stop`
are requests too, so they appear in `actionTriggers` as well
([Two blocks](#two-blocks--requests-and-moments)).

### The action words

Every move names **where** it goes (`…ToStart` / `…ToEnd`) and **how** (`jump…` at once,
`animate…` playing there). The same words serve every slot that can take them:

<!-- px-check off the one table of action words — each slot's values are checked in its own table below -->
| Word | Means | Taken by |
|---|---|---|
| `jumpToStart` | at once to the rest pose (`whenIdle`: the file's static look, or the first frame) | `playback.start` · `playback.stop` · `atEnd` · `outOfView` |
| `animateToStart` | plays backwards to the rest pose — the `returning` state | `playback.stop` · `atEnd` |
| `jumpToEnd` | at once to the end of the pass (a one-shot: the playback's end) | `playback.start` · `playback.stop` |
| `animateToEnd` | plays on to the end of the pass | `playback.stop` |
| `continue` | keeps going from where it is | `playback.start` · `outOfView` |
| `hold` | stays where it is | `atEnd` |
| `pause` | freezes where it is (the gate only) | `outOfView` |

**Reaching the end runs `atEnd`** — by any route: the natural end, a stop that goes there
(`jumpToEnd`, `animateToEnd`), a start that goes there (`jumpToEnd`), or the handle's `playback.jumpToEnd()`.
"The end" is the end of the **current pass**; on a one-shot that is the playback's end. WHY these words
(`reset` / `rewind` / `restart` / `completeIteration` until 1.22): one destination word and one manner
word say what a reader had to look up — "reset to where?", "rewind how?", "complete what?".

<!-- px-check off worked examples — the words are checked in the tables below -->
| You want | `actions` | What happens |
|---|---|---|
| stop after this pass — a heartbeat should not die mid-beat | `{ 'playback.stop': 'animateToEnd' }` | a stop plays on to the end of the current pass; arriving there runs `atEnd` — `hold` rests on that frame |
| …then snap back | `{ 'playback.stop': 'animateToEnd' }` + `atEnd: 'jumpToStart'` | the beat completes, then the rest pose |
| …then undo it smoothly | `{ 'playback.stop': 'animateToEnd' }` + `atEnd: 'animateToStart'` | the beat completes, then plays back to the rest pose — an explicit two-leg chain |
| a lid that opens on hover-in and closes animated on hover-out | `{ 'playback.stop': 'animateToStart' }` | a stop plays backwards from wherever it is |
| an overlay that appears at once and leaves animated | `{ 'playback.start': 'jumpToEnd', 'playback.stop': 'animateToStart' }` | a start shows the end pose with no motion (then `atEnd`: `hold`); a stop plays it back out |
| a splash that replays on every click | `{ 'playback.start': 'jumpToStart' }` | a start always plays from the top |

<!-- px-check schema PxActionsSchema -->
| Field | Values | Default |
|---|---|---|
| `playback.start.behavior` | `continue` · `jumpToStart` · `jumpToEnd` | `continue` |
| `playback.stop.behavior` | `jumpToStart` · `animateToStart` · `jumpToEnd` · `animateToEnd` | `jumpToStart` |
| `outOfView.behavior` | `pause` · `continue` · `jumpToStart` | `pause` — [the visibility gate](#whether-it-may-run--the-visibility-gate) |

`playback.pause`, `playback.resume` and `wake` have nothing to configure.

<!-- px-check values PxStartPlaybackBehavior pkg=core -->
| `actions["playback.start"].behavior` | A start (a `playback.start` event, `playback="on"`, `playback.start()`)… |
|---|---|
| `continue` (default) | continues from the current position. At the start or the end, that is a fresh playback from the beginning; while playing it changes nothing, while paused it unfreezes, while returning it turns around |
| `jumpToStart` | starts from the beginning every time — a splash that must replay on every click (was `restart`) |
| `jumpToEnd` | lands at the end pose with no motion, then runs `atEnd` — overlay art that appears instantly and retreats animated with `'playback.stop': 'animateToStart'`. `iterationDirection: 'reverse'` cannot replace it: a reversed one-shot still *plays* when started |

<!-- px-check values PxStopPlaybackBehavior pkg=core -->
| `actions["playback.stop"].behavior` | A stop (a `playback.stop` event, `playback="off"`, `playback.stop()`)… |
|---|---|
| `jumpToStart` (default) | jumps back to the rest pose at once (was `reset`) |
| `animateToStart` | plays backwards to the rest pose — the `returning` state (was `rewind`) — the trash-can lid: opens on hover-in, closes animated on hover-out |
| `jumpToEnd` | jumps to the end of the current pass, then runs `atEnd` |
| `animateToEnd` | plays on to the end of the current pass, then runs `atEnd` — "stop after this pass" (was `stop.completeIteration: true`); a one-shot runs to its end first |

### The end of the pass — `atEnd`

Nobody presses the end of a pass: the clock gets there, so what happens next is the timeline's own
rule — `timeline.atEnd`, a plain key beside `whenIdle`, not an `actions` slot (`actions.finish` until
1.23). It runs on **every** arrival at the end — the natural one, a `…ToEnd` stop or start, the
handle's `playback.jumpToEnd()`:

<!-- px-check values PxAtEndBehavior pkg=core -->
| `timeline.atEnd` | At the end — every iteration played, or a `…ToEnd` move arrived… |
|---|---|
| `hold` (default) | keeps the last frame showing — the playback rests in the `finished` state |
| `jumpToStart` | jumps back to the rest pose (was `reset`) — the playback is over, `off` |
| `animateToStart` | plays backwards to the rest pose (was `rewind`) — `returning` on the way, then `off` |

In a file: `"timeline": { "atEnd": "hold" }`; per mount, the same key inside `timelineOptions`
(`timelineOptions={{ atEnd: 'jumpToStart' }}`).

### What shows while off — `whenIdle`

`jumpToStart` and `animateToStart` land on ONE picture wherever they appear: the **rest pose** — by
default the SVG as authored. A hand-authored file whose static attributes differ from its first
keyframe can ask for the **first frame** instead with `timeline.whenIdle`, which governs the whole
**off** state — before the first start, after `playback.jumpToStart()`, after a stop or an `atEnd` that went back
to the start (a paused animation shows its paused frame, a finished one its held frame).

It is CSS's `animation-fill-mode`, split in two: what shows **before** the playback is `whenIdle`, what
stays **after** it is `atEnd`.

<!-- px-check off the fill-mode correspondence, prose -->
| CSS `animation-fill-mode` | SVGA |
|---|---|
| `backwards` | `whenIdle: 'firstFrame'` |
| `forwards` | `atEnd: 'hold'` (the default) |
| `both` | both of the above |
| `none` | neither — `whenIdle: 'static'` and an `atEnd` that goes back to the start |

WHY `whenIdle` (`showWhenStopped` until 1.18): "stopped" read as played-then-stopped, "before start"
as the first start only; `idle` is WAAPI's word for the state with no playback. The playback's own readout says
`off` since 1.24 (`playback.getState()`, `PxPlaybackState` — `idle` until 1.23); the key keeps WAAPI's word for
what shows while there is no playback:

<!-- px-check values PxWhenIdle pkg=core -->
| `timeline.whenIdle` | What is shown while off |
|---|---|
| `static` (default) | the SVG as authored |
| `firstFrame` | the first frame's values. The editor never writes it: in its files the two are the same picture |

A **one-shot document** driven by a component's `playback` prop reads these settings too:
`playback="on"` is a start (the default `continue` plays to the end and holds there, per `atEnd`
`hold`), `playback="off"` a stop (`jumpToStart` snaps back, `animateToStart` plays back). The trash-can
lid that closes animated is `actions={{ 'playback.stop': 'animateToStart' }}`; overlay art that appears at once
and retreats animated is `actions={{ 'playback.start': 'jumpToEnd', 'playback.stop': 'animateToStart' }}`.

### Whether it may run — the visibility gate

An animation nobody can see does not play, whatever started it. The gate is a **condition on
every driver** — the triggers, a component's `playback` prop and the API alike — not an event: once
none of it is on screen the player performs the built-in `outOfView` moment, and once it is seen
again `wake`, which carries on whatever was meant to run. `outOfView` has one setting; the two
numbers that say when the sensor counts it as seen are plain timeline keys:

<!-- px-check values PxOutOfViewBehavior pkg=core -->
| `actions.outOfView.behavior` | Effect while none of it is on screen |
|---|---|
| `pause` (default) | pause where it is; it resumes when the element comes back |
| `continue` | keep playing — and start without waiting to be seen at all |
| `jumpToStart` | jump back to the rest pose, so the next entry replays it from the beginning (was `reset`) |

`continue` reads differently in the two slots that take it: under `actions["playback.start"]` it means "from
where it rests", here "keep running".

<!-- px-check off two plain numbers, not a closed value list — the schema block in the format guide carries their types -->
| Field | Default | Meaning |
|---|---|---|
| `timeline.inViewThreshold` | `0.5` | how much of the element must be on screen before it may run: `0` any part, `0.5` half of it, `1` all of it. Playback stops only at **zero** visibility, so an element resting on the boundary cannot flicker |
| `timeline.inViewDebounce` | `150` | and for how long, in ms. Scrolling straight past an animation therefore starts nothing; `0` starts the moment the threshold is met |

`wake` needs no setting: if it was meant to run, it runs again — from the paused position after
`pause`, from the start after `jumpToStart`; `continue` never stopped. The hold is the sensor's, not
a `playback.pause`: no callback reports it and `playback.getState()` does not change. A hidden browser tab counts as
out of view. An element taller than the screen counts as fully visible once it fills the screen,
so a threshold of `0.5` or `1` can always be met. Where nothing can measure visibility — a server
render, a test environment without `IntersectionObserver` — the animation plays as if fully
visible, rather than silently never playing.

**To play an animation when it scrolls into view**, nothing has to be set: `"playback.start": load` behind
the default gate IS that behaviour — it waits on its first frame until half of it is on screen
for 150 ms, plays, pauses when scrolled away, and carries on when it comes back.

### Where triggers work

- **Every player** — web, React, Vue and React Native — honours the lists, the actions and the
  gate, with one exception: React Native has no `hoverIn` / `hoverOut`, because there is no hover
  on a touch screen.
- **Pre-rendered SVG + CSS animation + JS triggers** honours all of them too. The editor writes a
  few lines of script into the file for this; no library is involved.
- **Pre-rendered SVG + CSS animation** (no script at all) listens for `load` and, through CSS
  `:hover`, for `hoverIn` and `hoverOut` — `hoverOut` may pause or stop, not both. `click` and the
  visibility gate cannot be done in pure CSS and are dropped from the file; the actions keep
  their defaults (a class cannot jump keyframes to their start or end, or play them backwards). The editor marks every
  choice *(CSS)* or *(JS)* so you see what the script-free flavour keeps. See
  [Pre-rendered SVG](https://pixodesk.com/docs/svga/prerendered-svg/on-the-web#flavour-1--svg--css-animation).
- **The CSS components** (`SvgCssAnimationPlayer` in React and Vue) take the JS component's prop
  names, narrowed: `playUsingActionTriggers` as a block only (a script-free SVG carries no triggers the
  component could read, so there is no `true`), `timelineOptions` with the two gate numbers, and
  `actions` limited to `outOfView` — read with the same rules. An absent `playUsingActionTriggers`
  lists nothing, so nothing starts without one. Accepted limits of a class toggle: the start is
  always `continue` and the stop always `jumpToStart`, for the same reason as above.

## Overriding from a player

> **Example:** [`playback/override-web`](../../examples/docs-examples/src/cases/playback/override-web/) — `pnpm example:docs`, then open `#playback/override-web`.
> **Example:** [`playback/override-react`](../../examples/docs-examples/src/cases/playback/override-react/) — `pnpm example:docs`, then open `#playback/override-react`.

One document can play differently in each place you use it — the same file shown twice at two
speeds, or a file that starts by itself everywhere except inside your own play/pause UI. Every
player takes the **same three overrides**, and the file on disk is never modified:

<!-- px-check off the three override props, prose — their types are checked in each player's signature block -->
| | prop / option | what it carries |
|---|---|---|
| the timing | `timelineOptions` | corrections to the file's `timeline` block, minus its `actionTriggers` and `actions` — `iterations`, `delay`, `playbackSpeed`, `atEnd`, the gate numbers — as an object shaped like the file; whoever needs more edits the document |
| the actions | `actions` | corrections to the file's `timeline.actions`, setting by setting — `{ 'playback.stop': 'animateToStart' }` changes how a stop looks and leaves the rest as the file has it |
| the triggers | `playUsingActionTriggers` | `true` plays on the file's own triggers; an **object** is the whole `actionTriggers` block to use instead — `playback.resume` included (derived when left out), so the override has the file's power. Lists left out are simply not listed, never the file's values |

Merge or replace — the one rule for the three:

<!-- px-check off merge versus replace, prose -->
| | |
|---|---|
| `timelineOptions`, `actions` | **recursive partials** — objects merge key by key, values replace, a key left out changes nothing |
| a `playUsingActionTriggers` object | **replaces** the file's `actionTriggers` as a whole — its lists belong together, so switching hover → click would otherwise carry the hover-era lists along |

The prop is `timelineOptions`, not `timeline`: it is not the file's `timeline` object — two of its
keys live on other props — and a prop that shares a file key's name would promise the same shape.
`actions` keeps the file's name because it is a partial of that block.

**Web player**

```html
<div id="box" style="width: 300px; height: 300px"></div>
```

```js
import { createSvgAnimationPlayer } from '@pixodesk/svg-animator-web';

const a = createSvgAnimationPlayer({
  src: '/bouncing-ball.json',
  container: '#box',
  timelineOptions: { iterations: 'infinite' },
  actions: { 'playback.stop': 'animateToEnd' },   // no `playUsingActionTriggers`: nothing starts until a.playback.start()
});
a.playback.start();
a.playback.stop();   // plays on to the end of the current pass, then rests — the actions said so
```

**React / Vue / React Native** — the same objects, as props:

```jsx
// the file's triggers, looping forever
<SvgAnimationPlayer doc={doc} playUsingActionTriggers timelineOptions={{ iterations: 'infinite' }} />

// these triggers instead of the file's: starts on hover-in, plays back on hover-out
<SvgAnimationPlayer doc={doc} playUsingActionTriggers={{ 'playback.start': 'hoverIn', 'playback.stop': 'hoverOut' }}
  actions={{ 'playback.stop': 'animateToStart' }} />

// one click starts it, the next stops it
<SvgAnimationPlayer doc={doc} playUsingActionTriggers={{ 'playback.start': 'click', 'playback.stop': 'click' }} />

// driven by your state — the same actions, the same settings
<SvgAnimationPlayer doc={spinner} playback={busy ? 'on' : 'off'} actions={{ 'playback.stop': 'animateToEnd' }} />
```

### How the merge works

<!-- px-check off the merge rules, prose -->
| | |
| --- | --- |
| **Objects merge, key by key** | `timelineOptions: { outTime: 2000 }` changes the window end and leaves `iterations` and everything else as the file has them; `actions: { 'playback.stop': 'animateToStart' }` leaves the other actions alone |
| **Values replace** | numbers, strings and arrays are taken as given, never combined |
| **A key left out changes nothing** | there is no delete: a key left out — or `null` from JavaScript — keeps the file's value. To get a default, set it: `{ timelineOptions: { delay: 0, atEnd: 'hold' } }`, `{ actions: { 'playback.stop': 'jumpToStart' } }`. WHY no `null` delete (until 1.22): nobody resets one key to "absent" from a page — setting the value wanted is clearer, and React reads `null` as "nothing" anyway |
| **`actionTriggers` and `actions` are not timeline keys here** | the file nests them, the props lift them: only `playUsingActionTriggers` carries triggers and only `actions` the action settings, so every key is reachable exactly one way — `timelineOptions={{ actionTriggers: … }}` is a type error |
| **Changing `timeline.type` starts over** | switching between a clock and a scroll timeline keeps only `inTime`, `outTime`, `iterations`, `engine` and `frameRate` — the keys both kinds share. Clock-only keys (`actionTriggers`, `actions`, `whenIdle`, `atEnd`, `delay`, `playbackSpeed`, `iterationDirection`, the gate numbers) have no meaning on a scroll timeline and are dropped, with a console warning |

Every player uses the same code from core. `applyPlaybackOverride(doc, { timelineOptions, actions, playUsingActionTriggers })`
is the one implementation the web player and the three components call: the timing and the
actions merged (`mergeAnimatorConfig`'s rules, above), then — when `playUsingActionTriggers` is an object —
the `actionTriggers` block set to it as a whole. Its input is a `PxPlaybackOverrideInput` (the `timelineOptions`
and `actions` of `PxPlaybackOverride` plus `playUsingActionTriggers`), its answer a `PxPlaybackOverrideResult`: the new
document, sharing every untouched subtree, and the merge's warnings. `applyAnimatorConfig(doc, patch)`
applies a patch to a whole document; `mergeAnimatorConfig` does the same one level down, on the
`animator` block alone, and reports what it could and could not do in a `PxAnimatorConfigMergeResult`.
A patch is a `PxRecursivePartial` of the wire type — every key optional at every depth, arrays and
primitives replaced whole, no delete — so `PxAnimatorConfigPatch` patches the `animator` block,
`PxTimelineOptions` (the `timelineOptions` prop) the timing, typed from `PxTimelineTiming` (the timeline
minus `actionTriggers` and `actions`), and `PxActionsOptions` (the `actions` prop) the `actions` block
(`PxActions`). WHY the names (`PxPatch` · `PxTimelinePatch` · `PxActionsPatch` until 1.22):
`PxRecursivePartial` says what the type IS — the common `RecursivePartial`; the other two are the props'
own words. `withActionTriggers(doc, triggers)` is the SET a `PxActionTriggers` block needs (an empty
block and a replacement that drops keys are things a merge cannot say).

### A note on the components' control props

When you control a component with `playback`, `showAtProgress` or `showAtTime`, the component
ignores the triggers saved in the file: core's `withoutTriggerDriver` replaces them with an
**empty** `actionTriggers` block, so nothing starts the animation by itself — the same patch the
web player applies when `playUsingActionTriggers` is absent. Only `playUsingActionTriggers` mode follows the file's
triggers. The `playback` prop presses the built-in buttons — a change of position is one press: `off` → `on`
is `playback.start()`, `on` → `paused` is `playback.pause()`, `paused` → `on` is `playback.resume()`, anything → `off` is
`playback.stop()` — so the file's `actions` (and the `actions` prop) still say how each move looks; a mount with
`"off"` presses nothing, a mount with `"paused"` starts the playback frozen. Its positions are `PxPlayback`
(`off` · `on` · `paused`). `playerRef` is not a control prop: the handle is filled in every mode and
never changes which one you are in.

**One driver family at a time.** The React and React Native components type their control props as
`PxControlProps`, a union: `showAtProgress` · `showAtTime` · `playback` · `playUsingActionTriggers` —
two families together do not compile. Vue's runtime props, or a JavaScript caller, can still pass any mix (`PxAnyControlProps`
is every control prop, in any mix): React, Vue and React Native decide it with the same core
function, so they always agree. `resolveControlMode` reads the props you passed and returns the mode
that wins (`PxControlMode`), plus a ready-made [PX1501](../diagnostics.md#the-props-a-component-was-given)
warning when they came from more than one family — also when both `showAtProgress` and `showAtTime`
are set (`showAtProgress` wins). `controlModeTakesOverTrigger` then says whether that mode ignores the
file's triggers — true for every mode except `playUsingActionTriggers`.

### For player authors — the same rules, exported

Everything above is decided by functions in `@pixodesk/svg-animator-core`, so a player you
write yourself cannot drift from the four shipped ones:

- **Defaults.** `PX_PLAYBACK_DEFAULTS` is the one table of what an absent key means
  (`startPlaybackBehavior: 'continue'` · `stopPlaybackBehavior: 'jumpToStart'` · `atEnd: 'hold'` · `outOfViewBehavior: 'pause'`,
  `whenIdle: 'static'`, 0.5, 150 ms — and no `playback.start`: an absent trigger block names no event).
  `resolveTriggers(triggers)` returns a `PxResolvedTriggers` —
  every list an array of the events it may name (`triggerEventList` normalises one), `playback.resume`
  derived unless the file names it, an absent block and an empty one both nothing.
  `resolveActions(actions, atEnd?)` returns a
  `PxResolvedActions` — `playback.start`, `playback.stop` and `outOfView` settings plus `atEnd`, every one defaulted; `actionSettingsOf(slot)` reads one slot however it
  is written (the word `'animateToStart'` is exactly `{ behavior: 'animateToStart' }`). `resolveGate(view)` returns a `PxResolvedGate`:
  the `outOfView` behavior and the two sensor numbers, defaulted.
- **The lists.** `PxTriggerList` names them (`playback.start` · `playback.stop` · `playback.pause` · `playback.resume`);
  `allowedTriggerEvents(list)` is the table of events each may name (the schema is built from it);
  `counterpartTriggerEvent(event)` is the event that undoes another (`hoverIn` ↔ `hoverOut`,
  `click` → `click`, none for `load`); `derivedResume(startPlayback, stopPlayback, pausePlayback)` is the derived resume.
- **Schemas.** `PxActionTriggersSchema` (fixed lists, each limited to its events) and `PxActionsSchema`, one fixed sub-schema per
  slot — `PxStartPlaybackActionSchema`, `PxStopPlaybackActionSchema`, `PxOutOfViewActionSchema` — each stating its
  defaults; `PxAtEndSchema` is the `atEnd` enum on the timeline (`hold` · `jumpToStart` · `animateToStart`, default `hold`).
- **The event rule.** `triggerActionFor(triggers, state, event)` — the playback's state (`PxPlaybackState`:
  off · playing · paused · finished · returning — and `destroyed`, which answers nothing) picks the list, and the answer is a `PxTriggerAction`: `playback.start`,
  `playback.stop`, `playback.pause` or `playback.resume`. `triggerListsEvent` says which listeners to attach at all.
- **The warnings.** `triggerIssues(triggers)` returns every problem with a block as a
  `PxTriggerIssue` — `{ kind, list, event, otherList? }`, its `kind` a `PxTriggerIssueKind`
  (`eventNotAllowed` · `collision` · `resumeExtra` · `resumeMissing`); an empty array is a clean block. The web
  player reports them as PX1110, PX1109 and PX1111 (both resume kinds).
- **Where they live.** The trigger functions (`resolveTriggers` … `triggerIssues`) and their types
  (`PxResolvedTriggers`, `PxTriggerIssue`) come from `@pixodesk/svg-animator-core/engine`; the
  consts `PxTriggerList`, `PxTriggerIssueKind`, `PxPlaybackState` and `PxTriggerAction` from the main entry.
- **The executor.** One `PxPlayExecutor` per player performs every button — its own flat methods `startPlayback()` per
  `actions["playback.start"]`, `stopPlayback()` per `actions["playback.stop"]`, `pausePlayback()` / `resumePlayback()`,
  `jumpToStart()` (the unconditional jump to the rest pose), `animateToStart()` (the `returning` leg),
  `playOnce()`, and `onNaturalFinish()`, which performs `atEnd` when the engine reports the end (or a jump
  there). It owns the states engines cannot report — paused versus off, finished, returning — and tells
  the playback events (`setListeners(PxPlaybackListeners)`: `onPlaybackStart` · `onPlaybackStop` · `onPlaybackPause` · `onPlaybackResume`, the
  playback subset of `PxAnimationPlayerCallbacks`).
  `resolveDeclarativePlayback(args)` (`/engine`) turns a change of the `playback` prop (`PxDeclarativeProps`) into
  the buttons to press — `PxDeclarativeAction`: `startPlayback` · `stopPlayback` · `pausePlayback` · `resumePlayback` — so every
  framework component resolves `playback` the same way (a mount with `"off"` presses nothing; no position pair is
  invalid). `createPlayExecutor(api, config, raf)` builds
  one over any `PxPlayTarget` (the engine primitives it drives) from a `PxPlayExecutorConfig` (the
  playback's geometry, the `actions` and `atEnd` — `executorConfigOf(view)` reads them from the runtime view, a
  `PxApiExtrasConfig`); `ensurePlayExecutor` reuses the one an engine attached. `composeApiExtras(api, cfg, raf)`
  then completes an engine's primitives (a `PxApiExtrasTarget`) with `playback` — the four buttons, `jumpToStart()`,
  `playOnce()`, the state reads and every per-iteration and at-speed read — as `PxApiExtras`, so one engine keeps
  one clock and no rule can drift between engines. `forwardPlaybackControls(target, write)` builds the forwarding
  `playback` every wrapper hands out — the web player before it is ready, the React / Vue / React Native handles — so
  their tables cannot drift either. `applyDeclarativeAction` presses one of the four on a `PxDeclarativeTarget`
  (`player.playback`, or a component's forwarder).
- **CSS.** `fillModeOf(whenIdle, atEnd)` is the `animation-fill-mode` the two
  settings spell — (`static`, `hold`) `forwards`, (`firstFrame`, `hold`) `both`, (`static`, `jumpToStart`)
  `none`, (`firstFrame`, `jumpToStart`) `backwards` — what the CSS export and the WAAPI engine hand to the browser.

## The contract

What the names alone do not settle — each row is a test in the packages:

<!-- px-check off behaviour rules, prose -->
| Rule | What it means |
|---|---|
| A stop that reaches the end runs `atEnd` | `'playback.stop': 'jumpToEnd'` or `'animateToEnd'` arrives at the end of the current pass and performs `atEnd` — `hold` rests there (`finished`), `jumpToStart` / `animateToStart` go back. `onPlaybackStop` fires when the stop is performed: at once, or on arrival for `animateToEnd`. A loop stopped at a pass end reports `onPlaybackStop` only — its playback never ended, so there is no `onFinish` |
| The state during a return leg reads `returning` | while an `animateToStart` move is on its way — a `'playback.stop': 'animateToStart'` or an `atEnd: 'animateToStart'` — `playback.getState()` reads `returning`: the playback is over, `playback.isActive()` is false, the picture still moves; `playback.start()` turns it around. An `animateToEnd` stop in flight is still the playback — `playing` — until it arrives |
| A negative speed multiplies with `iterationDirection` | `playback.setSpeed(-1)` plays a `reverse` pass forwards. A file's `playbackSpeed` must be positive — in a file the direction is `iterationDirection` |
| Playback verbs do nothing on a scroll or view timeline | the scroll position owns the playhead: `playback.start()`, `playback.stop()`, `playback.pause()`, `playback.resume()`, `playback.playOnce()` (and the aliases `play()` / `pause()`), `playback.setSpeed()` and `playback.setDurationAtSpeed()` are no-ops with the usage warning `scrollOwnsPlayhead` ([PX1505](../diagnostics.md#the-props-a-component-was-given)); a seek still applies until the next scroll moves it |
| `playback="off"` on mount does nothing | a component mounted with `playback="off"` presses no button — there is nothing to stop yet; a change from `"on"` to `"off"` stops. A mount with `"on"` starts the playback, with `"paused"` starts it frozen |
| `play()` and `pause()` are aliases | `play()` is `playback.getState() === 'paused' ? playback.resume() : playback.start()`, `pause()` is `playback.pause()` — the media words for a `<video>`-minded page; the model's buttons are the four |
| The gate's hold reports nothing | an animation scrolled out of view is frozen by the sensor, not paused by the user: no callback fires and `playback.getState()` keeps reading `playing` |
| `playback.jumpToStart()` reports nothing | the handle's unconditional jump to the rest pose fires no callback — like a seek (`playback.setCurrentTime()`); `playback.stop()` runs the file's stop action and reports `onPlaybackStop` |

## Scroll-driven playback (in development)

> **In development.** Scroll-driven playback is not finished yet: the fields below may change,
> and not every combination works in every player. Time-driven playback — the default — is
> not affected.

Instead of playing on a clock, the animation can **follow the scroll position** — the playhead
moves as the user scrolls: scroll down and the animation goes forward, scroll back up and it
goes backward, stop and it stays on that frame. This is the model of CSS scroll-driven
animations. Choose
*Timeline → scroll* in the editor's playback panel, or set it in the document:

```js
"animator": {
  // The playhead follows the SVG's journey through the viewport instead of the clock;
  // `outTime` is the keyframe span the scroll range maps onto.
  "timeline": { "type": "view", "outTime": 3000, "range": { "start": { "phase": "entry", "fraction": 0 }, "end": { "phase": "exit", "fraction": 1 } } }
}
```

`timeline: { "type": "view" }` alone means *"show the whole animation, first frame to last, as
the SVG travels across the viewport — the scroll position, not the clock, decides which frame
is on screen"*; `type: "scroll"` follows the scroll container's offset instead. The clock
fields (`actionTriggers`, `actions`, `delay`, `"infinite"`) have no slot in these timelines. The
rest of the object tunes it:

<!-- px-check schema PxTimelineSchema variant=scroll omit=inTime,outTime,frameRate -->
| `timeline.` | Values | Meaning |
|---|---|---|
| `type` | `view` · `scroll` | progress = the SVG's journey across the scrollport, or the scroll container's offset ratio |
| `axis` | `block` (default) · `inline` · `x` · `y` | which axis; `block` = vertical in normal writing mode |
| `source` | `nearest` (default) · `root` | for `type: scroll` — the nearest scrollable ancestor, or the document |
| `subject` | `parent` · `scroller` · a CSS selector | for `type: view` — **whose** journey is measured (default: the `<svg>` itself). `parent` is what makes a *pinned* section work |
| `range.start` / `range.end` | `{ phase, fraction }` | the slice of the journey mapped to 0–100 %; `phase` ∈ `cover` (default) · `contain` · `entry` · `exit` · `entryCrossing` · `exitCrossing`; `fraction` is a position within that phase, `0` = its start, `1` = its end |
| `iterations` | number | the animation repeats this many times across the range (finite only — `"infinite"` cannot map onto a range) |
| `smoothing` | ms | catch-up lag — the playhead eases toward the scroll position instead of snapping (smoother under momentum scrolling) |
| `pin` | `true` · `{ align, offset, distance }` | hold the canvas still on screen while scrolling moves the animation forward and back (`position: sticky`); `align` ∈ `top`/`center`/`bottom`, `offset` in px from the aligned position, `distance` in viewport heights creates the scroll travel |
| `engine` | `auto` (default) · `native` · `js` | who computes progress and applies values — see [Engine](#engine): `auto`/`native` use the browser's `ScrollTimeline` where supported, `js` measures itself |

Support: the **web player** (both engines, and therefore React and Vue), and the *SVG + JS
animation* export. Not yet: the CSS export or React Native. The complete "scrollytelling"
pattern is `subject: "parent"` + `pin: true` inside a tall section.

## Engine

`timeline.engine` says **how the animated attributes get updated** — the same values on every timeline type:

<!-- px-check values PxTimelineEngineSetting pkg=core -->
| Value | Time-driven timeline | Scroll / view timeline |
|---|---|---|
| `auto` (default) | the Web Animations API — played by the browser itself, so it stays smooth even while the page is busy — with an **automatic fallback** to the player's frame loop when the document animates something WAAPI cannot express (path morphing, gradient geometry, filters, text on a path, …) | the browser's own `ScrollTimeline` / `ViewTimeline` where supported; otherwise the player measures scroll progress itself and drives WAAPI (or the frame loop, if WAAPI declines the document) |
| `native` | Web Animations API only | the browser's `ScrollTimeline` / `ViewTimeline` driving WAAPI (where unsupported, the player measures progress instead — WAAPI stays) |
| `js` | a `requestAnimationFrame` loop that writes attributes every frame; honors `frameRate`; universal browser support | the player measures scroll progress *and* applies values through its frame loop — identical everywhere |

Leave it on `auto` unless you need a guarantee — for instance `js` for path morphing in
Safari < 18.5. React Native ignores `engine` (playback is always native-driven).

Core exports the helpers the players decide this with, so a player you write yourself gets the
same answer: `resolveTimelineEngine` turns the document's setting into
the engine that will actually run, `isNativeForced` says whether `native` was asked for outright,
and `mayUseNativeScrollTimeline` whether a scroll timeline may be handed to the browser's own
`ScrollTimeline`.

[← React Native](./react-native.md) · [Contents](../../README.md#documentation) · Next: [Minification →](./minification.md)
