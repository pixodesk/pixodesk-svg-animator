/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { describe, expect, it } from 'vitest';
import { renderNode } from './PxAnimatorDOM';
import type { PxNode } from '@pixodesk/svg-animator-core';

describe('renderNode — feFunc type attribute', () => {
    // The lightweight-JSON `type` key is the node tag, so feFunc's SVG `type`
    // attribute (identity/table/…) travels under `funcType` and must be restored
    // onto the real `type` attribute — otherwise a feComponentTransfer can't invert.
    it('restores feFuncA `funcType` onto the `type` attribute', () => {
        const node = { type: 'feFuncA', funcType: 'table', tableValues: '1.0 0.0' } as unknown as PxNode;
        const el = renderNode(node) as SVGElement;

        expect(el.tagName.toLowerCase()).toBe('fefunca');
        expect(el.getAttribute('type')).toBe('table');
        expect(el.getAttribute('tableValues')).toBe('1.0 0.0');
        expect(el.getAttribute('funcType')).toBeNull(); // the escape key must not leak through
    });

    it('renders a full feComponentTransfer alpha-invert filter', () => {
        const node = {
            type: 'filter', id: 'f1',
            children: [{
                type: 'feComponentTransfer', in: 'SourceGraphic',
                children: [{ type: 'feFuncA', funcType: 'table', tableValues: '1 0' }],
            }],
        } as unknown as PxNode;
        const el = renderNode(node) as SVGElement;

        const feFuncA = el.querySelector('feFuncA');
        expect(feFuncA).toBeTruthy();
        expect(feFuncA!.getAttribute('type')).toBe('table');
        expect(feFuncA!.getAttribute('tableValues')).toBe('1 0');
    });
});
