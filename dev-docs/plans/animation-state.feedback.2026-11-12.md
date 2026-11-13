# Playback API and file format — owner feedback, 2026-11-12

**Status:** discussion only. Nothing here is implemented. The owner answered on 2026-11-12 and 2026-11-13, and all fifteen
items are now decided. The marks: ✅ decided · 🟡 partly decided · ❓ open.

**Baseline:** player 1.0.55, schema 1.25 (`player.playback.*`, `"playback.start"`), the editor on the same names.

**Earlier documents:** [animation-state.playback-namespace.md](./animation-state.playback-namespace.md) (the current
API), [animation-state.brainstorm.md](./animation-state.brainstorm.md) (the model), [playback-layers.md](./playback-layers.md)
(the planned layers: states, segments, inputs).

Each item has the feedback as given, the problem in full, what the code does today, my opinion, what I suggest,
and the owner's decision where there is one.

## Summary

| # | Topic | Status | The decision, or what is open |
|---|---|---|---|
| 1 | `src` / `doc` → one `document` | ✅ | One `document` option; the tag attribute becomes `data-px-document`. A URL in the components is a second step. |
| 2 | `playUsingActionTriggers` → `playerActionTriggers` | ✅ | Rename. |
| 3 | `jumpToStart()` / `jumpToEnd()` | ✅ | Remove both. |
| 4 | `playOnce()` | ✅ | Remove, together with item 7. |
| 5 | `atEnd` → `whenFinished` | ✅ | Rename. The state stays `finished`, whatever the picture shows. |
| 6 | `outOfView: jumpToStart` → `stop` | ✅ | `stop`, a hard stop with no animation. The state and the callbacks follow the out-of-view pause and stop. |
| 7 | `playback.start()` always restarts | ✅ | Yes, in every state, from a trigger too. |
| 8 | Stop after the current iteration | ✅ | No flag. One new stop value, `animateToEndAndBack`: finish the pass, then play back. |
| 9 | `onFinish` → `onPlaybackFinish` | ✅ | Rename. |
| 10 | Start behaviours | ✅ | None. The start action has no setting: it always plays from the start. |
| 11 | Moving the playhead | ✅ | While playing it keeps playing. In every other state it becomes `paused` at that frame. |
| 12 | Scroll / view timelines | ✅ | Keep them as they are. Cover the scroll and view cases in the brainstorm document. |
| 13 | Lottie, dotLottie, Rive | ✅ | Research only. Nothing is implemented in this iteration. |
| 14 | Progress above 1 | ✅ | `setCurrentProgress(1.2)` is 0.2 into the second iteration; no wrapping. `getCurrentProgress()` returns the same number. |
| 15 | `playback.play`: start, or carry on | ✅ | A method, `playback.play()`, and a trigger list, `"playback.play"`. |

Items 3, 4, 7, 10 and 15 are one change: once `start()` always plays from the start, the others follow.
Items 5 and 6 are one rule: a state word changes the state, a move word only moves the picture.

## The rule behind items 5, 6 and 10

The feedback keeps returning to one point, so it is stated once here.

- **The playback state** is `off` · `playing` · `paused` · `finished`. It says what the playback is doing.
- **The picture** is the frame on screen. It can be the rest pose, the last frame, or any frame in between.
- **State words** change the state: `start`, `stop`, `pause`, `resume`.
- **Move words** change only the picture: `jumpToStart`, `animateToStart`, `jumpToEnd`, `animateToEnd`, `hold`.

Today some settings use a move word for a state change (`outOfView: jumpToStart`, `atEnd: jumpToStart`). That is the
source of most of the confusion below.

---

## 1. ✅ One name for the animation: `document`

**Feedback.** "We have src/doc in props and as player creator function argument (src of what?). Let's unify: one
attr/prop `document`: string | our doc type."

**The problem.** The same thing — "which animation to play" — has two names, and which one you may use depends on
where you are. `src` does not say what it is the source of.

**Today.**

| Where | Names | Accepts |
|---|---|---|
| `createSvgAnimationPlayer({ … })` | `src` or `doc`, exactly one | `src`: a URL to fetch · `doc`: the parsed JSON |
| React, Vue, React Native components | `doc` only | the parsed JSON; no URL form, by an earlier decision |
| The tag for a page with no code: `<div data-px-animation-src="/ball.json">` | `data-px-animation-src` | a URL |

The name `doc` was chosen over `document` because a prop named `document` hides the browser's `window.document`
inside any function that destructures it.

**Opinion.** I agree. One name is better, and the type can tell a URL from a document. Two points to settle:

- A string must always mean a URL. JSON as text is not accepted; the caller parses it.
- The hiding problem is real but small. It only bites code that writes `({ document }) => …` and then calls
  `document.querySelector`. Our own code would rename on destructuring.

**Suggestion: change.**

- `document: string | PxDocumentJson` on `createSvgAnimationPlayer`. Remove `src` and `doc`.
- Components: rename `doc` → `document` now. Accepting a URL there is new work (loading state, an error callback,
  nothing to render on the server), so I suggest it as a second step, not part of the rename.
- The tag `<div data-px-animation-src="/ball.json">`: see the note under the decision.

**Decision (2026-11-12).** ✅ One `document` option, `string | PxDocumentJson`. A URL in the components is a second step. 

**Added 2026-11-13.** ✅ The tag attribute is renamed too: `data-px-animation-src` → `data-px-document`.

```html
<div data-px-document="/ball.json"></div>
```

This is the attribute a page author writes on an empty tag; `createSvgAnimationPlayersFromPage()` finds every
such tag, fetches the JSON and creates a player in it. It has nothing to do with `data-px-meta`, which holds the
settings inside a pre-rendered SVG and does not change.

---

## 2. ✅ `playUsingActionTriggers` → `playerActionTriggers`

**Feedback.** "Rename to playerActionTriggers."

**The problem.** The current name is long and reads as a sentence. It is also the only option whose name starts
with a verb.

**Today.** The option exists on the creator and on every component:

- `true` — the file's own `timeline.actionTriggers` start and stop the animation;
- an object — these trigger lists are used in place of the file's;
- left out — nothing plays by itself; your code drives the player.

**Opinion.** The new name is fine and shorter. It reads naturally with an object
(`playerActionTriggers={{ "playback.start": "click" }}`) and acceptably with `true`. One thing must stay clear in
the docs: left out means "off", which is different from `actions` and `timelineOptions`, where left out means "as
the file says". The plain name `actionTriggers` would hide that difference, so I prefer the owner's name.

**Suggestion: change.** Rename everywhere, no alias, including the control-mode name inside the library and any
warning text that names the option.

**Decision (2026-11-12).** ✅ Rename to `playerActionTriggers`.

---

## 3. ✅ Remove `jumpToStart()` and `jumpToEnd()`

**Feedback.** "What are those? Do they change the playback state, or purely change time when playing? We can just
use setProgress(0), setProgress(1) instead."

**The problem.** The names say "move the playhead". The functions do more than that, and what they do is not what
a seek does.

**Today.**

| Call | State after | Callback | Follows the file's settings |
|---|---|---|---|
| `playback.jumpToStart()` | `off` — the playback ends | none | no — ignores the stop action |
| `playback.jumpToEnd()` | `finished`, or `off` when `atEnd` goes back | `onFinish` | yes — runs `atEnd` |
| `playback.setCurrentProgress(0)` | unchanged | none | — |
| `playback.setCurrentProgress(1)` | unchanged | none | — |

So `jumpToStart()` is a silent stop, and `jumpToEnd()` is "finish now". Neither is a plain seek: after
`setCurrentProgress(0)` a playing animation keeps playing from the start.

**Opinion.** I agree they should go. Each one repeats something that already has a clearer name:

- back to the rest pose → `playback.stop()`;
- show the first or last frame → `playback.setCurrentProgress(0)` / `(1)`.

One case is lost: a file whose stop action is `animateToStart` cannot be reset at once from code. The page can
pass `actions: { "playback.stop": { behavior: "jumpToStart" } }` when it creates the player, which already works.

**Suggestion: change — remove both** from the public handle. The engines keep their internal jump. Call sites to
update: the docs and READMEs (about 35 mentions), the preview players, two learning projects.

**Decision (2026-11-12).** ✅ Remove both.

---

## 4. ✅ Remove `playOnce()`

**Feedback.** "Can we get rid of playOnce()? Just set iterations to 1 and call start(). Keep it simple, without
redundant ambiguous functions; give the core machinery."

**The problem.** `playOnce()` is a second way to start, with its own rules. A reader has to learn how it differs
from `start()`.

**Today.** `playOnce()` plays one fresh pass from the start, always: it restarts if something is playing, and it
plays a single pass even when the file loops. It then ends as `atEnd` says. `iterations` cannot be changed on a
live player; it is fixed when the player is created (`timelineOptions: { iterations: 1 }`).

**Opinion.** I agree. After item 7, `start()` on a one-iteration timeline is exactly `playOnce()`. What is lost is
"play one pass of a file that otherwise loops, in the same player". That is a segment use case (item 13), not a
reason to keep a second start function.

**Suggestion: change — remove**, in the same release as item 7. The docs get the two-line recipe: create with
`timelineOptions: { iterations: 1 }`, call `playback.start()`. The editor does not call `playOnce()`; the callers
are the docs, the READMEs and two learning projects.

**Decision (2026-11-12).** ✅ Remove, together with item 7.

---

## 5. ✅ `atEnd` → `whenFinished`; the state and the picture are different things

**Feedback.** "Playback state and what's shown currently by the animation are different things. So rename atEnd to
atFinished/whenFinished: what to show when the playback state becomes 'finished'."

**The problem.** `atEnd` mixes two questions: what state the playback is in after its last pass, and what picture
is shown. Two of its three values answer the first question without saying so.

**Today.** `timeline.atEnd` has three values. `onFinish` fires in all three.

| Value | Picture | State after |
|---|---|---|
| `hold` (default) | the last frame | `finished` |
| `jumpToStart` | the rest pose, at once | `off` — the playback is retired |
| `animateToStart` | plays backwards to the rest pose | `returning`, then `off` |

So "finished" is a state only under `hold`. With the other two, code cannot ask "did it finish?"; it has to have
caught the callback. A sibling key, `timeline.whenIdle`, already says what is shown while `off`.

**Opinion.** I agree with the rule and the name. `whenFinished` pairs with `whenIdle`. To make the name true, the
state has to be `finished` after every natural end, whatever is shown. Then the three values are honest move
words: they move the picture and leave the state alone.

One rule needs a small change. Today a click that is in both the start and the stop list stops a finished
animation. If a finished animation is already showing the rest pose, that click would do nothing visible. The rule
becomes: while `finished`, stop wins only when the last frame is held; otherwise start wins.

**Suggestion: change.**

- Rename `timeline.atEnd` → `timeline.whenFinished`, values unchanged (`hold` · `jumpToStart` · `animateToStart`).
- After the last pass the state is always `finished`, until the next start or stop.
- Adjust the click rule as above.
- If the owner prefers the smallest change: rename only, and keep today's states.

**Decision (2026-11-12).** ✅ Rename to `whenFinished`. The state stays `finished` after the last pass, whatever the picture
shows: the playback state and the position of the playhead are two different things. The click rule changes as
described above.

---

## 6. ✅ `outOfView: jumpToStart` → `stop`

**Feedback.** "outOfView: pause | continue | jumpToStart. I guess jumpToStart here means 'stop'? Then it needs to
be pause | continue | stop. 'jumpToStart' sounds like it moves the playhead to the start but keeps the current
playback state — if it was playing, it keeps playing?"

**The problem.** The reader cannot tell whether leaving the screen changes the playback state. The word
`jumpToStart` suggests it does not.

**Today.** `actions.outOfView.behavior` has three values:

| Value | Off screen | Back on screen |
|---|---|---|
| `pause` (default) | the clock is held | carries on from there |
| `continue` | keeps playing | — |
| `jumpToStart` | back to the rest pose | plays again from the start |

By design the gate holds the clock and does not press the playback buttons: no callback fires, and the docs say
`getState()` does not change. So the owner's reading of `jumpToStart` is close to what happens: the playhead goes
to the start and the animation "keeps playing" when it is seen again.

One finding from reading the code, not from running it: during a hold the engine is paused but the playback is
not marked paused, so `getState()` appears to read `off`, not `playing`. No test covers the state during a hold.

**Opinion.** I agree with `stop`. I would go one step further and apply the same rule to `pause`: the gate should
press the real buttons, so the state and the callbacks always tell the truth.

- `pause`: off screen it performs `playback.pause`; back on screen it performs `playback.resume`.
- `stop`: off screen it performs `playback.stop`, always as a jump; back on screen it performs `playback.start`.
- The gate only undoes what it did itself. A playback the user paused stays paused.

What the viewer sees does not change. What changes is that `getState()` reads `paused` or `off` while off screen,
and `onPlaybackPause` / `onPlaybackStop` fire for the gate. That reverses a 1.23 decision, when the gate was taken
out of `onPlay` because it was noise for app code.

**Suggestion: change.** `outOfView: pause | continue | stop`, with the gate pressing the real buttons. If the
callbacks must stay quiet for the gate, rename only, and add a test that pins what `getState()` reads during a hold.

**Decision (2026-11-12, completed 2026-11-13).** ✅

- The value is `stop`, and it is a hard stop: at once, with no animated return and no finishing of the
  iteration. When the graphic leaves the screen, all activity should end as soon as possible. The stop action's
  own setting is not used here.
- The gate presses the real buttons. An out-of-view pause reads as `paused` and reports `onPlaybackPause`, and
  `onPlaybackResume` when it is seen again. An out-of-view stop reads as `off` and reports `onPlaybackStop`.
- The gate only undoes what it did itself: a playback the user paused stays paused.

---

## 7. ✅ `playback.start()` always means "restart"

**Feedback.** "playback.start() always means 'restart', no matter the current state. We need to make sure that it
is the current implementation and that it is clearly explained in all documentation and comments."

**The problem.** A reader expects `start()` to play from the start. Whether it does depends on the state and on a
setting in the file.

**Today.** It is not the current implementation. The default start behaviour is `continue`:

| State when `start()` is called | Default (`continue`) | With `behavior: "jumpToStart"` |
|---|---|---|
| `off`, `finished` | plays from the start | plays from the start |
| `playing` | does nothing | restarts |
| `paused` | unfreezes, reports `onPlaybackResume` | restarts |
| `returning` | turns around from where it is | restarts |

So by default `start()` on a paused playback does the job of `resume()`.

**Opinion.** I agree. One job per function: `start()` plays from the start, `resume()` continues a pause. Two
effects to accept:

- A start trigger that fires while the animation is still playing now restarts it. Today it is ignored.
- A hover that returns during an animated return (`returning`) jumps to the start before playing. Today it turns
  around smoothly. Files that want the smooth turn set the second value from item 10.

**Suggestion: change.**

- `start()` and the `"playback.start"` trigger always play from the start, in every state.
- The file default changes with it (item 10), so it is a schema step. The step writes the old default into older
  files explicitly, so they play as before.
- Rewrite the method comment, the state table in `playback-and-triggers.md` and the READMEs to say it in one line.

**Decision (2026-11-12).** ✅ `start()` always plays from the start, in every state. A start trigger that fires while the
animation is playing or paused restarts it too.

- That also changes the trigger rule. Today the start list is not read while playing or paused.
- When one event is in several lists, the order stays: pause, stop, then start while playing; resume, stop,
  then start while paused.
- "Start, or carry on if it is already going" becomes its own action: item 15.

---

## 8. ✅ Stop only after the current iteration ends

**Feedback.** "Make sure that we have a configuration attr: when stop is triggered, we finish the current
iteration first."

**Second feedback, after the first answer.** "We used to have completeIteration, was it lost at some point? stop:
animateToEnd? No. What if we want an animation that goes forward on start and backward on stop? Then we have stop:
animateToStart, and we need the completeIteration flag for two scenarios: on stop we finish the current iteration
and then animate to the start; on stop we animate to the start from the current position."

**The problem.** A stop has two separate questions: **when** it acts (now, or after the current iteration) and
**how** the picture goes back (a jump, or playing backwards). Today the file can answer only one of them.

**Today.** The stop action has one setting with four values:

| `actions["playback.stop"].behavior` | Meaning |
|---|---|
| `jumpToStart` (default) | at once to the rest pose |
| `animateToStart` | plays backwards from where it is |
| `jumpToEnd` | at once to the end of the current pass, then `atEnd` |
| `animateToEnd` | plays on to the end of the current pass, then `atEnd` |

**What happened to the flag.** Until schema 1.22 the file had it:
`actions.stop: { behavior: "rewind", completeIteration: true }`. Schema 1.23 folded the flag into the value
`animateToEnd`, and "what happens after the pass" moved to `atEnd`.

So the first scenario can be written today only as `stop: animateToEnd` plus `atEnd: animateToStart`. Then a
natural end also plays backwards. For a loop without end that is the same thing. For an animation with a set
number of iterations it is not, and the two cannot be set apart.

**Opinion.** The owner is right: the fold in 1.23 lost a real case.

**First proposal, not taken.** Bring the flag back beside `behavior`, and remove the two "to end" values. The
owner found the pair of keys awkward.

**Third feedback (2026-11-13).** "Let's not bring back completeIteration. Instead, let's have jumpToEnd |
animateToEnd | animateToStart (from the current position) | animateToEndAndStart (this is equivalent to
completeIteration: true; come up with a better name maybe)."

**The list of stop values, as decided.** One key, five values. Four exist today; the last one is new.

| `actions["playback.stop"].behavior` | What the viewer sees | State after |
|---|---|---|
| `jumpToStart` (default) | at once to the rest pose | `off` |
| `animateToStart` | plays backwards from where it is | `returning`, then `off` |
| `jumpToEnd` | at once to the end of the current pass | `finished`, then `whenFinished` applies |
| `animateToEnd` | plays on to the end of the current pass | `finished`, then `whenFinished` applies |
| `animateToEndAndBack` (new) | plays on to the end of the current pass, then plays backwards to the start | `off` |

- The owner's list did not name `jumpToStart`. It stays: it is today's default, and the out-of-view stop
  (item 6) is exactly this value.
- The new value does not use `whenFinished`. That is the point: a stop can finish the pass and play back, while a
  natural end still does what `whenFinished` says.
- "Finish the pass, then jump to the start" needs no value of its own: `animateToEnd` with
  `whenFinished: jumpToStart`.

Names considered for the new value: `animateToEndThenStart`, `animateToStartViaEnd`, `animateToEndAndStart`.

**Decision (2026-11-13).** ✅ No `completeIteration` flag. The stop keeps one key with the five values above, and
the new one is named `animateToEndAndBack`.

---

## 9. ✅ `onFinish` → `onPlaybackFinish`

**Feedback.** "Inconsistent callback names: why onPlaybackStart() but onFinish()? Name it onPlaybackFinish() as
well. It is good to have 'playback' in those names; later, with scenes or segments, onStart/onStop can be
confusing."

**The problem.** Five callbacks report what the playback does. Four carry the word, one does not.

**Today.** `onReady` · `onPlaybackStart` · `onPlaybackStop` · `onPlaybackPause` · `onPlaybackResume` · `onFinish` ·
`onDestroy`. Vue emits `ready` · `playbackStart` · … · `finish` · `destroy`. `onFinish` fires when the last pass
ends; a loop without end never fires it.

**Opinion.** I agree. `onFinish` is a playback event. `onReady` and `onDestroy` belong to the player itself and
stay plain. The prefix also leaves room for `onSegmentFinish` later.

**Suggestion: change.** `onFinish` → `onPlaybackFinish`, Vue `finish` → `playbackFinish`, the registry event the
same way. No alias.

**Decision (2026-11-12).** ✅ Rename to `onPlaybackFinish`.

---

## 10. ✅ The start behaviours

**Feedback.** "continue | jumpToStart | jumpToEnd looks strange. I would expect something like animateToEnd and it
is the only value. So I guess we control what to do with where the playhead was before start() was called. Only
two values, e.g. 'fromStart' | 'fromCurrentPosition' — find better names — and 'fromStart' is the default."

**The problem.** A start always plays forward to the end. The only real choice is where it begins. The three
current values hide that, and one of them plays nothing at all.

**Today.** `actions["playback.start"].behavior`:

| Value | Meaning |
|---|---|
| `continue` (default) | plays on from where it is; from the start when it rests at the start or the end |
| `jumpToStart` | always from the start |
| `jumpToEnd` | shows the end pose at once, no motion, then `atEnd` |

`jumpToEnd` was added for art that appears at once and leaves animated. No editor preset uses it.

**Opinion.** I agree with two values and with the default. For the names I suggest `fromStart` and
`fromCurrentTime`: the handle already calls the playhead "current time" (`getCurrentTime()`).

`fromCurrentTime` keeps today's `continue` rules: a paused playback unfreezes, a returning one turns around, a
playing one is left alone, and at rest it plays from the start.

**Suggestion: change.**

- `behavior: "fromStart" | "fromCurrentTime"`, default `fromStart`.
- Remove `jumpToEnd` as a start. A page that needs the end pose at once calls `setCurrentProgress(1)`.
- The editor's "Hover: there and back" preset writes `fromCurrentTime`, so a returning animation still turns
  around smoothly.

**Decision (2026-11-12).** ✅ Two values, `fromStart` (default) and `fromCurrentTime`; `jumpToEnd` is dropped as a start.

**Changed 2026-11-13.** ✅ `fromCurrentTime` is dropped as well: "fromCurrentTime looks strange; get rid of it."

- The start action has no setting. `actions["playback.start"]` leaves the file.
- `playback.start` always plays from the start: from code, from a trigger and from the `playback` prop.
- "Carry on, do not restart" is the `playback.play` action (item 15).
- Older files: the old default, `continue`, behaved exactly as `playback.play` does. So a file that used it gets
  its start events moved to the `"playback.play"` list, and plays as before. A file that said `jumpToStart` keeps
  them in `"playback.start"`. The rare `jumpToEnd` start has no new form and becomes a plain start.

---

## 11. ✅ Moving the playhead: what exists and how it behaves

**Feedback.** "Do we have something like setProgress()/setTime() to move the playhead during playing, or
showAtProgress/showAtTime for when it is static? Not clear how it works. Explain the current state."

**The problem.** There are two ways to choose a frame, in two places, with different words. Nothing explains when
to use which.

**Today — from code, on the handle.**

| Call | Range | Meaning |
|---|---|---|
| `playback.setCurrentTime(ms)` | `0 … getDuration()` | a frame inside the current iteration |
| `playback.setCurrentProgress(p)` | `0 … 1` | the same, as a fraction |
| `playback.setTotalTime(ms)` | `0 … getTotalDuration()`; no upper limit for an endless loop | a position on the whole playback, all iterations |

Each has a matching read (`getCurrentTime()`, `getCurrentProgress()`, `getTotalTime()`), plus
`getCurrentIteration()` and `getTotalProgress()`. Values outside the range are clamped.

A seek never changes the state and reports nothing:

| State | After a seek |
|---|---|
| `playing` | keeps playing from the new frame |
| `paused` | shows the new frame and stays paused |
| `off` | shows the new frame; the state still reads `off` |

**Today — from props, on the components only.** `showAtProgress={0.5}` or `showAtTime={500}` shows one frame and
nothing plays. Changing the prop moves the frame, which is how a slider or app state drives it. They cannot be
mixed with `playback` or `playUsingActionTriggers` (warning PX1501). The plain web creator has no such option; it
uses the handle.

**Opinion.** Both ways are needed: one for code that drives a live animation, one for a component that shows a
fixed frame. The names are fine. Two things are unclear and should be fixed:

- After a seek while `off`, the state says `off` but the picture is not the rest pose. I suggest a seek while `off`
  makes the state `paused`: a frame is being held. The browser's own animation API does the same.
- A seek to the exact end while `off` reads `finished`, because that state is worked out from the position. No
  `onFinish` fires. I suggest it reads `paused` too; only playing to the end gives `finished`.

**Suggestion: keep the functions, fix the state rule**, and add one "moving the playhead" section to
`playback-and-triggers.md` with the two tables above.

**Decision (2026-11-13).** ✅ A seek follows one rule:

| State before the seek | After the seek |
|---|---|
| `playing` | the time is corrected and it keeps playing |
| `off`, `finished`, `paused` | `paused` at that frame |

Resuming then plays on from that frame. A seek to the exact end is `paused` too; only playing to the end gives
`finished`.

---

## 12. ✅ Re-enable the scroll and view timelines

**Feedback.** "We have the scroll/view timeline disabled in the player and the editor. We need to re-enable it now,
before releasing to users, because it might require redoing the current schema/API design."

**The problem.** The playback model was designed for a clock. A scroll timeline has no start, stop or pause. If it
does not fit the model, it is cheaper to find out before the names are public.

**Today.**

- **Player:** implemented and shipped. `timeline.type: "scroll" | "view"`, with range points, pin, smoothing and a
  subject, using the browser's scroll timelines where they exist and its own measuring otherwise. The docs mark the
  section "in development".
- **Editor:** the full panel exists (Timeline: Time | Scroll, the scroll cases, the warnings). The picker is hidden
  unless the build shows experimental features (`#svga&experimental`). A file that is already scroll-driven still
  shows it.
- **The contract on a scroll timeline:** `playback.start()`, `stop()`, `pause()`, `resume()`, `playOnce()` and
  `setSpeed()` do nothing and warn (PX1505). Triggers are ignored. A seek applies until the next scroll.

I have not run the scroll tests or pages since the 1.24–1.25 renames, so I cannot say what works today.

**Opinion.** I agree it should be settled before release. The open design questions are few:

- What `playback.getState()` reads on a scroll timeline, and whether any `onPlayback…` callback fires.
- Whether scroll stays a timeline type, or becomes an input that drives progress, as layer 4 of
  `playback-layers.md` sketches. This decides how it combines with segments later.

One question is already settled in the schema: a scroll timeline has its own key list (`inTime`, `outTime`, a
finite `iterations`, the scroll settings) and no `playbackSpeed`, `atEnd` or action blocks.

**Suggestion: do it before release, in this order.**

1. Run the existing scroll specs and the editor's scroll cases on the current code, and list what fails.
2. Decide the two questions above, in a short plan document.
3. Take the picker out of the experimental gate and remove "in development" from the docs.

**Decision (2026-11-12).** ✅ Keep it as it is: the player keeps the scroll and view timelines, and the editor keeps the
picker behind the experimental switch. No re-enable step in this iteration.

Follow-up, not done yet: cover the scroll and view cases in `animation-state.brainstorm` (md and html) — what
the playback state reads on such a timeline, and which settings apply.

---

## 13. ✅ Lottie segments and markers, dotLottie multi-animation, Rive

**Feedback.** "Research Lottie segments/markers, LottieFiles multi-animation, and Rive multi-animation. Describe
what they do that we cannot do, and how close our schema, player and editor are to the same results."

**What they do.**

| | Lottie (lottie-web) | dotLottie | Rive |
|---|---|---|---|
| Animations per file | one timeline | several, listed in a manifest | several per artboard, several artboards |
| Named parts | markers: a name, a start, a length | markers, used as a state's segment | each animation is its own timeline |
| Who picks what plays | the page's code | a state machine in the file, or code | a state machine in the file |
| Switching | `playSegments`, `goToAndPlay(marker)` | a transition; a "tweened" one has a duration and easing | a transition with a duration that blends the two |
| Conditions | none | guards on number, text, on/off and event inputs | conditions on inputs, now moving to data binding |
| Pointer events | none in the file | enter, exit, down, up, move, click; per layer | listeners on shapes inside the picture |
| Wait for the end | `complete`, `loopComplete` events | `OnComplete`, `OnLoopComplete` | exit time on a transition |
| Several at once | no | no | yes: layers, and blend states |
| Other | — | themes, open a URL, fire a custom event | events, nested artboards, runtime data |

**What we cannot do today.**

- Name parts of the timeline. A file has one window, `inTime` to `outTime`.
- Play one part and then another, such as an intro followed by a loop.
- Pick a part from code. A page can seek and pause, but nothing stops at the end of a part.
- Listen on a part of the picture. Triggers listen on the whole graphic.
- Define states, inputs or conditions in the file. Our machine is fixed: four buttons, four states.
- Blend from one animation into another, or run two independently.
- Send an event out of the file, switch a theme, or bind runtime data.

**What we already have that matches.**

| Ours | Theirs |
|---|---|
| `actionTriggers`: load, hover in, hover out, click | dotLottie interactions, Rive listeners |
| `actions["playback.stop"]`: `animateToStart` | a state that plays in reverse |
| `actions["playback.stop"]`: `animateToEnd` | `OnLoopComplete`, Rive's exit time |
| `iterationDirection: alternate`, `iterations`, `playbackSpeed` | `Bounce` mode, `loopCount`, `speed` |
| the out-of-view gate | not built in; page code |
| `inTime` / `outTime` | one segment |

**How close we are.**

- **Schema.** `playback-layers.md` already designs the missing steps: named segments with their own timeline
  settings (layer 3), states and rules (layer 2), inputs (layer 4), and triggers aimed at one element. The dotted
  action names (`"playback.start"`) were chosen so `"segment.next"` can sit beside them.
- **Player.** One executor already serves triggers, props and code. Segments need a window that can change while
  playing, and an "ended" signal per segment. Blending and layers are far: the engine plays one timeline.
- **Editor.** One timeline with an in and out point, and the presets. I found no marker or segment list in it.

**Opinion.** Named segments are the step that gives the most for the least. They cover Lottie markers, the
intro-then-loop pattern and "play this part from code", and they are the base for anything like a state machine.
Blending and layered animations are a different engine, and I would not aim for them now.

**Suggestion: no change now.** Decide items 1–12 first, then plan segments as the next schema layer. Items 5, 7, 9
and 10 make that easier: a `finished` state that always happens, one meaning of start, and prefixed callbacks.

**Decision (2026-11-12).** ✅ Research only. Nothing from this item is implemented in this iteration; it is input for a
later one.

---

## 14. ✅ Progress above 1

**Feedback.** "With a loop with alternating direction, setProgress/showAtProgress need to accept the range [0, 2],
I guess, so people can set a position on the reverse iteration. Otherwise it should mod the value to [0, 1] or
[0, 2]. Unless you have some considerations."

**Second feedback, after the first answer.** "I didn't understand. What is '1' when we have alternating directions
in iterations? Either you are saying that progress 1 is 2 iterations, which is even more confusing, or you are
saying that we have no way to set the playhead with setCurrentProgress on the back leg."

**The problem.** In an alternating loop the animation goes there and back. Every frame is passed twice: once on
the way there, once on the way back. One number from 0 to 1 can name the frame, but not which way it is going.

**Today.** Take a ball that moves from left to right in 1000 ms, with `iterationDirection: "alternate"`.

- Pass 1 plays left → right. Pass 2 plays right → left. Then it repeats.
- **Progress names the frame, never the pass.** `0` is the ball on the left. `1` is the ball on the right. `0.8`
  is the ball 80 % of the way to the right. This is the same in both passes. `1` is never "two iterations".
- `setCurrentProgress(0.8)` puts the ball at 80 % **inside the pass that is playing now**, and that pass keeps
  its direction:

| The playback is in | After `setCurrentProgress(0.8)` |
|---|---|
| pass 1, going right | the ball is at 80 % and continues to the right |
| pass 2, going left | the ball is at 80 % and continues to the left |

- So the playhead can be set on the way back with `setCurrentProgress`, but only when the playback is already on
  the way back. It cannot move from one pass to the other.
- Choosing the pass is done on the second axis, in ms over the whole playback:

| Call | Where it lands |
|---|---|
| `setTotalTime(800)` | pass 1: the ball at 80 %, going right |
| `setTotalTime(1200)` | pass 2, 200 ms into the way back: the ball at 80 %, going left |
| `setTotalTime(2800)` | pass 3: the ball at 80 %, going right |

- The reads are `getCurrentProgress()` for the frame, `getCurrentIteration()` for the pass (counted from 0) and
  `getTotalTime()`.

**Opinion.** The `[0, 2]` idea is "the pass and the frame in one number": `1.2` would be 20 % into the second
pass. The need is real: today it takes arithmetic in ms to pick the pass. I would still not put it into
`setCurrentProgress`:

- The same number would mean different frames in different files. `1.2` is the ball at 80 % in an alternating
  loop, and the ball at 20 % in a normal loop.
- Reducing the number with a remainder (the "mod" in the feedback) breaks the end. `1` must show the last frame,
  and `1 mod 1` is `0`, the first frame.
- For a fixed frame (`showAtProgress`) the pass does not matter. The ball at 80 % looks the same either way.

What is missing is small. There is a read for the pass, `getCurrentIteration()`, and no write.

**First suggestion, not taken.** A second function, `setCurrentIteration(n)`, called before `setCurrentProgress`.

**Third feedback (2026-11-13).** "This is awkward. I would prefer to have one method to set it. Suggest options."

**Options for one method.** Each row shows the call for "second pass, the ball at 80 %, going left".

| | The call | Good | Bad |
|---|---|---|---|
| A. A second argument | `setCurrentProgress(0.8, 1)` | one method, no new name; progress still names the frame; without the second argument it works as today; fine for a loop without end | two values in one call |
| B. One number, counted in passes | `setIterationProgress(1.2)` | one number; fits one slider over several passes | the part after the point is "how far through the pass", so `.2` is the ball at 80 %; a new name beside `setCurrentProgress` |
| C. Widen the range to `0 … 2` | `setCurrentProgress(1.2)` | no new name | `getCurrentProgress()` has to return `0 … 2` as well, so progress no longer names the frame; it means something else in a loop that does not alternate |
| D. One `seek` for everything | `seek({ iteration: 1, progress: 0.8 })` | one function replaces the three setters | the biggest change; an object as the argument |

**Suggestion: A.** `setCurrentProgress(progress, iteration?)`, and the same second argument on
`setCurrentTime(ms, iteration?)`. The iteration is counted from 0, like `getCurrentIteration()`.

**Fourth feedback (2026-11-13).** "OK, don't 'mod', just use setCurrentProgress(value). E.g.
setCurrentProgress(1.2) means 0.2 in the second iteration."

**Decision (2026-11-13).** ✅

- One method, one number. The whole part is the iteration, the rest is how far through that
  iteration. Nothing wraps. The value is clamped to `0 … iterations`; a loop without end has no upper limit.

| Call, for a 1000 ms animation | Where it lands |
|---|---|
| `setCurrentProgress(0.8)` | first iteration, 800 ms in |
| `setCurrentProgress(1)` | the end of the first iteration: its last frame |
| `setCurrentProgress(1.2)` | second iteration, 200 ms in |
| `setCurrentProgress(5.3)` | sixth iteration, 300 ms in |

- **In an alternating loop** "0.2 in the second iteration" is 20 % of the way through the second pass,
  in the order it plays (confirmed by the owner). The second pass runs backwards, so the ball is at 80 % and going left. This is the only
  reading where the picture does not jump when the value crosses 1. It is the same as
  `setTotalTime(1.2 × getDuration())`.
- **What changes from today:** `setCurrentProgress(0.8)` now always means the first iteration. Today it means
  "80 % inside the iteration that is playing now".
- `showAtProgress` on the components follows the same rule.
- **The read uses the same number.** `getCurrentProgress()` returns `1.2` in the second iteration, so writing
  back what was read changes nothing. A bar that should run `0 … 1` on every pass uses
  `getCurrentTime() / getDuration()`.

---

## 15. ✅ `playback.play`: start, or carry on

**Feedback, in the answer to item 7.** "Yes! Otherwise a 'playback.play' trigger needs to be used, I guess, which
is start (when off) or resume (when on, even when playing), depending on the state. player.playback.play() calls
internally either start() (if the player is stopped) or resume() otherwise. When already playing, resume()
doesn't do anything."

**The problem.** With item 7, `start` always restarts. Some animations need the other meaning: "make it go, but do
not restart it if it is already going". The editor's "Hover: there and back" preset is one. If the pointer comes
back while the animation is still playing, or is on its way back, a restart shows as a jump.

**Today.** That meaning is the default start behaviour, `continue`. The handle had `play()` until 1.25 (resume
when paused, otherwise start). It was removed as a second spelling of the same act.

**Opinion.** There are two ways to give the file this meaning. They should not both exist.

| | A: a setting on start (item 10) | B: a fifth action, `playback.play` |
|---|---|---|
| In the file | `"playback.start": { behavior: "fromCurrentTime" }` | the event goes into the `"playback.play"` list |
| In code | what `start()` does depends on the file | `playback.play()` beside `playback.start()` |
| Fits item 7 ("always") | no: `start()` does not always restart | yes: each word has one meaning everywhere |
| In the editor | four lists and a Start dropdown | five lists, no Start dropdown |
| Cost | `start()` cannot be understood without the file | one more list, one more rule for an event in two lists |

I prefer B. It is the only one where item 7 holds without an exception, and it removes the start action's
settings completely. A page also gets the usual Play button in one call.

**Suggestion: add `playback.play`, and drop `fromCurrentTime` from item 10.**

| State | `playback.play()` and the `"playback.play"` trigger |
|---|---|
| `off`, `finished` | starts from the start |
| `paused` | resumes |
| `playing` | does nothing |
| `returning` | turns around and plays forward from where it is |

The last row is my addition; the feedback does not cover it. It is what keeps "Hover: there and back" smooth.

**Decision (2026-11-13).** ✅ In two steps on the same day.

- First: "It is a convenience method. Add this, and keep fromCurrentTime for now as well."
- Then: `fromCurrentTime` is dropped (item 10), and "let's add the 'playback.play' trigger if it makes sense".

It does make sense, and it is needed. With `fromCurrentTime` gone, the list is the only way a file can say "carry
on, do not restart", and it is where the old default of older files goes. So this is option B in full:

- `playback.play()` on the handle;
- `"playback.play"` as a fifth list in `actionTriggers`, with its own row in the editor.

When one event is in more than one list, my proposal for which list wins. It can be settled when it is built:

| State | The lists, first match wins |
|---|---|
| `playing` | pause, stop, start. `play` does nothing here. |
| `paused` | resume, play, stop, start |
| `off` | start, play |
| `returning` | start (jumps to the start, then plays), play (turns around) |
| `finished` | stop when the last frame is held; otherwise start, play |

---

## How the items fit together

- **One breaking release.** Items 1–11, 14 and 15 change public names or behaviour. 1.0.55 is published with the
  current names, so they should go out together, with no aliases, as before.
- **One schema step** (1.26) carries the file changes: `whenFinished` (5), `outOfView: stop` (6), the new stop
  value (8), the start action losing its setting (7, 10), and the `"playback.play"` list (15). Older files are
  converted on read.
- **Order.** 7, 10 and 15 first, then 3 and 4, which depend on them. 5, 6 and 8 together. 1, 2 and 9 are
  independent renames. 11 and 14 are small and can ride along.
- **Not in this iteration.** 12 stays as it is. 13 is research only.

## Still open

Nothing. All fifteen items are decided as of 2026-11-13. Nothing is implemented yet.

## What I assumed — say if any of these is wrong

- **Item 15:** while the picture is on its way back (`returning`), `play()` turns it around and plays forward
  from where it is.
- **Item 15:** the table of which list wins when one event is in several.
- **Item 11:** a seek reports no callback, also when it changes the state to `paused`. A seek during `returning`
  gives `paused` too.
- **Item 10:** older files with the old default get their start events moved to the `"playback.play"` list.
- **Item 8:** a stop that goes to the end leaves the state `finished`, as today.

## Planned work, not started

**The brainstorm document**, `animation-state.brainstorm.md` and its page `animation-state.brainstorm.html`:

- Remove two sections: "0. The change in one place" and "6. Rejected on the way (2026-11-09/10)".
- Keep the others: 1. Terms and concepts · 2. The machinery as boxes · 3. The model · 4. Inside the box — the
  playback's state machine · 5. Why these words · 7. Later — not in this step · 8. History.
- Add the scroll and view cases (item 12): what the playback state reads on such a timeline, and which settings
  apply.
- Regenerate the html from the md.
- Four plan documents, one code comment, one skill and one test report point at "brainstorm §0". They need a new
  target when the section goes.

## Sources for item 13

- [dotLottie state machine specification](https://docs.lottiefiles.com/en/format/dotlottie/interactivity/state-machines/specification)
- [dotLottie web player: loading animations](https://docs.lottiefiles.com/en/runtimes/distributions/js/v0.x/core-concepts/loading-animations.md)
- [How multi-animation works in dotLottie](https://lottiefiles.com/blog/dotlottie/how-multi-animation-works-in-dotlottie)
- [Named markers in Lottie animations](https://lottiefiles.com/blog/working-with-lottie-animations/how-to-setup-named-markers-in-lottie-animations)
- [lottie-web](https://github.com/airbnb/lottie-web)
- [How state machines work in Rive](https://rive.app/blog/how-state-machines-work-in-rive)
- [Rive features](https://rive.app/features) · [Rive listeners](https://rive.app/docs/editor/state-machine/listeners) ·
  [Rive data binding migration guide](https://rive.app/docs/editor/data-binding/migration-guide)

## Implementation progress (2026-11-13, the owner's go: "ok, you can implement the change now")

Schema 1.26. Nothing committed.

| Step | State |
|---|---|
| core — schema, rules (`triggerActionFor` with `whenFinished`), executor (explicit state, `play`, `seek`, `leaveView` / `returnToView`, `animateToEndAndBack`), wire step 1.25 → 1.26, release record, field snapshot | done, 811 tests green |
| web — `document` option (export key `document`), `data-px-document`, `playerActionTriggers`, `onPlaybackFinish` (told by the executor), gate presses the real buttons | done, 220 tests green |
| react / vue / react-native components (CSS components: a start restarts by remounting the content) | done — 70 / 50 / 42 tests green |
| docs, READMEs, examples, docs-check | done — `pnpm check:docs` 172 passed; package build 10/10; examples typecheck; `check:get-started --local` 8 of 8 (published mode fails until a publish: the examples use 1.26 names) |
| kf editor — model, panel (Play on list; no Start playback choice; When finished; Out-of-View Stop), presets, export dialog, CSS trigger script, preview players, fixtures (350 restamped, 7 moved to `playback.play`), videos, field snapshot | done — tsc clean (7 known), 157 relevant spec files green after 7 expectation updates |
| brainstorm md + html | done — §0 and §6 removed, new §6 scroll / view timelines; both diagrams render |

Small choices made while implementing (say if any is wrong):
- the 1.26 step moves a `continue` start's hover / click events to `playback.play`; `load` stays a start (identical either way, and it keeps most files unchanged)
- a start from `off` does not jump first — `off` is always the rest pose
- the engine's raw finish no longer reaches the page: the executor tells `onPlaybackFinish`, never for the end of a return leg (it used to fire there too)
