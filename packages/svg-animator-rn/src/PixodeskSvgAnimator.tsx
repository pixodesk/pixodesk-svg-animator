/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import {
    generateNewIds,
    getAnimatorConfig,
    getDefs,
    materialiseAllInTree,
    validateNodeEffects,
    PxAnimatorEngine,
    type FillMode,
    type OutAction,
    type PlaybackDirection,
    type PxAnimatedSvgDocument,
    type PxNode,
} from '@pixodesk/svg-animator-core';
import React, { useEffect, useImperativeHandle, useMemo, useRef, type ComponentType, type ReactElement, type ReactNode } from 'react';
import { Dimensions, Pressable, View } from 'react-native';
import Animated, {
    cancelAnimation,
    Easing,
    runOnJS,
    useAnimatedProps,
    useSharedValue,
    withDelay,
    withRepeat,
    withTiming,
    type SharedValue,
} from 'react-native-reanimated';
import { compileTracks, sampleProps, type PxCompiledTracks, type PxElementTracks } from './PxRnTracks';
import { renderRnNode } from './PxRnRender';


// -- Public types -----------------------------------------------------------

/** Imperative playback API — mirrors ReactAnimatorApi from svg-animator-react. */
export interface RnAnimatorApi {
    /** Returns true if the animation is currently running. */
    isPlaying(): boolean;

    /** Starts or resumes the animation. */
    play(): void;

    /** Pauses the animation at its current state. */
    pause(): void;

    /** Stops the animation and resets it to its initial state. */
    cancel(): void;

    /** Jumps to the end of the animation and holds the final state. */
    finish(): void;

    /** Changes the speed of the animation. 1 is normal, 2 is double. */
    setPlaybackRate(rate: number): void;

    /** Returns the current playback time in milliseconds. */
    getCurrentTime(): number | null;

    /** Jumps to a specific time (in milliseconds) in the animation. */
    setCurrentTime(time: number): void;
}

export interface PixodeskSvgAnimatorProps {

    // -- Source ---------------------------------------------------------------

    /** The animation document to render. */
    doc: PxAnimatedSvgDocument;

    // -- Timing overrides -----------------------------------------------------

    /** Duration of a single iteration in milliseconds. */
    duration?: number;

    /** Delay before the animation starts, in milliseconds. */
    delay?: number;

    /** Number of iterations, or 'infinite' for endless looping. */
    iterations?: number | 'infinite';

    /** Defines the element's state when the animation is not active. */
    fill?: FillMode;

    /** Playback direction. */
    direction?: PlaybackDirection;

    /** Snap back to the start state after a natural finish. */
    resetOnFinish?: boolean;

    /**
     * What a second tap does when `startOn: 'click'` is active.
     * Defaults to the document's `trigger.outAction`, else `'pause'`.
     */
    outAction?: OutAction;

    // -- Declarative control --------------------------------------------------

    /** When true, honours the document trigger (`startOn: 'load'` plays on mount). */
    autoplay?: boolean;

    /** Starts playback unconditionally. */
    play?: boolean;

    /** Pauses current playback. */
    pause?: boolean;

    // -- Imperative control ---------------------------------------------------

    /** Ref populated with the imperative playback API. */
    apiRef?: React.RefObject<RnAnimatorApi | null>;

    // -- Controlled (external) time -------------------------------------------

    /** Seek to a fraction (0–1) of the whole timeline (duration × iterations). */
    time?: number;

    /** Seek to a specific time in milliseconds. */
    timeMs?: number;

    // -- Callbacks ------------------------------------------------------------

    onPlay?: () => void;
    onStop?: () => void;
    onPause?: () => void;
    onCancel?: () => void;
    onFinish?: () => void;
}


// -- Animated element wrapper ------------------------------------------------

const animatedComponentCache = new Map<ComponentType<any>, ComponentType<any>>();

function getAnimatedComponent(Component: ComponentType<any>): ComponentType<any> {
    let cached = animatedComponentCache.get(Component);
    if (!cached) {
        cached = Animated.createAnimatedComponent(Component as any);
        animatedComponentCache.set(Component, cached);
    }
    return cached;
}

/** One animated element: static props + UI-thread sampled animated props. */
function AnimatedPxElement({
    Component, staticProps, children, tracks, progress, stepMs, sampleCount,
}: {
    Component: ComponentType<any>;
    staticProps: Record<string, any>;
    children: ReactNode;
    tracks: PxElementTracks;
    progress: SharedValue<number>;
    stepMs: number;
    sampleCount: number;
}) {
    const AnimatedComponent = useMemo(() => getAnimatedComponent(Component), [Component]);

    // Runs on the UI thread every frame; `sampleProps` is a trivial indexed
    // lookup into the precompiled tracks — no interpolation logic on the hot path.
    const animatedProps = useAnimatedProps(() => {
        return sampleProps(tracks, progress.value, stepMs, sampleCount);
    }, [tracks, stepMs, sampleCount]);

    return (
        <AnimatedComponent {...staticProps} animatedProps={animatedProps}>
            {children}
        </AnimatedComponent>
    );
}


// -- Main component ----------------------------------------------------------

/**
 * React Native component for rendering and controlling Pixodesk SVG animations.
 *
 * The document is materialised once through the shared core pipeline (effects,
 * loops, motion-path sampling, animated-`<use>` inlining — identical to the
 * web frames engine), compiled into densely sampled per-element tracks, and
 * played back natively: a single reanimated progress value driven by
 * `withTiming`/`withRepeat` on the UI thread, with per-element worklets
 * indexing the precompiled tracks. No JS-thread frame loop.
 */
export function PixodeskSvgAnimator({
    doc, duration, delay, iterations, fill, direction, resetOnFinish, outAction: outActionProp,
    autoplay, play, pause, apiRef, time, timeMs,
    onPlay, onStop, onPause, onCancel, onFinish,
}: PixodeskSvgAnimatorProps): ReactElement | null {

    // -- Compile the document (once per doc/override change) ------------------

    const compiled = useMemo(() => {
        const warnings = validateNodeEffects(doc as PxNode);
        for (const w of warnings) console.warn('[PixodeskSvgAnimator] effects shape warning:', w);

        // `webapi` = the FULLY-FLATTENED materialisation: effects + loops +
        // sampled motion paths + animated `<use>` inlined into real `<g>`
        // clones + orphaned defs pruned. That last part is why RN must not use
        // the `frames` flavour: frames keeps `<use href="#animatedTarget">`
        // live references, which only work because the DOM propagates
        // attribute writes through `<use>` shadow trees. react-native-svg has
        // no such live propagation, so an animated `<use>` would render frozen.
        let prepared = materialiseAllInTree(doc, PxAnimatorEngine.webapi);

        // Apply prop overrides onto the animator config (mirrors the react wrapper).
        const animator = getAnimatorConfig(prepared) || {};
        prepared = {
            ...prepared,
            animator: {
                ...animator,
                duration: duration !== undefined ? duration : animator.duration,
                delay: delay !== undefined ? delay : animator.delay,
                iterations: iterations !== undefined ? iterations : animator.iterations,
                fill: fill !== undefined ? fill : animator.fill,
                direction: direction !== undefined ? direction : animator.direction,
                resetOnFinish: resetOnFinish !== undefined ? resetOnFinish : animator.resetOnFinish,
            },
        };

        prepared = generateNewIds(prepared);
        const tracks = compileTracks(prepared);
        return { doc: prepared, tracks };
    }, [doc, duration, delay, iterations, fill, direction, resetOnFinish]);

    const tracks: PxCompiledTracks = compiled.tracks;
    const totalDuration = tracks.duration * (tracks.iterations === Infinity ? 1 : tracks.iterations);

    // -- Playback state -------------------------------------------------------

    // Progress in ms within ONE iteration; iteration repetition/alternation is
    // expressed through withRepeat, so worklets only ever see [0, duration].
    const progress = useSharedValue(0);
    const playingRef = useRef(false);
    const rateRef = useRef(1);

    /** True when the current rate plays the timeline backwards. */
    const reversePlayback = () => rateRef.current < 0;

    /** Where the playhead rests once playback ends. `resetOnFinish` snaps back
     *  to the start; otherwise `fill` decides whether the final frame is held. */
    const restingPosition = () => {
        if (tracks.resetOnFinish) return 0;
        if (tracks.fill === 'none' || tracks.fill === 'backwards') return 0;
        return reversePlayback() ? 0 : tracks.duration;
    };

    const notifyFinish = () => {
        playingRef.current = false;
        progress.value = restingPosition();
        onFinish?.();
        onStop?.();
    };

    const startFrom = (fromMs: number) => {
        const dur = tracks.duration;
        const rate = rateRef.current || 1;
        const backwards = rate < 0;
        const speed = Math.abs(rate);
        // `direction` decides which end a leg runs toward; a negative playback
        // rate flips it again (the two compose, as in the Web Animations API).
        const directionReversed = tracks.direction === 'reverse' || tracks.direction === 'alternate-reverse';
        const reversedStart = backwards ? !directionReversed : directionReversed;
        const alternates = tracks.direction === 'alternate' || tracks.direction === 'alternate-reverse';
        const from = Math.max(0, Math.min(fromMs, dur));

        const legTarget = reversedStart ? 0 : dur;
        const legRemaining = Math.abs(legTarget - from) / speed;
        const repeats = tracks.iterations === Infinity ? -1 : tracks.iterations;

        cancelAnimation(progress);
        progress.value = reversedStart ? (from <= 0 ? dur : from) : (from >= dur ? 0 : from);

        const animation = repeats === 1
            ? withTiming(legTarget, { duration: legRemaining, easing: Easing.linear }, (finished) => {
                'worklet';
                if (finished) runOnJS(notifyFinish)();
            })
            : withRepeat(
                withTiming(legTarget, { duration: legRemaining, easing: Easing.linear }),
                repeats, alternates,
                (finished) => {
                    'worklet';
                    if (finished) runOnJS(notifyFinish)();
                }
            );

        progress.value = tracks.delay > 0 && from === 0
            ? withDelay(tracks.delay / speed, animation)
            : animation;

        playingRef.current = true;
    };

    const api: RnAnimatorApi = {
        isPlaying: () => playingRef.current,
        play: () => {
            // `startFrom` rewinds to the opposite end when the playhead is
            // already resting at a boundary (mirrors WAAPI, where play() on a
            // finished animation auto-rewinds).
            startFrom(progress.value);
            onPlay?.();
        },
        pause: () => {
            cancelAnimation(progress);
            playingRef.current = false;
            onPause?.();
            onStop?.();
        },
        cancel: () => {
            cancelAnimation(progress);
            progress.value = 0;
            playingRef.current = false;
            onCancel?.();
            onStop?.();
        },
        finish: () => {
            cancelAnimation(progress);
            playingRef.current = false;
            progress.value = restingPosition();
            onFinish?.();
            onStop?.();
        },
        setPlaybackRate: (rate: number) => {
            if (!isFinite(rate) || rate === 0) {
                console.warn('setPlaybackRate: rate must be finite and non-zero');
                return;
            }
            rateRef.current = rate;
            if (playingRef.current) startFrom(progress.value);
        },
        getCurrentTime: () => progress.value,
        setCurrentTime: (t: number) => {
            const wasPlaying = playingRef.current;
            cancelAnimation(progress);
            playingRef.current = false;
            const clamped = Math.max(0, Math.min(t, totalDuration));
            const withinIteration = tracks.duration > 0
                ? (clamped % tracks.duration) || (clamped === 0 ? 0 : tracks.duration)
                : 0;
            progress.value = withinIteration;
            // Seeking mid-playback continues from the new position rather than
            // silently pausing.
            if (wasPlaying) startFrom(withinIteration);
        },
    };

    useImperativeHandle(apiRef, () => api, [compiled]);

    // -- Declarative control --------------------------------------------------

    const trigger = getAnimatorConfig(compiled.doc)?.trigger;
    const startOn = trigger?.startOn ?? 'load';
    const outAction = outActionProp ?? trigger?.outAction ?? 'pause';

    useEffect(() => {
        if (time !== undefined || timeMs !== undefined) {
            const seekMs = timeMs !== undefined ? timeMs : (time ?? 0) * totalDuration;
            api.setCurrentTime(seekMs);
            return;
        }
        if (play !== undefined || pause !== undefined) {
            if (play && !pause) api.play();
            else if (pause) api.pause();
            else if (play === false) api.finish();
            else api.play();
            return;
        }
        // 'click' and 'scrollIntoView' start from their own handlers below.
        if (autoplay && startOn === 'load') {
            api.play();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [compiled, autoplay, play, pause, time, timeMs]);

    // `startOn: 'scrollIntoView'` — react-native has no IntersectionObserver, so
    // visibility is sampled by measuring the view against the window box. The
    // poll is cheap (a native measure every 200ms) and only runs while this
    // trigger is active; `outAction` decides what leaving the viewport does.
    const scrollRef = useRef<View | null>(null);
    const inViewRef = useRef(false);
    useEffect(() => {
        if (!autoplay || startOn !== 'scrollIntoView') return;
        const threshold = trigger?.scrollIntoViewThreshold ?? 0;
        inViewRef.current = false;

        const check = () => {
            const node = scrollRef.current;
            if (!node) return;
            node.measureInWindow((_x, y, _w, h) => {
                if (!h) return;
                const screen = Dimensions.get('window').height;
                const visible = Math.max(0, Math.min(y + h, screen) - Math.max(y, 0));
                const ratio = visible / h;
                const isIn = ratio > 0 && ratio >= threshold;
                if (isIn === inViewRef.current) return;
                inViewRef.current = isIn;
                if (isIn) {
                    if (rateRef.current < 0) api.setPlaybackRate(Math.abs(rateRef.current));
                    api.play();
                } else if (outAction === 'reset') api.cancel();
                else if (outAction === 'reverse') { api.setPlaybackRate(-Math.abs(rateRef.current || 1)); api.play(); }
                else if (outAction !== 'continue') api.pause();
            });
        };

        check();
        const id = setInterval(check, 200);
        return () => clearInterval(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [compiled, autoplay, startOn, outAction]);

    // Stop cleanly on unmount / doc swap.
    useEffect(() => {
        return () => {
            cancelAnimation(progress);
            playingRef.current = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [compiled]);

    // -- Render ---------------------------------------------------------------

    const trackById = useMemo(() => {
        const map = new Map<string, PxElementTracks>();
        for (const el of tracks.elements) map.set(el.id, el);
        return map;
    }, [tracks]);

    const warningsRef = useRef<Array<string>>([]);
    const root = useMemo(() => {
        warningsRef.current = [];
        return renderRnNode(compiled.doc as PxNode, {
            warnings: warningsRef.current,
            defs: getDefs(compiled.doc),
            decorate: (node, Component, staticProps, children) => {
                const id = (node as any).id;
                const elTracks = id ? trackById.get(id) : undefined;
                if (!elTracks) return undefined;
                return (
                    <AnimatedPxElement
                        key={staticProps.key}
                        Component={Component}
                        staticProps={staticProps}
                        tracks={elTracks}
                        progress={progress}
                        stepMs={tracks.stepMs}
                        sampleCount={tracks.sampleCount}
                    >
                        {children}
                    </AnimatedPxElement>
                );
            },
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [compiled, trackById]);

    useEffect(() => {
        for (const w of warningsRef.current) console.warn('[PixodeskSvgAnimator]', w);
    }, [root]);

    // `startOn: 'click'` — the touch analogue of the web player's click trigger:
    // tap to start, tap again to apply `outAction`. Hover (`mouseOver`) has no
    // touch equivalent and `scrollIntoView` needs the surrounding scroll view,
    // so both are left to the host app.
    if (autoplay && startOn === 'scrollIntoView' && root) {
        // `collapsable={false}` keeps the view in the native tree so it can be measured.
        return <View ref={scrollRef} collapsable={false}>{root}</View>;
    }

    if (autoplay && startOn === 'click' && root) {
        return (
            <Pressable
                onPress={() => {
                    if (playingRef.current) {
                        if (outAction === 'reset') api.cancel();
                        else if (outAction === 'reverse') { api.setPlaybackRate(-Math.abs(rateRef.current || 1)); api.play(); }
                        else if (outAction !== 'continue') api.pause();
                    } else {
                        if (rateRef.current < 0) api.setPlaybackRate(Math.abs(rateRef.current));
                        api.play();
                    }
                }}
            >
                {root}
            </Pressable>
        );
    }

    return root;
}

export default PixodeskSvgAnimator;
