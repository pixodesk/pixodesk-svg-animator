/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { clampSeekMs, createDiagnostics, createRunClock, isValidPlaybackRate, progressSpanMs, progressToTimeMs, PX_RATE_REJECTED, PxDiagnosticKind, seekCeilingMs, timeToProgress, type PxDiagnostic, type PxDiagnostics,
    reportDocumentDiagnostics, generateNewIds, getAnimatorConfig, getDefs, materialiseAllInTree, resolveTrigger, validateNodeEffects, PxTimelineEngine, PxControlMode, resolveControlMode, type PxFillMode, type PxOutAction, type PxPlaybackDirection, type PxAnimatedSvgDocument, type PxAnimatorConfigPatch, type PxNode, type PxStartOn, applyAnimatorConfig, foldAnimatorConfigShortcuts } from '@pixodesk/svg-animator-core';
import React, { createElement, useEffect, useImperativeHandle, useMemo, useRef, useState, type ComponentType, type ReactElement, type ReactNode } from 'react';
import { Dimensions, Platform, Pressable, View } from 'react-native';
import Animated, {
    cancelAnimation,
    useAnimatedReaction,
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
import { renderRnNode, type RenderRnNodeOptions } from './PxRnRender';
import { PxRnErrorBoundary } from './PxRnErrorBoundary';
import { openClosedTextPathTargets } from './PxRnSafety';


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

    /** Current playback time, ms from the start of the whole run (iterations included). */
    getCurrentTime(): number | null;

    /** Seeks, ms from the start of the whole run; clamped to `[0, duration × iterations]`. */
    setCurrentTime(time: number): void;

    /**
     * Current position as 0–1 of the whole run — the read twin of the `progress` prop,
     * and ONE iteration when `iterations` is `'infinite'`.
     */
    getCurrentProgress(): number | null;

    /** Seeks to 0–1 of the whole run, clamped to `[0, 1]`. */
    setCurrentProgress(progress: number): void;
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

    /** Shortcut for `config.timeline.trigger.startOn`. */
    startOn?: PxStartOn;

    /**
     * Per-instance override of the document's `animator` config — the same shape as `animator`
     * in SCHEMA.md, deep-merged over what the document says; `null` at a slot deletes it.
     * Replaces the former flat `fill` / `direction` / `resetOnFinish` / `outAction` props, so
     * every surface takes one vocabulary. Also accepts a JSON string.
     *
     * `timeline.engine` is accepted but ignored here: React Native always materialises the
     * WAAPI-style flattening, because react-native-svg has no `<use>` shadow-tree propagation.
     */
    config?: PxAnimatorConfigPatch | string;

    /** Start from the player's defaults instead of the document's playback settings. */
    resetDocDefaults?: boolean;

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
    progress?: number;

    /** Seek to a specific time in milliseconds. */
    time?: number;

    // -- Callbacks ------------------------------------------------------------

    onPlay?: () => void;
    onStop?: () => void;
    onPause?: () => void;
    onCancel?: () => void;
    onFinish?: () => void;


    // -- Failure handling -----------------------------------------------------

    /**
     * Called when a document cannot be compiled or rendered. The component
     * renders {@link fallback} instead of throwing, so a single broken
     * animation never takes down the screen around it.
     *
     * Only JavaScript failures reach this — a crash inside react-native-svg's
     * native renderer bypasses JavaScript entirely.
     */
    onError?: (error: Error, componentStack?: string) => void;

    /** Rendered in place of the animation after a failure. Default: nothing. */
    fallback?: (error: Error) => ReactElement | null;

    // -- Diagnostics (API review §5) -----------------------------------------

    /**
     * Called for anything survivable — an unknown easing, a config key that could not be
     * applied, a rejected playback rate. The animation still plays.
     *
     * Without this, these go to `console.warn`.
     */
    onWarn?: (diagnostic: PxDiagnostic) => void;

    /**
     * Silence the console FALLBACK — `true` for everything, or just the kinds listed, so
     * `platform` chatter can be quiet while `document` problems still speak.
     * `onWarn` / `onError` still fire if given.
     */
    silent?: boolean | ReadonlyArray<PxDiagnosticKind>;
}


// -- Animated element wrapper ------------------------------------------------

/**
 * Whether react-native-svg is backed by NATIVE views here, rather than by the
 * DOM through react-native-web.
 *
 * The two want different things from an animated `transform`: a native view
 * declares a `matrix` prop taking six numbers, while the DOM wants a
 * `transform` attribute holding an SVG string. Getting it wrong is silent —
 * the value is dropped and the element simply never moves — so this single
 * constant decides it once and feeds both the track compiler (value form) and
 * the sampler (prop name). Everything else in the package defaults to the
 * DOM-compatible form.
 */
const NATIVE_SVG_VIEWS = Platform.OS !== 'web';

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
        // On iOS/Android these values bypass react-native-svg's JS prop layer
        // and land on the native view, which declares `matrix`, not
        // `transform`. The web build keeps the DOM-facing `transform` name.
        return sampleProps(tracks, progress.value, stepMs, sampleCount, NATIVE_SVG_VIEWS);
    }, [tracks, stepMs, sampleCount]);

    return (
        <AnimatedComponent {...staticProps} animatedProps={animatedProps}>
            {children}
        </AnimatedComponent>
    );
}


/**
 * react-native-svg elements whose `render()` returns `null`. They carry data for
 * their PARENT (a `<Stop>` is read by the gradient that owns it) rather than
 * producing a native view, so reanimated has nothing to attach to — wrapping one
 * in `Animated.createAnimatedComponent` throws
 * "Cannot find host instance for this component".
 */
const NON_HOST_TAGS = new Set(['stop', 'feMergeNode']);

/**
 * Definition elements — they describe paint/geometry for something else rather
 * than drawing themselves. Their animated attributes (a gradient's `y1`, a
 * stop's `stop-color`) do not reliably flow through reanimated's animated-props
 * path, so an animated def is rendered by re-sampling from JS instead. There
 * are only ever a handful per document and they change slowly, so the cost is
 * negligible — visual elements still animate entirely on the UI thread.
 */
const SAMPLED_DEF_TAGS = new Set(['linearGradient', 'radialGradient', ...NON_HOST_TAGS]);

/** True when this subtree must be driven from JS rather than the UI thread:
 *  either the node itself is an animated def, or it owns an animated non-host
 *  child (an animated `<Stop>` only re-renders via its parent gradient). */
function needsJsSampling(node: PxNode, trackById: Map<string, PxElementTracks>): boolean {
    const id = (node as any).id;
    if (SAMPLED_DEF_TAGS.has(String(node.type)) && id && trackById.has(id)) return true;
    return (node.children ?? []).some(c => needsJsSampling(c, trackById));
}

/**
 * Renders a subtree whose animation cannot run on the UI thread (see
 * {@link NON_HOST_TAGS}) by re-rendering it from JS with sampled values.
 *
 * Changing a `<Stop>`'s props does not re-render its parent gradient, so the
 * whole subtree is rebuilt — which is why this wraps the gradient rather than
 * the stop. The reaction itself runs on the UI thread and only crosses to JS
 * when the QUANTISED sample index changes, capping these few elements at
 * ~30fps instead of a JS call every frame.
 */
function SampledSubtree({
    node, trackById, progress, stepMs, sampleCount, renderOpts,
}: {
    node: PxNode;
    trackById: Map<string, PxElementTracks>;
    progress: SharedValue<number>;
    stepMs: number;
    sampleCount: number;
    renderOpts: RenderRnNodeOptions;
}) {
    const [idx, setIdx] = useState(0);

    useAnimatedReaction(
        () => Math.floor(Math.round(progress.value / stepMs) / 2) * 2,   // half-rate
        (next, prev) => {
            if (next !== prev) runOnJS(setIdx)(next);
        },
        [stepMs]
    );

    const tMs = Math.min(Math.max(idx, 0), sampleCount - 1) * stepMs;

    return renderRnNode(node, {
        ...renderOpts,
        // Sampled values are baked in as PLAIN props — nothing reanimated-driven.
        decorate: (n, Component, staticProps, children, key) => {
            const id = (n as any).id;
            const tracks = id ? trackById.get(id) : undefined;
            if (!tracks) return undefined;
            // Wire prop names, NOT the native ones: these go back through
            // react-native-svg's JS prop layer, which does the renaming itself.
            const sampled = sampleProps(tracks, tMs, stepMs, sampleCount);
            return createElement(Component, { ...staticProps, ...sampled, key }, children);
        },
    });
}



/** Overrides that shadow the document's own `animator` config. */
interface ConfigOverrides {
    config?: PxAnimatorConfigPatch | string;
    resetDocDefaults?: boolean;
    duration?: number;
    delay?: number;
    iterations?: number | 'infinite';
    startOn?: PxStartOn;
}

interface Compiled {
    /** Materialised document, or null when compilation failed. */
    doc: PxAnimatedSvgDocument | null;
    tracks: PxCompiledTracks;
    error: Error | null;
}

/** Playable-but-empty tracks, so a failed compile still satisfies every hook
 *  below it — React forbids skipping hooks on an error path. */
const EMPTY_TRACKS: PxCompiledTracks = {
    duration: 1, iterations: 1, direction: 'normal', delay: 0,
    fill: 'forwards', resetOnFinish: false, stepMs: 1, sampleCount: 2, elements: [],
};

/**
 * Materialises + compiles a document. Extracted from the component so the
 * whole thing sits behind one try/catch, and so it can be tested directly.
 */
function compileDocument(doc: PxAnimatedSvgDocument, overrides: ConfigOverrides, diag: PxDiagnostics): Compiled {
    const { config, resetDocDefaults, duration, delay, iterations, startOn } = overrides;
    const warnings = validateNodeEffects(doc as PxNode);
    for (const w of warnings) diag.warn(PxDiagnosticKind.document, 'effects shape: ' + w);
    // The whole-document boundary diagnostic — see the note in the web player's entry.
    reportDocumentDiagnostics(doc, '[PixodeskSvgAnimator]');

    // The per-instance override, applied to the WIRE document BEFORE anything reads the
    // config — `materialiseAllInTree` samples motion paths against `duration`, so a later
    // patch would be read by none of the pipeline. Same call, same rules, on every surface.
    const patch = foldAnimatorConfigShortcuts(config, { duration, delay, iterations, startOn });
    if (patch !== undefined || resetDocDefaults) {
        const applied = applyAnimatorConfig(doc, patch ?? {}, { resetDefaults: !!resetDocDefaults });
        for (const w of applied.warnings) diag.warn(PxDiagnosticKind.usage, 'config override: ' + w);
        doc = applied.doc;
    }

    // `waapi` = the FULLY-FLATTENED materialisation: effects + loops +
    // sampled motion paths + animated `<use>` inlined into real `<g>`
    // clones + orphaned defs pruned. That last part is why RN must not use
    // the `frames` flavour: frames keeps `<use href="#animatedTarget">`
    // live references, which only work because the DOM propagates
    // attribute writes through `<use>` shadow trees. react-native-svg has
    // no such live propagation, so an animated `<use>` would render frozen.
    let prepared = materialiseAllInTree(doc, PxTimelineEngine.native);

    // Sidestep a react-native-svg NATIVE crash (see PxRnSafety). Guarded on
    // the platform because the DOM renders this case correctly and the web
    // document must stay exactly as the core pipeline produced it.
    if (NATIVE_SVG_VIEWS) {
        prepared = openClosedTextPathTargets(prepared as PxNode) as PxAnimatedSvgDocument;
    }

    prepared = generateNewIds(prepared);
    const tracks = compileTracks(prepared, { native: NATIVE_SVG_VIEWS });
    return { doc: prepared, tracks, error: null };
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
    doc, config, resetDocDefaults, duration, delay, iterations, startOn,
    // (`progress` prop aliased — the name is taken by the internal reanimated SharedValue)
    autoplay, play, pause, apiRef, progress: progressProp, time,
    onPlay, onStop, onPause, onCancel, onFinish, onError, fallback, onWarn, silent,
}: PixodeskSvgAnimatorProps): ReactElement | null {

    // -- Compile the document (once per doc/override change) ------------------

    // `config` is an object prop: a fresh literal every render would otherwise recompile the
    // whole document (materialise + compile tracks), which is the expensive path. Key on its
    // CONTENT instead — the override is small, the document is not.
    const configKey = typeof config === 'string' ? config : JSON.stringify(config ?? null);


    /**
     * The diagnostics channel, built from the CURRENT props each time (API review §5).
     * Deliberately not hoisted into a wrapper closure: `(m, d) => onWarn?.(m, d)` would always
     * be a function, so the channel would believe a handler exists and the console fallback
     * would never fire for anyone who passed nothing.
     */
    const makeDiag = (): PxDiagnostics => createDiagnostics({
        onWarn,
        // This component's public `onError` is richer — `(error, componentStack?)` — and the
        // error boundary hands it a component stack. Adapt rather than narrow it; the ternary
        // keeps "not given" as undefined, so the console fallback still fires.
        onError: onError ? (d: PxDiagnostic) => onError(d.error ?? new Error(d.message)) : undefined,
        silent,
    }, '[PixodeskSvgAnimator]');

    const compiled = useMemo((): Compiled => {
        try {
            return compileDocument(
                doc,
                { config, resetDocDefaults, duration, delay, iterations, startOn },
                makeDiag(),
            );
        } catch (e) {
            // A malformed document must not take the host screen down with it.
            const error = e instanceof Error ? e : new Error(String(e));
            makeDiag().warn(PxDiagnosticKind.internal, 'could not compile the document: ' + error.message);
            return { doc: null, tracks: EMPTY_TRACKS, error };
        }
        // `config` is an object prop, so a fresh literal each render would recompile the whole
        // document. Key on its CONTENT — the override is small, unlike the document.
    }, [doc, configKey, resetDocDefaults, duration, delay, iterations, startOn]);

    const tracks: PxCompiledTracks = compiled.tracks;
    // The span `progress` 0–1 covers (ONE iteration when endless) — NOT the seek ceiling.
    const totalDuration = progressSpanMs(tracks.duration, tracks.iterations);
    // How far a seek may go: unbounded when endless (review §3).
    const seekCeiling = seekCeilingMs(tracks.duration, tracks.iterations);

    // Whole-run time lives on its own clock: `progress` below is deliberately within ONE
    // iteration, and `withRepeat` never reports how many have elapsed, so the run time cannot
    // be read back off it. See `createRunClock`.
    const runClock = useMemo(() => createRunClock(seekCeiling), [seekCeiling]);

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
        runClock.seek(Number.isFinite(seekCeiling) ? seekCeiling : tracks.duration);
        runClock.stop();
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
            // finished animation auto-rewinds) — the run clock rewinds with it,
            // or the time would keep counting on from the old end.
            if (Number.isFinite(seekCeiling) && runClock.now() >= seekCeiling) runClock.seek(0);
            runClock.start(rateRef.current);
            startFrom(progress.value);
            onPlay?.();
        },
        pause: () => {
            cancelAnimation(progress);
            playingRef.current = false;
            runClock.stop();
            onPause?.();
            onStop?.();
        },
        cancel: () => {
            cancelAnimation(progress);
            progress.value = 0;
            playingRef.current = false;
            runClock.seek(0);
            runClock.stop();
            onCancel?.();
            onStop?.();
        },
        finish: () => {
            cancelAnimation(progress);
            playingRef.current = false;
            runClock.seek(Number.isFinite(seekCeiling) ? seekCeiling : tracks.duration);
            runClock.stop();
            progress.value = restingPosition();
            onFinish?.();
            onStop?.();
        },
        setPlaybackRate: (rate: number) => {
            if (!isValidPlaybackRate(rate)) {
                makeDiag().warn(PxDiagnosticKind.usage, PX_RATE_REJECTED);
                return;
            }
            rateRef.current = rate;
            if (playingRef.current) {
                runClock.start(rate);   // resume from the current time at the new rate
                startFrom(progress.value);
            }
        },

        // Ms from the start of the WHOLE run, like every other engine (review §3). This used
        // to return `progress.value`, which is ms within the current iteration — so a slider
        // built on it jumped back to 0 every time the animation repeated.
        getCurrentTime: () => runClock.now(),

        setCurrentTime: (t: number) => {
            const wasPlaying = playingRef.current;
            cancelAnimation(progress);
            playingRef.current = false;
            // Clamp against the SEEK ceiling, not the progress span — the old clamp capped an
            // endless timeline at one iteration.
            const clamped = clampSeekMs(t, seekCeiling);
            runClock.seek(clamped);
            const withinIteration = tracks.duration > 0
                ? (clamped % tracks.duration) || (clamped === 0 ? 0 : tracks.duration)
                : 0;
            progress.value = withinIteration;
            // Seeking mid-playback continues from the new position rather than
            // silently pausing.
            if (wasPlaying) startFrom(withinIteration);
            else runClock.stop();
        },

        getCurrentProgress: () => timeToProgress(runClock.now(), tracks.duration, tracks.iterations),

        setCurrentProgress: (p: number) => {
            api.setCurrentTime(progressToTimeMs(p, tracks.duration, tracks.iterations));
        },
    };

    useImperativeHandle(apiRef, () => api, [compiled]);

    // -- Declarative control --------------------------------------------------

    // The EFFECTIVE trigger, read back off the COMPILED document — so it already reflects the
    // `config` override and the `startOn` shortcut, both merged in before compilation.
    // Resolved through core's one table, so a document means the same here as on the web:
    // no `startOn` = 'load', no `outAction` = 'continue'.
    const trigger = resolveTrigger(compiled.doc ? getAnimatorConfig(compiled.doc)?.trigger : undefined);
    const effectiveStartOn = trigger.startOn;
    const effectiveOutAction = trigger.outAction;

    // ONE control-mode rule, decided in core and shared with React and Vue (API review §1/§7).
    // This component always had the right ORDER but no name for it, and never told anyone when
    // two tiers of props were passed together.
    const { mode: compMode, warnings: modeWarnings } =
        resolveControlMode({ progress: progressProp, time, play, pause, autoplay });

    useEffect(() => {
        const diag = makeDiag();
        for (const w of modeWarnings) diag.warn(PxDiagnosticKind.usage, w);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [modeWarnings.join('|')]);

    useEffect(() => {
        if (compMode === PxControlMode.fixedTime) {
            const seekMs = time !== undefined
                ? time
                : progressToTimeMs(progressProp ?? 0, tracks.duration, tracks.iterations);
            api.setCurrentTime(seekMs);
            return;
        }
        if (compMode === PxControlMode.play) {
            if (play && !pause) api.play();
            else if (pause) api.pause();
            else if (play === false) api.finish();
            else api.play();
            return;
        }
        // 'click' and 'scrollIntoView' start from their own handlers below.
        if (compMode === PxControlMode.autoplay && effectiveStartOn === 'load') {
            api.play();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [compiled, compMode, autoplay, play, pause, progressProp, time]);

    // `startOn: 'scrollIntoView'` — react-native has no IntersectionObserver, so
    // visibility is sampled by measuring the view against the window box. The
    // poll is cheap (a native measure every 200ms) and only runs while this
    // trigger is active; `outAction` decides what leaving the viewport does.
    const scrollRef = useRef<View | null>(null);
    const inViewRef = useRef(false);
    useEffect(() => {
        if (!autoplay || effectiveStartOn !== 'scrollIntoView') return;
        const threshold = trigger.scrollIntoViewThreshold;
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
                } else if (effectiveOutAction === 'reset') api.cancel();
                else if (effectiveOutAction === 'reverse') { api.setPlaybackRate(-Math.abs(rateRef.current || 1)); api.play(); }
                else if (effectiveOutAction !== 'continue') api.pause();
            });
        };

        check();
        const id = setInterval(check, 200);
        return () => clearInterval(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [compiled, autoplay, effectiveStartOn, effectiveOutAction]);

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
    const renderErrorRef = useRef<Error | null>(null);
    const root = useMemo(() => {
        warningsRef.current = [];
        renderErrorRef.current = null;
        if (!compiled.doc) return null;

        const renderOpts: RenderRnNodeOptions = {
            warnings: warningsRef.current,
            defs: getDefs(compiled.doc),
        };
        try {
            return renderRnNode(compiled.doc as PxNode, {
                ...renderOpts,
                decorate: (node, Component, staticProps, children, key) => {
                    // An animated definition subtree (gradient / its stops) cannot be
                    // driven on the UI thread — hand the WHOLE subtree to the
                    // JS-sampled renderer and stop descending here.
                    if (needsJsSampling(node, trackById)) {
                        return (
                            <SampledSubtree
                                key={key}
                                node={node}
                                trackById={trackById}
                                progress={progress}
                                stepMs={tracks.stepMs}
                                sampleCount={tracks.sampleCount}
                                renderOpts={renderOpts}
                            />
                        );
                    }

                    const id = (node as any).id;
                    const elTracks = id ? trackById.get(id) : undefined;
                    if (!elTracks) return undefined;
                    return (
                        <AnimatedPxElement
                            key={key}
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
        } catch (e) {
            // Building the element tree threw — report it and render nothing
            // rather than propagating and unmounting the host screen.
            const error = e instanceof Error ? e : new Error(String(e));
            renderErrorRef.current = error;
            makeDiag().warn(PxDiagnosticKind.internal, 'could not render the document: ' + error.message);
            return null;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [compiled, trackById]);

    useEffect(() => {
        const diag = makeDiag();
        // `platform`: these come from the react-native-svg prop mapper — shapes this renderer
        // cannot express, rather than anything wrong with the file.
        for (const w of warningsRef.current) diag.warn(PxDiagnosticKind.platform, w);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [root]);

    // Surface compile/render failures to the host exactly once per occurrence.
    const failure = compiled.error ?? renderErrorRef.current;
    useEffect(() => {
        if (failure) onError?.(failure);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [failure]);

    if (failure) return fallback ? fallback(failure) : null;

    // `startOn: 'click'` — the touch analogue of the web player's click trigger:
    // tap to start, tap again to apply `outAction`. Hover (`mouseOver`) has no
    // touch equivalent and `scrollIntoView` needs the surrounding scroll view,
    // so both are left to the host app.
    let content: ReactElement | null = root;

    if (autoplay && effectiveStartOn === 'scrollIntoView' && root) {
        // `collapsable={false}` keeps the view in the native tree so it can be measured.
        content = <View ref={scrollRef} collapsable={false}>{root}</View>;
    } else if (autoplay && effectiveStartOn === 'click' && root) {
        content = (
            <Pressable
                onPress={() => {
                    if (playingRef.current) {
                        if (effectiveOutAction === 'reset') api.cancel();
                        else if (effectiveOutAction === 'reverse') { api.setPlaybackRate(-Math.abs(rateRef.current || 1)); api.play(); }
                        else if (effectiveOutAction !== 'continue') api.pause();
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

    // Catches what the try/catch above cannot: throws during React's own render
    // and commit of the tree — react-native-svg internals, reanimated failing
    // to attach to a component that turns out not to be a host view, and so on.
    return (
        <PxRnErrorBoundary onError={onError} fallback={fallback} diag={makeDiag()}>
            {content}
        </PxRnErrorBoundary>
    );
}

export default PixodeskSvgAnimator;
