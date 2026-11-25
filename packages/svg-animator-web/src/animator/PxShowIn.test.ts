/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// `effects.show` (1.33; `showIn` 1.31) — an element shown only while one of its flow steps is current, in any flow; hidden
// with its own inline `display: none`, at once. The full player (a tree) and the pre-rendered one (a binding) alike.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PxDocument, PxDocumentJson } from '@pixodesk/svg-animator-core';
import { createSvgAnimationPlayer } from '../index';
import { createPrerenderedAnimator } from '../engines/PxAnimatorBind';
import type { PxAnimationPlayerApi } from '../shared/PxAnimatorWebTypes';

/** Pages a · b on the default flow; a lamp flow off · on on its own timeline. */
function doc(children: PxDocument['children']): PxDocument {
    return {
        type: 'svg', viewBox: '0 0 10 10',
        animator: {
            timelines: [{ engine: 'js', outTime: 2000 }, { id: 'l', engine: 'js', outTime: 2000 }],
            flowSteps: [
                { id: 'a', timelineOptions: { inTime: 0, outTime: 1000 } }, { id: 'b', timelineOptions: { inTime: 1000, outTime: 2000 } },
                { id: 'off', flow: 'lamp', timeline: 'l', timelineOptions: { inTime: 0, outTime: 1000 } },
                { id: 'on', flow: 'lamp', timeline: 'l', timelineOptions: { inTime: 1000, outTime: 2000 } },
            ],
            flows: [{ id: 'lamp' }],
        },
        children,
    };
}

/** Shown: no inline `display: none` on the rendered element. */
const shownOf = (root: Element | null, selector: string): boolean => {
    const el = root?.querySelector(selector);
    if (!(el instanceof SVGElement)) throw new Error('no ' + selector);
    return el.style.display !== 'none';
};

describe('effects.show (1.33; showIn 1.31)', () => {
    let api: PxAnimationPlayerApi | undefined;
    beforeEach(() => {
        document.body.innerHTML = '<div id="box"></div>';
        vi.useFakeTimers({
            toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame'],
        });
    });
    afterEach(() => {
        api?.destroy();
        api = undefined;
        vi.useRealTimers();
    });

    it('shown only in its steps: hidden at once on the others, shown again on return; no attribute is written for it', () => {
        api = createSvgAnimationPlayer({ container: '#box', document: doc([
            { type: 'rect', id: 'pa', width: 2, height: 2, effects: { show: { when: { flowSteps: ['a'] } } } },
            { type: 'rect', id: 'pb', width: 2, height: 2, effects: { show: { when: { flowSteps: ['b'] } } } },
            { type: 'rect', id: 'always', width: 2, height: 2 },
        ]) });
        const root = api.getRootElement();
        expect([shownOf(root, 'rect:nth-of-type(1)'), shownOf(root, 'rect:nth-of-type(2)'), shownOf(root, 'rect:nth-of-type(3)')]).toEqual([true, false, true]);
        expect(root?.querySelector('[effects]')).toBeNull();
        api.flow.goTo({ flowStep: 'b' });
        expect([shownOf(root, 'rect:nth-of-type(1)'), shownOf(root, 'rect:nth-of-type(2)')]).toEqual([false, true]);
        api.flow.goTo({ flowStep: 'a' });
        expect([shownOf(root, 'rect:nth-of-type(1)'), shownOf(root, 'rect:nth-of-type(2)')]).toEqual([true, false]);
    });

    it('any listed step of any flow; a node with no id; an empty list is always shown', () => {
        api = createSvgAnimationPlayer({ container: '#box', document: doc([
            { type: 'circle', r: 1, effects: { show: { when: { flowSteps: ['b', 'on'] } } } },
            { type: 'ellipse', rx: 1, ry: 1, effects: { show: { when: { flowSteps: [] } } } },
        ]) });
        const root = api.getRootElement();
        expect(shownOf(root, 'circle')).toBe(false);          // at a and off
        api.flow.goTo({ flowStep: 'on' });
        expect(shownOf(root, 'circle')).toBe(true);           // the lamp's step
        api.flow.goTo({ flowStep: 'off' });
        api.flow.goTo({ flowStep: 'b' });
        expect(shownOf(root, 'circle')).toBe(true);           // the page's step
        expect(shownOf(root, 'ellipse')).toBe(true);
    });

    it('a flow the page does not run stays at its start step', () => {
        api = createSvgAnimationPlayer({ container: '#box', flows: ['default'], document: doc([
            { type: 'rect', id: 'lit', width: 2, height: 2, effects: { show: { when: { flowSteps: ['on'] } } } },
            { type: 'rect', id: 'dark', width: 2, height: 2, effects: { show: { when: { flowSteps: ['off'] } } } },
        ]) });
        const root = api.getRootElement();
        expect([shownOf(root, 'rect:nth-of-type(1)'), shownOf(root, 'rect:nth-of-type(2)')]).toEqual([false, true]);
    });

    it('while a step finishes its pass, its content stays until the flow lands', () => {
        const d = doc([{ type: 'rect', id: 'pa', width: 2, height: 2, effects: { show: { when: { flowSteps: ['a'] } } } }]);
        const steps = d.animator?.flowSteps;
        if (!steps) throw new Error('no steps');
        steps[0] = { ...steps[0], timelineOptions: { ...steps[0].timelineOptions, iterations: 'infinite', whenLeaving: 'animateToEnd' } };
        d.animator = { ...d.animator, actions: [{ name: 'timeline.start', triggers: [{ event: 'load' }] }] };
        api = createSvgAnimationPlayer({ container: '#box', document: d });
        const root = api.getRootElement();
        vi.advanceTimersByTime(300);
        api.flow.goTo({ flowStep: 'b' });
        expect(shownOf(root, 'rect')).toBe(true);
        vi.advanceTimersByTime(900);
        expect(api.flow.get()).toEqual(['b', 'off']);
        expect(shownOf(root, 'rect')).toBe(false);
    });

    it('pre-rendered: the list rides on the element\'s binding', () => {
        document.body.innerHTML = '<svg id="pic" viewBox="0 0 10 10"><rect id="x" style="display:none"/><rect id="y"/></svg>';
        const pre: PxDocumentJson = {
            id: 'pic', type: 'svg',
            animator: {
                timelines: [{ engine: 'js', outTime: 2000 }],
                flowSteps: [{ id: 'a', timelineOptions: { inTime: 0, outTime: 1000 } }, { id: 'b', timelineOptions: { inTime: 1000, outTime: 2000 } }],
                bindings: [{ element: '#x', animateWith: [], show: { when: { flowSteps: ['b'] } } }, { element: '#y', animateWith: [], show: { when: { flowSteps: ['a'] } } }],
            },
        };
        api = createPrerenderedAnimator({ document: pre });
        const root = document.getElementById('pic');
        expect([shownOf(root, '#x'), shownOf(root, '#y')]).toEqual([false, true]);
        api.flow.goTo({ flowStep: 'b' });
        expect([shownOf(root, '#x'), shownOf(root, '#y')]).toEqual([true, false]);
    });
});

// `effects.showOneChild` (1.33; `showOneOf` 1.32) — a group shows one of its children; hidden the same way as `show` (one shared hider)
describe('effects.showOneChild (1.33; showOneOf 1.32)', () => {
    let api: PxAnimationPlayerApi | undefined;
    beforeEach(() => {
        document.body.innerHTML = '<div id="box"></div>';
        vi.useFakeTimers({
            toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame'],
        });
    });
    afterEach(() => {
        api?.destroy();
        api = undefined;
        vi.useRealTimers();
    });

    /** A face: three mouths in a group; `when.index` as given. */
    const face = (index: number | string, extra: Record<string, unknown> = {}): PxDocument => ({
        type: 'svg', viewBox: '0 0 10 10',
        animator: { timelines: [{ engine: 'js', outTime: 1000 }], definitions: { variables: { mood: { type: 'number', defaultValue: 0 } } }, ...extra },
        children: [
            // `index` may be binding text: bindings are resolved before validation, so the type says number
            { type: 'g', id: 'mouth', effects: { showOneChild: { when: Object.assign({ index: 0 }, { index }) } }, children: [
                { type: 'rect', width: 1, height: 1 }, { type: 'rect', width: 2, height: 2 }, { type: 'rect', width: 3, height: 3 },
            ] },
        ],
    });
    const mouths = (): Array<boolean> => Array.from(document.querySelectorAll('#box g rect')).map(r => r instanceof SVGElement && r.style.display !== 'none');

    it('a position: the second child only; a fraction is rounded down; out of range — none', () => {
        api = createSvgAnimationPlayer({ container: '#box', document: face(1) });
        expect(mouths()).toEqual([false, true, false]);
        api.destroy();
        api = createSvgAnimationPlayer({ container: '#box', document: face(2.7) });
        expect(mouths()).toEqual([false, false, true]);
        api.destroy();
        api = createSvgAnimationPlayer({ container: '#box', document: face(5) });
        expect(mouths()).toEqual([false, false, false]);
    });

    it('a variable: picked by the page, again when it changes', () => {
        api = createSvgAnimationPlayer({ container: '#box', document: face('var(mood)'), variables: { mood: 2 } });
        expect(mouths()).toEqual([false, false, true]);
        api.variables.set('mood', 1);
        vi.advanceTimersByTime(50);
        expect(mouths()).toEqual([false, true, false]);
        api.variables.set('mood', 0);
        vi.advanceTimersByTime(50);
        expect(mouths()).toEqual([true, false, false]);
    });

    it('with show on a child: hidden by either — the one hider', () => {
        const d = face(0, { flowSteps: [{ id: 'a', timelineOptions: { inTime: 0, outTime: 500 } }, { id: 'b', timelineOptions: { inTime: 500, outTime: 1000 } }] });
        const kids = d.children?.[0].children;
        if (!kids) throw new Error('no kids');
        kids[0] = { ...kids[0], effects: { show: { when: { flowSteps: ['b'] } } } };
        api = createSvgAnimationPlayer({ container: '#box', document: d });
        expect(mouths()).toEqual([false, false, false]);   // shown by showOneChild, hidden by show (step a)
        api.flow.goTo({ flowStep: 'b' });
        expect(mouths()).toEqual([true, false, false]);
    });

    it('pre-rendered: the binding carries it — a bound `when.index` follows the player\'s variables', () => {
        document.body.innerHTML = '<svg id="pic" viewBox="0 0 10 10"><g><rect id="m0"/><rect id="m1"/></g></svg>';
        // a pre-rendered binding keeps `when.index` as binding text — the type says number (bindings are resolved before validation)
        const showOneChild = { when: Object.assign({ index: 0 }, { index: 'var(mood)' }), options: [{ element: '#m0' }, { element: '#m1' }] };
        const pre: PxDocumentJson = {
            id: 'pic', type: 'svg',
            animator: {
                timelines: [{ engine: 'js', outTime: 1000 }],
                definitions: { variables: { mood: { type: 'number', defaultValue: 1 } } },
                bindings: [{ element: '#pic', animateWith: [], showOneChild }],
            },
        };
        api = createPrerenderedAnimator({ document: pre });
        const shown = (): Array<boolean> => ['m0', 'm1'].map(id => (document.getElementById(id) as SVGElement | null)?.style.display !== 'none');
        expect(shown()).toEqual([false, true]);
        api.variables.set('mood', 0);
        vi.advanceTimersByTime(50);
        expect(shown()).toEqual([true, false]);
    });

    it('pre-rendered: a binding that lists no options — the group\'s children as rendered', () => {
        document.body.innerHTML = '<svg id="pic" viewBox="0 0 10 10"><g id="grp"><rect/><rect/><rect/></g></svg>';
        const pre: PxDocumentJson = {
            id: 'pic', type: 'svg',
            animator: { timelines: [{ engine: 'js', outTime: 1000 }], bindings: [{ element: '#grp', animateWith: [], showOneChild: { when: { index: 2 } } }] },
        };
        api = createPrerenderedAnimator({ document: pre });
        expect(Array.from(document.querySelectorAll('#grp rect')).map(r => r instanceof SVGElement && r.style.display !== 'none')).toEqual([false, false, true]);
    });
});
