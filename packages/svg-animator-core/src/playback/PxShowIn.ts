// @px-area control
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// ============================================================================
// SHOW IN (1.31) — `effects.showIn`: an element shown only while one of its flow steps is current; hidden
// (`display: none`) otherwise, at once. One plain rule for every platform:
//
// | piece | what it does |
// |---|---|
// | `showInTargetsOf` | the elements that say it: the tree's nodes (the lowering keeps the effect), a pre-rendered file's bindings |
// | `currentFlowStepsOf` | the steps current now: a running flow's own, every other flow's start step |
// | `isShownIn` | shown while ANY listed step is current, in any flow; an empty list says nothing: shown always |
// | `flowNameOfUnit` | what a unit is called — its flow's id, or the name of the timeline the page runs by name |
//
// A step id the file lacks is never current (`validateDocument` warns).
// ============================================================================

import type { PxDocument, PxNode } from '../format/PxAnimatorTypes';
import { getBindings } from '../format/PxAnimatorConstants';
import type { PxUnit, PxUnitPlan } from './PxUnits';

/** One element shown only in some steps — its id (bare, as rendered) and the steps. @internal */
export interface PxShowInTarget {
    readonly id: string;
    readonly flowSteps: ReadonlyArray<string>;
}

/** Every element of `doc` that says `showIn`: the tree's nodes with an id, then the bindings (a pre-rendered file has
 *  no nodes). @internal */
export function showInTargetsOf(doc: PxDocument): Array<PxShowInTarget> {
    const out: Array<PxShowInTarget> = [];
    const walk = (node: PxNode): void => {
        const showIn = node.effects?.showIn;
        if (showIn && typeof node.id === 'string') out.push({ id: node.id, flowSteps: showIn.flowSteps });
        if (Array.isArray(node.children)) node.children.forEach(walk);
    };
    walk(doc);
    for (const binding of getBindings(doc) ?? []) {
        if (!binding.showIn) continue;
        const id = binding.element.startsWith('#') ? binding.element.slice(1) : binding.element;
        out.push({ id, flowSteps: binding.showIn.flowSteps });
    }
    return out;
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

/** Where a unit starts: the step marked `initial`, else the first. */
function startStepOf(unit: PxUnit): string {
    return (unit.steps.find(s => !s.implied && s.step.initial === true) ?? unit.steps[0]).id;
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
