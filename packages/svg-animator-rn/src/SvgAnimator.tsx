// @px-area entry
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { toPxDocument, type PxDocumentInput, PxDiagnosticCode, PxDiagnosticKind, type PxAnimationPlayerHandle, type PxAnimationPlayerCallbacks, type PxPlaybackOverride, type PxDiagnostics, getAnimatorConfig, getDefinitions, prepareDocument, PxDocStage, PxTimelineEngine, PxPlayEndAction, PxOutOfViewAction, PxTriggerAction, PxTriggerEvent, PxPlaybackDirection, type PxDocument, type PxNode, type PxPlayExecutor, applyAnimatorConfig, type PxPlaybackOverrideInput } from '@pixodesk/svg-animator-core';
import { applyDeclarativeAction, clampSeekMs, composeApiExtras, createRunClock, isValidPlaybackRate, type PxDeclarativeProps, PxPlaybackWorld, resolveDeclarativePlayback, resolvePlaybackWorld, progressSpanMs, progressToTimeMs, seekCeilingMs, timeToProgress, type PxControlProps, resolveGate, resolveTrigger, triggerActionFor, triggerListsEvent, PxControlMode, resolveControlMode, applyPlaybackOverride } from '@pixodesk/svg-animator-core/engine';
import { carryPrep, deepEquals, reportDocumentProblems, validateDeprecatedTransformChannels } from '@pixodesk/svg-animator-core/internal';
import { createDiagnostics, reportDocumentDiagnostics } from '@pixodesk/svg-animator-core/internal';
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
    type AnimatedProps,
    type SharedValue,
} from 'react-native-reanimated';
import { compileTracks, sampleProps, type PxCompiledTracks, type PxElementTracks } from './PxRnTracks';
import { renderRnNode, type RenderRnNodeOptions } from './PxRnRender';
import { RN_SVG_COMPONENTS, type RnSvgComponent, type RnSvgProps } from './PxRnTypeMap';
import { PxRnErrorBoundary } from './PxRnErrorBoundary';
import { openClosedTextPathTargets } from './PxRnSafety';


// -- Public types -----------------------------------------------------------

/**
 * The imperative handle `playerRef` is filled with — core's `PxAnimationPlayerHandle` under this package's
 * name (review §9). It no longer "mirrors" the React one by hand: the local copy had already
 * drifted (its `setPlaybackRate` comment lost "negative plays backwards"). One definition.
 * @public
 */

/**
 * The component's props. The playback override, the control props and the callbacks are core's
 * shared shapes (review §9) — `PxPlaybackOverride`, `PxControlProps` and
 * `PxAnimationPlayerCallbacks` — so React, Vue and React Native cannot drift apart. Only what differs
 * on this platform is declared here: `fallback`, which has no web counterpart.
 * @public
 */
export type SvgAnimationPlayerProps = PxPlaybackOverride & PxControlProps & PxAnimationPlayerCallbacks & {

    // -- Source ---------------------------------------------------------------

    /** The animation document to render. */
    doc: PxDocumentInput;

    // (`timeline.engine` is accepted but ignored here: React Native always uses the `native`, fully
    // flattened materialization, because react-native-svg has no `<use>` shadow-tree propagation.)

    // -- Imperative control ---------------------------------------------------

    /**
     * Ref populated with the imperative playback API. Filled in EVERY mode and never picks one
     * (review §1): `playOnTrigger` next to it still autoplays.
     */
    playerRef?: React.RefObject<PxAnimationPlayerHandle | null>;

    // -- Failure handling -----------------------------------------------------
    // A document that cannot be compiled or rendered is reported through `onError` — the same
    // `(diagnostic) => void` as every other player (review §25.1), with `diagnostic.error` the
    // thrown Error and, when the error boundary caught it, the component stack in `diagnostic.data`.
    // The component renders `fallback` instead of throwing, so one broken animation never
    // takes down the screen around it. Only JavaScript failures reach this — a crash inside
    // react-native-svg's native renderer bypasses JavaScript entirely.

    /** Rendered in place of the animation after a failure. Default: nothing. */
    fallback?: (error: Error) => ReactElement | null;
};


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

/** The reanimated twin of an element component: the same props, any of them animatable. */
type AnimatedRnSvgComponent = ComponentType<AnimatedProps<RnSvgProps>>;

/** The animated twin of an element component — from the constant table built at load (below). A
 *  component outside the table gets a fresh twin; the caller memoizes it per element instance. */
function getAnimatedComponent(Component: RnSvgComponent): AnimatedRnSvgComponent {
    return ANIMATED_SVG_COMPONENTS.get(Component) ?? Animated.createAnimatedComponent(Component);
}

/** One animated element: static props + UI-thread sampled animated props. */
function AnimatedPxElement({
    Component, staticProps, children, tracks, progress, stepMs, sampleCount,
}: {
    Component: RnSvgComponent;
    staticProps: RnSvgProps;
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

/** Every host element component → its reanimated twin, built ONCE at load: a constant table like the
 *  attribute sets, never filled lazily. Shared by design — a new twin per render would be a new React
 *  component type and remount the subtree. */
const ANIMATED_SVG_COMPONENTS: ReadonlyMap<RnSvgComponent, AnimatedRnSvgComponent> = new Map(
    [...new Set(Object.entries(RN_SVG_COMPONENTS).filter(([tag]) => !NON_HOST_TAGS.has(tag)).map(([, C]) => C))]
        .map((C): [RnSvgComponent, AnimatedRnSvgComponent] => [C, Animated.createAnimatedComponent(C)]),
);

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
    const id = node.id;
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
            const id = n.id;
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
/** The override subset of the props — core's shared shape, not a local copy (review §9). */
type ConfigOverrides = PxPlaybackOverrideInput;

interface Compiled {
    /** Materialized document, or null when compilation failed. */
    doc: PxDocument | null;
    tracks: PxCompiledTracks;
    error: Error | null;
}

/** Playable-but-empty tracks, so a failed compile still satisfies every hook
 *  below it — React forbids skipping hooks on an error path. */
const EMPTY_TRACKS: PxCompiledTracks = {
    duration: 1, iterations: 1, direction: 'normal', delay: 0,
    fill: 'forwards', resetOnFinish: false, stepMs: 1, sampleCount: 2, elements: [],
};

// @px-importance important
/**
 * Materializes + compiles a document. Extracted from the component so the
 * whole thing sits behind one try/catch, and so it can be tested directly.
 */
function compileDocument(doc: PxDocument, overrides: ConfigOverrides, pinPoseFill: boolean, diag: PxDiagnostics): Compiled {
    // Migrate + check ONCE — the same `checked` stage and reporting as the web player's entry.
    const onProblems = (problems: Parameters<typeof reportDocumentProblems>[0]) => reportDocumentProblems(problems, diag);
    doc = prepareDocument(doc, { stage: PxDocStage.checked, onProblems });
    // §6: per-key transform channels still play (old migrated files), but are named as deprecated
    for (const w of validateDeprecatedTransformChannels(doc)) diag.warn(PxDiagnosticKind.document, PxDiagnosticCode.deprecatedTransformChannel, w);
    // The whole-document boundary diagnostic — see the note in the web player's entry.
    reportDocumentDiagnostics(doc, '[SvgAnimationPlayer]');

    // The per-instance override, applied to the WIRE document BEFORE anything reads the
    // config — `materializeAllInTree` samples motion paths against `duration`, so a later
    // patch would be read by none of the pipeline. Same call, same rules, on every surface.
    const overridden = applyPlaybackOverride(doc, overrides);
    for (const w of overridden.warnings) diag.warn(PxDiagnosticKind.usage, PxDiagnosticCode.timelineOverrideIgnored, w);
    doc = overridden.doc;

    // §10 / D5: in the play tier's ONE-SHOT world the pose contract beats the file's rest poses — pin
    // both sides (the first frame before, the last frame after), so the held poses are the same on
    // every file (a `playEndAction: 'reset'` document would otherwise revert to its static attrs).
    if (pinPoseFill && resolvePlaybackWorld((getAnimatorConfig(doc) || {}).iterations) === PxPlaybackWorld.oneShot) {
        doc = applyAnimatorConfig(doc, { timeline: { showFirstFrameBeforePlayOn: true, playEndAction: PxPlayEndAction.hold } }).doc;
    }

    // `native` = the FULLY-FLATTENED materialization: effects + loops +
    // sampled motion paths + animated `<use>` inlined into real `<g>`
    // clones + orphaned defs pruned. That last part is why RN must not use
    // the `js` flavor: the frame loop keeps `<use href="#animatedTarget">`
    // live references, which only work because the DOM propagates
    // attribute writes through `<use>` shadow trees. react-native-svg has
    // no such live propagation, so an animated `<use>` would render frozen.
    // Through the shared staged pipeline: version-migrated → resolved → plain.
    let prepared: PxDocument = prepareDocument(doc, { engine: PxTimelineEngine.native, onProblems });   // only the override's own values can still need repair

    // Sidestep a react-native-svg NATIVE crash (see PxRnSafety). Guarded on
    // the platform because the DOM renders this case correctly and the web
    // document must stay exactly as the core pipeline produced it.
    // It edits textPath targets only — the animator config is untouched, so the stamp carries over.
    if (NATIVE_SVG_VIEWS) {
        prepared = carryPrep(prepared, openClosedTextPathTargets(prepared as PxNode) as PxDocument);
    }

    prepared = prepareDocument(prepared, { engine: PxTimelineEngine.native, freshIds: true });
    const tracks = compileTracks(prepared, { native: NATIVE_SVG_VIEWS });
    return { doc: prepared, tracks, error: null };
}


// -- Main component ----------------------------------------------------------

/**
 * React Native component for rendering and controlling Pixodesk SVG animations.
 *
 * The document is materialized once through the shared core pipeline (effects,
 * loops, motion-path sampling, animated-`<use>` inlining — identical to the
 * web's `native` engine, NOT the frame loop, which keeps `<use>` live), compiled
 * into densely sampled per-element tracks, and
 * played back natively: a single reanimated progress value driven by
 * `withTiming`/`withRepeat` on the UI thread, with per-element worklets
 * indexing the precompiled tracks. No JS-thread frame loop.
 * @public
 */
export function SvgAnimationPlayer({
    doc, timeline,
    playOnTrigger, play, pause, playerRef, playCurrentProgress, playCurrentTime,
    onReady, onPlay, onStop, onPause, onCancel, onFinish, onDestroy, onError, fallback, onWarn, muteWarn, muteError,
}: SvgAnimationPlayerProps): ReactElement | null {

    // -- Compile the document (once per doc/override change) ------------------

    // The override props are objects: a fresh literal every render would otherwise recompile the
    // whole document (materialize + compile tracks), which is the expensive path. Key on their
    // CONTENT instead — the override is small, the document is not.
    const overrideKey = JSON.stringify([timeline ?? null, typeof playOnTrigger === 'object' ? playOnTrigger : null]);

    // A re-created `doc` with the same content keeps the compiled tracks (core `deepEquals`, as in React and Vue).
    const docRef = useRef(doc);
    if (docRef.current !== doc && !deepEquals(docRef.current, doc)) docRef.current = doc;
    const stableDoc = docRef.current;


    /**
     * The diagnostics channel, built from the CURRENT props each time (API review §5).
     * Deliberately not hoisted into a wrapper closure: `(m, d) => onWarn?.(m, d)` would always
     * be a function, so the channel would believe a handler exists and the console fallback
     * would never fire for anyone who passed nothing.
     *
     * The handle, the worklet's finish callback and the unmount cleanup outlive the render that
     * built them, so callbacks and diagnostics are read through `latest` — refreshed every render
     * (as React's `callbacksRef`) — never the props they closed over.
     */
    const latest = useRef({ onReady, onPlay, onPause, onCancel, onFinish, onStop, onDestroy, onWarn, onError, muteWarn, muteError });
    latest.current = { onReady, onPlay, onPause, onCancel, onFinish, onStop, onDestroy, onWarn, onError, muteWarn, muteError };
    const makeDiag = (): PxDiagnostics => createDiagnostics(latest.current, '[SvgAnimationPlayer]');

    // ONE control-mode rule, decided in core and shared with React and Vue (API review §1/§7) —
    // resolved BEFORE compilation, because the play tier's pose contract pins `fillMode` there.
    const { mode: compMode, warnings: modeWarnings } =
        resolveControlMode({ playCurrentProgress, playCurrentTime, play, pause, playOnTrigger });

    const compiled = useMemo((): Compiled => {
        try {
            return compileDocument(
                toPxDocument(stableDoc),
                { timeline, playOnTrigger },
                compMode === PxControlMode.play,
                makeDiag(),
            );
        } catch (e) {
            // A malformed document must not take the host screen down with it. This instance
            // will not play — an ERROR, reported once, here (review §25.1).
            const error = e instanceof Error ? e : new Error(String(e));
            makeDiag().error(PxDiagnosticKind.internal, PxDiagnosticCode.rnCompileFailed, error);
            return { doc: null, tracks: EMPTY_TRACKS, error };
        }
        // `timeline` is an object prop, so a fresh literal each render would recompile the whole
        // document. Key on its CONTENT — the override is small, unlike the document.
        // eslint-disable-next-line react-hooks/exhaustive-deps -- `overrideKey` stands for `timeline` and a `playOnTrigger` object; `makeDiag` is rebuilt per render on purpose (above)
    }, [stableDoc, overrideKey, compMode]);

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

    /** The player's one executor (D5) — attached by `composeApiExtras` below; the natural end goes to it. */
    let executor: PxPlayExecutor | undefined;

    const notifyFinish = () => {
        playingRef.current = false;
        runClock.seek(Number.isFinite(seekCeiling) ? seekCeiling : tracks.duration);
        runClock.stop();
        progress.value = restingPosition();
        latest.current.onFinish?.();
        latest.current.onStop?.();
        executor?.onNaturalEnd();              // `playEndAction`: hold / reset / rewind
    };

    const startFrom = (fromMs: number) => {
        const dur = tracks.duration;
        const rate = rateRef.current || 1;
        const backwards = rate < 0;
        const speed = Math.abs(rate);
        // `direction` decides which end a leg runs toward; a negative playback
        // rate flips it again (the two compose, as in the Web Animations API).
        const directionReversed = tracks.direction === PxPlaybackDirection.reverse || tracks.direction === PxPlaybackDirection.alternateReverse;
        const reversedStart = backwards ? !directionReversed : directionReversed;
        const alternates = tracks.direction === PxPlaybackDirection.alternate || tracks.direction === PxPlaybackDirection.alternateReverse;
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

    const api: PxAnimationPlayerHandle = {
        isPlaying: () => playingRef.current,
        play: () => {
            // `startFrom` rewinds to the opposite end when the playhead is
            // already resting at a boundary (mirrors WAAPI, where play() on a
            // finished animation auto-rewinds) — the run clock rewinds with it,
            // or the time would keep counting on from the old end.
            if (Number.isFinite(seekCeiling) && runClock.now() >= seekCeiling) runClock.seek(0);
            runClock.start(rateRef.current);
            startFrom(progress.value);
            latest.current.onPlay?.();
        },
        pause: () => {
            cancelAnimation(progress);
            playingRef.current = false;
            runClock.stop();
            latest.current.onPause?.();
            latest.current.onStop?.();
        },
        cancel: () => {
            cancelAnimation(progress);
            progress.value = 0;
            playingRef.current = false;
            runClock.seek(0);
            runClock.stop();
            latest.current.onCancel?.();
            latest.current.onStop?.();
        },
        finish: () => {
            cancelAnimation(progress);
            playingRef.current = false;
            runClock.seek(Number.isFinite(seekCeiling) ? seekCeiling : tracks.duration);
            runClock.stop();
            progress.value = restingPosition();
            latest.current.onFinish?.();
            latest.current.onStop?.();
        },
        setPlaybackRate: (rate: number) => {
            if (!isValidPlaybackRate(rate)) {
                makeDiag().warn(PxDiagnosticKind.usage, PxDiagnosticCode.rateRejected);
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
    } as PxAnimationPlayerHandle;
    // The engine's own play / pause before the executor's versions replace them — the gate's hold and release.
    const engine = { play: api.play, pause: api.pause };
    // `play()` / `stop()` / `playOnce()` — the one shared rule (review §10, D5), same composer as the web
    // engines; the play keys come off the compiled document's runtime view.
    const view = compiled.doc ? getAnimatorConfig(compiled.doc) : undefined;
    const player = composeApiExtras(api, { ...view, duration: tracks.duration, iterations: tracks.iterations === Infinity ? 'infinite' : tracks.iterations }, (cb) => { requestAnimationFrame(cb); });
    executor = player.playExecutor;

    // `onReady` (review §14): the animator exists and the tree is rendered — once per compiled
    // instance, asynchronously like the web player fires it.
    useEffect(() => {
        if (!compiled.error) queueMicrotask(() => latest.current.onReady?.());
    }, [compiled]);

    /** The last APPLIED declarative props, per compiled animator (§10). */
    const prevPlaybackRef = useRef<{ compiled: Compiled; props: PxDeclarativeProps } | null>(null);

    // The ref is an ambient CAPABILITY, never a mode (§10) — but a WRITE call landing while a
    // declarative driver owns playback is the actual collision: warn (PX1503) and apply.
    useImperativeHandle(playerRef, () => {
        const guardWrite = (call: string): void => {
            if (compMode === PxControlMode.play || compMode === PxControlMode.fixedTime) {
                makeDiag().warn(PxDiagnosticKind.usage, PxDiagnosticCode.imperativeOverDeclarative, call);
            }
        };
        return {
            ...api,
            play: () => { guardWrite('play()'); api.play(); },
            pause: () => { guardWrite('pause()'); api.pause(); },
            stop: () => { guardWrite('stop()'); api.stop(); },
            cancel: () => { guardWrite('cancel()'); api.cancel(); },
            finish: () => { guardWrite('finish()'); api.finish(); },
            playOnce: () => { guardWrite('playOnce()'); api.playOnce(); },
            setPlaybackRate: (rate: number) => { guardWrite('setPlaybackRate()'); api.setPlaybackRate(rate); },
            setCurrentTime: (t: number) => { guardWrite('setCurrentTime()'); api.setCurrentTime(t); },
            setCurrentProgress: (p: number) => { guardWrite('setCurrentProgress()'); api.setCurrentProgress(p); },
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- `api` / `makeDiag` read callbacks and diagnostics through `latest`; the rest changes only with `compiled`
    }, [compiled, compMode]);

    // -- Declarative control --------------------------------------------------

    // The EFFECTIVE trigger and gate, read back off the COMPILED document's runtime view — so they
    // already reflect the `timeline` override and a `playOnTrigger` object, both merged in before
    // compilation. Resolved through core's one table, so a document means the same here as on the
    // web (D5): no trigger block = `playOn: 'load'`, no `outOfViewAction` = 'pause'.
    const trigger = resolveTrigger(view?.trigger);
    const gate = resolveGate(view);
    /** Whether visibility governs this document. `continue` means "run wherever it is". */
    const gated = gate.outOfViewAction !== PxOutOfViewAction.continue;

    useEffect(() => {
        const diag = makeDiag();
        for (const w of modeWarnings) diag.warn(PxDiagnosticKind.usage, PxDiagnosticCode.controlPropsConflict, w);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [modeWarnings.join('|')]);

    useEffect(() => {
        if (compMode === PxControlMode.fixedTime) {
            const seekMs = playCurrentTime !== undefined
                ? playCurrentTime
                : progressToTimeMs(playCurrentProgress ?? 0, tracks.duration, tracks.iterations);
            api.setCurrentTime(seekMs);
            return;
        }
        if (compMode === PxControlMode.play) {
            // ONE shared rule (§10, `resolveDeclarativePlayback` in core — same as React and
            // Vue): `play` is a pose switch on a one-shot document and a run switch on a looping
            // one; `pause` freezes the clock. HOW each step moves is the timeline's play keys (D5),
            // performed by the executor behind `play()` / `stop()`. A new `compiled` is a new
            // animator — the carried-over props then apply from scratch (mount semantics: no animation).
            const world = resolvePlaybackWorld(tracks.iterations === Infinity ? 'infinite' : tracks.iterations);
            const totalMs = tracks.iterations === Infinity ? Infinity : tracks.duration * Math.max(1, tracks.iterations);
            const prev = prevPlaybackRef.current?.compiled === compiled ? prevPlaybackRef.current.props : undefined;
            const { actions, warnings } = resolveDeclarativePlayback({ world, prev, next: { play, pause } });
            prevPlaybackRef.current = { compiled, props: { play, pause } };
            if (warnings.length) {
                const diag = makeDiag();
                for (const w of warnings) diag.warn(PxDiagnosticKind.usage, PxDiagnosticCode.playModifierIgnored, w);
            }
            for (const action of actions) applyDeclarativeAction(player, action, totalMs);
            return;
        }
        // a listed `click` starts from its own handler below, and a GATED document starts from the
        // visibility poll — calling play() here as well would defeat the gate.
        if (compMode === PxControlMode.playOnTrigger && trigger.playOn.includes(PxTriggerEvent.load) && !gated) {
            player.play();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [compiled, compMode, playOnTrigger, play, pause, playCurrentProgress, playCurrentTime]);

    // THE VISIBILITY GATE — permission to run, whatever started the animation, exactly as on the
    // web (`PxVisibilityGate`). React Native has no IntersectionObserver, so visibility is sampled
    // by measuring the view against the window box. The poll is cheap (a native measure every
    // 200ms) and only runs while the gate is active, which `outOfViewAction: 'continue'` turns off.
    const scrollRef = useRef<View | null>(null);
    const inViewRef = useRef(false);
    useEffect(() => {
        if (!playOnTrigger || !gated) return;
        const threshold = gate.inViewThreshold;
        inViewRef.current = false;
        /** The gate held (or reset) a run, so it owes a release; a `load` start is owed until the first entry. */
        let pausedByGate = false;
        let startPending = trigger.playOn.includes(PxTriggerEvent.load);

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
                    // as the web gate: a trigger's start goes through the executor, the gate's own release is the engine's
                    if (startPending) { startPending = false; pausedByGate = false; player.play(); }
                    else if (pausedByGate) { pausedByGate = false; engine.play(); }
                } else if (player.isPlaying()) {
                    if (gate.outOfViewAction === PxOutOfViewAction.reset) player.cancel();
                    else engine.pause();   // 'continue' never reaches here — the poll does not run
                    pausedByGate = true;
                }
            });
        };

        check();
        const id = setInterval(check, 200);
        return () => clearInterval(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [compiled, playOnTrigger, gated, gate.outOfViewAction]);

    // Stop cleanly on unmount / doc swap — and say so, the way the web's destroy() does (§18):
    // both are "the animator was thrown away", so `onDestroy` fires, and `onStop` with it.
    useEffect(() => {
        return () => {
            cancelAnimation(progress);
            playingRef.current = false;
            latest.current.onDestroy?.();
            latest.current.onStop?.();
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
            defs: getDefinitions(compiled.doc),
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

                    const id = node.id;
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
            // Building the element tree threw — this instance will not play: report it once
            // (an ERROR, review §25.1) and render nothing rather than unmount the host screen.
            const error = e instanceof Error ? e : new Error(String(e));
            renderErrorRef.current = error;
            makeDiag().error(PxDiagnosticKind.internal, PxDiagnosticCode.rnRenderFailed, error);
            return null;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [compiled, trackById]);

    useEffect(() => {
        const diag = makeDiag();
        // `platform`: these come from the react-native-svg prop mapper — shapes this renderer
        // cannot express, rather than anything wrong with the file.
        for (const w of warningsRef.current) diag.warn(PxDiagnosticKind.platform, PxDiagnosticCode.rnUnsupported, w);
    }, [root]);

    // A compile/render failure was reported where it was caught (once, as an error); here it
    // only decides what to show.
    const failure = compiled.error ?? renderErrorRef.current;
    if (failure) return fallback ? fallback(failure) : null;

    // A listed `click` — the touch analogue of the web player's click event, read by the same state
    // rule (core's `triggerActionFor`): the editor's click toggle taps to play and taps again to pause.
    // Hover has no touch equivalent, so `hoverIn` / `hoverOut` are left to the host app.
    let content: ReactElement | null = root;

    if (playOnTrigger && triggerListsEvent(trigger, PxTriggerEvent.click) && root) {
        content = (
            <Pressable
                onPress={() => {
                    switch (triggerActionFor(trigger, player.playExecutor.state(), PxTriggerEvent.click)) {
                        case PxTriggerAction.play: player.play(); break;
                        case PxTriggerAction.pause: player.pause(); break;
                        case PxTriggerAction.off: player.stop(); break;
                    }
                }}
            >
                {root}
            </Pressable>
        );
    }

    // The gate measures the view, so it must survive in the native tree:
    // `collapsable={false}` keeps it there.
    if (playOnTrigger && gated && content) {
        content = <View ref={scrollRef} collapsable={false}>{content}</View>;
    }

    // Catches what the try/catch above cannot: throws during React's own render
    // and commit of the tree — react-native-svg internals, reanimated failing
    // to attach to a component that turns out not to be a host view, and so on.
    return (
        <PxRnErrorBoundary fallback={fallback} diag={makeDiag()}>
            {content}
        </PxRnErrorBoundary>
    );
}

export default SvgAnimationPlayer;
