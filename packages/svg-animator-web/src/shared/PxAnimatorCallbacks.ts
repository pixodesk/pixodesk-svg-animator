// @px-area entry
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { type PxEngineCallbacks, type PxAnimationPlayerCallbacks } from '@pixodesk/svg-animator-core';
import { forwardPlaybackControls, PxVariablesRuntime } from '@pixodesk/svg-animator-core/engine';

/** The player's callbacks as they travel through the web builders — the public set: the playback events (the
 *  executor's to tell), the teardown, the diagnostics channel. The ENGINES get a slice of it
 *  ({@link toEngineCallbacks}); their raw `onPlay` / `onPause` / `onFinish` never come from here. */
export type PxPlayerCallbacks = PxAnimationPlayerCallbacks;
import type { PxAnimationPlayerApi } from './PxAnimatorWebTypes';

/**
 * Every public surface takes the callbacks INLINE — `createSvgAnimationPlayer({ onPlaybackFinish })`,
 * `createSvgAnimationPlayersFromPage({ onPlaybackFinish })`, `<SvgAnimationPlayer onPlaybackFinish />`. This picks the player's set out
 * of the options (the rest of the options are not callbacks). Defined HERE, once, so the web player and the
 * components cannot disagree.
 *
 * Nothing is wrapped: a callback the caller left out stays absent.
 */
export function toPlayerCallbacks(inline: PxAnimationPlayerCallbacks | undefined): PxPlayerCallbacks {
    const { onReady, onPlaybackStart, onPlaybackStop, onPlaybackPause, onPlaybackResume, onPlaybackFinish, onDestroy, onWarning, onError, suppressWarnings, suppressErrors } = inline ?? {};
    return { onReady, onPlaybackStart, onPlaybackStop, onPlaybackPause, onPlaybackResume, onPlaybackFinish, onDestroy, onWarning, onError, suppressWarnings, suppressErrors };
}

/** The slice an ENGINE takes: the teardown and the diagnostics channel. The playback events are the executor's
 *  (`composeApiExtras`' `playbackListeners`, `onPlaybackFinish` included), and the engine's own `onPlay` / `onPause` /
 *  `onFinish` are the player's internals — a jump's pause and the end of a return leg are not the user's. */
export function toEngineCallbacks(callbacks: PxPlayerCallbacks | undefined): PxEngineCallbacks {
    const { onDestroy, onWarning, onError, suppressWarnings, suppressErrors } = callbacks ?? {};
    return { onDestroy, onWarning, onError, suppressWarnings, suppressErrors };
}

/**
 * The API of a player that could not be built (the rule in core's `PxDiagnostics`): every
 * call is a no-op, every getter answers "not ready". Returned instead of throwing, after the
 * failure has been reported through `onError`.
 */
export function createInertAnimator(): PxAnimationPlayerApi {
    return {
        // no target ever: every read its "not ready" value, every write dropped
        playback: forwardPlaybackControls(() => undefined, () => {}),
        // no document: no variables — every read empty, every write ignored
        variables: new PxVariablesRuntime({ type: 'svg' }, undefined, undefined).api,
        isReady: () => false,
        getRootElement: () => null,
        destroy: () => {},
    };
}

/** Anything thrown becomes an Error, so a diagnostic always carries one shape. */
export function asThrownError(e: unknown): Error {
    return e instanceof Error ? e : new Error(String(e));
}
