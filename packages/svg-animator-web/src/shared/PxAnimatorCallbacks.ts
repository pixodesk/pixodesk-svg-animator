/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { PxEngineCallbacks, PxAnimatorCallbacks } from '@pixodesk/svg-animator-core';
import type { PxAnimatorApi } from './PxAnimatorWebTypes';

/**
 * The engines take ONE callbacks object; every public surface takes the callbacks INLINE —
 * `createAnimator({ onFinish })`, `loadTagAnimators({ onFinish })`, `<PixodeskSvgAnimator
 * onFinish />`. This builds the one from the other, and adds `onStop`: it fires after any of
 * pause / cancel / finish / remove, for callers who only care that playback is no longer
 * running. Defined HERE, once, so the web player and the components cannot disagree on when.
 *
 * A wrapper is only made when there is something to call — an engine tests
 * `callbacks?.onFinish` for presence, so an always-present function would change its behaviour.
 */
export function toEngineCallbacks(inline: PxAnimatorCallbacks | undefined): PxEngineCallbacks {
    const { onPlay, onPause, onCancel, onFinish, onRemove, onStop, onWarn, onError, muteWarn, muteError } = inline ?? {};
    const withStop = (own: (() => void) | undefined): (() => void) | undefined =>
        own || onStop ? () => { own?.(); onStop?.(); } : undefined;
    return {
        onPlay,
        onPause:  withStop(onPause),
        onCancel: withStop(onCancel),
        onFinish: withStop(onFinish),
        onRemove: withStop(onRemove),
        onWarn, onError, muteWarn, muteError,
    };
}

/**
 * The API of a player that could not be built (the rule in core's `PxDiagnostics`): every
 * call is a no-op, every getter answers "not ready". Returned instead of throwing, after the
 * failure has been reported through `onError`.
 */
export function createInertAnimator(): PxAnimatorApi {
    return {
        isReady: () => false,
        getRootElement: () => null,
        isPlaying: () => false,
        play: () => {},
        pause: () => {},
        cancel: () => {},
        finish: () => {},
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
