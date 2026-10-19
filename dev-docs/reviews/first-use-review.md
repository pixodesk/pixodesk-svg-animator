# First-use review — the API, the schema and the docs through a newcomer's eyes

Status **2026-10-15** (two passes the same day: the exports and schemas, then every guide in
`docs/`). Done so far: §1+2, §3, §4 (player side), §7, §8 — each closes with a **Done** note.

Read as a first-time user would: the five packages' exports, the wire schemas, the component
props, then the guides end to end — `README.md`, `docs/library/*`, `docs/format/README.md`,
`docs/diagnostics.md`. Each item asks "would someone new trip on this?". The bar is consistency
inside the library first, then the conventions users bring from CSS / the Web Animations API,
`<video>`, Lottie, dotLottie and Rive.

Left out on purpose — settled by the earlier reviews: `doc`, `pathData`, `effects.text`, the
control-mode precedence itself, the trigger's two axes ([api-schema-review.md](./api-schema-review.md),
[api-surface-review.md](./api-surface-review.md), [schema-naming-review.md](./schema-naming-review.md)).
Where an item reopens a decided question, it says so.

- **Part 1** — the API and the schema (items 1–26)
- **Part 2** — how they read in the docs: sleek or clumsy (D1–D6)
- **Part 3** — statements in the docs that are wrong today (E1–E12, each checked against the code)

🔴 the user's expectation and the behavior disagree · 🟠 inconsistent surface — users will trip on
it · 🟡 smaller

---

## ⏰ Reminder — after the next player publish

The renames (§7 `SvgAnimator` / `Pixodesk.SvgAnimator`, §8 `bind`, §1+2 `playAsSaved`) are in the
packages but NOT published; these run on the PUBLISHED player and are fixed only after
`pnpm publish` + a version bump:

1. **kf** — bump `@pixodesk/svg-animator-*` in `app/package.json` and
   `unified-preview-player/package.json`; plain `yarn install` (never `--ignore-scripts`); the
   user rebuilds Electron.
2. **kf learn/tutorial videos** — the `.data` projects' `package.json` versions and the typed code
   lines in the video scripts still say `createAnimator` / `PixodeskSvgAnimator` / `autoplay`;
   update the scripts, then re-record with `yarn website:videos` (needs the kf dev server).
3. **website live cards** — `yarn website:real-ui` regenerates `cards.json` and copies the new
   player to `public/app/real-ui/` (the cards' markup still calls the old global until then).
4. **website players + docs** — `yarn website:svga-player` / `website:player` re-copy the
   published builds; `yarn website:svga-docs` re-syncs these guides (which now teach the new
   names) — sync only AFTER publishing, or the docs describe a player the site does not run.
5. **website code** — `src/scripts/real-ui.ts`, `src/scripts/px-anim-monitor.ts`
   (`__pixodeskAnimators` → `__pixodeskSvgAnimators`, the global), `src/layouts/new-design2/codeTabs.ts`
   and the `/new-design/svg-animator` code samples (`createSvgAnimator`, `playAsSaved`,
   component `SvgAnimator`). The file-format examples are already regenerated.
6. **old exports** — SVG + JS files exported with "external player" before the rename call
   `PixodeskAnimator.createAnimator(…)`: they need re-exporting; inlined-player exports keep
   working.

# Part 1 — the API and the schema

## 🔴 Expectation vs behavior

### 1 + 2. ✅ One start rule — the same file started differently per surface, and `autoplay` lied

- **Was:** `createSvgAnimator` followed the file's trigger; the components forced `start: 'none'`
  in every control mode except `autoplay` — so the same file played on the web and sat still in
  React, the docs worked around it in three places, and `autoplay` did not mean "play now" (with
  a `click` trigger it waited), unlike `<video>`, lottie, dotLottie and Rive.

**Done (2026-10-19), owner's rule: NOTHING plays until a line names the driver — on every surface.**

```tsx
createSvgAnimator({ src: 'wave.json', container: '#box' });                     // still — you own it, api drives
createSvgAnimator({ src: 'wave.json', container: '#box', playAsSaved: true }); // the FILE drives it

<SvgAnimator src="wave.json" />                 // still                       (unchanged)
<SvgAnimator src="wave.json" playAsSaved />     // the FILE drives it          (was `autoplay`)
```

- **`autoplay` → `playAsSaved`** everywhere: the prop, `PxControlProps`, the `PxControlMode`
  value, docs, examples (the docs-examples case is now `play-as-saved`). The name is the docs'
  own promise — "plays the file the way the editor saved it" — honest for every trigger kind
  (a click file "plays as saved" = waits for the click), and it shares the `play` prefix with
  the control props, so the IDE autocompletes the driver words together.
- **Web `createSvgAnimator` takes `playAsSaved` too** — same word, same default (off). Without a
  driver it builds still: core's `suppressTriggerStart` (the components' takeover patch, now ONE
  helper) forces `trigger.start: 'none'` after the caller's override. The old
  `timeline: { trigger: { start: 'none' } }` transport workaround dies.
- **`bind` (pre-rendered) takes it as well, and the Editor's SVG + JS export emits it** —
  `Pixodesk.SvgAnimator.bind({"playAsSaved": true, "doc": …})` — the driver named before the
  data. `loadTagSvgAnimators` passes it internally: a tag embeds a finished file, the file IS
  the driver, so the tag takes no such option.
- **Scroll-driven documents are exempt** from the suppression (web and bind): scroll is their
  named driver; a clock trigger pushed into a scroll timeline would only warn.
- **Rationale kept short:** a bare component gave playback an INVISIBLE source (option A,
  declined); a `playback: "file" | "playing" | "paused"` enum mixed a controller into a state
  enum (option D, declined); `create` CONSTRUCTS — `new Audio`, `new Animation()`, dotLottie and
  Rive constructors are all still by default, and the modern players (dotLottie, Rive,
  react-player) all default to not playing. Generated snippets carrying the explicit word is a
  feature: the line documents itself (owner).
- **Deferred, recorded here:** `play` / `pause` are still tri-state booleans (absent ≠ `false`);
  the single-boolean / visible-state rework ("no boolean whose absence means a third thing",
  owner) is a separate later item.
- **Breaking:** web callers that relied on self-start add `playAsSaved: true` (folded into the
  already-breaking SvgAnimator-rename publish); component users only recompile (`autoplay` →
  `playAsSaved`, same behaviour). Guards: the web no-driver test (seen failing under the old
  behaviour), the components' control-mode suites, docs-check on every renamed name.


### 3. ✅ The document type accepts keys the player drops

- **Where:** `PxSvgNode.animator` / `PxAnimatedSvgDocument.animator` are typed `PxAnimatorConfig`
  (`svg-animator-core/src/format/PxAnimatorTypes.ts`) — the RUNTIME view, which still has flat
  `duration`, `delay`, `iterations`, `fill`, `trigger`, `timelineSource`, `resetOnFinish`,
  `engine`, `frameRate`.
- **Why:** `animator: { duration: 2000 }` type-checks. `getAnimatorConfig` then removes it
  (`PX_FLAT_RUNTIME_VIEW_KEYS`, schema-naming-review §2.3) and `validateDocument` reports an
  unknown key. The format guide's import table offers `PxAnimatorConfig` as the type of "the
  `animator` block as a whole".
- **Do:** type the document's `animator` with the wire shape (`PxInfer<typeof
  PxAnimatorConfigSchema>`); give the runtime view an internal name and drop it from the public
  tables.
- **Done (2026-10-19):** `PxAnimatorConfig` = the written shape, and `PxSvgNode` /
  `PxAnimatedSvgDocument` take it as is, so `animator: { duration }` no longer type-checks. The flat
  view is `PxAnimatorRuntimeConfig` (`@public @advanced`, core only): what `getAnimatorConfig` and
  `flattenAnimatorTimeline` return and `nestAnimatorTimeline` takes. Public because those three
  are; the format guide describes it next to them. Schema and runtime unchanged. Guard:
  `PxAnimatorConfigWireType.test.ts`.

### 4. ✅ `duration` reads as speed, but it is the timeline's length

- **Where:** wire `timeline.duration`; the shortcut `PxTimelineShortcuts.duration` on
  `createSvgAnimator` and the three components; the Timing table in `playback-and-triggers.md`.
- **Why:** keyframe `time` is absolute ms, so a longer `duration` adds a still tail and a shorter
  one cuts the end. Designers expect that (After Effects, Lottie's out point); developers expect
  scaling (CSS `animation-duration`, WAAPI). No option changes speed — only `setPlaybackRate()`
  after creation (the api method is the ONLY speed control today; the format has never carried
  one) — yet the docs twice motivate the override with "the same file shown twice at two speeds".

**Design settled (owner, 2026-10-19) — two clocks, not a rename. Not yet implemented.**

Content time is what keyframes are written in (ms, unchanged, what the editor's timeline shows).
Play time is wall clock, derived. `duration` is replaced by a content WINDOW plus one wall span:

```js
timeline: { inTime: 500, outTime: 2500 }                      // play this window of the content
timeline: { inTime: 500, outTime: 2500, playDuration: 4000 }  // …remapped to 4 s of wall time
// today's  duration: 3000  ≡  inTime: 0, outTime: 3000 — strictly less expressive
```

- **`inTime`** — content ms, default 0 (absent = 0, per the stated-defaults rule).
- **`outTime`** — content ms. The Editor ALWAYS writes it; absent, the player derives it: the max
  RAW keyframe time across all animations (before loop expansion — loops then fill to it), and
  the old default (`PX_DEFAULT_DURATION_MS`) when there are no keyframe times to take it from.
- **`playDuration`** — wall ms for one pass of the window; default `outTime − inTime` (play time
  = content time unless remapped). A duration name on purpose: `in`/`out` are POINTS, the remap
  is a SPAN — `playTime` read as a third point. Effective rate = `(outTime − inTime) /
  playDuration`, and `setPlaybackRate()` multiplies on top, live.
- **Named `inTime` / `outTime`, not `startTime` / `endTime`** (owner + review, 2026-10-19):
  "in/out point" is the editing term with exactly our meaning (AE, Premiere, Lottie's `ip`/`op`);
  WAAPI's `startTime` means wall-clock scheduling (our `delay`), and "start" is already taken
  twice next door (`trigger.start`, the `start` shortcut). The api keeps `setPlaybackRate`
  (owner, same date): the signed factor IS the WAAPI/`<video>` semantic; Lottie's `speed` is
  unsigned with a separate direction, so that name would break what it borrows.
- **No `speed` factor in the schema** (owner): `playDuration` covers it; don't ship schema we may
  not need and then must support. Side benefit: an absolute span cannot collide with
  `retime.stretch`'s direction (`stretch: 2` = slower), which a rate key would have.
- **Known trade-off, accepted:** `playDuration` silently means a new rate when the window is
  edited. In the editor that is visible (it owns both values); hand-written overrides own it.
- **Iterations** play the window over `playDuration` each; `delay` stays wall-side, unchanged.
  Scroll timelines take the window and ignore `playDuration` — scroll owns the pace
  (accepted-limits row). `getCurrentTime()` / `setCurrentTime()` stay CONTENT ms (the one meaning
  of time); wall time is derived.
- **Fragments become a feature:** `inTime`/`outTime` deliberately play a slice, so the old idea of
  warning when the window cuts keyframes dies with the rename; the override shortcuts become
  `inTime` / `outTime` / `playDuration` (the `duration` shortcut goes with the wire key).
- **Editor (owner, 2026-10-19):** SVGA gains `inTime` support the way the Lottie side already
  has it (Lottie's `ip` — SVGA could not represent a nonzero in point until now, so the
  Lottie → SVGA conversion had nowhere to put it). On the right attrs panel: an `inTime` input,
  and a `playDuration` input whose placeholder shows the computed default (`outTime − inTime`)
  with an [x] button that unsets it (absent = not written).
- **Scope:** a wire-format change — schema + a `PX_WIRE_STEPS` conversion step (`duration` →
  `outTime`, mechanical), the engines' wall ↔ content mapping, the editor's writer/reader and
  attrs-panel UI, loop expansion, the export math, SCHEMA.json, docs.
- **Done in the player (2026-10-19):** schema (`PxTimeTimelineSchema` + scrollish shape), wire
  step 1.2 → 1.3 (`duration` → `outTime`; the player now AUTO-CONVERTS older stamped documents on
  load) with the legacy `timeline.duration` still read for unstamped files; the window resolves
  ONCE in `getAnimatorConfig` (flat view: `inTime` + `duration` = window length + `playDuration`),
  `normalizeBindings` shifts keyframe times by `inTime`, loops fill to `outTime`, and
  `playDuration` is an initial rate factor composed under `setPlaybackRate` in
  `finaliseAnimator`. BOTH engines take the full window — the WAAPI clipper already interpolates
  boundary values with easing splitting, so no accepted limit was needed. Scroll timelines take
  the window, ignore `playDuration`. Shortcuts and component props: `inTime` / `outTime` /
  `playDuration` replace `duration`. Guards: `PxAnimatorWindow.test.ts` (web),
  PxTimelineCompat §4 cases (core). Editor-side (kf) tracked above, in progress.
- **Done in the editor (kf, 2026-10-20):** the model gains `inTime` + `playDuration` attrs (flat
  runtime view; `duration` stays the window LENGTH), so the wire nests/flattens them for free;
  `getAnimInFrame`/`setAnimInFrame` are real (frames ↔ `inTime` ms) and `setAnimRange` is
  `[in, out]` like Lottie; the Lottie → SVGA conversion passes `ip` straight through (the
  in-point-to-zero normaliser is retired from the conversion path). Attrs panel: `In Time` input
  (placeholder 0) and `Play Duration` input (placeholder = the computed window length, [x] unsets;
  hidden for scroll timelines). The PRE-RENDERED SVG+CSS export BAKES the window: keyframes remap
  `[inTime, outTime]` → `[0%, 100%]`, playback starts at the window immediately (no
  `animation-delay` lead-in), and `playDuration` becomes the CSS shorthand duration
  (`getCssWallScale`); the `data-px-meta` stays the lossless carrier (raw keyframe times + the
  window), and SVG+JS needs no baking — the embedded player shifts at runtime. Guards:
  `window-export.spec.ts` (kf; wire round-trip + both CSS behaviours, both seen failing first).
  Note: a `<symbol>`'s own `meta.timeline.duration` (editor extension) deliberately KEEPS the
  `duration` spelling — it is a plain length, not a window.

### 5. The first snippet does not type-check

- **Where:** get-started §3 (React, React Native) and every component guide pass
  `doc={animation}` straight from `import animation from './animation.json'`; the `doc` props and
  `createAnimator`'s `doc` are typed `PxAnimatedSvgDocument`.
- **Why:** a JSON import widens every string to `string`, so `"engine": "auto"` no longer matches
  the literal union and TypeScript rejects the line a newcomer just pasted. The fix is a note
  under the snippet (cast with `as PxAnimatedSvgDocument`) plus a troubleshooting entry — i.e. the
  first-run path needs a cast and an extra import.
- **Do:** let the players accept what a JSON import produces — a widened input type for `doc`
  (e.g. `PxDocumentInput`, every literal union widened to `string`), validated at runtime as today.
  Keep `PxAnimatedSvgDocument` for authors who build documents in code.

### 6. Transforms have two spellings, and one of them has a trap

- **Where:** `docs/format/README.md` › Transforms; the library guides' examples.
- **Why:** `animate.transform` with record keyframes (`{ translate, rotate, scale }`) and per-part
  channels (`animate.translate`, `animate.rotate`, …) are both accepted. The library guides teach
  the per-part form (the bouncing ball on every page); the format guide teaches the record form,
  then says several per-part channels animated on one node are "last-write-wins — compose those by
  nesting `<g>`s". So the most natural thing a newcomer writes — animate `translate` and `rotate`
  separately on one element — is the one combination that breaks. The same page also says "every
  key has exactly one spelling — there are no short aliases".
- **Do:** show one form in every example (the record form, which is what the editor writes).
  Then either make per-part channels compose on one node, or warn when two are set together; and
  qualify the "one spelling" sentence (it is also untrue for the bare-string path value, the SVG
  transform string and kebab-case attribute names, which are all accepted).

## 🟠 Inconsistent surface

### 7. ✅ The brand is spelled four ways

| Where | Spelling |
|---|---|
| components (React, Vue, RN) | `PixodeskSvgAnimator`, `PixodeskSvgCssAnimator` |
| UMD global (`svg-animator-web/tsup.config.ts` `GLOBAL_NAME`) | `PixodeskAnimator` |
| packages, UMD file | `@pixodesk/svg-animator-*`, `pixodesk-svg-animator.umd.min.js` |
| types, data attribute | `Px…`, `data-px-animation-src` |

- **Rule proposed:** the brand goes into names that land unscoped in user code — the components
  and the global. Functions stay short because the package or the global scopes them:
  `PixodeskSvgAnimator.createAnimator()`, like `lottie.loadAnimation()`.
- **Do:** rename the global to `PixodeskSvgAnimator` (the only outlier — it already disagrees with
  its own file name). Keep `PixodeskSvgAnimator` for the components and `createAnimator` for the
  function. Every *SVG + JS* file the editor exports calls `PixodeskAnimator.createAnimator(…)`, so
  the editor's exporter changes in the same pass.
- **Not `createSvgAnimator`:** it repeats the package name in every import. "Svg" belongs in the
  component name, where it also leaves room for a Lottie component.
- **Done (2026-10-19), owner's rule instead — explicit "SvgAnimator" everywhere (a 2D/Lottie product sits next to it):**
  components `SvgAnimator` / `SvgCssAnimator` (props `SvgAnimatorProps`, `SvgAnimatorCallbacks`); functions
  `createSvgAnimator`, `loadTagSvgAnimators`, `getAllSvgAnimators`, `onSvgAnimatorsChange`, `createAdapterSvgAnimator`;
  the one `<script>` global is the namespace `Pixodesk.SvgAnimator`, where the create function is the member `create`
  (also in the pre-rendered builds — exports call `Pixodesk.SvgAnimator.create(…)`); the registry global
  `__pixodeskSvgAnimators`. The React / Vue `<script>` builds were removed (unused, bundled their own framework).
  `PX_PLAYER_GLOBAL` / `PX_PLAYER_CREATE` are the one spelling the build config and the Editor's exporter share.

### 8. ✅ One name, two functions

- **Where:** `index.prerendered.ts` exports `createPrerenderedAnimator` *as* `createAnimator`
  (`doc` only, binds to markup already on the page), next to the package's
  `createAnimator(PxAnimatorOptions)`.
- **Why:** done so the emitted script is byte-identical whichever bundle is inlined. But a user
  reading an exported SVG's script and then the docs sees one name with two signatures, and the
  full build's `createAnimator` *also* binds to existing markup when `container` is omitted.
- **Do:** give the bind entry its own verb (e.g. `bindAnimator`) in both builds; the editor's
  exporter emits that.
- **Done (2026-10-19):** the bind entry is `bindSvgAnimator` (npm) / `bind` on the `<script>` global, in every
  build — the pre-rendered ones carry only `bind`, the full one `create` and `bind`. SVG + JS exports call
  `Pixodesk.SvgAnimator.bind({"doc": …})` (`PX_PLAYER_BIND`), so a page may supply either build. `createSvgAnimator`
  still binds when `container` is omitted (unchanged).

### 9. Handle types: six names, and the docs explain them wrong

- **Where:** core `PxPlaybackApi`, `PxAnimatorApi`, `PxAnimatorHandle`; React `ReactAnimatorApi`,
  Vue `VueAnimatorApi`, RN `RnAnimatorApi` (all three = `PxAnimatorHandle`).
- **Why:** the framework prefixes break the `Px` rule. `PxPlaybackApi` is returned by nothing — it
  is only the base of `PxAnimatorApi` — although installation.md calls it "the smaller set of
  methods a pre-rendered player offers" (the pre-rendered `createAnimator` returns `PxAnimatorApi`).
  React hands the handle over through a custom `apiRef` prop; Vue uses its standard template `ref`.
- **Do:** two public names — `PxAnimatorApi` (web, full) and `PxAnimatorHandle` (components),
  re-exported under that name by each framework package; fold `PxPlaybackApi` into
  `PxAnimatorApi`. In React, consider the standard `ref` (React 19 takes `ref` as a prop;
  `forwardRef` before it) so React and Vue match.

### 10. Two booleans for one state

- **Where:** `PxControlProps.play` / `pause`; react.md › Declarative play / pause.
- **Why:** `play && !pause` plays, `pause` pauses, `play === false` holds. The guide's own
  example has to set both on every click (`setPlay(true); setPause(false)`), and four
  combinations describe two states.
- **Do:** one boolean — `playing` (or `paused`) — for the declarative mode.

### 11. Methods and events don't pair

- **Where:** `PxEngineCallbacks` / `PxAnimatorCallbacks` (core `PxAnimatorTypes.ts`).
- **Why:** `destroy()` fires `onRemove`. `onStop` fires after pause, cancel, finish or remove, yet
  there is no `stop()` — and Lottie users expect a `stop()` that rewinds.
- **Do:** `destroy()` ↔ `onDestroy`. Rename `onStop` to say what it means ("no longer playing,
  whatever the reason"), or at least say so in its TSDoc and the callbacks table.

### 12. Sibling components take different prop shapes

- **Where:** `PixodeskSvgCssAnimator` (React and Vue) takes `start`, `offScreen`, `mouseOut`,
  `visibilityThreshold`, `visibilityDebounce` as flat props; `PixodeskSvgAnimator` takes `start`
  flat and the rest only through `timeline={{ trigger: { … } }}`.
- **Do:** one shape for both — the same flat trigger props on `PixodeskSvgAnimator`, or `timeline`
  on the CSS component.

### 13. What is shown after the end is decided in two places

- **Where:** `timeline.fillMode` and `timeline.trigger.finish`; the runtime view calls the second
  `resetOnFinish`.
- **Why:** `fillMode: 'none'` (revert to the static SVG) and `finish: 'reset'` (snap back to the
  start state) answer the same question from two blocks under three names. Troubleshooting's "I
  want it to reset" offers both without saying how they differ. `finish` is also the only `trigger`
  key about neither starting nor running — `setupAnimationTriggers`' own TSDoc says "`finish` is the
  player's, not the trigger wiring's".
- **Do:** move `finish` next to `fillMode` in `timeline`, and say in both rows how they combine.
  Reopens the placement chosen in the trigger model.

### 14. No ready event, no duration getter

- **Where:** `PxAnimatorApi`; web-player › The playback API; react.md / vue.md › Controlled time.
- **Why:** with `src`, the only way to know the SVG exists is polling `isReady()`. There is no
  `getDuration()`, so every slider example hard-codes its maximum (`max="1000"`, `max={2000}`).
- **Do:** add `onReady` to the callbacks and `getDuration()` (one iteration, ms) to the handle;
  use it in the slider examples.

### 15. Five ways to check a document

| Function | Returns |
|---|---|
| `validateDocument(doc, { strict })` | `Array<string>` |
| `isValidPxDocument(doc)` | `PxValidationResult` — an object, despite the `is` prefix |
| `isPxDocument(doc)` | type guard |
| `diagnoseDocument(doc)` | findings |
| `validateNodeEffects(node, { strict })` | `Array<string>`, one part only |

The format guide's "Validating a document" opens with `isPxDocument`, `isValidPxDocument` and the
raw schema call (`PxAnimatedSvgDocumentSchema.isValid(json, ctx, [])`, a context object and a
bare `[]`), and reaches `validateDocument` — the one the library README recommends — last.

- **Do:** one public `validateDocument` returning `{ valid, errors, findings }` plus the
  `isPxDocument` guard; move the rest to `/internal`; lead the section with it.

### 16. Two version constants for one fact

- **Where:** `PX_WIRE_VERSION` (`{ a, b, c }`) and `PX_WIRE_SCHEMA_VERSION` (`'1.2'`), beside
  `PX_WIRE_BASELINE_VERSION`. api-surface-review §6.6 unified their prefix; the duplication stayed.
- **Do:** keep one public constant (`formatWireVersion` gives the string).

### 17. "Flatten" names two operations; the function for it names a third idea

- **Where:** `materializeAllInTree(doc, engine)`; format guide › Flattening a document.
- **Why:** the guide calls the job "flattening a document", the function is "materialize all in
  tree", and `flattenAnimatorTimeline` uses "flatten" for something else (nested `timeline` → the
  runtime view). The second argument is a playback-engine name (`'native' | 'js'`) used to mean
  "does the target renderer resolve `<use>` live" — so React Native must pass `'native'`, the word
  that means the Web Animations API everywhere else.
- **Do:** `flattenDocument(doc, { … })` with an option named for what it decides (e.g.
  `{ inlineUse: true }`); `flattenAnimatorTimeline` → a name about the runtime view.

## 🟡 Smaller

### 18. "Animator" is both the file block and the player instance

`animator.timeline.trigger.finish` (the file) and `animator.setPlaybackRate(-1)` (the instance
`createAnimator` returned) sit a paragraph apart in troubleshooting. Cheapest fix is in the docs:
name the instance variable `player` everywhere. The block's name is a wire rename and not worth it.

### 19. `PxAnimatedSvgDocument`

Long, and not always SVG — the root may be an HTML element. The functions already say "Px
document" (`isPxDocument`, `validateDocument`, `diagnoseDocument`); `PxDocument` would match them.

### 20. `loadTagAnimators`

"Tag animators" is our jargon. `createAnimatorsFromPage()` reuses the verb of `createAnimator` and
says where it looks; `PxTagAnimatorOptions` follows. Its handle is documented as
`element._px_animator` — an underscore property as public API.

### 21. Trigger words

- `offScreen` (the action) and `visibilityThreshold` / `visibilityDebounce` (its parameters) use
  two words for one concept.
- `mouseOver` / `mouseOut` name a mouse for something that also works with touch and pen. The docs'
  own prose says "hover" throughout, CSS says `:hover` (which the SVG + CSS export uses) and
  LottieFiles interactivity says `hover`.
- `start: 'none'` reads as "never"; the editor's label for it is "Manually from JS" — `manual`.

Cheapest before release; each is a wire rename plus a version step afterwards.

### 22. `loop` means something else here

Everywhere else `loop` repeats the whole animation; in the format it repeats one property's
keyframe segment, and whole repeats are `iterations`. A React user who writes `loop` gets a type
error; a Vue user gets a silent `loop` attribute on the `<svg>`, because Vue's `PixodeskSvgAnimator`
keeps the default attribute fallthrough (the CSS component sets `inheritAttrs: false`). Worth one
line in the component guides, and perhaps a dev warning for a `loop` prop.

### 23. The core entry is very wide

Engine internals — `createRunClock`, `seekCeilingMs`, `clampSeekMs`, `PX_RATE_REJECTED`,
`foldTimelineOverride`, `downgradeWireDocument` — are tagged `@public @advanced` and appear in
autocomplete next to the document types (raised in api-surface-review §3).

### 24. Vue's `start` prop restates the trigger values

`start: { type: String as PropType<'load' | 'mouseOver' | 'click' | 'none'> }`
(`svg-animator-vue/src/PixodeskSvgAnimator.ts`) instead of `PxTriggerStart` — a second copy of the
list that will drift.

### 25. Enum value spelling follows an unwritten rule

Our own values are camelCase (`mouseOver`, `offsetPath`); values borrowed from CSS keep CSS's
kebab-case (`alternate-reverse`, `entry-crossing`). Fair, but stated nowhere — one sentence in the
format guide's principles.

### 26. Effect names mix two patterns

`maskedBy` / `transformBy` ("this element is … by") beside `clipPath` / `repeater` / `strokeTrim`
(the thing itself). The difference partly mirrors reference vs inline geometry, but a newcomer sees
no rule.

---

# Part 2 — how it reads in the docs

**Verdict.** The entry point is sleek: `get-started.md` is one page, one package per stack, a
complete project per section with an *Open in StackBlitz* link, and nothing to configure. The
format's core idea also reads well ("delete every `animate` key and a valid static SVG remains").
Past those, the reference pages read like the review records they grew out of: they explain *why*
the API is consistent instead of simply being consistent, they surface internal machinery, and the
same shapes are written out in many places — which is how they drifted (Part 3).

### D1. The guides argue for the design, in maintainers' words

- Headings advertise consistency instead of naming a task: *Control modes — one rule*, *Callbacks
  and diagnostics — one shape*, *Time — one contract* (`docs/library/README.md`).
- The "Props and options across players" table — 6 columns × ~30 rows + 9 footnotes — is a parity
  checklist ("so a prop added or renamed in one place can be checked against the others").
- Type genealogy in user code blocks: "`PxDiagnosticsConfig` → `PxEngineCallbacks` →
  `PxAnimatorCallbacks`"; "it is core's `PxAnimatorHandle` under this package's name …, so they
  cannot drift apart".
- Internal functions named in user guides, to prove a single implementation:

  | Name | Mentions in `docs/library` + `docs/format` |
  |---|---|
  | `resolveControlMode` | 4 |
  | `PX_ANIMATOR_DOC_KEY` | 4 |
  | `controlModeTakesOverTrigger`, `applyAnimatorConfig` | 3 each |
  | `foldTimelineOverride`, `mergeAnimatorConfig`, `resolveTrigger`, `PX_TRIGGER_DEFAULTS`, `prepareDocumentForRender` | 2 each |
  | `PxInternalAnimatorOptions`, `createVisibilityGate`, `diffInEffect`, `planSchemaRelease` | 1 each |

- ▪ internal exports are listed in the user guides' "Everything else this package exports" tables,
  some with paragraph-long rationale (`PxInternalAnimatorOptions`) or as editor tooling ("the
  editor's 'equal in effect' comparison", the schema-release functions). In a public repo that
  reads as an editor's internals dump.
- **Do:** user guides show ● and ○ only, in task order; the parity table, the audience marks, the
  genealogy and the ▪ inventory move to `dev-docs/` (docs-check can keep checking them there).
  Write "every player behaves the same" once, in one sentence.

### D2. Several vocabularies for one thing

| Concept | Spellings met in the docs |
|---|---|
| one property's animation | `ANIMATE` (schema at a glance), `Animated<T>` (effects tables), `PxPropertyAnimation` (types), `PxAnimatable` (code), "property animation" (prose) |
| the document and its parts | `SVG_JSON` / `NODE` / `EFFECTS` / `GRADIENT` (glance pseudo-types) vs `PxAnimatedSvgDocument` / `PxNode` / `PxEffects` |
| the default timeline | `type: 'time'` vs "clock timeline", "clock-only keys", "clock fields" |
| what starts it | `mouseOver` / `load` in the schema vs "hover" / "scroll into view" in prose (README, vue.md, troubleshooting's "scroll trigger") |
| unfinished parts | "in development" ×8, "experimental" ×8, "under development" ×1, plus 🧪 |
| `animator` | the file block and the player instance (item 18) |

- **Do:** pick one word per concept and use it in the glance, the tables and the prose — the type
  names are the natural choice (`PxNode`, `PxPropertyAnimation`); `time` for the timeline; one
  status word with one badge.

### D3. The same shape is written out in many places, and the copies drift

`PxTrigger` (or its fields) is written out in the format glance, web-player's API reference,
react.md and vue.md (the CSS component), the library README's CSS-wrapper table and the playback
guide — and the `mouseOut` default disagrees in four of those places (E1). The callbacks block,
the options block and the handle are each repeated per guide too.

- **Do:** write each shape once (the format glance for wire shapes, the library README for the
  shared player shapes) and link to it. docs-check covers tables and reference blocks, but not the
  comments inside code blocks — which is exactly where the `mouseOut` default went wrong.

### D4. Order and placement

- The format page opens with layer theory (L0–L5, Rule 1, Rule 2) before the reference a newcomer
  came for.
- The core library — a developer API — lives at the end of the *format* page, ~350 lines down.
- The diagnostics codes page sits at `docs/` root, outside the library it belongs to.
- **Do:** reference first, principles after (or on their own page); the core library as its own
  page in `docs/library/`; the codes page next to it.

### D5. TSDoc pasted into guide code blocks

Signature blocks carry 5–12-line comments (`setupAnimationTriggers`, `createAnimator`, the rest-pose
step of `materializeAllInTree`, `PxInternalAnimatorOptions`). In a guide they bury the signature.

- **Do:** one-line comments in guide signatures; the explanation as prose under the block (TSDoc in
  the code can stay as it is — the IDE shows it).

### D6. What reads well — keep it

- `get-started.md` as it is (fix E10 only).
- The trigger page's two questions — *what starts it* / *whether it may run* — with the editor's
  labels beside each `start` value.
- The diagnostics `kind` table ("who fixes it") and the generated codes page.
- The override merge rules table, and troubleshooting organized by symptom.

---

# Part 3 — statements in the docs that are wrong today

Each checked against the code on 2026-10-15.

| # | Where | Says | Actually |
|---|---|---|---|
| E1 | react.md, vue.md (CSS component), web-player.md › API reference, format › Schema at a glance | `mouseOut` default `'continue'` | `PX_TRIGGER_DEFAULTS.mouseOut` is `'pause'` — as playback-and-triggers.md, the library README and the core reference say |
| E2 | format › Schema at a glance, import table | `PxTrigger` types `animator.trigger` | it lives at `animator.timeline.trigger` |
| E3 | format › Player effects › 1 — `text`, the example | `"definitions": { "glyphs": { … } }` | the key is `definitions.fonts` |
| E4 | format › Player effects › 2 — `textPath`, the example | `"path": "M20,100 …"` | the key is `pathData` |
| E5 | playback-and-triggers › Overriding from a player; react.md and vue.md › Playback overrides | the `timeline` override is "shaped exactly like the document's `animator` block" | it is shaped like `animator.timeline` |
| E6 | library README › API at a glance ("Show the same JSON animation twice …"); web-player › Loading several animations ("From code, give the second copy fresh ids yourself"); format › core reference (`generateNewIds`: "what you need before putting the same animation on a page twice") | call `generateNewIds` for a second copy | `createAnimator` with a container and both components already give every render fresh ids (`PxAnimator.ts`, React `prepareDocumentForRender`) — as format › Nodes itself says |
| E7 | installation.md › TypeScript | `PxPlaybackApi` is "the smaller set of methods a pre-rendered player offers" | the pre-rendered `createAnimator` returns `PxAnimatorApi`; nothing returns `PxPlaybackApi` |
| E8 | troubleshooting.md › Nothing plays | the console says `createAnimator: failed to load "…"` or `invalid animation document format` | those sentences no longer exist; the player reports PX1003 / PX1002 |
| E9 | diagnostics.md (generated from the enum) 1303, 1304, 1306 | `scroll.subject`, `animator.trigger` | the file spells them `timeline.subject`, `timeline.trigger` — the codes use runtime-view paths |
| E10 | get-started §3 React and React Native snippets | `doc={animation}` straight from a JSON import | does not type-check under TypeScript without the cast the note below it describes (item 5) |
| E11 | web-player › Options; playback-and-triggers › Overriding from a player | the override lets "the same file … play at two speeds" | no override key changes speed (item 4) |
| E12 | format › Animating — Keyframes | "Every key has exactly one spelling — there are no short aliases" | transforms have two spellings; path values, transform strings and kebab-case attribute names are also accepted (item 6) |

---

## Suggested order

1. **Part 3** — wrong statements; docs-only, no behavior change (E9 needs the enum's text).
2. **§3, §5** — types that reject what users write, or accept what the player drops.
3. **§1 + §2 together, then §4, §6, §14** — the first-run experience.
4. **D1–D5** — restructure the guides once the API settles, so the rewrite happens once.
5. **§7–§13** — the renames, in one pass with the editor (`kf/app` resolves the packages from
   source, and the exporter emits the global and the bind entry's name).
6. **§15–§17**, then the 🟡 list.
