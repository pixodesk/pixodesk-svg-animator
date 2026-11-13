# Web player — `@pixodesk/svg-animator-web`

[← Installing the players (overview)](./installation.md) · [Contents](../../README.md#documentation) · Next: [React →](./react.md)

Use this on a plain web page — or anywhere you write JavaScript without a framework — to play
a JSON animation with full control. Hand it the document and it builds the SVG DOM, drives the
animation with the Web Animations API or a frame loop, and wires up hover / click / scroll
triggers for you. It ships as ESM, CJS and UMD (global `Pixodesk.SvgAnimator`), so it fits a
bundler or a plain `<script>` tag equally well.

```bash
npm install @pixodesk/svg-animator-web
```

## Ways to use it

### Declarative — `data-px-document`

> **Example:** [`web/declarative`](../../examples/docs-examples/src/cases/web/declarative/) — `pnpm example:docs`, then open `#web/declarative`.

Point an element at the JSON file and call `createSvgAnimationPlayersFromPage()` once the DOM is ready. The
script is the UMD build, copied from the npm package into your site — see
[Installing the players (overview)](./installation.md#builds--esm-cjs-and-umd):

```html
<div data-px-document="/bouncing-ball.json" style="width: 300px; height: 300px"></div>

<script src="/js/pixodesk-svg-animator.umd.min.js"></script>
<script>Pixodesk.SvgAnimator.createSvgAnimationPlayersFromPage();</script>
```

`bouncing-ball.json` is the whole document — a ball on an eased, alternating bounce. (The
comments are explanatory; JSON does not allow comments, so the real file has none.)

```js px-player
{
  // The root <svg> element — plain SVG, written as JSON
  "type": "svg",
  "viewBox": "0 0 400 400",

  // ADDED: the playback settings — how long, how many times, what starts it
  "animator": {
    "timeline": {
      "outTime": 1000,
      "iterations": "infinite",
      "iterationDirection": "alternate",
      "actionTriggers": { "playback.start": "load" }
    }
  },
  "children": [
    {
      // A plain SVG <circle> with ordinary attributes
      "type": "circle",
      "id": "ball",
      "cx": 0, "cy": 0, "r": 40, "fill": "#0087ff",

      // ADDED: the circle's animation — keyframes for its position
      "animate": {
        "transform": {
          "keyframes": [
            { "time": 0,    "value": { "translate": [200, 60] },  "easing": [0.33, 0, 0.67, 0.33] },
            { "time": 1000, "value": { "translate": [200, 340] } }
          ]
        }
      }
    }
  ]
}
```

Every matching element gets its own player (the [playback API](#the-playback-api) below):
`createSvgAnimationPlayersFromPage()` returns the ones it created, and `getSvgAnimationPlayer(element)` finds an
element's later. Calling `createSvgAnimationPlayersFromPage()` again only picks up elements that do not have
a player yet, so it is safe to call after inserting new content. Each file plays on its own triggers, as
on every player; the call's options apply to every player it creates — `actionTriggers` gives them all other
triggers, `disableActionTriggers: true` leaves the driving to your code (`getSvgAnimationPlayer(element)`),
`showAsStatic: true` shows each picture as drawn.

### Programmatic — `createSvgAnimationPlayer(options)`

> **Example:** [`web/programmatic`](../../examples/docs-examples/src/cases/web/programmatic/) — `pnpm example:docs`, then open `#web/programmatic`.

Use `createSvgAnimationPlayer` when you want to start the animation from code, react to what it does,
or control it after it has loaded. It returns the playback API at once — even while the
document is still loading from a URL.

```html
<div id="hero" style="width: 300px; height: 300px"></div>
```

```js
import { createSvgAnimationPlayer } from '@pixodesk/svg-animator-web';
import animationDoc from './bouncing-ball.json';

// from a URL — returns immediately; control calls made before the file loads are
// queued and replayed in order once it is ready
const player = createSvgAnimationPlayer({
  document: '/bouncing-ball.json',          // a string is always a URL
  container: '#hero',                       // plays the way the editor saved it — the file's own triggers
  onPlaybackFinish: () => console.log('done'),
});

// or from a document object you already have — imported, fetched, or built in code
const player2 = createSvgAnimationPlayer({ document: animationDoc, container: document.getElementById('hero') });

player.playback.start();
```

#### Options

<!-- px-check signature pkg=web -->
```typescript
// Create a player. `document` is required — a URL (a string is always a URL) or the
// document itself; leaving it out throws. With a URL, control calls made before the fetch
// resolves are queued and replayed in order, so
// `createSvgAnimationPlayer({ document: url }).playback.start()` works as written. A failed fetch or an
// invalid document reaches `onError` — and `console.error` when no handler is given;
// `isReady()` stays false either way.
function createSvgAnimationPlayer(options: PxAnimationPlayerOptions): PxAnimationPlayerApi;

interface PxAnimationPlayerOptions {
    document: string | PxDocumentJson;     // a URL to fetch the JSON document from, or the document
                                           //   itself (a .json import passes as-is). `src` / `doc` until 1.25
    container?: string | Element;          // CSS selector or element to render into (its content is
                                           //   replaced). Omit it to animate an SVG already in the
                                           //   page, found by the document's `id`

    // Callbacks, inline: `PxAnimationPlayerCallbacks`, the one shape every player takes — see
    // Callbacks below; the shape itself is spelled out once, in the library overview
    onReady?: () => void;   // the player exists and the SVG is rendered — once, async;
                            //   the push twin of isReady() (no polling while a URL loads)
    onPlaybackStart?: () => void;  onPlaybackStop?: () => void;     // the playback's two buttons, when performed
    onPlaybackPause?: () => void;  onPlaybackResume?: () => void;   // the freeze inside it (the gate's too)
    onPlaybackFinish?: () => void;  onDestroy?: () => void;
    onWarning?: (d: PxDiagnostic) => void;
    onError?: (d: PxDiagnostic) => void;
    suppressWarnings?: boolean;  suppressErrors?: boolean;

    // Control — `PxCommonControlProps`, one at a time (a mix warns, PX1501). None of them: the
    // document's own `timeline.actionTriggers` start, pause and stop it, behind the visibility gate —
    // the way the editor saved it — and the returned api drives it too.
    showAsStatic?: boolean;                // the picture as drawn: nothing plays, whatever the file says — no
                                           //   triggers, no scroll; every playback call is ignored (PX1506).
                                           //   Beats every other option
    disableActionTriggers?: boolean;       // manual: the file's triggers off — nothing starts by itself, the
                                           //   returned api (`playback.start()`, `playback.setCurrentTime()`) drives it
    actionTriggers?: PxActionTriggersInput | null; // the triggers INSTEAD of the file's, as a whole (lists
                                           //   left out are not listed, never the file's); null or {}: none

    // Per-instance playback override: `PxPlaybackOverride`; the document is never modified.
    // The rules: Playback settings & triggers → Overriding from a player
    timelineOptions?: PxTimelineOptions;   // MERGED over the document's `timeline` block — same shape as
                                           //   the file, minus `actionTriggers` and `actions`. A key left
                                           //   out keeps the file's value
    actions?: PxActionsInput;              // the `timeline.actions` block INSTEAD of the file's — how a stop
                                           //   looks (+ the gate's outOfView): `{ 'playback.stop': 'animateToStart' }`;
                                           //   a slot left out reads its default. What a finished playback
                                           //   shows, `whenFinished`, is a timeline key (timelineOptions)
}
```

By default there is nothing to configure: the player takes the window, iterations, iteration
direction, what starts and stops the animation, how a stop looks and the engine from the
`animator` block inside the JSON — the settings you chose in the editor. So a file plays the way
it was saved: one saved with `"playback.start": "load"` plays at once, one without triggers stays still until
your code calls `playback.start()`.

The control options change who drives it — one at a time
([Control modes](./playback-and-triggers.md#control-modes--who-drives-it)):

<!-- px-check off the control options, prose — their types are checked in the signature block above -->
| Option | The player… |
|---|---|
| none (the default) | plays on the file's own triggers; the returned api works too |
| `actionTriggers: { … }` | plays on these triggers instead of the file's |
| `disableActionTriggers: true` | ignores the file's triggers — nothing starts until your code says so |
| `showAsStatic: true` | shows the picture as drawn — nothing plays, playback calls are ignored with a warning (PX1506) |

`timelineOptions` and `actions` are there for when one page needs it to play differently — the same file
mounted twice at two speeds, or a heartbeat that should finish its beat before it stops. For your own transport
UI, switch the file's triggers off, and nothing starts until you say so:

```js
const player = createSvgAnimationPlayer({
  document: '/bouncing-ball.json',
  container: '#box',
  timelineOptions: { iterations: 'infinite' },
  actions: { 'playback.stop': 'animateToEnd' },
  disableActionTriggers: true,
});
player.playback.start();
player.playback.stop();   // plays on to the end of the current pass, then rests
```

Merge or replace — the one rule for the three:

<!-- px-check off merge versus replace, prose -->
| | |
|---|---|
| `timelineOptions` | **a recursive partial** — objects merge key by key, values replace, a key left out keeps the file's value |
| `actions`, `actionTriggers` | **blocks** that replace the file's as a whole — their slots belong together; a slot left out reads its default, never the file's value |

So the timing you do not mention stays as the file has it; to use other triggers than the file's, give
`actionTriggers` the triggers themselves —
`actionTriggers: { 'playback.play': 'hoverIn', 'playback.pause': 'hoverOut' }`. Full rules — what happens when
the override changes the kind of timeline — are in
[Playback settings & triggers → Overriding from a player](./playback-and-triggers.md#overriding-from-a-player).
Every field and its meaning is in [Playback settings & triggers](./playback-and-triggers.md).

## The playback API

`createSvgAnimationPlayer` returns a `PxAnimationPlayerApi`: the player's own lifecycle, and `playback` — a
`PxPlaybackControls`, everything a page does to the animation. One interface on every player (web, React,
Vue, React Native and `bind`), one time contract over two clocks: **plain names are content ms inside
the iteration, `total…` names span the whole playback, `…AtSpeed` names the same values at the current speed —
content time ÷ the speed**; a seek clamps; a speed of `0` is rejected ([Two clocks](./playback-and-triggers.md#two-clocks)).
Every act has one spelling: `player.playback.start()` presses the button a file's `"playback.start"` list
presses, `player.playback.play()` the one a `"playback.play"` list presses (until 1.25 the methods sat flat on
the player; `playOnce()`, `jumpToStart()` and `jumpToEnd()` until 1.25 — `start()` on a one-iteration timeline,
`stop()` and `setCurrentProgress()` say the same).

<!-- px-check signature pkg=web -->
```typescript
// What `createSvgAnimationPlayer` returns — core's `PxAnimationPlayerApi<Element>`.
interface PxAnimationPlayerApi {
    readonly playback: PxPlaybackControls; // everything a page does to the animation — below
    isReady(): boolean;                    // true once a document from a URL has loaded and rendered
    getRootElement(): Element | null;      // the rendered <svg>; null before ready
    destroy(): void;                       // stop, remove the SVG it rendered, release everything; fires onDestroy
}

// `player.playback` — ONE object per player, made of closures: `const { start } = player.playback` works.
// Calls made before a document from a URL has loaded are queued; after destroy() every call is a no-op.
interface PxPlaybackControls {
    start(): void;                         // a playback FROM THE START, in every state — off, finished, while
                                           //   playing (it restarts), paused (the freeze is dropped) or
                                           //   returning; the delay is waited again. Reports onPlaybackStart
    play(): void;                          // start or carry on — what a Play button wants: nothing while
                                           //   playing; paused resumes (onPlaybackResume); a picture on its
                                           //   way back to the start turns around and plays forward from where
                                           //   it is (onPlaybackStart); otherwise starts from the start
    stop(): void;                          // the built-in stop, per `actions["playback.stop"].behavior`
                                           //   (jumpToStart · animateToStart · jumpToEnd · animateToEnd ·
                                           //   animateToEndAndBack) — what a `playback.stop` trigger does;
                                           //   reports onPlaybackStop (on arrival for the stops that finish the pass)
    pause(): void;                         // freeze the current frame (only while playing); onPlaybackPause
    resume(): void;                        // carry on from the frozen frame (only while paused); onPlaybackResume
    getState(): PxPlaybackState;           // the one state read — the playback's: 'off' (no playback: before the first
                                           //   start, or back at the rest pose) | 'playing' | 'paused' (also after
                                           //   a seek made while not playing) | 'finished' (reached its end,
                                           //   whatever `whenFinished` then shows) | 'returning' (no playback, but
                                           //   the picture still plays back to the rest pose — a stop's return leg)
                                           //   | 'destroyed' (after destroy(); every call is then a no-op)
    isActive(): boolean;                   // a playback exists: playing · paused · finished
    isPlaying(): boolean;                  // getState() === 'playing' — a picture moving back is not playing

    // Content time, ONE iteration — the plain time names
    getDuration(): number | null;          // one pass of the content window (`outTime − inTime`), ms —
                                           //   a looping file's slider maximum; null before a URL loads
    getCurrentTime(): number | null;       // the frame on screen: ms inside the current iteration,
                                           //   0..getDuration(); a reversed pass of `alternate` counts down
    setCurrentTime(time: number): void;    // seek inside the current iteration; clamped to [0, getDuration()].
                                           //   The seek rule: playing, it continues from there; in any other
                                           //   state the playback is `paused` at that frame — a slider steps
                                           //   through it this way, and resume() plays on from it
    getCurrentProgress(): number | null;   // the position counted in iterations, in play order: 0.5 half-way
                                           //   through the first, 1.2 20 % into the second; null before ready
    setCurrentProgress(progress: number): void; // seek to that position — clamped to [0, iterations], no upper
                                           //   bound when endless, nothing wraps; the seek rule as above
    getCurrentIteration(): number;         // which pass is playing, 0-based

    // Content time, the WHOLE playback — the `total…` names
    getTotalDuration(): number | null;     // one pass × iterations; null when infinite — a finite playback's
                                           //   slider maximum, no division to guard. The delay is not counted
    getTotalTime(): number | null;         // the playhead on the whole playback, every iteration included;
                                           //   0 while the delay waits; unbounded on an endless file
    setTotalTime(time: number): void;      // seek on the whole playback; clamped to [0, getTotalDuration()];
                                           //   the seek rule as above
    getTotalProgress(): number | null;     // the playhead as 0–1 of the whole playback (GSAP's totalProgress);
                                           //   null when endless

    // The speed, and the same values at it — the `…AtSpeed` names
    getSpeed(): number;                    // 1 normal, 2 double, 0.5 half, negative plays backwards (on top
                                           //   of `iterationDirection`: a `reverse` pass at −1 plays forwards);
                                           //   starts at the file's `timeline.playbackSpeed`
    setSpeed(speed: number): void;         // replaces it — no hidden product with the file's value;
                                           //   0 and non-finite are rejected with a warning — use pause()
    getDurationAtSpeed(): number | null;   // one pass in ms at the current speed: getDuration() / |speed|
    setDurationAtSpeed(ms: number): void;  // the speed asked for as a length: one pass takes `ms` at it
    getTotalDurationAtSpeed(): number | null; // the whole playback at the current speed; null when `iterations` is 'infinite'
    getCurrentTimeAtSpeed(): number | null;   // the playhead in the pass at the current speed: getCurrentTime() / |speed|
                                           //   — derived from the position, never a stopwatch
    getTotalTimeAtSpeed(): number | null;  // the playhead on the whole playback at the current speed: getTotalTime() / |speed|
}
```

**Two clocks.** Plain time names are content ms **inside the iteration**: `playback.getCurrentTime()` is the frame on
screen, `0..getDuration()`, so a time slider for a looping file spans one pass and wraps — the way
lottie-web's `currentFrame` and GSAP's `time()` read. **Progress counts iterations, in the order they play**:
`playback.getCurrentProgress()` reads `1.2` 20 % into the second iteration, and `setCurrentProgress(1.2)` goes
there (an `alternate` second pass runs backwards, so that is the frame at 80 %); nothing wraps, so `1` is the
last frame of the first iteration. A 0–1 bar for every pass is `getCurrentTime() / getDuration()`. A seek
while `playing` keeps playing; in every other state the playback becomes `paused` at that frame and
`playback.resume()` plays on from it — a seek reports no callback
([Moving the playhead](./playback-and-triggers.md#moving-the-playhead)). The `total…` names span the **whole playback** —
"total" means including repeats, GSAP's words exactly (`time` / `totalTime`, `duration` /
`totalDuration`, `progress` / `totalProgress`): `playback.getTotalDuration()` is the slider maximum for a finite
playback and `null` when `iterations` is `'infinite'` (the honest answer, no division to guard);
`playback.getTotalTime()` / `playback.getTotalProgress()` are the playhead on it, `playback.getCurrentIteration()`
says which pass. The `…AtSpeed` names are the same values **at the current speed** — content time ÷ the speed:
`playback.getDurationAtSpeed()` is how long one pass takes, `playback.getTotalDurationAtSpeed()` the whole playback
("finishes in 3 s"), `playback.getCurrentTimeAtSpeed()` / `playback.getTotalTimeAtSpeed()` where the playhead is.
The file's `timeline.playbackSpeed` is the initial speed and `playback.setSpeed()` replaces it. On a scroll or
view timeline the scroll position owns the playhead: the playback verbs are no-ops with a `usage`
warning ([PX1505](../diagnostics.md#the-props-a-component-was-given)). After `destroy()` every
call is ignored with a `usage` warning ([PX1504](../diagnostics.md)) and `playback.getState()` says
`'destroyed'`.

```html
<div id="hero" style="width: 300px; height: 300px"></div>
<input id="time-slider" type="range" min="0" value="0">
```

```js
import { createSvgAnimationPlayer } from '@pixodesk/svg-animator-web';

const slider = document.querySelector('#time-slider');
const player = createSvgAnimationPlayer({
  document: '/bouncing-ball.json',
  container: '#hero',
  // §14: no polling isReady(), no hard-coded maximum — the document knows its own length
  onReady: () => { slider.max = String(player.playback.getDuration()); },
});

slider.addEventListener('input', () => {
  player.playback.pause();                                // a playing animation would carry on from the new frame
  player.playback.setCurrentTime(Number(slider.value));   // from 0 to playback.getDuration(), in ms — one iteration;
                                                          //   the playback is `paused` there, resume() plays on
});

// A slider over the WHOLE playback of a finite file: the `total…` pair
// slider.max = String(player.playback.getTotalDuration() ?? player.playback.getDuration());
// player.playback.setTotalTime(Number(slider.value));
```

## Callbacks

> **Example:** [`web/callbacks`](../../examples/docs-examples/src/cases/web/callbacks/) — `pnpm example:docs`, then open `#web/callbacks`.

Pass `onPlaybackStart`, `onPlaybackFinish` and friends — inline, next to `document` — to be told when a playback starts, pauses, resumes, stops, finishes or is
destroyed — for example to reveal the next section of a page once an intro has finished. Every
lifecycle callback is called with no arguments.

The same options carry the player's diagnostics, two severities with one meaning each: `onWarning`
— **it plays**, but something was ignored, degraded or misspelled; `onError` — **this instance
will not play**: the document failed to load, parse or build, or the render threw, and
`isReady()` stays false. Neither ever throws at you. Give a handler and the console stays out of
it; give none and the console still speaks, so nothing is lost by default. `suppressWarnings` /
`suppressErrors` switch that console fallback off — for when you know the player has something to
say about this document and are prepared to tolerate it (a handler you passed still fires).

Each one is `{ code, kind, data?, message, error? }`. `code` is a number you can switch on — its description is on the [codes page](../diagnostics.md), which `message` links to; `data` carries the specifics. `kind` says **who can act on it**:
`document` (repair the file) · `host` (fix the page) · `platform` (the browser could not do it;
the player degraded) · `usage` (fix the options you passed) · `internal` (report it to us). So
you can route rather than just log — a handler that ignores `platform` and logs the rest is one
line.

```html
<div id="box" style="width: 300px; height: 300px"></div>
```

```js
import { createSvgAnimationPlayer } from '@pixodesk/svg-animator-web';
import doc from './bouncing-ball.json';

createSvgAnimationPlayer({
  document: doc,
  container: '#box',
  onPlaybackStart:  () => {},   // a playback began — playback.start(), playback.play() from rest, a playback.start /
                                //   playback.play trigger, the gate starting it again; a return turned around by a play
  onPlaybackResume: () => {},   // the playback carried on after a freeze — playback.resume(), playback.play(), a
                                //   playback.resume trigger, the gate when it is seen again
  onPlaybackPause:  () => {},   // the playback was frozen — playback.pause(), a playback.pause trigger, the gate's pause
  onPlaybackStop:   () => {},   // the playback was stopped — a playback.stop trigger, playback.stop() or the gate's stop;
                                //   on arrival for the stops that finish the pass first
  onPlaybackFinish: () => {},   // the last pass ended by playing — never for a stop that goes to the end,
                                //   never for a loop without end
  onDestroy: () => {},   // destroyed

  onWarning: (d) => {}, // d = { code, kind, data? }; else console.warn
  onError: (d) => {},   // d = { code, kind, data?, error }; else console.error
  suppressWarnings: false,  // true: no console.warn — you know about the warnings and tolerate them
  suppressErrors: false,    // true: no console.error
});
```

## Triggers

> **Example:** [`web/triggers`](../../examples/docs-examples/src/cases/web/triggers/) — `pnpm example:docs`, then open `#web/triggers`.

By default the player listens on the rendered SVG for every event the document's
`timeline.actionTriggers` lists (or the `actionTriggers` option's block, given instead) — `hoverIn` / `hoverOut` (`mouseenter` / `mouseleave`), `click` — and
presses the built-in buttons by the state rule: the state picks the lists an event is read from, and the
first list that names it wins — while playing `playback.pause` · `playback.stop` · `playback.start`; while paused
the resume (derived unless the file names it: the counterpart of each `playback.pause` event, plus the
`playback.start` events that do not also stop it) · `playback.play` · `playback.stop` · `playback.start`; while off
or returning `playback.start` · `playback.play`; while finished `playback.stop` first when the last frame is held,
otherwise `playback.start` · `playback.play` · `playback.stop`. A `playback.start` event always plays from the
start; a `playback.play` event starts or carries on (`'playback.start': 'click', 'playback.stop': 'click'` is the
start / stop click toggle). Each list names only the events
it can use; the player warns about any other event, a `playback.resume` list that differs from the
derivation and two lists colliding on one event (PX1109 – PX1111 on
[the codes page](../diagnostics.md#what-the-document-says)). HOW a stop looks is the
timeline's `actions` block. A `load` listing starts it as soon as enough of it is on screen
(`inViewThreshold`), and with the default out-of-view behavior `pause` it pauses while scrolled out
of view — a real pause: `playback.getState()` reads `paused` and `onPlaybackPause` / `onPlaybackResume` report it.
An absent block and an empty one (`{}`) both list nothing: nothing happens until you
call `playback.start()` — a file that plays by itself says `'playback.start': 'load'`. `disableActionTriggers` and
`showAsStatic` empty the lists: no event starts it. The lists, the events and the rule are on
[Playback settings & triggers → Triggers](./playback-and-triggers.md#triggers--when-it-plays).

`setupAnimationTriggers(api, config)` is exported for one rare case: you have replaced the
rendered SVG yourself, so the listeners the player attached are gone with the old elements, and
you need to attach them to the new ones.

## Engines

> **Example:** [`web/engine-modes`](../../examples/docs-examples/src/cases/web/engine-modes/) — `pnpm example:docs`, then open `#web/engine-modes`.

`animator.timeline.engine` in the document selects how the animated attributes get updated:

<!-- px-check values PxTimelineEngineSetting pkg=web -->
| Value | Behavior |
|---|---|
| `'auto'` (default) | Web Animations API, with an automatic fallback to the player's frame loop when the document animates something WAAPI cannot express (path morphing, gradient geometry, filters, text on path…). For scroll-driven documents: the browser's `ScrollTimeline` where supported, else the player measures progress itself |
| `'native'` | Web Animations API only (and the browser's `ScrollTimeline` for scroll-driven documents) |
| `'js'` | the player's frame loop only; honors `timeline.frameRate`. Required for path morphing in Safari < 18.5 |

The fallback is per document: if any animated attribute fails the runtime `CSS.supports` gate,
the whole document runs on the frame loop. Either way it plays.

## Loading several animations

> **Example:** [`web/several`](../../examples/docs-examples/src/cases/web/several/) — `pnpm example:docs`, then open `#web/several`.

To put several animations on one page — different files, or even the same JSON file more than
once — give each one its own element and call `createSvgAnimationPlayersFromPage()` once. Every element gets its own
independent player, so the copies play, pause and finish on their own.

```html
<div class="stage" data-px-document="/bouncing-ball.json"></div>
<div class="stage" data-px-document="/bouncing-ball.json"></div>
<div class="stage" data-px-document="/bouncing-ball.json"></div>
```

```js
import { createSvgAnimationPlayersFromPage } from '@pixodesk/svg-animator-web';

createSvgAnimationPlayersFromPage();

// Calling it again is safe: only elements without a player are picked up.
createSvgAnimationPlayersFromPage();
```

Showing the same JSON file twice is safe here, unlike inlining the same pre-rendered SVG twice:
each instance gives the document fresh element ids, so the copies do not clash. The same holds
from code — `createSvgAnimationPlayer` with a `container` always renders with fresh ids:

```js
// Two copies of one animation on a page — no id handling needed
import { createSvgAnimationPlayer } from '@pixodesk/svg-animator-web';

createSvgAnimationPlayer({ document: doc, container: '#first' });
createSvgAnimationPlayer({ document: doc, container: '#second' });
```

## Every player on the page (experimental)

> **Experimental.** The registry is not settled yet: the event names, what
> `getAll()` includes (the pre-rendered builds, a player whose document is still loading from a URL) and
> the `__pixodeskSvgAnimationPlayers` global may change without a major version change. Use it for dev
> tooling and tests; expect to adjust your code as new versions come out.

The players keep a page-wide registry — the same idea as lottie-web's
`getRegisteredAnimations()`. Every player built by this package (`createSvgAnimationPlayer`,
`createSvgAnimationPlayersFromPage`, the pre-rendered builds, the React and Vue components) is listed from the
moment it exists until its `destroy()`, and announces its playback changes. One registry per
window, whatever the bundling: an ESM import in one script and the UMD build in another see
the same list.

<!-- px-check signature pkg=web -->
```typescript
function getAllSvgAnimationPlayers(): ReadonlyArray<PxAnimationPlayerApi>;
function onSvgAnimationPlayersChange(listener: PxAnimationPlayersListener): () => void;

type PxAnimationPlayersEvent = 'add' | 'remove' | 'playbackStart' | 'playbackStop' | 'playbackPause' | 'playbackResume' | 'playbackFinish';
type PxAnimationPlayersListener = (event: PxAnimationPlayersEvent, animator: PxAnimationPlayerApi) => void;

interface PxAnimationPlayerRegistry {
    getAll(): ReadonlyArray<PxAnimationPlayerApi>;
    subscribe(listener: PxAnimationPlayersListener): () => void;
}
```

`getAllSvgAnimationPlayers()` returns the live players in creation order. `onSvgAnimationPlayersChange` hears
every player appear (`add`), start a playback (`playbackStart`), stop it (`playbackStop`), pause and resume inside it
(`playbackPause` / `playbackResume`), finish it (`playbackFinish`) and go (`remove`) — the event set is the callback set
(`finish` until 1.25); a player's own
`onPlaybackStart` / `onPlaybackPause` / … callbacks run first. It returns the unsubscribe.

Code that cannot import the library — a page script next to a pre-rendered SVG, whose embedded
player keeps itself to itself, or a tool's iframe — reaches the same registry by name:
`window.__pixodeskSvgAnimationPlayers.getAll()` (the name is exported as `PX_ANIMATION_PLAYER_REGISTRY_GLOBAL`).

```js
import { getAllSvgAnimationPlayers, onSvgAnimationPlayersChange } from '@pixodesk/svg-animator-web';

// Pause everything while the tab is hidden, resume what was playing when it is back.
let paused = [];
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        paused = getAllSvgAnimationPlayers().filter(a => a.playback.isPlaying());
        paused.forEach(a => a.playback.pause());
    } else {
        paused.forEach(a => a.playback.resume());
        paused = [];
    }
});

// A dev panel: how many are playing right now?
onSvgAnimationPlayersChange(() => {
    console.log(getAllSvgAnimationPlayers().filter(a => a.playback.isPlaying()).length, 'playing');
});
```

The same store is reachable **by name** as `globalThis.__pixodeskSvgAnimationPlayers` — a
`PxAnimationPlayerRegistry` with `getAll()` and `subscribe()` — for tooling that reads a page it did
not build (a devtools panel, a test harness) without importing the library. Web only: the
React Native player keeps no registry.

## Cleaning up

> **Example:** [`web/cleanup`](../../examples/docs-examples/src/cases/web/cleanup/) — `pnpm example:docs`, then open `#web/cleanup`.

Call `destroy()` when the container goes away (route change, modal close). `onDestroy` fires
once. Frameworks: the React and Vue components do this on unmount.


## API reference

The calls above are spelled out where they are used: `createSvgAnimationPlayer` and its options under
[Programmatic](#programmatic--createsvganimationplayeroptions), the returned `PxAnimationPlayerApi` under
[The playback API](#the-playback-api). The callbacks and diagnostics are one shape on every
player, written out once in [the API at a glance](./README.md#the-api-at-a-glance). `PxActionTriggersInput` is the type of
the `actionTriggers` option — the same lists the file has, `resume` included (derived when left out); `PxActionsInput`
that of the `actions` option — the file's `actions` block; `PxCommonControlProps` names the three control options every
player takes (`showAsStatic`, `disableActionTriggers`, `actionTriggers`). The rest:

<!-- px-check signature pkg=web -->
```typescript
// Scan the page for `<div data-px-document="animation.json">` and create one
// player per match, rendered into that element. Safe to call repeatedly: elements that
// already carry a player are skipped. Returns the players THIS call created. Nothing
// calls it for you. `options` — everything `createSvgAnimationPlayer` takes except `document` /
// `container` — applies to EVERY player this call creates; omit it for zero-config.
function createSvgAnimationPlayersFromPage(options?: PxPageAnimationPlayerOptions): Array<PxAnimationPlayerApi>;

// The player `createSvgAnimationPlayersFromPage` created in `element`, or `undefined`.
function getSvgAnimationPlayer(element: Element): PxAnimationPlayerApi | undefined;

// Wire a player to the DOM events its document's triggers list, behind the visibility gate.
// `createSvgAnimationPlayer` already does this from the document's own `animator.timeline`,
// and ties the disposer to `destroy()`. Use it after you have replaced the rendered SVG
// yourself (the player's listeners went with the old elements). `config` is the document's
// runtime view — `getAnimatorConfig(doc)` from core: the triggers, the actions and the gate
// numbers. To change the triggers, use the `actionTriggers` option. Returns a DISPOSER that detaches
// everything this call attached — call it before re-arming an element you wired by hand, or
// the old listeners stay live next to the new ones. `diag` is optional: omit it and anything
// this has to say goes to the console.
function setupAnimationTriggers(api: PxEngineAnimationPlayerApi, config: PxAnimatorRuntimeConfig,
                                diag?: PxDiagnostics, playbackListeners?: PxPlaybackListeners): () => void;
                                           // `playbackListeners`: the playback events (`onPlaybackStart` …) for the executor the
                                           //   triggers press — attached before a `load` trigger can fire

interface PxActionTriggers {                     // also a wire type — the JSON format page. WHEN only;
                                           //   each list is one event or an array of the events
                                           //   it may name; any other event is ignored (PX1110)
    'playback.start'?: PxTriggerEvents;            // `playback.start` — from the start, in every state it is read in;
                                           //   load · hoverIn · click; an absent block, like {}, lists
                                           //   nothing (a file that plays by itself says 'load')
    'playback.play'?: PxTriggerEvents;             // `playback.play` — start or carry on: resumes a pause, turns a
                                           //   returning picture around, starts otherwise; load · hoverIn · click
    'playback.stop'?: PxTriggerEvents;             // acts while playing, paused or finished — `playback.stop`; hoverOut · click
    'playback.pause'?: PxTriggerEvents;            // acts while playing — freeze; hoverIn · hoverOut · click
    'playback.resume'?: PxTriggerEvents;           // acts while paused — carry on; DERIVED unless the file names it
                                           //   (each pause event's counterpart + the playback.start events that do
                                           //   not stop); a named list is honoured, differences noted (PX1111)
}
```

**Builds.** The ESM and CJS entries (`dist/index.js`, `dist/index.cjs`) carry everything on this
page. The `<script>` builds put a smaller set of functions on one global, `window.Pixodesk.SvgAnimator`
(the files themselves: [Installing the players](./installation.md#builds--esm-cjs-and-umd)):

<!-- px-check off the UMD file list, prose -->
| File | For | On `Pixodesk.SvgAnimator` |
|---|---|---|
| `pixodesk-svg-animator.umd.min.js` | a page playing JSON documents | `create` (= `createSvgAnimationPlayer`), `bind` (= `bindSvgAnimationPlayer`), `createSvgAnimationPlayersFromPage`, `setupAnimationTriggers`, `validateDocument`, `generateNewIds`, `PxTimelineEngineSetting`, `PxTimelineEngine`, `PX_ANIMATOR_DOC_KEY`, `PX_ANIM_ATTR_NAME`, `PX_DOCUMENT_ATTR_NAME` |
| `index.prerendered.umd.min.js` | a pre-rendered SVG + JS export (engine `auto` / `js`) | `bind(options: PxPrerenderedAnimationPlayerOptions)`, `setupAnimationTriggers`, `PX_ANIMATOR_DOC_KEY` |
| `index.prerendered-waapi.umd.min.js` | the same with engine `native` — the smallest build | the same as the line above |

`PxPrerenderedAnimationPlayerOptions` is `{ document: PxDocumentJson }` plus the three control options
(`showAsStatic`, `disableActionTriggers`, `actionTriggers` — `PxCommonControlProps`) and the inline callbacks (`doc`
until 1.25). With no control option the file's own triggers play it, as the editor's SVG + JS export expects. Its
`document` carries only `animator.definitions` and `animator.bindings` — the SVG is already in the page — and it is
not validated. It is inline only: there is no URL form.

<!-- px-check signature pkg=web -->
```typescript
// Bind a pre-rendered SVG that is already on the page — what an SVG + JS export's script calls,
// as `Pixodesk.SvgAnimator.bind(…)`. Every build has it; only the full build also has `create`.
function bindSvgAnimationPlayer(options: PxPrerenderedAnimationPlayerOptions): PxAnimationPlayerApi;
```

**Globals.** Importing the player writes nothing to `window`. `<script>` pages reach the player's
functions through `Pixodesk.SvgAnimator.*` on the UMD build — `createSvgAnimationPlayer` is the member `create`
there and `bindSvgAnimationPlayer` the member `bind`; ESM and CJS consumers import what they need. To drive a live instance from the console, use the page registry —
[Every player on the page](#every-player-on-the-page-experimental).

**Everything else this package exports** — ● user-facing · ○ advanced · ▪ internal, as in
[the API at a glance](./README.md#the-api-at-a-glance). Names marked **`/engine`** come from
`@pixodesk/svg-animator-web/engine`, the entry for player authors:

<!-- px-check exports @pixodesk/svg-animator-web -->
| Identifier | Audience · what it is for |
|---|---|
| `createSvgAnimationPlayer(options)`, `bindSvgAnimationPlayer(options)`, `createSvgAnimationPlayersFromPage(options?)`, `getSvgAnimationPlayer(element)`, `setupAnimationTriggers(api, config, diag?)` | ● the player — above |
| `getAllSvgAnimationPlayers()`, `onSvgAnimationPlayersChange(listener)`, `PxAnimationPlayerRegistry`, `PxAnimationPlayersEvent`, `PxAnimationPlayersListener`, `PX_ANIMATION_PLAYER_REGISTRY_GLOBAL` | ● **experimental** — [every player on the page](#every-player-on-the-page-experimental): the window-wide registry, also `globalThis.__pixodeskSvgAnimationPlayers` (that name: `PX_ANIMATION_PLAYER_REGISTRY_GLOBAL`); not settled, may change without a major version |
| `createAdapterSvgAnimationPlayer(doc, adapter, callbacks?)` | ○ **`/engine`** · the frame-loop engine against a custom `PxPlatformAdapter` — see [the core library](../format/README.md#core-library--pixodesksvg-animator-core) |
| `PxInternalAnimationPlayerOptions` | ▪ `PxAnimationPlayerOptions` plus `adapter` — the frame loop's custom render target (`PxPlatformAdapter`: `isConnected()` + `setAttribute(id, name, value)`). What the React and Vue components build the player with, so writes go to the elements they rendered; not an option of the public API, because a page has a DOM to write to |
| `renderNode(node, defs?, diag?)` → `toDomProps(props)` | ○ **`/engine`** · render one wire node to a DOM element / resolve a node's attributes. `diag` is optional — without it a blocked tag is reported on the console |
| `validateDocument(doc)` | ● the whole-document check — see [the core library](../format/README.md#core-library--pixodesksvg-animator-core) |
| `generateNewIds` | ○ document tooling — see [the core library](../format/README.md#core-library--pixodesksvg-animator-core) |
| `PX_ANIMATOR_DOC_KEY` | ▪ attribute and property names the player writes |
| `PX_PLAYER_GLOBAL`, `PX_PLAYER_CREATE`, `PX_PLAYER_BIND` | ▪ the `<script>` builds' global (`'Pixodesk.SvgAnimator'`) and its two members, `'create'` and `'bind'` — the editor's SVG + JS export builds its call from them |
| `createVisibilityGate(root, gate, host)`, `PxVisibilityGate`, `PxGateHost` | ▪ the gate `setupAnimationTriggers` wires for every document — it opens at `inViewThreshold`, closes only at zero visibility, waits out `inViewDebounce` and treats a hidden tab as off screen; `gate` is core's `resolveGate(view)`, the host's verbs `leaveView` / `returnToView` (the executor presses the real buttons, and undoes only what it did). Exported so the CSS-only React and Vue wrappers gate on the same rules rather than each growing their own observer |
| `px`, `PxNodeBaseSchema`, `PxSvgNodeRootSchema`, `PxAnimatorConfigSchema`, `PxActionTriggersSchema`, `PxActionsSchema`, `PxScrollSchema`, `PxDefinitionsSchema`, `PxSchema`, `PxInfer`, `PxValidationContext` | ○ the schema toolkit, re-exported from core — the schema values and the types to build on them |
| `PxDiagnosticsConfig`, `PxDiagnostic`, `PxDiagnosticKind` | ● the diagnostics every player shares — re-exported for the React and Vue components; spelled out in [the API at a glance](./README.md#the-api-at-a-glance) |
| `PxTimelineEngineSetting`, `PxFillMode`, `PxPlaybackDirection`, `PxTriggerEvent`, `PxTriggerEvents`, `PxStopPlaybackBehavior`, `PxWhenFinished`, `PxOutOfViewBehavior`, `PxWhenIdle` | ● named wire values — one const per wire enum, with the string type derived from it under the same name (`PxTriggerEvent.click` and `"playback.start"?: PxTriggerEvents` come from one import). `PxTimelineEngineSetting` is what `timeline.engine` accepts (`auto` · `native` · `js`); `PxTimelineEngine` is the resolved engine (`native` · `js`), the argument of `materializeAllInTree`, never an option. `PxFillMode` is the engines' CSS-style fill mode derived from `whenIdle` + `whenFinished`, not a wire key |
| `PxDocument`, `PxNode`, `PxSvgNode`, `PxAnimatorConfig`, `PxActionTriggers`, `PxActions`, `PxBinding`, `PxDefinitions` | ● wire types — the shapes in [the JSON format](../format/README.md#schema-at-a-glance) |
| `PxAnimationPlayerOptions`, `PxPageAnimationPlayerOptions`, `PxAnimationPlayerApi`, `PxPlaybackControls`, `PxAnimationPlayerCallbacks`, `PxEngineCallbacks`, `PxPlaybackOverride`, `PxCommonControlProps`, `PxTimelineOptions`, `PxTimelineTiming`, `PxActionsInput`, `PxPlatformAdapter` (`/engine`) | ● companion types of the calls above. `PxCommonControlProps` is the three control options (`showAsStatic`, `disableActionTriggers`, `actionTriggers`); `PxTimelineTiming` is the timeline minus its `actionTriggers` and `actions`; `PxTimelineOptions` (the `timelineOptions` option) is its recursive partial, `PxActionsInput` (the `actions` option) the whole `actions` block |
| `PxPlaybackOverrideInput`, `PxPlayExecutor` | ○ the override as `applyPlaybackOverride` reads it (`timelineOptions`, `actions` + `actionTriggers`), and the player's one executor of the built-in actions — [Playback settings & triggers → For player authors](./playback-and-triggers.md#for-player-authors--the-same-rules-exported) |

**Core only**: `prepareDocument` / `nestAnimatorTimeline`, the engine rules
(`resolveTimelineEngine`, …) and the scroll maths.

## Related

- [Playback settings & triggers](./playback-and-triggers.md) — every `animator` field and how to override it
- [JSON format reference](../format/README.md#json-format-reference)
- [Troubleshooting](./troubleshooting.md)

[← Installing the players (overview)](./installation.md) · [Contents](../../README.md#documentation) · Next: [React →](./react.md)
