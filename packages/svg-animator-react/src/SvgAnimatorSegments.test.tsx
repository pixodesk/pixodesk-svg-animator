/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// The `segment` prop and `onSegmentChange` (2026-11-15) — the page holds the segment; the file's segment triggers rest.

import { act, cleanup, render } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PxAnimationPlayerHandle, PxDocument } from '@pixodesk/svg-animator-core';
import SvgAnimationPlayer from './SvgAnimator';

/** Opacity runs 0 → 1 over content 0…3000 ms; a click goes to the next segment. */
const DOC: PxDocument = {
    type: 'svg', viewBox: '0 0 10 10',
    animator: {
        timeline: {
            engine: 'js', outTime: 3000,
            segments: [
                { name: 'intro',   inTime: 0,    outTime: 1000, whenFinished: 'timeline.segment.next' },
                { name: 'loop',    inTime: 1000, outTime: 2000, iterations: 'infinite' },
                { name: 'success', inTime: 2000, outTime: 3000 },
            ],
        },
        actionTriggers: { 'timeline.start': 'load', 'timeline.segment.next': 'click' },
    },
    children: [
        { type: 'rect', id: 'r', width: 10, height: 10,
          animate: { opacity: { keyframes: [{ time: 0, value: 0 }, { time: 3000, value: 1 }] } } },
    ],
};

const click = (container: HTMLElement): void => {
    act(() => { container.querySelector('svg')?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
};

describe('SvgAnimationPlayer — the `segment` prop (React)', () => {
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
        const ref = createRef<PxAnimationPlayerHandle>();
        const { container } = render(<SvgAnimationPlayer document={DOC} segment="success" playerRef={ref} />);
        expect(ref.current?.timeline.segment.get()).toBe('success');
        act(() => { vi.advanceTimersByTime(50); });
        expect(Number(container.querySelector('rect')?.getAttribute('opacity'))).toBeCloseTo(1, 2);
    });

    it('a new value goes there and tells `onSegmentChange`; the file\'s segment triggers are not read while held', () => {
        const ref = createRef<PxAnimationPlayerHandle>();
        const onSegmentChange = vi.fn();
        const { container, rerender } = render(<SvgAnimationPlayer document={DOC} segment="success" playerRef={ref} onSegmentChange={onSegmentChange} />);
        rerender(<SvgAnimationPlayer document={DOC} segment="loop" playerRef={ref} onSegmentChange={onSegmentChange} />);
        expect(ref.current?.timeline.segment.get()).toBe('loop');
        expect(onSegmentChange).toHaveBeenLastCalledWith('loop', 'success');
        click(container);
        expect(ref.current?.timeline.segment.get()).toBe('loop');   // held: the click's `timeline.segment.next` rests
    });

    it('without the prop the file\'s triggers move it, and `onSegmentChange` tells the page', () => {
        const ref = createRef<PxAnimationPlayerHandle>();
        const onSegmentChange = vi.fn();
        const { container } = render(<SvgAnimationPlayer document={DOC} playerRef={ref} onSegmentChange={onSegmentChange} />);
        expect(ref.current?.timeline.segment.get()).toBe('intro');
        click(container);
        expect(ref.current?.timeline.segment.get()).toBe('loop');
        expect(onSegmentChange).toHaveBeenCalledWith('loop', 'intro');
    });
});
