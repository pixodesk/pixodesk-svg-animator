# Pixodesk SVG Animator player


This documentation is about the **Pixodesk SVG Animator player** and its flavours, the **format**
it plays, and — briefly — the **editor** you use to create animation files in that format.

#### The player

Runs the animation on a page or in an app. Pick the flavour for where it runs: a player
library for plain **HTML**, **React**, **Vue** or **React Native** (in development), or none
at all — a pre-rendered SVG file plays on its own. Control playback from code, or let the
animation start itself on load, click, hover or scroll.

#### The format

Stays as close to plain SVG as it can, with a wide vector feature set. One animation, two
shapes:

- **JSON** — the source. A player library renders it, and you control it from code.
- **Pre-rendered SVG** — a finished `.svg` you embed or inline straight into a page. Three
  flavours:
  - **SVG + CSS animation** — pure **CSS keyframes**, for a file that needs **no JavaScript**
  - **SVG + CSS animation + JS triggers** — the same plus a small script for click and scroll
    triggers
  - **SVG + JS animation** — embedded **JavaScript** running the player on the engine you
    choose, **WAAPI** or **frames**

  One rule: a pre-rendered file goes on a page **once**; for several instances of one
  animation, use JSON.

#### The editor

The **Pixodesk SVG Animator editor** — a full-featured vector and animation tool — creates the
files in either shape, and sets their playback defaults (duration, loops, what starts it).
It also imports and exports **Lottie**, and exports video, GIF and static images as a
fallback. The editor has its own documentation; here it appears only where it decides what
ends up in the file.

## The three documentations

- **[Library documentation](./library/README.md)** — the players: web, React, Vue, React Native; installation, APIs, playback settings & triggers
- **[Format documentation](./format/README.md)** — the JSON document: reference, effects, editor meta, the core library ([compact printable schema](../SCHEMA.md))
- **[Pre-rendered SVG documentation](./prerendered-svg/README.md)** — the self-contained `.svg` flavours: embedding, static sites & CMS, `data-px-meta`

## Get started

1. [Introduction](./start/introduction.md) — the editor, the file formats, the players, and how they fit together
2. [Choosing a format](./start/choosing-a-format.md) — JSON vs pre-rendered SVG, what each can animate, browser support
3. [The editor](./start/editor.md) — creating shapes, animating, effects, exporting
4. [Set default playback settings & triggers](./start/editor-playback-settings.md) — duration, loops, direction, engine mode, what starts it, clock or scroll — saved with the file

## Get help

- [Troubleshooting & FAQ](./library/troubleshooting.md)

## Go further

- [Repository README](../README.md) — package overview and examples
- [Runnable examples](../examples/docs-examples/) — one tested page per documented case (web, React, Vue, pre-rendered SVG, static sites); plus a [preview player](../examples/preview-player/) and the [React Native](../examples/react-native-preview-player/) apps
- [pixodesk.com](https://pixodesk.com) — Pixodesk SVG Animator editor
