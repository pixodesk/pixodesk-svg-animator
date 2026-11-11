# How other animation libraries name states and controls — survey (2026-11-09)

Reference material for [animation-state.brainstorm.md](./animation-state.brainstorm.md) §5 (which keeps the condensed
table). Read against the brainstorm's kinds of word: "level" = a held control (a lever), "edge" = an event that flips
one (a button), "state" = what the player reports, "end" = the run reaching its end.

| Library | Levels (levers) | Edges / triggers | Reported state | The end | Wait for the end, then switch |
|---|---|---|---|---|---|
| **WAAPI** | — (methods only: `play()` `pause()` `cancel()` `finish()` `reverse()`) | — | `playState`: `idle` · `running` · `paused` · `finished`; `cancel()` → idle, `finish()` → finished | `finish` event, `finished` promise | — |
| **CSS** | the animation applied (or `animation-name: none`) × `animation-play-state: running \| paused` | `:hover` | — | `animationend`; `fill-mode: forwards \| none` | `animationiteration` |
| **SVGator player** | — (`play()` `pause()` `stop()` `restart()` `reverse()` `toggle()`) | export options: hover · click · scroll; on mouse-out / second click: Pause · Reset · Reverse · Continue | `state`: `"playing"` · `"paused"` · `"ended"` · **`"rollback"`** (+ `isPlaying`, `hasEnded`, `isRollingBack`) | `end` event, `hasEnded` | — |
| **GSAP** | `paused()` · `reversed()` (settable flags) | — | `isActive()` (derived: the playhead moves) | `onComplete` · `onReverseComplete` · `onInterrupt` | — |
| **lottie-web** | — (`play()` `pause()` `togglePause()` `stop()` = pause + frame 0) | — | `isPaused` | `complete` · `loopComplete` | — |
| **dotLottie player** | — (`play()` `pause()` `stop()`; **`freeze()` / `unfreeze()`** = halt the render loop, not a user pause) | state-machine `Interactions`: `PointerEnter` `PointerExit` `PointerDown` `PointerUp` `PointerMove` `Click` `OnComplete` `OnLoopComplete` | `isPlaying` · `isPaused` · `isStopped` · `isFrozen` | `complete` · `loop`; `OnComplete` | — |
| **dotLottie state machine** | `inputs`: `Boolean` · `Numeric` · `String` (levels) and `Event` (edge) | interactions → `actions`: `SetBoolean` `Toggle` `SetNumeric` `Increment` `Fire` `Reset` `SetFrame` `SetProgress` | `states` = `PlaybackState` (`autoplay` `loop` `mode` `speed` `segment` `final`) + `GlobalState`; one state at a time; `transitions` with `guards` on inputs | `OnComplete` interaction; `final: true` | `Tweened` transition (`duration`, `easing`) |
| **Rive** | inputs: `Boolean` · `Number` (levels), `Trigger` (edge; "true for a short time"); now View Model properties | `Listeners`: `Pointer Enter` `Pointer Exit` `Pointer Down` `Pointer Up` `Pointer Move` `Pointer Drag` `Click` `Focus` `Blur` `Keyboard` → `Input Change` / `Report Event` | states = animations (Idle · Hovered · Clicked) + `Entry` · `Exit` · `Any State` · blend states; runtime `isPlaying` `isPaused` `isStopped`, `onStateChange` | — (a one-shot state just ends) | transition **`Exit Time`** (+ `Pause Source When Exiting`), `Duration` |
| **Three.js** `AnimationAction` | **`enabled`** · **`paused`** (+ `weight`, `timeScale`) | — | `isRunning()` (= enabled ∧ ¬paused ∧ timeScale ≠ 0 ∧ scheduled), `isScheduled()` | `finished` · `loop` mixer events; **`clampWhenFinished`** (= hold) | `halt(duration)` |
| **Unity Animator** | parameters `Float` · `Int` · `Bool` (levels), `Trigger` (edge); `Animator.enabled`, `speed` | `SetBool` `SetTrigger` `ResetTrigger`; `Play` `CrossFade` | states + `Entry` · `Exit` · `Any State`; `IsInTransition` | — | transition **`Has Exit Time`** / `Exit Time`, `Transition Duration`, `Interruption Source` |
| **Godot** | `AnimationPlayer`: `autoplay`, `speed_scale`; `play()` `play_backwards()` `pause()` `stop(keep_state)` `queue()` `seek()` | state machine `travel()` `start()` `next()` `stop()`; `advance_condition` / `advance_expression` | `is_playing()`, `current_animation`; state machine `Start` · `End` · `Any State` | `animation_finished` | transition **`switch_mode: Immediate \| Sync \| AtEnd`**, `advance_mode: Disabled \| Enabled \| Auto`, `xfade_time`, `reset` (play the destination from its start), `break_loop_at_end` |
| **Spine** `AnimationState` | `TrackEntry`: `loop` `timeScale` `reverse` `holdPrevious` `alpha` `mixDuration` | `setAnimation` (replace) · `addAnimation` (queue) · `setEmptyAnimation` | per track; listener events `start` · `interrupt` · `end` · `dispose` · `complete` · `event` | `complete` (per loop), `end` | the queue (`addAnimation` with `delay`), `mixDuration` |
| **Motion (Framer)** | `animate` (the target), **`variants`** (named states), `whileHover` `whileTap` `whileFocus` `whileInView` `whileDrag` (held conditions) | — | controls: `play()` `pause()` `stop()`, `speed`, `time` | `onAnimationComplete` | `exit` (+ `AnimatePresence`) |

## Three.js `AnimationAction` in code (verified in `src/animation/AnimationAction.js`, dev branch)

```js
const mixer  = new THREE.AnimationMixer(model);
const action = mixer.clipAction(clip);       // one animation on one object
action.loop = THREE.LoopOnce;
action.clampWhenFinished = true;             // hold the last frame at the end
action.play();                               // enters the mixer: "scheduled", not yet "running"

action.enabled = false;  // switch off: the action has no impact (rest pose shows); its time is KEPT
action.enabled = true;   // continues from the kept time
action.paused  = true;   // time stands still, the pose stays
action.paused  = false;  // continues

action.isScheduled();    // in the mixer
action.isRunning();      // enabled && !paused && timeScale !== 0 && no delayed start && scheduled

mixer.addEventListener('finished', e => e.direction);  // +1 reached the end, -1 reached the start
mixer.addEventListener('loop',     e => e.loopDelta);
mixer.update(dt);                                       // each frame
```

```js
// _updateTime, LoopOnce, the clip ran past its end
if ( this.clampWhenFinished ) this.paused = true;
else this.enabled = false;
this._mixer.dispatchEvent( { type: 'finished', action: this, direction: deltaTime < 0 ? - 1 : 1 } );

// reset(): paused = false; enabled = true; time = 0; forget loops and scheduling
```

## Sources

WAAPI `Animation` (MDN), SVGator Player JS API + "interactive SVG" help, GSAP Timeline docs, lottie-web README,
dotLottie state-machine specification + dotlottie React API reference, Rive editor docs (states, transitions, inputs,
listeners) + web runtime parameters, Three.js `AnimationAction` source, Unity Animator Controller + Transition manual,
Godot `AnimationPlayer` / `AnimationNodeStateMachineTransition`, Spine AnimationState listener docs, Motion for React.
Caveat: the dotLottie player's method semantics (`freeze` / `unfreeze`, `isStopped`) came from secondary listings — the
LottieFiles API pages had moved.

## Methods compared (2026-11-10)

Columns are the ACTS of the brainstorm's grammar; a cell is the library's method for it ("—" = none; the idiom in
parentheses). Levers = settable held positions; read-only state is noted under them.

| Library | Go (idle → run) | Continue (unfreeze) | Freeze | Retire (to the rest pose, stays) | Restart | To the end | Reverse | Seek | Speed | Dispose | Levers · read-only state |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **WAAPI** `Animation` | `play()` | `play()` | `pause()` | `cancel()` → `idle`, effect removed | `play()` when finished (else `currentTime = 0`) | `finish()` | `reverse()` | `currentTime =` | `playbackRate =`, `updatePlaybackRate()` | (`cancel()` + drop) | — · `playState` idle · running · paused · finished |
| **`<video>`** HTMLMediaElement | `play()` | `play()` | `pause()` | — (`pause(); currentTime = 0`; `load()` reloads) | `play()` after `ended` | `currentTime = duration` | — (negative rate unsupported) | `currentTime =`, `fastSeek()` | `playbackRate` | (`removeAttribute('src'); load()`) | `autoplay` `loop` `muted` · `paused` `ended` |
| **YouTube IFrame** | `playVideo()` | `playVideo()` | `pauseVideo()` | `stopVideo()` — stops AND unloads | `seekTo(0); playVideo()` | `seekTo(duration)` | — | `seekTo()` | `setPlaybackRate()` | `destroy()` | — · `getPlayerState()` −1 unstarted · 0 ended · 1 playing · 2 paused · 3 buffering · 5 cued |
| **lottie-web** | `play()` (from the current frame) | `play()` | `pause()` | `stop()` = pause + first frame | `goToAndPlay(0, true)` | `goToAndStop(totalFrames − 1, true)` | `setDirection(-1)` | `goToAndStop()` / `goToAndPlay()` | `setSpeed()` | `destroy()` | `loop` `autoplay` (constructor) · `isPaused`; `togglePause()` |
| **dotLottie-web** (secondary listings) | `play()` | `play()` | `pause()` (user) · `freeze()` (render loop) | `stop()` → first frame of the segment | `setFrame(0); play()` | `setFrame(totalFrames − 1)` | `setMode('reverse')` | `setFrame()` | `setSpeed()` | `destroy()` | `setLoop()` `setMode()` `setSegment()` · `isPlaying` `isPaused` `isStopped` `isFrozen` |
| **Rive** web | `play(names?)` | `play()` | `pause()` | — (`stop()` halts, position undocumented; `reset()` rebuilds from the entry state) | `reset()` (+ `autoplay`) | — | — | `scrub()` (deprecated) | — | `cleanup()` | state-machine inputs Boolean · Number, `Trigger` · `isPlaying` `isPaused` `isStopped`; `stopRendering()` / `startRendering()` = the loop off/on |
| **GSAP** | `play()` (from the current position; at the end nothing) | `play()` (forward) · `resume()` (keeps direction) | `pause()` | `revert()` = pre-animation values + killed (or `pause(0)`) | `restart()` | `progress(1)` / `totalProgress(1)` | `reverse()` | `seek()` `time()` `progress()` | `timeScale()` | `kill()` | `paused(bool)` `reversed(bool)` · `isActive()` |
| **anime.js** v4 | `play()` | `resume()` / `play()` | `pause()` | `reset()` = pause + time 0 (instance kept) · `revert()` = original values, cleaned up | `restart()` | `complete()` | `reverse()` `alternate()` | `seek()` | `speed` | `cancel()` = pause + out of the engine, values kept | — · `paused` `reversed` `completed` |
| **Motion** `animate()` controls | `play()` | `play()` (restarts a finished one) | `pause()` | `cancel()` → initial state | `play()` after finish / `time = 0` | `complete()` | `speed = -1` | `time =` | `speed` | `stop()` — halts for good, values kept | — (React: `animate` `whileHover` `whileInView` props ARE levers) |
| **SVGator** | `play()` (from the current offset; restarts if ended) | `play()` | `pause()` | `stop()` → first keyframe | `restart()` | `seek(100)` | `reverse()` | `seek(%)` `seekTo(ms)` `seekBy(ms)` | `set('speed', v)` | `destruct()` | `set('direction' \| 'fill' \| 'iterations' \| 'alternate')` · `state` playing · paused · ended · rollback; `toggle()` |
| **Three.js** `AnimationAction` | `play()` = schedule in the mixer (runs while `enabled && !paused`) | `paused = false` | `paused = true` · `halt(d)` decelerates to it | `stop()` = unschedule + `reset()` · `enabled = false` = rest pose, time kept | `reset().play()` | `time = clip.duration` | `timeScale = -1` | `time =` | `timeScale`, `setEffectiveTimeScale()` | `mixer.uncacheAction()` | **`enabled` `paused`** `weight` `loop` `clampWhenFinished` · `isRunning()` `isScheduled()` |
| **Godot** `AnimationPlayer` | `play(name)` | `play()` (same animation after `pause()`) | `pause()` | `stop()` (`keep_state = false` resets the pose) · `stop(true)` halts, pose kept | `play(name)` again / `seek(0)` | `seek(length)`; `play(…, from_end = true)` | `play_backwards()` | `seek()` | `speed_scale`, `play(…, custom_speed)` | `queue_free()` | `active` `autoplay` · `is_playing()` |
| **Unity** Animator (legacy `Animation` in brackets) | `Play(state)` · `SetTrigger()` [`Play()`] | `speed = 1` | `speed = 0` | — (`Play(idle)`, `Rebind()`) [`Stop()` rewinds] | `Play(state, layer, 0)` [`Rewind(); Play()`] | `Play(state, layer, 1)` [`Sample()`] | `speed = -1` | `Play(state, layer, t)` | `speed` | — | **`enabled`**, parameters Bool · Float, `Trigger` · `IsInTransition()` [`isPlaying`] |
| **Spine** `AnimationState` | `setAnimation(track, name, loop)` | `timeScale = 1` | `timeScale = 0` | `setEmptyAnimation(track, mix)` → setup pose · `clearTrack()` | `setAnimation()` again | `trackTime = animationEnd` | `entry.reverse = true` | `trackTime` | `timeScale` | `clearTracks()` | per entry `loop` `alpha` `holdPrevious` |
| **Pixodesk today** | `play()` (idle → a run per `actions.start`; finished → a fresh run) | `play()` | `pause()` | `stop()` per `actions.stop` (jumpToStart · animateToStart · jumpToEnd · animateToEnd) | `jumpToStart(); play()` · `playOnce()` (one pass) | `jumpToEnd()` | `setPlaybackSpeed(-1)` | `setCurrentTime()` `setCurrentProgress()` `setTotalTime()` | `setPlaybackSpeed()` `setPlaybackDuration()` | `destroy()` | props `play` `pause` `playState` · `getPlayState()` idle · playing · paused · finished |
| **Pixodesk A3** | `play()` | `play()` | `pause()` | `disable()` per `actions.disable` | as today | `jumpToEnd()` | as today | as today | as today | `destroy()` | props **`enabled` `paused`** · `getPlayState()` |
