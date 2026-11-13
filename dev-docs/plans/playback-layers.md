# Playback layers — the lifecycle config, layer by layer

Status **2026-10-28 — layers 0–1 implemented** (schema 1.10; see [Implementation log](#implementation-log-2026-10-28)).

> **Since 2026-11-13 (owner decision; unpublished 1.26) — a player plays the way the file was saved.** With no control
> prop every surface plays on the document's own `actionTriggers` (the old "nothing plays until a prop names the
> driver" rule is reversed). The driver prop (`playOnTrigger` here; `playUsingActionTriggers`, then `playerActionTriggers`)
> is REMOVED: `actionTriggers` gives a whole block instead of the file's (`null` / `{}` = none), `disableActionTriggers`
> is manual (code presses the buttons), `showAsStatic` is the picture as drawn (playback calls ignored, PX1506). The
> `actions` prop now REPLACES the file's `actions` block (a slot left out reads its default; type `PxActionsInput`);
> `timelineOptions` still merges. See `component-api.md` (top note) and `docs/library/playback-and-triggers.md`.

> **Since 1.24–1.25 (2026-11-11) — the playback model.** The words below moved; this document keeps the ones it was written
> with (`animation-state.brainstorm.md` §0 and `animation-state.playback-noun.md` are the ledger; 1.24 spelt the
> noun `Run`; `animation-state.playback-namespace.md` moved the handle under `player.playback`). File `actionTriggers` /
> `actions` keys `start` · `stop` · `pause` · `resume` → `"playback.start"` · `"playback.stop"` · `"playback.pause"` ·
> `"playback.resume"` (values unchanged; `playback.resume` still derived); `actions.finish` → the timeline key `atEnd`;
> props `play` / `pause` / `playState` → one `playback="off" | "on" | "paused"`; handle — everything on `player.playback`:
> `play()` → `playback.start()` (+ `playback.stop()` · `playback.pause()` · `playback.resume()`; no aliases), `stop()` →
> `playback.stop()`, `playOnce()` → `playback.playOnce()`, `getPlayState()` → `playback.getState()` (`idle` → `off`, new
> `returning`), new `playback.isActive()`, the time reads under `playback.` (`getPlaybackSpeed()` → `playback.getSpeed()`,
> `getPlaybackDuration()` → `playback.getDurationAtSpeed()` …); callbacks `onPlay` → `onPlaybackStart` +
> `onPlaybackResume`, `onPause` → `onPlaybackPause`, `onStop` → `onPlaybackStop`; types `PxPlayState` → `PxPlaybackState`,
> `Px{Start,Stop,Finish}Behavior` → `PxStartPlaybackBehavior` / `PxStopPlaybackBehavior` / `PxAtEndBehavior`,
> `PxPlayStateRequest` → `PxPlayback`; `playStateToLevels` and PX1502 retired.

> **Since 1.21 (2026-11-04)** — this document keeps the words of the version it was written for; the current contract
> differs in these points (`dev-docs/reviews/schema-and-props--manual-review.md` has the reasoning): an absent
> `actionTriggers` block ≡ `{}` ≡ nothing starts it — autoplay is always written `start: 'load'` (1.17; the "block
> absent = load" lines below are history); `jumpToFinished` → `jumpToEnd` (1.18); `showWhenStopped` → `whenIdle` and
> `PxPlayState` is `idle · playing · paused · finished · destroyed` (1.19); `timeline.playDuration` → `playSpeed`
> (1.16); the component props `play` / `pause` → `playWhile` / `pauseWhile`, plus a `playState` word; the handle's
> `cancel()` / `finish()` are `reset()` / `jumpToEnd()`, `setPlaybackRate` → `setPlaySpeed`, and plain time reads are
> INSIDE the iteration (`total…` for the playback).
>
> **Since 1.23 (2026-11-05)** — decided in `dev-docs/reviews/schema-and-props--improvements.md` §0: `playSpeed` → `playbackSpeed` (1.22) and the handle's `play…` family → `playback…`; the action words name where and how (1.23) — `reset` → `jumpToStart`, `rewind` → `animateToStart`, `restart` → `jumpToStart`, `stop.completeIteration: true` → `stop: 'animateToEnd'` (plus `stop: 'jumpToEnd'`), and reaching the end by any route runs `finish`; `reset()` → `jumpToStart()` (reports nothing), `onReset` removed, `onWarn` → `onWarning`; the props are `play` / `pause` again beside `playState`, one driver family at a time in TypeScript; `null` no longer deletes in an override.

Layers 0 and 1 REPLACE D6 in
[component-api.md](./component-api.md) ("improved D6" = layers 0 and 1 together; layer 1 lists the
differences) and describe exactly today's schema 1.9, renamed and regrouped — see
[Implementing layers 0–1](#implementing-layers-01). Layers 2–5 are the design direction beyond that
(not planned yet). Started as a brainstorm on the schema seen as a state machine.

**What we model.** The PLAYBACK LIFECYCLE of one animation: it rests, plays, pauses, finishes, is
stopped. Three things are configured: WHO causes each change (an event on the page, the app's
state, the app's code), HOW each change looks, and WHAT the timeline is while in a state.

**Scope.** Everything here lives in a `timeline` of `type: 'time'` only. A scroll or view timeline is
driven by the scroll position — it has no lifecycle, so none of these blocks has a slot there.

**The layers.** Each layer EXTENDS the previous one; a file uses the lowest layer that says what it
needs, and the defaults of the lower layers make the common case short. The Editor's right panel
(Playback Triggers, Playback Behaviour) edits layers 0 and 1 with fixed fields, so the UI stays easy;
higher layers live in the file.

| layer | adds | a typical file |
|---|---|---|
| [0](#layer-0--triggers-only) | `triggers` — which events call the built-in actions; everything else implicit | hover in plays, hover out pauses |
| [1](#layer-1--how-each-built-in-action-looks-improved-d6) | `actions` — how each built-in action looks; with layer 0, this is improved D6 | the trash-can lid closes by playing back |
| [2](#layer-2--states-and-rules) | `state` and rules — the states written out, custom variables, custom actions | it plays the first time you hover, never again |
| [3](#layer-3--segments) | `state.segment` — named windows of the timeline | an intro, then a loop, a success at the end |
| [4](#layer-4--inputs-sensors-and-values-that-follow-them) | inputs — sensor variables, values that follow them, moves through a segment | a character walks, jumps while hovered, crawls while pressed |
| [5](#layer-5--not-designed) | not designed | counters, parallel parts, blends, scenes |

The rest: [Not covered by the layers](#not-covered-by-the-layers) — where it came from, why these
shapes, naming, Rive and dotLottie, more examples, limits, open questions.

## Layer 0 — triggers only

The file names which events call the built-in actions. Every action behaves as today's default;
nothing else is written.

```ts
type EventName = 'load' | 'hoverIn' | 'hoverOut' | 'click';                 // open vocabulary: a new interaction = a new word
type Trigger   = EventName | { on: EventName; target?: `#${string}` };       // on the whole SVG, or on one element (by #id)
type Triggers  = Trigger | Array<Trigger>;                                   // one, or several
interface Timing {                                                           // the timeline's own keys, as today
    inTime?: number; outTime?: number; playDuration?: number; delay?: number;
    iterations?: number | 'infinite';
    iterationDirection?: 'normal' | 'reverse' | 'alternate' | 'alternateReverse';
    engine?: 'auto' | 'native' | 'js'; frameRate?: number;
}
interface Timeline0 extends Timing {
    triggers?: {                         // WHO calls each built-in action; block absent = { start: 'load' }; {} = nothing starts it
        start?: Triggers; stop?: Triggers; pause?: Triggers; resume?: Triggers;      // resume absent = derived; named = honoured (the 1.15 release)
                                         // no toggle keys (1.12): the two click toggles are start + stop and start + pause on 'click'
    };
}
```

The built-in actions, at their defaults:

| action | does | called by |
|---|---|---|
| `start` | stopped or finished → playing: a fresh playback from the beginning | `triggers.start` (block absent: `load`) |
| `stop` | playing, paused or finished → stopped: jumps back to the start | `triggers.stop` |
| `pause` | playing → paused: freezes the current frame | `triggers.pause` |
| `resume` | paused → playing: carries on where it froze | `triggers.resume` (absent: the triggers of `start`) |
| the click toggles | start / stop: `start` + `stop` on `click`; play / pause: `start` + `pause` on `click` — the lists themselves (the `togglePlay` sugar of 1.10 was removed in 1.12; `togglePause` already in 1.10) | `triggers.start` + `triggers.stop` / `triggers.pause` |
| `finish` | the natural end: holds the last frame (→ finished) | the player, when the playback ends |
| `outOfView` | out of view: freezes the clock, keeps what was meant to run (`suspend` until 1.12) | the player's view sensor |
| `wake` | back in view: carries on what `outOfView` froze | the player's view sensor |

A click toggle is its two lists, so those actions' settings (layer 1) apply to it as they are.

```json
{
  "type": "svg",
  "viewBox": "0 0 24 24",
  "animator": {
    "timeline": {
      "outTime": 600, "iterations": "infinite",
      "triggers": { "start": "hoverIn", "pause": "hoverOut" }
    }
  },
  "children": [
    { "type": "path", "d": "M12 2a10 10..." }
  ]
}
```

Hover in starts it; hover out pauses it; hover in again resumes it (resume ← the triggers of start).

Two buttons inside the SVG — each trigger targets an element:

```json
{
  "type": "svg",
  "viewBox": "0 0 24 24",
  "animator": {
    "timeline": {
      "outTime": 600, "iterations": "infinite",
      "triggers": {
        "start": { "on": "click", "target": "#btn-play" },
        "stop":  { "on": "click", "target": "#btn-play" },
        "pause": { "on": "click", "target": "#btn-pause" }
      }
    }
  },
  "children": [
    { "type": "path", "d": "M12 2a10 10..." },
    { "type": "rect", "id": "btn-play",  "x": 2,  "y": 18, "width": 8, "height": 4 },
    { "type": "rect", "id": "btn-pause", "x": 14, "y": 18, "width": 8, "height": 4 }
  ]
}
```

**One event, several actions.** An event may be listed under several actions —
`{ "start": "click", "pause": "click" }` is the usual click toggle. The rule: every action listed for the event WHOSE CONDITION HOLDS runs, and
all of them check the state AS IT WAS when the event arrived.

- A click while stopped: `start` holds (it acts when stopped), `pause` does not (it needs playing) →
  it starts. A click while playing: only `pause` holds → it pauses.
- Without "as it was", a click while stopped would start it, and then `pause` would see playing and
  pause it at once — the click would seem to do nothing.
- The alternative "warn and call none" would break this toggle, the most common config; "call all,
  each checking its own condition" is what makes it work.
- A real clash is two actions that both hold and want different states — `{ "stop": "hoverOut",
  "pause": "hoverOut" }` while playing. The player warns when it loads the file (today's PX1109) and a
  fixed order decides: `pause` and `resume` win over `stop`.

**From the app** (the app's code that shows the animation: component props, the player API):

- `playOnTrigger` — the file's triggers drive it; an object instead REPLACES the file's `triggers`.
- `play` / `pause` props CALL the built-in actions: `play` true → `start` (or `resume` when paused),
  false → `stop`; `pause` true → `pause`, false → `resume`. This is how the components already work.
- `playerRef` / the player API: `play()` resumes when paused, otherwise `start`; `pause()`; `stop()`;
  and three app-only calls that are not actions: `cancel()` (back to stopped at once, ignoring every
  setting — e.g. on navigation), `finish()` (jump to finished), `playOnce()` (one pass from the start).

## Layer 1 — how each built-in action looks (improved D6)

Layers 0 and 1 together are improved D6. `actions` gives the built-in actions settings. A `behavior` (1.14; `transition` in 1.10, `do` in 1.11) is a PRESET: one word that packs WHERE
the move ends and the PATH it takes there (an instant jump, playing on, playing back).
`completeIteration` is a third decision: WHEN the move starts — now, or after the current iteration.

```ts
interface Timeline1 extends Timeline0 {
    showWhenStopped?: 'static' | 'firstFrame';      // what shows while STOPPED — before the first start, after a reset, where a rewind lands; default static (niche; `beforeStart` until 1.14)
    inViewThreshold?: number;                       // when the view sensor counts it as seen: 0–1 of it on screen, default 0.5
    inViewDebounce?: number;                        //   …for this long, ms, default 150
    actions?: {                                     // HOW each built-in action looks — settings only; no custom names (1.14: `behavior`,
        start?:     StartBehavior | { behavior?: StartBehavior };                                 //   and the word itself when `behavior` is all)
        stop?:      StopBehavior | { behavior?: StopBehavior; completeIteration?: boolean };      // reset, false
        finish?:    FinishBehavior | { behavior?: FinishBehavior };                               // hold
        outOfView?: OutOfViewBehavior | { behavior?: OutOfViewBehavior };                         // pause (`suspend` until 1.12)
    };                                              // pause, resume, wake: nothing to configure
}
type StartBehavior = 'continue' | 'restart' | 'jumpToFinished';   // default continue
type StopBehavior = 'reset' | 'rewind';
type FinishBehavior = 'hold' | 'reset' | 'rewind';
type OutOfViewBehavior = 'pause' | 'continue' | 'reset';
interface _ {
}
```

| action | preset | ends in | path (layer 2 spells these two separately) |
|---|---|---|---|
| `start` | `continue` | playing | plays on from where it is — from the beginning when it rests at the start or the end |
| `start` | `restart` | playing | from the beginning, always |
| `start` | `jumpToFinished` | finished | an instant jump to the end pose, no motion |
| `stop` | `reset` | stopped | an instant jump back to the start |
| `stop` | `rewind` | stopped | plays backwards to the start |
| `finish` | `hold` | finished | stays on the last frame |
| `finish` | `reset` / `rewind` | stopped | jumps back / plays back |
| `outOfView` | `pause` / `continue` / `reset` | — (the clock, not a state) | freezes / keeps playing while unseen / jumps to the start and replays when seen |

```json
{
  "type": "svg",
  "viewBox": "0 0 24 24",
  "animator": {
    "timeline": {
      "outTime": 400,
      "inViewThreshold": 0.25,
      "actions": {
        "stop":      { "behavior": "rewind", "completeIteration": true },
        "outOfView": "reset"
      },
      "actionTriggers": { "start": "hoverIn", "stop": "hoverOut" }
    }
  },
  "children": [
    { "type": "path", "d": "M12 2a10 10..." }
  ]
}
```

(Schema 1.11, D7: the block is `actionTriggers`, and a slot's preset is written as the word when it is the only
setting. 1.12 dropped the toggle sugar — the lists spell the toggles; 1.13 renamed `suspend` → `outOfView`;
1.14 named the preset key `behavior`; 1.15 renamed `beforeStart` → `showWhenStopped`.)

The lid: hover in opens it; hover out lets it finish opening, then plays it back closed. Scrolled
away, it goes back to the start; it counts as seen once a quarter of it is on screen.

**From the app:** the `actions` prop MERGES over the file's `actions` (`null` deletes a key — since 2026-11-13 it
REPLACES the whole block); the
`timelineOptions` prop merges over the timing. Whoever calls an action — a trigger, the `play` prop, `stop()`
— gets the same settings:

```tsx
<SvgAnimationPlayer doc={lid} play={hovered} actions={{ stop: 'rewind' }} />
```

The CSS components (`SvgCssAnimationPlayer`, React and Vue) take `actionTriggers`, `actions` limited to
`outOfView` (the only setting a class toggle can honour), `inViewThreshold` and `inViewDebounce`.

**Improved D6 against D6** (in `component-api.md`):

| D6 | improved D6 |
|---|---|
| `actions.outOfView: { transition, threshold, debounce }` | `actions.outOfView: { behavior }` (`suspend: { transition }` until 1.12), with `wake` as its pair; `inViewThreshold` / `inViewDebounce` stay timeline keys — they say when the sensor fires, not how a move looks |
| `actions.start.beforeStart` | `timeline.showWhenStopped` (`beforeStart` until 1.14) |
| start's `jumpToEnd` | `jumpToFinished` — named after the state it lands in |
| — | the click toggles, spelt with the lists (`togglePlay` existed 1.10–1.11, `togglePause` only in drafts of 1.10) |
| triggers are event words | a trigger may also target an element: `{ "on": "click", "target": "#id" }` |

## Layer 2 — states and rules

> **Implemented early (2026-10-31, D7):** the four-state rule — `finished` is a state of its own in `PxPlayState`; `start`
> acts on stopped or finished, `stop` on playing, paused or finished (and wins over `start` there, so a click toggle undoes
> a finished one-shot). The rest of this layer is still design.

**The key grammar.** A custom action is ONE name used in both blocks the same way:
`actionTriggers.<name>` says when the page asks for it, `actions.<name>` says what it does — both
optional. The built-ins already follow it: `start` and `stop` have both, `pause` has only a trigger
list (one behavior: freeze), `finish` and `outOfView` have only a behavior (they are not page events).

The states become visible. `state.playback` is built in (`stopped` initial, `playing`, `paused`,
`finished`) and needs no declaration; a file may add its own variables. An action becomes a RULE:
from which values (`when`), to which values (`set`), by which path (`path`) and when
(`completeIteration`). Every layer-1 preset is shorthand for its `set` + `path` (the table above).

```ts
type EventName2 = EventName | 'ended';                                 // the playback reached its end — now bindable
interface Timeline2 extends Timeline1 {
    state?: {
        playback?: Values<'stopped' | 'playing' | 'paused' | 'finished'>;   // built in — written only to configure a value
        [variable: string]: Values;                                           // a custom variable, e.g. a flag
    };
    actions?: Timeline1['actions'] & {
        [name: string]: Action;            // a built-in name + a rule REPLACES its rule; any other name is a custom action
    };
    triggers?: Timeline1['triggers'] & {
        [action: string]: EventName2 | Triggers;                             // custom actions are triggered the same way
    };
}
type Values<V extends string = string> = { [value in V]?: Value };       // the first value is initial, unless one says so
interface Value {
    initial?: true;                        // a value says what the timeline IS while the variable holds it — always an
}                                          //   object, even empty, so a value can grow settings later (layer 3)
type Action = Rule | Array<Rule>;          // a list: the first rule whose `when` holds runs
interface Rule {
    when?: { [variable: string]: string | Array<string> };   // FROM: each variable listed holds one of these values
    set?:  { [variable: string]: string };                   // TO: the values assigned — or, instead:
    run?:  string;                                           //     forward to another action (its settings apply)
    path?: 'jump' | 'continue' | 'restart' | 'rewind';       // HOW the playhead gets there; default jump
    completeIteration?: boolean;                             // WHEN: now, or after the current iteration
}
// The built-ins are these predefined rules:
//   start       { when: { playback: ['stopped', 'finished'] },           set: { playback: 'playing'  }, path: 'continue' }
//   stop        { when: { playback: ['playing', 'paused', 'finished'] }, set: { playback: 'stopped'  }, path: 'jump' }
//   pause       { when: { playback: 'playing' },                         set: { playback: 'paused'   } }
//   resume      { when: { playback: 'paused' },                          set: { playback: 'playing'  }, path: 'continue' }
//   (the click toggles are the lists themselves — start + stop, start + pause — and need no rule)
//   finish      { set: { playback: 'finished' } }                       ← 'ended'
//   outOfView / wake act on the CLOCK and never set playback: playback keeps the intent, so wake carries on only
//   what was running — they keep their layer-1 form
```

The layer-1 lid, written out (the same document as the layer-1 example):

```json
{
  "type": "svg",
  "viewBox": "0 0 24 24",
  "animator": {
    "timeline": {
      "outTime": 400,
      "inViewThreshold": 0.25,
      "state": {
        "playback": { "stopped": { "initial": true }, "playing": {}, "paused": {}, "finished": {} }
      },
      "actions": {
        "start":   { "when": { "playback": ["stopped", "finished"] },
                     "set": { "playback": "playing" }, "path": "continue" },
        "stop":    { "when": { "playback": ["playing", "paused", "finished"] },
                     "set": { "playback": "stopped" }, "path": "rewind", "completeIteration": true },
        "pause":   { "when": { "playback": "playing" }, "set": { "playback": "paused" } },
        "resume":  { "when": { "playback": "paused" },  "set": { "playback": "playing" }, "path": "continue" },
        "finish":  { "set": { "playback": "finished" } },
        "outOfView": { "behavior": "reset" }
      },
      "triggers": { "start": "hoverIn", "stop": "hoverOut", "resume": "hoverIn", "finish": "ended" }
    }
  },
  "children": [
    { "type": "path", "d": "M12 2a10 10..." }
  ]
}
```

A custom variable and a custom action — it plays the first time you hover, never again:

```json
{
  "type": "svg",
  "viewBox": "0 0 24 24",
  "animator": {
    "timeline": {
      "outTime": 800,
      "state": {
        "seen": { "no": {}, "yes": {} }
      },
      "actions": {
        "firstLook": { "when": { "seen": "no" }, "set": { "playback": "playing", "seen": "yes" }, "path": "continue" }
      },
      "triggers": { "firstLook": "hoverIn" }
    }
  },
  "children": [
    { "type": "path", "d": "M12 2a10 10..." }
  ]
}
```

`seen` starts at `no` (its first value). The first hover sets both variables: playback to playing,
`seen` to `yes` — so the rule never holds again. A `triggers` block is written without `start`, so it
does not play on load.

**From the app:**

- `stateValues={{ seen: 'yes' }}` — the current value of each state variable EXCEPT `playback` (which
  `play` / `pause` already control). A variable listed there belongs to the app: the file's actions
  no longer set it. (Named for what it holds; `state` would reuse the file block's name for a
  different shape — the file defines the values, the prop picks one.)
- `playerRef.current.run('firstLook')` — calls a custom action, with its rule.

## Layer 3 — segments

`state.segment` is a built-in variable KIND: its values are named windows of the one timeline (Lottie
calls them markers). Its value says which part plays while it holds — `inTime` / `outTime` — and may
override the timeline's own keys for that window, with the same merge rules as the component's
`timeline` prop (`null` deletes a key, so its default applies). Only `segment` defines a window, so
two variables never compete for it.

```ts
interface Timeline3 extends Timeline2 {
    state?: Timeline2['state'] & {
        segment?: { [name: string]: Segment };     // which window of the timeline plays
    };
}
interface Segment extends Value {
    inTime: number; outTime: number;               // the window
    timeline?: PxTimelinePatch;                    // the timeline's keys overridden while this segment plays
}
// 'ended' fires when the CURRENT SEGMENT's playback ends; `finish` decides with its rules (move on to the next segment, or rest).
// A switch takes the rule's path: jump = cut to the new segment's start (default); rewind = play the current one back first;
// completeIteration waits for the current iteration.
```

Why the override matters: below, the timeline says `iterations: 'infinite'`. The loop inherits it and
runs forever; the intro and the success delete it (`null`), so they play once — and only a segment
that plays once ever ends, which is what moves the intro on to the loop.

```json
{
  "type": "svg",
  "viewBox": "0 0 800 400",
  "animator": {
    "timeline": {
      "outTime": 5000, "iterations": "infinite",
      "state": {
        "segment": {
          "intro":   { "inTime": 0,    "outTime": 1000, "timeline": { "iterations": null } },
          "loop":    { "inTime": 1000, "outTime": 3500 },
          "success": { "inTime": 3500, "outTime": 5000, "timeline": { "iterations": null } }
        }
      },
      "actions": {
        "finish": [
          { "when": { "segment": "intro" }, "set": { "segment": "loop" } },
          { "set": { "playback": "finished" } }
        ],
        "playLoop": { "set": { "playback": "playing", "segment": "loop" }, "path": "continue", "completeIteration": true },
        "close":    { "set": { "playback": "stopped", "segment": "intro" }, "path": "rewind", "completeIteration": true }
      },
      "triggers": {
        "start":    "load",
        "playLoop": { "on": "click", "target": "#btn-play" },
        "close":    { "on": "click", "target": "#btn-close" }
      }
    }
  },
  "children": [
    { "type": "rect", "id": "btn-play",  "x": 100, "y": 200, "width": 80, "height": 40 },
    { "type": "rect", "id": "btn-close", "x": 600, "y": 200, "width": 80, "height": 40 }
  ]
}
```

On load it plays the intro (the first segment), then the loop. The play button switches to the loop
after the current iteration; the close button plays back to the start and returns to the intro.
`finish` is written as rules, so it replaces the built-in one — its last rule restates the default.
`success` is reachable from the app (or a later trigger).

**From the app:** `stateValues={{ segment: 'loop' }}` — a change cuts to that segment (path `jump`);
for an animated switch the app calls an action: `run('close')`.

## Layer 4 — inputs: sensors, and values that follow them

Layers 2–3 REACT to events. Some behaviour is a TARGET instead: "crawl while the pointer is pressed"
should hold whatever happened before, and settle there by itself. Three additions:

- **Sensor variables** kept by the player, read in `when`, never declared: `view` (`visible` ·
  `hidden`) and `pointer` (`out` · `over` · `down`).
- **Derived values**: a segment value with a `when` makes the variable FOLLOW the inputs — the player
  keeps it on the first value whose `when` holds, re-checked at load, whenever a variable it reads
  changes, and whenever a segment ends. `from` says how to arrive from a given value. A variable is
  either derived or set by actions — never both.
- **`via`**: move through a named segment (a posture change drawn in the timeline), then land.

```ts
type EventName4 = EventName2 | 'pointerDown' | 'pointerUp' | 'viewIn' | 'viewOut';   // bindable too
interface Rule4 extends Rule {
    via?: string;                                   // play this segment as the move, then land
}
interface Segment4 extends Segment {
    when?: Rule['when'];                            // DERIVED: wanted while this holds
    from?: { [source: string]: Pick<Rule4, 'path' | 'completeIteration' | 'via'> };   // how to arrive from a given segment
}                                                   // a segment without `when` is reachable only through `via`
```

A character: it walks; while hovered it jumps; while pressed it crawls. Getting down
(`walkToCrawl`) and getting up (`crawlToWalk`) are drawn in the timeline; a posture change that is
interrupted plays back the way it came.

```json
{
  "type": "svg",
  "viewBox": "0 0 400 400",
  "animator": {
    "timeline": {
      "outTime": 4400, "iterations": "infinite",
      "state": {
        "segment": {
          "walk": {
            "when": { "pointer": "out" }, "inTime": 1000, "outTime": 2000,
            "from": { "crawl": { "via": "crawlToWalk" }, "walkToCrawl": { "path": "rewind" } }
          },
          "jump": {
            "when": { "pointer": "over" }, "inTime": 2000, "outTime": 2600,
            "from": { "walk": { "completeIteration": true }, "crawl": { "via": "crawlToWalk" }, "walkToCrawl": { "path": "rewind" } }
          },
          "crawl": {
            "when": { "pointer": "down" }, "inTime": 2600, "outTime": 3600,
            "from": { "walk": { "via": "walkToCrawl" }, "jump": { "via": "walkToCrawl" }, "crawlToWalk": { "path": "rewind" } }
          },
          "walkToCrawl": { "inTime": 3600, "outTime": 4000, "timeline": { "iterations": null } },
          "crawlToWalk": { "inTime": 4000, "outTime": 4400, "timeline": { "iterations": null } }
        }
      },
      "triggers": { "start": "load" }
    }
  },
  "children": [
    { "type": "g", "id": "character", "children": [] }
  ]
}
```

| part | meaning |
|---|---|
| `when` on `walk` / `jump` / `crawl` | the three pointer values, so exactly one posture is wanted at any time |
| `"via": "crawlToWalk"` | from crawling it gets up first, then walks or jumps |
| `"path": "rewind"` from a posture change | released while still getting down → it stands back up the way it went down |
| `"completeIteration": true` (walk → jump) | the current step finishes before the jump |
| `walkToCrawl` / `crawlToWalk` | no `when`: never wanted for their own sake; they play once (`iterations: null`) |

It settles by itself: a `via` segment plays to its end (unless the new target lists it under `from`, as
the `rewind` entries do), and then the variable lands on the posture wanted AT THAT MOMENT. With rules
alone (layer 3) this takes about a dozen rules and still loses cases — released while getting down,
pointer still over it: it lands on walk, and no event comes to bring it to jump.

## Layer 5 — not designed

- Operations on custom variables: counters ("after three clicks"), comparisons in `when`.
- Parallel parts: legs walking while an arm waves — a second playhead bound to a subtree.
- Blends: a crossfade between two segments.
- Scenes that switch timelines — the whole machine then moves up from `timeline` to `animator`.

## Implementing layers 0–1

> **Names as of 1.15.** This section was written for 1.10 and keeps its words: `transition` became `do` (1.11)
> and `behavior` (1.14); the `togglePlay` sugar was removed (1.12) — the lists themselves spell the two click
> toggles; `suspend` → `outOfView` (1.13); `beforeStart` → `showWhenStopped` (1.15); a named `resume` list is
> honoured since the 1.15 release (PX1111 notes where it differs from the derivation).

**Verdict.** Layers 0–1 describe EXACTLY what schema 1.9 does today: every key has one place (the table
in [Where it came from](#where-it-came-from)), every value keeps its meaning, every rule keeps its
behaviour. It is a rename and a regroup, plus two additions in layer 0:

- **`togglePlay` / `togglePause`** — sugar: the same events listed under `start` and `stop`, or under
  `pause` and `resume`, which 1.9 already expresses. Cheap: they expand while the triggers are
  resolved, so the state rule and the engines do not change. Implement now.
- **Element targets** (`{ "on": "click", "target": "#id" }`) — new behaviour: listeners per element,
  the `#id` remapped when the player mints fresh ids, the SVG + JS script, and React Native has no
  element events. Defer.

| 1.9 behaviour | layers 0–1 | |
|---|---|---|
| absent trigger block = start on load; `{}` = nothing starts it | the same on `triggers` | same |
| resume absent = the triggers of start; `pauseStop: []` = never resumes | `resume` absent / `[]` | same |
| the state rule, `pauseStart` / `pauseStop` winning over `playStop` (PX1109) | the event rule of layer 0 | same |
| `playStartAction` `resume` · `restart` · `jumpToEnd` | `actions.start.transition` `continue` · `restart` · `jumpToFinished` | renamed |
| `playStopAction`, `completeIterationOnPlayStop`, `playFinishAction` | `actions.stop.*`, `actions.finish.transition` | moved |
| `showFirstFrameBeforePlayStart` false · true | `beforeStart` `static` · `firstFrame` | boolean → word |
| the gate: `outOfViewAction`, hold and release keeping the intent | `actions.suspend.transition`; `suspend` / `wake` | renamed |
| `inViewThreshold`, `inViewDebounce` | unchanged | same |

### The wire

- **A 1.10 step**, one `PX_WIRE_STEPS` entry, lossless both ways (an `up` and a `down`), then the schema
  release and docs-check. Not folded into 1.9: Editor builds since the 1.9 commit stamp `1.9.1` into
  saved files, so development files may already carry the 1.9 spelling (1.9 is unpublished either way).
- **Unstamped documents are not converted on read.** The 122 React Native explorer cases now carry the
  1.9 spelling without a stamp — stamp them (and any other unstamped fixture) before the converter runs.
- **Schemas:** `PxTriggersSchema` with fixed keys (`start`, `stop`, `pause`, `resume`, `togglePlay`,
  `togglePause`); `PxActionsSchema`, an object with one fixed sub-schema per action (`start`, `stop`,
  `finish`, `suspend`) — known keys, not a record — each stating its defaults; `beforeStart` on the time
  timeline schema.

### The player

- **Core:** `resolveAnimatorTimeline` / `nestAnimatorTimeline` map the two blocks to the runtime view,
  which carries `triggers` and `actions` as blocks (as it carries `trigger` today), defaulted by
  `resolveTriggers` / `resolveActions`; the executor reads `actions.start.transition` and the like; the
  toggles expand in `resolveTriggers`. The engines and the state rule are untouched.
- **Surfaces:** the components and the web player take `actions` (a merge, `PxActionsPatch`; a replacement,
  `PxActionsInput`, since 2026-11-13); the
  `timeline` prop's type omits `triggers` and `actions`; `playOnTrigger` takes `boolean | PxTriggers`;
  the CSS components as in layer 1.
- **Docs and examples:** the vocabulary page first, then every guide, README and example, as with D5.

### The Editor model

Fixed attributes in fixed model objects — the pattern of today's trigger container, no maps:

| today (`TSvgSvgAnimationAttr`) | layers 0–1 |
|---|---|
| `trigger`: `TSvgSvgAnimationTriggerAttr` with the lists `playStart` · `playStop` · `pauseStart` · `pauseStop` | `triggers`: the same container, lists `start` · `stop` · `pause` · `resume` |
| `playStartAction` | `actions.start.transition` |
| `playStopAction` · `completeIterationOnPlayStop` | `actions.stop.transition` · `actions.stop.completeIteration` |
| `playFinishAction` | `actions.finish.transition` |
| `outOfViewAction` | `actions.suspend.transition` |
| `showFirstFrameBeforePlayStart` | `beforeStart` (no UI, as today) |
| `inViewThreshold` · `inViewDebounce` | unchanged |

`actions` is a container (`TSvgSvgAnimationActionsAttr`) holding four FIXED child containers — `start`,
`stop`, `finish`, `suspend` — each with its own attributes (`TStrValue` for `transition`, `TBoolValue`
for `completeIteration`), keys from `schemaKeys(PxActionsSchema)` and the sub-schemas, never strings.
Each setting stays one attribute, so everything that reads it today keeps working with a new path: the
panel fields, the pure-CSS limit predicates, the SVG + JS trigger script, the export dialog's copy, the
preview players. The toggles get no attributes: the Editor reads a hand-written `togglePlay` into its
`start` and `stop` lists (same behaviour; a save writes the lists).

### The right panel

No reorganisation: the two sections already ARE layers 0 and 1.

| section | fields | layer |
|---|---|---|
| Playback Triggers | Use JS Triggers · Play on · Stop on · Pause on · Resume on | `triggers` (0) |
| Playback Behaviour | Play Action · Stop Action (+ Complete Iteration checkbox) · End Action · Out-of-View Action · In-View Threshold · In-View Delay | `actions` and the sensor numbers (1) |

Labels unchanged. Only the test ids follow the new keys — the lists by their key (`start`, `stop`,
`pause`, `resume`), the behaviour fields as `startTransition`, `stopTransition`, `stopCompleteIteration`,
`finishTransition`, `suspendTransition` — so the atests, the video scripts and the learn-video generator
change their ids once more. Optional: "Out of View" → "When out of view", in line with the other three
"When …" fields, now that it is an action. No UI for the toggles or for targets.

### Work by repository

| repository | work |
|---|---|
| player | schemas, the 1.10 step and release; resolve / nest and the runtime-view blocks; the toggles' expansion; the executor, web, React Native and CSS-component read sites; the `actions` / `playOnTrigger` / `timeline` prop types; tests; docs and examples |
| kf | the model containers and their keys; the panel bindings and test ids; the export dialog's config; the SVG + JS trigger script; fixtures restamped `1.10.1`, the field universe, the feature-explorer cases re-settled, the lifecycle fixtures; atest and video ids; learn assets reconverted (`convert-assets.mjs`); the relevant specs |
| website | the docs sync; the editor pages' key tables |

Mostly mechanical, like the start / stop rename. The one structural change is the play keys moving into
`actions` blocks, which the runtime view then carries as a block.

### Trigger rules (2026-10-29, folded into the unpublished 1.10)

| rule | detail |
|---|---|
| Each list names only the events that make sense | `start` load·hoverIn·click · `stop` hoverOut·click · `pause` hoverIn·hoverOut·click · `togglePlay` click; `allowedTriggerEvents(list)` is the one table, the schema is built from it (`px.words` — repair DROPS an unknown word, never puts a default in place of the list) |
| `togglePause` removed | `pause: 'click'` says the same now that resume is derived |
| `resume` derived for the built-in events | `derivedResume`: the counterpart of each pause event (hoverIn ↔ hoverOut, click → click) + the `start` events that do not also stop; an explicit built-in entry is ignored (PX1111); the key stays for element targets / custom pause-resume buttons |
| Collisions | `stop` + `pause` on one event (playing — pause wins), `stop` + a pause counterpart (paused — resume wins); allowed, warned (PX1109), marked red in the Editor; start+pause and start+stop on click are NOT collisions |
| One helper for players and Editor | `triggerIssues(triggers)` → structured `{ kind, list, event, otherList? }` (eventNotAllowed PX1110 · collision PX1109 · resumeIgnored PX1111) |
| Editor | `Play on` inline + "None (manual)"; `Stop on` / `Pause on` multi-select dropdowns + [x]; `Resume on` shown, disabled; the model no longer stores `resume` |

### Implementation log (2026-10-28)

Done in one pass across player, kf and website (nothing committed; staged).

| decision / deviation | why |
|---|---|
| The 1.10 step is `up` only (no `down`) | 1.10 can say what 1.9 could not (`togglePlay` / `togglePause`); the owner: no backwards compatibility needed before release |
| An EMPTY action block is dropped by resolve / nest (`actions.start: {}` → absent) | it says nothing; without it the SVG + JS export embedded `start: {}` / `stop: {}` / `finish: {}` |
| `resolveTriggers` computes `resume` from the EXPLICIT `start` before adding the toggles | a `togglePlay` click while paused stops, as the word says |
| The Editor reads a hand-written toggle INTO its four lists (`resume` spelled out when it no longer equals `start`) | no attributes for the toggles; a save writes the lists |
| Option labels unchanged ("Resume" for `continue`, "Jump to end" for `jumpToFinished`, "Out of View") | agreed: labels unchanged; "When out of view" stays optional |
| Test ids follow the keys: lists `start` / `stop` / `pause` / `resume`; behaviour `startTransition` · `stopTransition` · `stopCompleteIteration` · `finishTransition` · `suspendTransition`; preview timeline panel `timeline-startTransition` … | as planned |
| SVG + CSS trigger script variables `startOn` / `stopOn` / `pauseOn` / `resumeOn` | the exported file reads in the new words |
| Export dialog local config: fields renamed, stored keys stay opaque (`plOnAc` …) | local preferences, not wire |
| Preview pages (videos): new `data-px-actions` attribute = the `actions` prop | play keys left the `timeline` patch |

Verification: core 763 tests, web 215, React 68, Vue 49, RN 42 green; `pnpm check:docs` green (154);
kf typecheck = the 7 known errors; the kf specs touched by the rename green (serialisation, schema
explorer, wire guard, use / effects round-trips, feature explorer, export / preview, website file
examples); feature-explorer cases settled with 0 oracle diffs; website build + link check green.

Not run (offered): the e2e atests whose ids changed (`preview-basic-SVG_CssAnim_JsTrigger`,
`2da--(exportSvga(SVG_CssAnim_JsTrigger)-verify)`), the sequential `trigger-explorer.flaky.spec.ts`, the
full unit suite, the Playwright example / e2e suites. Five old web e2e fixtures were in 1.8 spelling
(their triggers were silently ignored); converted, they now play as written — re-check `animate-basic` /
`animate-triggers` screenshots. Pending (owner): re-record the learn videos and quick starts, publish the
packages, commit the website.

## Not covered by the layers

### Where it came from

Schema 1.9 (implemented) has the same lifecycle with flat keys; layers 0–1 regroup them (names as first designed — see the 1.15 note above):

| schema 1.9 | layers 0–1 |
|---|---|
| `trigger.playStart` · `playStop` · `pauseStart` · `pauseStop` | `triggers.start` · `stop` · `pause` · `resume` |
| `playStartAction`: `resume` · `restart` · `jumpToEnd` | `actions.start.transition`: `continue` · `restart` · `jumpToFinished` |
| `playStopAction` · `completeIterationOnPlayStop` | `actions.stop.transition` · `actions.stop.completeIteration` |
| `playFinishAction` | `actions.finish.transition` |
| `showFirstFrameBeforePlayStart`: false · true | `beforeStart`: `static` · `firstFrame` |
| `outOfViewAction` | `actions.suspend.transition` |
| `inViewThreshold` · `inViewDebounce` | unchanged |
| the "state rule" (the player's state picks the list an event is read from) | each built-in's condition — written out in layer 2 |

### Why these shapes

- **Actions are keyed by MOVES**, not by states and not by events.
  - Not by the state they reach: `start` (from stopped) and `resume` (from paused) both reach
    playing, but are configured differently (`restart` applies to a start, never to a resume); and
    some settings CHOOSE the state reached (`jumpToFinished` lands in finished, `finish: reset` in
    stopped), so they cannot sit under one.
  - Not by event (`"hoverIn": { "playback": "playing" }`): a click must mean "start" when stopped and
    "pause" when playing, which a map from event to state cannot say.
- **Moves on actions, being on values.** How you get somewhere belongs to the move — Rive and dotLottie
  also put duration and "exit time" on transitions. A value says what the timeline is while held (a
  segment's window).
- **The gate is not a pause.** `outOfView` / `wake` act on the clock and leave `playback` alone, so `wake`
  carries on only what was running. Setting `paused` instead would turn every scroll-away into a user
  pause that nothing resumes.
- **`showWhenStopped` is not in the state.** The rest pose applies to every rest, whatever caused it — a
  rendering setting of the timeline (the CSS analogue is `animation-fill-mode`) — and is rarely needed:
  in Editor files the static SVG and the first frame are the same picture.
- **The initial value** carries `initial: true`; without a marker, the first value is initial. That
  relies on key order: every JavaScript engine keeps the insertion order of string keys (value names
  are identifiers, never numbers, which JavaScript would reorder), but a tool that sorts JSON keys would
  change it — so the Editor always writes the marker.
- **Two kinds of variables.** Built-in kinds, whose effect the player knows: `playback` (the clock),
  `segment` (the window), `view` and `pointer` (the sensors), later perhaps `scene`. Custom variables
  (like `seen`) have no effect of their own; only conditions read them. Adding a kind is a format
  feature, not configuration.

### From the first sketches

The state-variable idea started from sketches that put actions under event names
(`"hoverIn": { "animation": "playing" }`), transitions on the values (`"stopped": { "transition":
"rewind" }`), element listeners in an `inputs` block and segments as `range` arrays. What changed, and
why:

| first sketch | now | why |
|---|---|---|
| actions keyed by event | actions keyed by move, events in `triggers` | an event-keyed map cannot express a toggle |
| transition settings on the value reached | on the action | two moves reach the same value with different settings |
| `inputs: { playBtn: { selector, events } }` + action keys like `"playBtn:click"` | a trigger entry `{ "on": "click", "target": "#id" }` | no small language hidden in key strings; no registry linking by shared names; `#id` survives fresh ids |
| `range: [1001, 3500]` | `inTime: 1000, outTime: 3500` | adjacent segments share their boundary — no 1 ms gaps — and reuse the timeline's own words |
| a segment's `transition: hold \| continue` | the rule's `path` + `completeIteration` | a segment switch needs WHEN it happens and HOW the playhead gets there, not playback words |
| nothing moved the intro on to the loop | `ended` + `finish` rules | the natural end of a segment is an event like any other |
| `beforeStart` on `playing` | `timeline.showWhenStopped` (`beforeStart` until 1.14) | it is what shows while NOT playing, and it applies to every rest |

### Naming notes

- **`outOfView` / `wake`** — `outOfView` (1.13) names the condition in the words `inViewThreshold` / `inViewDebounce` already use. `suspend` (until 1.12) was the browser's and the OS's word for a page or device going inactive and back, and asked "suspended by what?".
  Considered: `sleep` / `wake`; `freeze` / `unfreeze` (the Page Lifecycle API's `freeze`, whose partner
  is `resume` — taken); `deactivate` / `activate`; `hidden` / `visible` (the Page Visibility API — but
  those are states, not moves).
- **`stateValues`** — considered: `state` (the file block's name, for a different shape), `machineState`,
  `playCurrentState` (after the `play*` family of controlled props).
- **`jumpToFinished`** — named after the state it lands in.
- **`target: '#id'`, never a CSS selector.** Players mint fresh ids on every render (two copies on one
  page must not clash) and remap `#id` references; a raw selector cannot be remapped.
- **Not `inputs`** for event sources: in Rive and dotLottie an input is a VARIABLE (boolean, number). The
  binding carries the target instead, so one button may fire several actions and several buttons one
  action.
- **`playback`, not `animation`**: `animate` and `definitions.animations` already mean property
  animations. **`initial`, not `isDefault`**: "default" already means what an absent key reads as.
- **`segment`**, earlier `content`; Lottie says markers. Action and variable names are keys of the
  file, so camelCase.

### Rive and dotLottie

Both are general state machines: the author defines the states (each plays an animation or a segment),
transitions guarded by conditions on inputs (variables), and pointer listeners that set the inputs.
Rive builds the graph in its editor (binary `.riv`); dotLottie stores it as JSON. Ours is a FIXED
machine with built-in states and actions — the lid is two lines here, and three states, two
interactions and guarded transitions in dotLottie. The layers grow toward theirs (states in layer 2,
conditions on sensors in layer 4) without making simple files longer.

| ours | dotLottie / Rive |
|---|---|
| `hoverIn` · `hoverOut` · `click` | `PointerEnter` · `PointerExit` · `Click` |
| `finish` (`ended`) | `OnComplete` |
| `load` | the initial state + `autoplay` |
| `stop` with `rewind` | a state with `mode: Reverse` |
| `completeIteration` | a transition held until `OnLoopComplete` — Rive calls it exit time |

### More examples

**A character: it stands; walks while hovered; a click jumps, then it carries on** — walking if the
pointer is still over it, standing otherwise. A click during the jump is ignored, and hovering in or
out during the jump does not cut it. Rules (layer 3) plus the `pointer` sensor (layer 4):

```json
{
  "type": "svg",
  "viewBox": "0 0 400 400",
  "animator": {
    "timeline": {
      "outTime": 4400, "iterations": "infinite",
      "state": {
        "segment": {
          "idle": { "inTime": 0,    "outTime": 1000 },
          "walk": { "inTime": 1000, "outTime": 2000 },
          "jump": { "inTime": 2000, "outTime": 2600, "timeline": { "iterations": null } }
        }
      },
      "actions": {
        "startWalking": { "when": { "segment": "idle" }, "set": { "segment": "walk" } },
        "stopWalking":  { "when": { "segment": "walk" }, "set": { "segment": "idle" }, "completeIteration": true },
        "jump":         { "when": { "segment": ["idle", "walk"] }, "set": { "segment": "jump" } },
        "finish": [
          { "when": { "segment": "jump", "pointer": ["over", "down"] }, "set": { "segment": "walk" } },
          { "when": { "segment": "jump" }, "set": { "segment": "idle" } }
        ]
      },
      "triggers": { "start": "load", "startWalking": "hoverIn", "stopWalking": "hoverOut", "jump": "click" }
    }
  },
  "children": [
    { "type": "g", "id": "character", "children": [] }
  ]
}
```

**A scene sketch** — a hypothetical built-in kind `scene` that shows one group of the document at a
time (`show` is invented here):

```json
{
  "type": "svg",
  "viewBox": "0 0 800 400",
  "animator": {
    "timeline": {
      "outTime": 5000,
      "state": {
        "scene": {
          "home":   { "show": "#home" },
          "detail": { "show": "#detail" }
        }
      },
      "actions": {
        "openDetail": { "set": { "scene": "detail" } },
        "goHome":     { "set": { "scene": "home" } }
      },
      "triggers": {
        "start":      "load",
        "openDetail": { "on": "click", "target": "#card" },
        "goHome":     { "on": "click", "target": "#back" }
      }
    }
  },
  "children": [
    { "type": "g", "id": "home",   "children": [
      { "type": "rect", "id": "card", "x": 100, "y": 100, "width": 200, "height": 120 } ] },
    { "type": "g", "id": "detail", "children": [
      { "type": "rect", "id": "back", "x": 20, "y": 20, "width": 60, "height": 30 } ] }
  ]
}
```

### Limits

- **Blends** — one timeline has one playhead, so a change is a cut, a move through a segment or a
  rewind, never a crossfade (Rive's blend states). Smooth changes have to be drawn as segments.
- **Parts moving independently** — would need a second playhead bound to a subtree (Rive's layers): one
  more variable kind, but a real engine feature.
- **Facing and positions** — walking left versus right, or across the canvas, is a transform driven by
  a variable, not a segment of the timeline.

### Open questions

- **Placement**: inside `timeline` or on `animator` — needed once a variable (a scene) can switch timelines.
- **Order inside one action**: `close` both rewinds and switches to the intro — rewind within the current
  segment first, then switch?
- **Sugar**: `intro: { …, next: 'loop' }` instead of the first `finish` rule in layer 3?
- **Built-in names**: written with settings they merge, with a rule they replace — confirm; may `start` /
  `stop` be replaced at all, when the app's `play` / `stop()` rely on them?
- **Default bindings once a `triggers` block is written**: `start` then fires only on what is listed (no
  implicit `load`), while `resume` ← the triggers of `start`, `finish` ← `ended` and `outOfView` / `wake` ←
  the view sensor stay. Confirm.
- **Engine event names**: `ended`, `viewIn` / `viewOut`, `pointerDown` / `pointerUp`, an `iteration` event —
  and which of them may be rebound.
- **Raw DOM event names** in `on` (`dblclick`, `keydown`): an open vocabulary versus portability (React
  Native has no DOM events).
- **`pointer` on touch screens**: there is no hover, so it goes `out` → `down` → `out`; and a press that
  slides off the character — still `down`?
- **`stateValues` ownership**: only app-controlled, or may the file's actions change a value the app also
  sets? And how does the app learn the current values — an `onStateChange` callback?
- **Paths**: are `jump` · `continue` · `restart` · `rewind` enough? Setting the value a variable already has
  with path `restart` (replay mid-run) — allowed?
- **A segment's `timeline` override**: which keys may it hold — `iterations`, `iterationDirection`,
  `playDuration`, `delay`?

### References

- dotLottie state machine specification — https://docs.lottiefiles.com/en/format/dotlottie/interactivity/state-machines/specification
- Rive state machine: listeners — https://rive.app/docs/editor/state-machine/listeners · transitions — https://rive.app/docs/editor/state-machine/transitions
- XState — parallel (orthogonal) states — https://stately.ai/docs/parallel-states
