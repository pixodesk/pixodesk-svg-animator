This version is clearly better. `outOfView`, `playWhile` / `pauseWhile` / `playState`, `jumpToEnd`, `omit`, `onReset`, dropping `togglePlay`, and the new "absent `actionTriggers` = nothing starts it" rule all read correctly without docs now. The scroll timeline is also a strong point: `axis`, `source: 'nearest' | 'root'` and the range phases (`cover`, `entry`, `exitCrossing`…) mirror CSS scroll-driven animations, so web developers will recognise them immediately.

What's left is mostly consistency: places where the same concept has two names, or the same name has two meanings.

## The five things I'd fix first

**1. The same block has two prop names in one package.** `SvgCssAnimationPlayer` takes `actionTriggers`, while `SvgAnimationPlayer` takes `playUsingActionTriggers` for the same block. Someone who learns one component will guess wrong on the other. This is the strongest argument yet for `actionTriggers={true | false | {…}}` everywhere.

**2. The `timeline` mirror is broken.** The prop is now `timelineOptions`, but `actions` is still `actions`. The earlier "file key = prop name" rule was the most predictable part of the API. Use `timeline` (preferred) or suffix both, but don't mix.

**3. "Total time" reads as a duration.** In everyday English "total time" means "how long it all takes", so people will mix up `getTotalTime()` and `getTotalDuration()`. Then `getCurrentPlayTime()` breaks the pattern again, because elsewhere "Current" means inside the pass, but here it means the whole run. Mapped out:

| | One pass | Whole run |
|---|---|---|
| Model, duration | `getDuration` | `getTotalDuration` |
| Model, position | `getCurrentTime` | `getTotalTime` ⚠ reads as a duration |
| Real, duration | `getPlayDuration` | `getTotalPlayDuration` |
| Real, position | *(missing)* | `getCurrentPlayTime` ⚠ "Current" means run here |

I'd keep "Total" for durations only and use **"Elapsed"** for run positions, since "elapsed" naturally means "since the start, through everything":

```ts
getDuration()        getTotalDuration()       // model: pass · run
getCurrentTime()     getElapsedTime()         // model: pass · run   (was getTotalTime)
getPlayDuration()    getTotalPlayDuration()   // real:  pass · run
                     getElapsedPlayTime()     // real:  run          (was getCurrentPlayTime)
```

**4. Two different "first frame" defaults.** The React control order ends in "④ a still first frame", but `whenIdle` defaults to `'static'` ("as authored"). Which one does `<SvgAnimationPlayer doc={ball} />` show? If the answer is "whatever `whenIdle` says", change ④ to "idle (per `whenIdle`)". While you're there, `'authored'` would say what `'static'` means.

**5. Saved triggers are silently ignored.** The new rule makes file and component consistent when there's no block. But if a designer saves hover triggers in the editor and a developer writes `<SvgAnimationPlayer doc={x} />`, they get a frozen frame with no explanation. A cheap fix: emit an `onWarn` when the file has `actionTriggers` but no driver is named ("pass `playUsingActionTriggers` to use the file's triggers").

## Inconsistencies between parts of the API

- **`resume` in the file, but not in props.** The file's `actionTriggers` accepts `resume`, but the `Triggers` override type omits it, so a file can express something an override can't. Allow it in both or neither.
- **Event and callback sets don't match.** The callbacks include `onStop`, but `onSvgAnimationPlayersChange` events have `reset` and `finish` and no `stop`. Use the same set in both.
- **Two driver defaults on the web.** `createSvgAnimationPlayersFromPage()` plays as saved, while `createSvgAnimationPlayer()` shows a still. The reason is defensible (no code means no driver), but its `playUsingActionTriggers?: Triggers` also drops the boolean, so you can't opt a page out with `false`.
- **Gate settings in different places.** `inViewThreshold` / `inViewDebounce` sit inside `timelineOptions` on one component and at the top level on `SvgCssAnimationPlayer`.
- **Three words for real time.** The docs say "real", the timeline comment says "the wall clock", and the API says "play". Since the API settled on "play", make the comments say "play time" or "real time" consistently and drop "wall".

## Behaviour the names don't settle

- **`jumpToEnd()` with `actions.finish: 'reset'`.** It fires `onFinish`; does the finish action then reset immediately, undoing the jump? I'd expect `jumpToEnd` to skip the finish action and hold.
- **Rewind timing.** During a rewind (stop → `'rewind'`), what does `getPlayState()` return, and when do `onStop` and `onReset` fire: at the start of the rewind, at the end, or one of each? `playState={'idle'}` triggering a backwards animation makes this a common case.
- **Two ways to play backwards.** A negative `playSpeed` and `iterationDirection: 'reverse'` overlap. Say in TSDoc whether they combine (reverse × −1 = forward?) and whether the file's `playSpeed` may be negative.

## Smaller notes

- `engine: 'native'`: your own comment says "auto: WAAPI", so `'waapi'` would be self-explanatory and avoids the React Native clash.
- `playerRef`: React developers will try `ref` first. Accept both.
- `playSpeed` is clear. Web developers know `playbackRate` from media and WAAPI, but `playSpeed` fits your play family, so I'd keep it.
- `actions.stop` is written as a one-off type. Writing it as `Slot<'reset' | 'rewind'> & { completeIteration?: boolean }` would show it's the same slot pattern as the others.
- `Anim<T> = T | { value: T } | ANIMATE` is redundant, since `ANIMATE` already has `value`.
- The `version` comment says the player schema is "1.15", while the header says 1.21.

The suggested `getElapsedTime` / `getElapsedPlayTime` renames and the `actionTriggers` rename are the two changes with the biggest effect on readability. Everything else is mostly aligning docs with what you already decided.