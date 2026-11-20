/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// The `state` prop and the `stateChange` event (2026-11-20; `segment` 2026-11-15) — the page holds the state; the file's state rulest
// triggers rest.

import { cleanup, render } from '@testing-library/vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick, ref } from 'vue';
import type { PxAnimationPlayerHandle, PxDocument } from '@pixodesk/svg-animator-core';
import SvgAnimationPlayer from './SvgAnimator';

/** Opacity runs 0 → 1 over content 0…3000 ms; a click goes to the next state. */
const DOC: PxDocument = {
    type: 'svg', viewBox: '0 0 10 10',
    animator: {
        timelines: [{ engine: 'js', outTime: 3000 }], states: [{ id: 'intro', inTime: 0, outTime: 1000, whenFinished: { action: 'state.next' } }, { id: 'loop', inTime: 1000, outTime: 2000, iterations: 'infinite' }, { id: 'success', inTime: 2000, outTime: 3000 }],
        actionTriggers: [{ action: 'timeline.start', event: 'load' }, { action: 'state.next', event: 'click' }],
    },
    children: [
        { type: 'rect', id: 'r', width: 10, height: 10,
          animate: { opacity: { keyframes: [{ time: 0, value: 0 }, { time: 3000, value: 1 }] } } },
    ],
};

/** The player in a host that forwards `state`, with the handle and every `stateChange` caught. */
function renderHost(state: string | undefined) {
    const api = ref<PxAnimationPlayerHandle | null>(null);
    const changes: Array<[string, string]> = [];
    const utils = render(defineComponent({
        props: { state: { type: String, default: undefined } },
        setup(props) {
            return () => h(SvgAnimationPlayer, {
                document: DOC, state: props.state, ref: api,
                onStateChange: (s: string, p: string) => changes.push([s, p]),
            });
        },
    }), { props: { state } });
    return { api, changes, ...utils };
}

const click = (container: Element): void => {
    container.querySelector('svg')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
};

describe('SvgAnimationPlayer — the `state` prop (Vue)', () => {
    beforeEach(() => {
        // 'performance' faked with requestAnimationFrame: jsdom's rAF stops firing from the second test otherwise
        vi.useFakeTimers({
            toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame'],
        });
    });
    afterEach(() => {
        cleanup();
        vi.useRealTimers();
    });

    it('holds the named state from the first frame — one that ends is shown at its end', () => {
        const { api, container } = renderHost('success');
        expect(api.value?.state.get()).toEqual(['success']);
        vi.advanceTimersByTime(50);
        expect(Number(container.querySelector('rect')?.getAttribute('opacity'))).toBeCloseTo(1, 2);
    });

    it('a new value goes there and emits `stateChange`; the file\'s state rules are not read while held', async () => {
        const { api, changes, container, rerender } = renderHost('success');
        await rerender({ state: 'loop' });
        await nextTick();
        expect(api.value?.state.get()).toEqual(['loop']);
        expect(changes.at(-1)).toEqual(['loop', 'success']);
        click(container);
        expect(api.value?.state.get()).toEqual(['loop']);
    });

    it('without the prop the file\'s triggers move it, and `stateChange` tells the page', () => {
        const { api, changes, container } = renderHost(undefined);
        expect(api.value?.state.get()).toEqual(['intro']);
        click(container);
        expect(api.value?.state.get()).toEqual(['loop']);
        expect(changes).toEqual([['loop', 'intro']]);
    });
});
