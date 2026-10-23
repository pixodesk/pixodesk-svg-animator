/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// The 1.1 → 1.2 step: the trigger block became two axes. `outAction` meant three different things
// depending on `startOn`, so this is the one rename that cannot be done key by key — each case
// below is a row of the table in `PX_WIRE_STEPS`.

import { describe, expect, it } from 'vitest';
import { applyWireSteps, applyWireStepsDown, convertWireDocument, PX_WIRE_STEPS } from './PxWireVersion';
import { isRecord } from '../schema/PxSchema';

/** A 1.1 document carrying `trigger`, stamped so the step is due. */
function doc11(trigger: Record<string, unknown>): Record<string, unknown> {
    return {
        type: 'svg',
        animator: { version: '1.1.1', timeline: { duration: 1000, trigger } },
        children: [],
    };
}

/** A document's raw `animator.timeline` record — throws when there is none (a failed expectation). */
function timelineOf(doc: unknown): Record<string, unknown> {
    const animator = isRecord(doc) ? doc.animator : undefined;
    const timeline = isRecord(animator) ? animator.timeline : undefined;
    if (!isRecord(timeline)) throw new Error('no animator.timeline');
    return timeline;
}

const triggerOf = (converted: unknown): unknown => timelineOf(converted).trigger;

/** Converts to 1.6 — the words these cases name were renamed again by the 1.6 → 1.7 step. */
const STEPS_TO_1_6 = PX_WIRE_STEPS.slice(0, PX_WIRE_STEPS.findIndex(s => s.to === '1.7'));
const convertTo16 = (doc: unknown) => applyWireSteps(doc, { steps: STEPS_TO_1_6, target: { a: 1, b: 6, c: 0 }, readerReadsEditorPart: false });

describe('wire step 1.1 → 1.2 — the trigger block', () => {

    it("scrollIntoView becomes the DEFAULT gate: no `start` at all, and outAction becomes offScreen", () => {
        const out = convertTo16(doc11({ startOn: 'scrollIntoView', outAction: 'pause' }));
        expect(triggerOf(out.doc)).toEqual({ offScreen: 'pause' });
    });

    it('a hover document keeps its out action, under the name that says when it applies', () => {
        const out = convertTo16(doc11({ startOn: 'mouseOver', outAction: 'reverse' }));
        // `offScreen: 'continue'` is written explicitly: 1.1 had no gate, so saying nothing would
        // silently change what the document does.
        expect(triggerOf(out.doc)).toEqual({ start: 'mouseOver', mouseOut: 'reverse', offScreen: 'continue' });
    });

    it('a click document drops the action — it was never read for click', () => {
        const out = convertTo16(doc11({ startOn: 'click', outAction: 'reset' }));
        expect(triggerOf(out.doc)).toEqual({ start: 'click', offScreen: 'continue' });
    });

    it("programmatic becomes none", () => {
        const out = convertTo16(doc11({ startOn: 'programmatic' }));
        expect(triggerOf(out.doc)).toEqual({ start: 'none', offScreen: 'continue' });
    });

    it('a load document keeps playing regardless of visibility, as 1.1 meant', () => {
        const out = convertTo16(doc11({ startOn: 'load' }));
        expect(triggerOf(out.doc)).toEqual({ start: 'load', offScreen: 'continue' });
    });

    it('the threshold is carried over, including an explicit 0 that is no longer the default', () => {
        const out = convertTo16(doc11({ startOn: 'scrollIntoView', scrollIntoViewThreshold: 0 }));
        expect(triggerOf(out.doc)).toEqual({ visibilityThreshold: 0 });
    });

    it('finishAction becomes finish — and the 1.4 step then moves it next to fillMode (§13)', () => {
        const out = convertTo16(doc11({ startOn: 'load', finishAction: 'reset' }));
        expect(timelineOf(out.doc).finish).toBe('reset');
        const trigger = triggerOf(out.doc);
        if (trigger !== undefined) {
            expect(trigger).not.toHaveProperty('finish');
            expect(trigger).not.toHaveProperty('finishAction');
        }
    });

    it('never mutates the caller’s document', () => {
        const original = doc11({ startOn: 'scrollIntoView', outAction: 'pause' });
        convertTo16(original);
        expect(timelineOf(original).trigger).toEqual({ startOn: 'scrollIntoView', outAction: 'pause' });
    });

    it('a document with no trigger is left alone', () => {
        const input = { type: 'svg', animator: { version: '1.1.1', timeline: { duration: 1000 } }, children: [] };
        const out = convertTo16(input);
        expect(timelineOf(out.doc)).toEqual({ outTime: 1000 });   // the 1.2 → 1.3 step renames the length
    });
});

describe('wire step 1.6 → 1.7 — the trigger words', () => {
    const doc16 = (trigger: Record<string, unknown>) =>
        ({ type: 'svg', animator: { version: '1.6.0', timeline: { outTime: 1000, trigger } }, children: [] });
    const OLD_HOVER = { start: 'mouseOver', mouseOut: 'reverse', offScreen: 'reset', visibilityThreshold: 0.2, visibilityDebounce: 80 };
    const NEW_HOVER = { start: 'hover', hoverEnd: 'reverse', outOfView: 'reset', inViewThreshold: 0.2, inViewDebounce: 80 };

    it('renames every trigger key and the hover start', () => {
        expect(triggerOf(convertWireDocument(doc16(OLD_HOVER)).doc)).toEqual(NEW_HOVER);
    });

    it("start 'none' becomes 'manual'; load and click stay", () => {
        expect(triggerOf(convertWireDocument(doc16({ start: 'none' })).doc)).toEqual({ start: 'manual' });
        expect(triggerOf(convertWireDocument(doc16({ start: 'click' })).doc)).toEqual({ start: 'click' });
    });

    it('goes back down exactly', () => {
        const at17 = convertWireDocument(doc16(OLD_HOVER)).doc;
        const down = applyWireStepsDown(at17, { steps: PX_WIRE_STEPS, target: { a: 1, b: 6, c: 0 }, readerReadsEditorPart: false });
        expect(down.ok && triggerOf(down.doc)).toEqual(OLD_HOVER);
    });
});
