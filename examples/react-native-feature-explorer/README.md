# React Native Feature Explorer

Scrolls the **entire feature-fixture suite** — 118 cases across 16 sections —
through [`@pixodesk/svg-animator-rn`](../../packages/svg-animator-rn/README.md).
Where the [preview player](../react-native-preview-player) shows one hand-written
animation at a time, this shows everything the format can do, in one list.

## Run

```bash
pnpm install                 # from the repo root
pnpm example:rn:explorer     # then press i (iOS), a (Android), or scan the QR
```

Or from this directory: `npx expo start` (plus `--web`, `--ios`, `--android`).

## What's in it

The fixtures, their section titles and their order are copied from the editor's
own dev feature explorer, so the list matches what you see there:

| Source | Used for |
|---|---|
| `featureexplorer/cases/*.svga.ts` | the 118 animation documents |
| `modelCoverage.ts` → `DEV_FIXTURE_GROUPS` | section titles and case order |
| `cases/registry.ts` | preset id → document |
| `caseInfo.ts` | the one-line description under each title |

[`src/catalog.ts`](src/catalog.ts) is generated from those four and is what the
app actually reads. The fixtures themselves are unmodified data — only the file
header was swapped for this repo's MIT notice.

Sections run `§ 1.1 attr.number` → `§ 5 …`, covering numbers, vectors,
transforms, colours, gradients, paths, appearance, elements, text, effects
(clone, repeater, mask, clip, trim, gradients, text-path) and animation config
(easing, loops, direction).

## Controls

- **Filter** — type `gradient`, `transform`, `effect.trim`, … to narrow the list
- **Play all / Pause all** — stops every animation at once
- **↻ Loop** (on by default) — the fixtures are authored one-shot (1 s, no
  iterations) for frame-by-frame inspection in the editor; looping keeps them
  visible while you scroll. Turn it off to see each case's real timing.
- **↺** on a row — restart that one case
- **Theme** — light/dark, following the system scheme by default

## How it stays fast with 118 animations

Two mechanisms, because virtualisation alone is not enough:

1. **`SectionList` virtualisation** mounts only a small window of rows
   (`initialNumToRender: 3`, `windowSize: 5`, `removeClippedSubviews`), so most
   cases don't exist as components at all.
2. **Visibility gating** — `onViewableItemsChanged` tracks which rows are
   genuinely on screen, and only those get `autoplay`. Rows that are mounted but
   scrolled out render their first frame and sit idle, so no off-screen timeline
   burns a frame budget.

Each animation is still driven natively on the UI thread by reanimated, so
scrolling stays smooth while the visible animations play.

## Notes

- Every one of the 118 fixtures was verified to pass through the pipeline with
  **no errors, no effects-schema warnings and no unsupported elements** — the
  full suite maps onto `react-native-svg`.
- Around a third of the cases are deliberately **static** (e.g.
  `attr.gradient.endpoints.linear` is the still counterpart of
  `…linear.anim`, and `elem.marker` / `elem.pattern` demo elements rather than
  motion). Those rows correctly show a single frame.
- The fixtures are typed loosely (see [`src/caseTypes.ts`](src/caseTypes.ts)):
  they are data exported from the editor and carry a couple of keys the player's
  schema does not declare, such as `animator.timeline`.
