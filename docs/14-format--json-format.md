# JSON format reference

[← Format principles](./13-format--format-principles.md) · [Contents](./README.md) · Next: [Player effects →](./15-format--effects.md)

This page is the reference for the JSON format. It lists every key of the document, with its
type and its meaning. A document is simply **SVG written as JSON, with the animation added
alongside** — if you understand SVG files, you will understand these too. If SVG itself is
new to you, start with an SVG introduction first (for example
[MDN's SVG tutorial](https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorials/SVG_from_scratch)) and come back. Why the
format is shaped this way: [Format principles](./13-format--format-principles.md).

## A complete small document

Everything the format is, in one small document — a ball that drops with an ease-in-out.
The comments mark the two things **added on top of plain SVG** (JSON itself does not allow
comments, so a real file has none):

```js
{
  // The root <svg> element — plain SVG, written as JSON
  "type": "svg",
  "viewBox": "0 0 400 400",

  // ADDED: the playback settings — how long, how many times, what starts it
  "animator": { "duration": 1000, "iterations": "infinite", "trigger": { "startOn": "load" } },

  "children": [
    {
      // A plain <ellipse> element with ordinary SVG attributes
      "type": "ellipse",
      "cx": 139, "cy": 163, "rx": 64, "ry": 64,
      "fill": "#007fff85", "stroke": "#003a73",

      // ADDED: the element's animation — keyframes for its transform attribute
      "animate": {
        "transform": { "keyframes": [
          { "time": 0,    "value": { "translate": [0, 0] } },
          { "time": 1000, "value": { "translate": [0, 147] }, "easing": [0.42, 0, 0.58, 1] }
        ] }
      }
    }
  ]
}
```

Three ideas cover 90 % of the format:

1. **Every element is a JSON object** — `type` holds the SVG tag name, every other key is an
   SVG attribute, and `children` is an array of the element's child elements, nested the same
   way the tags nest in an SVG file.
2. **Any attribute can be animated by adding keyframes next to it** — they go under the
   element's `animate` key, filed by the attribute's name. The static attribute itself stays
   where it is, so if you remove every `animate`, a valid static SVG remains.
3. **One place for playback settings** — the root `animator` object holds everything about
   how the document plays: duration, loops, what starts it.

## The document root

| Field | Type | Meaning |
|---|---|---|
| `type` | always the string `"svg"` | required — marks the root element of the document |
| `id` | string | the element's identifier — it becomes the DOM id, and other elements and effects reference the element by it ([documents without `children`](#animating-a-pre-rendered-svg) rely on these references) |
| `viewBox` | string | the drawing's coordinate space, exactly as in SVG — e.g. `"0 0 700 380"` means "the drawing spans 700 × 380 units" |
| `width` · `height` | number or string | how big the drawing appears on the page — the same `width` / `height` you would put on an `<svg>` tag. Write a plain number (`400`) for pixels, or a string for anything with a unit: `"32px"`, `"100%"` |
| `animator` | object | the playback settings — duration, loops, trigger, etc — see [Playback settings](./10-player--playback-and-triggers.md) and [Definitions](#definitions--animatordefinitions) |
| `children` | array of element objects | the nested SVG children tree |
| any SVG attribute | string or number | any other key is passed through to the rendered `<svg>` as an SVG attribute (`fill`, `style`, …) |

## Nodes

Every element of the SVG tree is written as a JSON object, called a **node**. The `type` key
holds the tag name (`"rect"`, `"circle"`, `"path"`, …), the element's SVG attributes are
ordinary keys next to it, and three optional keys can be added: `children` (the element's
child elements), `animate` (its animation) and `effects` (its effects):

```js
// A plain SVG <rect>, written as JSON
{ "type": "rect", "id": "box", "x": 10, "y": 10, "width": 80, "height": 40, "rx": 6, "fill": "#6366f1",
  // ADDED: the rect's animation — keyframes for its opacity
  "animate": { "opacity": { "keyframes": [ { "time": 0, "value": 0 }, { "time": 500, "value": 1 } ] } } }
```

| Field | Meaning |
|---|---|
| `type` | the SVG tag: `rect`, `circle`, `ellipse`, `line`, `path`, `g`, `text`, `tspan`, `use`, `symbol`, `defs`, `image`, `mask`, `clipPath`, `linearGradient`, `radialGradient`, `stop`, `pattern`, `marker`, `filter` and the `fe*` primitives, … |
| `id` | DOM id — required when something references the element (`href="#id"`, `maskedBy`, `animateById`). When the player creates the DOM elements, it replaces every id with a fresh one (that is how several copies of one file coexist on a page), so ids need only be unique within the file |
| `children` | nested nodes |
| `animate` | this node's animations — [below](#animating--the-animate-channel) |
| `effects` | this node's effects — [Player effects](./15-format--effects.md) |
| `style` | inline style: a string or an object, or the **name** of a preset in `definitions.styles` |
| `textContent` | text content of `<text>` / `<tspan>` |
| `meta` | editor-only data (labels, shape presets, applied effects). Players ignore it, so if the file will only ever be played — never edited in the editor again — this key can be removed — [Editor meta and applied effects](./16-format--editor-meta.md) |
| any other key | an SVG attribute |

**Attribute names** may be written as in SVG (`stroke-width`, `font-size`) or camelCase
(`strokeWidth`, `fontSize`); both render to the standard kebab-case attribute. The editor
writes camelCase.

**Static values** are typed: numbers (`opacity: 0.5`), number lists (`strokeDasharray: [16,
16]`), strings (`fill: "#33b366"`, `viewBox`), a transform written as an **object with one key per part** (`transform:
{ translate: [10, 10], rotate: 45 }`) or an SVG transform string. Note that a static
attribute value is written exactly the same way as a keyframe's `value` for that attribute —
learn one way of writing values and you know both.

**Reserved keys** — `type`, `children`, `animator`, `animate`, `effects`, `meta`, `text`,
`textContent` never reach the DOM as attributes: they are instructions for the player, which
turns them into other things — the element itself, its child elements, its text, its
animation.

One name clashes with this rule. A few SVG filter elements (such as `<feTurbulence>`) have an
attribute that is itself called `type` — but in a node, the `type` key is already taken by
the tag name. For these elements, write the attribute under the name **`domType`** instead;
when the player creates the element, it turns `domType` back into a real `type` attribute:

```js
// In SVG this would be:  <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" />
{ "type": "feTurbulence", "domType": "fractalNoise", "baseFrequency": 0.05, "numOctaves": 2 }
```

### Text

Text nodes carry their content in `textContent`, not as children:

```json
{ "type": "text", "x": 20, "y": 40, "fill": "#111", "fontSize": 18, "textContent": "Hello",
  "children": [ { "type": "tspan", "dy": 20, "textContent": "second line" } ] }
```

With `effects.text.useGlyphs: true` the text renders from glyph outlines embedded in
`definitions.glyphs` — no font needed on the viewer's machine (the editor embeds them for you).

## Animating — the `animate` channel

A node animates through its `animate` map — one entry per attribute, each holding that
attribute's keyframes:

```js
// Three attributes of one element, each animated on its own channel
"animate": {
  "opacity":   { "keyframes": [ { "time": 0, "value": 0 }, { "time": 1000, "value": 1 } ] },
  "fill":      { "keyframes": [ { "time": 0, "value": "#3b82f6" }, { "time": 1000, "value": "#ec4899" } ] },
  "transform": { "keyframes": [ { "time": 0, "value": { "rotate": 0 } }, { "time": 1000, "value": { "rotate": 360 } } ] }
}
```

That is the usual form: an object with one entry per animated attribute. There are also
three shorthand forms, all built on **named animations** — animations defined once in
`definitions.animations` ([below](#definitions--animatordefinitions)) and reused by name:

```js
// One named animation, by itself
"animate": "fadeIn"

// Several named animations at once
"animate": ["fadeIn", "spin"]

// Named animations mixed with an ordinary inline one
"animate": ["fadeIn", { "scale": { "keyframes": [ { "time": 0, "value": [1, 1] }, { "time": 1000, "value": [1.5, 1.5] } ] } }]
```

### Property animation

| Field | Type | Meaning |
|---|---|---|
| `keyframes` | array | the timeline |
| `value` | same as a keyframe's `value` ([Keyframe values](#keyframe-values)) | optional static baseline (rarely needed — the static attribute on the node is the baseline) |
| `loop` | `true` or object | this one property repeats on its own, independent of the whole document's `iterations` — [Per-property loops](#per-property-loops) |
| `autoOrient` | boolean | translate animations with tangents: rotate the element to face the path — [Motion along a path](#motion-along-a-path) |

### Keyframes

| Field | Alias | Type | Meaning |
|---|---|---|---|
| `time` | `t` | ms | offset from the start of the document timeline |
| `value` | `v` | depends on the property — [Keyframe values](#keyframe-values) | the property's value at this time |
| `easing` | `e` | `[x1, y1, x2, y2]` or a name | how the value moves **from this keyframe to the next one**: a cubic-bezier curve, or the name of a curve defined in `definitions.easings` |
| `tangentOut` · `tangentIn` | `to` · `ti` | `[dx, dy]` | spatial tangents for motion along a path (translate only), relative to this keyframe's position |

Each key has a short alias (`time` / `t`, `value` / `v`, …). Use either the full name or the
alias for a key, never both on the same keyframe.

### Keyframe values

| Property kind | `value` | Example |
|---|---|---|
| a single number (`opacity`, `r`, `strokeWidth`, `rotate`, …) | number | `0.5` |
| a list of numbers (`strokeDasharray`, `scale`, `translate`) | number array | `[80, 40]` |
| colour (`fill`, `stroke`, `stopColor`, …) | CSS colour string (or an RGBA number array) | `"#ec4899"` |
| unified `transform` | an object with one key per transform part — `translate`, `rotate`, `scale`, `skew`, `origin` | `{ "translate": [8, 4], "rotate": 90, "scale": [2, 2] }` |
| path `d` | `{ "path": "M…" }` (a bare `"M…"` string is also accepted) | `{ "path": "M0,0 L50,0 L50,50 Z" }` |
| gradient `stops` (inside gradient effects) | array of `{ offset, color }` — each keyframe's value is the complete stop list, every stop with its position and colour at that moment | `[{ "offset": 0, "color": "#3b82f6" }, { "offset": 1, "color": "#ec4899" }]` |

### Easing

Easing controls the pace of the change between two keyframes — for example start fast and
slow down towards the end. It is written on the keyframe where the movement begins and
applies to the movement from that keyframe to the next.

Give it a cubic-bezier curve directly:

```json
{ "time": 0, "value": 0, "easing": [0.33, 0, 0.67, 1] }
```

Or give it a name — the named curve must then be defined in `animator.definitions.easings`
of the same document:

```js
// on the keyframe
{ "time": 0, "value": 0, "easing": "smooth" }

// at the document root
"animator": {
  "definitions": { "easings": { "smooth": [0.42, 0, 0.58, 1] } }
}
```

A keyframe with no `easing` gets linear movement: the value changes at a constant, even pace
all the way to the next keyframe.

### Per-property loops

A property can repeat part of its own keyframes to fill `animator.duration`, independently of
the document's `iterations`:

```json
"rotate": { "keyframes": [ { "time": 0, "value": 0 }, { "time": 1000, "value": 360 } ], "loop": true }
"scale":  { "keyframes": [ { "time": 0, "value": [1, 1] }, { "time": 500, "value": [1.2, 1.2] }, { "time": 1000, "value": [1, 1] } ],
            "loop": { "segmentCount": 1, "extend": "after", "alternate": true } }
```

| Field | Meaning |
|---|---|
| `segmentCount` | how big the repeated piece is, counted in **intervals** — an interval is the stretch between two neighbouring keyframes. By default the whole sequence repeats; `"segmentCount": 1` repeats only one interval — the last one with `extend: "after"`, the first one with `extend: "before"`. In the example above, `scale` has three keyframes (two intervals), and only its second half — the shrink back from 1.2 to 1 — keeps repeating |
| `extend` | which end of the timeline the repetition fills. `"after"` (default): the animation plays through once, then the **last** intervals repeat until the document's duration is used up — e.g. a character lands and then keeps breathing. `"before"`: the **first** intervals repeat first, and the rest of the keyframes play at the end — e.g. a logo pulses for a while and then settles |
| `alternate` | `false` (default) replays in the same direction; `true` ping-pongs |

`loop: true` = repeat the whole sequence, after, forward.

## Transforms

Animate every part together as **one** `transform` property. Each keyframe's value is an
object holding all the parts — `translate`, `rotate`, `scale` — side by side:

```js
// One transform property; every keyframe carries all the parts together
"animate": { "transform": { "keyframes": [
  { "time": 0,    "value": { "translate": [0, 0],   "rotate": 0,  "scale": [1, 1] } },
  { "time": 1000, "value": { "translate": [80, 40], "rotate": 90, "scale": [1.5, 1.5] } }
] } }
```

| Part | Type | Notes |
|---|---|---|
| `translate` | `[x, y]` | how far to move along x and y — plain numbers in the drawing's coordinates (the `viewBox` space) |
| `rotate` | number | degrees |
| `skew` | number | skewX degrees, composed between rotate and scale |
| `scale` | `[sx, sy]` | multipliers: `1` = unchanged, `2` = double size, `0.5` = half |
| `origin` | `[x, y]` | pivot for rotate / skew / scale — only meaningful alongside one of them |

The parts are applied in this order: `translate · +origin · rotate · skewX · scale · −origin`.

The same kind of object is also the preferred way to write a **static** `transform`
attribute (`"transform": { "translate": [100, 100], "rotate": 45 }`); an ordinary SVG
transform string is accepted too. Each part can also be animated as its own channel
(`animate: { translate, rotate, scale }`).

An animated `transform` writes the element's one `transform` attribute, so it overwrites a
static `transform` on the same element — put a fixed placement on a wrapping `<g>` instead.
And since all parts share one set of keyframes, they run on one schedule; to give each part
its own timing, use the [`transformBy` effect](./15-format--effects.md#8--transformby).

## Motion along a path

Translate keyframes can carry Bézier tangents; the element then moves along the curve, and
`autoOrient` turns it to face the direction of travel:

```js
"animate": { "transform": {
  // The element turns to face its direction of travel
  "autoOrient": true,
  "keyframes": [
    // The tangents bend the straight line between the keyframes into a curve
    { "time": 0,    "value": { "translate": [30, 150] },  "tangentOut": [46, -80] },
    { "time": 3000, "value": { "translate": [270, 150] }, "tangentIn":  [-46, -80] }
  ]
} }
```

The tangents are the Bézier control points of the curve, written relative to their keyframe's
own position (like the handles of a pen tool).

## Shape morphing — animating a `<path>`'s outline

A path's shape is its `d` attribute — a string of drawing commands. Animate `d` and the
shape morphs from one form to the next. One rule: every keyframe's path must have the
**same number of points** (in the example below, both shapes have four). Paths drawn in the
editor get this right automatically:

```js
{ "type": "path", "fill": "#f59e0b", "d": "M-50,0 L0,-50 L50,0 L0,50 Z",
  // The diamond morphs into a square — both shapes have four points
  "animate": { "d": { "keyframes": [
    { "time": 0,    "value": { "path": "M-50,0 L0,-50 L50,0 L0,50 Z" } },
    { "time": 2000, "value": { "path": "M-50,-50 L50,-50 L50,50 L-50,50 Z" } }
  ] } } }
```

Morphing runs on the frame-loop engine (the `auto` mode switches automatically).

## Definitions — `animator.definitions`

`animator.definitions` is where things are **defined once, under a name, and used in many
places by that name** — instead of repeating the same easing curve or the same animation on
every element that needs it:

```json
"definitions": {
  "easings":    { "smooth": [0.42, 0, 0.58, 1] },
  "animations": { "fadeIn": { "opacity": { "keyframes": [ { "time": 0, "value": 0 }, { "time": 2000, "value": 1 } ] } } },
  "styles":     { "label": { "fontFamily": "Inter", "fontSize": 12 } },
  "glyphs":     { "Roboto": { "fontFamily": "Roboto", "style": "", "ascent": 928, "unitsPerEm": 1000,
                              "glyphs": { "H": { "width": 722, "d": "M100 0V722H190V400H532V722H622V0H532V320H190V0Z" } } } }
}
```

| Field | What it holds | How an element uses it |
|---|---|---|
| `easings` | named easing curves | a keyframe writes the name instead of the curve: `"easing": "smooth"` |
| `animations` | named animations | a node writes the name instead of the keyframes: `"animate": "fadeIn"` (documents without `children` use the same names in `animateById`) |
| `styles` | named sets of style attributes | a node writes the name instead of the attributes: `"style": "label"` |
| `glyphs` | letter outlines: for each font, the shape of every letter used, stored under that font's name (`"Roboto": …` in the example above) | a `<text>` node with `effects.text.useGlyphs: true` is drawn from these outlines — the node's `font-family` says which font's outlines to use. No font file is needed on the viewer's machine |

## Animating a pre-rendered SVG

When the editor saves a **pre-rendered *SVG + JS animation*** file, it puts two things into
that one `.svg` file:

- the **markup** — the elements, as ordinary SVG, each with an id;
- a shortened **JSON document** inside the file's `<script>`, which carries only the
  animations and links them to the markup through those ids.

This section is about that shortened JSON document. It looks like a normal document, with one
difference: it has no `children` — the elements already exist as markup, so instead of
carrying them again, it lists its animations in `animator.animateById`, keyed by the id of
the element each one animates. You will normally never write such a document yourself; the
editor generates it.

```js
import { createAnimator } from '@pixodesk/svg-animator-web';

createAnimator({ container: '#box', data: {   // an empty <div id="box"> on the page
  type: 'svg', id: '_px_root',
  animator: {
    duration: 2000,
    definitions: { animations: { fadeIn: { opacity: { keyframes: [ { time: 0, value: 0 }, { time: 2000, value: 1 } ] } } } },
    animateById: {
      _px_rect:    'fadeIn',                                     // one named animation
      _px_ellipse: ['fadeIn', { fill: { keyframes: [ { time: 0, value: '#0087ff' }, { time: 2000, value: '#ff3b30' } ] } }],  // several, mixed
    },
  },
} });
```

`animateById` values have exactly the same shape as a node's `animate`; only the key differs
(element id here, attribute name there).

## Units of the values in a document

Every number in a document — a keyframe's `time`, a `duration`, a coordinate, an angle — is
written as a plain number, never with a unit after it (no `"500ms"`, no `"45deg"`). Instead,
each property has one fixed unit that is always understood:

| Value | Unit |
|---|---|
| time (`time`, `duration`, `delay`, `retime.start`) | milliseconds |
| lengths, coordinates, `fontSize` in px | plain numbers in the drawing's coordinates (the `viewBox` space) — no unit is written |
| `rotate`, `skew`, angles | degrees |
| `opacity`, trim `range` / `offset`, stop `offset`, `scrollIntoViewThreshold` | a share of the whole, from `0` (none) to `1` (all) |
| every `scale` | a multiplier: `1` = unchanged, `2` = double, `0.5` = half |
| `retime.stretch` | a multiplier of duration: `2` = twice as long (half speed), `0.5` = half as long (double speed) |
| `frameRate` | frames per second |
| easing | cubic-bezier `[x1, y1, x2, y2]` |

[← Format principles](./13-format--format-principles.md) · [Contents](./README.md) · Next: [Player effects →](./15-format--effects.md)
