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

    // the steps: their references and the scroll rule
    for (const step of steps) {
        const at = idOf(step);
        if (!timelineKnown(step.timeline)) notFound('timeline', typeof step.timeline === 'string' ? step.timeline : PX_DEFAULT_TIMELINE, at);
        const t = timelines.find(x => x.name === (typeof step.timeline === 'string' ? step.timeline : PX_DEFAULT_TIMELINE));
        if (t?.scroll && (step.inTime !== undefined || step.outTime !== undefined)) issues.push({ kind: PxTimelineIssueKind.partOfScrollTimeline, id: t.name, at });
    }

    // the rules' references
    for (const rule of listOf(animator.actions)) {
        const action = typeof rule.action === 'string' ? rule.action : undefined;
        // the steps an entry is limited to (1.29)
        const from = typeof rule.from === 'string' ? [rule.from] : Array.isArray(rule.from) ? rule.from.filter((x): x is string => typeof x === 'string') : [];
        for (const id of from) if (!stepIds.has(id)) notFound('from', id, action);
        if (typeof rule.timeline === 'string' && !timelineNames.has(rule.timeline)) notFound('timeline', rule.timeline, action);
        if (typeof rule.flow === 'string' && !flowIds.has(rule.flow)) notFound('flow', rule.flow, action);
        // a go-to naming no step is PX1114
        if (action !== PxFlowAction.goTo && typeof rule.flowStep === 'string' && !stepIds.has(rule.flowStep)) notFound('flowStep', rule.flowStep, action);
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
            issues.push({ kind: PxTimelineIssueKind.attributeSplit, at: typeof claim.node.id === 'string' ? claim.node.id : undefined, attribute: claim.attribute });
        }
    }
    return issues;
}
