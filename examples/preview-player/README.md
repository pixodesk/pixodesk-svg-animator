# Pixodesk SVG Animator — Preview Player example

A single-page preview player that demonstrates all three runtime packages side by side:

- **Web** — `@pixodesk/svg-animator-web` (`createAnimator`)
- **React** — `@pixodesk/svg-animator-react` (`<PixodeskSvgAnimator/>`)
- **Vue** — `@pixodesk/svg-animator-vue` (`<PixodeskSvgAnimator/>`)

## Features

- **Choose player:** switch between the Web, React and Vue implementations at runtime.
- **Drop area:** drag-and-drop any Pixodesk animation `.json` document onto the page to play it.
- **Light/dark theme:** toggle the theme; the choice is saved to `localStorage`.
- **Transport controls:** Play, Pause, Stop (reset to start), Restart, Finish (jump to end).
- **Time slider:** shows the current playback time and lets you scrub.
- **Playback rate:** speed control (Web player only).

The stage starts empty; use **Load demo** to load the built-in sample animation
(handled exactly as if its file were dropped onto the page).

## How it works

Each package exposes the same imperative API (`play` / `pause` / `cancel` /
`finish` / `getCurrentTime` / `setCurrentTime`). The three adapters in
[`src/players/`](src/players/) wrap them behind a common
[`PlayerHandle`](src/players/types.ts) so the vanilla-TS UI in
[`src/main.ts`](src/main.ts) can drive any of them uniformly.

## Run as a dev server

```bash
pnpm install      # from the repo root
pnpm --filter @pixodesk/example-preview-player dev
```

Then open http://localhost:5175.

## Compile to a static web page

```bash
pnpm --filter @pixodesk/example-preview-player build     # outputs to dist/
pnpm --filter @pixodesk/example-preview-player preview   # serve the built output
```

The build uses a relative `base` (`./`), so the contents of `dist/` can be
hosted from any path or opened directly from disk.
