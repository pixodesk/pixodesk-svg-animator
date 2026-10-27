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
      "outOfViewAction": "pause", "inViewThreshold": 0.5,
      "trigger": { "playOn": "load" }
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

## One idea: the trigger says WHEN, the timeline says HOW

Three things make an animation go: the **trigger** (the user hovers or clicks), a component's
**`play` / `pause` props** (your app's state), and the **player API** (`play()`, `pause()`,
`stop()` from your code). They are three ways of saying the same two words — *on* and *off* — so
the format writes down **how** a transition happens exactly once, in the timeline, and all three
honour it:

<!-- px-check off the one-idea overview — each key and list is checked in its own table below -->
| moment | the key that says what happens | its events (the trigger) |
|---|---|---|
| **play on** — stopped → playing | `playOnAction`: `resume` · `restart` · `jumpToEnd` | `trigger.playOn` |
| **play off** — playing or paused → stopped | `playOffAction`: `reset` · `rewind`, `completeIterationOnPlayOff` | `trigger.playOff` |
| **pause on / off** — freeze and continue | nothing to configure | `trigger.pauseOn` / `trigger.pauseOff` |
| **play end** — it stops by itself | `playEndAction`: `hold` · `reset` · `rewind` | — |
| **out of view** — nobody can see it | `outOfViewAction`: `pause` · `continue` · `reset` | — (a condition, not an event) |

So `player.stop()` on a looping heartbeat with `completeIterationOnPlayOff: true` finishes the
beat and then rests — and so does a `hoverOut` listed in `trigger.playOff`, and so does
`play={false}` on the React component. One vocabulary, learnt once.

## The `timeline` — what advances the playhead

`animator.timeline` says what *drives* the animation's progress, exactly like a Web Animations
API timeline. Its `type` picks the kind, mirroring WAAPI's `DocumentTimeline` /
`ScrollTimeline` / `ViewTimeline`:

<!-- px-check schema PxTimelineSchema values=type -->
| `timeline.type` | The playhead follows… |
|---|---|
| `time` (default — may be omitted) | wall time — something *starts* it (the `trigger`), and it has the playback dynamics below |
| `scroll` | a scroll container's offset — [Scroll-driven playback](#scroll-driven-playback-in-development) |
| `view` | the SVG's journey through the viewport — [Scroll-driven playback](#scroll-driven-playback-in-development) |

Each type carries only the fields that mean something for it — a scrubbed timeline has no
`trigger`, no `delay` and no play keys, and the format gives them no slot there. Omitting
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
| `timeline.playDuration` | ms | `outTime − inTime` | the window remapped to WALL time: one pass takes this long. Set it to play the same content faster or slower |
| `timeline.frameRate` | fps | uncapped | target rate for the player's frame loop only — a parameter of the engine `timeline.engine` selects, so it sits beside it |
| `timeline.engine` | `auto` · `native` · `js` | `auto` | how the animated attributes get updated — [Engine](#engine) |
| `timeline.delay` | ms | `0` | waited whenever a run starts from the beginning — the first play, a `restart`, a play after a reset or an end — never on a resume from a paused position. A **negative** value skips ahead instead: `-500` starts right away from the frame at 0.5 s |
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

## Play on, play off, play end — how a transition looks

Three keys, each named after the moment it describes. Every one has a stated default, so a
document that says nothing plays the way it always did: a play-on resumes, a play-off resets,
the end holds.

<!-- px-check values PxPlayOnAction pkg=core -->
| `playOnAction` | A play-on (a `playOn` event, `play={true}`, `play()`)… |
|---|---|
| `resume` (default) | continues from the current position. At the start or the end, that is a fresh run from the beginning |
| `restart` | starts from the beginning every time — a splash that must replay on every click |
| `jumpToEnd` | shows the end pose with no motion — overlay art that appears instantly and retreats animated |

<!-- px-check values PxPlayOffAction pkg=core -->
| `playOffAction` | A play-off (a `playOff` event, `play={false}`, `stop()`)… |
|---|---|
| `reset` (default) | jumps back to the state as before it started |
| `rewind` | plays BACK to it — the VCR word, never confused with `iterationDirection: reverse`. The trash-can lid: opens on hover-in, closes animated on hover-out |

<!-- px-check off one boolean, not a value list -->
| `completeIterationOnPlayOff` | WHEN the play-off takes effect |
|---|---|
| `false` (default) | now |
| `true` | after the current iteration — a heartbeat should not die mid-beat; a one-shot runs to its end first. Orthogonal to the action: `rewind` after completion plays back from there — finish the motion, then undo it smoothly |

<!-- px-check values PxPlayEndAction pkg=core -->
| `playEndAction` | When it ends by itself (every iteration played)… |
|---|---|
| `hold` (default) | keeps the last frame showing |
| `reset` | jumps back to the start state |
| `rewind` | plays back to the start state |

`reset` means ONE thing wherever it appears (`playOffAction`, `playEndAction`,
`outOfViewAction`): the state as before it started — the SVG as authored. A hand-authored file
whose static attributes differ from its first keyframe can ask for the **first frame** instead
with `showFirstFrameBeforePlayOn: true` (shown before the first play-on and after every reset).
The editor never writes that key: in its files the two are the same picture.

A **one-shot document** driven by a component's `play` prop reads these keys too: `play={true}`
is a play-on (the default `resume` plays to the end and holds there, per `playEndAction: hold`),
`play={false}` a play-off (`reset` snaps back, `rewind` plays back). The old `playMode` spellings
map onto them — `'both'` is `playOffAction: 'rewind'`, `'backwards'` is `playOnAction: 'jumpToEnd'`
+ `playOffAction: 'rewind'`, `'none'` is `playOnAction: 'jumpToEnd'`.

## Triggers — WHEN it plays

The `trigger` block — inside the time timeline — lists the user interactions that play, stop,
pause and resume the animation. Four lists, one per transition, over one open vocabulary of
events:

```json
"timeline": {
  "completeIterationOnPlayOff": true,
  "trigger": { "playOn": ["hoverIn", "click"], "playOff": "hoverOut", "pauseOn": "click" }
}
```

Read cold: play on hover-in or click, off (after the beat) on hover-out, a click while playing
pauses. Each list is a single event or an array of them — the house style of `animate`'s
references — and the editor writes the shortest exact spelling.

<!-- px-check schema PxTriggerSchema -->
| List | Acts while the player is… | Editor label |
|---|---|---|
| `playOn` | **stopped** — a play-on per `playOnAction` | *Plays on* |
| `playOff` | **playing or paused** — a play-off per `playOffAction` | *Stops on* |
| `pauseOn` | **playing** — freezes the current frame | *Pauses on* |
| `pauseOff` | **paused** — continues from there. Absent = a copy of `playOn` | *Resumes on* |

<!-- px-check values PxTriggerEvent pkg=core -->
| Event | Fires when… |
|---|---|
| `load` | the document is ready — the only event the visibility gate may hold back: nobody interacted, so it plays once enough of it is on screen |
| `hoverIn` | the pointer enters the element |
| `hoverOut` | the pointer leaves it — only after it entered (a pointer already over the element at load does not count) |
| `click` | the element is clicked (a tap on React Native) |

The vocabulary is open: a later interaction (keyboard, focus, an app event) is a new word in
the same lists, never a new key.

**The state rule.** The player's state picks the list an event is read from: `playOn` acts when
stopped, `pauseOn` when playing, `pauseOff` when paused, `playOff` when playing or paused. So
`click` in both `playOn` and `pauseOn` toggles through stopped → playing → paused → playing with
no toggle word; add `playOnAction: 'restart'` and a click while stopped restarts while a click
while paused still resumes. The same event in `playOff` *and* `pauseOn` asks for two different
things while playing — the players report it ([PX1109](../diagnostics.md)) and `pauseOn`
wins.

**Absent, or empty.** A document with no `trigger` block plays on load — a document is designed
to play. An **empty** block, `"trigger": {}`, lists nothing: nothing starts it until your code
calls `play()`. A list that is absent is simply not listed (`pauseOff` excepted — it copies
`playOn`).

**Pause and continue need no action.** Where an older file said "pause when the pointer leaves",
the trigger now lists `hoverOut` under `pauseOn`; "keep playing" is `hoverOut` not listed at all.
That is what the editor does for you: ticking *Hover in* under *Plays on* adds *Hover out* under
*Pauses on*, editable.

### Whether it may run — the visibility gate

An animation nobody can see does not play, whatever started it. The gate is a **condition on
every driver** — the trigger, a component's `play` prop and the API alike — not an event: it
remembers what was meant to happen and lets it happen once the element is on screen. Its three
keys sit in the timeline beside the play keys:

<!-- px-check values PxOutOfViewAction pkg=core -->
| `outOfViewAction` | Effect while none of it is on screen |
|---|---|
| `pause` (default) | pause where it is; it resumes when the element comes back |
| `continue` | keep playing — and start without waiting to be seen at all |
| `reset` | jump back to the start, so the next entry replays it from the beginning |

<!-- px-check off two plain numbers, not a closed value list — the schema block in the format guide carries their types -->
| Field | Default | Meaning |
|---|---|---|
| `inViewThreshold` | `0.5` | how much of the element must be on screen before it may run: `0` any part, `0.5` half of it, `1` all of it. Playback stops only at **zero** visibility, so an element resting on the boundary cannot flicker |
| `inViewDebounce` | `150` | and for how long, in ms. Scrolling straight past an animation therefore starts nothing; `0` starts the moment the threshold is met |

The return needs no key: if it was meant to run, it runs again — from the paused position after
`pause`, from the start after `reset`; `continue` never stopped. A hidden browser tab counts as
out of view. An element taller than the screen counts as fully visible once it fills the screen,
so a threshold of `0.5` or `1` can always be met. Where nothing can measure visibility — a server
render, a test environment without `IntersectionObserver` — the animation plays as if fully
visible, rather than silently never playing.

**To play an animation when it scrolls into view**, nothing has to be set: `playOn: load`
behind the default gate IS that behaviour — it waits on its first frame until half of it is on
screen for 150 ms, plays, pauses when scrolled away, and carries on when it comes back.

### Where triggers work

- **Every player** — web, React, Vue and React Native — honours the lists, the play keys and the
  gate, with one exception: React Native has no `hoverIn` / `hoverOut`, because there is no hover
  on a touch screen.
- **Pre-rendered SVG + CSS animation + JS triggers** honours all of them too. The editor writes a
  few lines of script into the file for this; no library is involved.
- **Pre-rendered SVG + CSS animation** (no script at all) listens for `load` and, through CSS
  `:hover`, for `hoverIn` and `hoverOut` — `hoverOut` may pause or stop, not both. `click` and the
  visibility gate cannot be done in pure CSS and are dropped from the file; the play actions keep
  their defaults (a class cannot restart keyframes or play them backwards). The editor marks every
  choice *(CSS)* or *(JS)* so you see what the script-free flavour keeps. See
  [Pre-rendered SVG](https://pixodesk.com/docs/svga/prerendered-svg/on-the-web#flavour-1--svg--css-animation).
- **The CSS components** (`SvgCssAnimationPlayer` in React and Vue) take the same `trigger` object
  and gate keys as props and read them with the same state rule; `rewind`, `restart`, `jumpToEnd`
  and the iteration completion act as the defaults there, for the same reason.

## Overriding from a player

> **Example:** [`playback/override-web`](../../examples/docs-examples/src/cases/playback/override-web/) — `pnpm example:docs`, then open `#playback/override-web`.
> **Example:** [`playback/override-react`](../../examples/docs-examples/src/cases/playback/override-react/) — `pnpm example:docs`, then open `#playback/override-react`.

One document can play differently in each place you use it — the same file shown twice at two
speeds, or a file that starts by itself everywhere except inside your own play/pause UI. Every
player takes the **same two overrides**, and the file on disk is never modified:

<!-- px-check off the two override props, prose — their types are checked in each player's signature block -->
| | prop / option | what it does |
|---|---|---|
| the timing | `timeline` | a **merge** over the file's `timeline` block, minus its `trigger`: an object shaped like the file, deep-merged key by key. Corrections — `iterations`, `delay`, `playOffAction` — never a replacement; whoever needs more edits the document |
| the trigger | `playOnTrigger` | `true` plays on the file's own trigger; an **object** is the whole trigger to use **instead** (a replacement — a trigger's lists belong together, so switching hover → click would otherwise carry the hover-era lists along). Keys left out take the format's defaults, not the file's values |

**Web player**

```html
<div id="box" style="width: 300px; height: 300px"></div>
```

```js
import { createSvgAnimationPlayer } from '@pixodesk/svg-animator-web';

const a = createSvgAnimationPlayer({
  src: '/bouncing-ball.json',
  container: '#box',
  timeline: { iterations: 'infinite', completeIterationOnPlayOff: true },   // no `playOnTrigger`: nothing starts until a.play()
});
a.play();
a.stop();      // finishes the current iteration, then rests — the timeline said so
```

**React / Vue / React Native** — the same objects, as props:

```jsx
// the file's trigger, looping forever
<SvgAnimationPlayer doc={doc} playOnTrigger timeline={{ iterations: 'infinite' }} />

// this trigger instead of the file's: plays on hover-in, plays back on hover-out
<SvgAnimationPlayer doc={doc} playOnTrigger={{ playOn: 'hoverIn', playOff: 'hoverOut' }}
  timeline={{ playOffAction: 'rewind' }} />

// driven by your state — the same words for the same transitions
<SvgAnimationPlayer doc={spinner} play={busy} timeline={{ completeIterationOnPlayOff: true }} />
```

### How the merge works

<!-- px-check off the merge rules, prose -->
| | |
| --- | --- |
| **Objects merge, key by key** | `timeline: { outTime: 2000 }` changes the window end and leaves `iterations`, the play keys and everything else as the file has them |
| **Values replace** | numbers, strings and arrays are taken as given, never combined |
| **`null` deletes** | `{ timeline: { delay: null } }` removes the file's delay, restoring what its *absence* means. This is the only way to get a default back, because there is no value that spells "unset" |
| **`trigger` is not a timeline key here** | the file nests it, the props lift it: only `playOnTrigger` carries a trigger, so every key is reachable exactly one way — `timeline={{ trigger: … }}` is a type error |
| **Changing `timeline.type` starts over** | switching between a clock and a scroll timeline keeps only `inTime`, `outTime`, `iterations`, `engine` and `frameRate` — the keys both kinds share. Clock-only keys (`trigger`, `delay`, `playDuration`, `iterationDirection`, the play keys, the gate keys) have no meaning on a scroll timeline and are dropped, with a console warning |

Every player uses the same code from core. `applyPlaybackOverride(doc, { timeline, playOnTrigger })`
is the one implementation the web player and the three components call: the timing merged
(`mergeAnimatorConfig`'s rules, above), then — when `playOnTrigger` is an object — the trigger
block set to it as a whole. Its input is a `PxPlaybackOverrideInput` (the `timeline` of
`PxPlaybackOverride` plus `playOnTrigger`), its answer a `PxPlaybackOverrideResult`: the new
document, sharing every untouched subtree, and the merge's warnings. `applyAnimatorConfig(doc, patch)`
applies a patch to a whole document; `mergeAnimatorConfig` does the same one level down, on the
`animator` block alone, and reports what it could and could not do in a `PxAnimatorConfigMergeResult`.
A patch is a `PxPatch` of the wire type — every key optional at every depth, `null` deletes,
arrays and primitives replace — so `PxAnimatorConfigPatch` patches the `animator` block and
`PxTimelinePatch` the timing, typed from `PxTimelineWithoutTrigger` (the timeline minus its
trigger). `withTrigger(doc, trigger)` is the SET the trigger needs (an empty block and a
replacement that drops keys are things a merge cannot say).

### A note on the components' control props

When you control a component with `play`, `pause`, `playCurrentProgress` or `playCurrentTime`,
the component ignores the trigger saved in the file: core's `withoutTriggerDriver` replaces it
with an **empty** trigger, so nothing starts the animation by itself — the same patch the web
player applies when `playOnTrigger` is absent. Only `playOnTrigger` mode follows the file's
trigger. `playerRef` is not a control prop: the handle is filled in every mode and never changes
which one you are in.

React, Vue and React Native decide this with the same core function, so they always agree.
`resolveControlMode` looks at the control props you passed (`PxControlProps`) and returns the
mode that wins (`PxControlMode`), plus a ready-made warning if you passed props from more than
one mode. `controlModeTakesOverTrigger` then says whether that mode ignores the file's trigger —
true for every mode except `playOnTrigger`.

### For player authors — the same rules, exported

Everything above is decided by functions in `@pixodesk/svg-animator-core`, so a player you
write yourself cannot drift from the four shipped ones:

- **Defaults.** `PX_PLAYBACK_DEFAULTS` is the one table of what an absent key means (`playOn:
  'load'`, `resume`, `reset`, `hold`, `pause`, 0.5, 150 ms). `resolveTrigger(trigger)` returns a
  `PxResolvedTrigger` — every list an array (`triggerEventList` normalises one), `pauseOff`
  defaulted to a copy of `playOn`, an absent block `{ playOn: ['load'] }`, an empty block nothing.
  `resolveGate(view)` returns the three gate keys defaulted, a `PxResolvedGate`.
- **The state rule.** `triggerActionFor(trigger, state, event)` — the player's state (`PxPlayState`:
  stopped · playing · paused) picks the list, and the answer is a `PxTriggerAction`: `play`,
  `pause` or `off`. `triggerListsEvent` says which listeners to attach at all; `triggerConflicts`
  names the events listed in both `playOff` and `pauseOn`.
- **The executor.** One `PxPlayExecutor` per player performs every on and off — `on()` per
  `playOnAction`, `off()` per `playOffAction` and `completeIterationOnPlayOff`, `pause()` /
  `resume()`, the state-rule `play()`, `cancel()` (the unconditional reset-now), `rewind()`, and
  `onNaturalEnd()`, which performs `playEndAction` when the engine reports the end. It owns the one
  state engines cannot report: paused versus stopped. `createPlayExecutor(api, config, raf)` builds
  one over any `PxPlayTarget` (the slice of the API it drives) from a `PxPlayExecutorConfig` (the
  run's geometry and the play keys — `executorConfigOf(view)` reads them from the runtime view, a
  `PxApiExtrasConfig`); `ensurePlayExecutor` reuses the one an engine attached. `composeApiExtras(api, cfg, raf)`
  then completes an engine's api (a `PxApiExtrasTarget`) with the composed members — `play()`,
  `stop()`, `cancel()`, `playOnce()`, `getDuration()` — as `PxApiExtras`. `applyDeclarativeAction`
  drives a `PxDeclarativeTarget` (the public api, or a component's proxy to it) from the
  declarative resolver's actions.
- **CSS.** `fillModeOf(showFirstFrameBeforePlayOn, playEndAction)` is the `animation-fill-mode`
  the two keys spell — (false, hold) `forwards`, (true, hold) `both`, (false, reset) `none`,
  (true, reset) `backwards` — what the CSS export and the WAAPI engine hand to the browser.

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
fields (`trigger`, `delay`, the play keys, `"infinite"`) have no slot in these timelines. The
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
