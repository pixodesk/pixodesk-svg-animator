// @px-area pipeline
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// ============================================================================
// UNITS (2026-11-20, kf app/docs/app-design/timelines-and-states.design.md) — a file with several timelines, as a
// player plays it: one UNIT per free timeline (no state uses it) and one per state machine. Each unit is a document
// with ONE timeline over the same picture — today's player plays it as it is; the units run side by side.
//
// | piece | what it does |
// |---|---|
// | `planUnits` | the units; `undefined` when the file is one unit of its first timeline (today's path) |
// | `unitDocumentOf` | a unit's one-timeline document: its tracks promoted to the plain keyframes — on the nodes and in the shared animations (`definitions.animations`, the pre-rendered path) — its states, its rules |
//
// A state machine whose states are on SEVERAL timelines gets them LAID END TO END into one timeline (a gap between
// them): each state's part moves with its timeline's offset, and an attribute with no track on a timeline holds the
// node's own value across that timeline's stretch — so the state clock seeks one engine, and "not showing → the
// node's own value" needs no engine to let go of anything.
//
// The rules — what goes where:
// | a rule | goes to |
// |---|---|
// | `timeline.*` with no `timeline` | every unit that a clock drives (the whole picture) |
// | `timeline.*` with a `timeline` | that timeline's unit |
// | `state.goTo` | the unit of the state's state machine |
// | `state.next` / `state.previous` | the unit of its `stateMachine` — none: the one without an id, else the first |
//
// The checks the plan makes (first wins; `timelineIssues` reports them, PX1116): a state on a timeline the file does
// not have, or on one another state machine uses, is not read; a state on a scroll timeline is not read; a timeline
// whose id an earlier one has is not read.
// ============================================================================

import { isCompiledAnimation, type PxActionTriggerRule, type PxAnimationDefinition, type PxCompiledAnimation, type PxDefinitions, type PxDocument, type PxNode, type PxState } from '../format/PxAnimatorTypes';
import { PxStateAction, PxWhenFinished, getAnimatorConfig, isPlaybackAction, resolveTimelineEngine } from '../format/PxAnimatorConstants';
import { firstTimelineIdOf, timelinesOf, timelineWindowsOf, trackedTimelineIds, type PxTimelineInfo } from './PxTimelineWindows';
import { animatorOf } from '../format/PxDocStage';
import { concatChannels, timelineTrackOf, type PxConcatRegion } from '../animation/PxRuntimeChannel';
import { compileAnimationDefinition, compileStaticChannel, type PxCompileContext } from '../animation/PxDefinitions';
import { staticTransformParts } from '../effects/shared/transformParts';

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** The ms between two timelines laid end to end — never shown; it keeps their keyframes apart. */
const GAP_MS = 1000;

/** The key the state machine without an id goes by inside the plan. */
const UNNAMED_STATE_MACHINE = '';

/** One unit: the timelines it plays (indexes into `timelines`), its state machine (`''` — the one without an id;
 *  absent — a free timeline), its states, and whether it holds the first timeline. @internal */
export interface PxUnit {
    readonly timelines: ReadonlyArray<number>;
    readonly stateMachine?: string;
    readonly states: ReadonlyArray<PxState>;
    readonly primary: boolean;
    readonly scroll: boolean;
}

/** The units of a document, and every timeline of it. @internal */
export interface PxUnitPlan {
    readonly units: ReadonlyArray<PxUnit>;
    readonly timelines: ReadonlyArray<PxTimelineInfo>;
}

/** The index of the timeline a state or a rule names — none: the first; an id the file lacks: -1. First id wins. */
function indexOfTimeline(timelines: ReadonlyArray<PxTimelineInfo>, ref: unknown): number {
    if (ref === undefined) return 0;
    const at = timelines.findIndex(t => t.id === ref);
    return at;
}

// @px-importance important
/**
 * The units of `doc` — `undefined` when the file plays as one unit of its first timeline (today's player, the doc as
 * it is): one timeline, or states on the first timeline only and no other timeline. See the top of the file. @internal
 */
export function planUnits(doc: PxDocument): PxUnitPlan | undefined {
    const timelines = timelinesOf(doc);
    if (timelines.length === 0) return undefined;
    const animator = animatorOf(doc);
    const rawStates = isRecord(animator) && Array.isArray(animator.states) ? animator.states : [];
    const machines = new Map<string, { timelines: Array<number>; states: Array<PxState> }>();
    const owner = new Map<number, string>();
    const seenIds = new Set<string>();
    for (const raw of rawStates) {
        if (!isRecord(raw) || typeof raw.id !== 'string' || seenIds.has(raw.id)) continue;
        const state = raw as PxState;
        seenIds.add(state.id);
        const at = indexOfTimeline(timelines, state.timeline);
        if (at < 0 || timelines[at].scroll) continue;                 // a timeline the file lacks, or a scroll one: not read
        const machine = typeof state.stateMachine === 'string' ? state.stateMachine : UNNAMED_STATE_MACHINE;
        const holder = owner.get(at);
        if (holder !== undefined && holder !== machine) continue;     // another state machine uses that timeline: first wins
        owner.set(at, machine);
        const entry = machines.get(machine) ?? { timelines: [], states: [] };
        if (!entry.timelines.includes(at)) entry.timelines.push(at);
        entry.states.push(state);
        machines.set(machine, entry);
    }
    const units: Array<PxUnit> = [];
    for (const [machine, entry] of machines) {
        units.push({ timelines: entry.timelines, stateMachine: machine, states: entry.states, primary: entry.timelines.includes(0), scroll: false });
    }
    const ridden = trackedTimelineIds(doc);
    for (const t of timelines) {
        if (owner.has(t.index)) continue;
        // a timeline whose id an earlier one has is not read — the first wins (PX1116 `idDuplicate`)
        const repeated = t.id !== undefined && timelines.some(o => o.index < t.index && o.id === t.id);
        // a free timeline nothing rides has nothing to play — no unit (the first keeps its own: it is the picture's clock)
        const empty = t.index !== 0 && (t.id === undefined || !ridden.has(t.id));
        if (!repeated && !empty) units.push({ timelines: [t.index], states: [], primary: t.index === 0, scroll: t.scroll });
    }
    units.sort((a, b) => Math.min(...a.timelines) - Math.min(...b.timelines));
    if (units.length === 1 && units[0].timelines.length === 1 && units[0].timelines[0] === 0) return undefined;
    return { units, timelines };
}

/** The rules a unit hears — see the table at the top of the file; `timeline` is dropped (the unit has one). */
function rulesForUnit(rules: ReadonlyArray<PxActionTriggerRule>, unit: PxUnit, plan: PxUnitPlan): Array<PxActionTriggerRule> {
    const stateIds = new Set(unit.states.map(st => st.id));
    const machineUnits = plan.units.filter(u => u.stateMachine !== undefined);
    const defaultMachine = machineUnits.find(u => u.stateMachine === UNNAMED_STATE_MACHINE) ?? machineUnits[0];
    const out: Array<PxActionTriggerRule> = [];
    for (const rule of rules) {
        let mine: boolean;
        if (isPlaybackAction(rule.action)) {
            mine = rule.timeline === undefined ? !unit.scroll : unit.timelines.includes(indexOfTimeline(plan.timelines, rule.timeline));
        } else if (rule.action === PxStateAction.goTo) {
            mine = rule.state !== undefined && stateIds.has(rule.state);
        } else {
            mine = rule.stateMachine !== undefined ? unit.stateMachine === rule.stateMachine : unit === defaultMachine;
        }
        if (!mine) continue;
        const { timeline: _timeline, ...rest } = rule;
        out.push(rest as PxActionTriggerRule);
    }
    return out;
}

/** A timeline record as a unit's only timeline — its id and label go (nothing refers to them inside the unit). */
function asOnlyTimeline(timeline: Record<string, unknown>): Record<string, unknown> {
    const { id: _id, name: _name, ...rest } = timeline;
    return rest;
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
 *  `project(entry, node, prop)`, `node` the element a binding plays it on (its own value is what is held), or none.
 *  `undefined` when there are none. */
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
    const first = plan.timelines[0];
    const ctx: PxCompileContext = {
        windowStart: first?.windowStart ?? 0, windowEnd: first?.windowEnd ?? 0, defs: defs as PxDefinitions,
        engine: resolveTimelineEngine(getAnimatorConfig(doc)?.engine), timelineWindows: timelineWindowsOf(doc), firstTimelineId: firstTimelineIdOf(doc),
    };
    const out: Record<string, unknown> = {};
    for (const [name, def] of Object.entries(animations)) {
        if (!isRecord(def)) { out[name] = def; continue; }
        const node = nodeOf(name);
        const projected: Record<string, unknown> = {};
        for (const [prop, entry] of Object.entries(def)) {
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

/** What a state takes from its own timeline when it says nothing (as `withStateEngine` bakes for one timeline). */
function stateWithItsTimeline(state: PxState, timeline: Record<string, unknown>): PxState {
    const out: PxState = { ...state };
    if (out.iterations === undefined && (typeof timeline.iterations === 'number' || timeline.iterations === 'infinite')) out.iterations = timeline.iterations;
    if (out.iterationDirection === undefined && typeof timeline.iterationDirection === 'string') out.iterationDirection = state.iterationDirection ?? (timeline.iterationDirection as PxState['iterationDirection']);
    if (out.playbackSpeed === undefined && typeof timeline.playbackSpeed === 'number') out.playbackSpeed = timeline.playbackSpeed;
    if (out.whenFinished === undefined && (timeline.whenFinished === PxWhenFinished.hold || timeline.whenFinished === PxWhenFinished.jumpToStart
        || timeline.whenFinished === PxWhenFinished.animateToStart)) out.whenFinished = timeline.whenFinished;
    return out;
}

/** The node's own value of `prop`, compiled — what is held where it has no track. The transform: its static parts. */
function heldValueOf(node: PxNode, prop: string): PxCompiledAnimation | undefined {
    const own = (node as Record<string, unknown>)[prop];
    if (prop === 'transform') return compileStaticChannel(prop, staticTransformParts(own) ?? {});
    return own === undefined ? undefined : compileStaticChannel(prop, own);
}

// @px-importance important
/** A unit's one-timeline document — see the top of the file. `doc` is the plain, rendered document. @internal */
export function unitDocumentOf(doc: PxDocument, unit: PxUnit, plan: PxUnitPlan): PxDocument {
    const animator = animatorOf(doc);
    const base: Record<string, unknown> = isRecord(animator) ? { ...animator } : {};
    delete base.timelines; delete base.states; delete base.stateMachines;
    const rules = Array.isArray(base.actionTriggers) ? rulesForUnit(base.actionTriggers as Array<PxActionTriggerRule>, unit, plan) : [];
    // no rule for this unit: no list (absent ≡ empty since 1.17 — and a scroll engine reads a list as triggers it ignores)
    if (rules.length) base.actionTriggers = rules; else delete base.actionTriggers;
    const parts = unit.timelines.map(i => plan.timelines[i]);
    const trackId = (t: PxTimelineInfo): string | undefined => (t.index === 0 ? undefined : t.id);

    if (parts.length === 1) {
        const only = parts[0];
        base.timelines = [asOnlyTimeline(only.timeline)];
        if (unit.states.length) base.states = unit.states.map(st => { const { timeline: _t, ...rest } = st; return rest; });
        const promote = (ch: PxCompiledAnimation): PxCompiledAnimation | undefined => timelineTrackOf(ch, trackId(only));
        const tree = projectTree(doc as PxNode, promote);
        const definitions = projectDefinitions(doc, base, plan, promote);
        if (definitions) base.definitions = definitions;
        return { ...tree, animator: base } as PxDocument;
    }

    // several timelines, one state machine: laid end to end
    let cursor = 0;
    const offsets = parts.map(p => { const at = cursor; cursor += (p.windowEnd - p.windowStart) + GAP_MS; return at; });
    const total = cursor - GAP_MS;
    const lead = asOnlyTimeline(parts[0].timeline);
    for (const key of ['inTime', 'outTime', 'iterations', 'iterationDirection', 'playbackSpeed', 'delay', 'whenFinished']) delete lead[key];
    lead.outTime = total;
    base.timelines = [lead];
    base.states = unit.states.map(st => {
        const j = unit.timelines.indexOf(indexOfTimeline(plan.timelines, st.timeline));
        const p = parts[j];
        const baked = stateWithItsTimeline(st, p.timeline);
        const { timeline: _t, ...rest } = baked;
        const inTime = (typeof st.inTime === 'number' ? st.inTime : p.windowStart) - p.windowStart + offsets[j];
        const outTime = (typeof st.outTime === 'number' ? st.outTime : p.windowEnd) - p.windowStart + offsets[j];
        return { ...rest, inTime, outTime };
    });
    const layOut = (ch: PxCompiledAnimation, node: PxNode | undefined, prop: string): PxCompiledAnimation | undefined => {
        const tracks = parts.map(p => timelineTrackOf(ch, trackId(p)));
        if (!tracks.some(Boolean)) return undefined;
        const hold = node ? heldValueOf(node, prop) : undefined;
        const regions: Array<PxConcatRegion> = parts.map((p, j) => ({
            track: tracks[j], hold, from: offsets[j], to: offsets[j] + (p.windowEnd - p.windowStart), shift: offsets[j] - p.windowStart,
        }));
        const template = tracks.find((t): t is PxCompiledAnimation => !!t);
        return template ? concatChannels(template, regions) : undefined;
    };
    const tree = projectTree(doc as PxNode, layOut);
    const definitions = projectDefinitions(doc, base, plan, layOut);
    if (definitions) base.definitions = definitions;
    return { ...tree, animator: base } as PxDocument;
}

/** The units' documents, in the plan's order. @internal */
export function unitDocumentsOf(doc: PxDocument, plan: PxUnitPlan): Array<PxDocument> {
    return plan.units.map(unit => unitDocumentOf(doc, unit, plan));
}
