# React API — hands-on check

Status **2026-10-25** — a checklist for trying `@pixodesk/svg-animator-react` by hand and judging it
the way a user of the library would. Each item gives:
- **code** to paste;
- what the component **does today** (read from the source; ❓ = not verified, find out by trying);
- **why** it may be awkward;
- **alternatives** to compare against;
- a **Verdict** line for your notes.

🔴 likely to trip people · 🟠 awkward or inconsistent · 🟡 polish · ✅ checked in the source

---

## Setup

| | |
|---|---|
| Playground | `~/projects/pixodesk-learning-projects/hello-react` → `npm run dev`. It installs the published **1.0.50** — the current runtime (only a type fix landed since). Latest source instead: `pnpm example:docs` in this repo (cases in `examples/docs-examples/src/cases/react/`, listed in `cases.mjs`). |
| The file | `src/animation.json` = the ball: one 1 s pass, `start: load`, `outOfView: pause`, `iterations: infinite` → a **looping** document. Add `iterations={1}` to make it **one-shot** — this changes what `play` means (section C). |
| Console | Keep it open: the warnings are part of the API being judged. |

> **2026-10-26 — the source moved on** ([component-api plan](../plans/component-api.md) D4): hello-react runs the
> LOCAL source, where every driver starts with `play`. Translate the fragments below (they keep the published
> 1.0.50 spelling until the API settles):
> `start="hover" hoverEnd="reset"` → `playOnTrigger={{ start: 'hover', hoverEnd: 'reset' }}` (the WHOLE trigger);
> `iterations={1}` → `timeline={{ iterations: 1 }}` (a merge, as 1.0.50's `timeline` was);
> `apiRef` → `playerRef`; `progress` / `time` → `playCurrentProgress` / `playCurrentTime`; `resetTimeline` is gone.

`src/App.tsx` — paste a fragment's component and render it from `App`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { SvgAnimationPlayer, type PxAnimationPlayerHandle } from '@pixodesk/svg-animator-react';
import animation from './animation.json';

const box = { width: 160, border: '1px solid #ddd' };

export function App() {
    return <TryA1 />;
}

function TryA1() {
    return <SvgAnimationPlayer doc={animation} style={box} playOnTrigger />;
}
```

---

## 0. First contact

### 0.1 The bare component 🟠
```tsx
<SvgAnimationPlayer doc={animation} style={box} />
```
- **Today ✅:** the first frame, still. The file says "start on load", but nothing plays without a control prop (the no-driver rule), and nothing is logged.
- **Why:** the first thing anyone writes does nothing, silently.
- **Note:** decided in the first-use review §1+2 (`autoplay` used to lie). Reopen only if it still feels wrong in practice; a one-time hint ("add `playOnTrigger` to play as the file says") would not reopen it.
- **Verdict:**

### 0.2 Reading the props in the editor 🟠
Type `<SvgAnimationPlayer doc={animation} ` and look at the autocomplete list.
- **Today ✅:** one flat interface, 34 props:

  | Group | Count |
  |---|---|
  | element (`className`, `style`, `doc`) | 3 |
  | override (`timeline`, `resetTimeline`) | 2 |
  | timeline shortcuts | 10 |
  | control | 8 |
  | lifecycle callbacks | 7 |
  | diagnostics | 4 |
- **Why:** four control modes share one bag. Nothing in the types says `playMode` matters only with `play`, or `hoverEnd` only with `start="hover"` + `playOnTrigger`.
- **Alternatives:**
  - a discriminated union of prop sets, so TypeScript flags `playMode` without `play`;
  - fewer modes (sketches S1–S3).
- **Verdict:**

---

## A. Playing as the file says

### A1. `playOnTrigger`
```tsx
<SvgAnimationPlayer doc={animation} style={box} playOnTrigger />
```
- **Today ✅:** starts on load and loops forever.
- **Watch for:** is `playOnTrigger` the word you'd guess for "play as the file says"?
- **Verdict:**

### A2. "Load" waits for the viewport 🟡
```tsx
function TryA2() {
    return (
        <>
            <div style={{ height: '150vh' }}>scroll down</div>
            <SvgAnimationPlayer doc={animation} style={box} playOnTrigger />
        </>
    );
}
```
- **Today ✅:** `start: 'load'` runs only while at least half of it is on screen. The defaults are `outOfView: 'pause'`, `inViewThreshold: 0.5` and a 150 ms debounce. Scroll away and it pauses.
- **Why:** "load" reads as "on page load". The gate is a good default, but the word hides it.
- **Alternative:** say it where the value is documented (renaming a wire value is expensive).
- **Verdict:**

### A3. One file, two mounts
```tsx
function TryA3() {
    return (
        <>
            <SvgAnimationPlayer doc={animation} style={box} playOnTrigger />
            <SvgAnimationPlayer doc={animation} style={box} playOnTrigger iterations={1} />
        </>
    );
}
```
- **Today ✅:** each mount has its own ids; the second plays once.
- **Verdict:**

---

## B. Overriding the trigger — expected to be the awkward part

### B1. Start on hover
```tsx
<SvgAnimationPlayer doc={animation} style={box} playOnTrigger start="hover" />
```
- **Today ✅:** plays while the pointer is over it; leaving pauses (`hoverEnd` defaults to `pause`).
- **Watch for:** is "pause on leave" the default you'd want?
- **Verdict:**

### B2. What leaving does
```tsx
function TryB2() {
    return (
        <>
            <SvgAnimationPlayer doc={animation} style={box} playOnTrigger start="hover" hoverEnd="pause" />
            <SvgAnimationPlayer doc={animation} style={box} playOnTrigger start="hover" hoverEnd="reset" />
            <SvgAnimationPlayer doc={animation} style={box} playOnTrigger start="hover" hoverEnd="continue" />
            <SvgAnimationPlayer doc={animation} style={box} playOnTrigger start="hover" hoverEnd="reverse" iterations={1} />
        </>
    );
}
```
- **Today ✅:** four values; `hoverEnd` is read only when `start` is `hover`.
- **Find out ❓:** `reverse` on the looping file (drop `iterations={1}`).
- **Verdict:**

### B3. Forget `playOnTrigger` 🔴
```tsx
<SvgAnimationPlayer doc={animation} style={box} start="hover" />
```
- **Today ✅:** nothing ever plays, and nothing is logged. Without `playOnTrigger` the component is in `static` mode, and `suppressTriggerStart` writes `start: 'manual'` over your `start`.
- **Why:** `start="hover"` is the most explicit instruction on the line, and it's the one silently dropped. It takes two props to say one thing.
- **Alternatives:**
  1. A trigger shortcut (`start`, `hoverEnd`, `outOfView`, …) implies `playOnTrigger` — the cheapest fix.
  2. At least warn: "`start` is ignored — add `playOnTrigger`".
  3. One prop for both — sketch S1.
- **Verdict:**

### B4. Two spellings for one override 🟠
```tsx
function TryB4() {
    return (
        <>
            <SvgAnimationPlayer doc={animation} style={box} playOnTrigger start="hover" hoverEnd="reset" />
            <SvgAnimationPlayer doc={animation} style={box} playOnTrigger
                timeline={{ trigger: { start: 'hover', hoverEnd: 'reset' } }} />
            {/* both, disagreeing */}
            <SvgAnimationPlayer doc={animation} style={box} playOnTrigger start="click"
                timeline={{ trigger: { start: 'hover' } }} />
        </>
    );
}
```
- **Today ✅:** the first two behave the same. In the third the shortcut wins (`click`), silently.
- **Why:** two ways to say it plus a precedence rule to remember, and tutorials mix them (the React learn video uses both).
- **Alternatives:**
  - shortcuts for the trigger, `timeline` only for timing;
  - a typed `trigger={{ … }}` object (S1).
- **Verdict:**

### B5. The `timeline` object is untyped 🟠
```tsx
<SvgAnimationPlayer doc={animation} style={box} playOnTrigger
    timeline={{ trigger: { strat: 'hover' }, iterations: 'forever' }} />
```
- **Today ✅:** TypeScript accepts it, because `timeline` is `Record<string, unknown> | string`.
- **Find out ❓:** what the console says about `strat` and `'forever'`.
- **Why:** the shortcuts are typed, but the one nested override has no autocomplete and no checking.
- **Alternatives:**
  - type it as a deep partial of the wire timeline (with `null` allowed for deletes);
  - drop the JSON-string form from React (its use case is mangled builds, not React apps).
- **Verdict:**

### B6. Deleting and resetting
```tsx
function TryB6() {
    return (
        <>
            <SvgAnimationPlayer doc={animation} style={box} playOnTrigger timeline={{ delay: null }} />
            <SvgAnimationPlayer doc={animation} style={box} playOnTrigger resetTimeline />
        </>
    );
}
```
- **Today ✅:**
  - `null` deletes a key, so its default comes back;
  - `resetTimeline` ignores the file's whole timeline (player defaults, with `timeline` on top).
- **Watch for:** would you ever reach for these? Do they deserve top-level props?
- **Verdict:**

### B7. Changing an override while it plays 🟠
```tsx
function TryB7() {
    const [start, setStart] = useState<'hover' | 'click'>('hover');
    const [loop, setLoop] = useState(true);
    return (
        <>
            <button onClick={() => setStart(start === 'hover' ? 'click' : 'hover')}>start = {start}</button>
            <button onClick={() => setLoop(!loop)}>loop = {String(loop)}</button>
            <SvgAnimationPlayer doc={animation} style={box} playOnTrigger start={start}
                iterations={loop ? 'infinite' : 1} onDestroy={() => console.log('rebuilt')} />
        </>
    );
}
```
- **Today ✅:** any override change makes a new document, so the player is rebuilt: a new instance, back to frame 0, and `onDestroy` fires.
- **Why:** a setting change looks like a restart.
- **Alternative:** apply trigger and timing changes to the live player and rebuild only on `doc` (S5).
- **Verdict:**

### B8. `start="manual"` contradicts `playOnTrigger` 🟡
```tsx
function TryB8() {
    const ref = useRef<PxAnimationPlayerHandle>(null);
    return (
        <>
            <SvgAnimationPlayer doc={animation} style={box} playOnTrigger start="manual" apiRef={ref} />
            <button onClick={() => ref.current?.play()}>play</button>
        </>
    );
}
```
- **Today ✅:** "play on trigger, where the trigger is manual" waits for `play()`. That's the same as leaving `playOnTrigger` out.
- **Why:** two spellings of "nothing starts it", and one contradicts itself.
- **Verdict:**

### B9. Click toggles; it never restarts 🟡
```tsx
<SvgAnimationPlayer doc={animation} style={box} playOnTrigger start="click" iterations={1} />
```
- **Today ✅:** a click plays, pauses or resumes (`click` is a plain toggle).
- **Find out ❓:** does a click after the end replay?
- **Why:** "ring the bell on every click" (one pass from the start) needs the imperative `playOnce()` (D1).
- **Alternatives:**
  - a `click: 'toggle' | 'restart'` trigger option (a wire change);
  - document the recipe.
- **Verdict:**

### B10. Does the visibility gate apply outside `playOnTrigger`? ❓
```tsx
function TryB10() {
    return (
        <>
            <div style={{ height: '150vh' }}>scroll down</div>
            <SvgAnimationPlayer doc={animation} style={box} play />
        </>
    );
}
```
- **Find out:** only `start` is taken over, so the file's `outOfView: 'pause'` survives in `play` mode. Does a `play`-driven loop pause off screen and resume on return, and is that what you'd want?
- **Verdict:**

---

## C. Declarative — `play`, `pause`, `playMode`, `completeIteration`

### C1. Hover built from state 🟠
```tsx
function TryC1() {
    const [hovered, setHovered] = useState(false);
    return (
        <div style={box} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
            <SvgAnimationPlayer doc={animation} iterations={1} play={hovered} playMode="both" />
        </div>
    );
}
```
- **Today ✅:** enter plays to the end; leave plays back from wherever it is; turnarounds are smooth.
- **Why:**
  - The component takes no DOM props: no `onMouseEnter`, `onClick`, `aria-label`, `role`, `tabIndex`, `id` or `data-*`, and no `ref` to the `<svg>`. So every interaction needs a wrapper `<div>`.
  - TypeScript rejects `<SvgAnimationPlayer onMouseEnter={…} />`. But `aria-label="…"` and `data-*` compile (hyphenated JSX names aren't checked) and are silently dropped.
  - Compare with B2's `hoverEnd="reverse"`: there are two hover mechanisms. Which one would you reach for?
- **Alternatives:**
  - S4: spread the rest onto the root `<svg>` and forward `ref`;
  - a built-in `whileHover`-style prop (the framer-motion idiom).
- **Verdict:**

### C2. Same code, looping file 🔴
C1 without `iterations={1}`.
- **Today ✅:** `play` is now a **run** switch: enter runs the loop, leave snaps to rest, and `playMode="both"` warns and is ignored.
- **Why:** what `play` means depends on the file's effective iterations. A designer turning on "loop" in the editor changes what your React code does, with no code change.
- **Alternative:** let the prop name choose the meaning, not the file (S2).
- **Verdict:**

### C3. The four `playMode` values 🟠
```tsx
function TryC3() {
    const [on, setOn] = useState(false);
    return (
        <>
            <button onClick={() => setOn(!on)}>on = {String(on)}</button>
            {(['forwards', 'backwards', 'both', 'none'] as const).map(mode => (
                <SvgAnimationPlayer key={mode} doc={animation} style={box} iterations={1} play={on} playMode={mode} />
            ))}
        </>
    );
}
```
- **Today ✅:** `playMode` picks which pose changes animate:

  | Value | `play` on | `play` off |
  |---|---|---|
  | `forwards` (default) | plays to the end | snaps back to the start |
  | `backwards` | snaps to the end | plays back to the start |
  | `both` | plays | plays back |
  | `none` | snaps | snaps |
- **Why:**
  - These are `fillMode`'s words, but the question is different (travel, not rest), and `forwards` reads like a direction.
  - A hover icon needs `both`, which you have to know.
- **Alternatives:** `transition="on" | "off" | "both" | "none"`, or `animateOn="enter" | "exit" | "both"`.
- **Verdict:**

### C4. `play` on mount doesn't play 🟠
```tsx
<SvgAnimationPlayer doc={animation} style={box} iterations={1} play />
```
- **Today ✅:** it shows the **end** pose with no motion. "A mount never animates", so a list of icons doesn't all fire on render.
- **Why:** sensible for poses, but surprising for a prop called `play`.
- **Alternative:** `pose="end"` (S2): the name then says "show the end".
- **Verdict:**

### C5. A splash you can fire twice 🔴
```tsx
function TryC5() {
    const [splash, setSplash] = useState(false);
    return (
        <>
            <button onClick={() => setSplash(true)}>splash</button>
            <SvgAnimationPlayer doc={animation} style={box} iterations={1}
                play={splash} onFinish={() => setSplash(false)} />
        </>
    );
}
```
- **Today ✅:**
  - It repeats only because `onFinish` re-arms the state.
  - Without `onFinish`, the second click does nothing (`play` is already true).
  - ❓ Turning `play` off snaps back (default `forwards`). Is there a visible jump at the end?
- **Why:** "play it again" is an event, not a state. The state API needs a re-arm dance, and the clean verb, `playOnce()`, exists only on the ref.
- **Alternatives:**
  - a replay token: `<SvgAnimationPlayer playOnceKey={n} />` (change the number for one pass, without a rebuild);
  - the hook (S3): `player.playOnce()`.
- **Verdict:**

### C6. Spinner and heartbeat
```tsx
function TryC6() {
    const [busy, setBusy] = useState(false);
    return (
        <>
            <button onClick={() => setBusy(!busy)}>busy = {String(busy)}</button>
            <SvgAnimationPlayer doc={animation} style={box} play={busy} />
            <SvgAnimationPlayer doc={animation} style={box} play={busy} completeIteration />
        </>
    );
}
```
- **Today ✅:** off snaps to rest. With `completeIteration`, it finishes the current bounce first.
- **Watch for:** should finishing the iteration be the default for loops? A UI "stop" usually wants a graceful end.
- **Verdict:**

### C7. `pause`
```tsx
function TryC7() {
    const [paused, setPaused] = useState(false);
    return (
        <>
            <button onClick={() => setPaused(!paused)}>paused = {String(paused)}</button>
            <SvgAnimationPlayer doc={animation} style={box} play pause={paused} />
            <SvgAnimationPlayer doc={animation} style={box} pause={paused} />
        </>
    );
}
```
- **Today ✅:** the first freezes and resumes. The second warns ("`pause` does nothing without `play`") and stays still.
- **Watch for:** do `play` + `pause` read as two booleans for one control?
- **Verdict:**

### C8. A class change resets the animation 🔴
```tsx
function TryC8() {
    const [hovered, setHovered] = useState(false);
    return (
        <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
            <SvgAnimationPlayer doc={animation} style={box} iterations={1} play={hovered} playMode="both"
                className={hovered ? 'icon hot' : 'icon'} />
        </div>
    );
}
```
- **Today ✅:** `className`, `style`, every override prop and the control mode are part of the player's key. A change rebuilds the player, and a mount never animates, so the hover **jumps** instead of playing.
- **Why:** highlighting the hovered icon is the most natural thing to add next to `play={hovered}`.
- **Alternative:** S5. React already re-renders the `<svg>`; only the player instance needs to survive.
- **Verdict:**

### C9. Quick in and out
Hover C1 in and out fast, several times.
- **Watch for:** smooth turnarounds and no jumps.
- **Find out ❓:** how many `onPlay` / `onStop` events fire (log them).
- **Verdict:**

---

## D. Imperative — `apiRef`

### D1. Buttons
```tsx
function TryD1() {
    const ref = useRef<PxAnimationPlayerHandle>(null);
    return (
        <>
            <SvgAnimationPlayer doc={animation} style={box} apiRef={ref} />
            <button onClick={() => ref.current?.play()}>play</button>
            <button onClick={() => ref.current?.pause()}>pause</button>
            <button onClick={() => ref.current?.setPlaybackRate(-1)}>reverse</button>
            <button onClick={() => ref.current?.cancel()}>cancel</button>
            <button onClick={() => ref.current?.finish()}>finish</button>
            <button onClick={() => ref.current?.playOnce()}>play once</button>
        </>
    );
}
```
- **Find out ❓:**
  - `finish()` on an endless loop;
  - `reverse` at frame 0;
  - `reverse`, then `play`.
- **Verdict:**

### D2. `apiRef`, not `ref` 🟡
- **Today ✅:**
  - The handle comes through `apiRef`, typed `RefObject<PxAnimationPlayerHandle | null>`.
  - `ref` isn't accepted, and neither is a callback ref.
  - The type name `PxAnimationPlayerHandle` has to be imported.
- **Why:** React 19 lets a function component take `ref` as a plain prop, and `<video ref>` is the model people know (an object with `play()` / `pause()`).
- **Alternatives:**
  - `ref` = the handle;
  - the hook (S3).
- **Verdict:**

### D3. A Play / Pause button with the right label 🟠
```tsx
function TryD3() {
    const ref = useRef<PxAnimationPlayerHandle>(null);
    const [playing, setPlaying] = useState(false);
    return (
        <>
            <SvgAnimationPlayer doc={animation} style={box} apiRef={ref} playOnTrigger
                onPlay={() => setPlaying(true)} onStop={() => setPlaying(false)} />
            <button onClick={() => (playing ? ref.current?.pause() : ref.current?.play())}>
                {playing ? 'Pause' : 'Play'}
            </button>
        </>
    );
}
```
- **Today ✅:** `isPlaying()` isn't reactive, so you mirror it with `onPlay` / `onStop`.
- **Find out ❓:** is the label right after the trigger pauses it on its own (scroll it away)?
- **Alternative:** S3 exposes `isPlaying` as state.
- **Verdict:**

### D4. A progress bar while it plays 🔴
```tsx
function TryD4() {
    const ref = useRef<PxAnimationPlayerHandle>(null);
    const [p, setP] = useState(0);
    useEffect(() => {
        let id = 0;
        const tick = () => {
            setP(ref.current?.getCurrentProgress() ?? 0);
            id = requestAnimationFrame(tick);
        };
        tick();
        return () => cancelAnimationFrame(id);
    }, []);
    return (
        <>
            <SvgAnimationPlayer doc={animation} style={box} apiRef={ref} playOnTrigger iterations={3} />
            <progress value={p} max={1} />
        </>
    );
}
```
- **Today ✅:** there's no time or progress event, so you poll with `requestAnimationFrame`.
- **Why:** progress bars, synced captions, or a scrubber that follows playback are common. Polling is boilerplate and re-renders every frame.
- **Alternatives:**
  - `onProgress(progress, timeMs)`, throttled to animation frames;
  - `onIteration(n)`;
  - the hook's `progress` (opt-in).
- **Verdict:**

### D5. Getting the duration 🟠
```tsx
function TryD5() {
    const ref = useRef<PxAnimationPlayerHandle>(null);
    const [ms, setMs] = useState<number | null>(null);
    return (
        <>
            <SvgAnimationPlayer doc={animation} style={box} apiRef={ref}
                onReady={() => setMs(ref.current?.getDuration() ?? null)} />
            <p>{ms} ms</p>
        </>
    );
}
```
- **Today ✅:** `onReady` takes no arguments and the ref is empty until mount, so you need a ref, state and `onReady`.
- **Why:** the duration is in the file, yet getting it takes three hooks.
- **Alternatives:**
  - `onReady(handle)`;
  - a pure `getDocumentDuration(doc)`;
  - the hook's `duration`.
- **Verdict:**

### D6. The ref while the props drive
```tsx
function TryD6() {
    const ref = useRef<PxAnimationPlayerHandle>(null);
    const [on, setOn] = useState(true);
    return (
        <>
            <button onClick={() => setOn(!on)}>play = {String(on)}</button>
            <button onClick={() => ref.current?.pause()}>ref.pause()</button>
            <SvgAnimationPlayer doc={animation} style={box} play={on} apiRef={ref} />
        </>
    );
}
```
- **Today ✅:** it works, with a warning (PX1503): the props own playback, and the next prop change reasserts them.
- **Watch for:** is the warning helpful or noise?
- **Verdict:**

### D7. Callbacks without context 🟡
- **Today ✅:** `onReady`, `onPlay`, `onPause`, `onCancel`, `onFinish`, `onStop` and `onDestroy` take no arguments.
- **Why:**
  - `onStop` can't say why it stopped (pause, finish, off screen);
  - `onPause` can't say whether the trigger or your code paused it.
- **Alternative:** an event object `{ reason, timeMs, progress }`, or at least `onStop(reason)`.
- **Verdict:**

---

## E. Controlled time — `progress` / `time`

### E1. The guide's scrubber
```tsx
function TryE1() {
    const ref = useRef<PxAnimationPlayerHandle>(null);
    const [time, setTime] = useState(0);
    const [max, setMax] = useState(0);
    return (
        <>
            <SvgAnimationPlayer doc={animation} style={box} time={time} apiRef={ref}
                onReady={() => setMax(ref.current?.getDuration() ?? 0)} />
            <input type="range" min={0} max={max} value={time} onChange={e => setTime(+e.target.value)} />
        </>
    );
}
```
- **Watch for:** three hooks for one slider (D5).
- **Verdict:**

### E2. `progress` depends on iterations 🟠
```tsx
function TryE2() {
    return (
        <>
            <SvgAnimationPlayer doc={animation} style={box} progress={0.5} />
            <SvgAnimationPlayer doc={animation} style={box} progress={0.5} iterations={4} />
        </>
    );
}
```
- **Today ✅:**
  - `progress` is a fraction of the whole run (duration × iterations), but of **one** pass when `iterations` is infinite (this file).
  - The first shows mid-bounce (0.5 s); the second shows 2 s into a 4 s run.
- **Why:** the same 0.5 means different frames, so a slider over a looping icon and over a four-pass one behave differently.
- **Alternatives:**
  - `progress` = one pass always, with `time` for the run;
  - or name the run version separately.
- **Verdict:**

### E3. From scrubbing to playing 🟠
```tsx
function TryE3() {
    const [p, setP] = useState<number | undefined>(0.3);
    return (
        <>
            <button onClick={() => setP(undefined)}>play from here</button>
            <SvgAnimationPlayer doc={animation} style={box} progress={p} play={p === undefined} />
        </>
    );
}
```
- **Today ✅:**
  - While `progress` is set, `play={false}` is also set, which warns ("both were set — progress/time wins").
  - Dropping `progress` switches the control mode, which rebuilds the player, so it starts from 0 instead of 0.3.
- **Why:** "scrub, then play from here" is a basic player UI.
- **Alternatives:**
  - a controlled pair like `<video>`: `time` + `playing`, handing over without a rebuild;
  - S3 / S5.
- **Verdict:**

### E4. Re-render cost ❓
Drag E1's slider fast, with a big document and one override prop (e.g. `iterations={2}`).
- **From the source ✅:** on every render, the component:
  - re-applies the override, making a new document;
  - deep-compares that document with the last one to decide whether to rebuild — a whole-document comparison per slider tick.
- **Watch for:** jank on a large file.
- **Verdict:**

---

## F. Smaller findings

| # | What | Status |
|---|---|---|
| F1 | Every React case in docs-examples casts `animation as any` (`react/*/main.tsx`, `playback/override-*`), though §5 made the cast unnecessary | ✅ |
| F2 | The TSDoc of `PxControlMode.static` says "the document's trigger decides"; the code takes the trigger over (nothing plays) | ✅ |
| F3 | `timeline` accepts a JSON string — a minification workaround every React user sees in the types | ✅ |
| F4 | Diagnostics: try `onWarn={d => console.log(d.code, d.kind, d.message)}` with B3, C7 and D6. Can you route them, and does B3 produce anything? | ❓ |
| F5 | Accessibility: no way to put `role="img"` / `aria-label` / `<title>` on the `<svg>`. `role` fails to compile; `aria-label` compiles and is silently dropped (C1) | ✅ |
| F6 | SSR (Next.js): a one-shot with `play` on renders the start pose on the server — does it jump to the end on hydration? | ❓ |

---

## Sketches — alternatives to compare against while trying

**S1. One trigger prop** — replaces `playOnTrigger` and the five trigger shortcuts. Fixes B3, B4, B5.
```tsx
<SvgAnimationPlayer doc={animation} trigger />                                     // as the file says
<SvgAnimationPlayer doc={animation} trigger="hover" />                             // override the start
<SvgAnimationPlayer doc={animation} trigger={{ start: 'hover', hoverEnd: 'reverse' }} />   // typed object
```

**S2. Pose or run, chosen by the prop** — not by the file's iterations. Fixes C2, C3, C4.
```tsx
<SvgAnimationPlayer doc={animation} pose={hovered ? 'end' : 'start'} transition="both" />   // icons
<SvgAnimationPlayer doc={animation} running={busy} stop="iterationEnd" />                  // loops
```

**S3. A hook for control and state.** Fixes C5, D2, D3, D4, D5.
```tsx
const player = useSvgAnimationPlayer();        // stable object; re-renders when its state changes
<SvgAnimationPlayer doc={animation} player={player} />
<button onClick={player.playOnce}>ring</button>
<span>{player.isPlaying ? 'playing' : 'stopped'} · {player.duration} ms</span>
<progress value={player.progress} max={1} />
```

**S4. DOM props pass through to the root `<svg>`.** Fixes C1, F5.
```tsx
<SvgAnimationPlayer doc={animation} role="img" aria-label="Loading" onClick={onClick} ref={svgRef} />
```

**S5. Live updates instead of rebuilds.** `className`, `style`, trigger and timing changes reach the running player; only a new `doc` rebuilds it. Fixes B7, C8, E3.

How others shape the same choices (for calibration):

| Library | Play as the file says | Hover | Control | Reactive state |
|---|---|---|---|---|
| lottie-react | `autoplay`, `loop` | `interactivity` | `lottieRef` (methods) | — |
| @lottiefiles/dotlottie-react | `autoplay`, `loop` | `playOnHover` | `dotLottieRefCallback` (instance + events) | via events |
| @rive-app/react-canvas | `autoplay` | state machine inputs | `useRive()` → `rive.play()` | hook |
| framer-motion | `animate` | `whileHover` | `useAnimationControls()` | named poses (variants) |

---

## Findings — fill in as you go

| # | Sev | In short | Alternative | Your verdict |
|---|---|---|---|---|
| B3 | 🔴 | `start="hover"` without `playOnTrigger`: silently nothing | shortcut implies it / warn / S1 | |
| C2 | 🔴 | `play` means pose or run depending on the file | S2 | |
| C5 | 🔴 | replay needs an `onFinish` re-arm; `playOnce` is ref-only | replay token / S3 | |
| C8 | 🔴 | a `className` / `style` change rebuilds the player | S5 | |
| D4 | 🔴 | no progress event; poll every frame | `onProgress` / S3 | |
| 0.2 | 🟠 | 34 flat props, no per-mode typing | union props / fewer modes | |
| B4 | 🟠 | shortcut vs `timeline.trigger`, shortcut wins silently | one spelling / S1 | |
| B5 | 🟠 | `timeline` is `Record<string, unknown>` | typed deep partial | |
| B7 | 🟠 | any override change restarts the animation | S5 | |
| C1 | 🟠 | no DOM props: wrapper `<div>` for every interaction | S4 | |
| C3 | 🟠 | `playMode` reuses `fillMode` words; hover needs `both` | `transition` | |
| C4 | 🟠 | `play` on mount shows the end without playing | `pose` (S2) | |
| D3 | 🟠 | `isPlaying` not reactive | S3 | |
| D5 | 🟠 | duration takes ref + state + `onReady` | `onReady(handle)` / S3 | |
| E2 | 🟠 | `progress` scale changes with iterations | one-pass `progress` | |
| E3 | 🟠 | scrub → play rebuilds and loses the position | `time` + `playing` / S5 | |
| A2 | 🟡 | `load` hides the visibility gate | document at the word | |
| B8 | 🟡 | `playOnTrigger start="manual"` contradicts itself | S1 | |
| B9 | 🟡 | click only toggles; "restart" needs the ref | trigger option / recipe | |
| D2 | 🟡 | `apiRef` instead of `ref` | `ref` / S3 | |
| D7 | 🟡 | callbacks carry no reason or position | event object | |
