/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { PxEngineCallbacks } from '@pixodesk/svg-animator-core';
import type { PxAnimatorApi } from '../shared/PxAnimatorWebTypes';

/**
 * THE PAGE-WIDE REGISTRY — every live animator in the window, whoever created it.
 *
 * Like lottie-web's `getRegisteredAnimations()`: a dev tool, a test, or a "pause everything
 * while the tab is hidden" can reach every player without holding on to each `createAnimator`
 * result. An animator joins when it is built and leaves on `destroy()`; play / pause / cancel /
 * finish are announced to subscribers.
 *
 * ONE registry per window, whatever the bundling: the store hangs off `globalThis` under a
 * `Symbol.for` key, so the ESM build in one script and the UMD build in another share it. It
 * is also reachable by NAME — `globalThis.__pixodeskAnimators` — for tooling that does not
 * import the library (a devtools panel reading a page it did not build). Web only: React
 * Native players never touch it.
 *
 * EXPERIMENTAL (2026-09): not settled — the event names, what `getAll()` includes and the
 * global's name may change without a major version. Documented as such in
 * docs/library/web-player.md ("Every animator on the page").
 */

/** What changed for an animator in the page-wide registry. Experimental — may change. @public */
export type PxAnimatorsEvent = 'add' | 'remove' | 'play' | 'pause' | 'cancel' | 'finish';

/** Called for every {@link PxAnimatorsEvent} of every animator in the window. Experimental — may change. @public */
export type PxAnimatorsListener = (event: PxAnimatorsEvent, animator: PxAnimatorApi) => void;

/** The store itself — what `globalThis.__pixodeskAnimators` holds. Experimental — may change. @public */
export interface PxAnimatorRegistry {
    /** Every live animator, in creation order. */
    getAll(): ReadonlyArray<PxAnimatorApi>;
    /** Announcements of add / remove / play / pause / cancel / finish; returns the unsubscribe. */
    subscribe(listener: PxAnimatorsListener): () => void;
}

interface RegistryStore extends PxAnimatorRegistry {
    readonly animators: Set<PxAnimatorApi>;
    readonly listeners: Set<PxAnimatorsListener>;
}

const STORE_KEY = Symbol.for('@pixodesk/svg-animator-web:animators');
/** The by-name handle for tooling that cannot import the library. */
const GLOBAL_NAME = '__pixodeskAnimators';

/** The one store of this window, created on first use. `globalThis` carries it under a
 *  symbol (shared across bundle copies) and, for discoverability, under {@link GLOBAL_NAME}. */
function store(): RegistryStore {
    // `globalThis` has no declared slot for either key — this is exactly the ad-hoc global
    // a cross-bundle registry needs, so it is typed as the record it is used as.
    const g = globalThis as unknown as Record<string | symbol, RegistryStore | undefined>;
    let s = g[STORE_KEY];
    if (!s) {
        const animators = new Set<PxAnimatorApi>();
        const listeners = new Set<PxAnimatorsListener>();
        s = {
            animators,
            listeners,
            getAll: () => Array.from(animators),
            subscribe: (listener) => {
                listeners.add(listener);
                return () => { listeners.delete(listener); };
            },
        };
        g[STORE_KEY] = s;
        if (g[GLOBAL_NAME] === undefined) g[GLOBAL_NAME] = s;
    }
    return s;
}

/** Every live animator in this window, in creation order. Experimental — may change. @public */
export function getAllAnimators(): ReadonlyArray<PxAnimatorApi> {
    return store().getAll();
}

/** Hear every animator in this window start, pause, cancel, finish, appear or go — returns
 *  the unsubscribe. Experimental — may change. @public */
export function onAnimatorsChange(listener: PxAnimatorsListener): () => void {
    return store().subscribe(listener);
}

/** A listener must never break playback: its error surfaces on its own, asynchronously. */
function notify(event: PxAnimatorsEvent, animator: PxAnimatorApi): void {
    for (const listener of store().listeners) {
        try { listener(event, animator); } catch (e) { setTimeout(() => { throw e; }, 0); }
    }
}

/** @internal Adds a freshly built animator; `destroy()` on the returned API removes it again. */
export function registerAnimator(animator: PxAnimatorApi): void {
    const s = store();
    if (s.animators.has(animator)) return;
    s.animators.add(animator);
    notify('add', animator);
    const destroy = animator.destroy.bind(animator);
    animator.destroy = () => {
        destroy();
        if (s.animators.delete(animator)) notify('remove', animator);
    };
}

/**
 * @internal The engine callbacks with the registry listening in: each of the caller's own
 * handlers still runs first. `api()` resolves the animator lazily — the callbacks are built
 * before it exists.
 */
export function withRegistryEvents(callbacks: PxEngineCallbacks | undefined, api: () => PxAnimatorApi | undefined): PxEngineCallbacks {
    const fire = (event: PxAnimatorsEvent): void => { const a = api(); if (a) notify(event, a); };
    return {
        ...callbacks,
        onPlay: () => { callbacks?.onPlay?.(); fire('play'); },
        onPause: () => { callbacks?.onPause?.(); fire('pause'); },
        onCancel: () => { callbacks?.onCancel?.(); fire('cancel'); },
        onFinish: () => { callbacks?.onFinish?.(); fire('finish'); },
    };
}
