# Glossary

[← Troubleshooting](./19-help--troubleshooting.md) · [Contents](./README.md)

Look up a term you met anywhere in these docs. Where a term has a JSON key or a TypeScript
type, the entry names it, so you can go straight from the word to the file.

| Term | Meaning |
|---|---|
| **Document** | A JSON animation file: the SVG tree plus its animation, root `type: "svg"`. The type is `PxAnimatedSvgDocument` |
| **Node** | One element of the tree — `{ type, …attributes, children }` |
| **`animate` channel** | The per-node map *attribute name → property animation*. The static attribute stays on the node; the keyframes sit beside it |
| **Property animation** | `{ keyframes, loop?, autoOrient? }` — one attribute's timeline |
| **Keyframe** | `{ time, value, easing?, tangentIn?, tangentOut? }` — the value at a moment (ms) |
| **Easing** | A cubic-bezier `[x1, y1, x2, y2]` for the interval leaving a keyframe, or a name from `definitions.easings` |
| **Loop** | A per-property repeat of a segment of its keyframes to fill the document duration (`extend: before/after`, `alternate`) — independent of `iterations` |
| **`animator`** | The document's playback settings: duration, delay, iterations, direction, fill, engine mode, triggers, scroll timeline, definitions, and — for pre-rendered SVG — the `animateById` bindings |
| **Iterations** | How many times the *whole* document timeline repeats (`"infinite"` allowed) |
| **Trigger** | What starts the animation: `load`, `scrollIntoView`, `mouseOver`, `click`, `programmatic`; `outAction` says what happens when the trigger ends |
| **Engine** | How the web player drives frames: the **Web Animations API** (`waapi`) or a **frame loop** (`frames`); `auto` picks WAAPI with automatic fallback |
| **Timeline source** | What advances the playhead: the clock (`time`) or the page's scroll position (`scroll` — in development) |
| **Effect** | A declarative instruction on `node.effects` the player expands into structure at load — `transformBy`, `repeater`, `maskedBy`, `clipPath`, `strokeTrim`, `clone`, `fillGradient`, `strokeGradient`, `textPath`, `text` |
| **Materialise** | Expand effects (and loops, motion paths, animated `<use>`) into a flat tree a renderer can draw. Done by the player at load, or by the editor at export |
| **Definitions** | `animator.definitions` — named, reusable easings, animations, styles and embedded glyph outlines |
| **Glyph mode** | Rendering a `<text>` from embedded outlines (`effects.text.useGlyphs`) so no font is needed at playback |
| **Motion along a path** | Translate keyframes carrying Bézier tangents; `autoOrient` turns the element to face the direction of travel |
| **Path morphing** | Animating a path's `d` between shapes with the same command structure |
| **Shape preset** | A ready-made editor shape (`star`, `polygon`, `spiral`, `arc`, `wave`, `arrow`, `heart`, …) described by a few settings, and those settings can animate; materialised to a path for playback and kept in `meta` for editing |
| **Symbol / instance** | An SVG `<symbol>` with its own animation, placed with `<use>`; the `clone` effect re-times each instance |
| **Retime** | Shifting (`start`) or stretching (`stretch`) a symbol's internal timeline for one instance; `timeCrop` limits when the instance is visible |
| **Self-contained vs bind-by-id document** | The two kinds of JSON document: a **self-contained** one carries its elements in `children` and the player builds the SVG from it; a **bind-by-id** one has no `children` and animates an SVG already on the page, matching elements by id (`animator.animateById`) — [read more](./14-format--json-format.md#animating-a-pre-rendered-svg) |
| **Pre-rendered SVG** | A normal `.svg` with the animation embedded: CSS `@keyframes`, optionally a trigger script, or the whole player |
| **Flavour** | One of the three pre-rendered SVG exports: *SVG + CSS animation*, *SVG + CSS animation + JS triggers*, *SVG + JS animation* — [which to pick](./11-player--prerendered-svg.md#which-flavour) |
| **Expanded parts (host / core / part)** | How a pre-rendered file records an effect that was written as several elements: the **host** carries the effects (`meta.effectsHost`), the **core** is the element itself, every **part** points back (`meta.partOf`) — [Editor meta → derived elements (host / core / part)](./16-format--editor-meta.md#applied-effects-that-create-derived-elements-host--core--part) |
| **`data-px-meta`** | The attribute a pre-rendered SVG uses to carry editor metadata per element, so the editor can re-open the file with its effects intact — [Meta in pre-rendered SVG](./17-format--data-px-meta.md) |
| **`meta`** | Editor-only data on a node (labels, shape presets, applied effects). Players ignore it — [Editor meta and applied effects](./16-format--editor-meta.md) |
| **Core** | `@pixodesk/svg-animator-core` — schema, materialisers, interpolation, sampling; no DOM; shared by every player |
| **UMD build** | The single-file player for a `<script>` tag, exposing the `PixodeskAnimator` global |
| **SVGR / `vite-svg-loader`** | Build tools that import an `.svg` as a React / Vue component — the way to use a CSS-flavour SVG like an icon |

[← Troubleshooting](./19-help--troubleshooting.md) · [Contents](./README.md)
