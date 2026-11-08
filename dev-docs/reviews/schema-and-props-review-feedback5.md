I’ve reviewed the new schema 1.21 version. Overall, this is a substantial improvement over the previous draft. The vocabulary is more coherent, and several earlier ambiguities have been addressed.

Three changes stand out positively:

- `actionTriggers` versus `actions` now has a much clearer distinction: events request actions; the actions block configures what those actions do.
- The time model now has a recognisable structure: unprefixed values describe model time, `total...` describes the whole run, and `play...` describes real elapsed playback time.
- `playWhile` / `pauseWhile` is a better React API than the old `play` / `pause` booleans. The distinction between stopping and pausing is much more apparent.&#x20;

  player-api-cheatsheet.html

  player-api-cheatsheet.html



I would keep this overall direction. However, I see some remaining issues worth resolving before treating the public API as settled.

## Issues I would prioritise

### 1.&#x20;

Must fix

&#x20;The `Patch<T>` type

The cheat sheet defines:

```
type Patch<T> = {
  [K in keyof T]?: Patch<T[K]> | null
};
```

This isn't a correct general-purpose deep-patch type. It recursively maps scalar types such as `number`, `string` and `boolean` instead of preserving them. It also treats arrays as objects rather than replacement values.

I'd use:

```
type Patch<T> =
  T extends readonly unknown[] ? T :
  T extends object
    ? { [K in keyof T]?: Patch<T[K]> | null }
    : T;
```

This also distributes over union types, which matters because `Timeline` is a discriminated union.

And make the timeline patch's exclusions explicit:

```
type TimelineOptions = Patch<
  DistributiveOmit<Timeline, 'actionTriggers' | 'actions'>
>;
```

If the cheat sheet is using abbreviated types rather than the actual exported definitions, this isn't necessarily an implementation bug, but I'd show the real types.&#x20;

player-api-cheatsheet.html



### 2.&#x20;

Must fix

`resume` is inconsistent between the document and player props

The document schema allows:

```
actionTriggers: {
  start?: Evs;
  stop?: Evs;
  pause?: Evs;
  resume?: Evs;
}
```

But the web/React `Triggers` type is:

```
type Triggers = {
  start?: Evs;
  stop?: Evs;
  pause?: Evs;
};
```

The comment says resume follows automatically. However, the document schema also says it is derived unless explicitly named.

This creates an inconsistency: a developer can explicitly configure `resume` in the file but cannot explicitly configure it when replacing the file's triggers through the component.

I'd choose one of two approaches:

- My preference: expose `resume` everywhere, including the React and web override types. Derive it when omitted.
- Alternatively, always derive it and remove `resume` as a configurable key from the document schema too.

The first is more flexible. The important thing is that the file and player API have the same capabilities.&#x20;

player-api-cheatsheet.html

player-api-cheatsheet.html



### 3. The time terminology is good, but the explanation is not quite correct

I actually like the new naming structure:

| Concept                                | Names                                                                 |
| -------------------------------------- | --------------------------------------------------------------------- |
| Animation/timeline time, one iteration | `getDuration()`, `getCurrentTime()`                                   |
| Animation/timeline time, whole run     | `getTotalDuration()`, `getTotalTime()`                                |
| Playback-time equivalent               | `getPlayDuration()`, `getTotalPlayDuration()`, `getCurrentPlayTime()` |
| Playback speed                         | `playSpeed`                                                           |

This is a good distinction. I would keep the `play...` family rather than introduce `wallClock...` everywhere.

There is, however, an important semantic distinction:

Playback time is not necessarily wall-clock elapsed time.

For example, if an animation is paused for five seconds, actual wall-clock time advances by five seconds, but the playback playhead doesn't. Likewise, `delay` is explicitly before the animation's time-zero position.

So I would describe `getPlayDuration()` as the nominal active playback duration at the current speed, rather than simply real elapsed time.

I'd clarify these points:

- Does `getTotalPlayDuration()` exclude `delay`? It appears to, because delay sits before zero.
- Does `getCurrentPlayTime()` exclude paused periods and delays?
- Do the duration methods include extra motion caused by `finish: 'rewind'` or `stop: 'rewind'`?
- With negative `playSpeed`, is `getCurrentPlayTime()` a monotonic elapsed-playback counter or a position along the playback-time axis?

These distinctions matter if somebody uses the values for a progress bar, scheduling or synchronisation.

There are also two inconsistencies in the introductory explanation:

- The `time` timeline is described as the wall clock. I'd call it a time-driven timeline: its playhead advances independently of scrolling. It is not itself wall-clock time.
- `inViewDebounce` is a real elapsed-time debounce, presumably measured in wall-clock milliseconds. `frameRate` also describes real-time rendering cadence. Therefore, `playSpeed` is not quite the only real-time-related setting; it is the only knob that changes the model-to-playback time conversion.

I'd explicitly distinguish animation time, playback time and wall-clock time in the documentation. If you ever expose actual elapsed wall time, give it a separate name such as `getElapsedWallTime()`.&#x20;

player-api-cheatsheet.html

player-api-cheatsheet.html



One naming choice remains debatable: `playSpeed` versus `playbackRate`.

- `playbackRate` is the more established term in browser animation and media APIs.
- `playSpeed` is shorter, easier to understand in ordinary English, and fits your `play...` naming family.

I wouldn't consider `playSpeed` a mistake. If consistency with your own API vocabulary matters more than matching established browser terminology, I'd keep it.

### 4. React control props: good direction, but define transitions precisely

I like this:

```
<SvgAnimationPlayer
  doc={ball}
  playWhile={hovered}
  pauseWhile={!inView}
/>
```

It's much better than `play` and `pause` as two booleans. `playWhile` communicates a sustained condition, and `pauseWhile` describes an additional condition that freezes playback.

There are two things I'd resolve.

First: what happens when the component initially mounts with `playWhile={false}`?

It should not execute the configured stop action just because the initial value is false. Imagine:

```
<SvgAnimationPlayer
  doc={ball}
  playWhile={false}
  actions={{ stop: 'rewind' }}
/>
```

I would define the semantics as:

- Initial `false`: remain idle; don't execute stop.
- `true → false`: execute the configured stop action.
- Initial `true`: start immediately.
- `pauseWhile: true → false`: resume if the prop was responsible for pausing.

This distinction between a level and a transition is important. Otherwise, a controlled React prop can unexpectedly initiate animation just by mounting.

Second: `playState` and the boolean props shouldn't silently compete.

Currently, `playState` is described as an alternative to `playWhile` / `pauseWhile`, but it wins if both are supplied.

I'd prefer a TypeScript union that prevents those combinations in the first place. You can still issue a runtime warning for JavaScript users.

The same applies to `showAtProgress` and `showAtTime`: they are alternatives for the same control mode, so passing both should be rejected or explicitly diagnosed.

One other small asymmetry: the `playState` prop accepts `idle | playing | paused`, whereas `getPlayState()` also returns `finished | destroyed`. That's defensible because the prop describes controllable states, but make that distinction explicit.&#x20;

player-api-cheatsheet.html



### 5. `version`: resolve the version-number discrepancy

The document header says schema 1.21, but the `animator.version` comment describes its second component as the player schema 1.15.

Perhaps these are intentionally different versioning systems, but the relationship isn't obvious. I'd include one actual example of the three-part version and explain exactly what each component represents.

I'd also reconsider whether `version` is the right name if it isn't a conventional document/schema version. `formatVersion` might be clearer if it identifies the format, while editor/toolchain information could live separately.&#x20;

player-api-cheatsheet.html



## Other issues worth considering

| Priority | Area                           | Feedback                                                                                                                                                                                                                        |
| -------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| High     | `engine: 'native'`             | If this means Web Animations API, use `waapi`. `native` is ambiguous, particularly when the same API targets React Native.                                                                                                      |
| Medium   | `click`, `hoverIn`, `hoverOut` | These are web-centric names despite the claim of a shared React/Vue/RN API. Either document platform mappings (`click` → native press) or use more platform-neutral event names.                                                |
| Medium   | `onSvgAnimationPlayersChange`  | The name suggests collection changes, but its event union also includes `play`, `pause`, `reset` and `finish`. Consider splitting registry changes from player events. Also, `stop` is missing from the event union.            |
| Medium   | Scroll/view timelines          | The schema excludes playback controls for these timelines, but the common player API still exposes `play()`, `pause()`, `stop()`, `playSpeed` etc. Define what happens when those methods are used with a scroll/view timeline. |
| Medium   | `getCurrentTime()`             | It describes time within one iteration, while `getTotalTime()` describes the entire run. This is workable and familiar, but the iteration-local meaning needs to remain very visible.                                           |
| Low      | `inViewDebounce`               | If it applies to both entering and leaving the viewport, `visibilityDebounce` might be more accurate. If it only debounces entering, the current name is fine.                                                                  |
| Low      | `outOfView: 'reset'`           | The example says it replays on return. Explain this automatic restart behaviour explicitly; it isn't immediately obvious from the name.                                                                                         |
| Low      | `completeIteration`            | Add a short explanation that it defers the stop until the current iteration completes.                                                                                                                                          |
| Low      | `onWarn`                       | `onWarning` is a little more conventional, although `onWarn` is perfectly understandable.                                                                                                                                       |

The scroll/view configuration itself is reasonably well structured: `axis`, `source`, `subject`, `pin` and `range` are recognisable concepts for developers familiar with scroll-driven animations. I'd mainly ensure that `smoothing`, `pin.offset`, `pin.distance` and `range.fraction` have clearly defined units and ranges.&#x20;

player-api-cheatsheet.html



## What I would definitely keep

These are good naming decisions in this revision:

| Name                                | Why I'd keep it                                                                            |
| ----------------------------------- | ------------------------------------------------------------------------------------------ |
| `actionTriggers` / `actions`        | Clear separation between event requests and configured outcomes.                           |
| `timelineOptions`                   | Better than `timeline` for a partial, merged instance-level override.                      |
| `behavior`                          | Good replacement for the earlier `do`.                                                     |
| `outOfView`                         | Much clearer than `suspend` for visibility behaviour.                                      |
| `whenIdle`                          | Describes the state in which the resting appearance applies.                               |
| `playWhile` / `pauseWhile`          | A significant improvement in the React API.                                                |
| `playState`                         | A useful explicit alternative to the two booleans, provided conflicts are prevented.       |
| `showAtTime` / `showAtProgress`     | Clear, concise and consistent.                                                             |
| `clone.omit`                        | Good choice: concise and natural for leaving a property out of the clone.                  |
| `getTotalDuration` / `getTotalTime` | A sensible distinction between nominal duration and current position across the whole run. |

player-api-cheatsheet.html

player-api-cheatsheet.html

## Overall verdict

Strong direction

I'd say the naming has improved considerably. The design now has a fairly consistent vocabulary, and I wouldn't undertake another broad renaming exercise.

My recommended order before publishing:

1. Fix the recursive `Patch<T>` type.
2. Make `resume` consistent between document schema and player overrides.
3. Clarify animation time versus playback time versus actual wall-clock time.
4. Define initial-value and transition semantics for `playWhile` / `pauseWhile`.
5. Resolve the version-number discrepancy.
6. Clarify the cross-platform engine and event vocabulary.

The biggest improvement is that the API now has a coherent mental model: a timeline defines how animation time progresses; triggers request actions; actions define their outcomes; and React props provide alternative ways to control playback. That's the kind of structure that lets an experienced developer understand the API without having to learn a collection of unrelated Pixodesk-specific names.