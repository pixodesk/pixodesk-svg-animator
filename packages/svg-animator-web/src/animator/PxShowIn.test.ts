/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// `effects.showIn` (1.31) — an element shown only while one of its flow steps is current, in any flow; hidden with its
// own inline `display: none`, at once. The full player (a tree) and the pre-rendered one (a binding) alike.

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
                { id: 'a', inTime: 0, outTime: 1000 }, { id: 'b', inTime: 1000, outTime: 2000 },
                { id: 'off', flow: 'lamp', timeline: 'l', inTime: 0, outTime: 1000 }, { id: 'on', flow: 'lamp', timeline: 'l', inTime: 1000, outTime: 2000 },
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

describe('effects.showIn (1.31)', () => {
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
            { type: 'rect', id: 'pa', width: 2, height: 2, effects: { showIn: { flowSteps: ['a'] } } },
            { type: 'rect', id: 'pb', width: 2, height: 2, effects: { showIn: { flowSteps: ['b'] } } },
            { type: 'rect', id: 'always', width: 2, height: 2 },
        ]) });
        const root = api.getRootElement();
        expect([shownOf(root, 'rect:nth-of-type(1)'), shownOf(root, 'rect:nth-of-type(2)'), shownOf(root, 'rect:nth-of-type(3)')]).toEqual([true, false, true]);
        expect(root?.querySelector('[effects]')).toBeNull();
        api.flow.goTo('b');
        expect([shownOf(root, 'rect:nth-of-type(1)'), shownOf(root, 'rect:nth-of-type(2)')]).toEqual([false, true]);
        api.flow.goTo('a');
        expect([shownOf(root, 'rect:nth-of-type(1)'), shownOf(root, 'rect:nth-of-type(2)')]).toEqual([true, false]);
    });

    it('any listed step of any flow; a node with no id; an empty list is always shown', () => {
        api = createSvgAnimationPlayer({ container: '#box', document: doc([
            { type: 'circle', r: 1, effects: { showIn: { flowSteps: ['b', 'on'] } } },
            { type: 'ellipse', rx: 1, ry: 1, effects: { showIn: { flowSteps: [] } } },
        ]) });
        const root = api.getRootElement();
        expect(shownOf(root, 'circle')).toBe(false);          // at a and off
        api.flow.goTo('on');
        expect(shownOf(root, 'circle')).toBe(true);           // the lamp's step
        api.flow.goTo('off');
        api.flow.goTo('b');
        expect(shownOf(root, 'circle')).toBe(true);           // the page's step
        expect(shownOf(root, 'ellipse')).toBe(true);
    });

    it('a flow the page does not run stays at its start step', () => {
        api = createSvgAnimationPlayer({ container: '#box', flows: ['default'], document: doc([
            { type: 'rect', id: 'lit', width: 2, height: 2, effects: { showIn: { flowSteps: ['on'] } } },
            { type: 'rect', id: 'dark', width: 2, height: 2, effects: { showIn: { flowSteps: ['off'] } } },
        ]) });
        const root = api.getRootElement();
        expect([shownOf(root, 'rect:nth-of-type(1)'), shownOf(root, 'rect:nth-of-type(2)')]).toEqual([false, true]);
    });

    it('while a step finishes its pass, its content stays until the flow lands', () => {
        const d = doc([{ type: 'rect', id: 'pa', width: 2, height: 2, effects: { showIn: { flowSteps: ['a'] } } }]);
        const steps = d.animator?.flowSteps;
        if (!steps) throw new Error('no steps');
        steps[0] = { ...steps[0], iterations: 'infinite', whenLeaving: 'animateToEnd' };
        d.animator = { ...d.animator, actions: [{ action: 'timeline.start', event: 'load' }] };
        api = createSvgAnimationPlayer({ container: '#box', document: d });
        const root = api.getRootElement();
        vi.advanceTimersByTime(300);
        api.flow.goTo('b');
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
                flowSteps: [{ id: 'a', inTime: 0, outTime: 1000 }, { id: 'b', inTime: 1000, outTime: 2000 }],
                bindings: [{ element: '#x', animateWith: [], showIn: { flowSteps: ['b'] } }, { element: '#y', animateWith: [], showIn: { flowSteps: ['a'] } }],
            },
        };
        api = createPrerenderedAnimator({ document: pre });
        const root = document.getElementById('pic');
        expect([shownOf(root, '#x'), shownOf(root, '#y')]).toEqual([false, true]);
        api.flow.goTo('b');
        expect([shownOf(root, '#x'), shownOf(root, '#y')]).toEqual([true, false]);
    });
});
