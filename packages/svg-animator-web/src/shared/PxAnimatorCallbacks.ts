// @px-area entry
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { PxEngineCallbacks, PxAnimationPlayerCallbacks } from '@pixodesk/svg-animator-core';

/** The engine's callbacks plus `onStop`, carried along to the player's executor (it is not the engine's to fire). */
export type PxPlayerCallbacks = PxEngineCallbacks & Pick<PxAnimationPlayerCallbacks, 'onStop'>;
import type { PxAnimationPlayerApi } from './PxAnimatorWebTypes';

/**
 * The engines take ONE callbacks object; every public surface takes the callbacks INLINE —
 * `createSvgAnimationPlayer({ onFinish })`, `createSvgAnimationPlayersFromPage({ onFinish })`, `<SvgAnimationPlayer
 * onFinish />`. This builds the one from the other. `onStop` is NOT an engine callback: it is the built-in
 * `stop` action's, told by the player's executor (`composeApiExtras`' `onStop`) — a pause is `onPause`, the
 * natural end `onFinish`. Defined HERE, once, so the web player and the components cannot disagree.
 *
 * A wrapper is only made when there is something to call — an engine tests
 * `callbacks?.onFinish` for presence, so an always-present function would change its behaviour.
 */
export function toEngineCallbacks(inline: PxAnimationPlayerCallbacks | undefined): PxPlayerCallbacks {
    const { onPlay, onPause, onReset, onFinish, onDestroy, onStop, onWarn, onError, suppressWarnings, suppressErrors } = inline ?? {};
    return { onPlay, onPause, onReset, onFinish, onDestroy, onStop, onWarn, onError, suppressWarnings, suppressErrors };
}

/**
 * The API of a player that could not be built (the rule in core's `PxDiagnostics`): every
 * call is a no-op, every getter answers "not ready". Returned instead of throwing, after the
 * failure has been reported through `onError`.
 */
export function createInertAnimator(): PxAnimationPlayerApi {
    return {
        isReady: () => false,
        getRootElement: () => null,
        isPlaying: () => false,
        play: () => {},
        pause: () => {},
        stop: () => {},
        reset: () => {},
        jumpToFinished: () => {},
        playOnce: () => {},
        getDuration: () => null,
        setPlaybackRate: () => {},
        getCurrentTime: () => null,
        setCurrentTime: () => {},
        getCurrentProgress: () => null,
        setCurrentProgress: () => {},
        destroy: () => {},
    };
}

/** Anything thrown becomes an Error, so a diagnostic always carries one shape. */
export function asThrownError(e: unknown): Error {
    return e instanceof Error ? e : new Error(String(e));
}
