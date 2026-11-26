// @px-area control
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// ============================================================================
// THE WINDOW OF A CHANGE (2026-11-26, kf app/docs/app-design/flow-step-transitions.build.md) — the overlap of a change
// A → B (`transition.overlap`) as ONE temporary playback: A's tail and B's head sampled at the frame rate, mixed per kind
// of value (`transition.mix`, the crossfade's `easing`), written as compiled channels of one plain document. Every
// engine plays it the same way — the frame loop, the native one, a pre-rendered build.
//
// | piece | what it is |
// |---|---|
// | a source | a part's document (`stepDocumentOf`), its playback ms at the window's start, its ms per window ms (0: held), how long it plays in the window |
// | `leaving` | A's tail — the part it is in, playing on or held (`leavingStep`) |
// | `entering` | B's head — its in-transition, then its segment |
// | the document | the plain document's tree with no `animate`, the window's channels as shared animations bound by element id, one timeline of the window's length, played once, held at its end |
// ============================================================================

import type { PxCompiledAnimation, PxDocument, PxEasingOrRef } from '../format/PxAnimatorTypes';
import { getAnimatorConfig, getDefinitions, PX_DEFAULT_ITERATIONS, PxPlaybackDirection, PxTimelineEngine, PxTransitionMix, PxWhenFinished, PxWhenIdle } from '../format/PxAnimatorConstants';
import { PxTimeTimelineSchema } from '../format/PxAnimatorTypes';
import { normalizeBindings, resolveEasing } from '../animation/PxDefinitions';
import { windowChannel, type PxWindowPiece } from '../animation/PxRuntimeChannel';
import { animatorOf } from '../format/PxDocStage';
import { clamp, cubicBezier, PX_DEFAULT_DURATION_MS } from '../util/PxAnimatorUtil';

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** One part a side plays in the window. @internal */
export interface PxWindowSource {
    /** The part's document — `stepDocumentOf`. */
    readonly doc: PxDocument;
    /** Its playback ms at the window's start — iterations included. */
    readonly atMs: number;
    /** Its playback ms per window ms; 0: held at `atMs`. */
    readonly rate: number;
    /** How long it plays in the window before the next source of its side; none: to the window's end. */
    readonly forMs?: number;
}

/** A window to build. @internal */
export interface PxWindowSpec {
    readonly durationMs: number;
    readonly leaving: ReadonlyArray<PxWindowSource>;
    readonly entering: ReadonlyArray<PxWindowSource>;
    readonly mix?: PxTransitionMix;
    readonly easing?: PxEasingOrRef;
    /** Samples per second — 60 when none. */
    readonly sampleRate?: number;
}

const DEFAULT_SAMPLE_RATE = 60;
/** The shared animations a window document binds — one per element. */
const WINDOW_ANIMATION_PREFIX = '__pxWindow';

/** A document's playback ms → its channels' own ms: its pass, iteration and direction — as the frame loop plays it. */
function localMsOf(doc: PxDocument): (ms: number) => number {
    const config = getAnimatorConfig(doc) ?? {};
    const raw = config.iterations;
    let iterations = typeof raw === 'number' ? (raw || PX_DEFAULT_ITERATIONS) : raw === 'infinite' ? Infinity : 1;
    if (iterations < 1) iterations = 1;
    const duration = +(config.duration || PX_DEFAULT_DURATION_MS);
    const direction = config.direction || PxTimeTimelineSchema.defaults.iterationDirection;
    return (ms) => {
        const t = clamp(ms, 0, iterations * duration);
        const iteration = Math.min(Math.max(0, Math.ceil(t / duration) - 1), iterations - 1);
        const p = clamp((t - iteration * duration) / duration, 0, 1);
        const back = direction === PxPlaybackDirection.reverse
            || (direction === PxPlaybackDirection.alternate && iteration % 2 === 1)
            || (direction === PxPlaybackDirection.alternateReverse && iteration % 2 === 0);
        return (back ? 1 - p : p) * duration;
    };
}

/** One side's channels by element id and attribute, laid out as the pieces of the window it plays. */
interface SideLayout {
    readonly pieces: ReadonlyArray<{ readonly from: number; readonly to: number; readonly localMs: (w: number) => number; readonly channels: ReadonlyMap<string, Readonly<Record<string, PxCompiledAnimation>>> }>;
}

function layoutOf(sources: ReadonlyArray<PxWindowSource>, durationMs: number): SideLayout {
    let from = 0;
    const pieces = sources.map(src => {
        const to = src.forMs === undefined ? durationMs : Math.min(durationMs, from + src.forMs);
        const start = from;
        const toLocal = localMsOf(src.doc);
        const channels = new Map(normalizeBindings(src.doc, PxTimelineEngine.native).map(b => [b.id, b.channels] as const));
        from = to;
        return { from: start, to, localMs: (w: number) => toLocal(src.atMs + src.rate * (w - start)), channels };
    });
    return { pieces };
}

/** The crossfade's weight of B at a window ms — the easing's curve over the window; linear when none. */
function weightOf(doc: PxDocument, durationMs: number, easing: PxEasingOrRef | undefined): (w: number) => number {
    const bezier = easing === undefined ? undefined : resolveEasing(easing, getDefinitions(doc));
    const curve = bezier ? cubicBezier(bezier) : undefined;
    return (w) => {
        const p = durationMs > 0 ? clamp(w / durationMs, 0, 1) : 1;
        return curve ? curve(p) : p;
    };
}

/** A part document's one timeline record — its engine and frame rate are the window's. */
function firstTimelineOf(doc: PxDocument): Record<string, unknown> | undefined {
    const animator = animatorOf(doc);
    const list = isRecord(animator) && Array.isArray(animator.timelines) ? animator.timelines : [];
    return isRecord(list[0]) ? list[0] : undefined;
}

/** The tree with no node's `animate` — the window's channels are bound by element id. */
function withoutAnimate(node: unknown): unknown {
    if (!isRecord(node)) return node;
    const { animate: _a, children, ...rest } = node;
    return Array.isArray(children) ? { ...rest, children: children.map(withoutAnimate) } : rest;
}

// @px-importance important
/** The window's document — see the top of the file. `base` is the plain, rendered document. @internal */
export function flowWindowDocumentOf(base: PxDocument, spec: PxWindowSpec): PxDocument {
    const durationMs = Math.max(1, spec.durationMs);
    const step = 1000 / (spec.sampleRate ?? DEFAULT_SAMPLE_RATE);
    const times: Array<number> = [];
    for (let t = 0; t < durationMs; t += step) times.push(t);
    times.push(durationMs);

    const leaving = layoutOf(spec.leaving, durationMs);
    const entering = layoutOf(spec.entering, durationMs);
    const weight = weightOf(base, durationMs, spec.easing);
    const mix = spec.mix ?? PxTransitionMix.crossfade;

    // every element and attribute either side animates, B's channel the template (its unit wins)
    const templates = new Map<string, Map<string, PxCompiledAnimation>>();
    for (const side of [entering, leaving]) for (const piece of side.pieces) for (const [id, channels] of piece.channels) {
        const byProp = templates.get(id) ?? new Map<string, PxCompiledAnimation>();
        for (const [prop, ch] of Object.entries(channels)) if (!byProp.has(prop)) byProp.set(prop, ch);
        templates.set(id, byProp);
    }
    const piecesOf = (side: SideLayout, id: string, prop: string): Array<PxWindowPiece> =>
        side.pieces.map(p => ({ ch: p.channels.get(id)?.[prop], from: p.from, to: p.to, localMs: p.localMs }));

    const animations: Record<string, Record<string, PxCompiledAnimation>> = {};
    const bindings: Array<Record<string, unknown>> = [];
    let n = 0;
    for (const [id, byProp] of templates) {
        const channels: Record<string, PxCompiledAnimation> = {};
        for (const [prop, template] of byProp) {
            const ch = windowChannel(template, { leaving: piecesOf(leaving, id, prop), entering: piecesOf(entering, id, prop), times, weight, mix });
            if (ch.keyframes.length) channels[prop] = ch;
        }
        if (!Object.keys(channels).length) continue;
        const name = WINDOW_ANIMATION_PREFIX + n++;
        animations[name] = channels;
        bindings.push({ element: '#' + id, animateWith: [name] });
    }

    const animator = animatorOf(base);
    const out: Record<string, unknown> = isRecord(animator) ? { ...animator } : {};
    delete out.timelines; delete out.flowSteps; delete out.flows; delete out.actions;
    const defs = isRecord(out.definitions) ? out.definitions : {};
    out.definitions = { ...defs, animations };
    // a pre-rendered file's own bindings keep what they carry besides animations (`show`, `showOneChild`)
    const own = Array.isArray(out.bindings) ? out.bindings.filter(isRecord).map(b => ({ ...b, animateWith: [] })) : [];
    out.bindings = [...own, ...bindings];
    // the engine and frame rate of the step it goes to — the window plays as its steps do
    const lead = spec.entering[0] ?? spec.leaving[0];
    const record = lead ? firstTimelineOf(lead.doc) : undefined;
    out.timelines = [{ ...(record?.engine !== undefined ? { engine: record.engine } : {}), ...(record?.frameRate !== undefined ? { frameRate: record.frameRate } : {}),
        outTime: durationMs, iterations: 1, whenFinished: PxWhenFinished.hold, whenIdle: PxWhenIdle.firstFrame }];
    const tree = withoutAnimate(base);
    return { ...(isRecord(tree) ? tree : {}), animator: out } as PxDocument;
}
