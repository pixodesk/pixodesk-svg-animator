// @px-area entry
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { PxEngineCallbacks } from '@pixodesk/svg-animator-core';
import type { PxAnimationPlayerApi } from '../shared/PxAnimatorWebTypes';

/**
 * THE PAGE-WIDE REGISTRY — every live player in the window, whoever created it.
 *
 * Like lottie-web's `getRegisteredAnimations()`: a dev tool, a test, or a "pause everything
 * while the tab is hidden" can reach every player without holding on to each `createSvgAnimationPlayer`
 * result. A player joins when it is built and leaves on `destroy()`; play / pause / cancel /
 * finish are announced to subscribers.
 *
 * ONE registry per window, whatever the bundling: the store hangs off `globalThis` under a
 * `Symbol.for` key, so the ESM build in one script and the UMD build in another share it. It
 * is also reachable by NAME — `globalThis.__pixodeskSvgAnimationPlayers` — for tooling that does not
 * import the library (a devtools panel reading a page it did not build). Web only: React
 * Native players never touch it.
 *
 * EXPERIMENTAL (2026-09): not settled — the event names, what `getAll()` includes and the
 * global's name may change without a major version. Documented as such in
 * docs/library/web-player.md ("Every player on the page").
 */

/** What changed for a player in the page-wide registry. Experimental — may change. @public */
export type PxAnimationPlayersEvent = 'add' | 'remove' | 'play' | 'pause' | 'cancel' | 'finish';

/** Called for every {@link PxAnimationPlayersEvent} of every player in the window. Experimental — may change. @public */
export type PxAnimationPlayersListener = (event: PxAnimationPlayersEvent, animator: PxAnimationPlayerApi) => void;

/** The store itself — what `globalThis.__pixodeskSvgAnimationPlayers` holds. Experimental — may change. @public */
export interface PxAnimationPlayerRegistry {
    /** Every live player, in creation order. */
    getAll(): ReadonlyArray<PxAnimationPlayerApi>;
    /** Announcements of add / remove / play / pause / cancel / finish; returns the unsubscribe. */
    subscribe(listener: PxAnimationPlayersListener): () => void;
}

interface RegistryStore extends PxAnimationPlayerRegistry {
    readonly animators: Set<PxAnimationPlayerApi>;
    readonly listeners: Set<PxAnimationPlayersListener>;
}

const STORE_KEY = Symbol.for('@pixodesk/svg-animator-web:animators');
/** The `globalThis` name the registry is also reachable by — for code that cannot import the library
 *  (a page script next to a pre-rendered SVG, a tool's iframe). Experimental — may change. @public */
export const PX_ANIMATION_PLAYER_REGISTRY_GLOBAL = '__pixodeskSvgAnimationPlayers';

/** A store some bundle copy of this library left on `globalThis` (which declares no slot for it). */
function isRegistryStore(value: unknown): value is RegistryStore {
    return typeof value === 'object' && value !== null
        && 'animators' in value && value.animators instanceof Set
        && 'listeners' in value && value.listeners instanceof Set;
}

/** The one store of this window, created on first use. `globalThis` carries it under a
 *  symbol (shared across bundle copies) and, for discoverability, under {@link PX_ANIMATION_PLAYER_REGISTRY_GLOBAL}. */
function store(): RegistryStore {
    const found: unknown = Reflect.get(globalThis, STORE_KEY);
    let s = isRegistryStore(found) ? found : undefined;
    if (!s) {
        const animators = new Set<PxAnimationPlayerApi>();
        const listeners = new Set<PxAnimationPlayersListener>();
        s = {
            animators,
            listeners,
            getAll: () => Array.from(animators),
            subscribe: (listener) => {
                listeners.add(listener);
                return () => { listeners.delete(listener); };
            },
        };
        Reflect.set(globalThis, STORE_KEY, s);
        if (Reflect.get(globalThis, PX_ANIMATION_PLAYER_REGISTRY_GLOBAL) === undefined) Reflect.set(globalThis, PX_ANIMATION_PLAYER_REGISTRY_GLOBAL, s);
    }
    return s;
}

/** Every live player in this window, in creation order. Experimental — may change. @public */
export function getAllSvgAnimationPlayers(): ReadonlyArray<PxAnimationPlayerApi> {
    return store().getAll();
}

/** Hear every player in this window start, pause, cancel, finish, appear or go — returns
 *  the unsubscribe. Experimental — may change. @public */
export function onSvgAnimationPlayersChange(listener: PxAnimationPlayersListener): () => void {
    return store().subscribe(listener);
}

/** A listener must never break playback: its error surfaces on its own, asynchronously. */
function notify(event: PxAnimationPlayersEvent, animator: PxAnimationPlayerApi): void {
    for (const listener of store().listeners) {
        try { listener(event, animator); } catch (e) { setTimeout(() => { throw e; }, 0); }
    }
}

/** @internal Adds a freshly built animator; `destroy()` on the returned API removes it again. */
export function registerAnimator(animator: PxAnimationPlayerApi): void {
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
export function withRegistryEvents(callbacks: PxEngineCallbacks | undefined, api: () => PxAnimationPlayerApi | undefined): PxEngineCallbacks {
    const fire = (event: PxAnimationPlayersEvent): void => { const a = api(); if (a) notify(event, a); };
    return {
        ...callbacks,
        onPlay: () => { callbacks?.onPlay?.(); fire('play'); },
        onPause: () => { callbacks?.onPause?.(); fire('pause'); },
        onCancel: () => { callbacks?.onCancel?.(); fire('cancel'); },
        onFinish: () => { callbacks?.onFinish?.(); fire('finish'); },
    };
}
