# docs-examples

One standalone page per case in the [documentation](../../README.md#documentation), and a browser to
step through them. Web player, React, Vue, playback overrides, pre-rendered SVG and a
static-site page — all in one Vite project.

```bash
pnpm example:docs          # dev server with the case browser
pnpm example:docs:build    # static site in dist/ — host it anywhere
pnpm example:docs:test     # Playwright: every case loads clean and does what it says
```

## Addressing a case

The browser (`index.html`) keeps the selected case in the URL hash, so every case has a
stable address the docs link to: `#react/autoplay`, `#prerendered/inline-css`, …

Each case is also a plain page of its own at `src/cases/<group>/<id>/index.html` — open it
directly, view source, copy it.

## Adding a case

1. Add a folder under `src/cases/<group>/<id>/` with an `index.html` (and a `main.ts` /
   `main.tsx` if it needs a script).
2. Register it in [`cases.mjs`](cases.mjs) — that one entry adds it to the Vite build, to the
   browser's sidebar, and to the test suite.
3. If "it animates" is not the right check, add a specific one to
   [`e2e/cases.spec.ts`](./e2e/cases.spec.ts).

## Not covered

**SVG + CSS + JS triggers** (pre-rendered flavour 2) has no case: its trigger script is
produced by the editor's export, and nothing in this repo generates it. Full coverage is not a
goal; the docs describe it in [Pre-rendered SVG → Flavour 2](https://pixodesk.com/docs/svga/prerendered-svg/on-the-web#flavour-2--svg--css-animation--js-triggers).

## How the tests gate the build

`test` builds the site and runs Playwright against the built output. In `turbo.json`, `build`
depends on `test`, so `pnpm build` at the repo root fails if any case fails — no release can
ship with a broken example.
