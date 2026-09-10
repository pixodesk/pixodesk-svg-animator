/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// ============================================================================
// SCHEMA RELEASES (tasks 5.3 / 5.4) — the decision "does this release move the schema
// version, and which part?" made by the DIFF, not by a person, plus the dated log of every
// release kept beside the step table (`schema-releases.player.json`).
//
// Pure functions, so the release CLI (`scripts/schema-release.mjs`) and the guard test run the
// SAME rule — a CLI and a test that each re-implement it are two rules that drift apart.
//
// The diff is over the canonical field inventory (`schemaFieldUniverse`): key paths only, so
// descriptions and comments can never make two identical schemas look different.
// ============================================================================

import { parseWireVersion, WireStepKind, type WireVersionStep } from './PxWireVersion';

/** One entry of the release log — what shipped, when, and what it changed. */
export interface SchemaReleaseRecord {
    readonly version: string;
    /** ISO date, `YYYY-MM-DD`. */
    readonly date: string;
    /** The first release: nothing to compare it against. */
    readonly baseline?: boolean;
    readonly added: ReadonlyArray<string>;
    readonly removed: ReadonlyArray<string>;
    readonly note?: string;
}

/** Keys that appeared and keys that left between two inventories, each sorted. */
export function diffFieldUniverse(
    previous: ReadonlyArray<string>, current: ReadonlyArray<string>,
): { added: Array<string>; removed: Array<string> } {
    const prev = new Set(previous);
    const cur = new Set(current);
    return {
        added: current.filter(k => !prev.has(k)).sort(),
        removed: previous.filter(k => !cur.has(k)).sort(),
    };
}

/** What a release must do about the version. `refuse` set means: do not release as-is. */
export interface SchemaReleasePlan {
    /** Did any key appear or leave since the last release? */
    readonly changed: boolean;
    /** Which kind of step the change requires — a removal is never additive. */
    readonly requiredKind?: WireStepKind;
    /** The version this release must carry. */
    readonly requiredVersion?: string;
    readonly refuse?: string;
}

/**
 * THE BUMP RULE. A key change requires `b + 1` and a step that explains it; no key change
 * requires nothing. The rule never picks the number by taste — the inventory diff does.
 */
export function planSchemaRelease(p: {
    readonly added: ReadonlyArray<string>;
    readonly removed: ReadonlyArray<string>;
    /** `PX_PLAYER_SCHEMA_VERSION` — what the source says now. */
    readonly declared: string;
    /** The version of the last release record. */
    readonly lastReleased: string;
    readonly steps: ReadonlyArray<WireVersionStep>;
}): SchemaReleasePlan {
    const changed = p.added.length > 0 || p.removed.length > 0;
    const last = parseWireVersion(p.lastReleased);
    const declared = parseWireVersion(p.declared);
    if (!last || !declared) return { changed, refuse: 'Unparseable version: ' + p.lastReleased + ' / ' + p.declared + '.' };

    const requiredVersion = last.a + '.' + (last.b + 1);
    if (!changed) {
        // Same keys: nothing to bump. A bump anyway is a SEMANTIC change and still needs its step.
        if (declared.b === last.b && declared.a === last.a) return { changed };
        const step = p.steps.find(s => s.to === p.declared);
        return step ? { changed, requiredVersion: p.declared }
            : { changed, refuse: 'The version moved to ' + p.declared + ' with no key change and no step explaining it.' };
    }

    const requiredKind = p.removed.length ? WireStepKind.converted : WireStepKind.additive;
    const summary = p.added.length + ' key(s) added, ' + p.removed.length + ' removed';
    if (declared.a !== last.a || declared.b !== last.b + 1) {
        return {
            changed, requiredKind, requiredVersion,
            refuse: 'The player schema changed (' + summary + ') but PX_PLAYER_SCHEMA_VERSION is '
                + p.declared + '. Set it to ' + requiredVersion + ' and add the PLAYER_WIRE_STEPS entry.',
        };
    }
    const step = p.steps.find(s => s.to === p.declared);
    if (!step) {
        return { changed, requiredKind, requiredVersion, refuse: 'No PLAYER_WIRE_STEPS entry reaches ' + p.declared + '.' };
    }
    if (requiredKind === WireStepKind.converted && step.kind !== WireStepKind.converted) {
        return {
            changed, requiredKind, requiredVersion,
            refuse: 'Keys were REMOVED (' + p.removed.join(', ') + '), which is never additive — the '
                + p.declared + ' step must be `converted`, with an up().',
        };
    }
    return { changed, requiredKind, requiredVersion };
}

/**
 * Everything wrong with the release log, as sentences — empty when it is consistent. The log
 * must start at the baseline, move strictly forward, END at the version the source declares,
 * and every release after the baseline must have the step that explains it.
 */
export function releaseLogProblems(
    releases: ReadonlyArray<SchemaReleaseRecord>, steps: ReadonlyArray<WireVersionStep>,
    declared: string, baseline: string,
): Array<string> {
    const problems: Array<string> = [];
    if (!releases.length) return ['The release log is empty.'];
    if (!releases[0].baseline || releases[0].version !== baseline) {
        problems.push('The first release must be the baseline ' + baseline + '.');
    }
    for (let i = 1; i < releases.length; i++) {
        const prev = parseWireVersion(releases[i - 1].version);
        const cur = parseWireVersion(releases[i].version);
        if (!prev || !cur || cur.a !== prev.a || cur.b !== prev.b + 1) {
            problems.push('Release ' + releases[i].version + ' does not follow ' + releases[i - 1].version + ' by one `b` step.');
        }
        if (releases[i].date < releases[i - 1].date) problems.push('Release ' + releases[i].version + ' is dated before its predecessor.');
        const step = steps.find(s => s.to === releases[i].version);
        if (!step) problems.push('Release ' + releases[i].version + ' has no PLAYER_WIRE_STEPS entry.');
        else if (releases[i].removed.length && step.kind !== WireStepKind.converted) {
            problems.push('Release ' + releases[i].version + ' removed keys, but its step is not `converted`.');
        }
    }
    const latest = releases[releases.length - 1].version;
    if (latest !== declared) {
        problems.push('PX_PLAYER_SCHEMA_VERSION is ' + declared + ' but the last release record is ' + latest
            + ' — a bump needs its changelog entry (run scripts/schema-release.mjs --apply).');
    }
    return problems;
}
