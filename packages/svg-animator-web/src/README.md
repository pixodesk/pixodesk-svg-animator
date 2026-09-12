# svg-animator-web — source layout

The browser player. The format, schemas, effects and value engine live in `@pixodesk/svg-animator-core`;
this package adds the DOM: building the SVG, driving it with an engine, and wiring triggers.

| where | what lives here |
|---|---|
| `index.ts` | the npm entry (esm + cjs) — the full public surface |
| `index.player.ts` | the UMD / iife entry — the playback surface only |
| `index.prerendered.ts` · `index.prerendered-waapi.ts` | UMD entries for pre-rendered SVG (both engines · WAAPI only, the smallest build) |
| `animator/` | `PxAnimator` — `createAnimator` and the control API (play, pause, seek, destroy) |
| `engines/` | how attributes get updated: `PxAnimatorWebApi` (WAAPI), `PxAnimatorFrameLoop` (the player's own frame loop), and `PxAnimatorBind`, which picks and builds the engine for the full and pre-rendered builds alike |
| `scroll/` | `PxScrollDriver` — the DOM half of scroll/view timelines: measures scroller and subject, feeds core's scroll math |
| `triggers/` | `PxAnimatorTriggers` — what STARTS an animation: load, click, hover, scroll-into-view |
| `dom/` | `PxAnimatorDOM` — renders the document's nodes to SVG elements |
| `shared/` | `PxAnimatorKeys` (wire keys every entry reads) and `PxAnimatorWebTypes` (DOM specializations of core's types) |

Conventions:

- The four `index*.ts` files stay at the root: `tsup.config.ts` names them literally, and the
  `e2e:fixtures` scripts copy their built outputs by filename.
- Tests sit beside the code they test, as `*.test.ts`; `index.test.ts` covers the public surface.
- Keep the pre-rendered entries lean: they must not pull in `animator/` or core's schema engine
  (see `PRERENDERED-PLAYER-BUILDS.md`).
