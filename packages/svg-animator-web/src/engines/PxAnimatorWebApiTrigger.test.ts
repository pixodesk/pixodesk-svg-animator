/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// The WAAPI engine wires the trigger for every time-driven document, so a document with no
// trigger starts on load (`startOn` defaults to 'load' — SCHEMA-NAMING-REVIEW §2.1). jsdom has no
// Web Animations API, so the two classes the engine constructs are stubbed with the bare minimum.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAnimator } from '../animator/PxAnimator';
import type { PxAnimatedSvgDocument } from '@pixodesk/svg-animator-core';

class StubKeyframeEffect {
    constructor(readonly target: Element, readonly keyframes: unknown, private readonly timing: EffectTiming) {}
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

function doc(trigger?: { startOn: 'programmatic' }): PxAnimatedSvgDocument {
    return {
        type: 'svg',
        viewBox: '0 0 100 100',
        animator: { timeline: { engine: 'native', duration: 1000, ...(trigger ? { trigger } : {}) } },
        children: [{
            type: 'rect', id: 'r1', opacity: 0,
            animate: { opacity: { keyframes: [{ time: 0, value: 0 }, { time: 1000, value: 1 }] } },
        }],
    };
}

beforeEach(() => {
    document.body.innerHTML = '<div id="stage"></div>';
    vi.stubGlobal('KeyframeEffect', StubKeyframeEffect);
    vi.stubGlobal('Animation', StubAnimation);
    vi.stubGlobal('CSS', { supports: () => true });
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('WAAPI engine — trigger wiring', () => {

    it('a document with no trigger starts on load', () => {
        const api = createAnimator({ data: doc(), container: '#stage' });
        expect(api.isPlaying()).toBe(true);
    });

    it('an explicit programmatic trigger still waits for play()', () => {
        const api = createAnimator({ data: doc({ startOn: 'programmatic' }), container: '#stage' });
        expect(api.isPlaying()).toBe(false);
        api.play();
        expect(api.isPlaying()).toBe(true);
    });
});
