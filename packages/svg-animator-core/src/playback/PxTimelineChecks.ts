// @px-area pipeline
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// ============================================================================
// THE CHECKS of timelines, flows and flow steps (2026-11-20; flows 2026-11-22, kf app/docs/app-design/timelines-and-states.plan.md).
// Each is a finding; none stops a file from playing — the player keeps the first and goes on. The decisions are the
// plan's own (`planUnits`, `attributeOwnersOf`): what is reported here is what the player does.
//
// | kind | when |
// |---|---|
// | `idDuplicate` | two timelines (also two with no id) or two flows share an id — the first wins |
// | `referenceNotFound` | a step's or an entry's `timeline` / `flow`, an entry's `flowStep` or `from`, a track's `timeline` names nothing |
// | `timelineShared` | steps of two flows are on one timeline — the first flow keeps it |
// | `partOfScrollTimeline` | a step is a part of a scroll timeline (`inTime` / `outTime`) — not read; the whole of one is a step |
// | `attributeSplit` | an attribute (a node's transform parts count as one) is moved by two flows — the first wins |
// | `keyframesWithoutDefault` | plain keyframes in a file whose timelines all have an id — they are no timeline's: not played |
// | `unnamedAmongSeveral` | a timeline with no id in a file with several (2026-11-26: with several, every timeline is named) — it plays as the default one |
//
// Duplicate step ids and a `flow.goTo` naming no step have their own codes (PX1115, PX1114).
// ============================================================================

import { animatorOf } from '../format/PxDocStage';
import { PX_DEFAULT_ID, PX_DEFAULT_TIMELINE, PxFlowAction } from '../format/PxAnimatorConstants';
import type { PxDocument } from '../format/PxAnimatorTypes';
import { attributeOwnersOf, planUnits } from './PxUnits';
import { timelinesOf } from './PxTimelineWindows';

/** What {@link timelineIssues} reports. @public @advanced */
export const PxTimelineIssueKind = {
    idDuplicate:             'idDuplicate',
    referenceNotFound:       'referenceNotFound',
    timelineShared:          'timelineShared',
    partOfScrollTimeline:    'partOfScrollTimeline',
    attributeSplit:          'attributeSplit',
    keyframesWithoutDefault: 'keyframesWithoutDefault',
    unnamedAmongSeveral:     'unnamedAmongSeveral',
} as const;
/** @public @advanced */
export type PxTimelineIssueKind = typeof PxTimelineIssueKind[keyof typeof PxTimelineIssueKind];

/** One finding — structured, so a caller decides on `kind`, never on text. @public @advanced */
export interface PxTimelineIssue {
    readonly kind: PxTimelineIssueKind;
    /** The list the id is in (`timelines`, `flows`), or the reference's field (`timeline`, `flowStep`, `flow`). */
    readonly key?: string;
    /** The id: the repeated one, the one named, the shared timeline (`PX_DEFAULT_TIMELINE`, '', for the timeline with no id). */
    readonly id?: string;
    /** Where: a step's id, a rule's action, an element's id. */
    readonly at?: string;
    /** The attribute (`attributeSplit`, `keyframesWithoutDefault`). */
    readonly attribute?: string;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const listOf = (v: unknown): Array<Record<string, unknown>> => Array.isArray(v) ? v.filter(isRecord) : [];
const idOf = (v: Record<string, unknown>): string | undefined => typeof v.id === 'string' ? v.id : undefined;

// @px-importance important
/** Every finding in a document (its authored form, a version-current one). An empty list is a clean file.
 *  @public @advanced */
export function timelineIssues(doc: PxDocument): Array<PxTimelineIssue> {
    const animator = animatorOf(doc);
    if (!isRecord(animator)) return [];
    const issues: Array<PxTimelineIssue> = [];
    const rawTimelines = listOf(animator.timelines);
    const steps = listOf(animator.flowSteps);
    const flows = listOf(animator.flows);

    // repeated ids — timelines (two with no id are two default ones) and flows; a repeated step id is PX1115
    // several timelines: every one is named (2026-11-26) — one with no id still plays, as the default one
    if (rawTimelines.length > 1 && rawTimelines.some(t => idOf(t) === undefined)) {
        issues.push({ kind: PxTimelineIssueKind.unnamedAmongSeveral, key: 'timelines', id: PX_DEFAULT_TIMELINE });
    }
    const seenTimelines = new Set<string>();
    for (const t of rawTimelines) {
        const name = idOf(t) ?? PX_DEFAULT_TIMELINE;
        if (seenTimelines.has(name)) issues.push({ kind: PxTimelineIssueKind.idDuplicate, key: 'timelines', id: name });
        seenTimelines.add(name);
    }
    const seenFlows = new Set<string>();
    for (const f of flows) {
        const id = idOf(f);
        if (id === undefined) continue;
        if (seenFlows.has(id)) issues.push({ kind: PxTimelineIssueKind.idDuplicate, key: 'flows', id });
        seenFlows.add(id);
    }

    const timelines = timelinesOf(doc);
    const hasDefault = timelines.some(t => t.isDefault);
    const timelineNames = new Set(timelines.map(t => t.name));
    const flowIds = new Set<string>([PX_DEFAULT_ID, ...flows.map(idOf).filter((id): id is string => id !== undefined),
        ...steps.map(s => (typeof s.flow === 'string' ? s.flow : undefined)).filter((id): id is string => id !== undefined)]);
    const stepIds = new Set<string>([...steps.map(idOf).filter((id): id is string => id !== undefined), ...timelines.map(t => t.stepId)]);
    const timelineKnown = (ref: unknown): boolean => ref === undefined ? hasDefault : typeof ref === 'string' && timelineNames.has(ref);
    const notFound = (key: string, id: string, at?: string): void => { issues.push({ kind: PxTimelineIssueKind.referenceNotFound, key, id, at }); };

    // the steps: their references and the scroll rule — the segment (1.34), and each transition segment (its timeline
    // none: the step's own; a part of a scroll timeline is not played)
    for (const step of steps) {
        const at = idOf(step);
        const segment = isRecord(step.segment) ? step.segment : {};
        const own = typeof segment.timeline === 'string' ? segment.timeline : undefined;
        if (!timelineKnown(own)) notFound('timeline', own ?? PX_DEFAULT_TIMELINE, at);
        const t = timelines.find(x => x.name === (own ?? PX_DEFAULT_TIMELINE));
        if (t?.scroll && (segment.inTime !== undefined || segment.outTime !== undefined)) issues.push({ kind: PxTimelineIssueKind.partOfScrollTimeline, id: t.name, at });
        for (const part of [step.inTransitionSegment, step.outTransitionSegment]) {
            if (!isRecord(part)) continue;
            const ref = typeof part.timeline === 'string' ? part.timeline : own;
            if (!timelineKnown(ref)) { notFound('timeline', ref ?? PX_DEFAULT_TIMELINE, at); continue; }
            const pt = timelines.find(x => x.name === (ref ?? PX_DEFAULT_TIMELINE));
            if (pt?.scroll) issues.push({ kind: PxTimelineIssueKind.partOfScrollTimeline, id: pt.name, at });
        }
    }

    // where each flow starts (1.33): a step of that flow — or, for `default`, a timeline's own step
    for (const f of flows) {
        const id = idOf(f) ?? undefined;
        const start = typeof f.initialFlowStep === 'string' ? f.initialFlowStep : undefined;
        if (id === undefined || start === undefined) continue;
        const own = steps.some(s => idOf(s) === start && (typeof s.flow === 'string' ? s.flow : PX_DEFAULT_ID) === id)
            || (id === PX_DEFAULT_ID && timelines.some(t => t.stepId === start) && !steps.some(s => idOf(s) === start));
        if (!own) notFound('initialFlowStep', start, id);
    }

    // the entries' references (1.33: what it acts on in `with`, the steps in `when.flowSteps`)
    for (const entry of listOf(animator.actions)) {
        const action = typeof entry.name === 'string' ? entry.name : undefined;
        const args = isRecord(entry.with) ? entry.with : {};
        const when = isRecord(entry.when) ? entry.when : {};
        const from = Array.isArray(when.flowSteps) ? when.flowSteps.filter((x): x is string => typeof x === 'string') : [];
        for (const id of from) if (!stepIds.has(id)) notFound('flowSteps', id, action);
        if (typeof args.timeline === 'string' && !timelineNames.has(args.timeline)) notFound('timeline', args.timeline, action);
        if (typeof args.flow === 'string' && !flowIds.has(args.flow)) notFound('flow', args.flow, action);
        // a go-to naming no step is PX1114
        if (action !== PxFlowAction.goTo && typeof args.flowStep === 'string' && !stepIds.has(args.flowStep)) notFound('flowStep', args.flowStep, action);
    }

    // the tracks' references, and plain keyframes with no default timeline to be on
    const visit = (node: unknown): void => {
        if (!isRecord(node)) return;
        const element = typeof node.id === 'string' ? node.id : undefined;
        if (isRecord(node.animate)) {
            for (const [attribute, entry] of Object.entries(node.animate)) {
                if (!isRecord(entry)) continue;
                if (!hasDefault && entry.kind === undefined && Array.isArray(entry.keyframes) && entry.keyframes.length > 0) {
                    issues.push({ kind: PxTimelineIssueKind.keyframesWithoutDefault, at: element, attribute });
                }
                for (const track of listOf(entry.byTimeline)) {
                    if (typeof track.timeline === 'string' && (track.timeline === PX_DEFAULT_TIMELINE || !timelineNames.has(track.timeline))) notFound('timeline', track.timeline, element);
                }
            }
        }
        if (Array.isArray(node.children)) node.children.forEach(visit);
    };
    visit(doc);

    // what the plan keeps first — a timeline two flows use, an attribute two flows move
    const plan = planUnits(doc);
    if (plan) {
        for (const d of plan.droppedSteps) issues.push({ kind: PxTimelineIssueKind.timelineShared, id: plan.timelines[d.timeline].name, at: d.flowStep });
        for (const claim of attributeOwnersOf(doc, plan)) {
            if (claim.units.length < 2) continue;
            const at = typeof claim.node?.id === 'string' ? claim.node.id : claim.element;
            issues.push({ kind: PxTimelineIssueKind.attributeSplit, at, attribute: claim.attribute });
        }
    }
    return issues;
}
