// @px-area entry
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { type PxEngineCallbacks, type PxAnimationPlayerCallbacks } from '@pixodesk/svg-animator-core';
import { forwardPlaybackControls } from '@pixodesk/svg-animator-core/engine';

/** The player's callbacks as they travel through the web builders — the public set: the four playback events (the
 *  executor's to tell), the end, the teardown, the diagnostics channel. The ENGINES get a slice of it
 *  ({@link toEngineCallbacks}); their raw `onPlay` / `onPause` never come from here. */
export type PxPlayerCallbacks = PxAnimationPlayerCallbacks;
import type { PxAnimationPlayerApi } from './PxAnimatorWebTypes';

/**
 * Every public surface takes the callbacks INLINE — `createSvgAnimationPlayer({ onFinish })`,
 * `createSvgAnimationPlayersFromPage({ onFinish })`, `<SvgAnimationPlayer onFinish />`. This picks the player's set out
 * of the options (the rest of the options are not callbacks). Defined HERE, once, so the web player and the
 * components cannot disagree.
 *
 * A wrapper is only made when there is something to call — an engine tests
 * `callbacks?.onFinish` for presence, so an always-present function would change its behaviour.
 */
export function toPlayerCallbacks(inline: PxAnimationPlayerCallbacks | undefined): PxPlayerCallbacks {
    const { onReady, onPlaybackStart, onPlaybackStop, onPlaybackPause, onPlaybackResume, onFinish, onDestroy, onWarning, onError, suppressWarnings, suppressErrors } = inline ?? {};
    return { onReady, onPlaybackStart, onPlaybackStop, onPlaybackPause, onPlaybackResume, onFinish, onDestroy, onWarning, onError, suppressWarnings, suppressErrors };
}

/** The slice an ENGINE takes: the end, the teardown and the diagnostics channel. The playback events are the executor's
 *  (`composeApiExtras`' `playbackListeners`), and the engine's own `onPlay` / `onPause` stay unwired — the gate's hold and
 *  a jump's internal pause are not the user's. */
export function toEngineCallbacks(callbacks: PxPlayerCallbacks | undefined): PxEngineCallbacks {
    const { onFinish, onDestroy, onWarning, onError, suppressWarnings, suppressErrors } = callbacks ?? {};
    return { onFinish, onDestroy, onWarning, onError, suppressWarnings, suppressErrors };
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
        isReady: () => false,
        getRootElement: () => null,
        destroy: () => {},
    };
}

/** Anything thrown becomes an Error, so a diagnostic always carries one shape. */
export function asThrownError(e: unknown): Error {
    return e instanceof Error ? e : new Error(String(e));
}
