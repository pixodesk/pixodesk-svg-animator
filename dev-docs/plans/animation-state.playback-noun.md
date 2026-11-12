# Playback as the noun — rename plan (schema 1.25)

**Status: the noun is implemented (schema 1.25); the flat spellings are SUPERSEDED.** The owner chose (2026-11-12)
one object `player.playback.*` and dotted action names (`"playback.start"`) before any commit — the final words are in
[animation-state.playback-namespace.md](./animation-state.playback-namespace.md). Read §3, §4 and §6 below as the
first, flat pass (`startPlayback()`, `actionTriggers.startPlayback`); the reasoning for the noun (§1, §2) stands.
Follows [animation-state.brainstorm.md](./animation-state.brainstorm.md) (the 1.24 run model, shipped in the repo,
unpublished) and uses the state block of [playback-layers.md](./playback-layers.md).
Owner decisions already taken: the rest state stays **`off`**; **`returning`** stays a handle readout only;
**`atEnd`** is not touched.

## 1. Why

The owner's doubts about **run** (the 1.24 noun): read as a verb; its noun sense is idiomatic and hard for
non-English readers; not an animation or video word; "running" ≈ "playing" (WAAPI `playState: 'running'` means
playing). Candidates compared: run · session · track · clip · animation · playthrough · playbackRun · animationRun ·
playbackSession · animationSession.

**Playback** wins because:

| fact | consequence |
|---|---|
| "start / stop / pause / resume playback" are the phrases on every media UI | non-English readers get it for free; stop ≠ pause is already known, which is exactly the two-level model (lifecycle vs transport) |
| it is a state noun: `playback: playing` is a readout, like `segment: loop`, `view: visible` | fits the `timeline.state` variable slot of the layered design, which already names it `playback` ("playback, not animation", its naming note) |
| the API already says it: `getPlaybackSpeed`, `getPlaybackDuration`, "PLAYBACK ms"; the Editor has Playback settings, `PlaybackPresets`, `playbackSpeed` | `getPlaybackState()` sits beside names that exist |
| two web standards name this axis with "play": WAAPI `playState`, Media Session `playbackState` (`none · paused · playing` = our lever) | a name web developers meet elsewhere |
| no collisions | unlike **animation** (React DOM `onAnimationStart/End`, `definitions.animations`, `animate`) and **run** (the layered rules' `run:` field and `run('action')` = execute an action) |
| "playback" is already an occurrence noun ("each playback", analytics count "playbacks") | the instance needs no second word; `startPlayback` / `stopPlayback` are complete sentences where `startRun` is not |

Ranking: 1 playback · 2 playbackRun · 3 run · 4 animationRun · 5 animation · then activate/deactivate, playbackSession,
session, animationSession, playthrough, cycle/pass, performance, track, clip, take/showing. Compounds were rejected as a
qualifier paid at every call site and in every rule: `playbackRun` is three words where media UIs use two, and the
suffix distinguishes nothing.

## 2. Glossary

- **Playback** — one instance of the animation in effect, from `startPlayback` until it is stopped or retired
  (`atEnd: jumpToStart` / `animateToStart`). Countable: "the second playback of the intro". Its state: **`off` ·
  `playing` · `paused` · `finished`**; the handle adds `returning` (an `animateToStart` in flight) and `destroyed`.
- **Playback ms** — the speed-adjusted time axis (`getPlaybackDuration`, `getCurrentPlaybackTime`, …) keeps its name;
  "the whole playback in playback ms" (`getTotalPlaybackDuration`) reads right.
- `play()` / `pause()` stay the documented aliases (play = start or resume).

## 3. The rename, by surface

> Superseded 2026-11-12: the handle is `player.playback.start()` … and the file keys are `"playback.start"` … —
> [animation-state.playback-namespace.md](./animation-state.playback-namespace.md) §2–§3.

| surface | 1.24 | 1.25 | unchanged |
|---|---|---|---|
| handle | `startRun` `stopRun` `pauseRun` `resumeRun` · `runOnce` · `getRunState` `isRunActive` | `startPlayback` `stopPlayback` `pausePlayback` `resumePlayback` · `playOnce` (its name until 1.23 — the 1.24 rename only followed the noun) · `getPlaybackState` `isPlaybackActive` | `play` `pause` `jumpToStart` `jumpToEnd` `isPlaying`, every getter/setter |
| callbacks | `onRunStart` `onRunStop` `onRunPause` `onRunResume` | `onPlaybackStart` `onPlaybackStop` `onPlaybackPause` `onPlaybackResume` | `onReady` `onFinish` `onDestroy` `onWarning` `onError` |
| registry events | `runStart` `runStop` `runPause` `runResume` | `playbackStart` `playbackStop` `playbackPause` `playbackResume` | `finish` |
| types | `PxRunState` `PxStartRunBehavior` `PxStopRunBehavior` `PxPlayRun` `PxRunListeners` `PxTriggerList.startRun…` `PxEngineCallbacks.runListeners` | `PxPlaybackState` `PxStartPlaybackBehavior` `PxStopPlaybackBehavior` `PxPlayback` `PxPlaybackListeners` `PxTriggerList.startPlayback…` `PxEngineCallbacks.playbackListeners` | `PxAtEndBehavior` `PxOutOfViewBehavior` `PxTriggerEvent` |
| component prop (React · Vue · RN) | `playRun` | `playback` (`'off' \| 'on' \| 'paused'`, same diff rule) | `playUsingActionTriggers` `showAtTime` `showAtProgress` `timelineOptions` `actions` `playerRef` |
| wire | `actionTriggers.{startRun, stopRun, pauseRun, resumeRun}` · `actions.{startRun, stopRun}` | `actionTriggers.{startPlayback, stopPlayback, pausePlayback, resumePlayback}` · `actions.{startPlayback, stopPlayback}` | `actions.outOfView` `atEnd` `whenIdle` `playbackSpeed` `inViewThreshold` `inViewDebounce` |
| later layers | — | `state.playback` variable, values `off · playing · paused · finished` (the layered design's name; its `stopped` becomes `off`) | `state.segment`, custom variables, `stateValues` |
| diagnostics | PX1505 lists the run words | lists the playback words | codes |
| Editor | labels Start run on · Stop run on · Pause run on · Resume run on; actions Start run · Stop run; test ids `….animation.startRun.startRun.<option>`; `PlaybackPresets` fields `startRun/stopRun/pauseRun`; presets JSON; `triggerRows`; `pureCssTriggers`; export labels | Start playback on · Stop playback on · Pause playback on · Resume playback on; Start playback · Stop playback; `….animation.startPlayback.startPlayback.<option>`; fields renamed alike | At end · Out-of-View Action; `startBehavior/stopBehavior/finishBehavior` action test ids |
| words in prose | "run", "a run of the animation" | "playback", "a playback" | — |

## 4. Example

Handle:

```ts
player.startPlayback();  player.stopPlayback();  player.pausePlayback();  player.resumePlayback();
player.play();  player.pause();                 // aliases
player.playOnce();                              // one pass whatever `iterations` says
player.jumpToStart();  player.jumpToEnd();
player.getPlaybackState();                      // 'off' | 'playing' | 'paused' | 'finished' | 'returning' | 'destroyed'
player.isPlaybackActive();  player.isPlaying();
player.getPlaybackSpeed();  player.setPlaybackSpeed(2);  player.getTotalPlaybackDuration();  …   // as today
// callbacks: onReady · onPlaybackStart · onPlaybackStop · onPlaybackPause · onPlaybackResume · onFinish · onDestroy · onWarning · onError
// later (layer 3), if imperative sugar is wanted: player.startPlayback({ segment: 'intro' })
```

React (Vue and React Native carry the same names):

```tsx
<SvgAnimationPlayer
  doc={lid}
  playback={hovered ? "on" : "off"}            // off→on startPlayback · on→paused pausePlayback · paused→on resumePlayback · →off stopPlayback
  actions={{ stopPlayback: "animateToStart" }}
  onPlaybackStart={() => setBusy(true)}
  onPlaybackStop={() => setBusy(false)}
  playerRef={api}
/>
api.current?.pausePlayback();
// later: <SvgAnimationPlayer doc={hero} playback="on" stateValues={{ segment: "loop" }} />  ·  api.current?.run("close")
// ("run" stays the verb for executing a custom action — no noun clash once the instance is "playback")
```

Wire today (layers 0–1, schema 1.25):

```json
"animator": {
  "version": "1.25.0",
  "timeline": {
    "outTime": 400, "iterations": 1, "playbackSpeed": 1,
    "atEnd": "hold", "whenIdle": "static",
    "inViewThreshold": 0.25, "inViewDebounce": 150,
    "actionTriggers": { "startPlayback": "hoverIn", "stopPlayback": "hoverOut" },
    "actions": { "startPlayback": "continue", "stopPlayback": "animateToStart", "outOfView": "pause" }
  }
}
```

Click toggles stay lists: `"actionTriggers": { "startPlayback": "click", "pausePlayback": "click", "resumePlayback": "click" }`.

Wire later (layer 3 of playback-layers.md, same words; `atEnd` and the rest as today — how a finished segment moves on
is that design's business, not this plan's):

```json
"timeline": {
  "outTime": 5000, "iterations": "infinite", "atEnd": "hold",
  "state": {
    "playback": { "off": { "initial": true }, "playing": {}, "paused": {}, "finished": {} },
    "segment": {
      "intro": { "inTime": 0,    "outTime": 1000, "timeline": { "iterations": null } },
      "loop":  { "inTime": 1000, "outTime": 3500 }
    },
    "seen": { "no": {}, "yes": {} }
  },
  "actions": {
    "startPlayback":  { "when": { "playback": ["off", "finished"] },             "set": { "playback": "playing" }, "path": "continue" },
    "stopPlayback":   { "when": { "playback": ["playing", "paused", "finished"] }, "set": { "playback": "off" },     "path": "rewind", "completeIteration": true },
    "pausePlayback":  { "when": { "playback": "playing" },                        "set": { "playback": "paused" } },
    "resumePlayback": { "when": { "playback": "paused" },                         "set": { "playback": "playing" }, "path": "continue" },
    "firstLook": { "when": { "seen": "no" }, "set": { "playback": "playing", "seen": "yes" }, "path": "continue" },
    "playLoop":  { "set": { "playback": "playing", "segment": "loop" },  "path": "continue", "completeIteration": true },
    "close":     { "set": { "playback": "off", "segment": "intro" },     "path": "rewind",   "completeIteration": true },
    "outOfView": { "behavior": "pause" }
  },
  "actionTriggers": {
    "startPlayback": "load",
    "firstLook": "hoverIn",
    "playLoop": { "on": "click", "target": "#btn-play" },
    "close":    { "on": "click", "target": "#btn-close" }
  }
}
```

The four built-in actions are these predefined rules; a file that writes them out replaces them. `state.playback` is what
`getPlaybackState()` reads and the `playback` prop drives; `stateValues` carries every other variable.

## 5. Schema step 1.25 (per [versioning.md](../versioning.md))

1. Bump `PX_WIRE_SCHEMA_VERSION`; `PX_WIRE_STEPS` entry with `converted` + `up` renaming the six keys
   (`actionTriggers.*Run` → `*Playback`, `actions.startRun/stopRun` → `startPlayback/stopPlayback`); no `down`.
2. Build the core; `node scripts/schema-release.mjs --apply` (field snapshot, release record, `SCHEMA.json`); move the
   version literals it breaks (`PxSchemaRelease` self-test, `PxPrepareDocument` fixture); `mangle-reserved.json` regenerates.
3. kf: convert only files stamped **1.24.x** (older stamps stay for the read-time chain) — the 1.24 converter
   `app/tools/convert-json-1-24.py` is the template (minified stays minified; hand-formatted JSON through the
   layout-keeping text rule); restamp the `.ts`-embedded fixtures (`effect.retime.nested.*`) and the `01-app-lifecycle/.data`
   files; regenerate the field universe, settle the explorer cases, regenerate preset scenes, website examples and the
   text-path oracle baseline; refresh the inline snapshots that embed `data-px-meta`.
4. `pnpm build` (docs-check, get-started examples) and `pnpm check:docs`.

## 6. Checklist (the 1.24 pass, repeated with the new words)

- [x] Player: core constants/types/schema + 1.25 step; web (`animator/`, `engines/`, `triggers/`, `registry/`,
      PX1505 text); react · vue · rn props and callbacks; tests (core 802 · web 219 · react 70 · vue 50 · rn 42); `pnpm build`
      green (docs-check 170, docs-examples 24, get-started 8/8). The 1.25 step test was seen failing without the step.
      docs-check's mark lookup now matches whole names (`PxPlayback` had matched `` `PxPlaybackListeners` (○) ``).
- [x] Player docs: `docs/library/*`, `docs/format/README.md`, `docs/diagnostics.md` (regenerated), package READMEs,
      examples (incl. the RN explorer fixtures), dev-docs "since 1.24–1.25" notes; the brainstorm got one History line
      (its body and the print HTML are untouched). Noun "run" → "playback" in comments and docs; other senses (text
      runs, a pipeline run, `run.repairs`, the engine's `PxRunClock`) kept.
- [ ] Editor: code (`PlaybackPresets`, `TExportConfig`, `ExportSvgContent`, `SvgTriggerFields`, `SvgSvgAnimationAttrs`,
      `triggerRows`, `Types.ts`, `VscPreviewApp`, preview player `content.ts`, `FrameSvgSource`), presets JSON, specs and
      fixtures (step 5.3), atests (`2da--(exportSvga…)`, `preview-basic-…JsTrigger`; keep their flags, add a comment),
      `file-format.md`, `manual-testing.md` §7; typecheck at the 7 known errors; relevant specs, then the full unit run
      and the e2e Play-All, like 1.24.
- [ ] Website: editor pages (`015-quick-start`, `175-playback-settings`, `animation/140-animation`), `yarn website:svga-docs`,
      `yarn website:real-ui`, `videos.ts` anchors, `public/` file-format examples; `yarn build` green.
- [ ] Learning projects (`hello-react`, `hello-web`, cheatsheet, changes page) and their JSON.
- [ ] Learn-video generator: trigger objects and narration ("start playback on hover"); regenerate the affected projects;
      videos re-recorded by the owner (`yarn website:videos`).
- [ ] Report `app/docs/testing/test-run.<date>.md`; skills (`player-repo`, `e2e-tests`, `svga-format-schema`,
      `editor-app`) and memory updated; every process I started stopped.

## 7. Not in this plan

- `atEnd` stays exactly as in 1.24 (owner). The layered design's `finish` rules and `triggers` name are reconciled with
  `atEnd` / `actionTriggers` when layer 2 is designed, not here.
- `off` stays the rest state (owner); `returning` is a handle readout, not a file value (owner agreed).
- `startPlayback({ segment })` is layer-3 sugar, later.
- Electron and the unified preview player follow after npm publish + the kf bump, as with 1.24.

## 8. Agreed on paper for the later layers (owner, 2026-11-11)

> The flat handle of this section was replaced by `player.playback.*` on 2026-11-12 (namespace plan §2); the layer
> decisions stand.

| decision | shape | why |
|---|---|---|
| **Flat handle** | `player.startPlayback()`, never `player.playback.start()` | one spelling for one act: the file's action name = the handle method = `run('startPlayback')`; the seven existing `*Playback*` getters stay where they are; transport verbs are flat in HTMLMediaElement, WAAPI, lottie-web. A namespace only for a collection one queries (`player.segments.current`), never for an act |
| **One playback per link** | a chain of segments/pages: each link is its own playback — start → `playing` → `finished` (rests, `atEnd` as today) → the next trigger starts a fresh playback | `finished` means "this link ended, waiting for Next"; `onFinish` ends a link, `onPlaybackStop` only on a stop or when Next cuts a playing link (then stop + start, so counts stay exact — to confirm) |
| **No session object** | the chain is flat: `state.playback` · `state.segment` · later `state.page` are sibling variables; rules move them (`finish`, Next) | one clock per player (accepted limit: independent parts = two players until layer 5); media APIs put playback on the player and the chain beside it; "session" is a span, not content, and `mediaSession` is something else |
| **Lever re-applies** | `playback="on"` + a segment change starts the new link; `off` moves the window and shows the rest pose; `paused` holds its first frame | the same diff rule with one more input |
| **Chain actions** | built-ins `nextSegment()` / `previousSegment()` / `jumpToSegment(name)`; rule `{ set: { segment: <next>, playback: 'playing' }, path: 'jump' }` | the media words next/previous; `jumpTo…` is the existing "at once" verb; `goTo` would be a new verb. "Next" needs a declared order (a `next` field per segment or a list), never key order |
| **Key triggers** | `"nextSegment": [ { "on": "key", "code": "ArrowRight" }, { "on": "key", "code": "Space" } ]` | arrays already allowed (`PxTriggerEvents`); an object per event, as `{ on, target }` — no mini-language in strings (`"key:ArrowRight"` rejected, like `"playBtn:click"` before). `code`, because the space bar's `key` is `" "`. Needs a `target` (document vs focused player) and a rule for swallowing the browser default |

## 9. History

- 2026-11-11: the owner's doubt about "run"; the ten candidates compared on handle, props, wire and the `timeline.state`
  block; playback chosen on paper; owner fixed `off`, `returning`, `atEnd`; this document. No code touched.
- 2026-11-11, later: chains and segments talked through (§8) — flat handle, one playback per link, no session object,
  next/previous/jumpTo, key triggers as objects. Still no code touched; `playOnce()` (§3) awaits the owner's word.
