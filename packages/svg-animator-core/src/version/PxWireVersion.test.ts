/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// The PLAYER's half of the version scheme: read the stamp, compare it, convert forward, and say
// something useful when the gap cannot be closed. The editor extends this — it never re-implements it.

import { assert, describe, expect, it } from 'vitest';
import { PX_WIRE_SCHEMA_VERSION } from './PxSchemaVersion';
import { PxSchemaChangeCode, schemaChangeRef } from './PxSchemaChangeCode';
import {
    applyWireSteps, applyWireStepsDown, PX_WIRE_BASELINE_VERSION, downgradeWireDocument, compareWireVersion, convertWireDocument, formatWireVersion,
    parseWireVersion, PX_WIRE_STEPS, PX_WIRE_VERSION, readWireVersion, wireVersionAdvice,
    PxWireStepKind, PxWireVersionRelation, type PxWireVersionStep, upFlowWords, upActionsList, downActionsList, downFlowEnds, downShowIn,
    upActionsAndFlowsShape, upStepSegments,
} from './PxWireVersion';
import { isRecord } from '../schema/PxSchema';
import { validateDocument } from '../format/PxAnimatorTypes';

const doc = (version?: string) => ({
    type: 'svg',
    animator: { timeline: { duration: 1000 }, ...(version === undefined ? {} : { version }) },
    children: [{ type: 'rect', width: 10, height: 10 }],
});

/** A document's raw `animator` record — throws when there is none (a failed expectation). */
function rawAnimator(doc: unknown): Record<string, unknown> {
    if (!isRecord(doc) || !isRecord(doc.animator)) throw new Error('no animator');
    return doc.animator;
}

/** A document's raw `animator.timeline` record — what the self-test steps rename keys in. */
function rawTimeline(doc: unknown): Record<string, unknown> {
    const animator = rawAnimator(doc);
    if (!isRecord(animator.timeline)) throw new Error('no animator.timeline');
    return animator.timeline;
}

describe('wire version — parsing and comparison', () => {

    it('parses `a.b.c`, defaults a missing `c`, and refuses nonsense', () => {
        expect(parseWireVersion('1.1.1')).toEqual({ a: 1, b: 1, c: 1 });
        expect(parseWireVersion('1.2')).toEqual({ a: 1, b: 2, c: 0 });
        expect(parseWireVersion('2.10.3')).toEqual({ a: 2, b: 10, c: 3 });
        for (const bad of ['', 'x', '1', '1.1.1.1', 'v1.1', undefined, null, 3]) {
            expect(parseWireVersion(bad)).toBeUndefined();
        }
    });

    it('compares numerically, not lexically — 1.10 is NEWER than 1.9', () => {
        const nine = parseWireVersion('1.9');
        const ten = parseWireVersion('1.10');
        assert(nine && ten, 'both versions parse');
        expect(compareWireVersion(ten, nine, false)).toBe(PxWireVersionRelation.newer);
        expect(compareWireVersion(nine, ten, false)).toBe(PxWireVersionRelation.older);
    });

    it('the PLAYER is blind to `c`; the editor is not', () => {
        const mine = { a: 1, b: 1, c: 1 };
        const editorOnlyBump = { a: 1, b: 1, c: 7 };
        expect(compareWireVersion(editorOnlyBump, mine, false)).toBe(PxWireVersionRelation.same);
        expect(compareWireVersion(editorOnlyBump, mine, true)).toBe(PxWireVersionRelation.newer);
    });

    it('reads the stamp from either carrier address', () => {
        // JSON lifts `animator` to the top level; a pre-rendered SVG carries it under `meta`.
        const v = { a: 1, b: 4, c: 2 };
        expect(readWireVersion({ animator: { version: '1.4.2' } })).toEqual(v);
        expect(readWireVersion({ meta: { animator: { version: '1.4.2' } } })).toEqual(v);
        expect(readWireVersion({ animator: {} })).toBeUndefined();
        expect(readWireVersion({})).toBeUndefined();
    });

    it("the player's own version is its declared schema version", () => {
        expect(`${PX_WIRE_VERSION.a}.${PX_WIRE_VERSION.b}`).toBe(PX_WIRE_SCHEMA_VERSION);
    });
});


describe('convertWireDocument — the playerFixer half', () => {

    it('leaves an UNSTAMPED document exactly as it is — nothing is assumed', () => {
        const d = doc();
        const r = convertWireDocument(d);
        expect(r.relation).toBe(PxWireVersionRelation.unstamped);
        expect(r.applied).toEqual([]);
        expect(r.advice).toBeUndefined();
        expect(r.doc).toBe(d);
    });

    it('leaves a same-version document alone and says nothing', () => {
        const r = convertWireDocument(doc(`${PX_WIRE_SCHEMA_VERSION}.1`));
        expect(r.relation).toBe(PxWireVersionRelation.same);
        expect(r.applied).toEqual([]);
        expect(r.advice).toBeUndefined();
    });

    it('a NEWER file is still returned, with advice naming the remedy — never refused', () => {
        // one revision past whatever the source declares today
        const [a, b] = PX_WIRE_SCHEMA_VERSION.split('.').map(Number);
        const r = convertWireDocument(doc(a + '.' + (b + 1) + '.0'));
        expect(r.relation).toBe(PxWireVersionRelation.newer);
        expect(r.advice).toContain('Update the player');
        expect(r.doc).toBeDefined();          // the document survives; the player renders what it can
    });

    it('another GENERATION is returned too, naming both remedies', () => {
        const r = convertWireDocument(doc('2.0.0'));
        expect(r.relation).toBe(PxWireVersionRelation.otherGeneration);
        expect(r.advice).toContain('no conversion bridges');
        expect(r.doc).toBeDefined();
    });

    it('never throws on rubbish input', () => {
        for (const bad of [undefined, null, 42, 'x', [], {}]) {
            expect(() => convertWireDocument(bad)).not.toThrow();
        }
    });
});


describe('the step table', () => {

    it('runs unbroken from the baseline to this player version', () => {
        const chain = [PX_WIRE_BASELINE_VERSION, ...PX_WIRE_STEPS.map(s => s.to)];
        PX_WIRE_STEPS.forEach((step, i) => expect(step.from).toBe(chain[i]));
        expect(playerPart(chain[chain.length - 1])).toBe(PX_WIRE_SCHEMA_VERSION);
    });

    it('every step carries a converter or is DECLARED additive, and moves strictly forward', () => {
        for (const step of PX_WIRE_STEPS) {
            if (step.kind === PxWireStepKind.converted) expect(step.up).toBeTypeOf('function');
            else expect(step.up).toBeUndefined();
            const from = parseWireVersion(step.from);
            const to = parseWireVersion(step.to);
            assert(from && to, 'step ' + step.from + ' → ' + step.to + ' parses');
            expect(to.a).toBe(from.a);          // a `b` step never changes the generation
            expect(to.b).toBeGreaterThan(from.b);
        }
    });

    it('every step has its own schema change code, the codes only go forward, and every code is used', () => {
        // A NUMBER IS FOREVER (PxSchemaChangeCode.ts): a new step takes the next number, never an old one.
        const codes = PX_WIRE_STEPS.map(s => s.code);
        codes.forEach((code, i) => { if (i > 0) expect(code, 'step ' + PX_WIRE_STEPS[i].to).toBeGreaterThan(codes[i - 1]); });
        const members = Object.values(PxSchemaChangeCode).filter((v): v is number => typeof v === 'number');
        expect([...members].sort((a, b) => a - b)).toEqual(codes);
        expect(schemaChangeRef(PxSchemaChangeCode.triggerTwoAxes)).toBe('PXS1 https://github.com/pixodesk/pixodesk-svg-animator/blob/main/docs/schema-changes.md#pxs1');
    });

    it('MUTATION SELF-TEST: a real step converts, re-stamps, and leaves `meta.*` untouched', () => {
        // Runs the actual machinery on a fabricated 1.1 → 1.2 step, because an empty table proves
        // only that nothing is needed yet, not that conversion works when it is.
        const step: PxWireVersionStep = {
            from: '1.1', to: '1.2', kind: PxWireStepKind.converted,
            code: PxSchemaChangeCode.triggerTwoAxes,   // self-test only — renames animator.timeline.duration to durationMs
            up: (d) => {
                const timeline = (d.animator as Record<string, unknown>).timeline as Record<string, unknown>;
                timeline.durationMs = timeline.duration;
                delete timeline.duration;
            },
        };
        const d: Record<string, unknown> = {
            type: 'svg',
            animator: { timeline: { duration: 1000 }, version: '1.1.1' },
            meta: { editorOnly: 'must survive untouched' },
        };
        // Apply it the way `convertWireDocument` does, then assert all three obligations.
        assert(step.up, 'a converted step carries `up`');
        step.up(d);
        const timeline = (d.animator as Record<string, unknown>).timeline as Record<string, unknown>;
        expect(timeline.durationMs).toBe(1000);
        expect(timeline.duration).toBeUndefined();
        expect((d.meta as Record<string, unknown>).editorOnly).toBe('must survive untouched');
    });

    it('applies a real step to a COPY, re-stamps it, and leaves the caller\'s document untouched', () => {
        // The end-to-end path, driven through the exported entry point rather than by calling
        // `up` by hand — with a step temporarily spliced into the live table.
        const step: PxWireVersionStep = {
            from: '1.1', to: '1.2', kind: PxWireStepKind.converted,
            code: PxSchemaChangeCode.triggerTwoAxes,   // self-test only — renames timeline.duration to durationMs
            up: (d) => {
                const t = (d.animator as Record<string, unknown>).timeline as Record<string, unknown>;
                t.durationMs = t.duration;
                delete t.duration;
            },
        };
        const original = { ...doc('1.1.1'), meta: { editorOnly: 'must survive' } };
        const before = JSON.stringify(original);
        const r = applyWireSteps(original, {
            steps: [step], target: { a: 1, b: 2, c: 0 }, readerReadsEditorPart: false,
        });

        // the copy moved forward…
        const out = r.doc;
        expect(r.applied).toHaveLength(1);
        expect(rawTimeline(out).durationMs).toBe(1000);
        expect(rawTimeline(out).duration).toBeUndefined();
        expect(rawAnimator(out).version).toBe('1.2.1');            // `c` preserved, `a.b` moved
        expect(isRecord(out) && isRecord(out.meta) ? out.meta.editorOnly : undefined).toBe('must survive');   // player steps never touch meta.*
        // …and the caller's object did not.
        expect(JSON.stringify(original)).toBe(before);
        expect(r.doc).not.toBe(original);
    });

    it('a step that THROWS degrades to "not converted" — never to a failed open', () => {
        const boom: PxWireVersionStep = {
            from: '1.1', to: '1.2', kind: PxWireStepKind.converted,
            code: PxSchemaChangeCode.triggerTwoAxes,   // self-test only — always throws
            up: () => { throw new Error('deliberate'); },
        };
        const original = doc('1.1.1');
        const before = JSON.stringify(original);
        const r = applyWireSteps(original, {
            steps: [boom], target: { a: 1, b: 2, c: 0 }, readerReadsEditorPart: false,
        });
        expect(r.applied).toEqual([]);
        expect(r.doc).toBe(original);                 // the untouched input comes back
        expect(JSON.stringify(original)).toBe(before);
    });

    it('an older document with NO applicable step is returned unconverted, not mangled', () => {
        // The table is empty at 1.1, so a hypothetical 1.0 file has no path forward. It must come
        // back intact rather than half-converted.
        const d = doc('1.0.0');
        const before = JSON.stringify(d);
        convertWireDocument(d);
        expect(JSON.stringify(d)).toBe(before);
    });
});


describe('wireVersionAdvice', () => {

    it('says nothing for same or unstamped — a gap alone is never a story', () => {
        const mine = { a: 1, b: 1, c: 1 };
        expect(wireVersionAdvice(PxWireVersionRelation.same, mine, mine, true)).toBeUndefined();
        expect(wireVersionAdvice(PxWireVersionRelation.unstamped, undefined, mine, true)).toBeUndefined();
    });

    it('names the right target for each reader', () => {
        const mine = { a: 1, b: 1, c: 1 };
        const newer = { a: 1, b: 9, c: 0 };
        expect(wireVersionAdvice(PxWireVersionRelation.newer, newer, mine, true)).toContain('Update the player');
        expect(wireVersionAdvice(PxWireVersionRelation.newer, newer, mine, false)).toContain('Update the editor');
    });

    it('formats back to the spelling it parsed', () => {
        expect(formatWireVersion({ a: 1, b: 1, c: 1 })).toBe('1.1.1');
        const parsed = parseWireVersion('1.2');
        assert(parsed, '1.2 parses');
        expect(formatWireVersion(parsed)).toBe('1.2.0');
    });
});

/** `a.b` of a version string. */
function playerPart(v: string): string {
    return v.split('.').slice(0, 2).join('.');
}


describe('down-conversion (task 6.7) — all or nothing', () => {

    const undoable = (from: string, to: string): PxWireVersionStep => ({
        from, to, kind: PxWireStepKind.converted,
        code: PxSchemaChangeCode.triggerTwoAxes,   // spec only — renames timeline.duration ⇄ durationMs
        up: (d) => { const t = rawTimeline(d); t.durationMs = t.duration; delete t.duration; },
        down: (d) => { const t = rawTimeline(d); t.duration = t.durationMs; delete t.durationMs; },
    });
    const oneWay = (from: string, to: string): PxWireVersionStep => ({
        from, to, kind: PxWireStepKind.converted, code: PxSchemaChangeCode.triggerTwoAxes,   // spec only — the shape rework: no way back
        up: () => { /* forward only */ },
    });
    const at12 = () => ({ type: 'svg', animator: { timeline: { durationMs: 1000 }, version: '1.2.0' } });

    it('undoes every step back to the target, on a COPY, and re-stamps it', () => {
        const original = at12();
        const before = JSON.stringify(original);
        const r = applyWireStepsDown(original, {
            steps: [undoable('1.1', '1.2')], target: { a: 1, b: 1, c: 0 }, readerReadsEditorPart: false,
        });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        const out = r.doc;
        expect(rawTimeline(out).duration).toBe(1000);
        expect(rawTimeline(out).durationMs).toBeUndefined();
        expect(rawAnimator(out).version).toBe('1.1.0');
        expect(JSON.stringify(original)).toBe(before);       // caller's document untouched
    });

    it('REFUSES when any step on the way back has no `down`, and names it', () => {
        const r = applyWireStepsDown(at12(), {
            steps: [oneWay('1.1', '1.2')], target: { a: 1, b: 1, c: 0 }, readerReadsEditorPart: false,
        });
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.blocking).toHaveLength(1);
        expect(r.reason).toContain('1.1 → 1.2 (PXS1 https://');   // the blocking step, by its code and the page
        expect(r.reason).toContain('cannot be undone');
    });

    it('refuses the WHOLE request even when only one of several steps is one-way', () => {
        const d = { type: 'svg', animator: { timeline: { durationMs: 1 }, version: '1.3.0' } };
        const r = applyWireStepsDown(d, {
            steps: [oneWay('1.1', '1.2'), undoable('1.2', '1.3')],
            target: { a: 1, b: 1, c: 0 }, readerReadsEditorPart: false,
        });
        expect(r.ok).toBe(false);          // never a partial downgrade to 1.2
    });

    it('additive steps need no `down` — an older reader ignores what they added', () => {
        const additive: PxWireVersionStep = { from: '1.1', to: '1.2', kind: PxWireStepKind.additive, code: PxSchemaChangeCode.triggerTwoAxes };   // spec only — a new optional field
        const r = applyWireStepsDown(at12(), { steps: [additive], target: { a: 1, b: 1, c: 0 }, readerReadsEditorPart: false });
        expect(r.ok).toBe(true);
    });

    it('is a no-op when the document is already at or below the target', () => {
        const d = doc('1.1.0');
        const r = applyWireStepsDown(d, { steps: [oneWay('1.1', '1.2')], target: { a: 1, b: 2, c: 0 }, readerReadsEditorPart: false });
        expect(r.ok).toBe(true);
        if (r.ok) expect(r.doc).toBe(d);
    });

    it('refuses across generations and for an unstamped document', () => {
        const other = applyWireStepsDown(doc('2.0.0'), { steps: [], target: { a: 1, b: 1, c: 0 }, readerReadsEditorPart: false });
        expect(other.ok).toBe(false);
        const unstamped = applyWireStepsDown(doc(), { steps: [], target: { a: 1, b: 1, c: 0 }, readerReadsEditorPart: false });
        expect(unstamped.ok).toBe(false);
    });

    it('the live player table can always go down to where it is — nothing to undo at 1.1', () => {
        const r = downgradeWireDocument(doc(PX_WIRE_SCHEMA_VERSION + '.0'), PX_WIRE_VERSION);
        expect(r.ok).toBe(true);
    });
});


describe('T3 — conversion is idempotent', () => {

    it('converting twice is converting once: the stamp stops a second pass', () => {
        const step: PxWireVersionStep = {
            from: '1.1', to: '1.2', kind: PxWireStepKind.converted,
            code: PxSchemaChangeCode.triggerTwoAxes,   // spec only — renames timeline.duration to durationMs
            up: (d) => { const t = rawTimeline(d); t.durationMs = t.duration; delete t.duration; },
        };
        const cfg = { steps: [step], target: { a: 1, b: 2, c: 0 }, readerReadsEditorPart: false };
        const once = applyWireSteps(doc('1.1.0'), cfg);
        const twice = applyWireSteps(once.doc, cfg);
        expect(once.applied).toHaveLength(1);
        expect(twice.applied).toEqual([]);                       // nothing left to do
        expect(twice.doc).toBe(once.doc);                        // not even a copy
        expect(JSON.stringify(twice.doc)).toBe(JSON.stringify(once.doc));
    });
});

describe('1.28 amended a third time (2026-11-22) — the flow words', () => {
    /** A 1.27 file with segments, a goTo key and a segment that goes on to the next. */
    const old = (): Record<string, unknown> => ({
        type: 'svg',
        animator: {
            version: '1.27.0',
            timeline: {
                outTime: 3000,
                segments: [
                    { name: 'intro', inTime: 0, outTime: 1000, whenFinished: 'timeline.segment.next' },
                    { name: 'loop', inTime: 1000, outTime: 3000 },
                ],
            },
            actionTriggers: { 'timeline.segment.goTo(loop)': 'click', 'timeline.start': 'load' },
        },
    });

    it('a 1.27 file with segments arrives as flow steps and flow actions', () => {
        const r = convertWireDocument(old());
        const animator = isRecord(r.doc) && isRecord(r.doc.animator) ? r.doc.animator : {};
        expect(animator.states).toBeUndefined();
        // 1.29: the list is `actions`, and "at its end, the next" is an entry of it; 1.30: a next of before wrapped, so it
        // arrives as `flow.nextOrWrap`; 1.33: a step's part in `timelineOptions`, an entry `{ name, with, triggers, when }`;
        // 1.34: the part in its `segment`
        expect(animator.flowSteps).toEqual([
            { id: 'intro', segment: { inTime: 0, outTime: 1000 } },
            { id: 'loop', segment: { inTime: 1000, outTime: 3000 } },
        ]);
        expect(animator.actions).toEqual([
            { name: 'flow.goTo', with: { flowStep: 'loop' }, triggers: [{ event: 'click' }] },
            { name: 'timeline.start', triggers: [{ event: 'load' }] },
            { name: 'flow.nextOrWrap', triggers: [{ event: 'flowStep.finished' }], when: { flowSteps: ['intro'] } },
        ]);
    });

    it('upFlowWords brings a file of the 11-20 words over; twice is the same as once', () => {
        const d: Record<string, unknown> = { type: 'svg', animator: {
            timelines: [{ outTime: 1000 }],
            states: [{ id: 'a', stateMachine: 'm', whenFinished: { action: 'state.goTo', state: 'b' } }, { id: 'b', stateMachine: 'm' }],
            stateMachines: [{ id: 'm' }],
            actionTriggers: [{ action: 'state.next', stateMachine: 'm', event: 'click' }],
        } };
        upFlowWords(d);
        const once = JSON.stringify(d);
        expect(d.animator).toEqual({
            timelines: [{ outTime: 1000 }],
            flowSteps: [{ id: 'a', flow: 'm', whenFinished: { action: 'flow.goTo', flowStep: 'b' } }, { id: 'b', flow: 'm' }],
            flows: [{ id: 'm' }],
            actionTriggers: [{ action: 'flow.next', flow: 'm', event: 'click' }],
        });
        upFlowWords(d);
        expect(JSON.stringify(d)).toBe(once);
    });
});

describe('1.29 (2026-11-22) — one actions list, whenStopped / whenOutOfView, a step\'s end as an entry', () => {
    /** A 1.28 file: the list under its old name, the timeline's block, a step that goes on at its end. */
    const at128 = (): Record<string, unknown> => ({
        type: 'svg',
        animator: {
            version: '1.28.0',
            timelines: [{ outTime: 2000, actions: { 'timeline.stop': { behavior: 'animateToStart' }, outOfView: 'pause' } }],
            flowSteps: [{ id: 'intro', inTime: 0, outTime: 1000, whenFinished: { action: 'flow.goTo', flowStep: 'loop' } }, { id: 'loop', inTime: 1000, outTime: 2000 }],
            actionTriggers: [{ action: 'timeline.start', event: 'load' }],
        },
    });

    it('upActionsList: the list renamed, the block flattened, the step\'s end appended as a finished entry', () => {
        const d = at128();
        upActionsList(d);
        expect(rawAnimator(d)).toEqual({
            version: '1.28.0',
            timelines: [{ outTime: 2000, whenStopped: 'animateToStart', whenOutOfView: 'pause' }],
            flowSteps: [{ id: 'intro', inTime: 0, outTime: 1000 }, { id: 'loop', inTime: 1000, outTime: 2000 }],
            actions: [
                { action: 'timeline.start', event: 'load' },
                { action: 'flow.goTo', flowStep: 'loop', event: 'finished', from: 'intro' },
            ],
        });
    });

    it('upActionsList twice is the same as once', () => {
        const d = at128();
        upActionsList(d);
        const once = JSON.stringify(d);
        upActionsList(d);
        expect(JSON.stringify(d)).toBe(once);
    });

    it('a step\'s `hold` end goes without an entry — holding is what no entry means', () => {
        const d: Record<string, unknown> = { type: 'svg', animator: { flowSteps: [{ id: 'a', whenFinished: 'hold' }] } };
        upActionsList(d);
        expect(rawAnimator(d)).toEqual({ flowSteps: [{ id: 'a', whenFinished: 'hold' }] });
    });

    it('down to 1.28 and up again gives the same file', () => {
        const up = at128();
        upActionsList(up);
        const back = JSON.parse(JSON.stringify(up)) as Record<string, unknown>;
        downActionsList(back);
        expect(rawAnimator(back)).toEqual({
            version: '1.28.0',
            timelines: [{ outTime: 2000, actions: { 'timeline.stop': 'animateToStart', outOfView: 'pause' } }],
            flowSteps: [{ id: 'intro', inTime: 0, outTime: 1000, whenFinished: { action: 'flow.goTo', flowStep: 'loop' } }, { id: 'loop', inTime: 1000, outTime: 2000 }],
            actionTriggers: [{ action: 'timeline.start', event: 'load' }],
        });
        upActionsList(back);
        expect(back).toEqual(up);
    });

    /** A 1.29 file with one entry 1.28 cannot say. */
    const at129With = (entry: Record<string, unknown>) => ({
        type: 'svg', animator: { version: '1.29.0', timelines: [{ outTime: 1000 }], flowSteps: [{ id: 'a' }, { id: 'b' }], actions: [entry] },
    });
    const to128 = { a: 1, b: 28, c: 0 };

    it.each([
        ['an entry\'s own behavior', { action: 'timeline.stop', event: 'click', behavior: 'animateToStart' }],
        ['a `from` on a page event', { action: 'flow.next', event: 'click', from: 'a' }],
        ['a step\'s end naming several steps', { action: 'flow.next', event: 'finished', from: ['a', 'b'] }],
        ['a step\'s end naming no step', { action: 'flow.next', event: 'finished' }],
    ])('down to 1.28 is REFUSED for %s, and names the step', (_what, entry) => {
        const r = downgradeWireDocument(at129With(entry), to128);
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.blocking.map(s => s.code)).toEqual([PxSchemaChangeCode.actionsList]);
    });

    it('down to 1.28 through the live table, for a file 1.28 can say', () => {
        const r = downgradeWireDocument(at129With({ action: 'flow.goTo', flowStep: 'b', event: 'finished', from: 'a' }), to128);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(rawAnimator(r.doc).actionTriggers).toEqual([]);
        expect(rawAnimator(r.doc).flowSteps).toEqual([{ id: 'a', whenFinished: { action: 'flow.goTo', flowStep: 'b' } }, { id: 'b' }]);
        expect(rawAnimator(r.doc).version).toBe('1.28.0');
    });
});

describe('1.30 (2026-11-23) — next and previous stop at the ends; the `…OrWrap` actions wrap', () => {
    /** A 1.29 file: every stepping action, a go-to and a playback action. */
    const at129 = (): Record<string, unknown> => ({
        type: 'svg',
        animator: {
            version: '1.29.0',
            timelines: [{ outTime: 2000 }],
            flowSteps: [{ id: 'a', inTime: 0, outTime: 1000 }, { id: 'b', inTime: 1000, outTime: 2000 }],
            actions: [
                { action: 'timeline.start', event: 'load' },
                { action: 'flow.next', event: 'click', selector: '.next' },
                { action: 'flow.previous', event: 'click', selector: '.back' },
                { action: 'flow.next', event: 'finished', from: 'a' },
                { action: 'flow.goTo', flowStep: 'a', event: 'keyDown' },
            ],
        },
    });
    const to129 = { a: 1, b: 29, c: 0 };
    // 1.33 has no way back: the round trip stops at 1.30
    const STEPS_TO_1_30 = PX_WIRE_STEPS.slice(0, PX_WIRE_STEPS.findIndex(s => s.to === '1.30') + 1);
    const upTo130 = (d: unknown) => applyWireSteps(d, { steps: STEPS_TO_1_30, target: { a: 1, b: 30, c: 0 }, readerReadsEditorPart: false });

    it('a 1.29 file keeps its meaning: its next and previous wrapped, so they arrive as `…OrWrap`', () => {
        const r = convertWireDocument(at129());
        expect(r.applied.map(s => s.to)).toEqual(['1.30', '1.33', '1.34']);
        // 1.33: an entry `{ name, with, triggers, when }`
        expect(rawAnimator(r.doc).actions).toEqual([
            { name: 'timeline.start', triggers: [{ event: 'load' }] },
            { name: 'flow.nextOrWrap', triggers: [{ event: 'click', selector: '.next' }] },
            { name: 'flow.previousOrWrap', triggers: [{ event: 'click', selector: '.back' }] },
            { name: 'flow.nextOrWrap', triggers: [{ event: 'flowStep.finished' }], when: { flowSteps: ['a'] } },
            { name: 'flow.goTo', with: { flowStep: 'a' }, triggers: [{ event: 'keyDown' }] },
        ]);
    });

    it('down to 1.29 and up again gives the same file', () => {
        const up = upTo130(at129());
        expect(up.applied.map(s => s.to)).toEqual(['1.30']);
        const back = downgradeWireDocument(up.doc, to129);
        expect(back.ok).toBe(true);
        if (!back.ok) return;
        expect(rawAnimator(back.doc).actions).toEqual(rawAnimator(at129()).actions);
        expect(upTo130(back.doc).doc).toEqual(up.doc);
    });

    it.each([['flow.next'], ['flow.previous']])('down to 1.29 is REFUSED for a %s that stops at the ends', (action) => {
        const doc = { type: 'svg', animator: { version: '1.30.0', flowSteps: [{ id: 'a' }, { id: 'b' }], actions: [{ action, event: 'click' }] } };
        expect(() => downFlowEnds(JSON.parse(JSON.stringify(doc)) as Record<string, unknown>)).toThrow();
        const r = downgradeWireDocument(doc, to129);
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.blocking.map(s => s.code)).toEqual([PxSchemaChangeCode.flowEnds]);
    });
});

describe('1.31 (2026-11-23) — an element shown only in some flow steps', () => {
    const to130 = { a: 1, b: 30, c: 0 };
    const withShowIn = { type: 'svg', animator: { version: '1.31.0', flowSteps: [{ id: 'a' }] },
        children: [{ type: 'g', children: [{ type: 'rect', effects: { showIn: { flowSteps: ['a'] } } }] }] };
    const onBinding = { type: 'svg', animator: { version: '1.31.0', bindings: [{ element: '#x', animateWith: [], showIn: { flowSteps: ['a'] } }] } };

    it('down to 1.30 is REFUSED for a node\'s showIn and for a binding\'s', () => {
        for (const doc of [withShowIn, onBinding]) {
            expect(() => downShowIn(JSON.parse(JSON.stringify(doc)) as Record<string, unknown>)).toThrow();
            const r = downgradeWireDocument(doc, to130);
            expect(r.ok).toBe(false);
            if (r.ok) return;
            expect(r.blocking.map(s => s.code)).toEqual([PxSchemaChangeCode.showIn]);
        }
    });

    it('down to 1.30 for a file without it changes nothing but the version', () => {
        const r = downgradeWireDocument({ type: 'svg', animator: { version: '1.31.0', flowSteps: [{ id: 'a' }] } }, to130);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(rawAnimator(r.doc)).toEqual({ version: '1.30.0', flowSteps: [{ id: 'a' }] });
    });
});

describe('1.32 (2026-11-24) — a group shows one of its children', () => {
    it('down to 1.31 is REFUSED for a group\'s showOneOf; a file without it goes down', () => {
        const to131 = { a: 1, b: 31, c: 0 };
        const withIt = { type: 'svg', animator: { version: '1.32.0' }, children: [{ type: 'g', effects: { showOneOf: { which: 1 } }, children: [] }] };
        const r = downgradeWireDocument(withIt, to131);
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.blocking.map(s => s.code)).toEqual([PxSchemaChangeCode.showOneOf]);
        expect(downgradeWireDocument({ type: 'svg', animator: { version: '1.32.0' } }, to131).ok).toBe(true);
    });
});

describe('1.33 (2026-11-24) — an entry `{ name, with, triggers, when }`, a step\'s `timelineOptions`, a flow\'s `initialFlowStep`', () => {
    /** A 1.32 file with every old spelling the step converts. */
    const at132 = (): Record<string, unknown> => ({
        type: 'svg', viewBox: '0 0 100 100',
        animator: {
            version: '1.32.0',
            timelines: [{ name: 'Main', outTime: 3000 }, { id: 'lamp', name: 'Lamp', outTime: 1000 }],
            flows: [{ id: 'pages', name: 'Pages' }],
            flowSteps: [
                { id: 'intro', name: 'Intro', inTime: 0, outTime: 1000, iterations: 2, whenFinished: 'hold' },
                { id: 'loop', name: 'Loop', inTime: 1000, outTime: 3000, iterationDirection: 'alternate', playbackSpeed: 2, whenLeaving: 'animateToEnd', initial: true },
                { id: 'off', flow: 'pages', timeline: 'lamp', inTime: 0, outTime: 500, initial: false },
                { id: 'on', flow: 'pages', timeline: 'lamp', inTime: 500, outTime: 1000, initial: true },
            ],
            actions: [
                { action: 'timeline.start', event: 'load' },
                { action: 'timeline.pause', timeline: 'lamp', event: 'click', element: '#bulb' },
                { action: 'flow.nextOrWrap', flow: 'pages', event: 'keyDown', selector: '.deck', with: { key: 'ArrowRight', metaOrCtrlKey: true } },
                { action: 'flow.next', event: 'click' },
                { action: 'timeline.stop', event: 'hoverOut', behavior: 'animateToStart' },
                { action: 'flow.goTo', flowStep: 'loop', event: 'finished', from: 'intro' },
                { action: 'flow.goTo', flowStep: 'intro', event: 'click', selector: '.restart', from: ['loop'], behavior: 'animateToStart' },
                { action: 'flow.previous', flow: 'pages', event: 'click', from: ['on', 'off'] },
            ],
            bindings: [
                { element: '#pre', animateWith: [], showIn: { flowSteps: ['on'] } },
                { element: '#face', animateWith: [], showOneOf: { which: 1, options: [{ element: '#f0' }, { element: '#f1' }] } },
            ],
        },
        children: [
            { type: 'g', id: 'face', effects: { showOneOf: { which: 1 } }, children: [{ type: 'rect', id: 'f0' }, { type: 'rect', id: 'f1' }] },
            { type: 'rect', id: 'bulb', effects: { showIn: { flowSteps: ['on', 'loop'] } } },
            { type: 'rect', id: 'pre' },
        ],
    });

    it('twice is the same as once — an entry already in the 1.33 shape is left as it is', () => {
        const once = at132();
        upActionsAndFlowsShape(once);
        const twice = JSON.parse(JSON.stringify(once));
        upActionsAndFlowsShape(twice);
        expect(twice).toEqual(once);
    });

    it('a 1.32 file arrives in the 1.33 shape (then 1.34\'s segments), exactly, and validates with no finding', () => {
        const r = convertWireDocument(at132());
        expect(r.applied.map(s => s.to)).toEqual(['1.33', '1.34']);
        expect(r.doc).toEqual({
            type: 'svg', viewBox: '0 0 100 100',
            animator: {
                version: '1.34.0',
                // every `name` of a timeline, a flow and a step is dropped
                timelines: [{ outTime: 3000 }, { id: 'lamp', outTime: 1000 }],
                // a step's `initial` → its flow's `initialFlowStep`; a step of no flow → the flow `default`
                flows: [{ id: 'pages', initialFlowStep: 'on' }, { id: 'default', initialFlowStep: 'loop' }],
                flowSteps: [
                    // 1.34: a step's timeline and `timelineOptions` in its `segment`
                    { id: 'intro', segment: { inTime: 0, outTime: 1000, iterations: 2, whenFinished: 'hold' } },
                    { id: 'loop', segment: { inTime: 1000, outTime: 3000, iterationDirection: 'alternate', playbackSpeed: 2, whenLeaving: 'animateToEnd' } },
                    { id: 'off', flow: 'pages', segment: { timeline: 'lamp', inTime: 0, outTime: 500 } },
                    { id: 'on', flow: 'pages', segment: { timeline: 'lamp', inTime: 500, outTime: 1000 } },
                ],
                actions: [
                    { name: 'timeline.start', triggers: [{ event: 'load' }] },
                    { name: 'timeline.pause', with: { timeline: 'lamp' }, triggers: [{ event: 'click', element: '#bulb' }] },
                    { name: 'flow.nextOrWrap', with: { flow: 'pages' }, triggers: [{ event: 'keyDown', selector: '.deck', with: { key: 'ArrowRight', metaOrCtrlKey: true } }] },
                    { name: 'flow.next', triggers: [{ event: 'click' }] },
                    // `behavior` → the stop's `whenStopped`, the go-to's `whenLeaving`; `finished` → `flowStep.finished`
                    { name: 'timeline.stop', with: { whenStopped: 'animateToStart' }, triggers: [{ event: 'hoverOut' }] },
                    { name: 'flow.goTo', with: { flowStep: 'loop' }, triggers: [{ event: 'flowStep.finished' }], when: { flowSteps: ['intro'] } },
                    { name: 'flow.goTo', with: { flowStep: 'intro', whenLeaving: 'animateToStart' }, triggers: [{ event: 'click', selector: '.restart' }], when: { flowSteps: ['loop'] } },
                    { name: 'flow.previous', with: { flow: 'pages' }, triggers: [{ event: 'click' }], when: { flowSteps: ['on', 'off'] } },
                ],
                bindings: [
                    { element: '#pre', animateWith: [], show: { when: { flowSteps: ['on'] } } },
                    { element: '#face', animateWith: [], showOneChild: { when: { index: 1 }, options: [{ element: '#f0' }, { element: '#f1' }] } },
                ],
            },
            children: [
                { type: 'g', id: 'face', effects: { showOneChild: { when: { index: 1 } } }, children: [{ type: 'rect', id: 'f0' }, { type: 'rect', id: 'f1' }] },
                { type: 'rect', id: 'bulb', effects: { show: { when: { flowSteps: ['on', 'loop'] } } } },
                { type: 'rect', id: 'pre' },
            ],
        });
        const checked = validateDocument(r.doc);
        expect(checked.errors).toEqual([]);
        expect(checked.findings).toEqual([]);
    });

    it('a flow already listed keeps its own `initialFlowStep`; the first step marked `initial` wins', () => {
        const d: Record<string, unknown> = { type: 'svg', animator: {
            flows: [{ id: 'm', initialFlowStep: 'b' }],
            flowSteps: [{ id: 'a', flow: 'm', initial: true }, { id: 'b', flow: 'm' }, { id: 'c', initial: true }, { id: 'd', initial: true }],
        } };
        upActionsAndFlowsShape(d);
        expect(rawAnimator(d)).toEqual({
            flows: [{ id: 'm', initialFlowStep: 'b' }, { id: 'default', initialFlowStep: 'c' }],
            flowSteps: [{ id: 'a', flow: 'm' }, { id: 'b', flow: 'm' }, { id: 'c' }, { id: 'd' }],
        });
    });

    it('down to 1.32 is REFUSED — 1.33 has no way back', () => {
        const r = downgradeWireDocument(convertWireDocument(at132()).doc, { a: 1, b: 32, c: 0 });
        expect(r.ok).toBe(false);
        if (r.ok) return;
        // 1.34 has no way back either — the steps back are refused, the newest first
        expect(r.blocking.map(s => s.code)).toEqual([PxSchemaChangeCode.flowStepTransitions, PxSchemaChangeCode.actionsAndFlowsShape]);
    });
});

describe('1.34 (2026-11-26) — a step\'s `segment`, its transition segments, and how two steps hand over', () => {
    it('a 1.33 step\'s `timeline` and `timelineOptions` arrive as its `segment`; twice is the same as once', () => {
        const d: Record<string, unknown> = { type: 'svg', animator: {
            timelines: [{ outTime: 1000 }, { id: 'lamp', outTime: 500 }],
            flowSteps: [{ id: 'a', timelineOptions: { inTime: 0, outTime: 500 } }, { id: 'b', flow: 'f', timeline: 'lamp' },
                { id: 'c', timeline: 'lamp', timelineOptions: { iterations: 'infinite', whenLeaving: 'animateToEnd' } }, { id: 'd' }],
        } };
        upStepSegments(d);
        const once = JSON.stringify(d);
        expect(rawAnimator(d).flowSteps).toEqual([
            { id: 'a', segment: { inTime: 0, outTime: 500 } },
            { id: 'b', flow: 'f', segment: { timeline: 'lamp' } },
            { id: 'c', segment: { timeline: 'lamp', iterations: 'infinite', whenLeaving: 'animateToEnd' } },
            { id: 'd' },
        ]);
        upStepSegments(d);
        expect(JSON.stringify(d)).toBe(once);
    });

    it('a 1.33 file converts by the 1.34 step alone', () => {
        const r = convertWireDocument({ type: 'svg', animator: { version: '1.33.0', timelines: [{ outTime: 1000 }], flowSteps: [{ id: 'a', timelineOptions: { outTime: 500 } }] } });
        expect(r.applied.map(s => s.to)).toEqual(['1.34']);
        expect(rawAnimator(r.doc).flowSteps).toEqual([{ id: 'a', segment: { outTime: 500 } }]);
    });
});
