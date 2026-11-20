// @px-area pipeline
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// ============================================================================
// THE CHECKS of several timelines and states (2026-11-20, kf app/docs/app-design/timelines-and-states.design.md §2.7).
// Each is a finding; none stops a file from playing — the player keeps the first and goes on (`planUnits`).
//
// | kind | when |
// |---|---|
// | `idDuplicate` | two timelines, states or state machines share an id — the first wins |
// | `referenceNotFound` | a state's or a rule's `timeline` / `stateMachine`, a rule's `state`, a track's `timeline` names nothing |
// | `timelineShared` | states of two state machines are on one timeline — it has one playhead; the first keeps it |
// | `stateOnScrollTimeline` | a state on a scroll-driven timeline — not read |
// | `attributeSplit` | an attribute (a node's transform parts count as one) rides timelines of two units — the first wins |
// | `keyframesBesideTracks` | plain `keyframes` beside `byTimeline` — `byTimeline` wins |
//
// Duplicate state ids and a `state.goTo` naming no state have their own codes (PX1115, PX1114).
// ============================================================================

import { animatorOf } from '../format/PxDocStage';
import { PxStateAction } from '../format/PxAnimatorConstants';
import type { PxDocument } from '../format/PxAnimatorTypes';

/** What {@link timelineIssues} reports. @public @advanced */
export const PxTimelineIssueKind = {
    idDuplicate:           'idDuplicate',
    referenceNotFound:     'referenceNotFound',
    timelineShared:        'timelineShared',
    stateOnScrollTimeline: 'stateOnScrollTimeline',
    attributeSplit:        'attributeSplit',
    keyframesBesideTracks: 'keyframesBesideTracks',
} as const;
/** @public @advanced */
export type PxTimelineIssueKind = typeof PxTimelineIssueKind[keyof typeof PxTimelineIssueKind];

/** One finding — structured, so a caller decides on `kind`, never on text. @public @advanced */
export interface PxTimelineIssue {
    readonly kind: PxTimelineIssueKind;
    /** The list the id is in (`timelines`, `states`, `stateMachines`), or the reference's field (`timeline`, `state`, `stateMachine`). */
    readonly key?: string;
    /** The id: the repeated one, the one named, the shared timeline. */
    readonly id?: string;
    /** Where: a state's id, a rule's action, an element's id. */
    readonly at?: string;
    /** The attribute (`attributeSplit`, `keyframesBesideTracks`). */
    readonly attribute?: string;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const listOf = (v: unknown): Array<Record<string, unknown>> => Array.isArray(v) ? v.filter(isRecord) : [];
const idOf = (v: Record<string, unknown>): string | undefined => typeof v.id === 'string' ? v.id : undefined;

/** A node's transform parts — one attribute while playing. */
const TRANSFORM_PARTS: ReadonlyArray<string> = ['transform', 'translate', 'rotate', 'scale', 'skew', 'transformOrigin'];

/** The attribute a node's `animate` key counts as: a transform part → `transform`. */
const attributeGroupOf = (key: string): string => TRANSFORM_PARTS.includes(key) ? 'transform' : key;

// @px-importance important
/** Every finding of §2.7 in a document (its authored form, a version-current one). An empty list is a clean file.
 *  @public @advanced */
export function timelineIssues(doc: PxDocument): Array<PxTimelineIssue> {
    const animator = animatorOf(doc);
    if (!isRecord(animator)) return [];
    const issues: Array<PxTimelineIssue> = [];
    const timelines = listOf(animator.timelines);
    const states = listOf(animator.states);
    const machines = listOf(animator.stateMachines);

    for (const [key, items] of [['timelines', timelines], ['states', states], ['stateMachines', machines]] as const) {
        const seen = new Set<string>();
        for (const item of items) {
            const id = idOf(item);
            if (id === undefined) continue;
            // a repeated state id has its own code (PX1115)
            if (seen.has(id) && key !== 'states') issues.push({ kind: PxTimelineIssueKind.idDuplicate, key, id });
            seen.add(id);
        }
    }

    const timelineIds = timelines.map(idOf);
    const machineIds = machines.map(idOf);
    const stateIds = states.map(idOf);
    const timelineIndexOf = (ref: unknown): number => ref === undefined ? 0 : typeof ref === 'string' ? timelineIds.indexOf(ref) : -1;
    const notFound = (key: string, id: string, at?: string): void => { issues.push({ kind: PxTimelineIssueKind.referenceNotFound, key, id, at }); };

    // the states: their references, the scroll rule, one state machine per timeline (first wins — as `planUnits`)
    const unitOfTimeline = new Map<number, string>();
    for (const state of states) {
        const at = idOf(state);
        const timeline = state.timeline;
        const index = timelineIndexOf(timeline);
        if (typeof timeline === 'string' && index < 0) notFound('timeline', timeline, at);
        const machine = typeof state.stateMachine === 'string' ? state.stateMachine : '';
        if (machine && !machineIds.includes(machine)) notFound('stateMachine', machine, at);
        if (index < 0) continue;
        if (timelines[index]?.type === 'scroll') { issues.push({ kind: PxTimelineIssueKind.stateOnScrollTimeline, id: timelineIds[index] ?? '', at }); continue; }
        const holder = unitOfTimeline.get(index);
        if (holder === undefined) unitOfTimeline.set(index, 'm:' + machine);
        else if (holder !== 'm:' + machine) issues.push({ kind: PxTimelineIssueKind.timelineShared, id: timelineIds[index] ?? '', at });
    }
    // a timeline no state uses plays by itself: a unit of its own
    timelines.forEach((_, index) => { if (!unitOfTimeline.has(index)) unitOfTimeline.set(index, 't:' + index); });

    // the rules' references
    for (const rule of listOf(animator.actionTriggers)) {
        const action = typeof rule.action === 'string' ? rule.action : undefined;
        if (typeof rule.timeline === 'string' && !timelineIds.includes(rule.timeline)) notFound('timeline', rule.timeline, action);
        if (typeof rule.stateMachine === 'string' && !machineIds.includes(rule.stateMachine)) notFound('stateMachine', rule.stateMachine, action);
        // a go-to naming no state is PX1114
        if (action !== PxStateAction.goTo && typeof rule.state === 'string' && !stateIds.includes(rule.state)) notFound('state', rule.state, action);
    }

    // the attributes: their tracks' timelines, one unit each (a node's transform parts together)
    const visit = (node: unknown): void => {
        if (!isRecord(node)) return;
        const element = typeof node.id === 'string' ? node.id : undefined;
        if (isRecord(node.animate)) {
            const unitsOf = new Map<string, Set<string>>();
            for (const [key, entry] of Object.entries(node.animate)) {
                if (!isRecord(entry)) continue;
                const tracks = listOf(entry.byTimeline);
                const plain = Array.isArray(entry.keyframes) && entry.keyframes.length > 0;
                // an authored entry (no `kind`) with both: `byTimeline` wins; a compiled one carries the first timeline's keyframes there
                if (plain && tracks.length && entry.kind === undefined) issues.push({ kind: PxTimelineIssueKind.keyframesBesideTracks, at: element, attribute: key });
                const units = unitsOf.get(attributeGroupOf(key)) ?? new Set<string>();
                if (plain && (!tracks.length || entry.kind !== undefined)) units.add(unitOfTimeline.get(0) ?? 't:0');
                for (const track of tracks) {
                    const index = timelineIndexOf(track.timeline);
                    if (index < 0) { if (typeof track.timeline === 'string') notFound('timeline', track.timeline, element); continue; }
                    units.add(unitOfTimeline.get(index) ?? 't:' + index);
                }
                unitsOf.set(attributeGroupOf(key), units);
            }
            for (const [attribute, units] of unitsOf) {
                if (units.size > 1) issues.push({ kind: PxTimelineIssueKind.attributeSplit, at: element, attribute });
            }
        }
        if (Array.isArray(node.children)) node.children.forEach(visit);
    };
    visit(doc);
    return issues;
}
