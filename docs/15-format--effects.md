# Player effects

[← JSON format reference](./14-format--json-format.md) · [Contents](./README.md) · Next: [Editor meta and applied effects →](./16-format--editor-meta.md)

An **effect** is a shortcut. Everything an effect does could be written out by hand with
plain elements and attributes — a mask as a `<mask>` element, five copies of a shape as five
elements — but that means a lot of repeated markup. An effect says the same thing in one
short declaration on the element: *"mask me with that circle"*, *"repeat me five times, each
copy 80 further right"*. When a JSON document loads, the player expands each effect into the
plain elements and attributes it stands for. (This applies to JSON only — in a pre-rendered
SVG export the editor has already done the expanding.)

```js
// A plain SVG <rect> with ordinary attributes
{ "type": "rect", "x": 0, "y": 0, "width": 40, "height": 40, "fill": "#3b82f6",
  // ADDED: two effects — the player turns them into real elements when the file loads
  "effects": {
    "transformBy": { "translate": [50, 50], "rotate": 30 },
    "repeater":    { "copies": 5, "translate": [80, 0], "rotate": 15 }
  } }
```

**Effect attribute values — static or animated.** Many of an effect's attributes can be
animated, just like an element's attributes. In the tables below their type is written as a
union, e.g. `number | Animated<number>` — the attribute accepts either form:

- a static value — `"rotate": 30` (also accepted wrapped in an object: `"rotate": { "value": 30 }`)
- an `Animated<…>` value — keyframes written exactly like in an element's `animate`:
  `"rotate": { "keyframes": [ … ] }`, optionally with `"loop"`

When an element has several effects, the player applies them in a fixed order — the
**Applied** column below. How you order the keys inside `effects` makes no difference:

| Applied | Effect | What it does |
|---|---|---|
| 1 | [`text`](#1--text) | glyph-outline text rendering |
| 2 | [`textPath`](#2--textpath) | text along a path |
| 3 | [`fillGradient` / `strokeGradient`](#3--fillgradient--strokegradient) | gradient paint with animatable stops and geometry |
| 4 | [`strokeTrim`](#4--stroketrim) | reveal or hide a stroke progressively along its path |
| 5 | [`repeater`](#5--repeater) | N copies, each stepped by a delta |
| 6 | [`maskedBy`](#6--maskedby) | mask by another element |
| 7 | [`clipPath`](#7--clippath) | clip to a (possibly animated) path |
| 8 | [`transformBy`](#8--transformby) | per-part transforms with independent timing |
| 9 | [`clone`](#9--clone) | `<use>` semantics: what it copies, and re-timing |

For example, `repeater` + `transformBy` on one element always means "repeat, then transform
the whole row", because `repeater` (5) is applied before `transformBy` (8). For "transform
each copy, then repeat", put the `transformBy` on a child and the `repeater` on the parent
group.

## 1 — `text`

Draws a `<text>` element from letter outlines stored in the document itself
(`definitions.glyphs`) instead of using a font: the text looks identical on every machine,
and no font file needs to be installed or loaded.

| Field | Type | Meaning |
|---|---|---|
| `useGlyphs` | boolean | render the text from the glyph outlines in `definitions.glyphs` — self-contained, identical on every machine, no font loading |

```js
{
  "type": "svg",
  "viewBox": "0 0 400 100",
  "animator": {
    "duration": 1000,
    "definitions": {
      // The outlines the text is drawn from — one entry per letter used
      // (paths shortened here; the editor writes the real ones)
      "glyphs": {
        "Roboto": { "fFamily": "Roboto", "style": "", "ascent": 928, "unitsPerEm": 1000,
                    "glyphs": { "H": { "width": 722, "d": "M…" }, "e": { "width": 556, "d": "M…" },
                                "l": { "width": 222, "d": "M…" }, "o": { "width": 556, "d": "M…" } } }
      }
    }
  },
  "children": [
    { "type": "text", "x": 20, "y": 60, "fontFamily": "Roboto", "fontSize": 32, "textContent": "Hello",
      // Draw "Hello" from the embedded Roboto outlines instead of loading the font
      "effects": { "text": { "useGlyphs": true } } }
  ]
}
```

The editor embeds the used glyphs when you switch a text to glyph mode. Combined with
`textPath`, the glyphs are laid along the path directly.

## 2 — `textPath`

Put this on a `<text>` element to lay its text along a curved path — and, if you want, to
move the text along that path over time.

The text is rendered one of two ways — as **browser text** (a native SVG `<textPath>`, using
a font), or as **glyph text** (from embedded outlines, when the element also has
`effects.text.useGlyphs: true`). Not every field applies to both; the **Applies to** column
says which:

| Field | Type | Meaning | Applies to |
|---|---|---|---|
| `path` | path string | the path geometry (inline — no separate element needed) | browser text, glyphs |
| `startOffset` | number \| `Animated<number>` | where the text starts along the path ([SVG spec](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/startOffset)) | browser text, glyphs |
| `textLength` | number \| `Animated<number>` | stretch / squeeze the text to this length ([SVG spec](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/textLength)) | browser text, glyphs |
| `lengthAdjust` | `spacing` · `spacingAndGlyphs` | how `textLength` is reached: by changing the space between glyphs only, or by stretching the glyphs too ([SVG spec](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/lengthAdjust)) | browser text only |
| `method` | `align` · `stretch` | each glyph is rotated to sit on the path, or the glyphs themselves are bent to follow its curve ([SVG spec](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/method)) | browser text only |
| `spacing` | `auto` · `exact` | `exact` places glyphs strictly by the SVG layout rules; `auto` lets the renderer adjust the spacing to look better on curves ([SVG spec](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/spacing)) | browser text only |
| `pathOverflow` | `extend` (default) · `clip` | glyphs past the end of an open path continue along the tangent, or disappear | browser text, glyphs |

```js
{ "type": "text", "fill": "#111", "fontSize": 18,
  // Lay the text along the curve, and slide it 260 units along the path over 2 s
  "effects": { "textPath": {
    "path": "M20,100 Q150,20 280,100",
    "startOffset": { "keyframes": [ { "time": 0, "value": 0 }, { "time": 2000, "value": 260 } ] }
  } },
  "children": [ { "type": "tspan", "textContent": "animated text on a path" } ] }
```

## 3 — `fillGradient` / `strokeGradient`

Paints the element's fill (or its stroke) with a colour gradient, and lets the gradient's
colours and geometry animate. Under the hood it generates a `<linearGradient>` /
`<radialGradient>` element and points the `fill` (or `stroke`) at it. Both effects have the
same settings; the only difference is which of the two attributes is painted.

| Field | Type | Meaning |
|---|---|---|
| `type` | `linear` · `radial` | a gradient along a line from `p1` to `p2`, or one spreading out from a centre `c` |
| `p1` · `p2` | `[x, y]` \| `Animated<[x, y]>` | linear start / end |
| `c` · `r` · `fp` | `[x, y]` \| `Animated<[x, y]>` · number \| `Animated<number>` · `[x, y]` \| `Animated<[x, y]>` | radial centre, radius, focal point |
| `stops` | array of `{ offset, color }` \| `Animated<array of { offset, color }>` | **one** timeline: an animated `stops` has, per keyframe, the full stop list as its value (same count each time) |
| `gradientUnits` | `objectBoundingBox` · `userSpaceOnUse` | which coordinates `p1`, `p2`, `c`, `r`, `fp` are in: positions across the element's own box (`0` = its left / top edge, `1` = its right / bottom edge), or the drawing's own coordinates ([SVG spec](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/gradientUnits)) |
| `spreadMethod` | `pad` · `reflect` · `repeat` | what to paint beyond the last stop: extend the end colour, mirror the gradient back, or start it over ([SVG spec](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/spreadMethod)) |
| `gradientTransform` | string | static only ([SVG spec](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/gradientTransform)) |

```js
{ "type": "rect", "x": 0, "y": 0, "width": 200, "height": 120,
  // A horizontal gradient; its two colours cross-fade to new ones over one second
  "effects": { "fillGradient": {
    "type": "linear", "p1": [0, 0], "p2": [200, 0],
    "stops": { "keyframes": [
      { "time": 0,    "value": [ { "offset": 0, "color": "#3b82f6" }, { "offset": 1, "color": "#ec4899" } ] },
      { "time": 1000, "value": [ { "offset": 0, "color": "#10b981" }, { "offset": 1, "color": "#f59e0b" } ] }
    ] }
  } } }
```

Animated stop **colours** work everywhere; animated stop *offsets* and geometry need the frame
loop (`mode: auto` switches for you). CSS exports can animate stop colours only.

## 4 — `strokeTrim`

Shows only a window of the **stroke** along the path — a line that draws itself, or erases itself. Works
by generating `stroke-dasharray` / `stroke-dashoffset`; the path geometry and fill are
untouched (unlike Lottie's *trim paths*, which cut the shape itself).

| Field | Type | Meaning |
|---|---|---|
| `range` | `[start, end]` \| `Animated<[start, end]>` | which part of the stroke is visible, as two positions along the path: `0` is the start of the path, `1` its end — `[0, 0.5]` shows the first half |
| `offset` | number \| `Animated<number>` | slides that visible part along the path, as a share of its length: `0.25` moves it a quarter of the way |
| `subPaths` | `separate` (default) · `combined` | what those positions are measured against: each sub-path against its own length, or all sub-paths chained into one so the window slides across them (After Effects "Trim All As One") |

```js
{ "type": "path", "d": "M 30 360 C 130 290 230 420 330 350", "stroke": "#ef4444", "strokeWidth": 3, "fill": "none",
  // The stroke draws itself: the visible part grows from nothing to the full length in 2 s
  "effects": { "strokeTrim": { "range": { "keyframes": [ { "time": 0, "value": [0, 0] }, { "time": 2000, "value": [0, 1] } ] } } } }
```

On a group, the trim applies to every path inside it (`subPaths: "combined"` chains them).

## 5 — `repeater`

Repeats the element: the player creates `copies` real copies, each one shifted, rotated or
scaled a step further than the one before — like rubber-stamping a shape across the page.
If the element is animated, every copy carries the same animation.

| Field | Type | Meaning |
|---|---|---|
| `copies` | number | static — the count cannot animate |
| `translate` | `[x, y]` \| `Animated<[x, y]>` | per-copy step |
| `rotate` | number \| `Animated<number>` | per-copy degrees |
| `skew` | number \| `Animated<number>` | per-copy skewX degrees |
| `scale` | `[sx, sy]` \| `Animated<[sx, sy]>` | per-copy multiplier (`0.85` = each copy 85 % of the previous) |
| `origin` | `[x, y]` \| `Animated<[x, y]>` | pivot for the per-copy rotate / scale |

```js
{ "type": "rect", "x": 0, "y": 0, "width": 30, "height": 30, "fill": "#6366f1",
  "animate": { "opacity": { "keyframes": [ { "time": 0, "value": 1 }, { "time": 1000, "value": 0.2 } ] } },
  // Four copies, each 50 further right; the per-copy rotation step grows from 0° to 20°
  "effects": { "repeater": { "copies": 4, "translate": [50, 0], "rotate": { "keyframes": [ { "time": 0, "value": 0 }, { "time": 1000, "value": 20 } ] } } } }
```

## 6 — `maskedBy`

Shows this element only where another element is: that other element becomes the mask.
Under the hood the player builds a `<mask>` from it and applies it to this element.

| Field | Type | Meaning |
|---|---|---|
| `sourceId` | `"#id"` | the element that becomes the mask |
| `maskType` | `alpha` · `luminance` | how the source's pixels become mask values ([CSS spec](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/mask-type)) |
| `maskUnits` · `maskContentUnits` | `userSpaceOnUse` · `objectBoundingBox` | SVG's mask coordinate systems ([SVG spec](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/maskUnits), [maskContentUnits](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/maskContentUnits)) |
| `x` · `y` · `width` · `height` | numbers | the mask **viewport** in `maskUnits` space; omit all four for SVG's default (−10 %…120 % of the bounding box). `0` is a real value ([SVG `<mask>` spec](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/mask)) |

```js
// The element that will become the mask — a growing circle
{ "type": "defs", "children": [ { "type": "circle", "id": "spot", "cx": 100, "cy": 100, "r": 80, "fill": "#fff",
    "animate": { "r": { "keyframes": [ { "time": 0, "value": 20 }, { "time": 1000, "value": 120 } ] } } } ] },
// The element being masked
{ "type": "rect", "x": 0, "y": 0, "width": 200, "height": 200, "fill": "#ec4899",
  // Use the circle as this rect's mask: the rect shows only where the circle is
  "effects": { "maskedBy": { "sourceId": "#spot", "maskType": "alpha" } } }
```

## 7 — `clipPath`

Cuts the element down to a shape: only what falls inside the given path stays visible. The
shape can animate — the browser re-clips on every frame. Under the hood the player generates
a `<clipPath>` element and sets `clip-path` on this one.

| Field | Type | Meaning |
|---|---|---|
| `d` | path string \| `Animated<path string>` | static `"M…"`, or `{ "keyframes": [ { "time", "value": { "path": "M…" } } ] }` |

```js
// A clipping window that widens from a narrow strip to the full 200 × 200 square
"effects": { "clipPath": { "d": { "keyframes": [
  { "time": 0,    "value": { "path": "M0,0 L20,0 L20,200 L0,200 Z" } },
  { "time": 1000, "value": { "path": "M0,0 L200,0 L200,200 L0,200 Z" } }
] } } }
```

## 8 — `transformBy`

Wraps the element in transform groups so each part has its **own timeline**. Use it when
translate and rotate (say) must run at different times — a single `transform` attribute has one
timeline for all parts.

| Field | Type | Meaning |
|---|---|---|
| `translate` | `[x, y]` \| `Animated<[x, y]>` | how far to move along x and y — plain numbers in the drawing's coordinates |
| `rotate` | number \| `Animated<number>` | degrees |
| `skew` | number \| `Animated<number>` | skewX degrees |
| `scale` | `[sx, sy]` \| `Animated<[sx, sy]>` | multipliers: `1` = unchanged, `2` = double size, `0.5` = half |
| `origin` | `[x, y]` \| `Animated<[x, y]>` | pivot |

```js
// Two parts on their own timelines: move during the first half second, then spin during the next
"effects": { "transformBy": {
  "translate": { "keyframes": [ { "time": 0,   "value": [0, 0] },   { "time": 500,  "value": [200, 0] } ] },
  "rotate":    { "keyframes": [ { "time": 500, "value": 0 },        { "time": 1000, "value": 360 } ] }
} }
```

## 9 — `clone`

For `<use>` elements: says **what** the instance copies and, optionally, **when** its source's
animation runs relative to the document.

| Field | Type | Meaning |
|---|---|---|
| `sourceId` | `"#id"` | the source element / symbol (the `<use>` also keeps its normal `href`) |
| `type` | absent · `content` | absent = a direct copy of the whole element; `content` = copy the source's content but not its own outer position |
| `retime.start` | ms | shift the source's internal timeline |
| `retime.stretch` | a multiplier of duration | `2` = twice as long (half speed), `0.5` = half as long (double speed) |
| `retime.timeCrop` | `[inMs, outMs]` | show the instance only inside this window of the document timeline |

```js
// The source: a spinning-wheel symbol with its own one-second animation
{ "type": "defs", "children": [ { "type": "symbol", "id": "wheel", "viewBox": "0 0 100 100", "children": [
    { "type": "circle", "cx": 50, "cy": 50, "r": 40, "fill": "none", "stroke": "#0087ff", "stroke-width": 8, "stroke-dasharray": "40 20",
      "animate": { "rotate": { "keyframes": [ { "time": 0, "value": 0 }, { "time": 1000, "value": 360 } ] } } }
] } ] },
// An exact copy of the wheel
{ "type": "use", "href": "#wheel", "x": 0,   "y": 0, "effects": { "clone": { "sourceId": "#wheel" } } },
// A copy that starts 0.5 s later and spins at half speed
{ "type": "use", "href": "#wheel", "x": 120, "y": 0, "effects": { "clone": { "sourceId": "#wheel", "retime": { "start": 500, "stretch": 2 } } } },
// A copy shown only between 1 s and 2 s of the document timeline
{ "type": "use", "href": "#wheel", "x": 240, "y": 0, "effects": { "clone": { "sourceId": "#wheel", "retime": { "timeCrop": [1000, 2000] } } } }
```

Symbols with their own animation length are how the editor builds reusable animated components;
instances re-time them freely.

[← JSON format reference](./14-format--json-format.md) · [Contents](./README.md) · Next: [Editor meta and applied effects →](./16-format--editor-meta.md)
