# The editor

[← Choosing a format](./02-start--choosing-a-format.md) · [Contents](./README.md) · Next: [Set default playback settings & triggers →](./04-editor--playback-settings.md)

The Pixodesk SVG Animator editor is a desktop app for drawing and animating SVG. It saves the
result in the Pixodesk animation format — as **JSON**, or as a **pre-rendered SVG** — the files
every player in this documentation plays.

## Create content

**Draw it.** The editor is a full-featured SVG vector editor: it supports the same shapes,
paths, text, fills, strokes and gradients as SVG itself, and most of their attributes can be
animated.

**Or bring it in.**

- **SVG** from Illustrator, Figma, Inkscape or any other tool. **Open** it as SVG document of
  its own — the way to turn an existing SVG into a pre-rendered one — or **import** it into a
  document you already have, such as a Pixodesk JSON. Either way it arrives as static artwork,
  ready to animate.
- **Lottie** files are converted into the editor's own model. If something cannot be
  converted, a dialog lists exactly what was left out or changed before the file opens.

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
- **Independent transform parts** — translate, rotate, scale, skew and origin (anchor point) can each run on
  their own timeline instead of sharing one.

## Loops

There are two kinds of loop — the whole animation can repeat, and a single property can repeat
on its own — and you can use both at once: a property loop keeps running inside every repeat
of the whole animation.

**The document loops** by its *iterations* setting — the whole animation plays again, in the
same or alternating direction. That is the outer loop, and it is what a player's `iterations`
prop overrides.

**A single property can loop on its own**, inside the document: a segment of its keyframes
repeats — forward or ping-pong — to fill the document's duration. For example, one element's
rotation can keep repeating while everything else plays through once. These loops are saved
into the file and every player honours them.


## Effects

An attribute is a value the browser reads as-is. An **effect** is something that needs more
than one attribute to exist — copies, masks, clipping, a gradient, text laid along a path.
In the editor you add an effect to an element and adjust it like any other setting, and its
settings can be animated too. At playback the effect is **materialised** — turned into plain
animated SVG attributes — so the browser never sees anything but ordinary SVG. In a
pre-rendered file that happens at export; in JSON the player does it at load
([Player effects](./15-format--effects.md)).


## Set the playback defaults

Duration, iterations, direction, what starts the animation (load, click, hover, scroll into
view, or code), what happens when the trigger ends, and whether the timeline follows the clock
or the page's scroll position — all set once in the editor and saved with the file, so a
player needs no configuration to play it correctly.

Which control writes which value:
[Set default playback settings & triggers](./04-editor--playback-settings.md).

## Save, convert, export

**Save** writes the document in the file type you have chosen:

- **Pixodesk JSON** — the source format: the animation exactly as you authored it, with
  every effect still an effect and nothing expanded. Good to keep it as your master copy. It is also
  the format the players play: use it when the animation goes into an app, when you need to
  control playback from code, or when it uses features CSS cannot animate.
- **Pre-rendered SVG** — the finished result. Every effect is already expanded into plain
  SVG; the file still re-opens in the editor, which reconstructs the effects from the notes it
  saves alongside. Three flavours:
  - **SVG + CSS animation** — pure CSS, no JavaScript
  - **SVG + CSS animation + JS triggers** — plus a few inline lines of script for click and
    scroll triggers
  - **SVG + JS animation** — with the JS player embedded

  Anything the chosen flavour cannot animate is flagged on the timeline, in the file-type
  picker and in the toolbar's *App warnings* button while you work, and listed again in a
  notice when you save. A pre-rendered file is meant to be used **once per page**. To show
  the same animation several times, either export a separate file for each place — every
  export gets its own element ids, so the copies don't clash — or use JSON, where the player
  handles this for you ([read more](./11-player--prerendered-svg.md#one-copy-of-a-file-per-page)).

**Convert freely.** *Save as JSON* / *Save as SVG* switches between them at any time, in
either direction, so the choice is never final ([Choosing a format](./02-start--choosing-a-format.md)).

**Export a fallback** for places that cannot play SVG: **Lottie** (`.json` / `.lottie`),
**video**, **GIF** or a static **image**. Conversions that lose something show exactly what was
dropped or approximated before the file is written.

**Preview** plays the document as it will look outside the editor.

[← Choosing a format](./02-start--choosing-a-format.md) · [Contents](./README.md) · Next: [Set default playback settings & triggers →](./04-editor--playback-settings.md)
