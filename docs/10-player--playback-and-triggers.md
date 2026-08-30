# Playback settings & triggers

[← React Native](./09-player--react-native.md) · [Contents](./README.md) · Next: [Pre-rendered SVG on the web →](./11-player--prerendered-svg.md)

Change how an animation plays — its length, loops, direction, what starts it — without going
back to the editor. Everything about *when* and *how* it plays lives in one place, the
document's `animator` block, and every player lets you **override it at runtime** from
component props or the player API. This page is the reference for those fields and the
overrides.

The editor writes the same block from its playback panel; if you only want to set the
defaults there, see
[Set default playback settings & triggers](./04-editor--playback-settings.md).

```json
{
  "type": "svg",
  "viewBox": "0 0 400 400",
  "animator": {
    "duration": 2000,
    "iterations": "infinite",
    "direction": "alternate",
    "trigger": { "startOn": "scrollIntoView", "outAction": "pause", "scrollIntoViewThreshold": 0.5 }
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

The same bouncing ball as in the [web player](./06-player--web-player.md#declarative--data-px-animation-src),
now two seconds per bounce and waiting until half of it has scrolled into view.

## Timing

| Field | Values | Default | Meaning |
|---|---|---|---|
| `duration` | ms | `1000` | length of **one** iteration. Keyframe times are absolute offsets within it |
| `delay` | ms | `0` | wait this long, then start. A **negative** value skips ahead instead: `-500` starts right away from the frame at 0.5 s, as if the animation had already been running for half a second |
| `iterations` | number · `"infinite"` | `1` | how many times the whole document timeline repeats |
| `direction` | `normal` · `reverse` · `alternate` · `alternate-reverse` | `normal` | `alternate` ping-pongs on every other iteration |
| `fill` | `forwards` · `backwards` · `both` · `none` | `forwards` | what is shown *outside* the active time: `forwards` holds the last frame after the end; `backwards` shows the first frame during the delay; `none` reverts to the static SVG |
| `resetOnFinish` | boolean | `false` | after a natural finish, snap back to the start state (instead of holding per `fill`) |
| `frameRate` | fps | uncapped | target rate for the frame-loop engine only |
| `mode` | `auto` · `waapi` · `frames` | `auto` | the engine — see below |

**Per-property loops vs `iterations`.** There are two kinds of repetition, and they work at
different levels. `iterations` repeats the **whole document** — every element, from the first
keyframe to the last. A single property can also `loop` on its own: a segment of *its own*
keyframes repeats until it fills the document's duration, while everything else plays through
once (see [JSON format → Loops](./14-format--json-format.md#loops)). The property loop is
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

The `trigger` block says what starts the animation and what happens when that condition ends.
The editor writes it from its **Start** setting; every player honours it:

```json
"trigger": { "startOn": "mouseOver", "outAction": "reset" }
```

| `startOn` | Starts when… | Editor label |
|---|---|---|
| `load` (default) | the animation is displayed | On load |
| `scrollIntoView` | the element becomes visible; `scrollIntoViewThreshold` says how much of it must be on screen first: `0` (default) any part, `0.5` half of it, `1` all of it | When visible |
| `mouseOver` | the pointer enters the element | On mouse over |
| `click` | the element is clicked (a second click applies `outAction`) | On click |
| `programmatic` | never by itself — you call `play()` | Manually from JS |

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
  [Pre-rendered SVG](./11-player--prerendered-svg.md#flavour-1--svg--css-animation).

## Overriding from a player

> **Example:** [`playback/override-web`](../examples/docs-examples/src/cases/playback/override-web/) — `pnpm example:docs`, then open `#playback/override-web`.
> **Example:** [`playback/override-react`](../examples/docs-examples/src/cases/playback/override-react/) — `pnpm example:docs`, then open `#playback/override-react`.

**Web player** — edit the object before handing it over (the player reads `animator` once at
creation):

```html
<div id="box" style="width: 300px; height: 300px"></div>
```

```js
import { createAnimator } from '@pixodesk/svg-animator-web';

const doc = await (await fetch('/bouncing-ball.json')).json();
doc.animator = { ...doc.animator, iterations: 'infinite', trigger: { startOn: 'programmatic' } };
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

## Scroll-driven playback (in development)

> **In development.** Scroll-driven playback is not finished yet: the fields below may change,
> and not every combination works in every player. Time-driven playback — the default — is
> not affected.

Instead of playing on a clock, the animation can **follow the scroll position** — the playhead
moves as the user scrolls: scroll down and the animation goes forward, scroll back up and it
goes backward, stop and it stays on that frame. This is the model of CSS scroll-driven
animations. Choose
*Timeline → scroll* in the editor's playback panel, or set it in the document:

```json
"animator": {
  "duration": 3000,
  "timelineSource": "scroll",
  "scroll": { "kind": "view", "range": { "start": { "phase": "entry", "fraction": 0 }, "end": { "phase": "exit", "fraction": 1 } } }
}
```

`timelineSource: "scroll"` alone means *"show the whole animation, first frame to last, as the
SVG travels across the viewport — the scroll position, not the clock, decides which frame is on
screen"*. With it, `trigger` and `iterations: "infinite"` are ignored. The optional `scroll`
block tunes it:

| `scroll.` | Values | Meaning |
|---|---|---|
| `kind` | `view` (default) · `scroll` | progress = the SVG's journey across the scrollport, or the scroll container's offset ratio |
| `axis` | `block` (default) · `inline` · `x` · `y` | which axis; `block` = vertical in normal writing mode |
| `source` | `nearest` (default) · `root` | for `kind: scroll` — the nearest scrollable ancestor, or the document |
| `subject` | `parent` · `scroller` · a CSS selector | for `kind: view` — **whose** journey is measured (default: the `<svg>` itself). `parent` is what makes a *pinned* section work |
| `range.start` / `range.end` | `{ phase, fraction }` | the slice of the journey mapped to 0–100 %; `phase` ∈ `cover` (default) · `contain` · `entry` · `exit` · `entry-crossing` · `exit-crossing`; `fraction` is a position within that phase, `0` = its start, `1` = its end |
| `smoothing` | ms | catch-up lag — the playhead eases toward the scroll position instead of snapping (smoother under momentum scrolling) |
| `pin` · `pinAlign` · `pinTop` · `pinDistance` | boolean · `top`/`center`/`bottom` · px · viewport heights | hold the canvas still on screen while scrolling moves the animation forward and back (`position: sticky`); `pinDistance` creates the scroll travel |
| `driver` | `custom` (default) · `native` | who computes progress: the player's own measurement (identical everywhere) or the browser's `ScrollTimeline` (falls back automatically when unsupported) |

Support: the **web player** (both engines, and therefore React and Vue), and the *SVG + JS
animation* export. Not yet: the CSS export or React Native. The complete "scrollytelling"
pattern is `subject: "parent"` + `pin: true` inside a tall section.

[← React Native](./09-player--react-native.md) · [Contents](./README.md) · Next: [Pre-rendered SVG on the web →](./11-player--prerendered-svg.md)
