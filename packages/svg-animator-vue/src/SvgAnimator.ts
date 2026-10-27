// @px-area entry
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { PxDocument, PxAnimationPlayerApi, PxTimelineEngineSetting, PxTimelinePatch, PxTrigger, PxPlaybackOverrideInput } from '@pixodesk/svg-animator-web';
import type { PxInternalAnimationPlayerOptions } from '@pixodesk/svg-animator-web/internal';
import { createSvgAnimationPlayer, PxDiagnosticKind, type PxDiagnostic, type PxDiagnostics } from '@pixodesk/svg-animator-web';
import { applyAnimatorConfig, toPxDocument, type PxDocumentInput, getAnimatorConfig, PxDiagnosticCode, PxPlayEndAction, type PxAnimationPlayerHandle } from '@pixodesk/svg-animator-core';
import { applyDeclarativeAction, applyPlaybackOverride, type PxDeclarativeProps, PxControlMode, PxPlaybackWorld, resolveControlMode, resolveDeclarativePlayback, resolvePlaybackWorld, controlModeTakesOverTrigger, progressToTimeMs, withoutTriggerDriver, type PxControlProps } from '@pixodesk/svg-animator-core/engine';
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
type DocOverrideProps = PxPlaybackOverrideInput & Pick<PxControlProps, 'playCurrentProgress' | 'playCurrentTime'>;

// @px-importance important
function applyDocOverrides(
    doc: PxDocument,
    props: DocOverrideProps,
    compMode: PxControlMode,
    diag: PxDiagnostics,
): PxDocument {

    // The override, applied ONCE through core's one rule (D3: per block, the replacement, then the
    // merge), and then the component's own need to take the trigger over in the non-playOnTrigger
    // control modes — the EMPTY trigger goes on AFTER the caller's override, so nothing re-arms it.
    const overridden = applyPlaybackOverride(doc, props);
    for (const w of overridden.warnings) diag.warn(PxDiagnosticKind.usage, PxDiagnosticCode.timelineOverrideIgnored, w);
    doc = overridden.doc;
    if (controlModeTakesOverTrigger(compMode)) doc = withoutTriggerDriver(doc);

    // §10 / D5: in the play tier's ONE-SHOT world the pose contract beats the file's rest poses — pin
    // both sides (the first frame before, the last frame after), so the held poses are the same on
    // every file (a `playEndAction: 'reset'` document would otherwise revert to its static attrs).
    if (compMode === PxControlMode.play
        && resolvePlaybackWorld((getAnimatorConfig(doc) || {}).iterations) === PxPlaybackWorld.oneShot) {
        doc = applyAnimatorConfig(doc, { timeline: { showFirstFrameBeforePlayOn: true, playEndAction: PxPlayEndAction.hold } }).doc;
    }

    return doc;
}

/**
 * Controlled-time mode: absolute seek target in ms. `playCurrentProgress` is a fraction
 * (0–1) of the WHOLE timeline (duration × iterations — ONE iteration when
 * endless); `playCurrentTime` is absolute. Applied through the player API
 * (setCurrentTime) so scrubbing does NOT recreate the player.
 */
function calcSeekMs(doc: PxDocument, props: DocOverrideProps): number | undefined {
    let seekMs: number | undefined;
    // The FLAT runtime view, so this works on a wire-format document too — reading
    // `doc.animator.duration` directly finds nothing there.
    const animator = getAnimatorConfig(doc) || {};
    if (props.playCurrentProgress !== undefined) {
        // ONE rule for progress → time (core's `progressToTimeMs`): the same mapping
        // `getCurrentProgress` reads back, so a prop of 0.5 and a read of 0.5 agree.
        const iterationsValue = animator.iterations;        // the override is already folded into the patched doc
        const iterationsCount = iterationsValue === 'infinite' ? Infinity
            : (typeof iterationsValue === 'number' && iterationsValue >= 1 ? iterationsValue : 1);
        // the window length — the shortcuts are already folded into the patched doc
        const singleDuration = animator.duration ?? PX_DEFAULT_DURATION_MS;
        seekMs = progressToTimeMs(props.playCurrentProgress, singleDuration, iterationsCount);
    }
    if (props.playCurrentTime !== undefined) seekMs = props.playCurrentTime;
    return seekMs;
}


// -- Main public component --------------------------------------------------

/**
 * Vue component for rendering and controlling Pixodesk SVG animations.
 *
 * Supports four mutually-exclusive control modes:
 *
 * 1. **Autoplay** – uses triggers from the animation document.
 *    ```vue
 *    <SvgAnimationPlayer :doc="animation" playOnTrigger />
 *    ```
 *
 * 2. **Declarative play/pause** – controlled via boolean props.
 *    ```vue
 *    <SvgAnimationPlayer :doc="animation" play :pause="false" />
 *    ```
 *
 * 3. **Imperative** – exposes a ref-based API for full programmatic control.
 *    ```vue
 *    <SvgAnimationPlayer :doc="animation" ref="player" />
 *    <button @click="$refs.player.play()">Play</button>
 *    ```
 *
 * 4. **Controlled time** – renders a single frame at a given time.
 *    ```vue
 *    <SvgAnimationPlayer :doc="animation" :playCurrentProgress="0.5" />
 *    <SvgAnimationPlayer :doc="animation" :playCurrentTime="500" />
 *    ```
 * @public
 */
const SvgAnimationPlayer = defineComponent({
    name: 'SvgAnimationPlayer',

    props: {
        // -- Source
        doc: { type: Object as PropType<PxDocumentInput>, required: true },

        // -- Playback override: the file's timing, adjusted (dev-docs/plans/component-api.md D4) — a merge
        //    patch, `null` deletes a key. The trigger travels with its driver, `playOnTrigger`. Same names as React / RN.
        timeline: { type: Object as PropType<PxTimelinePatch> },

        // -- Declarative control
        playOnTrigger: { type: [Boolean, Object] as PropType<boolean | PxTrigger>, default: undefined },   // true = the file's trigger; an object = the whole trigger instead
        play: { type: Boolean, default: undefined },
        pause: { type: Boolean, default: undefined },

        // -- Controlled time
        playCurrentProgress: { type: Number },
        playCurrentTime: { type: Number },

        // -- Diagnostics (API review §5).
        //    Function PROPS, not emits, on purpose: an emit handler always exists, so wiring
        //    these to `emit` would permanently suppress the console fallback for anyone who
        //    never listens. As props, "not given" really is undefined and the console still
        //    speaks by default — the same contract as React and React Native.
        onWarn: { type: Function as PropType<(diagnostic: PxDiagnostic) => void> },
        onError: { type: Function as PropType<(diagnostic: PxDiagnostic) => void> },
        //    `muteWarn` / `muteError` switch the console fallback off — for a host that knows
        //    about the warnings and tolerates them; a handler you passed still fires.
        muteWarn: { type: Boolean, default: undefined },
        muteError: { type: Boolean, default: undefined },
    },

    emits: ['ready', 'play', 'stop', 'pause', 'cancel', 'finish', 'destroy'],

    setup(props, { expose, emit }) {
        // The `<svg>` this component rendered — handed to the player, which attaches its
        // triggers to it and writes animated values to the elements under it.
        let rootElement: Element | null = null;
        const apiRef = shallowRef<PxAnimationPlayerApi | null>(null);

        /**
         * The diagnostics channel, built from the CURRENT props each time (API review §5).
         * Not hoisted into a constant wrapper: `(m, d) => props.onWarn?.(m, d)` would always be
         * a function, so the channel would think a handler exists and the console fallback
         * would never fire for anyone who passed nothing.
         */
        const makeDiag = (): PxDiagnostics => createDiagnostics(
            { onWarn: props.onWarn, onError: props.onError, muteWarn: props.muteWarn, muteError: props.muteError },
            '[SvgAnimationPlayer]',
        );

        // -- Determine control mode ---------------------------------------------

        // ONE control-mode rule, decided in core (API review §1/§7). The template ref is not an
        // input: it is exposed in every mode and never changes which one is chosen.
        const resolvedMode = computed(() => resolveControlMode({
            playCurrentProgress: props.playCurrentProgress, playCurrentTime: props.playCurrentTime,
            play: props.play, pause: props.pause, playOnTrigger: props.playOnTrigger,
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
            // names every surface uses (review §9). `stop` fires alongside any event that halts
            // playback — that is the PLAYER's rule, so `onStop` is passed through, not re-derived.
            // No `adapter`: the web player's OWN writer drives the elements Vue rendered, found by
            // id under the root. A second writer here was a second place for rules to go missing.
            const options: PxInternalAnimationPlayerOptions = {
                doc,
                // The component resolved its control mode and patched `doc` above — the web player
                // must not add its own no-driver suppression on top (first-use review §1+2).
                playOnTrigger: true,
                // Mounted (or `flush: 'post'`) by the time this runs, so the root exists.
                rootElement: rootElement ?? undefined,
                onReady:  () => emit('ready'),
                onPlay:   () => emit('play'),
                onPause:  () => emit('pause'),
                onCancel: () => emit('cancel'),
                onFinish: () => emit('finish'),
                onDestroy: () => emit('destroy'),
                onStop:   () => emit('stop'),
                // The player's own diagnostics reach the same handlers as the component's.
                onWarn:   props.onWarn,
                onError:  props.onError,
                muteWarn:  props.muteWarn,
                muteError: props.muteError,
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

        /** Declarative props → animator calls — ONE shared rule (§10, `resolveDeclarativePlayback`
         *  in core, same as React and React Native): `play` is a pose switch on a one-shot
         *  document and a run switch on a looping one; `pause` freezes the clock. HOW each step
         *  moves is the timeline's play keys (D5), performed by the executor behind `play()` / `stop()`. */
        function syncPlayState() {
            if (compMode.value !== PxControlMode.play) return;
            const api = apiRef.value;
            const { world, totalMs } = playbackGeometry();
            const { actions, warnings } = resolveDeclarativePlayback({
                world,
                prev: prevPlayback ?? undefined,
                next: { play: props.play, pause: props.pause },
            });
            prevPlayback = { play: props.play, pause: props.pause };
            if (warnings.length) {
                const diag = makeDiag();
                for (const w of warnings) diag.warn(PxDiagnosticKind.usage, PxDiagnosticCode.playModifierIgnored, w);
            }
            if (api) for (const action of actions) applyDeclarativeAction(api, action, totalMs);
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
        // and trigger setup fails (playOnTrigger would never resume after a doc swap).
        watch(resolvedDoc, () => createApi(), { flush: 'post' });

        // Sync declarative play/pause props with the animator.
        watch([compMode, () => props.play, () => props.pause], () => syncPlayState());

        // Scrubbing progress/time only seeks — the animator is NOT recreated.
        watch([compMode, () => props.playCurrentProgress, () => props.playCurrentTime], () => applySeek());

        onUnmounted(() => {
            destroyApi();
        });

        // -- Expose imperative API ----------------------------------------------

        // The template ref is an ambient CAPABILITY, never a mode (§10) — but a WRITE call
        // landing while a declarative driver owns playback is the actual collision: warn
        // (PX1503) and apply; the next prop change reasserts the props.
        const guardWrite = (call: string): void => {
            if (compMode.value === PxControlMode.play || compMode.value === PxControlMode.fixedTime) {
                makeDiag().warn(PxDiagnosticKind.usage, PxDiagnosticCode.imperativeOverDeclarative, call);
            }
        };
        const publicApi: PxAnimationPlayerHandle = {
            isPlaying: () => apiRef.value?.isPlaying() || false,
            play: () => { guardWrite('play()'); apiRef.value?.play(); },
            pause: () => { guardWrite('pause()'); apiRef.value?.pause(); },
            stop: () => { guardWrite('stop()'); apiRef.value?.stop(); },
            cancel: () => { guardWrite('cancel()'); apiRef.value?.cancel(); },
            finish: () => { guardWrite('finish()'); apiRef.value?.finish(); },
            playOnce: () => { guardWrite('playOnce()'); apiRef.value?.playOnce(); },
            setPlaybackRate: (rate: number) => { guardWrite('setPlaybackRate()'); apiRef.value?.setPlaybackRate(rate); },
            getDuration: () => apiRef.value?.getDuration() ?? null,
            getCurrentTime: () => apiRef.value?.getCurrentTime() ?? null,
            setCurrentTime: (time: number) => { guardWrite('setCurrentTime()'); apiRef.value?.setCurrentTime(time); },
            getCurrentProgress: () => apiRef.value?.getCurrentProgress() ?? null,
            setCurrentProgress: (progress: number) => { guardWrite('setCurrentProgress()'); apiRef.value?.setCurrentProgress(progress); },
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
