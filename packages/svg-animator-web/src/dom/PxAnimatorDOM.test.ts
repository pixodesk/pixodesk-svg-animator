/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { describe, expect, it } from 'vitest';
import { renderNode } from './PxAnimatorDOM';
import type { PxNode } from '@pixodesk/svg-animator-core';

describe('renderNode — text content', () => {
    it('renders `textContent` as the element text, never as an attribute', () => {
        const el = renderNode({ type: 'text', textContent: 'Hello' } as PxNode) as SVGElement;
        expect(el.textContent).toBe('Hello');
        expect(el.getAttribute('textContent')).toBeNull();
    });

    it('`text` is not a text-content key — nothing is rendered from it', () => {
        const el = renderNode({ type: 'text', text: 'Hello' } as unknown as PxNode) as SVGElement;
        expect(el.textContent).toBe('');
    });

    it('a node with child nodes keeps its children and does not also render its own `textContent`', () => {
        // The shape the editor writes for a one-span line: the line <tspan> carries its folded
        // text AND the styled child span. The children are what renders (the rule every player
        // follows); setting the parent's own text would wipe the styled span out.
        const el = renderNode({
            type: 'text',
            children: [{
                type: 'tspan', textContent: 'Hi',
                children: [{ type: 'tspan', fill: '#ff0000', textContent: 'Hi' }],
            }],
        } as PxNode) as SVGElement;

        const inner = el.querySelector('tspan > tspan');
        expect(inner).not.toBeNull();
        expect(inner!.getAttribute('fill')).toBe('#ff0000');
        expect(el.textContent).toBe('Hi');
    });
});

describe('renderNode — feFunc type attribute', () => {
    // The lightweight-JSON `type` key is the node tag, so feFunc's SVG `type`
    // attribute (identity/table/…) travels under `domType` and must be restored
    // onto the real `type` attribute — otherwise a feComponentTransfer can't invert.
    it('restores feFuncA `domType` onto the `type` attribute', () => {
        const node = { type: 'feFuncA', domType: 'table', tableValues: '1.0 0.0' } as unknown as PxNode;
        const el = renderNode(node) as SVGElement;

        expect(el.tagName.toLowerCase()).toBe('fefunca');
        expect(el.getAttribute('type')).toBe('table');
        expect(el.getAttribute('tableValues')).toBe('1.0 0.0');
        expect(el.getAttribute('domType')).toBeNull(); // the escape key must not leak through
    });

    it('renders a full feComponentTransfer alpha-invert filter', () => {
        const node = {
            type: 'filter', id: 'f1',
            children: [{
                type: 'feComponentTransfer', in: 'SourceGraphic',
                children: [{ type: 'feFuncA', domType: 'table', tableValues: '1 0' }],
            }],
        } as unknown as PxNode;
        const el = renderNode(node) as SVGElement;

        const feFuncA = el.querySelector('feFuncA');
        expect(feFuncA).toBeTruthy();
        expect(feFuncA!.getAttribute('type')).toBe('table');
        expect(feFuncA!.getAttribute('tableValues')).toBe('1 0');
    });
});
