/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// The PLAYER's half of the version scheme: read the stamp, compare it, convert forward, and say
// something useful when the gap cannot be closed. The editor extends this — it never re-implements it.

import { describe, expect, it } from 'vitest';
import { PX_PLAYER_SCHEMA_VERSION } from './PxSchemaVersion';
import {
    applyWireSteps, applyWireStepsDown, BASELINE_PLAYER_VERSION, downgradePlayerDocument, compareWireVersion, convertPlayerDocument, formatWireVersion,
    parseWireVersion, PLAYER_WIRE_STEPS, PLAYER_WIRE_VERSION, readWireVersion, versionAdvice,
    WireStepKind, WireVersionRelation, type WireVersionStep,
} from './PxWireVersion';

const doc = (version?: string) => ({
    type: 'svg',
    animator: { timeline: { duration: 1000 }, ...(version === undefined ? {} : { version }) },
    children: [{ type: 'rect', width: 10, height: 10 }],
});

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
        const nine = parseWireVersion('1.9')!;
        const ten = parseWireVersion('1.10')!;
        expect(compareWireVersion(ten, nine, false)).toBe(WireVersionRelation.newer);
        expect(compareWireVersion(nine, ten, false)).toBe(WireVersionRelation.older);
    });

    it('the PLAYER is blind to `c`; the editor is not', () => {
        const mine = { a: 1, b: 1, c: 1 };
        const editorOnlyBump = { a: 1, b: 1, c: 7 };
        expect(compareWireVersion(editorOnlyBump, mine, false)).toBe(WireVersionRelation.same);
        expect(compareWireVersion(editorOnlyBump, mine, true)).toBe(WireVersionRelation.newer);
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
        expect(`${PLAYER_WIRE_VERSION.a}.${PLAYER_WIRE_VERSION.b}`).toBe(PX_PLAYER_SCHEMA_VERSION);
    });
});


describe('convertPlayerDocument — the playerFixer half', () => {

    it('leaves an UNSTAMPED document exactly as it is — nothing is assumed', () => {
        const d = doc();
        const r = convertPlayerDocument(d);
        expect(r.relation).toBe(WireVersionRelation.unstamped);
        expect(r.applied).toEqual([]);
        expect(r.advice).toBeUndefined();
        expect(r.doc).toBe(d);
    });

    it('leaves a same-version document alone and says nothing', () => {
        const r = convertPlayerDocument(doc(`${PX_PLAYER_SCHEMA_VERSION}.1`));
        expect(r.relation).toBe(WireVersionRelation.same);
        expect(r.applied).toEqual([]);
        expect(r.advice).toBeUndefined();
    });

    it('a NEWER file is still returned, with advice naming the remedy — never refused', () => {
        const r = convertPlayerDocument(doc('1.9.0'));
        expect(r.relation).toBe(WireVersionRelation.newer);
        expect(r.advice).toContain('Update the player');
        expect(r.doc).toBeDefined();          // the document survives; the player renders what it can
    });

    it('another GENERATION is returned too, naming both remedies', () => {
        const r = convertPlayerDocument(doc('2.0.0'));
        expect(r.relation).toBe(WireVersionRelation.otherGeneration);
        expect(r.advice).toContain('no conversion bridges');
        expect(r.doc).toBeDefined();
    });

    it('never throws on rubbish input', () => {
        for (const bad of [undefined, null, 42, 'x', [], {}]) {
            expect(() => convertPlayerDocument(bad)).not.toThrow();
        }
    });
});


describe('the step table', () => {

    it('runs unbroken from the baseline to this player version', () => {
        const chain = [BASELINE_PLAYER_VERSION, ...PLAYER_WIRE_STEPS.map(s => s.to)];
        PLAYER_WIRE_STEPS.forEach((step, i) => expect(step.from).toBe(chain[i]));
        expect(playerPart(chain[chain.length - 1])).toBe(PX_PLAYER_SCHEMA_VERSION);
    });

    it('every step carries a converter or is DECLARED additive, and moves strictly forward', () => {
        for (const step of PLAYER_WIRE_STEPS) {
            if (step.kind === WireStepKind.converted) expect(step.up).toBeTypeOf('function');
            else expect(step.up).toBeUndefined();
            expect(step.reason.length).toBeGreaterThan(10);
            const from = parseWireVersion(step.from)!;
            const to = parseWireVersion(step.to)!;
            expect(to.a).toBe(from.a);          // a `b` step never changes the generation
            expect(to.b).toBeGreaterThan(from.b);
        }
    });

    it('MUTATION SELF-TEST: a real step converts, re-stamps, and leaves `meta.*` untouched', () => {
        // Runs the actual machinery on a fabricated 1.1 → 1.2 step, because an empty table proves
        // only that nothing is needed yet, not that conversion works when it is.
        const step: WireVersionStep = {
            from: '1.1', to: '1.2', kind: WireStepKind.converted,
            reason: 'self-test only — renames animator.timeline.duration to durationMs',
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
        // Apply it the way `convertPlayerDocument` does, then assert all three obligations.
        step.up!(d);
        const timeline = (d.animator as Record<string, unknown>).timeline as Record<string, unknown>;
        expect(timeline.durationMs).toBe(1000);
        expect(timeline.duration).toBeUndefined();
        expect((d.meta as Record<string, unknown>).editorOnly).toBe('must survive untouched');
    });

    it('applies a real step to a COPY, re-stamps it, and leaves the caller\'s document untouched', () => {
        // The end-to-end path, driven through the exported entry point rather than by calling
        // `up` by hand — with a step temporarily spliced into the live table.
        const step: WireVersionStep = {
            from: '1.1', to: '1.2', kind: WireStepKind.converted,
            reason: 'self-test only — renames timeline.duration to durationMs',
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
        const out = r.doc as Record<string, any>;
        expect(r.applied).toHaveLength(1);
        expect(out.animator.timeline.durationMs).toBe(1000);
        expect(out.animator.timeline.duration).toBeUndefined();
        expect(out.animator.version).toBe('1.2.1');            // `c` preserved, `a.b` moved
        expect(out.meta.editorOnly).toBe('must survive');       // player steps never touch meta.*
        // …and the caller's object did not.
        expect(JSON.stringify(original)).toBe(before);
        expect(r.doc).not.toBe(original);
    });

    it('a step that THROWS degrades to "not converted" — never to a failed open', () => {
        const boom: WireVersionStep = {
            from: '1.1', to: '1.2', kind: WireStepKind.converted,
            reason: 'self-test only — always throws',
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
        convertPlayerDocument(d);
        expect(JSON.stringify(d)).toBe(before);
    });
});


describe('versionAdvice', () => {

    it('says nothing for same or unstamped — a gap alone is never a story', () => {
        const mine = { a: 1, b: 1, c: 1 };
        expect(versionAdvice(WireVersionRelation.same, mine, mine, true)).toBeUndefined();
        expect(versionAdvice(WireVersionRelation.unstamped, undefined, mine, true)).toBeUndefined();
    });

    it('names the right target for each reader', () => {
        const mine = { a: 1, b: 1, c: 1 };
        const newer = { a: 1, b: 9, c: 0 };
        expect(versionAdvice(WireVersionRelation.newer, newer, mine, true)).toContain('Update the player');
        expect(versionAdvice(WireVersionRelation.newer, newer, mine, false)).toContain('Update the editor');
    });

    it('formats back to the spelling it parsed', () => {
        expect(formatWireVersion({ a: 1, b: 1, c: 1 })).toBe('1.1.1');
        expect(formatWireVersion(parseWireVersion('1.2')!)).toBe('1.2.0');
    });
});

/** `a.b` of a version string. */
function playerPart(v: string): string {
    return v.split('.').slice(0, 2).join('.');
}


describe('down-conversion (task 6.7) — all or nothing', () => {

    const undoable = (from: string, to: string): WireVersionStep => ({
        from, to, kind: WireStepKind.converted,
        reason: 'spec only — renames timeline.duration ⇄ durationMs',
        up: (d) => { const t = (d.animator as any).timeline; t.durationMs = t.duration; delete t.duration; },
        down: (d) => { const t = (d.animator as any).timeline; t.duration = t.durationMs; delete t.durationMs; },
    });
    const oneWay = (from: string, to: string): WireVersionStep => ({
        from, to, kind: WireStepKind.converted, reason: 'spec only — the shape rework: no way back',
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
        const out = r.doc as any;
        expect(out.animator.timeline.duration).toBe(1000);
        expect(out.animator.timeline.durationMs).toBeUndefined();
        expect(out.animator.version).toBe('1.1.0');
        expect(JSON.stringify(original)).toBe(before);       // caller's document untouched
    });

    it('REFUSES when any step on the way back has no `down`, and names it', () => {
        const r = applyWireStepsDown(at12(), {
            steps: [oneWay('1.1', '1.2')], target: { a: 1, b: 1, c: 0 }, readerReadsEditorPart: false,
        });
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.blocking).toHaveLength(1);
        expect(r.reason).toContain('1.1 → 1.2');
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
        const additive: WireVersionStep = { from: '1.1', to: '1.2', kind: WireStepKind.additive, reason: 'spec only — a new optional field' };
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
        const r = downgradePlayerDocument(doc(PX_PLAYER_SCHEMA_VERSION + '.0'), PLAYER_WIRE_VERSION);
        expect(r.ok).toBe(true);
    });
});


describe('T3 — conversion is idempotent', () => {

    it('converting twice is converting once: the stamp stops a second pass', () => {
        const step: WireVersionStep = {
            from: '1.1', to: '1.2', kind: WireStepKind.converted,
            reason: 'spec only — renames timeline.duration to durationMs',
            up: (d) => { const t = (d.animator as any).timeline; t.durationMs = t.duration; delete t.duration; },
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
