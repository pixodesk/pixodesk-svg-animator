// @px-area pipeline
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// ============================================================================
// EFFECT PARAMETERS ON SEVERAL TIMELINES (2026-11-20, kf app/docs/app-design/timelines-and-states.design.md N4) — an
// effect's parameter with `byTimeline` (a text path's `pathData`, a stroke trim's `end`, …). Every effect turns its
// parameters into the animations of the nodes it makes; so the effects run once per timeline, and the runs are merged:
//
// | run | the parameters |
// |---|---|
// | the first timeline | their plain keyframes (`byTimeline` left out) |
// | timeline `T` | `T`'s track as the keyframes; a parameter with no `T` track holds its own value |
//
// The merge walks the first run's tree and each `T` run's side by side (by position — the effects make the same
// nodes on every run) and adds, to every animation that differs on `T`, a `byTimeline` track for `T`. An animation
// that does not differ (a node's own, or one no parameter on `T` moves) gets none.
//
// Accepted limit: a parameter that changes what an effect MAKES (a count, a kind) is the first timeline's — a run
// whose tree does not match is not merged below the first node that differs.
// ============================================================================

import type { PxNode } from '../format/PxAnimatorTypes';
import { materializeNodeEffects, type ApplyResult } from '../effects/PlayerEffectsUtil';

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** The timelines the effect parameters of the tree name, in the order met. */
export function effectTrackTimelines(root: PxNode): Array<string> {
    const out: Array<string> = [];
    const scanValue = (v: unknown): void => {
        if (Array.isArray(v)) { v.forEach(scanValue); return; }
        if (!isRecord(v)) return;
        if (Array.isArray(v.byTimeline)) {
            for (const track of v.byTimeline) if (isRecord(track) && typeof track.timeline === 'string' && !out.includes(track.timeline)) out.push(track.timeline);
        }
        Object.values(v).forEach(scanValue);
    };
    const visit = (node: unknown): void => {
        if (!isRecord(node)) return;
        if (isRecord(node.effects)) scanValue(node.effects);
        if (Array.isArray(node.children)) node.children.forEach(visit);
    };
    visit(root);
    return out;
}

/** A parameter as one run sees it: `undefined` — the plain keyframes; a timeline — its track, or the own value. */
function paramFor(param: Record<string, unknown>, timeline: string | undefined): Record<string, unknown> {
    const { byTimeline, ...plain } = param;
    if (timeline === undefined || !Array.isArray(byTimeline)) return plain;
    const track = byTimeline.find(t => isRecord(t) && t.timeline === timeline);
    const { keyframes, value, ...rest } = plain;
    // a track with no keyframes is no track (2026-11-22: a track holds keyframes only)
    if (isRecord(track) && Array.isArray(track.keyframes) && track.keyframes.length) {
        const { timeline: _t, ...own } = track;
        return { ...rest, ...own };
    }
    // no track here: the parameter's own value — its `value`, else its first keyframe's
    const first = Array.isArray(keyframes) && isRecord(keyframes[0]) ? keyframes[0].value : undefined;
    return value !== undefined ? { ...rest, value } : first !== undefined ? { ...rest, value: first } : rest;
}

/** The effects buckets of the tree as one run sees them. */
function effectsFor(node: PxNode, timeline: string | undefined): PxNode {
    const mapValue = (v: unknown): unknown => {
        if (Array.isArray(v)) return v.map(mapValue);
        if (!isRecord(v)) return v;
        const mapped: Record<string, unknown> = {};
        for (const [k, x] of Object.entries(v)) mapped[k] = mapValue(x);
        return Array.isArray(v.byTimeline) ? paramFor(mapped, timeline) : mapped;
    };
    const out: PxNode = { ...node };
    if (isRecord(node.effects)) out.effects = mapValue(node.effects) as PxNode['effects'];
    if (Array.isArray(node.children)) out.children = node.children.map(child => effectsFor(child, timeline));
    return out;
}

/** An animation entry without its tracks. */
function withoutTracks(entry: Record<string, unknown>): Record<string, unknown> {
    const { byTimeline: _b, ...rest } = entry;
    return rest;
}

/** An animation entry as a `T` track. */
function trackOf(entry: Record<string, unknown>, timeline: string): Record<string, unknown> {
    const { byTimeline: _b, ...rest } = entry;
    return { timeline, ...rest };
}

/** Merges the run for `timeline` into `base` (a fresh tree): every animation that differs there gets its track. */
function mergeRun(base: PxNode, run: PxNode, timeline: string): PxNode {
    if (base.type !== run.type) return base;
    const out: PxNode = { ...base };
    if (isRecord(run.animate)) {
        const animate: Record<string, unknown> = isRecord(base.animate) ? { ...base.animate } : {};
        let changed = false;
        for (const [prop, entry] of Object.entries(run.animate)) {
            if (!isRecord(entry)) continue;
            const mine = animate[prop];
            const own = isRecord(mine) ? mine : {};
            // the same as the first timeline's (its tracks aside): a node's own animation, or one nothing moves on `timeline`
            if (JSON.stringify(withoutTracks(own)) === JSON.stringify(withoutTracks(entry))) continue;
            const tracks = Array.isArray(own.byTimeline) ? own.byTimeline : [];
            animate[prop] = { ...own, byTimeline: [...tracks, trackOf(entry, timeline)] };
            changed = true;
        }
        if (changed) out.animate = animate as PxNode['animate'];
    }
    const kids = base.children;
    const theirs = run.children;
    if (Array.isArray(kids) && Array.isArray(theirs) && kids.length === theirs.length) {
        out.children = kids.map((child, i) => mergeRun(child, theirs[i], timeline));
    }
    return out;
}

// @px-importance important
/** `materializeNodeEffects`, with every effect parameter's `byTimeline` carried onto the animations it makes — see the
 *  top of the file. A tree with none: the one run, as before. @internal */
export function materializeNodeEffectsByTimeline(root: PxNode): ApplyResult {
    const timelines = effectTrackTimelines(root);
    if (!timelines.length) return materializeNodeEffects(root);
    const base = materializeNodeEffects(effectsFor(root, undefined));
    let merged = base.root;
    for (const timeline of timelines) {
        const run = materializeNodeEffects(effectsFor(root, timeline));
        merged = mergeRun(merged, run.root, timeline);
    }
    return { ...base, root: merged };
}
