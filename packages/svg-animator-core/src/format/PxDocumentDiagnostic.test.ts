/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

/**
 * The entry diagnostic has exactly one job: make a SILENT failure audible.
 *
 * The way it fails is staying quiet when a consumer's build mangled the keys — the bug it exists
 * for. The pre-2026-09 flat spelling is no longer a special case: those keys are not read, so a
 * document still carrying them is reported like any other unrecognized key.
 */
import { describe, expect, it, vi } from 'vitest';
import { diagnoseDocument, reportDocumentDiagnostics } from './PxDocumentDiagnostic';
import { PxDiagnosticCode } from '../playback/PxDiagnosticCode';
import { createDiagnostics, PxDiagnosticKind } from '../playback/PxDiagnostics';

/** The current wire spelling — nothing to report. */
const sound = {
    type: 'svg',
    animator: { timeline: { outTime: 1000, frameRate: 30, actionTriggers: { start: 'load' } } },
    children: [{ type: 'rect', id: 'r', width: 10, height: 10 }],
};

/** What a property-mangling build produces: the wire keys renamed to short internal names. */
const mangled = {
    type: 'svg',
    animator: { timeline: { a: 1000, b: { c: 'load' } } },
    children: [{ type: 'rect', id: 'r' }],
};

/** The pre-2026-09 flat spelling — no longer read, so it MUST be reported. */
const flatSpelling = {
    type: 'svg',
    animator: { duration: 1000, actionTriggers: { start: 'load' }, fill: 'both', resetOnFinish: true },
    children: [{ type: 'rect', id: 'r' }],
};

describe('diagnoseDocument', () => {

    it('says nothing about a document in the current wire spelling', () => {
        expect(diagnoseDocument(sound)).toEqual({ problems: [] });
    });

    it('reports mangled keys as PROBLEMS', () => {
        expect(diagnoseDocument(mangled).problems.length).toBeGreaterThan(0);
    });

    it('reports the flat spelling — those keys are dropped on read, so the file plays without them', () => {
        const { problems } = diagnoseDocument(flatSpelling);
        expect(problems.length).toBeGreaterThan(0);
        expect(problems.join(' ')).toContain('animator.duration');
    });

    it('never throws, whatever it is handed', () => {
        for (const junk of [null, undefined, 5, 'x', [], { type: 99 }]) {
            expect(() => diagnoseDocument(junk)).not.toThrow();
        }
    });
});

describe('reportDocumentDiagnostics', () => {

    const captured = (doc: unknown): string => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        reportDocumentDiagnostics(doc, '[test]');
        const out = warn.mock.calls.map(c => c.join(' ')).join('\n');
        warn.mockRestore();
        return out;
    };

    it('is SILENT on a sound document, and speaks up on the flat spelling', () => {
        expect(captured(sound)).toBe('');
        expect(captured(flatSpelling)).toContain('animator.duration');
    });

    it('given a diagnostics channel it reports THROUGH it — kind document, code documentSchemaMismatch, the problems in data — and prints nothing itself', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const onWarn = vi.fn();
        reportDocumentDiagnostics(mangled, '[test]', createDiagnostics({ onWarn }));
        expect(warn).not.toHaveBeenCalled();
        expect(onWarn).toHaveBeenCalledTimes(1);
        const d = onWarn.mock.calls[0][0];
        expect(d.kind).toBe(PxDiagnosticKind.document);
        expect(d.code).toBe(PxDiagnosticCode.documentSchemaMismatch);
        expect(JSON.stringify(d.data)).toContain('MANGLES PROPERTY NAMES');
        // a sound document says nothing on either road
        reportDocumentDiagnostics(sound, '[test]', createDiagnostics({ onWarn }));
        expect(onWarn).toHaveBeenCalledTimes(1);
        warn.mockRestore();
    });

    it('names property mangling and points at the reserved list — a bare "extra key" helps nobody', () => {
        const out = captured(mangled);
        expect(out).toContain('[test]');
        expect(out).toContain('MANGLES PROPERTY NAMES');
        expect(out).toContain('mangle-reserved.json');
        expect(out).toContain('minification.md');
    });

    it('caps the list so a broken document cannot flood the console', () => {
        const many: Record<string, unknown> = {};
        for (let i = 0; i < 40; i++) many['k' + i] = 1;
        const out = captured({ type: 'svg', animator: { timeline: many } });
        expect(out).toContain('and ');
        expect(out.split('\n  - ').length - 1).toBeLessThanOrEqual(6);
    });
});
