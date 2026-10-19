/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/
// The Editor's SVG + JS export calls `${PX_PLAYER_GLOBAL}.${PX_PLAYER_BIND}(…)` and inlines one of the three `<script>`
// builds — or leaves the full one to the page: each entry must export `bind`, or every exported file stops playing.
// `create` renders a document into a container: the full build only (first-use review §8: one name, one function).
import { describe, expect, it } from 'vitest';
import * as player from '../index.player';
import * as prerendered from '../index.prerendered';
import * as prerenderedWaapi from '../index.prerendered-waapi';
import { PX_PLAYER_BIND, PX_PLAYER_CREATE } from './PxPlayerGlobal';

describe('the <script> builds expose PX_PLAYER_BIND; only the full one PX_PLAYER_CREATE', () => {
    it('index.player: bind and create', () => {
        expect(Object.keys(player)).toEqual(expect.arrayContaining([PX_PLAYER_BIND, PX_PLAYER_CREATE]));
    });
    for (const [name, entry] of [['prerendered', prerendered], ['prerendered-waapi', prerenderedWaapi]] as const) {
        it(`index.${name}: bind, no create`, () => {
            expect(Object.keys(entry)).toContain(PX_PLAYER_BIND);
            expect(Object.keys(entry)).not.toContain(PX_PLAYER_CREATE);
        });
    }
});
