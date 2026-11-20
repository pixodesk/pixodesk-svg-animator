// @px-area control
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import {
    PxDiagnosticCode,
    PxDiagnosticKind,
    PxTriggerAction,
    PxTriggerEvent,
    PxTriggerIssueKind,
    type PxAnimatorRuntimeConfig,
    type PxDiagnostics,
    type PxPlaybackListeners,
    PxStateAction,
} from '@pixodesk/svg-animator-core';
import { duplicateStateIds, ensurePlayExecutor, resolveActions, resolveGate, resolveStates, resolveTriggers, stateReferenceIssues, triggerActionFor, triggerIssues, triggerKeys, type PxTriggerEventSpec } from '@pixodesk/svg-animator-core/engine';
import { createDiagnostics } from '@pixodesk/svg-animator-core/internal';
import type { PxEngineAnimationPlayerApi } from '../shared/PxAnimatorWebTypes';
import { webRaf } from '../shared/PxWebRaf';
import { createVisibilityGate } from './PxVisibilityGate';

/** The diagnostic each kind of trigger problem is reported as. */
function triggerIssueCode(kind: PxTriggerIssueKind): PxDiagnosticCode {
    switch (kind) {
        case PxTriggerIssueKind.collision: return PxDiagnosticCode.triggerEventConflict;
        case PxTriggerIssueKind.eventNotAllowed: return PxDiagnosticCode.triggerEventNotAllowed;
        case PxTriggerIssueKind.resumeExtra:
        case PxTriggerIssueKind.resumeMissing: return PxDiagnosticCode.triggerResumeDiffers;
    }
}

/**
 * Wires a document's triggers to its root element (dev-docs/plans/playback-layers.md, layer 0).
 *
 * The triggers say only WHEN: event lists — the five buttons `timeline.start`, `timeline.play`, `timeline.stop`,
 * `timeline.pause` and `timeline.resume` (derived unless the file names it) — over the events `load`, `hoverIn`,
 * `hoverOut`, `click`, each list naming only the events it can use. Which list an event is read from is the STATE RULE,
 * core's `triggerActionFor`. Every problem `triggerIssues` finds is reported — a disallowed event (ignored), a named
 * `timeline.resume` list that differs from the derivation (honoured), two lists reacting to one event in the same state.
 * An absent triggers block, like an EMPTY one, lists nothing — only the api drives it.
 *
 * HOW is the timeline's `actions` block, performed by the player's one executor, shared with the api's
 * `timeline.start()` / `timeline.stop()`, so a click and a `player.timeline.start()` do exactly the same thing. The visibility gate
 * (`actions.outOfView`, `inViewThreshold`, `inViewDebounce`) decides whether it may RUN, whatever
 * started it; only `load` waits for it — a hover or a click is aimed at something the reader sees. Leaving the screen
 * presses the executor's real buttons (1.26): the state and the callbacks follow.
 *
 * @param api The engine api to wire; the executor is attached to it as `playExecutor`.
 * @param config The document's runtime view (`getAnimatorConfig(doc)`): the action triggers, the actions and the gate numbers.
 * @returns A disposer that detaches every listener, observer and timer this call attached
 *   (review §14). `createSvgAnimationPlayer` ties it to `destroy()`. Call it yourself before re-arming an
 *   element you wired by hand — otherwise the old listeners stay live next to the new ones.
 * @public
 */
export function setupAnimationTriggers(
    api: PxEngineAnimationPlayerApi,
    config: PxAnimatorRuntimeConfig,
    diag?: PxDiagnostics,
    playbackListeners?: PxPlaybackListeners
): () => void {
    // Public export, so the channel is optional and falls back to the console (review §5).
    const report = diag ?? createDiagnostics(undefined, '[PxAnimator]');

    // Everything attached below registers its own undo here, so one call detaches it all.
    const cleanups: Array<() => void> = [];
    const dispose = (): void => { for (const undo of cleanups.splice(0)) undo(); };

    const trigger = resolveTriggers(config.actionTriggers, resolveStates(config).map(s => s.id));
    for (const issue of triggerIssues(config.actionTriggers)) report.warn(PxDiagnosticKind.usage, triggerIssueCode(issue.kind), issue);
    for (const issue of stateReferenceIssues(config)) report.warn(PxDiagnosticKind.document, PxDiagnosticCode.stateNotFound, issue);
    for (const id of duplicateStateIds(config.states)) report.warn(PxDiagnosticKind.document, PxDiagnosticCode.stateIdDuplicate, id);

    const root = api.getRootElement();
    if (!root) {
        report.warn(PxDiagnosticKind.host, PxDiagnosticCode.triggersNoRoot);
        return dispose;
    }

    const executor = ensurePlayExecutor(api, config, webRaf);
    // attached BEFORE anything below can press a button: a `load` trigger fires right here when the document is complete
    if (playbackListeners) executor.setListeners(playbackListeners);

    // Permission to run, for every document and whatever starts it. Leaving and returning are the executor's buttons.
    const gateRule = resolveGate(config);
    const gate = createVisibilityGate(root, gateRule, {
        leaveView: () => executor.leaveView(gateRule.outOfView),
        returnToView: () => executor.returnToView(),
    });
    cleanups.push(() => gate.dispose());


    const whenFinished = resolveActions(config.actions, config.whenFinished).whenFinished;

    /** The state rule (core's `triggerActionFor`): the player's state picks the lists an event is read
     *  from — off · playing · paused · finished · returning. `direct` is a pointer interaction — it never waits out
     *  the gate; a resume never does either (a paused playback was seen). */
    const fire = (event: string, direct: boolean): void => {
        // the state actions first (2026-11-20) — unless a component holds the state (its `state` prop)
        const states = api.stateRuntime;
        if (states && !states.isHeld()) {
            for (const s of trigger.states) {
                if (!s.keys.includes(event)) continue;
                if (s.action === PxStateAction.next) states.controls.next();
                else if (s.action === PxStateAction.previous) states.controls.previous();
                else if (s.state !== undefined) states.controls.goTo(s.state);
            }
        }
        switch (triggerActionFor(trigger, executor.state(), event, whenFinished)) {
            case PxTriggerAction.startPlayback: gate.requestStart(direct, () => executor.startPlayback()); break;
            case PxTriggerAction.playPlayback: gate.requestStart(direct, () => executor.playPlayback()); break;
            case PxTriggerAction.resumePlayback: executor.resumePlayback(); break;
            case PxTriggerAction.pausePlayback: executor.pausePlayback(); break;
            case PxTriggerAction.stopPlayback: executor.stopPlayback(); break;
        }
    };

    // one listener per entry — a bare word on the whole picture as before, an event object where it says (2026-11-15)
    const page = root.ownerDocument;
    for (const key of triggerKeys(trigger)) {
        const spec = trigger.specs.get(key);
        if (!spec) continue;
        if (spec.event === PxTriggerEvent.load) {
            // The document being ready. The only event the gate may hold: nobody interacted, so there is
            // nothing to honour at once — the gate plays when enough is on screen (after the debounce).
            const onLoad = (): void => fire(key, false);
            if (document.readyState === 'complete') {
                onLoad();
            } else {
                window.addEventListener('load', onLoad, { once: true });
                cleanups.push(() => window.removeEventListener('load', onLoad));
            }
            continue;
        }
        cleanups.push(listenFor(spec, root, page, report, () => fire(key, true)));
    }

    return dispose;
}

/** The DOM event an entry listens to; hover is `pointerover` / `pointerout` on a part, `mouseenter` / `mouseleave` on
 *  the whole picture. */
function domEventOf(event: PxTriggerEvent): string | undefined {
    switch (event) {
        case PxTriggerEvent.click: return 'click';
        case PxTriggerEvent.pointerDown: return 'pointerdown';
        case PxTriggerEvent.pointerUp: return 'pointerup';
        case PxTriggerEvent.keyDown: return 'keydown';
        case PxTriggerEvent.keyUp: return 'keyup';
        case PxTriggerEvent.hoverIn: return 'pointerover';
        case PxTriggerEvent.hoverOut: return 'pointerout';
        case PxTriggerEvent.load: return undefined;
    }
}

const isHover = (event: PxTriggerEvent): boolean => event === PxTriggerEvent.hoverIn || event === PxTriggerEvent.hoverOut;
const isKey = (event: PxTriggerEvent): boolean => event === PxTriggerEvent.keyDown || event === PxTriggerEvent.keyUp;

/** The entry's `with`: every field it names must be the event's (`metaOrCtrlKey`: ⌘ or Ctrl, whichever is down). Each
 *  field read by its name — a listed set (2026-11-15). */
function matchesFilter(spec: PxTriggerEventSpec, e: Event): boolean {
    const f = spec.filter;
    if (!f) return true;
    const keyed = e instanceof KeyboardEvent ? e : undefined;
    const mouse = e instanceof MouseEvent ? e : undefined;
    const pointer = typeof PointerEvent !== 'undefined' && e instanceof PointerEvent ? e : undefined;
    const ctrl = keyed?.ctrlKey ?? mouse?.ctrlKey ?? false;
    const shift = keyed?.shiftKey ?? mouse?.shiftKey ?? false;
    const alt = keyed?.altKey ?? mouse?.altKey ?? false;
    const meta = keyed?.metaKey ?? mouse?.metaKey ?? false;
    if (f.key !== undefined && keyed?.key !== f.key) return false;
    if (f.code !== undefined && keyed?.code !== f.code) return false;
    if (f.ctrlKey !== undefined && ctrl !== f.ctrlKey) return false;
    if (f.shiftKey !== undefined && shift !== f.shiftKey) return false;
    if (f.altKey !== undefined && alt !== f.altKey) return false;
    if (f.metaKey !== undefined && meta !== f.metaKey) return false;
    if (f.metaOrCtrlKey !== undefined && (meta || ctrl) !== f.metaOrCtrlKey) return false;
    if (f.button !== undefined && mouse?.button !== f.button) return false;
    if (f.pointerType !== undefined && pointer?.pointerType !== f.pointerType) return false;
    return true;
}

/** A key event counts while the picture is in view and no text field has the focus. */
function keyCounts(root: Element, e: Event): boolean {
    const target = e.target;
    if (target instanceof HTMLElement && (target.isContentEditable || target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) return false;
    const r = root.getBoundingClientRect();
    const view = root.ownerDocument.defaultView;
    const w = view?.innerWidth ?? 0, h = view?.innerHeight ?? 0;
    return r.bottom > 0 && r.right > 0 && r.top < h && r.left < w;
}

/** The bare id of an `element` reference (`#id`-spelled). */
const bareId = (ref: string): string => ref.startsWith('#') ? ref.slice(1) : ref;

/** The element `spec` is heard on that contains `node` — by the page selector, or the picture's element id — or null. */
function placeOf(spec: PxTriggerEventSpec, root: Element, node: EventTarget | null): Element | null {
    if (!(node instanceof Element)) return null;
    if (spec.selector !== undefined) {
        try { return node.closest(spec.selector); } catch { return null; }
    }
    if (spec.element !== undefined) {
        const id = bareId(spec.element);
        for (let el: Element | null = node; el && el !== root.parentElement; el = el.parentElement) if (el.id === id) return el;
    }
    return null;
}

/** Attaches the listener for one entry and returns its undo. The whole picture: the root's own events (hover as
 *  enter / leave, an out only after an in, as before); a key: the page; an element of the picture or of the page:
 *  delegated, found with `closest`. */
function listenFor(spec: PxTriggerEventSpec, root: Element, page: Document, report: PxDiagnostics, press: () => void): () => void {
    const type = domEventOf(spec.event);
    if (!type) return () => {};
    if (isKey(spec.event)) {
        const onKey = (e: Event): void => { if (keyCounts(root, e) && matchesFilter(spec, e)) press(); };
        page.addEventListener(type, onKey);
        return () => page.removeEventListener(type, onKey);
    }
    if (spec.element === undefined && spec.selector === undefined) {
        if (isHover(spec.event)) {
            // An OUT may only follow an IN. A `mouseleave` with no preceding `mouseenter` happens when the pointer is
            // already over the element at load and then moves away — and a stop on `hoverOut` with a rewinding stop
            // would start the animation running backwards.
            let entered = false;
            const onEnter = (e: Event): void => { entered = true; if (spec.event === PxTriggerEvent.hoverIn && matchesFilter(spec, e)) press(); };
            const onLeave = (e: Event): void => { if (entered && spec.event === PxTriggerEvent.hoverOut && matchesFilter(spec, e)) press(); };
            root.addEventListener('mouseenter', onEnter);
            root.addEventListener('mouseleave', onLeave);
            return () => { root.removeEventListener('mouseenter', onEnter); root.removeEventListener('mouseleave', onLeave); };
        }
        const onEvent = (e: Event): void => { if (matchesFilter(spec, e)) press(); };
        root.addEventListener(type, onEvent);
        return () => root.removeEventListener(type, onEvent);
    }
    if (spec.element !== undefined && !root.querySelector('#' + cssEscape(bareId(spec.element)))) {
        report.warn(PxDiagnosticKind.document, PxDiagnosticCode.triggerElementNotFound, spec.element);
    }
    // an element of the picture (inside the root) or of the page (anywhere): one delegated listener
    const host: EventTarget = spec.selector !== undefined ? page : root;
    const onEvent = (e: Event): void => {
        const place = placeOf(spec, root, e.target);
        if (!place) return;
        if (isHover(spec.event)) {
            const related = e instanceof MouseEvent ? e.relatedTarget : null;
            if (related instanceof Node && place.contains(related)) return;   // moving inside it is no hover in or out
        }
        if (matchesFilter(spec, e)) press();
    };
    host.addEventListener(type, onEvent);
    return () => host.removeEventListener(type, onEvent);
}

function cssEscape(id: string): string {
    return typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(id) : id;
}
