/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// Inline callbacks → the one object the engines take, plus `onStop` (API review §9 / §5).

import { describe, expect, it, vi } from 'vitest';
import { toEngineCallbacks, toPlayerCallbacks } from './PxAnimatorCallbacks';

describe('toPlayerCallbacks / toEngineCallbacks', () => {

    it('toPlayerCallbacks passes each lifecycle callback through', () => {
        const onPlaybackStart = vi.fn(), onPlaybackPause = vi.fn(), onPlaybackResume = vi.fn(), onPlaybackStop = vi.fn(), onPlaybackFinish = vi.fn(), onDestroy = vi.fn();
        const out = toPlayerCallbacks({ onPlaybackStart, onPlaybackPause, onPlaybackResume, onPlaybackStop, onPlaybackFinish, onDestroy });

        out.onPlaybackStart?.(); out.onPlaybackPause?.(); out.onPlaybackResume?.(); out.onPlaybackStop?.(); out.onPlaybackFinish?.(); out.onDestroy?.();

        for (const fn of [onPlaybackStart, onPlaybackPause, onPlaybackResume, onPlaybackStop, onPlaybackFinish, onDestroy]) expect(fn).toHaveBeenCalledTimes(1);
    });

    it('the playback events never reach an ENGINE — they are the executor\'s to fire, the finish included (1.26); the engine gets the teardown and the diagnostics', () => {
        const onPlaybackStart = vi.fn(), onPlaybackStop = vi.fn(), onPlaybackFinish = vi.fn();
        const out = toEngineCallbacks({ onPlaybackStart, onPlaybackStop, onPlaybackFinish });
        expect(out.onPlay).toBeUndefined();
        expect(out.onPause).toBeUndefined();
        expect(out.onFinish).toBeUndefined();               // the engine's raw end goes to the executor, wired by the player
        expect(Object.keys(out)).not.toContain('onPlaybackFinish');
        expect(Object.keys(out)).not.toContain('onPlaybackStart');
        expect(onPlaybackStart).not.toHaveBeenCalled();
        expect(onPlaybackStop).not.toHaveBeenCalled();
    });

    it('makes NO wrapper when the callback is not given', () => {
        // Absence stays absence — an engine tests its callbacks for presence.
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
