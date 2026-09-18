# Trigger block: one object, short keys, safe defaults — implementation plan

**Status: IMPLEMENTED 2026-09-18.** Every step below is ticked. Two things found on the way are
in §11; one of them (O2) is still open. Nothing is committed. No backwards compatibility is
owed: the format has not shipped to clients, so this is a clean cut with no aliases and no shims.

Scope is deliberately narrow: **only `timeline.trigger` changes.** No other part of the wire format
is touched.

## 1. What changes

`trigger` keeps its five ideas but drops the prefixes its keys carry, splits the one overloaded
action field in two, and flips two defaults so that a document which says nothing behaves politely.

| Today | New | Note |
| --- | --- | --- |
| `startOn: load \| mouseOver \| click \| scrollIntoView \| programmatic` | `start: load \| mouseOver \| click \| none` | `scrollIntoView` is no longer a trigger (§2); `programmatic` → `none` |
| `outAction` (shared by hover, click and scroll) | `offScreen` **and** `mouseOut` | one field meant three things depending on `startOn` |
| `finishAction: hold \| reset` | `finish: hold \| reset` | same values, shorter key |
| `scrollIntoViewThreshold: 0..1` | `visibilityThreshold: 0..1` | same meaning and same measurement (D4); default moves 0 → 0.5, and it now always applies |
| — | `visibilityDebounce: ms` | **new.** How long the graphic must stay visible before it starts, so a fast scroll past it starts nothing. Default 150 |

## 2. Why

Three defects, all visible in `packages/svg-animator-web/src/triggers/PxAnimatorTriggers.ts`.

1. **`startOn` mixes one-shot events with a continuous condition.** `load`, `mouseOver`, `click`
   and `programmatic` are things that happen; `scrollIntoView` is a state that holds. Because they
   share an enum, visibility is available only to a document that gives up every other trigger:
   "start on click, but pause when scrolled away" cannot be said at all.
2. **One `handleEndAction()` serves all three branches,** so `outAction` means three different
   things, and `reverse` is meaningful on hover but meaningless off-screen, where nobody can watch
   it play backwards.
3. **The defaults are the unfriendly ones.** `{ startOn: 'load', outAction: 'continue',
   scrollIntoViewThreshold: 0 }`: a document that says nothing plays immediately and forever,
   whether or not anyone can see it, and `0` means "any pixel counts".

Separating *what starts it* from *what happens when nobody can see it* fixes all three, and makes
`start: 'load'` under a closed gate mean exactly what `startOn: 'scrollIntoView'` meant before:
hold at frame 0 until enough is on screen, play, pause when it leaves, resume when it returns.

Naming follows what the format already does with grouped data. `pin` spells its keys `align`,
`offset`, `distance`, not `pinAlign`; `range.start` spells them `phase`, `fraction`. Inside an
object already called `trigger`, the keys should be bare too.

## 3. The final shape

```jsonc
"trigger": {
  "start":     "none" | "load" | "mouseOver" | "click",            // default "load"
  "offScreen": "pause" | "continue" | "reset",                     // default "pause"
  "mouseOut":  "continue" | "pause" | "reset" | "reverse",         // default "continue"
  "finish":    "hold" | "reset",                                   // default "hold"
  "visibilityThreshold": 0.0 - 1.0,                                 // default 0.5
  "visibilityDebounce": 0+                                         // ms, default 150
}
```

- `start` — what starts the animation. `none` means only the API does.
- `offScreen` — what happens when none of the graphic is on screen. Applies whatever `start` is.
- `mouseOut` — what happens when the pointer leaves. Read only when `start` is `mouseOver`.
- `finish` — what happens after a natural end. Unchanged in meaning.
- `visibilityThreshold` — how much of the graphic must be on screen before it may run, as a
  fraction of its area. `0.5` means "at least half of it is showing".
- `visibilityDebounce` — how long, in ms, that must stay true before it actually starts, so
  scrolling straight past a graphic starts nothing. `0` starts the moment the threshold is met.

The first four keys name an **occasion**, and the parent `trigger` says what kind of occasion it
is, so they can be bare. The last two name a **measured quantity**, which `trigger` does not
qualify — a bare `threshold` could as easily be a time or a distance — so they keep their subject
word (D6).

Every field is optional and every default is the common case, so the whole block is usually absent.

## 4. Real JSON

Only the `animator` fragment is shown; the surrounding document is unchanged.

**A. The common case — say nothing.** Starts when half of it is on screen, pauses when it leaves,
resumes when it comes back.

```json
{ "animator": { "timeline": { "duration": 2000, "iterations": "infinite" } } }
```

Today the same behaviour needs this, and gets it wrong for a graphic taller than the viewport:

```json
{ "animator": { "timeline": { "duration": 2000, "iterations": "infinite",
  "trigger": { "startOn": "scrollIntoView", "scrollIntoViewThreshold": 0.5, "outAction": "pause" } } } }
```

**B. Click to play, and still pause when scrolled away.** Not expressible today.

```json
{ "animator": { "timeline": { "duration": 2000, "trigger": { "start": "click" } } } }
```

**C. Hover to play, reverse on leave, and keep running off screen.**

```json
{ "animator": { "timeline": { "duration": 800,
  "trigger": { "start": "mouseOver", "mouseOut": "reverse", "offScreen": "continue" } } } }
```

**D. Replay from the start every time it scrolls back into view.**

```json
{ "animator": { "timeline": { "duration": 1500, "trigger": { "offScreen": "reset" } } } }
```

**E. A page of graphics that must ignore a flick-scroll.** Two thirds visible, for a third of a
second, before anything moves.

```json
{ "animator": { "timeline": { "duration": 1200, "iterations": "infinite",
  "trigger": { "visibilityThreshold": 0.66, "visibilityDebounce": 300 } } } }
```

**F. The host app drives everything.** Nothing auto-starts, and visibility is ignored.

```json
{ "animator": { "timeline": { "duration": 2000,
  "trigger": { "start": "none", "offScreen": "continue" } } } }
```

**G. The old default, if someone really wants it.** Plays on load, runs forever, seen or not.

```json
{ "animator": { "timeline": { "duration": 2000, "trigger": { "offScreen": "continue" } } } }
```

## 5. Semantics to pin down

1. **Arm, do not autoplay then pause.** `start: 'load'` behind a closed gate must not start the
   clock at all: starting and pausing produces a one-frame flash and a spurious play/pause pair.
2. **Hysteresis.** The gate opens at `visibilityThreshold` and closes only at zero visibility. One value, two
   edges. Today one number serves both, so a graphic resting on the boundary flaps.
3. **The debounce delays OPENING only; closing is immediate.** When visibility reaches the
   threshold the gate arms a timer; if visibility drops before it elapses the pending start is
   cancelled and nothing has moved. Going off screen pauses at once — there is no benefit in
   deferring that. A resume after a pause waits the same debounce as a first start.
4. **A deliberate action skips a pending debounce.** A `click`, or `play()` through the API, starts
   at once rather than waiting out a timer the reader cannot see.
5. **The debounce applies to the first observation too,** so a graphic already on screen at load
   waits it out. One rule rather than two, and at the default it is imperceptible.
6. **Elapsed time must not accrue while gated.** The frames engine reads a wall clock
   (`PxFrameLoop.getRawAnimTime`), so the gate must go through the real `pause()` path, which banks
   the time, rather than merely stopping rendering.
7. **A hidden tab counts as off screen.** `IntersectionObserver` does not fire when a tab is
   hidden, so the gate also listens to `visibilitychange`. Nothing in core or web listens today.
8. **`visibilityThreshold` keeps its present measurement** (D4): an intersection ratio, normalised by
   `effectiveRatio` for graphics taller than the viewport. Only the name and the default change.
9. **`offScreen: 'reset'` plus re-entry is replay** — `cancel()` then `play()` runs from 0 — so no
   separate `replay` value is needed.
10. **`click` is a plain play/pause toggle** with nothing to configure.
11. **Scroll and view timelines carry no `trigger`,** exactly as today, so they are not gated. See §12.
12. **When visibility cannot be measured, the gate stays open.** No `IntersectionObserver` (jsdom,
    SSR, an old engine) means the animation plays as if fully visible, never that it silently never
    plays. The web package's own tests stub the observer rather than having one, so failing closed
    would break every existing test of a `load` document, and a page that fails to measure is
    better off animating than frozen.

## 6. Step-by-step plan

### Core — `packages/svg-animator-core/src/format/`

1. ✅ `PxAnimatorConstants.ts`: rename `PxStartOn` → `PxTriggerStart`; drop the `scrollIntoView`
   member; rename `programmatic` → `none`.
2. ✅ Same file: replace `PxOutAction` with two enums — `PxOffScreenAction` (`pause`, `continue`,
   `reset`) and `PxMouseOutAction` (`continue`, `pause`, `reset`, `reverse`). Delete `PxOutAction`.
   `PxFinishAction` is unchanged.
3. ✅ Same file: `PX_TRIGGER_DEFAULTS` becomes `{ start: 'load', offScreen: 'pause', mouseOut:
   'continue', visibilityThreshold: 0.5, visibilityDebounce: 150 }`. `finish` stays out of it and out of `PxResolvedTrigger`, which is
   already the rule there ("not a start/stop decision"). Update `resolveTrigger` to match.
4. ✅ `PxAnimatorTypes.ts`: rename the five keys in `_PxTrigger` and `PxTriggerSchema`. The
   `implementsInterface` + `KeysMatch` locks make any miss a compile error.
5. ✅ `PxAnimatorConstants.ts` (~line 705): the `const { finishAction, ...restTrigger } =
   timeline.trigger` destructure follows the rename.

### Web — `packages/svg-animator-web/src/`

6. ✅ New `triggers/PxVisibilityGate.ts`: owns the `IntersectionObserver`, the `effectiveRatio`
   normalisation and the 21-step threshold list (both moved verbatim out of the `scrollIntoView`
   case), the open/close hysteresis of §5.2, the debounce timer of §5.3 to §5.5, the
   `visibilitychange` listener of §5.7, and the `offScreen` action. Returns a disposer, like the existing trigger wiring.
7. ✅ `triggers/PxAnimatorTriggers.ts`: delete the `scrollIntoView` case; keep `load`, `mouseOver`,
   `click`, `none`. Split `handleEndAction` so hover reads `mouseOut` and the gate reads
   `offScreen`. Wire the gate unconditionally beside the switch. Keep the `enteredOnce` latch.
8. ✅ `animator/PxAnimator.ts`: arm instead of autoplay (§5.1) — `load` hands the start to the gate
   rather than calling `play()` itself.
9. ✅ `packages/svg-animator-web/mangle-reserved.json`: swap the four old names for the five new ones.
   **Wire keys must never be mangled** (see `plans/minification-boundary.md`); missing this breaks
   the minified build silently.

### Schema, docs, version

10. ✅ Regenerate `SCHEMA.json` (`node scripts/gen-schema-json.mjs`).
11. ✅ Update the eight docs pages that name these fields — `docs/format/README.md`,
    `docs/library/{playback-and-triggers,web-player,react,vue,react-native,troubleshooting,README}.md`
    — and any `px-check` blocks in them, then run `tools/docs-check`.
12. ✅ Bump the schema version per [../versioning.md](../versioning.md).

### Editor (`kf/app`) — same pass, or the monorepo and the editor disagree

13. ✅ `src/svgeditor/animation/TSvgSvgAnimationAttr.tsx` and `animation/Types.ts`: the model fields,
    including the omit-when-default value for the threshold moving from `0` to `0.5`.
14. ✅ `src/kf/app/right/svg/animation/SvgTriggerFields.tsx`: the UI becomes a start picker plus the
    action pickers, with `mouseOut` shown only for `mouseOver`.
15. ✅ `src/svgeditor/model/serialization/players/SvgJsCssPlayerSerialisationUtil.tsx`: the
    pre-rendered bootstrap emits the resolved `visibilityThreshold` **and** `visibilityDebounce`
    instead of hard-coded values, so a pre-rendered file and the player behave identically.
16. ✅ `src/svgeditor/model/serialization/schema/PxSchemaUtil.ts`, `schema/coverage/
    PxSchemaFullCoverageDoc.ts`, the dev trigger explorer (`src/kf/common/development/
    triggerexplorer/*`) and `src/karma/TestSvgaAnimationTrigger.karma.tsx`.
17. ✅ Fixtures and specs (§8 has the counts).

### Verification

18. ✅ Player: core 586 · web 181 · react 41 · vue 30 · rn 42 · docs-check 120 — all green.
19. ✅ Editor: `tsc` clean (12 errors remain, all pre-existing on HEAD in files this work never
    touched), and the WHOLE vitest pass runs — 3661 passing over 345 files. The one failure is
    `readDegradation.spec.ts`, the open item C2 in `docs-dev/yarn-test-failures.2026-09-15.md`,
    which predates this work.
20. ✅ Website: all 28 documents migrated and all 22 embedded bootstraps upgraded to the dwell +
    hysteresis, then driven in a real browser at 0% / 30% / 70% / 0% visibility — every inlined
    animation and every player embed starts only at ≥50% visible and pauses when hidden. The player
    bundle was republished (`yarn website:player`) and the docs re-synced
    (`yarn website:svga-docs`). §10 has the counts.

## 7. Tests that must fail first ✅

All fifteen exist and pass; the gate ones live in `PxAnimatorTriggers.test.ts`.

Each is a behaviour the current code gets wrong, so each must be seen red before the change lands.

1. ✅ A document with no `trigger` does not play while its root is outside the viewport.
2. ✅ The same document plays at 50% visible and not at 49%.
3. ✅ It pauses at zero visibility and resumes from the paused time, not from 0.
4. ✅ A graphic resting exactly on the threshold does not oscillate.
5. ✅ A graphic taller than the viewport still starts (the `effectiveRatio` path, now on the gate).
6. ✅ `start: 'click'` with the default `offScreen`: clicking plays, scrolling away pauses, scrolling
   back resumes. Inexpressible today.
7. ✅ `start: 'mouseOver'`, `mouseOut: 'reverse'`: a `mouseleave` with no preceding `mouseenter` still
   does nothing.
8. ✅ Tab hidden pauses, tab visible resumes, and no time accrued in between.
9. ✅ `start: 'none'` ignores visibility until `play()` is called, and is gated normally afterwards.
10. ✅ `offScreen: 'reset'` restarts from 0 on the next entry.
11. ✅ A graphic that crosses the threshold and leaves again before `visibilityDebounce` elapses never
    plays a frame.
12. ✅ One that crosses and stays plays once the debounce has elapsed, and not before.
13. ✅ `visibilityDebounce: 0` plays the moment the threshold is met.
14. ✅ A click during a pending debounce plays immediately.
15. ✅ With no global `IntersectionObserver`, a `load` document plays (§5.12).

## 8. Blast radius ✅

Mechanical, but not small. Occurrences, counted 2026-09-17:

What it actually cost, 2026-09-18:

| Where | Result |
| --- | --- |
| Player repo | 5 packages + docs; schema 1.1 → 1.2 with a conversion step |
| Editor source | 74 files renamed by compiler-guided sweep; no `as any`, no `@ts-ignore` |
| Player examples | 137 files — the tree the first pass forgot |
| Fixtures + test data | 643 trigger blocks in 378 files, by `tools/migrate-trigger-two-axes.mjs` |
| Website | 29 blocks in 28 files, 22 embedded bootstraps upgraded, docs re-synced |

The compile-time locks in core (`implementsInterface`, `KeysMatch`) and the editor's own typing
turned nearly every occurrence into a compiler error rather than silent drift. The three that
stayed silent were exactly the ones called out in advance: JSON fixtures, markdown, and
`mangle-reserved.json`.

Most are fixtures and specs. The compile-time locks in core (`implementsInterface`, `KeysMatch`)
and the editor's own typing turn nearly all of them into compiler errors rather than silent drift;
the exceptions are JSON fixtures, markdown and `mangle-reserved.json`, which is why step 9 and
step 11 are called out separately.

## 9. Decisions

| # | Decision |
| --- | --- |
| D1 | **One `trigger` object with bare keys**, not a separate `visibility` object. A second object would have shown the two axes more honestly, but it introduces a whole new member for two fields; the author chose the smaller shape. Consequence: scroll and view timelines still have no home for the gate (§12). |
| D2 | **`programmatic` → `none`.** `load` is also programmatically controllable, so `programmatic` named the wrong property. |
| D3 | **`start` keeps `load` as its default.** `none` was considered and rejected: a pre-rendered SVG inlined in a page has nobody to call `play()`, so a `none` default would render the commonest delivery path permanently static. The gate is what makes `load` safe. |
| D4 | **`visibilityThreshold` keeps its present measurement.** Redefining it in the scroll model's `phase`/`fraction` vocabulary was proposed and rejected. Only the name and the default change. |
| D5 | **No `replay` value.** `offScreen: 'reset'` plus re-entry already replays (§5.9). |
| D6 | **The two quantity keys keep their subject word** while the other four are bare. Occasion keys are scoped by the parent `trigger`; a quantity key is not, and a bare `threshold` could as easily be a time or a distance. Four spellings were weighed: `offScreenThreshold` is **wrong**, because the off-screen boundary is zero visibility rather than this number (§5.2); `onScreenThreshold` implies the same two-state model the hysteresis breaks; `visibleThreshold` would be the format's only adjective-plus-noun key, parsing as "a threshold that is visible". `visibilityThreshold` is noun plus noun like `frameRate`, `segmentCount` and `pinDistance`, and claims nothing about a boundary it does not own. `visibilityDebounce` follows it. `minVisible` was dropped earlier: no `min`/`max` prefix exists anywhere in the format. |
| D7 | **`visibilityDebounce` defaults to 150 ms.** A fast flick-scroll keeps a typical graphic on screen for roughly 100 to 300 ms, so 150 skips most of them while staying imperceptible once the reader stops. Not `visibilityDelay`: the timeline already has a `delay`, and the two would read as the same thing. |

## 10. Migrating the documents we already have ✅

Four trees. Counts taken 2026-09-18.

| Tree | Done | Result |
| --- | --- | --- |
| `kf/app/src` | ✅ | 255 trigger blocks in 139 files |
| `kf/app/tests` | ✅ | 361 blocks in 215 files |
| `kf/app/docs-dev/animations/SVGA` | ✅ | 27 blocks in 24 files |
| `pixodesk-website` | ✅ | 29 blocks in 28 files, **plus all 22 embedded bootstraps upgraded** to the dwell + hysteresis |
| `pixodesk-svg-animator/examples` | ✅ | 14 blocks + 124 TypeScript/HTML literals — **missed on the first pass**, see below |

Most of it by `kf/app/tools/migrate-trigger-two-axes.mjs`, which also moves the version stamp
`1.1.x` → `1.2.1`. The website was then verified in a real browser: every inlined animation and
every player embed starts only at ≥50% visible and pauses when hidden.

**The first pass missed a whole tree, and the verification did not catch it.** `examples/` was
never swept: ~130 files, including the preview-player's trigger UI (a real form with selects) and
every React Native feature-explorer case. Two `packages/` tests were missed as well —
`PxSchema.test.ts`, which builds its OWN sample trigger schema to exercise the schema toolkit, and
`PxAnimatorConfigPatch.test.ts`, which pushes untyped objects through a generic merge. Both passed
throughout, because neither is checked against the real `PxTriggerSchema`, and `examples/` is in
neither the test run nor any typecheck that CI gates. A green suite said nothing about them.
**The lesson for the next rename: grep the whole repository for the old identifiers and drive the
count to zero, rather than trusting the suites to find what they never look at.**

**The mapping is not one-to-one,** because `outAction` meant three different things:

| Old | New |
| --- | --- |
| `startOn: 'scrollIntoView'` + `outAction: X` + `scrollIntoViewThreshold: T` | `offScreen: X`, `visibilityThreshold: T`, and no `start` at all — its default already means this |
| `startOn: 'mouseOver'` + `outAction: X` | `start: 'mouseOver'`, `mouseOut: X` |
| `startOn: 'click'` + `outAction: X` | `start: 'click'`; **X is dropped**, since a second click now always pauses (§5.10) |
| `startOn: 'load'` or `'programmatic'` + `outAction: X` | `start: 'load'` or `'none'`; X is dropped, it was never read for these |
| `finishAction: X` | `finish: X` |
| `scrollIntoViewThreshold: 0` (the old default) | omit; the new default is 0.5, so an explicit 0 must be written out to be preserved |

**Two behaviour changes are deliberate.** A document that said `startOn: 'load'`, or said nothing at
all, used to play immediately and forever; after migration it is gated. On the website that is the
whole point. For fixtures it is immaterial, because they assert serialisation rather than playback —
and any fixture that does depend on ungated playback takes an explicit `offScreen: 'continue'`.
A `click` document with a non-default `outAction` also changes, per the table above.

### Steps

1. ✅ Add rule **C35** to `kf/app/tools/migrate-px-current.mjs` implementing the mapping above,
   including the `outAction` split by old `startOn` and the explicit-zero threshold case.
2. ✅ **Dry-run and read the diff before applying anything,** and spell out every case where two old
   spellings collapse into one new one. This is the standing rule for in-place fixture migration.
3. ✅ Apply to the two editor trees, then verify with the three existing checks: `pxFileHealth` for
   what the Open dialog rejects, `pxFileRoundTrip` plus `px-file-stats compare` for what the reader
   silently drops, and `px-render-diff` for anything that renders differently.
4. ✅ **Fix the test DATA, not just the documents.** Three kinds, and each fails differently:
   - **Unit-spec fixtures** — inline documents and `.json` / `.svg` files read by vitest specs.
     The compile-time locks catch the inline ones; the file ones fail as assertion diffs.
   - **e2e `.data` folders** — `tests/atest/**/*.data/**`, the recorded expectations of the
     file-format suite. These are WRITER OUTPUT, so they are regenerated rather than hand-edited:
     defaults that are now omitted, and defaults that are now different, both change what the
     writer emits.
   - **Player e2e fixtures** — `packages/svg-animator-web/e2e/*.json` and the `e2e/fixtures/*.html`
     pages, which carry trigger blocks of their own.
   Regenerate what is generated, hand-edit only what was hand-written, and read the diff in both
   cases — a fixture whose trigger silently became gated will hang a test rather than fail it.
5. ✅ Apply to the website with `--for-display`, then regenerate the 22 files carrying the
   `startOnScrollIntoView` bootstrap so it emits the resolved `visibilityThreshold` **and**
   `visibilityDebounce` rather than the values hand-patched on 2026-09-17.
6. ✅ **Out of scope in the website tree**, and to be left alone: the eight Lottie-Animator exports
   under `public/assets/lottie`, which are not Pixodesk documents and carry their own `st` / `mo` /
   `so` config, and `public/app/player/samples/*`, which is republished by `yarn website:player`
   rather than edited in place.

## 11. Found while implementing

Two things the implementation turned up that the plan did not anticipate. The first is fixed; the
second is a defect that predates this change and is now merely visible, left for its own pass.

**O1 — the editor's SVG carrier must convert too. ✅ FIXED.**
`wireVersionGuard.spec.ts` carries a deliberate tripwire: *"NO step may exist until the SVG
carrier re-spells its raw tree."* On a JSON open, migration rewrites the document the model is
built from; on an SVG open it runs only on the AUDIT view
(`convertEditorDocument(svgMetaWireView(obj)).doc` in `SvgaSerializationUtil.deserialize`), and the
model is still built from the raw `data-px-meta`. With both step tables empty that lost nothing.
Adding the 1.2 step makes it matter: a 1.1 SVG would be judged migrated and read unmigrated, so its
trigger would be silently dropped. The fix the spec itself names is to map the converted view's
meta back onto the raw tree in `deserialize`, then relax the assertion. Removing the step instead
is not an option — `PxSchemaRelease` refuses a rename without one.
**Done:** `applyWireViewToRawTree` (in `SvgMetaWireView.ts`) walks the converted view and the raw
tree in lockstep — the same child filter and order as `toWireNode`, so neither side needs a
back-reference — and rewrites `data-px-meta` wherever a step applied. `deserialize` calls it only
when `converted.applied.length`, on a COPY, since the audit wants the view untouched. The tripwire
now guards the WIRING instead of the emptiness, and a second test opens a real 1.1 SVG and asserts
its raw tree comes out spelling `start` / `mouseOut`.

**O2 — an explicit ZERO cannot be saved for either visibility value. ⬜ STILL OPEN.**
A falsy number reads as "unset" in the editor model, so `visibilityDebounce: 0` ("start the moment
the threshold is met") and `visibilityThreshold: 0` ("any pixel counts") both come back as their
defaults. This was harmless while those defaults were 0 themselves, and moving them to 0.5 and 150
exposed it. Fixing it means teaching `TNumValue` the difference between "unset" and "set to zero".
Documented on `AnimatorShape.visibilityDebounce` in the animator round-trip spec, which covers the
field with a non-zero value instead.

## 12. Not in this change

- **Gating a scroll or view timeline.** `trigger` remains time-only, so a scroll-driven document
  keeps running its driver off screen. Following from D1; revisit if it proves costly.
- **`source: 'self'`** on the scroll member, which CSS `scroll()` accepts and we do not.
- **The `finish` / `fillMode` overlap** — "hold the end state" is largely what
  `animation-fill-mode: forwards` already says.
- **`prefers-reduced-motion`**, which would be a third gate on the same axis.
