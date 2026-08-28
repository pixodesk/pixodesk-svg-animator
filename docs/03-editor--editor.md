# The editor

[← Choosing a format](./02-start--choosing-a-format.md) · [Contents](./README.md) · Next: [Set default playback settings & triggers →](./04-editor--playback-settings.md)

The Pixodesk editor — the *Pixodesk Animator Studio* desktop app — is a vector and animation
editor for SVG. This page is what it can do, not where the buttons are: enough to know whether
a thing is possible before you go looking for it.

## Create content

**Draw it.** Rectangles, ellipses, pen and freehand paths, text. Fills and strokes take solid
colours or linear / radial gradients.

**Or use a shape preset.** Stars, polygons, spirals, arcs, waves, arrows, cogs and more are
*parametric*: you edit a radius or a point count, not individual vertices. Every parameter can
be animated — a star can grow points, an arc can sweep open — and a preset stays editable
after you save.

**Round any corner**, per vertex, with a radius that can animate too.

**Or bring it in.**

- **SVG** from Illustrator, Figma, Inkscape or any other tool. **Open** it as a document of
  its own — the way to turn an existing SVG into a pre-rendered one — or **import** it into a
  document you already have, such as a Pixodesk JSON. Either way it arrives as static artwork,
  ready to animate.
- **Lottie** files are converted into the editor's own model. Anything Lottie expresses that
  the editor cannot is listed, so you know what changed.

## Animate

Any property of any element can carry **keyframes**: position, size, colour, opacity, stroke,
transform, a path's geometry, a preset's parameters, an effect's settings. Move the playhead,
change the value, and the editor records a keyframe — either for the properties you have
switched a *watch* on, or for everything at once with *auto-animate* pinned. Values are
interpolated between keyframes, with **easing** per keyframe.

On top of plain keyframes:

- **Motion along a path** — translate keyframes can carry curved tangents, and *auto-orient*
  turns the element to face the direction of travel.
- **Path morphing** — animate a path's `d` between shapes with the same structure.
- **Independent transform parts** — translate, rotate, scale, skew and origin can each run on
  their own timeline instead of sharing one.

## Loops

Two kinds, and they compose.

**The document loops** by its *iterations* setting — the whole animation plays again, in the
same or alternating direction. That is the outer loop, and it is what a player's `iterations`
prop overrides.

**A single property can loop on its own**, inside the document: repeat a segment of its
keyframes — forward or ping-pong — to fill the document's duration, before its first keyframe
or after its last. A wheel keeps spinning while everything else runs once; an intro plays and
the last two keyframes then idle until the end. These inner loops are saved into the file and
every player honours them.

**Reusable animated components.** Wrap animated content in a **symbol** and place it as many
times as you like. Each instance can *retime* the symbol — start it later, run it faster or
slower, or show it only inside a window of the timeline — so one animated component gives you
a staggered crowd.

## Effects

An attribute is a value the browser reads as-is. An **effect** is something that needs more
than one attribute to exist — copies, masks, clipping, a gradient, text laid along a path.
The editor treats each effect as a first-class thing with its own animatable settings; at
playback it is **materialised** into plain animated SVG attributes, so the browser never sees
anything but ordinary SVG. In a pre-rendered file that happens at export; in JSON the player
does it at load ([Effects reference](./15-format--effects.md)).

| Effect | What it does |
|---|---|
| **Repeater** | N copies of an element, each stepped by a translation, rotation, scale, skew and origin — all animatable |
| **Trim stroke** | Draw-on / draw-off along a stroke; offset and range animatable; trim each sub-path separately or all as one |
| **Mask** | Mask an element by another (alpha or luminance) |
| **Clip path** | Clip to a path whose geometry can itself animate |
| **Gradient fill / stroke** | Linear / radial gradients with animatable stops and geometry |
| **Text on path** | Lay text along a path; animate its start offset |
| **Glyph text** | Render text from embedded outlines so no font is needed at playback |
| **Symbols & instances** | Reuse a symbol; each instance retimes it (see Loops) |
| **Independent transform parts** | Separate timelines for translate, rotate, scale, skew and origin (see Animate) |

## Set the playback defaults

Duration, iterations, direction, what starts the animation (load, click, hover, scroll into
view, or code), what happens when the trigger ends, and whether the timeline follows the clock
or the page's scroll position — all set once in the editor and saved with the file, so a
player needs no configuration to play it correctly.

Which control writes which value:
[Set default playback settings & triggers](./04-editor--playback-settings.md).

## Save, convert, export

**Save** writes the document in the file type you have chosen:

- **Pixodesk JSON** — the source format. Everything survives; the best format to keep editing.
- **Pre-rendered SVG**, in one of three flavours — CSS animation, CSS + JS triggers, or with
  the JS player embedded. Anything the chosen flavour cannot animate is flagged on the
  timeline and in the file-type picker *before* you save. A pre-rendered file is meant to be
  used **once per page**; for several instances export once per instance, or use JSON
  ([why](./11-player--prerendered-svg.md#one-copy-of-a-file-per-page)).

**Convert freely.** *Save as JSON* / *Save as SVG* switches between them at any time, in
either direction, so the choice is never final ([Choosing a format](./02-start--choosing-a-format.md)).

**Export a fallback** for places that cannot play SVG: **Lottie** (`.json` / `.lottie`),
**video**, **GIF** or a still **image**. Conversions that lose something show exactly what was
dropped or approximated before the file is written.

**Preview** plays the document as it will look outside the editor.

[← Choosing a format](./02-start--choosing-a-format.md) · [Contents](./README.md) · Next: [Set default playback settings & triggers →](./04-editor--playback-settings.md)
