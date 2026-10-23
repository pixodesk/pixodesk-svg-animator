/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// The engine wiring lives on `/engine` only (first-use review §23): the main entry is the
// user-facing set, so no runtime name may be exported from both.
import { describe, expect, it } from 'vitest';
import * as engine from './engine';
import * as main from './index';

describe('the /engine entry', () => {
    it('shares no name with the main entry', () => {
        expect(Object.keys(engine).filter(name => name in main)).toEqual([]);
    });
});
