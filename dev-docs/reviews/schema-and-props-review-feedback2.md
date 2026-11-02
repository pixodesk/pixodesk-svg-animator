Overall this holds together well. The strongest idea is the shared key between `actionTriggers` and `actions` (`stop` says when, `stop` says how). Keying by move rather than by event or state is the right call, and the "file key = prop name, merged" rule for `timeline` and `actions` is exactly what makes props predictable. Most of my feedback is about the places where that rule is broken or where the first read doesn't match what a web or animation developer already expects.

## The five things I'd change first

**1. `doc` alone renders a frozen first frame.** This is the biggest "without the docs" failure, and you already know it. The file's own rule is "no `animator` block means play on load", so the file and the component disagree about the default. Your reason (200 icons in a list) is already handled by the visibility gate in the file. I'd make the file's triggers the default driver and add an explicit opt-out. That also fixes point 2.

**2. `playUsingActionTriggers` breaks your own rule.** `timeline` and `actions` are the file's keys verbatim on the component, but `actionTriggers` becomes a nine-syllable prop. Reading it cold I parsed "play using action triggers" as an imperative, then had to work out whether it's a switch or a block. If the prop were simply `actionTriggers`:

- absent → the file's block (default driver)
- `false` → none; your code drives (this is the "manual" literal from §8 #1, for free)
- `{…}` → yours, replacing the file's

That reads like the other two override props, and `actionTriggers={false}` is far more guessable than `playUsingActionTriggers={{}}`. The cost is giving up the "a driver is named by its verb" rule, but that rule mostly exists to justify this one name.

**3. `togglePlay` means play/stop, but everyone will read it as play/pause.** Every media UI's toggle button is play/pause. Someone writing `togglePlay: 'click'` for a spinner will be surprised when the second click resets it instead of freezing it. Since `{ start: 'click', pause: 'click' }` already expresses the play/pause toggle, the sugar you're naming is specifically the play/stop one. Make "stop" visible in the name, or keep `togglePlay` but give it the media meaning and spell the stop variant out.

**4. `suspend` is unguessable, and your own keys already use a better word.** The sensor is configured by `inViewThreshold` and `inViewDebounce`. `outOfView: 'pause'` reads as a sentence and rhymes with those keys; `suspend: 'pause'` makes people ask "suspended by what?". The OS analogy is accurate but no one will reach for it. Same for `wake`.

**5. `engine: 'native'` is ambiguous once React Native is a target.** In that codebase "native" means the RN side. The value means the browser's Web Animations API, so call it `waapi`. `js` and `auto` are fine.

## §8 answers

| # | My reaction |
|---|---|
| 1 | Disagree with `{}`. See point 2 above: `false` (or `'manual'`) says it. |
| 2 | Keep two booleans, but reconsider the words. You say they're states, like CSS classes, yet `play` is a verb. `playing={hovered}` and `paused={frozen}` read as states; `play={false}` performing a destructive stop (reset or rewind) is the part people will trip on, because in every media API "not playing" means paused, not reset. |
| 3 | Keep `showAtTime`. Unitless ms is consistent with the file. |
| 4 | Keep `timeline`. The mirror rule matters more than the slight misdirection. |
| 5 | Keep `do`, it's fine once seen. `completeIteration: true` sounds like a command; `afterIteration: true` says *when*, which is what it is. |
| 6 | `jumpToEnd`. "End" is already your word (`outTime` is "where it ends"). The `finish` / `finished` / `onFinish` trio survives without the preset borrowing it. `start: 'load'`: keep, the gate explanation is sound. |
| 7 | Agree: `onReset`. But check the overlap: §4 says `onStop` also fires on `reset()`. Firing both `onStop` and `onReset` for one call will confuse; I'd fire only `onReset`. |

`onFinish` over `onEnded`: agree. `onIdle`: skip until someone asks.

## Smaller notes, roughly by weight

- **`playerRef` is non-idiomatic React.** A React developer expects `ref` to hand back the imperative handle (`useImperativeHandle`), and in React 19 `ref` is an ordinary prop. Accept `ref` on React; keep `playerRef` as an alias if Vue and RN need one name.
- **`resume` is a key that exists but is ignored.** A schema key that type-checks in the file, does nothing, and warns is exactly the sort of thing that needs the docs. Remove it until the element-target layer ships; adding a key later is cheap.
- **Three time axes.** `inTime`/`outTime` are content ms, `playDuration` is wall ms, `showAtTime` and `getCurrentTime()` are run ms (iterations included). The names don't say which axis they're on, and `getDuration()` ("one pass of the content window") doesn't say whether it returns content or wall time. Either make the TSDoc say the axis on every one of these, or put it in the name for the run-time ones.
- **`continue` means two things.** As a start preset it's "resume from where it rests"; as a suspend preset it's "keep running off screen". Fine, but worth a TSDoc line.
- **`beforeStart: 'static'`** doesn't say what "static" is. `'asAuthored'` would, though it's clunkier. Low priority since the editor never writes it.
- **Collision rule** (`pause` wins over `stop` while playing) is arbitrary; the warning is the right answer. Good.
- **`null` deletes** is well established (JSON Merge Patch). Keep.
- **`inTime` / `outTime`**: a video or animation person gets these instantly; a pure web developer may expect `startTime` / `endTime`. The TSDoc covers it. Keep.

## Agree, keep as is

`animator`, `timeline` as a discriminated union, `iterations` / `delay` / `iterationDirection`, `actions` keyed by move, the string-or-object shorthand, `reset` / `rewind` / `hold` / `restart`, `playOnce()`, `stop()` vs `reset()`, `showAtProgress`, `onWarn` / `onError` with `kind`, the precedence rule with a warning instead of an error, and the version-is-not-a-gate stance.