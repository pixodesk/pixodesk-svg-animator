// @px-area control
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// ============================================================================
// SHOW (1.33; `showIn` 1.31) — `effects.show: { when: { flowSteps } }`: an element shown only while one of its flow steps
// is current; hidden (`display: none`) otherwise, at once. One plain rule for every platform (the names here keep the
// 1.31 word — they are the player's own):
//
// | piece | what it does |
// |---|---|
// | `showInTargetsOf` | the elements that say it: the tree's nodes (the lowering keeps the effect), a pre-rendered file's bindings |
// | `currentFlowStepsOf` | the steps current now: a running flow's own, every other flow's start step |
// | `isShownIn` | shown while ANY listed step is current, in any flow; an empty list says nothing: shown always |
// | `flowNameOfUnit` | what a unit is called — its flow's id, or the name of the timeline the page runs by name |
//
// A step id the file lacks is never current (`validateDocument` warns).
//
// `showOneChild` (1.33; `showOneOf` 1.32) lives here too — a group shows one of its children (`showOneOfTargetsOf`,
// `shownOptionOf`). The two HIDE THE SAME WAY (`display: none` on the element itself); change both together.
// ============================================================================

import type { PxDocument, PxNode } from '../format/PxAnimatorTypes';
import { getBindings } from '../format/PxAnimatorConstants';
import type { PxUnit, PxUnitPlan } from './PxUnits';

/** One element shown only in some steps — its id (bare, as rendered) and the steps. @internal */
export interface PxShowInTarget {
    readonly id: string;
    readonly flowSteps: ReadonlyArray<string>;
}

/** Every element of `doc` that says `effects.show`: the tree's nodes with an id, then the bindings (a pre-rendered file
 *  has no nodes). @internal */
export function showInTargetsOf(doc: PxDocument): Array<PxShowInTarget> {
    const out: Array<PxShowInTarget> = [];
    const walk = (node: PxNode): void => {
        const show = node.effects?.show;
        if (show && typeof node.id === 'string') out.push({ id: node.id, flowSteps: show.when.flowSteps });
        if (Array.isArray(node.children)) node.children.forEach(walk);
    };
    walk(doc);
    for (const binding of getBindings(doc) ?? []) {
        if (!binding.show) continue;
        const id = binding.element.startsWith('#') ? binding.element.slice(1) : binding.element;
        out.push({ id, flowSteps: binding.show.when.flowSteps });
    }
    return out;
}

/** One group that shows one of its children: `which` — its `when.index`: a number, or (a pre-rendered binding) binding text; `options` —
 *  the children's bare ids, in order; none (a binding that lists none) — the children of `group` as rendered. @internal */
export interface PxShowOneOfTarget {
    readonly which: number | string | undefined;
    readonly options?: ReadonlyArray<string>;
    /** The group's bare id — a pre-rendered binding's element. */
    readonly group?: string;
}

const bareId = (ref: string): string => ref.startsWith('#') ? ref.slice(1) : ref;

/** Every group of `doc` that says `effects.showOneChild` with its options listed (the lowering lists them), then the bindings. @internal */
export function showOneOfTargetsOf(doc: PxDocument): Array<PxShowOneOfTarget> {
    const out: Array<PxShowOneOfTarget> = [];
    const walk = (node: PxNode): void => {
        const fx = node.effects?.showOneChild;
        if (fx?.options) out.push({ which: fx.when?.index, options: fx.options.map(o => bareId(o.element)) });
        if (Array.isArray(node.children)) node.children.forEach(walk);
    };
    walk(doc);
    for (const binding of getBindings(doc) ?? []) {
        const fx = binding.showOneChild;
        if (fx) out.push(fx.options ? { which: fx.when?.index, options: fx.options.map(o => bareId(o.element)) } : { which: fx.when?.index, group: bareId(binding.element) });
    }
    return out;
}

/** The option shown: `which` rounded down, if it is a position among `count`; none otherwise (no default here — an absent
 *  `which` was read as `0` by then). @internal */
export function shownOptionOf(which: number | undefined, count: number): number | undefined {
    if (which === undefined || !Number.isFinite(which)) return undefined;
    const at = Math.floor(which);
    return at >= 0 && at < count ? at : undefined;
}

/** The rule: shown while any listed step is current; an empty list — always. @internal */
export function isShownIn(flowSteps: ReadonlyArray<string>, current: ReadonlySet<string>): boolean {
    return flowSteps.length === 0 || flowSteps.some(id => current.has(id));
}

/** What a unit is called — its flow's id (`default` for the flow `default`), or the name of the timeline the page runs
 *  by name. @internal */
export function flowNameOfUnit(plan: PxUnitPlan, unit: PxUnit): string {
    return unit.flow ?? plan.timelines[unit.steps[0].timeline].name;
}

/** Where a unit starts: the step its flow's `initialFlowStep` names, else the first. */
function startStepOf(unit: PxUnit): string {
    return (unit.steps.find(s => s.initial) ?? unit.steps[0]).id;
}

/** The steps current now — each unit of `all` (every flow of the file) at `current`'s step for it (by
 *  {@link flowNameOfUnit}), else at its start: a flow the page does not run stays there. @internal */
export function currentFlowStepsOf(all: PxUnitPlan, current: ReadonlyMap<string, string>): Set<string> {
    const out = new Set<string>();
    for (const unit of all.units) {
        if (!unit.steps.length) continue;
        out.add(current.get(flowNameOfUnit(all, unit)) ?? startStepOf(unit));
    }
    return out;
}
