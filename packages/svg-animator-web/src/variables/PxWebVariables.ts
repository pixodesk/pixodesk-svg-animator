// @px-area variables
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

/**
 * The web side of one player's variables (docs/library/variables.md): it draws what the
 * runtime says, and feeds the player's own variables (`player.pointer…`, `player.playback…`, `player.prefers…`).
 *
 * | What must hold                                                                                                |
 * |-------------------------------------------------------------------------------------------------------------|
 * | a change is written on the next frame, never at once — many `set` calls between two frames cost one write   |
 * | only the places bound to a variable that changed are written; a value set once is written once               |
 * | nothing queues — a source faster than the screen cannot get ahead                                             |
 * | a change never seeks, pauses or restarts the animation: a bound attribute is never an animated one            |
 * | nothing playing: a change asks for one frame, no loop keeps running                                           |
 *
 * A value on a node with no effects is written straight to its element(s). Anything else — an effect's setting, an
 * animated default switching on or off — builds the player again, its state and time kept (the host's `rebuild`).
 */

import type { PxDocument, PxNode, PxPlaybackControls } from '@pixodesk/svg-animator-core';
import { PxPredefinedVariable, type PxVariableValue } from '@pixodesk/svg-animator-core';
import type { PxBindingSite, PxVariablesRuntime } from '@pixodesk/svg-animator-core/engine';
import { cssVarValue, domAttributeOf, isDirectWriteSite, nodeKeyOf, PX_VARIABLE_NODE_MARK, camelCaseToKebabWordIfNeeded } from '@pixodesk/svg-animator-core/internal';
import { webRaf } from '../shared/PxWebRaf';

/** What the player gives its variables. @internal */
export interface PxWebVariablesHost {
    /** The playback of the player as it is now — for the playback variables. */
    playback(): PxPlaybackControls | undefined;
    /** Build the player again from the runtime's current document, its state and time kept. */
    rebuild(): void;
}

const POINTER_PREFIX = 'player.pointer';
const PLAYBACK_PREFIX = 'player.playback.';
const PREFERS_PREFIX = 'player.prefers.';
const STYLE_KEY = 'style';
const TEXT_KEY = 'textContent';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)';

/** One player's variables on the web — see the module comment. @internal */
export class PxWebVariables {
    private elements = new Map<string, Array<Element>>();
    private root: Element | null = null;
    private framePending = false;
    private playbackLooping = false;
    private destroyed = false;
    private readonly detachRuntime: () => void;
    private detachPointer: () => void = () => { /* nothing attached */ };
    private detachPrefers: () => void = () => { /* nothing attached */ };

    constructor(
        readonly runtime: PxVariablesRuntime,
        private readonly host: PxWebVariablesHost,
        private readonly raf: (cb: () => void) => void = webRaf,
    ) {
        this.detachRuntime = runtime.attach(() => this.requestFrame());
        this.setupPrefers();
    }

    /** After every build: the document as rendered (materialized, fresh ids) and its root. */
    bind(renderedDoc: PxDocument, root: Element | null): void {
        this.root = root;
        this.elements = indexMarkedElements(renderedDoc, root);
        this.setupPointer();
        this.onPlaybackActivity();
    }

    /** The playback moved (a button, a seek, a trigger) — the playback variables follow while it plays. */
    onPlaybackActivity(): void {
        if (this.destroyed || this.playbackLooping || !this.runtime.usesAnyOf(PLAYBACK_PREFIX)) return;
        this.playbackLooping = true;
        const tick = (): void => {
            if (this.destroyed) return;
            const playback = this.host.playback();
            if (playback) {
                const time = playback.getCurrentTime() ?? 0;
                const duration = playback.getDuration();
                this.runtime.setPredefined(PxPredefinedVariable.playbackCurrentTime, time);
                this.runtime.setPredefined(PxPredefinedVariable.playbackCurrentProgress, playback.getCurrentProgress() ?? 0);
                this.runtime.setPredefined(PxPredefinedVariable.playbackIterationProgress, duration ? Math.min(1, Math.max(0, time / duration)) : 0);
            }
            this.flush();
            if (playback?.isPlaying()) this.raf(tick);
            else this.playbackLooping = false;
        };
        this.raf(tick);
    }

    destroy(): void {
        this.destroyed = true;
        this.detachRuntime();
        this.detachPointer();
        this.detachPrefers();
    }

    // ── the frame ────────────────────────────────────────────────────────────────────────────────

    private requestFrame(): void {
        if (this.framePending || this.destroyed) return;
        this.framePending = true;
        this.raf(() => {
            this.framePending = false;
            this.flush();
        });
    }

    private flush(): void {
        if (this.destroyed) return;
        const changes = this.runtime.takeChanges();
        if (changes.structural) {
            this.host.rebuild();
            return;
        }
        if (changes.names.size === 0) return;
        const sites = this.runtime.sitesReading(changes.names);
        if (sites.some(site => !this.canWriteDirectly(site))) {
            this.host.rebuild();
            return;
        }
        // one write per bound attribute — every site of that attribute evaluated together
        const written = new Set<string>();
        for (const site of sites) {
            const key = String(site.keyPath[0]);
            const group = nodeKeyOf(site.nodePath) + '|' + key + (key === STYLE_KEY ? '|' + String(site.keyPath[1]) : '');
            if (written.has(group)) continue;
            written.add(group);
            this.write(site, key);
        }
    }

    private canWriteDirectly(site: PxBindingSite): boolean {
        const node = this.runtime.sourceNodeAt(site.nodePath);
        return !!node && isDirectWriteSite(site, node) && this.elements.has(nodeKeyOf(site.nodePath))
            && (site.keyPath[0] !== STYLE_KEY || site.keyPath.length === 2);
    }

    private write(site: PxBindingSite, key: string): void {
        const elements = this.elements.get(nodeKeyOf(site.nodePath)) ?? [];
        const read = (name: string): PxVariableValue | undefined => this.runtime.valueOf(name);

        if (key === STYLE_KEY) {
            const property = String(site.keyPath[1]);
            const value = site.binding?.evaluate(read);
            const css = this.runtime.isCssSite(site) && site.binding ? this.runtime.cssPropertyOf(site.binding.names[0]) : undefined;
            for (const el of elements) setStyle(el, camelCaseToKebabWordIfNeeded(property), css !== undefined ? cssVarValue(css, value) : value);
            return;
        }
        if (key === TEXT_KEY) {
            const value = site.binding?.evaluate(read);
            for (const el of elements) el.textContent = value === undefined ? '' : String(value);
            return;
        }
        if (this.runtime.isCssSite(site) && site.binding) {
            const css = this.runtime.cssPropertyOf(site.binding.names[0]);
            const value = site.binding.evaluate(read);
            if (css !== undefined) for (const el of elements) setStyle(el, camelCaseToKebabWordIfNeeded(key), cssVarValue(css, value));
            return;
        }

        const node = this.runtime.sourceNodeAt(site.nodePath);
        const raw: unknown = node ? attributeOf(node, key) : undefined;
        const sitesOfKey = this.runtime.sites.filter(s => sameNode(s, site) && String(s.keyPath[0]) === key);
        const value = valueWithBindings(raw, sitesOfKey, read);
        const attr = value === undefined ? undefined : domAttributeOf(key, value);
        for (const el of elements) {
            if (!attr) el.removeAttribute(camelCaseToKebabWordIfNeeded(key));
            else if (attr.isStyle) setStyle(el, attr.name, attr.value);
            else el.setAttribute(attr.name, attr.value);
        }
    }

    // ── the player's own variables ───────────────────────────────────────────────────────────────

    private setupPointer(): void {
        this.detachPointer();
        this.detachPointer = () => { /* nothing attached */ };
        const target = this.root;
        if (!target || !this.runtime.usesAnyOf(POINTER_PREFIX)) return;
        const svg = target instanceof SVGSVGElement ? target : target.querySelector('svg');
        const rt = this.runtime;
        const moveTo = (e: MouseEvent): void => {
            const point = svg ? toViewBox(svg, e.clientX, e.clientY) : undefined;
            if (!point) return;
            rt.setPredefined(PxPredefinedVariable.pointer, point);
            rt.setPredefined(PxPredefinedVariable.pointerX, point[0]);
            rt.setPredefined(PxPredefinedVariable.pointerY, point[1]);
        };
        const onMove = (e: MouseEvent): void => moveTo(e);
        const onEnter = (e: MouseEvent): void => { rt.setPredefined(PxPredefinedVariable.pointerOver, true); moveTo(e); };
        const onLeave = (): void => { rt.setPredefined(PxPredefinedVariable.pointerOver, false); rt.setPredefined(PxPredefinedVariable.pointerDown, false); };
        const onDown = (e: MouseEvent): void => { rt.setPredefined(PxPredefinedVariable.pointerDown, true); moveTo(e); };
        const onUp = (): void => rt.setPredefined(PxPredefinedVariable.pointerDown, false);
        // each listener made ONCE, so the same function is removed again
        const listeners: Array<[string, EventListener]> = [
            ['pointermove', asListener(onMove)], ['pointerenter', asListener(onEnter)], ['pointerleave', asListener(onLeave)],
            ['pointerdown', asListener(onDown)], ['pointerup', asListener(onUp)], ['pointercancel', asListener(onUp)],
        ];
        for (const [type, listener] of listeners) target.addEventListener(type, listener);
        this.detachPointer = () => { for (const [type, listener] of listeners) target.removeEventListener(type, listener); };
    }

    private setupPrefers(): void {
        if (!this.runtime.usesAnyOf(PREFERS_PREFIX) || typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
        const motion = window.matchMedia(REDUCED_MOTION_QUERY);
        const scheme = window.matchMedia(DARK_SCHEME_QUERY);
        const update = (): void => {
            this.runtime.setPredefined(PxPredefinedVariable.prefersReducedMotion, motion.matches);
            this.runtime.setPredefined(PxPredefinedVariable.prefersColorScheme, scheme.matches ? 'dark' : 'light');
        };
        update();
        motion.addEventListener?.('change', update);
        scheme.addEventListener?.('change', update);
        this.detachPrefers = () => {
            motion.removeEventListener?.('change', update);
            scheme.removeEventListener?.('change', update);
        };
    }
}

/** The rendered elements of every marked node, by node key — a marked node may be rendered several times (an inlined
 *  `<use>` clone carries the mark too). */
function indexMarkedElements(doc: PxDocument, root: Element | null): Map<string, Array<Element>> {
    const idsByKey = new Map<string, Array<string>>();
    const walk = (node: PxNode): void => {
        const meta: unknown = node.meta;
        const key = meta && typeof meta === 'object' ? (meta as { [k: string]: unknown })[PX_VARIABLE_NODE_MARK] : undefined;
        if (typeof key === 'string' && typeof node.id === 'string') {
            const ids = idsByKey.get(key) ?? [];
            ids.push(node.id);
            idsByKey.set(key, ids);
        }
        node.children?.forEach(walk);
    };
    walk(doc);
    const byId = new Map<string, Element>();
    if (root) {
        if (root.id) byId.set(root.id, root);
        root.querySelectorAll('[id]').forEach(el => byId.set(el.id, el));
    }
    const out = new Map<string, Array<Element>>();
    for (const [key, ids] of idsByKey) {
        const elements = ids.map(id => byId.get(id)).filter((el): el is Element => !!el);
        if (elements.length) out.set(key, elements);
    }
    return out;
}

function sameNode(a: PxBindingSite, b: PxBindingSite): boolean {
    return a.nodePath.length === b.nodePath.length && a.nodePath.every((v, i) => v === b.nodePath[i]);
}

function attributeOf(node: PxNode, key: string): unknown {
    const record: { readonly [k: string]: unknown } = node;
    return record[key];
}

/** An attribute's value with every binding inside it evaluated: the whole value, or the items / parts of a
 *  structured one. `undefined` when one of them has no value — the attribute then reads as absent. */
function valueWithBindings(raw: unknown, sites: ReadonlyArray<PxBindingSite>, read: (name: string) => PxVariableValue | undefined): unknown {
    const whole = sites.find(s => s.keyPath.length === 1);
    if (whole) return whole.binding?.evaluate(read);
    let value = cloneJson(raw);
    for (const site of sites) {
        const v = site.binding?.evaluate(read);
        if (v === undefined) return undefined;
        value = setIn(value, site.keyPath.slice(1), v);
    }
    return value;
}

function cloneJson(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(cloneJson);
    if (value && typeof value === 'object') {
        const out: { [k: string]: unknown } = {};
        for (const [k, v] of Object.entries(value)) out[k] = cloneJson(v);
        return out;
    }
    return value;
}

function setIn(target: unknown, path: ReadonlyArray<string | number>, value: unknown): unknown {
    if (path.length === 0) return value;
    const [head, ...rest] = path;
    if (Array.isArray(target)) {
        const copy = [...target];
        copy[Number(head)] = setIn(copy[Number(head)], rest, value);
        return copy;
    }
    const record: { [k: string]: unknown } = target && typeof target === 'object' ? { ...(target as { [k: string]: unknown }) } : {};
    record[String(head)] = setIn(record[String(head)], rest, value);
    return record;
}

function setStyle(el: Element, property: string, value: unknown): void {
    if (!(el instanceof HTMLElement || el instanceof SVGElement)) return;
    if (value === undefined) el.style.removeProperty(property);
    else el.style.setProperty(property, String(value));
}

/** A client point in the drawing's coordinates — the inverse of the `<svg>`'s screen matrix. */
function toViewBox(svg: SVGSVGElement, clientX: number, clientY: number): [number, number] | undefined {
    const m = svg.getScreenCTM?.();
    if (!m) return undefined;
    const det = m.a * m.d - m.b * m.c;
    if (!det) return undefined;
    const x = clientX - m.e;
    const y = clientY - m.f;
    return [(m.d * x - m.c * y) / det, (-m.b * x + m.a * y) / det];
}

/** A pointer handler as a DOM listener — a pointer event is a `MouseEvent` (`PointerEvent` extends it). */
function asListener(fn: (e: MouseEvent) => void): EventListener {
    return e => { if (e instanceof MouseEvent) fn(e); };
}
