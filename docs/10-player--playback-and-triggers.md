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
  "animator": {
    "duration": 2000,
    "iterations": "infinite",
    "direction": "alternate",
    "trigger": { "startOn": "scrollIntoView", "outAction": "pause", "scrollIntoViewThreshold": 0.5 }
  },
  "children": [ … ]
}
```

## Timing

| Field | Values | Default | Meaning |
|---|---|---|---|
| `duration` | ms | `1000` | length of **one** iteration. Keyframe times are absolute offsets within it |
| `delay` | ms | `0` | wait before starting. **Negative** = start part-way through the timeline |
| `iterations` | number · `"infinite"` | `1` | how many times the whole document timeline repeats |
| `direction` | `normal` · `reverse` · `alternate` · `alternate-reverse` | `normal` | `alternate` ping-pongs on every other iteration |
| `fill` | `forwards` · `backwards` · `both` · `none` | `forwards` | what is shown *outside* the active time: `forwards` holds the last frame after the end; `backwards` shows the first frame during the delay; `none` reverts to the static SVG |
| `resetOnFinish` | boolean | `false` | after a natural finish, snap back to the start state (instead of holding per `fill`) |
| `frameRate` | fps | uncapped | target rate for the frame-loop engine only |
| `mode` | `auto` · `waapi` · `frames` | `auto` | the engine — see below |

**Per-property loops vs `iterations`.** A single property can also `loop` — repeat a segment
of *its own* keyframes to fill the document duration (see [JSON format → Loops](./14-format--json-format.md#loops)).
That is a pre-processing step; `iterations` then repeats the whole document. They compose: a
looping wheel inside an infinitely iterating document spins within every iteration.

## Engine mode

| Mode | What runs the animation |
|---|---|
| `auto` (default) | the Web Animations API — native, smooth, off the main thread where possible — with an **automatic fallback** to the frame loop when the document animates something WAAPI cannot express (path morphing, gradient geometry, filters, text on a path, …) |
| `waapi` | Web Animations API only |
| `frames` | a `requestAnimationFrame` loop that writes attributes every frame; honours `frameRate`; universal browser support |

Leave it on `auto` unless you need a guarantee — for instance `frames` for path morphing in
Safari < 18.5. React Native ignores `mode` (playback is always native-driven).

## Triggers — what *starts* the animation

```json
"trigger": { "startOn": "mouseOver", "outAction": "reset" }
```

| `startOn` | Starts when… | Editor label |
|---|---|---|
| `load` (default) | the animation is displayed | On load |
| `scrollIntoView` | the element becomes visible; `scrollIntoViewThreshold` (0–1, default 0 = any pixel) is the fraction that must be visible | When visible |
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

Triggers are implemented by every player (the RN player has no `mouseOver`) and by the
*SVG + CSS + JS triggers* export flavour. A CSS-only SVG starts on load, or is controlled by
its classes — see [Pre-rendered SVG](./11-player--prerendered-svg.md#flavour-1--svg--css-animation).

## Overriding from a player

**Web player** — edit the object before handing it over (the player reads `animator` once at
creation):

```js
const doc = await (await fetch('/animation.json')).json();
doc.animator = { ...doc.animator, iterations: 'infinite', trigger: { startOn: 'programmatic' } };
const a = createAnimator({ data: doc, container: '#box' });
a.play();
```

**React / Vue / React Native** — props with the same names override the document:
`duration`, `delay`, `iterations`, `direction`, `fill`, `mode`, `frameRate`, `startOn`,
`outAction`, `scrollIntoViewThreshold` (see each package page). Note that the components
switch the trigger to `programmatic` whenever you use `play` / `pause` / `apiRef` / `time`, so
only `autoplay` mode uses the document's trigger.

## Scroll-driven playback

Instead of playing on a clock, the animation can **follow the scroll position** — the playhead
moves as the user scrolls ("scrubbing"), the model of CSS scroll-driven animations. Choose
*Timeline → scroll* in the editor's playback panel, or set it in the document:

```json
"animator": {
  "duration": 3000,
  "timelineSource": "scroll",
  "scroll": { "kind": "view", "range": { "start": { "phase": "entry", "fraction": 0 }, "end": { "phase": "exit", "fraction": 1 } } }
}
```

`timelineSource: "scroll"` alone means *"scrub the whole animation as the SVG crosses the
viewport"*. With it, `trigger` and `iterations: "infinite"` are ignored. The optional `scroll`
block tunes it:

| `scroll.` | Values | Meaning |
|---|---|---|
| `kind` | `view` (default) · `scroll` | progress = the SVG's journey across the scrollport, or the scroll container's offset ratio |
| `axis` | `block` (default) · `inline` · `x` · `y` | which axis; `block` = vertical in normal writing mode |
| `source` | `nearest` (default) · `root` | for `kind: scroll` — the nearest scrollable ancestor, or the document |
| `subject` | `parent` · `scroller` · a CSS selector | for `kind: view` — **whose** journey is measured (default: the `<svg>` itself). `parent` is what makes a *pinned* section work |
| `range.start` / `range.end` | `{ phase, fraction }` | the slice of the journey mapped to 0–100 %; `phase` ∈ `cover` (default) · `contain` · `entry` · `exit` · `entry-crossing` · `exit-crossing`, `fraction` 0–1 |
| `smoothing` | ms | catch-up lag — the playhead eases toward the scroll position instead of snapping (smoother under momentum scrolling) |
| `pin` · `pinAlign` · `pinTop` · `pinDistance` | boolean · `top`/`center`/`bottom` · px · viewport heights | hold the canvas still on screen while scrolling scrubs it (`position: sticky`); `pinDistance` creates the scroll travel |
| `driver` | `custom` (default) · `native` | who computes progress: the player's own measurement (identical everywhere) or the browser's `ScrollTimeline` (falls back automatically when unsupported) |

Support: the **web player** (both engines, and therefore React and Vue), and the *SVG + JS
animation* export. Not yet: the CSS export or React Native. The complete "scrollytelling"
pattern is `subject: "parent"` + `pin: true` inside a tall section.

[← React Native](./09-player--react-native.md) · [Contents](./README.md) · Next: [Pre-rendered SVG on the web →](./11-player--prerendered-svg.md)
