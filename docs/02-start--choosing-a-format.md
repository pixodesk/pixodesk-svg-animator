# Choosing a format

[← Introduction](./01-start--introduction.md) · [Contents](./README.md) · Next: [The editor →](./03-editor--editor.md)

As the [Introduction](./01-start--introduction.md) covered, the editor saves an animation in
one of two formats: **JSON**, which a player library renders, or **pre-rendered SVG**, which a
browser plays on its own. This page is about picking between them — and, for pre-rendered SVG,
between its three flavours.

Both are the same document in a different shape. You can switch at any time —
**File → Save as JSON / Save as SVG** — so the choice is never final.

## The formats at a glance

| Format | File | What is inside | Needs a library? |
|---|---|---|---|
| **JSON** ("Pixodesk JSON") | `.json` | the SVG tree + animation data + editor metadata | yes — a player renders it |
| **Pre-rendered SVG + CSS animation** | `.svg` | ordinary SVG + a `<style>` with `@keyframes` | no |
| **Pre-rendered SVG + CSS animation + JS triggers** | `.svg` | the above + a tiny `<script>` that starts/stops it on hover, click or scroll | no (the script is inline) |
| **Pre-rendered SVG + JS animation** | `.svg` | ordinary SVG + the web player embedded in a `<script>` (~25–35 KB) | no (the player is inline) |

The editor can also export **Lottie** (`.json` / `.lottie`), **video**, **GIF** and **image**
snapshots — see [The editor → Save, convert, export](./03-editor--editor.md#save-convert-export).

## The decision, short version

**Default to JSON** when you write code (React, Vue, React Native, vanilla JS with runtime
control).   
**Use a pre-rendered SVG** when you just want to drop a file in CMS or static site with minimal setup —
and you need each file **once per page** ([why](./11-player--prerendered-svg.md#one-copy-of-a-file-per-page)).

| Situation | Pick |
|---|---|
| React / Vue / Next.js / Nuxt app | **JSON** with the framework component — SSR-safe, full runtime control, every animation type. *Or* a **CSS-flavour SVG** imported like an icon (SVGR / `vite-svg-loader`) when you only need it to play, not to be controlled |
| Vanilla JavaScript page, you want play/pause/seek from code | **JSON** + the web player |
| Static site generator or CMS (Astro, Jekyll, WordPress, Shopify, Webflow…) | **any pre-rendered SVG** — the platform inlines the file; even the flavours with a `<script>` just work when inlined |
| Loader / icon / decorative loop, no interaction | **SVG + CSS animation** — smallest, zero JavaScript |
| Start on hover / click / scroll without writing code | **SVG + CSS + JS triggers** |
| Content must be visible before any JavaScript runs, but the animation uses path morphing or another CSS-unsupported feature | **SVG + JS animation** |
| Several copies of the same animation on one page | **JSON** — each instance gets fresh element ids; inlined SVGs can collide on ids |

### Pros and cons

| Format | Advantages | Limitations |
|---|---|---|
| **JSON** | Every animation type on every browser · full runtime control (play, pause, seek, reverse, speed) · clean per-instance rendering, no id conflicts · SSR-safe | Needs a player package · two things to wire together (file + component) |
| **SVG + CSS** | No library, smallest file · no `<script>`, so it works inline and through SVGR · drop-in icon replacement | Only what CSS `@keyframes` can express (table below) · path morphing in Chrome/Firefox/Edge only, and only between same-structure paths · no runtime control · **id conflicts if inlined twice** ([one copy per page](./11-player--prerendered-svg.md#one-copy-of-a-file-per-page)) |
| **SVG + CSS + JS triggers** | Same as above plus event-driven start/stop (hover, click, scroll into view) | Same CSS limits · no precise control (seek, reverse, speed) · the `<script>` prevents SVGR use · **id conflicts if inlined twice** ([one copy per page](./11-player--prerendered-svg.md#one-copy-of-a-file-per-page)) |
| **SVG + JS animation** | Every animation type · full runtime control · self-contained | Embeds the player (~25–35 KB) · the `<script>` prevents SVGR use · possible id conflicts if inlined twice |

## What each engine can animate

The JSON format is played by one of two engines: the **Web Animations API** (native, very
smooth) or a **frame loop** (`requestAnimationFrame`, universal). With the default `mode:
'auto'` the player picks WAAPI and **falls back to frames automatically** whenever the
document animates something WAAPI cannot express — so in JSON every row below *just works*.
The columns tell you which mechanism drives it and, more importantly, what the **CSS
flavour** cannot do.

| Animation type | SVG + CSS `@keyframes` | Web Animations API | Frame loop |
|---|---|---|---|
| Numeric attributes (opacity, stroke-width…) | ✅ | ✅ | ✅ |
| Position (x, y, cx, cy, r, rx, ry) | ✅ ¹ | ✅ ¹ | ✅ |
| Size (width, height) | ✅ ¹ | ✅ ¹ | ✅ |
| Transform (translate, rotate, scale, skew) | ✅ | ✅ | ✅ |
| Colours (fill, stroke) | ✅ | ✅ | ✅ |
| Path morphing (`d`) | ⚠️ Chrome / Firefox / Edge ² | ❌ | ✅ |
| Stroke dash (draw-on) | ✅ | ✅ | ✅ |
| Gradient stops | ⚠️ colour only ³ | ❌ | ✅ |
| Gradient geometry | ❌ | ❌ | ✅ |
| Filters (blur, brightness…) | ❌ | ❌ | ✅ |
| Clip-path / mask morphing | ❌ | ❌ | ✅ |
| Text on a path (`startOffset`) | ❌ ⁴ | ❌ | ✅ |
| Performance | ⚡ excellent | ⚡ excellent | good |
| Browser support | universal | modern browsers | universal |

¹ Geometry as CSS properties works in Chromium and WebKit; **Firefox does not implement it** —
use JSON (frames fallback) when cross-browser geometry animation matters.
² CSS `d: path()` needs identical path command structure across keyframes; unavailable in
Safari before 18.5.
³ Per-stop `stop-color` animates via CSS; stop `offset` and gradient geometry cannot be
expressed in CSS at all.
⁴ The static text-on-path layout renders everywhere; only animating `startOffset` /
`textLength` is impossible in CSS.

The editor warns you as you go: an attribute the chosen SVG flavour cannot animate is flagged
on its timeline row and in the file-type picker, so you never find out after export.

### Engine pros and cons

| Engine | Advantages | Limitations |
|---|---|---|
| **CSS `@keyframes`** | No JavaScript at all · the browser runs it natively, with transforms and opacity on the compositor · nothing to load | The smallest feature set (❌ rows above) · geometry properties do not animate in Firefox · no runtime control beyond toggling classes |
| **Web Animations API** | Native and very smooth — transforms and opacity off the main thread · full runtime control · no per-frame JavaScript work | Cannot express structural changes: path morphing, gradient geometry, filters, masks, text on a path · modern browsers only |
| **Frame loop** | Every animation type, in every browser · full runtime control · the only engine for path morphing in older Safari | Writes attributes from JavaScript every frame, so it shares the main thread with your page · runs uncapped unless you set `frameRate` · still fast, but WAAPI stays smoother when the page is busy |

In JSON you rarely choose: `mode: 'auto'` uses WAAPI and switches to the frame loop only for
what WAAPI cannot do. The choice that matters is the pre-rendered one — **SVG + CSS** locks
you to the first row.

## Converting between formats

Any time: open the document and **File → Save as JSON** or **Save as SVG**. The JSON keeps the
editor's parametric information (shape presets, effects), so it is the best archival format;
the pre-rendered SVG is the derived, ready-to-ship one.

[← Introduction](./01-start--introduction.md) · [Contents](./README.md) · Next: [The editor →](./03-editor--editor.md)
