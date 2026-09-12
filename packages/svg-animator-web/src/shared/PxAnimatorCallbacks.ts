/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { PxAnimatorCallbacksConfig, PxComponentCallbacks } from '@pixodesk/svg-animator-core';

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
export function toEngineCallbacks(inline: PxComponentCallbacks | undefined): PxAnimatorCallbacksConfig {
    const { onPlay, onPause, onCancel, onFinish, onRemove, onStop, onWarn, onError, silent } = inline ?? {};
    const withStop = (own: (() => void) | undefined): (() => void) | undefined =>
        own || onStop ? () => { own?.(); onStop?.(); } : undefined;
    return {
        onPlay,
        onPause:  withStop(onPause),
        onCancel: withStop(onCancel),
        onFinish: withStop(onFinish),
        onRemove: withStop(onRemove),
        onWarn, onError, silent,
    };
}
