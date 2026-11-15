/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// The `segment` prop and the `segmentChange` event (2026-11-15) — the page holds the segment; the file's segment
// triggers rest.

import { cleanup, render } from '@testing-library/vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick, ref } from 'vue';
import type { PxAnimationPlayerHandle, PxDocument } from '@pixodesk/svg-animator-core';
import SvgAnimationPlayer from './SvgAnimator';

/** Opacity runs 0 → 1 over content 0…3000 ms; a click goes to the next segment. */
const DOC: PxDocument = {
    type: 'svg', viewBox: '0 0 10 10',
    animator: {
        timeline: {
            engine: 'js', outTime: 3000,
            segments: {
                intro:   { inTime: 0,    outTime: 1000, whenFinished: 'timeline.segment.next' },
                loop:    { inTime: 1000, outTime: 2000, iterations: 'infinite' },
                success: { inTime: 2000, outTime: 3000 },
            },
        },
        actionTriggers: { 'timeline.start': 'load', 'timeline.segment.next': 'click' },
    },
    children: [
        { type: 'rect', id: 'r', width: 10, height: 10,
          animate: { opacity: { keyframes: [{ time: 0, value: 0 }, { time: 3000, value: 1 }] } } },
    ],
};

/** The player in a host that forwards `segment`, with the handle and every `segmentChange` caught. */
function renderHost(segment: string | undefined) {
    const api = ref<PxAnimationPlayerHandle | null>(null);
    const changes: Array<[string, string]> = [];
    const utils = render(defineComponent({
        props: { segment: { type: String, default: undefined } },
        setup(props) {
            return () => h(SvgAnimationPlayer, {
                document: DOC, segment: props.segment, ref: api,
                onSegmentChange: (s: string, p: string) => changes.push([s, p]),
            });
        },
    }), { props: { segment } });
    return { api, changes, ...utils };
}

const click = (container: Element): void => {
    container.querySelector('svg')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
};

describe('SvgAnimationPlayer — the `segment` prop (Vue)', () => {
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

    it('holds the named segment from the first frame — one that ends is shown at its end', () => {
        const { api, container } = renderHost('success');
        expect(api.value?.timeline.segment.get()).toBe('success');
        vi.advanceTimersByTime(50);
        expect(Number(container.querySelector('rect')?.getAttribute('opacity'))).toBeCloseTo(1, 2);
    });

    it('a new value goes there and emits `segmentChange`; the file\'s segment triggers are not read while held', async () => {
        const { api, changes, container, rerender } = renderHost('success');
        await rerender({ segment: 'loop' });
        await nextTick();
        expect(api.value?.timeline.segment.get()).toBe('loop');
        expect(changes.at(-1)).toEqual(['loop', 'success']);
        click(container);
        expect(api.value?.timeline.segment.get()).toBe('loop');
    });

    it('without the prop the file\'s triggers move it, and `segmentChange` tells the page', () => {
        const { api, changes, container } = renderHost(undefined);
        expect(api.value?.timeline.segment.get()).toBe('intro');
        click(container);
        expect(api.value?.timeline.segment.get()).toBe('loop');
        expect(changes).toEqual([['loop', 'intro']]);
    });
});
