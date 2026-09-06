# animator-web

> 📖 Full user guide: [docs/library/web-player.md](../../docs/library/web-player.md) · [all docs](../../README.md#documentation)

[![CI](https://github.com/pixodesk/pixodesk-svg-animator/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/pixodesk/pixodesk-svg-animator/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A lightweight JavaScript library for playing SVG animations in the browser. Pixodesk Animator runs animations created in the Pixodesk editor using the Web Animations API or requestAnimationFrame. It supports event triggers such as click, hover, and scroll. The library ships as ESM, CJS, and UMD bundles.


# 🚧 **Status - This project is currently under development.**

## Usage

### Embed/Inline SVG with animation

```html
<body>
  <svg width="200" height="200" viewBox="0 0 200 200">
    <!-- animation here -->
  </svg>
</body>
```

#### CSS Keyframes

```html
<body>
  <svg width="200" height="200" viewBox="0 0 200 200">
    <!-- animation here -->
  </svg>
</body>
```

#### JS


### Declarative (HTML)

Add a `data-px-animation-src` attribute to any element pointing to your animation JSON file, then call `loadTagAnimators()`:

```html
<div data-px-animation-src="/animation.json"></div>

<!-- UMD -->
<script src="pixodesk-svg-animator.umd.js"></script>
<script>
  PixodeskAnimator.loadTagAnimators();
</script>
```

Each element gets an animator instance stored on `element._px_animator`, which you can use for playback control.

### Programmatic

Use `createAnimator` for full control:

```js
import { createAnimator } from '@pixodesk/svg-animator-web';

// From a URL — returns a proxy immediately; control calls made before the
// document loads are queued and replayed once it's ready
const animator = createAnimator({
  src: '/animation.json',
  container: '#container',
  callbacks: { onFinish: () => console.log('done') },
});

// Or from an already-loaded document object
const animator = createAnimator({ data: animationDoc, container: '#container' });

animator.play();
animator.pause();
animator.setCurrentTime(500);   // jump to 0.5 s from the start
animator.setPlaybackRate(2);    // 2x speed (-1 plays in reverse)
animator.finish();              // jump to end
animator.destroy();             // cleanup
```

### API

`createAnimator(options)` takes a single options object:

| Option | Type | Description |
| ----------- | ------------------------- | -------------------------------------------------- |
| `src`       | `string`                  | URL to fetch the animation document from (provide either `src` or `data`) |
| `data`      | `PxAnimatedSvgDocument`   | Inline animation document object                    |
| `container` | `string \| Element`       | CSS selector or element to render the SVG into      |
| `callbacks` | `PxAnimatorCallbacksConfig` | Lifecycle callbacks (see below)                   |
| `adapter`   | `PxPlatformAdapter`       | Custom attribute-writer for frame-loop rendering (advanced) |

It returns a `PxAnimatorAPI`:

| Method                  | Description                                                       |
| ----------------------- | ----------------------------------------------------------------- |
| `play()`                | Start or resume playback                                          |
| `pause()`               | Pause at the current time                                         |
| `cancel()`              | Stop and reset to the start                                       |
| `finish()`              | Jump to the end                                                   |
| `setPlaybackRate(rate)` | Change speed (1 = normal, 2 = double, -1 = reverse)               |
| `getCurrentTime()`      | Current time in ms                                                |
| `setCurrentTime(ms)`    | Jump to a point in the animation, in milliseconds from its start |
| `isPlaying()`           | Whether the animation is currently playing                        |
| `isReady()`             | Whether the document has loaded (relevant for URL-based creation) |
| `getRootElement()`      | The rendered SVG DOM element                                      |
| `destroy()`             | Remove the animation and clean up                                 |

### Callbacks

```js
createAnimator({
  data: doc,
  container: '#container',
  callbacks: {
    onPlay:   () => { /* started/resumed */ },
    onPause:  () => { /* paused */ },
    onCancel: () => { /* cancelled */ },
    onFinish: () => { /* finished naturally (or via finish()) */ },
    onRemove: () => { /* destroyed / cleaned up */ },
  },
});
```

### Engine modes

`animator.mode` selects the playback engine:

- `'auto'` (default) — try the Web Animations API, fall back to `requestAnimationFrame`.
- `'waapi'` — Web Animations API only.
- `'frames'` — `requestAnimationFrame` only; honours `animator.frameRate`. Required for path morphing.

### Document format & effects

The `doc` passed to `createAnimator` is a `PxAnimatedSvgDocument` (`type: 'svg'`), the
same shape as the JSON export. It comes in two modes:

- **Self-contained document** — has `children`: the player renders the SVG tree and animates it.
- **Bind-by-id document** — no `children`: the player animates a pre-existing SVG DOM, mapping
  element ids to animation specs via `animator.animateById`.

Elements may also carry a `node.effects` bucket (structural effects such as
`transformBy`, `repeater`, `maskedBy`, `strokeTrim`, `clone`, `fillGradient` /
`strokeGradient`, `textPath`). This player materialises and removes them at
runtime before any other normalisation.

See the [JSON format reference](../../docs/format/README.md#json-format-reference) and
[Player effects](../../docs/format/README.md#player-effects) for the full schema and
examples (compact printable schema: [SCHEMA.md](../../SCHEMA.md)). The wire
types live in [`PxAnimatorTypes.ts`](../svg-animator-core/src/PxAnimatorTypes.ts).

