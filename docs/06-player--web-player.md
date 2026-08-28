# Web player — `@pixodesk/svg-animator-web`

[← Installing the players (overview)](./05-player--installation.md) · [Contents](./README.md) · Next: [React →](./07-player--react.md)

Use this on a plain web page — or anywhere you write JavaScript without a framework — to play
a JSON animation with full control. Hand it the document and it builds the SVG DOM, drives the
animation with the Web Animations API or a frame loop, and wires up hover / click / scroll
triggers for you. It ships as ESM, CJS and UMD (global `PixodeskAnimator`), so it fits a
bundler or a plain `<script>` tag equally well.

```bash
npm install @pixodesk/svg-animator-web
```

## Two ways to use it

### Declarative — `data-px-animation-src`

> **Example:** [`web/declarative`](../examples/docs-examples/src/cases/web/declarative/) — `pnpm example:docs`, then open `#web/declarative`.

Point an element at the JSON file and call `loadTagAnimators()` once the DOM is ready. The
script is the UMD build, copied from the npm package into your site — see
[Installing the players (overview)](./05-player--installation.md#without-a-bundler--the-umd-build):

```html
<div data-px-animation-src="/animation.json" style="width: 400px; height: 300px"></div>

<script src="/js/pixodesk-svg-animator.umd.min.js"></script>
<script>PixodeskAnimator.loadTagAnimators();</script>
```

Every matching element gets its own animator, stored on the element as `element._px_animator`
(the [playback API](#the-playback-api) below). Calling `loadTagAnimators()` again only picks up
elements that do not have one yet, so it is safe to call after inserting new content.

### Programmatic — `createAnimator(options)`

> **Example:** [`web/programmatic`](../examples/docs-examples/src/cases/web/programmatic/) — `pnpm example:docs`, then open `#web/programmatic`.

```js
import { createAnimator } from '@pixodesk/svg-animator-web';

// from a URL — returns immediately; control calls made before the file loads are
// queued and replayed in order once it is ready
const animator = createAnimator({
  src: '/animation.json',
  container: '#hero',
  callbacks: { onFinish: () => console.log('done') },
});

// or from an already-loaded document object
const animator2 = createAnimator({ data: animationDoc, container: document.getElementById('hero') });

animator.play();
```

#### Options

| Option | Type | Description |
|---|---|---|
| `src` | `string` | URL of the JSON document. Provide **either** `src` **or** `data` |
| `data` | `PxAnimatedSvgDocument` | the document object |
| `container` | `string \| Element` | CSS selector or element the SVG is rendered into |
| `callbacks` | `PxAnimatorCallbacksConfig` | lifecycle callbacks, see [Callbacks](#callbacks) |
| `adapter` | `PxPlatformAdapter` | advanced — a custom attribute writer for the frame loop (this is how the React and Vue packages route updates through their own DOM refs) |

The document's own `animator` settings (duration, iterations, trigger, engine mode…) apply as
saved by the editor. To override them, change the object before passing it as `data` — see
[Playback settings & triggers](./10-player--playback-and-triggers.md).

## The playback API

`createAnimator` returns a `PxAnimatorAPI`:

| Method | Description |
|---|---|
| `play()` | start, or resume from the current time. On a finished animation, rewinds and plays again |
| `pause()` | pause at the current time |
| `cancel()` | stop and reset to the start state |
| `finish()` | jump to the end and hold the final state |
| `setPlaybackRate(rate)` | speed: `1` normal, `2` double, `0.5` half, **negative plays in reverse** |
| `getCurrentTime()` | current time in ms (`null` before a `src` document has loaded) |
| `setCurrentTime(ms)` | seek. Works while paused (scrubbing) or playing |
| `isPlaying()` | `true` while running |
| `isReady()` | `true` once a `src` document has loaded and rendered |
| `getRootElement()` | the rendered `<svg>` element (`null` before ready) |
| `destroy()` | stop, remove the SVG from the container, release everything |

```js
const slider = document.querySelector('#scrub');
slider.addEventListener('input', () => {
  animator.pause();
  animator.setCurrentTime(Number(slider.value));   // 0 … duration (ms)
});
```

## Callbacks

> **Example:** [`web/callbacks`](../examples/docs-examples/src/cases/web/callbacks/) — `pnpm example:docs`, then open `#web/callbacks`.

```js
createAnimator({
  data: doc,
  container: '#box',
  callbacks: {
    onPlay:   () => {},   // started or resumed
    onPause:  () => {},   // paused
    onCancel: () => {},   // cancelled (reset)
    onFinish: () => {},   // finished naturally, or finish() was called
    onRemove: () => {},   // destroyed
  },
});
```

## Triggers

> **Example:** [`web/triggers`](../examples/docs-examples/src/cases/web/triggers/) — `pnpm example:docs`, then open `#web/triggers`.

If the document says `trigger.startOn: 'click'` (or `mouseOver`, `scrollIntoView`), the player
wires the event on the rendered SVG for you; `outAction` (continue / pause / reset / reverse)
and `scrollIntoViewThreshold` are honoured. With `'load'` it starts immediately; with
`'programmatic'` nothing happens until you call `play()`.

`setupAnimationTriggers(api, triggerConfig)` is exported for the rare case where you replace
the rendered content and need to re-arm the listeners.

## Engine modes

> **Example:** [`web/engine-modes`](../examples/docs-examples/src/cases/web/engine-modes/) — `pnpm example:docs`, then open `#web/engine-modes`.

`animator.mode` in the document selects the engine:

| Mode | Behaviour |
|---|---|
| `'auto'` (default) | Web Animations API, with an automatic fallback to the frame loop when the document animates something WAAPI cannot express (path morphing, gradient geometry, filters, text on path…) |
| `'waapi'` | Web Animations API only |
| `'frames'` | frame loop only; honours `animator.frameRate`. Required for path morphing in Safari < 18.5 |

The fallback is per document: if any animated attribute fails the runtime `CSS.supports` gate,
the whole document runs on the frame loop. Either way it plays.

## Loading several animations

> **Example:** [`web/several`](../examples/docs-examples/src/cases/web/several/) — `pnpm example:docs`, then open `#web/several`.

```js
const animators = [...document.querySelectorAll('.anim')].map(el =>
  createAnimator({ src: el.dataset.src, container: el })
);
animators.forEach(a => a.play());
```

Each instance regenerates the document's element ids, so many copies of the same file coexist
on one page without id conflicts.

## Cleaning up

> **Example:** [`web/cleanup`](../examples/docs-examples/src/cases/web/cleanup/) — `pnpm example:docs`, then open `#web/cleanup`.

Call `destroy()` when the container goes away (route change, modal close). `onRemove` fires
once. Frameworks: the React and Vue components do this on unmount.

## TypeScript

The package re-exports every document type from the core — `PxAnimatedSvgDocument`, `PxNode`,
`PxAnimatorConfig`, `PxTrigger`, `PxKeyframe`, `PxPropertyAnimation`, … — plus `PxAnimatorAPI`,
`PxAnimatorOptions` and `PxAnimatorCallbacksConfig`.

```ts
import { createAnimator, type PxAnimatorAPI, type PxAnimatedSvgDocument } from '@pixodesk/svg-animator-web';
```

## Advanced exports

For tooling, the package also re-exports the core's document utilities (`materialiseAllInTree`,
`applyPlayerEffects`, `calcAnimationValues`, `generateNewIds`, validation schemas, the glyph
text materialiser, …). They are documented in [Core library](./16-format--core-library.md).

## Related

- [Playback settings & triggers](./10-player--playback-and-triggers.md) — every `animator` field and how to override it
- [JSON format reference](./14-format--json-format.md)
- [Troubleshooting](./17-help--troubleshooting.md)

[← Installing the players (overview)](./05-player--installation.md) · [Contents](./README.md) · Next: [React →](./07-player--react.md)
