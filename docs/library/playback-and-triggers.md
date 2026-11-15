# Playback settings & triggers

[← React Native](./react-native.md) · [Contents](../../README.md#documentation) · Next: [Variables →](./variables.md)

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
      "actions": { "outOfView": "pause" }, "inViewThreshold": 0.5
    },
    "actionTriggers": { "timeline.start": "load" }
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

## Two blocks — requests and moments

Three things make an animation go: the **triggers** (the user hovers or clicks), a component's
**`playback` prop** (your app's state — `off` · `on` · `paused`), and the **player API**
(`timeline.start()`, `timeline.play()`, `timeline.stop()`, `timeline.pause()`, `timeline.resume()` from your code).
All three press the same five **buttons**, so the format writes down **how** a stop looks exactly once, in the
timeline's `actions` block, and all three honour it.

A **playback** is one instance of the animation being in effect: it begins with `timeline.start` (always from
the start) or `timeline.play` (start, or carry on), lasts while the animation is `playing`, `paused` or
`finished`, and is retired by `timeline.stop`. `timeline.pause` / `timeline.resume` are the freeze inside it;
`off` is no playback. Reaching the end makes the playback `finished`, whatever the picture then shows. The two
blocks are not mirror images of each other:

- `actionTriggers` keys are the **requests** a page event can make — `timeline.start`, `timeline.play`,
  `timeline.stop`, `timeline.pause` (`timeline.resume` is derived unless the file names it).
- `actions` keys are the **moments** whose outcome is configurable — `timeline.stop` and `outOfView`.
- `timeline.stop` is in both because it is both a request and a moment. The other buttons have one behaviour
  each — a start always plays from the start, a pause freezes — so there is no `actions["timeline.start"]` (until
  1.25) or `actions["timeline.pause"]`; `outOfView` is not a page event, so it has no list. What the picture
  shows once the playback is finished is nobody's request either — it is the clock's rule, the timeline key
  `whenFinished` beside `whenIdle`, not a button.

<!-- px-check off the two-blocks overview — each key and list is checked in its own table below -->
| button / moment | does | how it looks | requested by (`actionTriggers`) |
|---|---|---|---|
| **timeline.start** | any state → playing, from the start | nothing to configure — always from the start | `timeline.start` |
| **timeline.play** | off or finished → playing, from the start; paused → resumes; a picture on its way back → turns around; playing → nothing | nothing to configure | `timeline.play` |
| **timeline.stop** | playing, paused or finished → off, or on to the end (finished) | `actions["timeline.stop"].behavior`: `jumpToStart` · `animateToStart` · `jumpToEnd` · `animateToEnd` · `animateToEndAndBack` | `timeline.stop` |
| **timeline.pause** / **timeline.resume** | freeze, and carry on | nothing to configure | `timeline.pause`; `timeline.resume` — derived unless the file names it |
| **whenFinished** | the playback reached its end — the state is `finished`; this moves only the picture | `timeline.whenFinished`: `hold` · `jumpToStart` · `animateToStart` | — (the clock) |
| **outOfView** / back in view | nobody can see it / seen again | `actions.outOfView.behavior`: `pause` · `continue` · `stop` | — (the view sensor: a condition, not an event) |

So `player.timeline.stop()` on a looping heartbeat with `actions: { 'timeline.stop': 'animateToEnd' }` finishes the
beat and then rests — and so does a `hoverOut` listed in `actionTriggers["timeline.stop"]`, and so does
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
of view reads `paused` (or `off`, with `outOfView: 'stop'`) and reports it.

## The `timeline` — what advances the playhead

`animator.timeline` says what *drives* the animation's progress, exactly like a Web Animations
API timeline. Its `type` answers one question — who moves the playhead:

<!-- px-check schema PxTimelineSchema values=type -->
| `timeline.type` | The playhead follows… |
|---|---|
| `time` (default — may be omitted) | the player's clock — something *starts* a playback (the `actionTriggers`), and it has the playback dynamics below |
| `scroll` | the scrolling — an element on its way across the screen, or how far the page or a box is scrolled — [Following the scroll](#following-the-scroll) |

Each type carries only the fields that mean something for it — a scroll timeline has no
`actionTriggers`, no `actions`, no `delay` and no `frameRate`, and the format gives them no slot there. Omitting
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
| `timeline.playbackSpeed` | factor | `1` | the speed one pass plays at: `2` plays one pass in half the time, `0.5` in twice. Content ms stay content ms — only the speed changes. Must be positive in a file (the direction is `iterationDirection`). The handle's `timeline.setSpeed()` replaces it at runtime; `timeline.setDurationAtSpeed(ms)` asks for the same knob as a length. WHY a speed, not a duration (`playDuration` until 1.15): every player spells speed as a factor (lottie-web `setSpeed`, WAAPI `playbackRate`, GSAP `timeScale`) and a factor needs no knowledge of the content's length. WHY `playback…` (`playSpeed` until 1.21): "playback speed" is how media players say it, and the handle's family reads the same (`timeline.getDurationAtSpeed()`, `timeline.getCurrentTimeAtSpeed()`) |
| `timeline.frameRate` | fps | uncapped | target rate for the player's frame loop only — a parameter of the engine `timeline.engine` selects, so it sits beside it. A clock timeline only: a scroll timeline draws a frame when the scroll moves |
| `timeline.engine` | `auto` · `native` · `js` | `auto` | how the animated attributes get updated — [Engine](#engine) |
| `timeline.delay` | ms | `0` | waited whenever a playback starts from the beginning — every `timeline.start`, a `timeline.play` from rest — never on a resume from a paused position. Scaled by the speed as WAAPI's `delay` is: at `playbackSpeed: 2` a `delay: 500` waits 250 ms. A **negative** value skips ahead instead: `-500` starts right away from the frame at 0.5 s |
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

The `actionTriggers` block — at the root of `animator`, beside the time timeline — names the user interactions that call the
built-in buttons. One list per request — `timeline.start`, `timeline.play`, `timeline.stop`, `timeline.pause`, and
`timeline.resume` when the file names it — over one open vocabulary of events:

```json
"timeline": {
  "actions": { "timeline.stop": "animateToEnd" }
},
"actionTriggers": { "timeline.play": ["hoverIn", "click"], "timeline.stop": "hoverOut", "timeline.pause": "click" }
```

Read cold: play on hover-in or click (carrying on if it is already going), stop (after the beat) on hover-out,
a click while playing pauses and the next click carries on. Each list is a single event or an array of them —
the house style of `animate`'s references — and the editor writes the shortest exact spelling.

<!-- px-check schema PxActionTriggersSchema -->
| List | Presses | Acts while the playback is… | Editor label |
|---|---|---|---|
| `timeline.start` | `timeline.start` — always from the start | **off, finished or returning** — and **playing** or **paused** when no other list names the event: it restarts | *Start playback on* |
| `timeline.play` | `timeline.play` — starts, or carries on: resumes a pause, turns a picture on its way back around | **off, finished, returning or paused** — nothing to do while playing | — |
| `timeline.stop` | `timeline.stop`, per `actions["timeline.stop"]` | **playing, paused or finished** | *Stop playback on* |
| `timeline.pause` | `timeline.pause` — freezes the current frame | **playing** | *Pause playback on* |
| `timeline.resume` | `timeline.resume` — carries on from there. **Derived unless the file names it** ([below](#what-resumes-a-pause--derived-unless-named)) | **paused** | *Resume playback on* (shown, not edited) |
| `timeline.segment.next` | the next segment in the list; after the last, the first ([Segments](#segments--named-parts-of-one-timeline)) | **any state** — read before the lists above | *Add trigger* → Next segment |
| `timeline.segment.previous` | the previous segment; before the first, the last | **any state** | *Add trigger* → Previous segment |

`timeline.start` and `timeline.play` differ only when something is already going: a start always plays from the
start, a play carries on. A hover animation that should not jump back when the pointer returns mid-way uses
`timeline.play`; a splash that replays on every click uses `timeline.start`. (Until 1.25 the start list carried
on by default, as `timeline.play` does now. A 1.25 file is converted on read: with that default, its hover and
click start events move to `timeline.play`, and `load` stays a start.)

Two clicks make two toggles — spelt with the lists themselves, no extra key:

<!-- px-check off the two click toggles, prose -->
| Click toggles | `actionTriggers` | A click while… |
|---|---|---|
| start / stop | `{ "timeline.start": "click", "timeline.stop": "click" }` | off starts it; playing or paused stops it |
| play / pause | `{ "timeline.play": "click", "timeline.pause": "click" }` | off starts it; playing pauses it; paused resumes it |

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

The vocabulary is open: a later interaction (focus, an app event) is a new word in the same lists, never a new key.
Each entry of a list is a word — the whole picture — or an [event object](#an-event-on-one-element-a-page-element-or-a-key).

### Which events each list may name

Each list names only the events that make sense for it; any other event is ignored, with a
warning ([PX1110](../diagnostics.md#what-the-document-says)).

<!-- px-check values PxTriggerList pkg=core -->
| List | `load` | `hoverIn` | `hoverOut` | `click` | Why |
|---|---|---|---|---|---|
| `timeline.start` | ✓ | ✓ | — | ✓ | starting when the pointer *leaves* makes no sense |
| `timeline.play` | ✓ | ✓ | — | ✓ | the same as `timeline.start` |
| `timeline.stop` | — | — | ✓ | ✓ | stopping on load, or when the pointer *arrives*, makes no sense |
| `timeline.pause` | — | ✓ | ✓ | ✓ | a marquee pauses on hover-in, a hover animation on hover-out |
| `timeline.resume` | — | ✓ | ✓ | ✓ | derived unless the file names it — see below |

The four pressed events — `pointerDown`, `pointerUp`, `keyDown`, `keyUp` — may stand in every list, and the segment
actions take any event.

### What resumes a pause — derived unless named

`timeline.resume` need not be written: when the file does not name it, the player derives it from
`timeline.start`, `timeline.stop` and `timeline.pause`. A paused animation then resumes on

1. the **counterpart** of each `timeline.pause` event — `hoverIn` ↔ `hoverOut`, `click` → `click`
   (`load` has none), and
2. the `timeline.start` events that do not also stop it — so a click that starts *and* stops
   (`"timeline.start": "click", "timeline.stop": "click"`) stops a paused animation, as the lists say.

<!-- px-check off worked examples of the derived resume — the lists are checked in the tables above -->
| `actionTriggers` | Resume playback on | Plays as… |
|---|---|---|
| `{ "timeline.start": "load", "timeline.pause": "hoverIn" }` | `hoverOut` (and `load`, which has fired by then) | a marquee: runs on load, holds while the pointer is over it, carries on when it leaves |
| `{ "timeline.start": "hoverIn", "timeline.pause": "hoverOut" }` | `hoverIn` | a hover animation that holds where it is when the pointer leaves |
| `{ "timeline.start": "click", "timeline.pause": "click" }` | `click` | the play / pause click toggle: start → pause → resume → pause … |
| `{ "timeline.start": "click", "timeline.stop": "click" }` | — | the start / stop click toggle: one click starts it, the next stops it — also while paused |

A `timeline.resume` list the file **does** name is honoured as written. Where it differs from the
derivation — it names an event the derivation would not, or leaves out one it would (that pause
then waits for another list: `timeline.play`, `timeline.stop` or `timeline.start`) — the player notes it
([PX1111](../diagnostics.md#what-the-document-says)), so a surprising resume is no mystery.

### One event, several lists

An event may be listed under several lists. The player's **state** picks the lists it is read
from, in order, and the first list that names the event wins — every button checks the state **as it was when
the event arrived**:

<!-- px-check off the state rule, prose — triggerActionFor is described under "For player authors" -->
| State | Lists, first match wins |
|---|---|
| `playing` | `timeline.pause` · `timeline.stop` · `timeline.start` (a play has nothing to do) |
| `paused` | `timeline.resume` · `timeline.play` · `timeline.stop` · `timeline.start` |
| `off`, `returning` | `timeline.start` · `timeline.play` |
| `finished` | last frame held (`whenFinished: 'hold'`): `timeline.stop` · `timeline.start` · `timeline.play`; otherwise `timeline.start` · `timeline.play` · `timeline.stop` |

- `{ "timeline.play": "click", "timeline.pause": "click" }`: a click while off starts, while playing pauses,
  while paused resumes.
- `{ "timeline.start": "click" }` alone: every click plays from the start — also while it is playing.
- `{ "timeline.start": "click", "timeline.stop": "click" }` on a one-shot: a click on the finished animation
  undoes it while its last frame is held; when `whenFinished` already took the picture back, the click plays it
  again.

Two lists that react to the same event **in the same state** are a **collision**: the players
report it ([PX1109](../diagnostics.md#what-the-document-says)) and one of them wins.

<!-- px-check off collision cases — the lists are checked in the tables above -->
| `actionTriggers` | Collision? | What happens |
|---|---|---|
| `{ "timeline.stop": "click", "timeline.pause": "click" }` | **yes** — `timeline.stop` with `timeline.pause` | while playing, `timeline.pause` wins |
| `{ "timeline.start": "load", "timeline.pause": "hoverIn", "timeline.stop": "hoverOut" }` | **yes** — `timeline.stop` with the counterpart of a `timeline.pause` event | while paused, `hoverOut` resumes rather than stops |
| `{ "timeline.start": "click", "timeline.play": "click" }` | **yes** — `timeline.start` with `timeline.play` | while off, `timeline.start` wins — the file should name one |
| `{ "timeline.play": "click", "timeline.pause": "click" }` | no | the normal play / pause toggle — the state decides which list a click is read from |
| `{ "timeline.start": "click", "timeline.stop": "click" }` | no | the start / stop click toggle — the state decides which list a click is read from |
| `{ "timeline.play": "hoverIn", "timeline.stop": "hoverOut" }` | no | play on hover-in, stop on hover-out |

Every warning the players give about a triggers block, by kind:

<!-- px-check values PxTriggerIssueKind pkg=core -->
| Kind | Example | The player… | Code |
|---|---|---|---|
| `eventNotAllowed` | `"timeline.stop": "load"` | ignores the event (in a file, the document repair drops it from the list first — [PX1108](../diagnostics.md#what-the-document-says)) | [PX1110](../diagnostics.md#what-the-document-says) |
| `collision` | `"timeline.stop": "click", "timeline.pause": "click"` | lets `timeline.pause` win while playing, the resume while paused, `timeline.start` over `timeline.play` while off | [PX1109](../diagnostics.md#what-the-document-says) |
| `resumeExtra` | `"timeline.start": "load", "timeline.pause": "hoverIn", "timeline.resume": ["hoverOut", "click"]` | honours the list as written; `click` is the event the derivation would not name | [PX1111](../diagnostics.md#what-the-document-says) |
| `resumeMissing` | `"timeline.start": "load", "timeline.pause": ["hoverIn", "click"], "timeline.resume": "hoverOut"` | honours the list as written; a pause by `click` then waits for `timeline.start` or `timeline.stop` | [PX1111](../diagnostics.md#what-the-document-says) |

### Absent, or empty

An absent `actionTriggers` block and an empty one, `"actionTriggers": {}`, mean the same thing:
nothing is listed, so nothing starts the animation until something drives it — your code's
`timeline.start()`, a component's `playback` prop, or an `actionTriggers` block given to the player. A file that plays by
itself says so: `"actionTriggers": { "timeline.start": "load" }`. The editor always writes it, and files saved before
schema 1.17 — when an absent block still meant `load` — get the line written in when they are
migrated. WHY: a default nobody wrote is a guess, and an absent block meaning something other than an
empty one trapped every merge patch, hand edit and tool that drops empty objects. A list that is
absent is simply not listed.

**Pause and carry on need no setting.** "Pause when the pointer leaves" is `hoverOut` listed under
`timeline.pause` (hover-in resumes it — derived); "keep playing" is `hoverOut` not listed at all. That is
what the editor does for you: ticking *Hover in* under *Start playback on* adds *Hover out* under *Pause playback
on*, editable.

## Actions — how a stop looks

`timeline.actions` gives the playback's stop its settings, and the visibility gate its one — one slot per
moment. `behavior` names a **preset**: one word for where the move goes and how it gets there — and a slot that
says only `behavior` is written as the word itself: `"timeline.stop": "animateToStart"` is exactly
`"timeline.stop": { "behavior": "animateToStart" }`. Every setting has a stated default, so a document that says
nothing plays the way it always did: a stop jumps back to the start, a finished playback holds its last frame
(`whenFinished`, [below](#once-finished--whenfinished)), an animation scrolled away pauses. A key here names a
moment; `timeline.stop` is a request too, so it appears in `actionTriggers` as well
([Two blocks](#two-blocks--requests-and-moments)). A start has nothing to configure: it always plays from the
start (`actions["timeline.start"]` until 1.25).

### The action words

There are two kinds of words. **State words** change the playback state: the buttons `start`, `play`, `stop`,
`pause`, `resume`, and the gate's `pause` and `stop`. **Move words** change only the picture — **where** it goes
(`…ToStart` / `…ToEnd`) and **how** (`jump…` at once, `animate…` playing there):

<!-- px-check off the one table of action words — each slot's values are checked in its own table below -->
| Word | Means | Taken by |
|---|---|---|
| `jumpToStart` | at once to the rest pose (`whenIdle`: the file's static look, or the first frame) | `timeline.stop` · `whenFinished` |
| `animateToStart` | plays backwards to the rest pose | `timeline.stop` (the `returning` state) · `whenFinished` |
| `jumpToEnd` | at once to the end of the current pass (a one-shot: the playback's end) | `timeline.stop` |
| `animateToEnd` | plays on to the end of the current pass | `timeline.stop` |
| `animateToEndAndBack` | plays on to the end of the current pass, then backwards to the rest pose | `timeline.stop` |
| `hold` | stays where it is | `whenFinished` |

**A stop that goes to the end leaves the playback `finished`** — `jumpToEnd` and `animateToEnd` arrive at the end
of the **current pass** (on a one-shot, the playback's end), the state is `finished`, and `whenFinished` then says
what the picture shows, as after a natural end. `animateToEndAndBack` does not use `whenFinished`: it finishes the
pass, then plays back to the rest pose, and the playback is `off`. WHY these words (`reset` / `rewind` / `restart`
/ `completeIteration` until 1.22): one destination word and one manner word say what a reader had to look up —
"reset to where?", "rewind how?", "complete what?".

<!-- px-check off worked examples — the words are checked in the tables below -->
| You want | `actions` | What happens |
|---|---|---|
| stop after this pass — a heartbeat should not die mid-beat | `{ 'timeline.stop': 'animateToEnd' }` | a stop plays on to the end of the current pass; the playback is `finished` there — `whenFinished: 'hold'` rests on that frame |
| …then snap back | `{ 'timeline.stop': 'animateToEnd' }` + `whenFinished: 'jumpToStart'` | the beat completes, then the rest pose — a natural end does the same |
| …then play it back | `{ 'timeline.stop': 'animateToEndAndBack' }` | the beat completes, then plays backwards to the rest pose; a natural end still does what `whenFinished` says |
| a lid that opens on hover-in and closes animated on hover-out | `{ 'timeline.stop': 'animateToStart' }` | a stop plays backwards from wherever it is |

<!-- px-check schema PxActionsSchema -->
| Field | Values | Default |
|---|---|---|
| `timeline.stop.behavior` | `jumpToStart` · `animateToStart` · `jumpToEnd` · `animateToEnd` · `animateToEndAndBack` | `jumpToStart` |
| `outOfView.behavior` | `pause` · `continue` · `stop` | `pause` — [the visibility gate](#whether-it-may-run--the-visibility-gate) |

`timeline.start`, `timeline.play`, `timeline.pause`, `timeline.resume` and the return into view have nothing to
configure.

<!-- px-check values PxStopPlaybackBehavior pkg=core -->
| `actions["timeline.stop"].behavior` | A stop (a `timeline.stop` event, `playback="off"`, `timeline.stop()`)… |
|---|---|
| `jumpToStart` (default) | jumps back to the rest pose at once (was `reset`) — `off` |
| `animateToStart` | plays backwards to the rest pose from wherever it is — the `returning` state (was `rewind`), then `off` — the trash-can lid: opens on hover-in, closes animated on hover-out |
| `jumpToEnd` | jumps to the end of the current pass — `finished`, then `whenFinished` applies |
| `animateToEnd` | plays on to the end of the current pass — `finished`, then `whenFinished` applies — "stop after this pass" (was `stop.completeIteration: true`); a one-shot runs to its end first |
| `animateToEndAndBack` | plays on to the end of the current pass, then backwards to the rest pose — `returning` on the way back, then `off`; `whenFinished` is not used |

`onPlaybackStop` fires when the stop is performed: at once, or on arrival at the end for the three that finish
the pass first. With `jumpToEnd` or `animateToEnd`, a stop on a playback that is already finished does nothing;
the other three take it back to the rest pose.

### Once finished — `whenFinished`

Nobody presses the end of the playback: the clock gets there. When the last pass ends by playing, the playback
is `finished` — and it stays `finished` until the next start, stop or seek, **whatever the picture then shows**.
`timeline.whenFinished` moves only the picture; it is a plain key beside `whenIdle`, not an `actions` slot
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
trigger rule: a click listed under both `timeline.start` and `timeline.stop` undoes a finished animation while its
last frame is held, and plays it again once `whenFinished` took the picture back
([One event, several lists](#one-event-several-lists)).

In a file: `"timeline": { "whenFinished": "hold" }`; per mount, the same key inside `timelineOptions`
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
lid that closes animated is `actions={{ 'timeline.stop': 'animateToStart' }}`.

### Whether it may run — the visibility gate

An animation nobody can see does not play, whatever started it. The gate is a **condition on
every driver** — the triggers, a component's `playback` prop and the API alike — not an event: once
none of it is on screen the player performs the built-in `outOfView` moment, and once it is seen
again it undoes what it did. The gate presses the real buttons, so `timeline.getState()` and the callbacks
tell the truth while the animation is off screen. `outOfView` has one setting; the two numbers that say when
the sensor counts it as seen are plain timeline keys:

<!-- px-check values PxOutOfViewBehavior pkg=core -->
| `actions.outOfView.behavior` | Effect while none of it is on screen |
|---|---|
| `pause` (default) | pauses a playing animation — `paused`, `onPlaybackPause` — and resumes it when it comes back (`onPlaybackResume`) |
| `continue` | keep playing — and start without waiting to be seen at all |
| `stop` | stops a playing or finished animation at once — `off`, `onPlaybackStop`; no animated return, the stop action is not used — and starts it again from the start when it comes back (`onPlaybackStart`) (`jumpToStart` until 1.25) |

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

**To play an animation when it scrolls into view**, nothing has to be set: `"timeline.start": load` behind
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
  names, narrowed: `actionTriggers` (the block), `timelineOptions` with the two gate numbers, and
  `actions` limited to `outOfView` — read with the same rules. A script-free SVG carries no triggers the
  component could read, so with no `actionTriggers` nothing starts it. Accepted limits of a class toggle: a start that is not
  from rest restarts by remounting the content (a class cannot rewind keyframes), the stop is always
  `jumpToStart`, there is no `finished` state (the class toggle does not see the CSS animation end), and
  `whenIdle` / `whenFinished` are the file's own CSS.

### An event on one element, a page element, or a key

A list entry can be an object instead of a word (2026-11-15) — the same event, heard somewhere else or narrowed:

```json
"actionTriggers": {
  "timeline.start": ["load", { "event": "click", "element": "#lens" }],
  "timeline.segment.next": [
    { "event": "click", "selector": ".next-step" },
    { "event": "keyDown", "with": { "key": "ArrowRight" } }
  ],
  "timeline.pause": { "event": "pointerDown", "with": { "button": 2 } }
}
```

<!-- px-check schema PxTriggerEventObjectSchema -->
| Field | Means |
|---|---|
| `event` | one of the events — the list's own, or any for a segment action |
| `element` | one element **of the picture**, by its id (`"#lens"`). The player renders fresh ids and follows them; a hover counts only on crossing that element's edge. An id the picture lacks is reported (PX1113) |
| `selector` | an element **of the page**, by CSS selector — a *Next* button outside the animation |
| `with` | fields the event must have — below |

Neither `element` nor `selector`: the whole picture, as a bare word. A word and an object mean the same where both can be
said: `"click"` is `{ "event": "click" }`. The types are `PxTriggerEventEntry` (a word or a `PxTriggerEventObject`) and
`PxTriggerEventFilter`.

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

## Segments — named parts of one timeline

A timeline can be cut into **segments** (2026-11-15): a list of named parts that play one at a time — an intro, a loop
that waits, an ending. The page, or the file's own triggers, moves between them; while a segment is current, **the
playback is that segment**: `timeline.start()` plays it, `getDuration()` is its pass, a seek lands inside it.

```json
"animator": {
  "timeline": {
    "outTime": 3000,
    "segments": [
      { "name": "intro",   "inTime": 0,    "outTime": 1000, "whenFinished": "timeline.segment.next" },
      { "name": "loading", "inTime": 1000, "outTime": 2000, "iterations": "infinite", "whenLeaving": "animateToEnd" },
      { "name": "success", "inTime": 2000, "outTime": 3000 }
    ]
  },
  "actionTriggers": {
    "timeline.start": "load",
    "timeline.segment.goTo(success)": { "event": "click", "selector": "#save" }
  }
}
```

Read cold: the intro plays once and goes on to the loading loop by itself; a click on the page's *Save* button asks for
the success — the loop first finishes its pass, then the success plays and holds its last frame.

<!-- px-check schema PxTimelineSegmentSchema -->
| Field | Means |
|---|---|
| `name` | what triggers, go-tos and the page call it — unique in the list: a later segment with a name already used is ignored, with a warning (PX1115) |
| `inTime` | where its part of the content starts, ms (default: the timeline's window) |
| `outTime` | …and ends |
| `iterations` | passes, or `"infinite"` (default 1) |
| `iterationDirection` | as the timeline's |
| `playbackSpeed` | as the timeline's (default 1) |
| `initial` | the segment the timeline starts in; none: the first in the list |
| `whenFinished` | after its last pass: a picture word (`hold` — the default, `jumpToStart`, `animateToStart`), or go on — `"timeline.segment.next"` or `"timeline.segment.goTo(‹name›)"` |
| `whenLeaving` | how it leaves when another is asked for (`PxWhenLeaving`): `jump` (default) at once · `animateToEnd` this pass first · `animateToStart` played back to its start |

**Moving between them.** Three actions (`PxSegmentAction`): `timeline.segment.next` — the next in the LIST, not by
time (after the last, the first),
`timeline.segment.previous` (before the first, the last), and a go-to per segment, whose key names it —
`"timeline.segment.goTo(success)"`; `segmentGoToAction(name)` spells it. The same keys go in `actionTriggers` (any
event, read before the playback lists) and in a segment's `whenFinished`. A go-to naming no segment is ignored and
reported (PX1114); a request while a segment is leaving replaces the earlier one — the newest wins.

<!-- px-check signature pkg=core -->
```typescript
// The `actionTriggers` key — and the `whenFinished` value — that goes to the segment `name`:
//   'timeline.segment.goTo(' + name + ')'. A whole key, looked up as it is; nothing takes it apart.
function segmentGoToAction(name: string): string;
```

**From page code**, `player.timeline.segment` (`PxSegmentControls`): `next()`, `previous()`, `goTo(name)`, `get()` and
`getAll()`; `onSegmentChange(segment, previous)` tells the page — [the web player](./web-player.md#the-playback-api).
**A component** takes the segment as a lever: `<SvgAnimationPlayer document={saveIcon} segment={status} />` (React, Vue;
`PxSegmentProps`). While the prop is set the page holds the segment and the file's segment triggers rest; at mount a
segment that ends is shown at its end without playing, one that repeats plays. The wire type is `PxTimelineSegment`.

<!-- px-check off accepted limits, prose -->
| Not in this first cut | Instead |
|---|---|
| `getState()` naming the segment | `timeline.segment.get()` beside it |
| the timeline's own `whenFinished` moving between segments | a segment's `whenFinished` |
| `delay` with segments | ignored — a segment plays at once |
| `timelineOptions` changing one segment | an override REPLACES the `segments` list, as every list — pass it whole |
| exports other than the players (Lottie, video, SVG + CSS) | the whole timeline, as before |
| React Native's `segment` prop | `playerRef` → `timeline.segment` |

## Overriding from a player

> **Example:** [`playback/override-web`](../../examples/docs-examples/src/cases/playback/override-web/) — `pnpm example:docs`, then open `#playback/override-web`.
> **Example:** [`playback/override-react`](../../examples/docs-examples/src/cases/playback/override-react/) — `pnpm example:docs`, then open `#playback/override-react`.

One document can play differently in each place you use it — the same file shown twice at two
speeds, or a file that starts by itself everywhere except inside your own play/pause UI. With no
option at all a player plays the file **the way it was saved**: its own `actionTriggers` start it and its
`actions` say how a stop looks. Every player takes the **same three overrides**, and the file on disk is
never modified:

<!-- px-check off the three override props, prose — their types are checked in each player's signature block -->
| | prop / option | what it carries |
|---|---|---|
| the timing | `timelineOptions` | corrections to the file's `timeline` block, minus its `actionTriggers` and `actions` — `iterations`, `delay`, `playbackSpeed`, `whenFinished`, the gate numbers — as an object shaped like the file, **merged** over it; whoever needs more edits the document |
| the actions | `actions` | the `timeline.actions` block to use **instead** of the file's — `{ 'timeline.stop': 'animateToStart' }` says how a stop looks; a slot left out (`outOfView`, say) reads its default, never the file's value |
| the triggers | `actionTriggers` | the `actionTriggers` block to use **instead** of the file's — `timeline.resume` included (derived when left out), so the override has the file's power. Lists left out are simply not listed, never the file's values. `null` or `{}`: no triggers, the same as `disableActionTriggers` ([Control modes](#control-modes--who-drives-it)) |

Merge or replace — the one rule for the three:

<!-- px-check off merge versus replace, prose -->
| | |
|---|---|
| `timelineOptions` | **a recursive partial** — "options": objects merge key by key, values replace, a key left out keeps the file's value |
| `actions`, `actionTriggers` | **blocks** that replace the file's as a whole — their slots belong together: switching hover → click wants other lists too, and one action slot changed against the file's others can make no sense |

So a hover file that saves `actions: { outOfView: 'continue' }`, mounted with
`actions={{ 'timeline.stop': 'animateToStart' }}`, scrolls out of view with `outOfView` at its default,
`pause`. To keep a slot, write it in the block you pass.

The prop is `timelineOptions`, not `timeline`: it is not the file's `timeline` object — two of its
keys live on other props — and a prop that shares a file key's name would promise the same shape.
`actions` and `actionTriggers` keep the file's names because each IS that block.

**Web player**

```html
<div id="box" style="width: 300px; height: 300px"></div>
```

```js
import { createSvgAnimationPlayer } from '@pixodesk/svg-animator-web';

const a = createSvgAnimationPlayer({
  document: '/bouncing-ball.json',
  container: '#box',
  timelineOptions: { iterations: 'infinite' },
  actions: { 'timeline.stop': 'animateToEnd' },
  disableActionTriggers: true,   // the file's triggers off: nothing starts until a.timeline.start()
});
a.timeline.start();
a.timeline.stop();   // plays on to the end of the current pass, then rests — the actions said so
```

**React / Vue / React Native** — the same objects, as props:

```jsx
// the file's triggers (the default), looping forever
<SvgAnimationPlayer document={animation} timelineOptions={{ iterations: 'infinite' }} />

// these triggers instead of the file's: plays on hover-in, plays back on hover-out —
// a hover-in on the way back turns it around
<SvgAnimationPlayer document={animation} actionTriggers={{ 'timeline.play': 'hoverIn', 'timeline.stop': 'hoverOut' }}
  actions={{ 'timeline.stop': 'animateToStart' }} />

// one click starts it, the next stops it
<SvgAnimationPlayer document={animation} actionTriggers={{ 'timeline.start': 'click', 'timeline.stop': 'click' }} />

// driven by your state — the same actions, the same settings
<SvgAnimationPlayer document={spinner} playback={busy ? 'on' : 'off'} actions={{ 'timeline.stop': 'animateToEnd' }} />
```

### How the merge works

`timelineOptions` is the one override that merges:

<!-- px-check off the merge rules, prose -->
| | |
| --- | --- |
| **Objects merge, key by key** | `timelineOptions: { outTime: 2000 }` changes the window end and leaves `iterations` and everything else as the file has them |
| **Values replace** | numbers, strings and arrays are taken as given, never combined |
| **A key left out changes nothing** | there is no delete: a key left out — or `null` from JavaScript — keeps the file's value. To get a default, set it: `{ timelineOptions: { delay: 0, whenFinished: 'hold' } }`. WHY no `null` delete (until 1.22): nobody resets one key to "absent" from a page — setting the value wanted is clearer, and React reads `null` as "nothing" anyway |
| **`actionTriggers` and `actions` are not timeline keys here** | the file nests them, the props lift them: only `actionTriggers` carries triggers and only `actions` the action settings, so every key is reachable exactly one way — `timelineOptions={{ actionTriggers: … }}` is a type error. Both are whole blocks, set as given (`actions` merged until 1.25) |
| **Changing `timeline.type` starts over** | switching between a clock and a scroll timeline keeps only `inTime`, `outTime`, `iterations` and `engine` — the keys both kinds share. Clock-only keys (`actionTriggers`, `actions`, `whenIdle`, `whenFinished`, `delay`, `playbackSpeed`, `iterationDirection`, `frameRate`, the gate numbers) have no meaning on a scroll timeline and are dropped, with a console warning; so is `iterations: 'infinite'` |
| **A moment and `holdOnScreen` are one value each** | on a scroll timeline, `firstFrameWhen`, `lastFrameWhen` and `holdOnScreen` are replaced whole — a word and an object never mix: `timelineOptions: { holdOnScreen: { at: 'center' } }` over a file's `{ forScreens: 3 }` holds at the centre for the page's own tall section |

Every player uses the same code from core. `applyPlaybackOverride(doc, { timelineOptions, actions, actionTriggers })`
is the one implementation the web player and the three components call: the timing merged
(`mergeAnimatorConfig`'s rules, above), then the `actions` block and the `actionTriggers` block, each SET as a
whole when given (`actionTriggers: null` is left to the control mode — [below](#control-modes--who-drives-it)).
Its input is a `PxPlaybackOverrideInput` (the `timelineOptions` and `actions` of `PxPlaybackOverride` plus
`actionTriggers`), its answer a `PxPlaybackOverrideResult`: the new document, sharing every untouched subtree,
and the merge's warnings. `applyAnimatorConfig(doc, patch)` applies a patch to a whole document;
`mergeAnimatorConfig` does the same one level down, on the `animator` block alone, and reports what it could
and could not do in a `PxAnimatorConfigMergeResult`. A patch is a `PxRecursivePartial` of the wire type —
every key optional at every depth, arrays and primitives replaced whole, no delete — so
`PxAnimatorConfigPatch` patches the `animator` block and `PxTimelineOptions` (the `timelineOptions` prop) the
timing, typed from `PxTimelineTiming` (the timeline minus `actionTriggers` and `actions`); its parameter,
`PxTimelineOptions<TFollowed>`, is what a scroll timeline's `follows` may also take from page code — an `Element`
on the web player, none by default ([From page code](#from-page-code)). `PxActionsInput`
(the `actions` prop) is the `actions` block itself (`PxActions`), and `PxActionTriggersInput` the triggers
block. WHY the names (`PxPatch` · `PxTimelinePatch` · `PxActionsPatch` until 1.22; `PxActionsOptions`, a merged partial, until
1.25): `PxRecursivePartial` says what the type IS — the common `RecursivePartial`; "options" is the word
for a merge, "input" for a block taken as given. `withActionTriggers(doc, triggers)` and
`withActions(doc, actions)` are the SETs the two blocks need (an empty block and a replacement that drops
keys are things a merge cannot say).

### Control modes — who drives it

Every player takes the same three control options — `PxCommonControlProps`: the web player's options, the
pre-rendered `bind` and the three components alike. The components add the props that hold a position.
**None of them set, the file plays the way it was saved**: its own `actionTriggers` start it, and your code
can still drive it through the handle.

<!-- px-check values PxControlMode pkg=core -->
| Mode (`PxControlMode`) | Chosen by | The file's triggers | The handle (`timeline.start()` …) |
|---|---|---|---|
| `static` | `showAsStatic` | off — and no scroll: the picture as drawn | every playback call is ignored with a warning ([PX1506](../diagnostics.md#the-props-a-component-was-given)); the reads still answer |
| `fixedTime` | `showAtProgress` / `showAtTime` (components) | off; the player seeks and holds that frame | works; a write warns ([PX1503](../diagnostics.md#the-props-a-component-was-given)) and the next prop change reasserts the frame |
| `playback` | `playback` (components) | off; the lever presses the buttons | works; a write warns (PX1503) and the next prop change reasserts the lever |
| `manual` | `disableActionTriggers` (or `actionTriggers: null`) | off — nothing starts it by itself | your code presses the buttons |
| `actionTriggers` (default) | nothing — or an `actionTriggers` block | the file's own, or the block given | works too |

When two are set at once the higher row wins — `showAsStatic` beats everything — and the player warns
once, naming both and the winner ([PX1501](../diagnostics.md#the-props-a-component-was-given)); TypeScript
rejects the mix on the components first. `actionTriggers={{}}` is the default mode with an empty block, so
it does what `disableActionTriggers` does. `playerRef` (a Vue template ref, the web player's returned api)
is not a mode: the handle is filled in every mode and never changes which one you are in, so a bare
component with `playerRef` plays as the file says AND gives you the handle — add `disableActionTriggers`
when your code alone should start it.

The `playback` prop presses the built-in buttons — a change of position is one press: `off` → `on` is
`timeline.start()`, `on` → `paused` is `timeline.pause()`, `paused` → `on` is `timeline.resume()`, anything →
`off` is `timeline.stop()` — so the file's `actions` (and the `actions` prop) still say how each move looks;
a mount with `"off"` presses nothing, a mount with `"paused"` starts the playback frozen. Its positions are
`PxPlayback` (`off` · `on` · `paused`).

**One driver family at a time.** The React and React Native components type their control props as
`PxControlProps`, a union: `showAsStatic` · `showAtProgress` · `showAtTime` · `playback` ·
`disableActionTriggers` · `actionTriggers` — two families together do not compile. Vue's runtime props, the
web player's options, or a JavaScript caller can still pass any mix (`PxAnyControlProps` is every control
prop, in any mix): every player decides it with the same core function, so they always agree.
`resolveControlMode` reads the props you passed and returns a `PxResolvedControlMode` — the mode that wins
(`PxControlMode`), plus a ready-made PX1501 warning when they came from more than one family (also when both
`showAtProgress` and `showAtTime` are set: `showAtProgress` wins). `controlModeTakesOverTrigger` then says
whether that mode switches the file's triggers off — true for every mode except `actionTriggers`.
`withControlMode(doc, mode)` applies it to a document, after the override so nothing re-arms what it
switched off: `static` → `withStaticPicture(doc)` (the triggers emptied and `whenIdle: 'static'`, so the
picture is the SVG as drawn; a scroll-driven document comes back as it is — its scroll is simply not
attached), the other modes that take the triggers over → `withoutTriggerDriver(doc)` (an **empty**
`actionTriggers` block; a scroll-driven document is spared), `actionTriggers` → as it is. The web player and
the pre-rendered builds call it; the components apply their own pose rules beside it.

### For player authors — the same rules, exported

Everything above is decided by functions in `@pixodesk/svg-animator-core`, so a player you
write yourself cannot drift from the four shipped ones:

- **Defaults.** `PX_PLAYBACK_DEFAULTS` is the one table of what an absent key means
  (`stopPlaybackBehavior: 'jumpToStart'` · `whenFinished: 'hold'` · `outOfViewBehavior: 'pause'`,
  `whenIdle: 'static'`, 0.5, 150 ms — and no `timeline.start`: an absent trigger block names no event).
  `resolveTriggers(triggers)` returns a `PxResolvedTriggers` —
  every list an array of the events it may name (`triggerEventList` normalises one), `timeline.resume`
  derived unless the file names it, an absent block and an empty one both nothing.
  `resolveActions(actions, whenFinished?)` returns a
  `PxResolvedActions` — the `timeline.stop` and `outOfView` settings plus `whenFinished`, every one defaulted; `actionSettingsOf(slot)` reads one slot however it
  is written (the word `'animateToStart'` is exactly `{ behavior: 'animateToStart' }`). `resolveGate(view)` returns a `PxResolvedGate`:
  the `outOfView` behavior and the two sensor numbers, defaulted.
- **Segments and events.** `resolveSegments(view)` returns the segments in timeline order as `PxSegmentSettings`
  (`hasSegments(doc)` asks first); `withSegmentEngine(doc)` is the document the engine plays — one plain pass the
  segment clock seeks (`PxSegmentRuntime`); `segmentReferenceIssues(view)` lists the go-tos that name nothing
  (`PxSegmentReferenceIssue`), `duplicateSegmentNames(view)` the names used twice, `isSegmentGoToAction(key)` recognises one. `resolveTriggers` keys every entry —
  `triggerKeys(resolved)`, `triggerKeyOf(entry)`, `triggerSpecOf(entry)` → a `PxTriggerEventSpec` (`triggerEventOf`
  gives its event) — and lists the segment triggers (`PxSegmentTrigger`, `PxSegmentTriggerKind`);
  `isTriggerEvents(value)` guards an open key's value; `PX_ALL_TRIGGER_EVENTS` is every event.
- **The lists.** `PxTriggerList` names them (`timeline.start` · `timeline.play` · `timeline.stop` · `timeline.pause` · `timeline.resume`);
  `allowedTriggerEvents(list)` is the table of events each may name (the schema is built from it);
  `counterpartTriggerEvent(event)` is the event that undoes another (`hoverIn` ↔ `hoverOut`,
  `click` → `click`, none for `load`); `derivedResume(startPlayback, stopPlayback, pausePlayback)` is the derived resume.
- **Schemas.** `PxActionTriggersSchema` (fixed lists, each limited to its events) and `PxActionsSchema`, one fixed sub-schema per
  slot — `PxStopPlaybackActionSchema`, `PxOutOfViewActionSchema` — each stating its
  defaults; `PxWhenFinishedSchema` is the `whenFinished` enum on the timeline (`hold` · `jumpToStart` · `animateToStart`, default `hold`).
- **The event rule.** `triggerActionFor(triggers, state, event, whenFinished)` — the playback's state (`PxPlaybackState`:
  off · playing · paused · finished · returning — and `scrubbing` and `destroyed`, which answer nothing) picks the lists, in the order of
  [One event, several lists](#one-event-several-lists) (`whenFinished` decides the order while finished), and the answer is a
  `PxTriggerAction`: `timeline.start`, `timeline.play`, `timeline.stop`, `timeline.pause` or `timeline.resume`.
  `triggerListsEvent` says which listeners to attach at all.
- **The warnings.** `triggerIssues(triggers)` returns every problem with a block as a
  `PxTriggerIssue` — `{ kind, list, event, otherList? }`, its `kind` a `PxTriggerIssueKind`
  (`eventNotAllowed` · `collision` · `resumeExtra` · `resumeMissing`); an empty array is a clean block. The web
  player reports them as PX1110, PX1109 and PX1111 (both resume kinds).
- **Where they live.** The trigger functions (`resolveTriggers` … `triggerIssues`) and their types
  (`PxResolvedTriggers`, `PxTriggerIssue`) come from `@pixodesk/svg-animator-core/engine`; the
  consts `PxTriggerList`, `PxTriggerIssueKind`, `PxPlaybackState` and `PxTriggerAction` from the main entry.
- **The executor.** One `PxPlayExecutor` per player performs every button — its own flat methods `startPlayback()`
  (from the start, in every state), `playPlayback()` (start or carry on), `stopPlayback()` per
  `actions["timeline.stop"]`, `pausePlayback()` / `resumePlayback()`, `seek(totalMs)` (the seek rule),
  `leaveView(behavior)` / `returnToView()` (the visibility gate's two edges: it presses the real buttons and undoes
  only what it did), and `onNaturalFinish()`, called when the engine's clock reaches an end — the playback's
  finish (`finished`, `onPlaybackFinish`, then `whenFinished`), or the end of a return leg. It owns the states
  engines cannot report — paused versus off, finished, returning — and tells the playback events
  (`setListeners(PxPlaybackListeners)`: `onPlaybackStart` · `onPlaybackStop` · `onPlaybackPause` · `onPlaybackResume` ·
  `onPlaybackFinish`, the playback subset of `PxAnimationPlayerCallbacks`); an engine's own raw end never reaches a page.
  `resolveDeclarativePlayback(args)` (`/engine`) turns a change of the `playback` prop (`PxDeclarativeProps`) into
  the buttons to press — `PxDeclarativeAction`: `startPlayback` · `stopPlayback` · `pausePlayback` · `resumePlayback` — so every
  framework component resolves `playback` the same way (a mount with `"off"` presses nothing; no position pair is
  invalid). `createPlayExecutor(api, config, raf)` builds
  one over any `PxPlayTarget` (the engine primitives it drives) from a `PxPlayExecutorConfig` (the
  playback's geometry, the `actions` and `whenFinished` — `executorConfigOf(view)` reads them from the runtime view, a
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
| A stop that reaches the end leaves the playback finished | `'timeline.stop': 'jumpToEnd'` or `'animateToEnd'` arrives at the end of the current pass: the state is `finished`, then `whenFinished` applies. `onPlaybackStop` fires when the stop is performed: at once, or on arrival for `animateToEnd` and `animateToEndAndBack` |
| The state during a stop's return leg reads `returning` | while a `'timeline.stop': 'animateToStart'` (or the way back of `animateToEndAndBack`) is on its way, `timeline.getState()` reads `returning`: the playback is over, `timeline.isActive()` and `timeline.isPlaying()` are false, the picture still moves; `timeline.play()` turns it around, `timeline.start()` plays from the start. An `animateToEnd` stop in flight is still the playback — `playing` — until it arrives |
| A seek holds the frame unless playing | `timeline.setCurrentTime()`, `timeline.setCurrentProgress()` and `timeline.setTotalTime()` while `playing` keep playing from there; in every other state the playback becomes `paused` at that frame, and `timeline.resume()` plays on from it. A seek reports no callback |
| Progress counts iterations | `timeline.getCurrentProgress()` / `timeline.setCurrentProgress()` and `showAtProgress`: `1.2` is 20 % into the second iteration, in play order; clamped to `0 … iterations`, no upper bound when endless; nothing wraps |
| A negative speed multiplies with `iterationDirection` | `timeline.setSpeed(-1)` plays a `reverse` pass forwards. A file's `playbackSpeed` must be positive — in a file the direction is `iterationDirection` |
| On a scroll timeline only the scroll moves the playhead | `timeline.getState()` reads `scrubbing` on every engine and no playback callback fires. The buttons — `timeline.start()`, `timeline.play()`, `timeline.stop()`, `timeline.pause()`, `timeline.resume()` — `timeline.setSpeed()`, `timeline.setDurationAtSpeed()` and the seeks — `timeline.setCurrentTime()`, `timeline.setCurrentProgress()`, `timeline.setTotalTime()`, the components' `showAtProgress` / `showAtTime` — are ignored with the usage warning `scrollOwnsPlayhead` ([PX1505](../diagnostics.md#the-props-a-component-was-given)); the reads still answer |
| With no control prop the file drives | no `showAsStatic`, `showAt…`, `playback`, `disableActionTriggers` or `actionTriggers`: the document's own `actionTriggers` start it, on every player — a file saved with `"timeline.start": "load"` plays at once, a file without triggers stays still until code calls `timeline.start()` |
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
  "timeline": { "type": "scroll", "outTime": 3000 }
}
```

A scroll timeline answers three questions, one key each. Every key has a default, so `{ "type": "scroll" }`
alone is a whole timeline:

- **what** the playhead follows — `follows`: this animation, unless it says otherwise;
- **from which moment to which** — `firstFrameWhen` and `lastFrameWhen`: from when it appears to when it is
  gone, unless they say otherwise;
- whether it is **held on screen** meanwhile — `holdOnScreen`.

The clock keys — `actionTriggers`, `actions`, `delay`, `playbackSpeed`, `iterationDirection`, `whenIdle`,
`whenFinished`, `frameRate` and the gate numbers — have no slot on a scroll timeline.

<!-- px-check schema PxScrollTimelineSchema -->
| `timeline.` | Values | Default | Meaning |
|---|---|---|---|
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
// Across the screen: the first frame as it appears, the last as it is gone (the defaults)
"timeline": { "type": "scroll" }

// Draws itself while it comes in — done once all of it is in
"timeline": { "type": "scroll", "lastFrameWhen": "fullyIn" }

// Plays out as it goes
"timeline": { "type": "scroll", "firstFrameWhen": "startsToLeave" }

// From the middle of the screen until it is half out
"timeline": { "type": "scroll", "firstFrameWhen": "centered", "lastFrameWhen": "halfOut" }

// A reading-progress bar: how far the page is scrolled, top to bottom
"timeline": { "type": "scroll", "follows": "pageScroll" }

// …over the middle of the page only: from 20 % to 80 % scrolled
"timeline": { "type": "scroll", "follows": "pageScroll",
              "firstFrameWhen": { "scrolled": 0.2 }, "lastFrameWhen": { "scrolled": 0.8 } }

// Held in the centre of the screen for three screens of scrolling, playing meanwhile
"timeline": { "type": "scroll", "holdOnScreen": { "at": "center", "forScreens": 3 } }

// An element of the page drives it: the chapter, on its way across the screen
"timeline": { "type": "scroll", "follows": "pageDomElement", "selector": "#chapter-2" }

// An exact place: the first frame when its top is 80 % down the screen
"timeline": { "type": "scroll", "firstFrameWhen": { "domElement": "top", "screen": 0.8 } }

// A horizontal strip, a soft catch-up, a window of the keyframes played twice across the stretch
"timeline": { "type": "scroll", "axis": "horizontal", "smoothing": 150,
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
| One part follows the scroll while the rest plays on the clock | — : one timeline per document, so the whole document follows the scroll |
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
