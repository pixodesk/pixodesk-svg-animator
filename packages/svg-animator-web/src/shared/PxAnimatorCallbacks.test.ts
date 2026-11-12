/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// Inline callbacks → the one object the engines take, plus `onStop` (API review §9 / §5).

import { describe, expect, it, vi } from 'vitest';
import { toEngineCallbacks, toPlayerCallbacks } from './PxAnimatorCallbacks';

describe('toPlayerCallbacks / toEngineCallbacks', () => {

    it('toPlayerCallbacks passes each lifecycle callback through', () => {
        const onPlaybackStart = vi.fn(), onPlaybackPause = vi.fn(), onPlaybackResume = vi.fn(), onPlaybackStop = vi.fn(), onFinish = vi.fn(), onDestroy = vi.fn();
        const out = toPlayerCallbacks({ onPlaybackStart, onPlaybackPause, onPlaybackResume, onPlaybackStop, onFinish, onDestroy });

        out.onPlaybackStart?.(); out.onPlaybackPause?.(); out.onPlaybackResume?.(); out.onPlaybackStop?.(); out.onFinish?.(); out.onDestroy?.();

        for (const fn of [onPlaybackStart, onPlaybackPause, onPlaybackResume, onPlaybackStop, onFinish, onDestroy]) expect(fn).toHaveBeenCalledTimes(1);
    });

    it('the playback events never reach an ENGINE — they are the executor\'s to fire; the engine gets the end, the teardown and the diagnostics', () => {
        const onPlaybackStart = vi.fn(), onPlaybackStop = vi.fn(), onFinish = vi.fn();
        const out = toEngineCallbacks({ onPlaybackStart, onPlaybackStop, onFinish });
        expect(out.onPlay).toBeUndefined();
        expect(out.onPause).toBeUndefined();
        expect(out.onFinish).toBe(onFinish);
        expect(Object.keys(out)).not.toContain('onPlaybackStart');
        expect(onPlaybackStart).not.toHaveBeenCalled();
        expect(onPlaybackStop).not.toHaveBeenCalled();
    });

    it('makes NO wrapper when the callback is not given', () => {
        // The WAAPI engine wires `anim.onfinish` only if `callbacks.onFinish` EXISTS — an
        // always-present function would change what it does. Absence must stay absence.
        const out = toEngineCallbacks({});
        expect(out.onPlay).toBeUndefined();
        expect(out.onPause).toBeUndefined();
        expect(out.onFinish).toBeUndefined();
        expect(out.onDestroy).toBeUndefined();
    });

    it('accepts no options at all', () => {
        expect(() => toEngineCallbacks(undefined)).not.toThrow();
        expect(toEngineCallbacks(undefined).onFinish).toBeUndefined();
    });

    it('passes the diagnostics fields through untouched', () => {
        const onWarning = vi.fn(), onError = vi.fn();
        const out = toEngineCallbacks({ onWarning, onError, suppressWarnings: true, suppressErrors: false });

        expect(out.onWarning).toBe(onWarning);
        expect(out.onError).toBe(onError);
        expect(out.suppressWarnings).toBe(true);
        expect(out.suppressErrors).toBe(false);
    });
});
