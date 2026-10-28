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
      "actions": { "suspend": { "transition": "pause" } }, "inViewThreshold": 0.5,
      "triggers": { "start": "load" }
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

## One idea: triggers say WHEN, actions say HOW

Three things make an animation go: the **triggers** (the user hovers or clicks), a component's
**`play` / `pause` props** (your app's state), and the **player API** (`play()`, `pause()`,
`stop()` from your code). All three call the same **built-in actions** — `start`, `stop`, `pause`,
`resume` — so the format writes down **how** each action looks exactly once, in the timeline's
`actions` block, and all three honour it:

<!-- px-check off the one-idea overview — each key and list is checked in its own table below -->
| action | does | how it looks (`actions`) | called by (`triggers`) |
|---|---|---|---|
| **start** | stopped or finished → playing | `start.transition`: `continue` · `restart` · `jumpToFinished` | `start` (or `togglePlay`) |
| **stop** | playing or paused → stopped | `stop.transition`: `reset` · `rewind`, `stop.completeIteration` | `stop` (or `togglePlay`) |
| **pause** / **resume** | freeze, and carry on | nothing to configure | `pause` / `resume` (or `togglePause`) |
| **finish** | the run ends by itself | `finish.transition`: `hold` · `reset` · `rewind` | — (the player) |
| **suspend** / **wake** | nobody can see it / seen again | `suspend.transition`: `pause` · `continue` · `reset` | — (the view sensor: a condition, not an event) |

So `player.stop()` on a looping heartbeat with `actions: { stop: { completeIteration: true } }`
finishes the beat and then rests — and so does a `hoverOut` listed in `triggers.stop`, and so does
`play={false}` on the React component. One vocabulary, learnt once.

## The `timeline` — what advances the playhead

`animator.timeline` says what *drives* the animation's progress, exactly like a Web Animations
API timeline. Its `type` picks the kind, mirroring WAAPI's `DocumentTimeline` /
`ScrollTimeline` / `ViewTimeline`:

<!-- px-check schema PxTimelineSchema values=type -->
| `timeline.type` | The playhead follows… |
|---|---|
| `time` (default — may be omitted) | wall time — something *starts* it (the `triggers`), and it has the playback dynamics below |
| `scroll` | a scroll container's offset — [Scroll-driven playback](#scroll-driven-playback-in-development) |
| `view` | the SVG's journey through the viewport — [Scroll-driven playback](#scroll-driven-playback-in-development) |

Each type carries only the fields that mean something for it — a scrubbed timeline has no
`triggers`, no `actions` and no `delay`, and the format gives them no slot there. Omitting
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

## Triggers — WHEN it plays

The `triggers` block — inside the time timeline — names the user interactions that call the
built-in actions. Four lists, one per action, and two toggles, over one open vocabulary of events:

```json
"timeline": {
  "actions": { "stop": { "completeIteration": true } },
  "triggers": { "start": ["hoverIn", "click"], "stop": "hoverOut", "pause": "click" }
}
```

Read cold: start on hover-in or click, stop (after the beat) on hover-out, a click while playing
pauses. Each list is a single event or an array of them — the house style of `animate`'s
references — and the editor writes the shortest exact spelling.

<!-- px-check schema PxTriggersSchema -->
| List | Calls | Acts while the player is… | Editor label |
|---|---|---|---|
| `start` | `start`, per `actions.start` | **stopped** (or finished) | *Plays on* |
| `stop` | `stop`, per `actions.stop` | **playing or paused** | *Stops on* |
| `pause` | `pause` — freezes the current frame | **playing** | *Pauses on* |
| `resume` | `resume` — carries on from there. Absent = a copy of `start`; `[]` = never | **paused** | *Resumes on* |
| `togglePlay` | `start` when stopped, otherwise `stop` | any state | — (read into *Plays on* + *Stops on*) |
| `togglePause` | `pause` when playing, `resume` when paused | playing or paused | — (read into *Pauses on* + *Resumes on*) |

<!-- px-check values PxTriggerEvent pkg=core -->
| Event | Fires when… |
|---|---|
| `load` | the document is ready — the only event the visibility gate may hold back: nobody interacted, so it plays once enough of it is on screen |
| `hoverIn` | the pointer enters the element |
| `hoverOut` | the pointer leaves it — only after it entered (a pointer already over the element at load does not count) |
| `click` | the element is clicked (a tap on React Native) |

The vocabulary is open: a later interaction (keyboard, focus, an app event) is a new word in
the same lists, never a new key.

**The toggles.** `togglePlay` and `togglePause` are sugar: their events go into two lists at once.

```json
"triggers": { "togglePlay": "click" }
```

One click starts it, the next stops it — also while paused. `togglePlay` puts its events under
`start` and `stop`; they are not copied into `resume` (only an explicit `start` list is), so a
click while paused stops, as the word says.

```json
"triggers": { "start": "load", "togglePause": "click" }
```

Plays on load; a click pauses, the next click resumes. `togglePause` puts its events under `pause`
and `resume`. Both toggles call the actions they stand for, so those actions' settings apply.

**One event, several actions.** An event may be listed under several actions —
`{ "start": "click", "pause": "click" }` is the usual click toggle (`{ "start": "click",
"togglePause": "click" }` says the same). The rule: every action listed for the event **whose
condition holds** runs, and all of them check the state **as it was when the event arrived**.

- A click while stopped: `start` holds, `pause` does not (it needs playing) → it starts. A click
  while playing: only `pause` holds → it pauses. A click while paused: `resume` (a copy of `start`)
  → it carries on.
- Add `actions: { start: { transition: 'restart' } }` and a click while stopped restarts, while a
  click while paused still resumes.
- The one real clash: the same event in `stop` *and* `pause` asks for two different things while
  playing — the players report it ([PX1109](../diagnostics.md)) and `pause` wins (and `resume`
  wins over `stop` while paused).

**Absent, or empty.** A document with no `triggers` block starts on load — a document is designed
to play. An **empty** block, `"triggers": {}`, lists nothing: nothing starts it until your code
calls `play()`. A list that is absent is simply not listed (`resume` excepted — it copies
`start`; `"resume": []` never resumes).

**Pause and carry on need no setting.** "Pause when the pointer leaves" is `hoverOut` listed under
`pause`; "keep playing" is `hoverOut` not listed at all. That is what the editor does for you:
ticking *Hover in* under *Plays on* adds *Hover out* under *Pauses on*, editable.

## Actions — how start, stop and finish look

`timeline.actions` gives the built-in actions their settings — one fixed block per action. A
`transition` is a **preset**: one word for where the move ends and the path it takes there (an
instant jump, playing on, playing back). Every setting has a stated default, so a document that
says nothing plays the way it always did: a start continues, a stop resets, the end holds.

<!-- px-check schema PxActionsSchema -->
| Field | Values | Default |
|---|---|---|
| `start.transition` | `continue` · `restart` · `jumpToFinished` | `continue` |
| `stop.transition` | `reset` · `rewind` | `reset` |
| `stop.completeIteration` | `true` · `false` | `false` |
| `finish.transition` | `hold` · `reset` · `rewind` | `hold` |
| `suspend.transition` | `pause` · `continue` · `reset` | `pause` — [the visibility gate](#whether-it-may-run--the-visibility-gate) |

`pause`, `resume` and `wake` have nothing to configure; the toggles use the settings of the actions
they call.

<!-- px-check values PxStartTransition pkg=core -->
| `actions.start.transition` | A start (a `start` event, `play={true}`, `play()`)… |
|---|---|
| `continue` (default) | continues from the current position. At the start or the end, that is a fresh run from the beginning |
| `restart` | starts from the beginning every time — a splash that must replay on every click |
| `jumpToFinished` | lands in finished: the end pose with no motion — overlay art that appears instantly and retreats animated |

<!-- px-check values PxStopTransition pkg=core -->
| `actions.stop.transition` | A stop (a `stop` event, `play={false}`, `stop()`)… |
|---|---|
| `reset` (default) | jumps back to the state as before it started |
| `rewind` | plays BACK to it — the VCR word, never confused with `iterationDirection: reverse`. The trash-can lid: opens on hover-in, closes animated on hover-out |

<!-- px-check off one boolean, not a value list -->
| `actions.stop.completeIteration` | WHEN the stop takes effect |
|---|---|
| `false` (default) | now |
| `true` | after the current iteration — a heartbeat should not die mid-beat; a one-shot runs to its end first. Orthogonal to the transition: `rewind` after completion plays back from there — finish the motion, then undo it smoothly |

<!-- px-check values PxFinishTransition pkg=core -->
| `actions.finish.transition` | When it ends by itself (every iteration played)… |
|---|---|
| `hold` (default) | keeps the last frame showing |
| `reset` | jumps back to the start state |
| `rewind` | plays back to the start state |

`reset` means ONE thing wherever it appears (the stop, finish and suspend transitions): the state
as before it started — the SVG as authored. A hand-authored file whose static attributes differ
from its first keyframe can ask for the **first frame** instead with `timeline.beforeStart`:

<!-- px-check values PxBeforeStart pkg=core -->
| `timeline.beforeStart` | The rest pose — before the first start and after every reset |
|---|---|
| `static` (default) | the SVG as authored |
| `firstFrame` | the first frame's values. The editor never writes it: in its files the two are the same picture |

A **one-shot document** driven by a component's `play` prop reads these settings too:
`play={true}` is a start (the default `continue` plays to the end and holds there, per finish
`hold`), `play={false}` a stop (`reset` snaps back, `rewind` plays back). The trash-can lid that
closes animated is `actions={{ stop: { transition: 'rewind' } }}`; overlay art that appears at once
and retreats animated is `actions={{ start: { transition: 'jumpToFinished' }, stop: { transition: 'rewind' } }}`.

### Whether it may run — the visibility gate

An animation nobody can see does not play, whatever started it. The gate is a **condition on
every driver** — the triggers, a component's `play` prop and the API alike — not an event: once
none of it is on screen the player calls the built-in `suspend`, and once it is seen again `wake`,
which carries on whatever was meant to run. `suspend` has one setting; the two numbers that say
when the sensor counts it as seen are plain timeline keys:

<!-- px-check values PxSuspendTransition pkg=core -->
| `actions.suspend.transition` | Effect while none of it is on screen |
|---|---|
| `pause` (default) | pause where it is; it resumes when the element comes back |
| `continue` | keep playing — and start without waiting to be seen at all |
| `reset` | jump back to the start, so the next entry replays it from the beginning |

<!-- px-check off two plain numbers, not a closed value list — the schema block in the format guide carries their types -->
| Field | Default | Meaning |
|---|---|---|
| `timeline.inViewThreshold` | `0.5` | how much of the element must be on screen before it may run: `0` any part, `0.5` half of it, `1` all of it. Playback stops only at **zero** visibility, so an element resting on the boundary cannot flicker |
| `timeline.inViewDebounce` | `150` | and for how long, in ms. Scrolling straight past an animation therefore starts nothing; `0` starts the moment the threshold is met |

`wake` needs no setting: if it was meant to run, it runs again — from the paused position after
`pause`, from the start after `reset`; `continue` never stopped. A hidden browser tab counts as
out of view. An element taller than the screen counts as fully visible once it fills the screen,
so a threshold of `0.5` or `1` can always be met. Where nothing can measure visibility — a server
render, a test environment without `IntersectionObserver` — the animation plays as if fully
visible, rather than silently never playing.

**To play an animation when it scrolls into view**, nothing has to be set: `start: load` behind
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
  their defaults (a class cannot restart keyframes or play them backwards). The editor marks every
  choice *(CSS)* or *(JS)* so you see what the script-free flavour keeps. See
  [Pre-rendered SVG](https://pixodesk.com/docs/svga/prerendered-svg/on-the-web#flavour-1--svg--css-animation).
- **The CSS components** (`SvgCssAnimationPlayer` in React and Vue) take the same `triggers`
  object, `actions` limited to `suspend`, and the two gate numbers as props, and read them with the
  same rules; `rewind`, `restart`, `jumpToFinished` and the iteration completion act as the
  defaults there, for the same reason.

## Overriding from a player

> **Example:** [`playback/override-web`](../../examples/docs-examples/src/cases/playback/override-web/) — `pnpm example:docs`, then open `#playback/override-web`.
> **Example:** [`playback/override-react`](../../examples/docs-examples/src/cases/playback/override-react/) — `pnpm example:docs`, then open `#playback/override-react`.

One document can play differently in each place you use it — the same file shown twice at two
speeds, or a file that starts by itself everywhere except inside your own play/pause UI. Every
player takes the **same three overrides**, and the file on disk is never modified:

<!-- px-check off the three override props, prose — their types are checked in each player's signature block -->
| | prop / option | what it does |
|---|---|---|
| the timing | `timeline` | a **merge** over the file's `timeline` block, minus its `triggers` and `actions`: an object shaped like the file, deep-merged key by key. Corrections — `iterations`, `delay`, `playDuration` — never a replacement; whoever needs more edits the document |
| the actions | `actions` | a **merge** over the file's `timeline.actions`, setting by setting — `{ stop: { transition: 'rewind' } }` changes how a stop looks and leaves the rest as the file has it |
| the triggers | `playOnTrigger` | `true` plays on the file's own triggers; an **object** is the whole `triggers` block to use **instead** (a replacement — the lists belong together, so switching hover → click would otherwise carry the hover-era lists along). Lists left out are simply not listed (`resume` copies `start`), never the file's values |

**Web player**

```html
<div id="box" style="width: 300px; height: 300px"></div>
```

```js
import { createSvgAnimationPlayer } from '@pixodesk/svg-animator-web';

const a = createSvgAnimationPlayer({
  src: '/bouncing-ball.json',
  container: '#box',
  timeline: { iterations: 'infinite' },
  actions: { stop: { completeIteration: true } },   // no `playOnTrigger`: nothing starts until a.play()
});
a.play();
a.stop();      // finishes the current iteration, then rests — the actions said so
```

**React / Vue / React Native** — the same objects, as props:

```jsx
// the file's triggers, looping forever
<SvgAnimationPlayer doc={doc} playOnTrigger timeline={{ iterations: 'infinite' }} />

// these triggers instead of the file's: starts on hover-in, plays back on hover-out
<SvgAnimationPlayer doc={doc} playOnTrigger={{ start: 'hoverIn', stop: 'hoverOut' }}
  actions={{ stop: { transition: 'rewind' } }} />

// one click starts it, the next stops it
<SvgAnimationPlayer doc={doc} playOnTrigger={{ togglePlay: 'click' }} />

// driven by your state — the same actions, the same settings
<SvgAnimationPlayer doc={spinner} play={busy} actions={{ stop: { completeIteration: true } }} />
```

### How the merge works

<!-- px-check off the merge rules, prose -->
| | |
| --- | --- |
| **Objects merge, key by key** | `timeline: { outTime: 2000 }` changes the window end and leaves `iterations` and everything else as the file has them; `actions: { stop: { transition: 'rewind' } }` leaves `stop.completeIteration` and the other actions alone |
| **Values replace** | numbers, strings and arrays are taken as given, never combined |
| **`null` deletes** | `{ timeline: { delay: null } }` removes the file's delay, restoring what its *absence* means; `{ actions: { stop: null } }` drops the file's stop settings. This is the only way to get a default back, because there is no value that spells "unset" |
| **`triggers` and `actions` are not timeline keys here** | the file nests them, the props lift them: only `playOnTrigger` carries triggers and only `actions` the action settings, so every key is reachable exactly one way — `timeline={{ triggers: … }}` is a type error |
| **Changing `timeline.type` starts over** | switching between a clock and a scroll timeline keeps only `inTime`, `outTime`, `iterations`, `engine` and `frameRate` — the keys both kinds share. Clock-only keys (`triggers`, `actions`, `beforeStart`, `delay`, `playDuration`, `iterationDirection`, the gate numbers) have no meaning on a scroll timeline and are dropped, with a console warning |

Every player uses the same code from core. `applyPlaybackOverride(doc, { timeline, actions, playOnTrigger })`
is the one implementation the web player and the three components call: the timing and the
actions merged (`mergeAnimatorConfig`'s rules, above), then — when `playOnTrigger` is an object —
the `triggers` block set to it as a whole. Its input is a `PxPlaybackOverrideInput` (the `timeline`
and `actions` of `PxPlaybackOverride` plus `playOnTrigger`), its answer a `PxPlaybackOverrideResult`: the new
document, sharing every untouched subtree, and the merge's warnings. `applyAnimatorConfig(doc, patch)`
applies a patch to a whole document; `mergeAnimatorConfig` does the same one level down, on the
`animator` block alone, and reports what it could and could not do in a `PxAnimatorConfigMergeResult`.
A patch is a `PxPatch` of the wire type — every key optional at every depth, `null` deletes,
arrays and primitives replace — so `PxAnimatorConfigPatch` patches the `animator` block,
`PxTimelinePatch` the timing, typed from `PxTimelineTiming` (the timeline minus `triggers` and
`actions`), and `PxActionsPatch` the `actions` block (`PxActions`). `withTriggers(doc, triggers)`
is the SET a `PxTriggers` block needs (an empty block and a replacement that drops keys are things
a merge cannot say).

### A note on the components' control props

When you control a component with `play`, `pause`, `playCurrentProgress` or `playCurrentTime`,
the component ignores the triggers saved in the file: core's `withoutTriggerDriver` replaces them
with an **empty** `triggers` block, so nothing starts the animation by itself — the same patch the
web player applies when `playOnTrigger` is absent. Only `playOnTrigger` mode follows the file's
triggers. The `play` / `pause` props call the built-in actions, so the file's `actions` (and the
`actions` prop) still say how each move looks. `playerRef` is not a control prop: the handle is
filled in every mode and never changes which one you are in.

React, Vue and React Native decide this with the same core function, so they always agree.
`resolveControlMode` looks at the control props you passed (`PxControlProps`) and returns the
mode that wins (`PxControlMode`), plus a ready-made warning if you passed props from more than
one mode. `controlModeTakesOverTrigger` then says whether that mode ignores the file's triggers —
true for every mode except `playOnTrigger`.

### For player authors — the same rules, exported

Everything above is decided by functions in `@pixodesk/svg-animator-core`, so a player you
write yourself cannot drift from the four shipped ones:

- **Defaults.** `PX_PLAYBACK_DEFAULTS` is the one table of what an absent key means
  (`start: 'load'`, the presets `continue` · `reset` · `hold` · `pause`, no iteration completion,
  `beforeStart: 'static'`, 0.5, 150 ms). `resolveTriggers(triggers)` returns a `PxResolvedTriggers` —
  every list an array (`triggerEventList` normalises one), the toggles expanded into the lists they
  stand for, `resume` defaulted to a copy of the explicit `start`, an absent block
  `{ start: ['load'] }`, an empty block nothing. `resolveActions(actions)` returns a
  `PxResolvedActions` — every setting defaulted. `resolveGate(view)` returns a `PxResolvedGate`:
  the `suspend` transition and the two sensor numbers, defaulted.
- **Schemas.** `PxTriggersSchema` (fixed lists) and `PxActionsSchema`, one fixed sub-schema per
  action — `PxStartActionSchema`, `PxStopActionSchema`, `PxFinishActionSchema`,
  `PxSuspendActionSchema` — each stating its defaults.
- **The event rule.** `triggerActionFor(triggers, state, event)` — the player's state (`PxPlayState`:
  stopped · playing · paused) picks the list, and the answer is a `PxTriggerAction`: `play`,
  `pause` or `stop`. `triggerListsEvent` says which listeners to attach at all; `triggerConflicts`
  names the events listed in both `stop` and `pause`.
- **The executor.** One `PxPlayExecutor` per player performs every built-in action — `start()` per
  `actions.start`, `stop()` per `actions.stop` (transition and iteration completion), `pause()` /
  `resume()`, the state-rule `play()`, `cancel()` (the unconditional reset-now), `rewind()`, and
  `onNaturalFinish()`, which performs `actions.finish` when the engine reports the end. It owns the one
  state engines cannot report: paused versus stopped. `createPlayExecutor(api, config, raf)` builds
  one over any `PxPlayTarget` (the slice of the API it drives) from a `PxPlayExecutorConfig` (the
  run's geometry and the `actions` — `executorConfigOf(view)` reads them from the runtime view, a
  `PxApiExtrasConfig`); `ensurePlayExecutor` reuses the one an engine attached. `composeApiExtras(api, cfg, raf)`
  then completes an engine's api (a `PxApiExtrasTarget`) with the composed members — `play()`,
  `stop()`, `cancel()`, `playOnce()`, `getDuration()` — as `PxApiExtras`. `applyDeclarativeAction`
  drives a `PxDeclarativeTarget` (the public api, or a component's proxy to it) from the
  declarative resolver's actions.
- **CSS.** `fillModeOf(beforeStart, finishTransition)` is the `animation-fill-mode` the two
  settings spell — (`static`, `hold`) `forwards`, (`firstFrame`, `hold`) `both`, (`static`, `reset`)
  `none`, (`firstFrame`, `reset`) `backwards` — what the CSS export and the WAAPI engine hand to the browser.

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
fields (`triggers`, `actions`, `delay`, `"infinite"`) have no slot in these timelines. The
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
