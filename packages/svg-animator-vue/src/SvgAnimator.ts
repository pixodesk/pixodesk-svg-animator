// @px-area entry
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { PxDocument, PxAnimationPlayerApi, PxTimelineEngineSetting, PxTimelineOptions, PxActionsOptions, PxActionTriggersInput, PxPlaybackOverrideInput } from '@pixodesk/svg-animator-web';
import type { PxInternalAnimationPlayerOptions } from '@pixodesk/svg-animator-web/internal';
import { createSvgAnimationPlayer, PxDiagnosticKind, type PxDiagnostic, type PxDiagnostics } from '@pixodesk/svg-animator-web';
import { applyAnimatorConfig, toPxDocument, type PxDocumentJson, getAnimatorConfig, PxDiagnosticCode, PxAtEndBehavior, PxRunState, PxWhenIdle, type PxAnimationPlayerHandle, type PxPlayRun } from '@pixodesk/svg-animator-core';
import { applyDeclarativeAction, applyPlaybackOverride, type PxDeclarativeProps, PxControlMode, PxPlaybackWorld, resolveControlMode, resolveDeclarativePlayback, resolvePlaybackWorld, controlModeTakesOverTrigger, withoutTriggerDriver, type PxControlProps } from '@pixodesk/svg-animator-core/engine';
import { createDiagnostics, deepEquals, PX_DEFAULT_DURATION_MS, prepareDocumentForRender, renderPxTree, reportDocumentProblems, type PxElementFactory } from '@pixodesk/svg-animator-core/internal';
import {
    computed, defineComponent, h, onMounted, onUnmounted, ref, shallowRef, type PropType, type VNode,
    watch,
} from 'vue';


// -- Public types -----------------------------------------------------------

/** Vue's own prop names on the vnode — not wire keys. See the React twin. */
const VUE_PROP = { ref: 'ref', style: 'style' } as const;

/**
 * The imperative handle the template ref exposes — core's `PxAnimationPlayerHandle` under this
 * package's name (review §9). One definition for React, Vue and React Native.
 * @public
 */


// -- Internal types ---------------------------------------------------------

// The control mode is core's `PxControlMode`, shared with React and React Native
// (API review §1/§7) — one precedence rule, one set of conflict warnings.


// FIXME: add model validation (e.g. isElementFileJson check)


// -- Helper: apply doc overrides --------------------------------------------

/**
 * What `applyDocOverrides` / `calcSeekMs` read off the props — core's shared shapes, not a local
 * copy (review §9). The runtime `props: {…}` block below stays Vue's own, because Vue needs
 * runtime prop declarations; this is only the TypeScript view of the same members.
 */
type DocOverrideProps = PxPlaybackOverrideInput & Pick<PxControlProps, 'showAtProgress' | 'showAtTime'>;

// @px-importance important
function applyDocOverrides(
    doc: PxDocument,
    props: DocOverrideProps,
    compMode: PxControlMode,
    diag: PxDiagnostics,
): PxDocument {

    // The override, applied ONCE through core's one rule (D3: per block, the replacement, then the
    // merge), and then the component's own need to take the triggers over in the non-playUsingActionTriggers
    // control modes — the EMPTY block goes on AFTER the caller's override, so nothing re-arms it.
    const overridden = applyPlaybackOverride(doc, props);
    for (const w of overridden.warnings) diag.warn(PxDiagnosticKind.usage, PxDiagnosticCode.timelineOverrideIgnored, w);
    doc = overridden.doc;
    if (controlModeTakesOverTrigger(compMode)) doc = withoutTriggerDriver(doc);

    // §10 / D5: in the play tier's ONE-SHOT world the pose contract beats the file's rest poses — pin
    // both sides (the first frame before, the last frame after), so the held poses are the same on
    // every file (a `finish: jumpToStart` document would otherwise revert to its static attrs).
    if (compMode === PxControlMode.playRun
        && resolvePlaybackWorld((getAnimatorConfig(doc) || {}).iterations) === PxPlaybackWorld.oneShot) {
        doc = applyAnimatorConfig(doc, { timeline: { whenIdle: PxWhenIdle.firstFrame, atEnd: PxAtEndBehavior.hold } }).doc;
    }

    return doc;
}

/**
 * Controlled-time mode: the frame to show, content ms INSIDE the iteration (the handle's `getCurrentTime` axis):
 * `showAtProgress` is 0–1 of one pass, `showAtTime` its ms. Applied through the player API (setCurrentTime) so
 * scrubbing does NOT recreate the player.
 */
function calcSeekMs(doc: PxDocument, props: DocOverrideProps): number | undefined {
    let seekMs: number | undefined;
    // The FLAT runtime view, so this works on a wire-format document too — reading
    // `doc.animator.duration` directly finds nothing there.
    const animator = getAnimatorConfig(doc) || {};
    if (props.showAtProgress !== undefined) {
        const singleDuration = animator.duration ?? PX_DEFAULT_DURATION_MS;   // the window length, overrides folded in
        seekMs = (Number.isFinite(props.showAtProgress) ? Math.min(1, Math.max(0, props.showAtProgress)) : 0) * singleDuration;
    }
    if (props.showAtTime !== undefined) seekMs = props.showAtTime;
    return seekMs;
}


// -- Main public component --------------------------------------------------

/** The runtime props of {@link SvgAnimationPlayer} — named so the script-free sibling, `SvgCssAnimationPlayer`, can
 *  derive its own from them and be checked against them. @internal */
export const svgAnimationPlayerProps = {
    // -- Source
    doc: { type: Object as PropType<PxDocumentJson>, required: true },

    // -- Playback override: the file's timing and actions, adjusted (D4, playback-layers.md) — recursive
    //    partials merged over the file. The triggers travel with their driver, `playUsingActionTriggers`. Same names as React / RN.
    timelineOptions: { type: Object as PropType<PxTimelineOptions> },
    actions: { type: Object as PropType<PxActionsOptions> },

    // -- Declarative control
    playUsingActionTriggers: { type: [Boolean, Object] as PropType<boolean | PxActionTriggersInput>, default: undefined },   // true = the file's triggers; an object = the whole block instead
    playRun: { type: String as PropType<PxPlayRun>, default: undefined },   // the lever: the run's position, off · on · paused

    // -- Controlled time
    showAtProgress: { type: Number },
    showAtTime: { type: Number },

    // -- Diagnostics (API review §5).
    //    Function PROPS, not emits, on purpose: an emit handler always exists, so wiring
    //    these to `emit` would permanently suppress the console fallback for anyone who
    //    never listens. As props, "not given" really is undefined and the console still
    //    speaks by default — the same contract as React and React Native.
    onWarning: { type: Function as PropType<(diagnostic: PxDiagnostic) => void> },
    onError: { type: Function as PropType<(diagnostic: PxDiagnostic) => void> },
    //    `suppressWarnings` / `suppressErrors` switch the console fallback off — for a host that knows
    //    about the warnings and tolerates them; a handler you passed still fires.
    suppressWarnings: { type: Boolean, default: undefined },
    suppressErrors: { type: Boolean, default: undefined },
} as const;

/**
 * Vue component for rendering and controlling Pixodesk SVG animations.
 *
 * Supports four mutually-exclusive control modes (one at a time; a conflicting set warns, PX1501):
 *
 * 1. **Play on trigger** – the document's own triggers, or an object with the triggers to use instead.
 *    ```vue
 *    <SvgAnimationPlayer :doc="animation" playUsingActionTriggers />
 *    ```
 *
 * 2. **Declarative `playRun`** – the run's position, held by the host: `"off"` · `"on"` · `"paused"`.
 *    ```vue
 *    <SvgAnimationPlayer :doc="animation" :playRun="hovered ? 'on' : 'off'" />
 *    ```
 *
 * 3. **Imperative** – exposes a ref-based API for full programmatic control.
 *    ```vue
 *    <SvgAnimationPlayer :doc="animation" ref="player" />
 *    <button @click="$refs.player.startRun()">Start</button>
 *    ```
 *
 * 4. **Controlled time** – renders a single frame at a given time.
 *    ```vue
 *    <SvgAnimationPlayer :doc="animation" :showAtProgress="0.5" />
 *    <SvgAnimationPlayer :doc="animation" :showAtTime="500" />
 *    ```
 *
 * A script-free SVG + CSS export plays with the sibling `SvgCssAnimationPlayer`: the same prop names, fewer of them
 * (its props derive from {@link svgAnimationPlayerProps} and are checked against them).
 * @public
 */
const SvgAnimationPlayer = defineComponent({
    name: 'SvgAnimationPlayer',

    props: svgAnimationPlayerProps,

    emits: ['ready', 'runStart', 'runStop', 'runPause', 'runResume', 'finish', 'destroy'],

    setup(props, { expose, emit }) {
        // The `<svg>` this component rendered — handed to the player, which attaches its
        // triggers to it and writes animated values to the elements under it.
        let rootElement: Element | null = null;
        const apiRef = shallowRef<PxAnimationPlayerApi | null>(null);

        /**
         * The diagnostics channel, built from the CURRENT props each time (API review §5).
         * Not hoisted into a constant wrapper: `(m, d) => props.onWarning?.(m, d)` would always be
         * a function, so the channel would think a handler exists and the console fallback
         * would never fire for anyone who passed nothing.
         */
        const makeDiag = (): PxDiagnostics => createDiagnostics(
            { onWarning: props.onWarning, onError: props.onError, suppressWarnings: props.suppressWarnings, suppressErrors: props.suppressErrors },
            '[SvgAnimationPlayer]',
        );

        // -- Determine control mode ---------------------------------------------

        // ONE control-mode rule, decided in core (API review §1/§7). The template ref is not an
        // input: it is exposed in every mode and never changes which one is chosen.
        const resolvedMode = computed(() => resolveControlMode({
            showAtProgress: props.showAtProgress, showAtTime: props.showAtTime,
            playRun: props.playRun, playUsingActionTriggers: props.playUsingActionTriggers,
        }));
        const compMode = computed<PxControlMode>(() => resolvedMode.value.mode);

        // Warn where the mode is COMPUTED, not inside `applyDocOverrides` — that runs again on
        // every doc recompute and would repeat the same sentence.
        watch(resolvedMode, r => {
            const diag = makeDiag();
            for (const w of r.warnings) diag.warn(PxDiagnosticKind.usage, PxDiagnosticCode.controlPropsConflict, w);
        }, { immediate: true });

        // -- Prepare the document with overrides --------------------------------

        // A re-created `doc` with the same content keeps the animator (core `deepEquals`, as in React
        // and React Native); an in-place change to a reactive doc still recomputes — read through below.
        const docInput = shallowRef(props.doc);
        watch(() => props.doc, next => { if (!deepEquals(docInput.value, next)) docInput.value = next; });

        const resolvedDoc = computed(() => {
            // Overrides FIRST: they can change `timeline.engine` and `duration`, and
            // materialization reads both (the engine picks the stages, the duration sizes loop
            // expansion). Then render what the web player renders — materialized, fresh ids.
            // Rendering the raw document dropped every `effects` bucket, so a document painted
            // by `effects` alone came out as an empty canvas.
            const doc = applyDocOverrides(toPxDocument(docInput.value), props, compMode.value, makeDiag());
            // The checked stage repairs what does not match the schema and says what it repaired.
            return prepareDocumentForRender(doc, ps => reportDocumentProblems(ps, makeDiag()));
        });

        // -- Render the SVG node tree -------------------------------------------

        // The ONLY Vue-specific part of rendering: how to create a vnode. Every decision about the
        // document — tags, attribute names and values, sanitization, styles, text — is made by
        // core's `renderPxTree`, the same code the web player renders with. Vue writes an SVG
        // attribute name verbatim, so the names it is handed are used as they are.
        const createVNode: PxElementFactory<VNode> = ({ tag, attrs, style, children, text, node, isRoot, index }) => {
            const vnodeProps: Record<string, unknown> = { ...attrs, key: node.id ?? index };
            if (style) vnodeProps[VUE_PROP.style] = style;
            if (isRoot) vnodeProps[VUE_PROP.ref] = (el: Element | null) => { rootElement = el; };
            return h(tag, vnodeProps, children.length ? children : text);
        };

        // -- Animator lifecycle -------------------------------------------------

        function createApi() {
            destroyApi();
            const doc = resolvedDoc.value;
            if (!doc) return;

            // Route animator lifecycle events to Vue component events, INLINE under the same
            // names every surface uses (review §9). The run events are the PLAYER's executor's, told when
            // it performs the act — passed through, not re-derived.
            // No `adapter`: the web player's OWN writer drives the elements Vue rendered, found by
            // id under the root. A second writer here was a second place for rules to go missing.
            const options: PxInternalAnimationPlayerOptions = {
                doc,
                // The component resolved its control mode and patched `doc` above — the web player
                // must not add its own no-driver suppression on top (first-use review §1+2).
                playUsingActionTriggers: true,
                // Mounted (or `flush: 'post'`) by the time this runs, so the root exists.
                rootElement: rootElement ?? undefined,
                onReady:  () => emit('ready'),
                onRunStart:  () => emit('runStart'),
                onRunStop:   () => emit('runStop'),
                onRunPause:  () => emit('runPause'),
                onRunResume: () => emit('runResume'),
                onFinish: () => emit('finish'),
                onDestroy: () => emit('destroy'),
                // The player's own diagnostics reach the same handlers as the component's.
                onWarning:   props.onWarning,
                onError:  props.onError,
                suppressWarnings:  props.suppressWarnings,
                suppressErrors: props.suppressErrors,
            };
            apiRef.value = createSvgAnimationPlayer(options);

            // (Re)apply the declarative control state to the fresh animator —
            // covers both the initial mount (e.g. `:play="true"` from the
            // start) and doc swaps. The fresh instance has seen nothing: mount semantics.
            prevPlayback = null;
            syncPlayState();
            applySeek();
        }

        function destroyApi() {
            apiRef.value?.destroy();
            apiRef.value = null;
        }

        /** The last APPLIED declarative props — `null` until the fresh animator saw one apply. */
        let prevPlayback: PxDeclarativeProps | null = null;

        /** The run's geometry (§10): its world and its whole length. */
        function playbackGeometry() {
            const view = getAnimatorConfig(resolvedDoc.value) || {};
            const passMs = view.duration ?? PX_DEFAULT_DURATION_MS;
            const totalMs = view.iterations === 'infinite' ? Infinity
                : passMs * (typeof view.iterations === 'number' && view.iterations >= 1 ? view.iterations : 1);
            return { world: resolvePlaybackWorld(view.iterations), totalMs };
        }

        /** The `playRun` prop → animator calls — ONE shared rule (§10, `resolveDeclarativePlayback`
         *  in core, same as React and React Native): the lever's position — off · on · paused — and a change
         *  between two positions is one or two of the four buttons. HOW each step moves is the timeline's
         *  `actions`, performed by the executor behind the buttons. */
        function syncPlayState() {
            if (compMode.value !== PxControlMode.playRun) return;
            const api = apiRef.value;
            const { world, totalMs } = playbackGeometry();
            const position: PxDeclarativeProps = { playRun: props.playRun };
            const { actions } = resolveDeclarativePlayback({
                world,
                prev: prevPlayback ?? undefined,
                next: position,
            });
            prevPlayback = position;
            if (api) for (const action of actions) applyDeclarativeAction(api, action);
        }

        /** Controlled-time mode: seek through the animator API (no recreate). */
        function applySeek() {
            if (compMode.value !== PxControlMode.fixedTime) return;
            const doc = resolvedDoc.value;
            if (!doc) return;
            const seekMs = calcSeekMs(doc, props);
            if (seekMs !== undefined) {
                apiRef.value?.setCurrentTime(seekMs);
                apiRef.value?.pause();
            }
        }

        // Create the animator once DOM refs are available.
        onMounted(() => createApi());

        // Recreate the animator when the resolved doc changes.
        // `flush: 'post'` — the animator must be created AFTER the DOM is
        // patched, otherwise the new root element isn't in the document yet
        // and trigger setup fails (playUsingActionTriggers would never resume after a doc swap).
        watch(resolvedDoc, () => createApi(), { flush: 'post' });

        // Sync the declarative playback props with the animator.
        watch([compMode, () => props.playRun], () => syncPlayState());

        // Scrubbing progress/time only seeks — the animator is NOT recreated.
        watch([compMode, () => props.showAtProgress, () => props.showAtTime], () => applySeek());

        onUnmounted(() => {
            destroyApi();
        });

        // -- Expose imperative API ----------------------------------------------

        // The template ref is an ambient CAPABILITY, never a mode (§10) — but a WRITE call
        // landing while a declarative driver owns playback is the actual collision: warn
        // (PX1503) and apply; the next prop change reasserts the props.
        const guardWrite = (call: string): void => {
            if (compMode.value === PxControlMode.playRun || compMode.value === PxControlMode.fixedTime) {
                makeDiag().warn(PxDiagnosticKind.usage, PxDiagnosticCode.imperativeOverDeclarative, call);
            }
        };
        const publicApi: PxAnimationPlayerHandle = {
            isPlaying: () => apiRef.value?.isPlaying() || false,
            startRun: () => { guardWrite('startRun()'); apiRef.value?.startRun(); },
            stopRun: () => { guardWrite('stopRun()'); apiRef.value?.stopRun(); },
            pauseRun: () => { guardWrite('pauseRun()'); apiRef.value?.pauseRun(); },
            resumeRun: () => { guardWrite('resumeRun()'); apiRef.value?.resumeRun(); },
            play: () => { guardWrite('play()'); apiRef.value?.play(); },
            pause: () => { guardWrite('pause()'); apiRef.value?.pause(); },
            jumpToStart: () => { guardWrite('jumpToStart()'); apiRef.value?.jumpToStart(); },
            jumpToEnd: () => { guardWrite('jumpToEnd()'); apiRef.value?.jumpToEnd(); },
            runOnce: () => { guardWrite('runOnce()'); apiRef.value?.runOnce(); },
            getRunState: () => apiRef.value?.getRunState() ?? PxRunState.off,
            isRunActive: () => apiRef.value?.isRunActive() ?? false,
            getPlaybackSpeed: () => apiRef.value?.getPlaybackSpeed() ?? 1,
            setPlaybackSpeed: (speed: number) => {{ guardWrite('setPlaybackSpeed()'); apiRef.value?.setPlaybackSpeed(speed); }},
            getPlaybackDuration: () => apiRef.value?.getPlaybackDuration() ?? null,
            setPlaybackDuration: (ms: number) => {{ guardWrite('setPlaybackDuration()'); apiRef.value?.setPlaybackDuration(ms); }},
            getTotalPlaybackDuration: () => apiRef.value?.getTotalPlaybackDuration() ?? null,
            getCurrentPlaybackTime: () => apiRef.value?.getCurrentPlaybackTime() ?? null,
            getTotalPlaybackTime: () => apiRef.value?.getTotalPlaybackTime() ?? null,
            getDuration: () => apiRef.value?.getDuration() ?? null,
            getTotalDuration: () => apiRef.value?.getTotalDuration() ?? null,
            getTotalProgress: () => apiRef.value?.getTotalProgress() ?? null,
            getCurrentTime: () => apiRef.value?.getCurrentTime() ?? null,
            setCurrentTime: (time: number) => {{ guardWrite('setCurrentTime()'); apiRef.value?.setCurrentTime(time); }},
            getCurrentProgress: () => apiRef.value?.getCurrentProgress() ?? null,
            setCurrentProgress: (progress: number) => {{ guardWrite('setCurrentProgress()'); apiRef.value?.setCurrentProgress(progress); }},
            getCurrentIteration: () => apiRef.value?.getCurrentIteration() ?? 0,
            getTotalTime: () => apiRef.value?.getTotalTime() ?? null,
            setTotalTime: (time: number) => {{ guardWrite('setTotalTime()'); apiRef.value?.setTotalTime(time); }},
        };

        expose(publicApi);

        // -- Render -------------------------------------------------------------

        return () => {
            const doc = resolvedDoc.value;
            return renderPxTree(doc, createVNode, makeDiag());
        };
    },
});

export default SvgAnimationPlayer;
