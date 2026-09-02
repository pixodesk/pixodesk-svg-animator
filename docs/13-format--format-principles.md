# Format principles

[← Static sites & CMS](./12-player--static-sites-and-cms.md) · [Contents](./README.md) · Next: [JSON format reference →](./14-format--json-format.md)

Read this if you write animation files by hand, need to read one to diagnose a problem, or
are simply curious *why* the format looks the way it does.

## Plain SVG, with layers on top

Start from what already exists: **SVG**, the standard format for vector graphics on the web —
every browser draws it. What SVG does not give us is a good way to describe *animation*: how
those shapes move, change colour, morph over time. The Pixodesk format does not replace SVG
to get there. It **keeps SVG as its base and adds what is missing on top, one addition at a
time** — first typed values, then animation, then effects, then the editor's own data. Each
addition is called a **layer**: plain SVG is layer zero (L0), and every layer above it adds
exactly **one idea** and uses only the layers beneath it.

Two rules hold the stack together.

**Rule 1 — the layers don't mix.** Each layer keeps its data in its own place: animation
always under `animate`, effects under `effects`, editor data under `meta`. So a program
reading the file can take the parts it understands and simply skip the rest.

**Rule 2 — higher layers get translated down into simpler ones, never the other way.** In
the end, a browser can only draw plain SVG. So everything a higher layer describes is, at
some point, converted into the simpler layers below it. This happens at three moments:

- when the **editor saves** a file, it converts its editor-only constructs (L4 — for example
  a star shape preset) into the plain layers below (a path, and its animation);
- when the **player loads** a JSON file, it converts the effects (L3) into plain elements,
  attributes and animation (L0–L2);
- when the **editor exports a pre-rendered SVG**, it converts everything into plain SVG plus
  CSS (L0).

Whichever of these three conversions runs, its output is always written in the simple layers
only.

| Layer | Where its data lives | What it adds | Who reads it |
|---|---|---|---|
| **L0 — plain SVG** | the element object itself: `{type, ...attributes, children}` | the drawing — elements and their SVG attributes, exactly as in any SVG; values are plain strings | the browser |
| **L1 — typed values** | the same SVG attributes as L0 — the layer changes their values, not their place | values become typed instead of strings: numbers (`opacity: 0.5`), arrays (`translate: [96.8, 46.8]`), objects (`transform: { translate, rotate, scale }`). Units are never written — each property has one fixed, implied unit. A value written this way is exactly what a keyframe of L2 holds | the player |
| **L2 — animated attributes** | `node.animate`, one entry per animated attribute name | keyframes for any attribute; the element itself and its place in the tree are untouched — delete every `animate` key and a valid static SVG remains | the player |
| **L3 — player effects** | `node.effects` | effects — short descriptions of masks, gradients, copies and other effects ([see more](./15-format--effects.md)), which the player expands into plain elements and attributes when the file loads | the player |
| **L4 — editor meta** | `node.meta` | everything only the editor needs — labels, shape presets, the sources of applied effects; the player ignores this key entirely — [Editor meta and applied effects](./16-format--editor-meta.md) | the editor |
| **L5 — pre-rendered SVG** | unlike the layers above, this one is not a part of the JSON document — it is a separate `.svg` file the editor produces on export | the same document, converted into an ordinary SVG file: the animation travels as CSS or a script inside it, and the editor data as `data-px-meta` attributes — [Meta in pre-rendered SVG](./17-format--data-px-meta.md) | depends on the flavour: a CSS-animation file is played by the browser alone; a JS-animation file is played by the player embedded in it |

[← Static sites & CMS](./12-player--static-sites-and-cms.md) · [Contents](./README.md) · Next: [JSON format reference →](./14-format--json-format.md)
