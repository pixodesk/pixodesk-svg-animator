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
import { PX_TIME_ONLY_TIMELINE_KEYS, PX_TIMELINE_SHARED_KEYS } from './PxAnimatorConstants';
import { validateDocument } from './PxAnimatorTypes';

/** How many problems to print before summarising the rest. A wall of text gets scrolled past. */
const MAX_REPORTED = 6;

/**
 * The pre-2026-09 FLAT animator spelling. Still accepted on purpose (old files keep playing), so
 * seeing it is not a defect and must not be reported as one — it would cry wolf on every legacy
 * document and train people to ignore the channel.
 */
const LEGACY_FLAT_KEYS: ReadonlyArray<string> = [
    ...PX_TIMELINE_SHARED_KEYS, ...PX_TIME_ONLY_TIMELINE_KEYS,
    'fill', 'resetOnFinish', 'timelineSource', 'scroll',
];

const isLegacyFlatAnimatorKey = (w: string): boolean =>
    LEGACY_FLAT_KEYS.some(k => w.indexOf('animator.' + k + ':') >= 0);

/**
 * Splits the raw findings into the two things a reader has to tell apart: a document written in
 * the old-but-supported spelling, and one whose keys we simply do not recognise.
 */
export interface PxDocumentDiagnosis {
    /** Findings worth showing — unrecognised keys and shape violations. */
    problems: Array<string>;
    /** Findings that are just the legacy flat spelling, which still plays correctly. */
    legacy: Array<string>;
}

/** Pure: classify a document's schema findings. Never throws. */
export function diagnoseDocument(doc: unknown): PxDocumentDiagnosis {
    let all: Array<string>;
    try {
        all = validateDocument(doc);
    } catch {
        return { problems: [], legacy: [] };   // a diagnostic must never be the thing that breaks
    }
    const problems: Array<string> = [];
    const legacy: Array<string> = [];
    for (const w of all) (isLegacyFlatAnimatorKey(w) ? legacy : problems).push(w);
    return { problems, legacy };
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
