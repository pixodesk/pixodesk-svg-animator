import './style.css';
import {
  getAnimatorConfig,
  isPxElementFileFormat,
  type PxAnimatedSvgDocument,
} from '@pixodesk/svg-animator-web';

import { createWebPlayer } from './players/web';
import { createReactPlayer } from './players/react';
import { createVuePlayer } from './players/vue';
import {
  loopModeToIterations,
  type LoopMode,
  type PlayerFactory,
  type PlayerHandle,
  type PlayerKind,
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

const transportButtons = [btnPlay, btnPause, btnStop, btnRestart, btnFinish];

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
const demoDoc = sample as unknown as PxAnimatedSvgDocument;

let currentDoc: PxAnimatedSvgDocument | null = null;
let currentKind: PlayerKind = 'web';
let currentLoop: LoopMode = 'auto';
let handle: PlayerHandle | null = null;
let duration = 0;
let scrubbing = false;

function readDuration(doc: PxAnimatedSvgDocument): number {
  return getAnimatorConfig(doc)?.duration ?? 1000;
}

/**
 * Resolves the animation's canvas dimensions from the document: prefer the
 * `viewBox` (last two numbers), fall back to `width`/`height`, then 400×400.
 */
function readCanvasSize(doc: PxAnimatedSvgDocument): { w: number; h: number } {
  const vb = doc.viewBox?.trim().split(/[\s,]+/).map(Number);
  if (vb && vb.length === 4 && vb[2] > 0 && vb[3] > 0 && vb.every((n) => Number.isFinite(n))) {
    return { w: vb[2], h: vb[3] };
  }
  if (doc.width && doc.height && doc.width > 0 && doc.height > 0) {
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
function applyCanvasSize(doc: PxAnimatedSvgDocument): void {
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
  for (const btn of transportButtons) btn.disabled = !enabled;
  seek.disabled = !enabled;
  rateSel.disabled = !enabled || currentKind !== 'web';
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

  // Empty state: nothing loaded yet.
  if (!currentDoc) {
    stageWrap.classList.remove('has-content');
    setControlsEnabled(false);
    duration = 0;
    seek.value = '0';
    timeEl.textContent = '0 / 0 ms';
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
      iterations: loopModeToIterations(currentLoop),
    });
  } catch (err) {
    showError(`Failed to mount ${currentKind} player: ${String(err)}`);
    return;
  }

  // React/Vue populate their imperative API after the first commit, so start
  // playback on the next frame to keep behaviour identical across players.
  requestAnimationFrame(() => handle?.play());
}

/** Adopts a validated document and (re)mounts the current player. */
function loadDocument(doc: PxAnimatedSvgDocument, sourceLabel: string): void {
  currentDoc = doc;
  filenameEl.textContent = sourceLabel;
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
      if (!isPxElementFileFormat(json)) {
        showError(`"${file.name}" is not a Pixodesk SVG animation document.`);
        return;
      }
      loadDocument(json as PxAnimatedSvgDocument, file.name);
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
    const playing = handle.isPlaying();
    btnPlay.disabled = playing;
    btnPause.disabled = !playing;

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
