# Pixodesk SVG Animator — `animator` block and `<SvgAnimationPlayer>` props: a brief for an outside review

Status **2026-11-01**. Schema **1.11** (`animator.version` `"1.11.x"`), the component as it will ship in the next
`@pixodesk/svg-animator-react` release (the published 1.0.52 still reads schema 1.10 and the old names — see §9).
Self-contained: every type and example a reviewer needs is in this file; nothing has to be looked up.

**What we are asking you to judge.** Two public surfaces that must read right *without the docs*:

1. the `animator` block of a document — the JSON a designer saves from the editor and a developer ships; in particular
   `animator.timeline`, its `actionTriggers` and `actions`;
2. the props of the React component `<SvgAnimationPlayer>` (Vue and React Native take the same props; the plain web
   player takes most of them as options).

For each name we give what it does, why it is called that, what else was considered, and examples with commentary.
Where we already doubt a choice we say so (§8), so you can agree, disagree or propose a third word.

---

## 0. The product in one paragraph

An animation is a **JSON document**: an SVG tree written as JSON, where any attribute can carry `keyframes` next to
it. The editor writes such files; a **player** (web, React, Vue, React Native — or a few lines of script inside a
pre-rendered SVG) renders the tree and animates the attributes. One block at the root, `animator`, holds everything
about **how the document plays**: the content window, repeats, what starts it, how a start / stop / end looks, and
what to do while nobody can see it. Everything a player can do from code or props calls the same handful of
**built-in actions** the file configures, so the vocabulary is learnt once.

```json
{
  "type": "svg", "viewBox": "0 0 400 400",
  "animator": {
    "version": "1.15.1",
    "timeline": { "outTime": 1000, "iterations": "infinite", "actionTriggers": { "start": "load" }, "actions": { "outOfView": "pause" } }
  },
  "children": [
    { "type": "ellipse", "cx": 139, "cy": 163, "rx": 64, "ry": 64, "fill": "#007fff85",
      "animate": { "transform": { "keyframes": [
        { "time": 0,    "value": { "translate": [0, 0] } },
        { "time": 1000, "value": { "translate": [0, 147] }, "easing": [0.42, 0, 0.58, 1] } ] } } }
  ]
}
```

That is a new document as the editor saves it today (the stamp aside): a ball drops for one second, forever, starting
when loaded and seen, pausing while scrolled out of view.

---

## 1. The design in four sentences

1. **Triggers say WHEN, actions say HOW.** `timeline.actionTriggers` keys are the REQUESTS a page event can make
   (`start`, `stop`, `pause`; `resume` derived unless the file names it); `timeline.actions` keys are the MOMENTS
   whose outcome is configurable (`start`, `stop`, `finish`, `outOfView`). `start` and `stop` appear in both because
   each is both a request and a moment — `stop` in `actionTriggers` says *when* a stop happens, `stop` in `actions`
   says *what a stop does*. The blocks are not symmetrical and do not claim to be: `pause` has one behavior (freeze),
   so no `actions.pause`; `finish` and `outOfView` are not page events, so no list.
2. **Three drivers, one vocabulary.** A user event (hover, click), a component's `play` / `pause` props and the
   handle's `play()` / `stop()` all call the same built-in actions, so a file's `actions` settings hold whoever is
   driving.
3. **Everything playback lives inside `timeline`.** `animator` itself keeps only what is not playback: the lookup
   tables (`definitions`, `bindings`) and the schema stamp (`version`).
4. **Every optional key has a stated default**, and the common case writes nothing: no `animator` block at all means
   one 1000 ms pass, playing on load, holding the last frame.

The built-in actions:

| action | does | configured in `actions` | called from `actionTriggers` by |
|---|---|---|---|
| **start** | stopped or finished → playing | `start.behavior`: `continue` · `restart` · `jumpToFinished` | the `start` list |
| **stop** | playing, paused or finished → stopped | `stop.behavior`: `reset` · `rewind`; `stop.completeIteration` | the `stop` list |
| **pause** / **resume** | freeze where it is / carry on | nothing to configure | the `pause` list; `resume` derived from it unless the file names one |
| **finish** | the run reached its end by itself | `finish.behavior`: `hold` · `reset` · `rewind` | — (the player) |
| **outOfView** / back in view | none of it on screen / seen again | `outOfView.behavior`: `pause` · `continue` · `reset` | — (the visibility sensor; a condition, not an event) |

---

## 2. The `animator` block — TypeScript types

These are the shipped types, condensed (the real ones are generated from runtime schemas and carry the same keys;
`Px` is the package prefix). Comments are the TSDoc the developer sees on hover.

```ts
// ─── the root ───────────────────────────────────────────────────────────────────────────────
/** The document's `animator` block as written in a file. Playback lives inside `timeline`;
 *  a flat key (`duration`, `trigger`, …) does not type-check here — the player drops it. */
interface PxAnimatorConfig {
    timeline?: PxTimeline;          // WHAT ADVANCES THE PLAYHEAD and every playback setting
    definitions?: PxDefinitions;    // named easings / animations / embedded fonts, used by name
    bindings?: Array<PxBinding>;    // bind-by-id documents only: which named animations drive which `#id`
    version?: string;               // the schema stamp "a.b.c" — written by the editor, never a gate (§2.5)
}

// ─── the timeline: a discriminated union, mirroring WAAPI's DocumentTimeline / ScrollTimeline / ViewTimeline
type PxTimeline = PxTimeTimeline | PxScrollTimeline | PxViewTimeline;   // `type` absent = 'time'

/** The time-driven timeline — the one an absent `type` (or an absent `timeline`) selects. */
interface PxTimeTimeline {
    type?: 'time';
    engine?: 'auto' | 'native' | 'js';   // how the attributes get updated (default auto): the browser's API where it can, else our frame loop
    frameRate?: number;                  // target fps of OUR frame loop only; uncapped when absent
    inTime?: number;                     // CONTENT ms where the window begins (default 0); keyframe times are absolute content ms
    outTime?: number;                    // CONTENT ms where it ends (default: the last keyframe); the editor always writes it
    playDuration?: number;               // WALL ms one pass takes (default outTime − inTime) — stretch or squeeze the same content
    delay?: number;                      // ms waited whenever a run starts from the beginning — never on a resume; negative skips ahead
    iterations?: number | 'infinite';    // whole-document repeats (default 1)
    iterationDirection?: 'normal' | 'reverse' | 'alternate' | 'alternateReverse';   // WAAPI `direction`, camelCased
    actionTriggers?: PxActionTriggers;   // WHEN each built-in action fires. ABSENT = { start: 'load' }; {} = nothing starts it
    actions?: PxActions;                 // HOW start / stop / finish / outOfView look
    showWhenStopped?: 'static' | 'firstFrame';  // the rest pose before the first start and after a reset (default static = the SVG as authored)
    inViewThreshold?: number;            // how much must be on screen to count as seen: 0..1 (default 0.5; 0 = any pixel)
    inViewDebounce?: number;             // …for how long, ms (default 150)
}

// ─── WHEN ────────────────────────────────────────────────────────────────────────────────────
/** An interaction a trigger listens for — an OPEN list: a new interaction is a new word, never a new key. */
type PxTriggerEvent = 'load' | 'hoverIn' | 'hoverOut' | 'click';
/** One event, or several. */
type PxTriggerEvents = PxTriggerEvent | Array<PxTriggerEvent>;

/** WHEN each built-in action fires. A key names the action; the same key in `actions` says how that action looks.
 *  The player's STATE picks the list an event is read from: `start` acts when stopped or finished, `pause` when
 *  playing, the derived resume when paused, `stop` when playing, paused or finished. */
interface PxActionTriggers {
    start?: PxTriggerEvents;        // may name: load · hoverIn · click        (starting when the pointer LEAVES makes no sense)
    stop?: PxTriggerEvents;         // may name: hoverOut · click              (stopping on load or on pointer ARRIVAL makes no sense)
    pause?: PxTriggerEvents;        // may name: hoverIn · hoverOut · click    (a marquee pauses on hoverIn, a hover animation on hoverOut)
    resume?: PxTriggerEvents;       // DERIVED for the built-in events (§3.3); a listed built-in event is ignored. Kept for element targets (later)
}
/** What a DRIVER takes (the component prop, the web option): the schema type without `resume`,
 *  so autocomplete cannot offer a key the runtime would only ignore. */
type PxActionTriggersInput = Omit<PxActionTriggers, 'resume'>;

// ─── HOW ─────────────────────────────────────────────────────────────────────────────────────
type PxStartBehavior   = 'continue' | 'restart' | 'jumpToFinished';   // where a start ends and the path there
type PxStopBehavior    = 'reset' | 'rewind';                          // jump back, or play back
type PxFinishBehavior  = 'hold' | 'reset' | 'rewind';                 // after the natural end
type PxOutOfViewBehavior = 'pause' | 'continue' | 'reset';              // while none of it is on screen

/** HOW the built-in actions look — one slot per action. `behavior` names a PRESET; a slot that says only `behavior`
 *  is written as the word itself: `stop: 'rewind'` IS `stop: { behavior: 'rewind' }`. */
interface PxActions {
    start?:   PxStartBehavior   | { behavior?: PxStartBehavior };                              // default continue
    stop?:    PxStopBehavior    | { behavior?: PxStopBehavior; completeIteration?: boolean };  // default reset, now
    finish?:  PxFinishBehavior  | { behavior?: PxFinishBehavior };                             // default hold
    outOfView?: PxOutOfViewBehavior | { behavior?: PxOutOfViewBehavior };                            // default pause
}

// ─── the defaults, as one table (what every player applies when a key is absent) ─────────────
const PX_PLAYBACK_DEFAULTS = {
    start: 'load',                 // an absent actionTriggers block plays on load — a document is designed to play
    startBehavior: 'continue',
    stopBehavior: 'reset',
    stopCompleteIteration: false,
    finishBehavior: 'hold',
    outOfViewBehavior: 'pause',    // an animation nobody can see does not run
    showWhenStopped: 'static',
    inViewThreshold: 0.5,
    inViewDebounce: 150,
} as const;

// ─── the lookup tables (not playback) ────────────────────────────────────────────────────────
interface PxDefinitions {
    easings?: Record<string, [number, number, number, number]>;   // "smooth": [0.42, 0, 0.58, 1] → a keyframe says "easing": "smooth"
    animations?: Record<string, PxAnimationDefinition>;            // "fadeIn": { opacity: { keyframes: [...] } } → a node says "animate": "fadeIn"
    fonts?: Record<string, PxGlyphFont>;                           // embedded glyph outlines per face, for text that needs no font file
}
/** One named animation: a map from attribute name to its keyframes (the same shape as a node's `animate`). */
type PxAnimationDefinition = Record<string, PxPropertyAnimation>;
/** One entry of `bindings` — a document without `children` animating a pre-rendered SVG already in the page. */
interface PxBinding {
    target: string;                 // the element — '#id'
    animateWith: Array<string>;     // names into definitions.animations, applied in order
}
```

The scroll-driven members (`type: 'scroll' | 'view'`) are in development and out of scope here; they matter only in
that the union explains why `type` exists and why `actionTriggers` / `actions` / `delay` live on the *time* member
(nothing starts a scrubbed timeline, so those keys have no slot there).

### 2.1 Why the keys are called what they are

| Key | Why this word | Alternatives that were on the table |
|---|---|---|
| `animator` | the block that *animates* the static SVG; the product's own noun. Not `animation`: that word already means a property animation (`animate`, `definitions.animations`) | — |
| `timeline` | the WAAPI word for "what advances progress" — a clock, a scroller, a viewport journey; its `type` mirrors `DocumentTimeline` / `ScrollTimeline` / `ViewTimeline`. Making it an object with a discriminant lets each kind carry only the keys that mean something for it | flat keys on `animator` (`duration`, `trigger`, `scroll` …) — the earlier spelling, still read and converted; a scroll document then carried clock-only keys that silently did nothing |
| `engine` | an implementation preference — *who updates the attributes* — not a behaviour switch | `mode` (sounded like a behaviour) |
| `inTime` / `outTime` | the editing in/out points: a *window* on the content. Keyframe times stay absolute, so a window can move without retiming every keyframe | `duration` (said nothing about where the window starts; replaced in 1.3) |
| `playDuration` | wall time of one pass of that window; the one knob to play the same content faster or slower. A duration rather than a rate factor: "one pass takes 2 s" is what a designer asks for, and the handle already owns the rate (`setPlaybackRate`) | — |
| `iterations` · `iterationDirection` · `delay` | CSS / WAAPI words, kept so web developers guess them. `iterationDirection` rather than `direction`: it says *of each iteration*, and leaves `direction` free for a property loop | `loop` (means something narrower in the file: a repeat of one property's keyframes) |
| `actionTriggers` | **1.11**, was `triggers`. "triggers" did not say *of what*, and nothing linked it to `actions` beside it. The shared stem now says it: a key in `actionTriggers` names the action it fires; the same key in `actions` says how that action looks | `triggers`; `playOn` (reads as a condition for *starting* only, yet the block holds `stop` and `pause`); keying the block by event instead of by action (§2.2) |
| `start` / `stop` / `pause` / `resume` | the built-in actions' names; the container supplies "action", so `start: 'hoverIn'` reads "start on hover in" | `play` for `start` (`play` = start-or-resume by design, see §4); `startAction` keys (repeat the container) |
| `actions` | the file configures *moves* (start, stop, finish, outOfView), not states and not events — §2.2 | `transitions` (CSS word), `playback` (inside `timeline` everything is playback) |
| `behavior` | **1.11**, was `transition`. "transition" means a CSS transition to every web developer, and `reset` / `hold` / `jumpToFinished` are not transitions. `behavior` reads as the imperative: "stop: do rewind", "finish: do hold" | `transition`; `how` (runner-up) |
| the word shorthand | `stop: 'rewind'` ≡ `{ behavior: 'rewind' }` — the house style the trigger lists already have (one event or a list); only `stop` has a second setting, so the common case reads as a sentence. A string is *exactly* `{ behavior }`, so a merging prop keeps the file's `completeIteration` | — |
| `continue` / `restart` / `jumpToFinished` | a start *continues* from where it rests (from the beginning when at either end), *restarts* from zero, or *jumps to finished* — named after the state it lands in | `jumpToEnd` (doubt, §8) |
| `reset` / `rewind` | `reset` means ONE thing wherever it appears (stop, finish, outOfView): the state as before it started, now. `rewind` is the VCR word for *playing back* there — never confused with `iterationDirection: reverse` | `reverse` (taken by direction), `cancel` (WAAPI's word, told nothing about where it ends) |
| `hold` | the natural end keeps the last frame. The CSS `animation-fill-mode` (`forwards` / `both` / …) stays internal — the players derive it from `showWhenStopped` + `finish.behavior`, so the file speaks of what the viewer sees | — |
| `completeIteration` | *when* the stop takes effect — after the current iteration; orthogonal to `behavior`, so `rewind` after completion finishes the motion and then undoes it smoothly | — |
| `finish` | the run reaching its end by itself — an action the *player* performs, so it has a slot in `actions` but none in `actionTriggers` | `end` / `ended` (an event name — the state-machine layer reserves `ended` for it) |
| `outOfView` / `wake` | the browser's and OS's words for going inactive and back. The gate holds the *clock*, not the playback state, so `wake` carries on only what was running | `sleep`; `freeze` (its Page Lifecycle partner is `resume` — taken); `hidden` / `visible` (states, not moves); `outOfView` (doubt, §8) |
| `showWhenStopped` | the rest pose before the first start *and after every reset* — a rendering setting of the timeline (CSS analogue `fill-mode: backwards`), not a state | a value on the `stopped` state (it applies to every rest, whatever caused it) |
| `inViewThreshold` / `inViewDebounce` | the two sensor numbers: how much, for how long. Plain timeline keys, not settings of `outOfView`: they parametrise the *sensor* (a condition on every driver), while `outOfView` says what to do when it closes | — |
| `version` | the schema stamp "a.b.c": format generation · player schema revision · editor extension. Never a gate: the player checks the document against its schema, not the stamp | — |
| `definitions` / `…With` | a bare key holds the thing (`animate` holds keyframes); `<key>With` holds *names* of the same concept (`animateWith` → `definitions.animations`); `source` / `target` point at *elements* (`#id`), `…With` at *definitions* | — |

### 2.2 Why the structure is what it is — keyed by MOVES

The two blocks are keyed by **action** (start, stop, pause, …), not by event and not by state. Both alternatives
were sketched and fail on the same document:

- *By event* — `"hoverIn": { "playback": "playing" }` — cannot say that one click must mean "start" when stopped
  and "pause" when playing. A toggle is inexpressible.
- *By state reached* — `"playing": { "transition": "restart" }` — `start` (from stopped) and `resume` (from paused)
  both reach *playing* but are configured differently (`restart` applies to a start, never to a resume); and some
  settings *choose* the state reached (`jumpToFinished` lands in finished, `finish: reset` in stopped), so they
  cannot sit under one state.

Keying by move gives the state rule for free: the player's state picks which list an event is read from, and every
action checks the state *as it was when the event arrived*. It also scales: a later layer adds custom actions
(`"firstLook"`) and element targets (`{ "on": "click", "target": "#playBtn" }`) with the same keys.

### 2.3 Why the default is "plays on load, pauses out of view"

A document is *designed to play*: a file with no `actionTriggers` block starts on load. `load` is "the document is
ready", **not** "when the page loads": with the default gate it still waits until half of it has been on screen for
150 ms, and `actions.outOfView: pause` pauses it while scrolled away. So "play when it scrolls into view" needs no
setting at all — it *is* the default. An **empty** block, `"actionTriggers": {}`, lists no event: nothing starts it
until code calls `play()`.

This is a **FILE** default, not a component default. The contract across every surface: nothing plays until a prop
or option names the driver (`playUsingActionTriggers`, `play`, `showAt…`). A file embedded with no code around it —
the `<div data-px-animation-src>` tag, the CSS wrapper, a standalone SVG file — has no other possible driver, so there
the embedding is that naming and the file plays as saved.

### 2.4 The derived `resume` — and the named one

A paused animation resumes on (1) the **counterpart** of each `pause` event — `hoverIn` ↔ `hoverOut`,
`click` → `click`, `load` has none — plus (2) the `start` events that do not also stop it. So `{ start: 'load',
pause: 'hoverIn' }` is a marquee that holds while hovered and carries on when the pointer leaves, with nothing
written for the resume. Since 1.15 a `resume` list the FILE names is **honoured as written** (it used to be
ignored — both outside reviewers objected to a key that type-checks and does nothing); the player warns (code 1111)
where it differs from the derivation — an extra event, or a pause left without its resume. The prop type
(`PxActionTriggersInput`) still omits it: a driver's block says what the page does, the resume follows from it.

### 2.5 Versioning

`animator.version` is `"a.b.c"`: `a` format generation (nothing converts across it), `b` player schema revision
(a player at `a.b` reads any `b` up to its own, converting one step at a time on read), `c` editor extension (meta
only; the player ignores it). Two things about it a reviewer should know: it is **not a gate** (a gap alone never
refuses or warns) and **absent means unknown** (nothing is converted on a guess). 1.10 → 1.11 renamed
`timeline.triggers` → `actionTriggers` and `actions.*.transition` → `behavior`, added the word shorthand; both players
convert old files on read.

---

## 3. The `animator` block — examples, with commentary

Each example is a complete `animator` block. The comment above says what it does read cold; the notes say why it
is spelled that way.

### 3.1 The editor's new document

```json
"animator": { "version": "1.15.1",
  "timeline": { "outTime": 1000, "actionTriggers": { "start": "load" }, "actions": { "outOfView": "pause" } } }
```

- Both `start: load` and `outOfView: pause` **are the defaults**; the editor writes them anyway, so a designer opening
  the file sees what the panel showed. Everything else is left out.
- `outTime` is always written (its default is *derived* — the last keyframe — so stating it protects the window
  against a later keyframe edit).

### 3.2 A hover icon — the trash-can lid

```json
// hover in opens it; hover out lets it finish opening, then plays it back closed; scrolled away it goes back to the start
"timeline": { "outTime": 400,
  "actionTriggers": { "start": "hoverIn", "stop": "hoverOut" },
  "actions": { "stop": { "behavior": "rewind", "completeIteration": true }, "outOfView": "reset" } }
```

- Read aloud: *action triggers — start on hover in, stop on hover out; actions — stop does rewind after the
  iteration, outOfView does reset.* The link between the blocks is the repeated key `stop`.
- `stop` needs two settings, so it is the object form; `outOfView` needs one, so it is the word. Both are the
  *shortest exact spelling*, which is what the editor writes.
- This document needs the `finished` state: after hover-in it rests at its end, and a `hoverOut` must act on
  a finished one-shot. Before 1.11 finished = stopped and this file was inexpressible.

### 3.3 The marquee and the derived resume

```json
// runs on load, holds while the pointer is over it, carries on when it leaves
"timeline": { "iterations": "infinite", "actionTriggers": { "start": "load", "pause": "hoverIn" } }
```

Nothing says `resume`: `hoverOut` is the counterpart of the `pause` event, so it resumes. Writing
`"resume": "hoverOut"` would be redundant (and the prop type refuses it).

### 3.4 The click toggle, two ways

```json
"actionTriggers": { "start": "click", "pause": "click" }   // stopped → playing → paused → playing …
"actionTriggers": { "start": "click", "stop": "click" }    // stopped → playing → stopped (also from paused)
```

- Both work because the **state picks the list**: a click while stopped is read from `start`, while playing from
  `pause` (first line) or `stop` (second), while paused from the derived resume (first) or `stop` (second).
- There is no `togglePlay` shortcut any more (1.12): it only ever meant the second line, and media people read it as
  the first. The two lists say which toggle is meant.

### 3.5 A like button — forward on click, back on the next

```json
"timeline": { "outTime": 600, "actionTriggers": { "start": "click", "stop": "click" }, "actions": { "stop": "rewind" } }
```

The first click plays to the end (finished); the second is read from `stop` — which acts on finished — and rewinds.

### 3.6 Lists, and events a list may not name

```json
"actionTriggers": { "start": ["hoverIn", "click"], "stop": "hoverOut", "pause": "click" }
```

- A list is one event or an array — the house style of every reference in the format.
- Each list names only the events that make sense for it (§2, the comments on `PxActionTriggers`). `"stop": "load"`
  fails the schema; the document repair drops *that event* (never the whole list) and warns.
- Two lists reacting to the same event *in the same state* is a **collision**: `{ stop: 'click', pause: 'click' }`
  — while playing, `pause` wins and the player warns. The one above has none: `click` starts when stopped and
  pauses when playing.

### 3.7 A document meant to be started by code

```json
"timeline": { "actionTriggers": {} }
```

An empty block lists nothing, so no event starts it; the host calls `play()`. This is a spelling of the FILE: on the
component, "your code drives" is simply no control prop at all (§5 ⑤).

### 3.8 A splash that replays on every click and snaps back

```json
"timeline": { "actionTriggers": { "start": "click" }, "actions": { "start": "restart", "finish": "reset" } }
```

`start: restart` because `continue` on a click mid-run would just keep going; `finish: reset` so the stamp
disappears when done and the next click plays it again from a clean state.

### 3.9 Overlay art — appears instantly, retreats animated

```json
"actions": { "start": "jumpToFinished", "stop": "rewind" }
```

A start lands in *finished* with no motion (the overlay is simply there); a stop plays back to nothing.

### 3.10 Timing, and a hand-authored rest pose

```json
"timeline": { "inTime": 500, "outTime": 2500, "playDuration": 1000, "delay": -200,
  "iterations": 3, "iterationDirection": "alternate", "showWhenStopped": "firstFrame", "engine": "js", "frameRate": 30 }
```

- The window is content 0.5 s → 2.5 s, squeezed into 1 s of wall time; the run starts 0.2 s *in* (negative delay).
- `showWhenStopped: firstFrame` is for hand-written files whose static attributes differ from their first keyframe. The
  editor never writes it: in its files the static SVG *is* the first frame.

### 3.11 Definitions and a bind-by-id document

```json
"animator": {
  "definitions": {
    "easings": { "smooth": [0.42, 0, 0.58, 1] },
    "animations": { "fadeIn": { "opacity": { "keyframes": [ { "time": 0, "value": 0 }, { "time": 2000, "value": 1, "easing": "smooth" } ] } } }
  },
  "bindings": [ { "target": "#hero", "animateWith": ["fadeIn"] } ],
  "timeline": { "outTime": 2000 }
}
```

A document with no `children`: it animates an SVG already in the page by `#id`. `animateWith` (not `animations`
or `use`) follows the convention "a bare key holds the thing, `…With` holds names of it".

---

## 4. `<SvgAnimationPlayer>` — TypeScript types

```tsx
import { SvgAnimationPlayer, type PxAnimationPlayerHandle } from '@pixodesk/svg-animator-react';

/** The component's props: the shared control props, the shared playback override and the shared callbacks
 *  (one definition in core for React, Vue and React Native, so the three cannot drift), plus what is React-specific. */
type SvgAnimationPlayerProps = PxControlProps & PxPlaybackOverride & PxAnimationPlayerCallbacks & {
    doc: PxDocumentInput;           // the animation document — a `.json` import passes as-is. No URL form by design: the app owns loading
    className?: string;             // added to the root <svg>
    style?: CSSProperties;          // set on the root <svg>
    playerRef?: React.RefObject<PxAnimationPlayerHandle | null>;   // the imperative handle — filled in EVERY mode, never picks one
};

// ─── CONTROL: which props DRIVE playback. The highest-priority group that is set wins, and the component warns
//     if props of two groups are given: showAt… → play/pause → playUsingActionTriggers → (none: static first frame)
interface PxControlProps {
    /** Play using action triggers — WHEN each built-in action fires. `true`: the document's own `actionTriggers`
     *  block (as the editor saved it). An OBJECT: that block instead, as a WHOLE — a replacement, not a merge:
     *  the lists belong together (switching hoverIn → click wants other pause / stop lists too); lists left out are
     *  simply not listed, never the file's. */
    playUsingActionTriggers?: boolean | PxActionTriggersInput;   // { start, stop, pause } — no `resume`

    /** The STATE: `true` performs the built-in `start` (or `resume` when paused), a mount included — a one-shot
     *  plays to its end and rests there; `false` performs `stop`. Each per `actions`, always from the current frame. */
    play?: boolean;
    /** Freeze the current frame NOW / resume. Only meaningful while `play` is true — `play: false` forcibly unfreezes. */
    pause?: boolean;

    /** SHOW one frame — nothing plays: the frame at this position in the whole run (duration × iterations), `0` the
     *  first, `1` the last — of ONE iteration when iterations is 'infinite'. The read twin is `getCurrentProgress()`. */
    showAtProgress?: number;
    /** SHOW the frame at this time, ms from the start of the whole run. The read twin is `getCurrentTime()`. */
    showAtTime?: number;
}

// ─── OVERRIDE: the file's settings, adjusted per instance. The document passed in is never mutated.
interface PxPlaybackOverride {
    /** A MERGE over the file's `timeline` block MINUS `actionTriggers` and `actions` — an object shaped like the file,
     *  deep-merged key by key (JSON Merge Patch): objects merge, values replace, `null` at a key DELETES it, restoring
     *  the default its absence means (`outTime: null` = the content's end, `playDuration: null` = natural speed). */
    timelineOptions?: PxTimelinePatch;     // { engine, frameRate, inTime, outTime, playDuration, delay, iterations, iterationDirection,
                                    //   showWhenStopped, inViewThreshold, inViewDebounce } — `actionTriggers` here is a TYPE ERROR
    /** A MERGE over the file's `timeline.actions`, slot by slot — `{ stop: 'rewind' }` changes how a stop looks and
     *  leaves `stop.completeIteration` and the other actions as the file has them; `null` at a slot deletes it. */
    actions?: PxActionsPatch;
}
type PxPatch<T> = T extends ReadonlyArray<unknown> ? T : T extends object ? { [K in keyof T]?: PxPatch<T[K]> | null } : T;
type PxTimelineTiming = Omit<PxTimeline, 'actionTriggers' | 'actions'>;   // distributive over the union
type PxTimelinePatch  = PxPatch<PxTimelineTiming> | null;
type PxActionsPatch   = PxPatch<PxActions> | null;

// ─── CALLBACKS: no arguments; the same names on every surface (`createSvgAnimationPlayer({ onFinish })` too)
interface PxAnimationPlayerCallbacks {
    onReady?: () => void;     // the player exists and the SVG is rendered — once, always async; the push twin of isReady()
    onPlay?: () => void;      // started, or resumed after a pause
    onPause?: () => void;     // paused — the `pause` prop, pause(), a `pause` trigger, or the visibility gate
    onStop?: () => void;      // the built-in STOP action was performed — a `stop` trigger, play={false}, stop();
                              //   now, or after the iteration it waited for. A pause is onPause, the end onFinish, never this one
    onFinish?: () => void;    // reached the end by itself — every iteration played (or jumpToFinished()); not when stopped early
    onReset?: () => void;     // back at the start pose — reset(), a stop or finish whose preset is reset, the end of a rewind,
                              //   the gate's outOfView: reset (was onCancel: the callback now speaks the preset's word)
    onDestroy?: () => void;   // torn down — unmount, a new `doc`, destroy()
    // diagnostics — the shared channel: onWarn = it plays but something was ignored / degraded / misspelled;
    // onError = this instance will not play (playerRef stays empty)
    onWarn?: (d: PxDiagnostic) => void;
    onError?: (d: PxDiagnostic) => void;
    suppressWarnings?: boolean;
    suppressErrors?: boolean;
}
interface PxDiagnostic { code: number; kind: 'document' | 'host' | 'platform' | 'usage' | 'internal'; data?: ReadonlyArray<unknown>; message: string; error?: Error; }

// ─── THE HANDLE `playerRef` is filled with: the player API minus what the component owns (isReady, getRootElement, destroy)
interface PxAnimationPlayerHandle {
    isPlaying(): boolean;
    play(): void;                   // the state rule: start (per actions.start) when stopped or finished, resume when paused
    pause(): void;                  // freeze where it is
    stop(): void;                   // the CONFIGURED stop — actions.stop: reset or rewind, after the iteration when completeIteration
    reset(): void;                  // back to the start state NOW, whatever the settings say (was cancel() before 1.11)
    jumpToFinished(): void;         // the end pose, no motion — the preset as a call; rests in `finished` (was finish())
    playOnce(): void;               // ONE fresh pass from the start, whatever `iterations` says; re-entrant. The doorbell verb
    setPlaybackRate(rate: number): void;   // 1 normal, 2 double, -1 backwards; 0 is rejected with a warning — use pause()
    getDuration(): number | null;          // ONE pass of the content window, ms (× iterations for the whole run); null before ready
    getCurrentTime(): number | null;       // ms from the start of the WHOLE run (iterations included) — a slider never jumps back
    setCurrentTime(ms: number): void;      // clamped to [0, duration × iterations]
    getCurrentProgress(): number | null;   // 0..1 of the whole run (one iteration when infinite)
    setCurrentProgress(p: number): void;
}
```

### 4.1 Why the props are called what they are

| Prop | Why this word | Alternatives that were on the table |
|---|---|---|
| `doc` | the document, passed as a value. No `src` URL prop: in a component tree the app already owns loading (import or fetch), and a URL form would make the component a loader with its own error channel | `src` (a URL form); a `data` alias (shipped once, removed) |
| `playUsingActionTriggers` | **1.11**, was `playOnTrigger` (and `autoplay` before that). *A driver is named by its verb*: `play…` when it plays. "play, using the action triggers" names the driver *and* the block it takes — the same block the file has, so a developer who read the file knows the prop. `true` = the file's block; an object = this block as a whole | `autoplay` (lied for a click-triggered file: nothing played automatically); `triggers` (a block you could pass *without* choosing the trigger driver — it then silently did nothing); flat `playOn="hoverIn"` props (one prop per list hides that the lists belong together); `playOnTrigger` ("play on …" reads as a condition for *starting*, yet the object holds `stop` and `pause`) |
| `boolean \| object` on one prop | an established config idiom (`pagination={false \| {…}}`, Vite `hmr: boolean \| {…}`); typed `boolean`, not `true`, so `playUsingActionTriggers={flag}` works; the object *replaces* the file's block because its lists belong together (hover → click wants other lists too) | a separate `actionTriggers` prop beside the switch (two props that only work together) |
| `play` / `pause` | **a state, like a CSS class**, not a command: `play={hovered}` reads as "it plays while hovered". `true` calls the built-in `start`, `false` the built-in `stop`, so the file's `actions` hold here too. Since 1.11 `play` on a one-shot at mount *plays* (everyone writes `<Player play />` meaning "play it"); the motionless end pose moved to `showAtProgress={1}` | a three-valued `playback="playing \| paused \| stopped"` (deferred — §8) |
| `showAtProgress` / `showAtTime` | **1.11**, were `playCurrentProgress` / `playCurrentTime` (and `progress` / `time` before). They *show one frame* and play nothing, so a `play` prefix read as an action; "show at" says a frame at a position. The rule became: `play…` when it plays, `show…` when it only shows. They rhyme with the handle's `getCurrentProgress` / `setCurrentTime` | `progress` / `time` (a bare `time` was misread as a duration); `playCurrentProgress` / `playCurrentTime` (the 1.10 names) |
| `playerRef` | the React `…Ref` convention under the `play*` stem; the guide's variable was already `playerRef`. Deliberately **not a mode**: it is filled in every mode, so `<Player playUsingActionTriggers playerRef={r} />` autostarts *and* hands you the handle (an earlier `apiRef` silently switched the triggers off) | `apiRef` |
| `timeline` | the file's own key: what you pass is shaped like the file's `timeline` block, deep-merged over it. Corrections — `iterations`, `delay`, `playDuration` — never a replacement; whoever needs more edits the document | `timing` (doubt — §8); a replace/merge *pair* (`timeline` + `mergeTimeline`, shipped briefly and removed: two props for one idea) |
| `actions` | the file's own key, merged slot by slot; the word shorthand works here too and — because a string is *exactly* `{ behavior }` — keeps the file's `completeIteration` | folding it into `timeline` (then `timeline.actions.stop` and the triggers would be reachable two ways) |
| `actionTriggers` and `actions` **not** keys of `timeline` | every setting reachable exactly one way: only `playUsingActionTriggers` carries triggers, only `actions` the action settings; `timelineOptions={{ actionTriggers }}` is a type error | — |
| `null` deletes | the only way to restore a *meaningful absence* (`outTime` absent = the content's end); `null` is not a legal value anywhere in the schema, so it is unambiguous — and "not given" (`undefined`) stays distinct from "delete" | — |
| `onReady` `onPlay` `onPause` `onFinish` `onDestroy` | media-element words; `onFinish` pairs with the `finish` action and the `finished` state | `onEnded` (the `<video>` word — §8) |
| `onReset` | **1.11**, was `onCancel`. The handle's `cancel()` became `reset()`, and `reset` is the vocabulary's one word for the start pose, so the callback follows. It is the *state* callback — back at the start pose, by a `reset()`, a reset or rewind stop or finish, the gate's reset — the twin of `onFinish`; `onStop` is the *action* callback | `onCancel` (WAAPI's word, paired with a `cancel()` that no longer exists) |
| `onStop` | **1.11**: fires only when the built-in **stop** action was performed. Before, it fired after *any* halt — pause, finish, destroy — so a handler written for a stop ran on every pause. The others cover the rest; a catch-all can come back as `onIdle` if anyone needs it | keep as catch-all; `onPlaybackEnd` |
| `reset()` / `jumpToFinished()` on the handle | **1.11**, were `cancel()` / `finish()`. The handle speaks the actions' words: `reset` is already a preset (`do: 'reset'`) and means "back to the start, now"; `finish()` could be read as "let it play to the end", while it jumps there — exactly the `jumpToFinished` preset | `cancel` (WAAPI's word; told nothing about where it ends), `finish` |
| `stop()` vs `reset()` | `stop()` is the *configured* stop (maybe a rewind, maybe after the iteration) — what a stop trigger does; `reset()` is unconditional and immediate | — |
| `playOnce()` | one fresh pass from the start whatever `iterations` says — the doorbell / notification ping; there is no "off" state to express with `play` | — |
| `suppressWarnings` / `suppressErrors` | silence the console once a document's known complaints are tolerated; the typed `onWarn` / `onError` still fire | — |

### 4.2 Why four control modes, and why precedence instead of an error

A component must do *something* sensible for any combination of props. The rule (one function in core, shared by
React, Vue and React Native): the most specific instruction wins — an explicit position (`showAt…`) over an
explicit state (`play` / `pause`) over the file's triggers (`playUsingActionTriggers`) over nothing (a static first
frame) — and the component warns naming both props and the winner. In every mode but `playUsingActionTriggers` the
file's own triggers are switched off (an empty `actionTriggers` block is applied), so a `play`-driven icon never
also reacts to the file's hover. The three components once each had their own order (the same props played on
React and seeked on React Native), which is why it is now one rule.

---

## 5. `<SvgAnimationPlayer>` — examples, with commentary

```tsx
// ① As the file says. The most common line: the triggers, the gate and the actions the designer set in the editor.
<SvgAnimationPlayer doc={ball} playUsingActionTriggers />
//   Note: `doc` alone — no control prop — renders the FIRST FRAME and waits; that is deliberate (nothing surprises a list
//   of 200 icons), but it is the one place a newcomer expects motion and gets none.

// ② Your triggers instead of the file's, and a smooth retreat. The object IS an `actionTriggers` block —
//   the same keys the file has, so reading one teaches the other.
<SvgAnimationPlayer doc={lid}
    playUsingActionTriggers={{ start: 'hoverIn', stop: 'hoverOut' }}
    actions={{ stop: 'rewind' }} />

// ③ Pause instead of stop: leaving freezes it, pointing again carries on — nothing written for the resume.
<SvgAnimationPlayer doc={wheel} playUsingActionTriggers={{ start: 'hoverIn', pause: 'hoverOut' }} />

// ④ The clearest key in the format.
<SvgAnimationPlayer doc={heart} playUsingActionTriggers={{ start: 'click', stop: 'click' }} actions={{ stop: 'rewind' }} />

// ⑤ Your code drives: NO control prop. The file's triggers are switched off, the first frame shows, `playerRef` is the driver.
//   (There is no third spelling: `playUsingActionTriggers` is either `true` — the file's block — or an override object.)
const ref = useRef<PxAnimationPlayerHandle>(null);
<SvgAnimationPlayer doc={bell} playerRef={ref} />
<button onClick={() => ref.current?.playOnce()}>Ring</button>

// ⑥ Your state. `play` is a state like a CSS class; the file's actions (and this prop) say how each move looks.
//   A one-shot PLAYS on mount when `play` is true (1.11) — the pose without motion is ⑦.
<SvgAnimationPlayer doc={lid} play={hovered} actions={{ stop: 'rewind' }} />
<SvgAnimationPlayer doc={spinner} play={busy} actions={{ stop: { completeIteration: true } }} />   // finishes the turn, then rests
<SvgAnimationPlayer doc={beat} play={running} pause={frozen} />                                   // two booleans, three states — §8

// ⑦ One frame, no playback. `show…` because nothing plays; ms is in the TSDoc, not in the name — §8.
<SvgAnimationPlayer doc={tick} showAtProgress={1} />      // the end pose a re-rendered list of icons mounts with
<SvgAnimationPlayer doc={ball} showAtTime={500} />        // half-way through a 1 s bounce
<SvgAnimationPlayer doc={ball} showAtProgress={t} />      // a scrubber: changing the prop seeks; the player is not recreated

// ⑧ Timing corrections — a merge over the file's timeline; `null` deletes a key and restores its default.
<SvgAnimationPlayer doc={ball} playUsingActionTriggers timelineOptions={{ iterations: 'infinite' }} />
<SvgAnimationPlayer doc={ball} playUsingActionTriggers timelineOptions={{ outTime: 2000, playDuration: 1000 }} />
<SvgAnimationPlayer doc={ball} playUsingActionTriggers timelineOptions={{ delay: null }} />
//   `timelineOptions={{ actionTriggers: … }}` does not compile: triggers travel only with their driver.

// ⑨ Actions: the word when it is the only setting, the object when it is not. A string is exactly `{ behavior }`,
//   so `stop: 'rewind'` keeps the file's `completeIteration`.
<SvgAnimationPlayer doc={lid} play={open} actions={{ start: 'jumpToFinished', stop: 'rewind' }} />            // overlay art
<SvgAnimationPlayer doc={lid} play={open} actions={{ stop: { behavior: 'rewind', completeIteration: true } }} />  // finish the motion, then undo it
<SvgAnimationPlayer doc={ball} playUsingActionTriggers actions={{ outOfView: 'continue' }} />                  // keep playing off screen

// ⑩ The handle — the actions' words.
ref.current?.play();            // start per actions.start, or resume
ref.current?.stop();            // the configured stop (maybe a rewind, maybe after the iteration)
ref.current?.reset();           // back to the start NOW, whatever the settings (was cancel())
ref.current?.jumpToFinished();  // the end pose, no motion (was finish())
ref.current?.setPlaybackRate(-1);

// ⑪ Callbacks — `onStop` now means a stop.
<SvgAnimationPlayer doc={lid} playUsingActionTriggers={{ start: 'click', pause: 'click' }}
    onPlay={…} onPause={…} onStop={…} onFinish={…} onReset={…} />
//   onStop = the stop action was ordered; onReset = it is back at the start pose (with the default preset, both at once).

// ⑫ Diagnostics — route, don't just log. `kind` says who can act: document (fix the file), host (fix the page),
//   platform (the browser could not), usage (fix the props), internal (tell us).
<SvgAnimationPlayer doc={ball} playUsingActionTriggers
    onWarn={d => d.kind === 'document' && report(d.code, d.data)} suppressWarnings />
```

What the same object looks like on the other surfaces, so the reviewer sees the vocabulary is shared:

```ts
// web player
createSvgAnimationPlayer({ doc, container: '#box', playUsingActionTriggers: { start: 'hoverIn', stop: 'hoverOut' }, actions: { stop: 'rewind' } });
// pre-rendered SVG + CSS, with the few lines of script the editor embeds
bind({ "playUsingActionTriggers": true, "doc": … });
// the CSS-only components have no driver switch and take the block directly
<SvgCssAnimationPlayer actionTriggers={{ start: 'hoverIn', stop: 'hoverOut' }} actions={{ outOfView: 'continue' }}>{/* the exported SVG */}</SvgCssAnimationPlayer>
```

---

## 6. The one rule that ties file and props together

| in the file | on the component | relationship |
|---|---|---|
| `timeline.actionTriggers` | `playUsingActionTriggers={…}` | the prop's object **is** the block, as a whole (replace) |
| `timeline.actions` | `actions={…}` | **merge**, slot by slot; the word shorthand is identical |
| `timeline` (the rest) | `timelineOptions={…}` | **merge**, key by key; `null` deletes |
| the built-in actions | `play` / `pause` · `play()` `stop()` `pause()` | call them; the file's `actions` apply |
| `start` / `stop` / `finish` / `outOfView` presets | `reset()` · `jumpToFinished()` · `onReset` | the handle and the callbacks speak the presets' words |
| `finished` state | `onFinish` · `stop` acting on a finished one-shot | one trio: action `finish`, state `finished`, callback `onFinish` |

A developer who learns the file can predict the props and vice versa. That is the property we most want you to
test: pick any key in §2 and check whether its prop in §4 is where you would look for it and does what you would
expect.

---

## 7. What we believe reads well (keep unless you object)

`doc` · `className` / `style` · the events `hoverIn` / `hoverOut` / `click` · event lists
`['hoverIn', 'click']` · `iterations` with `'infinite'` · `delay` · `iterationDirection` · `engine` · `frameRate` ·
the preset words `rewind` / `reset` / `hold` / `restart` · `actions={{ stop: 'rewind' }}` · `playerRef` with `play()`
/ `pause()` / `playOnce()` / `setPlaybackRate()` · `onPlay` / `onPause` / `onFinish` / `onReady` · `suppressWarnings` /
`suppressErrors` · `showAtProgress` / `showAtTime` · `playUsingActionTriggers` (long, but it says the driver and the block).

---

## 8. Where we had doubts — and how the two reviews settled them (2026-11-02)

Judged in a playground where every example was read cold: round one (schema 1.10, the old names) had **3 names that
did something other than they said** and 11 that needed a read of the docs; after 1.11 it had **0 and 5**. The five
as they were put to the reviewers, with the decision now taken (see §10 for the whole change set):

| # | Today | The doubt | Options |
|---|---|---|---|
| 1 | `play` / `pause` booleans | two booleans for three states; `pause` alone warns; absent ≠ `false` | KEPT — the CSS model (on/off × frozen), `play={hovered}` composes; the TSDoc now warns that `play={false}` STOPS, it does not pause |
| 2 | `showAtTime` | the unit (ms) is not in the name; `showAtProgress` 0..1 is guessable | KEPT — ms everywhere on this API, as WAAPI |
| 3 | `timeline` prop · `inTime` / `outTime` / `playDuration` | the prop name suggests a timeline *object*; the keys are video-editing words | prop RENAMED `timelineOptions` (it is not the file's object: two keys live on other props); the keys kept, each TSDoc now names its time axis |
| 4 | `{ behavior: 'rewind', completeIteration: true }` | `behavior` is abstract and met once | RENAMED `behavior` (1.14): "stop behavior: rewind" says what kind of thing the value is |
| 5 | `jumpToFinished` · `outOfView` · `start: 'load'` | "finished what?"; nobody guesses `outOfView` = scrolled out of view; `load` waits for the gate | `jumpToFinished` KEPT (the `finish` / `finished` / `onFinish` trio, WAAPI's word); `outOfView` RENAMED `outOfView` (1.13); `load` KEPT (the gate is a condition on every driver) |

Also decided: `onFinish` stays (both reviewers agree; `ended` is `<video>`'s word); no `onIdle` until someone asks;
`onCancel` → `onReset`; `suppressWarnings` / `suppressErrors` → `suppressWarnings` / `suppressErrors`; `showWhenStopped` →
`showWhenStopped` (1.15); `getDuration` stays one iteration (WAAPI's, CSS's and lottie-web's meaning) with the axis
in its TSDoc; `doc`, `playerRef`, `target`, `version`, `engine: 'native'`, `iterationDirection` kept (reasons in the
TSDoc, marked "WHY").

Decided and **not** up for re-opening (with the recorded reason): `autoplay`; `triggers` as the switch; flat
`playOn=` props; `start` → `play` in the lists; `startAction`-style keys; a `playback` stem on both props;
`transition`.

---

## 9. Notes for the reviewer

- **Versions.** This brief describes schema **1.15** and the component after the 1.11 – 1.15 renames (§10 lists
  them). The npm packages at 1.0.52 still carry 1.10 and the old names (`playOnTrigger`, `playCurrentProgress`,
  `triggers`, `transition`, `cancel()`, `finish()`, `onCancel`, `suppressWarnings`); the next release ships what is written here.
- **Where the vocabulary comes from.** CSS / WAAPI where a web developer would guess it (`iterations`, `delay`,
  `direction`, `fill` behind `hold`, `timeline`), media elements for the callbacks, VCR words for the moves
  (`rewind`), the visibility sensor's own words for the gate (`outOfView`, `inViewThreshold`). Where we invented a
  word we tried to name the *thing* and not the mechanism (`behavior` not `preset`, `actionTriggers` not `events`).
- **Beyond this brief.** A later schema layer makes the states visible (`stopped · playing · paused · finished`),
  lets a file declare custom actions and variables, and lets a trigger name an element (`{ on: 'click', target:
  '#playBtn' }`). The keys above were chosen so that layer adds to them without renaming any.
- **How to answer.** For each row of §2.1, §4.1 and §8: *agree* / *disagree, because* / *a third word*. A first-read
  reaction ("I expected X to mean Y") is worth more to us than a reasoned defence of our choice.

---

## 10. What changed after the two outside reviews (2026-11-02)

The decisions are recorded in [schema-and-props-review-fix-plan.md](schema-and-props-review-fix-plan.md); the
reasons for every kept or renamed word are in the TSDoc (search "WHY" in `PxAnimatorTypes.ts`, `PxAnimatorConstants.ts`,
`PxAnimatorConfigPatch.ts`, `PxDiagnostics.ts`, `SvgAnimator.tsx`). Old → new:

| Old | New | Where |
|---|---|---|
| `actionTriggers.togglePlay: 'click'` | removed — `start: 'click', stop: 'click'` (the conversion folds it) | wire 1.12 |
| `actions.suspend` | `actions.outOfView` (values unchanged) | wire 1.13 |
| `actions.<slot>.do` | `actions.<slot>.behavior` (the word shorthand unchanged) | wire 1.14 |
| `timeline.beforeStart: 'static' \| 'firstFrame'` | `timeline.showWhenStopped`, same values | wire 1.15 |
| `actionTriggers.resume` — accepted, ignored | honoured when the file names it; code 1111 where it differs from the derivation | player |
| prop / option `timeline` | `timelineOptions` (`actions` keeps its name) | all components, web |
| `muteWarn` / `muteError` | `suppressWarnings` / `suppressErrors` | all components, web, core |
| `onCancel` | `onReset` (2026-11-01) | all components, web |
| `PxStartTransition` · `PxStopTransition` · `PxFinishTransition` · `PxSuspendTransition` · `PxBeforeStart` | `PxStartBehavior` · `PxStopBehavior` · `PxFinishBehavior` · `PxOutOfViewBehavior` · `PxShowWhenStopped` | core types |

Kept, with the reason now written into the TSDoc: `play` / `pause` as two booleans (`play={false}` stops, it does not
pause), `showAtTime` (ms), `jumpToFinished`, `getDuration` (one iteration), `doc`, `playerRef`, `target`, `version`,
`engine: 'native'`, `iterationDirection`, `load`, the `start: 'load'` FILE default and the components' still-by-default
contract (§2.3).
