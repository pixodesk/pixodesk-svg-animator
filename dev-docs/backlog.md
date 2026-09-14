# Backlog — deferred items

Live items collected from finished plans and reports when those were retired (2026-09-14); each
says where it came from. Closed items are not kept here — the record that closed them has them.

## Player

- **e2e baselines for `animate-basic` / `animate-triggers`** are `animations: 'disabled'`
  artifacts — stable, but weak assertions. Regenerate them with the seek-driven pattern.
  *(release prep, 2026-07)*
- **React and Vue Playwright component-test configs exist with zero specs** — add
  component-screenshot specs, or drop the configs. *(release prep)*
- **Teardown noise** — "setAttribute: No elements found" on unmount was cosmetic; confirm it is
  gone now that every player reports through the diagnostics channel, and that a real host
  problem still reaches `onWarn` as `host`. *(release prep)*

## Pre-rendered builds

- **Optional motion-path hooks** — `PxMotionPath` (~5 KB) is dead twice over for the
  pre-rendered WAAPI build: pre-sampled at export, and the frames kernel is unused. The floor
  would be ~19 KB. *(pre-rendered progress log)*
- **Run the feature-explorer's 124 cases through SVG+JS export against the pre-rendered
  bundles** — turns "the editor pre-materializes everything" from a well-supported assumption
  into a verified fact. *(pre-rendered progress log)*

## Docs

- **React Native support matrix** — its ✅ / ⚠️ / ❌ rows were last re-verified against the
  player in 2026-08; re-verify on a real device before the package leaves 🧪.
  *(docs update, 2026-08)*

## Format

- **Lottie import still bakes a layer's crop as opacity** instead of emitting
  `clone.retime.timeCrop`. Paused with the ground mapped —
  [schema-design.md §7](./schema-design.md#7--open-items). *(editor repo work)*
