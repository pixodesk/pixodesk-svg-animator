import './style.css';
import { type PxActionsPatch, type PxDocument, type PxTimelinePatch, type PxTriggers } from '@pixodesk/svg-animator-web';
import {
  getAnimatorConfig,
  isPxDocument,
  PxSuspendTransition,
  PxTriggerEvent,
  type PxInfer,
  type PxTimeTimelineSchema,
  type PxTriggerEvents,
} from '@pixodesk/svg-animator-core';
import { allowedTriggerEvents, resolveTriggers, type PxResolvedTriggers } from '@pixodesk/svg-animator-core/engine';

import { createWebPlayer } from './players/web';
import { createReactPlayer } from './players/react';
import { createVuePlayer } from './players/vue';
import {
  loopModeToIterations,
  type LoopMode,
  type PlayerFactory,
  type PlayerHandle,
  type PlayerKind,
  type PlayerOptions,
} from './players/types';

import sample from './sample.json';

const factories: Record<PlayerKind, PlayerFactory> = {
  web: createWebPlayer,
  react: createReactPlayer,
  vue: createVuePlayer,
};

// -- DOM lookups -------------------------------------------------------------

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el as T;
};

const stageWrap = $('stage-wrap');
const stageEl = $('stage');
const canvas = $('canvas');
const mount = $('mount');
const canvasSizeEl = $('canvas-size');
const errorEl = $('error');
const hintEl = $('hint');
const seek = $<HTMLInputElement>('seek');
const timeEl = $('time');
const filenameEl = $('filename');
const rateSel = $<HTMLSelectElement>('rate');
const rateNote = $('rate-note');

const btnPlay = $<HTMLButtonElement>('btn-play');
const btnPause = $<HTMLButtonElement>('btn-pause');
const btnStop = $<HTMLButtonElement>('btn-stop');
const btnRestart = $<HTMLButtonElement>('btn-restart');
const btnFinish = $<HTMLButtonElement>('btn-finish');
const btnDemo = $<HTMLButtonElement>('btn-demo');
const btnTheme = $<HTMLButtonElement>('btn-theme');

const chkUseTrigger = $<HTMLInputElement>('chk-use-trigger');
const triggerConfigEl = $('trigger-config');
const chkFileConfig = $<HTMLInputElement>('chk-file-config');
const triggerListsEl = $('trigger-lists');
const selOutOfView = $<HTMLSelectElement>('sel-out-of-view');
const inpThreshold = $<HTMLInputElement>('inp-threshold');
const inpDebounce = $<HTMLInputElement>('inp-debounce');
const thresholdField = $('threshold-field');
const debounceField = $('debounce-field');

const transportButtons = [btnPlay, btnPause, btnStop, btnRestart, btnFinish];

// -- Trigger panel: the three lists × the events each may name, from the player's own vocabulary --------

/** The time timeline as the file spells it; the gate keys and `iterations` are picked from it. */
type TimeTimeline = PxInfer<typeof PxTimeTimelineSchema>;

/** The trigger lists, with the editor's labels — typed by the resolved lists' own keys (the
 *  `togglePlay` sugar resolves into them). No `resume`: the player derives it from these three. */
const TRIGGER_LISTS: Array<{ key: keyof PxResolvedTriggers; label: string }> = [
  { key: 'start', label: 'Play on' },
  { key: 'stop', label: 'Stop on' },
  { key: 'pause', label: 'Pause on' },
];
const SUSPEND_TRANSITIONS = Object.values(PxSuspendTransition);

interface EventCheckbox {
  event: PxTriggerEvent;
  input: HTMLInputElement;
}

/** One checkbox per list × event the list may name, from the player's own table so a new event shows up by itself. */
const listCheckboxes = new Map<keyof PxResolvedTriggers, Array<EventCheckbox>>();
for (const { key, label } of TRIGGER_LISTS) {
  const group = document.createElement('fieldset');
  group.className = 'trigger-list';
  const legend = document.createElement('legend');
  legend.textContent = label;
  group.append(legend);
  const boxes: Array<EventCheckbox> = [];
  for (const event of allowedTriggerEvents(key)) {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = event;
    const l = document.createElement('label');
    l.append(input, ` ${event}`);
    group.append(l);
    boxes.push({ event, input });
  }
  listCheckboxes.set(key, boxes);
  triggerListsEl.append(group);
}
const allListInputs = [...listCheckboxes.values()].flat().map((b) => b.input);

for (const transition of SUSPEND_TRANSITIONS) {
  const option = document.createElement('option');
  option.value = transition;
  option.textContent = transition;
  selOutOfView.append(option);
}

/** The option the select shows, as the enum member (the options were built from it). */
function selectedSuspendTransition(): PxSuspendTransition {
  return SUSPEND_TRANSITIONS.find((a) => a === selOutOfView.value) ?? PxSuspendTransition.pause;
}

/** The events ticked under one list — one as the string, several as the array, none = absent:
 *  the file's own spelling. */
function tickedEvents(key: keyof PxResolvedTriggers): PxTriggerEvents | undefined {
  const on = (listCheckboxes.get(key) ?? []).filter((b) => b.input.checked).map((b) => b.event);
  return on.length === 0 ? undefined : on.length === 1 ? on[0] : on;
}

// -- Theme (persisted in localStorage) ---------------------------------------

type Theme = 'light' | 'dark';
const THEME_KEY = 'preview-player-theme';

function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
  const icon = btnTheme.querySelector('.theme-icon');
  const label = btnTheme.querySelector('.theme-label');
  // Show the action the button performs (i.e. the theme it switches *to*).
  if (icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';
  if (label) label.textContent = theme === 'dark' ? 'Light' : 'Dark';
}

function loadTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY);
  return stored === 'light' || stored === 'dark' ? stored : 'dark';
}

let theme: Theme = loadTheme();
applyTheme(theme);

btnTheme.addEventListener('click', () => {
  theme = theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
});

// -- State -------------------------------------------------------------------

// The JSON import is inferred as a wide literal type; route through `unknown`
// to adopt the document type (as TypeScript recommends for this conversion).
const demoDoc = sample as unknown as PxDocument;

let currentDoc: PxDocument | null = null;
let currentKind: PlayerKind = 'web';
let currentLoop: LoopMode = 'auto';
// Trigger controls: when `useTrigger` is on, the document's trigger — from the file or a
// custom config — drives start, and the transport buttons are disabled.
let useTrigger = false;
let useFileConfig = true;
let handle: PlayerHandle | null = null;
let duration = 0;
let scrubbing = false;

function readDuration(doc: PxDocument): number {
  return getAnimatorConfig(doc)?.duration ?? 1000;
}

/**
 * Resolves the animation's canvas dimensions from the document: prefer the
 * `viewBox` (last two numbers), fall back to `width`/`height`, then 400×400.
 */
function readCanvasSize(doc: PxDocument): { w: number; h: number } {
  const vb = doc.viewBox?.trim().split(/[\s,]+/).map(Number);
  if (vb && vb.length === 4 && vb[2] > 0 && vb[3] > 0 && vb.every((n) => Number.isFinite(n))) {
    return { w: vb[2], h: vb[3] };
  }
  // `width` / `height` are a number or a CSS length string in the format; only numbers size the box.
  if (typeof doc.width === 'number' && typeof doc.height === 'number' && doc.width > 0 && doc.height > 0) {
    return { w: doc.width, h: doc.height };
  }
  return { w: 400, h: 400 };
}

// Native canvas dimensions of the currently-loaded document, used to "contain"
// the canvas box within the stage on every resize.
let canvasW = 400;
let canvasH = 400;

/**
 * Sizes the canvas box to fit the stage while preserving the animation's aspect
 * ratio ("contain"). The box matches the canvas dimensions exactly, so the
 * rendered SVG's viewBox maps 1:1 to its viewport — which makes the SVG clip
 * off-canvas content at the true canvas edge. A dashed frame marks the bounds.
 */
function fitCanvas(): void {
  const cs = getComputedStyle(stageEl);
  const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
  const availW = stageEl.clientWidth - padX;
  const availH = stageEl.clientHeight - padY;
  if (availW <= 0 || availH <= 0) return;

  const scale = Math.min(availW / canvasW, availH / canvasH);
  canvas.style.width = `${Math.round(canvasW * scale)}px`;
  canvas.style.height = `${Math.round(canvasH * scale)}px`;
}

/** Reads the document's canvas size, updates the label, and fits the box. */
function applyCanvasSize(doc: PxDocument): void {
  const { w, h } = readCanvasSize(doc);
  canvasW = w;
  canvasH = h;
  canvasSizeEl.textContent = `${w} × ${h}`;
  fitCanvas();
}

function showError(msg: string): void {
  errorEl.textContent = msg;
  errorEl.hidden = false;
}

function clearError(): void {
  errorEl.hidden = true;
  errorEl.textContent = '';
}

function setControlsEnabled(enabled: boolean): void {
  // With a trigger driving playback, the transport + scrubber are disabled (the trigger owns start).
  const transport = enabled && !useTrigger;
  for (const btn of transportButtons) btn.disabled = !transport;
  seek.disabled = !transport;
  rateSel.disabled = !enabled || currentKind !== 'web';
}

/** The triggers option handed to the player: `undefined` = programmatic (transport owns
 *  start); `'file'` = the document's own triggers; a config = the user's custom triggers —
 *  the WHOLE block, from the three lists of checkboxes. */
function currentTriggerOption(): PlayerOptions['triggers'] {
  if (!useTrigger) return undefined;
  if (useFileConfig) return 'file';
  // WHEN: the three lists say which events start, stop and pause it; the player derives what resumes it.
  const triggers: PxTriggers = {};
  for (const { key } of TRIGGER_LISTS) {
    const events = tickedEvents(key);
    if (events !== undefined) triggers[key] = events;
  }
  return triggers;
}

/** The timeline merge for this mount: the Loop picker's `iterations`, and — with custom
 *  triggers — the gate's two visibility numbers (timeline keys), only while there IS a gate.
 *  `undefined` = the document's own values. */
function currentTimelineOverride(): PxTimelinePatch | undefined {
  const override: Pick<TimeTimeline, 'iterations' | 'inViewThreshold' | 'inViewDebounce'> = {};
  const iterations = loopModeToIterations(currentLoop);
  if (iterations !== undefined) override.iterations = iterations;
  if (useTrigger && !useFileConfig && selectedSuspendTransition() !== PxSuspendTransition.continue) {
    override.inViewThreshold = Number(inpThreshold.value);
    override.inViewDebounce = Number(inpDebounce.value);
  }
  return Object.keys(override).length ? override : undefined;
}

/** The actions merge for this mount: with custom triggers, the gate's `suspend` transition.
 *  `undefined` = the document's own actions. */
function currentActionsOverride(): PxActionsPatch | undefined {
  if (!useTrigger || useFileConfig) return undefined;
  return { suspend: { transition: selectedSuspendTransition() } };
}

/** Sync the trigger config panel — visibility, disabled state, and (when reading from the
 *  file) reflect the document's own triggers and gate into the fields. */
function syncTriggerUi(): void {
  chkUseTrigger.checked = useTrigger;
  chkFileConfig.checked = useFileConfig;
  triggerConfigEl.hidden = !useTrigger;

  if (useFileConfig) {
    // Show the file's config, read-only. `resolveTriggers` spells out what the file means:
    // every list an array of the events it may name, an absent block = play on load.
    const cfg = currentDoc ? getAnimatorConfig(currentDoc) : undefined;
    const lists = resolveTriggers(cfg?.triggers);
    for (const { key } of TRIGGER_LISTS) {
      for (const { event, input } of listCheckboxes.get(key) ?? []) input.checked = lists[key].includes(event);
    }
    selOutOfView.value = cfg?.actions?.suspend?.transition ?? PxSuspendTransition.pause;
    if (cfg?.inViewThreshold != null) {
      inpThreshold.value = String(cfg.inViewThreshold);
    }
    if (cfg?.inViewDebounce != null) {
      inpDebounce.value = String(cfg.inViewDebounce);
    }
  }
  // "From file" → fields are read-only; custom → editable.
  for (const el of [...allListInputs, selOutOfView, inpThreshold, inpDebounce]) {
    el.disabled = useFileConfig;
  }

  // The visibility pair only while there IS a gate.
  const gated = selectedSuspendTransition() !== PxSuspendTransition.continue;
  thresholdField.hidden = !gated;
  debounceField.hidden = !gated;
}

// -- The cue over a still stage ----------------------------------------------

/**
 * What the viewer has to do before the animation moves, when the document's triggers — not the
 * transport — are what starts it. `start: 'load'` behind the default visibility gate IS
 * "scroll into view" (see docs/library/playback-and-triggers.md); `undefined` means it starts by
 * itself as soon as it is shown.
 */
const USER_ACTION_HINTS = {
  hover: 'Hover over the animation to play it',
  click: 'Click the animation to play it',
  scrollIntoView: 'Scroll the animation into view to play it',
  play: 'Press Play to start',
} as const;

type UserAction = keyof typeof USER_ACTION_HINTS;

function userActionForTrigger(
  triggers: PxTriggers | undefined,
  suspend: PxSuspendTransition | undefined,
): UserAction | undefined {
  const { start } = resolveTriggers(triggers);
  if (start.includes(PxTriggerEvent.hoverIn)) return 'hover';
  if (start.includes(PxTriggerEvent.click)) return 'click';
  if (start.length === 0) return 'play';
  // `load` — behind a visibility gate it waits to be seen; `continue` starts right away.
  return suspend === PxSuspendTransition.continue ? undefined : 'scrollIntoView';
}

/** The triggers and gate actually driving the mounted player — the file's, or the custom config. */
function effectiveTriggerAndGate(): { triggers: PxTriggers | undefined; suspend: PxSuspendTransition | undefined } {
  const option = currentTriggerOption();
  if (option === 'file') {
    const cfg = currentDoc ? getAnimatorConfig(currentDoc) : undefined;
    return { triggers: cfg?.triggers, suspend: cfg?.actions?.suspend?.transition };
  }
  return { triggers: option, suspend: option ? selectedSuspendTransition() : undefined };
}

/** Shown while a trigger-driven animation sits still — not over a running one, and not after a
 *  play-once run has ended. With the transport in charge there is nothing to say. */
function syncHint(): void {
  const { triggers, suspend } = effectiveTriggerAndGate();
  const action = useTrigger && handle ? userActionForTrigger(triggers, suspend) : undefined;
  const t = handle?.getCurrentTime() ?? 0;
  const finished = currentLoop === 'no-loop' || (currentLoop === 'auto' && !documentLoops()) ? t >= duration : false;
  const show = !!action && !!handle && !handle.isPlaying() && !finished;
  hintEl.hidden = !show;
  hintEl.textContent = show && action ? USER_ACTION_HINTS[action] : '';
}

function documentLoops(): boolean {
  const iterations = currentDoc ? getAnimatorConfig(currentDoc)?.iterations : undefined;
  return iterations === 'infinite' || (typeof iterations === 'number' && iterations > 1);
}

// -- Mount / remount ---------------------------------------------------------

function remount(): void {
  if (handle) {
    try {
      handle.destroy();
    } catch {
      /* ignore teardown errors */
    }
    handle = null;
  }
  mount.replaceChildren();
  clearError();
  syncTriggerUi();

  // Empty state: nothing loaded yet.
  if (!currentDoc) {
    stageWrap.classList.remove('has-content');
    setControlsEnabled(false);
    duration = 0;
    seek.value = '0';
    timeEl.textContent = '0 / 0 ms';
    hintEl.hidden = true;
    return;
  }

  stageWrap.classList.add('has-content');
  setControlsEnabled(true);

  duration = readDuration(currentDoc);
  seek.max = String(duration);
  seek.value = '0';
  timeEl.textContent = `0 / ${duration} ms`;

  applyCanvasSize(currentDoc);

  const supportsRate = currentKind === 'web';
  rateSel.disabled = !supportsRate;
  rateNote.hidden = supportsRate;
  rateSel.value = '1';

  try {
    handle = factories[currentKind](mount, currentDoc, {
      timeline: currentTimelineOverride(),
      actions: currentActionsOverride(),
      triggers: currentTriggerOption(),
    });
  } catch (err) {
    showError(`Failed to mount ${currentKind} player: ${String(err)}`);
    return;
  }

  // With a trigger driving start, DON'T auto-play — the `load` event (or the user's
  // hover/click/scroll for the others) starts it. Otherwise auto-play as before.
  // React/Vue populate their imperative API after the first commit, so play next frame.
  if (!useTrigger) requestAnimationFrame(() => handle?.play());
}

/** Adopts a validated document and (re)mounts the current player. */
function loadDocument(doc: PxDocument, sourceLabel: string): void {
  currentDoc = doc;
  filenameEl.textContent = sourceLabel;
  // Auto-detect the trigger mode from the loaded file: a triggers block that lists an event
  // turns "Use trigger" ON and reads its config from the file; an EMPTY block (or no triggers
  // at all) leaves it OFF so the transport buttons drive playback.
  const fileTriggers = getAnimatorConfig(doc)?.triggers;
  const lists = resolveTriggers(fileTriggers);
  useTrigger = !!fileTriggers && TRIGGER_LISTS.some(({ key }) => lists[key].length > 0);
  useFileConfig = true;
  remount();
}

// -- Transport controls ------------------------------------------------------

btnPlay.addEventListener('click', () => handle?.play());
btnPause.addEventListener('click', () => handle?.pause());
btnStop.addEventListener('click', () => {
  handle?.cancel();
  seek.value = '0';
});
btnRestart.addEventListener('click', () => {
  handle?.setCurrentTime(0);
  handle?.play();
});
btnFinish.addEventListener('click', () => handle?.finish());

// Load the built-in demo — handled through the same path as a dropped file.
btnDemo.addEventListener('click', () => loadDocument(demoDoc, 'demo (built-in)'));

rateSel.addEventListener('change', () => {
  handle?.setPlaybackRate?.(Number(rateSel.value));
});

// Player picker
document.querySelectorAll<HTMLInputElement>('input[name="player"]').forEach((radio) => {
  radio.addEventListener('change', () => {
    if (radio.checked) {
      currentKind = radio.value as PlayerKind;
      remount();
    }
  });
});

// Loop picker — auto (from JSON) / loop / no-loop
document.querySelectorAll<HTMLInputElement>('input[name="loop"]').forEach((radio) => {
  radio.addEventListener('change', () => {
    if (radio.checked) {
      currentLoop = radio.value as LoopMode;
      remount();
    }
  });
});

// -- Trigger controls --------------------------------------------------------

chkUseTrigger.addEventListener('change', () => {
  useTrigger = chkUseTrigger.checked;
  remount();
});
chkFileConfig.addEventListener('change', () => {
  useFileConfig = chkFileConfig.checked;
  remount();
});
// Editing a custom trigger config re-creates the animator with it.
for (const el of [...allListInputs, selOutOfView, inpThreshold, inpDebounce]) {
  el.addEventListener('change', () => {
    if (useTrigger && !useFileConfig) remount();
  });
}

// -- Time slider -------------------------------------------------------------

seek.addEventListener('pointerdown', () => {
  scrubbing = true;
});
seek.addEventListener('input', () => {
  handle?.pause();
  handle?.setCurrentTime(Number(seek.value));
  timeEl.textContent = `${seek.value} / ${duration} ms`;
});
seek.addEventListener('pointerup', () => {
  scrubbing = false;
});
seek.addEventListener('change', () => {
  scrubbing = false;
});

// -- Drag & drop -------------------------------------------------------------

function loadFile(file: File): void {
  file
    .text()
    .then((text) => {
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        showError(`"${file.name}" is not valid JSON.`);
        return;
      }
      if (!isPxDocument(json)) {
        showError(`"${file.name}" is not a Pixodesk SVG animation document.`);
        return;
      }
      loadDocument(json as PxDocument, file.name);
    })
    .catch((err) => showError(`Could not read "${file.name}": ${String(err)}`));
}

let dragDepth = 0;

window.addEventListener('dragenter', (e) => {
  e.preventDefault();
  dragDepth++;
  stageWrap.classList.add('dragging');
});
window.addEventListener('dragover', (e) => {
  e.preventDefault();
});
window.addEventListener('dragleave', (e) => {
  e.preventDefault();
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) stageWrap.classList.remove('dragging');
});
window.addEventListener('drop', (e) => {
  e.preventDefault();
  dragDepth = 0;
  stageWrap.classList.remove('dragging');
  const file = e.dataTransfer?.files?.[0];
  if (file) loadFile(file);
});

// -- Playback state poll -----------------------------------------------------

function tick(): void {
  if (handle) {
    if (!useTrigger) {
      const playing = handle.isPlaying();
      btnPlay.disabled = playing;
      btnPause.disabled = !playing;
    }
    syncHint();

    if (!scrubbing) {
      const t = handle.getCurrentTime();
      if (t != null && duration > 0) {
        const pos = ((t % duration) + duration) % duration;
        seek.value = String(Math.round(pos));
        timeEl.textContent = `${Math.round(pos)} / ${duration} ms`;
      }
    }
  }
  requestAnimationFrame(tick);
}

// -- Responsive canvas fitting -----------------------------------------------

// Re-fit the canvas box whenever the stage changes size (window resize, etc.).
new ResizeObserver(() => {
  if (currentDoc) fitCanvas();
}).observe(stageEl);

// -- Boot --------------------------------------------------------------------

remount(); // starts in the empty state (no document loaded)
requestAnimationFrame(tick);
