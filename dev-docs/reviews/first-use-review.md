# First-use review — the API, the schema and the docs through a newcomer's eyes

Status **2026-10-15** (two passes the same day: the exports and schemas, then every guide in
`docs/`). All items open; nothing implemented yet.

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

# Part 1 — the API and the schema

## 🔴 Expectation vs behavior

### 1. The same file starts differently on the web and in a component

- **Where:** `createAnimator` (`svg-animator-web/src/animator/PxAnimator.ts`) follows the
  document's trigger; the components go through `controlModeTakesOverTrigger`
  (`svg-animator-core/src/format/PxAnimatorConstants.ts`), which forces `start: 'none'` in every
  mode but `autoplay`.
- **Why:** `createAnimator({ doc })` plays on load; `<PixodeskSvgAnimator doc={…} />` shows the
  first frame and waits. The docs have to work around it in three places: get-started §3 promises
  "every snippet below plays the file the way the editor saved it" (true only because the component
  snippets add `autoplay`); `docs/library/README.md` says "the web player and the tag are always in
  autoplay mode"; troubleshooting's first React entry is "with no control prop … add `autoplay`".
- **Do:** make "follow the document's trigger" the components' default, as on the web.
  `play` / `pause` / `progress` / `time` still take over; `apiRef` stays a handle. Reopens the
  static-by-default choice behind api-schema-review §1 / §7.

### 2. `autoplay` means "follow the trigger", not "play now"

- **Where:** `PxControlProps.autoplay` (core `PxAnimatorConstants.ts`); React / Vue / RN props.
- **Why:** with a `click` trigger, `autoplay` waits for a click. In `<video>`, lottie-react,
  dotLottie and Rive, `autoplay` starts at once. The guides even show
  `<PixodeskSvgAnimator doc={doc} autoplay timeline={{ trigger: { start: 'none' } }} />` — an
  "autoplay" that waits for `play()` (playback-and-triggers › Overriding from a player).
- **Do:** with §1 done the prop is no longer needed. If §1 is declined, rename it to what it does
  (e.g. `useTrigger`).

### 3. The document type accepts keys the player drops

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

### 4. `duration` reads as speed, but it is the timeline's length

- **Where:** wire `timeline.duration`; the shortcut `PxTimelineShortcuts.duration`
  (`svg-animator-core/src/playback/PxAnimatorConfigPatch.ts`) on `createAnimator` and the three
  components; the Timing table in `docs/library/playback-and-triggers.md`.
- **Why:** keyframe `time` is absolute ms, so a longer `duration` adds a still tail and a shorter
  one cuts the end. Designers expect that (After Effects composition length, Lottie's out point).
  Developers expect scaling (CSS `animation-duration`, Web Animations API `duration`, where keyframe
  offsets are 0–1). The wire name is actually right — `timeline.duration` *is* the length of the
  timeline — but the shortcut drops the word that made it right, and that shortcut is exactly where
  developers meet it. No option changes speed; only `setPlaybackRate()` after creation. Yet the docs
  twice motivate the override with "the same file shown twice at two speeds" (web-player › Options,
  playback-and-triggers › Overriding from a player) — something the override cannot do.
- **Do** (no rename needed):
  1. Add a `playbackRate` option / prop / shortcut — the starting speed. Same word as
     `setPlaybackRate()`, the Web Animations API and `<video>`.
  2. Describe `duration` everywhere as "length of the timeline — keyframes keep their times; to
     play faster or slower, use `playbackRate`" (TSDoc of the shortcut, the Timing table, the
     shortcuts table, the editor's tooltip). Fix the "two speeds" sentences to use `playbackRate`.
  3. Warn (diagnostic) when an override `duration` is shorter than the last keyframe — the end is
     cut silently today.
- **Note:** the format already scales time once, `clone.retime.stretch`, and it runs the opposite
  way: `stretch: 2` is slower, `playbackRate: 2` is faster. If a speed key ever enters the timeline
  itself, pick one direction.

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

### 7. The brand is spelled four ways

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

### 8. One name, two functions

- **Where:** `index.prerendered.ts` exports `createPrerenderedAnimator` *as* `createAnimator`
  (`doc` only, binds to markup already on the page), next to the package's
  `createAnimator(PxAnimatorOptions)`.
- **Why:** done so the emitted script is byte-identical whichever bundle is inlined. But a user
  reading an exported SVG's script and then the docs sees one name with two signatures, and the
  full build's `createAnimator` *also* binds to existing markup when `container` is omitted.
- **Do:** give the bind entry its own verb (e.g. `bindAnimator`) in both builds; the editor's
  exporter emits that.

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
