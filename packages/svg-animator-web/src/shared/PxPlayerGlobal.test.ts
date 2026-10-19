/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/
// The Editor's SVG + JS export calls `${PX_PLAYER_GLOBAL}.${PX_PLAYER_CREATE}(…)` and inlines one of the three `<script>`
// builds: each of their entries must export a member of that name, or every exported file stops playing.
import { describe, expect, it } from 'vitest';
import * as player from '../index.player';
import * as prerendered from '../index.prerendered';
import * as prerenderedWaapi from '../index.prerendered-waapi';
import { PX_PLAYER_CREATE } from './PxPlayerGlobal';

describe('the <script> builds expose PX_PLAYER_CREATE', () => {
    for (const [name, entry] of [['player', player], ['prerendered', prerendered], ['prerendered-waapi', prerenderedWaapi]] as const) {
        it(`index.${name}`, () => {
            expect(Object.keys(entry)).toContain(PX_PLAYER_CREATE);
        });
    }
});
