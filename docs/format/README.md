# Format documentation — the JSON format

The **JSON** animation document: what's in it, how animation is expressed, and the library
that validates and transforms it. (The other shape an animation takes — a finished `.svg`
file — has its own documentation: [Pre-rendered SVG](../prerendered-svg/README.md).)

## Contents

1. [Format principles](./principles.md) — why the format is shaped this way: plain SVG at the base, with the missing pieces added as layers on top
2. [JSON format reference](./json-format.md) — the document, `animator`, nodes, `animate`, keyframes, easing, loops, transforms, motion paths — including the flattened schema at a glance
3. [Player effects](./effects.md) — `transformBy`, `repeater`, `maskedBy`, `clipPath`, `strokeTrim`, `clone`, gradients, `textPath`, `text`
4. [Editor meta and applied effects](./editor-meta.md) — what the editor keeps in `meta`, applied effects vs effects, how an expanded effect folds back
5. [Core library (`@pixodesk/svg-animator-core`)](./core-library.md) — validate, transform and sample documents without a renderer

## See also

- [SCHEMA.md](../../SCHEMA.md) — the compact, printable schema with examples
- [Library documentation](../library/README.md) — the players that render these documents
- [Documentation home](../README.md)
