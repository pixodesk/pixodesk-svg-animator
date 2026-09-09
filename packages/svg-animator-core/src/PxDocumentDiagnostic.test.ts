/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

/**
 * The entry diagnostic has exactly one job: make a SILENT failure audible.
 *
 * The two ways it can fail are symmetrical, and both are tested here — staying quiet when a
 * consumer's build mangled the keys (the bug it exists for), and crying wolf on a legacy-but-
 * supported document (which would train people to ignore the channel).
 */
import { describe, expect, it, vi } from 'vitest';
import { diagnoseDocument, reportDocumentDiagnostics } from './PxDocumentDiagnostic';

/** The current wire spelling — nothing to report. */
const sound = {
    type: 'svg',
    animator: { timeline: { duration: 1000, frameRate: 30, trigger: { startOn: 'load' } } },
    children: [{ type: 'rect', id: 'r', width: 10, height: 10 }],
};

/** What a property-mangling build produces: the wire keys renamed to short internal names. */
const mangled = {
    type: 'svg',
    animator: { timeline: { a: 1000, b: { c: 'load' } } },
    children: [{ type: 'rect', id: 'r' }],
};

/** The pre-2026-09 flat spelling — still accepted, still plays, must NOT be reported. */
const legacyFlat = {
    type: 'svg',
    animator: { duration: 1000, trigger: { startOn: 'load' }, fill: 'both', resetOnFinish: true },
    children: [{ type: 'rect', id: 'r' }],
};

describe('diagnoseDocument', () => {

    it('says nothing about a document in the current wire spelling', () => {
        expect(diagnoseDocument(sound)).toEqual({ problems: [], legacy: [] });
    });

    it('reports mangled keys as PROBLEMS', () => {
        const { problems, legacy } = diagnoseDocument(mangled);
        expect(problems.length).toBeGreaterThan(0);
        expect(legacy).toEqual([]);
    });

    it('classifies the legacy flat spelling as legacy, NOT a problem', () => {
        const { problems, legacy } = diagnoseDocument(legacyFlat);
        expect(problems).toEqual([]);              // it plays correctly — crying wolf here is the bug
        expect(legacy.length).toBeGreaterThan(0);
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

    it('is SILENT on a sound document and on a legacy flat one', () => {
        expect(captured(sound)).toBe('');
        expect(captured(legacyFlat)).toBe('');
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
