/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { getSelector } from './PxAnimatorFrameLoop';
import { setupAnimationTriggers } from './PxAnimatorTriggers';
import { buildMotionPathD, computeOffsetDistances, findMotionPathNodes } from './PxMotionPath';
import { getAnimatorConfig, PxAnimatedSvgDocument, PxAnimatorConfig, PxKeyframe, PxNode, PxPropertyAnimation, type PxAnimationDefinition, type PxAnimatorAPI, type PxAnimatorCallbacksConfig } from './PxAnimatorTypes';
import { clamp, COLOUR_ATTR_NAMES, composeTransformParts, cubicBezier, kebabToCamelCaseWord, splitEasing, toRGBA, TRANSFORM_FN_NAMES } from './PxAnimatorUtil';
import { getNormalisedBindings, interpolateValue } from './PxDefinitions';


/**
 * Converts a single PxKeyframe into a Web Animations API Keyframe object.
 *
 * Handles three categories of CSS property:
 * - **Colour attributes** (e.g. fill, stroke): array values are converted to an rgba() string.
 * - **Transform functions** (e.g. translate, rotate, scale): values are formatted as a
 *   CSS transform function string and mapped to the transform property.
 * - **All other properties**: the value is coerced to a string as-is.
 *
 * If the resulting (cssKey, cssValue) pair is not supported by the browser (CSS.supports returns
 * false), cssKey is added to unsupportedSet so the caller can decide whether to fall back to the
 * frame-loop animator.
 */
function createCssKf(kf: PxKeyframe, t: number, propName: string, unsupportedSet: Set<string>) {
    let value = kf.v ?? kf.value;
    const e = kf.e ?? kf.easing; // e is on the source keyframe: applied from this KF to the next (matches WAAPI easing convention)

    const cssKf: Keyframe = {
        offset: t,
        easing: e && Array.isArray(e) ? "cubic-bezier(" + e.join(',') + ")" : undefined
    };

    let cssValue: any;
    let cssKey = propName;

    if (COLOUR_ATTR_NAMES.has(propName) && Array.isArray(value)) {
        cssValue = toRGBA(value);
    } else if (propName === 'transform' && value !== null && typeof value === 'object' && !Array.isArray(value)) {
        // Unified transform: keyframe value is a parts record (PxTransformParts).
        // Compose all present parts into one CSS transform string.
        cssValue = composeTransformParts(value, { withUnits: true });
        cssKey = 'transform';
    } else if (TRANSFORM_FN_NAMES.has(propName)) {
        if (Array.isArray(value)) {
            if (propName === 'translate') value = value.map(v => v + 'px');
            value = value.join(',');
        }
        if (propName === 'rotate') value = value + 'deg';
        cssValue = propName + '(' + value + ')';
        cssKey = 'transform';
    } else {
        cssValue = '' + value;
    }

    if (!CSS.supports(cssKey, cssValue)) unsupportedSet.add(cssKey);

    cssKey = kebabToCamelCaseWord(cssKey);
    cssKf[cssKey] = cssValue;
    return cssKf;
}

/**
 * Clips keyframes to the [0, duration] range.
 * If a keyframe pair straddles a boundary (t=0 or t=duration), inserts an interpolated
 * keyframe at the boundary with the correct value and split easing, so WAAPI sees
 * exact start/end values rather than out-of-range ones.
 */
function clipKeyframesToDuration(
    propName: string,
    keyframes: PxKeyframe[],
    duration: number
): PxKeyframe[] {
    const result: PxKeyframe[] = [];

    for (let i = 0; i < keyframes.length; i++) {
        const kf = keyframes[i];
        const t = kf.t ?? 0;

        if (t < 0) {
            // If the next keyframe is in range, interpolate value at t=0
            const next = keyframes[i + 1];
            if (next && (next.t ?? 0) >= 0) {
                const nextT = next.t ?? 0;
                const localFrac = (0 - t) / (nextT - t);
                const easedFrac = kf.e ? cubicBezier(kf.e as [number, number, number, number])(localFrac) : localFrac;
                const { right: rightEasing } = splitEasing(kf.e as any, localFrac);
                result.push({ t: 0, v: interpolateValue(propName, kf.v, next.v, easedFrac), e: rightEasing });
            }
            continue;
        }

        if (t > duration) {
            // If the previous keyframe was in range, interpolate value at t=duration
            const prev = keyframes[i - 1];
            if (prev && (prev.t ?? 0) <= duration) {
                const prevT = prev.t ?? 0;
                const localFrac = (duration - prevT) / (t - prevT);
                const easedFrac = prev.e ? cubicBezier(prev.e as [number, number, number, number])(localFrac) : localFrac;
                const { left: leftEasing } = splitEasing(prev.e as any, localFrac);
                if (result.length > 0) result[result.length - 1] = { ...result[result.length - 1], e: leftEasing };
                result.push({ t: duration, v: interpolateValue(propName, prev.v, kf.v, easedFrac), e: undefined });
            }
            break;
        }

        result.push(kf);
    }

    return result;
}

/**
 * Converts a PxAnimationDefinition into a map of Web Animations API Keyframe arrays, one per
 * animated property.
 *
 * For each property in the definition the function:
 * 1. Clips keyframes to [0, duration], interpolating boundary values when a pair straddles an edge.
 * 2. Normalises keyframe time values to the [0, 1] offset range (time / duration).
 * 3. Delegates CSS value conversion to createCssKf.
 * 4. Ensures the keyframe sequence always starts at offset: 0 and ends at offset: 1 — a
 *    requirement of the Web Animations API for correct looping behaviour. If the first keyframe
 *    starts after 0 or the last keyframe ends before 1, a copy of that keyframe is inserted at the
 *    boundary with the adjusted offset.
 */
function convertToWebApiKeyframes(
    animDef: PxAnimationDefinition,
    unsupportedSet: Set<string>,
    config: PxAnimatorConfig
): Map<string, Keyframe[]> {
    const result = new Map<string, Keyframe[]>();

    for (const [propName, propAnim] of Object.entries(animDef)) {
        const duration = config.duration || 1;
        const clippedKeyframes = clipKeyframesToDuration(propName, propAnim.kfs || propAnim.keyframes || [], duration);
        const cssKeyframes: Keyframe[] = [];

        for (let i = 0; i < clippedKeyframes.length; i++) {
            const kf = clippedKeyframes[i];

            const t = clamp((kf.t ?? 0) / duration, 0, 1);
            const cssKf: Keyframe = createCssKf(kf, t, propName, unsupportedSet);

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

// ─────────────────────────────────────────────────────────────────────────────
//  Motion-along-path → CSS Motion Path conversion (WAAPI-only)
// ─────────────────────────────────────────────────────────────────────────────


/** Cheap pre-scan; avoids the clone when there's nothing to convert. */
function needsWaapiMotionPathConversion(doc: PxAnimatedSvgDocument): boolean {
    return findMotionPathNodes(doc).length > 0;
}

/**
 * Returns a deep-cloned `doc` whose motion-path nodes have been rewritten:
 *   - `node.animate.transform` → `node.animate.offsetDistance` (0→1 arc-length kfs)
 *   - static `offset-path`/`offset-anchor`/`offset-rotate` pushed onto the
 *     corresponding DOM element in `rootElement` (so WAAPI just animates the
 *     numeric `offsetDistance` and the browser renders the path).
 *
 * Inline `path("d…")` syntax sidesteps `<defs>` injection — no DOM/structure
 * mutation beyond the styles on the animated element.
 */
function cloneAndConvertMotionPaths(doc: PxAnimatedSvgDocument, rootElement: Element | null | undefined): PxAnimatedSvgDocument {
    const cloned: PxAnimatedSvgDocument = JSON.parse(JSON.stringify(doc));
    const motionNodes = findMotionPathNodes(cloned);
    for (const node of motionNodes) {
        const d = buildMotionPathD(node);
        if (!d) continue;
        const animBucket = node.animate;
        if (!animBucket || typeof animBucket !== 'object' || Array.isArray(animBucket)) continue;
        const animate = animBucket as Record<string, PxPropertyAnimation>;
        const anim = animate.transform;
        if (!anim) continue;
        const kfs = (anim.keyframes ?? anim.kfs) as Array<PxKeyframe> | undefined;
        if (!kfs || kfs.length < 2) continue;

        const offsets = computeOffsetDistances(kfs);
        const offsetKfs: Array<PxKeyframe> = kfs.map((kf, i) => {
            const out: PxKeyframe = { time: kf.time ?? kf.t, value: (offsets[i] * 100) + '%' };
            const easing = kf.easing ?? kf.e;
            if (easing !== undefined) out.easing = easing;
            return out;
        });

        // Apply the STATIC offset-* styles to the rendered DOM element. The
        // selector mirrors `getSelector(binding.id)` used downstream.
        if (rootElement && node.id) {
            const el = rootElement.querySelector(getSelector(node.id)) as HTMLElement | null;
            if (el) {
                el.style.offsetPath = 'path("' + d + '")';
                el.style.offsetAnchor = '0 0';
                el.style.offsetRotate = anim.autoOrient ? 'auto' : '0deg';
            }
        }

        // Swap the animation on the clone — drop `transform`, add `offsetDistance`.
        delete animate.transform;
        animate.offsetDistance = { keyframes: offsetKfs };
    }
    return cloned;
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
 * @returns An PxAnimatorAPI instance, or null if unsupported features are used and not forced.
 */
export function createWebApiAnimator(
    doc: PxAnimatedSvgDocument,
    callbacks?: PxAnimatorCallbacksConfig,
    rootElement?: Element | null,
    forceEvenIfHasUnsupportedAttrs?: boolean
): PxAnimatorAPI | null {

    const config = getAnimatorConfig(doc) || {};

    // Use provided root element or try to find by selector
    if (!rootElement) {
        if (doc.id) {
            const rootSelector = getSelector(doc.id);
            rootElement = document.querySelector(rootSelector);
            if (!rootElement) console.warn("createFrameLoopAnimator: No root element found for selector: ", rootSelector);
        } else {
            console.warn("createFrameLoopAnimator: No root element provided");
        }
    }

    // Motion-along-path → CSS Motion Path. Clone the doc so the original (used
    // by the frames-loop fallback if WAAPI bails) stays parametric with
    // `tangentIn/Out`/`autoOrient` intact. The clone's per-node `transform`
    // animation is replaced with an `offsetDistance` animation that drives the
    // browser's native motion-path renderer; the static `offset-*` styles are
    // pushed directly onto the rendered DOM element here (WAAPI can't easily
    // express a static-via-kfs CSS property without an extra animation).
    const wDoc = needsWaapiMotionPathConversion(doc) ? cloneAndConvertMotionPaths(doc, rootElement) : doc;

    const bindings = getNormalisedBindings(wDoc);

    const animations: Array<Animation> = [];

    const _iterations = config.iterations;
    let iterations: number | undefined;
    if (typeof _iterations === 'number') iterations = _iterations;
    if (_iterations === 'infinite') iterations = Infinity;

    const unsupportedSet = new Set<string>();

    ////////////////////////////////////////////////////////////////

    // Warn if no bindings defined
    if (!bindings?.length) {
        console.warn('createWebApiAnimator: No animation bindings defined');
    }

    for (const binding of bindings || []) {
        const animDef = binding.animate;
        if (!animDef || typeof animDef !== 'object' || Array.isArray(animDef)) {
            console.warn('createWebApiAnimator: Empty or unresolved binding', binding);
            continue;
        }

        const selector = getSelector(binding.id);

        // Use CSS selector to find elements
        const elements = rootElement?.querySelectorAll(selector) || document.querySelectorAll(selector);

        if (elements.length === 0) {
            console.warn('createWebApiAnimator: No elements found for selector "' + selector + '"');
        }

        // Convert animation definition to Web API keyframes
        const keyframesMap = convertToWebApiKeyframes(animDef, unsupportedSet, config);


        // Delay handling:
        // - Positive delay (e.g., 500): Wait before starting → use delay option
        // - Negative delay (e.g., -500): Start mid-animation → use currentTime to seek
        //   (Web Animations API doesn't reliably support negative delay values)
        // - Negative delay is wrapped to duration (e.g., -5000 with duration 2000 → seek to 1000)
        const positiveDelay = config.delay && config.delay > 0 ? config.delay : undefined;
        const seekPosition = config.delay && config.delay < 0 && config.duration
            ? (-config.delay) % config.duration
            : undefined;

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
                        const anim = new Animation(effect, document.timeline);

                        if (callbacks?.onFinish) anim.onfinish = () => callbacks.onFinish?.();
                        if (callbacks?.onRemove) anim.onremove = () => callbacks.onRemove?.();

                        // Seek forward for negative delay (e.g., delay=-500 → seek to 500ms)
                        if (seekPosition) {
                            anim.currentTime = seekPosition;
                        }

                        animations.push(anim);
                    } catch (e) {
                        console.warn(e);
                    }
                }
            }
        }
    }

    ////////////////////////////////////////////////////////////////

    if (!forceEvenIfHasUnsupportedAttrs && unsupportedSet.size) {
        console.warn('Unsupported CSS attrs: ' + [...unsupportedSet].join(', '));
        return null;
    }

    ////////////////////////////////////////////////////////////////

    const api: PxAnimatorAPI = {

        "isReady": () => true,

        "getRootElement": () => rootElement || null,

        "isPlaying": (): boolean => { return animations[0]?.playState === 'running'; },

        "play": () => {
            animations.forEach(a => a.play());
            callbacks?.onPlay?.();
        },
        "pause": () => {
            animations.forEach(a => a.pause());
            callbacks?.onPause?.();
        },
        "cancel": () => {
            animations.forEach(a => a.cancel());
            callbacks?.onCancel?.(); // FIXME onFinished needs to be called when animation finishes, e.g. from animations, and some flag that it was triggered by user
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
            // FIXME onFinished needs to be called when animation finishes, e.g. from animations, not only when you call finish manually
        },

        "setPlaybackRate": (rate: number) => {
            animations.forEach(a => (a.playbackRate = rate));
            return api;
        },
        "getCurrentTime": (): number | null => {
            const res = animations[0]?.currentTime ?? null;
            return res !== null ? +res : null;
        },
        "setCurrentTime": (time: number) => {
            animations.forEach(a => {
                a.currentTime = time;
            });
        },

        "destroy": () => {
            api.cancel();
            animations.splice(0, animations.length);
        }
    };

    ////////////////////////////////////////////////////////////////

    if (config.trigger) {
        setupAnimationTriggers(api, config.trigger);
    }

    return api;
}
