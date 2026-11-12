# The playback namespace — `player.playback.*` and dotted action names

**Status: owner's go 2026-11-12 — implemented (§6, all phases; nothing committed).**
Follows [animation-state.playback-noun.md](./animation-state.playback-noun.md) (the 1.25 flat rename `…Run` → `…Playback`),
and reopens its §8 row "Flat handle".

**Where the working tree is** (all uncommitted): the flat 1.25 rename is applied in the player (tests and `pnpm build`
green), the editor (typecheck at the 7 known errors; full unit run 4,121 passed + 76 sequential, 5 stale-fixture
failures not yet fixed), the website pages and the learning material. The e2e run and the website build have not run.
This proposal changes that work before it is committed.

## 1. The change in one table

| surface | 1.25 flat (working tree) | proposed |
|---|---|---|
| handle: every method except the player's lifecycle (27 move, 2 aliases go) | `player.startPlayback()` · `player.getCurrentTime()` · `player.play()` … | `player.playback.start()` · `player.playback.getCurrentTime()` …; the `play()` / `pause()` aliases removed (§2) |
| file: built-in action names (6 keys) | `actionTriggers.startPlayback`, `actions.stopPlayback` … | `actionTriggers["playback.start"]`, `actions["playback.stop"]` … (§3) |
| everything else | — | unchanged (§4) |

Why: 13 handle methods carry "Playback"; a namespace turns them into the plain media verbs, gives every act one home
and one spelling, and leaves room for sibling namespaces (`player.segment.*`). In the file the same
names are entries of a registry of actions, not fields of a structure, so a namespaced name is the VS Code settings
pattern (`"editor.fontSize"`), and the dot reserves a shape for built-ins that a custom action name (layer 2) can never
collide with. File name = handle path = state variable: `"playback.start"` ↔ `player.playback.start()` ↔ `timeline.state.playback`.

## 2. The handle — every method, where it goes, what it does

**The rule (owner, 2026-11-12): one home.** Everything a page does to the animation is on `player.playback`; the player
itself keeps only its own lifecycle. No aliases: each act has one spelling.

### 2.1 `player.playback` — the whole family

| group | 1.25 flat | proposed | what it does (unchanged behaviour) |
|---|---|---|---|
| buttons | `startPlayback()` | `playback.start()` | Lever 1 on. From `off` or `finished`: begins a playback per `actions["playback.start"]` (`continue` from the rest pose · `jumpToStart` from the beginning always · `jumpToEnd` the end pose, then `atEnd`). While `playing`: `continue` does nothing, `jumpToStart` restarts. While `paused`: unfreezes. While `returning`: turns around. Reports `onPlaybackStart` |
| | `stopPlayback()` | `playback.stop()` | Lever 1 off. Retires the playback per `actions["playback.stop"]` (`jumpToStart` at once · `animateToStart`, the `returning` state · `jumpToEnd` · `animateToEnd` after the current pass); clears a freeze. Reports `onPlaybackStop` (on arrival for `animateToEnd`). A no-op when `off` or already returning |
| | `pausePlayback()` | `playback.pause()` | Lever 2 on. Freezes the playback where it is, only while `playing`. Reports `onPlaybackPause` |
| | `resumePlayback()` | `playback.resume()` | Lever 2 off. Continues from the frozen frame, only while `paused`. Reports `onPlaybackResume` |
| | `playOnce()` | `playback.playOnce()` | One fresh pass from the start whatever `iterations` says; re-entrant (a call mid-pass restarts); the end follows `atEnd`. Reports `onPlaybackStart` |
| state | `getPlaybackState()` | `playback.getState()` | The one state read: `off` · `playing` · `paused` · `finished` · `returning` · `destroyed` (`PxPlaybackState`) |
| | `isPlaybackActive()` | `playback.isActive()` | A playback exists: `playing` · `paused` · `finished` |
| | `isPlaying()` | `playback.isPlaying()` | `getState() === 'playing'` — the clock moves |
| playhead moves | `jumpToStart()` | `playback.jumpToStart()` | To the rest pose now; `actions` not consulted; reports nothing (like a seek); clears a freeze |
| | `jumpToEnd()` | `playback.jumpToEnd()` | The end pose, no motion; arriving runs `atEnd` and fires `onFinish` |
| | `setCurrentTime(ms)` | `playback.setCurrentTime(ms)` | Seeks inside the current iteration, content ms clamped to `[0, getDuration()]`. Paused, it shows that frame and stays |
| | `setCurrentProgress(p)` | `playback.setCurrentProgress(p)` | The same seek as 0–1 of the iteration |
| | `setTotalTime(ms)` | `playback.setTotalTime(ms)` | Seeks on the whole playback, content ms clamped to `[0, getTotalDuration()]` |
| content time | `getDuration()` | `playback.getDuration()` | Content ms of one pass (`outTime − inTime`), as WAAPI's `duration`. `null` before ready |
| | `getTotalDuration()` | `playback.getTotalDuration()` | The whole playback, content ms: one pass × iterations. `null` when endless |
| | `getCurrentTime()` | `playback.getCurrentTime()` | The frame on screen: content ms inside the current iteration |
| | `getCurrentProgress()` | `playback.getCurrentProgress()` | The same position as 0–1 |
| | `getCurrentIteration()` | `playback.getCurrentIteration()` | Which pass is playing, 0-based |
| | `getTotalTime()` | `playback.getTotalTime()` | The playhead on the whole playback, content ms; 0 while the delay waits |
| | `getTotalProgress()` | `playback.getTotalProgress()` | The playhead as 0–1 of the whole playback. `null` when endless |
| speed | `getPlaybackSpeed()` | `playback.getSpeed()` | The speed factor: 1 normal, 2 double, 0.5 half, negative backwards. Starts at the file's `timeline.playbackSpeed` |
| | `setPlaybackSpeed(speed)` | `playback.setSpeed(speed)` | Changes the speed. 0 or a non-finite value is rejected with a warning |
| time at the current speed | `getPlaybackDuration()` | `playback.getDurationAtSpeed()` | One pass in real ms at the current speed: `getDuration() / \|speed\|` |
| | `setPlaybackDuration(ms)` | `playback.setDurationAtSpeed(ms)` | The speed knob as a length: sets the speed so one pass takes `ms` |
| | `getTotalPlaybackDuration()` | `playback.getTotalDurationAtSpeed()` | The whole playback at the current speed: `getTotalDuration() / \|speed\|`. `null` when endless |
| | `getCurrentPlaybackTime()` | `playback.getCurrentTimeAtSpeed()` | The playhead inside the iteration at the current speed: `getCurrentTime() / \|speed\|` |
| | `getTotalPlaybackTime()` | `playback.getTotalTimeAtSpeed()` | The playhead on the whole playback at the current speed: `getTotalTime() / \|speed\|` |

**Why the last five need a word.** There are two clocks with the same five names: content time and time at the
current speed. Flat, the word "Playback" told them apart (`getDuration()` vs `getPlaybackDuration()`); inside the
namespace that word is the namespace, so `playback.getDuration()` can mean only one. The plain names go to content
time (the common ones: sliders, WAAPI's and GSAP's words); the five rarer reads take a suffix, which also puts each
beside its twin in autocomplete (`getDuration`, `getDurationAtSpeed`).

### 2.2 Removed — no aliases (owner, 2026-11-12)

| removed | write instead |
|---|---|
| `play()` | `playback.start()`. It already unfreezes a paused playback under the default `continue`; the exact old meaning is `playback.getState() === 'paused' ? playback.resume() : playback.start()` |
| `pause()` | `playback.pause()` |

### 2.3 Stays on `player`

`isReady()` · `getRootElement()` · `destroy()` — the player's own lifecycle. The component handle (`playerRef`) omits these
three as today, so it is `{ playback }`.

### 2.4 The type

```ts
/** `player.playback` — everything a page does to the animation. @public */
export interface PxPlaybackControls {
    start(): void;  stop(): void;  pause(): void;  resume(): void;  playOnce(): void;
    getState(): PxPlaybackState;  isActive(): boolean;  isPlaying(): boolean;
    jumpToStart(): void;  jumpToEnd(): void;
    getDuration(): number | null;         getTotalDuration(): number | null;
    getCurrentTime(): number | null;      setCurrentTime(ms: number): void;
    getCurrentProgress(): number | null;  setCurrentProgress(progress: number): void;
    getCurrentIteration(): number;
    getTotalTime(): number | null;        setTotalTime(ms: number): void;   getTotalProgress(): number | null;
    getSpeed(): number;                   setSpeed(speed: number): void;
    getDurationAtSpeed(): number | null;  setDurationAtSpeed(ms: number): void;
    getTotalDurationAtSpeed(): number | null;
    getCurrentTimeAtSpeed(): number | null;  getTotalTimeAtSpeed(): number | null;
}
export interface PxAnimationPlayerApi<TRoot = unknown> {
    readonly playback: PxPlaybackControls;
    isReady(): boolean;  getRootElement(): TRoot | null;  destroy(): void;
}
/** The component handle: `playerRef.current?.playback.start()`. */
export type PxAnimationPlayerHandle = Pick<PxAnimationPlayerApi, 'playback'>;
```

- `playback` is ONE object per player, the same on every read, made of closures: `const { playback } = player` and
  `const { start } = player.playback` both work.
- It exists from creation, so calls before ready queue as today (`PxAnimator.ts`), and after `destroy()` they are no-ops.
- React / Vue / RN share the type, so the three cannot drift.
- Internal `PxPlayExecutor` keeps its flat names (`startPlayback()` …): it IS the playback's executor, one object, not public.

## 3. The file — built-in action names

| block | 1.24 | 1.25 flat (working tree) | proposed |
|---|---|---|---|
| `actionTriggers` | `startRun` · `stopRun` · `pauseRun` · `resumeRun` | `startPlayback` · `stopPlayback` · `pausePlayback` · `resumePlayback` | `"playback.start"` · `"playback.stop"` · `"playback.pause"` · `"playback.resume"` |
| `actions` | `startRun` · `stopRun` | `startPlayback` · `stopPlayback` | `"playback.start"` · `"playback.stop"` |
| `actions.outOfView`, `atEnd`, `whenIdle`, `playbackSpeed`, the gate numbers | — | — | unchanged |

```json
"timeline": {
  "outTime": 400, "atEnd": "hold",
  "actionTriggers": { "playback.start": "hoverIn", "playback.stop": "hoverOut" },
  "actions": { "playback.start": "continue", "playback.stop": "animateToStart", "outOfView": "pause" }
}
```

**The rule (one sentence for `docs/format`):** a dot marks a built-in action name, spelled `<state variable>.<verb>`;
every other key of the format is camelCase; a namespace alone (`"playback"`) is never an action name; a custom action
name (layer 2) contains no dot.

**One act, every spelling:**

| file (lists and slots) | handle | callback | registry / Vue event | Editor label |
|---|---|---|---|---|
| `"playback.start"` | `player.playback.start()` | `onPlaybackStart` | `playbackStart` | Start playback on · Start playback |
| `"playback.stop"` | `player.playback.stop()` | `onPlaybackStop` | `playbackStop` | Stop playback on · Stop playback |
| `"playback.pause"` | `player.playback.pause()` | `onPlaybackPause` | `playbackPause` | Pause playback on |
| `"playback.resume"` | `player.playback.resume()` | `onPlaybackResume` | `playbackResume` | Resume playback on |

**In code:**

- From JavaScript the six names need quotes: `actions={{ "playback.stop": "animateToStart" }}`,
  `playUsingActionTriggers={{ "playback.start": "click" }}`, `timelineOptions={{ actionTriggers: { "playback.start": "load" } }}`.
- The names live ONCE, in `PxTriggerList` (and `PxTriggerAction`): the member names stay identifiers
  (`PxTriggerList.startPlayback`), the values become the dotted names. The schema objects and every reader take the
  key from there (`{ [PxTriggerList.startPlayback]: triggerListSchema(…).optional() }`, `triggers[PxTriggerList.startPlayback]`).
- **Dotted names exist only at the wire.** The resolved view (`resolveActions`, `resolveTriggers`, the runtime config,
  the Editor's `PlaybackValues`) keeps its identifier fields, so engines, the executor and the exported CSS trigger
  script are untouched.
- Later (layer 2): `player.run("playback.start")` ≡ `player.playback.start()`; `player.segment.next()` ↔ `"segment.next"`.

## 4. Unchanged

- Props: `playback="off" | "on" | "paused"` and its diff rule, `playUsingActionTriggers`, `showAtTime`, `showAtProgress`,
  `timelineOptions`, `actions` (only their KEYS take the dotted names), `playerRef`.
- Callbacks `onPlaybackStart/Stop/Pause/Resume`, `onFinish`, `onReady`, `onDestroy`; registry and Vue events.
- Type names (`PxPlaybackState`, `PxStartPlaybackBehavior`, `PxStopPlaybackBehavior`, `PxPlayback`, `PxPlaybackListeners`),
  state values, behaviour words, `atEnd`, `outOfView`, diagnostic codes (their texts name the new methods).
- Editor labels, presets' meaning, the state machine.

## 5. Accepted limits

| limit | size |
|---|---|
| quotes around the six names in JavaScript object literals | small; in JSON every key is quoted anyway |
| two key styles in one format | one stated rule (§3) |
| printed paths read as nested (`actionTriggers.playback.start` in a validation message, the field inventory) | cosmetic; findings keep a structured path |
| stores that treat a dot in a field name as a path (MongoDB, Firestore, Elasticsearch) | a host saving the document as a native object must escape or stringify it |
| lodash-style string paths (`_.get(doc, "…actionTriggers.playback.start")`) | need the array form |
| Editor test ids use a dash form of the name (`….animation.playback-start.playback-start.hoverIn`) | one helper, `testIdOfActionName()`, is the single place to change or pin them (Q6) |
| every published handle name moves without an alias (npm 1.0.54), and `play()` / `pause()` go | one table in troubleshooting (Q3, Q5) |

**`data-px-meta` (the pre-rendered SVG's inline config) — checked 2026-11-11, nothing to build.** It is JSON5, written and
read by one module (`SvgaExtendedAttrFormatUtil.ts`): `JSON5.stringify` quotes a key that is not an identifier by itself
and `JSON5.parse` reads it back, so the attribute reads `actionTriggers:{'playback.start':'load'}` — the same single
quotes its string values already use, safe inside the double-quoted XML attribute. The other readers do not look at
these keys: the players never parse the attribute; the unified preview player parses with JSON5 and uses regexes only
for `duration` and `externalJs`; the website only tests for the attribute's presence.

## 6. Implementation plan, step by step

Each step ends with its check. Nothing is committed by Claude; a wire change never runs while a full test run is going.

**Progress (2026-11-12):** Phases A–C done — core 802 · web 220 (+1: `playback` is one object, works destructured,
seen failing with a per-read object) · react 70 · vue 50 · rn 42; `pnpm build` 14/14, docs-check 171, docs-examples 24,
get-started 8/8. Beyond the plan: one core helper `forwardPlaybackControls(target, write)` builds every wrapper's
forwarding `playback` (web pre-ready queue, React / Vue / RN handles, the inert player) — four hand-written tables became
one; the executor's internal `play()` alias went with the public ones; `createAdapterSvgAnimationPlayer` returns
`PxComposedAnimationPlayerApi` (engine primitives + `playback`); docs-check reads quoted schema keys and resolves dotted
keys in tables (`propertyKey`, greedy `at`); `PxPlaybackControls` re-exported from web / react / vue / rn.

**Progress (2026-11-12, later):** Phases D–F done. Editor: tsc = the 7 known errors; full unit run 46 failures in 4
files → all fixed and re-run green (45 files, 626 tests), sequential pass 76/76; e2e Play-All 683/687 — the same 4 open
atests at their known steps (the two JsTrigger ones now stop at `playback-start.playback-start…`). One real bug of this
step: `applyPlaybackPreset` passed the RESOLVED actions view to the wire setter — the plain names matched until the keys
became dotted (the all-optional `PxActions` accepts any object sharing `outOfView`); fixed with one `wireActions()` builder,
guard seen failing. The sweep also restored the LEGACY `timeline.trigger.start` in 39 kf spec inputs that 1.24 had renamed
(checked against commit `653988578`). Website build + link check green; learning projects, cheatsheet, learn-video data
done; report `kf/app/docs/testing/test-run.2026-11-12.md`. Open: the `PxActions` type hole (owner's call); Electron and the
unified preview player after publish + bump; videos re-recorded by the owner.

**Phase A — wire names (player core)**

1. `PxAnimatorConstants.ts`: the values of `PxTriggerList` (line 99) and `PxTriggerAction` (line 794) become the dotted names.
   *Check:* `tsc` in core lists every literal-key site (expected: about 33 reads in 4 files — Constants, Types, `PxDeclarativePlayback.ts`, `PxRestPose.ts`).
2. `PxAnimatorTypes.ts`: `PxActionTriggersSchema` (line 626) and the actions schema and types declare the six keys through the constants; the public types become `{ "playback.start"?: … }`.
3. Readers and the normaliser (`resolveTriggers`, `resolveActions`, `allowedTriggerEvents`, `triggerActionFor`, the override merge in `PxAnimatorConfigPatch.ts`) read through the constants; the resolved view keeps identifier fields. *Check:* core `tsc` clean.
4. The wire step (Q1): fold into 1.25 — `PLAYBACK_KEYS_1_25` maps `startRun` → `playback.start` … — or add 1.26. Update `PxWireTriggerStep.test.ts`; see the step test FAIL with the step disabled.
5. Release record: restore `schema-field-universe.player.json`, `schema-releases.player.json` and `SCHEMA.json` to HEAD (the 1.25 record written today names the flat keys), build core, `node scripts/schema-release.mjs --apply`. *Check:* the record lists the six dotted fields added, the six `…Run` fields removed.
6. Core tests: quoted keys in literals. *Check:* `npx vitest run` in core green.

**Phase B — the handle (player)**

7. Types: `PxPlaybackControls` (`@public`), `PxAnimationPlayerApi.playback`, every flat member except the three lifecycle ones removed (incl. `play()` / `pause()`); `PxAnimationPlayerHandle` becomes `Pick<…, 'playback'>`; `PxWebApiPrimitives`' pick list follows.
8. Core `composeApiExtras` (`PxDeclarativePlayback.ts`) builds the one `playback` object from the executor and the time helpers.
9. Web: the pre-ready queue facade (`animator/PxAnimator.ts`), the scroll-timeline stubs (`engines/PxAnimatorBind.ts`, PX1505), the no-op api (`shared/PxAnimatorCallbacks.ts`).
10. Wrappers: React `SvgAnimator.tsx`, Vue `SvgAnimator.ts`, RN `SvgAnimator.tsx` — the handle with `guardWrite` per write method (PX1503 names `playback.start()`).
11. Call sites in tests and examples: `.startPlayback(` → `.playback.start(`, `.getCurrentTime(` → `.playback.getCurrentTime(` and the rest of §2.1, by a script that matches method calls on a player or handle only (never keys, constants, the executor or the engines' internal api); `play()` / `pause()` callers rewritten by hand. *Check:* core · web · react · vue · rn green; a new test that `player.playback` is the same object on every read and works destructured, seen failing first.
12. `pnpm build`: docs-check (signature blocks against the built `.d.ts`; `PxPlaybackControls` must appear in a guide), docs-examples, get-started 8/8, `mangle-reserved.json` regenerated (verify the dotted names need no entry).

**Phase C — player docs and examples**

13. `docs/library/*` (signature blocks, method tables, the naming-rationale rows, troubleshooting's rename list with all three steps), `docs/format/README.md` (keys, the rule of §3, examples), `docs/diagnostics.md` regenerated, package READMEs.
14. Examples: get-started (8), docs-examples cases, preview players, the RN explorer fixtures (keys).
15. `dev-docs`: this document ticked; `animation-state.playback-noun.md` §3/§8 marked superseded where they say flat; the "since 1.24–1.25" notes in the three older plans.

**Phase D — the Editor (kf)**

16. Key access: `svgeditor/animation/Types.ts` (`TRIGGER_KEYS = schemaKeys(PxActionTriggersSchema)`), the action schema keys, the 11 non-spec files that read the keys, and the unified preview player's `content.ts` (wire-shaped trigger objects, lines 100–113; it compiles against the published package, so it follows after publish) → the player's constants. The Editor's own field names (`PlaybackValues.startPlayback` …) stay. *Check:* typecheck at the 7 known errors.
17. Fixtures: the 346 JSON files holding the keys, the 10 preset JSONs, feature-explorer cases, `.ts`-embedded fixtures and the three `.svg` atest files — rekeyed by the text rule (each key is a unique string; inside `data-px-meta` the key gains its quotes: `startPlayback:` → `'playback.start':`), verified by parsing; stamps stay 1.25.x if folded.
18. Regenerate: the Editor field snapshot, settled cases (0 oracle diffs expected), inline snapshots with `data-px-meta`, preset scenes, the website file-format examples, the text-path baseline.
19. Handle callers: specs, `VscPreviewApp.ts`, the preview protocol and trigger-iframe script strings.
20. Test ids (Q6): one helper `testIdOfActionName(name)` (dot → dash) where the trigger fields build their ids; the two flagged atests and their flags (a `// 1.25` comment per changed line), `e2e-tests` skill, `claude-browser-context.md`.
21. Tests: relevant specs, then the full unit run and the e2e Play-All; failures listed before any expectation changes.

**Phase E — website, learning, videos**

22. Website: the three editor pages (keys and methods), `yarn website:svga-docs`, `yarn website:real-ui`, `yarn build` with the link check.
23. Learning projects: `hello-react`, `hello-web`, the cheatsheet, the changes page (a section for this step).
24. Learn-video generator: the code shown on screen (`actions={{ "playback.stop": … }}`, `playerRef.current?.playback.start()`), narration only where it reads code; regenerate; recording stays the owner's.

**Phase F — close**

25. Report `app/docs/testing/test-run.<date>.md`; skills (`player-repo`, `svga-format-schema`, `e2e-tests`, `editor-app`) and memory; every process Claude started stopped; nothing committed.

## 7. Questions

**Decided by the owner (2026-11-12):**

| # | question | decision |
|---|---|---|
| Q1 | Fold the dotted names into the uncommitted 1.25 step, or add 1.26? | **fold** — files go `startRun` → `playback.start` |
| Q3 | Do `play()`, `pause()`, `playOnce()`, `isPlaying()`, `jumpToStart()`, `jumpToEnd()` stay flat? | **no** — the aliases `play()` / `pause()` are removed; the rest move under `player.playback` |
| Q4 | Do the content-time reads and seeks stay flat? | **no** — they move under `player.playback` |
| Q5 | Do the names published in npm 1.0.54 move without an alias? | **yes** |
| Q6 | Editor test ids | **a dash form** (`playback-start`), built in one place so a later move is one edit |
| Q7 | `start({ marker })` in the sketches | **ignore** — not part of the design |
| Q8 | A camelCase alias for the six names in JavaScript? | **no** — always quoted |
| Q9 | `PxTriggerAction` takes the dotted values? | **yes** |
| Q10 | The word for the five reads at the current speed inside the namespace | **`…AtSpeed`** (`getDurationAtSpeed()` …) |
| Q11 | `playOnce()` inside the namespace | **`playback.playOnce()`** — `startOnce()` rejected ("sounds weird"); `startAndPlayOnce()` offered only if `playOnce()` raised doubts. It does not: the repeated word is cosmetic, and the name is the one published in 1.0.54, so a user finds it where they look |

**Taken at the default, not answered:** Q2 — `actions.outOfView` stays a bare key beside the dotted ones (a sensor's
rule, not a button of a state variable).

**Open:** none.

## 8. History

- 2026-11-11: after the flat 1.25 rename was applied, the owner proposed the namespace (`player.playback.start()`,
  `"playback.start"`). First answer: handle yes, file no. Reconsidered on the VS Code precedent: the file keys are action
  names in a registry, and the dot reserves built-ins against custom names. Nesting weighed and not taken (one level
  deeper for the common file). This document; no code touched.
- 2026-11-12: the owner's answers (§7): fold into 1.25; one home — every method under `player.playback`, the aliases
  removed; dash-form test ids; `…AtSpeed` for the five speed-adjusted reads; `playback.playOnce()` keeps its name.
  No open questions. Still no code touched; implementation waits for the owner's explicit go.
