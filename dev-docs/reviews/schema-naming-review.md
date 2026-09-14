# Schema naming & consistency review

Status **2026-09-13** (reviewed 2026-09-10; all 11 findings resolved since — 10 fixed, 2.11
decided to keep as is), player schema `1.1`, pre-release. 2.12 (`animateById` → `bindings`) and 2.13
(`definitions.styles` removed) landed the same day — clean changes, still `1.1` (nothing released). Part 1 records the decisions that stand,
each with its one-line reason, so they are not argued again. Part 2 is a fresh review of the schema
as it is today. Every claim was checked against the code (`PxAnimatorTypes.ts`,
`PxAnimatorConstants.ts`, the four players, the editor's writer), not against docs/format/README.md.

**The bar.** Readable by someone who knows CSS keyframes / WAAPI / GSAP without reading prose
first, and easy for an LLM to emit correctly on the first try. Both point the same way: familiar
vocabulary, one obvious spelling per concept, no single-value ceremony, the common case in the
fewest keys.

**Why now.** Nothing is published, so a wire change costs one migration in this repo. After the
first release every rename or removal needs a `b` bump and a converted step
([dev-docs/versioning.md](./dev-docs/versioning.md)).

## Part 1 — Decisions that stand

| Topic | Decision | Why |
|---|---|---|
| Time-driven timeline | `timeline.type` optional; absent = `'time'`; `'scroll'` / `'view'` explicit | `clock` was invented vocabulary; `document` is overloaded (the JSON *is* a document); absent-means-time lets the common case declare nothing |
| Fill | `timeline.fillMode` | CSS `animation-fill-mode`. `fill` means paint everywhere else in the format — a model would write `fill: "forwards"` on a shape |
| Embedded fonts | `definitions.fonts[…].glyphs[char]` | the outer map holds fonts, not glyphs |
| Debug handle | `animator.debugGlobalName` | says what it does, no abbreviation |
| Bind-by-id map | ~~keep `animateById`~~ → superseded by 2.12: `bindings` list of `{ target, animations }` | `animateBy` reads like `transformBy` / `maskedBy` (an effect); bare `animate` collides with `node.animate`. Best alternative if it ever moves: `animateTargets` |
| Loop | `loop.repeatAt: 'start' \| 'end'`, `loop.direction: 'normal' \| 'alternate'` | the same words as `timeline.direction`; `extend` was a direction word posing as a duration word |
| Element references | `maskedBy.source` / `clone.source`, always `'#id'` | name the field for what it holds; `sourceId: "#a"` invited the bare form |
| By-name references | `<key>With: Array<string>` names entries of the matching `definitions` table (`animateWith` → `definitions.animations`); the bare key holds the thing itself | one convention for "by name": `source` / `target` point at elements (`#id`), `…With` at definitions, `…By` is an effect. Only `animateWith` uses it today (2.12); `styleWith` / `effectsWith` would follow the same rule when needed |
| Attribute names | camelCase DOM names — React's spelling (`strokeWidth`, `fontSize`, `viewBox`); the SVG kebab spelling is accepted on read; `style` keys are camelCase CSS property names too, as in React's `style` prop (`whiteSpace`) | one spelling to write, the one every React user already knows, and the DOM gets the standard attribute either way. Typed as `[camelCaseDomKey: string]` so the name says it |
| Text on a path | `textPath.pathData` | `path` read like a `#id` reference to a `<path>` |
| Clone | `clone.without?: 'translate'` (`'transform'` reserved) | the `<use>` can point at one wrapper layer only, so the options form a ladder — whole → without translate → content only. Additive names lie about the middle rung, which still rotates |
| Engine | `timeline.engine: 'auto' \| 'native' \| 'js'`; code consts `PxTimelineEngine {native, js}` and `PxTimelineEngineExtra = {...PxTimelineEngine, auto}` | `engine` announces an implementation preference, not a behavior switch; `native` / `js` say how the attributes get updated. `runtime` is taken by the export block in `data-px-meta`. Not to be re-argued: `auto` resolves **per document** after the `CSS.supports` probe, and React Native never reads the key |
| Frame rate | `timeline.frameRate`, shared by every timeline type | it parameterises the engine, so it sits beside it; `animator` keeps only non-playback keys |
| After a natural finish | `trigger.finishAction: 'hold' \| 'reset'` | pairs with `outAction`, stays clear of the `onFinish` callback |
| Keyframe time | absolute ms, not a 0–1 `offset` | stable when the story grows: adding a second leaves every existing keyframe untouched (Lottie is absolute for the same reason) |
| `type` | the one kind marker — node tag, timeline, gradient | every JSON ecosystem expects it; `domType` is the escape for an element with a real `type` attribute |
| Keyframe keys | wire: `time` / `value` / `easing` / `tangentIn` / `tangentOut`. `t` / `v` / `e` exist only on the runtime type `_PxNormalizedKeyframe` | locked by `KeysMatch`; the wire type cannot carry the short keys |
| Aliases | none, and no tolerant readers | one spelling per concept; after release, conversions live only in the version steps |
| Single-value fields | not written on the wire | a one-option choice makes the reader hunt for the others |
| Schema version | `animator.version: "a.b.c"`, stamped by the editor | a diagnostic, not a gate ([dev-docs/versioning.md](./dev-docs/versioning.md)) |
| Machine checks | `validateDocument`, `SCHEMA.json`, the entry diagnostic | silence is not proof of correctness for a generated document |
| Text effect wrapper | keep `effects.text: { useGlyphs }` — do NOT flatten to `effects.useGlyphs` (2.11) | `effects` holds effect OBJECTS named for what they do; a bare boolean among them would read wrong, and the object is where the next text option goes without a wire change |

## Part 2 — Review of the current schema (2026-09-10)

| # | Finding | |
|---|---|---|
| 2.1 | ✅ `trigger.startOn` has no default, and web and React Native disagree about a missing trigger | 🔴 |
| 2.2 | ✅ Text content has two keys, and the players prefer different ones | 🔴 |
| 2.3 | ✅ The flat legacy `animator` spelling still plays — silently | 🟠 |
| 2.4 | ✅ Five spellings of "path data"; an animated `d` needs a wrapper the static one does not | 🟠 |
| 2.5 | ✅ The font key is an unspecified string — editor and importer spell it differently; `fontStyle` is carried but never matched | 🟠 |
| 2.6 | ✅ `pin.top` is an offset named like an edge; `pin.distance` has a unit found nowhere else | 🟠 |
| 2.7 | ✅ Wire enums: some have constants, some only types, some nothing | 🟡 |
| 2.8 | ✅ Union failures do not name the bad key | 🟡 |
| 2.9 | ✅ An unknown easing name passes validation and plays linear | 🟡 |
| 2.10 | ✅ `animator.version` accepts any string (validator half; `SCHEMA.json` pattern still open) | 🟢 |
| 2.11 | ⏸ `effects.text` wraps a single flag — **decided: keep it**, see the section | 🟢 |

🔴 a file plays differently from what it says, or differently per player · 🟠 a reader or model
will likely write it wrong · 🟡 tooling and consistency · 🟢 polish

### 2.1 ✅ `trigger.startOn` has no default 🔴

> **Done 2026-09-11** (recommended option, `'load'`). `PxTriggerSchema` declares `startOn` default
> `'load'` and `outAction` default `'continue'`. Core's `PX_TRIGGER_DEFAULTS` + `resolveTrigger()`
> are the one resolution: the web's `setupAnimationTriggers` and the React Native component both
> call it, and both web engines now wire every time-driven document. React Native's `outAction`
> fallback is `'continue'`. Locked by `PxTriggerDefaults.test.ts`, `PxAnimatorWebApiTrigger.test.ts`
> and new cases in `PxAnimatorTriggers.test.ts` / `PxAnimator.test.ts`.

Every trigger field has a default except the one that decides whether anything happens:

| Field | Default |
|---|---|
| `outAction` | `'continue'` |
| `finishAction` | `'hold'` |
| `scrollIntoViewThreshold` | `0` |
| `startOn` | none |

What the players do when it is missing:

| | No `trigger`, or a `trigger` without `startOn` | Missing `outAction` |
|---|---|---|
| Web (React and Vue go through it) | nothing starts until `play()` — the engines wire triggers only `if (config.trigger)`, the start `switch` has no default, and WAAPI animations are created idle | `'continue'` (`PxAnimatorTriggers.ts:42`) |
| React Native, `autoplay` | plays on mount — `trigger?.startOn ?? 'load'` (`PixodeskSvgAnimator.tsx:515`) | `'pause'` (`:516`) |

So one file starts on a phone and not in a browser, and the public docs said "`load` (default)"
until today. The editor's own default is *On load*.

**Recommendation:** give `startOn` a default in the schema and resolve the trigger in one core
helper that every player calls.

- **`'load'`** (recommended) — a document is designed to play. It matches CSS animations,
  lottie-web's autoplay, the editor's default and what React Native already does, and the
  "smallest document that animates" would need no trigger at all.
- `'programmatic'` — today's web behavior. Safest for embedding, but every author must remember
  the trigger.

Either way React Native's `outAction` fallback becomes `'continue'`.

### 2.2 ✅ Text content has two keys 🔴

> **Done 2026-09-11.** `textContent` is the one key: declared on the node schema as a string
> (so a wrong value is a schema error, and it is in both field-inventory snapshots), read by
> every player and by the editor. `text` is gone — from `INTERNAL_ATTRS`, from the exports
> (`TEXT_ATTR`) and from every reader (web and React Native renderers, the glyph and text-path
> effects, the editor's `UnitRestore`). 234 keys in 33 fixture files migrated (React Native
> examples, editor specs, the e2e `.data` fixture, two saved retest SVGs). Locked by
> `PxWireSpellingGuard.test.ts` (no `text` key in any fixture), `PxInternalAttrs.test.ts` and
> `PxAnimatorDOM.test.ts`. Because nodes are open objects, a stray `text` is now just an unknown
> attribute: it renders no text, and validation does not flag it.

`textContent` (what the editor writes) and `text` (`TEXT_ATTR`) are both read, in different orders:

| Reader | Order |
|---|---|
| web DOM renderer (`PxAnimatorDOM.ts:106`) | `textContent \|\| text` |
| React Native (`PxRnRender.tsx:111`) | `text \|\| textContent` |
| glyph effect (`textGlyphsEffect.ts`) | `textContent ?? text` |

A node carrying both shows different text on web and on a phone. Also:

- neither key is declared in the node schema (nodes are open objects), so `textContnet` passes to
  the DOM as an attribute with no warning;
- `text` already names something else: `effects.text`, the glyph-rendering switch.

**Recommendation:** keep `textContent` — the DOM property, and what the editor writes. Drop `text`
from `INTERNAL_ATTRS` and every reader, and declare `textContent: string` on the node schema so it
is typed and validated.

### 2.3 ✅ The flat legacy `animator` spelling still plays 🟠

> **Done 2026-09-11** (dropped, as recommended). `getAnimatorConfig` — the door every player reads
> a document through — removes the flat runtime-view keys (`PX_FLAT_RUNTIME_VIEW_KEYS`, now one
> exported list instead of three copies), so they never reach an engine; `flattenAnimatorTimeline`
> still folds the wire `timeline` and stays identity for the internal runtime view the editor
> writes through. The entry diagnostic has no `legacy` bucket any more: `PxDocumentDiagnosis` is
> `{ problems }`, and a flat key is reported like any other unrecognized key. Locked by new cases
> in `PxTimelineCompat.test.ts` (watched to fail) and the rewritten `PxDocumentDiagnostic.test.ts`.

`flattenAnimatorTimeline` returns the config unchanged when there is no `timeline`, so the
pre-2026-09 spelling reaches the engines as the runtime view:

```jsonc
"animator": { "duration": 500, "iterations": 2, "trigger": { "startOn": "load" } }   // plays
```

- `validateDocument` rejects it (three "unexpected extra key").
- The entry diagnostic files these under `legacy` and stays silent on purpose
  (`PxDocumentDiagnostic.ts`, `LEGACY_FLAT_KEYS`).
- Next to a `timeline`, the timeline wins without a word: `duration: 500` beside
  `timeline.duration: 900` plays 900.

That is a compatibility path nobody declared: it plays, fails validation and never warns, which
contradicts "no aliases" in Part 1.

**Recommendation:** drop it now — `flattenAnimatorTimeline` ignores flat keys, and the diagnostic
reports them like any other unknown key. Pre-release this costs nothing; after release an old file
is exactly what a version step converts. If it has to stay, it needs a documented legacy status
rather than a silent one.

### 2.4 ✅ Five spellings of "path data" 🟠

> **Done 2026-09-11/12.** Two spellings left: `d` where SVG owns it (the node attribute), and
> `pathData` everywhere else — `effects.clipPath.pathData`, the keyframe/static value
> `{ pathData: "M…" }`, and the editor's own path-value object. The Lottie-style
> `{ paths: [{v,i,o,c}] }` member is **gone** from the wire; it survives only as the
> interpolator's internal shape (`normalizePathValue`), and the editor's legacy read of it was
> deleted. 4232 keys across 83 fixture files migrated (dry-run first; JSON keys everywhere, the
> JSON5 dialect only inside `data-px-meta`), both field-inventory snapshots and `SCHEMA.json`
> regenerated. Locked by `PxPathDataSpelling.test.ts` (watched to fail) and a new
> `PxWireSpellingGuard` rule that rejects `"path"` / `"paths"` keys in any fixture.
>
> **Second wave — the editor's own files.** Deleting `PxAttrPathObj.fromJson`'s legacy
> `paths:[…]` branch silently strips the geometry of any file still written that way, so those
> were migrated too: 733 occurrences across 12 live `dev-public/` and `tests/` assets, the
> bundled demo `src/assets/web-demo-files/girl-on-bike.svg.txt`, and the e2e `.data` format
> doc. The rewrite preserves each file's dialect — JSON5 files take the unwrapped
> `pathData:'M…'` (manual rule 9), pre-JSON5 files keep the wrapper as `pathData:path(M…)`,
> which exists only because bare commas broke the old parser. An empty `paths:[]` becomes
> `pathData:''` — exactly what the deleted branch produced for it. Left alone on purpose:
> archive and build trees (`__ANIMATIONS__/`, `site/__pixodesk2__old/`, `build-debug/`,
> `allure-results/`, `*.old.svg` backups) and two **STATUS: IMPLEMENTED** plan docs that
> record the *previous* migration and should not be rewritten.
>
> **Third wave — the last two slots, both now closed.** `definitions.fonts[…].glyphs[c].d`
> → `pathData` (`_PxGlyph` + `PxGlyphSchema`, both player reads in `textGlyphsEffect`, the
> editor's `TSvgGlyph`/`TSvgGlyphDefs` and `GlyphDefsConverter`, 251 keys in library fixtures
> and 551 in app fixtures — rewritten strictly inside `glyphs` blocks so a node's own `d`
> attribute is never touched). The editor-only `meta.appliedEffects.shape.path` → `pathData`
> (`SvgShapeEffectSchema`, `SHAPE_GENERATORS`, `TSvgPathShapePartsValue`). `SCHEMA.json`,
> both field-inventory snapshots, `docs/format/README.md`, `../schema-design.md` and `docs/format/README.md`
> regenerated or corrected to match. The only `d` left is SVG's own node attribute.

Every slot below is now settled — `d` only where SVG owns the name, `pathData` in every
structure of ours (☑ = done):

| Where | Key — was → is | Shape | |
|---|---|---|---|
| node attribute | `d` — **kept**, SVG owns it | `"M…"` | ☑ |
| `effects.clipPath` | `d` → `pathData` | `"M…"` · `{value}` · `{keyframes}` | ☑ |
| `definitions.fonts…glyphs[c]` | `d` → `pathData` | `"M…"` | ☑ |
| `effects.textPath` | `pathData` — already right | `"M…"` | ☑ |
| keyframe `value` of an animated `d` | `path` → `pathData` | `{ pathData: "M…" }` | ☑ |
| keyframe `value`, legacy | `paths` → **removed from the wire** | was `{ paths: [{ v, i, o, c }] }` | ☑ |
| editor `meta.appliedEffects.shape` | `path` → `pathData` | `"M…"` · `{keyframes}` | ☑ |

1. **The wrapper breaks "one rule for every attribute".** A static `d` is `"M…"`; an animated one
   needs `value: { path: "M…" }`. A plain string keyframe value *validates* — the value union
   includes strings, for colors — but does not morph, because the interpolator reads only
   `.path` / `.paths` (`PxDefinitions.ts:184-191`). A silent wrong document, and the one a model is
   most likely to write.
2. **`{ paths }` has no owner.** The editor never writes it (it reads it as back-compat in
   `PxAttrSerializationObjs.ts`), no doc mentions it, and its single-letter keys `v` / `i` / `o` /
   `c` are the only Lottie-isms in the format.
3. **`clipPath.d` and `textPath.pathData`** hold the same thing under two names.

**Recommendations:**

- Remove `{ paths }` and `PxBezierPathSchema` from the wire (pre-release, no alias).
- Let a `d` keyframe take the same plain string as the static attribute — or at least have
  `validateDocument` reject any other value shape on a `d` keyframe.
- Pick one name for the two effect slots. `d` is SVG's own name and is already used twice.

### 2.5 ✅ The font key is an unspecified string, and two writers spell it differently 🟠

`definitions.fonts: Record<key, { fontFamily, fontStyle, ascent, unitsPerEm, glyphs }>`.

The player's whole lookup is one line — the key is matched against the node's `font-family`
**verbatim**, with no notion of family vs face (`textGlyphsEffect.ts:178`):

```ts
const gf = s.fontFamily ? glyphs[s.fontFamily] : soleFont;
if (!gf) warnings?.push('textGlyphs: no glyphs for font "' + … + '"');
```

Nothing says what that key *is*, and the two writers disagree.

**The editor** stores the node's `font-family` string and re-uses it as the key, copies it into
`fontFamily`, and hardcodes the style (`TSvgGlyphDefs.build`):

```ts
fonts.push(new TSvgGlyphFont(fName, fName, '', ascent, emSize, glyphs));
//                           key    family  ^^ fontStyle is ALWAYS ''
```

```jsonc
// elem.text.json (editor-written) — key repeated in fontFamily, style blank
"fonts": { "Roboto-Regular": { "fontFamily": "Roboto-Regular", "fontStyle": "", … } }
```

**The Lottie importer** keys by face id and fills both fields properly:

```jsonc
// 94983-logo-liquid-json-animation — same family, two faces, real style names
"fonts": {
  "Kanit-Light": { "fontFamily": "Kanit", "fontStyle": "Light", … },   // 5 glyphs  — used
  "Kanit-Bold":  { "fontFamily": "Kanit", "fontStyle": "Bold",  … }    // 11 glyphs — never referenced
}
```

What follows from having no rule:

1. **`fontFamily` is either a duplicate or a value nobody matches.** Editor-written: identical to
   the key. Imported: the true family `"Kanit"` — which is exactly the string a hand-written SVG
   or a CSS-minded author would put in `font-family`, and it matches **neither** key. The
   document still renders only because imported *nodes* also carry the face id.
2. **The sole-font fallback is narrower than it looks.** `soleFontOf` returns the only entry when
   exactly one font is embedded, but `glyphFontFor` consults it ONLY when the node carries no
   `font-family` at all — `s.fontFamily ? glyphs[s.fontFamily] : soleFont`. It is **not** a rescue
   for a key that misses. So a miss is a console warning and a row of □ placeholder boxes however
   few fonts are embedded, and `"Kanit"` above would render nothing.
3. **Nothing says whether the CSS weight/slant attrs pick a face.** Characters are bucketed on
   `font-family` verbatim (`TSvgTspanElement.readAllChars`) while `font-weight` and
   `font-style: italic` sit beside it, so the format alone can't tell you whether
   `font-family: "Roboto-Regular"` + `font-weight: 700` means *the Bold face* or *the Regular face,
   styled bold*. It means the latter: the font dropdown writes the FACE into `font-family`
   (`onReduceFName` → `fontFamily.setValue(fName)`, split back for display with
   `parseFontFileName`), so `Roboto-Light` and `Roboto-Regular` are already two keys with their own
   outlines. Only the code said so — and a reader that guessed otherwise would silently swap faces.
4. **Dead payload.** `Kanit-Bold` above ships 11 outlines nothing can reach.

> **Done 2026-09-12 — items 1 and 3.** The rule is now written down instead of living only in the
> code: the key is the **face name**, i.e. exactly the node's `font-family` (`docs/format/README.md`,
> `docs/format/README.md`), and `font-weight` / `font-style` are CSS styling on top of that face —
> never a way to select another one. No derivation, no weight→style-name mapping: a face's name is
> whatever the font file is called (`SemiBold`, `Black`, …), the author picks it from the font
> dropdown, and the writer stores it verbatim.
>
> The one code change: `TSvgGlyphDefs.build` no longer copies the key into `fontFamily` — it records
> the real family and face (`splitFaceName`, the same `Family-Style` split the font panel already
> does with `parseFontFileName`), which is also what `GlyphDefsConverter` feeds back out to Lottie.
> Pinned by `GlyphDefsExtractor.spec.ts` (one bucket per face; the CSS weight/italic attrs neither
> split nor merge one) and `textGlyphsEffect.test.ts` (each face resolves its own outlines; the CSS
> attrs never re-pick the face).

> **Done 2026-09-12 — the cross-reference check.** `validateDocument` now reports a glyph-mode
> text whose `font-family` has no `animator.definitions.fonts` entry
> (`validateGlyphFontRefs`), naming the face and the node that declares it — one problem per
> mistake, not one per descendant that inherits the name. Nothing caught this before: the schema
> validates each side's SHAPE, never that the two agree, so a key/`font-family` disagreement
> reached the renderer and became □ placeholder boxes behind a console warning. Pinned by
> `PxGlyphFontRefs.test.ts`, including its two deliberate silences.
>
> It stays silent in the legal cases, each checked against the fixture corpus first: a document
> that embeds NO faces (browser-font text — `elem.text.mixedSpans.json`), and a node with no
> `font-family` (with one face embedded the player resolves it via `soleFont`).

**Item 2 — decided, keep it.** A miss renders nothing: `glyphFontFor` is
`s.fontFamily ? glyphs[s.fontFamily] : soleFont`, so the sole-font fallback helps only a node with
NO `font-family`, and a node naming an absent face gets a console warning and □ placeholder boxes.
That stands, deliberately: a visible failure beats silently drawing the wrong typeface, the reader
cannot know WHICH of several embedded faces was meant, and since the cross-reference check above a
mismatch is caught before the document ships rather than at render time. The behavior was
inherited rather than chosen — now it is chosen.

**Item 4 was not a defect** — withdrawn. An entry no node references is legal and deliberate: the
outlines of a text whose glyph mode is currently off are kept so toggling it back on needs no font
reload. 12 of the 34 font-carrying fixtures are in exactly that state, every one of them with zero
glyph-mode texts (`elem.text.browser.json`, `…glyphsOff.json`, `…browserFont.json`), which is why
the new check deliberately does NOT flag it. The editor prunes the genuinely stale ones anyway
(`ensureGlyphDefs` → `hasGlyphsOutside` / `prunedTo`, on both the live-fixer and save paths), so
`94983`'s `Kanit-Bold` is a stored-file artifact that disappears on the next save.

Changing the key structure after release needs a converted step. (`fontFamily` / `fontStyle` are
**not** inert and must not be dropped — `GlyphDefsConverter` feeds both back out to Lottie as
`font.fFamily` / `font.fStyle`.)

### 2.6 ✅ `pin` 🟠

> **Done 2026-09-12.** `pin.top` → **`pin.offset`**: it is a delta from whichever edge `align`
> picked, so `{ align: 'bottom', top: 20 }` read as a contradiction. The internal runtime-view
> twin moved with it (`scroll.pinTop` → `scroll.pinOffset`) — leaving the two spelled differently
> would have recreated the split §2.5 just closed. Renamed across the wire schema, the
> `flatten`/`nest` bridge, the player's sticky-offset implementation (`PxScrollDriver`), the
> editor's attr model, CSS export and the UI field (its label already read "Offset"), plus
> `mangle-reserved.json` — a miss there would have let the minifier mangle the property and break
> pinning **only in production**. `distance` keeps its name, with the unit ("viewport heights")
> already stated in `docs/format/README.md` and `docs/format/README.md`. No document fixture carries a pin, so
> there was nothing to migrate. Locked by `PxTimelineCompat.test.ts` (both directions of the
> bridge), `PxScrollDriver.test.ts`, `animator-config.spec.ts` and `scroll-css-export.spec.ts`.
>
> Left alone deliberately: `align`'s `'top'` VALUE (that one really is an edge), the CSS `top`
> property the exporter emits, and the historical `scroll-timeline*.md` planning docs.

```ts
pin?: boolean | { align?: 'top' | 'center' | 'bottom'; offset?: number; distance?: number }
```

- `top` was "px offset from the aligned position", so `{ align: 'bottom', top: 20 }` read as a
  contradiction.
- `distance` is in **viewport heights** — the only viewport-relative unit in a format that
  otherwise uses px, ms and 0–1 fractions — and nothing in the name says so.

**Recommendation:** rename `top` to `offset`. Keep `distance`, with the unit stated wherever the
field is (docs/format/README.md now says it).

### 2.7 ✅ Wire enums: constants, types, or nothing 🟡

> **Done 2026-09-12.** One exported `Px*` const per wire enum, with the string type derived from
> it under the same name. Ten names added (`PxFillMode`, `PxPlaybackDirection`, `PxStartOn`,
> `PxOutAction`, `PxFinishAction`, `PxScrollKind`, `PxScrollAxis`, `PxScrollSource`, `PxPinAlign`,
> `PxAlongPathMode`, `PxScrollPhase`), and every `px.enum([…])` in the schema now references its
> members instead of repeating bare literals. Both mismatches are gone: `PxStartOn` includes
> `'programmatic'` (which retired the local `StartOnExtra` patch that existed only to add it back),
> and `PxGradientUnits` folded into `PxUnits` — one name for one value set. The four formerly
> type-only names are now VALUE exports, so a consumer gets `PxStartOn.click` and
> `startOn?: PxStartOn` from one import; `PxFillMode` was also a dead import in the React and Vue
> components and is gone.
>
> **Verified code-only, as promised:** `SCHEMA.json` regenerated byte-identical and the
> field-inventory snapshot unchanged — the accepted strings never moved, so no document, fixture or
> `data-px-meta` blob needed migrating. All five packages and the app typecheck clean.
>
> **Not a TypeScript `enum`, deliberately.** These are wire values and a document is authored as
> plain JSON (`{ startOn: 'click' }`). A string `enum` is nominal, so that literal would not
> typecheck without importing the enum; the derived union accepts both spellings. It is also the
> only form that composes (`PxTimelineEngineExtra` spreads `PxTimelineEngine`) and that survives
> erasable-syntax builds. Real `enum`s stay right for internal discriminators, which is what the
> five in this library and the ~150 in the editor already are.

How it looked before — one concept, four spellings:

| Kind | Slots |
|---|---|
| exported `Px*` const | `engine`, `loop.repeatAt`, `loop.direction`, `clone.without`, `strokeTrim.subPaths`, gradient `type` / `gradientUnits` / `spreadMethod` |
| const, not in the public API | `maskType` (`PxMaskType`), mask units (`PxUnits`), `textPath` `pathOverflow` / `lengthAdjust` / `method` / `spacing` |
| type only — no runtime value, no `Px` prefix | `fillMode` (`FillMode`), `timeline.direction` (`PlaybackDirection`), `startOn` (`StartOn`), `outAction` (`OutAction`) |
| nothing | `finishAction`, `scroll.kind`, `axis`, `source`, `range.*.phase`, `pin.align`, `alongPathMode` |

Two outright mismatches as well: `StartOn` omitted `'programmatic'`, which the schema accepts, and
`PxUnits` / `PxGradientUnits` were the same two values under two names.

(`timeline.type` is NOT in that last row, contrary to an earlier draft of this finding: the
timeline union is discriminated structurally and has no `px.enum` to name.)

### 2.8 ✅ Union failures do not name the bad key 🟡

> **Done 2026-09-12.** The headline stays (consumers match on it), and after it a failed union
> now reports the member that got FURTHEST into the value — the likeliest intended shape:
>
> ```
> root.children[0].opacity: no union member matched for value {"keyframe":[{"time":0,"value":1}]}
> root.children[0].opacity.keyframes: expected array, got undefined
> root.children[0].opacity.keyframe: unexpected extra key
> ```
>
> The three cases that used to read identically now differ. A wrong leaf type points at the leaf
> — `…opacity.keyframes[0].value: expected finite number, got "nope"`. Short `t`/`v` keys name all
> four facts (missing `time`, missing `value`, extra `t`, extra `v`). A value that cannot descend
> at all gets ONE folded line naming what the slot accepts —
> `…opacity: expected finite number | object` — not one complaint per alternative.
>
> **Why not every variant, which you might expect.** `Union.isValid` already ran each member
> against a scratch context and threw the errors away, so reporting them all was free. But the
> real unions run to 11 members (`PxKeyframeValueSchema`), and a typo inside one object member
> would have arrived buried under ten "expected string, got object" lines. Scoring by depth
> reached (longest error path, fewest errors as tie-break) and appending at most
> `UNION_MEMBER_ERROR_LIMIT` (4) lines keeps the useful one visible.
>
> Pinned by `PxSchemaUnionErrors.test.ts` — six cases, watched failing first: with the diagnosis
> block disabled, 4 of 6 fail and the two that cover the unchanged headline and the success path
> stay green. Costs nothing on the success path (the re-run happens only after a union has
> already failed) and nothing on the wire.

A strict object reports precisely — `root.children[0].effects.strokeTrim.ofset: unexpected extra
key`. A union reports only that nothing matched:

```
root.children[0].animate: no union member matched for value {"opacity":{"keyframe":[…]}}
```

The same message comes back for a `keyframe` / `keyframes` typo, for `t` / `v` short keys and for
an object-valued node typo, so the entry diagnostic and any LLM repair loop get no pointer to the
fix.

**Recommendation:** when every member fails, report the member that got furthest — here
`…opacity.keyframe: unexpected extra key`.

### 2.9 ✅ Unknown easing names 🟡

> **Done 2026-09-12.** `validateDocument` now cross-checks every named easing against
> `definitions.easings` (`validateEasingRefs`), so the likeliest silent mistake in a generated
> document is caught before it ships instead of playing linear behind one `console.warn`:
>
> ```
> root.children[0].animate.opacity.keyframes[1].easing: "ease-in-out" names no entry in
> animator.definitions.easings — it will play linear
> ```
>
> A misspelling reads the same way (`"softdrop"` for `softDrop`), and a name is reported even when
> the document defines no `easings` block at all. An inline cubic-bezier array is silent — there is
> nothing to cross-check — and only the wire spelling `easing` is read: the runtime view's `e` is an
> already-RESOLVED curve, never a name.
>
> Verified against the corpus before shipping: **0 problems across 260 documents**, so no real file
> is newly flagged. Pinned by `PxEasingAndVersionRefs.test.ts`, watched failing first — with the
> pass disabled its two positive cases fail while every "accepts"/"says nothing" case stays green.
> No player cost: this is a tooling check, and the runtime resolver is untouched.

`easing: "ease-in-out"` validates (it is a string), finds nothing in `definitions.easings`, and
plays linear with a console warning (`resolveEasing`, `PxDefinitions.ts:245`). CSS keywords were
left out on purpose (player weight), which makes this the likeliest silent mistake in a generated
file.

**Recommendation:** `validateDocument` checks that every string easing names a
`definitions.easings` key — a cross-reference check with no player cost.

### 2.10 ✅ `animator.version` accepts any string 🟢

> **Done 2026-09-12 — the validator half.** A present stamp that does not parse is now reported
> (`validateVersionStamp`), so a document can no longer lose the one diagnostic saying which schema
> wrote it:
>
> ```
> root.animator.version: "v1" is not a version stamp ("a.b" or "a.b.c") — it reads as unstamped
> ```
>
> Parsing is delegated to the reader's own `parseWireVersion`, so the validator and the reader can
> never disagree about what counts as a stamp — no second regex. A nearly-right stamp is caught too
> (`"1.1.1-beta"`, `"1"`), and an ABSENT stamp stays legal and silent: unstamped is a valid state,
> only a broken stamp is a problem. Corpus check before shipping: the only stamps in the whole
> fixture set are `1.1.1` (×387), `1.9.1`, `2.0.0` and `1.0.1` — all parse, **0 newly flagged**.
>
> **Not done: the `SCHEMA.json` `pattern`.** The generator has no `pattern` support at all — its
> string leaf emits a flat `{ type: 'string' }` — so teaching it per-field annotations is a change
> to the generator rather than to the schema, and it is left for that.

It is `px.string()`: `"v1"` validates and is then read as unstamped. `SCHEMA.json` could carry
`pattern: "^\\d+\\.\\d+(\\.\\d+)?$"`, and `validateDocument` could flag a stamp that does not parse.

### 2.11 ⏸ `effects.text` wraps a single flag 🟢 — decided, keeping it

> **Decided 2026-09-12: leave as is.** Still true — `_PxTextEffect` has exactly one member
> (`useGlyphs?: boolean`) — but the wrapper stays. `effects` is a bucket of effect OBJECTS, each
> named for what it does (`repeater`, `strokeTrim`, `maskedBy`, `textPath`); flattening to
> `effects.useGlyphs` would put a bare boolean among them and leave text rendering the one option
> with no home to grow into. Reserving the object costs one pair of braces and keeps the next text
> option (a glyph-quality or fallback-behavior key) from forcing a wire change.

`effects: { text: { useGlyphs: true } }` has one member. Either reserve it for more text options,
said where the reader sees it, or flatten to `effects.useGlyphs`.

### 2.12 ✅ `animateById` → `bindings` 🟠 — done 2026-09-13

**Where.** `animator.animateById?: Record<'#id', PxElementAnimation>` — the bind-by-id map of a
pre-rendered SVG + JS export; `PxElementAnimation` is the four-way union `string | Array<string> |
{ prop: ANIMATE } | Array<string | { … }>`, shared with `node.animate`.

**Why it matters.** Two things read badly: the reference is a *key*, so an export reads
`"#_px_3cnuvau3": ["a0"]` with nothing saying what either side is; and the value may take four
shapes, so a reader (human or model) has to guess which one it is looking at. Checked against the
writers and readers before deciding: the editor writes exactly one shape — an array of names into
`definitions.animations` (`SvgJsaAnimationDictBuilder.toJson` returns `Record<string, Array<string>>`),
never a bare string or inline keyframes; the editor never reads the map back (it rebuilds from the
element attributes); the player resolves all four (`resolveElementAnimation`); the other three shapes
live only in player tests and the schema-coverage fixture. On nodes it is the mirror image: 4255
fixture `animate` values, every one the inline record, none a name.

**Decision.** A list, one shape, names only:

```jsonc
"animator": {
  "definitions": { "animations": { "a0": { "opacity": { "keyframes": [ … ] } } } },
  "bindings": [
    { "target": "#_px_3cnuvau3", "animations": ["a0"] }
  ]
}
```

- `bindings` — the docs already say "bind-by-id document", core already has `PxBinding` /
  `getBindings`; the word steers a writer toward *referencing* a definition rather than inlining
  keyframes (that is what a binding is). Rejected: `animateBy` (reads like an effect, §Part 1),
  `animateElements` (a command, not a list), `animationBindings` (`animator.animationBindings` says
  "anim" twice).
- `target: "#id"` — the reference is a value, spelled like every other reference (`source`,
  `partOf`, `href`); the last place in the format where a `#id` was a key goes away.
- `animations: Array<string>` — the same word as `definitions.animations`, so the link is visible.
  No inline form: nothing ever wrote one, and `definitions` is where an animation with a name lives.
- `node.animate` is NOT touched: this change is the bind-by-id map of a pre-rendered SVG only.
  Self-contained documents keep `node.animate` exactly as it is (`PxElementAnimation` stays).

**Plan.**
1. Core: `PxBindingSchema = { target, animations }` (the wire item), `animator.bindings: Array<PxBinding>`;
   the runtime `{ id, animate }` that `getNormalizedBindings` returns becomes `PxNormalizedBinding`
   (like `PxNormalizedKeyframe`); `getBindings` / `generateNewIds` (`PxIdUtil`) / `CONTENT_KEYS`
   (`PxAnimatorConfigPatch`) follow.
2. Version: none — a clean change at `1.1`. Nothing has been released to a client, so there is no
   file to convert; `animateById` simply stops existing (no alias, no tolerant reader, per Part 1).
3. Editor: `SvgJsaAnimationDictBuilder.toJson` returns the list; `SvgaJsonSerializationUtil`
   writes `bindings`; the coverage doc (`PxSchemaFullCoverageDoc`) and specs follow; the stamp
   stays `1.1.x`.
4. Fixtures: the bind-by-id fixtures in the player tests, e2e pages and examples move to the list
   (none of the app's JSON fixtures carries the map — it exists only inside SVG+JS exports).
5. Docs: docs/format/README.md / format README typings and tables, the API reference (now the guides under docs/library), the bind-by-id examples;
   `tools/docs-check` holds them to the new schema. Part 1's "keep `animateById`" row is
   superseded by this entry.

### 2.13 ✅ `definitions.styles` and the name form of `node.style` 🟡 — removed 2026-09-13

**Where.** `definitions.styles: Record<name, Record<attr, string | number>>` and
`node.style: string | Record<…>`, where a string was "the name of a preset" — and, per docs/format/README.md,
also "CSS text". `resolveStyle` treated every string as a name, so CSS text resolved to `undefined`.

**Why it matters.** The same polymorphism `animateById` had (2.12), on a key nobody used: the editor
writes `style` objects only (615 fixtures, 0 strings) and never writes `definitions.styles`; no
player test covered the name form.

**Decision.** Removed rather than fixed: `definitions` is `easings` / `animations` / `fonts`;
`node.style` is an object of attribute → value, nothing else; `resolveStyle` is gone (web and
React Native apply the record directly). When presets are wanted, they come back as
`definitions.styles` + `node.styleWith: ["label"]` under the `…With` convention — designed then,
not carried as a hypothetical now. Clean change at `1.1` (pre-release); ship-guard inventories
regenerated.

## What already works — keep it

- **One rule for every attribute** — a primitive, `{value}` or `{keyframes}`. (2.4 was the one
  exception and is now fixed: an animated `d` takes `{ pathData: "M…" }` like every other slot.)
- **Pass-through attributes** — existing SVG knowledge applies directly.
- **Strict objects** (the animator block, every `ANIMATE`, every effect) give exact
  `path: unexpected extra key` errors.
- `'infinite'` as a string; effects named for what they do (`repeater`, `strokeTrim`, `maskedBy`).
- `SCHEMA.json` is generated from the runtime schemas, so it cannot drift.

## The order it was done in — all of Part 2 is closed

Kept as the record of why the waves ran in this order; every row below is now done or decided.

| | Items | Why it went here | |
|---|---|---|---|
| 1 | 2.1, 2.2 | the same file behaved differently per player | ✅ |
| 2 | 2.3, 2.4, 2.5 | wire shape — free pre-release, a version step after | ✅ |
| 3 | 2.6 | a rename, same reasoning | ✅ |
| 4 | 2.7, 2.8, 2.9 | code and validator only, no wire change | ✅ |
| 5 | 2.10, 2.11 | polish | ✅ 2.10 (validator half) · ⏸ 2.11 keep |

**What is deliberately NOT done**, both recorded in their sections rather than left implicit:

- **2.5** — a glyph face that misses renders □ placeholder boxes; the sole-font fallback applies
  only to a node with no `font-family` at all. Kept on purpose: a visible failure beats silently
  drawing the wrong typeface, and `validateDocument` now catches the mismatch before it ships.
- **2.10** — `SCHEMA.json` carries no `pattern` for the version stamp. The generator has no
  `pattern` support (its string leaf emits a flat `{ type: 'string' }`), so that is a change to
  `scripts/gen-schema-json.mjs`, not to the schema.
