/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// The 1.1 → 1.2 step: the trigger block became two axes. `outAction` meant three different things
// depending on `startOn`, so this is the one rename that cannot be done key by key — each case
// below is a row of the table in `PX_WIRE_STEPS`.

import { describe, expect, it } from 'vitest';
import { convertWireDocument } from './PxWireVersion';

/** A 1.1 document carrying `trigger`, stamped so the step is due. */
function doc11(trigger: Record<string, unknown>): Record<string, unknown> {
    return {
        type: 'svg',
        animator: { version: '1.1.1', timeline: { duration: 1000, trigger } },
        children: [],
    };
}

const triggerOf = (converted: unknown): Record<string, unknown> =>
    ((converted as any).animator.timeline.trigger) as Record<string, unknown>;

describe('wire step 1.1 → 1.2 — the trigger block', () => {

    it("scrollIntoView becomes the DEFAULT gate: no `start` at all, and outAction becomes offScreen", () => {
        const out = convertWireDocument(doc11({ startOn: 'scrollIntoView', outAction: 'pause' }));
        expect(triggerOf(out.doc)).toEqual({ offScreen: 'pause' });
    });

    it('a hover document keeps its out action, under the name that says when it applies', () => {
        const out = convertWireDocument(doc11({ startOn: 'mouseOver', outAction: 'reverse' }));
        // `offScreen: 'continue'` is written explicitly: 1.1 had no gate, so saying nothing would
        // silently change what the document does.
        expect(triggerOf(out.doc)).toEqual({ start: 'mouseOver', mouseOut: 'reverse', offScreen: 'continue' });
    });

    it('a click document drops the action — it was never read for click', () => {
        const out = convertWireDocument(doc11({ startOn: 'click', outAction: 'reset' }));
        expect(triggerOf(out.doc)).toEqual({ start: 'click', offScreen: 'continue' });
    });

    it("programmatic becomes none", () => {
        const out = convertWireDocument(doc11({ startOn: 'programmatic' }));
        expect(triggerOf(out.doc)).toEqual({ start: 'none', offScreen: 'continue' });
    });

    it('a load document keeps playing regardless of visibility, as 1.1 meant', () => {
        const out = convertWireDocument(doc11({ startOn: 'load' }));
        expect(triggerOf(out.doc)).toEqual({ start: 'load', offScreen: 'continue' });
    });

    it('the threshold is carried over, including an explicit 0 that is no longer the default', () => {
        const out = convertWireDocument(doc11({ startOn: 'scrollIntoView', scrollIntoViewThreshold: 0 }));
        expect(triggerOf(out.doc)).toEqual({ visibilityThreshold: 0 });
    });

    it('finishAction becomes finish', () => {
        const out = convertWireDocument(doc11({ startOn: 'load', finishAction: 'reset' }));
        expect(triggerOf(out.doc)).toMatchObject({ finish: 'reset' });
        expect(triggerOf(out.doc)).not.toHaveProperty('finishAction');
    });

    it('never mutates the caller’s document', () => {
        const original = doc11({ startOn: 'scrollIntoView', outAction: 'pause' });
        convertWireDocument(original);
        expect((original as any).animator.timeline.trigger).toEqual({ startOn: 'scrollIntoView', outAction: 'pause' });
    });

    it('a document with no trigger is left alone', () => {
        const input = { type: 'svg', animator: { version: '1.1.1', timeline: { duration: 1000 } }, children: [] };
        const out = convertWireDocument(input);
        expect((out.doc as any).animator.timeline).toEqual({ duration: 1000 });
    });
});
