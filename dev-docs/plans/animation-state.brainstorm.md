# Animation state — the playback model

Status: **implemented** — schema 1.24 (the model, 2026-11-11) and 1.25 (the words, 2026-11-12). This text now uses the
final words: the noun is **playback** ([animation-state.playback-noun.md](./animation-state.playback-noun.md)), the handle
is one object `player.playback.*` and the file names each built-in action `"playback.start"` …
([animation-state.playback-namespace.md](./animation-state.playback-namespace.md)); 1.24 spelt the noun "run" (§8).
The brainstorm of 2026-11-09/10 (the two switches, the tiers,
the naming rounds, the library survey) is folded into this text; what it rejected is in §6, the full survey is in
[animation-state.survey.2026-11-09.md](./animation-state.survey.2026-11-09.md). Refines layer 2 of
[playback-layers.md](./playback-layers.md#layer-2--states-and-rules). Schema 1.23; every "today" fact was read from the
source on 2026-11-10 (the OLD column below is that code, schema 1.23).

## 0. The change in one place

### OLD → NEW

| Where | Old | New |
|---|---|---|
| Props (React / Vue) | `play` · `pause` · `playState` (`idle` · `playing` · `paused`) | `playback="off" \| "on" \| "paused"` — one driver prop, three positions |
| Handle | `play()` (start or resume by state) | `playback.start()` — lever 1 on |
| Handle | `stop()` | `playback.stop()` — lever 1 off (`endRun()` weighed and not taken, §6) |
| Handle | `pause()` | `playback.pause()` — lever 2 on (the noun on all four buttons: one family, `playback.resume` cannot be read as "start again", `onPlaybackPause` is the user's pause) |
| Handle | `playOnce()` | `playback.playOnce()` |
| Handle | `getPlayState()` → `idle` · `playing` · `paused` · `finished` · `destroyed` | `playback.getState()` → `off` · `playing` · `paused` · `finished` · **`returning`** · `destroyed` |
| Registry events | `add` `remove` `play` `pause` `stop` `finish` | `add` `remove` `playbackStart` `playbackStop` `playbackPause` `playbackResume` `finish` |
| Callbacks + registry events | `onPlay` (fires for a start AND a resume) | `onPlaybackStart` + `onPlaybackResume` |
| Callbacks + registry events | `onStop` | `onPlaybackStop` |
| Callbacks + registry events | `onPause` (fires for the user's pause AND the gate's engine hold) | `onPlaybackPause` — the user's pause only; the gate's hold reports nothing (DECIDED 5) |
| File `actionTriggers` | `start` · `stop` · `pause` · `resume` | `playback.start` · `playback.stop` · `playback.pause` · `playback.resume` (`playback.resume` derived as `resume` is today) |
| File `actions` | `start` · `stop` | `playback.start` · `playback.stop` |
| File | `actions.finish` | `atEnd` — a timeline key beside `whenIdle` (a sensor rule, not a button) |
| Handle (1.25) | every method flat on the player | everything a page does on ONE object, `player.playback` (`PxPlaybackControls`); the player keeps `isReady()` · `getRootElement()` · `destroy()`; the speed-adjusted reads are `…AtSpeed` (`getPlaybackDuration()` → `playback.getDurationAtSpeed()`) |
| Wire | 1.23 | 1.24 (the run words, `atEnd`) and 1.25 (`startRun` → `"playback.start"` …), `up` / `down` exact |
| Editor labels | Start on · Stop on · Pause on · Resume on; Start Action · Stop Action | Start playback on · Stop playback on · Pause playback on · Resume playback on; Start playback · Stop playback · At end of pass |
| Internal | `PxPlayState` (`idle`), `PxDeclarativeAction.start/stop/pause/resume`, `PxTriggerAction.play`, `PxTriggerList`, executor `start/stop/pause/resume/play`, gate host `start` | `PxPlaybackState` (`off`) and the public words (`playback.start` / `playback.stop` / `playback.pause` / `playback.resume`) |

### NEW

| What | Why |
|---|---|
| `playback.resume()` on the handle | lever 2's second button; today both edges land on `play()` |
| no `play()` / `pause()` aliases | kept as aliases in 1.24, removed in 1.25 (owner: one spelling per act); `playback.start()` also unfreezes a paused playback (`continue`) |
| `player.playback` — one object | every act has one home and one spelling; the content / at-speed pairs explain themselves (`playback.getDuration()` vs `playback.getDurationAtSpeed()`); `player.segment.*` can follow |
| dotted action names in the file | `"playback.start"` ↔ `player.playback.start()`; names in a registry (the VS Code settings pattern), the dot reserves built-ins against custom actions |
| `playback.isActive()` | the region `playing` · `paused` · `finished` as one boolean |
| `onPlaybackResume` callback + registry event | mirrors the button (MediaRecorder's event set) |
| the term **playback** (§1) | the thing lever 1 switches on — "start / stop / pause / resume playback" are the media player's phrases; the state variable of the layered design is `timeline.state.playback` |

### REMOVE

| What | Why |
|---|---|
| `play()` as THE button, and the `play()` / `pause()` aliases | the model's buttons are the four; the aliases lived in 1.24 only |
| props `play` · `pause` · `playState` | folded into `playback` |
| the "`pause` does nothing without `play`" warning and `playStateToLevels` | `playback` has no invalid position pair |
| `actions.finish` as an action slot | nobody presses it; it is the clock's rule → `atEnd` |

### UNCHANGED

| Where | Stays as it is |
|---|---|
| Handle | the behaviour of `jumpToStart()` · `jumpToEnd()` · `isPlaying()` and every time / speed / progress read and write (under `player.playback` since 1.25); `destroy()` · `isReady()` on the player |
| Callbacks | `onReady` `onFinish` (not `onPlaybackFinish` — WAAPI / `onEnded` expectations) `onDestroy` `onWarning` `onError` |
| Props | `playUsingActionTriggers`, `showAtProgress` / `showAtTime`; one driver family per element (the TypeScript union) |
| File | the `resume` derivation (now `playback.resume`); `actions.outOfView` (`pause` · `continue` · `jumpToStart`) and the gate numbers `inViewThreshold` / `inViewDebounce`; the preset words `continue` `jumpToStart` `animateToStart` `jumpToEnd` `animateToEnd` `hold`; `whenIdle` |
| Rules | the state rule (`triggerActionFor`), the visibility gate, PX1505 on scroll timelines, the registry |

### DECIDED 2026-11-10 (set to the leanings; revisit after the code review)

| # | Question | Decision |
|---|---|---|
| 1 | `play()`: drop or keep | kept with `pause()` as aliases in 1.24; removed in 1.25 (owner, 2026-11-12) |
| 2 | the noun on lever 2 | `playback.pause()` / `playback.resume()`, applied throughout |
| 3 | `actions.outOfView` → a timeline key beside `atEnd` | no — stays in `actions` (UNCHANGED) |
| 4 | the readout during a return leg (`playback.stop: animateToStart`, `atEnd: animateToStart`) | a fifth state **`returning`** (SVGator `rollback`): the lever is off, the picture still moves; `playback.isActive()` is false; `playback.start()` turns it around |
| 5 | the gate's hold | reports nothing (no callback; `playback.getState()` unchanged by a hold); documented; a `frozen` readout / `onFreeze` later |
| 6 | callback word order | noun first for events (`onPlaybackStart`), verb first for methods (`playback.start()`) |
| 7 | `restart()` on the handle | none — `playback.start()` with `actions["playback.start"]: jumpToStart`, or `playback.jumpToStart(); playback.start()` |
| 8 | readout shape | flat `playback.getState()` + `playback.isActive()`; no nesting |
| 9 | type name | `PxPlayState` → `PxPlaybackState`; `PxStartBehavior` / `PxStopBehavior` / `PxFinishBehavior` → `PxStartPlaybackBehavior` / `PxStopPlaybackBehavior` / `PxAtEndBehavior` (names mirror the keys) |
| 10 | registry events | `add` `remove` `playbackStart` `playbackStop` `playbackPause` `playbackResume` `finish` |
| 11 | `isPlaying()` | stays (= `playback.getState() === 'playing'`) |

### PLAN (recommendations, 2026-11-10)

Verdict of the review: a real improvement in correctness and consistency (the handle's missing lever edges, the invalid
prop pair, `play` as a lever word, `finish` among buttons, five spellings of one act, the user's pause vs the gate's
hold), paid for with unfamiliarity (every competitor says `play()` / `pause()`; React developers think `<video>`) and
churn (the third rename of the control props; wire 1.24; docs, cheat sheet, learning projects, ten videos).

1. **Do it now** — the defects are real and the window is cheap today; it closes as users arrive.
2. **Keep `play()` and `pause()` as documented one-line aliases** — done in 1.24; the owner removed them in 1.25 (one
   spelling per act).
3. **Keep `onFinish`** (WAAPI `finish`, `<video>` `onEnded`); never `onPlaybackFinish`.
4. **The last rename of the control surface:** write the inputs destination (§7) so that `playback`'s positions are
   its built-in input, and check that nothing in it would rename the prop again. Then implement.

Order of work (each a commit; the wire step first so everything downstream compiles against the new words):

| # | Step | Where |
|---|---|---|
| 1 | Wire 1.24: `start` → `playback.start`, `stop` → `playback.stop`, `pause` → `playback.pause`, `resume` → `playback.resume` (lists and `actions`), `actions.finish` → `atEnd`; `up` / `down` exact; `schema-release.mjs --apply`; field universe + defaults guards | core `version/`, `format/` |
| 2 | Core words: `PxPlayState` → `PxPlaybackState` (`idle` → `off`), `PxTriggerList`, `PxDeclarativeAction`, `PxTriggerAction`, executor `playback.start / playback.stop / playback.pause / playback.resume`, declarative resolver for `playback` (+ remove `playStateToLevels` and the "pause without play" warning), `PxControlProps` union | core `format/PxAnimatorConstants.ts`, `playback/PxDeclarativePlayback.ts` |
| 3 | Handle: `playback.start()` `playback.stop()` `playback.pause()` `playback.resume()` `playback.playOnce()` `playback.getState()` `playback.isActive()`; callbacks `onPlaybackStart` `onPlaybackStop` `onPlaybackPause` `onPlaybackResume`; the gate's hold reports nothing; the `returning` state | core types, web `animator/`, `engines/`, `triggers/`, `registry/` (events), RN |
| 4 | Components: `playback` prop replaces `play` / `pause` / `playState` in React, Vue, RN, the CSS components' derived props + guard; callbacks | react, vue, react-native |
| 5 | Tests + docs: package tests, `docs/library/*`, `docs/format/`, diagnostics, READMEs, examples, `pnpm build` (docs-check) | player repo |
| 6 | Editor: trigger lists and labels, action fields, `atEnd`, fixtures restamped 1.24.1, field-universe snapshot, settled cases, SVG + CSS JS-trigger script words, `VscPreviewApp` logs; tsc + targeted specs; e2e | kf `app/` |
| 7 | Website manual pages (140, 175), synced player docs, real-ui cards, learning projects, cheat sheet + changes HTML; videos re-recorded by the owner | website, kf `pixodesk-learning-projects`, `tests/video` |

## 1. Terms and concepts

| Term | What it is | Today's code |
|---|---|---|
| **Player box** | one instance of `createSvgAnimationPlayer()`: the animation, its clock, its state machine and its **imperative function controls** (buttons) | `PxAnimationPlayerApi` |
| **Button** | a momentary control on the box, pressed by code or by a rule: an act, named by a verb (+ the noun it acts on) — `playback.start()` `playback.stop()` `playback.pause()` `playback.resume()`; momentary `playback.jumpToStart()` `playback.jumpToEnd()` `playback.playOnce()` | `player.playback`, `PxPlayExecutor` |
| **Component wrapper** | the React / Vue box around the player box: declarative, so it has **state controls** (levers), not buttons; a prop change is an edge that presses a button | `SvgAnimationPlayer`, `resolveDeclarativePlayback` |
| **Lever** | a held position (a prop), named by its noun and its positions; each lever has exactly two buttons — its edges | props |
| **Driver** | what makes the animation play: the lever (`playback`), the file's wiring (`playUsingActionTriggers`) or nothing (`showAtProgress` / `showAtTime` shows one frame). One driver family per element; the family mark is the verb (`play…` / `show…`) | `PxControlProps` union, `resolveControlMode` |
| **Playback** | one instance (session) of the animation being in effect — what lever 1 switches on. It begins with `playback.start` (from the rest pose, or with `continue` from wherever the playhead rests) and lasts until it is retired by `playback.stop` or by `atEnd: jumpToStart` / `animateToStart`. While it exists its state is **`playing` · `paused` · `finished`**. A playback contains the iterations: a loop's playback is endless, `playback.playOnce()` makes a one-pass playback, `getTotalDuration()` is one playback's length | `PxPlayExecutor` world, `getTotalDuration()` |
| **Off** | no playback; the rest pose shows (`whenIdle: static` / `firstFrame`) | `PxPlayState.idle` |
| **Freeze** (lever 2) | the clock stopped inside a playback, pose kept, resumable — `playback.pause` / `playback.resume`; state `paused` | executor `paused` flag |
| **Finished** | a playback that reached its end and holds there (`atEnd: hold`); still the playback — `playback.stop` acts on it, `playback.start` makes a fresh playback | `PxPlayState.finished`, `heldAtEnd` |
| **The end** (of the pass) | always a compound word — `jumpToEnd` · `animateToEnd` · `atEnd` — never a bare verb; the end of the CURRENT pass; reached by any route (natural end, `playback.stop: …ToEnd`, `playback.start: jumpToEnd`, `playback.jumpToEnd()`), it runs the `atEnd` rule | `onNaturalFinish`, `finishAt()` |
| **Move** (setting) | HOW a button moves the playhead — the preset words, each naming where + how: `continue` · `jumpToStart` · `animateToStart` · `jumpToEnd` · `animateToEnd` · `hold` | `actions.*` schemas, `PxStartBehavior` … |
| **Wiring** | the file's rule for which page event presses which button: `actionTriggers.<button>: events` (`playback.start` · `playback.stop` · `playback.pause` · `playback.resume`); the current state picks the list (the state rule) | `timeline.actionTriggers`, `triggerActionFor` |
| **Sensor** | what the box notices by itself and answers by rule: the visibility gate (`inView` / `outOfView`), the clock reaching the end (`atEnd`), pointer events (fed to the wiring). A sensor's rule is a setting, not a button | `PxVisibilityGate`, `onNaturalFinish` |
| **Hold** (the gate's) | the engine's freeze while off screen — not the user's pause; `release` on re-entry (dotLottie `freeze` / `unfreeze`) | gate host `hold` / `release` |
| **Return leg** | the picture still moving after `playback.stop: animateToStart` (or `atEnd: animateToStart`) — the lever is off, no playback; the state **`returning`**; `playback.start()` turns it around | executor `reversed` |
| **Readout** | what the box reports: `playback.getState()` (`off` · `playing` · `paused` · `finished` · `returning` · `destroyed`), `playback.isActive()` (the playback exists), `isPlaying()`; callbacks `onPlaybackStart` `onPlaybackStop` `onPlaybackPause` `onPlaybackResume` `onFinish`; registry events | `getPlayState()`, callbacks, `PxAnimatorRegistry` |
| **Request vs result** | a lever asks (`playback="on"`), a readout answers (`playing` or `finished`); the words are kept apart on purpose | — |

Four kinds of word, one grammar each:

| Kind | Holds / does | Named by | Example |
|---|---|---|---|
| **lever** | a position, held | the lever's noun + its positions | `playback="paused"` |
| **button** | an act, momentary | a verb + the noun it acts on | `playback.start`, `playback.pause` |
| **setting** | how a button moves the playhead | a preset word — where + how | `animateToStart` |
| **readout** | what it is | a state word | `paused`, `finished` |

A lever has exactly two buttons (its edges); the file names buttons, never levers (a file cannot hold a position; the
page can); sensors press buttons by rule, and their rules (`atEnd`, `actions.outOfView`) are settings, not buttons.

## 2. The machinery as boxes

![The boxes](./animation-state.boxes.svg)

```mermaid
flowchart LR
  subgraph page["Page / app"]
    direction TB
    subgraph comp["Component wrapper · React / Vue"]
      lever["LEVER (held)<br/>playback = off / on / paused<br/>showAtProgress · showAtTime"]
      diff["prop change = edge<br/>playback.start · playback.stop · playback.pause · playback.resume"]
      lever --> diff
    end
    subgraph wiring["Wiring · file actionTriggers"]
      ev["events<br/>load · hoverIn · hoverOut · click"]
      lists["lists (the state picks one)<br/>playback.start · playback.stop · playback.pause · playback.resume"]
      ev --> lists
    end
    subgraph box["Player box · createSvgAnimationPlayer()"]
      buttons["BUTTONS<br/>playback.start() playback.stop() playback.pause() playback.resume()<br/>playback.jumpToStart() playback.jumpToEnd() playback.playOnce()"]
      settings["SETTINGS · file actions · atEnd · outOfView<br/>continue · jumpToStart · animateToStart · jumpToEnd · animateToEnd · hold"]
      sm["STATE — the playback<br/>off → playing ⇄ paused → finished"]
      out["READOUTS<br/>playback.getState() playback.isActive() · onPlaybackStart onPlaybackStop onPlaybackPause onPlaybackResume onFinish"]
      buttons --> settings --> sm --> out
    end
    sensors["SENSORS<br/>gate: outOfView → hold / jumpToStart, inView → release / playback.start<br/>clock: the pass ends → atEnd"]
  end
  diff --> buttons
  lists --> buttons
  sensors --> settings
```

| Box | What it is | Its controls |
|---|---|---|
| **Player box** | one instance of `createSvgAnimationPlayer()` | buttons `playback.start()` `playback.stop()` `playback.pause()` `playback.resume()`; momentary `playback.jumpToStart()` `playback.jumpToEnd()` `playback.playOnce()` |
| **Settings** | how a press moves the playhead | `actions["playback.start"]` · `actions["playback.stop"]`; sensor rules `atEnd` · `actions.outOfView` |
| **Wiring** | which page event presses which button | `actionTriggers["playback.start"]` · `playback.stop` · `playback.pause` · `playback.resume` over `load` · `hoverIn` · `hoverOut` · `click`; the current state picks the list |
| **Component wrapper** | React / Vue around the box — one driver prop | `playback` (the lever) · `playUsingActionTriggers` (the wiring) · `showAtProgress` / `showAtTime` (one frame) |
| **Sensors** | what the box notices and answers by rule | the visibility gate (`inView` / `outOfView`), the clock reaching the end, pointer events (fed to the wiring) |
| **Inside** | the playback's state machine | `off` · `playing` · `paused` · `finished` (· `destroyed`) |
| **Readouts** | what the box reports | `playback.getState()` `playback.isActive()` `isPlaying()`; `onReady` `onPlaybackStart` `onPlaybackStop` `onPlaybackPause` `onPlaybackResume` `onFinish` `onDestroy`; registry events |

## 3. The model

```js
// WEB PLAYER — nothing plays on creation unless a driver says so
const player = createSvgAnimationPlayer({
  container, src: 'lid.svga.json',
  playUsingActionTriggers: true,            // the file's actionTriggers drive it (omit → only the calls below)
  onPlaybackStart() {}, onPlaybackStop() {}, onPlaybackPause() {}, onPlaybackResume() {}, onFinish() {},
});

// lever 1 — the playback
player.playback.start();    // off → a playback per actions["playback.start"] ('continue' = from the rest pose; finished → a fresh playback)
player.playback.stop();     // → off per actions["playback.stop"] (jumpToStart · animateToStart · jumpToEnd · animateToEnd)
// lever 2 — the freeze (only inside a playback)
player.playback.pause();
player.playback.resume();
// momentary
player.playback.jumpToStart(); // the rest pose now, unconditionally, nothing reported
player.playback.jumpToEnd();   // the end pose; arriving runs `atEnd`
player.playback.playOnce();    // one pass from the start, whatever `iterations` says
// readouts
player.playback.getState();    // 'off' | 'playing' | 'paused' | 'finished' | 'returning'
player.playback.isActive();    // playing · paused · finished

// no play() / pause() aliases (1.24 had them): playback.start() also unfreezes a paused playback (`continue`)
```

```jsx
// REACT / VUE — one driver family per element; the family mark is the verb
<SvgAnimationPlayer src={src} playUsingActionTriggers />                                  // the file's triggers
<SvgAnimationPlayer src={src} playback={hovered ? (frozen ? "paused" : "on") : "off"} />   // the lever
<SvgAnimationPlayer src={src} showAtProgress={0.5} />                                     // one frame, nothing plays
// prop diff → button:  off→on playback.start() · on→paused playback.pause() · paused→on playback.resume() · →off playback.stop()
// a mount with playback="off" presses nothing; a mount with "paused" = playback.start() + playback.pause()
```

```json
// SCHEMA — lists name the buttons; actions say how a button moves the playhead
"timeline": {
  "actionTriggers": { "playback.start": "load" },                                                            // autoplay
  "actionTriggers": { "playback.start": "hoverIn", "playback.stop": "hoverOut", "playback.pause": "click", "playback.resume": "click" },  // the lid
  "actionTriggers": { "playback.start": "click", "playback.stop": "click" },                                       // a click toggle
  "actions": { "playback.start": "continue", "playback.stop": "animateToStart", "outOfView": "pause" },
  "atEnd": "hold"
}
```

| Where | Words |
|---|---|
| Props | `playback="off" \| "on" \| "paused"` beside `playUsingActionTriggers`, `showAtProgress`, `showAtTime` — one driver family at a time (the TypeScript union stays) |
| Handle | everything on `player.playback`: `start()` `stop()` `pause()` `resume()`; momentary `jumpToStart()` `jumpToEnd()` `playOnce()`; `getState()` `isActive()` `isPlaying()`; both clocks and the speed |
| File | `actionTriggers: { "playback.start", "playback.stop", "playback.pause", "playback.resume" }` (always quoted); `actions: { "playback.start": continue · jumpToStart · jumpToEnd, "playback.stop": jumpToStart · animateToStart · jumpToEnd · animateToEnd }`; `atEnd: hold · jumpToStart · animateToStart`; `actions.outOfView: pause · continue · jumpToStart` (unchanged) |
| Readouts | `playback.getState()` → `off` · `playing` · `paused` · `finished` · `returning` (the request says `on`, the result says `playing` or `finished`); `playback.isActive()`; callbacks `onPlaybackStart` `onPlaybackStop` `onPlaybackPause` `onPlaybackResume` `onFinish` |
| Editor | Start playback on · Stop playback on · Pause playback on · Resume playback on; Start playback · Stop playback · At end of pass |

Rules, written once:

- `playback` off → on presses `playback.start()`, on → paused `playback.pause()`, paused → on `playback.resume()`, anything → off `playback.stop()`
  (which clears the freeze).
- `playback.start()` while a playback exists does what `actions["playback.start"]` says — `continue` (default) nothing while playing, a
  fresh playback from `finished`; `jumpToStart` a restart. `playback.stop()` retires per `actions["playback.stop"]`; the unconditional reset
  stays `playback.jumpToStart()`.
- The state rule for the lists is today's, renamed: `playback.start` acts when `off` or `finished`; `playback.stop` when `playing`,
  `paused` or `finished` (and wins over `playback.start` while finished — a click toggle undoes a finished one-shot);
  `playback.pause` when `playing`; `playback.resume` when `paused` — derived from the `playback.pause` events' counterparts unless the
  file names it.
- `playback.jumpToStart()` clears the freeze (today's executor does; Three.js `reset()` too).

What it fixes (today, read from the source 2026-11-10):

1. The levers' edges had no buttons of their own — both edges of `play` and the OFF edge of `pause` landed on `play()`,
   which decides by state; the file had all four lists (`start` `stop` `pause` `resume`), the handle did not.
2. `play` was a lever named like a button and like the readout `playing` (`play={false}` while it animates back,
   `play={true}` while it rests `finished`).
3. `pause` was a lever AND a button with one spelling.
4. `finish` sat in `actions` beside the buttons, but nobody presses it — the clock's rule → `atEnd`.
5. One act, five spellings across the layers (`start` · `play()` · `PxTriggerAction.play` · gate `start` · `onPlay`).
6. Two booleans allowed an invalid pair (`play={false} pause={true}`); one three-position lever cannot.

Precedent for the quartet: `MediaRecorder` — `start()` `pause()` `resume()` `stop()`, `state: inactive · recording ·
paused`, events `start` `pause` `resume` `stop`. For the two levers: Three.js `AnimationAction.enabled` + `paused`
(`isRunning()` derived; `clampWhenFinished` = our `hold`). For the playback as a unit: our own `playback.getTotalDuration()`.

## 4. Inside the box — the playback's state machine

```mermaid
stateDiagram-v2
  [*] --> off
  off --> playing: playback.start (continue · jumpToStart)
  off --> finished: playback.start jumpToEnd
  playing --> paused: playback.pause
  paused --> playing: playback.resume
  playing --> off: playback.stop jumpToStart
  playing --> returning: playback.stop animateToStart
  paused --> off: playback.stop
  returning --> off: arrives at the start
  returning --> playing: playback.start (turns around)
  playing --> finished: the playback ends · playback.stop jumpToEnd · animateToEnd
  finished --> off: atEnd jumpToStart · playback.stop jumpToStart
  finished --> returning: atEnd animateToStart · playback.stop animateToStart
  finished --> playing: playback.start (a fresh playback)
```

| Point | Rule |
|---|---|
| Arrival at the end by any route (natural end, `playback.stop: …ToEnd`, `playback.start: jumpToEnd`, `playback.jumpToEnd()`) | `atEnd` runs: `hold` rests `finished`, `jumpToStart` / `animateToStart` retire the playback |
| "End" | the end of the CURRENT pass; a loop stopped at a pass end reports `onPlaybackStop` only |
| `paused` into `finished` | cleared: `playback.start`, `playback.stop`, `jumpToStart` and the engine's end all set the freeze off |
| `onPlaybackStop` | fires when the stop is performed: at once for a jump, on arrival for `animateToEnd` |
| The gate | `outOfView` presses the ENGINE's pause (`hold`) and `playback.start` / `release` on re-entry; a hold is a freeze, not the user's pause — it reports nothing and `playback.getState()` does not change (DECIDED 5) |
| Scroll / view timelines | the playback buttons are no-ops (PX1505 `scrollOwnsPlayhead`) |

## 5. Why these words

What each verb means elsewhere, in this grammar (GO = off → a playback · CONTINUE = unfreeze · FREEZE · RETIRE = to the
rest pose and stay · HALT = clock stopped, pose kept, no resume). Full matrix: the survey file.

| Word | Who | Meaning there |
|---|---|---|
| `play` | WAAPI, `<video>`, YouTube, lottie-web, dotLottie, Rive, GSAP, anime, Motion, SVGator, Godot | GO or CONTINUE by state — always "from the current position"; never a lever. The one word that blurs start and resume — hence not a button here |
| `pause` | everyone but Spine / Unity's Animator (`timeScale` / `speed = 0`) | FREEZE, resumable — our `playback.pause()` |
| `resume` | GSAP, anime, MediaRecorder | CONTINUE — where it differs from `play` |
| `stop` | lottie-web, dotLottie, SVGator, Three.js, Godot, Unity, Rive, YouTube, Motion | four different things: RETIRE to the first frame (lottie-web, dotLottie, SVGator, Three.js, Godot); HALT keeping the pose (Godot `stop(true)`, Motion — terminal); UNLOAD (YouTube); halt the state machine (Rive) — hence `playback.stop` is pinned by the preset word beside it |
| `start` / `stop` as a pair | MediaRecorder (`stop()` = the session is over, a new `start()` begins another), Android `MediaPlayer`, Unity `Animation`; CI / test runs: "stop" / "cancel" a playback = terminate it, "finish" / "complete" = it reached its end | a session's bracket; with the noun "run", `stop` is the established terminator |
| `start` / `end` as a pair | DOM `touchstart` / `touchend`, `dragstart` / `dragend`, `animationend`; Spine `end` event (the entry is gone) vs `complete` (reached the end) | "end" = over — but as EVENT names; as a method `end()` lives in streams (`res.end()`), not in players; and "end" is already our position word |
| `cancel` | WAAPI, Motion, anime | RETIRE (WAAPI → `idle`, Motion → initial) or HALT + dispose (anime) |
| `finish` · `complete` | WAAPI, anime, Motion | jump TO THE END, end callbacks run — our `playback.jumpToEnd()` |
| `restart` | GSAP, anime, SVGator | a fresh playback from the start — ours is `playback.start` with `jumpToStart` (DECIDED 7) |
| `reset` | Three.js, anime, Rive | levers to default + time 0 (Three.js), pause + time 0 (anime), rebuild (Rive) — our `playback.jumpToStart()` |
| `freeze` / `unfreeze` | dotLottie (Rive `stopRendering`) | the render loop off / on — our gate's hold |
| `enabled` · `active` | Three.js, Unity, Godot `active` | the switch lever as a PROPERTY — never a method; our `playback` |
| `idle` · `inactive` · `unstarted` | WAAPI, MediaRecorder, YouTube | the not-playing state — our `off` |

Three.js in code, the two-lever precedent (`src/animation/AnimationAction.js`, verified):

```js
action.enabled = false;  // switch off: no impact, rest pose shows; time KEPT — re-enable continues
action.paused  = true;   // time stands still
action.isRunning();      // enabled && !paused && timeScale !== 0 && scheduled — derived, never set
if ( this.clampWhenFinished ) this.paused = true;   // the end of a one-shot: = our hold
else this.enabled = false;                          // = our atEnd: jumpToStart
```

## 6. Rejected on the way (2026-11-09/10)

| Idea | Why not |
|---|---|
| `play` as the lever's name (today) | no library uses `play` as a level; it is the button everywhere |
| `start()` / `stop()` beside `play()` | ambiguous only while `play()` exists — the quartet without `play()` is distinct |
| `enabled` prop + `enable()` / `disable()` | `enabled` is a property in Three.js / Unity, never a method; `player.disable()` reads as switching the component |
| `active` prop + `activate()` / `deactivate()` | one stem, but "deactivate sounds funny" and nothing in the wild says it |
| `play()` as the ONE go button of both levers, `stop()` the retire (A3) | a lever needs its own two buttons; `play()` lived on only as an alias (1.24), gone in 1.25 |
| `playState` as the only control, lists keyed by destination states (`playing` · `paused` · `idle`) | the request set ≠ the result set (`finished` cannot be asked for); state words as buttons |
| `playOn` · `playOff` · `pauseOn` · `pauseOff` | "on" clashes with the trigger's `on:` key; idioms |
| `restart()` … `reset()` | `restart` is wrong for the first playback; `reset` was removed in 1.23 for `jumpToStart` |
| `setOff()` · `begin()` / `end()` | obscure; `end()` collides with THE END |
| `startPlayback()` `pausePlaying()` `resumePlaying()` `resetPlayback()` | a noun per lever is right, but `playback` / `playing` share a stem; `reset` contradicts `playback.stop: jumpToEnd`; no adjective for a prop |
| `player.playback.start()` … | rejected 2026-11-10 ("the file and the props cannot namespace cheaply"); **taken in 1.25** — the file names the act `"playback.start"` (a dotted action name), the props stay flat (`playback`, `onPlaybackStart`) |
| `createPlayback()` → `pause()` `resume()` `dispose()` | the playback as an object's lifetime — `playback.stop: animateToStart` becomes "dispose, animating", `finished` a live object at rest, a prop cannot hold an object; survives as `playback.isActive()` |
| `playback={bool}` + `paused={bool}` · `playControls={{ playback, paused }}` | the second lever has no family mark; an object prop re-renders; the enum has no invalid pair |
| buttons only (drop the lever, drive through `playerRef`) | React is declarative; the lever is the point of the wrapper |
| `isRunning()` as the region readout | WAAPI's `running` = playing; "running but paused" contradicts — `playback.isActive()` |
| `endRun()` instead of `playback.stop()` (owner's doubt: "stop" sounds like halted, "end" like over) | weighed, not taken — close call. For: a playback is a session, sessions end (DOM `*start` / `*end` events, Spine `end`); `onPlaybackEnd` reads like `animationend`. Against: "end" is already our POSITION word in three compounds (`jumpToEnd` `animateToEnd` `atEnd`) and would become a verb too — "end the playback" can be read as "make it reach its end", the very thing `jumpToEnd()` does, so `endRun()` next to `jumpToEnd()` raises a worse doubt than `playback.stop()` next to `pause()`; with the noun "run", "stop" / "cancel" is the established terminator (CI and test runs) and "end" the umbrella for both ways out; every animation library spells this act `stop`, none `end`. Kept: `playback.stop()` / `onPlaybackStop` (MediaRecorder: method `stop()`, event `stop`). If a third word is ever wanted: `exitRun()` (Motion `exit`, Rive / Unity Exit) says "over" without touching "end" (1.24's names; since 1.25 the act is `playback.stop()` / `onPlaybackStop`) |

## 7. Later — not in this step

- **Inputs (layer 2 + 4, the destination):** every lever and button becomes an input the file wires events to;
  `playback`'s positions are the built-in input. These names are those inputs, so this is a step, not a detour:
  ```json
  "timeline": { "state": { "playback": { "off": { "initial": true }, "playing": {}, "paused": {}, "finished": {} } }, "actionTriggers": { "playback.start": "hoverIn", "playback.stop": "hoverOut" }, "atEnd": "hold" }
  ```
- **The gate as a sensed lever** (`inView`), with its own rule words beside `outOfView`.
- **Pointer words:** `hoverIn` / `hoverOut` are web words; Rive, dotLottie and React Native say `pointerEnter` /
  `pointerExit`.
- **A `frozen` readout** for the gate's hold (dotLottie `isFrozen`).

## 8. History

- 2026-11-09: the two switches as `timeline.state.animation.{play, pause}` + `playOn` / `playOff` names; then the
  three tiers (controls · animation state · moves) and the library survey.
- 2026-11-10: the boxes; `start` / `stop` vs `play` / `resume` / `pause` ambiguity; `enable` / `disable`, `activate` /
  `deactivate`, one-go-button `play()`, nouned spellings tried; the run as the lever's noun; `playRun` as the one driver
  prop with the `play` family mark; `endRun` weighed against `stopRun` and not taken; this text.
- 2026-11-11: the noun changed — **playback**, not run (first flat: `startPlayback()` · `onPlaybackStart` · the `playback` prop ·
  `getPlaybackState()` · `playOnce()`); the reasoning is in [animation-state.playback-noun.md](./animation-state.playback-noun.md).
- 2026-11-12: one home — `player.playback.*` (`start()` · `getState()` · `getSpeed()` · `…AtSpeed`), no `play()` / `pause()`
  aliases, and dotted action names in the file (`"playback.start"`), folded into schema 1.25 before any commit
  ([animation-state.playback-namespace.md](./animation-state.playback-namespace.md)). This text and the boxes rewritten to the
  final words; the print version regenerated.
