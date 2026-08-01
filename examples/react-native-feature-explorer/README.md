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

## "The request timed out" on the phone

Expo Go gave up waiting for the JS bundle. The first request after a cold start
has to build the whole thing; every one after that is served from Metro's cache.

Measured here (Apple Silicon, cold cache): Metro ready in **0.6 s**, first
bundle **5.5 s / 8.9 MB**, subsequent bundles **0.1 s** — down from 1.6 s and
10.9 s before the changes below. Most of that size is React Native, reanimated
and react-native-svg; the 118 fixtures account for 0.7 MB of it.

In order:

1. **Just retry.** The build that timed out still finished and is now cached, so
   the second attempt is near-instant.
2. **Check the phone and the Mac are on the same network**, and that the Mac's
   firewall is not blocking incoming connections. A LAN URL the phone cannot
   reach times out exactly like a slow build.
3. `pnpm example:rn:explorer:tunnel` — routes through Expo's tunnel when the two
   devices cannot see each other directly. Slower, but it works across networks.
4. `pnpm example:rn:explorer:clear` — clears Metro's cache. Use this if the
   bundle seems stale or the app behaves like an older build, not for a timeout;
   it makes the next build slower, not faster.

What the app itself does to keep the wait short:

- fixtures load **on first access** — scrolling to a case is what parses it, so
  startup does not evaluate 1.2 MB of object literals up front
  ([`catalog.ts`](src/catalog.ts))
- the header renders immediately and the list one frame later, so a slow start
  shows *Loading 118 cases…* rather than a frozen screen
- Metro is told to skip `.git`, test artefacts and the sibling example apps, so
  its startup crawl is not the whole monorepo ([`metro.config.js`](metro.config.js))

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

## When something goes wrong

The title carries a build number (**Feature Explorer #6**) that is bumped on
every player fix, so it is obvious on-device which build is running.

Failures are shown, not fatal:

- a case that fails to compile or render prints the error under its own row and
  leaves the other 117 playing
- every failure, plus any uncaught JS error, is collected into a tappable
  **⚠ N errors** panel under the header, with a *clear* button
- a throw that escapes everything else still lands on an on-device error screen
  with the message, the component stack and a *Try again* button
  ([`AppErrorBoundary.tsx`](src/AppErrorBoundary.tsx)) — never a white screen

A crash inside react-native-svg's native renderer is the one thing this cannot
catch. One such crash — text on a closed path — is worked around in the player
itself; see [Known limitations](../../packages/svg-animator-rn/README.md#known-limitations).

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
