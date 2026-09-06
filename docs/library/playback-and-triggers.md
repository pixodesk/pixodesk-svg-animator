# Playback settings & triggers

[← React Native](./react-native.md) · [Contents](../../README.md#documentation) · Next: [Pre-rendered SVG on the web →](https://pixodesk.com/docs/svga/prerendered-svg/on-the-web)

Change how an animation plays — its length, loops, direction, what starts it — without going
back to the editor. Everything about *when* and *how* it plays lives in one place, the
document's `animator` block, and every player lets you **override it at runtime** from
component props or the player API. This page is the reference for those fields and the
overrides.

The editor writes the same block from its playback panel; if you only want to set the
defaults there, see
[Set default playback settings & triggers](https://pixodesk.com/docs/svga/editor/playback-settings).

A document with its `animator` block. (The comments are explanatory; JSON does not allow
comments, so a real file has none.)

```js
{
  "type": "svg",
  "viewBox": "0 0 400 400",

  // Everything about WHEN and HOW the animation plays lives here
  "animator": {
    "timeline": {
      "type": "clock",
      "duration": 2000,
      "iterations": "infinite",
      "direction": "alternate",
      "trigger": { "startOn": "scrollIntoView", "outAction": "pause", "scrollIntoViewThreshold": 0.5 }
    }
  },
  "children": [
    {
      "type": "circle",
      "id": "ball",
      "cx": 0, "cy": 0, "r": 40, "fill": "#0087ff",
      "animate": {
        "translate": {
          "keyframes": [
            { "time": 0,    "value": [200, 60],  "easing": [0.33, 0, 0.67, 0.33] },
            { "time": 2000, "value": [200, 340] }
          ]
        }
      }
    }
  ]
}
```

The same bouncing ball as in the [web player](./web-player.md#declarative--data-px-animation-src),
now two seconds per bounce and waiting until half of it has scrolled into view.

## The `timeline` — what advances the playhead

`animator.timeline` says what *drives* the animation's progress, exactly like a Web Animations
API timeline. Its `type` picks one of three, mirroring WAAPI's `DocumentTimeline` /
`ScrollTimeline` / `ViewTimeline`:

| `timeline.type` | The playhead follows… |
|---|---|
| `clock` (default) | wall time — something *starts* it (the `trigger`), and it has the playback dynamics below |
| `scroll` | a scroll container's offset — [Scroll-driven playback](#scroll-driven-playback-in-development) |
| `view` | the SVG's journey through the viewport — [Scroll-driven playback](#scroll-driven-playback-in-development) |

Each type carries only the fields that mean something for it — a scrubbed timeline has no
`trigger` or `delay`, and the format gives them no slot there. Omitting `timeline` entirely
means a plain clock.

## Timing

The engine settings stay on `animator` itself; timing and the playback dynamics live in
the timeline:

| Field | Values | Default | Meaning |
|---|---|---|---|
| `timeline.duration` | ms | `1000` | length of **one** pass of the timeline. Keyframe times are absolute offsets within it |
| `frameRate` | fps | uncapped | target rate for the frame-loop engine only |
| `mode` | `auto` · `waapi` · `frames` | `auto` | the engine — [Engine mode](#engine-mode) |
| `timeline.delay` | ms | `0` | wait this long, then start. A **negative** value skips ahead instead: `-500` starts right away from the frame at 0.5 s, as if the animation had already been running for half a second |
| `timeline.iterations` | number · `"infinite"` | `1` | how many times the whole document timeline repeats |
| `timeline.direction` | `normal` · `reverse` · `alternate` · `alternate-reverse` | `normal` | `alternate` ping-pongs on every other iteration |
| `timeline.fill` | `forwards` · `backwards` · `both` · `none` | `forwards` | what is shown *outside* the active time: `forwards` holds the last frame after the end; `backwards` shows the first frame during the delay; `none` reverts to the static SVG |
| `timeline.trigger.onFinish` | `hold` · `reset` | `hold` | after a natural finish: keep the end state (per `fill`), or snap back to the start |

**Per-property loops vs `iterations`.** There are two kinds of repetition, and they work at
different levels. `iterations` repeats the **whole document** — every element, from the first
keyframe to the last. A single property can also `loop` on its own: a segment of *its own*
keyframes repeats until it fills the document's duration, while everything else plays through
once (see [JSON format → Per-property loops](../format/README.md#per-property-loops)). The property loop is
applied first, when the document is prepared; `iterations` then repeats the result. So both
can be used at once, and one runs inside the other: a wheel whose rotation loops, inside a
document set to infinite iterations, keeps spinning during every iteration.

## Engine mode

| Mode | What runs the animation |
|---|---|
| `auto` (default) | the Web Animations API — played by the browser itself, so it stays smooth even while the page is busy — with an **automatic fallback** to the frame loop when the document animates something WAAPI cannot express (path morphing, gradient geometry, filters, text on a path, …) |
| `waapi` | Web Animations API only |
| `frames` | a `requestAnimationFrame` loop that writes attributes every frame; honours `frameRate`; universal browser support |

Leave it on `auto` unless you need a guarantee — for instance `frames` for path morphing in
Safari < 18.5. React Native ignores `mode` (playback is always native-driven).

## Triggers — what *starts* the animation

The `trigger` block — inside the clock timeline — says what starts the animation and what
happens when that condition ends. The editor writes it from its **Start** setting; every
player honours it:

```json
"timeline": { "type": "clock", "trigger": { "startOn": "mouseOver", "outAction": "reset" } }
```

| `startOn` | Starts when… | Editor label |
|---|---|---|
| `load` (default) | the animation is displayed | *On load* |
| `scrollIntoView` | the element becomes visible; `scrollIntoViewThreshold` says how much of it must be on screen first: `0` (default) any part, `0.5` half of it, `1` all of it | *When visible* |
| `mouseOver` | the pointer enters the element | *On mouse over* |
| `click` | the element is clicked (a second click applies `outAction`) | *On click* |
| `programmatic` | never by itself — you call `play()` | *Manually from JS* |

`outAction` says what happens when the trigger condition ends (pointer leaves, scrolled out,
second click):

| `outAction` | Effect |
|---|---|
| `continue` (default) | keep playing |
| `pause` | pause where it is; the next trigger resumes |
| `reset` | jump back to the start |
| `reverse` | play backwards to the start |

Where triggers work:

- **Every player** — web, React, Vue and React Native — supports all of them, with one
  exception: React Native has no `mouseOver`, because there is no hover on a touch screen.
- **Pre-rendered SVG + CSS animation + JS triggers** supports all of them too. The editor
  writes a few lines of script into the file for this; no library is involved.
- **Pre-rendered SVG + CSS animation** (no script at all) supports `load`, and `mouseOver`
  through CSS `:hover`. `click` and `scrollIntoView` cannot be done in pure CSS, so in this
  flavour they behave like `load` — the animation starts as soon as it is shown. See
  [Pre-rendered SVG](https://pixodesk.com/docs/svga/prerendered-svg/on-the-web#flavour-1--svg--css-animation).

## Overriding from a player

> **Example:** [`playback/override-web`](../../examples/docs-examples/src/cases/playback/override-web/) — `pnpm example:docs`, then open `#playback/override-web`.
> **Example:** [`playback/override-react`](../../examples/docs-examples/src/cases/playback/override-react/) — `pnpm example:docs`, then open `#playback/override-react`.

**Web player** — edit the object before handing it over (the player reads `animator` once at
creation):

```html
<div id="box" style="width: 300px; height: 300px"></div>
```

```js
import { createAnimator } from '@pixodesk/svg-animator-web';

const doc = await (await fetch('/bouncing-ball.json')).json();
doc.animator = { ...doc.animator,
  timeline: { type: 'clock', iterations: 'infinite', trigger: { startOn: 'programmatic' } } };
const a = createAnimator({ data: doc, container: '#box' });
a.play();
```

**React / Vue / React Native** — the components take props with the same names as the fields
of the document's `animator` block, and a prop you pass replaces that one field for that one
component; the rest of the document is untouched: `duration`, `delay`, `iterations`,
`direction`, `fill`, `mode`, `frameRate` replace the fields of `animator`; `startOn`,
`outAction`, `scrollIntoViewThreshold` replace the fields of `animator.trigger` (see each
package page). Note that the components switch the trigger to `programmatic` whenever you use
`play` / `pause` / `apiRef` / `time`, so only `autoplay` mode uses the trigger saved in the
file.

## Debug handle — `debugInstName`

`"animator": { "debugInstName": "heroBanner" }` makes the player publish its API object as
`window.heroBanner`, so you can drive a live instance from the browser console —
`heroBanner.pause()`, `heroBanner.setCurrentTime(500)`, and so on. Purely a debugging
convenience; remove it (or leave it — it has no other effect) for production files.

## Scroll-driven playback (in development)

> **In development.** Scroll-driven playback is not finished yet: the fields below may change,
> and not every combination works in every player. Time-driven playback — the default — is
> not affected.

Instead of playing on a clock, the animation can **follow the scroll position** — the playhead
moves as the user scrolls: scroll down and the animation goes forward, scroll back up and it
goes backward, stop and it stays on that frame. This is the model of CSS scroll-driven
animations. Choose
*Timeline → scroll* in the editor's playback panel, or set it in the document:

```js
"animator": {
  // The playhead follows the SVG's journey through the viewport instead of the clock;
  // `duration` is the keyframe span the scroll range maps onto.
  "timeline": { "type": "view", "duration": 3000, "range": { "start": { "phase": "entry", "fraction": 0 }, "end": { "phase": "exit", "fraction": 1 } } }
}
```

`timeline: { "type": "view" }` alone means *"show the whole animation, first frame to last, as
the SVG travels across the viewport — the scroll position, not the clock, decides which frame
is on screen"*; `type: "scroll"` follows the scroll container's offset instead. The clock
fields (`trigger`, `delay`, `"infinite"`) have no slot in these timelines. The rest of the
object tunes it:

| `timeline.` | Values | Meaning |
|---|---|---|
| `type` | `view` · `scroll` | progress = the SVG's journey across the scrollport, or the scroll container's offset ratio |
| `axis` | `block` (default) · `inline` · `x` · `y` | which axis; `block` = vertical in normal writing mode |
| `source` | `nearest` (default) · `root` | for `type: scroll` — the nearest scrollable ancestor, or the document |
| `subject` | `parent` · `scroller` · a CSS selector | for `type: view` — **whose** journey is measured (default: the `<svg>` itself). `parent` is what makes a *pinned* section work |
| `range.start` / `range.end` | `{ phase, fraction }` | the slice of the journey mapped to 0–100 %; `phase` ∈ `cover` (default) · `contain` · `entry` · `exit` · `entry-crossing` · `exit-crossing`; `fraction` is a position within that phase, `0` = its start, `1` = its end |
| `iterations` | number | the animation repeats this many times across the range (finite only — `"infinite"` cannot map onto a range) |
| `smoothing` | ms | catch-up lag — the playhead eases toward the scroll position instead of snapping (smoother under momentum scrolling) |
| `pin` | `true` · `{ align, top, distance }` | hold the canvas still on screen while scrolling moves the animation forward and back (`position: sticky`); `align` ∈ `top`/`center`/`bottom`, `top` in px, `distance` in viewport heights creates the scroll travel |
| `engine` | `custom` (default) · `native` | who computes progress: the player's own measurement (identical everywhere) or the browser's `ScrollTimeline` (falls back automatically when unsupported) |

Support: the **web player** (both engines, and therefore React and Vue), and the *SVG + JS
animation* export. Not yet: the CSS export or React Native. The complete "scrollytelling"
pattern is `subject: "parent"` + `pin: true` inside a tall section.

[← React Native](./react-native.md) · [Contents](../../README.md#documentation) · Next: [Pre-rendered SVG on the web →](https://pixodesk.com/docs/svga/prerendered-svg/on-the-web)
