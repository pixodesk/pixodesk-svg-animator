// @px-area pipeline
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// Every timeline of a document and its WINDOW (2026-11-20) — what a `byTimeline` track is compiled against
// (`PxCompileContext.timelineWindows`) and what the plan reads (`PxUnits.ts`). The DEFAULT timeline — the first with no
// id, wherever it stands (2026-11-22) — takes its window from the runtime view; another from its own keys, else its
// tracks' last keyframe. A second timeline with no id, or a repeated id, is not read (the first wins).

import { PX_DEFAULT_DURATION_MS, PX_DEFAULT_ID, PX_DEFAULT_TIMELINE, getAnimatorConfig } from '../format/PxAnimatorConstants';
import { animatorOf } from '../format/PxDocStage';
import type { PxDocument } from '../format/PxAnimatorTypes';

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** One timeline of the file, as the plan reads it. @internal */
export interface PxTimelineInfo {
    /** Its place among the timelines that are read. */
    readonly index: number;
    readonly id?: string;
    /** What the page and the rules call it: its id, or {@link PX_DEFAULT_TIMELINE}. */
    readonly name: string;
    /** The id of the step it is when no written step names it: its id, or `default` (`PX_DEFAULT_ID`). */
    readonly stepId: string;
    /** The timeline with no id — keyframes that name no timeline are its. */
    readonly isDefault: boolean;
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

/** Every timeline of the document that is read, with its window — the default one's from the runtime view, the
 *  others' from their keys. */
export function timelinesOf(doc: PxDocument): Array<PxTimelineInfo> {
    const animator = animatorOf(doc);
    const list = isRecord(animator) && Array.isArray(animator.timelines) ? animator.timelines : [];
    const view = getAnimatorConfig(doc);
    const out: Array<PxTimelineInfo> = [];
    let hasDefault = false;
    for (const timeline of list.filter(isRecord)) {
        const id = typeof timeline.id === 'string' && timeline.id !== PX_DEFAULT_TIMELINE ? timeline.id : undefined;
        if (id === undefined ? hasDefault : out.some(t => t.id === id)) continue;   // the first wins (PX1116)
        const scroll = timeline.type === 'scroll';
        const index = out.length;
        if (id === undefined) {
            hasDefault = true;
            const start = view?.inTime ?? 0;
            out.push({ index, id, name: PX_DEFAULT_TIMELINE, stepId: PX_DEFAULT_ID, isDefault: true, timeline, scroll, windowStart: start, windowEnd: start + (view?.duration ?? PX_DEFAULT_DURATION_MS) });
            continue;
        }
        const start = typeof timeline.inTime === 'number' ? timeline.inTime : 0;
        const end = typeof timeline.outTime === 'number' ? timeline.outTime : maxTrackTimeOf(doc, id) ?? start + PX_DEFAULT_DURATION_MS;
        out.push({ index, id, name: id, stepId: id, isDefault: false, timeline, scroll, windowStart: start, windowEnd: Math.max(start, end) });
    }
    return out;
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

/** Every named timeline's window by its id — what `byTimeline` is compiled against. @internal */
export function timelineWindowsOf(doc: PxDocument): Map<string, { windowStart: number; windowEnd: number }> {
    const out = new Map<string, { windowStart: number; windowEnd: number }>();
    for (const t of timelinesOf(doc)) if (t.id !== undefined) out.set(t.id, { windowStart: t.windowStart, windowEnd: t.windowEnd });
    return out;
}

