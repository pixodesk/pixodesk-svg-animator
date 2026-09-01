/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { JsMode, OutAction, PxAnimatedSvgDocument, PxAnimatorAPI, PxNode, PxPlatformAdapter, PxTrigger, StartOn } from '@pixodesk/svg-animator-web';
import { camelCaseToKebabWordIfNeeded, createAnimator, FillMode, generateNewIds, getNormalizedProps, STYLE_ATTR_NAMES } from '@pixodesk/svg-animator-web';
import type { CSSProperties, FC, ReactElement } from 'react';
import React, { createElement, useEffect, useImperativeHandle, useRef } from 'react';
import { useDepsVersion } from './Utils';


// -- Public types -----------------------------------------------------------

export interface ReactAnimatorApi {
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

    /** Changes the speed of the animation. 1 is normal, 2 is double, -1 is reverse. */
    setPlaybackRate(rate: number): void;

    /** Returns the current playback time in milliseconds. */
    getCurrentTime(): number | null;

    /** Jumps to a specific time (in milliseconds) in the animation. */
    setCurrentTime(time: number): void;
}

export interface PixodeskSvgAnimatorImplProps {
    className?: string;
    style?: CSSProperties;
    doc: PxAnimatedSvgDocument;
    compMode: PixodeskSvgAnimatorCompMode;

    /** Imperative API handle populated by the inner component. */
    apiHolderRef: React.RefObject<PxAnimatorAPI | null>;

    /**
     * Latest lifecycle callbacks, read at invocation time so the memoised
     * inner component always calls the current props even though it never
     * re-renders.
     */
    callbacksRef: React.RefObject<PixodeskSvgAnimatorCallbacks>;
}

/** Lifecycle callback props (subset of {@link PixodeskSvgAnimatorProps}). */
export interface PixodeskSvgAnimatorCallbacks {
    onPlay?: () => void;
    onStop?: () => void;
    onPause?: () => void;
    onCancel?: () => void;
    onFinish?: () => void;
    onRemove?: () => void;
}

export interface PixodeskSvgAnimatorProps {

    className?: string;

    style?: CSSProperties;

    // -- Source ---------------------------------------------------------------

    /**
     * The animation document to render.
     *
     * TODO: Accept PxFileConfig | string to support URL-based loading, e.g.
     *   <PixodeskSvgAnimator doc="/animation.json" />
     */
    doc: PxAnimatedSvgDocument;

    // -- Rendering mode ------------------------------------------------------

    /** Forces a specific rendering engine. Defaults to 'auto'. */
    mode?: JsMode;

    // -- Timing overrides ----------------------------------------------------

    /** Delay before the animation starts, in milliseconds. */
    delay?: number;

    /** Defines the element's style when the animation is not active. */
    fill?: FillMode;

    /** Number of iterations, or 'infinite' for endless looping. */
    iterations?: number | 'infinite';

    /** Duration of a single iteration in milliseconds. */
    duration?: number;

    /** Playback direction. */
    direction?: PlaybackDirection;

    /** Target frame rate (frames per second). */
    frameRate?: number;

    // -- Trigger overrides ---------------------------------------------------

    /** The event that starts the animation. When omitted, uses the value from the document config. */
    startOn?: StartOn;

    /** Behaviour when the trigger condition ends (e.g. mouse-out, second click). */
    outAction?: OutAction;

    /** Visibility ratio (0.0–1.0) required to trigger a scrollIntoView animation. Defaults to 0.5. */
    scrollIntoViewThreshold?: number;

    // -- Declarative control -------------------------------------------------

    /** When true, uses triggers defined in the animation document. */
    autoplay?: boolean;

    /**
     * Starts the animation unconditionally, ignoring document triggers.
     * Equivalent to `startOn="load"` / `outAction="continue"`.
     */
    play?: boolean;

    /** Pauses current playback. Only meaningful when `play` or `autoplay` is set. */
    pause?: boolean;

    // -- Imperative control --------------------------------------------------

    /** Ref populated with the imperative playback API. */
    apiRef?: React.RefObject<ReactAnimatorApi | null>;

    // -- Controlled (external) time ------------------------------------------

    /** Seek to a specific point in the animation, as a fraction (0–1) of the whole timeline (duration × iterations). */
    progress?: number;

    /** Seek to a specific point in the animation (milliseconds). */
    time?: number;

    // -- Callbacks -----------------------------------------------------------

    /** Called when the animation starts or resumes. */
    onPlay?: () => void;

    /** Called when the animation stops for any reason (pause / cancel / finish / removal). */
    onStop?: () => void;

    /** Called when the animation is paused. */
    onPause?: () => void;

    /** Called when the animation is cancelled. */
    onCancel?: () => void;

    /** Called when the animation finishes naturally. */
    onFinish?: () => void;

    /** Called when the animation is removed. */
    onRemove?: () => void;
}


// -- Internal types ---------------------------------------------------------

enum PixodeskSvgAnimatorCompMode {
    static = 'static',
    autoplay = 'autoplay',
    play = 'play',
    imperativeApi = 'imperativeApi',
    fixedTime = 'fixedTime'
}


// -- React ↔ Animator bridge ------------------------------------------------

/**
 * Creates a platform adapter that routes animator attribute updates
 * to the corresponding React-managed DOM refs.
 */
export function createReactAdapter(elementRefs: React.RefObject<Map<string, any>>) {
    const warnedSelectors = new Set<string>();

    const adapter: PxPlatformAdapter = {
        isConnected: () => {
            return true;
        },
        setAttribute: (id, attrName, value) => {

            attrName = camelCaseToKebabWordIfNeeded(attrName);

            const selector = getSelector(id);

            const element = elementRefs.current.get(id);

            if (!element && !warnedSelectors.has(selector)) {
                warnedSelectors.add(selector);
                console.warn('setAttribute: No elements found for selector "' + selector + '"');
                console.warn(elementRefs.current);
            }

            if (element) {
                element.setAttribute(attrName, value);
                if (STYLE_ATTR_NAMES.has(attrName)) {
                    (element as HTMLElement).style[attrName as any] = value;
                }
            }
        },
    };
    return adapter;
}

export function getSelector(id: string) {
    return '#' + id;
}

// FIXME: add model validation (e.g. isElementFileJson check)


// -- Inner component (memoised, never re-renders) ---------------------------

const PixodeskSvgAnimatorImpl: FC<PixodeskSvgAnimatorImplProps> = ({
    className, style, doc, compMode, apiHolderRef, callbacksRef
}) => {

    doc = generateNewIds(doc);

    const elementRefs = useRef(new Map<string, any>());

    const renderNode = (node: PxNode | undefined, isRoot = false): ReactElement | null => {
        if (!node) return null;

        const { type, animate, meta, children, ...props } = node;

        const normProps = getNormalizedProps(props);

        normProps['ref'] = (domEl: any) => {
            if (node['id']) elementRefs.current.set(node['id'], domEl);
            // return () => {};
        };

        // Apply the component's className/style props to the root SVG element.
        if (isRoot) {
            if (className) {
                normProps['className'] = normProps['className']
                    ? normProps['className'] + ' ' + className
                    : className;
            }
            if (style) normProps['style'] = style;
        }

        return createElement(type, normProps, children?.map(child => renderNode(child)));
    };

    const root = doc ? renderNode(doc, true) : null;

    // Create the animator once per document and tear it down on unmount.
    useEffect(() => {

        // Route lifecycle events through `callbacksRef` so the latest callback
        // props are invoked even though this component never re-renders.
        const cb = (name: keyof PixodeskSvgAnimatorCallbacks, alsoStop = false) => () => {
            callbacksRef.current?.[name]?.();
            if (alsoStop) callbacksRef.current?.onStop?.();
        };
        const callbacks = {
            onPlay:   cb('onPlay'),
            onPause:  cb('onPause', true),
            onCancel: cb('onCancel', true),
            onFinish: cb('onFinish', true),
            onRemove: cb('onRemove', true),
        };

        let api: PxAnimatorAPI | undefined = createAnimator({ data: doc, adapter: createReactAdapter(elementRefs), callbacks });
        apiHolderRef.current = api;

        return () => {
            api?.destroy();
            apiHolderRef.current = null;
        };
    }, [doc, apiHolderRef, callbacksRef]);

    return root;
};

/** Memoised wrapper — the inner component never re-renders (props are stable by design). */
const PixodeskSvgAnimatorImplOnce = React.memo(
    PixodeskSvgAnimatorImpl,
    () => true // Don't re-render
);


// -- Main public component --------------------------------------------------

/**
 * React component for rendering and controlling Pixodesk SVG animations.
 *
 * Supports four mutually-exclusive control modes:
 *
 * 1. **Autoplay** – uses triggers from the animation document.
 *    ```tsx
 *    <PixodeskSvgAnimator doc={animation} autoplay />
 *    ```
 *
 * 2. **Declarative play/pause** – controlled via boolean props.
 *    ```tsx
 *    <PixodeskSvgAnimator doc={animation} play pause={false} />
 *    ```
 *
 * 3. **Imperative** – exposes a ref-based API for full programmatic control.
 *    ```tsx
 *    const api = useRef<ReactAnimatorApi>(null);
 *    <PixodeskSvgAnimator doc={animation} apiRef={api} />
 *    <button onClick={() => api.current?.play()}>Play</button>
 *    ```
 *
 * 4. **Controlled time** – renders a single frame at a given time.
 *    ```tsx
 *    <PixodeskSvgAnimator doc={animation} progress={0.5} />
 *    <PixodeskSvgAnimator doc={animation} time={500} />
 *    ```
 */
const PixodeskSvgAnimator: FC<PixodeskSvgAnimatorProps> = ({
    className, style,
    doc, autoplay, play, pause, progress, time, apiRef,

    // Overrides
    mode, delay, fill, iterations, duration, direction, frameRate,

    startOn, outAction, scrollIntoViewThreshold,

    onPlay, onStop, onPause, onCancel, onFinish, onRemove
}) => {

    // Determine which control mode is active.
    let compMode = PixodeskSvgAnimatorCompMode.static;
    if (apiRef) {
        compMode = PixodeskSvgAnimatorCompMode.imperativeApi;
    } else if (autoplay) {
        compMode = PixodeskSvgAnimatorCompMode.autoplay;
    } else if (progress !== undefined || time !== undefined) {
        compMode = PixodeskSvgAnimatorCompMode.fixedTime;
    } else if (play !== undefined || pause !== undefined) {
        compMode = PixodeskSvgAnimatorCompMode.play;
    }

    // In non-autoplay modes, override the document trigger to 'programmatic'
    // so the component can manage playback itself.
    if (compMode !== PixodeskSvgAnimatorCompMode.autoplay) {
        const startOn = doc.animator?.trigger?.startOn;
        if (
            startOn &&
            startOn !== 'programmatic' // FIXME: use enum
        ) {
            doc = {
                ...doc,
                animator: {
                    ...doc.animator,
                    trigger: {
                        ...doc.animator?.trigger,
                        startOn: 'programmatic' // FIXME: use enum
                    }
                }
            };
        }
    }

    // Apply timing overrides from props onto the document config.
    if (
        mode !== undefined ||
        duration !== undefined ||
        delay !== undefined ||
        iterations !== undefined ||
        fill !== undefined ||
        direction !== undefined ||
        frameRate !== undefined
    ) {
        const animator = doc.animator || {};
        doc = {
            ...doc,
            animator: {
                ...animator,
                mode: mode !== undefined ? mode : animator.mode,
                duration: duration !== undefined ? duration : animator.duration,
                delay: delay !== undefined ? delay : animator.delay,
                iterations: iterations !== undefined ? iterations : animator.iterations,
                fill: fill !== undefined ? fill : animator.fill,
                direction: direction !== undefined ? direction : animator.direction,
                frameRate: frameRate !== undefined ? frameRate : animator.frameRate
            }
        };
    }

    // Apply trigger overrides from props.
    if (
        startOn !== undefined ||
        outAction !== undefined ||
        scrollIntoViewThreshold !== undefined
    ) {
        const trigger: PxTrigger = doc.animator?.trigger || {};
        doc = {
            ...doc,
            animator: {
                ...doc.animator,
                trigger: {
                    ...trigger,
                    startOn: startOn !== undefined ? startOn : trigger.startOn,
                    outAction: outAction !== undefined ? outAction : trigger.outAction,
                    scrollIntoViewThreshold: scrollIntoViewThreshold !== undefined ? scrollIntoViewThreshold : trigger.scrollIntoViewThreshold
                }
            }
        };
    }

    // Controlled-time mode: compute the absolute seek target. `progress` is a
    // fraction (0–1) of the WHOLE timeline (duration × iterations); `time`
    // is absolute milliseconds. The seek is applied through the animator API
    // (setCurrentTime) below — the document itself stays stable, so scrubbing
    // does NOT recreate the animator.
    let seekMs: number | undefined;
    if (compMode === PixodeskSvgAnimatorCompMode.fixedTime) {
        const animator = doc.animator || {};
        if (progress !== undefined) {
            const iterationsValue = iterations ?? animator.iterations;
            const iterationsCount = typeof iterationsValue === 'number' && iterationsValue >= 1 ? iterationsValue : 1;
            const singleDuration = duration ?? animator.duration ?? 1000; // engine default duration
            seekMs = progress * singleDuration * iterationsCount;
        }
        if (time !== undefined) seekMs = time;
    }

    const apiHolderRef = useRef<PxAnimatorAPI | null>(null);

    // Keep the latest callback props readable by the memoised inner component.
    const callbacksRef = useRef<PixodeskSvgAnimatorCallbacks>({});
    callbacksRef.current = { onPlay, onStop, onPause, onCancel, onFinish, onRemove };

    // Expose the imperative API via the consumer-provided ref.
    useImperativeHandle(apiRef, () => {
        return {
            isPlaying: () => apiHolderRef.current?.isPlaying() || false,
            play: () => apiHolderRef.current?.play(),
            pause: () => apiHolderRef.current?.pause(),
            cancel: () => apiHolderRef.current?.cancel(),
            finish: () => apiHolderRef.current?.finish(),
            setPlaybackRate: (rate: number) => apiHolderRef.current?.setPlaybackRate(rate),
            getCurrentTime: () => apiHolderRef.current?.getCurrentTime() ?? null,
            setCurrentTime: (time: number) => apiHolderRef.current?.setCurrentTime(time),
        };
    }, []);

    // Increment key when the document, mode, or root styling changes to force
    // a full remount (the inner component is memoised and never re-renders).
    const key = useDepsVersion(compMode, doc, className, style);

    // Sync declarative play/pause props with the animator. Re-runs after a
    // remount (`key` in deps) so a doc swap re-applies the current state.
    useEffect(() => {

        if (compMode === PixodeskSvgAnimatorCompMode.play) {
            if (play && !pause) {
                apiHolderRef.current?.play();
            } else if (pause) {
                apiHolderRef.current?.pause();
            } else if (play === false) {
                // explicit play=false → jump to the end state
                apiHolderRef.current?.finish();
            } else {
                // pause-only usage: pause switched off → resume
                apiHolderRef.current?.play();
            }
        }

        return () => {
            if (compMode === PixodeskSvgAnimatorCompMode.play) {
                // Intentionally read at cleanup time (NOT snapshotted at effect
                // time): the inner component nulls the ref when it destroys the
                // animator, so this pauses only a still-live instance. A
                // snapshot would call pause() on a destroyed animator and emit
                // a spurious onPause after teardown.
                // eslint-disable-next-line react-hooks/exhaustive-deps
                apiHolderRef.current?.pause();
            }
        };
    }, [compMode, play, pause, key]);

    // Controlled-time mode: seek through the animator API. Scrubbing `progress` /
    // `time` only re-runs this effect — the animator is NOT recreated.
    useEffect(() => {
        if (compMode === PixodeskSvgAnimatorCompMode.fixedTime && seekMs !== undefined) {
            apiHolderRef.current?.setCurrentTime(seekMs);
            apiHolderRef.current?.pause();
        }
    }, [compMode, seekMs, key]);

    return (
        <PixodeskSvgAnimatorImplOnce
            key={key}
            className={className}
            style={style}
            compMode={compMode}
            doc={doc}
            apiHolderRef={apiHolderRef}
            callbacksRef={callbacksRef}
        />
    );
};

export default PixodeskSvgAnimator;