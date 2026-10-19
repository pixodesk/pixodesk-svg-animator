/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/
// A value the browser's Web Animations API rejects (here a unitless rect `width`) makes the WAAPI engine step aside for
// the frame loop. It used to find that out only AFTER building a KeyframeEffect per element × property — animations
// that were never played, and each one made the browser log "Invalid keyframe value for property …" (513 warnings for
// one repeater scene). The support check now runs before any effect exists.
//
// jsdom has no Web Animations API: the two classes are stubbed and counted (as in PxAnimatorWebApiTime.test.ts).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSvgAnimator } from '../animator/PxAnimator';
import type { PxAnimatedSvgDocument } from '@pixodesk/svg-animator-core';

const DUR = 1000;
let effects = 0;
class StubKeyframeEffect {
    constructor(readonly target: Element, readonly keyframes: unknown, private readonly timing: EffectTiming) { effects++; }
    getTiming(): EffectTiming { return this.timing; }
    updateTiming(): void {}
}
class StubAnimation {
    playState: AnimationPlayState = 'idle';
    playbackRate = 1;
    currentTime: number | null = 0;
    onfinish: (() => void) | null = null;
    onremove: (() => void) | null = null;
    constructor(readonly effect: StubKeyframeEffect) {}
    play(): void { this.playState = 'running'; }
    pause(): void { this.playState = 'paused'; }
    cancel(): void { this.playState = 'idle'; }
    finish(): void { this.playState = 'finished'; }
}

/** Two rects whose width grows 4 → 16, plus an opacity the browser does accept. */
function doc(engine: string): PxAnimatedSvgDocument {
    const rect = (id: string) => ({
        type: 'rect', id, width: 4, height: 4,
        animate: {
            width: { keyframes: [{ time: 0, value: 4 }, { time: DUR, value: 16 }] },
            opacity: { keyframes: [{ time: 0, value: 0 }, { time: DUR, value: 1 }] },
        },
    });
    return {
        type: 'svg', viewBox: '0 0 100 100',
        animator: { timeline: { engine, duration: DUR, trigger: { start: 'none' } } },
        children: [rect('a'), rect('b')],
    } as PxAnimatedSvgDocument;
}

beforeEach(() => {
    effects = 0;
    document.body.innerHTML = '<div id="stage"></div>';
    vi.stubGlobal('KeyframeEffect', StubKeyframeEffect);
    vi.stubGlobal('Animation', StubAnimation);
    // a browser that wants a unit on CSS `width` (as Chromium does: `width: 4` is invalid, `4px` is fine)
    vi.stubGlobal('CSS', { supports: (prop: string, value: string) => !(prop === 'width' && /^-?\d+(\.\d+)?$/.test(value)) });
});
afterEach(() => {
    vi.unstubAllGlobals();
});

describe('WAAPI engine — values the browser rejects', () => {
    it('steps aside for the frame loop without building a single KeyframeEffect', () => {
        const api = createSvgAnimator({ doc: doc('auto'), container: '#stage', muteWarn: true });
        expect(effects).toBe(0);
        // ...and the frame loop it fell back to animates the width
        api.setCurrentTime(DUR);
        const widths = Array.from(document.querySelectorAll('#stage rect')).map((r) => Number(r.getAttribute('width')));
        expect(widths).toEqual([16, 16]);
    });

    it('still builds the effects when the native engine is forced', () => {
        createSvgAnimator({ doc: doc('native'), container: '#stage', muteWarn: true });
        expect(effects).toBeGreaterThan(0);
    });
});
