/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// THE PLAYER SHIP-GUARD (task 5.1): a wire key may not LEAVE the player schema unnoticed.
//
// WHEN THIS FAILS — do not just regenerate. Read which key moved:
//   · removed / renamed → some file still says the old name: add the conversion step to
//     `PLAYER_WIRE_STEPS` (and bump `PX_PLAYER_SCHEMA_VERSION`), or — pre-release — migrate the
//     repo fixtures; THEN regenerate.
//   · added → the safe half. Regenerate with `PX_REGEN_FIELD_UNIVERSE=1 npx vitest run
//     src/version/PxSchemaFieldUniverse.test.ts` and commit the diff: it is the reviewable record.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PxAnimatedSvgDocumentSchema } from '../format/PxAnimatorTypes';
import { schemaFieldUniverse } from './PxSchemaFieldUniverse';

const SNAPSHOT = resolve(__dirname, 'schema-field-universe.player.json');
const live = schemaFieldUniverse(PxAnimatedSvgDocumentSchema);

/** Explicit opt-in, so a normal run never rewrites the baseline it is checked against. */
const shouldRegenerate = (): boolean => process.env.PX_REGEN_FIELD_UNIVERSE === '1';

describe('player wire-key inventory', () => {

    if (shouldRegenerate()) {
        it('REGENERATES the committed snapshot', () => {
            writeFileSync(SNAPSHOT, JSON.stringify(live, null, 1) + '\n');
        });
        return;
    }

    const snapshot: Array<string> = JSON.parse(readFileSync(SNAPSHOT, 'utf8'));

    it('no key LEFT the player schema without the snapshot being moved deliberately', () => {
        const liveSet = new Set(live);
        expect(snapshot.filter(id => !liveSet.has(id))).toEqual([]);
    });

    it('the committed snapshot lists every key the player schema carries', () => {
        const snapSet = new Set(snapshot);
        expect(live.filter(id => !snapSet.has(id))).toEqual([]);
    });

    it('is a plausible inventory — canonical, sorted, and not exploded', () => {
        // Guards the MECHANISM: an empty universe passes both checks above vacuously, and a
        // walker that re-lists recursive schemas at every path buries a rename in noise.
        expect(snapshot.length).toBeGreaterThan(100);
        expect(snapshot.length).toBeLessThan(600);
        expect([...snapshot].sort()).toEqual(snapshot);
        expect(snapshot).toContain('effects.textPath.pathData');
        expect(snapshot).toContain('effects.maskedBy.source');
    });

    it('MUTATION SELF-TEST: the historical renames are named, not merely counted', () => {
        // Replays the three renames that shipped silently against the REAL check: a snapshot
        // still saying the old names must report exactly those names as vanished.
        const liveSet = new Set(live);
        const stale = [...snapshot, 'effects.textPath.path', 'effects.maskedBy.sourceId'].sort();
        expect(stale.filter(id => !liveSet.has(id)).sort())
            .toEqual(['effects.maskedBy.sourceId', 'effects.textPath.path']);
    });
});
