# The editor

[← Choosing a format](./03-start--choosing-a-format.md) · [Contents](./README.md) · Next: [Installing the players →](./05-player--installation.md)

The Pixodesk editor is a vector and animation editor for SVG. It runs in the browser at
[pixodesk.com](https://pixodesk.com) and as the *Pixodesk Animator Studio* desktop app. This
page is a tour of what you can do in it, in the order you will meet things; it is not a
button-by-button manual.

## The welcome screen

- **New → Document** — canvas size and playback basics (duration, frame rate), plus the
  **file type**: Pixodesk JSON, one of the three pre-rendered SVG flavours, or Lottie
  (JSON / `.lottie`). The type can be changed later from the right panel or the File menu.
- **Open / Drop file** — open an existing `.json`, `.svg` or Lottie file, or drag one onto the
  window. Plain SVG files from any tool open as static artwork ready to animate; Lottie files
  are converted (with a list of anything that could not be represented).
- **Recent documents** and **Help & Learning** links.

## The workspace

| Area | What it does |
|---|---|
| **Canvas** | Draw, select, move, scale and rotate elements; drag the control points of shape presets and effects |
| **Toolbar** | Selection, shapes (rectangle, ellipse, path/pen, text) and the **shape presets** |
| **Element tree** | The SVG structure — groups, symbols, defs; reorder and nest by dragging |
| **Timeline** | One row per animated property, keyframes as diamonds, the playhead, easing per keyframe, loop controls |
| **Right panel** | Every property of the selected element, grouped in sections (Fill, Stroke, Transform, Corners, Repeater, Text, …) plus the document's file and playback settings |

## Creating content

**Basic shapes and paths** — rectangle, ellipse, freehand and pen paths, text. Fill and stroke
accept solid colours or gradients (linear / radial, editable on-canvas).

**Shape presets** — parametric shapes you edit with handles rather than points: *star*,
*polygon*, *spiral*, and (as experimental features) *arc / pie / ring*, *wave*, *arrow*,
*heart*, *cross*, *frame*, *cog*, *crescent*, *tear*, *eye*, *trapezoid*. Every parameter
(radius, roundness, sweep, thickness…) can be **animated**, so a star can gain points-of-a-star
roundness over time or an arc can sweep open. Presets stay editable after you save to JSON.

**Round corners** — round any vertex of any path or preset, per corner, with an animatable
radius. The *Corners* section appears in the right panel when a shape has rounded corners.

**Import** — SVG files from Illustrator, Figma, Inkscape and the like; Lottie animations.

## Animating

1. Select an element and move the **playhead** on the timeline.
2. Change a property — drag on the canvas, or type in the right panel. The editor records a
   **keyframe** on that property's row (a *watch* button next to each property toggles whether
   changes create keyframes).
3. Move the playhead, change the value again. Between keyframes the value is interpolated.

Other things to know:

- **Easing** — per keyframe, from a dropdown on the timeline (cubic-bezier presets or custom).
- **Loops** — a property can repeat a segment of its keyframes to fill the whole document
  duration, forward or ping-pong, independently of the document's own iteration count.
- **Motion along a path** — translate keyframes can carry curved tangents (edit them on the
  canvas); *auto-orient* turns the element to follow the curve.
- **Path morphing** — animate the `d` of a path between shapes with the same structure.
- **Copy / paste keyframes**, select ranges, stretch and move groups of keyframes.
- Time is shown in frames in the UI (10 ms per frame by default) and saved as milliseconds.

## Effects

Effects add structure the browser cannot express as a single attribute. They live in the
right panel and, in the JSON format, travel as declarative `effects` the player expands at
load ([Effects reference](./15-format--effects.md)):

| Effect | What it does |
|---|---|
| **Repeater** | N copies of an element, each stepped by a translation, rotation, scale, skew and origin — all animatable |
| **Trim Stroke** | Draw-on / draw-off along a stroke; offset and range animatable; trim each sub-path separately or all as one |
| **Mask** | Mask an element by another (alpha or luminance), with an optional viewport |
| **Clip path** | Clip to a path whose geometry can itself animate |
| **Gradient fill / stroke** | Linear / radial gradients with animatable stops and geometry |
| **Text on path** | Lay text along a path; animate its start offset |
| **Glyph text** | Render text from embedded glyph outlines so no font is needed at playback |
| **Symbols & instances** (`<use>`) | Reuse a symbol many times; each instance can *retime* the symbol's animation (start offset, speed) and be cropped to a time window |
| **Per-part transforms** | Give translate, rotate, scale, skew and origin independent timings on one element |

## Playback settings and triggers

In the right panel with nothing selected (the document's own settings):

- **Duration**, **iterations** (a number or infinite), **direction** (normal, reverse,
  alternate), **fill** (hold the last frame or reset), **frame rate**.
- **Engine mode** — *auto* (Web Animations API with automatic frame-loop fallback), *WAAPI*
  only, or *frames* only. Leave it on auto unless you have a reason.
- **Start** — *On load*, *When visible (e.g. on scroll into view)* with a visibility
  **threshold**, *On mouse over*, *On click*, or *Manually from JS*; and what happens when the
  trigger ends (continue, pause, reset); **Reset on finish**.
- **Timeline** — *time* (the clock) or **scroll**: the animation follows the page's scroll
  position instead of playing on its own (scroll-driven playback, with pinning and range
  options).

All of these are explained, with the values they write into the file, in
[Playback settings & triggers](./12-player--playback-and-triggers.md). The players can override every
one of them at runtime.

## Exporting

**File type** (right panel *File* section, or the File menu) decides what **Save** writes:

- **Pixodesk JSON** — the document for the players; also the best format to keep editing.
- **SVG + CSS animation** — self-contained, no JavaScript. Properties the CSS engine cannot
  animate are flagged with a warning icon on their timeline row and in the file-type picker.
- **SVG + CSS animation + JS triggers** — adds a small inline script for hover / click / scroll
  triggers.
- **SVG + JS animation** — embeds the web player. Options: *Embed JS player* (inline it, or
  reference the library externally), *Unoptimised JS* (readable instead of minified), and the
  engine mode. The panel shows how many kilobytes the player adds to the file.

**Save as JSON / Save as SVG** converts between the two at any time. **Preview** opens the
current document as it will play outside the editor.

**Export** (File → Export) writes other formats: **Lottie** (`.json` or `.lottie`), **video**,
**GIF** and a still **image**. Conversions that lose something show a warning list before you
save, so you know exactly which feature was dropped or approximated.

## Tips

- Keep animated elements at the origin and position them with a parent group when you rotate
  or scale — the pivot then behaves as you expect in every export format.
- Prefer the JSON format for archival; you can always re-export any SVG flavour from it.
- Use the file-type picker's warnings as a checklist before shipping a CSS-flavour SVG.

[← Choosing a format](./03-start--choosing-a-format.md) · [Contents](./README.md) · Next: [Installing the players →](./05-player--installation.md)
