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

/** Converts to 1.8 — the trigger block these cases name was replaced by the 1.8 → 1.9 step. */
const STEPS_TO_1_8 = PX_WIRE_STEPS.slice(0, PX_WIRE_STEPS.findIndex(s => s.to === '1.9'));
const convertTo18 = (doc: unknown) => applyWireSteps(doc, { steps: STEPS_TO_1_8, target: { a: 1, b: 8, c: 0 }, readerReadsEditorPart: false });

describe('wire step 1.6 → 1.7 — the trigger words', () => {
    const doc16 = (trigger: Record<string, unknown>) =>
        ({ type: 'svg', animator: { version: '1.6.0', timeline: { outTime: 1000, trigger } }, children: [] });
    const OLD_HOVER = { start: 'mouseOver', mouseOut: 'reverse', offScreen: 'reset', visibilityThreshold: 0.2, visibilityDebounce: 80 };
    const NEW_HOVER = { start: 'hover', hoverEnd: 'reverse', outOfView: 'reset', inViewThreshold: 0.2, inViewDebounce: 80 };

    it('renames every trigger key and the hover start', () => {
        expect(triggerOf(convertTo18(doc16(OLD_HOVER)).doc)).toEqual(NEW_HOVER);
    });

    it("start 'none' becomes 'manual'; load and click stay", () => {
        expect(triggerOf(convertTo18(doc16({ start: 'none' })).doc)).toEqual({ start: 'manual' });
        expect(triggerOf(convertTo18(doc16({ start: 'click' })).doc)).toEqual({ start: 'click' });
    });

    it('goes back down exactly', () => {
        const at18 = convertTo18(doc16(OLD_HOVER)).doc;
        const down = applyWireStepsDown(at18, { steps: STEPS_TO_1_8, target: { a: 1, b: 6, c: 0 }, readerReadsEditorPart: false });
        expect(down.ok && triggerOf(down.doc)).toEqual(OLD_HOVER);
    });
});

describe('wire step 1.8 → 1.9 — WHEN in the trigger, HOW on the timeline (component-api plan D5)', () => {
    const doc18 = (timeline: Record<string, unknown>) =>
        ({ type: 'svg', animator: { version: '1.8.0', timeline: { outTime: 1000, ...timeline } }, children: [] });
    const up = (timeline: Record<string, unknown>) => timelineOf(convertWireDocument(doc18(timeline)).doc);

    it('hover: the leave action becomes the list it belongs to — pause → pauseStart, reset → playStop, reverse → playStop + rewind, continue → nothing', () => {
        expect(up({ trigger: { start: 'hover', hoverEnd: 'pause' } })).toEqual({ outTime: 1000, trigger: { playStart: 'hoverIn', pauseStart: 'hoverOut' } });
        expect(up({ trigger: { start: 'hover', hoverEnd: 'reset' } })).toEqual({ outTime: 1000, trigger: { playStart: 'hoverIn', playStop: 'hoverOut' } });
        expect(up({ trigger: { start: 'hover', hoverEnd: 'reverse' } }))
            .toEqual({ outTime: 1000, playStopAction: 'rewind', trigger: { playStart: 'hoverIn', playStop: 'hoverOut' } });
        expect(up({ trigger: { start: 'hover', hoverEnd: 'continue' } })).toEqual({ outTime: 1000, trigger: { playStart: 'hoverIn' } });
        // an omitted hoverEnd meant pause
        expect(up({ trigger: { start: 'hover' } })).toEqual({ outTime: 1000, trigger: { playStart: 'hoverIn', pauseStart: 'hoverOut' } });
    });

    it('click was a toggle: it plays AND pauses', () => {
        expect(up({ trigger: { start: 'click' } })).toEqual({ outTime: 1000, trigger: { playStart: 'click', pauseStart: 'click' } });
    });

    it("manual becomes the EMPTY block — nothing starts it; load and an absent start become playStart: 'load'", () => {
        expect(up({ trigger: { start: 'manual' } }).trigger).toEqual({});
        expect(up({ trigger: { start: 'load' } }).trigger).toEqual({ playStart: 'load' });
        expect(up({ trigger: { outOfView: 'continue' } })).toEqual({ outTime: 1000, outOfViewAction: 'continue', trigger: { playStart: 'load' } });
    });

    it('the gate keys move up to the timeline', () => {
        expect(up({ trigger: { start: 'load', outOfView: 'reset', inViewThreshold: 0.2, inViewDebounce: 80 } }))
            .toEqual({ outTime: 1000, outOfViewAction: 'reset', inViewThreshold: 0.2, inViewDebounce: 80, trigger: { playStart: 'load' } });
    });

    it('fillMode + finish become the end action and the first-frame flag', () => {
        expect(up({ fillMode: 'both' })).toEqual({ outTime: 1000, showFirstFrameBeforePlayStart: true });
        expect(up({ fillMode: 'backwards' })).toEqual({ outTime: 1000, showFirstFrameBeforePlayStart: true, playFinishAction: 'reset' });
        expect(up({ fillMode: 'none' })).toEqual({ outTime: 1000, playFinishAction: 'reset' });
        expect(up({ fillMode: 'forwards' })).toEqual({ outTime: 1000 });
        expect(up({ finish: 'reset' })).toEqual({ outTime: 1000, playFinishAction: 'reset' });
        expect(up({ finish: 'hold' })).toEqual({ outTime: 1000 });
        expect(up({ fillMode: 'both', finish: 'reset' })).toEqual({ outTime: 1000, showFirstFrameBeforePlayStart: true, playFinishAction: 'reset' });
    });

    it('direction becomes iterationDirection', () => {
        expect(up({ direction: 'alternate' })).toEqual({ outTime: 1000, iterationDirection: 'alternate' });
    });

    it('a timeline without the old keys is left alone, and so is a document without a timeline', () => {
        expect(up({ delay: 5 })).toEqual({ outTime: 1000, delay: 5 });
        const bare = { type: 'svg', animator: { version: '1.8.0' }, children: [] };
        expect(convertWireDocument(bare).doc).toMatchObject({ type: 'svg', children: [] });
    });

    it('never mutates the caller’s document', () => {
        const original = doc18({ fillMode: 'both', trigger: { start: 'hover', hoverEnd: 'reverse' } });
        convertWireDocument(original);
        expect(timelineOf(original)).toEqual({ outTime: 1000, fillMode: 'both', trigger: { start: 'hover', hoverEnd: 'reverse' } });
    });
});
