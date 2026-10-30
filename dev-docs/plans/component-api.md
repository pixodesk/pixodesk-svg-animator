# Component API — the plan after the hands-on review

Status **2026-10-25 — planning.** Decisions land here; the trying and the findings stay in
[../reviews/react-api-hands-on.md](../reviews/react-api-hands-on.md). Scope: the shapes the four
surfaces share — React, Vue, React Native, the web `createSvgAnimationPlayer` — and the CSS
components; kf consumes all of them. Nothing here is implemented.

## Decisions

### D1. Reuse the document schema
A per-mount override is a piece of the file. It is shaped like the file and **typed from the
schema** (`PxTimeline`, `PxTrigger`), never from a hand-written copy. A component invents no
vocabulary the file lacks: the file, the editor and the code share one set of words.

### D2. Two aliases, and no flat shortcuts
`timeline` and `trigger` are the override surface. The ten flat shortcuts
(`inTime outTime playDuration delay iterations start outOfView hoverEnd inViewThreshold inViewDebounce`)
go: a bare `start` or `delay` among 30 props carries no context, and every shortcut needed a
"shortcut wins over the key inside `timeline`" rule.

Both aliases are aliases — one could get by overriding the JSON — but two named objects beat a
dozen loose attributes. `trigger` is `timeline.trigger` lifted one level: the override people make
per mount, and the ONLY override a CSS component has (no timeline). To keep every key reachable
exactly one way, the `timeline` prop's type **omits** `trigger`.

```tsx
<SvgAnimationPlayer className="player" doc={animation} playOnTrigger
    timeline={{ iterations: 'infinite' }}
    trigger={{ start: 'hover' }} />

<SvgAnimationPlayer doc={animation} playOnTrigger trigger={{ strat: 'hover' }} />   // compile error, with autocomplete
```

The same in Vue — the names are identical by design (the Vue component already declares React's
prop names); only the template syntax differs:

```vue
<SvgAnimationPlayer class="player" :doc="animation" playOnTrigger
    :timeline="{ iterations: 'infinite' }"
    :trigger="{ start: 'hover' }" />

<SvgAnimationPlayer :doc="animation" playOnTrigger :trigger="{ strat: 'hover' }" />   <!-- compile error under vue-tsc -->
```

| | React | Vue |
|---|---|---|
| an object prop | `timeline={{ … }}` | `:timeline="{ … }"` |
| the mode switch | `playOnTrigger` | `playOnTrigger` — bare works, the prop is declared `Boolean` |
| the element class | `className` | `class` |
| the typo is caught | by `tsc` — always | only by `vue-tsc` (hello-vue's `npm run build` runs it; `vite` alone and `npm run dev` do not check templates) |
| the prop's type | `PxTriggerPatch` | `Object as PropType<PxTriggerPatch>` — the same type, so T1 serves both |

Kept as they are, for now: `playOnTrigger` (the mode switch), `apiRef`, the control props, the callbacks.

### D3 — IMPLEMENTED 2026-10-25 in the player packages (T3c): a replace / merge pair per block — `timeline` / `mergeTimeline`, `trigger` / `mergeTrigger`
`resetTimeline` is a flag that changes what another prop means (merge vs replace) — gone. Instead the
choice is in the prop's NAME, for both blocks:

| prop | meaning | type |
|---|---|---|
| `timeline` | REPLACE the timing block — the file's `timeline` minus `trigger`; what is left out takes the file-format default | `PxTimeline` (sans trigger) — the schema type itself |
| `mergeTimeline` | MERGE over the file's block; `null` deletes a key; also a JSON string | `PxTimelinePatch \| string` |
| `trigger` | REPLACE the trigger block | `PxTrigger` |
| `mergeTrigger` | MERGE over the file's trigger | `PxTriggerPatch` |

```tsx
<SvgAnimationPlayer doc={d} timeline={{ iterations: 'infinite' }} playOnTrigger />                      // the file's trigger
<SvgAnimationPlayer doc={d} timeline={{ iterations: 'infinite' }} mergeTrigger={{ hoverEnd: 'reset' }} playOnTrigger />   // file's trigger + hoverEnd
<SvgAnimationPlayer doc={d} timeline={{ iterations: 'infinite' }} trigger={{ start: 'hover' }} playOnTrigger />           // only this trigger; the file's ignored
```

Analysis (Claude, 2026-10-25) — for the owner to confirm or reject:

| # | Point | Verdict |
|---|---|---|
| 1 | Replace props ARE the schema types (`PxTimeline`, `PxTrigger`), merge props their `PxPatch` — D1 at its purest; the root-`null` trick and `resetTimeline` become unnecessary | ✅ agree |
| 2 | Required keys on the replace type? No: an absent `outTime` means the END OF THE CONTENT (max keyframe time, `PxAnimatorConstants.ts:759`), every other absence is a stated default — `timeline={{ iterations: 'infinite' }}` plays the whole content forever | ✅ all-optional, like the file |
| 3 | `timeline` on the props = timing WITHOUT the trigger (the file nests it; the props lift it). All three examples follow this; it must be said once, where `timeline` is documented | ✅ consistent, given the one definition |
| 4 | Both of a pair set (`timeline` + the merge prop) | ✅ owner: exclusive by TYPE (a union of prop sets) + a usage WARNING at runtime (Vue templates and JS have no TS); if both still arrive, apply replace THEN merge — deterministic, nothing dropped silently |
| 5 | Naming the merge prop | ✅ owner, 2026-10-25: `mergeTimeline` / `mergeTrigger` — the one candidate with option-key precedent (evidence below) |
| 6 | `trigger` / its merge prop without `playOnTrigger` still plays nothing, silently (hands-on B3) | ✅ owner: KEEP the behaviour; a warning, or any trigger prop implying `playOnTrigger`, stays open question 1 — nothing auto-set for now |
| 7 | ~~The web `data-px-timeline` attribute~~ — **correction:** the web player reads only `data-px-animation-src`, `data-px-id`, `data-px-pin`; `data-px-timeline` / `data-px-reset` exist in ONE file, kf's video-preview harness (`VscPreviewApp.ts`), and were wrongly presented as a player feature. The `\| string` form exists for mangled builds (minification.md) | the string form is open question 2, unchanged |
| 8 | CSS components / pre-rendered SVG | ✅ owner: change NOTHING there beyond T3a (`trigger?: PxTrigger` as already landed); no merge prop on them; the `playOnTrigger` questions wait |
| 9 | A replace can change the timeline's KIND (time → scroll) with no carried keys; the merge's RULE 2 stays merge-only | ✅ simpler |
| 10 | `applyAnimatorConfig`'s `{ resetTimeline }` option, `PX_ANIMATOR_RESET_KEY`, the two specs, 6 doc sites, kf's unused `data-px-reset` | go with the change |

**Naming evidence (point 5), researched 2026-10-25 — what established libraries actually do:**

| Pattern | Precedents (verified) |
|---|---|
| verb-first `merge<Thing>` as an OPTION KEY | Inertia's protocol keys [`mergeProps`, `deepMergeProps`, `prependProps`](https://inertiajs.com/the-protocol); Firestore `SetOptions` [`merge` / `mergeFields`](https://firebase.google.com/docs/reference/node/firebase.firestore.SetOptions); Zustand persist's [`merge`](https://zustand.docs.pmnd.rs/reference/middlewares/persist); Apollo field policies' [`merge`](https://www.apollographql.com/docs/react/caching/cache-field-behavior); RTK Query endpoints' [`merge`](https://redux-toolkit.js.org/rtk-query/api/createApi) |
| verb-first `merge<Thing>` as a FUNCTION | Vue [`mergeProps`](https://vuejs.org/api/render-function.html#mergeprops), Solid [`mergeProps`](https://docs.solidjs.com/reference/reactive-utilities/merge-props), React Aria [`mergeProps`](https://react-spectrum.adobe.com/react-aria/mergeProps.html), Vite [`mergeConfig`](https://vite.dev/guide/api-javascript#mergeconfig), lodash `merge`, MUI `mergeSlotProps`, Playwright `mergeTests` |
| the bare noun REPLACES, a marked sibling MERGES | Tailwind [`theme` vs `theme.extend`](https://v3.tailwindcss.com/docs/theme); Firestore `set()` overwrites unless `merge` is passed |
| the merge document is a *patch* (noun) | [RFC 7386 "JSON Merge Patch"](https://www.rfc-editor.org/rfc/rfc7386) — the semantics `mergeAnimatorConfig` implements; HTTP [PATCH](https://www.rfc-editor.org/rfc/rfc5789) vs PUT; Kubernetes [`kubectl patch --type merge`](https://kubernetes.io/docs/tasks/manage-kubernetes-objects/update-api-object-kubectl-patch/) vs [`kubectl replace`](https://kubernetes.io/docs/reference/kubectl/generated/kubectl_replace/); Pinia [`store.$patch()`](https://pinia.vuejs.org/core-concepts/state.html#Mutating-the-state) merges, `$state =` replaces |
| the verb pair replace / merge | MongoDB [`replaceOne`](https://www.mongodb.com/docs/manual/reference/method/db.collection.replaceOne/) / [`updateOne`](https://www.mongodb.com/docs/manual/reference/method/db.collection.updateOne/); kubectl `replace` / `patch` |
| `<noun>Merge` (suffix) | none found |
| `override…` | none that separates replace from merge — our own guides call today's MERGE "Playback overrides"; CSS "overrides" merge property-wise, OOP "override" replaces |

Candidates, against that:

| | Reads as | Precedent | Cost |
|---|---|---|---|
| A `timeline` + `mergeTimeline` | the timeline; merge this into it | Tailwind / Firestore (bare replaces), Inertia / Firestore (`merge<Thing>` keys) | the pair does not share a stem in autocomplete |
| B `timeline` + `timelineMerge` | the same | none for the suffix | — |
| C `timeline` + `timelinePatch` | the timeline; a patch on it | RFC 7386, kubectl, Pinia; matches `PxTimelinePatch` | "patch" is a developer's word |
| D `replaceTimeline` + `mergeTimeline` | both verbs explicit, no bare prop | MongoDB, kubectl | longer; the common case loses the short name |
| E `overrideDocTimeline` (+ a merge twin) | override the doc's | none; "override" is ambiguous (above); `Doc` repeats what the `doc` prop beside it says | the longest; Vue `:override-doc-timeline` |

Recommendation: **A** — or **D** if every prop should carry its verb. Not E.

**Status:** implemented 2026-10-25 (T3c), **superseded by D4 on 2026-10-26** — the pair, the exclusivity typing and PX1504 are gone again; the record of why stays above.

### D4 — IMPLEMENTED 2026-10-26 in the player packages (T3d): the `play*` family names the driver

Remove `timeline` / `mergeTimeline` / `trigger` / `mergeTrigger`. Then:

| Prop | Meaning |
|---|---|
| *(no `play*` prop)* | static — the first frame |
| `playOnTrigger` | `true` = the document's own trigger drives; **an object** = the WHOLE trigger to use instead (a replacement — switching `hover` → `click` changes the other settings with it; absent keys take the wire defaults). No separate trigger prop |
| `play` | declarative state (with `pause`, `playMode`, `completeIteration` as today) |
| `playerRef` *(renamed from `apiRef`)* | imperative control — the ref the component fills; starts with `play` like every driver. Vue keeps its template `ref` (its own mechanism, not a prop) |
| `timeline` | a MERGE over the file's timing — corrections (`iterations`, `delay`), never a replacement; whoever needs more edits the document |
| `playCurrentProgress` / `playCurrentTime` *(renamed from `progress` / `time`)* | controlled position — the host holds the frame; the names rhyme with `getCurrentProgress` / `setCurrentTime` |
| later: `playOnScrollTimeline` | a full scroll-driven timeline config — the scroll driver. Listed now as a TODO line in the shared props TSDoc (`PxControlProps`), so the family is visible where the props are read |

Analysis (Claude, 2026-10-26) — for the owner:

| # | Point | Verdict |
|---|---|---|
| 1 | One stem for every way to make it play: `playOnTrigger`, `play`, `play…` — autocomplete on `play` lists the drivers; "how do I make it move?" has one answer-space | ✅ the strongest naming idea so far |
| 2 | The trigger lives INSIDE the driver prop, so a trigger cannot be given without choosing the trigger driver — hands-on B3 (`start="hover"` alone, silently nothing) becomes impossible; open question 1 closes by construction | ✅ |
| 3 | `true \| object` on one prop | ✅ an established config idiom: antd `pagination={false \| {…}}`, Vite `server.hmr: boolean \| {…}`, webpack `optimization.splitChunks: false \| {…}`. Type it `boolean \| …` (not `true \| …`) so `playOnTrigger={flag}` works; Vue `type: [Boolean, Object]` keeps the bare-attribute form |
| 4 | Replace or merge for the object? | ✅ owner: REPLACE — a trigger's keys belong together: switching `hover` → `click` makes `hoverEnd` meaningless and usually wants a different `outOfView` too, so a merge would carry the hover-era settings into the click trigger. Type: `boolean \| PxTrigger` (the schema type; absent keys = wire defaults) |
| 5 | `timeline` as merge only, trigger excluded from its type (only `playOnTrigger` carries a trigger) — no key reachable two ways; `null` deletes a key (needed for `outTime` / `playDuration`, whose absence means "the content's end" / "natural speed"); the string form stays for mangled builds | ✅ (the string form on the components is still open question 2) |
| 6 | The ref's name | ✅ owner, 2026-10-26: `playerRef` — under the `play*` rule, the React `…Ref` convention, and the guide's variable is already `playerRef` |
| 7 | `progress` / `time` → `playCurrentProgress` / `playCurrentTime` | ✅ owner, 2026-10-26: unambiguous (no duration misread), and the prop names rhyme with the handle's `getCurrentProgress` / `setCurrentTime`. RN's `progress: progressProp` alias (a name clash with its SharedValue) goes away with it |
| 8 | The future scroll driver | ✅ owner: `playOnScrollTimeline={…}` — `playStart<Driver>`, and the word "timeline" kept on purpose |
| 9 | CSS components (`SvgCssAnimationPlayer`): `trigger` today; `playOnTrigger={{…}}` would make them read like the JSON player | ⏸ pre-rendered logic stays untouched (owner); a later rename for symmetry |
| 10 | What goes: D3's pair, `PxTimelineOverride` / `PxTriggerOverride` / `PxPlaybackOverrideFields`, the exclusivity test, PX1504 (unpublished — safe to delete); `applyPlaybackOverride` shrinks to `{ timeline, playOnTrigger }` | go with the change |
| 11 | Prop count: 34 → 22 | ✅ |
| 12 | The `play` driver's modifiers — `pause`, `playMode`, `completeIteration` — do not all start with `play` | ✅ left as they are: they are modifiers of ONE driver, not drivers; the rule is about how the animation is driven |

### D5 — DECIDED 2026-10-26 (owner), design complete: the trigger says WHEN; how playback starts, stops and ends are `timeline` keys named by their moment

**The idea (owner).** `play` / `pause` (host state), the trigger (user interactions) and `play()` / `pause()` / `stop()`
(code) are the same kind of thing — three ways to say "on" or "off"; only who says it differs. So HOW a transition happens
is written once and honoured by all three, and the trigger says only WHEN.

**Today** the same question has three vocabularies: `playMode` + `completeIteration` on the `play` prop; `hoverEnd`
(`continue | pause | reset | reverse`) and `outOfView` (`pause | continue | reset`) in the trigger; `pause()` / `cancel()` /
`finish()` / a negative rate on the api. Reverse is implemented twice, and "finish the iteration first" exists only on the
`play` path — the gap that started this (mouse out → finish the beat, then stop). The timeline's own words confused at
first glance too: three concepts borrowed the same time-direction words (`direction: reverse`, `fillMode: forwards |
backwards`, a stop that "reverses"), "Mode" said nothing, `finish` named a moment but held an action.

**Two principles (owner).** Names must be self-explanatory to someone who knows the area but not this library; related
attributes show their relation through shared name parts. The file's own vocabulary is the 2×2 `play` / `pause` ×
`on` / `off`; play has a third moment, `end` (it stops by itself). Every "what happens when X" key is `X` + `Action`, the
events that cause X are the list with the same stem, and the HOW lives flat in `timeline` — the file's playback block by
definition — not in a new container.

**The timeline, grouped** (the time member; a scroll / view timeline keeps its own keys — `axis`, `source`, `subject`,
`smoothing`, `pin` — and takes neither `trigger` nor the play keys, since scroll is its driver):

```json
"timeline": {
  "type": "time", "engine": "auto", "frameRate": 60,                           // ── the kind, the engine
  "inTime": 0, "outTime": 1200, "playDuration": 1200, "delay": 0,               // ── the content window and its timing
  "iterations": "infinite", "iterationDirection": "normal",                     // ── the run
  "playStartAction": "resume",                                                     // ── play: on, off, end
  "playStopAction": "reset", "completeIterationOnPlayStop": true,
  "playFinishAction": "hold",
  "outOfViewAction": "pause", "inViewThreshold": 0.5, "inViewDebounce": 150,    // ── the visibility gate
  "trigger": { "playStart": ["hoverIn", "click"], "playStop": "hoverOut", "pauseStart": "click" }   // ── when
}
```
Read cold: play-start resumes, play-stop resets after completing the iteration, play-finish holds, out-of-view pauses; play on
hover-in or click, off on hover-out.

| key | values (default first) | meaning |
|---|---|---|
| `type` | `time` · `scroll` · `view` | what advances progress |
| `engine` | `auto` · `native` · `js` | who renders the frames |
| `frameRate` | number | frames per second for the frames mode |
| `inTime` / `outTime` | ms; 0 / the content's end | the content window — one pass plays it |
| `playDuration` | ms; the window's length | the window remapped to wall time |
| `delay` | ms, 0; negative skips ahead | waited whenever a run starts from the beginning — the first play, a `restart`, a `resume` after a reset or an end — never on a resume from a paused position |
| `iterations` | 1 · n · `infinite` | how many passes |
| `iterationDirection` (was `direction`) | `normal` · `reverse` · `alternate` · `alternateReverse` | each iteration's direction (`reverse` applies to a single pass too — still one iteration) |
| `playStartAction` | `resume` · `restart` · `jumpToEnd` | what a play-start does: continue from the current position (at the start or the end, that is a fresh run from the beginning); from the beginning always; or show the end with no motion |
| `playStopAction` | `reset` · `rewind` | what a play-stop does: jump back to the state as before it started, or play back to it (`rewind` — the VCR word, never confused with `iterationDirection: reverse`) |
| `completeIterationOnPlayStop` | false · true | WHEN the play-stop takes effect: now, or after the current iteration (a one-shot runs to its end). Orthogonal to the action: `rewind` after completion plays back from there — finish the motion, then undo it smoothly |
| `playFinishAction` (absorbs `finish` and the after-half of `fillMode`) | `hold` · `reset` · `rewind` | when it ends by itself: keep the last frame, jump back, or play back |
| `showFirstFrameBeforePlayStart` (the before-half of `fillMode`) | false · true | false: the SVG as authored shows before the first play-start and after a reset — this format's contract (`PxRestPose.ts`: the initial value IS the static attribute, so in Editor files the two are the same picture and the key is never written). true: the first frame's values are applied instead — hand-authored files; a checkbox later |
| `outOfViewAction` (was `trigger.outOfView`) | `pause` · `continue` · `reset` | while none of it is on screen. The return needs no key: if it was meant to run, it runs again — from the paused position after `pause`, from the start after `reset`; `continue` never stopped |
| `inViewThreshold` / `inViewDebounce` | 0.5 (0 = any pixel) / 150 ms | the gate's measure |
| `trigger` | absent = `{ playStart: ['load'] }` (today's "a missing trigger starts on load"); `{}` = nothing starts it | WHEN — `playStart`, `playStop`, `pauseStart`, `pauseStop?` (absent = a copy of `playStart`), each a single event or a list of them (`'hoverIn'` or `['hoverIn', 'click']` — the house style of `animate`'s references; the reader normalises, the Editor writes the shortest exact spelling) from an OPEN vocabulary: `load`, `hoverIn`, `hoverOut`, `click`; later keyboard, focus, app events — a new interaction is a new string, never a new key. Pause and resume need no action |

`reset` means ONE thing wherever it appears (`playStopAction`, `playFinishAction`, `outOfViewAction`): the state as before it
started — the SVG as authored, or the first frame when `showFirstFrameBeforePlayStart` is set. The CSS export maps
(`showFirstFrameBeforePlayStart`, `playFinishAction`) to `animation-fill-mode`: (false, hold) → forwards, (true, hold) → both,
(false, reset) → none, (true, reset) → backwards — all four expressible.

**Rules.**
- The state rule over stopped · playing · paused: `playStart` acts when stopped, `pauseStart` when playing, `pauseStop` when
  paused, `playStop` when playing or paused. So `click` in `playStart` and `pauseStart` toggles through all three with no toggle
  word; with `playStartAction: restart`, a click while stopped restarts and a click while paused resumes (`pauseStop`). An
  event in two lists of the same kind is a validation error.
- The gate is a condition on every driver, not an event — it remembers INTENT (above), and applies in `play` mode and to
  the api alike. `inView` / `outOfView` are therefore not events; `load` is.
- WHEN × WHAT compose: `completeIterationOnPlayStop` decides when, `playStopAction` what; no combination is special.
- Booleans only for boolean facts (`completeIterationOnPlayStop`, `showFirstFrameBeforePlayStart`); exclusive choices are enums.
  `continue` and `pause` are not play actions: the lists say them (do not list `hoverOut`; use `pauseStart`).
- The api: `play()`, `pause()`, `stop()` take NO per-call config — they follow the effective timeline; a runtime change, if
  ever wanted, is `updateTimeline(patch)`. `finish()` stays (a seek to the end); `playOnce()` stays (one pass whatever
  `iterations` say).
- ONE executor in core (`applyOn` / `applyOff`, the generalised `applyDeclarativeAction`) serves the declarative resolver,
  the web triggers and the api — `rewind` and the iteration completion exist once.
- Editor note (T3b): a new hover trigger puts `hoverOut` in `pauseStart`, so the default feel stays "pause on leave".

**On the surfaces.**

| | spelling |
|---|---|
| component | `playOnTrigger?: boolean \| PxTrigger` (an object REPLACES the file's trigger — its keys are coupled); `timeline?: PxTimelinePatch` (MERGES: timing, the play keys and the gate are independent knobs with defaults); beside `play` / `pause` / `playerRef` / `playCurrentProgress` / `playCurrentTime`. `playMode` and `completeIteration` are gone — they are timeline keys now |
| web | `createSvgAnimationPlayer({ playOnTrigger?, timeline? })`; the handle `play()`, `pause()`, `stop()` |
| core | the one executor; the enums `PxPlayStartAction`, `PxPlayStopAction`, `PxPlayFinishAction` beside the existing `PxOutOfViewAction` |
| CSS components | keep their per-event props; `rewind` and the iteration completion act as `continue` there (a class toggle cannot run keyframes backwards or count iterations) — the precedent `reverse` already has |

**What replaces what.**

| today | D5 |
|---|---|
| `playMode: 'forwards'` (default) | the defaults (`playStartAction: 'resume'`, `playStopAction: 'reset'`) |
| `playMode: 'backwards'` | `timeline={{ playStartAction: 'jumpToEnd', playStopAction: 'rewind' }}` |
| `playMode: 'both'` | `timeline={{ playStopAction: 'rewind' }}` |
| `playMode: 'none'` | `timeline={{ playStartAction: 'jumpToEnd' }}` |
| `completeIteration` | `timeline={{ completeIterationOnPlayStop: true }}` |
| `direction` | `iterationDirection`, same values |
| `fillMode: 'forwards'` + `finish: 'hold'` | `playFinishAction: 'hold'` (the defaults) |
| `fillMode: 'both'` | + `showFirstFrameBeforePlayStart: true` |
| `fillMode: 'none'`, `finish: 'reset'` | `playFinishAction: 'reset'` |
| `fillMode: 'backwards'` | `showFirstFrameBeforePlayStart: true` + `playFinishAction: 'reset'` |
| `trigger.start: 'load'` / `'hover'` / `'click'` / `'manual'` | `playStart: ['load']` / `['hoverIn']` / `['click']` + `pauseStart: ['click']` / `trigger: {}` |
| `hoverEnd: 'pause'` / `'reset'` / `'reverse'` / `'continue'` | `pauseStart: ['hoverOut']` / `playStop: ['hoverOut']` (+ `playStopAction: 'reset'`) / … + `playStopAction: 'rewind'` / `hoverOut` not listed |
| `trigger.outOfView`, `inViewThreshold`, `inViewDebounce` | `outOfViewAction` + the two, one level up in `timeline` |
| `cancel()` | `stop()` per the timeline — or kept as the unconditional reset-now (open) |
| — | new: `playStartAction: 'restart'` (replay on every click — hands-on B9); `playFinishAction: 'rewind'`; the iteration completion reachable from a trigger (the case that started this) |

**The types** (the TS view; the schema spells the same with stated defaults):
```ts
/** An interaction the trigger listens for — an OPEN list: a new interaction is a new member, never a new key. */
enum PxTriggerEvent { load = 'load', hoverIn = 'hoverIn', hoverOut = 'hoverOut', click = 'click' /* later: keyboard, focus, app events */ }

/** `timeline.trigger` in the file, and the object form of `playOnTrigger` — WHEN. */
type PxTriggerEvents = PxTriggerEvent | Array<PxTriggerEvent>;   // one, or several — like `animate`'s references
interface PxTrigger {
    playStart?: PxTriggerEvents;               // acts when stopped
    playStop?: PxTriggerEvents;              // acts when playing or paused
    pauseStart?: PxTriggerEvents;              // acts when playing
    pauseStop?: PxTriggerEvents;             // acts when paused; absent = a copy of `playStart`
}

enum PxPlayStartAction    { resume = 'resume', restart = 'restart', jumpToEnd = 'jumpToEnd' }
enum PxPlayStopAction   { reset = 'reset', rewind = 'rewind' }
enum PxPlayFinishAction   { hold = 'hold', reset = 'reset', rewind = 'rewind' }
enum PxOutOfViewAction { pause = 'pause', continue = 'continue', reset = 'reset' }      // as today

/** The time timeline (every key with a stated default). */
interface PxTimeTimeline {
    type?: 'time'; engine?: PxTimelineEngineSetting; frameRate?: number;
    inTime?: number; outTime?: number; playDuration?: number; delay?: number;
    iterations?: number | 'infinite'; iterationDirection?: PxPlaybackDirection;
    playStartAction?: PxPlayStartAction;              // default resume
    playStopAction?: PxPlayStopAction;            // default reset
    completeIterationOnPlayStop?: boolean;       // default false
    playFinishAction?: PxPlayFinishAction;            // default hold
    showFirstFrameBeforePlayStart?: boolean;       // default false; never written by the Editor
    outOfViewAction?: PxOutOfViewAction;        // default pause
    inViewThreshold?: number;                   // default 0.5
    inViewDebounce?: number;                    // default 150
    trigger?: PxTrigger;                        // default { playStart: ['load'] }
}
// component:  playOnTrigger?: boolean | PxTrigger;  timeline?: PxTimelinePatch (= PxPatch of the timeline minus `trigger`)
// web:        createSvgAnimationPlayer({ playOnTrigger?, timeline? });  play(); pause(); stop()
```

**Examples.** A looping icon in a FILE — plays while hovered, finishes its beat when the pointer leaves, a click toggles
it, the gate pauses it while scrolled away:

```json
{
  "type": "svg",
  "animator": {
    "timeline": {
      "outTime": 1200, "iterations": "infinite",
      "completeIterationOnPlayStop": true,
      "outOfViewAction": "pause", "inViewThreshold": 0.5, "inViewDebounce": 150,
      "trigger": { "playStart": ["hoverIn", "click"], "playStop": "hoverOut", "pauseStart": "click" }
    }
  },
  "children": []
}
```

A one-shot icon in a file — the trash-can lid: opens on hover, closes (plays back) when the pointer leaves:

```json
{ "timeline": { "outTime": 400, "playStopAction": "rewind", "trigger": { "playStart": "hoverIn", "playStop": "hoverOut" } } }
```

The component, driven by state — the same words for the same transitions:

```tsx
// a spinner: runs while busy; when busy ends it finishes the current turn, then rests
<SvgAnimationPlayer doc={spinner} play={busy} timeline={{ completeIterationOnPlayStop: true }} />

// the lid from React state: plays to the end on enter, plays BACK on leave   (today: playMode="both")
<SvgAnimationPlayer doc={lid} play={hovered} timeline={{ playStopAction: 'rewind' }} />

// overlay art: appears instantly, retreats animated                            (today: playMode="backwards")
<SvgAnimationPlayer doc={art} play={open} timeline={{ playStartAction: 'jumpToEnd', playStopAction: 'rewind' }} />

// a heartbeat with two buttons: Pause freezes it (the freeze axis), Stop lets the beat finish first
<SvgAnimationPlayer doc={beat} play={running} pause={paused} timeline={{ completeIterationOnPlayStop: true }} />

// a splash that must replay on every click — the start-edge restarts instead of resuming
<SvgAnimationPlayer doc={splash} play={splashing} timeline={{ playStartAction: 'restart' }} onFinish={() => setSplashing(false)} />

// the trigger driver with the file's trigger replaced, the play keys adjusted
<SvgAnimationPlayer doc={icon} playOnTrigger={{ playStart: 'hoverIn', playStop: 'hoverOut' }} timeline={{ completeIterationOnPlayStop: true }} />
```

```vue
<SvgAnimationPlayer :doc="spinner" :play="busy" :timeline="{ completeIterationOnPlayStop: true }" />
```

The web player — the timeline is given once; the calls follow it:

```ts
const player = createSvgAnimationPlayer({ doc, container, timeline: { completeIterationOnPlayStop: true, playStartAction: 'restart' } });
player.play();      // from the start
player.stop();      // finishes the current iteration, then rests
player.stop();      // already stopping — nothing more to do
player.play();      // from the start again
```

**Editor impact (kf) — surveyed 2026-10-26** (`app/src` unless said; counts = lines touching the changed keys):

| layer | what is there today | what D5 changes |
|---|---|---|
| **model** — `svgeditor/animation/Types.ts` (25), `TSvgSvgAnimationAttr.tsx` (37) | the choice tables `AnimTriggerStart`, `animationHoverEndAction`, `animationOutOfViewAction`, `animationDirection`, `animationFillMode` (built with `createSchemaChoices` from the player's schema defaults); `TSvgSvgAnimationTriggerAttr` with `start` / `outOfView` / `hoverEnd` (`TStrValue`) and `inViewThreshold` / `inViewDebounce` (`TNumValue`, `writeWhenDefault`), the write-time pruning rule (hoverEnd only for hover; thresholds only while gated), `getStartOn()` / `setStartOn()` / `unsetStartOn()` used by exporters, previews and the export config; `isNoJsCssOutActionSupported` / `isNoJsCssOutOfViewSupported` (what pure-CSS export can do); the timeline attr with `iterations`, `direction`, `fillMode` (and Reset on Finish) | new choice tables for `PxTriggerEvent`, `PxPlayStartAction`, `PxPlayStopAction`, `PxPlayFinishAction`; the trigger attr becomes four event-list attrs (a new value type: one event or several — `TStrValue` cannot hold a list) with the gate attrs moved to the timeline attr; the pruning rule becomes "thresholds only while `outOfViewAction` ≠ continue"; `getStartOn()` and friends replaced by list queries (`hasEvent(playStart, hoverIn)`); the no-JS capability check per ACTION (`rewind`, the iteration completion unsupported in pure CSS); `direction` → `iterationDirection`, `fillMode` + Reset on Finish → `playFinishAction` (+ `showFirstFrameBeforePlayStart` read-only, never written) |
| **serialization** — `schema/PxSchemaUtil.ts`, `coverage/PxSchemaFullCoverageDoc.ts`, `schemaexplorer/brokenExamples.ts`, fixtures (`effect.retime.nested.fixtures.ts`, the atest `01-app-lifecycle/.data`) | key constants derived from the schema (`PxTriggerSchemaKeys`, `PxTimeTimelineSchemaKeys`); the full-coverage round-trip fixture; the catalogue of broken examples (trigger values); stamped fixtures | the constants follow the player's schema by themselves; the writer emits the new keys (the string / array rule); OLD files convert on open through the player's wire step — nothing to do in the reader; restamp the fixtures `a.b.1`, regenerate the field universe (`PxSchemaFieldUniverse.gen.spec.ts`), re-settle the feature-explorer cases, re-migrate the test corpora (`tools/migrate-px-current.mjs`; 268 fixture JSONs carry trigger keys — most convert on read, the expected-output ones regenerate) |
| **right panel** — `kf/app/right/svg/animation/SvgTriggerFields.tsx` (9), `SvgSvgAnimationAttrs.tsx` (5), `SvgTimelineFields.tsx` | Start (choices suffixed "(CSS)" / "(JS)" by no-JS support), Hover End (only for hover), Out of view, Threshold, Debounce, Reset on Finish; Loop / iterations, Direction, Fill mode; the section's summary line ("loop 2×, reverse, fill both"); test ids `animation.start.start.*` | four multi-selects (Play on · Play off · Pause on · Pause off, each event marked CSS / JS); Play-on action, Play-off action, Complete iteration on play-stop, Play-end action (replaces Reset on Finish AND Fill mode), Out-of-view action + the two numbers; Iteration direction; new summary words; the editor's default for a new hover trigger puts `hoverOut` in `pauseStart`; new test ids → the e2e DSL (3 atests drive `animation.start.start.*` today; the trigger dropdowns have no option ids for `hoverEnd` / `outOfView` — a chance to give the new fields ids) |
| **pre-rendered exporters** — `serialization/players/SvgJsCssPlayerSerialisationUtil.tsx` (32), `SvgCssAnimationBuilder.ts` (8), `kf/export/ExportSvgContent.tsx` (11), `TExportConfig.tsx` (6), `preview/players/exportedSvgTrigger.ts`, `ExportPreviewContent.tsx`, `savePreviewDemoHtml.ts`, `DevAppIframePreviewPanel.tsx`, `export/video/FrameSvgSource.ts` | the SVG+JS / SVG+CSS trigger snippets (hover / click / scroll restart, `hoverEnd` / `outOfView` handling, `resetOnFinish`); `fillMode` → `animation-fill-mode`; the export dialog's OWN copy of the trigger (`stOn`, `outOfView`, `resetOnTrigger`, `useJsTriggers`, `fillMode`); the preview's cue ("hover to play") derived from `start`; `data-px-meta` carrying the timeline | snippets generated from the lists × actions — `rewind` is already feasible there (the hover-`reverse` snippet drives `playbackRate: -1` through `getAnimations()`), the iteration completion is new (`animationiteration`); fill-mode from (`showFirstFrameBeforePlayStart`, `playFinishAction`); the export config mirrors the new keys (or stops duplicating the model — a chance to simplify); the cue from the `playStart` list; `data-px-meta` carries the new keys by itself |
| **dev tools & tests** — `kf/common/development/triggerexplorer/*` (`triggerRows.ts` 46, `TriggerCell.tsx`, `triggerIframe.ts`, `triggerCheck.ts`, `DevTriggerExplorer.tsx`), `specs/visual/TriggerCellDriver.ts` (22), `trigger-explorer.flaky.spec.ts` (61 rows), `karma/TestSvgaAnimationTrigger.karma.tsx`, `demo/SvgAnimationPlayerDemo.tsx`, `googscript/animation-json-example.ts`, `DevHelpView.tsx` | the trigger CONTRACT matrix: rows = start × `hoverEnd` × `outOfView`, driven by a cell driver that mirrors the player's two-axis rule | rows regenerated for lists × actions (a larger space — pick representative rows: each event in each list, each action, the gate's three values, the toggle, complete-then-rewind); the driver's rule becomes the state rule; the karma test and the demo follow |
| **converters** — `svgeditor/convertor` | Lottie ↔ SVGA maps neither triggers nor the timeline's direction | unaffected |
| **e2e & videos** — `tests/atest` (3 scripts + 268 fixture JSONs), `tests/video` (10 scripts / generator files, the narration "Start, set to mouse over…", the annotate chips) | | the 3 scripts follow the new ids; fixtures as above; the trigger and React learn videos re-recorded (narration names the new fields) |
| **website editor docs** — 9 pages (`175-playback-settings`, `140-animation`, `165-loop-animation`, `015-quick-start`, `180-save`, `185-choosing-a-format`, `220-useful-info`, `170-animation-techniques`, `050-color`) | Start / Hover end / Out of view / Fill mode as the editor shows them | rewritten with the new fields; screenshots via the e2e MCP |
| **harness** — `kf/common/test/VscPreviewApp.ts` | passes a `data-px-timeline` JSON string (+ `resetTimeline`, already pending) | the new keys flow through; the string is parsed on its side (T3b) |

Order that keeps the Editor shippable at each step: player wire step + core enums + executor → the Editor's model + writer (files
convert on read meanwhile) → right panel → exporters → trigger explorer and tests → videos and docs.

**Costs.** A wire step (1.9) with a conversion step in `PX_WIRE_STEPS`: the trigger block restructured into the lists
(`start: hover` + `hoverEnd: X` → `playStart: ['hoverIn']` + (`X` = pause → `pauseStart: ['hoverOut']`; reset / reverse →
`playStop: ['hoverOut']` + `playStopAction`; continue → nothing), `start: load` → `playStart: 'load'`, `start: click` →
`click` in `playStart` and `pauseStart`, `start: manual` → `trigger: {}`; a single event is written as the string, several as the array); the gate keys moved up (`outOfView` → `outOfViewAction`);
`direction` → `iterationDirection`; `fillMode` + `finish` → `playFinishAction` (+ `showFirstFrameBeforePlayStart`); the three new
play keys. The editor: the trigger panel (one multi-select per list), the timeline panel (the play keys, the gate), the
default `hoverOut` → `pauseStart`. The CSS export's fill-mode mapping. The executor refactor in the web triggers and the
visibility gate; the handle (`stop`); docs. Props: `playMode` + `completeIteration` go (22 → 20).

**Decided 2026-10-26 (owner):** reuse, never duplicate — the export dialog builds on the model's trigger attr and the same
fields; a CLEAN cut everywhere — no aliases, no deprecated props, nothing that accepts the old spelling.

**Decided 2026-10-26 (owner) — the remaining questions:**
1. Files: the version bump WITH a `PX_WIRE_STEPS` conversion (the repo's policy; it opens the owner's development files and the
   fixtures) — the one place a conversion exists; everything else is a clean cut.
2. Right panel: each of the four lists is its own field with its own choice control (no matrix).
3. Labels: designer words in the UI — "Play on / Stop on / Pause on / Resume on" for the lists; "Play Action / Stop Action /
   End Action" for the actions; code words in the file.
4. Sections: the attribute panel is flat, so two sections — **Playback Triggers** (the four lists, Out of view + the two numbers) and
   **Playback Behaviour** (the three actions, Complete iteration, Iteration direction, Loop) — no nesting.
5. Editing defaults as today: ticking "hover in" under Play on auto-adds "hover out" under Pause on, editable; a new document is
   `playStart: 'load'` + the gate defaults.
6. The "(CSS)" / "(JS)" marks keep their mechanism, applied to events and actions: works in both → marked so; JS only → marked so.
7. `showFirstFrameBeforePlayStart`: no UI at all — the editor cannot author that state.
8. Export dialog: the export-time trigger override stays, built from the model's trigger attr and the same fields — one implementation.
9. CSS components: the same trigger shape as the file; `rewind` and Complete iteration act as `continue` there, and the editor's UI shows the limit.
10. `cancel()` stays — the unconditional hard reset (navigation).

**Later:** `inView` as an INTENTIONAL event ("replay every time it scrolls in"); a per-event action (`{ on: 'hoverOut',
playStopAction: 'rewind' }` entries) if the shared one proves too coarse.

**Precedent** (for the record): the shared action vocabulary between trigger and api is GSAP ScrollTrigger's practice
([`toggleActions`](https://gsap.com/docs/v3/Plugins/ScrollTrigger/) uses the tween's own method names); Rive
[listeners](https://rive.app/docs/editor/state-machine/listeners) and dotLottie
[state machines](https://docs.lottiefiles.com/en/format/dotlottie/interactivity/state-machines/specification) map
events to actions; a restart waits the delay again in CSS and WAAPI (GSAP's [`restart(includeDelay = false)`](https://gsap.com/docs/v3/GSAP/Tween/restart()) is the outlier).
The action-keyed lists, "no new container" and the moment-named keys are the owner's calls.

### D6 — superseded 2026-10-28: see [playback-layers.md](./playback-layers.md)

The `actions` + `trigger` proposal written here on 2026-10-27 was refined into layers 0 and 1 of
[playback-layers.md](./playback-layers.md) ("improved D6": `triggers` plural, `beforeStart` a timeline
key, `jumpToFinished`, `suspend` / `wake` for the gate, `togglePlay` / `togglePause`, element targets).
That document is the one to implement; it also lists the 1.9 → layers mapping and the Editor model.

## TODO

| # | What | Notes |
|---|---|---|
| T1 ✅ | **`PxTimelinePatch` typed from the schema — done 2026-10-25** (was `Record<string, unknown> \| null`) | `PxPatch<T>` = the merge's RFC 7386 contract as a type: every key optional at every depth, `null` deletes, arrays and primitives replace, distributes over a union (time \| scroll \| view). `PxTimelinePatch = PxPatch<DistributiveOmit<PxTimeline, 'trigger'>> \| null`; `PxTriggerPatch` from `PxTrigger`. The merge still parses records (the string form); `uncheckedPatch` names the ONE boundary where a record becomes a patch, like `uncheckedConfig`. Guard: a type test in `PxAnimatorConfigPatch.test.ts` — `{ strat }`, `{ iterations: 'forever' }` and `timeline.trigger` are `@ts-expect-error`s |
| T2 ✅ | `PxAnimatorConfigPatch` typed — done 2026-10-25 | `PxPatch<PxAnimatorConfig> \| null`: `timeline` (trigger included at this level), `definitions`, `bindings`, `version` — the tests that patch definitions and bindings compile as they are |
| T3a ✅ | **Player packages — done 2026-10-25.** `trigger` on every surface, the ten shortcuts gone | core: `PxTriggerPatch` (typed from `PxTrigger`), `PxPlaybackOverride` = `timeline` + `trigger` + `resetTimeline`, `foldTimelineOverride(timeline, trigger)` — a `trigger` key wins over one inside the string form; `PxTimelineShortcuts` deleted. Web options; React / Vue / RN components; both CSS components take `trigger?: PxTrigger` (defaults filled). Tests rewritten with the API: typecheck clean on all five packages, core 426 · web 216 · react 68 · vue 49 · rn 42 |
| T3c ✅ | **D3 in the player packages — done 2026-10-25.** `timeline` / `mergeTimeline`, `trigger` / `mergeTrigger`; `resetTimeline` gone | core: `PxTimelineOverride` and `PxTriggerOverride` (each pair exclusive by type), `PxPlaybackOverride` = both, `PxPlaybackOverrideFields` (the plain all-optional view a runtime props object is), `PxTimelineWithoutTrigger`; `applyPlaybackOverride(doc, fields)` → `{ doc, warnings, conflicts }` — per block the replacement first (delete, then set; a timing replace carries the file's trigger over), then the merge through the existing rules; the string form parsed, bad JSON reported, never thrown. Deleted: `foldTimelineOverride`, `resetTimeline`, `applyAnimatorConfig`'s reset option, web `PX_ANIMATOR_RESET_KEY`. New diagnostic PX1504 `overrideConflict` (both of a pair set → both applied, warned). Web options / page options, React, Vue and RN props are now intersections of the shared types (`interface extends` cannot take a union). Verified: typecheck clean on all five packages; core 735 · web 211 · react 68 · vue 49 · rn 42; exclusivity as `@ts-expect-error`s, the runtime conflict through a JS-style caller (web) |
| T3d ✅ | **D4 in the player packages — done 2026-10-26.** `playOnTrigger: boolean \| PxTrigger`, `playerRef`, `playCurrentProgress` / `playCurrentTime`, `timeline` merge-only; D3's pair gone | core: `PxPlaybackOverride` = `{ timeline?: PxTimelinePatch }` (no string form — a JS caller's string is reported as `timelineOverrideIgnored`, never written), `PxPlaybackOverrideInput` adds `playOnTrigger`; `applyPlaybackOverride` = the timing merged, then a trigger object deleted-and-set as a WHOLE; `PxControlProps` renamed the position props and carries the `playOnScrollTimeline` TODO line; deleted `PxTimelineOverride` / `PxTriggerOverride` / `PxPlaybackOverrideFields` / `PxTriggerPatch` and PX1504 (unpublished). Web: options and the page scan take the object form (`createSvgAnimationPlayersFromPage({ playOnTrigger: {…} })` = one trigger for every player). React / Vue / RN: `playerRef`, the two renames, the object form (`[Boolean, Object]` in Vue), one content key in RN. Verified: typecheck clean on five packages; core 735 · web 209 · react 68 · vue 49 · rn 42 — type guards: no trigger and no unknown key inside `timeline`, no unknown key in the trigger object; the control-mode warnings name the new props |
| T3b ⏳ | The rest — **waiting until the API settles** (owner, 2026-10-25: more changes may come) | docs (`playback-and-triggers.md` has a `px-check props PxTimelineShortcuts` marker; the props blocks and guides), docs-examples (`css-svgr`, `override-*`), the full `pnpm build` (docs-check is red until the docs follow; `mangle-reserved.json` regenerates then), kf (6 sites), the videos (16), the website (13). Until then hello-react runs the local source and is the test bench |
| T4 | Guard: a type test next to `PxDocumentInput.test.ts` | `trigger={{ start: 'hover' }}` compiles; `trigger={{ strat: 'hover' }}` and `timeline={{ trigger: … }}` are `@ts-expect-error`; `timeline={{ iterations: 'forever' }}` too. Seen failing before the fix |
| T5 | Remove `animation as any` from the docs-examples React / override cases (hands-on F1) | six files; the cast hides exactly the kind of type error T4 wants |
| T6 | Fix the `PxControlMode.static` comment (hands-on F2) | "the document's trigger decides" — the code takes it over |

### How the raw record happened (T1)
`PxTimelinePatch` arrived in `251a888` (2026-09-12, "Improve schema"), three days after the override
shipped. The merge wanted three things the wire type does not say — every slot optional at every
depth, `null` meaning "delete this key", and a JSON-string form for HTML attributes and mangled
builds — so it took the merge's own input type (parsed JSON, a record) and exported it. Nobody
wrote the patch type; the `@public` tag made the record look intentional, and `docs-check` only
checks that the docs match the `.d.ts`, not that the `.d.ts` says anything. The result: the one
nested override has no autocomplete and no checking, while every flat shortcut is typed — the
opposite of what the shapes deserve.

### The same pattern elsewhere — audited 2026-10-25

| Where | Verdict |
|---|---|
| `PxAnimatorConfigPatch` (core, same file, line 31) | ✅ T2 |
| `timeline?: PxTimelinePatch \| string` on React (`SvgAnimator.tsx`), Vue (`SvgAnimator.ts:150`, `[Object, String]`), RN (`SvgAnimator.tsx:64`), web options | ✅ typed through T1; the `string` form is a separate question (below) |
| `PxWebApiScrollTimeline.rangeStart / rangeEnd: Record<string, unknown>` (web `engines/PxAnimatorWebApi.ts:182`) and `PxScrollDriver.ts:37–41` | ✅ 2026-10-25 — `PxNativeRangeOffset` (`shared/PxAnimatorWebTypes.ts`: `rangeName?` + `offset: CSSNumericValue`) and `PxNativeTimelineOptions` for the `ScrollTimeline` / `ViewTimeline` constructor — browser API the DOM lib does not type yet, declared locally |
| renderer prop bags — React `SvgAnimator.tsx:168`, Vue `SvgAnimator.ts:248`, RN `toRnProps` | legitimate: DOM / native props handed to the framework |
| core casts while repairing open JSON — `PxAnimatorConstants.ts:750, 753, 799, 816`, `PxAnimatorTypes.ts:1999` | legitimate per the schema-cast rule (open JSON reads as `Record<string, unknown>`, then a cast earns the type) |
| `PxSchema.ts`, `PxWireVersion.ts` (`unknown` throughout) | legitimate: the schema framework and the migrations work on unknown input by definition |

### Where the shortcuts are used today (T3 sites)

| Place | Lines with a shortcut prop |
|---|---|
| player `docs/` | 12 |
| `examples/docs-examples` | 2 |
| player packages (the declarations + fold) | core 1 · react 1 · vue 1 |
| kf `app/src` | 6 |
| kf `app/tests/video` (scripts + projects — the videos then re-record) | 16 |
| website `src` (code tabs, synced docs) | 13 |

## Open questions

1. **`trigger` without `playOnTrigger`** — today `start="hover"` alone does nothing, silently
   (hands-on B3). Does `trigger={…}` imply `playOnTrigger`, warn without it, or stay a plain
   override? The D2 example keeps both.
2. **The JSON-string form** of `timeline` (`PxTimelinePatch | string`) — facts, 2026-10-26: added 2026-09-12
   with the override as a *property-mangling* workaround (a consumer's build that renames object keys would
   rename the patch's keys too; a string's contents survive, and the player parses it). Callers today: ONE doc
   line (`playback-and-triggers.md:307`) and kf's video-preview harness (`VscPreviewApp.ts`, a test tool), which
   passes a `data-px-timeline` attribute value straight through (26 generated preview pages carry one). The EDITOR
   itself: nowhere — not the SVG+JS export (writes only `doc`), not the preview players, website or examples. The player already has the proper defence for that rare setting —
   `mangle-reserved.json` + the "unrecognized keys" diagnostic (`docs/library/minification.md`). Claude
   recommends DROPPING the string form: the type becomes plain `PxTimelinePatch`, the harness parses on its side (T3b).
3. ✅ **`resetTimeline`** — removed with D3 (2026-10-25); `timeline={{ … }}` is the reset. kf's unused `data-px-reset` goes with T3b.
4. ✅ **`trigger={null}`** deletes the block, so the defaults return — `PxTriggerPatch` allows `null` at the root like any slot (decided with T3a, 2026-10-25).
5. **Vue** — `trigger` as an Object prop, same `PropType`; the CSS components (React and Vue) take the same object.

## Accepted limits

| Limit | Why it is fine |
|---|---|
| The file nests `trigger` inside `timeline`; the props split them | documented once; the type forbids the nested spelling, so there is no second way |
| A patch cannot express "replace the whole trigger block" except by naming every key | `null` + the keys you want is one line |
