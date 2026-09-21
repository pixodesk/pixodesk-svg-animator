/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// THE parity guard: whatever the web player renders for a document, this component renders too.
//
// All DOM players render through core's `renderPxTree` and differ only in how an element is
// created, so they cannot disagree about a document — and this proves it, document by document,
// for every file in the shared corpus. Before that was true the components carried renderers of
// their own, which had drifted: effects never materialized (empty canvas), camelCase attribute
// names SVG ignores (`maskType`; in Vue every presentation attribute), the `domType` escape key
// written as a literal attribute (filters painted black), CSS-only properties as dead attributes.
//
// A failure here means a rule was added to one player only. Fix the shared renderer, not the test.

import { prepareDocumentForRender } from '@pixodesk/svg-animator-core/internal';
import { renderNode, type PxAnimatedSvgDocument } from '@pixodesk/svg-animator-web';
import { cleanup, render } from "@testing-library/vue";
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PixodeskSvgAnimator from './PixodeskSvgAnimator';


const SAMPLES_DIR = path.resolve(__dirname, '../../svg-animator-web/e2e');
const CORPUS_DIRS: ReadonlyArray<string> = [SAMPLES_DIR, path.join(SAMPLES_DIR, 'parity-corpus')];

const corpus: Array<{ name: string; file: string }> = CORPUS_DIRS.flatMap(dir =>
    readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'tsconfig.json').sort()
        .map(f => ({ name: path.relative(SAMPLES_DIR, path.join(dir, f)), file: path.join(dir, f) })));

/**
 * The tree as text — one line per element, attributes sorted. Generated ids are replaced by
 * their order of first appearance (in attributes AND in text, where a `<style>` carries
 * `url(#id)`), because each render mints its own.
 */
function dumpTree(root: Element): string {
    const ids = new Map<string, string>();
    const norm = (v: string): string => v.replace(/_px_[a-z0-9]+/g, id => {
        if (!ids.has(id)) ids.set(id, 'ID' + ids.size);
        return ids.get(id) ?? id;
    });
    const lines: Array<string> = [];
    const walk = (el: Element, depth: number): void => {
        const attrs = Array.from(el.attributes).map(a => a.name + '="' + norm(a.value) + '"').sort().join(' ');
        const text = el.children.length === 0 && el.textContent ? ' | ' + norm(el.textContent) : '';
        lines.push('  '.repeat(depth) + '<' + el.tagName + (attrs ? ' ' + attrs : '') + '>' + text);
        for (const child of Array.from(el.children)) walk(child, depth + 1);
    };
    walk(root, 0);
    return lines.join('\n');
}


describe('parity with the web player', () => {
    afterEach(() => cleanup());

    it('has a corpus to check', () => {
        // An empty glob would make every test below pass by checking nothing.
        expect(corpus.length).toBeGreaterThanOrEqual(8);
    });

    it.each(corpus)('renders $name exactly as the web player does', ({ file }) => {
        const doc: PxAnimatedSvgDocument = JSON.parse(readFileSync(file, 'utf8'));
        // jsdom has no WAAPI, so building the player reports it — not what is under test here.
        const quiet = [vi.spyOn(console, 'error').mockImplementation(() => { }), vi.spyOn(console, 'warn').mockImplementation(() => { })];

        const webRoot = renderNode(prepareDocumentForRender(doc));
        const ownRoot = render(PixodeskSvgAnimator, { props: { doc } }).container.querySelector('svg');
        quiet.forEach(spy => spy.mockRestore());

        expect(webRoot, 'the web player renders it').not.toBeNull();
        expect(ownRoot, 'the component renders it').not.toBeNull();
        if (!webRoot || !ownRoot) return;
        expect(dumpTree(ownRoot)).toBe(dumpTree(webRoot));
    });
});
