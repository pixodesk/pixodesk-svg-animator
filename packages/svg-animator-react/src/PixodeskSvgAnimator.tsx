/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { PxAnimatedSvgDocument, PxAnimatorApi, PxTimelineEngineSetting, PxTrigger } from '@pixodesk/svg-animator-web';
import type { PxInternalAnimatorOptions } from '@pixodesk/svg-animator-web/internal';
import type { PxMouseOutAction } from '@pixodesk/svg-animator-core';
import { createAnimator, PxDiagnosticKind, type PxAnimatorCallbacks, type PxPlaybackOverride, type PxDiagnostics, type PxDiagnosticsConfig } from '@pixodesk/svg-animator-web';
import { applyAnimatorConfig, foldTimelineOverride, getAnimatorConfig, PxDiagnosticCode, PxControlMode, resolveControlMode, controlModeTakesOverTrigger, progressToTimeMs, type PxAnimatorHandle, type PxControlProps } from '@pixodesk/svg-animator-core';
import { createDiagnostics, PX_DEFAULT_DURATION_MS, prepareDocumentForRender, renderPxTree, type PxElementFactory } from '@pixodesk/svg-animator-core/internal';
import type { CSSProperties, FC, ReactElement } from 'react';
import React, { createElement, useEffect, useImperativeHandle, useRef } from 'react';
import { useDepsVersion } from './Utils';


// -- Public types -----------------------------------------------------------

/** React's own prop names on the element we create — not wire keys, and not names React
 *  would let us rename. Kept as a record so they are written as data, like every other
 *  name that crosses out of this bundle. */
const REACT_PROP = { key: 'key', ref: 'ref', className: 'className', style: 'style' } as const;

/**
 * The SVG attribute names React maps from camelCase (`stroke-width` ← `strokeWidth`): the SVG 2
 * presentation attributes it knows, plus the namespaced ones. Given the kebab form of one of
 * these, React still writes it — but warns "did you mean strokeWidth" for every attribute.
 *
 * Deliberately an ALLOWLIST. A name that is not here is handed to React verbatim, and React
 * writes an attribute it does not know untouched — so an unlisted or future name is CORRECT by
 * construction. The other default fails silently: camelCase a name React does not know and it
 * writes the camelCase form, which SVG ignores — `maskType="alpha"` quietly became luminance
 * masking, `offsetDistance` did nothing.
 *
 * Every entry is checked against the real DOM by the spec "attribute names", which renders each
 * one through React and through the web player and compares what arrives.
 * @internal
 */
export const REACT_CAMEL_CASED_SVG_ATTRS: ReadonlySet<string> = new Set([
    'alignment-baseline', 'baseline-shift', 'clip-path', 'clip-rule', 'color-interpolation',
    'color-interpolation-filters', 'color-rendering', 'dominant-baseline', 'fill-opacity', 'fill-rule',
    'flood-color', 'flood-opacity', 'font-family', 'font-size', 'font-size-adjust', 'font-stretch',
    'font-style', 'font-variant', 'font-weight', 'image-rendering', 'letter-spacing', 'lighting-color',
    'marker-end', 'marker-mid', 'marker-start', 'paint-order', 'pointer-events', 'shape-rendering',
    'stop-color', 'stop-opacity', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-linecap',
    'stroke-linejoin', 'stroke-miterlimit', 'stroke-opacity', 'stroke-width', 'text-anchor',
    'text-decoration', 'text-rendering', 'transform-origin', 'unicode-bidi', 'vector-effect',
    'word-spacing', 'writing-mode',
    'xlink:actuate', 'xlink:arcrole', 'xlink:href', 'xlink:role', 'xlink:show', 'xlink:title', 'xlink:type',
    'xml:base', 'xml:lang', 'xml:space',
]);

const SVG_CLASS_ATTR = 'class';

/** SVG attribute name (as the shared renderer hands it over) → the prop name React wants. */
function toReactPropName(attr: string): string {
    if (attr === SVG_CLASS_ATTR) return REACT_PROP.className;
    if (!REACT_CAMEL_CASED_SVG_ATTRS.has(attr)) return attr;
    return attr.replace(/[-:]([a-z])/g, (_all, c: string) => c.toUpperCase());
}

/**
 * The imperative handle `apiRef` is filled with — core's `PxAnimatorHandle` under this package's
 * name (review §9). One definition for React, Vue and React Native: the three used to declare
 * the same methods separately, and their comments had already begun to drift.
 * @public
 */
export type ReactAnimatorApi = PxAnimatorHandle;

export interface PixodeskSvgAnimatorImplProps {
    className?: string;
    style?: CSSProperties;
    doc: PxAnimatedSvgDocument;
    compMode: PxControlMode;

    /** Imperative API handle populated by the inner component. */
    apiHolderRef: React.RefObject<PxAnimatorApi | null>;

    /**
     * Latest lifecycle callbacks, read at invocation time so the memoised
     * inner component always calls the current props even though it never
     * re-renders.
     */
    callbacksRef: React.RefObject<PixodeskSvgAnimatorCallbacks>;

    /**
     * Latest diagnostics props (API review §5). Kept OUT of
     * {@link PixodeskSvgAnimatorCallbacks} on purpose: that type is indexed with `keyof` and
     * every member invoked as a function, so a `muteWarn: boolean` in there would not type.
     */
    diagRef: React.RefObject<PxDiagnosticsConfig>;
}

/**
 * The six lifecycle callbacks — a subset of {@link PixodeskSvgAnimatorProps}, derived from core's
 * `PxAnimatorCallbacks` (review §9). Kept under its own name because the inner component indexes
 * it with `keyof` and invokes every member, which the diagnostics members would not allow.
 * @public
 */
export type PixodeskSvgAnimatorCallbacks =
    Pick<PxAnimatorCallbacks, 'onPlay' | 'onStop' | 'onPause' | 'onCancel' | 'onFinish' | 'onRemove'>;

/**
 * The component's props. The playback override, the control props and every callback are
 * core's shared shapes (review §9) — `PxPlaybackOverride`, `PxControlProps` and
 * `PxAnimatorCallbacks` — so React, Vue and React Native cannot drift apart. Only what is
 * React-specific is declared here.
 * @public
 */
export interface PixodeskSvgAnimatorProps extends PxPlaybackOverride, PxControlProps, PxAnimatorCallbacks {

    /** Added to the root `<svg>`. */
    className?: string;

    /** Set on the root `<svg>`. */
    style?: CSSProperties;

    // -- Source ---------------------------------------------------------------

    /**
     * The animation document to render. No URL form by design (review §16): in a component
     * tree the app already owns loading — import the JSON or fetch it, then pass it down.
     */
    doc: PxAnimatedSvgDocument;

    // -- Imperative control --------------------------------------------------

    /**
     * Ref populated with the imperative playback API. Filled in EVERY mode and never picks one
     * (review §1): `autoplay` next to it still autoplays.
     */
    apiRef?: React.RefObject<ReactAnimatorApi | null>;
}


// -- Internal types ---------------------------------------------------------

// The control mode is core's `PxControlMode`, shared with Vue and React Native (API review
// §1/§7). The local enum is gone — and with it `imperativeApi`, which existed only to make a
// REF pick a mode and so silently disabled `autoplay`.


// FIXME: add model validation (e.g. isElementFileJson check)


// -- Inner component (memoised, never re-renders) ---------------------------

const PixodeskSvgAnimatorImpl: FC<PixodeskSvgAnimatorImplProps> = ({
    className, style, doc, compMode, apiHolderRef, callbacksRef, diagRef
}) => {

    // Render what the web player renders: materialized, then fresh ids. Rendering the raw
    // document dropped every `effects` bucket — no gradient, mask or wrapper defs — so a
    // document painted by `effects` alone came out as an empty canvas.
    doc = prepareDocumentForRender(doc);

    // The `<svg>` this component rendered — handed to the player, which attaches its triggers
    // to it and writes animated values to the elements under it.
    const rootRef = useRef<Element | null>(null);

    // The ONLY React-specific part of rendering: how to create an element. Every decision about
    // the document — tags, attribute names and values, sanitization, styles, text — is made by
    // core's `renderPxTree`, the same code the web player renders with.
    const createReactElement: PxElementFactory<ReactElement> = ({ tag, attrs, style: nodeStyle, children, text, node, isRoot, index }) => {
        const props: Record<string, unknown> = {};
        for (const name of Object.keys(attrs)) props[toReactPropName(name)] = attrs[name];

        props[REACT_PROP.key] = node.id ?? index;
        if (nodeStyle) props[REACT_PROP.style] = nodeStyle;

        // The component's own `className` / `style` props land on the root `<svg>`; its `style`
        // wins over the document root's own declarations.
        if (isRoot) {
            props[REACT_PROP.ref] = (domEl: Element | null) => { rootRef.current = domEl; };
            if (className) props[REACT_PROP.className] = props[REACT_PROP.className] ? props[REACT_PROP.className] + ' ' + className : className;
            if (style) props[REACT_PROP.style] = { ...nodeStyle, ...style };
        }

        return createElement(tag, props, children.length ? children : text);
    };

    const root = renderPxTree(doc, createReactElement, createDiagnostics(diagRef.current ?? undefined, '[PixodeskSvgAnimator]'));

    // Create the animator once per document and tear it down on unmount.
    useEffect(() => {

        // Route lifecycle events through `callbacksRef` so the latest callback
        // props are invoked even though this component never re-renders.
        const cb = (name: keyof PixodeskSvgAnimatorCallbacks) => () => { callbacksRef.current?.[name]?.(); };
        // The player's own diagnostics reach the same handlers as the component's (§5). Spread
        // the CURRENT values rather than wrapping them: `(m, d) => diagRef.current?.onWarn?.(m, d)`
        // would always be a function, so the channel would never fall back to the console.
        //
        // The callbacks go INLINE, under the same names as the props (review §9). `onStop` is
        // the PLAYER's to fire after pause / cancel / finish / remove — one rule, in the web
        // package — so it is passed through rather than re-derived here.
        // No `adapter`: the web player's OWN writer drives the elements React rendered, found by
        // id under the root. A second writer here was a second place for rules to go missing.
        const options: PxInternalAnimatorOptions = {
            doc,
            // Refs are attached during commit, before this effect runs, so the root exists here.
            rootElement: rootRef.current ?? undefined,
            onPlay:   cb('onPlay'),
            onPause:  cb('onPause'),
            onCancel: cb('onCancel'),
            onFinish: cb('onFinish'),
            onRemove: cb('onRemove'),
            onStop:   cb('onStop'),
            onWarn:   diagRef.current?.onWarn,
            onError:  diagRef.current?.onError,
            muteWarn:  diagRef.current?.muteWarn,
            muteError: diagRef.current?.muteError,
        };
        let api: PxAnimatorApi | undefined = createAnimator(options);
        apiHolderRef.current = api;

        return () => {
            api?.destroy();
            apiHolderRef.current = null;
        };
    }, [doc, apiHolderRef, callbacksRef, diagRef]);

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
 * @public
 */
const PixodeskSvgAnimator: FC<PixodeskSvgAnimatorProps> = ({
    className, style,
    doc, autoplay, play, pause, progress, time, apiRef,

    // Overrides
    timeline, resetTimeline, duration, delay, iterations, start,

    onPlay, onStop, onPause, onCancel, onFinish, onRemove,

    // Diagnostics (API review §5)
    onWarn, onError, muteWarn, muteError
}) => {

    // ONE control-mode rule, decided in core and shared with Vue and React Native
    // (API review §1/§7). `apiRef` is deliberately NOT an input: the handle is populated in
    // every mode, so `<PixodeskSvgAnimator autoplay apiRef={api} />` now autostarts AND gives
    // you the handle, instead of the ref silently forcing `start: 'none'`.
    const { mode: compMode, warnings: modeWarnings } =
        resolveControlMode({ progress, time, play, pause, autoplay });

    /**
     * The diagnostics channel, built from the CURRENT props each time (API review §5).
     * Deliberately not hoisted into a wrapper closure: `(m, d) => onWarn?.(m, d)` would always
     * be a function, so the channel would believe a handler exists and the console fallback
     * would never fire for anyone who passed nothing.
     */
    const makeDiag = (): PxDiagnostics =>
        createDiagnostics({ onWarn, onError, muteWarn, muteError }, '[PixodeskSvgAnimator]');

    // Warn once per distinct conflict, not once per render — a parent re-rendering on unrelated
    // state must not repeat the sentence. React Native guards it the same way.
    useEffect(() => {
        const diag = makeDiag();
        for (const w of modeWarnings) diag.warn(PxDiagnosticKind.usage, PxDiagnosticCode.controlPropsConflict, w);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [modeWarnings.join('|')]);

    // ONE patch, applied ONCE: the props, plus the component's own need to take the trigger
    // over in the non-autoplay control modes.
    //
    // This replaces three hand-rolled spread blocks that wrote the FLAT runtime keys
    // (`animator.duration`, `animator.trigger`). On a wire-format document — `animator.timeline.…`,
    // which is what every writer emits — `flattenAnimatorTimeline` overwrites those flat keys from
    // `timeline` immediately afterwards, so every one of those overrides was silently discarded.
    // See dev-docs/plans/playback-override.md §1.1.
    const patch = foldTimelineOverride(timeline, { duration, delay, iterations, start });
    const takeOverTrigger = controlModeTakesOverTrigger(compMode);
    const fullPatch: any = takeOverTrigger
        ? {
            ...(patch ?? {}),
            timeline: {
                ...((patch as any)?.timeline ?? {}),
                trigger: { ...((patch as any)?.timeline?.trigger ?? {}), start: 'none' },
            },
        }
        : patch;

    if (fullPatch !== undefined || resetTimeline) {
        const applied = applyAnimatorConfig(doc, fullPatch ?? {}, { resetTimeline: !!resetTimeline });
        const diag = makeDiag();
        for (const w of applied.warnings) diag.warn(PxDiagnosticKind.usage, PxDiagnosticCode.timelineOverrideIgnored, w);
        doc = applied.doc;
    }

    // Controlled-time mode: compute the absolute seek target. `progress` is a
    // fraction (0–1) of the WHOLE timeline (duration × iterations — ONE iteration
    // when endless); `time` is absolute milliseconds. The seek is applied through
    // the animator API (setCurrentTime) below — the document itself stays stable,
    // so scrubbing does NOT recreate the animator.
    let seekMs: number | undefined;
    if (compMode === PxControlMode.fixedTime) {
        // `getAnimatorConfig` returns the FLAT runtime view, so this works for a wire-format
        // document too — reading `doc.animator.duration` directly would find nothing there.
        const animator = getAnimatorConfig(doc) || {};
        if (progress !== undefined) {
            // ONE rule for progress → time (core's `progressToTimeMs`): the same mapping
            // `getCurrentProgress` reads back, so a prop of 0.5 and a read of 0.5 agree.
            const iterationsValue = iterations ?? animator.iterations;
            const iterationsCount = iterationsValue === 'infinite' ? Infinity
                : (typeof iterationsValue === 'number' && iterationsValue >= 1 ? iterationsValue : 1);
            const singleDuration = duration ?? animator.duration ?? PX_DEFAULT_DURATION_MS;
            seekMs = progressToTimeMs(progress, singleDuration, iterationsCount);
        }
        if (time !== undefined) seekMs = time;
    }

    const apiHolderRef = useRef<PxAnimatorApi | null>(null);

    // Keep the latest callback props readable by the memoised inner component.
    const callbacksRef = useRef<PixodeskSvgAnimatorCallbacks>({});
    callbacksRef.current = { onPlay, onStop, onPause, onCancel, onFinish, onRemove };

    // Same idea for the diagnostics props, so the player and the adapter report where the
    // component does (§5).
    const diagRef = useRef<PxDiagnosticsConfig>({});
    diagRef.current = { onWarn, onError, muteWarn, muteError };

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
            getCurrentProgress: () => apiHolderRef.current?.getCurrentProgress() ?? null,
            setCurrentProgress: (progress: number) => apiHolderRef.current?.setCurrentProgress(progress),
        };
    }, []);

    // Increment key when the document, mode, or root styling changes to force
    // a full remount (the inner component is memoised and never re-renders).
    const key = useDepsVersion(compMode, doc, className, style);

    // Sync declarative play/pause props with the animator. Re-runs after a
    // remount (`key` in deps) so a doc swap re-applies the current state.
    useEffect(() => {

        if (compMode === PxControlMode.play) {
            if (play && !pause) {
                apiHolderRef.current?.play();
            } else if (pause) {
                apiHolderRef.current?.pause();
            } else if (play === false) {
                // explicit play=false → hold where it is (review §8). This used to `finish()`;
                // a boolean whose `false` means "jump to the end" is not what anyone guesses.
                apiHolderRef.current?.pause();
            } else {
                // pause-only usage: pause switched off → resume
                apiHolderRef.current?.play();
            }
        }

        return () => {
            if (compMode === PxControlMode.play) {
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
        if (compMode === PxControlMode.fixedTime && seekMs !== undefined) {
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
            diagRef={diagRef}
        />
    );
};

export default PixodeskSvgAnimator;