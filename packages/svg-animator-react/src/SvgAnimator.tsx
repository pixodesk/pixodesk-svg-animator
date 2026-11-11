// @px-area entry
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { PxDocument, PxAnimationPlayerApi, PxTimelineEngineSetting, PxActionTriggersInput } from '@pixodesk/svg-animator-web';
import type { PxInternalAnimationPlayerOptions } from '@pixodesk/svg-animator-web/internal';
import { createSvgAnimationPlayer, PxDiagnosticKind, type PxAnimationPlayerCallbacks, type PxPlaybackOverride, type PxDiagnostics, type PxDiagnosticsConfig } from '@pixodesk/svg-animator-web';
import { applyAnimatorConfig, toPxDocument, type PxDocumentJson, getAnimatorConfig, PxDiagnosticCode, PxAtEndBehavior, PxRunState, PxWhenIdle, type PxAnimationPlayerHandle } from '@pixodesk/svg-animator-core';
import { applyDeclarativeAction, applyPlaybackOverride, type PxDeclarativeProps, PxControlMode, PxPlaybackWorld, resolveControlMode, resolveDeclarativePlayback, resolvePlaybackWorld, controlModeTakesOverTrigger, withoutTriggerDriver, type PxControlProps } from '@pixodesk/svg-animator-core/engine';
import { createDiagnostics, PX_DEFAULT_DURATION_MS, prepareDocumentForRender, renderPxTree, reportDocumentProblems, type PxElementFactory } from '@pixodesk/svg-animator-core/internal';
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
 * The imperative handle `playerRef` is filled with — core's `PxAnimationPlayerHandle` under this package's
 * name (review §9). One definition for React, Vue and React Native: the three used to declare
 * the same methods separately, and their comments had already begun to drift.
 * @public
 */

export interface SvgAnimatorImplProps {
    className?: string;
    style?: CSSProperties;
    doc: PxDocument;
    compMode: PxControlMode;

    /** Imperative API handle populated by the inner component. */
    apiHolderRef: React.RefObject<PxAnimationPlayerApi | null>;

    /**
     * Latest lifecycle callbacks, read at invocation time so the memoised
     * inner component always calls the current props even though it never
     * re-renders.
     */
    callbacksRef: React.RefObject<SvgAnimationPlayerCallbacks>;

    /**
     * Latest diagnostics props (API review §5). Kept OUT of
     * {@link SvgAnimationPlayerCallbacks} on purpose: that type is indexed with `keyof` and
     * every member invoked as a function, so a `suppressWarnings: boolean` in there would not type.
     */
    diagRef: React.RefObject<PxDiagnosticsConfig>;
}

/**
 * The lifecycle callbacks — a subset of {@link SvgAnimationPlayerProps}, derived from core's
 * `PxAnimationPlayerCallbacks` (review §9). Kept under its own name because the inner component indexes
 * it with `keyof` and invokes every member, which the diagnostics members would not allow.
 * @public
 */
export type SvgAnimationPlayerCallbacks =
    Pick<PxAnimationPlayerCallbacks, 'onReady' | 'onRunStart' | 'onRunStop' | 'onRunPause' | 'onRunResume' | 'onFinish' | 'onDestroy'>;

/**
 * The component's props. The playback override, the control props and every callback are
 * core's shared shapes (review §9) — `PxPlaybackOverride`, `PxControlProps` and
 * `PxAnimationPlayerCallbacks` — so React, Vue and React Native cannot drift apart. Only what is
 * React-specific is declared here. `SvgCssAnimationPlayerProps` derives from this type — a change here is checked there.
 * @public
 */
export type SvgAnimationPlayerProps = PxPlaybackOverride & PxControlProps & PxAnimationPlayerCallbacks & {

    /** Added to the root `<svg>`. */
    className?: string;

    /** Set on the root `<svg>`. */
    style?: CSSProperties;

    // -- Source ---------------------------------------------------------------

    /**
     * The animation document to render. No URL form by design (review §16): in a component
     * tree the app already owns loading — import the JSON or fetch it, then pass it down.
     * WHY `doc`, not `document`: `document` shadows `window.document` in exactly the files that also query it,
     * and the type is `PxDocument`.
     */
    doc: PxDocumentJson;

    // -- Imperative control --------------------------------------------------

    /**
     * Ref the component fills with the imperative playback API — your code as the driver. Filled in
     * EVERY mode and never picks one (review §1): `playUsingActionTriggers` next to it still autoplays.
     * WHY not React's `ref`: the handle is not a control mode — the drivers are the `play…` / `show…` props — and
     * Vue and React Native carry the same name, so one word reads the same in all three.
     */
    playerRef?: React.RefObject<PxAnimationPlayerHandle | null>;
};


// -- Internal types ---------------------------------------------------------

// The control mode is core's `PxControlMode`, shared with Vue and React Native (API review
// §1/§7). The local enum is gone — and with it `imperativeApi`, which existed only to make a
// REF pick a mode and so silently disabled `playUsingActionTriggers`.


// FIXME: add model validation (e.g. isElementFileJson check)


// -- Inner component (memoised, never re-renders) ---------------------------

// @px-importance important
const SvgAnimatorImpl: FC<SvgAnimatorImplProps> = ({
    className, style, doc, compMode, apiHolderRef, callbacksRef, diagRef
}) => {

    // Render what the web player renders: materialized, then fresh ids. Rendering the raw
    // document dropped every `effects` bucket — no gradient, mask or wrapper defs — so a
    // document painted by `effects` alone came out as an empty canvas.
    // The checked stage repairs what does not match the schema and says what it repaired.
    doc = prepareDocumentForRender(doc, ps => reportDocumentProblems(ps, createDiagnostics(diagRef.current ?? undefined, '[SvgAnimationPlayer]')));

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

    const root = renderPxTree(doc, createReactElement, createDiagnostics(diagRef.current ?? undefined, '[SvgAnimationPlayer]'));

    // Create the animator once per document and tear it down on unmount.
    useEffect(() => {

        // Route lifecycle events through `callbacksRef` so the latest callback
        // props are invoked even though this component never re-renders.
        const cb = (name: keyof SvgAnimationPlayerCallbacks) => () => { callbacksRef.current?.[name]?.(); };
        // The player's own diagnostics reach the same handlers as the component's (§5). Spread
        // the CURRENT values rather than wrapping them: `(m, d) => diagRef.current?.onWarning?.(m, d)`
        // would always be a function, so the channel would never fall back to the console.
        //
        // The callbacks go INLINE, under the same names as the props (review §9). The run events are
        // the PLAYER's executor's to fire when it performs the act — one rule, in the web package — so
        // they are passed through rather than re-derived here.
        // No `adapter`: the web player's OWN writer drives the elements React rendered, found by
        // id under the root. A second writer here was a second place for rules to go missing.
        const options: PxInternalAnimationPlayerOptions = {
            doc,
            // The component resolved its control mode and patched `doc` above — the web player
            // must not add its own no-driver suppression on top (first-use review §1+2).
            playUsingActionTriggers: true,
            // Refs are attached during commit, before this effect runs, so the root exists here.
            rootElement: rootRef.current ?? undefined,
            onReady:  cb('onReady'),
            onRunStart:  cb('onRunStart'),
            onRunStop:   cb('onRunStop'),
            onRunPause:  cb('onRunPause'),
            onRunResume: cb('onRunResume'),
            onFinish: cb('onFinish'),
            onDestroy: cb('onDestroy'),
            onWarning:   diagRef.current?.onWarning,
            onError:  diagRef.current?.onError,
            suppressWarnings:  diagRef.current?.suppressWarnings,
            suppressErrors: diagRef.current?.suppressErrors,
        };
        let api: PxAnimationPlayerApi | undefined = createSvgAnimationPlayer(options);
        apiHolderRef.current = api;

        return () => {
            api?.destroy();
            apiHolderRef.current = null;
        };
    }, [doc, apiHolderRef, callbacksRef, diagRef]);

    return root;
};

/** Memoised wrapper — the inner component never re-renders (props are stable by design). */
const SvgAnimatorImplOnce = React.memo(
    SvgAnimatorImpl,
    () => true // Don't re-render
);


// -- Main public component --------------------------------------------------

/**
 * React component for rendering and controlling Pixodesk SVG animations.
 *
 * Supports four mutually-exclusive control modes — TypeScript accepts one at a time (`PxControlProps`):
 *
 * 1. **Play on trigger** – the document's own triggers, or an object with the triggers to use instead.
 *    ```tsx
 *    <SvgAnimationPlayer doc={animation} playUsingActionTriggers />
 *    ```
 *
 * 2. **Declarative `playRun`** – the run's position, held by the host: `"off"` · `"on"` · `"paused"`.
 *    ```tsx
 *    <SvgAnimationPlayer doc={animation} playRun={hovered ? "on" : "off"} />
 *    ```
 *
 * 3. **Imperative** – exposes a ref-based API for full programmatic control.
 *    ```tsx
 *    const api = useRef<PxAnimationPlayerHandle>(null);
 *    <SvgAnimationPlayer doc={animation} playerRef={api} />
 *    <button onClick={() => api.current?.startRun()}>Start</button>
 *    ```
 *
 * 4. **Controlled time** – renders a single frame at a given time.
 *    ```tsx
 *    <SvgAnimationPlayer doc={animation} showAtProgress={0.5} />
 *    <SvgAnimationPlayer doc={animation} showAtTime={500} />
 *    ```
 *
 * A script-free SVG + CSS export plays with the sibling {@link SvgCssAnimationPlayer}: the same prop names, fewer of
 * them ({@link SvgCssAnimationPlayerProps} is derived from these props and checked against them).
 * @public
 */
const SvgAnimationPlayer: FC<SvgAnimationPlayerProps> = ({
    className, style,
    doc: docInput, playUsingActionTriggers, playRun, showAtProgress, showAtTime, playerRef,

    // Override — the file's timing and actions, adjusted (D4, playback-layers.md); the triggers travel with `playUsingActionTriggers`
    timelineOptions, actions,

    onReady, onRunStart, onRunStop, onRunPause, onRunResume, onFinish, onDestroy,

    // Diagnostics (API review §5)
    onWarning, onError, suppressWarnings, suppressErrors
}) => {
    // ONE type-level narrowing from the JSON-import shape (§5); the runtime validates values.
    // `let`: the timeline overrides below replace it with the patched copy.
    let doc = toPxDocument(docInput);

    // ONE control-mode rule, decided in core and shared with Vue and React Native
    // (API review §1/§7). `playerRef` is deliberately NOT an input: the handle is populated in
    // every mode, so `<SvgAnimationPlayer playUsingActionTriggers playerRef={api} />` autostarts AND gives
    // you the handle, instead of the ref silently forcing `start: 'manual'`.
    const { mode: compMode, warnings: modeWarnings } =
        resolveControlMode({ showAtProgress, showAtTime, playRun, playUsingActionTriggers });

    /**
     * The diagnostics channel, built from the CURRENT props each time (API review §5).
     * Deliberately not hoisted into a wrapper closure: `(m, d) => onWarning?.(m, d)` would always
     * be a function, so the channel would believe a handler exists and the console fallback
     * would never fire for anyone who passed nothing.
     */
    const makeDiag = (): PxDiagnostics =>
        createDiagnostics({ onWarning, onError, suppressWarnings, suppressErrors }, '[SvgAnimationPlayer]');

    // Warn once per distinct conflict, not once per render — a parent re-rendering on unrelated
    // state must not repeat the sentence. React Native guards it the same way.
    useEffect(() => {
        const diag = makeDiag();
        for (const w of modeWarnings) diag.warn(PxDiagnosticKind.usage, PxDiagnosticCode.controlPropsConflict, w);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [modeWarnings.join('|')]);

    // The override, applied ONCE through core's one rule (D4: the timing and actions merged, a `playUsingActionTriggers`
    // object replacing the file's triggers), and then the component's own need to take the triggers over
    // in the non-playUsingActionTriggers control modes — the EMPTY block goes on AFTER the caller's override.
    const overridden = applyPlaybackOverride(doc, { timelineOptions, actions, playUsingActionTriggers });
    if (overridden.warnings.length) {
        const diag = makeDiag();
        for (const w of overridden.warnings) diag.warn(PxDiagnosticKind.usage, PxDiagnosticCode.timelineOverrideIgnored, w);
    }
    doc = overridden.doc;
    if (controlModeTakesOverTrigger(compMode)) doc = withoutTriggerDriver(doc);

    // §10: the EFFECTIVE iterations (file + the `iterations` prop, folded into the patched doc
    // above) decide what `playRun` drives — a POSE (one pass) or a RUN (loop).
    const animatorView = getAnimatorConfig(doc) || {};
    const world = resolvePlaybackWorld(animatorView.iterations);
    const passMs = animatorView.duration ?? PX_DEFAULT_DURATION_MS;
    const totalMs = animatorView.iterations === 'infinite' ? Infinity
        : passMs * (typeof animatorView.iterations === 'number' && animatorView.iterations >= 1 ? animatorView.iterations : 1);
    if (compMode === PxControlMode.playRun && world === PxPlaybackWorld.oneShot) {
        // The pose contract beats the file's rest poses (§10, D5): while `playRun` names a pose, the held
        // poses must be the same on every file — an `atEnd: jumpToStart` document would revert to its
        // static attrs after the run. Pin both sides: the first frame before, the last frame after.
        doc = applyAnimatorConfig(doc, { timeline: { whenIdle: PxWhenIdle.firstFrame, atEnd: PxAtEndBehavior.hold } }).doc;
    }

    // Controlled-time mode: the frame to show, content ms INSIDE the iteration (the handle's `getCurrentTime` axis;
    // schema-and-props--manual-review.md A5): `showAtProgress` is 0–1 of one pass, `showAtTime` its ms. The seek is
    // applied through the animator API (setCurrentTime) below — the document itself stays stable, so scrubbing does
    // NOT recreate the animator.
    let seekMs: number | undefined;
    if (compMode === PxControlMode.fixedTime) {
        // `getAnimatorConfig` returns the FLAT runtime view, so this works for a wire-format
        // document too — reading `doc.animator.duration` directly would find nothing there.
        const animator = getAnimatorConfig(doc) || {};
        if (showAtProgress !== undefined) {
            const singleDuration = animator.duration ?? PX_DEFAULT_DURATION_MS;   // the window length, overrides folded in
            seekMs = (Number.isFinite(showAtProgress) ? Math.min(1, Math.max(0, showAtProgress)) : 0) * singleDuration;
        }
        if (showAtTime !== undefined) seekMs = showAtTime;
    }

    const apiHolderRef = useRef<PxAnimationPlayerApi | null>(null);

    // Keep the latest callback props readable by the memoised inner component.
    const callbacksRef = useRef<SvgAnimationPlayerCallbacks>({});
    callbacksRef.current = { onReady, onRunStart, onRunStop, onRunPause, onRunResume, onFinish, onDestroy };

    // Same idea for the diagnostics props, so the player and the adapter report where the
    // component does (§5).
    const diagRef = useRef<PxDiagnosticsConfig>({});
    diagRef.current = { onWarning, onError, suppressWarnings, suppressErrors };

    // Expose the imperative API via the consumer-provided ref. The ref is an ambient
    // CAPABILITY, never a mode (§10) — but a WRITE call landing while a declarative driver
    // (`playRun` or `showAtProgress`/`showAtTime`) owns playback is the actual collision, so it warns
    // (PX1503) and is applied; the next prop change reasserts the props.
    useImperativeHandle(playerRef, () => {
        const guardWrite = (call: string): void => {
            if (compMode === PxControlMode.playRun || compMode === PxControlMode.fixedTime) {
                createDiagnostics(diagRef.current ?? undefined, '[SvgAnimationPlayer]')
                    .warn(PxDiagnosticKind.usage, PxDiagnosticCode.imperativeOverDeclarative, call);
            }
        };
        return {
            isPlaying: () => apiHolderRef.current?.isPlaying() || false,
            startRun: () => { guardWrite('startRun()'); apiHolderRef.current?.startRun(); },
            stopRun: () => { guardWrite('stopRun()'); apiHolderRef.current?.stopRun(); },
            pauseRun: () => { guardWrite('pauseRun()'); apiHolderRef.current?.pauseRun(); },
            resumeRun: () => { guardWrite('resumeRun()'); apiHolderRef.current?.resumeRun(); },
            play: () => { guardWrite('play()'); apiHolderRef.current?.play(); },
            pause: () => { guardWrite('pause()'); apiHolderRef.current?.pause(); },
            jumpToStart: () => { guardWrite('jumpToStart()'); apiHolderRef.current?.jumpToStart(); },
            jumpToEnd: () => { guardWrite('jumpToEnd()'); apiHolderRef.current?.jumpToEnd(); },
            runOnce: () => { guardWrite('runOnce()'); apiHolderRef.current?.runOnce(); },
            getRunState: () => apiHolderRef.current?.getRunState() ?? PxRunState.off,
            isRunActive: () => apiHolderRef.current?.isRunActive() ?? false,
            getPlaybackSpeed: () => apiHolderRef.current?.getPlaybackSpeed() ?? 1,
            setPlaybackSpeed: (speed: number) => {{ guardWrite('setPlaybackSpeed()'); apiHolderRef.current?.setPlaybackSpeed(speed); }},
            getPlaybackDuration: () => apiHolderRef.current?.getPlaybackDuration() ?? null,
            setPlaybackDuration: (ms: number) => {{ guardWrite('setPlaybackDuration()'); apiHolderRef.current?.setPlaybackDuration(ms); }},
            getTotalPlaybackDuration: () => apiHolderRef.current?.getTotalPlaybackDuration() ?? null,
            getCurrentPlaybackTime: () => apiHolderRef.current?.getCurrentPlaybackTime() ?? null,
            getTotalPlaybackTime: () => apiHolderRef.current?.getTotalPlaybackTime() ?? null,
            getDuration: () => apiHolderRef.current?.getDuration() ?? null,
            getTotalDuration: () => apiHolderRef.current?.getTotalDuration() ?? null,
            getTotalProgress: () => apiHolderRef.current?.getTotalProgress() ?? null,
            getCurrentTime: () => apiHolderRef.current?.getCurrentTime() ?? null,
            setCurrentTime: (time: number) => {{ guardWrite('setCurrentTime()'); apiHolderRef.current?.setCurrentTime(time); }},
            getCurrentProgress: () => apiHolderRef.current?.getCurrentProgress() ?? null,
            setCurrentProgress: (progress: number) => {{ guardWrite('setCurrentProgress()'); apiHolderRef.current?.setCurrentProgress(progress); }},
            getCurrentIteration: () => apiHolderRef.current?.getCurrentIteration() ?? 0,
            getTotalTime: () => apiHolderRef.current?.getTotalTime() ?? null,
            setTotalTime: (time: number) => {{ guardWrite('setTotalTime()'); apiHolderRef.current?.setTotalTime(time); }},
        };
    }, [compMode]);

    // Increment key when the document, mode, or root styling changes to force
    // a full remount (the inner component is memoised and never re-renders).
    const key = useDepsVersion(compMode, doc, className, style);

    // Sync the declarative props with the animator — ONE shared rule (§10,
    // `resolveDeclarativePlayback` in core, same in Vue and React Native). `prevPlaybackRef`
    // carries the last applied props; a remount (`key` change) clears it, so the fresh animator
    // renders the named position from scratch — a mount with `"on"` plays (a one-shot to its end), `"off"` does nothing.
    const prevPlaybackRef = useRef<{ key: number; props: PxDeclarativeProps } | null>(null);
    const position: PxDeclarativeProps = { playRun };
    useEffect(() => {
        if (compMode === PxControlMode.playRun) {
            const api = apiHolderRef.current;
            const prev = prevPlaybackRef.current?.key === key ? prevPlaybackRef.current.props : undefined;
            const { actions: steps } = resolveDeclarativePlayback({ world, prev, next: position });
            // HOW each step moves is the timeline's `actions` (startRun / stopRun) — the player's executor
            // behind the buttons.
            if (api) for (const action of steps) applyDeclarativeAction(api, action);
        }
        prevPlaybackRef.current = { key, props: position };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [compMode, playRun, key]);

    // Controlled-time mode: seek through the animator API. Scrubbing `showAtProgress` /
    // `showAtTime` only re-runs this effect — the animator is NOT recreated.
    useEffect(() => {
        if (compMode === PxControlMode.fixedTime && seekMs !== undefined) {
            apiHolderRef.current?.setCurrentTime(seekMs);
            apiHolderRef.current?.pause();
        }
    }, [compMode, seekMs, key]);

    return (
        <SvgAnimatorImplOnce
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

export default SvgAnimationPlayer;