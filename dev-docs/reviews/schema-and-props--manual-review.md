# Schema, props and API — manual review, digested

The owner's questions from the manual review of the wire schema (1.15), the player API and the component props.
First the proposed changes as old → new, then what stays unresolved, then the research: the libraries used as
precedent and, per question, the complaint as asked, what the code does today, what other libraries do, and the
options. Analysis date 2026-11-03. *agreed* marks what was settled with the owner that day; everything else is this
review's pick. Decisions go to `schema-and-props-review-fix-plan.md`.

**Read with:** `packages/svg-animator-core/src/format/PxAnimatorTypes.ts` (wire), `PxAnimatorConstants.ts` (enums,
resolution), `src/playback/PxFrameLoop.ts` (the js engine's clock), `svg-animator-web/src/engines/PxAnimatorBind.ts`
(the `playDuration` factor), `docs/library/playback-and-triggers.md` (the published words).

## Proposed changes — old → new

Each wire row is its own schema step with the exact `up` / `down` where one exists. Additions follow in [New](#new),
what stays as it is in [Kept as is](#kept-as-is).

**Wire schema**

| Old | New | Section |
|---|---|---|
| `timeline.playDuration` — wall ms of one pass | `timeline.playSpeed` — factor, default 1; `playSpeed = (outTime − inTime) / playDuration` | A2 *agreed* |
| `actionTriggers` absent = `load`, `{}` = manual | absent ≡ `{}` ≡ manual: no triggers, static until driven by the handle, the `play` prop or an override; autoplay is always written, `{ "start": "load" }`; the step writes it into stamped files that relied on the old default | B2 *agreed* |
| `actions.start: 'jumpToFinished'` | `'jumpToEnd'` | A4, B1 *agreed* |
| `timeline.showWhenStopped: 'static' \| 'firstFrame'` | `timeline.whenIdle`, values kept | B3 *agreed* |
| `effects.clone.without: 'translate'` | `effects.clone.omit: 'translate'` — subtractive kept (owner); `without` is the close second | B4 *agreed* |
| `effects.clone.retime: { start, stretch, timeCrop: [a, b] }` | `retime: { offset, stretch, inTime, outTime }` | B5 *agreed* |

**Player handle**

| Old | New | Section |
|---|---|---|
| `setPlaybackRate(r)`, no getter | `setPlaySpeed(s)` / `getPlaySpeed()` — the handle's value replaces the file's, no hidden product | A2 *agreed* |
| `getCurrentTime()` / `setCurrentTime(ms)` — ms into the whole run | the position INSIDE the iteration: the content time of the frame on screen, 0 to `getDuration()`; runs backwards during a reversed pass of `alternate` | A5 *agreed* |
| `getCurrentProgress()` / `setCurrentProgress(p)` — 0–1 of the run, of one iteration when infinite | 0–1 of the iteration, always; the `infinite` exception goes | A5 *agreed* |
| `showAtTime`, `showAtProgress` — of the whole run | of one iteration, the same axis as `getCurrentTime()` / `getCurrentProgress()` | A5 *agreed* |
| `jumpToFinished()` | `jumpToEnd()`, `@advanced` — the executor of the action value | A4 *agreed* |
| `PxPlayState`: `stopped · playing · paused · finished` | `idle · playing · paused · finished · destroyed`; calls after `destroy()` are no-ops with a `usage` diagnostic | B3, C4 *agreed* |

**Component props and options**

| Old | New | Section |
|---|---|---|
| `timelineOptions.playDuration` | `timelineOptions.playSpeed` | A2 *agreed* |
| `play` / `pause` — React, Vue, React Native | `playWhile` / `pauseWhile` — the same two levels, named as levels; a driver prop starts with its verb | C1 *agreed* |

**Types, docs, editor**

| Old | New | Section |
|---|---|---|
| `PxDocumentInput` | `PxDocumentJson` | C3 *agreed* |
| the three-axes table in `playback-and-triggers.md` | one sentence: *every plain ms is model ms inside the iteration; `total…` counts the whole run; the speed only changes how fast real time passes* | A1 |
| `delay` doc line — scaling by the speed unsaid | add: run ms, scaled by the speed, as WAAPI — `delay: 500` at `playSpeed: 2` lasts 250 real ms | A3 *agreed* |
| the editor's Play Duration field | stays as the label; writes `playSpeed`, shows both | A2 |

## New

Additions that replace nothing.

| What | Why | Section |
|---|---|---|
| `getPlayDuration()` / `setPlayDuration(ms)` | one pass in real ms — the meaning the file key `playDuration` had, moved to the handle; the setter is sugar that sets the speed | A2 *agreed* |
| `getCurrentPlayTime()` | the playhead in real ms at the current speed: `getCurrentTime() / getPlaySpeed()`; derived and read-only, so paused time and speed changes cannot confuse it | A1 *agreed* |
| `getTotalDuration()` | the run's length: one pass × iterations, `null` when infinite; the slider's `max` without a division to guard | A5 *agreed* |
| `getTotalPlayDuration()` | the run in real ms at the current speed: `getTotalDuration() / getPlaySpeed()`, `null` when infinite — the "finishes in 3 s" label, the figure podcast apps show as time remaining at 1.5× | A1, A5 |
| `getTotalTime()` / `setTotalTime(ms)` | the position on the whole run, every iteration included; `getTotalTime()` is 0 while the delay waits and grows without bound on an infinite file; the across-the-run slider | A5 *agreed* |
| `getCurrentIteration()` | which pass is playing, 0-based | A5 *agreed* |
| `getPlayState()` | the one state read, `PxPlayState` with `idle` and `destroyed`; `isReady()` / `isPlaying()` stay as conveniences | C4 *agreed* |
| `playState` prop — `'idle' \| 'playing' \| 'paused'` | the same control as `playWhile` / `pauseWhile` in one state word (`idle` = the file's stop action, `paused` = frozen); a driver, so it starts with `play`; set together with `playWhile` / `pauseWhile` it is a usage conflict like the other control props. Both forms ship so the owner can try them (2026-11-04) | C1 *agreed* |

## Kept as is

Questions answered with no change; the section has the reasoning.

| What | Why | Section |
|---|---|---|
| `timeline.delay` — run ms, scaled by the speed | WAAPI's behaviour, free on the native engine; only the doc line was missing (above) | A3 |
| `actions.*` words — `continue`, `restart`, `reset`, `rewind`, `hold`, `pause` | short, one meaning each; they map onto GSAP's `toggleActions` vocabulary | B1 |
| `timeline.inViewThreshold`, `timeline.inViewDebounce` | they describe the gate, which has two edges; `outOfView` is only the leaving edge (owner, 2026-11-03) | B7 |
| `timeline.actionTriggers`, `timeline.actions` — the names | inside `timeline` everything is playback; a `playback` prefix adds length, not meaning | B8 |
| `effects.transformBy`, `effects.maskedBy`, `effects.clipPath` | `maskedBy` references an element, `clipPath` holds its own `pathData`, `transformBy` its own amounts — the two grammars are the rule | B6 |
| `definitions.easings` / `animations` / `fonts` | clear and distinguishable; `animations` is read through `animateWith` | B9 |
| per-property `loop.direction: normal \| alternate` — no `reverse` | After Effects' `loopOut` has none either; a reversed first repetition would be a jump | B10 |
| `getDuration()` | one pass, model ms; plain names are model ms, the convention of every player | A1 *agreed* |
| `isReady()`, `isPlaying()` | conveniences beside the new `getPlayState()` | C4 |
| `PxDiagnostic`, `onWarn` / `onError` / `suppressWarnings` / `suppressErrors` | React's and Angular's error-code design; nothing to change | C5 |
| `onSvgAnimationPlayersChange()` | the page registry's subscription; experimental, drop only if it never finds a second user | C6 |
| `doc` + `src` | two props is the norm everywhere; `source` is taken by the effects | C2 |
| `showAtTime`, `showAtProgress`, `playUsingActionTriggers`, `actions`, `playerRef` | not questioned | — |
| `unknown` for `meta` and pass-through attributes in the TS rendering | the honest type for values the player never looks inside; one sentence in the docs | C7 |
| `actionTriggers.resume` on the wire | derived unless the file names it, honoured and checked (PX1111) since 1.15; the editor's field stays disabled. Owner, 2026-11-04: keep | fix plan §2.1 *agreed* |

## Unresolved

None. Every question above ends in an *agreed* row.

## Libraries used as precedent

| Library | What it contributes here |
|---|---|
| lottie-web | `setSpeed`, `setDirection`, `goToAndStop`, `playSegments`, `currentFrame` / `totalFrames`, `isPaused`, `getRegisteredAnimations()`, `destroy()`; the JSON's `ip` / `op` / `fr` and the layer's `ip` / `op` / `st` / `sr` |
| dotLottie (web, React) | `src` + `data`, `speed`, `mode` (`forward` · `reverse` · `bounce` · `reverse-bounce`), `segment: [start, end]`, `setFrame`, `freeze` / `unfreeze`, `isPlaying` / `isPaused` / `isStopped` / `isFrozen`, `loadError` event |
| react-lottie, lottie-react | controlled booleans `isStopped` / `isPaused`; `animationData`, `autoplay`, `lottieRef`; `useLottieInteractivity` (visibility ranges with `seek` / `play` / `stop` / `loop`) |
| GSAP | `time` / `totalTime`, `duration` / `totalDuration`, `progress` / `totalProgress`, `timeScale`, `repeat` / `yoyo` / `repeatDelay`, `delay`; `play` / `pause` / `resume` / `reverse` / `restart` / `seek` / `kill`; ScrollTrigger `toggleActions` with the eight words `play pause resume reset restart complete reverse none` |
| WAAPI | `playbackRate`, `currentTime`, `playState` (`idle` · `running` · `paused` · `finished`), `finish()`, `cancel()`, `reverse()`; timing `delay`, `endDelay`, `fill`, `iterations`, `iterationStart`, `direction`; `getComputedTiming().progress` is per iteration; `document.getAnimations()` |
| CSS | `animation-fill-mode`, `animation-play-state`; scroll-driven `animation-range: entry 0% exit 100%` with the phases `cover` · `contain` · `entry` · `exit` · `entry-crossing` · `exit-crossing` |
| SVGator player | `play` / `pause` / `stop` / `restart` / `reverse` / `toggle` / `seek` / `destruct` / `ready`; `state` = `playing` · `paused` · `ended` · `rollback`; `currentTime`, `totalTime` (iterations × duration), `duration`, `iterations`, `isAlternate`, `isRollingBack`, `hasEnded`; `set('speed' \| 'fps' \| 'direction' \| 'fill' …)`; editor start triggers load · click · hover · scroll · programmatic |
| Rive | `src` + `buffer`; `play` / `pause` / `stop` (by animation name); `scrub(name, seconds)`; `isPlaying`, `playingAnimationNames`; `onPlay` / `onPause` / `onStop` / `onLoop`; `cleanup()`; pointer listeners live in state machines; no public speed in the high-level JS API |
| Motion (Framer) | `animate()` controls: `play` / `pause` / `stop` / `cancel` / `complete`, `time`, `speed`; `transition.repeat`, `repeatType` (`loop` · `reverse` · `mirror`), `repeatDelay` |
| Three.js AnimationAction | `enabled` and `paused` as two independent flags, `timeScale`, `loop` (`LoopOnce` · `LoopRepeat` · `LoopPingPong`), `repetitions`, `clampWhenFinished` |
| SMIL, `<video>` | SMIL `fill="freeze \| remove"`, `restart="always \| whenNotActive \| never"`; `<video>` `playbackRate`, `currentTime`, `duration`, `paused`, `ended`, `autoplay` |
| After Effects | `loopOut('cycle' \| 'pingpong' \| 'offset' \| 'continue')` and `loopIn` — the per-property loop model Lottie inherits |
| React, Angular | production error codes with a docs URL instead of shipped sentences |

---

## Part A — Time

### A1. Three time dimensions

> it seems we have 3 time dimensions/units: progress [0, 1]; inTime/outTime and keyframes in content/internal/model
> time; playDuration creates another time dimension, screen/user-time. Then you are not sure about all other time
> attributes, in which dimension: e.g. `timeline.delay` — content or play time? Because we model internal time in ms,
> we use ms for both … If we replace playDuration with speed/playbackRate the problem will probably remain.

**Today.** Three axes, one unit, and the axis is knowable only per key:

| Axis | Keys |
|---|---|
| content ms | keyframe `time`, `inTime` / `outTime`, `retime.start`, `retime.timeCrop`, `getDuration()` |
| run ms (content ms counted across iterations, `delay` before 0) | `getCurrentTime()`, `setCurrentTime()`, `showAtTime`, `delay` |
| wall ms | `playDuration` only — implemented as a hidden rate factor (`PxAnimatorBind.ts`): `setPlaybackRate(r)` multiplies on top, `getCurrentTime()` is untouched |

Related findings:
- Speed is spelled three ways with two opposite senses: `playDuration` in ms, `retime.stretch` as a factor where 2 is
  slower, `setPlaybackRate` as a factor where 2 is faster.
- A declarative "play at 2×" is impossible without reading the file: `timelineOptions.playDuration` needs the
  content length first.
- `progress` is 0–1 of the whole run, except for `infinite`, where it is one iteration — two meanings under one word.

**Precedent.** No player exposes a wall-ms knob. Speed is a unitless rate everywhere: lottie-web `setSpeed`,
dotLottie `speed`, SVGator `speed`, GSAP `timeScale`, WAAPI `playbackRate`, `<video>.playbackRate`, Motion
`controls.speed`, Three.js `timeScale`. Durations in ms/s appear only where the author DEFINES a tween (GSAP, Motion,
CSS `animation-duration`) — our keyframes already carry the length. For the two axes GSAP has the clearest naming:
`time` vs `totalTime`, `duration` vs `totalDuration`, `progress` vs `totalProgress`. WAAPI's `progress` is per
iteration, with `currentIteration` beside it.

**Proposal (agreed 2026-11-03).** Three layers; the two model layers keep plain names, the real-time layer carries
the word `play`; no key in the file is ever a wall quantity:

| Layer | Names |
|---|---|
| one iteration — the content window; plain names | keyframe `time`, `inTime` / `outTime`, `retime.inTime` / `outTime`, `getDuration()`, `getCurrentTime()` / `setCurrentTime()`, `getCurrentProgress()`, `showAtTime`, `showAtProgress` |
| the run — the delay, then every iteration in order; `total…` names | `getTotalTime()` / `setTotalTime()`, `getTotalDuration()`, `getCurrentIteration()`, `delay` |
| real time — the run at the current speed | `playSpeed` (file, override, handle), `getPlayDuration()` / `setPlayDuration()`, `getTotalPlayDuration()`, `getCurrentPlayTime()` |

```ts
// model, plain names
getCurrentTime() / setCurrentTime(ms)     // the playhead inside the iteration, 0..duration
getDuration()                             // one pass
getCurrentProgress() / setCurrentProgress(p)   // 0..1 of the iteration
getCurrentIteration()                     // which pass, 0-based
getTotalTime() / setTotalTime(ms)         // the playhead on the whole run
getTotalDuration()                        // the run; null when infinite

// real time, the play family, every value derived from the speed
getPlaySpeed() / setPlaySpeed(s)          // 1 normal, 2 double, 0.5 half
getPlayDuration() / setPlayDuration(ms)   // one pass in real ms; the setter sets the speed
getTotalPlayDuration()                    // the run in real ms; null when infinite
getCurrentPlayTime()                      // getCurrentTime() / getPlaySpeed()

// file and override, the same word
{ "timeline": { "outTime": 1000, "playSpeed": 2 } }
timelineOptions={{ playSpeed: 0.5 }}
```

Why these words:
- Plain names stay model time INSIDE the iteration: it is the axis with the most keys, and the animation players
  with loops spell it plainly there — lottie-web and dotLottie `currentFrame`, Three.js `action.time`, GSAP `time()`;
  the run takes GSAP's `total…` prefix (`totalTime`, `totalDuration`). One pass is always finite, so no read has an
  `infinite` exception.
- `play…` reads as real time to nearly everyone ("play duration: 3 s") — the reason the wire key got the name. The
  family keeps the word with its meaning and moves it from the file to the handle, one spelling for the whole
  family, like lottie-web's own `playSpeed` / `playDirection`.
- A wall POSITION is well defined only as a conversion of the playhead at the current speed, never as a stopwatch
  (paused time, speed changes mid-run) — so `getCurrentPlayTime()` is derived and read-only, and there is no
  "elapsed" read.
- `getTotalDuration()` is the recognised word for the run's length (GSAP `totalDuration`, SVGator `totalTime`,
  Android `getTotalDuration`) and the slider's `max`, with `null` as the honest answer for `infinite`.

One sentence for the docs: *every plain ms is model ms inside the iteration; `total…` counts the whole run; the
speed only changes how fast real time passes.* With it `delay: 500` at `playSpeed: 2` reads as 250 real ms without a table.

Rejected on the way: `playbackRate` ("rate" reads as a frequency and sits next to `frameRate`), `timeScale` (invites
the 1 / x misreading; `scale` is a transform word here), the prefixes `wallClock` / `real` / `unscaled` (precise but
cold; `real` works only as the compound `realTime`, which also means "live"; `unscaled` depends on the viewpoint), a
`content` prefix on the plain axis (two words longer on every common read), and an "elapsed" wall read (ambiguous
about paused time).

### A2. speed / playbackRate / playDuration — which knob

> What is the best way to configure slowing or accelerating: speed / playbackRate / playDuration — which is most used
> elsewhere? In config we have playDuration but no method; in player we have playbackRate but no attr.
> `player.setPlaybackRate()` — sets some internal playDuration? How are both resolved when both specified?

**Today.** Effective engine rate = `setPlaybackRate(r) × (outTime − inTime) / playDuration`; `getCurrentTime()` stays
on content ms. No `getPlaybackRate()`.

**Precedent.** The word splits in two camps: `speed` (lottie-web, whose property is `playSpeed`; dotLottie; SVGator;
Motion) and `playbackRate` / `timeScale` (WAAPI, `<video>`, GSAP, Three.js). Every one is a factor where 2 means
faster. The only inverse quantities are a time STRETCH (After Effects, Lottie `sr`, our `retime.stretch`) and a wall
duration (`playDuration`): `speed = 1 / stretch = (outTime − inTime) / playDuration`. GSAP's `duration()` setter and
Three.js `setDuration()` are the precedent for a duration SETTER as sugar over the speed, nothing stored.

**Proposal (agreed 2026-11-03).** Wire `timeline.playSpeed?: number` (default 1, positive; direction stays
`iterationDirection`) replaces `playDuration`; `timelineOptions.playSpeed` for the declarative case. On the handle
the file's value is the initial one and `setPlaySpeed(s)` REPLACES it — no hidden product. `setPlayDuration(ms)` is
the sugar that computes the speed. Migration is exact both ways: `playSpeed = (outTime − inTime) / playDuration`.
The editor's Play Duration field stays as the human phrase and writes the speed; it can show both.

```json
{ "timeline": { "outTime": 1000, "playSpeed": 2 } }
```
```tsx
<SvgAnimationPlayer doc={ball} playUsingActionTriggers timelineOptions={{ playSpeed: 0.5 }} />
```

### A3. `delay` — which clock

**Today.** The js engine starts the clock at `−delay` and advances it by `wall × speed`, so a delay is scaled by the
speed; `playDuration` (a speed factor underneath) scales it too: `delay: 500` with a `playDuration` of twice the
window waits 1000 wall ms. The docs list `delay` under "ms into the whole run" and say nothing about scaling.

**Precedent.** WAAPI's `delay` runs on the animation's own clock, so `playbackRate` scales it — our `native` engine
IS WAAPI, so this is the free behaviour. GSAP positions `delay` on the parent timeline, so a tween's own `timeScale`
does not scale it. CSS has no rate. Lottie and dotLottie have no delay.

**Proposal.** Keep run ms scaled by the speed (WAAPI), and say it in the `delay` doc line: "run ms: at
`playSpeed: 2` a `delay: 500` lasts 250 real ms". Under the A1 model this is the only consistent choice. Rejected:
wall ms (the viewer's wait is what a designer sets) — needs compensation in the native engine and breaks the
"no file key is a wall quantity" rule.

### A4. `jumpToFinished` — value and method

> do we really need them? anyone going to use it? can it be useful and for what?

**Today.** `actions.start: 'jumpToFinished'` lands in the finished state with no motion; `api.jumpToFinished()` does
the same and fires `onFinish`. The documented use: overlay art that *appears instantly and retreats animated* —
`actions: { start: 'jumpToFinished', stop: 'rewind' }` on a tooltip, a menu, a hover highlight.

**Precedent.** The method exists everywhere: WAAPI `finish()`, Motion `controls.complete()`, GSAP `progress(1)`,
lottie-web `goToAndStop(totalFrames − 1, true)`, SVGator `seek(100)`. GSAP's ScrollTrigger even has it as a trigger
reaction word, `complete`. As a *start behaviour of a document* it is ours alone — justified by the case above, which
nothing else can say declaratively.

**Options.**
1. Keep the value, rename `jumpToEnd`: its siblings name positions and motion (`restart`, `rewind`, `reset`) while
   `finished` is a state. Demote the method to `@advanced` (it is the executor of the value), or drop it once
   `setCurrentProgress(1)` lands in `finished` and fires `onFinish`.
2. Keep both as they are, add the overlay example to the method's doc line.
3. Drop both — loses the one declarative "exit animation only" pattern.

### A5. `getCurrentTime()` is run ms, `getDuration()` is one pass — which axis is plain?

`setCurrentTime` clamps to pass × iterations while `getDuration()` returns one pass, so the documented slider
(`slider.max = getDuration()`) covers the first pass of a repeating file only. The asymmetry itself is the
convention — WAAPI's `currentTime` runs across iterations against a per-iteration `duration`, SVGator and GSAP the
same — and every one of them names the run's length with `total…` (SVGator `totalTime`, GSAP `totalDuration`,
Android `getTotalDuration`).

The second shape is GSAP's, and also what the animation players with loops do: the plain position lives INSIDE
the iteration (lottie-web and dotLottie `currentFrame`, Three.js `action.time`, Rive, GSAP `time()`), and `total…`
names the run (GSAP `totalTime` / `totalDuration`). Its advantage: one pass is always finite, so no read needs an
`infinite` exception — today `getCurrentProgress()` and `showAtProgress` mean the run, except for `infinite`, where
they silently mean one iteration.

**Proposal (agreed 2026-11-04).** The GSAP shape:

| | one iteration | the run |
|---|---|---|
| position | `getCurrentTime()` / `setCurrentTime(ms)` — the content time of the frame on screen, 0 to `getDuration()`; runs backwards during a reversed pass of `alternate` | `getTotalTime()` / `setTotalTime(ms)` — every iteration included; 0 while the delay waits; unbounded on an infinite file |
| length | `getDuration()` | `getTotalDuration()` — one pass × iterations, `null` when infinite |
| progress | `getCurrentProgress()` / `setCurrentProgress(p)`, `showAtProgress`, `showAtTime` | not needed |
| which pass | `getCurrentIteration()`, 0-based | |

A slider for a looping file spans one pass and wraps, as every animation player shows it; a slider over the whole
run of a finite file uses the `total…` pair. The earlier verdict on `getTotalDuration()` ("duration × iterations,
useless") is revisited: as a value it is a multiplication, as a NAME it is the recognised word for the run, and
`null` is the honest answer for `infinite` instead of a division the page has to guard. This changes the meaning
of `getCurrentTime()`, `setCurrentTime()`, `getCurrentProgress()`, `setCurrentProgress()`, `showAtTime` and
`showAtProgress`; `getTotalTime()`, `setTotalTime()` and `getCurrentIteration()` are new.

---

## Part B — Playback words and shapes

### B1. The action words — `rewind`, `reset`, … is there a way to simplify?

**Today.**

| Action | Values | Default |
|---|---|---|
| `start` | `continue` · `restart` · `jumpToFinished` | `continue` |
| `stop` | `reset` · `rewind`, + `completeIteration` | `reset` |
| `finish` | `hold` · `reset` · `rewind` | `hold` |
| `outOfView` | `pause` · `continue` · `reset` | `pause` |

**Precedent.** GSAP's ScrollTrigger `toggleActions` is the one established vocabulary of "what a trigger does":
`play pause resume reset restart complete reverse none`. Ours maps onto it almost one to one:

| Ours | GSAP word | Note |
|---|---|---|
| start `continue` | `play` | play on from where it rests |
| start `restart` | `restart` | |
| start `jumpToFinished` | `complete` | |
| stop `reset` | `reset` | lottie-web, dotLottie, SVGator, Three.js: `stop()` = reset to the start |
| stop `rewind` | `reverse` | SVGator's hover-out reaction is also "reverse"; GSAP's `reverse` leaves the tween reversed, ours ends stopped |
| finish `hold` | — | CSS `fill: forwards`, SMIL `freeze`, Three.js `clampWhenFinished` |
| outOfView `pause` | `pause` | |
| outOfView `continue` | `none` | |
| outOfView `reset` | `reset` | |

**Options.**
1. One rename: `jumpToFinished` → `jumpToEnd` (A4). `reset`, `rewind`, `hold` are short, one meaning each; `continue`
   carries two shades (from where it rests · keep running) but both are "do not interrupt the position". Optionally
   `outOfView: 'none'` for GSAP's word of "do nothing".
2. A full two-axis system — `jumpToStart` · `playToStart` · `jumpToEnd` · `hold` — one grammar, longer words, a 1.16
   step with exact up/down.
3. Adopt GSAP's words outright (`complete`, `reverse`, `none`) — `reverse` collides with `iterationDirection: reverse`.

### B2. `timeline.actionTriggers` absent when the triggers are programmatic

> Make sure that timeline.actionTriggers is absent from json when we set programmatic triggers.

**Today.** It cannot be absent: an absent block means `start: 'load'` (`resolveTriggers`, `PX_PLAYBACK_DEFAULTS.start`),
and the editor writes `{}` for the manual document, which the player reads as "no start event". Absence and
emptiness carry different meanings — a trap for merge patches, hand editing and every tool that drops empty objects.

**Precedent.** SVGator's editor has "Programmatically" as an explicit start choice, and the exported file always
carries the setting. dotLottie and Rive default `autoplay` to off: nothing plays until asked, and the file never
implies it. The owner's own rule for the components (fix plan §2.2): a bare component is a still — don't guess the
default.

**Proposal (agreed 2026-11-03).** One rule: absent ≡ `{}` ≡ manual. A file that names no triggers stays static until
something drives it — the handle's `play()`, the component's `play` prop, a `playUsingActionTriggers={{ start: … }}`
override. Autoplay is always written, as the editor already does:

```json
{ "actionTriggers": { "start": "load" } }
```

Every list's stated default becomes empty; `PX_PLAYBACK_DEFAULTS.start` and the docs line "absent block = load" go.
A 1.16 step keeps existing files playing: `up` writes `{ "start": "load" }` into a stamped time timeline that has no
block. The one behaviour change is for hand-written, unstamped files without the block — they become static, the
"don't guess" rule applied to the file.

### B3. `showWhenStopped`

> wrong name; the meaning is showFirstFrameBeforeStart (or when reset): boolean (default false). "stopped" implies
> played and then stopped.

**Today.** It governs one state of `PxPlayState` — `stopped`: before the first play, after `reset()`, after a stop or
finish whose behaviour is `reset`, after a `rewind` lands. Values `static` (the SVG as authored) · `firstFrame`.
"Before start" was the name until 1.14 and read as the first start only; "stopped" now reads as played-then-stopped.
Both readings are the VCR's fault: that state has no everyday word.

**Precedent.** WAAPI calls exactly this state `idle` (`playState: idle · running · paused · finished`). CSS says
`animation-fill-mode: backwards` for "show the first keyframe before it starts", and `none` for the static element.
Lottie, dotLottie, Rive and SVGator have no `static`: their art has no authored state apart from frame 0, so they
always show the first frame.

**Options.**
1. `whenIdle: 'static' | 'firstFrame'` — WAAPI's state word, no VCR reading; rename `PxPlayState.stopped` → `idle`
   with it so the key, the enum and `getPlayState()` (C4) say one word. Keep the enum: `lastFrame` is a plausible
   third value.
2. Boolean `showFirstFrameWhenIdle` (default `false`) — the owner's shape; closes the door on a third value.
3. `fillMode: 'none' | 'backwards'` — CSS's words, but our finish behaviour already covers `forwards` with three
   values, so the two keys would overlap.

### B4. `clone.without: 'translate'`

> "without" is a strange attribute name … alternatives?

**Today.** Subtractive on purpose: the `<use>` can point at one wrapper layer of the source, so the choices form a
ladder (`translate` now, maybe `transform` later). Absent = whole element (moves with the source); `translate` =
the source's content without its own position (the clone sits where the `<use>` put it).

**Precedent.** None for the effect — SVG `<use>` always copies the whole element; Lottie has no clone; SVGator none.
For the WORD there is: TypeScript's `Omit<T, K>` and lodash's `_.omit` mean "a copy of this without these keys",
lodash also has `_.without`; `exclude` is webpack's and rsync's; `except` belongs to Python and SQL; `drop` takes a
count in lodash and Kotlin; `remove` is a mutation verb; `undo` means reverting.

**Proposal (owner, 2026-11-03: stay subtractive).** `omit: 'translate'` — the TypeScript word for exactly this
operation, read right by every TS developer, and it grows into a list (`omit: ['translate', 'rotate']`) if the ladder
ever needs two rungs at once. `without` is the close second: it reads as English and costs nothing. A positive form
(`copy: 'element' | 'content'`) was considered and set aside: the choice IS subtractive — which layer of the source's
own transform the clone leaves out.

### B5. `retime.timeCrop: [in, out]` vs `inTime` / `outTime`

> is it consistent with other attrs that we have a range as [number, number]?

**Today.** The format uses tuples for VECTORS and POINTS (`translate: [x, y]`, `scale`, `origin`, easings,
`tangentIn` / `tangentOut`, RGBA) and NAMED KEYS for windows (`inTime` / `outTime`, the scroll `range.start` /
`range.end` objects). `timeCrop` is the one window spelled as a tuple. `retime.start` also reuses a word that means a
trigger list and an action elsewhere.

**Precedent.** Lottie spells the same four layer settings `ip` · `op` · `st` · `sr` (in point, out point, start
time, stretch) — and its composition uses the same `ip` / `op` / `fr` that our timeline calls `inTime` / `outTime` /
`frameRate`. dotLottie's player-side `segment: [start, end]` is a tuple, but that is a playback selection, not an
authored window. CSS scroll ranges are named (`animation-range-start` / `-end`).

**Options.**
1. Mirror the timeline and Lottie: `retime: { offset?, stretch?, inTime?, outTime? }` — same words as the timeline
   because it is the same thing, a window on the document timeline; `offset` instead of `start` (free of the
   trigger/action meaning). `stretch` may stay: it is After Effects' and Lottie's authoring word (`sr`), and
   `playSpeed` (A2) is the player's word — two worlds, two words.
2. The same with `playSpeed` inside `retime` too — one word for speed everywhere, at the cost of the AE precedent.
3. Keep the tuple and add the rule "windows are tuples" — contradicts `inTime` / `outTime` and `range`.

### B6. `transformBy` vs `maskedBy` — passive voice?

**Today.** Different grammar, both natural: *masked BY an agent* (passive, a reference to another element through
`source`) and *transform BY an amount* (instrumental, the effect's own numbers). The bucket's names sort into the
two kinds already: `maskedBy` is the one effect that references another element; `clipPath` (its own animatable
`pathData`), `transformBy`, `repeater`, `strokeTrim`, `fillGradient`, `strokeGradient`, `textPath` and `text` hold
their own parameters; `clone` references through `source` but names the thing it makes.

**Precedent.** None to borrow: Lottie uses `tt` (matte), `masksProperties`, `parent`; CSS `clip-path`, `mask`.

**Keep.** The rule the names already follow: an effect that REFERENCES another element reads as a passive with its
agent (`maskedBy`), an effect that holds its own parameters is a noun or an instrumental verb phrase (`clipPath`,
`transformBy`). This review first proposed `clipPath` → `clippedBy` on the wrong assumption that it referenced an
element; it does not, so the rename is withdrawn. Worth one sentence in the effects doc so the two grammars read as
intended.

### B7. Found, then withdrawn: the gate's numbers sit apart from the gate's action

`inViewThreshold` and `inViewDebounce` are timeline keys, while `actions.outOfView` is the behaviour the gate
fires. This review first proposed nesting the numbers under the action,
`outOfView: { behavior, threshold, debounce }`, the way lottie-react's `useLottieInteractivity` and GSAP's
ScrollTrigger keep the visibility numbers with the reaction.

**Withdrawn (owner, 2026-11-03).** The gate has two edges — leaving the view and coming back — like `start` and
`stop`, or `pause` and `resume`. `outOfView` names only the leaving edge; the threshold and the debounce describe the
gate itself and apply to both. So they stay where they are, as attributes of the gate. If the returning edge ever
gets its own behaviour, it is a separate action (`inView`), not a reason to move the numbers.

### B8. Names: `playbackActions`, `playbackActionTriggers`?

Inside `timeline` everything is playback; the prefix adds length, not meaning. SVGator says "interactions",
GSAP `toggleActions`, Rive "listeners". Keep `actionTriggers` and `actions` (the 1.11 reasoning holds: a key names
the action it fires, the same key in `actions` says how that action looks).

### B9. `definitions` — are the immediate names clear?

`easings` (name → bezier) and `fonts` (face → glyph outlines; Lottie splits the same data into `fonts` + `chars`)
are clear and distinguishable. `animations` (name → a whole `animate` block, used through `bindings[].animateWith`)
is the vague one, but rarely used and read through `animateWith`. Keep; if ever renamed, `animateBlocks` says what an
entry is.

### B10. Inner loop vs the outer iterations

> inner loop values don't have e.g. "reverse" — sync them, or ok if slightly different?

**Today.** Inner `loop: { segmentCount, repeatAt: start | end, direction: normal | alternate }`; outer
`iterations`, `iterationDirection: normal | reverse | alternate | alternateReverse`.

**Precedent.** After Effects' `loopIn` / `loopOut('cycle' | 'pingpong' | 'offset' | 'continue')` — exactly
`repeatAt` + `direction`; it has no `reverse` either. A reversed first repetition would be a jump: the segment was
authored forward and the loop repeats what was authored.

**Options.** Keep the subset; the words already match (`normal` / `alternate`). Add one line to the per-property
loop doc saying why `reverse` has no inner meaning.

---

## Part C — Player API and component props

### C1. React `play` prop — easily confused with running / not-paused

> ideally it should be isPlayerEnabled={true/false} instead of "play"

**Today.** `play: boolean` performs start / stop (per `actions`), `pause: boolean` freezes on top — the CSS model
(`animation-name` applied × `animation-play-state`). The confusion has a cause: the handle's `play()` is a one-shot
COMMAND, the prop is a LEVEL, and they share a word.

**Precedent.** React's controlled booleans are state adjectives: `checked`, `open`, `muted`, `disabled`. `<video>`
has `autoPlay` and imperative `play()`. react-lottie: `isStopped` + `isPaused`. Three.js: `enabled` + `paused` as
two independent flags. lottie-react, dotlottie-react, Rive: `autoplay` plus a ref — no controlled level at all.

**The rule (owner, 2026-11-04).** A driver prop starts with its verb — `play…` plays, `show…` shows a frame — so
`active`, first proposed here, is out: it says nothing about playing. What is left to remove is only the one-shot
reading of `play`, the handle's `play()`.

**Options.**
1. `playWhile={hovered}` + `pauseWhile={!inView}` — "while" is a level by construction (as long as the condition
   holds); both start with their verb, both compose, and Framer Motion's `whileHover` / `whileInView` make the shape
   familiar to React developers.
2. Keep `play` + `pause` — the WHY in the code stands; the fix is one doc sentence: the prop is a level, the method
   is the command.
3. `playing` + `paused` — adjectives, but set together they read as a contradiction, and `playing={false}` has to
   mean stop rather than pause.
4. `playEnabled` + `pause` — "enabled" is about permission, not motion, and the pair stops matching.

Rejected: `playOn` and `playWhen` read as event binding (the triggers' territory); `playIf` as a one-time check at
mount; `isPlayerEnabled` — the player is always enabled, and `is…` prefixes are component-library style, not React's.

**Decision (owner, 2026-11-04).** `playWhile` / `pauseWhile`, AND a new `playState` prop beside them —
`'idle' | 'playing' | 'paused'`, the values of `PxPlayState` a host can ask for (`idle` performs the file's stop
action, `paused` freezes) — so both forms can be tried once implemented. A state word cannot be composed from two
independent sources the way the booleans can (`playWhile={hovered} pauseWhile={!inView}`), which is why both exist;
setting `playState` together with `playWhile` / `pauseWhile` is a usage conflict, reported like the other control-prop
conflicts (`resolveControlMode`).

```tsx
<SvgAnimationPlayer doc={ball} playWhile={hovered} pauseWhile={!inView} />
<SvgAnimationPlayer doc={ball} playState={hovered ? 'playing' : 'idle'} />
```

### C2. `doc` / `src` — full words, one attribute?

> consider document / source … maybe one attribute: `document: {} | string`

**Today.** Web: `src` (URL) and `doc` (object); React: `doc` only (loading is the app's job, review §16). `doc`
because `document` shadows `window.document` in the files that also query it.

**Precedent.** Two props is the norm: lottie-web `path` + `animationData`, dotLottie `src` + `data`, Rive `src` +
`buffer`. No library takes a `string | object` union — a string cannot be told apart as a URL or inline JSON text.
And `source` is TAKEN in our own schema: every effect's `source` is an `#id` reference.

**Options.**
1. Keep `doc` + `src`. `doc` is an everyday abbreviation (MongoDB, Firestore, Yjs, ProseMirror), the type is
   `PxDocument`, `src` is the web's word for a URL.
2. `document` + `src`, with the shadowing handled inside the package by destructuring as `{ document: doc }` — a
   full word for users, a rule for maintainers.
3. One union prop — rejected: ambiguity, no precedent, worse types.

### C3. `PxDocumentInput` — confusing name

**Today.** `PxWidenJsonImport<PxDocument>`: the shape a `.json` import has — literals widened to `string`, tuples to
arrays — so `import ball from './ball.json'` passes into `doc` with no cast. The name says "input", not "JSON".

**Precedent.** lottie-web `animationData: any`; dotLottie `data: Record<string, unknown> | …`. Nobody else types the
document; the problem is TypeScript's JSON widening, which every typed library meets.

**Options.**
1. `PxDocumentJson` — what it is.
2. Flip the roles: the wide type becomes THE public `PxDocument`; the literal-typed one is `PxDocumentStrict`
   (`@advanced`, for code that builds documents). One name for users, the narrow one only where autocomplete pays.
3. Keep.

### C4. `destroy()` — is there an internal "destroyed" flag?

**Today.** Yes, a private `destroyed` in the web player (guards `onReady` and a late `src` load); nothing reads it
from outside. The handle has `isReady()` and `isPlaying()` only; `PxPlayState` (`stopped` · `playing` · `paused` ·
`finished`) is never returned.

**Precedent.** WAAPI `playState` (+ `replaceState: 'removed'`), SVGator `state` (`playing` · `paused` · `ended` ·
`rollback`), dotLottie `isPlaying` / `isPaused` / `isStopped` / `isFrozen` / `isLoaded`, GSAP `kill()` then
`isActive()` false.

**Options.**
1. `getPlayState(): PxPlayState` with `destroyed` added (and `idle` for `stopped`, B3); calls after `destroy()` are
   no-ops with a `usage` diagnostic. `isReady()` / `isPlaying()` stay as conveniences.
2. `isDestroyed(): boolean` only.

### C5. What is `PxDiagnostic` for?

A structured channel instead of console strings: `{ code, kind, data, message }` — `code` a permanent number,
`kind` who can act (`document` · `host` · `platform` · `usage` · `internal`), `data` the values the site had. The
TEXT lives on the codes page, not in the bundle. Surface: `onWarn`, `onError`, `suppressWarnings`,
`suppressErrors`. Precedent: React's minified errors and Angular's `NG0xxx` ship a code and a docs URL for the same
two reasons — size and a stable number to switch on. dotLottie has a `loadError` event, lottie-web only the console.
Nothing to change.

### C6. What is `onSvgAnimationPlayersChange()` for?

The page-wide registry's subscription: `add` / `remove` / `play` / `pause` / `reset` / `finish` for every player in
the window, whoever created it — a devtools panel, a test, "pause everything while the tab is hidden", the website's
animation monitor. Precedent for the registry: lottie-web `getRegisteredAnimations()`, WAAPI `document.getAnimations()`,
GSAP `globalTimeline.getChildren()`; none has change events. Keep it experimental; the subscription is the part to
drop if it never finds a second user.

### C7. `unknown` instead of `any` in the schema's TS rendering

`unknown` is the honest type for values the player never looks inside — `meta`, pass-through attributes: the reader
must narrow before use, where `any` lets them call methods and crash. The runtime schema uses `px.any()` for the same
slots (accept anything, validate nothing). Keep; one sentence in the format doc explains it.

---

## Part D — Suggested order

Each wire change is its own schema step with the exact `up` / `down` where one exists.

1. **Time model** (A1–A3, A5, agreed): `playSpeed` replaces `playDuration`; the handle's `play` family
   (`get/setPlaySpeed`, `get/setPlayDuration`, `getTotalPlayDuration`, `getCurrentPlayTime`); the plain position
   inside the iteration with `get/setTotalTime`, `getTotalDuration` and `getCurrentIteration` for the run; `retime` gets
   `offset` / `inTime` / `outTime`; the one-sentence rule in the docs.
2. **Triggers** (B2, agreed): absent ≡ `{}` ≡ manual; autoplay always written as `start: 'load'`; the step writes
   it into stamped files without the block.
3. **Words** (A4, B1, B3, B4): `jumpToEnd`, `whenIdle` + `PxPlayState.idle`, `clone.omit`.
4. **Handle** (C4): `getPlayState()` with `destroyed`.
5. **Props and types** (C1, C3, agreed): `playWhile` / `pauseWhile` plus the `playState` prop, `PxDocumentJson`.

## Implementation surface of the time family

Every name in the A1 family is in the tables above; this is where each has to land so nothing is half done.

| Surface | Files | What changes |
|---|---|---|
| the one handle type | core `format/PxAnimatorTypes.ts` — `PxAnimationPlayerApi` (web, React, Vue and React Native all expose this one interface; `bind` returns it too) | the renamed, the new and the re-meant members, each with its doc line |
| the js engine | core `playback/PxFrameLoop.ts`, `PxPlaybackTime.ts`, `PxDeclarativePlayback.ts` | per-iteration `currentTime` / `progress`, `totalTime`, `currentIteration`; `alternate` runs the iteration backwards |
| the native engine | web `engines/PxAnimatorWebApi.ts`, `PxAnimatorBind.ts` | WAAPI's `currentTime` is across the run: derive iteration and position from it; the `playDuration` factor goes, `playSpeed` replaces it as the initial rate |
| the web player | web `animator/PxAnimator.ts`, `shared/PxAnimatorCallbacks.ts` | the queued-call list (`setPlaybackRate` → `setPlaySpeed`, the new members) |
| the components | react, vue, rn `SvgAnimator` | `showAtTime` / `showAtProgress` per iteration; `timelineOptions.playSpeed` |
| the wire | core `PxAnimatorTypes.ts`, `PxAnimatorConstants.ts`, `version/PxWireVersion.ts`, `PxSchemaVersion.ts` | `playSpeed` for `playDuration`, exact `up` / `down`; `schema-release.mjs --apply`; the field-universe snapshot |
| docs, checked by `docs-check` | `docs/library/{web-player,react,vue,react-native,playback-and-triggers,troubleshooting,README}.md`, `docs/format/README.md` | the signature blocks and the time-axes table → the one sentence; the build fails until they match |
| examples | `examples/docs-examples` (`web/programmatic`, `e2e/cases.spec.ts`), `examples/preview-player` (web, react, vue players), `examples/react-native-preview-player` | call sites |
| the editor (kf), same pass | `src/kf/common/test/PlayerClock.ts`, `VscPreviewApp.ts`, `action/TestPlayVscAction.tsx`; the editor's `playDuration` field and its wire key; fixtures restamped | call sites, the Play Duration field writing `playSpeed` |
| videos | `learn-react-apiref`, `learn-web-api`, `learn-ui-hover` (generated projects call the handle) | regenerate and re-record |

Nothing is left open: `resume` stays on the wire (owner, 2026-11-04).
