// @px-area engine
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { getAnimatorConfig, normalizeBindings, PxTimelineEngine, PxValueKind, type PxAnimatedSvgDocument, type PxEngineCallbacks, type PxAnimatorRuntimeConfig, type PxRuntimeAnimation, type PxRuntimeChannel, type PxRuntimeKeyframe, clampSeekMs, isValidPlaybackRate, progressToTimeMs, PxDiagnosticCode, PxDiagnosticKind, seekCeilingMs, timeToProgress } from '@pixodesk/svg-animator-core';
import { PX_DEFAULT_ITERATIONS, mapChannelKeyframes, type PxChannelLerp } from '@pixodesk/svg-animator-core/internal';
import { bezierToSvgPath, camelCaseToKebabWordIfNeeded, clamp, composeTransformParts, cubicBezier, kebabToCamelCaseWord, splitEasing, toRGBA, createDiagnostics } from '@pixodesk/svg-animator-core/internal';
import { getSelector } from './PxAnimatorFrameLoop';
import { setupAnimationTriggers } from '../triggers/PxAnimatorTriggers';
import type { PxEngineAnimatorApi } from '../shared/PxAnimatorWebTypes';


/** One WAAPI keyframe's CSS: the property it writes and the value, before the `offset` / `easing`. */
interface CssValue { key: string; value: string }

/**
 * The CSS a channel's keyframe writes — by its KIND (decided once, at conversion): a colour as
 * `rgba()`, a parts record / per-part channel into `transform` (with CSS units), `d` as `path("…")`,
 * a percent number as `%`, a number with its unit, anything else as it is.
 */
function cssValuesOf(propName: string, channel: PxRuntimeChannel): Array<CssValue> {
    switch (channel.kind) {
        case PxValueKind.color: return channel.keyframes.map(kf => ({ key: propName, value: toRGBA(kf.v) }));
        case PxValueKind.parts: return channel.keyframes.map(kf => ({ key: TRANSFORM, value: composeTransformParts(kf.v, { withUnits: true }) }));
        case PxValueKind.translate: return channel.keyframes.map(kf => ({ key: TRANSFORM, value: 'translate(' + kf.v.map(v => v + 'px').join(',') + ')' }));
        case PxValueKind.scale: return channel.keyframes.map(kf => ({ key: TRANSFORM, value: 'scale(' + kf.v.join(',') + ')' }));
        case PxValueKind.rotate: return channel.keyframes.map(kf => ({ key: TRANSFORM, value: 'rotate(' + kf.v + 'deg)' }));
        case PxValueKind.skew: return channel.keyframes.map(kf => ({ key: TRANSFORM, value: 'skewX(' + kf.v + 'deg)' }));
        // Animated path: the CSS `d` presentation-attr syntax `path("…")`, via the same bezierToSvgPath
        // the CSS export uses. forceCurves: CSS/WAAPI only interpolates `path()` values with IDENTICAL
        // command sequences — uniform all-`C` output keeps every keyframe structurally equal (mixed L/C,
        // e.g. round-corner radius 0 vs >0, would go DISCRETE → 50% flip).
        case PxValueKind.path: return channel.keyframes.map(kf => ({ key: propName, value: 'path("' + kf.v.paths.map(bz => bezierToSvgPath(bz, true)).join('') + '")' }));
        // Percent-based CSS properties (offset-distance): the wire carries 0..1 numbers, the property
        // needs a <length-percentage> — the same maths and units as the frames engine.
        case PxValueKind.percent: return channel.keyframes.map(kf => ({ key: propName, value: (kf.v * 100) + '%' }));
        case PxValueKind.number: return channel.keyframes.map(kf => ({ key: propName, value: '' + kf.v + (channel.unit ?? '') }));
        case PxValueKind.numberList: return channel.keyframes.map(kf => ({ key: propName, value: '' + kf.v }));
        case PxValueKind.discrete: return channel.keyframes.map(kf => ({ key: propName, value: kf.v }));
    }
}

const TRANSFORM = 'transform';

/**
 * Clips keyframes to the [0, duration] range.
 * If a keyframe pair straddles a boundary (t=0 or t=duration), inserts an interpolated
 * keyframe at the boundary with the correct value and split easing, so WAAPI sees
 * exact start/end values rather than out-of-range ones.
 */
function clipKeyframesToDuration<V>(
    keyframes: Array<PxRuntimeKeyframe<V>>,
    duration: number,
    lerp: PxChannelLerp<V>,
): Array<PxRuntimeKeyframe<V>> {
    const result: Array<PxRuntimeKeyframe<V>> = [];

    for (let i = 0; i < keyframes.length; i++) {
        const kf = keyframes[i];
        const t = kf.t;

        if (t < 0) {
            // If the next keyframe is in range, interpolate value at t=0
            const next = keyframes[i + 1];
            if (next && next.t >= 0) {
                const localFrac = (0 - t) / (next.t - t);
                const easedFrac = kf.e ? cubicBezier(kf.e)(localFrac) : localFrac;
                const { right: rightEasing } = splitEasing(kf.e, localFrac);
                result.push({ t: 0, v: lerp(kf.v, next.v, easedFrac), e: rightEasing });
            }
            continue;
        }

        if (t > duration) {
            // If the previous keyframe was in range, interpolate value at t=duration
            const prev = keyframes[i - 1];
            if (prev && prev.t <= duration) {
                const localFrac = (duration - prev.t) / (t - prev.t);
                const easedFrac = prev.e ? cubicBezier(prev.e)(localFrac) : localFrac;
                const { left: leftEasing } = splitEasing(prev.e, localFrac);
                if (result.length > 0) result[result.length - 1] = { ...result[result.length - 1], e: leftEasing };
                result.push({ t: duration, v: lerp(prev.v, kf.v, easedFrac), e: undefined });
            }
            break;
        }

        result.push(kf);
    }

    return result;
}

/**
 * Converts an element's runtime channels into a map of Web Animations API Keyframe arrays, one per
 * animated property.
 *
 * For each channel the function:
 * 1. Clips keyframes to [0, duration], interpolating boundary values when a pair straddles an edge.
 * 2. Normalizes keyframe time values to the [0, 1] offset range (time / duration).
 * 3. Writes each keyframe's CSS by the channel's kind (`cssValuesOf`).
 * 4. Ensures the keyframe sequence always starts at offset: 0 and ends at offset: 1 — a
 *    requirement of the Web Animations API for correct looping behavior. If the first keyframe
 *    starts after 0 or the last keyframe ends before 1, a copy of that keyframe is inserted at the
 *    boundary with the adjusted offset.
 *
 * A value the browser rejects (`CSS.supports` false) adds its property to `unsupportedSet`, so the
 * caller can decide whether to fall back to the frame-loop animator.
 */
export function convertToWebApiKeyframes(
    channels: PxRuntimeAnimation,
    unsupportedSet: Set<string>,
    config: PxAnimatorRuntimeConfig
): Map<string, Keyframe[]> {
    const result = new Map<string, Keyframe[]>();

    for (const [propName, channel] of Object.entries(channels)) {
        const duration = config.duration || 1;
        const clipped = mapChannelKeyframes(channel, (keyframes, lerp) => clipKeyframesToDuration(keyframes, duration, lerp));
        const css = cssValuesOf(propName, clipped);
        const cssKeyframes: Keyframe[] = [];

        for (let i = 0; i < clipped.keyframes.length; i++) {
            const kf = clipped.keyframes[i];
            const { key, value } = css[i];
            // The easing is on the SOURCE keyframe: it applies from this kf to the next, matching the
            // WAAPI convention — resolved already when the channel was converted.
            const cssKf: Keyframe = {
                offset: clamp(kf.t / duration, 0, 1),
                easing: kf.e ? 'cubic-bezier(' + kf.e.join(',') + ')' : undefined,
            };
            // `CSS.supports` takes a CSS PROPERTY name, so it must be asked in kebab-case —
            // `CSS.supports('strokeDasharray', …)` is always false. Prop names reach us in
            // either form (the app materializes trim paths as camelCase `strokeDasharray` /
            // `strokeDashoffset` / `strokeOpacity`), and an unsupported entry makes the caller
            // discard EVERY animation on the document, so a false negative here is costly.
            if (!CSS.supports(camelCaseToKebabWordIfNeeded(key), value)) unsupportedSet.add(key);
            cssKf[kebabToCamelCaseWord(key)] = value;

            // Keyframes need to start with offset:0 to work correctly with loops
            if (i === 0 && (cssKf.offset || 0) > 0) {
                cssKeyframes.push({ ...cssKf, offset: 0 });
            }

            cssKeyframes.push(cssKf);
        }

        // Keyframes need to end with offset:1 to work correctly with loops
        if (cssKeyframes.length > 0 && (cssKeyframes[cssKeyframes.length - 1].offset || 0) < 1) {
            cssKeyframes.push({
                ...cssKeyframes[cssKeyframes.length - 1],
                offset: 1
            });
        }

        if (cssKeyframes.length > 0) {
            result.set(propName, cssKeyframes);
        }
    }

    return result;
}

/**
 * Creates an animator instance that uses the native Web Animations API.
 *
 * This is the preferred, more performant animator. It will return null if the
 * animation configuration contains properties not supported by the browser's
 * Web Animations API implementation, unless forceEvenIfHasUnsupportedAttrs is true.
 *
 * @param callbacks Optional lifecycle callbacks.
 * @param rootElement Root element.
 * @param forceEvenIfHasUnsupportedAttrs If true, an animator will be created even if some CSS properties are not supported.
 * @returns An PxAnimatorApi instance, or null if unsupported features are used and not forced.
 */
/** Native scroll-timeline payload (`timeline.engine: 'native'` / `auto`; see PxScrollDriver.createNativeScrollTimeline): the
 *  browser-native timeline every Animation attaches to, plus optional range offsets. */
export interface PxWebApiScrollTimeline {
    timeline: AnimationTimeline;
    rangeStart?: Record<string, unknown>;
    rangeEnd?: Record<string, unknown>;
}

// @px-importance important
/** @internal */
export function createWebApiAnimator(
    doc: PxAnimatedSvgDocument,
    callbacks?: PxEngineCallbacks,
    rootElement?: Element | null,
    forceEvenIfHasUnsupportedAttrs?: boolean,
    scrollTimeline?: PxWebApiScrollTimeline
): PxEngineAnimatorApi<Element> | null {

    const config = getAnimatorConfig(doc) || {};

    // One channel for everything this engine has to say (API review §5).
    const diag = createDiagnostics(callbacks, '[PxAnimator]');

    // Use provided root element or try to find by selector
    if (!rootElement) {
        if (doc.id) {
            const rootSelector = getSelector(doc.id);
            rootElement = document.querySelector(rootSelector);
            if (!rootElement) diag.warn(PxDiagnosticKind.host, PxDiagnosticCode.noRootForSelector, rootSelector);
        } else {
            diag.warn(PxDiagnosticKind.host, PxDiagnosticCode.noRootElement);
        }
    }

    // WAAPI bindings: motion-along-path is materialized into plain `{ translate,
    // rotate }` transform kfs inside `normalizeAnimationDefinition` (gated on
    // `engine === 'waapi'`). The WAAPI keyframe builder then sees a vanilla
    // unified-transform animation — no DOM-style mutation, no offset-path.
    const bindings = normalizeBindings(doc, PxTimelineEngine.native);

    const animations: Array<Animation> = [];

    const _iterations = config.iterations;
    let iterations: number | undefined;
    if (typeof _iterations === 'number') iterations = _iterations;
    if (_iterations === 'infinite') iterations = Infinity;

    const unsupportedSet = new Set<string>();

    // A document commonly produces many Animation objects (one per element ×
    // animated property), but the public callbacks describe the document
    // timeline as a whole — guard so each fires once per finish/remove episode.
    // `finishNotified` re-arms on play/cancel/seek.
    let finishNotified = false;
    let removeCalled = false;

    ////////////////////////////////////////////////////////////////

    // Warn if no bindings defined
    if (!bindings?.length) {
        diag.warn(PxDiagnosticKind.document, PxDiagnosticCode.noBindings);
    }

    // Pass 1 — every binding's keyframes, so support is known BEFORE any KeyframeEffect exists. A value the browser rejects
    // (e.g. a unitless rect `width`) makes this engine step aside for the frame loop; building the effects first only
    // made the browser log "Invalid keyframe value" for each element × property of animations that were never played.
    const prepared: Array<{ id: string; keyframesMap: ReturnType<typeof convertToWebApiKeyframes> }> = [];
    for (const binding of bindings || []) {
        prepared.push({ id: binding.id, keyframesMap: convertToWebApiKeyframes(binding.channels, unsupportedSet, config) });
    }

    if (!forceEvenIfHasUnsupportedAttrs && unsupportedSet.size) {
        diag.warn(PxDiagnosticKind.platform, PxDiagnosticCode.unsupportedAnimatedAttrs, [...unsupportedSet].join(', '));
        return null;
    }

    // Pass 2 — the effects
    for (const { id, keyframesMap } of prepared) {
        const selector = getSelector(id);

        // Use CSS selector to find elements
        const elements = rootElement?.querySelectorAll(selector) || document.querySelectorAll(selector);

        if (elements.length === 0) {
            diag.warn(PxDiagnosticKind.host, PxDiagnosticCode.noElementsForSelector, selector);
        }


        // Delay handling:
        // - Positive delay (e.g., 500): Wait before starting → use delay option
        // - Negative delay (e.g., -500): Start mid-animation → use currentTime to seek
        //   (Web Animations API doesn't reliably support negative delay values)
        // WAAPI `currentTime` spans ALL iterations, so a finite timeline clamps
        // the seek to duration × iterations (seeking to exactly the end must
        // land on the final frame, not wrap to 0); an infinite timeline wraps
        // within one iteration instead.
        const positiveDelay = config.delay && config.delay > 0 ? config.delay : undefined;
        let seekPosition: number | undefined;
        if (config.delay && config.delay < 0 && config.duration) {
            const rawSeek = -config.delay;
            seekPosition = iterations === Infinity
                ? rawSeek % config.duration
                : Math.min(rawSeek, config.duration * (iterations ?? PX_DEFAULT_ITERATIONS));
        }

        const effectOptions: KeyframeEffectOptions = {
            duration: config.duration,
            delay: positiveDelay,
            // Default to 'forwards' so elements hold their final state after the
            // animation ends — consistent with Lottie and other animation runtimes.
            // Without this, seeking to the last frame reverts elements to their
            // pre-animation state (the Web Animations API "after" phase with fill:'none').
            fill: config.fill ?? 'forwards',
            direction: config.direction,
            iterations: iterations
        };

        for (let i = 0; i < elements.length; i++) {
            const element = elements[i];

            for (const [, keyframes] of keyframesMap) {
                if (keyframes.length > 0) {
                    try {
                        const effect = new KeyframeEffect(element, keyframes, effectOptions);
                        // Native scroll timeline (`mode: 'native'` / `auto`): the browser computes
                        // progress AND applies values (compositor-driven). Range offsets are
                        // per-Animation in WAAPI.
                        const anim = new Animation(effect, scrollTimeline ? scrollTimeline.timeline : document.timeline);
                        if (scrollTimeline) {
                            const a = anim as unknown as { rangeStart?: unknown; rangeEnd?: unknown };
                            if (scrollTimeline.rangeStart) a.rangeStart = scrollTimeline.rangeStart;
                            if (scrollTimeline.rangeEnd) a.rangeEnd = scrollTimeline.rangeEnd;
                        }

                        if (callbacks?.onFinish) anim.onfinish = () => {
                            if (finishNotified) return;
                            finishNotified = true;
                            callbacks.onFinish?.();
                        };
                        if (callbacks?.onDestroy) anim.onremove = () => {
                            if (removeCalled) return;
                            removeCalled = true;
                            callbacks.onDestroy?.();
                        };

                        // Seek forward for negative delay (e.g., delay=-500 → seek to 500ms).
                        // `!== undefined` — a seek of exactly 0 is still a seek.
                        if (seekPosition !== undefined) {
                            anim.currentTime = seekPosition;
                        }

                        animations.push(anim);
                    } catch (e) {
                        // Was a bare dump of the error object; the channel carries it as the
                        // DETAIL so a handler gets something it can act on (review §5).
                        diag.warn(PxDiagnosticKind.internal, PxDiagnosticCode.animationBuildFailed, e);
                    }
                }
            }
        }
    }

    ////////////////////////////////////////////////////////////////

    const api: PxEngineAnimatorApi<Element> = {

        "isReady": () => true,

        "getRootElement": () => rootElement || null,

        "isPlaying": (): boolean => { return animations[0]?.playState === 'running'; },

        "play": () => {
            finishNotified = false; // re-arm finish notification
            animations.forEach(a => a.play());
            callbacks?.onPlay?.();
        },
        "pause": () => {
            animations.forEach(a => a.pause());
            callbacks?.onPause?.();
        },
        "cancel": () => {
            finishNotified = false; // re-arm finish notification
            animations.forEach(a => a.cancel());
            callbacks?.onCancel?.();
        },
        "finish": () => {
            for (const a of animations) {
                try {
                    if (a.effect?.getTiming().iterations === Infinity) {
                        a.effect.updateTiming({ iterations: 1 });
                        a.finish();
                        a.effect.updateTiming({ iterations: Infinity });
                    } else {
                        a.finish();
                    }
                } catch (e) {
                    a.cancel();
                }
            }
            // Natural finish also reaches onFinish via the native `anim.onfinish`
            // handler wired at construction time.
        },

        "setPlaybackRate": (rate: number) => {
            // WAAPI itself accepts 0 and silently freezes; the other two engines reject it.
            // One answer everywhere (review §3) — `pause()` is how you stop.
            if (!isValidPlaybackRate(rate)) {
                diag.warn(PxDiagnosticKind.usage, PxDiagnosticCode.rateRejected);
                return api;
            }
            animations.forEach(a => (a.playbackRate = rate));
            return api;
        },
        "getCurrentTime": (): number | null => {
            const res = animations[0]?.currentTime ?? null;
            return res !== null ? +res : null;
        },
        "setCurrentTime": (time: number) => {
            // Clamp like every other engine (review §3). A duration is not always declared,
            // and a ceiling of 0 would pin every seek to the first frame — so clamp only when
            // the timeline length is actually known, and otherwise just floor at 0.
            const ceiling = seekCeilingMs(config.duration ?? 0, iterations ?? PX_DEFAULT_ITERATIONS);
            const seek = ceiling > 0 ? clampSeekMs(time, ceiling) : Math.max(0, time);
            finishNotified = false; // re-arm finish notification
            animations.forEach(a => {
                a.currentTime = seek;
            });
        },

        "getCurrentProgress": (): number | null => {
            const t = api.getCurrentTime();
            return t === null ? null : timeToProgress(t, config.duration ?? 0, iterations ?? PX_DEFAULT_ITERATIONS);
        },

        "setCurrentProgress": (progress: number) => {
            api.setCurrentTime(progressToTimeMs(progress, config.duration ?? 0, iterations ?? PX_DEFAULT_ITERATIONS));
        },

        "destroy": () => {
            api.cancel();
            animations.splice(0, animations.length);
            if (!removeCalled) {
                removeCalled = true;
                callbacks?.onDestroy?.();
            }
        }
    };

    ////////////////////////////////////////////////////////////////

    // D3 (scroll-timeline.design.md): triggers are inert on a scroll-driven document —
    // writers must not emit them; a doc that carries them anyway gets a warning.
    // Every time-driven document IS wired: no `trigger` means the defaults (`start` 'load',
    // `offScreen` 'pause' — so an unseen animation does not run).
    if (config.timelineSource === 'scroll') {
        if (config.trigger) diag.warn(PxDiagnosticKind.usage, PxDiagnosticCode.scrollTriggerIgnored);
    } else {
        // The disposer rides on destroy(), so the listeners go when the animator does (§14).
        const detachTriggers = setupAnimationTriggers(api, config.trigger ?? {}, diag);
        const destroyEngine = api.destroy.bind(api);
        api.destroy = () => { detachTriggers(); destroyEngine(); };
    }

    // A progress-based timeline only tracks while the animation is PLAYING — start it
    // (there is no wall clock involved; "playing" here means "bound to the timeline").
    if (scrollTimeline) {
        animations.forEach(a => a.play());
    }

    return api;
}
