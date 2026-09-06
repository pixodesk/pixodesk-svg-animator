# Set default playback settings & triggers

[← The editor](./editor.md) · [Contents](../../README.md) · Next: [Installing the players (overview) →](../library/installation.md)

Set *how long*, *how many times* and *what starts it* once, in the editor, and forget about
it: the settings travel inside the file, every player reads them, and the animation plays
correctly with no configuration on the page.

This page is the **editor** side: which control writes which value. To change any of it at
runtime, from component props or the player API, see
[Playback settings & triggers](../library/playback-and-triggers.md).

These are settings of the whole document, not of an element, so the panel shows them when
**nothing is selected** — deselect everything (click an empty part of the canvas), or select
the root `<svg>` element. Everything here is written into the document's `animator` block on
save.

## Timing

| Control | Writes | Notes |
|---|---|---|
| **Duration** | `timeline.duration` (ms) | the length of **one** iteration; keyframe times are offsets within it |
| **Delay** | `timeline.delay` (ms) | wait before the first iteration starts |
| **Iterations** | `timeline.iterations` | a number, or “infinite” |
| **Direction** | `timeline.direction` | “normal”, “reverse”, “alternate” (ping-pong), “alternate-reverse” |
| **Fill mode** | `timeline.fill` | what shows outside the active time — “forwards” holds the last frame, “backwards” shows the first frame during the delay, “both”, or “none” to revert to the static SVG |
| ***Reset on finish*** | `timeline.trigger.onFinish: "reset"` | snap back to the start after a natural finish |
| **Frame rate** | `frameRate` | a target rate for the frame-loop engine only; leave it unset to run uncapped |

## Engine mode

**Engine mode** writes `mode`, and decides what actually drives the animation in a browser:

- **Auto** (default) — the Web Animations API, falling back to a frame loop by itself when the
  document animates something WAAPI cannot express.
- **WAAPI** — Web Animations API only.
- **Frames** — a `requestAnimationFrame` loop; universal browser support, honours *frame rate*.

Leave it on **auto** unless you need a guarantee. React Native ignores it — playback there is
always native-driven.

## Start trigger

**Start** writes `timeline.trigger.startOn` — what makes the animation begin:

| Editor label | Writes | Begins when |
|---|---|---|
| “On load” | `load` | the animation is displayed (default) |
| “When visible” | `scrollIntoView` | it scrolls into view; the **threshold** writes `scrollIntoViewThreshold` — how much of it must be on screen first, from `0` (any part) to `1` (all of it) |
| “On mouse over” | `mouseOver` | the pointer enters it |
| “On click” | `click` | it is clicked |
| “Manually from JS” | `programmatic` | never on its own — code calls `play()` |

**When the trigger ends** (pointer leaves, scrolled out of view, a second click) writes
`timeline.trigger.outAction`: “continue”, “pause”, “reset” or “reverse”.

**Use JS Triggers** only matters for the pre-rendered *SVG + CSS animation* export, and decides
how the trigger is implemented in that file:

- With **Use JS Triggers** switched **off**, the file contains no script at all. “On load” works, and
  “On mouse over” works through CSS `:hover`. “On click” and “When visible” (start when
  scrolled into view) cannot be done in pure CSS, so the export **falls back to “On load”**
  for them.
- With **Use JS Triggers** switched **on**, the export adds a few lines of inline script (no library),
  and the file behaves exactly as this panel says: whichever **Start** trigger you chose, the
  action **when the trigger ends**, and **Reset on finish** all work.

The JSON format and the *SVG + JS animation* export always honour the full setting, whatever
*Use JS Triggers* says.

## Timeline — clock or scroll

**Timeline** chooses what the playhead follows — it writes `timeline.type`:

- **Time** (default) — the clock. The animation plays on its own once triggered.
- **Scroll** *(in development)* — the page's scroll position drives the playhead: scrolling
  down plays the animation forward, scrolling back up rewinds it, and it stays at whatever
  frame you stop on. Pinning and range options choose which part of the page's scroll maps to
  the animation. The “Scroll” option is still in development: expect gaps and changes.

## Which export formats keep the playback settings and triggers

Not every export can carry every setting from this page. What each one keeps:

| Export | Kept in the file |
|---|---|
| **Pixodesk JSON** | everything |
| **SVG + CSS animation** | timing; “On load”, and “On mouse over” via CSS `:hover`. “On click” / “When visible” fall back to “On load”; **Reset on finish** is not applied |
| **SVG + CSS + JS triggers** | timing, every trigger, the out action and **Reset on finish** — through a few inline lines of script (added by the editor app), no library |
| **SVG + JS animation** | everything |

[Choosing a format](./choosing-a-format.md) has the full comparison.

---

[← The editor](./editor.md) · [Contents](../../README.md) · Next: [Installing the players (overview) →](../library/installation.md)
