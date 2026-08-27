# SVGA Format — Schema Design (player + editor)

The design record of the SVGA wire format: the layers, the generative rules, the value taxonomy,
the editor's unit contract, the corpus that pins it all, and the history of every normalisation.
§I is the two-page version; everything after it is the full treatment.

Sources of truth:
- **Player schema**: `packages/svg-animator-core/src/PxAnimatorTypes.ts` (`PxAnimatedSvgDocumentSchema`) +
  the wire enums in `PxAnimatorConstants.ts`
- **Editor schema** (extensions): `kf/app/src/svgeditor/model/serialization/schema/PxSchemaUtil.ts`
- **Empirical corpus**: the feature-explorer cases (`featureexplorer/cases/*.json`, 117 at the last census — §6)

> ⚠️ **A "REAL" claim in this document means verified against WRITTEN OUTPUT** — a probe capture or a
> corpus census, never a field name read off the model. The trap that produced three wrong examples
> in the old issues log (S11, N4, J3, all corrected 2026-08): **the wire key comes from the VALUE's
> own attr names, not from the `@serializable(…)`/schema field name.** `TSvgMaskEffectAttr.start` is
> declared `start` and writes `x`,`y`; `TSvgUseElement.sz` writes `width`,`height`. When those two
> disagree the WIRE wins — and where a schema was once written from the field names instead
> (`maskedBy`), the result was a real shipped bug (B5, §5).

---

## I · Introduction — the format in six layers

The format is **plain SVG with layers added on top**. Each layer adds one idea, uses only
the layers beneath it, and has its own *address on the node* — that address is the contract.
Full treatment: §L (the map and where each layer is enforced), §1 (rules R1–R7), §2 (values),
§P (the unit contract), §4 (the editor superset).

| layer | | address on the node | what it adds | read by |
|---|---|---|---|---|
| **L0** | plain SVG | `{type, ...attrs, children}` | strings · static attributes · static elements | the browser |
| **L1** | typed values | the same attributes | numbers, vectors, records — seven kinds | player |
| **L2** | animated attributes | `node.animate[attr]` | a parallel channel per attribute; zero structure | player |
| **L3** | player effects | `node.effects` | declarative generators, expanded at load | player |
| **L4** | editor meta | `node.meta` | everything the player ignores | editor |
| | ↳ own effects | `meta.appliedEffects` | this node's effects the player never sees | editor |
| | ↳ a unit | `meta.effectsHost` + `meta.partOf` | several emitted elements that fold back into ONE | editor |
| **L5** | pre-rendered SVG | a real `.svg` file | the same model, flattened | the browser (or the player) |

### L0 · Plain SVG — where we start

An element is `{type, ...attributes, children}`. SVG itself knows only **string** attribute
values, static attributes, static elements. Nothing of ours yet.

### L1 · Typed values — the same attributes, real types

The first thing we add is not animation but **types**: `opacity: 0.5`, `translate: [96.8,
46.8]`, `transform: {translate, rotate, scale, skew, origin}`, `d: {path: "M…"}`, gradient
stops as `[{offset, color}]`. Seven kinds in all (§2). Units are never written — each property
has one fixed implicit unit. A typed static is byte-for-byte the same shape as a keyframe value,
which is what makes L2 a one-line addition rather than a second grammar.

### L2 · Animated attributes — `node.animate`

Any attribute animates through a **parallel channel keyed by attribute name**. The static
stays a plain attribute; the animation sits beside it and never touches the element's shape
in the tree — **zero structure**. One clock (`animator`), one reusable-definitions store.

```json
{ "type": "rect", "opacity": 1, "animate": { "opacity": { "keyframes": [] } } }
```

### L3 · Player effects — `node.effects`

**The law: an attribute is a value the browser consumes as-is; an effect is anything that
needs STRUCTURE** — generated defs, wrapper nodes, clones, geometry-derived rewrites. The player
expands `effects` into L0–L2 content at load; its runtime never sees a non-empty `effects`.

The player knows ten: `transformBy repeater maskedBy clipPath strokeTrim clone fillGradient
strokeGradient textPath text`. The editor's list is a **strict superset** (it widens some and
adds `shape`, which the player never sees — see L4 and §4).

#### The cut that matters downstream: what an effect LEAVES BEHIND

| kind | applying it produces | examples |
|---|---|---|
| **attribute effect** | values on the element (`node[attr]`, `node.animate[attr]`) and/or a def **outside** the tree | `shape` → `d`; single-subpath `strokeTrim` → `stroke-dasharray`; `fillGradient` → `fill=url(#…)` + def; `clipPath`, `maskedBy`, `textPath` → def + ref |
| **element effect** | **extra elements in place** — the element's position now holds several | `transformBy` (wrapper chain), `repeater` (copies), `clone` (wrapped source), glyph `text` (`<g>` + outlines), **multi**-subpath `strokeTrim` (`<g>` + a `<path>` per subpath) |

The cut is **data-dependent** — `strokeTrim` is on both rows — so readers decide from what
is *marked in the file*, never from the effect's name.

#### Who expands what

| wire form | the editor writes | who expands |
|---|---|---|
| **lightweight JSON** (`.svga`, production) | `effects` **un-expanded** — no wrappers, no hosts | the **player**, at load |
| **heavy JSON** (test oracle) · **pre-rendered SVG** (L5) | **materialised** — wrappers, copies, hosts | the editor already did |

Two consequences. The player must support every *element* effect — true by construction, it
is handed `effects` and expands them itself; the editor never writes a unit into a `.svga`.
And the player need **not** know every *attribute* effect: the editor materialises those into
`node[attr]` / `node.animate[attr]`, and the player just renders the result.

### L4 · Editor meta — `node.meta`

The player types `meta` as `any` and ignores it wholesale. Everything the editor needs that
the player does not lives here — and *only* here, so editor additions can never break the
player.

**`meta.appliedEffects` — this node's own effects.** How an attribute effect the player
doesn't know survives a round-trip: the editor bakes `shape` into `node.d`, then keeps the
parametric preset here so the shape re-opens as a shape. Also rich `text` config and the
gradient mirror. The *tense* is the meaning: `effects` = the player WILL apply; `appliedEffects`
= these WERE applied — read back, never re-applied.

**`meta.effectsHost` + `meta.partOf` — a UNIT.** Needed because of L3's element effects: once
one model element is *written* as several (L5 forces this), the reader must fold them back
into one.

```
HOST   the outermost emitted element; has an id;
       declares meta.effectsHost = { coreId?, appliedEffects }
CORE   the element inside that IS the original, named by coreId
PART   every element the write derived; marked meta.partOf = '#hostId'
```

The rules that make this safe, in one breath: `effectsHost` is created **only by element
effects** — attribute effects, defs included, never make a host; **all** of the original's
applied effects live on the host, none on a part; the read takes **one verdict per unit** —
*does it fold back to exactly ONE element?* — and restores everything or nothing; a unit that
fails keeps its artwork, **loses its effects cleanly**, and the user is told what was lost.
Every write is checked: an emitted element is either a document element, a marked part, or a
host — there is no fourth kind. (Full contract: §P.)

The editor can read a unit back from **either** carrier — JSON and SVG share one read pipeline.
Production `.svga` just never contains one.

### L5 · Pre-rendered SVG — the same model, flattened

A real `.svg` a browser opens with no player: `meta` → a per-element `data-px-meta="…"` JSON5
string; animation → CSS `@keyframes`, or an embedded player plus an id → animation map (the
DOM already exists; the player only binds). Every element effect is materialised — which is
exactly why L4's unit contract has to exist: the file holds the expansion, and the editor
must be able to fold it back.

### The principles behind the layering

1. **Each layer reduces to the one below.** A document using only L0–L2 is fully playable;
   everything above is expanded into it. That is what keeps the player small.
2. **Address is contract.** What a key *means* is fixed by *where* it sits — `effects` vs
   `appliedEffects` vs `effectsHost.appliedEffects` are three tenses of one idea, told apart
   by position, not by a flag.
3. **Widen, never narrow.** Every editor schema is the player schema plus named keys; the
   player ignores what it doesn't know (`meta` is `any`), so the editor can grow freely.
4. **Structure is the dividing line.** Attribute or effect, attribute effect or element
   effect, host or no host — every split in the design is the same question asked again:
   *does this change the tree?*
5. **Round-trips must reach a fixed point.** `read ∘ write` is idempotent from the first
   round-trip on; the first write may bake, no later write may grow. Everything in §P exists
   to make that true by construction, not by hope.

---

## L · The layer map — rules, materialisers, enforcement

Same six layers as §I, now with the rule that defines each (§1) and the party that expands it.
The layer's **address on the node** is the contract — the player reads `effects` and `animate`
and ignores `meta`; the editor owns `meta`.

```
L0  plain SVG              static elements + static attributes              the browser     R1
 │
L1  typed values           the same attributes, real kinds (§2)             player          R1
 │
L2  animated attributes    node.animate[attr] — a parallel channel keyed    player          R2–R4
 │                         by attribute name; zero structure
 │
L3  player effects         node.effects.{effect} — declarative, expanded    player          R5
 │                         by the player at load into L0+L2
 │
L4  editor-only info       node.meta — the player types it px.any()        editor          R6, §P, §4
 │   ├ meta.appliedEffects   this node's OWN effects the player never sees
 │   │                       (or that were pre-baked into L1/L2 attrs)
 │   └ meta.effectsHost      a UNIT: several emitted elements that fold
 │     + meta.partOf         back into ONE model element
 │
L5  pre-rendered SVG       the same model flattened to a real .svg:         editor          R7
                           meta → data-px-meta, animation → CSS / JS map
```

### The cut the editor cares about: what an effect LEAVES BEHIND

R5's law says *what* is an effect (anything needing structure). The editor needs a second cut —
what applying it produces — because that decides whether a unit (L4) has to exist:

| kind | applying it produces | examples | creates `effectsHost` |
|---|---|---|---|
| **attribute effect** | values on the element itself (`node[attr]`, `node.animate[attr]`), and/or a def OUTSIDE the tree | `shape` → `d`; single-subpath `strokeTrim` → `stroke-dasharray`; `fillGradient` → `fill=url(#…)` + def; `clipPath` / `maskedBy` / `textPath` → def + ref | **no** |
| **element effect** | **extra elements in place** — the element's position in the tree now holds several | `transformBy` (wrapper chain), `repeater` (copies), `clone` (wrapped source), `text` glyph bake (`<g>` + outlines), **multi**-subpath `strokeTrim` (`<g>` + a `<path>` per subpath) | **yes** |

- The cut is **data-dependent**, not a property of the effect name — `strokeTrim` is on both
  rows. Readers decide from what is *marked in the file*, never from an allow-list.
- Effect-generated defs are not "extra elements": they have no model node, are re-generated from the
  effect on every write, and are swept when unreferenced. (`clipPath` / `textPath` do create
  an *owned child* node on read — but the owner never splits: still one element in its place.)
- `<symbol>`, `<pattern>`, `<marker>`, `<filter>`, `<mask>` are ordinary model elements
  wherever they are written — "inside `<defs>`" is never the test; "has a model node" is.

### Who materialises — per wire form

| wire form | the editor writes | who expands the effects |
|---|---|---|
| **lightweight JSON** (`.svga`, production) | `node.effects` **un-expanded** — no wrappers, no `effectsHost` | the **player**, at load |
| **heavy JSON** (test oracle only) | effects **materialised**: wrappers, copies, `effectsHost` / `partOf` | the editor already did |
| **pre-rendered SVG** (L5) | materialised — same as heavy, flattened | the editor already did |

So "the player must support every element effect" holds for `.svga` by construction: the
player is handed `effects` and expands them itself; the editor never writes a unit into a
`.svga`. The reverse — can the editor **read** a unit back? — is yes from **either** carrier:
the JSON reader converts to the same tree and runs the same collapse as the SVG reader. It is
simply never *exercised* by production `.svga` (no hosts there); heavy JSON round-trips are
what pin it.

### Where each layer is enforced

| layer | what can go wrong | check (`PxSchemaValidationUtil.ts`, editor) |
|---|---|---|
| L0–L3 | document off-schema; editor-only key in the player bucket | `validateWithSchema`, `lintPlayerEffectsBucketKeys` |
| L4 | a `partOf` points at nothing; a part outlives its host | `lintPartOfMarks`, `warnOnLeftoverHostParts`, `checkNoUncollapsedUnits` |
| L4 read | a unit cannot fold back to one element | `isUnitFoldableToOneElement`, `isValidCombinedShapeUnit` |
| L5 write | an emitted element is neither a document element nor a marked part | `WriteInvariantAudit` (W-1) |
| L5 ↔ L4 | the document grows on every save → open | `detectWriteReadGrowth` |

---

## 0 · Ref-attr glossary — one relation per name

| name | relation | carriers |
|---|---|---|
| **`sourceId`** | ref to an **external** element (survives on its own) | `clone.sourceId`, `maskedBy.sourceId`, retime `sourceId`, `retimedCopy.sourceId` |
| **`coreId`** | my own unit's **survivor** — the node the collapse restores to | `effectsHost.coreId` |
| **`partOf`** | my **host** — origin mark on every derived node (which host produced it) | `meta.partOf` |

- Wire spelling of every px-meta ref is **`#id`** (E-5 canon); readers accept legacy bare `id`.
- Native SVG refs (`<use href>`, `mask="url(#…)"`, `fill="url(#…)"`, `offset-path`) stay
  browser-spelled and are always **derived on write**, never design-authored.
- History: `maskedBy.href`→`sourceId`, `clone.baseId`→`sourceId`, retime `baseId`→`sourceId`;
  `retimedCopy.{srcId,baseId}` (two fossil fields nothing wrote or read) collapsed to `sourceId`.

---

## 1 · Generative rules — the format as a story

Each rule adds one concept. A document using only R1–R3 is fully playable; everything later reduces to R1–R3.

**At a glance:**

- **R1** — Static content is SVG as JSON: `{type, ...svgAttributes, children}`.
- **R2** — Any attribute animates via the parallel `animate` channel, keyed by attribute name; the static attr stays plain SVG.
- **R3** — One clock: the root `animator` owns everything temporal that isn't per-property.
- **R4** — Reuse by name: `animator.definitions` (easings, animations, styles, glyphs).
- **R5** — Effects are declarative generators the player expands at load; anything needing STRUCTURE (defs, wrappers, clones, multi-attr rewrites) is an effect, anything the browser consumes as one value is an attribute.
- **R6** — Everything editor-only lives in `meta` (label, runtime, own `appliedEffects`, `effectsHost`/`partOf`); the player is free to ignore it.
- **R7** — Pre-rendered SVG is the same model flattened: `meta` → `data-px-meta` strings, animation → CSS `@keyframes` or embedded player binding by id.

### R1 · Static content = SVG as JSON
`{type: "<tagName>", ...svgAttributes, children: []}` — the SVG vocabulary, JSON-encoded.
Reserved node keys: `type, children, animator, meta, animate, effects, textContent, text`.
Text content rides on `textContent` (the DOM property name; canonical since S8 — `text` is
READ-ONLY legacy: it was triply overloaded with the `text` TAG and the `effects.text` group).

**Reserved-key escape: `domType` (S2 closed)**. An element whose SVG `type` ATTRIBUTE collides with
the reserved node-tag key carries it as `domType` — `feColorMatrix` (matrix/saturate/…),
`feTurbulence` (fractalNoise/turbulence), `feFunc*` (identity/table/…). Named for `PxAttrScope.dom`,
the real rendered DOM attribute (NOT `htmlType`: these are SVG elements). Applied at ONE write choke
point so a new element with a `type` attr cannot forget it, and mapped back onto the DOM attribute by
every renderer (web + RN). If another reserved key ever collides, extend this rule (`domChildren`, …)
rather than inventing a per-element name.

**`type` is deliberately ONE word, discriminated by CARRIER (N4 closed)**: the node tag
(`{type:'rect'}`) and every sub-object's kind (`clone.type`, `preset.type`, `fillGradient.type`)
all spell it `type`. Each occurrence sits inside its own object, so the carrier disambiguates
completely — `presetShape`/`cloneKind`/`gradientKind` would add three words that all mean "type"
while still requiring the carrier to interpret. Same for `offset` (`strokeTrim.offset` = dash phase,
stop `offset` = position in the ramp): both are 0–1 positions along whatever carries them. What
guards against a WRONG VALUE in a `type` slot is strict enums (issues V3), never distinct key
names. NOTE this is orthogonal to **S2**, which is a real hole: the node-level `type` makes an SVG
`type` ATTRIBUTE (`<feTurbulence type="fractalNoise">`) inexpressible.

```json
{ "type": "svg", "viewBox": "0 0 200 200", "children": [
    { "type": "ellipse", "cx": 100, "cy": 100, "r": 30, "fill": "#33b366" } ] }
```

### R2 · Any attribute can animate: the `animate` channel
A **parallel channel keyed by attribute name** — never an inline value replacement:

```json
{ "type": "ellipse", "opacity": 0.5,
  "animate": { "opacity": { "keyframes": [
      { "time": 0, "value": 0.5, "easing": [0.33, 0, 0.67, 1] },
      { "time": 1000, "value": 1 } ] } } }
```

Why not inline: the static attr stays a plain SVG value — the doc degrades to valid static SVG by
ignoring `animate`; tools read initial state without understanding animation.
Keyframe grammar: `{time, value, easing?, tangentIn?/tangentOut?}` (+ short aliases `t/v/e/ti/to`);
`tangent*` = motion-along-path, `autoOrient` rotates along it; per-property
`loop {segmentCount?, before?, alternate?}` extends kfs to the document duration.

### R3 · One clock: root `animator`
`{duration/delay (ms), mode: auto|waapi|frames, iterations, direction, fill, frameRate,
resetOnFinish, trigger {startOn, outAction}}` — everything temporal that is not per-property.
`iterations: number | "infinite"` is the ONE sanctioned string-in-number union (CSS
`animation-iteration-count` familiarity — S10); do not add more mixed unions.

**Mode-specific trigger params stay FLAT and PREFIXED (S7 closed)**: `scrollIntoViewThreshold` sits
beside `startOn`, not nested under it. Nesting (`trigger.scrollIntoView:{threshold}`) would repeat
the mode name — once as the enum VALUE, once as the KEY — and be asymmetric, since most modes
(`load`, `click`, `hover`, `programmatic`) carry no params at all. A generic `threshold`
discriminated by `startOn` would be less discoverable and would overload silently if a second mode
ever needed one. Flat+prefixed is also the house style of the vocabulary this format mirrors:
`patternUnits`, `maskUnits`, `gradientUnits`, `markerUnits`, `filterUnits`, `primitiveUnits`.
Revisit only if one mode ever needs several params at once.

**What ADVANCES the clock: `timelineSource` (+ `scroll`) — N10, implemented 2026-08.**
`trigger.startOn` says what STARTS the animation; `timelineSource` says what MOVES the playhead
afterwards: `'time'` (the wall clock — default, **omitted from the wire**) or `'scroll'`
(scroll-linked "scrubbing", the CSS scroll-driven-animations model). With `'scroll'`, `trigger`
and `iterations: 'infinite'` are meaningless and MUST NOT be written (readers ignore them with a
warning). The parameters live in `animator.scroll` — structured atomic values, never CSS strings,
so a mechanical translation to `animation-range` / WAAPI `rangeStart`/`rangeEnd` exists but the
format is not bound to CSS syntax. All optional; `timelineSource: 'scroll'` alone means *"scrub
the whole animation as the SVG crosses the viewport"*:

| `scroll.` | values | meaning |
|---|---|---|
| `driver` | `custom` (default) · `native` | who computes progress: the player's own DOM-measuring driver (both engines, identical everywhere) or the browser's `ScrollTimeline`/`ViewTimeline` (waapi only; **falls back** to `custom` when unsupported or when `smoothing` is set) |
| `kind` | `view` (default) · `scroll` | progress = the subject's journey across the scrollport, or the scroller's offset ratio |
| `axis` | `block` (default) · `inline` · `x` · `y` | writing-mode-relative or physical axis |
| `source` | `nearest` (default) · `root` | `kind: 'scroll'` only — which scroller |
| `subject` | `'parent'` · `'scroller'` · a CSS selector | `kind: 'view'` only — WHOSE journey is measured (unset = the `<svg>`); `parent` skips sticky/fixed ancestors, which is what makes a pinned section work |
| `smoothing` | ms | catch-up lag (GSAP `scrub: seconds`); forces `driver: 'custom'` |
| `pin` · `pinAlign` · `pinTop` · `pinDistance` | bool · `top`/`center`/`bottom` · px · viewport heights | hold the canvas with `position: sticky` while scrolling scrubs it; `pinDistance` injects a spacer wrapper |
| `range.start` / `range.end` | `{phase?, fraction?}` | the timeline slice mapped to 0..1; `phase` (view only) ∈ `cover contain entry exit entry-crossing exit-crossing`, default `{cover,0}`→`{cover,1}` |

Pure math in core `PxScrollMath` (`scrollViewProgress`, `scrollOffsetProgress`, …); the DOM half is
the web player's `PxScrollDriver` (one coalesced measurement + seek per frame). Design and the
per-parameter semantics: app `svgeditor/animation/scroll-timeline.design.md`. Not yet consumed by
the RN player or the SVG+CSS export.

### R4 · Reuse: `animator.definitions`
Named libraries: `easings`, `animations`, `styles`, `glyphs` (embedded font outlines).
*Corpus reality: only `glyphs` is used (24 files); named easings/styles are dormant.*

**Two "defs" vocabularies, deliberately (N9).** `animator.definitions` and SVG's `<defs>` share a
name but nothing else, and can never be confused by a reader:

| | address | holds | referenced by |
|---|---|---|---|
| `animator.definitions` | inside the animator config | **values** — easings, animations, styles, glyph outlines | name (`"easeInOut"`) |
| `<defs>` | a node in `children` (`type: 'defs'`) | **elements** — gradients, masks, symbols | id (`url(#…)` / `href`) |

Different address, different content, different reference syntax — the shadow is nominal only.
Kept as-is: a rename would break the wire to fix a word.

### R5 · Effects (player): declarative generators
`node.effects.{effect}` describes structure the player expands into R1–R3 content at load
(`applyPlayerEffects`; the runtime never sees a non-empty `effects` after entry).

**The attribute-vs-effect law**: an *attribute* is a value the browser consumes as-is on that element —
animating it is one channel, zero structure. An *effect* is anything whose realisation requires
**structure**: generating defs (gradient, clipPath, maskedBy, textPath), wrapper nodes (`transformBy`),
clones (repeater, clone), or geometry-derived multi-attr rewrites (strokeTrim). The test is structure,
not value complexity (`transform` has a parts-record value but lands in one attribute → attribute);
one attr name can sit on both sides split by value (flat `fill` = attribute; gradient fill = effect).

| effect | expands to | payload core (✚ = animatable slot) |
|---|---|---|
| `transformBy` | per-part wrapper sandwich `T(+o)·T(t)·R(r)·S(s)·T(−o)` | `translate✚ rotate✚ scale✚ skew✚ origin✚` |
| `repeater` | N sibling copies, per-copy transform ×i | `copies` (STATIC — see below) + `translate✚ rotate✚ scale✚ skew✚ origin✚` (scale compounds `s^i`) |
| `maskedBy` | generated `<mask>` + wiring | `sourceId`, `maskType` / `maskUnits` / `maskContentUnits`, viewport `x`/`y`/`width`/`height` (B5 — the SVG attrs verbatim, never `start`/`size`) |
| `clipPath` | generated `<clipPath><path>` + url | `d✚` (legacy sibling `animate` read-only) |
| `strokeTrim` | dash-based draw-on | `offset✚`, `range✚` (fractions), `subPaths` |
| `clone` | `<use>` semantics: what + when | `type: 'content'?`, `sourceId`, `retime {sourceId?, start, stretch, timeCrop?: [inMs, outMs]}` (`timeCrop` = a visibility window, implemented 2026-08) |
| `fillGradient`/`strokeGradient` | generated gradient def + url | geometry `p1/p2/c/r/fp`✚ + `stops`✚ |
| `textPath` | native `<textPath>` + generated path def | `path` (d), `startOffset✚`, `pathOverflow…` |
| `text` | glyph-outline text rendering | `useGlyphs` |

**Effect NAMING stance (N6 closed — apply to every new effect)**: an effect is an INSTRUCTION
applied to this element, so names lean verb-ish — with deliberate leeway, because forcing one
grammatical form on nine effects produces junk (`filler`, `glypher`, `pathLayouter`):
- **verb** or **verb + preposition** when the effect performs an action — `transformBy`;
- **umbrella noun** when it groups a SET of changes, or is a generator — `repeater`, `strokeTrim`;
- **passive + agent (`-edBy`)** when, and ONLY when, the effect REFERENCES ANOTHER ELEMENT —
  `maskedBy`. Direction is the point: `mask` would say "this element IS a mask" (the way the SVG
  `mask` attribute points); `maskedBy` says "is masked BY x". A bare verb throws that away.
- A preposition may carry different senses in different keys — `maskedBy` = AGENT,
  `transformBy` = MEANS (the `sortBy`/`groupBy` idiom). That is how prepositions work; chasing
  perfect uniformity yields rigid, awkward names.
- Effect keys live INSIDE `effects:{…}` / `appliedEffects:{…}`, never at node level, so they can
  NEVER collide with an SVG attribute name — verbs are freely available.

**Why `transformBy` and not `transform` (N6)**: this effect and the `transform` ATTRIBUTE carry
nearly the same payload, and a node can hold BOTH plus `animate.transform` at once — three things
that must not read as one. `transformBy` keeps the relation visible (it IS a transform) while being
a different word; `By` reads as the MEANS, the `sortBy`/`groupBy` idiom ("transform by these
parts"). What the attribute cannot do is the reason this is an effect at all: the attr has ONE
shared timeline, `transformBy` gives each part its own. (`transformation` was the old key —
renamed 2026-08; note `maskedBy` uses `By` for the AGENT, `transformBy` for the MEANS: participle
+ `By` = a reference to another element, bare verb + `By` = self-contained instruction.)

**Why `repeater` and not `repeat` (N6)**: the repetition is SPATIAL — N copies, each stepped by a
compounding per-copy delta. In an ANIMATION format a bare `repeat` reads as TIME, and this format
has real time-repetition concepts to confuse it with (`animator.iterations`, per-property
`loop {segmentCount, alternate}`, SVG/SMIL `repeatCount`/`repeatDur`). The agent noun stays
unambiguously spatial and matches the term the audience already knows (After Effects "Repeater",
Lottie `rp`). Same principle as `maskedBy` over `mask`: prefer the form that preserves the right
MEANING over the grammatically uniform one.

**`repeater.copies` is STATIC (V2 closed)**: the copy COUNT is config, not a channel — it is read
once at expansion time and never sampled, so it takes a plain number and no `keyframes`. (Lottie can
animate its repeater count; importing one freezes the count at its frame-0 value.) Every other
repeater part is animatable — the `✚` marks in the table above are the channel/config split.

**The gradient-stops law (S9 closed)**: gradient `stops` are ONE animatable value — the whole
stop-array animates as snapshots on a single timeline (`stops.keyframes[i].value = [{offset,
color}, …]`), while geometry (`p1/p2/c/r/fp`) animates per-slot with independent timelines. There
is deliberately NO per-stop keyframing/easing; revisit only if per-stop timing is ever demanded.

**The composition-order law (S3 closed)**: `effects` is ONE bag per element — JSON key order carries
NO meaning (tooling reorders it freely) and is never read. The applier composes in one hard-coded
order, innermost → outermost:

```
glyphs/textPath → fill/strokeGradient → strokeTrim → repeater → maskedBy → clipPath → clone-href+transformBy
```

- `repeater` + `transformBy` on one element therefore ALWAYS means "repeat, then transform the
  whole row". The other reading — "transform each copy, then repeat" — is expressed by STRUCTURE,
  not order: put the `transformBy` on a child and the `repeater` on its parent `<g>`.
- `retime` is not in the chain — it applies in a second pass, after every element's structure exists
  (it remaps the timeline of an already-built clone target).
- `text.useGlyphs` + `textPath` combine rather than stack: glyphs are laid along the path and the
  native `<textPath>` step is skipped.
- If authorable order is ever demanded, the sanctioned extension is an explicit
  `effects.order: [names]` array — NEVER key-order significance, which JSON tooling would silently
  destroy.

### R6 · Editor layer: `meta`
Everything the editor needs but the player is free to ignore (player types `meta` as `px.any()`).
The editor's `SvgMetaAttrSchema` (`PxSchemaUtil.ts`) — every key, and where it may appear:

| key | on | holds |
|---|---|---|
| `label` | any element | editor-only display name |
| `runtime` | root `<svg>` only | export-format settings `{useCssAnimation, useJsTriggers, externalJs, unoptimisedJs}` — HOW animation code is generated, not what the animation does (that is `animator`). Player never reads it |
| `animator` | root `<svg>`, **pre-rendered SVG only** | the animator config's second address (S4, R7) — lifted to the top level on JSON write |
| `appliedEffects` | a PLAIN node | this node's own effects — the editor bucket (§4): the player bucket + `shape`, widened `clone`/`text`/`clipPath`, `combinedPath` |
| `timeline` | `<symbol>` only | `{duration}` — the symbol's OWN animation length in ms (unrelated to `animator.timelineSource`) |
| `lineSpacing` | text LINE tspans (2nd line on) | bare Auto line-height multiplier (`gap = value × maxFontOnLine`); absent = the baked `y` alone is the truth |
| `effectsHost` | a unit's HOST | `{coreId?, appliedEffects}` — the expansion-host contract (§P) |
| `partOf` | every derived element of a unit | `'#hostId'` — single string ref (§0 glossary) |
| `animate` | any element, **`data-px-meta` form only** | the node's channels keyed by attr name; the JSON form hoists the same bucket to `node.animate` |

Two editor widenings ride on the lib's animation grammar without touching the player: keyframe
`selected` (editor UI state; declared in the lib so strict validation accepts it) and
`PxPropertyAnimationSchemaExtra.alongPathMode` (`'offsetPath' | 'sampled'` — the motion-along-path
ENCODING choice for CSS/WAAPI output; absent ⇒ sampled).

### R7 · Pre-rendered SVG (.svg)
The same model flattened into a real SVG document: `meta` serialises to a per-element
`data-px-meta="…"` string; animation ships as CSS `@keyframes` or as embedded player +
`animator.animate` **id → animation map** (the DOM already exists; the player only binds by id).

**The animator config: ONE name, TWO addresses (S4, settled 2026-08).** The config is always called
`animator`. Where it sits depends on the carrier, and that is forced by the medium, not drift:

| form | address | why |
|---|---|---|
| `.svga` / JSON | top-level `animator` | a JSON document has a top level |
| `.svg` (pre-rendered) | `meta.animator`, inside the root's `data-px-meta` | an SVG file has nowhere else to put a non-SVG key |
| SVG+JS bootstrap | `createAnimator({ data: { …document… } })` | `data` is an API PARAMETER, not an address — the document inside it uses the two rows above |

`getAnimatorConfig` reads exactly those two addresses. The editor lifts `meta.animator` → top level on
JSON write and un-lifts on read. Consequence to accept: a reader must check both; that is the whole
cost, and it is cheaper than inventing a second SVG attribute.

**One discriminator: `type`.** A document is a Px document iff `type === 'svg'` — the same thing the
schema requires (`px.literal('svg')`). The `animation` / `meta.animation` config spellings and the
`tagName` discriminator were deleted in 2026-08: nothing wrote any of them, none were in the schema,
and `tagName` actively disagreed with deep validation.

**The two materialisers agree visually, not structurally** (S6/A2 — intentional, don't read it as
drift): for STATIC repeated content the editor emits `<use href>` copies while the player deep-clones
the subtree. Each fits its medium — the editor's SVG is a FILE (a `<use>` beats re-emitting a whole
subtree, and stays re-editable), the player's tree is EPHEMERAL and in-memory (cloning is simpler and
avoids shadow-DOM quirks). ANIMATED repeated content is inlined by BOTH — the editor emits no `<use>`
there at all, which is why animated copies never hit Safari's `<use>` shadow-snapshot problem.
Consequence: editor output and player output cannot be diffed node-for-node.

---

## 2 · Value taxonomy

### Kinds
| kind | example | used by |
|---|---|---|
| number | `0.5`, `45` | opacity, rotate, r, offsets |
| Vec2 `[x,y]` | `[96.8, 46.8]` | translate, scale, origin, ranges, gradient pts |
| number array | `[16,16]` | dasharray (canonical static AND kf form; legacy `"5,5"` read-only), RGBA |
| string | `"#33b366"`, `"none"`, `"0 0 200 200"` | colors, enums, viewBox, transform-as-string |
| transform parts record | `{translate:[x,y], rotate:deg, scale:[sx,sy], skew:deg, origin:[x,y]}` | unified `transform` |
| path value | `{path: "M…"}` (legacy `{paths:[…]}` bezier read-only) | animated `d`, clipPath |
| gradient stops | `[{offset: 0.4, color: "#f00"}, …]` | gradient effects |

### The ONE animatable grammar
The animated form IS `PxPropertyAnimation` everywhere (the exact `node.animate` object; one schema,
one reader `readAnimatable`, one loop path). What a STATIC looks like is decided by CONTEXT:

**Body attributes are statics-only slots** — animation lives in the parallel `animate` channel (R2),
so the static is simply the attribute's bare VALUE KIND, object-shaped or not; nothing to
discriminate:

```json5
"opacity": 0.5
"transform": { "translate": [100,100], "rotate": 45, "scale": [1.5,1.5], "origin": [25,25] }
"animate": { "transform": { "keyframes": [ { "time": 0, "value": { "translate": [100,100] } } ] } }
//                                                       ^ static value ≡ keyframe value, byte-for-byte
```

**Effect slots are genuine unions** (static and animated share one slot — no parallel channel):

```
T                          — raw static (numbers, strings, tuples, arrays)
{ value: T }               — object-shaped static (the wrapper IS the animated form's base slot)
{ value?, keyframes|kfs, loop?, autoOrient? }   — animated
```

`value` inside the animated form is the static baseline. Most slots treat kf values as complete;
patch-semantics slots (the editor `shape` extended-d) shallow-merge each kf value over the base —
which is exactly why `shape` KEEPS its `{value:…}` wrapper: the same key is the patch base in both
tenses, and animating a static shape stays purely additive (`+ keyframes`). `loop`/`kfs` are legal in
every animatable slot. In practice effect-slot statics are never plain objects except `shape`, so the
wrapper rule exists but rarely fires.

### Units — implicit-units doctrine
**Units are never written; each property has one fixed implicit unit.**

| quantity | unit |
|---|---|
| time (`time`, `duration`, `delay`, `retime.start`) | **ms** (editor UI thinks in 10 ms frames; wire is ms) |
| lengths / coords / px `fontSize` | user units, unitless (non-px `fontSize` — `em`/`%`/`pt` — is the one place a suffix appears) |
| `rotate`, `skew` | **degrees** |
| `opacity`, trim `range/offset`, stop `offset`, `scrollIntoViewThreshold` | fraction **0–1** |
| every `scale` (transform, transformBy, repeater per-copy) | **factor** (1 = 100%; editor UI displays %) |
| `retime.stretch` | **factor** (0.5 = half speed / twice as long; 1 = unchanged) |
| `frameRate` | **fps** (frames per second) |
| `maskedBy` viewport (`x`/`y`/`width`/`height`) | **`maskUnits` space** — fractions of the bounding box by default (`objectBoundingBox`), user units under `userSpaceOnUse` |
| easing | cubic-bezier `[x1,y1,x2,y2]`, x∈0–1 |

### Naming & ids
- Wire attr names are **camelCase JSX-style** (`strokeDasharray`) → kebab-case on rendered SVG.
- Short kf aliases (`t/v/e/kfs/ti/to`) are read; the editor writes long forms.
- Auto-ids `_px_<base36>`, regenerated per write — only reference structure is meaningful.

**The three `animate` keyspaces (N2, settled 2026-08).** One word was doing two jobs; the
`ById` suffix names the difference, exactly as `transformBy` does for `transform`:

| key | keyed by | what it is |
|---|---|---|
| `node.animate` | attr name (`opacity`) | this node's own channels — the base form |
| `animator.animateById` | element id (`_px_a1`) | the SAME value type, HOISTED to the root so a pre-rendered DOM can be bound by id (Mode B) |
| `definitions.animations` | a name (`fadeIn`) | the reusable library both of the above can reference |

`animateById` was `animate` until 2026-08. The rename is safe precisely because the two shared a
value schema (`PxElementAnimationSchema`) — nothing about the payload changed, only the address's
name. `animator` (the config) and `animations` (the library) keep their own words: different word,
different thing, no rename needed.

**Boolean naming law (N8, settled 2026-08).** A wire boolean is a **verb phrase or a state**, never a
bare preposition and never `is*`-prefixed:

| shape | example | verdict |
|---|---|---|
| verb phrase | `useGlyphs`, `combinedPath` | ✔ canonical |
| state / adjective | `alternate`, `hidden` | ✔ canonical |
| `is*` prefix | `isItalic`, `isHidden` | ✘ editor-model only — never reaches the wire (italics ship as `fontStyle: 'italic'`) |
| bare preposition | ~~`loop.before`~~ | ✘ named no subject — **replaced** by `loop.extend` |

**A two-way selector is an enum, not a boolean.** `loop.before: true` encoded "extend before the first
keyframe" and left the false branch unnamed; it is now `loop.extend: 'before' | 'after'` (absent =
`'after'`, the idle/outro default). Same test for any future key: if the false branch has a name worth
saying, write the enum.

### Corpus reality (116 cases)
- Animated attrs: `transform` 54 (dominant), `d` 9, `fill`/`opacity`/`letterSpacing` 6…
- Effects: strokeTrim 68, textPath 62, text 33, repeater 28, fillGradient 28, maskedBy 26, clone 23,
  strokeGradient 12, clipPath 2. `effects.transformBy` — 1 (`effect.transformBy.splitTiming.json`).
- All easings are cubic arrays; the `{value:T}` structured-static form is written 0 times.

---

## 3 · Transform encodings (T1–T5) and the unifiability rule

SVG gives an element ONE `transform` attribute. Per-part timelines need structure → the split form is
an effect (R5 law). Five representations exist, each with a defined role:

| form | what | where |
|---|---|---|
| **T1** | static SVG string `"translate(125,125)rotate(45)…translate(-25,-25)"` (origin baked into a pivot sandwich — derived numbers, not authored) | pre-rendered forms (SVG DOM attr + heavy-JSON mirror) + the read-forever foreign-SVG import path |
| **T2** | bare parts record `{translate:[100,100], rotate:45, scale:[1.5,1.5], origin:[25,25]}` — authored parts verbatim, wire units; static value ≡ kf value | **the lightweight wire** (implemented; readers also accept the `{value:…}` spelling + the string, forever) |
| **T3** | body `animate.transform`, ONE timeline, parts-record kf values | SHARED timing (the common case) |
| **T4** | `effects.transformBy` — per-part independent slots | SPLIT timing, **the lightweight wire** |
| **T5** | pre-materialised wrapper tree + `meta.effectsHost` applied effects | heavy/pre-rendered SVG only |

**Unifiability rule (deliberate design, not drift):** the writer emits ONE body channel (T3) whenever
part timings coincide — cheapest for CSS/WAAPI, degrades to valid static SVG — and the
`transformBy` effect (T4) only when timings genuinely split. Consequence: the wire shape of "animate
translate+rotate" depends on whether keyframes share times. Accepted cost; readers must handle both.

**Effect = semantic source; baked structure = render artifact** (the "gradient law", holds for
transforms too): lightweight JSON never materialises expansions — it carries T4 and the player expands
at load. Only the editor's pre-rendered outputs (heavy JSON oracle + .svg) carry the baked tree, and
then ALWAYS with the host applied effects alongside (`meta.effectsHost`, §P). Player-materialised output is
ephemeral — rendered, never serialised back.

---

## P · The `meta.effectsHost` expansion contract (implemented)

**Effect-bucket taxonomy (the tense is the meaning):**

| key | tense | meaning |
|---|---|---|
| `effects` | declarative | the player APPLIES these at load (lightweight only) |
| `appliedEffects` | past | these WERE applied — baked, read-back only, never re-apply. On a plain node: applied in place (e.g. shape preset → its own `d`). Under `effectsHost`: applied as an expansion. |
| `effectsHost` | — | the node hosting a baked expansion (carries the host `appliedEffects`) |

Editor-expanded effects in pre-rendered output follow one formula — **ONE HOST, ONE CORE**
(`kf/app/src/svgeditor/model/serialization/schema/complex-effects.brainstorm.md` §10, rules
R-0…R-6, implemented 2026-08):

```
HOST      exactly ONE per element that produces in-tree derived elements (R-0). Carries the
          element's AUTHORED id. Two fields:
          meta.effectsHost = { coreId?,                 // the element's own node; absent ⇒ this node
                               appliedEffects }         // ALL of the element's effects — the only copy

CORE      the element's own node inside the unit: ALL of its own attributes (R-2); its own
          tag, or a <g> standing in. A stand-in is declared by the IDENTITY EFFECT that made it,
          inside the bucket (R-4):
            text.content        → a glyph bake: the core is a <g> of outline <path>s
            combinedPath: true  → a split: the core is a <g> of one <path> per sub-path
            clone               → an inlined clone: the host itself becomes the <use>
          A stand-in's children are PARTS; a plain core's children are REAL and stay.

PART      every derived element in the tree — wrappers, copies, a stand-in's children:
          meta.partOf = '#hostId'   — always the HOST, never the core, never a sibling (R-3).
          Generated defs (gradient, mask, clip, textPath geometry) carry NO partOf: their
          lifecycle is reference-driven.

READ      ONE pre-model pass on the raw tree (`UnitRestore.ts`), both carriers:
          core found → element = core attrs + identity restore + the whole bucket as
                       meta.appliedEffects + the host's id; host subtree REPLACED; every
                       node partOf it deleted (tree and defs); refs into the unit re-pointed.
          core missing / stand-in unreadable → restore NOTHING (unit stays as ordinary
                       content, declarations stripped), one warning PER LOST EFFECT.
          The unit is OPAQUE (R-5): marks only record the origin, the restore never depends on them; an unmarked
          node in the interior is cleaned up, not a reason to refuse.

INVARIANT a node is HOST, PART or PLAIN — never two (R-6). Only a PLAIN node carries
          meta.appliedEffects; inside a unit everything is in the host's bucket.
```

### The three meta keys (orthogonal)

```json5
// 1. expansion HOST — two fields, nothing else:
"meta": { "effectsHost": {
    "coreId": "#aaa",              // the element's own node inside the unit; absent ⇒ this node
    "appliedEffects": {            // ALL of the element's effects — the only copy (R-6)
        "transformBy": {…}, "repeater": {…},
        "strokeTrim": {…}, "combinedPath": true,        // ← identity effect: the core is a split
        "fillGradient": {…}                             // attribute effects live here too
    }
} }

// 2. every derived element in the tree — one string, naming the HOST:
"meta": { "partOf": "#star" }

// 3. meta.appliedEffects on a PLAIN node (no unit) = this node's own effects.
```

**Host applied-effects invariant (now literally true):** `effectsHost.appliedEffects` ≡ the
restored element's complete effects bucket — same keys, same shapes, element effects AND
attribute effects — plus the identity effects only materialised output has (`combinedPath`,
`text.content`). The core and every part carry no bucket. The only structure fact is `coreId`;
`combinedShape` became the `combinedPath` applied effect, clone `width/height` moved inside
`appliedEffects.clone`.

**Why TOTAL marking:** the one failure this design makes structurally impossible is
restore-the-effect-AND-keep-its-materialised-elements — the next write expands again next to the stale
survivors, doubling forever. Marked set ≡ derived set; each element's origin is readable off the element itself;
interiors of copies/clone content are **stripped of their own meta** and carry only `partOf`
(the derived-content strip — kills per-copy applied-effects duplication and dead meta in one mechanism).

**Contract rules (P1–P8, condensed):**
- **P1** player-materialised output is ephemeral; the contract concerns editor output only.
- **P2** the host declares; effect grammar `true | {…params}` (`true` ≡ `{}`, survives empty-group pruning).
- **P3** writer-auto-triggered identity effects (`combinedPath` beside `strokeTrim`) use the same machinery, editor bucket only.
- **P4** TOTAL marking of the TREE, single-string `partOf` naming the HOST. Generated out-of-tree
  defs (gradient / clipPath / textPath geometry, a `maskedBy` mask, retime defs-copies) carry
  NO mark: their lifecycle is reference-driven (`url(#…)`, `href`) plus the free-def sweep.
- **P5** part ⇒ anchor is a HOST. `lintPartOfMarks` flags a mark naming a non-host, a part
  carrying a bucket, and a host carrying a sibling `meta.appliedEffects` (R-3, R-6).
- **P6** collapse is atomic (above).
- **P7** failure keeps pixels and shouts: unit left whole + warning on read AND on next write.
  Since 2026-08 the failed unit's effects are LOST cleanly (P-N below) — nothing is carried
  forward for a later recovery.
- **P8** hosts nest only through REAL parent/child elements (a real `<g>` core's child may be
  its own host); a host is NEVER the host of its own core, and nothing inside a host's derived
  interior is a host (R-1). The former "inner trim host on the core" is gone: the split is
  declared by `combinedPath` on the ONE host.

### Principles added 2026-08 (implemented — the `__bug-a.svg` run-away growth)

P1–P8 state the contract; these name the properties that turned out to be **load-bearing**
when a glyph-baked text under `transformBy` grew one wrapper per save, for ever. Each is now
enforced in code; the design and measurements are in the editor's
`schema/all-or-nothing-restore.design.md`, the guards in `spec/allOrNothingRestore.spec.ts`
and `spec/effectFixedPointMatrix.spec.ts`.

- **P-H · THE TRIGGER RULE** — `effectsHost` is created ONLY by **element effects** (L, above):
  those that put several elements in the original's position. Attribute effects — including
  the def-generating ones — never create a host; they stay in the node's own `meta.appliedEffects`.
  When several element effects sit on one element they ALL go into that element's single host.
  *Reconciles P4/P5:* marking of effect-generated defs is PARTIAL today (gradient defs marked,
  `clipPath` / `textPath` geometry not) and is deliberately OUT of the W-1 write invariant —
  defs have no model node and the unused-def sweep already collects them. Revisit only if an
  orphan def is ever shown to matter.
- **P-I · IDENTITY** — at the moment of collapse, `coreId` MUST resolve to exactly one element
  of the unit, and it is the SAME element (strict identity, not "one of the right kind"). The
  bug: `coreId` named the wrapper while the rebuilt text carried the core's id — the core
  "ceased to exist", the collapse aborted, and the survivor was re-wrapped on the next write.
- **P-S · SINGLE SOURCE OF APPLIED EFFECTS** — an effect exists in exactly ONE place: the
  host's `effectsHost.appliedEffects`. No part carries any — *including* the glyph bake's
  `text.source` (now `text.content`), which used to sit on the CORE while the wrapper hosted `transformBy`. Two
  sets of applied effects that cannot see each other is the default architecture for a half-restore. The
  writer cannot know whether it will be wrapped, so it REGISTERS host applied effects
  (`ElementEffectRenderingContext.addHostAppliedEffectsWriter`) and the context places them;
  `SvgHostAppliedEffectsSchema` is the list `promoteToEffectsHost()` hoists — keep them in step.
- **P-N · CLEAN LEFTOVER** — when atomic read (P6) leaves a unit materialised, the leftover
  becomes ORDINARY content: effects lost, markers stripped, user told (one warning PER lost
  capability, not per unit). No "frozen" state, no retained applied effects, nothing to remember — a
  plain write of plain elements is already a fixed point. Read-time scaffolding
  (`_readAdaptor`) is cleared at the end of the read (the "seal") so stale file state cannot
  leak into a later write. *(An earlier draft preserved the markers so the leftover stayed
  recognisable for a future recovery — rejected: a half-alive element kept for ever is the
  class of mystery this contract exists to remove.)*
- **P-F · FIXED POINT** — the observable consequence: for every element × effect × carrier,
  `read ∘ write` is idempotent from the first round-trip onward. The first write may change
  the element count (materialisation bakes shapes); no write after that may. Guarded by a
  matrix GENERATED from the effects schema — an effect with no sample fails, so a new effect
  must bring its own coverage.
- **W-1 · THE WRITE INVARIANT** (how P4 stops being a rule writers must *remember*): every
  element emitted into the document tree is (a) one-to-one with a TDomElement of the USER's
  document, (b) marked `partOf`, (c) inside a marked subtree, (d) a host wrapper, or
  (e) materialises to a model node on read (`<textPath>`). Verified on EVERY write
  (`WriteInvariantAudit`); a violation reaches the user through the growth dialog. Two
  things measurement forced into it: clause (d) — host wrappers are neither 1:1 nor marked,
  123 false reports without it — and "(a) means the *user's* document": pre-write
  materialisation creates real model elements, which would otherwise launder every baked
  outline into legitimate content.

### Worked example (heavy SVG, condensed)

ONE host per element, the core as a `<g>` stand-in, the split declared in the bucket —
the former nested "inner trim host" is gone:

```html
<g id="star" data-px-meta="effectsHost:{coreId:'#_px_core',appliedEffects:{
      transformBy:{…}, repeater:{copies:2,…}, strokeTrim:{…}, combinedPath:true, fillGradient:{…}}}">
  <g transform="…" data-px-meta="partOf:'#star'">                          ← transform wrapper
    <g id="_px_core" fill="url(#g1)" stroke="#000" data-px-meta="partOf:'#star'">   ← CORE: all own attrs
      <path d="M0,0L100,0"  … data-px-meta="partOf:'#star'"/>             ← sub-path: a part, child of the core
      <path d="M0,50L100,50" … data-px-meta="partOf:'#star'"/>
    </g>
    <g transform="…" data-px-meta="partOf:'#star',animate:{…}">…copy…</g>  ← repeater copy: parts
  </g>
</g>
```

Every meta string is one of exactly three shapes (`effectsHost:{…}`, `partOf:'#id'`, a plain
node's `appliedEffects`); the effects appear ONCE; the reader dispatches on the bucket.

**Read algorithm — ONE pre-model pass, both carriers** (`UnitRestore.ts`):
① for each raw node with `effectsHost`, find the core (`coreId`, or the node itself) → ② build
the element: the core's own attrs, then the identity effect (`combinedPath` → rejoin the core's
`<path>` children into one `d`; `text.content` → `<text>` from core attrs + content; `clone` →
the host's transform becomes a `<use>`'s), then the WHOLE bucket as `meta.appliedEffects`, then
the host's id → ③ replace the host subtree; delete every node `partOf` it (tree and defs);
re-point references that targeted anything inside the unit at the element → ④ walk the restored
element again (a real child of a plain core may be a host). Core missing or stand-in unreadable
→ restore NOTHING, strip the declarations, one warning per lost effect.

What the model reader then sees is an ordinary element with an ordinary `meta.appliedEffects` —
exactly what a lightweight `.svga` gives it. No adoption pass, no collapse, no parts-deletion
step exist on the model side any more; `SvgaDeserialisationChecks.checkNoUncollapsedUnits`
asserts that no `effectsHost` / `partOf` ever reaches the model.

**Why the unit is OPAQUE (R-5), not mark-validated:** the previous read validated marks
("every part present and pointing here, else restore nothing") and so had three readers with
three validity rules that had to agree — they did not (`__bug-a.svg`). With one host, one core
and the identity declared in the bucket, the only structural failure is a missing core; marks
record the origin for the write-side audit (W-1) and nothing else.

## 4 · Editor schema = player schema + named keys

The editor schema is a strict superset built by reuse, not parallel declaration: effect slots share
the lib schemas outright (`SvgRetimeEffectAttrSchema = PxRetimeEffectSchema`,
`SvgCloneEffectAttrSchema = extendedObject(PxCloneEffectSchema, {width, height})`, …), and the
EFFECT BUCKETS are two schemas (V1 closed): `node.effects` = the lib's closed `PxEffectsSchema`
only (editor-only keys there are flagged by `lintPlayerEffectsBucketKeys` on read);
`meta.appliedEffects` = `SvgEffectsAttrSchema = extendedObject(PxEffectsSchema, {shape, clone,
clipPath, text, combinedPath})`. Features implemented by the player live ONLY in the lib schema
(`resetOnFinish`, kf tangents, `repeater.skew`, `maskedBy` viewport, `retime.timeCrop`).

### 4.1 · Every editor-only key, and why it exists

| slot | editor adds | why the player never needs it |
|---|---|---|
| `appliedEffects.shape` | the whole group (§4.2) | an ATTRIBUTE effect: baked into `node.d` / `node.animate.d` before the player sees the file |
| `appliedEffects.clone` | `width`, `height` | the materialised `<use>`'s explicit size — heavy meta only, seeds the collapse |
| `appliedEffects.text` | `fontSource` (`'asset'` \| `'browser'`), `content` (a `<text>` node: tspans + text-only geometry) | `content` is the IDENTITY effect of a glyph-baked core (R-4, §P): the `<g>` of outlines cannot carry the text, so the host does |
| `appliedEffects.clipPath.animate` | widened to `PxPropertyAnimationSchemaExtra` | editor's own animation extras (`alongPathMode`, corners-carrying `value`) |
| `appliedEffects.combinedPath` | `true` | writer-auto-emitted IDENTITY effect beside a multi-subpath `strokeTrim`: the core is a `<g>` of one `<path>` per sub-path — reassemble ONE shape on read. Never in lightweight output |
| `meta.runtime` · `meta.timeline` · `meta.lineSpacing` · `meta.label` | R6 | editor state |
| `animator.timelineSource` | *graduated* — now in the lib too | was editor-only while reserved |
| `PxPropertyAnimationSchemaExtra` | `alongPathMode`; `value` widened to the corners-carrying path object | encoding choice for CSS/WAAPI output |

`EFFECT_ATTR_KEYS` (built from the same `schemaKeys(...)` constants the writers use) is the
per-effect field list the reader checks unknown content against (`unsupportedEffectAttribute`
warning); an effect absent from that map is never field-checked — silence beats a false
"unsupported". `isKnownEffectName(name)` is the bucket-key test.

### 4.2 · `appliedEffects.shape` — the editor's parametric path source

*(Design record: app `schema/shape-effect.schema.rework.md`; editing-time sync of the clocks:
`schema/shape-effect.timing-sync.md`. Both IMPLEMENTED 2026-08.)*

`shape` is one **generator** — exactly one of `path` / `preset` (validated, not structural:
`SHAPE_GENERATORS`) — plus zero or more **modifier** sub-effects applied in `SHAPE_BAKE_ORDER`
(today one: `corners`). It materialises to the plain `node.d` / `node.animate.d` the player
consumes; the source stays here so the shape re-opens as a shape.

```jsonc
"shape": {
  "path":   "M…" | { "keyframes": [ { "time", "value": { "path": "M…" } } ] },   // GENERATOR — raw source (pre-modifier)
  "preset": { "type": "star", "points": 5, "radius": 89 | {keyframes}, … },       // GENERATOR — parametric
  "corners": { "entries": [ {pathIndex?, pointIndex, r?, type?} ] | {keyframes} } // MODIFIER
}
```

**The one-sentence animation model:** *every leaf attribute is `T | {keyframes}`; a collection is
ONE attribute* (animated as whole-array snapshots — the gradient-stops precedent, S9). Scalars
therefore animate per attribute (`preset.radius` moves, everything else stays static) and
`corners.entries` animates as snapshots. Three laws are enforced around the schema (named SH-1..3
here; the rework doc calls them L1–L3 — not the format layers of §I):

- **SH-1 · one clock per shape** — all animated slots inside `shape` (and the baked `animate.d`)
  carry identical times AND easing. Validated by `validateShapeEffectClock`; the read normalises a
  violation and warns. At editing time the editor keeps every animated slot on ONE clock
  (`TBezierPathsCompositeKfGroup` — the timing-sync doc).
- **SH-2 · write only what cannot be recovered** — no `shape` at all when it would restate
  `d`/`animate.d` (a plain or morphing path with no preset and no modifier); attributes at their
  defaults are omitted, recursively per sub-effect.
- **SH-3 · topology is static** — counts and enums (`points`, `turnsCount`, `segmentsInTurn`,
  `cycles`, `phase`, `heads`, `teeth`, `boreRadius`, `closeMode`, `waveType`, corner `type`) are
  plain fields, never `{keyframes}`; every keyframe must bake to the same bezier-point count
  (presets clamp/pad degenerate values in the animated bake so the count holds).

The fourteen presets (`ShapePresetType`; ✚ = animatable, ⚑ = topology-static):

| type | attributes |
|---|---|
| `star` | `points`⚑ `radius`✚ `roundness`✚ `startAngle`✚ `innerRadius`✚ `innerRoundness`✚ |
| `polygon` | `points`⚑ `radius`✚ `roundness`✚ `startAngle`✚ |
| `spiral` | `innerRadius`✚ `radiusIncrement`✚ `roundness`✚ `startAngle`✚ `turnsCount`⚑ `segmentsInTurn`⚑ |
| `arc` | `radius`✚ `innerRadius`✚ (ratio) `startAngle`✚ `sweep`✚ `closeMode`⚑ ∈ `pie`/`chord`/`open` |
| `wave` | `wavelength`✚ `amplitude`✚ `cycles`⚑ `phase`⚑ `waveform`✚ `waveType`⚑ ∈ `sine`/`square`/`sawtooth` |
| `arrow` | `length`✚ `baseThickness`✚ `headWidth`✚ `headLength`✚ `headInset`✚ `angle`✚ `heads`⚑ |
| `heart` | `width`✚ `height`✚ `lobeFullness`✚ `cleftDepth`✚ |
| `cross` | `width`✚ `height`✚ `armThickness`✚ `shift`✚ `cornerRadius`✚ |
| `frame` | `width`✚ `height`✚ `thickness`✚ `cornerRadius`✚ |
| `cog` | `teeth`⚑ `tipRadius`✚ `rootRadius`✚ `innerToothWidth`✚ `outerToothWidth`✚ `roundness`✚ `boreRadius`⚑ |
| `crescent` | `radius`✚ `arch`✚ `hollow`✚ |
| `tear` | `radius`✚ `tipLength`✚ `tipRoundness`✚ `angle`✚ |
| `eye` | `width`✚ `height`✚ `bulge`✚ |
| `trapezoid` | `width`✚ `height`✚ `topWidth`✚ `skew`✚ |

Unit conventions (the implicit-units doctrine, §2): lengths px, angles degrees, **ratios stored
0–1** (shown as % in the UI). Placement params are banned — geometry is origin-centred and the
element transform places it. `corners.entries` is sparse (only vertices with a non-default corner
appear); `pathIndex` defaults to 0 and is omitted for single-path shapes.

---

## 5 · Normalisation history (resolved — recorded so it doesn't resurface)

> Entries below are HISTORY and name things by their names at the time. Superseded 2026-08 by
> ONE HOST, ONE CORE (§P): `effectsHost:{combinedShape:true}` → the `combinedPath: true`
> applied effect; `appliedEffects.text.source` → `text.content` (content only); the model-side
> readers (`adoptHostAppliedEffectsForRead`, `adoptSelfHostAppliedEffects`, the step-03
> collapse) → one raw-tree pass, `UnitRestore.ts`.

- **Dasharray**: canonical static = number array (string legacy read-only) — the static/animated split closed.
- **fontSize**: px writes as bare number; `em`/`%`/`pt` keep suffixes (genuinely different lengths).
- **Scale**: FACTOR everywhere (percent eliminated; breaking for old bare-percent statics).
- **Keyframe `value`**: runtime-validated by `PxKeyframeValueSchema` (was `px.any()`); compile-time stays permissive for the duck-typed interpolators.
- **One animatable grammar** (was three): gradient geometry animates on its slots (`animate.gradientX1…` legacy read-only); `clipPath.d` is a slot; `shape` documented as patch-semantics instance. Consolidating readers fixed a real bug (repeater mappers missed the `kfs` alias).
- **Ref canon `#id`** everywhere on write; readers accept bare. Fell out: bare `maskedBy` refs became visible to `generateNewIds` + broken-ref validation.
- **Gradient triality** → ONE semantic encoding (`fillGradient`/`strokeGradient` effect; heavy mirrors it); the `colorType`/`gradient(…)` design channel and `animate.gradientX1…` wire channels deleted outright (write AND read); def-chain parse survives only as foreign-SVG import.
- **`isCombinedShape`** → deleted (player + editor); function carried by `effectsHost:{combinedShape:true}` + marked subpath children; the player applier's parameter was a literal no-op.
- **Marker evolution**: `appliedEffectPart:{topId,role,index}` → `[{hostId,effect,role?,index?}]` → **`partOf:'#id'`** (everything else host-declared or derivable). A7 fixed en route (markers now reach heavy JSON; combined-trim no longer splits permanently). A8 (wrong host) and A9 (per-copy meta explosion + dangling ids) died by construction; hosts force + carry their ids.
- **`sourceId` renames** (see §0 glossary) incl. the `retimedCopy` fossil collapse.
- **`meta.host` → `meta.effectsHost`** — the host key says what it hosts. The inner key stays `appliedEffects` DELIBERATELY: the tense distinguishes baked-never-re-apply from the declarative `effects` bucket, and it means the same thing as a plain node's `meta.appliedEffects` (applied in place vs applied as an expansion) — see the taxonomy table in §P.
- **`noRefTranslate`**: dead vocabulary — live mechanism is `clone.type:'content'` (stale comments may linger).
- **Editor↔player graduations**: `repeater.skew` (animated, ×i), `maskedBy.start/size` (mask viewport), kf tangent fields, `resetOnFinish`; dead `SvgTransformAttrSchema` decomposed-transform group deleted.
- **Group-trim safety** (verified): trim on a REAL `<g>` cannot false-collapse — children are per-child wrappers, each its own host.
- **S1/I-1 closed — transform grammar split FIXED**: the lightweight wire's static `transform` is the
  BARE parts record (authored parts verbatim; the old string baked origin into a pivot sandwich of
  DERIVED numbers). No wrapper/tag needed — a body attr never carries animation (R2's channel
  separation does the disambiguation; the transitional `{value: record}` spelling considered en route
  is read-accepted). Pre-rendered forms (SVG DOM attr + its heavy-JSON mirror) keep the composed
  string — the law: *declarative wire carries the record; pre-rendered forms carry the browser
  string*. Readers accept string + bare record + `{value:…}` forever (string = foreign-SVG import
  path; the editor's missing record reader was added first). Player gained record support in the
  schema, normaliser, `contentRefSplit`, `maskedBy` body-inverse and ancestor chains; 104 corpus
  fixtures regenerated via write(read(stored)) with the round-trip guard verifying each. Body-attr
  slots are declared statics-only (inline `{keyframes}` stays legacy read-only — see issues J3).
  Pinned by `transform-structured-static.spec.ts`.
- **B3 closed — strict atomic read IMPLEMENTED**: transparent host-applied-effects fallbacks removed from the
  adaptor; unit readers validate-then-adopt (`adoptHostAppliedEffectsForRead`), self-hosts adopt in a
  dedicated pre-attr-read pass (step 00b); invalid units now restore NOTHING (previously the host applied effects
  leaked back, making the effect exist twice with visible drift — per-child vs combined trim).
- **A10 closed — FIXED** (probe-verified, then repro'd + fixed): repeater × animated combined-trim generated DUPLICATE DOM ids across inlined copies in the SVG+JS form (invalid SVG; the JS dict animated only the first occurrence). Cause: `SvgClonedSubtreeIdGenerator` remaps only listed inner ids, and `renderClonedSubtree` collected element + kf-group ids but NOT shape-PART ids — the keys the trim-split subpath `<path>`s are generated from. Fixed by listing shape-part ids in the clone remap; pinned by the SVG+JS uniqueness regression in `trim-multi-subpath.spec.ts`.
- **Q-A closed — not a bug** (probe-verified): the suspected "static body transform dropped next to `transformation.translate`" was an artifact of the original probe's model construction — setting keyframes on a channel REPLACES its static value in the MODEL (a keyframed channel's value IS its keyframes); the writer is faithful. Real UI-authored motion writes absolute keyframes that include placement + a static t=0 body `transform` snapshot.
- **N6 (partial) — `transformation` → `transformBy`** (2026-08): the effect and the DOM
  `transform` attr carried near-identical payloads under near-identical names (a node can hold
  `transform`, `animate.transform` AND the effect simultaneously). Renamed on the stance: effects
  read as INSTRUCTIONS, with leeway for verb / verb+preposition / umbrella noun, and passive+agent
  (`-edBy`) reserved for effects that REFERENCE another element. Wire key + schema/type identifiers
  + internal vocabulary renamed together in editor, player and RN; 0 corpus occurrences so no
  fixture regen. The other names were reviewed and KEPT — see the `repeater` and `type` notes above.
- **S2 closed — the `type`-attribute collision FIXED, and it was an ACTIVE bug** (2026-08): `type`
  is the node TAG, so an element with an SVG `type` ATTRIBUTE overwrote its own tag on write. Two
  elements had per-element workarounds relocating the value to `funcType`; `feTurbulence` had none,
  so it shipped `{type:'fractalNoise'}` — the player never rendered the primitive, the `<filter>`
  came out EMPTY, and per spec that paints the filtered element TRANSPARENT BLACK (it vanishes).
  Exactly the failure recorded for feColorMatrix ("134799-chart-loading-animation's candles"),
  still live in a third element. FIXED in three parts: the escape key renamed `funcType` → **`domType`**
  (one general name, after `PxAttrScope.dom`; not `htmlType` — these are SVG elements); the
  relocation HOISTED to the single write choke point in `TDomElement.createJsonWithPlayerEffects`,
  deleting both copy-pasted overrides — the root cause was that the workaround was opt-in per
  element; and the mapping updated in BOTH renderers (web `PxAnimatorDOM`, RN `PxRnRender`).
  Pinned by `dom-type-escape.spec.ts` (all three elements × lightweight JSON + pre-rendered SVG,
  plus a no-stray-key case). No legacy alias; corpus carried `funcType` 0 times.
- **`retime.timeCrop` IMPLEMENTED in the player** (2026-08): was accepted on the wire, modelled by
  the editor, and warned-and-ignored by the applier. `timeCrop: [start, end]` (ms, document time) is
  a VISIBILITY WINDOW on the instance — independent of the retime remap, which shifts/stretches the
  target's own timeline. Materialised as an opacity animation on a wrapper `<g>` rather than by
  clipping the timeline, so the target keeps running (a layer inside its window appears mid-motion,
  not restarted); the wrapper is player-side only and never round-trips. A wrapper — rather than
  opacity on the `<use>` — keeps an authored instance opacity intact, mirroring what the Lottie
  converter already does in `TimeAttrsPartMC`, whose keyframe shape it copies exactly:
  `[s-1 → 0][s → 1][e → 1][e+1 → 0]`, so edges are effectively instant while the element is fully
  visible AT both boundaries. An empty/inverted window (`end <= start`, i.e. Lottie `ip >= op`)
  hides it outright. Pinned by the `timeCrop` block in `retimeEffect.test.ts`.
- **J2 closed — omit-at-default, OPT-IN not global** (2026-08): all 218 redundant default-writes
  are gone from the corpus. The cause was NOT "two outlier writers": `getValue()` falls back to the
  DEFAULT when a value is unset, and both guards tested the wrong thing — `TStrValue.writeDesignPxAttr`
  checked only `isDefault()` (false for an UNSET value), and the gradient effect writer tested
  `if (getValue())`, which can never be falsy. So attrs NOBODY had set were written forever
  (`textPath.lengthAdjust:'spacing'` in all 62 cases). Fixing it globally was tried and REJECTED:
  it strips `animator.{mode,direction,timeline,trigger}` from all 117 documents — including the
  `timeline` slot deliberately deferred in J1 — and breaks 108 specs, so plenty of behaviour still
  relies on defaults being written. Instead an OPT-IN `omitWhenDefault` flag on `SvgStrValConfig`,
  set only where OUR default equals what a consumer assumes when the key is ABSENT (for a DOM attr
  that means SVG's own initial value — the `textPath.spacing` trap is why that qualifier matters).
  Applied to `textPath.{pathOverflow,lengthAdjust,method,spacing}` + gradient `spreadMethod`;
  `gradientUnits` and `maskedBy.maskType` stay always-written by decision. 117 fixtures regenerated
  guard-clean, 4 spec expectations updated.
- **J3 closed — body attrs are declared STATICS-ONLY** (2026-08): `PxAttrValueSchema` no longer
  lists `PxPropertyAnimationSchema`, so an inline `"opacity": {keyframes:[…]}` is no longer a
  declared form (R2: animation lives in the parallel `animate` channel). NOT a plain deletion —
  `transform` is an OPEN key, so its parts record had been validating only by ACCIDENT through that
  same all-optional animation schema; `PxTransformPartsSchema` is now an explicit member, which also
  stops conflating "an animation object" with "a transform parts record". Enforcement is a separate
  matter: validation still cannot REJECT the inline form, for two engine-level reasons filed as
  issues V6 (`Union.isValid` drops `ctx`, so `strict` is inert inside unions; `{value: px.any()}`
  matches any object). Pinned by the body-attrs block in `PxEnumSlots.test.ts`, which asserts the
  gap as current behaviour so it flips when V6 is fixed.
- **J1 (partial) — dead declarations removed** (2026-08): `meta.retimedCopy` (+ its schema/keys),
  `TDomElement.__ser_renderExtraPxAttrs` (the hook it was supposed to arrive through — nothing ever
  assigned it) and `animator.debug` deleted after checking each for a writer AND a reader. Three
  items the entry listed as dead turned out to be ALIVE and were kept: `debugInstName` (used by
  `PxAnimator`), `definitions.styles` (read by `resolveStyle`) and `node.style`. `retime.timeCrop`
  and `animator.timeline` are half-implemented FEATURES, not fossils — see issues J1.
- **V3 closed — closed value lists are strict enums** (2026-08): ten slots that were plain
  `px.string()` with their values only in a COMMENT are now named consts + `px.enum`, so a typo is a
  schema ERROR instead of validating silently: `maskedBy.{maskType,maskUnits,maskContentUnits}`,
  `clone.type`, `fillGradient/strokeGradient.{gradientUnits,spreadMethod}`,
  `textPath.{pathOverflow,lengthAdjust,method,spacing}`. New consts `PxMaskType`, `PxUnits`,
  `PxCloneType`, `PxPathOverflow`, `PxLengthAdjust`, `PxTextPathMethod`, `PxTextPathSpacing` sit
  with the other enum constants (they must precede first use — placing them lower first produced a
  temporal-dead-zone load failure). Plain `px.string()` KEPT where SVG is genuinely open-ended:
  `gradientTransform`, `viewBox`, textPath `path` (a `d`), ids/refs, `debugInstName`. Runtime-only
  tightening — a corpus census confirmed every shipped value is inside the new sets (0 rejections).
  Pinned by `PxEnumSlots.test.ts` (valid accepted / typo rejected per slot + the open-ended cases).
- **C2 closed — and it was NOT a font race** (2026-08): `CloneTextConvert` ×3 failed with
  "precomp width: expected 200 to be less than 150" (200 = the canvas-size fallback), recorded as a
  browserFont measurement race. Instrumenting `TextMeasureSession` showed the real cause: it looked
  up a live `<text>` by `appliedEffectPart:{topId,role:'core'}` — a marker that DIED in the `partOf`
  migration — so nothing had matched it since; the text never entered the lookup, its box came back
  null, `maxBoxAtKeyframes` returned undefined and the precomp fell back to ROOT bounds. Glyph text
  passed throughout only because ITS marker (`appliedEffects.text.source`) is still current — the
  "glyph siblings pass" clue in the original report. FIXED by keying live text off its mounted id
  (the plain `SvgIdGenerator` publishes the model id) minus the `_content`/`_base` sub-ref suffix;
  no font gating and no timing dependency needed. `src/svgeditor` is now fully green (847/0).
- **C1 closed — `effects.transformBy` has a visual fixture** (2026-08): added
  `effect.transformBy.splitTiming` — translate 0→500ms while rotate runs 500→1000ms, i.e. the SPLIT
  PER-PART TIMING that a flat `transform` attr cannot express, which is the whole reason the effect
  exists. Built through `settleCaseJson` (canonical fixed point) and guard-verified; corpus census
  `transformBy` 0 → 1, fixture gate 116 → 117.
- **S7 closed — ACCEPTED, mode params stay flat + prefixed** (2026-08, user decision): nesting a
  per-mode object would duplicate the mode name (enum value AND key) and leave most modes with an
  empty slot; a generic discriminated `threshold` would cost discoverability. Flat+prefixed matches
  SVG's own `*Units` family. Recorded as a law in R3.
- **N4 closed — ACCEPTED, one contextual `type` is a feature** (2026-08, user decision): uniformity
  beats invented synonyms — every occurrence is inside its own object, so the carrier disambiguates
  and there is no path on which the kinds could be confused; `type` is also the ecosystem-standard
  discriminator (JSON Schema, AST nodes, Lottie `ty`), i.e. the guessable choice. Recorded as a law
  in R1. Its `start`/`size` half had already evaporated (mis-read field names), and the one genuine
  `type` problem — inexpressible fe-filter `type` ATTRIBUTE — is S2 and stays open.
- **N3 closed — NOT a collision: `text` is ONE effect in two tenses** (2026-08, probe-verified —
  the suspicion was that `effects.text` and `meta.appliedEffects.text` were two different things
  sharing a name, needing a rename to `textConfig`). REAL output says otherwise: the SAME payload
  appears in both buckets — a glyph-mode text writes `effects.text = {useGlyphs:true}` in the
  lightweight form and `meta.appliedEffects.text = {useGlyphs:true}` in the heavy one, i.e. the
  ordinary declarative-vs-applied tense split (§P), not two payloads. The editor's schema is a
  strict SUPERSET of the player's — `{useGlyphs, fontSource, source}` ⊃ `{useGlyphs}` — which is
  exactly the widening V1 already formalised for `clone` (+`width`/`height`) and `clipPath`
  (+`animate`); `fontSource`/`source` are editor-only extras that the player ignores, not a rival
  meaning. No rename; the entry's premise was simply stale after V1.
- **B6 closed — an authored `0` no longer vanishes on read** (2026-08, found while writing the B5
  regression test): `TNumValue._readFromJsonValue` opened with a FALSY guard (`if (!json) return
  false`), so a numeric px-attr of exactly `0` never reached the model — the attr stayed unset and
  `getValue()` fell back to the field DEFAULT. It affected EVERY numeric effect param read through
  the design/meta path, but stayed invisible wherever that default is itself `0` (most of them); it
  bit where the default is non-zero — a `maskedBy` viewport `x: 0` silently became `-0.1`, a
  10%-of-box shift of the mask region. FIXED to test for ABSENT (`undefined`/`null`) instead of
  falsy, in `TNumValue` and, identically, in the Vec reader (a no-op there — vectors are arrays,
  always truthy — kept in step so the two can't drift). Pinned by the zero-component case in
  `mask-viewport-clip.spec.ts` (wire + rendered SVG). No fixture changed: the 116-case round-trip
  guard passed untouched.
- **B5 closed — `maskedBy` viewport FIXED** (2026-08, found by re-verifying a mislabelled "REAL"
  example): the editor had always written the viewport as the SVG `<mask>` attrs `x/y/width/height`,
  while the player schema declared — and `maskedByEffect` read — `start`/`size`, which were the
  EDITOR's model FIELD names and never a wire spelling. Disjoint vocabularies in both directions, so
  every non-default mask region was silently dropped on the `.svga` → JS-player path (the generated
  `<mask>` got no viewport attrs and fell back to SVG's implicit −10%…120% region); pre-rendered SVG
  was unaffected. FIXED by making the player speak the wire: `x/y/width/height` in
  `PxMaskedByEffectSchema` + the applier, NO legacy alias. It hid because all 26 corpus `maskedBy`
  entries use default viewports (omitted) and the player's own test hand-authored the schema
  spelling instead of real editor output. Pinned by `mask-viewport-clip.spec.ts`, which asserts a
  CLIPPING region survives into lightweight JSON, the player's generated `<mask>`, the pre-rendered
  SVG, and an edit cycle. Lesson recorded in the issues-doc header: **the wire key comes from the
  VALUE's attr names, not the `@serializable`/schema field name** — a schema written from field
  names is a bug, not a naming nit.
- **V5 closed — units table completed** (2026-08): added `retime.stretch` (factor), `frameRate`
  (fps) and the `maskedBy` viewport (`maskUnits` space) — the table claims completeness, so the gaps
  were a correctness problem in the doc itself.
- **V4 closed — `appliedEffects.text.source` typed** (2026-08): was `px.any()` (a whole serialised
  `<text>` subtree with zero validation — the same hole class the keyframe-value fix closed); now a
  `px.lazy(() => PxNodeSchemaExtra)` reference, i.e. the recursive node schema it actually is.
  Runtime-only tightening, no wire change.
- **V2 half-closed — `copies` documented as STATIC** (2026-08, user decision): the repeater's copy
  count is config, read once at expansion, never sampled; the `✚` marks in R5's effects table carry
  the config-vs-channel split for every effect. The remaining half of V2 (a machine-readable
  convention in the schema SOURCE, e.g. a `channel()` wrapper) stays open.
- **N5 closed — accepted, not an issue** (2026-08, user decision): a Vec2 on the wire is just a
  number pair; `translate` (point), `scale` (axis pair), `range` (start/end window) share that one
  shape and take their meaning from the SLOT NAME — no per-semantic type aliases needed. The skew
  half was already void: skew is a SCALAR in all three carriers (body transform, `transformation`,
  `repeater`) since the S1 parts-record.
- **S9/S10 closed — two laws documented** (2026-08, doc-only): gradient `stops` = ONE animatable
  value (whole-array snapshots, per-slot geometry timelines stay independent; no per-stop easing);
  `iterations: number | "infinite"` = the one sanctioned string-in-number union (CSS familiarity),
  closed against imitation. Recorded in R5 / R3 + the schema JSDoc.
- **S8 closed — text-content key canon → `textContent`** (2026-08): writers (editor lightweight +
  heavy; SVG uses real XML text nodes and is unaffected) emit `textContent` — the DOM property
  name — instead of the triply-overloaded `text` (tag / `effects.text` group / content key, the
  S8+N3 complaint). `text` stays READ-ONLY legacy on both sides (editor `_txt` setter reads, its
  getter returns undefined so nothing writes; player readers do `textContent ?? text`). 30 corpus
  fixtures regenerated (216 keys), guard-verified; test docs swept to the canon (Slate specs
  untouched — `{text}` there is Slate's own schema).
- **S5 closed — the host-completeness sitting** (2026-08, one pass over all six recorded
  follow-ups; the working doc's stage log is folded into this entry):
  1. *Nested units LEGALISED* (P8) instead of umbrella-hoisting — documenting the implemented
     per-unit atomicity; one set of applied effects per host stays law.
  2. *Generated defs marked* `partOf` (gradient defs, textPath path def, retime defs-copies,
     materialised-`<use>` viewport clip) via a per-layer `forceElementHostId` provider; removal
     stays owned by the existing cleanup (marks only record the origin, they are not a second deleter); P5's anchor
     rule extended to `appliedEffects`-carrying elements.
  3. *Mask host id FORCED* (355-fix law) — id-less masked elements now emit full unit marks;
     late-id-flush machinery (`lateForcedElementIds`) stamps the canonical layer only (stamping
     from the mask writer duplicated ids on wrapped elements — caught by the permutation suite).
  4. *"Composite sentinel gap" root-caused as a DUPLICATE-ID bug*: curved-autoOrient/content-ref
     outer wrap layers generated the canonical id (`i => undefined` subref), shadowing the host
     declaration — fixed with distinct `_elEff_out_` subrefs; partOf orphans 0/3456 (was 1296).
  5. *Wire-noise strip*: `partOf`-marked derived-structure layers no longer flush the redundant
     `meta.animate` bag into `data-px-meta` (the CSS/JS binding carries it); heavy JSON keeps
     `node.animate` (there it IS the channel); real elements' bags stay in every form.
  6. *Renames*: `anchorTopId`/`wrapperAnchorId` → `hostId`; spec-harness ref-extraction taught
     the `'#id'` canon + `partOf`.
- **S3 closed — composition order documented as LAW** (2026-08, doc-only): `effects` key order
  carries no meaning; the applier's hard-coded innermost→outermost chain is now stated in §R5 and in
  the `_PxEffects` schema docblock, together with the structural idiom for "the other order" (nest
  elements) and the sanctioned future extension (`effects.order: [names]`) should authorable order
  ever be demanded. No wire or code change.
- **B4/A1 closed — transformation id ownership FIXED** (2026-08, probe-verified then fixed): the
  player's `applyTransformationEffect` left the element id on the inner core while its anonymous
  wrappers stacked outside — so a live `<use href>` (and the maskedBy-generated `<use>`) resolved to
  the UNtransformed element in the DOM, diverging from the editor's heavy render, from
  `repeaterEffect` (which transfers the id) and from the player's own `ctx.idMap` (which already
  mapped the id to the outer wrapper). Fix: repeater-style id transfer to the outermost generated
  wrapper (`transformationEffect.ts`); `splitForContentRef`'s manual delete/re-stamp dance predates
  it and stays valid. Pinned by the id-ownership block in `transformationEffect.test.ts`; etalons in
  `PlayerEffectsUtil.test.ts` / `maskedByEffect.test.ts` updated to the new placement.
- **V1 closed — effect-bucket schema split** (2026-08): `meta.appliedEffects` is now formally
  `extendedObject(PxEffectsSchema, {shape, clone, clipPath, text})` — the player bucket + named
  editor keys/widenings, not a parallel declaration (this also legalised `transformation` there,
  which `adoptHostAppliedEffectsForRead` really does hoist in and the old bucket never listed).
  `node.effects` stays the lib's closed `PxEffectsSchema`; because default-mode validation ignores
  unknown keys, a shallow read-time lint (`lintPlayerEffectsBucketKeys`, wired into
  `validateWithSchema`) is what flags editor-only keys in the player bucket. Pinned by
  `effects-bucket-validation.spec.ts`. Wire unchanged (corpus audit: `node.effects` was already
  player-keys-only in all 104 cases).
- **`effects.trimPath` → `effects.strokeTrim`** (2026-08): HARD rename, no legacy alias — wire key,
  schema (`PxStrokeTrimEffectSchema` / `_PxStrokeTrimEffect`), enum (`PxStrokeTrimSubPaths`),
  applier (`effects/strokeTrimEffect.ts`, `applyStrokeTrimEffect`) and the editor's own
  `TSvgStrokeTrimEffect*`. The name made a FALSE CLAIM: the effect emits `stroke-dasharray` /
  `stroke-dashoffset` (+ `stroke-opacity` for the empty-range hide) and never rewrites `d`, so the
  fill is untouched — while Lottie's same-named `ty:'tm'`, the format most authors convert from, IS
  a path operator that rewrites geometry. That is misdirection about BEHAVIOUR, not the "break the
  wire to fix a word" case R4 declines (there the shadow is nominal only — different address,
  content and reference syntax). Two independent confirmations the new name is the house one:
  the sibling effects already prefix by the channel they target (`fillGradient` / `strokeGradient`),
  and the editor UI had always called it **"Trim Stroke"**, in the Stroke section. `Path` was dropped
  rather than kept as `strokeTrimPath` because `Path` is precisely the false half — the window is
  measured ALONG the path (`subPaths` still says so) but nothing about the path changes. Breaking for
  documents written before the rename; taken deliberately while pre-release.
- **N9 mode half closed — `mode: 'webapi'` → `'waapi'`** (2026-08): HARD rename, no legacy alias —
  on the wire and in every enum: player `PxAnimatorMode.waapi`/`PxAnimatorEngine.waapi`, editor
  `SvgAnimationMode.waapi`. Old spelling is neither written nor read (breaking for old documents:
  the schema rejects it; a value that slips past validation reads as neither `waapi` nor `frames`
  and behaves like `auto`). `animator.definitions` untouched by decision — its `<defs>` name-shadow
  stays open in issues N9.
- **V6 closed — strict validation now works inside unions; the `{value:…}` catch-all is shut**
  (2026-08). Three engine changes, all in `PxSchema.ts`:
  1. **`Union.isValid` propagates the MODE, not the error sink.** The row's proposed "forward `ctx`"
     would have traded one bug for another — dropping `ctx` was deliberate (a non-matching branch must
     not push errors when a later branch matches). Members now get a scratch ctx carrying `strict`,
     whose errors are discarded; the union still reports one summary error when NO branch matches.
  2. **`px.defined()`** — anything except `undefined`. `px.object({value: px.any()})` matched EVERY
     object, because `any` accepts `undefined` and an absent key is indistinguishable from one holding
     it. `PxAttrValueSchema`'s structured-static branch now uses `defined`, so the KEY's presence is
     what identifies the branch.
  3. **Strict ignores `undefined`-valued keys.** Turning (1) on immediately failed 480 permutations in
     the editor's strict round-trip spec, on values that printed as perfectly valid JSON: freshly-built
     (pre-serialisation) objects carry declared-elsewhere keys set to `undefined` (`alongPathMode`,
     `kfs`, …), which `Object.keys` counts but `JSON.stringify` drops. Strict now judges the DOCUMENT,
     not the in-memory object that produced it — an undefined-valued key cannot exist on the wire.
  Net effect: an inline animation on a body attr is REJECTED under `strict` (was accepted in both
  modes). Default mode still tolerates it, and that split is intended — `strict` is the well-formedness
  claim, default is the repairability claim. Union diagnostics also widened 60→240 chars, without which
  the phantom-key cause was invisible. Verified: player build 13/13 (311 core tests), 15/15 e2e visual,
  app tsc clean, `src/svgeditor` 847, feature-explorer corpus unchanged (same 3 unrelated pre-existing
  failures before and after).
- **N10 closed — `animator.timeline` → `animator.timelineSource`, and the symbol duration is really ms**
  (2026-08). Two unrelated things shared the word `timeline`: which CLOCK drives playback, and a
  `<symbol>`'s own animation length. Renamed the first — `timelineSource` reads correctly with BOTH
  values (`'time'` is a legitimate kind of source, not a tautology), keeps the CSS
  `animation-timeline: scroll()` lineage the reserved `'scroll'` value must line up with, and is a
  NOUN phrase like every sibling in that config block (`duration`, `delay`, `iterations`, `fill`,
  `direction`, `frameRate`, `trigger`). It also reads against `trigger.startOn` as two distinct axes:
  what STARTS the animation vs what ADVANCES it. Free rename — omitted at its default, so 0 of the 117
  corpus cases carried it. `meta.timeline` on `<symbol>` keeps its name; with the collision gone it
  needs no change.
  - **A units bug surfaced while measuring it, and is FIXED.** `TSvgSymbolElement` read and wrote its
    `duration` in FRAMES while the schema — and the identical field on the root — say milliseconds, so
    a symbol declaring `500` ran for 5000ms, ten times its own content. It now converts at the
    boundary exactly like `TSvgSvgElement.getAnimOutFrame`.
  - *Method note, worth keeping:* the first attempt "preserved behaviour" by migrating the corpus
    values 500 → 5000. That preserved the BUG. The evidence that settles it is the symbol's own inner
    keyframe times — `[0, 250, 500]`, i.e. ms — which match `duration: 500` exactly. The fixtures were
    right all along and are byte-unchanged. The feature-explorer could not catch this either way: it
    compares columns against each other, so it stays green whether the symbol runs 500ms or 5000ms as
    long as every form agrees.
  - Also cleared: two `PxSchemaUtil` notes and a fixture `info.json` claiming the writer DROPS
    `meta.timeline.duration` and that `symbol-timeline.spec.ts` is skipped — both stale; the spec
    passes 2/2 and the value round-trips.
- **J4 closed — `effects` added to `INTERNAL_ATTRS`** (2026-08). One word, no decision. The set lists
  the wire keys that carry STRUCTURE and must never reach the DOM as attributes; `effects` was absent
  and safe only because `applyPlayerEffects` deletes it at load — a property of the pipeline, not of
  the contract. An applier returning early, or a document carrying an effect key the pipeline does not
  recognise, would have left the object attached and `getNormalizedProps` (the single gate) would have
  written `effects="[object Object]"` on the element, silently. Pinned by `PxInternalAttrs.test.ts`,
  which also covers an UNCONSUMED bucket — the case the invariant exists for.
- **C3 closed — the zero-coverage slots got fixtures, and two of them were broken** (2026-08). Five
  feature-explorer cases added (`maskedBy.viewport`, `transformBy.skew`, `repeater.skew`,
  `textPath.fitting`, `gradient.spreadMethod`), all green across every column. What the coverage
  found:
  - **Per-copy repeater `skew` was never implemented** anywhere that renders — declared, serialised
    and round-tripped, and applied by the PLAYER (`skew × i`), but missing from
    `buildPerCopyTransform` (editor render/export), `TSvgRepeaterElementEffectAttr.applyToMatrix`
    (selection boxes), `RepeaterAttrsPartMC` (SVGA ⇄ Lottie, both directions) and
    `TRepeaterAttrPart.applyToMatrix` (the app's Lottie renderer). Fixed in all four. Skew accumulates
    like rotation, not like scale, and sits between rotate and scale. **The right panel had no Skew
    field for the repeater either** — the property was unauthorable; added.
  - **`spreadMethod` was silently lost** in SVGA→Lottie — read nowhere in the converter. Added the
    `svga_gradientSpreadMethod` warning, raised from `copyGradientGeometryToLottie` (the chokepoint
    both fill and stroke pass through). Lottie gradients have only `pad`, so the loss is real and now
    declared; the fixture carries a matching tolerance for the two Lottie columns.
  - **`retime.timeCrop` is player-only by design.** The editor cannot round-trip the wire slot, and
    does not need to: the Lottie importer already bakes a layer's crop into animated opacity
    (`[s-1:0][s:1][e:1][e+1:0]`, wrapping in a `<g>` when opacity is taken, `opacity 0` for an empty
    window) — the SAME construction the player's `applyTimeCrop` uses. A cropped Lottie layer arrives
    as ordinary animated opacity. Open: the schema presents the slot as universal and should say
    player-only; and `hasRetime()` ignores `timeCrop`, so a crop-only retime would be dropped — a fix
    was drafted and reverted as unverifiable while the read is broken.
- **B8 closed — points are narrowed to 2D in ONE place, and a lost Z now says so** (2026-08).
  Lottie positions and spatial tangents (`ti`/`to`) are `[x, y, z]`; SVGA points are `[x, y]` and the
  schema declares a 2-tuple. The importer passed Lottie's tangents through verbatim, so a
  3-component value reached the wire and failed validation outright — every Lottie-converted document
  with spatial tangents reported `…transformBy.translate: no union member matched`. (Invisible until
  V6 closed the `{value: any}` catch-all that had been swallowing it.)
  - **Centralised:** `POINT_COMPONENTS` + `normalisePoint()` in `TypeAndCastUtil.ts` are now the only
    place that knows a point is 2D. `castValidPoint` delegates to it and TRUNCATES a longer vector
    instead of rejecting it — the old behaviour dropped an imported tangent whole. Supporting 3D later
    is a change to that one file, not a hunt through call sites.
  - **Guarded in DEPTH, at three layers**, because Lottie is 3D in more places than the importer knew:
    1. *Importer* (`TransformAttrsPartMC`): position, both spatial tangents, **anchor** and **scale**.
    2. *SVGA read path* (`PxAttrValueObj.fromJson`) — serves lightweight JSON and `data-px-meta` alike.
    3. *The model itself* (`TAbstractVecValue._setValue`): a fixed-dimension slot now clamps on the
       way IN, so no source can seat an over-long vector by a path the importer doesn't cover.
       `TAnyVecValue` (genuinely variable-length, e.g. `stroke-dasharray`) opts out via max-dim 0.
  - **A latent bug found on the way:** `_fix()` TRUNCATES by returning a slice but only PADS in place,
    and `_fromRaw` called it as a statement — discarding the result. Over-long vectors passed straight
    through the one guard that existed.
  - **Warning discipline — the neutral value is per-property.** A lossless dropped Z is 0 for offsets
    but **100 for SCALE** (Lottie scale is a percentage, so 100 = unscaled): testing scale against 0
    would flag every ordinary 3D-scale document. `PointNeutralZ` names both. A genuinely lossy Z
    raises `lottie_point3d`.
  - **Measured, not assumed.** A census of 43 real Lottie files found the 3-component fields to be
    `p`/`to`/`ti` (z=0), `a` (z=0), `s` (z=100 — 119 of 119) and `c` — which is COLOUR, not a point,
    and must never be narrowed. Converting all **127** corpus files afterwards yields **0** length-3
    arrays on the SVGA wire and **0** 3D warnings.
  - Pinned by `PointNormalisation.spec.ts` (8 tests: helper, read path, per-property neutral Z, and
    the model-side clamp). The `no union member matched` errors are gone from the Lottie suites.
- **S4 closed — four config spellings and two doc discriminators reduced to the truth** (2026-08).
  `getAnimatorConfig` was `doc.animator || doc.meta.animator || doc.animation || doc.meta.animation`
  (with a standing `FIXME`); `isPxElementFileFormat` accepted `type === 'svg'` OR `tagName === 'svg'`.
  Audited: `animator` and `meta.animator` are both genuinely written (the two addresses above);
  `animation`, `meta.animation` and `tagName` had NO writer anywhere and were never in the schema —
  and `tagName` was worse than redundant, since a tagName-only document passed the shallow gate and
  then failed `isPxElementFileFormatDeep`. All three deleted, no compat shim.
  - *Blocker cleared first:* four shipped assets still used the dead spelling and would have silently
    stopped animating — `app/src/kf/export/progress-animation.json` (the export-dialog spinner,
    rendered by the React player) and the three `svg-animator-web/e2e/0*.json` fixtures. All migrated
    to top-level `animator`, dropping `type: 'javaScript'` (never a schema slot) and `timeline: 'time'`
    (the default, now omitted). The spinner also shed 28 keys the player provably never reads
    (`data-px-label` ×20, `strokeTrimEffect` ×4, `isCombinedShape` ×4); it now validates clean in BOTH
    default and strict mode and keeps all 17 bindings.
  - *Left alone:* `src/svgeditor/googscript/animation-json-example.ts` still shows the old shape, but
    it has no importers — dead sample code, not a live asset.
- **B7 closed — a cycle loop's snap-back no longer shares a time with the previous repetition**
  (2026-08). The player emitted BOTH keyframes at the boundary (`0:20 500:160 500:20 1000:160`), so
  the value at that instant fell out of `findBracketingKeyframes`' first-match-wins tie-break and
  disagreed with every other output form. It now mirrors `TLoop.toKeyframes`: separate the pair by
  `LOOP_JUMP_SHIFT_MS` (10ms = one editor frame), and DROP the duplicate outright when the two values
  are equal (a pingpong turn says nothing). Both sides now materialise identical keyframes —
  `0:20 500:160 510:20 1000:160` for a cycle and `0:20 500:160 1000:20` for a pingpong, byte-for-byte
  the editor's CSS export (`0% / 50% / 51% / 100%` and `0% / 50% / 100%`).
  - *Scope:* loopOut only. For loopIn the coincident pair sits in the opposite array order, so
    separating it naively inverts keyframe order and re-breaks the loopIn `f0` regression; left as-is,
    and the two sides may still differ at a loopIn boundary.
  - *Why not a smaller epsilon:* the shift is one 10ms frame, not a percentage — it only looked like
    1% because the fixture is 1000ms. Going below a frame is blocked editor-side: a fractional shift
    was tried in `TLoop` and reverted (`TKeyframeGroup` mishandles fractional-frame keyframes).
  - *Consequence to know:* the shift COMPRESSES each repetition rather than delaying it (the repeat
    still ends exactly on the duration) — 2% on a 1000ms/500ms loop. The editor does the same, so they
    agree; changing that would be a change to both sides.
  - *Contradiction resolved:* the investigation could not explain a t=500 pixel diff when both sides
    computed 160 there. Fixing the TIMING (not the tie-break) made the case pass, which confirms the
    harness was catching the post-boundary phase drift — the player's repeat spanned 500ms where the
    editor's spanned 490ms — and not the boundary instant itself. An earlier note claiming the CSS
    export shows ~20 at t=500 was a deduction and was wrong; its 50% stop is 160.
  - Pinned by `PxLoopBoundary.test.ts` (4 tests, incl. sampling exactly ON the boundary — nothing did
    before, which is how this survived). `anim.loop` now passes every column in BOTH the SVGA and
    Lottie feature-explorer corpora.
- **N2 closed — `animator.animate` → `animator.animateById`** (2026-08): HARD rename, no legacy
  alias. The row claimed "three structures, one word"; the probe found something milder and more
  useful — `node.animate` and `animator.animate` share the SAME value schema
  (`PxElementAnimationSchema`), so the root form is the node form HOISTED and keyed by id, and
  `definitions.animations` is a different word for a different thing. Only the two-address collision
  was real, and the `ById` suffix names it (the `transformBy` pattern). Cost was near zero: Mode B
  appears in **0 of 117** corpus cases — it lives only in the SVG+JS export bootstrap — so no fixture
  regen, just the player (`getBindings`, `PxIdUtil` id-remap), the editor writer key (schema-derived,
  so it followed automatically) and one SVG+JS etalon. `getBindings()` keeps returning `{id, animate}`
  — that's a derived runtime view, not the wire. Documented in §2 *Naming & ids*.
- **J1 `animator.timeline` resolved — omit at default, slot KEPT** (2026-08): the row framed it as
  "implement scroll/scrub or delete + regen"; both were wrong. It was written by 117 of 117 cases,
  always `'time'` — i.e. always the default — so the J2 omit-at-default law already covered it.
  `omitWhenDefault: true` on the slot means only a genuinely scroll-driven document carries the key,
  the reserved name survives for the **scroll-linked implementation that is coming**, and the "is this
  slot used?" ambiguity disappears. Migration: 117 fixtures lost exactly one line each (verified by
  diff: 117 files, 0 insertions, 117 deletions, all the identical key), plus 15 in-spec etalons. The
  round-trip spec now asserts BOTH halves — 16 default rows expect the key absent, and a new
  `timeline = scroll` row proves a non-default value still ships (without it, silently dropping the
  slot would have passed).
- **S6 closed — the two materialisers agree visually, not structurally** (2026-08): documented as
  intentional in R7, nothing to change. Of the three original sub-items only A2 was real: for STATIC
  repeated content the editor's heavy SVG emits `<use href>` copies while the player deep-clones the
  subtree (re-verified: `clone(base)` in `repeaterEffect.ts`, `createPxElement('use', …)` in
  `TSvgRepeaterElementEffectAttr.tsx`). Each side fits its medium — the editor's SVG is a FILE that
  stays re-editable, the player's tree is EPHEMERAL. The open sub-question is answered too: animated
  repeated content is inlined by BOTH sides (0 `<use>` emitted), so animated copies never meet
  Safari's `<use>` shadow-snapshot problem. A4 (frozen animated content-ref copy) and A5 (two gradient
  defs per gradient) were probe-checked and found NOT REAL — stale claims that outlived their fixes.
  Only consequence worth knowing: editor output and player output cannot be diffed node-for-node.
- **Q1 closed — `PxInfer` over `px.union` dropped its bare-static branches** (2026-08). TWO causes,
  and only fixing both works:
  1. `UnionMembers` used `T extends ReadonlyArray<PxSchema<infer U>>` — ONE inference site for the whole
     array, so TS picked a single candidate. Replaced with per-position mapped inference
     (`{[K in keyof T]: …}[number]`).
  2. The load-bearing half: `px.union` inferred its argument as a plain ARRAY, unifying the element
     type to one `PxSchema<…>` — so (1) had a single member to map and collapsed anyway. Fixed with a
     **`const` type parameter** (`<const T extends ReadonlyArray<PxSchema<…>>>`), which forces tuple
     inference. Same modifier applied to `px.discriminatedUnion`, which had the identical latent bug.
  Symptom was that `PxAnimatableVec2Schema` published as `PxPropertyAnimation` alone, so the DIST types
  rejected a legal wire value (`effects.transformBy.translate: [100, 100]`) — which had been silently
  breaking `tsc -p e2e` in svg-animator-web. Localised with an incremental declaration-emit probe:
  a two-member union emitted correctly, adding a third collapsed it, which pointed at inference rather
  than at `implementsInterface` / `InferShape` (both had been suspects). Pinned by
  `PxSchemaUnionInference.test.ts` — the type-level assignments there stop compiling if the `const`
  modifier is ever dropped. Verified: player build 13/13, `npm run test:e2e` green end to end
  (typecheck + 15/15 visual), app tsc clean, `src/svgeditor` 847, corpus unchanged.
- **N9 closed — `definitions` vs `<defs>` kept, by decision** (2026-08): audited and closed as a
  non-issue. The two carry disjoint content at disjoint addresses with disjoint reference syntax
  (values-by-name inside `animator` vs elements-by-id in `children`), so no reader can conflate them;
  a rename would break the wire to fix a word. Documented as law in R4. The other half of the row —
  `mode: 'webapi'` → `'waapi'` — was resolved earlier (see below).
- **V2 closed — channel-vs-config IS declared in the source** (2026-08, audited slot by slot): the
  row asked for a machine-readable convention that already existed, twice over. Every effect slot
  declares its kind in BOTH the interface and the schema — channel = `PxAnimatable<T>` +
  a named `PxAnimatable*Schema`; static config = the bare type + a bare `px.*()`. Audit of all 11
  effect schemas found the split total and consistent, with ONE hand-inlined violator: `clipPath.d`
  spelled the union out at the slot (`px.union([px.string(), {value}, PxPropertyAnimation])`) instead
  of naming it. Fixed by adding `PxAnimatableStringSchema` and using it there — the convention is now
  exception-free, so "is this slot a channel?" is answerable by reading the slot's type name alone
  (and by tooling: a channel is exactly a union containing `PxPropertyAnimationSchema`). The rule is
  recorded at the `PxAnimatable*Schema` block. No `channel()` wrapper or `✚` JSDoc tag was added —
  that machinery would only restate what the types already say. Editor mirrors it with
  `isAnimatable: true` on the value config (`copies` has none; the five repeater channels do).
- **N7 closed — `strokeTrim.trimAllAsOne: boolean` → `strokeTrim.subPaths: 'separate' | 'combined'`**
  (2026-08): HARD rename, no legacy alias. The stutter was the smaller half — the flag was a two-way
  selector flattened to a boolean, the one place we narrowed an upstream enum (Lottie/AE model it as
  `m: 1 | 2`, "Trim Multiple Shapes"). Player: `PxStrokeTrimSubPaths` enum + `px.enum([...])` slot,
  `strokeTrimEffect.ts` reads `subPaths === combined`. Editor: `TSvgStrokeTrimEffect.subPaths` is a
  `TStrValue` (`subPathsType` choices, `omitWhenDefault`) with `isCombinedSubPaths()` /
  `setCombinedSubPaths()` at the call sites (Lottie convertor, dasharray math); the right-panel
  checkbox became a 2-item dropdown matching the Lottie panel. Default `'separate'` is omitted, so all
  68 strokeTrim corpus cases are byte-identical — only the 3 files that carried the non-default changed
  (2 feature-explorer cases, renamed `…trimAllAsOne.json` → `…subPathsCombined.json`, + the
  round-trip oracle). Pinned by `PlayerEffects-strokeTrim.spec.ts`, `PlayerEffects-Read.spec.ts`, the
  full-coverage round-trip, and the 8 strokeTrim feature-explorer cases.
- **N8 closed — `loop.before: boolean` → `loop.extend: 'before' | 'after'`** (2026-08): HARD rename,
  no legacy alias. Player `PxLoopExtend` enum + `px.enum([...])` slot; all four `if (loop.before)`
  branches in `PxDefinitions.ts` now test `loop.extend === PxLoopExtend.before`. Editor: `PxAttrLoopObj.extend`
  (`str()`, typed `PxLoopExtend`), `TLoop.isBefore` mapped at both ends (`PxAttrSerialisationObjs`,
  `SvgGradientElements.readStopColorLoop`, `GlyphMaterialiseSvgUtil.to/fromPxLoop`). `TLoop.isBefore`
  keeps its editor-model name — the law governs the wire, not the model. Absent `extend` = `'after'`,
  so the boolean shorthand `loop: true` and every corpus case are byte-identical (the key was DECLARED
  but written 0 times in 116 cases — zero migration risk). Boolean-naming law recorded in §2
  *Naming & ids*; `isItalic` audited as a non-issue (ships as `fontStyle: 'italic'`, never a wire
  boolean). Pinned by the web loop-expansion spec + editor `loop-config.spec.ts` / `SvgaAttrSerialisationUtil.spec.ts`.
- **Heavy round-trip idempotency** holds (`write(read(heavy)) == heavy`, canonical ids) across probe combos; accumulation guarded by `applied-effects-accumulation.spec.ts` (11 producers × 2 forms × 3 cycles).

---

## 6 · Corpus & verification — what pins the format

*Method (2026-08 audit): three probes over the feature-explorer corpus, all deleted afterwards.
(1) validate every case against BOTH `PxAnimatedSvgDocumentSchema` (lib) and
`PxAnimatedSvgDocumentSchemaExtra` (editor), in default AND strict mode; (2) diff every
schema-DECLARED key path against every key path actually WRITTEN across the corpus; (3) serialise
all cases to the pre-rendered SVG form and parse every `data-px-meta` blob. Counts are REAL — read
off generated output, not off declarations.*

### 6.1 · Baseline — the corpus is schema-clean

**117 / 117 cases pass BOTH schemas in BOTH modes**, with zero errors. After the V6 engine fixes
`strict: true` is a real gate (it reaches inside unions and ignores `undefined`-valued keys — see
the core README "Validating a document"), and the corpus still passes it. **Any future strict
failure is a genuine regression, not noise.**

Fixtures are authored as draft documents, run through `settleCaseJson` to the serializer's
canonical fixed point (write → read → write), then written to `cases/`; the glob picks them up for
the explorer and the visual suite automatically. Every fixture is therefore also a round-trip
guard (P-F).

### 6.2 · Coverage — the slots the corpus exercises by decision

The 2026-08 sweep (C3, §5) added five fixtures for slots that had zero coverage, and two of them
found real bugs (per-copy `repeater.skew` was never rendered by the editor — three places — and
gradient `spreadMethod` was silently lost in the Lottie export):

| case | covers |
|---|---|
| `effect.maskedBy.viewport` | `maskedBy.x/y/width/height` — uses `x: 0` deliberately, so a dropped `0` (B6) fails it |
| `effect.transformBy.skew` | `transformBy.skew` |
| `effect.repeater.skew` | `repeater.skew` (found the bug above) |
| `effect.textPath.fitting` | `textPath.lengthAdjust: spacingAndGlyphs` + `method: stretch` + `textLength` |
| `attr.gradient.spreadMethod` | `fillGradient.spreadMethod: reflect` — keeps a `tolerances` entry for the two Lottie columns (Lottie has no spreadMethod; the loss is real and now declared) |
| `effect.transformBy.splitTiming` | split per-part timing — the reason the effect exists (C1) |
| `effect.retime.timeCrop` | the visibility window, green on every column (C4) |

**Left uncovered, by decision:** `animator.delay` / `.fill` / `.frameRate` / `.iterations` /
`.resetOnFinish` / `.trigger.scrollIntoViewThreshold` (document-level config — retimes the whole
document, and the harness samples at fixed fractions, so a fixture there tests the harness more
than the format; wants unit coverage instead); `effects.clipPath.animate` (`@deprecated`,
read-only by design); `fillGradient/strokeGradient.gradientTransform` (documented static-only,
no author path); `animator.definitions.*` and `animator.animateById` (export/library-only).

### 6.3 · The `data-px-meta` surface, measured

Exactly **six** top-level keys are ever written to a per-element `data-px-meta` across the corpus
(378 distinct key paths in total, 0 unparseable):

| key | occurrences | meaning |
|---|---|---|
| `partOf` | 920 | derived node → its host |
| `animate` | 600 | the node's own channels |
| `appliedEffects` | 233 | baked recipe, applied IN PLACE on a plain node |
| `effectsHost` | 152 | baked recipe for an EXPANSION (carries `coreId` + its own `appliedEffects`) |
| `label` | 93 | editor-only display name |
| `timeline` | 2 | symbol duration (R6) |

`appliedEffects` appearing in both positions is the documented §P contract, not drift. Effect keys
seen inside it: `clone`, `fillGradient`, `maskedBy`, `repeater`, `shape`, `strokeGradient`,
`text`, `textPath`, `transformBy`, `strokeTrim` (census taken under its pre-rename spelling
`trimPath`) — `shape` is the editor-only extension (§4.2), correctly absent from the lib's
`PxEffectsSchema`.

---

## 7 · Open items

Everything closed lives in §5. Ids are stable and never reused (`B*` bugs, `S*` structural, `N*`
naming, `V*` validation, `J*` janitorial, `C*` coverage). **One row is open, and it is not a
defect.**

### C4 · Lottie IMPORT still bakes a layer's crop as opacity — PAUSED ★☆☆☆

The wire, the editor, the player and every pre-rendered form already agree on `retime.timeCrop`
(§5). What remains is that the Lottie IMPORT expresses a layer's `ip`/`op` crop as baked opacity
rather than emitting the declarative slot. Both render correctly; the declarative form is simply
the better one to carry. Attempted twice in 2026-08 and reverted both times; paused with the
ground mapped so the next attempt starts from evidence:

- **Design (settled):** a `<use>` (precomp link) should carry `clone.retime.timeCrop`; anything that
  is NOT a `<use>` keeps baked opacity (only a `<use>` has a retime slot); `ip`/`op` windows that
  merely restate the composition's own range are NOT crops and must be dropped — guard written and
  verified: `timeCrop[0] > (animation.ip ?? 0) || timeCrop[1] < (animation.op ?? +∞)`.
- **Proven correct with the switch applied** (`143463-boat`, 6 cropped layers): full-range windows
  ignored; Lottie → model gives `[0,100] [100,200] …` editor frames on the six `<use>`; model →
  Lottie writes back ×0.6 matching the ORIGINAL file; the SVGA render shows exactly one `<use>`
  per frame.
- **What still fails:** only the reverse render (`lottie-in-app-back__vs__svga-in-app`) —
  `lottie-roundtrip-diff` goes 4 → 9 failures on a quiesced tree. Values and forward rendering are
  right, so the fault is downstream of both.
- **Hypothesis to test first:** Lottie `ip`/`op` are relative to the CONTAINING composition's
  timeline; if the round-trip moves layers between nesting levels (or remaps the `<use>` → precomp
  linkage), identical numbers denote different windows.
- ⚠️ Re-establish the diff-suite baseline on a quiesced tree before judging any change — an early
  "8 → 14" reading compared two different codebases.

Two corpus cases are RED and tracked outside this file (`effect.clone.text`,
`effect.clone.text.glyphs`) — a read-back defect, see `app/TEST-FAILURES-2026-08.md` §1b.
