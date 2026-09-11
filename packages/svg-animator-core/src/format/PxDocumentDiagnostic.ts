/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

/**
 * THE ENTRY DIAGNOSTIC — how a consumer whose build renamed our keys finds out.
 *
 * Property mangling across the document boundary fails SILENTLY: the keys no longer match, the
 * player reads an empty configuration rather than an invalid one, and the animation renders a
 * blank canvas with nothing in the console. That is the failure this exists to name.
 *
 * It is a DIAGNOSTIC, not a gate. Nothing is rejected — the player still does its best with
 * whatever it can read, exactly as before.
 *
 * What it can and cannot see (MINIFICATION-BOUNDARY-PLAN §3):
 *   - keyframes, the animator block and every effect are strict `px.object`, so an unexpected
 *     key there IS detectable;
 *   - nodes are `px.openObject`, so an unknown attribute on a node is indistinguishable from a
 *     legitimate SVG attribute. The diagnostic therefore keys off the strict parts.
 */
import { validateDocument } from './PxAnimatorTypes';

/** How many problems to print before summarising the rest. A wall of text gets scrolled past. */
const MAX_REPORTED = 6;

/**
 * A document's schema findings. The pre-2026-09 FLAT animator spelling is NOT a category of its
 * own: those keys are no longer read (`getAnimatorConfig` drops them), so a document still
 * carrying them is reported like any other unrecognised key — silence would hide a file that
 * plays with its playback settings ignored.
 */
export interface PxDocumentDiagnosis {
    /** Findings worth showing — unrecognised keys and shape violations. */
    problems: Array<string>;
}

/** Pure: collect a document's schema findings. Never throws. */
export function diagnoseDocument(doc: unknown): PxDocumentDiagnosis {
    try {
        return { problems: validateDocument(doc) };
    } catch {
        return { problems: [] };   // a diagnostic must never be the thing that breaks
    }
}

/**
 * Runs the diagnosis and reports it on the console, naming property mangling as the likely cause
 * — a bare "unexpected extra key" leaves the reader no wiser, which is the whole point.
 *
 * `where` names the entry the document came in through, so the message says which call to look at.
 */
export function reportDocumentDiagnostics(doc: unknown, where: string): void {
    const { problems } = diagnoseDocument(doc);
    if (!problems.length) return;

    const shown = problems.slice(0, MAX_REPORTED);
    const more = problems.length - shown.length;
    console.warn(
        where + ': this document does not match the animation schema in '
        + problems.length + ' place' + (problems.length === 1 ? '' : 's') + '.\n'
        + shown.map(p => '  - ' + p).join('\n')
        + (more > 0 ? '\n  … and ' + more + ' more' : '')
        + '\n\nIf you did not author these keys, the usual cause is a build that MANGLES PROPERTY '
        + 'NAMES. An animation document is data loaded at runtime, so renaming the property reads '
        + 'inside the player stops them matching the keys in the JSON, and the animation silently '
        + 'does nothing. Feed the published reserved-name list to your minifier — '
        + '@pixodesk/svg-animator-web/mangle-reserved.json — see docs/library/minification.md.');
}
