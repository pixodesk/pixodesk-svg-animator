/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// Tasks 5.3 / 5.4 — the bump rule and the release log. The CLI runs exactly these functions,
// so what is proven here is what the release tool does.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PX_WIRE_SCHEMA_VERSION } from './PxSchemaVersion';
import { diffFieldUniverse, planSchemaRelease, releaseLogProblems, type SchemaReleaseRecord } from './PxSchemaRelease';
import { PX_WIRE_BASELINE_VERSION, PX_WIRE_STEPS, PxWireStepKind, type PxWireVersionStep } from './PxWireVersion';

const releases: Array<SchemaReleaseRecord> = JSON.parse(readFileSync(resolve(__dirname, 'schema-releases.player.json'), 'utf8'));

const step = (to: string, kind: PxWireStepKind): PxWireVersionStep => ({
    from: '1.1', to, kind, reason: 'spec only — a fabricated step',
    ...(kind === PxWireStepKind.converted ? { up: () => { /* spec */ } } : {}),
});

describe('the release log (5.4)', () => {

    it('the REAL log is consistent: baseline first, ends at the declared version', () => {
        expect(releaseLogProblems(releases, PX_WIRE_STEPS, PX_WIRE_SCHEMA_VERSION, PX_WIRE_BASELINE_VERSION)).toEqual([]);
    });

    it('MUTATION SELF-TEST: a bump with no changelog entry is named', () => {
        const problems = releaseLogProblems(releases, [step('1.2', PxWireStepKind.additive)], '1.2', PX_WIRE_BASELINE_VERSION);
        expect(problems.join(' ')).toContain('last release record is 1.1');
    });

    it('a release with no step, or a removal logged under an additive step, is named', () => {
        const log: Array<SchemaReleaseRecord> = [...releases,
            { version: '1.2', date: '2026-10-01', added: [], removed: ['effects.x'] }];
        expect(releaseLogProblems(log, [], '1.2', PX_WIRE_BASELINE_VERSION).join(' ')).toContain('no PX_WIRE_STEPS entry');
        expect(releaseLogProblems(log, [step('1.2', PxWireStepKind.additive)], '1.2', PX_WIRE_BASELINE_VERSION).join(' '))
            .toContain('not `converted`');
    });
});

describe('the bump rule (5.3) — the diff decides, not a person', () => {

    it('diffs inventories into added / removed, sorted', () => {
        expect(diffFieldUniverse(['a', 'b', 'c'], ['a', 'c', 'd', 'e'])).toEqual({ added: ['d', 'e'], removed: ['b'] });
    });

    it('no key change → nothing to bump', () => {
        const plan = planSchemaRelease({ added: [], removed: [], declared: '1.1', lastReleased: '1.1', steps: [] });
        expect(plan.changed).toBe(false);
        expect(plan.refuse).toBeUndefined();
    });

    it('a key change WITHOUT a bump is refused, and the message names the version to set', () => {
        const plan = planSchemaRelease({ added: ['effects.newThing'], removed: [], declared: '1.1', lastReleased: '1.1', steps: [] });
        expect(plan.refuse).toContain('Set it to 1.2');
        expect(plan.requiredKind).toBe(PxWireStepKind.additive);
    });

    it('an ADDED key with the bump and an additive step is releasable', () => {
        const plan = planSchemaRelease({
            added: ['effects.newThing'], removed: [], declared: '1.2', lastReleased: '1.1',
            steps: [step('1.2', PxWireStepKind.additive)],
        });
        expect(plan.refuse).toBeUndefined();
    });

    it('a REMOVED key is never additive — refused until the step converts', () => {
        const plan = planSchemaRelease({
            added: [], removed: ['effects.textPath.path'], declared: '1.2', lastReleased: '1.1',
            steps: [step('1.2', PxWireStepKind.additive)],
        });
        expect(plan.refuse).toContain('never additive');
        expect(planSchemaRelease({
            added: [], removed: ['effects.textPath.path'], declared: '1.2', lastReleased: '1.1',
            steps: [step('1.2', PxWireStepKind.converted)],
        }).refuse).toBeUndefined();
    });

    it('skipping a version is refused — one `b` step at a time', () => {
        const plan = planSchemaRelease({
            added: ['x'], removed: [], declared: '1.3', lastReleased: '1.1', steps: [step('1.3', PxWireStepKind.additive)],
        });
        expect(plan.refuse).toContain('Set it to 1.2');
    });
});
