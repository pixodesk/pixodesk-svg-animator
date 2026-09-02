# Editor meta and applied effects

[← Player effects](./15-format--effects.md) · [Contents](./README.md) · Next: [Meta in pre-rendered SVG →](./17-format--data-px-meta.md)

Read this if you open an animation file and find a `meta` block you did not write, or if you
write files by hand and want to know what you can leave out. Everything here is the editor's:
the player types `meta` as *anything* and ignores it wholesale, so a file with no `meta` at all
plays exactly the same.

## Where it lives

Every node may carry a `meta` object. In the JSON format it sits on the node as `node.meta`;
in a pre-rendered SVG the same object is written into a per-element `data-px-meta` attribute
([Meta in pre-rendered SVG](./17-format--data-px-meta.md)). One read pipeline handles both.

```js
// A plain SVG path — this is what every player draws
{ "type": "path", "id": "star", "d": "M50,122L78,172.4L22,172.4L50,122z",
  // ADDED: editor-only data — players skip `meta` entirely
  "meta": { "label": "Triangle", "appliedEffects": { "shape": { "preset": { "type": "polygon", "points": 3, "radius": 30 } } } } }
```

## The keys

| Key | On | Holds |
|---|---|---|
| `label` | any element | the display name shown in the editor's element tree |
| `appliedEffects` | a plain node | this node's own effects, **already applied** — [Applied effects](#applied-effects--the-tense-is-the-meaning) |
| `effectsHost` | the host of an expanded unit | `{ coreId?, appliedEffects }` — the effects of an element that was written as several elements — see [Units](#units--one-element-written-as-several) |
| `partOf` | every element derived by that expansion | `"#hostId"` — points back at the host |
| `runtime` | root `<svg>` only | how the animation code was generated: `{ useCssAnimation, useJsTriggers, externalJs, unoptimisedJs }` — the export-format choices, not the animation |
| `animator` | root `<svg>`, **pre-rendered SVG only** | the playback settings; in JSON they are the top-level `animator` instead ([read more](./17-format--data-px-meta.md#the-animator-config-lives-in-two-different-places)) |
| `timeline` | `<symbol>` only | `{ duration }` — the symbol's own animation length, ms |
| `lineSpacing` | text line `<tspan>`s from the second line on | the *Auto* line-height multiplier the materialised `y` was computed from |
| `animate` | any element, **pre-rendered SVG only** | the node's keyframes, so a CSS export can be re-opened; in JSON this is the node's own `animate` |

## Applied effects — the tense is the meaning

An animation file can carry the same effect in two places, and the *position* says what it means:

| | Who acts | Meaning |
|---|---|---|
| `node.effects` | the player, at load | **apply these.** Declarative — [Player effects](./15-format--effects.md) |
| `node.meta.appliedEffects` | nobody | **these were applied.** The result is already in the node's ordinary attributes; this is the recipe kept so the editor can show the effect as an effect again |

The player never reads `appliedEffects`, and the editor never re-applies it. Editing a value
in `appliedEffects` by hand changes nothing on screen — the materialised result is what plays.

What can appear there is the player's effects bucket plus the editor's own keys:

- **`shape`** — the parametric source of a path: a `preset`, or a raw `path` when a modifier
  (rounded `corners`) was applied. The editor materialises the result into `node.d` (or `node.animate.d`
  when the preset animates) and keeps `shape` here, so the file re-opens as a star with a
  radius handle, not as a fixed path. Fourteen presets: star, polygon, spiral, arc, wave, arrow,
  heart, cross, frame, cog, crescent, tear, eye, trapezoid. A preset's *topology* (a polygon's
  side count) is static; its geometry (radius, roundness, start angle …) can carry keyframes.
- **`text`** — widened with `fontSource` and `source`, the payload that lets glyph-rendered
  text be edited as text again.
- **`clone`** — widened with the `width` / `height` of a materialised `<use>`.
- **`combinedPath: true`** — an *identity* effect the writer adds beside `strokeTrim` when it
  had to split a multi-sub-path shape into a `<g>` of one `<path>` each; it tells the reader to
  join them back into one shape.

```json
"meta": { "appliedEffects": {
  "shape": {
    "preset": { "type": "polygon", "points": 6, "radius": 40, "startAngle": 0,
                "roundness": { "keyframes": [ { "time": 0, "value": 0 }, { "time": 1000, "value": 12 } ] } }
  }
} }
```

## Units — one element written as several

Some effects cannot be materialised into one element. A repeater is *n* copies; a stroke trim on a
shape with several sub-paths becomes a `<g>` of one `<path>` per sub-path. A pre-rendered file
holds that expansion — and the editor must be able to fold it back into the one element you
drew. Three marks make that possible:

```
HOST   the outermost written element; keeps the element's own id
       meta.effectsHost = { coreId?, appliedEffects }   ← ALL of the element's effects, the only copy
CORE   the element's own node inside the unit — named by coreId, or the host itself when absent
PART   every element the expansion produced
       meta.partOf = "#hostId"                          ← always the host, never a sibling
```

A node is exactly one of *host*, *part* or *plain* — never two. Only a plain node carries
`appliedEffects` directly; inside a unit everything lives in the host's bucket.

On read the editor takes one verdict per unit — *does this fold back to exactly one element?* —
and restores all of it or none. A unit it cannot restore keeps its artwork, drops its effects
cleanly, and tells you which effect was lost. This is also why every derived element is marked:
restoring an effect while leaving its old expansion behind would double it on the next save.

Units appear in pre-rendered files. A JSON document from the editor carries its effects
declaratively instead, so it never contains one.

## If you write files by hand

- **Leave `meta` out.** Nothing in it affects playback.
- **Don't put an effect in `appliedEffects` expecting it to run** — that is what `effects` is for.
- **Don't strip `meta` from a file you intend to re-open** in the editor: a preset becomes a
  plain path, glyph text becomes outlines, and an expanded effect becomes ordinary elements.
  For a file that only needs to *play*, stripping it is safe and makes the file smaller.

[← Player effects](./15-format--effects.md) · [Contents](./README.md) · Next: [Meta in pre-rendered SVG →](./17-format--data-px-meta.md)
