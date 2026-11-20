// @px-area pipeline
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// Every timeline of a document and its WINDOW (2026-11-20) — what a `byTimeline` track is compiled against
// (`PxCompileContext.timelineWindows`) and what the units plan reads (`PxUnits.ts`). The first timeline's window comes
// from the runtime view; another's from its own keys, else its tracks' last keyframe.

import { PX_DEFAULT_DURATION_MS, getAnimatorConfig } from '../format/PxAnimatorConstants';
import { animatorOf } from '../format/PxDocStage';
import type { PxDocument } from '../format/PxAnimatorTypes';

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** One timeline of the file, as the plan reads it. @internal */
export interface PxTimelineInfo {
    readonly index: number;
    readonly id?: string;
    readonly timeline: Record<string, unknown>;
    readonly scroll: boolean;
    readonly windowStart: number;
    readonly windowEnd: number;
}

/** The largest keyframe time of the tracks on timeline `id` — what its window ends at when it says no `outTime`. */
function maxTrackTimeOf(doc: PxDocument, id: string): number | undefined {
    let max: number | undefined;
    const scanEntry = (entry: unknown): void => {
        if (!isRecord(entry) || !Array.isArray(entry.byTimeline)) return;
        for (const track of entry.byTimeline) {
            if (!isRecord(track) || track.timeline !== id || !Array.isArray(track.keyframes)) continue;
            for (const kf of track.keyframes) if (isRecord(kf) && typeof kf.time === 'number' && (max === undefined || kf.time > max)) max = kf.time;
        }
    };
    const scanNode = (node: unknown): void => {
        if (!isRecord(node)) return;
        if (isRecord(node.animate)) Object.values(node.animate).forEach(scanEntry);
        if (Array.isArray(node.children)) node.children.forEach(scanNode);
    };
    scanNode(doc);
    const animator = animatorOf(doc);
    const animations = isRecord(animator) && isRecord(animator.definitions) ? animator.definitions.animations : undefined;
    if (isRecord(animations)) for (const def of Object.values(animations)) if (isRecord(def)) Object.values(def).forEach(scanEntry);
    return max;
}

/** Every timeline of the document with its window — the first's from the runtime view, the others' from their keys. */
export function timelinesOf(doc: PxDocument): Array<PxTimelineInfo> {
    const animator = animatorOf(doc);
    const list = isRecord(animator) && Array.isArray(animator.timelines) ? animator.timelines : [];
    const view = getAnimatorConfig(doc);
    return list.filter(isRecord).map((timeline, index): PxTimelineInfo => {
        const id = typeof timeline.id === 'string' ? timeline.id : undefined;
        const scroll = timeline.type === 'scroll';
        if (index === 0) {
            const start = view?.inTime ?? 0;
            return { index, id, timeline, scroll, windowStart: start, windowEnd: start + (view?.duration ?? PX_DEFAULT_DURATION_MS) };
        }
        const start = typeof timeline.inTime === 'number' ? timeline.inTime : 0;
        const end = typeof timeline.outTime === 'number' ? timeline.outTime : (id !== undefined ? maxTrackTimeOf(doc, id) : undefined) ?? start + PX_DEFAULT_DURATION_MS;
        return { index, id, timeline, scroll, windowStart: start, windowEnd: Math.max(start, end) };
    });
}

/** The ids of the timelines some attribute rides — a `byTimeline` track on a node or in a shared animation. @internal */
export function trackedTimelineIds(doc: PxDocument): Set<string> {
    const out = new Set<string>();
    const scanEntry = (entry: unknown): void => {
        if (!isRecord(entry) || !Array.isArray(entry.byTimeline)) return;
        for (const track of entry.byTimeline) if (isRecord(track) && typeof track.timeline === 'string') out.add(track.timeline);
    };
    const scanNode = (node: unknown): void => {
        if (!isRecord(node)) return;
        if (isRecord(node.animate)) Object.values(node.animate).forEach(scanEntry);
        if (Array.isArray(node.children)) node.children.forEach(scanNode);
    };
    scanNode(doc);
    const animator = animatorOf(doc);
    const animations = isRecord(animator) && isRecord(animator.definitions) ? animator.definitions.animations : undefined;
    if (isRecord(animations)) for (const def of Object.values(animations)) if (isRecord(def)) Object.values(def).forEach(scanEntry);
    return out;
}

/** The first timeline's `id`, when it has one — a track naming it is that timeline's keyframes. @internal */
export function firstTimelineIdOf(doc: PxDocument): string | undefined {
    const animator = animatorOf(doc);
    const first = isRecord(animator) && Array.isArray(animator.timelines) ? animator.timelines[0] : undefined;
    return isRecord(first) && typeof first.id === 'string' ? first.id : undefined;
}

/** Every timeline's window by its id — the first's too when it has one. What `byTimeline` is compiled against. @internal */
export function timelineWindowsOf(doc: PxDocument): Map<string, { windowStart: number; windowEnd: number }> {
    const out = new Map<string, { windowStart: number; windowEnd: number }>();
    for (const t of timelinesOf(doc)) if (t.id !== undefined && !out.has(t.id)) out.set(t.id, { windowStart: t.windowStart, windowEnd: t.windowEnd });
    return out;
}

