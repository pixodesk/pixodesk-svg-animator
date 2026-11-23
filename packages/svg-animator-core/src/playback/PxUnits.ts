// @px-area pipeline
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// ============================================================================
// THE PLAN (2026-11-22; units 2026-11-20) — a file with flows, as a player plays it. ONE UNIT per flow that runs —
// they run side by side; within a unit one STEP is current, and a step plays with the ordinary playback, on its own
// timeline (kf app/docs/app-design/timelines-and-states.plan.md, P-1: no timelines glued together, no clock of our own).
//
// | piece | what it does |
// |---|---|
// | `planUnits` | the units; `undefined` when the file is its default timeline alone (today's one-timeline path) |
// | `stepDocumentOf` | one step's document: its timeline only (its part, its own settings), its tracks promoted to the plain keyframes — on the nodes and in the shared animations (`definitions.animations`, the pre-rendered path) — and only the attributes its unit owns |
// | `unitConfigOf` | what a unit's triggers are wired from: its rules, its steps, the gate of its first step's timeline |
// | `attributeOwnersOf` | which unit moves each attribute (the clash rule) |
//
// The flow `default` (2026-11-22): the steps that name no flow, AND one step for every timeline no written step names —
// the whole of it, called by the timeline's id (the default timeline's: `default`). In it, written steps keep their
// order and such a step stands at its timeline's place. Only flows run side by side: two timelines alone are two steps.
//
// What runs: every flow, `default` first, then the flows in `animator.flows`' order, then those only steps name. The
// page may say exactly what runs (`PxRunLists`): `flows` — those flows; `timelines` — each of those timelines whole, by
// itself, side by side.
//
// The checks — the first wins: a step on a timeline the file lacks is not read; a step on a part of a scroll timeline is
// not read; a timeline that steps of two running flows use stays with the first flow; an attribute that two running
// units move stays with the first (a node's transform parts count as one attribute). `timelineIssues` reports them.
//
// The rules — what goes where:
// | a rule | goes to |
// |---|---|
// | `timeline.*` with no `timeline` | every unit a clock drives (the whole picture) |
// | `timeline.*` with a `timeline` | the unit that plays that timeline |
// | `flow.goTo` | the unit that has the step |
// | `flow.next` / `flow.previous` | the unit of its `flow` — none: `default`, else the first |
// ============================================================================

import { isCompiledAnimation, type PxActionObject, type PxActionTriggerRule, type PxAnimationDefinition, type PxCompiledAnimation, type PxDefinitions, type PxDocument, type PxFlowStep, type PxNode } from '../format/PxAnimatorTypes';
import { PX_DEFAULT_ID, PX_DEFAULT_TIMELINE, PxFlowAction, PxWhenFinished, PxWhenIdle, PxWhenLeaving, flowStepIndexAfter, flowStepMoveOf, getAnimatorConfig, isPlaybackAction, resolveTimelineEngine } from '../format/PxAnimatorConstants';
import { atEndActionOf, isFlowStepEntry } from './PxFlows';
import type { PxFlowSwitchStep } from './PxFlowSwitch';
import { timelinesOf, timelineWindowsOf, type PxTimelineInfo } from './PxTimelineWindows';
import { animatorOf } from '../format/PxDocStage';
import { timelineTrackOf } from '../animation/PxRuntimeChannel';
import { compileAnimationDefinition, type PxCompileContext } from '../animation/PxDefinitions';

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** What the page says runs (2026-11-22) — the `flows` and `timelines` options and props. With neither, every flow
 *  runs; with either, exactly what they name. The public face is `PxRunListProps`. @internal */
export interface PxRunLists {
    /** The flows that run, by id — `default` for the flow `default`. */
    readonly flows?: ReadonlyArray<string>;
    /** The timelines that run, each whole and by itself, by id — `default` for the timeline with no id. */
    readonly timelines?: ReadonlyArray<string>;
}

/** True when the page named what runs. */
const hasRunLists = (run: PxRunLists | undefined): boolean => !!run && (run.flows !== undefined || run.timelines !== undefined);

/** One step as the player plays it: written, or the step a timeline no step names is. @internal */
export interface PxPlannedStep {
    readonly id: string;
    /** Its timeline — an index into the plan's `timelines`. */
    readonly timeline: number;
    /** As written; for a timeline's own step `{ id }` (and its `timeline`). */
    readonly step: PxFlowStep;
    /** The step a timeline no written step names is — it plays as the timeline alone does. */
    readonly implied: boolean;
}

/** One unit: a flow that runs, or a timeline the page runs by name. @internal */
export interface PxUnit {
    /** The flow's id — `default` for the flow `default`; absent: a timeline the page runs by name. */
    readonly flow?: string;
    /** Its steps, in order — one is current at a time. */
    readonly steps: ReadonlyArray<PxPlannedStep>;
    /** The timelines its steps are on, each once, in step order. */
    readonly timelines: ReadonlyArray<number>;
    /** Every step is the whole of a scroll timeline: the scrolling moves it, no trigger is heard. */
    readonly scroll: boolean;
}

/** The units of a document, every timeline of it, and what the plan left out. @internal */
export interface PxUnitPlan {
    readonly units: ReadonlyArray<PxUnit>;
    readonly timelines: ReadonlyArray<PxTimelineInfo>;
    /** Steps of a later running flow on a timeline an earlier flow uses — not read: the first flow keeps the timeline. */
    readonly droppedSteps: ReadonlyArray<{ readonly timeline: number; readonly flowStep: string }>;
}

/** The index of the timeline a step or a rule names — none or `PX_DEFAULT_TIMELINE`: the default one; -1 when the file lacks it. */
function indexOfTimeline(timelines: ReadonlyArray<PxTimelineInfo>, ref: unknown): number {
    if (ref === undefined || ref === PX_DEFAULT_TIMELINE) return timelines.findIndex(t => t.isDefault);
    return timelines.findIndex(t => t.id === ref);
}

/** The step a timeline is when no written step names it — the whole of it, called by its `stepId`. */
function impliedStepOf(t: PxTimelineInfo): PxPlannedStep {
    return { id: t.stepId, timeline: t.index, step: t.isDefault ? { id: t.stepId } : { id: t.stepId, timeline: t.id }, implied: true };
}

/** A step is a PART of its timeline when it says where it begins or ends. */
const isPartOfTimeline = (step: PxFlowStep): boolean => step.inTime !== undefined || step.outTime !== undefined;

/** A unit of `flow` (or of a timeline the page runs) over `steps`. */
function unitOf(flow: string | undefined, steps: ReadonlyArray<PxPlannedStep>, timelines: ReadonlyArray<PxTimelineInfo>): PxUnit {
    const used: Array<number> = [];
    for (const s of steps) if (!used.includes(s.timeline)) used.push(s.timeline);
    return { flow, steps, timelines: used, scroll: used.length > 0 && used.every(i => timelines[i].scroll) };
}

// @px-importance important
/**
 * The units of `doc` — `undefined` when the file is its default timeline alone, with no step written and no list from
 * the page (the one-timeline path: the document plays as it is). See the top of the file. @internal
 */
export function planUnits(doc: PxDocument, run?: PxRunLists): PxUnitPlan | undefined {
    const timelines = timelinesOf(doc);
    if (timelines.length === 0) return undefined;
    const animator = animatorOf(doc);
    const rawSteps = isRecord(animator) && Array.isArray(animator.flowSteps) ? animator.flowSteps : [];

    // the written steps — the first id wins; a timeline the file lacks, or a part of a scroll timeline: not read
    const written: Array<PxPlannedStep & { flow: string }> = [];
    const ids = new Set<string>();
    for (const raw of rawSteps) {
        if (!isFlowStepEntry(raw) || ids.has(raw.id)) continue;
        const step = raw;
        const at = indexOfTimeline(timelines, step.timeline);
        if (at < 0 || (timelines[at].scroll && isPartOfTimeline(step))) continue;
        ids.add(step.id);
        written.push({ id: step.id, timeline: at, step, implied: false, flow: typeof step.flow === 'string' ? step.flow : PX_DEFAULT_ID });
    }
    // a timeline no written step names is a step of `default` — unless a written step has its name
    const named = new Set(written.map(s => s.timeline));
    const implied: Array<PxPlannedStep> = timelines
        .filter(t => !named.has(t.index) && !ids.has(t.stepId))
        .map(t => impliedStepOf(t));

    /** The steps of a flow in order; in `default` a timeline's own step stands at its timeline's place. */
    const stepsOf = (flow: string): Array<PxPlannedStep> => {
        const own: Array<PxPlannedStep> = written.filter(s => s.flow === flow);
        if (flow !== PX_DEFAULT_ID) return own;
        for (const step of implied) {
            const at = own.findIndex(s => s.timeline > step.timeline);
            if (at < 0) own.push(step); else own.splice(at, 0, step);
        }
        return own;
    };
    // the flows in order: `default`, the listed ones, then those only steps name
    const flowIds: Array<string> = [];
    const addFlow = (id: string): void => { if (!flowIds.includes(id) && stepsOf(id).length) flowIds.push(id); };
    addFlow(PX_DEFAULT_ID);
    if (isRecord(animator) && Array.isArray(animator.flows)) for (const f of animator.flows) if (isRecord(f) && typeof f.id === 'string') addFlow(f.id);
    for (const s of written) addFlow(s.flow);

    // what runs, in run order
    const running: Array<{ flow?: string; steps: Array<PxPlannedStep> }> = [];
    if (hasRunLists(run)) {
        for (const flow of run?.flows ?? []) if (flowIds.includes(flow) && !running.some(u => u.flow === flow)) running.push({ flow, steps: stepsOf(flow) });
        for (const name of run?.timelines ?? []) {
            const t = timelines.find(x => x.name === name);
            if (!t || running.some(u => u.flow === undefined && u.steps[0]?.timeline === t.index)) continue;
            running.push({ steps: [impliedStepOf(t)] });
        }
    } else {
        for (const flow of flowIds) running.push({ flow, steps: stepsOf(flow) });
    }

    // a timeline is the first running flow's: a later flow's steps on it are not read
    const owner = new Map<number, number>();
    const dropped: Array<{ timeline: number; flowStep: string }> = [];
    const units: Array<PxUnit> = [];
    running.forEach((u, i) => {
        const kept = u.flow === undefined ? u.steps : u.steps.filter(s => {
            const o = owner.get(s.timeline);
            if (o === undefined || o === i) { owner.set(s.timeline, i); return true; }
            dropped.push({ timeline: s.timeline, flowStep: s.id });
            return false;
        });
        if (kept.length) units.push(unitOf(u.flow, kept, timelines));
    });

    const only = units.length === 1 ? units[0] : undefined;
    if (!hasRunLists(run) && only && only.flow === PX_DEFAULT_ID && only.steps.length === 1 && only.steps[0].implied
        && timelines[only.steps[0].timeline].isDefault && timelines.length === 1) return undefined;
    return { units, timelines, droppedSteps: dropped };
}

// ── the clash rule ─────────────────────────────────────────────────────────────────────────

/** A node's transform parts — one attribute while playing. */
const TRANSFORM_PARTS: ReadonlyArray<string> = ['transform', 'translate', 'rotate', 'scale', 'skew', 'transformOrigin'];

/** The attribute a node's `animate` key counts as: a transform part → `transform`. @internal */
export const attributeGroupOf = (key: string): string => TRANSFORM_PARTS.includes(key) ? 'transform' : key;

/** The timelines (indexes) an `animate` entry moves the attribute on — authored or compiled: its plain keyframes on the
 *  default timeline, each track on its own. */
function timelinesOfEntry(entry: unknown, timelines: ReadonlyArray<PxTimelineInfo>): Array<number> {
    if (!isRecord(entry)) return [];
    const out: Array<number> = [];
    const def = timelines.findIndex(t => t.isDefault);
    if (def >= 0 && Array.isArray(entry.keyframes) && entry.keyframes.length > 0) out.push(def);
    if (Array.isArray(entry.byTimeline)) {
        for (const track of entry.byTimeline) {
            if (!isRecord(track) || typeof track.timeline !== 'string' || !Array.isArray(track.keyframes) || !track.keyframes.length) continue;
            const at = timelines.findIndex(t => t.id === track.timeline);
            if (at >= 0 && !out.includes(at)) out.push(at);
        }
    }
    return out;
}

/** Who moves one attribute: the units that do, in run order — the first owns it. @internal */
export interface PxAttributeClaim {
    readonly node: PxNode;
    readonly attribute: string;
    /** Indexes into the plan's `units`, in run order. */
    readonly units: ReadonlyArray<number>;
}

// @px-importance important
/** Every animated attribute of the tree (a node's transform parts as one) with the units that move it. The first unit
 *  owns it; the others' keyframes for it are not played. @internal */
export function attributeOwnersOf(doc: PxDocument, plan: PxUnitPlan): Array<PxAttributeClaim> {
    const out: Array<PxAttributeClaim> = [];
    const visit = (node: unknown): void => {
        if (!isRecord(node)) return;
        if (isRecord(node.animate)) {
            const byGroup = new Map<string, Array<number>>();
            for (const [key, entry] of Object.entries(node.animate)) {
                const group = attributeGroupOf(key);
                const units = byGroup.get(group) ?? [];
                for (const t of timelinesOfEntry(entry, plan.timelines)) {
                    plan.units.forEach((u, i) => { if (u.timelines.includes(t) && !units.includes(i)) units.push(i); });
                }
                byGroup.set(group, units);
            }
            for (const [attribute, units] of byGroup) if (units.length) out.push({ node: node as PxNode, attribute, units: [...units].sort((a, b) => a - b) });
        }
        if (Array.isArray(node.children)) node.children.forEach(visit);
    };
    visit(doc);
    return out;
}

/** Whether unit `unit` may move `prop` of `node` — no other unit before it does. */
function ownsOf(claims: ReadonlyArray<PxAttributeClaim>, unit: number): (node: PxNode | undefined, prop: string) => boolean {
    const byNode = new Map<PxNode, Map<string, number>>();
    for (const c of claims) {
        const m = byNode.get(c.node) ?? new Map<string, number>();
        m.set(c.attribute, c.units[0]);
        byNode.set(c.node, m);
    }
    return (node, prop) => {
        if (!node) return true;
        const first = byNode.get(node)?.get(attributeGroupOf(prop));
        return first === undefined || first === unit;
    };
}

// ── what a unit hears ──────────────────────────────────────────────────────────────────────

/** The rules a unit hears — see the table at the top of the file; `timeline` is dropped (a step has one). */
function rulesForUnit(rules: ReadonlyArray<PxActionTriggerRule>, unit: PxUnit, plan: PxUnitPlan): Array<PxActionTriggerRule> {
    const stepIds = new Set(unit.steps.map(s => s.id));
    const flowUnits = plan.units.filter(u => u.flow !== undefined);
    const defaultFlow = flowUnits.find(u => u.flow === PX_DEFAULT_ID) ?? flowUnits[0];
    const out: Array<PxActionTriggerRule> = [];
    for (const rule of rules) {
        let mine: boolean;
        if (isPlaybackAction(rule.action)) {
            mine = rule.timeline === undefined ? !unit.scroll : unit.timelines.includes(indexOfTimeline(plan.timelines, rule.timeline));
        } else if (rule.action === PxFlowAction.goTo) {
            mine = rule.flowStep !== undefined && stepIds.has(rule.flowStep);
        } else {
            mine = rule.flow !== undefined ? unit.flow === rule.flow : unit === defaultFlow;
        }
        if (!mine) continue;
        out.push({ ...rule, timeline: undefined });
    }
    return out;
}

/** What a unit's triggers are wired from (2026-11-22): its rules, its steps, and the gate — the in-view numbers and
 *  `actions` of its first step's timeline. A one-timeline document whose triggers wire the picture. @internal */
export function unitConfigOf(doc: PxDocument, unit: PxUnit, plan: PxUnitPlan): PxDocument {
    const rules = rulesForUnit(getAnimatorConfig(doc)?.actions ?? [], unit, plan);
    const first = plan.timelines[unit.steps[0]?.timeline ?? 0]?.timeline ?? {};
    const timeline: Record<string, unknown> = {};
    for (const key of ['whenStopped', 'whenOutOfView', 'inViewThreshold', 'inViewDebounce']) if (first[key] !== undefined) timeline[key] = first[key];
    const config: Record<string, unknown> = { timelines: [timeline], flowSteps: unit.steps.map(s => ({ id: s.id })) };
    if (rules.length) config.actions = rules;
    return { type: 'svg', animator: config } as PxDocument;
}

// ── a step's document ──────────────────────────────────────────────────────────────────────

/** A timeline record as a step's only timeline — its id and label go (nothing refers to them inside). */
function asOnlyTimeline(timeline: Record<string, unknown>): Record<string, unknown> {
    const { id: _id, name: _name, ...rest } = timeline;
    return rest;
}

/** A step of no length (`inTime` = `outTime`) holds the frame at its start — played as a part this long, ms. */
const HELD_FRAME_MS = 1;

const isPictureWord = (v: unknown): v is PxWhenFinished =>
    v === PxWhenFinished.hold || v === PxWhenFinished.jumpToStart || v === PxWhenFinished.animateToStart;

/** A written step's timeline: its part, and what it says over the timeline (repeats, direction, speed, its end —
 *  an action at its end is the flow's: the playback holds). No delay; before anything plays, its first frame. */
function stepTimeline(timeline: Record<string, unknown>, step: PxFlowStep, goesOn: boolean): Record<string, unknown> {
    const out = asOnlyTimeline(timeline);
    if (typeof step.inTime === 'number') out.inTime = step.inTime;
    if (typeof step.outTime === 'number') out.outTime = step.outTime;
    const start = typeof out.inTime === 'number' ? out.inTime : 0;
    if (typeof out.outTime === 'number' && out.outTime <= start) { out.outTime = start + HELD_FRAME_MS; out.iterations = 1; }
    if (step.iterations !== undefined) out.iterations = step.iterations;
    if (step.iterationDirection !== undefined) out.iterationDirection = step.iterationDirection;
    if (step.playbackSpeed !== undefined) out.playbackSpeed = step.playbackSpeed;
    // it goes on at its end (a `finished` entry, 1.29): the flow's — the playback holds
    if (goesOn) out.whenFinished = PxWhenFinished.hold;
    else if (isPictureWord(step.whenFinished)) out.whenFinished = step.whenFinished;
    delete out.delay;
    out.whenIdle = PxWhenIdle.firstFrame;
    return out;
}

/** The node tree with every compiled entry of every node's `animate` replaced by `project(entry, node, prop)` — an
 *  entry it drops is gone; a node left with none has no `animate`. Shares untouched subtrees. */
function projectTree(node: PxNode, project: (ch: PxCompiledAnimation, node: PxNode, prop: string) => PxCompiledAnimation | undefined): PxNode {
    let children: Array<PxNode> | undefined;
    if (Array.isArray(node.children)) {
        const mapped = node.children.map(child => projectTree(child, project));
        if (mapped.some((c, i) => c !== node.children?.[i])) children = mapped;
    }
    let animate: Record<string, PxCompiledAnimation> | undefined;
    let dropAnimate = false;
    if (isRecord(node.animate)) {
        animate = {};
        for (const [prop, entry] of Object.entries(node.animate)) {
            if (!isRecord(entry) || !isCompiledAnimation(entry as PxCompiledAnimation)) continue;
            const projected = project(entry as PxCompiledAnimation, node, prop);
            if (projected) animate[prop] = projected;
        }
        if (!Object.keys(animate).length) { animate = undefined; dropAnimate = true; }
    }
    if (!children && animate === undefined && !dropAnimate) return node;
    const out: PxNode = { ...node };
    if (children) out.children = children;
    if (animate) out.animate = animate;
    else if (dropAnimate) delete out.animate;
    return out;
}

/** Every node with an id, by its id. */
function nodesById(root: PxNode): Map<string, PxNode> {
    const out = new Map<string, PxNode>();
    const visit = (n: PxNode): void => {
        if (typeof n.id === 'string' && !out.has(n.id)) out.set(n.id, n);
        if (Array.isArray(n.children)) n.children.forEach(visit);
    };
    visit(root);
    return out;
}

/** The shared animations (`definitions.animations` — the pre-rendered path) with every compiled entry replaced by
 *  `project(entry, node, prop)`, `node` the element a binding plays it on, or none. `undefined` when there are none. */
function projectDefinitions(
    doc: PxDocument,
    animator: Record<string, unknown>,
    plan: PxUnitPlan,
    project: (ch: PxCompiledAnimation, node: PxNode | undefined, prop: string) => PxCompiledAnimation | undefined,
): Record<string, unknown> | undefined {
    const defs = isRecord(animator.definitions) ? animator.definitions : undefined;
    const animations = defs && isRecord(defs.animations) ? defs.animations : undefined;
    if (!defs || !animations) return undefined;
    const nodes = nodesById(doc as PxNode);
    const bindings = Array.isArray(animator.bindings) ? animator.bindings.filter(isRecord) : [];
    const nodeOf = (name: string): PxNode | undefined => {
        const binding = bindings.find(b => Array.isArray(b.animateWith) && b.animateWith.includes(name));
        const element = binding && typeof binding.element === 'string' ? binding.element : undefined;
        return element === undefined ? undefined : nodes.get(element.startsWith('#') ? element.slice(1) : element);
    };
    // a plain document keeps its shared animations AUTHORED (`normalizeBindings` compiles them at bind time): they are
    // compiled here — every track against its own timeline's window, the engine as the player resolves it
    const def = plan.timelines.find(t => t.isDefault) ?? plan.timelines[0];
    const ctx: PxCompileContext = {
        windowStart: def?.windowStart ?? 0, windowEnd: def?.windowEnd ?? 0, defs: defs as PxDefinitions,
        engine: resolveTimelineEngine(getAnimatorConfig(doc)?.engine), timelineWindows: timelineWindowsOf(doc),
    };
    const out: Record<string, unknown> = {};
    for (const [name, animation] of Object.entries(animations)) {
        if (!isRecord(animation)) { out[name] = animation; continue; }
        const node = nodeOf(name);
        const projected: Record<string, unknown> = {};
        for (const [prop, entry] of Object.entries(animation)) {
            if (!isRecord(entry)) { projected[prop] = entry; continue; }
            const compiled: Record<string, PxCompiledAnimation> = isCompiledAnimation(entry as PxCompiledAnimation)
                ? { [prop]: entry as PxCompiledAnimation }
                : compileAnimationDefinition({ [prop]: entry } as PxAnimationDefinition, node?.transform, ctx);
            for (const [key, ch] of Object.entries(compiled)) {
                const kept = project(ch, node, key);
                if (kept) projected[key] = kept;
            }
        }
        out[name] = projected;
    }
    return { ...defs, animations: out };
}

// @px-importance important
/**
 * One step's document — see the top of the file. `doc` is the plain, rendered document; `claims` from
 * {@link attributeOwnersOf} on it (the clash rule). The step's timeline is its only one: a timeline's own step plays as
 * the timeline alone does (its delay, its rest pose); a written step plays its part with its own settings. No rules: the
 * flow wires them (`unitConfigOf`). @internal
 */
export function stepDocumentOf(doc: PxDocument, plan: PxUnitPlan, unitIndex: number, stepIndex: number, claims: ReadonlyArray<PxAttributeClaim>): PxDocument {
    const unit = plan.units[unitIndex];
    const planned = unit.steps[stepIndex];
    const t = plan.timelines[planned.timeline];
    const animator = animatorOf(doc);
    const base: Record<string, unknown> = isRecord(animator) ? { ...animator } : {};
    delete base.timelines; delete base.flowSteps; delete base.flows; delete base.actions;
    const goesOn = goesOnAtEnd(atEndActionOf(planned.id, getAnimatorConfig(doc)?.actions), stepIndex, unit.steps.length);
    base.timelines = [planned.implied ? asOnlyTimeline(t.timeline) : stepTimeline(t.timeline, planned.step, goesOn)];
    const owns = ownsOf(claims, unitIndex);
    const trackId = t.isDefault ? undefined : t.id;
    const promote = (ch: PxCompiledAnimation, node: PxNode | undefined, prop: string): PxCompiledAnimation | undefined =>
        owns(node, prop) ? timelineTrackOf(ch, trackId) : undefined;
    const tree = projectTree(doc as PxNode, promote);
    const definitions = projectDefinitions(doc, base, plan, promote);
    if (definitions) base.definitions = definitions;
    return { ...tree, animator: base } as PxDocument;
}

/** A step goes on at its end by `then` — unless a next / previous would pass an end of the flow (no `…OrWrap`, 1.30):
 *  then it stays, finished by its own `whenFinished`. */
function goesOnAtEnd(then: PxActionObject | undefined, stepIndex: number, count: number): boolean {
    if (then === undefined) return false;
    const move = flowStepMoveOf(then.action);
    return !move || flowStepIndexAfter(stepIndex, count, move) !== undefined;
}

const isLeaving = (v: unknown): v is PxWhenLeaving =>
    v === PxWhenLeaving.jump || v === PxWhenLeaving.animateToEnd || v === PxWhenLeaving.animateToStart;

/** A unit's steps as its flow switch reads them: where each goes at its end (the `finished` entries of `rules`, 1.29),
 *  how it is left, where the flow starts, whether it repeats for ever (its own `iterations`, else its timeline's). @internal */
export function switchStepsOf(unit: PxUnit, plan: PxUnitPlan, rules: ReadonlyArray<PxActionTriggerRule> = []): Array<PxFlowSwitchStep> {
    const ids = unit.steps.map(s => s.id);
    return unit.steps.map((planned): PxFlowSwitchStep => {
        const step = planned.implied ? undefined : planned.step;
        const wf = atEndActionOf(planned.id, rules);
        const move = wf && flowStepMoveOf(wf.action);
        const then: PxFlowSwitchStep['then'] = wf === undefined ? undefined
            : move ? (move.wrap ? { step: move.delta, wrap: true } : { step: move.delta })
            : wf.flowStep !== undefined && ids.includes(wf.flowStep) ? { flowStep: wf.flowStep } : undefined;
        const iterations = step?.iterations ?? plan.timelines[planned.timeline].timeline.iterations;
        return {
            id: planned.id,
            then,
            whenLeaving: isLeaving(step?.whenLeaving) ? step.whenLeaving : PxWhenLeaving.jump,
            initial: step?.initial === true,
            endless: iterations === 'infinite',
        };
    });
}

/** The names in the page's lists the file does not have (2026-11-22) — each ignored, with a warning. @internal */
export function unknownRunNames(doc: PxDocument, run: PxRunLists | undefined): Array<{ list: 'flows' | 'timelines'; name: string }> {
    if (!hasRunLists(run)) return [];
    const timelines = timelinesOf(doc);
    const animator = animatorOf(doc);
    const flows = new Set<string>([PX_DEFAULT_ID]);
    if (isRecord(animator)) {
        for (const f of Array.isArray(animator.flows) ? animator.flows : []) if (isRecord(f) && typeof f.id === 'string') flows.add(f.id);
        for (const s of Array.isArray(animator.flowSteps) ? animator.flowSteps : []) if (isRecord(s) && typeof s.flow === 'string') flows.add(s.flow);
    }
    const out: Array<{ list: 'flows' | 'timelines'; name: string }> = [];
    for (const name of run?.flows ?? []) if (!flows.has(name)) out.push({ list: 'flows', name });
    for (const name of run?.timelines ?? []) if (!timelines.some(t => t.name === name)) out.push({ list: 'timelines', name });
    return out;
}
