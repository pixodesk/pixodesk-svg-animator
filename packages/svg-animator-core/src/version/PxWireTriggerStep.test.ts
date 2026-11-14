/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// The 1.1 → 1.2 step: the trigger block became two axes. `outAction` meant three different things
// depending on `startOn`, so this is the one rename that cannot be done key by key — each case
// below is a row of the table in `PX_WIRE_STEPS`.

import { describe, expect, it } from 'vitest';
import { applyWireSteps, applyWireStepsDown, convertWireDocument, PX_WIRE_STEPS } from './PxWireVersion';
import { PX_WIRE_SCHEMA_VERSION } from './PxSchemaVersion';
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

/** Converts to 1.25 — the steps the next two blocks test, before 1.26 rewrote their words again (1.26 has no `down`). */
const STEPS_TO_1_25 = PX_WIRE_STEPS.slice(0, PX_WIRE_STEPS.findIndex(s => s.to === '1.26'));
const convertTo125 = (doc: unknown) => applyWireSteps(doc, { steps: STEPS_TO_1_25, target: { a: 1, b: 25, c: 0 }, readerReadsEditorPart: false });

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

/** Converts to 1.9 — the spelling these cases name was renamed again by the 1.9 → 1.10 step. */
const STEPS_TO_1_9 = PX_WIRE_STEPS.slice(0, PX_WIRE_STEPS.findIndex(s => s.to === '1.10'));
const convertTo19 = (doc: unknown) => applyWireSteps(doc, { steps: STEPS_TO_1_9, target: { a: 1, b: 9, c: 0 }, readerReadsEditorPart: false });

describe('wire step 1.8 → 1.9 — WHEN in the trigger, HOW on the timeline (component-api plan D5)', () => {
    const doc18 = (timeline: Record<string, unknown>) =>
        ({ type: 'svg', animator: { version: '1.8.0', timeline: { outTime: 1000, ...timeline } }, children: [] });
    const up = (timeline: Record<string, unknown>) => timelineOf(convertTo19(doc18(timeline)).doc);

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
        expect(convertTo19(bare).doc).toMatchObject({ type: 'svg', children: [] });
    });

    it('never mutates the caller’s document', () => {
        const original = doc18({ fillMode: 'both', trigger: { start: 'hover', hoverEnd: 'reverse' } });
        convertTo19(original);
        expect(timelineOf(original)).toEqual({ outTime: 1000, fillMode: 'both', trigger: { start: 'hover', hoverEnd: 'reverse' } });
    });
});

/** Converts to 1.11 — the 1.12+ steps rename again what these cases name. */
const STEPS_TO_1_11 = PX_WIRE_STEPS.slice(0, PX_WIRE_STEPS.findIndex(s => s.to === '1.12'));
const convertTo111 = (doc: unknown) => applyWireSteps(doc, { steps: STEPS_TO_1_11, target: { a: 1, b: 11, c: 0 }, readerReadsEditorPart: false });
/** Every step from `from` on, by its `to` — what a document stamped `from` goes through to reach the current version. */
// the steps that convert — an additive step (1.27, variables) has no `up` and is not listed as applied
const stepsFrom = (from: string): Array<string> => PX_WIRE_STEPS.slice(PX_WIRE_STEPS.findIndex(s => s.from === from)).filter(s => s.up).map(s => s.to);

describe('wire step 1.9 → 1.10 — triggers and actions (playback-layers.md, layers 0–1); read through 1.11', () => {
    const doc19 = (timeline: Record<string, unknown>) =>
        ({ type: 'svg', animator: { version: '1.9.0', timeline: { outTime: 1000, ...timeline } }, children: [] });
    const up = (timeline: Record<string, unknown>) => timelineOf(convertTo111(doc19(timeline)).doc);

    it('the trigger lists become triggers — playStart → start, playStop → stop, pauseStart → pause, pauseStop → resume', () => {
        expect(up({ trigger: { playStart: ['hoverIn', 'click'], playStop: 'hoverOut', pauseStart: 'click', pauseStop: [] } }))
            .toEqual({ outTime: 1000, actionTriggers: { start: ['hoverIn', 'click'], stop: 'hoverOut', pause: 'click', resume: [] } });
        // the empty block stays empty — nothing starts it
        expect(up({ trigger: {} })).toEqual({ outTime: 1000, actionTriggers: {} });
    });

    it('the play keys become the actions block; resume → continue, jumpToEnd → jumpToFinished (the 1.10 word; 1.18 turns it back)', () => {
        expect(up({ playStartAction: 'resume', playStopAction: 'rewind', completeIterationOnPlayStop: true, playFinishAction: 'reset', outOfViewAction: 'continue' }))
            .toEqual({ outTime: 1000, actions: {
                start: 'continue', stop: { do: 'rewind', completeIteration: true },
                finish: 'reset', suspend: 'continue',
            } });
        expect(up({ playStartAction: 'jumpToEnd' })).toEqual({ outTime: 1000, actions: { start: 'jumpToFinished' } });
        expect(up({ playStartAction: 'restart' })).toEqual({ outTime: 1000, actions: { start: 'restart' } });
    });

    it('the first-frame flag becomes beforeStart: firstFrame; false is the default and is dropped', () => {
        expect(up({ showFirstFrameBeforePlayStart: true })).toEqual({ outTime: 1000, beforeStart: 'firstFrame' });
        expect(up({ showFirstFrameBeforePlayStart: false })).toEqual({ outTime: 1000 });
    });

    it('a timeline without the old keys is left alone; the converted document is current', () => {
        expect(up({ delay: 5, inViewThreshold: 0.2 })).toEqual({ outTime: 1000, delay: 5, inViewThreshold: 0.2 });
        expect(convertWireDocument(doc19({ trigger: { playStart: 'click' } })).applied.map(s => s.to)).toEqual(stepsFrom('1.9'));
    });
});

describe('wire step 1.10 → 1.11 — actionTriggers, and `do` written as the word when alone (react-props-review.md)', () => {
    const doc110 = (timeline: Record<string, unknown>) =>
        ({ type: 'svg', animator: { version: '1.10.0', timeline: { outTime: 1000, ...timeline } }, children: [] });
    const up = (timeline: Record<string, unknown>) => timelineOf(convertTo111(doc110(timeline)).doc);

    it('triggers → actionTriggers, the lists untouched', () => {
        expect(up({ triggers: { start: ['hoverIn', 'click'], stop: 'hoverOut', togglePlay: 'click' } }))
            .toEqual({ outTime: 1000, actionTriggers: { start: ['hoverIn', 'click'], stop: 'hoverOut', togglePlay: 'click' } });
        expect(up({ triggers: {} })).toEqual({ outTime: 1000, actionTriggers: {} });
    });

    it('transition → do; a slot that says only `do` becomes the word, a flagged one stays an object', () => {
        expect(up({ actions: { start: { transition: 'restart' }, stop: { transition: 'rewind', completeIteration: true }, finish: { transition: 'hold' } } }))
            .toEqual({ outTime: 1000, actions: { start: 'restart', stop: { do: 'rewind', completeIteration: true }, finish: 'hold' } });
        expect(up({ actions: { stop: { completeIteration: true } } })).toEqual({ outTime: 1000, actions: { stop: { completeIteration: true } } });
    });

    it('a 1.11 document goes through the later steps only', () => {
        const doc = { type: 'svg', animator: { version: '1.11.0', timeline: { outTime: 1000, actionTriggers: { start: 'load' }, actions: { stop: 'rewind' } } }, children: [] };
        expect(convertWireDocument(doc).applied.map(s => s.to)).toEqual(stepsFrom('1.11'));
    });
});

describe('wire step 1.11 → 1.12 — `togglePlay` folded into `start` and `stop` (schema-and-props-review-fix-plan.md §2.3)', () => {
    const STEPS_TO_1_12 = PX_WIRE_STEPS.slice(0, PX_WIRE_STEPS.findIndex(s => s.to === '1.12') + 1);
    const doc111 = (triggers: Record<string, unknown>) =>
        ({ type: 'svg', animator: { version: '1.11.0', timeline: { outTime: 1000, actionTriggers: triggers } }, children: [] });
    const up = (triggers: Record<string, unknown>) =>
        timelineOf(applyWireSteps(doc111(triggers), { steps: STEPS_TO_1_12, target: { a: 1, b: 12, c: 0 }, readerReadsEditorPart: false }).doc).actionTriggers;

    it('alone, togglePlay becomes click under start and stop — one event is written as the word', () => {
        expect(up({ togglePlay: 'click' })).toEqual({ start: 'click', stop: 'click' });
    });

    it('merged into existing lists without doubling an event; a list that gains a second event becomes an array', () => {
        expect(up({ start: ['hoverIn', 'click'], stop: 'hoverOut', togglePlay: 'click' })).toEqual({ start: ['hoverIn', 'click'], stop: ['hoverOut', 'click'] });
        expect(up({ start: 'click', togglePlay: ['click'] })).toEqual({ start: 'click', stop: 'click' });
    });

    it('an empty togglePlay list only disappears; a block without it is untouched', () => {
        expect(up({ togglePlay: [], pause: 'click' })).toEqual({ pause: 'click' });
        expect(up({ start: 'load' })).toEqual({ start: 'load' });
    });

});

describe('wire step 1.12 → 1.13 — `actions.suspend` → `actions.outOfView` (schema-and-props-review-fix-plan.md §2.4)', () => {
    const STEPS_TO_1_13 = PX_WIRE_STEPS.slice(0, PX_WIRE_STEPS.findIndex(s => s.to === '1.13') + 1);
    const doc112 = (actions: Record<string, unknown>) =>
        ({ type: 'svg', animator: { version: '1.12.0', timeline: { outTime: 1000, actions } }, children: [] });
    const up = (actions: Record<string, unknown>) =>
        timelineOf(applyWireSteps(doc112(actions), { steps: STEPS_TO_1_13, target: { a: 1, b: 13, c: 0 }, readerReadsEditorPart: false }).doc).actions;

    it('the key is renamed, the slot kept as written — the word form and the settings form alike', () => {
        expect(up({ suspend: 'continue', stop: 'rewind' })).toEqual({ outOfView: 'continue', stop: 'rewind' });
        expect(up({ suspend: { do: 'reset' } })).toEqual({ outOfView: { do: 'reset' } });
        expect(up({ stop: 'rewind' })).toEqual({ stop: 'rewind' });
    });

    it('down-converts exactly — a key rename', () => {
        const current = { type: 'svg', animator: { version: '1.13.0', timeline: { outTime: 1000, actions: { outOfView: 'reset' } } }, children: [] };
        const down = applyWireStepsDown(current, { steps: PX_WIRE_STEPS, target: { a: 1, b: 12, c: 0 }, readerReadsEditorPart: false });
        if (!down.ok) throw new Error(down.reason);
        expect(timelineOf(down.doc).actions).toEqual({ suspend: 'reset' });
    });

});

describe('wire step 1.13 → 1.14 — an action\'s `do` → `behavior` (schema-and-props-review-fix-plan.md §2.6)', () => {
    const STEPS_TO_1_14 = PX_WIRE_STEPS.slice(0, PX_WIRE_STEPS.findIndex(s => s.to === '1.14') + 1);
    const doc113 = (actions: Record<string, unknown>) =>
        ({ type: 'svg', animator: { version: '1.13.0', timeline: { outTime: 1000, actions } }, children: [] });
    const up = (actions: Record<string, unknown>) =>
        timelineOf(applyWireSteps(doc113(actions), { steps: STEPS_TO_1_14, target: { a: 1, b: 14, c: 0 }, readerReadsEditorPart: false }).doc).actions;

    it('every settings-form slot is renamed; the word form and a slot without `do` are untouched', () => {
        expect(up({ start: { do: 'restart' }, stop: { do: 'rewind', completeIteration: true }, finish: 'hold', outOfView: { do: 'reset' } }))
            .toEqual({ start: { behavior: 'restart' }, stop: { behavior: 'rewind', completeIteration: true }, finish: 'hold', outOfView: { behavior: 'reset' } });
        expect(up({ stop: { completeIteration: true } })).toEqual({ stop: { completeIteration: true } });
    });

    it('down-converts exactly', () => {
        const current = { type: 'svg', animator: { version: '1.14.0', timeline: { outTime: 1000, actions: { stop: { behavior: 'rewind', completeIteration: true } } } }, children: [] };
        const down = applyWireStepsDown(current, { steps: PX_WIRE_STEPS, target: { a: 1, b: 13, c: 0 }, readerReadsEditorPart: false });
        if (!down.ok) throw new Error(down.reason);
        expect(timelineOf(down.doc).actions).toEqual({ stop: { do: 'rewind', completeIteration: true } });
    });

});

describe('wire step 1.14 → 1.15 — `timeline.beforeStart` → `showWhenStopped` (schema-and-props-review-fix-plan.md §3.1)', () => {
    const STEPS_TO_1_15 = PX_WIRE_STEPS.slice(0, PX_WIRE_STEPS.findIndex(s => s.to === '1.15') + 1);
    const doc114 = (timeline: Record<string, unknown>) =>
        ({ type: 'svg', animator: { version: '1.14.0', timeline: { outTime: 1000, ...timeline } }, children: [] });
    const up = (timeline: Record<string, unknown>) =>
        timelineOf(applyWireSteps(doc114(timeline), { steps: STEPS_TO_1_15, target: { a: 1, b: 15, c: 0 }, readerReadsEditorPart: false }).doc);

    it('the key is renamed, the value kept; a timeline without it is untouched', () => {
        expect(up({ beforeStart: 'firstFrame' })).toEqual({ outTime: 1000, showWhenStopped: 'firstFrame' });
        expect(up({ delay: 5 })).toEqual({ outTime: 1000, delay: 5 });
    });

    it('down-converts exactly', () => {
        const current = { type: 'svg', animator: { version: '1.15.0', timeline: { outTime: 1000, showWhenStopped: 'static' } }, children: [] };
        const down = applyWireStepsDown(current, { steps: PX_WIRE_STEPS, target: { a: 1, b: 14, c: 0 }, readerReadsEditorPart: false });
        if (!down.ok) throw new Error(down.reason);
        expect(timelineOf(down.doc)).toEqual({ outTime: 1000, beforeStart: 'static' });
    });

    it('a 1.9 document converts through every step to the current version: the whole chain in one read', () => {
        const old = { type: 'svg', animator: { version: '1.9.0', timeline: { outTime: 1000, trigger: { playStart: 'click', playStop: 'click' }, playStopAction: 'rewind', outOfViewAction: 'reset', showFirstFrameBeforePlayStart: true } }, children: [] };
        expect(timelineOf(convertWireDocument(old).doc)).toEqual({
            // 1.26: the old default start carried on — a click is now `playback.play`; `jumpToStart` out of view is `stop`
            outTime: 1000, actionTriggers: { 'playback.play': 'click', 'playback.stop': 'click' }, actions: { 'playback.stop': 'animateToStart', outOfView: 'stop' }, whenIdle: 'firstFrame',
        });
    });

    it('a current document is left alone', () => {
        const current = { type: 'svg', animator: { version: PX_WIRE_SCHEMA_VERSION + '.0', timeline: { outTime: 1000, actionTriggers: { 'playback.start': 'load' } } }, children: [] };
        expect(convertWireDocument(current).applied).toEqual([]);
    });
});

describe('wire steps 1.21 → 1.22 → 1.23 → 1.24 — `playbackSpeed`, the action words jump / animate to the start or the end, the run model (schema-and-props--improvements.md §0, animation-state.brainstorm.md §0)', () => {
    const at = (version: string, timeline: Record<string, unknown>) => ({ type: 'svg', animator: { version, timeline: { outTime: 1000, ...timeline } }, children: [] });
    const down = (doc: unknown, b: number) => {
        const result = applyWireStepsDown(doc, { steps: PX_WIRE_STEPS, target: { a: 1, b, c: 0 }, readerReadsEditorPart: false });
        if (!result.ok) throw new Error(result.reason);
        return result.doc;
    };

    it('1.22: `playSpeed` becomes `playbackSpeed`, value kept, and back', () => {
        const up = convertTo125(at('1.21.0', { playSpeed: 0.5 })).doc;
        expect(timelineOf(up)).toEqual({ outTime: 1000, playbackSpeed: 0.5 });
        expect(timelineOf(down(up, 21))).toEqual({ outTime: 1000, playSpeed: 0.5 });
    });

    it('1.23: every slot\'s word is renamed — the word form and the settings form', () => {
        const up = convertTo125(at('1.22.0', { actions: { start: 'restart', stop: { behavior: 'rewind' }, finish: 'reset', outOfView: 'reset' } })).doc;
        // read to 1.25: the 1.25 keys and `atEnd`
        expect(timelineOf(up)).toEqual({ outTime: 1000, actions: { 'playback.start': 'jumpToStart', 'playback.stop': { behavior: 'animateToStart' }, outOfView: 'jumpToStart' }, atEnd: 'jumpToStart' });
        expect(timelineOf(down(up, 22))).toEqual({ outTime: 1000, actions: { start: 'restart', stop: { behavior: 'rewind' }, finish: 'reset', outOfView: 'reset' } });
    });

    it('1.23: `completeIteration: true` becomes `stop: animateToEnd`; an ENDLESS timeline takes the old stop word as its finish', () => {
        const endless = convertTo125(at('1.22.0', { iterations: 'infinite', actions: { stop: { behavior: 'rewind', completeIteration: true } } })).doc;
        expect(timelineOf(endless)).toEqual({ outTime: 1000, iterations: 'infinite', actions: { 'playback.stop': 'animateToEnd' }, atEnd: 'animateToStart' });
        // a finite one keeps its finish (accepted limit: the completed stop then ends the way the natural end does)
        const finite = convertTo125(at('1.22.0', { iterations: 3, actions: { stop: { completeIteration: true }, finish: 'hold' } })).doc;
        expect(timelineOf(finite)).toEqual({ outTime: 1000, iterations: 3, actions: { 'playback.stop': 'animateToEnd' }, atEnd: 'hold' });
        // `completeIteration: false` is the default — dropped, the slot keeps its word
        const off = convertTo125(at('1.22.0', { actions: { stop: { behavior: 'rewind', completeIteration: false } } })).doc;
        expect(timelineOf(off)).toEqual({ outTime: 1000, actions: { 'playback.stop': 'animateToStart' } });
    });

    it('1.23 down: `animateToEnd` becomes `completeIteration` with the finish\'s way back; `stop: jumpToEnd` stays for the older reader to default', () => {
        const back = down(at('1.23.0', { iterations: 'infinite', actions: { stop: 'animateToEnd', finish: 'animateToStart' } }), 22);
        expect(timelineOf(back)).toEqual({ outTime: 1000, iterations: 'infinite', actions: { stop: { behavior: 'rewind', completeIteration: true }, finish: 'rewind' } });
        const jump = down(at('1.23.0', { actions: { stop: 'jumpToEnd' } }), 22);
        expect(timelineOf(jump)).toEqual({ outTime: 1000, actions: { stop: 'jumpToEnd' } });
    });

    it('1.24: the four lists and the two slots take the buttons\' names; `actions.finish` becomes `timeline.atEnd`; values unchanged', () => {
        const up = convertTo125(at('1.23.0', {
            actionTriggers: { start: ['load', 'click'], stop: 'hoverOut', pause: 'click', resume: 'click' },
            actions: { start: 'jumpToStart', stop: { behavior: 'animateToEnd' }, finish: { behavior: 'animateToStart' }, outOfView: 'continue' },
        })).doc;
        expect(timelineOf(up)).toEqual({
            outTime: 1000,
            actionTriggers: { 'playback.start': ['load', 'click'], 'playback.stop': 'hoverOut', 'playback.pause': 'click', 'playback.resume': 'click' },
            actions: { 'playback.start': 'jumpToStart', 'playback.stop': { behavior: 'animateToEnd' }, outOfView: 'continue' },
            atEnd: 'animateToStart',
        });
        expect(timelineOf(down(up, 23))).toEqual({
            outTime: 1000,
            actionTriggers: { start: ['load', 'click'], stop: 'hoverOut', pause: 'click', resume: 'click' },
            actions: { start: 'jumpToStart', stop: { behavior: 'animateToEnd' }, outOfView: 'continue', finish: 'animateToStart' },
        });
    });

    it('1.24: an `actions` block that held only `finish` disappears; `atEnd` alone goes back into a new `actions` block', () => {
        const up = convertTo125(at('1.23.0', { actions: { finish: 'jumpToStart' } })).doc;
        expect(timelineOf(up)).toEqual({ outTime: 1000, atEnd: 'jumpToStart' });
        expect(timelineOf(down(up, 23))).toEqual({ outTime: 1000, actions: { finish: 'jumpToStart' } });
        expect(timelineOf(convertTo125(at('1.23.0', { actionTriggers: { start: 'load' } })).doc)).toEqual({ outTime: 1000, actionTriggers: { 'playback.start': 'load' } });
    });
});

describe('wire step 1.24 → 1.25 — playback is the noun (animation-state.playback-noun.md)', () => {
    const at = (version: string, timeline: Record<string, unknown>) => ({ type: 'svg', animator: { version, timeline: { outTime: 1000, ...timeline } }, children: [] });
    const down = (doc: unknown, b: number) => {
        const result = applyWireStepsDown(doc, { steps: PX_WIRE_STEPS, target: { a: 1, b, c: 0 }, readerReadsEditorPart: false });
        if (!result.ok) throw new Error(result.reason);
        return result.doc;
    };
    const runWords = {
        actionTriggers: { startRun: ['load', 'click'], stopRun: 'hoverOut', pauseRun: 'click', resumeRun: 'click' },
        actions: { startRun: 'continue', stopRun: { behavior: 'animateToStart' }, outOfView: 'pause' },
        atEnd: 'hold',
    };

    it('the four lists and the two slots: `…Run` → `playback.…`, values and the other keys unchanged, and back exactly', () => {
        const up = convertTo125(at('1.24.0', runWords)).doc;
        expect(timelineOf(up)).toEqual({
            outTime: 1000,
            actionTriggers: { 'playback.start': ['load', 'click'], 'playback.stop': 'hoverOut', 'playback.pause': 'click', 'playback.resume': 'click' },
            actions: { 'playback.start': 'continue', 'playback.stop': { behavior: 'animateToStart' }, outOfView: 'pause' },
            atEnd: 'hold',
        });
        expect(timelineOf(down(up, 24))).toEqual({ outTime: 1000, ...runWords });
    });

    it('only 1.25 (and then 1.26) is applied to a 1.24 file; a file without lists or slots passes untouched', () => {
        expect(convertWireDocument(at('1.24.1', runWords)).applied.map(s => s.to)).toEqual(['1.25', '1.26']);
        expect(timelineOf(convertTo125(at('1.24.0', { iterations: 2 })).doc)).toEqual({ outTime: 1000, iterations: 2 });
    });
});


describe('wire step 1.25 → 1.26 — state words and move words (animation-state.feedback.2026-11-12.md)', () => {
    const at = (version: string, timeline: Record<string, unknown>) => ({ type: 'svg', animator: { version, timeline: { outTime: 1000, ...timeline } }, children: [] });

    it('`atEnd` → `whenFinished`, `outOfView: jumpToStart` → `stop` (word and settings form); other values unchanged', () => {
        expect(timelineOf(convertWireDocument(at('1.25.0', { atEnd: 'animateToStart', actions: { outOfView: 'jumpToStart' } })).doc))
            .toEqual({ outTime: 1000, whenFinished: 'animateToStart', actions: { outOfView: 'stop' } });
        expect(timelineOf(convertWireDocument(at('1.25.0', { actions: { outOfView: { behavior: 'jumpToStart' }, 'playback.stop': 'animateToEnd' } })).doc))
            .toEqual({ outTime: 1000, actions: { outOfView: { behavior: 'stop' }, 'playback.stop': 'animateToEnd' } });
    });

    it('the default `continue` start becomes `playback.play` for hover and click; `load` stays a start', () => {
        const up = convertWireDocument(at('1.25.0', { actionTriggers: { 'playback.start': ['load', 'hoverIn'], 'playback.pause': 'hoverOut' } })).doc;
        expect(timelineOf(up)).toEqual({ outTime: 1000, actionTriggers: { 'playback.start': 'load', 'playback.play': 'hoverIn', 'playback.pause': 'hoverOut' } });
        const said = convertWireDocument(at('1.25.0', { actionTriggers: { 'playback.start': 'click' }, actions: { 'playback.start': 'continue' } })).doc;
        expect(timelineOf(said)).toEqual({ outTime: 1000, actionTriggers: { 'playback.play': 'click' } });
        const load = convertWireDocument(at('1.25.0', { actionTriggers: { 'playback.start': 'load' } })).doc;
        expect(timelineOf(load)).toEqual({ outTime: 1000, actionTriggers: { 'playback.start': 'load' } });
    });

    it('a `jumpToStart` or `jumpToEnd` start keeps its lists as starts (they restart now); the slot leaves the file', () => {
        const restart = convertWireDocument(at('1.25.0', { actionTriggers: { 'playback.start': 'hoverIn' }, actions: { 'playback.start': { behavior: 'jumpToStart' } }, atEnd: 'jumpToStart' })).doc;
        expect(timelineOf(restart)).toEqual({ outTime: 1000, actionTriggers: { 'playback.start': 'hoverIn' }, whenFinished: 'jumpToStart' });
        const toEnd = convertWireDocument(at('1.25.0', { actionTriggers: { 'playback.start': 'click' }, actions: { 'playback.start': 'jumpToEnd', 'playback.stop': 'animateToStart' } })).doc;
        expect(timelineOf(toEnd)).toEqual({ outTime: 1000, actionTriggers: { 'playback.start': 'click' }, actions: { 'playback.stop': 'animateToStart' } });
    });

    it('only 1.26 is applied to a 1.25 file, and it has no way back', () => {
        expect(convertWireDocument(at('1.25.1', { atEnd: 'hold' })).applied.map(s => s.to)).toEqual(['1.26']);
        const result = applyWireStepsDown(at('1.26.0', { whenFinished: 'hold' }), { steps: PX_WIRE_STEPS, target: { a: 1, b: 25, c: 0 }, readerReadsEditorPart: false });
        expect(result.ok).toBe(false);
    });
});
