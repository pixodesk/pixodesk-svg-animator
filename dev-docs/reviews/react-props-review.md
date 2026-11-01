# React props — first-read review, decisions and the plan

Status **2026-10-31** — `<SvgAnimationPlayer>` from `@pixodesk/svg-animator-react` **1.0.52** (schema 1.10), every
prop judged by its **name alone**: would a developer who never opened the docs guess what it does? Most people
don't read docs; the props have to explain themselves. Reviewed, then discussed with the owner; the decisions are
in §2, the plan in §4, what the plan does not settle in §5. **Implemented 2026-10-31** — steps 1–7 (schema 1.11 in the
player packages, docs and examples; the editor, its fixtures and the website) staged in the three repos; step 8 (publish, then
the editor's dependency bump, `yarn website:real-ui`, re-recorded videos) is the owner's.

Playground: `~/projects/pixodesk-learning-projects/hello-react/src/App.tsx` — one example per idea, each with a
verdict comment. Follows [react-api-hands-on.md](react-api-hands-on.md) (2026-10-25) and the design in
[../plans/component-api.md](../plans/component-api.md) (D4: the `play*` family names the driver; D5) and
[../plans/playback-layers.md](../plans/playback-layers.md) (layers 0–2). The same props exist on Vue and React
Native, and most as `createSvgAnimationPlayer` options.

---

## 1. The props today, as a newcomer reads them

🔴 does what the name would not lead you to expect · 🟠 the name misleads or needs the docs · 🟡 polish · ✅ reads well

| Prop | What it does | |
|---|---|---|
| `doc` | the animation document (the JSON) | ✅ |
| `className` · `style` | set on the root `<svg>` | ✅ |
| `playOnTrigger` | `true`: play by the file's triggers · `{ … }`: by these instead · `{}`: nothing starts it | 🟠 "play on …" reads as a condition for *starting*, yet the object holds `stop` and `pause` too |
| `play` · `pause` | your state: `play` runs, `play` + `pause` freezes, neither stops | 🔴 `play` on a one-shot at mount shows the end pose, no motion · 🟠 two booleans for three states |
| `playCurrentProgress` · `playCurrentTime` | show one moment (0…1, or ms) | 🟠 they play nothing; the `play` prefix reads as an action |
| `timeline` | timing corrections merged over the file's | 🟡 "timeline" suggests an object; `inTime` / `outTime` / `playDuration` are video words |
| `actions` | how a start / stop / end / out-of-view looks: `{ start, stop, finish, suspend }: { transition }` (+ `stop.completeIteration`) | 🟠 "transition" reads as CSS; the same keys as the triggers, with nothing in the names saying so |
| `playerRef` | the handle: `play()` `pause()` `stop()` `cancel()` `finish()` `playOnce()` `setPlaybackRate()` … | ✅ · 🟡 `stop()` vs `cancel()` not told apart by name |
| `onReady` `onPlay` `onPause` `onCancel` `onFinish` `onStop` `onDestroy` | callbacks | ✅ · 🔴 `onStop` fires on a pause too |
| `muteWarn` · `muteError` | silence the console | ✅ |

Reads well, keep: `doc` · `className` / `style` · the events `hoverIn` / `hoverOut` / `click` · `togglePlay: 'click'`
(the clearest key of all) · event lists `['hoverIn', 'click']` · `iterations` (with `'infinite'`) · `delay` ·
`iterationDirection` · `engine` · `frameRate` · the action values (`rewind`, `reset`, `hold`, `restart`) ·
`playerRef` with `play()` / `pause()` / `playOnce()` / `setPlaybackRate()` · `onPlay` / `onPause` / `onFinish` /
`onReady` · `muteWarn` / `muteError`.

Rejected on the way (with the recorded reason): `autoplay` (first-use review §1+2: it lied for a click file);
`triggers` as the switch and flat `playOn="hoverIn"` props (D4: the triggers live inside the driver prop; D2: no flat
shortcuts); `start` → `play` in the lists (`play` = start-or-resume by design, layer 0); `startAction` keys (the
container says "action" already; `togglePlayAction` buries the clearest key); a `playback` stem on both props (inside
`timeline` everything is playback — the link is the word *action*).

## 2. Decisions (owner, 2026-10-31)

| | Was | Now | Reasoning |
|---|---|---|---|
| File block | `timeline.triggers` | `timeline.actionTriggers` | "triggers" didn't say *of what*, and nothing linked it to `actions` beside it. The shared stem now says it: a key in `actionTriggers` names the action it fires; the same key in `actions` says how that action looks. |
| Preset key | `actions.*.transition` | `actions.*.do` | "transition" means a CSS transition to every web developer, and `reset` / `hold` / `jumpToFinished` aren't transitions. `do` reads as the imperative: "stop: do rewind", "finish: do hold". (Runner-up: `how`.) |
| Preset shorthand | — | `actions.stop: 'rewind'` ≡ `{ do: 'rewind' }` | The house style the triggers already have (one event or a list; the editor writes the shortest exact spelling). Only `stop` has a flag, so the common case reads as a sentence. **A string is exactly `{ do }`**: the merging `actions` prop keeps the file's `completeIteration` when you pass `stop: 'rewind'`. |
| Keys | `start / stop / pause / resume / togglePlay / finish / suspend` | unchanged | They are the action names, and the container now supplies "action". `start: 'hoverIn'` reads "start on hover in"; a suffix only repeats the container. Layer 2 keys custom actions (`firstLook`) the same way, and `run(name)` takes them. |
| Driver prop | `playOnTrigger` | `playUsingActionTriggers` | "play on …" reads as a condition for *starting*, so the object looked like it was about starting only. "play using …" names the driver and the block it takes, and keeps the `play*` family (`playUsingScrollTimeline` later). `true` = the file's block; an object = this block, as a whole. |
| Settings prop | `actions={{ stop: { transition } }}` | `actions={{ stop: 'rewind' }}` / `{ do, completeIteration }` | Same prop; the inner key and the shorthand follow the file. |
| Controlled position | `playCurrentProgress` / `playCurrentTime` | `showAtProgress` / `showAtTime` | They play nothing — they show one frame — so the `play` prefix read as an action. "show at" says a frame at a position. D4's rule becomes "a driver is named by its verb: `play…` when it plays, `show…` when it only shows". |
| `play` on a one-shot at mount | shows the end pose, no motion | plays | Everyone writes `<Player play />` meaning "play it". The recorded reason for the pose (a re-rendered list of icons all animating) now has its own prop: `showAtProgress={1}`. |
| `onStop` | after any halt (pause, finish, destroy too) | the `stop` action only | The name promised a stop, so a handler written for a stop ran on every pause. `onPause` / `onFinish` / `onDestroy` already cover the rest; the catch-all goes (§5 if an `onIdle` is wanted). |
| State rule | stopped · playing · paused; finished = stopped | + `finished` | Layer 0 and 2 designed four states; the implementation lagged. With finished = stopped a stop trigger could not act on a finished one-shot, so "forward on hover, back on leave" and like-toggles were inexpressible — and `onStop` vs `onFinish` needs the distinction. `start` acts on stopped or finished, `stop` on playing, paused or finished. |
| Editor labels | "Play on" / "Play Action" / "End Action" / "Out-of-View Action" | unchanged | The panel speaks to designers, the file to developers; the mapping is one-to-one. Panel test ids follow the keys, which do not change. |
| Handle: reset now | `cancel()` | `reset()` | It resets at once, ignoring every setting — and `reset` is already the vocabulary (`do: 'reset'`), so the handle speaks the actions' words. `cancel` only ever came from the Web Animations API. |
| Handle: jump to the end | `finish()` | `jumpToFinished()` | It does exactly the `jumpToFinished` preset; "finish()" can be read as "let it play to the end". |
| `resume` in the trigger type | offered by autocomplete, ignored at runtime (PX1111) | omitted from the prop, the web option and `bind` (an `Omit` over the schema type) | A key you may type but must not is a trap; the type refuses it at compile time. The schema keeps the key for layer 2 (element targets). |
| Docs only | — | `load` says it still waits for the gate; ms on `inTime` / `outTime` / `playDuration` / `delay`; ~~`playUsingActionTriggers={{}}` = nothing starts it, your code does~~ (withdrawn 2026-11-01, owner: the prop has two spellings — `true` or an override block; "your code drives" is no control prop at all, so `{}` is not documented) | Three first-read traps that need no rename. |

## 3. Examples

### The file — 1.10 → 1.11

The lid: hover in opens it, hover out lets it finish opening and then plays it back closed; scrolled away it goes
back to the start.

```json
// 1.10
"timeline": {
  "outTime": 400,
  "triggers": { "start": "hoverIn", "stop": "hoverOut" },
  "actions":  { "stop": { "transition": "rewind", "completeIteration": true }, "suspend": { "transition": "reset" } }
}
```
```json
// 1.11
"timeline": {
  "outTime": 400,
  "actionTriggers": { "start": "hoverIn", "stop": "hoverOut" },
  "actions":        { "stop": { "do": "rewind", "completeIteration": true }, "suspend": "reset" }
}
```

Read cold: action triggers — start on hover in, stop on hover out; actions — stop does rewind after the iteration,
suspend does reset. A new document from the editor: `"actionTriggers": { "start": "load" }, "actions": { "suspend": "pause" }`.

### React — before and after

```tsx
// as the file says
<SvgAnimationPlayer doc={lid} playOnTrigger />
<SvgAnimationPlayer doc={lid} playUsingActionTriggers />

// your triggers and how the actions look
<SvgAnimationPlayer doc={lid}
    playOnTrigger={{ start: 'hoverIn', stop: 'hoverOut', togglePlay: 'click' }}
    actions={{ start: { transition: 'restart' }, stop: { transition: 'rewind' } }} />
<SvgAnimationPlayer doc={lid}
    playUsingActionTriggers={{ start: 'hoverIn', stop: 'hoverOut', togglePlay: 'click' }}
    actions={{ start: 'restart', stop: 'rewind' }} />

// your state — the same actions apply (a one-shot now PLAYS on mount)
<SvgAnimationPlayer doc={lid} play={hovered} pause={frozen}
    actions={{ start: { transition: 'jumpToFinished' }, stop: { transition: 'rewind', completeIteration: true } }} />
<SvgAnimationPlayer doc={lid} play={hovered} pause={frozen}
    actions={{ start: 'jumpToFinished', stop: { do: 'rewind', completeIteration: true } }} />

// one frame, no playback
<SvgAnimationPlayer doc={lid} playCurrentProgress={0.3} />
<SvgAnimationPlayer doc={lid} showAtProgress={0.3} />
<SvgAnimationPlayer doc={lid} showAtTime={120} />          // ms

// the pose a list of icons mounts with (what `play` on a one-shot used to give)
<SvgAnimationPlayer doc={tick} showAtProgress={1} />

// callbacks — `onStop` now means a stop
<SvgAnimationPlayer doc={lid} playUsingActionTriggers={{ start: 'click', pause: 'click' }}
    onPlay={…} onPause={…} onStop={…} onFinish={…} />

// now expressible (the `finished` state): forward on hover, back on leave — and a like-toggle
<SvgAnimationPlayer doc={lid}   playUsingActionTriggers={{ start: 'hoverIn', stop: 'hoverOut' }} actions={{ stop: 'rewind' }} />
<SvgAnimationPlayer doc={heart} playUsingActionTriggers={{ start: 'click',   stop: 'click' }}    actions={{ stop: 'rewind' }} />
```

```tsx
// the handle — the actions' words
playerRef.current?.play(); pause(); stop();          // the built-in actions, with the file's settings
playerRef.current?.reset();                          // was cancel(): back to the start now, whatever the settings
playerRef.current?.jumpToFinished();                 // was finish(): the end pose, no motion
playerRef.current?.playOnce();
```

The CSS components (`SvgCssAnimationPlayer`, React and Vue) have no driver switch and take the block directly:
`actionTriggers={{ start: 'hoverIn', stop: 'hoverOut' }}` + `actions={{ suspend: 'continue' }}`. The web player:
`createSvgAnimationPlayer({ doc, container, playUsingActionTriggers: true })`; the pre-rendered export's script:
`bind({ "playUsingActionTriggers": true, "doc": … })`.

## 4. The plan

One schema step, every package, then the editor and the website; publish once at the end. Verify each step
before the next; every behaviour change gets a test seen failing first.

### Step 1 — the wire: schema 1.10 → 1.11 (player core)
- `PX_WIRE_SCHEMA_VERSION` → 1.11; `PX_WIRE_STEPS` entry (`converted` + `up`): `timeline.triggers` → `actionTriggers`;
  in every `actions.*`, `transition` → `do` (the object form stays valid; the editor writes the short form on its next save).
- Schema (`format/PxAnimatorTypes.ts`): `PxTriggersSchema` → `PxActionTriggersSchema` under the new key; each action
  slot = `px.union([the preset enum, the object])`, `PxStopActionSchema` keeps `completeIteration`; types `PxTriggers` →
  `PxActionTriggers`, `PxActions` with the string form; `_PxActions` TSDoc.
- `pnpm build` the core, then `node scripts/schema-release.mjs --apply` (field snapshot, release record, `SCHEMA.json`);
  move the literals the bump breaks (`PxSchemaRelease` self-test, the `PxPrepareDocument` fixture); `PxSchemaFieldUniverse`
  regenerated (`PX_REGEN_FIELD_UNIVERSE=1`); `PxSchemaDefaults.test.ts` still green.

### Step 2 — core behaviour and names
- `resolveActions` normalises the string form (one helper, like `triggerEventList`); `getAnimatorConfig` / the
  runtime view read `actionTriggers`; `triggerIssues` / `derivedResume` / `allowedTriggerEvents` unchanged in logic,
  `PxTriggerList` unchanged (the keys stay).
- **`finished`:** `PxPlayState` gains `finished`; `triggerActionFor`: `start` acts on stopped | finished, `stop` on
  playing | paused | finished, `pause` on playing, the derived resume on paused. The executor sets `finished` when a
  one-shot run ends (after the `finish` action); a `stop` from finished runs the stop action from the end pose
  (reset = jump, rewind = play back). A rewind in progress counts as playing. Test: the lid (`start: hoverIn`,
  `stop: hoverOut`, `stop: rewind`) — seen failing on the 3-state rule first.
- **Play on mount:** `resolveDeclarativePlayback` — a mount with `play` starts a one-shot (today `showEnd`).
  `PxDeclarativePlayback.test.ts` updated, the guide's "a mount never animates" paragraph replaced.
- **Control props** (`PxControlProps`, `PxControlMode`, `resolveControlMode`, `controlModeTakesOverTrigger`,
  `PxPlaybackOverrideInput`, `withTriggers` / `withoutTriggerDriver`): `playOnTrigger` → `playUsingActionTriggers`
  (mode value too), `playCurrentProgress` / `playCurrentTime` → `showAtProgress` / `showAtTime` (`fixedTime` mode
  keeps its name). PX1501–1503 texts name the new props. `/engine` and `index` exports follow.
- The trigger type the drivers take — `playUsingActionTriggers`, the web option, `bind` — is `Omit<PxActionTriggers,
  'resume'>` (one exported alias); the schema type keeps `resume`. Test: a `resume` key no longer typechecks on the prop.
- TSDoc: `playOnce()` says `actions.finish` (still says `timeline.finish`); `PxControlProps` carries the
  `playUsingScrollTimeline` TODO line (was `playOnScrollTimeline`); `load` says the gate still applies (half on screen by
  default, `inViewThreshold`); `inTime` / `outTime` / `playDuration` / `delay` say ms.
- Tests: core suite green; `anyBudget` unchanged.

### Step 3 — web player
- `PxAnimatorTriggers.ts`: reads `actionTriggers`, the 4-state rule via core; `PxVisibilityGate` untouched.
- `PxAnimatorCallbacks.ts`: `onStop` is called by the stop action only — no longer composed after `onPause` /
  `onFinish` / `onDestroy`. Test seen failing first (today's "onStop after pause" assertion inverted).
- Options: `createSvgAnimationPlayer({ playUsingActionTriggers })`, `createSvgAnimationPlayersFromPage`, `bind` and
  the pre-rendered entries (`index.prerendered*.ts`) — same name everywhere; `showAt*` where the position props exist.
- The handle (`PxAnimationPlayerApi`): `cancel()` → `reset()`, `finish()` → `jumpToFinished()` — the web player, the
  bind entries, and the executor's `cancel` naming where it surfaces publicly; the three framework handles follow in step 4.
- `mangle-reserved.json` regenerates on build — commit it.

### Step 4 — React, Vue, React Native
- Props renamed as in §2 (Vue `[Boolean, Object]` for the driver prop, `play-using-action-triggers` in templates;
  RN the same names); the control-mode warnings name the new props; `onStop` semantics from step 3.
- CSS components (`SvgCssAnimator.tsx` / `.ts`): `triggers` → `actionTriggers`; `actions` accepts the string form.
- Suites green: react · vue · rn; the type guards (no unknown key in the trigger object; no trigger inside `timeline`).

### Step 5 — player docs, examples, plans
- Guides: `react.md`, `vue.md`, `react-native.md`, `web-player.md`, `playback-and-triggers.md` (the actions table with
  the string form; "`onStop` = the stop action"; the handle's `reset()` / `jumpToFinished()`), `format/README.md`,
  `troubleshooting.md`, `diagnostics.md` (`pnpm gen:diagnostics`), the package READMEs. One line in each component guide:
  ~~`playUsingActionTriggers={{}}` = nothing starts it, your code does~~ (removed again 2026-11-01 — see §2). Every `px-check` block re-checked.
- Examples: `docs-examples` cases (`play-on-trigger` → `play-using-action-triggers`, `declarative`, triggers),
  `preview-player` (labels + the lists), `get-started` samples; `pnpm check:get-started --local`.
- Plans: `component-api.md` — a D7 entry recording §2 and the amended D4 rule ("a driver is named by its verb");
  `playback-layers.md` — layer 1's shape (`actionTriggers`, `do`, the string form), the 4-state rule marked
  implemented, the naming notes.
- `pnpm build` (docs-check — compare the test count with the marker count; links).

### Step 6 — the editor (kf)
- Schema keys: `PxTriggersSchemaKeys` → `PxActionTriggersSchemaKeys`; `TSvgSvgAnimationTriggersAttr` group name
  `actionTriggers`; the action attrs write `do`, shortest exact spelling (a string when only the preset is set);
  readers accept both forms. Panel test ids unchanged (they follow the keys).
- Consumers: `SvgJsCssPlayerSerialisationUtil` (resolved actions), the SVG + JS export script
  (`"playUsingActionTriggers": true` via the script-call constants), `triggerIframe.ts` / `previewPlayerProtocol.ts`,
  the export dialog (`TExportConfig` get/set wire), `PlaybackPresets.ts` (`valuesOf` / `wireTriggers` keys) and the
  regenerated preset scenes, `progress-animation.json`.
- Trigger explorer: `TriggerCellDriver` derives the expected state with `finished`; the lid rows become green.
- Fixtures: restamp the editor stamp in `effect.retime.nested.*`, the atest `.data` files, the learn assets
  (`convert-assets.mjs`), `PxSchemaFullCoverageDoc`; regenerate the kf field-universe snapshot; re-settle the
  feature-explorer cases (dry run first); refresh inline snapshots that embed `data-px-meta`.
- Specs: serialisation (`animator-config.spec.ts`, `…_animator.spec.ts`, the round-trip fixture),
  `TSvgSvgAnimationTriggersAttr.spec.ts`, `PlaybackPresets.spec.ts` + scenes, `schemaDefaultsParity.spec.ts`,
  `pxFileHealth`; the trigger-explorer sequential spec. Atests: none expected to change (ids stay); run the two
  trigger atests and the trigger video script once.
- Skills: `svga-format-schema`, `editor-app`, `e2e-tests` (the new wire words). hello-react playground updated.

### Step 7 — website
- `scripts/sync-svga-docs.mjs` (player docs), the editor pages that spell wire keys (`175-playback-settings.md`,
  `140-animation.mdx`, `015-quick-start.mdx`), the file-format samples (`fileFormatExamples.spec.ts` regen),
  `yarn build` (link check).

### Step 8 — publish and bump
- Player: commit, version bump, `pnpm build`, publish. Editor: `app/package.json` `^1.0.x` → the new version, plain
  `yarn install` (never `--ignore-scripts`), Electron build by the owner.

## 5. Not resolved by this plan

Left on purpose this round (owner, 2026-10-31): the `play` / `pause` booleans (the boolean is right for `play={hovered}`;
an enum would cost every such line), `onFinish` (one trio with the `finish` action and the `finished` state), `onIdle`
(add when someone needs "stopped for any reason"), and the `'manual'` literal / `outOfView` / `jumpToEnd` words.

| Issue | Today | Options (first = my pick) |
|---|---|---|
| The catch-all callback | `onStop` was it | drop (three specific callbacks cover it) · `onIdle` · `onPlaybackEnd` |
| "Reached the end" callback name | `onFinish` | keep (matches the `finish` action and the `finished` state) · `onEnded` (matches the engine event `ended` and `<video>`) |
| `play` / `pause` are tri-state booleans | absent ≠ `false`; `pause` alone warns | deferred by the owner (first-use §1+2); if reopened: `playback="playing" \| "paused" \| "stopped"` — layer 2's built-in variable, passes the `play*` test, mixes no driver in |
| `start: 'load'` waits until seen | the gate (`suspend`) is a condition on every driver, `load` is the event | keep (design; the TSDoc now says it — step 2) · rename the event (`appear`) — a wire change |
| `timeline` prop and its words | `inTime` / `outTime` / `playDuration`, video words | keep (mirrors the file; ms in the TSDoc — step 2) · `timing` for the prop |
| `suspend`, `jumpToFinished` as words | design-justified (`suspend` / `wake`; named after the state) | keep · `outOfView`, `jumpToEnd` |
| `completeIteration` | a flag beside `do` | keep |
