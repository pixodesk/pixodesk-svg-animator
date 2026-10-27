/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// The 1.7 → 1.8 step: the three kebab-case values the format took from CSS become camelCase,
// like every other value it defines (first-use review §25).

import { describe, expect, it } from 'vitest';
import { applyWireSteps, applyWireStepsDown, PX_WIRE_STEPS } from './PxWireVersion';
import { isRecord } from '../schema/PxSchema';

const doc17 = (timeline: Record<string, unknown>) =>
    ({ type: 'svg', animator: { version: '1.7.0', timeline }, children: [] });

/** A converted document's raw `animator.timeline` — throws when there is none (a failed expectation). */
function timelineOf(doc: unknown): Record<string, unknown> {
    const animator = isRecord(doc) ? doc.animator : undefined;
    const timeline = isRecord(animator) ? animator.timeline : undefined;
    if (!isRecord(timeline)) throw new Error('no animator.timeline');
    return timeline;
}

/** Converts to 1.8 — `direction` was renamed again by the 1.8 → 1.9 step. */
const STEPS_TO_1_8 = PX_WIRE_STEPS.slice(0, PX_WIRE_STEPS.findIndex(s => s.to === '1.9'));
const convertTo18 = (doc: unknown) => applyWireSteps(doc, { steps: STEPS_TO_1_8, target: { a: 1, b: 8, c: 0 }, readerReadsEditorPart: false });

const OLD_VIEW = { type: 'view', range: { start: { phase: 'entry-crossing', fraction: 0.2 }, end: { phase: 'exit-crossing' } } };
const NEW_VIEW = { type: 'view', range: { start: { phase: 'entryCrossing', fraction: 0.2 }, end: { phase: 'exitCrossing' } } };

describe('wire step 1.7 → 1.8 — camelCase values', () => {

    it("direction 'alternate-reverse' becomes 'alternateReverse'; the one-word directions stay", () => {
        expect(timelineOf(convertTo18(doc17({ direction: 'alternate-reverse' })).doc).direction).toBe('alternateReverse');
        expect(timelineOf(convertTo18(doc17({ direction: 'alternate' })).doc).direction).toBe('alternate');
    });

    it('the crossing phases of a view range become camelCase; the other phases stay', () => {
        expect(timelineOf(convertTo18(doc17(OLD_VIEW)).doc)).toEqual(NEW_VIEW);
        expect(timelineOf(convertTo18(doc17({ type: 'view', range: { start: { phase: 'contain' } } })).doc))
            .toEqual({ type: 'view', range: { start: { phase: 'contain' } } });
    });

    it('goes back down exactly', () => {
        const at18 = convertTo18(doc17({ ...OLD_VIEW })).doc;
        const down = applyWireStepsDown(at18, { steps: STEPS_TO_1_8, target: { a: 1, b: 7, c: 0 }, readerReadsEditorPart: false });
        expect(down.ok && timelineOf(down.doc)).toEqual(OLD_VIEW);
        const dir18 = convertTo18(doc17({ direction: 'alternate-reverse' })).doc;
        const dirDown = applyWireStepsDown(dir18, { steps: STEPS_TO_1_8, target: { a: 1, b: 7, c: 0 }, readerReadsEditorPart: false });
        expect(dirDown.ok && timelineOf(dirDown.doc).direction).toBe('alternate-reverse');
    });
});
