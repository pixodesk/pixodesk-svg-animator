# Troubleshooting & FAQ

[← Core library](./16-format--core-library.md) · [Contents](./README.md) · Next: [Glossary →](./18-help--glossary.md)

Find your symptom below — each entry says what to check and what to change. If yours is not
here, go to [Still stuck?](#still-stuck) at the end.

## Nothing plays

**The trigger is not "on load".** Check `animator.trigger.startOn` in the file (or the *Start*
setting in the editor). `click` / `mouseOver` / `scrollIntoView` wait for the user;
`programmatic` waits for you to call `play()`. In React/Vue, remember that `autoplay` is the
only mode that uses the document's trigger — with `play`, `apiRef`, `time` etc. the trigger is
switched to programmatic.

**React / Vue component with no control prop.** With none of `autoplay` / `play` / `pause` /
`apiRef` / `time` / `timeMs` set, the component deliberately renders the first frame and does
nothing. Add `autoplay`.

**`loadTagAnimators()` ran before the elements existed.** Call it after the DOM is ready (end of
`<body>`, `DOMContentLoaded`), and call it again after inserting content dynamically — it only
creates animators for elements that do not have one yet.

**`createAnimator({ src })` — the file did not load.** Look in the console: the player logs
`createAnimator: failed to load "…"` or `invalid animation document format`. The JSON must have
`"type": "svg"` at the root. Calls made before the load finishes are queued, so `play()` is
not lost — a network or CORS error is the usual cause.

**Scroll trigger never fires.** The element may already be fully in view at load (then it
starts immediately), or `scrollIntoViewThreshold` may be higher than the element can ever
reach on a small viewport. Inside an `<iframe>`, visibility is measured relative to the iframe.

## It plays in Chrome but not in Firefox / Safari

**Geometry attributes in a CSS-flavour SVG (x, y, r, width, …).** Firefox does not implement
SVG geometry as CSS properties. Use the JSON format (the frame-loop fallback handles it), or
animate `transform` instead of `x`/`y`.

**Path morphing in a CSS-flavour SVG.** CSS `d: path()` needs identical command structure and is
missing in Safari < 18.5. Use JSON (`mode: 'auto'` falls back to frames) or the *SVG + JS
animation* flavour.

**Text on a path, gradient geometry, filters, clip-path morphing.** Not expressible in CSS at
all; JSON + a player handles them via the frame loop. The editor flags every such attribute in
the file-type picker before you export.

## The CSS-flavour SVG works, the JS flavours don't

**`<img src="animation.svg">` and SVGR strip or ignore `<script>`.** Only the pure CSS flavour
animates as an image or through SVGR / `vite-svg-loader`. Inline the scripted flavours as raw
HTML (see [Static sites & CMS](./12-player--static-sites-and-cms.md)), or switch to JSON.

**Content Security Policy.** Inline scripts may be blocked by your CSP. Use the CSS flavour, or
JSON with the player loaded from your own origin.

## Two copies of the same SVG interfere with each other

Inlining one file twice duplicates its element ids, so masks, gradients and JS bindings can
point at the wrong copy. Export the file twice (each export gets fresh ids), or use the JSON
format — each player instance regenerates ids.

## React

**The animation restarts when the parent re-renders.** The animator is recreated only when the
`doc` *content* changes (the comparison is deep), so a re-created but identical object is fine.
Restarts usually come from a `doc` that really is different each render — for example built
inline with a changing value. Build the document once (module level or `useMemo`).

**Console: `setAttribute: No elements found for selector "#…"` on unmount.** Cosmetic — a
late frame after teardown. Safe to ignore.

**`onCancel` / `onRemove` / `onStop` fire when I swap `doc`.** Expected: the old animator is
torn down and reports it.

**Next.js: "useRef is not a function" / hooks error.** The component must be used from a client
component — add `'use client'` at the top of the file that renders it.

## TypeScript

**`Type '…' is not assignable to type 'PxAnimatedSvgDocument'` when importing JSON.** Cast
once: `const doc = animation as PxAnimatedSvgDocument;` — JSON imports are typed structurally
and a string field such as `"mode": "auto"` widens to `string`. Enable `resolveJsonModule`.

## React Native

**`View config getter callback for component 'RNSVGLine' must be a function`.** Two copies of
`react-native-svg` (or reanimated / react) in your node_modules — see
[Monorepo setup](./09-player--react-native.md#monorepo-setup).

**Nothing renders, no error.** Pass `onError` — a document that fails to compile is reported
there and replaced by `fallback` (nothing by default).

**The app crashes on text along a closed path.** A native `react-native-svg` bug the player
works around on device; if you hit it, keep `startOffset` at 0 on closed paths or use an open
path. Details in [React Native → Known limitations](./09-player--react-native.md#known-limitations).

**Hover does nothing.** `mouseOver` has no touch equivalent; use `click` or drive `play`
yourself.

## Playback behaviour

**It holds the last frame — I want it to reset.** Set `resetOnFinish: true`, or `fill:
'none'` (see [Playback settings](./10-player--playback-and-triggers.md#timing)).

**How do I play backwards?** `animator.setPlaybackRate(-1); animator.play();` — also as a
trigger out action (`outAction: 'reverse'`).

**Seeking while playing.** `setCurrentTime(ms)` works while playing (continues from the new
position) and while paused (scrubbing).

**Frame rate.** `frameRate` applies only to the frames engine; WAAPI runs at the display rate.
React Native always runs at the display rate.

**A property does not animate under `mode: 'waapi'`.** WAAPI cannot drive it (the console
says which); leave `mode` on `auto` so the document switches to the frame loop.

## Fonts look different on the viewer's machine

Switch the text to **glyph mode** in the editor (`effects.text.useGlyphs`): the used glyph
outlines are embedded in the file and render identically everywhere, with no font to load.

## Still stuck?

- [Repository issues](https://github.com/pixodesk/pixodesk-svg-animator/issues) — include the
  JSON (or the SVG), the package version and the browser / platform.
- The [runnable examples](../examples/) show every control mode working end to end.

[← Core library](./16-format--core-library.md) · [Contents](./README.md) · Next: [Glossary →](./18-help--glossary.md)
