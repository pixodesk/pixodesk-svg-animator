# First-use review — the API, the schema and the docs through a newcomer's eyes

Status **2026-10-15** (two passes the same day: the exports and schemas, then every guide in
`docs/`). Done so far: §1+2, §3, §4, §5, §6, §7, §8, §9 (types + docs; apiRef kept), §10 (play/pause/playMode/completeIteration + playOnce), §11 (onDestroy pairs destroy; onStop documented), §12 (flat trigger shortcuts everywhere), §13 (finish lives next to fillMode; wire 1.4), §14 (onReady + getDuration), §15 (one validateDocument → { valid, errors, findings }), §16 (one public PX_WIRE_VERSION; the string is internal), §17 (guide says "materializing"; no rename), §17a (prepareDocument pipeline, no WeakMaps; `resolveAnimatorTimeline` internal). §17b (no WeakMaps or global caches: motion-path segment tables owned per animator / per pass). §17c (documents earned as types: schema casts + type stamps + the `checked` stage; `any` 319 → 0 in shipped source and 373 → 0 in tests; ESLint `no-explicit-any` forbids it). — each closes with a **Done** note.

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

### 5. The first snippet does not type-check ✅

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
- **Done (2026-10-20):** `PxDocumentInput` = `PxAnimatedSvgDocument` with every literal widened to
  `string` and every tuple to an array (a recursive mapped type — one source, cannot drift), and
  `toAnimatedSvgDocument(doc)` names the one type-level narrowing to the strict type (runtime
  validation unchanged). Every `doc` input takes it: `PxAnimatorOptions.doc` (web create),
  `PxPrerenderedAnimatorOptions.doc` (bind), and the React / Vue / React Native `doc` props — each
  narrows once at its boundary. Docs: the cast notes in get-started / installation /
  troubleshooting / react-native / rn README became "a `.json` import passes as-is"; prop tables
  and signature blocks say `PxDocumentInput`; the strict type is positioned as the
  build-a-document-in-code type. Guard: `PxDocumentInput.test.ts` (core) assigns the exact
  JSON-import shape with no cast and keeps a `@ts-expect-error` proving the strict type still
  rejects it.

### 6. Transforms have two spellings, and one of them has a trap ✅

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
- **Investigated (2026-10-20, corrected same day), owner's question "does the Editor even
  produce per-part channels?":** the CURRENT writer never does — the editor model stores the
  parts separately (`TSvgTransformAttr`) but always FOLDS them into the one unified
  `animate.transform` record on write (`writeKeyframesPxAttr`, `InternalError(404)` if the fold
  bails). The ~50 learn assets (all but the hand-made `ball-typo.json`), the feature-explorer
  cases, the trigger fixtures and the website art generators are all record-form. BUT the
  per-key spelling is the descendant of the OLD editor's per-axis storage: ancient
  `data-px-attrs`-era files spell transforms per axis (`transform-translate`, `transform-scale`,
  top-level `rotation`), and the kf migrator (`tools/migrate-data-px-meta.mjs`) maps each axis
  onto `animate.translate` / `animate.rotate` / `animate.scale` — SEVERAL on one node when the
  old file animated several, which is exactly the last-write-wins case. The kf reader folds
  per-key channels back into the per-part model (a re-save normalises to the record form), so
  the trap bites only migrated-but-never-resaved old files fed straight to the player, plus
  hand-written documents following the guides (web-player.md's ball, `rn-expo`). Implication for
  the "Do": the per-key READ must stay (compat for migrated files), and those multi-axis
  migrated files argue for COMPOSE (or at least a diagnostic) over documentation alone.
- **Decision (owner, 2026-10-20):** get rid of the per-key form — out of the docs entirely; it is
  too ambiguous (what would `animate.translate` + `animate.rotate` with different timings even
  mean?). Independently-timed parts belong to `effects.transformBy`.
- **Done (2026-10-20):** every doc and example now teaches the record form only — web-player.md's
  ball, playback-and-triggers.md, the format guide's two `px-player` examples,
  `get-started/html-inline-json`, `rn-expo`, `react-native-preview-player` samples, the
  react-native.md support-matrix row, and the `PxAnimationDefinition` / `PxElementAnimation`
  JSDoc examples. The format guide's teaching paragraph became a **Deprecated** note (still
  read, for migrated files). The players now WARN: `validateDeprecatedTransformChannels(root)`
  (core, next to `validateNodeEffects`) + diagnostic **PX1107**, wired in the web create path
  and the RN `compileDocument` — so a migrated-but-never-resaved multi-axis file names itself
  instead of silently dropping a channel. Guard: `PxDeprecatedTransformChannels.test.ts` (seen
  failing first). NOT done (deliberately): the read stays — published docs taught the spelling,
  so dropping it is a format break for hand-written files; revisit at the next major if wanted.

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

### 9. Handle types: six names, and the docs explain them wrong ✅

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
- **Done (2026-10-20), types + docs only — NO functionality change:** `PxPlaybackApi` folded into
  `PxAnimatorApi` (it was returned by nothing); the three aliases (`ReactAnimatorApi`,
  `VueAnimatorApi`, `RnAnimatorApi`) are gone — each framework package re-exports
  `PxAnimatorHandle` itself, so the handle has ONE name everywhere. installation.md's wrong
  explanation ("the smaller set a pre-rendered player offers") removed; web-player.md's split
  signature block merged into one `PxAnimatorApi`; guides, package READMEs, px-check markers and
  every example swept. Owner's call: `apiRef` STAYS as the React/RN prop (the standard-`ref`
  idea is dropped); Vue keeps its template ref.

### 10. Two booleans for one state — REWORKED into the declarative playback proposal ✅

- **Where:** `PxControlProps.play` / `pause`; react.md › Declarative play / pause.
- **Why (original):** `play && !pause` plays, `pause` pauses, `play === false` holds — four
  combinations for two behaviours, and the guide's own example has to set both per click.
- **Trail (2026-10-20):** a first two-axis implementation (play=run/reset, pause=freeze, PX1502,
  shared `resolveDeclarativePlayback` rule) was built, then REVERTED by owner decision — the
  design below supersedes it; we start afresh on a go. Research kept in git history: nobody in
  the lottie/SVGator/Rive field ships declarative play state (config + ref + events is the norm);
  the full on/off permutation matrix collapsed to the small prop set below; `reverse`-as-a-prop
  died on the mount case ("rest at start" is inexpressible when reverse means a motion).

#### Proposed declarative playback API (settled 2026-10-20, awaiting go)

The key idea: **`play` names a STATE, not a command** — like a CSS class; *how* a state change
looks is the `playMode` config. Two worlds, told apart by the document's effective `iterations`:

**World 1 — one-shot (a single pass): `play` is a POSE switch.**
`false` = the START pose, `true` = the FINISH pose. A change moves to the new pose per
`playMode`, always FROM THE CURRENT FRAME (interruptions turn around smoothly — never
configurable, never a jump). On mount the component SHOWS the pose without animating (a
re-rendered list of icons must not all play at once).

**World 2 — loop (`iterations` > 1 or `infinite`): `play` is a RUN switch.**
`true` = running, `false` = stopped at rest (snap). There are no poses, so `playMode` does not
apply (usage warning if set).

| Prop | World | Meaning |
|---|---|---|
| `play?: boolean` | both | one-shot: which pose; loop: running or not |
| `pause?: boolean` | both | freeze the current frame NOW / resume from it — always immediate, never deferred |
| `playMode?: 'none' \| 'forwards' \| 'backwards' \| 'both'` | one-shot | which pose changes PLAY (animate) vs snap — default **`forwards`**: plays forwards, snaps back |
| `completeIteration?: boolean` | loop | an off first finishes the CURRENT iteration, then rests (off by default; re-on before the boundary cancels the pending stop) |

`playMode` deliberately reuses `fillMode`'s value spellings and side-mapping — `forwards` is the
toward-END side, `backwards` the toward-START side, `both`/`none` both/neither — read as plain
English each value states its own meaning: "plays forwards only", "plays backwards only",
"plays both ways", "never plays — snaps". (NOT named `fillMode`: that key already exists in the
timeline and answers a different question — see below. NOT `playDirection`: `timeline.direction`
is the run's direction. Not lottie's old `playMode: normal|bounce` — one docs note.)

**`playMode` vs `fillMode`, side by side** (both active on one tag): a toast icon popping in
after a delay — `<SvgAnimator play={visible} playMode="both" />` with
`timeline: { delay: 300, fillMode: 'backwards' }`. `visible` flips true → `playMode` says the
change ANIMATES (vs snap); during the 300 ms delay the run is active but before keyframe 0 →
`fillMode: 'backwards'` says WHICH PICTURE shows while waiting (first keyframe's pose, not the
raw static attrs). `playMode` picks whether a change travels; `fillMode` picks the picture at
rest around a run. Neither can express the other.

Config shortcuts stay as they are (`iterations`, `inTime`/`outTime`/`playDuration`, `delay`,
`timeline={{ … }}` for `direction` etc.); the ref gains ONE verb: **`playOnce()`** — always a
fresh single PASS from the start (even on loop-configured or finite multi-iteration docs),
ending per the file's `finish` action; re-entrant (a second call restarts).

#### Every case, one line each

```tsx
// ── one-shot ────────────────────────────────────────────────────────────────────────────
// Splash / stamp — zero config: plays forward, switching off SNAPS back to clean.
// NOTE: a REPEAT splash needs the off edge — re-arm on finish (or use api.playOnce() instead):
<SvgAnimator doc={doc} play={isSplashing} onFinish={() => setIsSplashing(false)} />

// Hover icon / trash-can lid / hamburger↔X:
// rests at start · hover → plays forward · rests at end · unhover → plays BACK · rests
<SvgAnimator doc={doc} play={isHovered} playMode="both" />

// Menu/overlay art: appears INSTANTLY, retreats animated
<SvgAnimator doc={doc} play={isOpen} playMode="backwards" />

// Pure pose display (no motion at all — poster states)
<SvgAnimator doc={doc} play={isOn} playMode="none" />

// Freezable one-shot: freeze mid-motion while a dialog is open, resume after
<SvgAnimator doc={doc} play={isOn} pause={dialogOpen} />

// ── loop ────────────────────────────────────────────────────────────────────────────────
// Spinner: spins while busy, off = snap to rest
<SvgAnimator doc={doc} play={isBusy} iterations="infinite" />

// Pausable loop: freeze mid-cycle, resume from the same frame
<SvgAnimator doc={doc} play pause={!isActive} iterations="infinite" />

// Heartbeat: never dies mid-beat — finishes the current iteration, then rests
<SvgAnimator doc={doc} play={isBeating} iterations="infinite" completeIteration />

// Ping-pong while on (config, not control — one run alternates; nothing to do with playMode)
<SvgAnimator doc={doc} play={isOn} iterations="infinite" timeline={{ direction: 'alternate' }} />

// ── ref verbs (the imperative 20 %) ─────────────────────────────────────────────────────
// Doorbell: click plays once, start to finish — there is no "off"
<SvgAnimator doc={doc} apiRef={api} />   /* + onClick={() => api.current?.playOnce()} */

// Skip to the final pose                      api.current?.finish()
// Play backward / rates (exotic)              api.current?.setPlaybackRate(-1)
```

#### Rules that make it behave

- **Mount never animates** — the component renders the pose/state the props name.
- **Interruptions always continue from the current frame** (turn around / proceed) — smoothness
  is a guarantee, not an option; there is deliberately NO "abrupt" mode.
- **`pause` always wins immediately** — the escape hatch is never deferred, not even by
  `completeIteration`. It freezes the CLOCK only: prop changes still retarget while frozen, and
  unpausing resumes toward the current target. And it is only meaningful while `play` is true —
  `play: false` forcibly unfreezes, and the off happens exactly as if nothing had been frozen.
- **The pose contract beats `fillMode` in the play tier:** while `play` is true and the run has
  ended, the FINISH pose is held even for a `fillMode: 'none'` document (which would otherwise
  revert to its static attrs) — the same props must give the same picture on every file.
- **Conflicts:** `play`/`pause` beat `playAsSaved` (warning, lower tier ignored — the existing
  rule). The ref is an AMBIENT CAPABILITY, never a mode (Vue's handle is the standard template
  ref — undetectable by design, and read-only uses are legitimate): an imperative WRITE call
  acts immediately, the next declarative prop EDGE reasserts the props, and a write call landing
  while a declarative driver (`play` or `progress`/`time`) is active emits a usage warning at
  the moment of the actual collision. `<SvgAnimator apiRef={api} />` with no control props (the
  doorbell) is the blessed pattern — no warning.
- The one-shot/loop split follows the document's EFFECTIVE iterations (file + `iterations`
  prop); `playMode` on a loop, `completeIteration` on a one-shot, and `pause`/modifiers without
  `play` are one usage warning each, animation unaffected.
- Tier precedence unchanged: `progress`/`time` → `play`/`pause` → `playAsSaved` → static.

#### Settled (owner, 2026-10-20)

- Prop names: `play`, `pause` (not `paused`), **`playMode`** (rejected: `transition` — conflates
  with CSS; `fillMode`, `playDirection` — collide with existing keys), `completeIteration`.
- `playMode` values = `fillMode`'s spellings (`none|forwards|backwards|both`), same side-mapping.
- **Default `playMode: 'forwards'`** (owner): off snapping back feels more natural than reverse
  playing by default — and it matches the pre-rendered export's class-toggle physics and makes
  the splash zero-config; the hover icon pays one word (`playMode="both"`).
- `playOnce()` = one PASS on every document, finite multi-iteration included.
- Contract breaches warn (usage), never alter playback.
- Pause semantics (owner): subordinate to `play` — `play: false` forcibly unfreezes; while
  frozen, retargets apply and unpause travels to the current target.
- Ref stays mode-neutral; conflicts are detected at WRITE CALLS, not at the ref's existence
  (owner accepted — Vue's template ref is undetectable, reads are legitimate).

#### Implementation notes (for the build, when it gets its go)

- The loop-world warning for `playMode` fires only when the prop was EXPLICITLY written —
  `playMode` has a default (`'forwards'`), so the check is on `undefined`-ness, not the value.
- Pose pinning (the `fillMode: 'none'` rule above) and `playMode: 'backwards'` travel need
  engine-level care: backward playback from arbitrary frames on BOTH engines, snap-to-finish as
  a static render (no animation on mount), reversed easings are the standard mirrored behaviour.
- The one-shot/loop world split reads the document's EFFECTIVE iterations — a designer flipping
  a file to looping changes what `play` means in integration code; the warning plus a docs
  callout cover it, but say it loudly in the guides.
- COMPAT/CHANGELOG duty: `play: false` changes meaning vs the published packages (was "hold
  where it is", becomes "snap/travel to the start pose") — list it in the release notes with
  the rest of this wave's breaks.

#### Done (2026-10-20) — the proposal above is BUILT

- Core: `resolveDeclarativePlayback` (the one rule, pure, rule-table-tested), `PxPlayMode`,
  `resolvePlaybackWorld`, `applyDeclarativeAction` (executor with the boundary guards that stop
  `play()`'s rewind-at-boundary from turning a re-apply into a replay), `createIterationStopWatcher`
  (the `completeIteration` boundary landing), `composePlayOnce` (ONE `playOnce()` on top of any
  engine or handle; a pending pass watcher is invalidated by `destroy()` — leak found and fixed),
  `PxEngineAnimatorApi` (what engines construct; `playOnce` is composed once on top). Codes
  **PX1502** (misplaced modifier) and **PX1503** (imperative write under a declarative driver).
- Components: React, Vue and React Native all consume the shared rule; the play-tier one-shot
  world pins `fillMode: 'both'` (the pose contract); mounts render the pose silently; the public
  ref/handle warns PX1503 on write calls under a declarative driver and carries `playOnce()`.
- Web api: `PxAnimatorApi.playOnce()` everywhere (create, src-proxy queue, pre-rendered builds,
  the inert stub).
- Docs: react.md / vue.md / react-native.md declarative sections teach the two worlds + the
  recipes; signature blocks, prop tables, the API matrix, web-player.md, the format README's
  exports table + plumbing block, diagnostics.md (30 codes) — docs-check green.
- Guards: core rule table (12 cases, seen failing first), web `PxPlayOnce.test.ts` (3), React
  §10 suite (7: snap-back default, silent mount, playMode='both' travel-back, pause freeze/resume,
  loop + completeIteration boundary, playOnce + PX1503, PX1502). All five packages green:
  core 655 · web 209 · react 66 · vue 48 · rn 42 · docs-check 145.
- kf uses only `playAsSaved` — no editor-side impact.

#### Parked for separate consideration (not part of this proposal)

- **Out-channels:** `onPlaybackChange(state)` (one callback with a state enum on every
  transition, incl. natural finish — echo it back for a controlled component; precedent:
  LottieFiles react-lottie-player `onStateChange`), readonly `getPlayState()` on the api (same
  enum; precedent: WAAPI `playState`, SVGator `player.state`), and a throttled
  `onTimeUpdate(ms, progress)` for progress bars (precedent: media `timeupdate`, lottie
  `enterFrame`). Continuous position must never flow through React state.
- **Promoting `direction` to a top-level shortcut prop** (today it needs the `timeline` patch).

### 11. Methods and events don't pair ✅

- **Where:** `PxEngineCallbacks` / `PxAnimatorCallbacks` (core `PxAnimatorTypes.ts`).
- **Why:** `destroy()` fires `onRemove`. `onStop` fires after pause, cancel, finish or remove, yet
  there is no `stop()` — and Lottie users expect a `stop()` that rewinds.
- **Do:** `destroy()` ↔ `onDestroy`. Rename `onStop` to say what it means ("no longer playing,
  whatever the reason"), or at least say so in its TSDoc and the callbacks table.
- **Done (2026-10-20):** `destroy()` ↔ **`onDestroy`** — `onRemove` renamed across core, every
  engine, the three components (Vue's event: `remove` → `destroy`), docs, examples and tests.
  `onStop` KEEPS its name and now says what it means in its TSDoc and every callbacks table:
  "no longer playing, whatever the reason" — fires after any of `onPause` / `onCancel` /
  `onFinish` / `onDestroy`. Deliberately NO `stop()` method: `cancel()` is the stop-and-reset
  verb and `pause()` the hold — a `stop` alias would be a second spelling (the no-aliases rule);
  the Lottie-user expectation is answered by `cancel()`'s docs line "stop and reset to the start".


### 12. Sibling components take different prop shapes ✅

- **Where:** `PixodeskSvgCssAnimator` (React and Vue) takes `start`, `offScreen`, `mouseOut`,
  `visibilityThreshold`, `visibilityDebounce` as flat props; `PixodeskSvgAnimator` takes `start`
  flat and the rest only through `timeline={{ trigger: { … } }}`.
- **Do:** one shape for both — the same flat trigger props on `PixodeskSvgAnimator`, or `timeline`
  on the CSS component.
- **Done (2026-10-20), the first option:** the SAME flat trigger props on `SvgAnimator` —
  `offScreen`, `mouseOut`, `visibilityThreshold`, `visibilityDebounce` joined `start` as
  shortcuts in core's `PxTimelineShortcuts`/`foldTimelineOverride` (ONE choke point), so the
  web `createSvgAnimator` options and all three components gained them in one move; a shortcut
  still wins over the same key inside `timeline`. `SvgCssAnimator` is untouched — both siblings
  now read identically: `<SvgAnimator playAsSaved start="mouseOver" mouseOut="reverse" />`.
  Docs: shortcut tables, signature blocks, the API matrix, playback-and-triggers. Guard: two
  fold tests (seen failing first). This also closes the §10-era note that trigger recipes needed
  the nested patch for anything beyond `start`.


### 13. What is shown after the end is decided in two places ✅

- **Where:** `timeline.fillMode` and `timeline.trigger.finish`; the runtime view calls the second
  `resetOnFinish`.
- **Why:** `fillMode: 'none'` (revert to the static SVG) and `finish: 'reset'` (snap back to the
  start state) answer the same question from two blocks under three names. Troubleshooting's "I
  want it to reset" offers both without saying how they differ. `finish` is also the only `trigger`
  key about neither starting nor running — `setupAnimationTriggers`' own TSDoc says "`finish` is the
  player's, not the trigger wiring's".
- **Do:** move `finish` next to `fillMode` in `timeline`, and say in both rows how they combine.
  Reopens the placement chosen in the trigger model.
- **Done (2026-10-20), wire 1.4:** `finish` moved out of the trigger and next to `fillMode` as
  `timeline.finish` — schema, flatten (the pre-1.4 `trigger.finish` still read for unstamped
  files), nest, and a `PX_WIRE_STEPS` 1.3 → 1.4 step (with a `down`: the move is lossless both
  ways; older players can be written for). Both rows now document HOW THEY COMBINE, in the
  schema JSDoc and every doc table: `finish: 'reset'` wins at the natural end (the run is
  cancelled, so there is nothing for `fillMode` to fill); with the default `hold`, `fillMode`
  decides what the end shows. Troubleshooting's "I want it to reset" now explains the difference
  instead of offering both. The runtime view keeps `resetOnFinish` (engines unchanged);
  `resolveTrigger` and `setupAnimationTriggers` lose the key that was never theirs. Editor side:
  the coverage doc moved the key, writer etalons and fixtures restamped 1.4.1, the preview
  player's "After finish" row moved from the Trigger section to the timeline rows next to Fill
  mode, website file-format examples regenerated. All suites + docs-check green in both repos.


### 14. No ready event, no duration getter ✅

- **Where:** `PxAnimatorApi`; web-player › The playback API; react.md / vue.md › Controlled time.
- **Why:** with `src`, the only way to know the SVG exists is polling `isReady()`. There is no
  `getDuration()`, so every slider example hard-codes its maximum (`max="1000"`, `max={2000}`).
- **Do:** add `onReady` to the callbacks and `getDuration()` (one iteration, ms) to the handle;
  use it in the slider examples.
- **Done (2026-10-20):** `getDuration()` (ONE pass of the content window, ms; `null` before a
  `src` loads) on `PxAnimatorApi`/`PxAnimatorHandle` — composed centrally with `playOnce()`
  (`composePlayOnce` became **`composeApiExtras`**), so every engine, the src-proxy, the inert
  stub, RN and both component facades got it in one move. `onReady` on `PxAnimatorCallbacks` —
  the push twin of `isReady()`: fires ONCE, always asynchronously (the create call has returned);
  wired in the web create path (doc + src), the pre-rendered registry path, React/RN props and
  Vue's `@ready` emit. The slider examples (web-player.md, react.md Controlled time) now set
  their maximum from `getDuration()` on `onReady` instead of hard-coding it. Guard:
  `PxReadyAndDuration.test.ts` (window-length duration, async-once onReady, the src path
  null→value transition).


### 15. Five ways to check a document ✅

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
- **Done (2026-10-21):** ONE public deep check — `validateDocument(doc, { strict? })` now
  returns **`{ valid, errors, findings }`** (`PxValidationResult`, retagged plain `@public`) —
  plus the `isPxDocument` guard (retagged plain `@public`); everything narrower moved to
  `@pixodesk/svg-animator-core/internal`: `isValidPxDocument` (now a thin alias of
  `validateDocument(doc, { strict: false })`, kept for the editor's read path),
  `diagnoseDocument`, `validateNodeEffects`, `validateDeprecatedTransformChannels`,
  `validateEasingRefs`, `validateVersionStamp`. The format guide's "Validating a document" now
  LEADS with `validateDocument` + the guard and no longer teaches the raw schema call or the
  `is`-prefixed object-returner; the mode table describes `validateDocument`'s own two modes.
  Players import the walkers from `/internal`; the editor's read-time validation switched to
  `validateDocument(…, { strict: false })` and the preview check script reads `.errors`.
  All suites + docs-check green in both repos.


### 16. Two version constants for one fact ✅

- **Where:** `PX_WIRE_VERSION` (`{ a, b, c }`) and `PX_WIRE_SCHEMA_VERSION` (`'1.2'`), beside
  `PX_WIRE_BASELINE_VERSION`. api-surface-review §6.6 unified their prefix; the duplication stayed.
- **Do:** keep one public constant (`formatWireVersion` gives the string).
- **Done (2026-10-21):** the one public constant is `PX_WIRE_VERSION` (parsed `{ a, b, c }`);
  `formatWireVersion(PX_WIRE_VERSION)` gives the `"a.b.c"` string back. `PX_WIRE_SCHEMA_VERSION`
  is demoted to `@internal` — it stays as THE one bump site (the string the release tooling
  diffs against), exported only from `/internal`; `scripts/schema-release.mjs` and
  `scripts/upgrade-document.mjs` read it from there. The format guide's signature block,
  exports-table row and Versioning prose now teach only the public pair (and the prose caught
  up with wire 1.4 / editor stamp 1.4.1 — it still said 1.2). kf already used only
  `PX_WIRE_VERSION` / `formatWireVersion`, so nothing moved there. All suites + docs-check green.

### 17. "Flatten" names two operations; the function for it names a third idea ✅

- **Where:** `materializeAllInTree(doc, engine)`; format guide › Flattening a document.
- **Why:** the guide calls the job "flattening a document", the function is "materialize all in
  tree", and `flattenAnimatorTimeline` uses "flatten" for something else (nested `timeline` → the
  runtime view). The second argument is a playback-engine name (`'native' | 'js'`) used to mean
  "does the target renderer resolve `<use>` live" — so React Native must pass `'native'`, the word
  that means the Web Animations API everywhere else.
- **Decision (2026-10-21):** inverted from the original Do — "materialize" is the established,
  correct word (every stage function says it: `materializeNodeEffects`, `materializeMotionPathsInTree`,
  `materializeAnimatedUseInstances`, …); the GUIDE invented "flattening". So: no rename of
  `materializeAllInTree`, fix the docs instead.
- **Done (docs, 2026-10-21):** guide section renamed "Flattening a document" → "Materializing a
  document"; the stray "flatten" wording for this operation fixed in the core intro, the section
  body and the signature-block comment. No anchors pointed at the old slug. The `engine` argument
  is unchanged (the section already states the `<use>`-propagation rule honestly).
  The `flattenAnimatorTimeline` half of the card moved to §17a — parked for owner review.

### 17a. `flattenAnimatorTimeline` ✅ (now `resolveAnimatorTimeline`, internal)

- **Done (2026-10-21):** the WeakMap question is answered by the staged pipeline (below:
  `prepareDocument`, both memos deleted); then, owner's call: renamed `flattenAnimatorTimeline` →
  `resolveAnimatorTimeline` (nothing is "flattened" — it resolves the wire `timeline` into the
  runtime view) and moved from the main entry to `/internal` — public code reads the view through
  `getAnimatorConfig` / `prepareDocument`. No alias. kf's five editor call sites import it from
  `/internal`; guides and the core README no longer teach it (format-guide "Timeline shape" row
  names it ▪). Its body's `(cfg as any)` reads are §17c's.
- **What it is:** the wire→runtime adapter — the 2026-09 overhaul made the nested `timeline`
  object the only WRITTEN spelling, while the engines still read the old FLAT fields
  (`duration`, `fill`, `trigger`, `timelineSource`, `scroll`, …); this memoised fold sits at
  the boundary (applied by `getAnimatorConfig`) and also absorbs legacy spellings (pre-1.3
  `duration`, pre-1.4 `trigger.finish`). Scroll already flows through it
  (`timeline.type: 'scroll' | 'view'` → `timelineSource: 'scroll'` + the `scroll` block);
  a future timeline type lands as one more branch of the `type` discriminator.
- **⏸ PARKED:** the owner wants to review this function before deciding anything.
  Candidate rename if kept as-is: `resolveAnimatorTimeline(cfg)`.
  Tooling for the review: dev monitor › **Player fns** (`/player-functions`) — the call graph of
  all player packages with multi-level caller/callee trees per function.
- **Owner's specific question: what is the `flattenMemo` WeakMap doing there?** Current answer
  in code: the fold allocates a fresh flat object, but `getAnimatorConfig` callers compare the
  config by identity / cache off it, so repeated calls must return the SAME object;
  `wireViewMemo` two lines up exists for the same reason. Whether that identity contract is the
  right design is the thing to review. See also §17b (WeakMaps) and §17c (`as any` — the body
  reads the wire through `(cfg as any).timeline`).

- **Research (2026-10-21): "fix once + stamp + trust" instead of the WeakMaps — feasible, and it
  wants to be ONE staged pipeline.**
  - **Today's lowering is fragmented** (the owner's core complaint): version migration in
    `convertWireDocument`, config fold + window resolution LAZILY per read in
    `getAnimatorConfig` (26 call sites, WeakMap-memoised), effects/loops/motion-paths/`<use>`/rest
    poses in `materializeAllInTree(doc, engine)`, window-time keyframes in `normalizeBindings`,
    engine projection inline in each player's bind. No public "give me a doc lowered to level X";
    the closest to "WAAPI-ready" is what `PxAnimatorBind` composes internally.
  - **Proposal: `prepareDocument(doc, { stage, engine? })` with a monotonic stage ladder** that
    mirrors the documented layer model (format guide › layers L0–L5): `wire` (as loaded) →
    `current` (version-migrated) → `resolved` (animator config folded to the runtime view ONCE,
    window resolved — the lazy fold dies) → `plain` (L3 effects translated down to L0–L2; the
    engine/`inlineUse` choice lives here) → `engine` (bindings in window time, directly
    projectable to WAAPI / frame loop). Each stage is already a pure doc→new-doc function; the
    pipeline just composes them.
  - **The stamp (immutable — the input is NEVER touched):** each stage stamps its RESULT via a
    non-enumerable **Symbol** property `{ stage, engine?, coreVersion }`. `fixToStage(doc, s)`
    returns `doc` when `stamp.stage ≥ s`, else runs the remaining stages. A symbol key is
    invisible to `JSON.stringify`, `Object.keys`, schema validation and `structuredClone` — a
    saved/cloned doc naturally loses the stamp and is re-verified. One ORDERED stage (not
    boolean soup) answers the "fixed and unfixed at the same time" worry: a doc carries the
    highest stage it reached, nothing else. Branded types (`PxDocAt<'plain'>`) make the trust
    compile-time checkable for internal signatures.
  - **Stamp vs WeakMap, by aspect:**

| Aspect | Symbol stamp on the result | WeakMap side table (today) |
|---|---|---|
| Locality | travels WITH the object; visible in a debugger | global module state; invisible |
| Input mutation | never (stamp only on new objects) | never |
| Stale-trust hazard | in-place mutation keeps a wrong stamp — strippable at the editor's edit choke point | in-place mutation serves a stale view — nothing to strip |
| Serialization | symbol drops on JSON/clone → safe re-verify (a STRING key would leak into files — unacceptable) | nothing to leak |
| Two copies of the lib on one page | stamp crosses copies → must carry `coreVersion` and distrust foreign stamps | each copy re-derives — safe, slightly wasteful |
| Perf | caller must KEEP the prepared doc (that's the point); re-preparing a raw doc re-pays the cost | caches implicitly even for unplumbed call graphs |
| Type safety | pairs with branded stage types | none possible |
| API | one explicit pipeline entry + stage param | zero API, zero visibility |

  - **IMPLEMENTED 2026-10-21** — plan + log: `dev-docs/plans/prepare-document-pipeline.md`.
    `prepareDocument` / `documentStage` / `PxDocStage` public; both WeakMaps (`wireViewMemo`,
    `flattenMemo`) deleted; `getAnimatorConfig` = stamp read (while the doc holds the same config
    object — `viewOf`) else fresh derive; web load path, RN compile and `prepareDocumentForRender`
    on the pipeline (RN now version-migrates, as web always did). `flattenAnimatorTimeline` is now a
    plain pure fold — its rename (`resolveAnimatorTimeline`?) stays the owner's call.
  - **Feasibility verdict: yes.** The stages exist and are pure; the refactor is composing them
    under one entry, replacing the 26 lazy folds with a read of the already-resolved config, and
    switching kf's direct piece-calls to the pipeline. The WeakMaps then disappear (or shrink to
    a transition shim). Costs: internal signatures change (branded types), the editor must strip
    stamps at its mutable-edit choke point, and the stamp must be version-guarded.

### 17b. Audit every WeakMap in the library ✅

- **Trigger:** the `flattenMemo` WeakMap in §17a looked suspicious to the owner — audit the rest.
- **Instances today (non-test), `packages/*/src`:**

| Where | What it memoises |
|---|---|
| `format/PxAnimatorConstants.ts:695` `wireViewMemo` | `getAnimatorConfig` result per document config — identity contract (callers compare/cache by identity) |
| `format/PxAnimatorConstants.ts:712` `flattenMemo` | `flattenAnimatorTimeline` result per config — same identity contract (§17a) |
| `materialize/PxMotionPath.ts:99` `_segmentCache` | per keyframe-PAIR sampled motion-path segments (nested WeakMap, module-level) |
| `materialize/PxAnimatorUseMaterializer.ts:121` `cache` | function-LOCAL per-node boolean during one materialize pass (harmless scope) |

- **Do:** for each module-level one, establish who relies on the cached identity, whether a
  mutated input object can serve a stale value, and whether the cache belongs at module scope
  at all (cross-document leaks of correctness, not memory — WeakMap handles memory). Decide
  keep / scope-down / replace with an explicit field on the owning object.
- **Done (2026-10-22):** no `WeakMap` / `WeakSet` / `WeakRef` and no module-level cache left in the player.
  - Motion-path segments: `createMotionPathSegments()` makes a table its OWNER keeps — each frame-loop
    animator (`createAdapterSvgAnimator`), each `materializeMotionPathInPropAnim` call, each rest-pose pass,
    each React Native track compile — passed down via `calcAnimationValues(def, ms, segments?)` and
    `evaluateMotionPathSegment(…, segments?)`; without a table nothing is cached. The module `WeakMap` and the
    dead `_resetMotionPathSegmentCache` are gone; no type gained a field.
  - The two function-local weak structures are a plain `Map` / `Set`.
  - React Native: `ANIMATED_SVG_COMPONENTS`, a constant table built once at load (non-host tags excluded).
  - Guards: `noGlobalCaches.test.ts` (no weak structure in any package source — seen red on the 4 old sites);
    owner-table tests in `motionPathSegmentCache.test.ts` (fill once per pair + reuse — seen red when the table
    stops storing; a pre-start frame does not poison it). Note: `getKeyframesPair` now only returns ADJACENT
    pairs, so the pair key is defensive — the poisoning guard proper is that function's.
- **Investigation (2026-10-22) — what is left after §17a, and can it go the same way?**

| Where | Scope | Verdict |
|---|---|---|
| `wireViewMemo`, `flattenMemo` | module | **gone** (§17a: the prepare pipeline's stamp) |
| `materialize/PxMotionPath.ts` `_segmentCache` | **module** | the one real global left — see below |
| `svg-animator-rn/src/SvgAnimator.tsx` `animatedComponentCache` (a `Map`, not weak) | module | not document data — see below |
| `materialize/PxAnimatorUseMaterializer.ts` `cache` | one call | fine (local; could be a plain `Map`) |
| `svg-animator-react/src/Utils.ts` `seen` (`WeakSet`) | one call | fine (cycle guard inside `deepEquals`) |

  All other module-level `Set`s are constant lookup tables (attribute names, tag lists), not caches.
  - **`_segmentCache`** — the arc-length table of one motion-path Bezier segment, keyed by the
    keyframe PAIR. Two users: the frame loop evaluates it EVERY FRAME (`calcPropertyValue` →
    `evaluateMotionPathSegment`), so the cache is real speed; the native-engine materializer asks for
    the same segment 2–3 times during one pass. The cached value is a pure function of the two
    keyframes (positions come from their own values), so it is sound — just global.
  - **The stamp is not the right tool here.** The stamp exists because a DOCUMENT is user input we
    must not add fields to. The keyframes this cache is keyed on are objects the LIBRARY creates
    (`normalizeBindings` builds the frame loop's normalized animations once per animator; the
    materializer works on its own copies). Library-made objects can simply carry an explicit,
    typed field — no hidden symbol needed.
  - **Proposed, fully local:**
    1. Frame loop: the normalized property animation (made once per animator) gets a typed
       segment table (`segments`), filled lazily per keyframe pair and passed into
       `evaluateMotionPathSegment`. It lives and dies with the animator.
    2. Materializer: one local table per `materializeMotionPathInPropAnim` call, passed down to
       its helpers (`materializeSegment`, the sharp-corner and first-angle helpers).
    3. Delete the module `WeakMap` and the dead no-op `_resetMotionPathSegmentCache`.
    Keeps the pair-keying that `motionPathSegmentCache.test.ts` guards (a first→last lookup before
    the first keyframe must not poison the real first segment).
  - **`animatedComponentCache` (React Native)** — memoizes `Animated.createAnimatedComponent(C)` per
    react-native-svg component CLASS. It must be shared: a fresh wrapper per instance or render would
    be a new React component type and remount the subtree. Bounded by the ~20 svg element kinds, keyed
    by constants, holds no document data. Options: keep as is, or build it EAGERLY at module load from
    the known element map — a constant table like the attribute `Set`s, no lazy mutation.

### 17c. Audit every `as any` in the library ✅ (shipped source and tests: 0 — 2026-10-23; ESLint `no-explicit-any`)

- **Done (2026-10-22)** — plan and log: `dev-docs/plans/schema-cast-and-stamps.md`. Shipped `any` 319 → 126.
  - ONE mechanism bound to the schema framework: every schema has `is` / `cast` / `castOrNull` / `castOrFix`;
    `castOrFix` repairs in one visit, builds a NEW tree and type-stamps what it checked (non-enumerable Symbol),
    so a later cast is a stamp lookup. The `checked` stage of `prepareDocument` runs it on every document;
    repairs are reported (`documentRepaired` PX1108, or `effectsShape` inside `effects`).
  - Reads after that: TS narrowing where the doc type says the shape; a schema cast where a value is a union
    of shapes; effect channels through `readAnimatable(raw, valueSchema)`; open JSON as `Record<string, unknown>`.
  - Root holes closed: `PxNode` index, `meta`, `PxKeyframe<T = unknown>`, `keyframeValue(): unknown`, `px.any()`.
  - Guards: `noImplicitAny` on everywhere; `anyBudget.test.ts` — a per-package ratchet that can only go down.
  - Part 2 (`dev-docs/plans/typed-internals.md`): the schema framework typed (`PxAnySchema`, `describe()` per class),
    the glyph materializer generic over the caller's paint (`GlyphTextNode<P, A>`, `GlyphFactory`), the engine's
    runtime values as typed channels with ONE value-kind decision (`channelKindOf`) — which fixed animated gradient
    stops falling back to the frames engine, `NaN` at loop cut points with named easings, `"20%"` offsets. Shipped
    `any` 126 → 40; left: platform globals, React Native component types, React `deepEquals`, the effects test kit.
- **Trigger:** `flattenAnimatorTimeline` reads the wire through `(cfg as any).timeline` even
  though the document was already validated — once a document passed the check it HAS a type,
  and reading it through `any` throws that away. Audit the rest.
- **Real numbers (2026-10-22, TypeScript AST — every `any` type node, not text matches).** The earlier
  "63" counted only non-test lines with the literal `as any` — it hid most of it.

| | `any` nodes, shipped source | in tests | literal `as any` (src / tests) |
|---|---|---|---|
| core | **277** | 299 | 51 / 192 |
| web | 8 | 27 | 7 / 21 |
| react | 9 | 1 | 0 / 1 |
| vue | 1 | 4 | 0 / 2 |
| rn | 24 | 36 | 10 / 1 |
| **total** | **319** | **367** | 68 / 217 |

- **Silent multipliers — not in any count, but they spread `any` everywhere:**
  1. `PxNode` (public) has `[camelCaseDomKey: string]: any` — every attribute read on a node is `any`.
  2. `PxKeyframe<T = any>` (44 bare uses) and `keyframeValue(): any` (20 call sites).
  3. `noImplicitAny: false` in all five tsconfigs (only 2 implicit sites exist today — tests).
  Measured by switching each to `unknown`: PxNode index → 0 source errors (1 test); `keyframeValue` → 0;
  `PxKeyframe` default → 8 errors in 4 files. The holes are nearly free to close.
- **Why it exists — shipped source by cause:**

| Cause | Nodes | Where |
|---|---|---|
| A. Schema DSL generics — `PxSchema<any, any>` in `infer` / mapped types | 79 | `PxSchema.ts`, `PxSchemaFieldUniverse.ts` |
| B. Animated values whose type depends on the attribute — keyframes, animatables, interpolation | ~100 | `maskedByEffect`, `contentRefSplit`, `transformParts`, `visualModel`, `retime`, `PxDefinitions` |
| D. Open JSON records — `Record<string, any>` | 50 | config patches, node/raw objects |
| G. Platform boundaries — React / RN / DOM / WAAPI | 42 | web, react, rn |
| I. Reading an already-VALIDATED doc through `any` (`(cfg as any).timeline`) | 14 | `PxAnimatorConstants`, `PxAnimatorTypes` |
| F. Paint/style property bags (`fill?: any`) | 13 | `textGlyphsEffect` |
| E. Generic defaults (`<E = any>`) | 8 | glyph element factory |
| H. Test kit shipped in `src` | 9 | `effectTestKit` |

  Tests (367): typed-`any` helpers 150, reading results `(x as any).prop` 90, fixture literals `{…} as any` 63,
  invalid input on purpose / mocks 58.
- **Ranked plan (easiest × biggest effect first):**
  1. **Close the root holes + stop regressions** (≈1 h): `PxNode` index → `unknown`, `keyframeValue(): unknown`,
     `PxKeyframe<T = unknown>`, `noImplicitAny: true` everywhere, and an "any budget" guard (AST count per
     package that can only go DOWN, like the docs-check allowlist). Few visible nodes, but ends the silent spread
     — and `PxNode` is public, so consumers' code stops being unchecked too.
  2. **A — schema generics** (−~75, one file, type-level only): one schema alias for "any schema" in
     constraints, `boolean` instead of `any` in `infer` positions.
  3. **I — validated reads** (−~14): the owner's point — after `prepareDocument` the types ARE settled; read the
     wire config as `PxAnimatorConfig` (typed `timeline` union) instead of `as any`; `isPxDocument(doc: unknown)`.
  4. **D — JSON records** (−~45): `Record<string, unknown>` + the existing `isPlainObject` predicate;
     `PxAnimatorConfigPatch` stays writable for consumers.
  5. **E + F** (−~20): `<E = unknown>`; paint bags typed `PxAnimatable<string>` / `unknown`.
  6. **B — animated values** (−~100, the real design work, file by file): typed accessors and type predicates
     — `readTransformParts(kf)`, `PxAnimatable<PxTransformParts>` instead of `<any>`, an attribute-value union
     for `interpolateValue` with `isTransformParts` / `isVec2` guards (`isX(): v is X`).
  7. **G — platform** (−~30): DOM `Keyframe` types, a declared global instead of `globalThis as any`; keep the
     genuinely loose library edges (react-native-svg props) as a handful of commented casts. RN last.
  8. **Tests** (−~300, mechanical): validators already take `unknown`, so invalid-input tests need no cast;
     typed fixture builders for partial documents; read results through their real types.
  Shipped source after 1–7: 319 → roughly 15 documented boundary casts.

## 🟡 Smaller

Each item: what it is, where it shows up, why it trips a newcomer, the options, and a
**Suggested** solution (a proposal, not a decision). None of them changes behaviour; the fixes
are docs, type names, or wire renames. Names were checked against the
source on 2026-10-23 (where the review's first draft used an older spelling, it says so).

### 18. "Animator" is both the file block and the player instance

- **What:** two different things share one word.
  - `animator` in the document is the root block that holds `timeline`, `bindings` and `definitions`.
  - The object `createSvgAnimator()` returns (type `PxAnimatorApi`) is also called `animator` in most code samples.
- **Where:** the samples in `docs/library/get-started.md` (§ "returns the player… `animator.play()`"),
  `web-player.md`, `vue.md` and `troubleshooting.md`. `react.md` calls the same object `api`, a third name.
- **Why it trips:** in `troubleshooting.md` › Playback behavior, `timeline.finish: "reset"` (a path
  in the file) and `animator.setPlaybackRate(-1)` (a method call) are a paragraph apart. A reader
  takes `animator.` as the file block and looks for `setPlaybackRate` in the schema.
- **Options:**
  1. Docs only: call the instance `player` in every sample and prose line (`const player =
     createSvgAnimator(…)`, React `playerRef`). No API change.
  2. Rename the block. This is a wire rename plus a version step, and it would break every saved file, so it is not worth it.
- **Suggested:** 1 — `player` in every web/Vue/troubleshooting sample, `playerRef` in React (replacing `api`), and one sentence in get-started: "the file's `animator` block configures playback; the object you get back is the player".

### 19. `PxAnimatedSvgDocument` → `PxDocument` ✅

- **What:** the TypeScript type of the whole document (`format/PxAnimatorTypes.ts`, `interface PxAnimatedSvgDocument`).
- **Why it trips:**
  - It is long: a user types it in every typed fixture and every function signature.
  - "Svg" is not always true. The root `type` may be an HTML element that wraps SVG (`div`, …), and `isPxDocument` accepts that.
  - "Animated" is not always true either: a static document is valid.
  - The functions around it already say "Px document": `isPxDocument`, `validateDocument`, `diagnoseDocument`, `prepareDocument`, and the result type is `PxPreparedDocument`. Only the main type breaks the pattern.
- **Options:**
  1. Rename to `PxDocument`. It is a type-only rename: no wire change and no runtime effect. It touches 7 docs files and every consumer's imports.
  2. Keep the name and explain it in the type's TSDoc. That costs nothing, but the name stays wrong for `div` roots.
- **Suggested:** 1, as a clean break in one release (the no-aliases rule of the 2026-09 API rename). `PxAnimatedSvgDocumentSchema` → `PxDocumentSchema` in the same change, so the type and its schema keep one name.
- **Done (2026-10-23):** `PxDocument`, `PxDocumentSchema`, and `toAnimatedSvgDocument` → `toPxDocument`, in all five packages, the docs, the examples and the editor (whose `PxAnimatedSvgDocumentSchemaExtra` / `…Keys` became `PxDocumentSchemaExtra` / `PxDocumentSchemaKeys`). No aliases. Dated plans and reviews keep the old name.

### 20. `loadTagSvgAnimators` and the `_px_animator` handle ✅

- **What:** the zero-code embed. `loadTagSvgAnimators(options?)` (web, `animator/PxAnimator.ts`)
  finds every `<div data-px-animation-src="file.json">` on the page and creates a player inside
  each one. (The first draft of this review called it `loadTagAnimators`.)
- **Why it trips:**
  - "Tag animators" is our word for "players made from data attributes". A newcomer searching for "create players for the page" won't find it.
  - The verb `load` hides that it **creates** players. The programmatic call is `createSvgAnimator`, so the pair reads as two unrelated features.
  - The options type `PxTagAnimatorOptions` carries the same jargon.
  - The function returns `void`. The only way to get a player back is the property it sets on the element, `element._px_animator`. It is documented in `web-player.md` and in `README.md` step 7.
    - A leading underscore reads as "private, don't touch".
    - A TypeScript user has to cast the element to read it.
- **Options:**
  - Rename to `createSvgAnimatorsFromPage(options?)`, which shares the verb of `createSvgAnimator` and says where it looks. The options type becomes `PxPageAnimatorOptions`.
  - Return the created players: `Array<PxAnimatorApi>`, only the new ones, since repeat calls skip elements that already have a player.
  - Add an accessor `getSvgAnimator(element): PxAnimatorApi | undefined` and document that instead of the property. The property stays as the implementation detail.
- **Suggested:** all three in one change:
  1. `createSvgAnimatorsFromPage(options?: PxPageAnimatorOptions): Array<PxAnimatorApi>`, returning the players this call created.
  2. `getSvgAnimator(element)` for finding one later.
  3. The docs drop `element._px_animator`.
- **Done (2026-10-23):** all three, also on the `<script>` global (`Pixodesk.SvgAnimator.createSvgAnimatorsFromPage()` / `.getSvgAnimator(el)`). The property stays as the implementation (`PX_ANIM_ATTR_NAME`), so a repeat call still skips a tagged element. Test: `PxAnimator.test.ts` › *returns the players THIS call created* (seen failing with the return value removed).

### 21. Trigger words

`timeline.trigger` (`PxTriggerSchema`) has five keys: `start` (`load | mouseOver | click | none`),
`offScreen` (`pause | continue | reset`), `mouseOut` (`continue | pause | reset | reverse`),
`visibilityThreshold` and `visibilityDebounce`. Three of these names are off:

| Now | Problem | Possible name |
|---|---|---|
| `offScreen` + `visibilityThreshold` / `visibilityDebounce` | one concept (how much of the animation is on screen) under two words; a reader looks for `offScreenThreshold` and doesn't find it | `offScreen` + `offScreenThreshold` / `offScreenDebounce`, or one `visibility` word for all three |
| `mouseOver` / `mouseOut` | names a mouse, but it works with touch and pen too; the docs' prose says "hover", the SVG + CSS export uses CSS `:hover`, LottieFiles interactivity says `hover` | `start: 'hover'`, `hoverEnd` (or `onHoverEnd`) for the out action |
| `start: 'none'` | reads as "never starts"; it means "waits for `play()`"; the editor's own label is "Manually from JS" | `start: 'manual'` |

- **Cost:** each row is a wire rename. That means:
  - a schema step: `PX_WIRE_STEPS` entry plus `up`;
  - the enum (`PxTriggerStart` / `PxMouseOutAction`);
  - the React/Vue prop types (see §24);
  - the docs;
  - the editor's writer.

  The renames are cheapest before the first publish, because afterwards every saved file needs the conversion step.
- **Suggested:** all three rows in ONE schema step, before the first publish:
  - `offScreenThreshold` / `offScreenDebounce`. This keeps `offScreen` (already the action's name) and makes the parameters visibly belong to it.
  - `start: 'hover'` with `hoverEnd` for the out action, which also reads naturally on React Native, where the start value stays unavailable.
  - `start: 'manual'`.

  The `up` step converts old files, so nothing a user saved breaks.

### 22. `loop` means something else here

- **What:** in the format, `loop` belongs to ONE property's animation: `animate.<prop>.loop: true | { segmentCount, repeatAt, direction }` (`PxLoopSchema`). It repeats a segment of that property's keyframes to fill the timeline. Repeating the whole animation is `timeline.iterations` (a number or `'infinite'`).
- **Why it trips:** everywhere else `loop` repeats the whole thing: `<video loop>`, lottie-web `loop: true`, the `loop` prop of the Lottie React players. So a user's first try is `loop` on the component:
  - **React:** `<SvgAnimator loop />` is a type error. That is correct, but the error doesn't point to `iterations`.
  - **Vue:** `<SvgAnimator loop>` raises no error. Vue's default attribute fallthrough puts a dead `loop=""` attribute on the rendered root element. `SvgAnimator` (`svg-animator-vue/src/SvgAnimator.ts`) keeps the fallthrough; `SvgCssAnimator` sets `inheritAttrs: false`.
- **Options (no wire rename):**
  - One line in the React and Vue guides: "repeat the whole animation: `timeline={{ iterations: 'infinite' }}`".
  - A dev-only console warning when a `loop` prop/attribute reaches either component.
  - Optionally, `inheritAttrs: false` on Vue `SvgAnimator`, forwarding `class`/`style`/`aria-*` explicitly.
- **Suggested:** the guide line and the dev warning, in both React and Vue.
  - The warning text names the fix: "`loop` is not a prop — to repeat the whole animation pass `timeline={{ iterations: 'infinite' }}`".
  - Skip `inheritAttrs: false`. Fallthrough of `class`/`style` is what Vue users expect, and the warning already covers the one confusing attribute.

### 23. The core entry is very wide

- **What:** `@pixodesk/svg-animator-core`'s entry exports engine plumbing that the sibling packages (web, React, Vue, React Native) share. Each piece is tagged `@public @advanced`:

| Export | Lives in | What it is for |
|---|---|---|
| `createRunClock`, `seekCeilingMs`, `clampSeekMs`, `PX_RATE_REJECTED` | `playback/PxPlaybackTime.ts` | the one time contract every engine implements |
| `foldTimelineOverride` | `playback/PxAnimatorConfigPatch.ts` | merging a mount's timeline override into the file's |
| `downgradeWireDocument` | `version/PxWireVersion.ts` | writing a document for an older schema |

- **Why it trips:** `import { … } from '@pixodesk/svg-animator-core'` lists these in autocomplete next to the document types and `validateDocument`. A newcomer cannot tell what is for them and what is engine wiring. Raised before as api-surface-review §3.
- **Options:**
  1. Move them to a subpath entry, e.g. `@pixodesk/svg-animator-core/engine` (`exports` map). The sibling packages import from there, and the main entry is left with the user-facing set.
  2. Re-tag as `@internal` and strip them from the published `.d.ts`. This does not work while the sibling packages, which are separate npm packages, need the types.
  3. Keep them, but group them under one "For player authors" heading in the API reference.
- **Suggested:** 1, plus 3 for the docs.

### 24. Vue `SvgAnimator`'s `start` prop restates the trigger values

- **What:** `SvgAnimator.ts` declares `start: { type: String as PropType<'load' | 'mouseOver' | 'click' | 'none'> }`. That is a hand-written copy of `PxTriggerStart`. Its sibling `SvgCssAnimator.ts` already uses `PropType<PxTriggerStart>`. (The first draft named the old component `PixodeskSvgAnimator`.)
- **Why it matters:** the copy drifts silently. If §21 renames `'none'` → `'manual'`, Vue keeps accepting and type-checking the old word, and nothing fails.
- **Suggested:** a one-line change to `PropType<PxTriggerStart>`. Keep no `default`: an absent prop means "the file's own value".
  - Also check the other Vue/React trigger props (`mouseOut`, `offScreen`) for the same hand-written lists while there.
  - Do it before §21, so the §21 renames reach Vue with no extra edit.

### 25. Enum value spelling follows an unwritten rule

- **What:** two spellings meet in the value lists.
  - Our own values are camelCase: `mouseOver`, `offsetPath` (`alongPathMode`), `continue`.
  - Values borrowed from CSS keep CSS's kebab-case: `direction: 'alternate-reverse'` (CSS `animation-direction`) and the scroll phases `'entry-crossing'` / `'exit-crossing'` (CSS view-timeline ranges).
- **Why it trips:** a user who has seen `mouseOver` writes `'alternateReverse'`, and gets a validation error with no hint why. The format guide (`docs/format/README.md`) states the rule for attribute NAMES (camelCase DOM names), but none for VALUES.
- **Suggested:** one sentence in the format guide's principles: "a value we invented is camelCase; a value taken from CSS keeps its CSS spelling". Add the full list of kebab-case values (today: `alternate-reverse`, `entry-crossing`, `exit-crossing`).
  - Optionally, the validator's enum error can name the closest valid value ("did you mean `alternate-reverse`?"). That catches the typo at the moment it happens.
  - No wire change.

### 26. Effect names mix two patterns

- **What:** the `effects` keys (`PxEffectsSchema`):
  - two are passive, "this element is … by": `maskedBy`, `transformBy`;
  - eight name the thing they add: `clipPath`, `repeater`, `strokeTrim`, `clone`, `fillGradient`, `strokeGradient`, `textPath`, `text`.
- **Why it trips:** a newcomer looks for a rule and none fits all ten:
  - "…By = points at another element" fails: `maskedBy` has a `source`, but `transformBy` (its own parts) doesn't, and `clone` has a `source` without the suffix.
  - "…By = avoids clashing with an SVG attribute" fails too: `effects.clipPath` lives in its own namespace next to the `clipPath` attribute, so `effects.transform` / `effects.mask` could have done the same.
- **A rule that almost fits:** "an effect is named for what it adds. When that noun is already an attribute the same node can carry, it takes `…By`, so the two never share a word."
  - `transform` and `mask` are SVG attributes, hence `transformBy` and `maskedBy`.
  - `repeater`, `strokeTrim`, `clone`, `fillGradient`, `strokeGradient`, `textPath` and `text` are not attributes, so they keep the bare noun.
  - The one exception is `clipPath`: it is the camelCase name of the `clip-path` attribute, yet it has no suffix.
- **Options:**
  1. Keep the names and document them as a fixed list. No rule is claimed, and nothing changes.
  2. Rename the two outliers to nouns, `effects.mask` and `effects.transform`. Every key then names what it adds. The cost is three `transform`s on one node (the attribute, `animate.transform`, `effects.transform`) and two `mask`s. This is a wire rename plus a schema step.
  3. Rename the others to the passive pattern (`clippedBy`, …). This is worse: eight renames to fix two.
  4. Adopt the rule above and rename only `clipPath` → `clippedBy`. One wire rename, and the rule then holds for all ten.
- **Suggested:** 4, in the same schema step as §21. Write the rule in the format guide's principles next to §25's value rule.

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
