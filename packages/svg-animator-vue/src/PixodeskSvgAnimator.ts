/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { PxAnimatedSvgDocument, PxAnimatorApi, PxTimelineEngineSetting, PxTimelinePatch, PxTrigger } from '@pixodesk/svg-animator-web';
import type { PxInternalAnimatorOptions } from '@pixodesk/svg-animator-web/internal';
import { createAnimator, PxDiagnosticKind, type PxPlaybackOverride, type PxDiagnostic, type PxDiagnostics } from '@pixodesk/svg-animator-web';
import { applyAnimatorConfig, foldTimelineOverride, getAnimatorConfig, PxDiagnosticCode, PxControlMode, resolveControlMode, controlModeTakesOverTrigger, progressToTimeMs, type PxAnimatorHandle, type PxControlProps } from '@pixodesk/svg-animator-core';
import { createDiagnostics, PX_DEFAULT_DURATION_MS, prepareDocumentForRender, renderPxTree, type PxElementFactory } from '@pixodesk/svg-animator-core/internal';
import {
    computed, defineComponent, h, onMounted, onUnmounted, ref, shallowRef, type PropType, type VNode,
    watch,
} from 'vue';


// -- Public types -----------------------------------------------------------

/** Vue's own prop names on the vnode — not wire keys. See the React twin. */
const VUE_PROP = { ref: 'ref', style: 'style' } as const;

/**
 * The imperative handle the template ref exposes — core's `PxAnimatorHandle` under this
 * package's name (review §9). One definition for React, Vue and React Native.
 * @public
 */
export type VueAnimatorApi = PxAnimatorHandle;


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
type DocOverrideProps = PxPlaybackOverride & Pick<PxControlProps, 'progress' | 'time'>;

function applyDocOverrides(
    doc: PxAnimatedSvgDocument,
    props: DocOverrideProps,
    compMode: PxControlMode,
    diag: PxDiagnostics,
): PxAnimatedSvgDocument {

    // ONE patch, applied ONCE: the props, plus the component's own need to take the trigger
    // over in the non-autoplay control modes.
    //
    // This replaces three hand-rolled spread blocks that wrote the FLAT runtime keys. On a
    // wire-format document — which is what every writer emits — `flattenAnimatorTimeline`
    // overwrote them from `timeline` immediately afterwards, so the overrides were silently
    // discarded. See dev-docs/plans/playback-override.md §1.1.
    const { timeline, resetTimeline, duration, delay, iterations, start } = props;
    const patch = foldTimelineOverride(timeline, { duration, delay, iterations, start });
    const fullPatch: any = controlModeTakesOverTrigger(compMode)
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
        for (const w of applied.warnings) diag.warn(PxDiagnosticKind.usage, PxDiagnosticCode.timelineOverrideIgnored, w);
        doc = applied.doc;
    }

    return doc;
}

/**
 * Controlled-time mode: absolute seek target in ms. `progress` is a fraction
 * (0–1) of the WHOLE timeline (duration × iterations — ONE iteration when
 * endless); `time` is absolute. Applied through the animator API
 * (setCurrentTime) so scrubbing does NOT recreate the animator.
 */
function calcSeekMs(doc: PxAnimatedSvgDocument, props: DocOverrideProps): number | undefined {
    let seekMs: number | undefined;
    // The FLAT runtime view, so this works on a wire-format document too — reading
    // `doc.animator.duration` directly finds nothing there.
    const animator = getAnimatorConfig(doc) || {};
    if (props.progress !== undefined) {
        // ONE rule for progress → time (core's `progressToTimeMs`): the same mapping
        // `getCurrentProgress` reads back, so a prop of 0.5 and a read of 0.5 agree.
        const iterationsValue = props.iterations ?? animator.iterations;
        const iterationsCount = iterationsValue === 'infinite' ? Infinity
            : (typeof iterationsValue === 'number' && iterationsValue >= 1 ? iterationsValue : 1);
        const singleDuration = props.duration ?? animator.duration ?? PX_DEFAULT_DURATION_MS;
        seekMs = progressToTimeMs(props.progress, singleDuration, iterationsCount);
    }
    if (props.time !== undefined) seekMs = props.time;
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
 *    <PixodeskSvgAnimator :doc="animation" autoplay />
 *    ```
 *
 * 2. **Declarative play/pause** – controlled via boolean props.
 *    ```vue
 *    <PixodeskSvgAnimator :doc="animation" play :pause="false" />
 *    ```
 *
 * 3. **Imperative** – exposes a ref-based API for full programmatic control.
 *    ```vue
 *    <PixodeskSvgAnimator :doc="animation" ref="animator" />
 *    <button @click="$refs.animator.play()">Play</button>
 *    ```
 *
 * 4. **Controlled time** – renders a single frame at a given time.
 *    ```vue
 *    <PixodeskSvgAnimator :doc="animation" :progress="0.5" />
 *    <PixodeskSvgAnimator :doc="animation" :time="500" />
 *    ```
 * @public
 */
const PixodeskSvgAnimator = defineComponent({
    name: 'PixodeskSvgAnimator',

    props: {
        // -- Source
        doc: { type: Object as PropType<PxAnimatedSvgDocument>, required: true },

        // -- Playback override: the document's `timeline` block as a patch (or a JSON string),
        //    plus the four shortcuts people reach for most. The same names as React / RN.
        timeline: { type: [Object, String] as PropType<PxTimelinePatch | string> },
        resetTimeline: { type: Boolean, default: undefined },
        duration: { type: Number },
        delay: { type: Number },
        iterations: { type: [Number, String] as PropType<number | 'infinite'> },
        start: { type: String as PropType<'load' | 'mouseOver' | 'click' | 'none'> },

        // -- Declarative control
        autoplay: { type: Boolean, default: undefined },
        play: { type: Boolean, default: undefined },
        pause: { type: Boolean, default: undefined },

        // -- Controlled time
        progress: { type: Number },
        time: { type: Number },

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

    emits: ['play', 'stop', 'pause', 'cancel', 'finish', 'remove'],

    setup(props, { expose, emit }) {
        // The `<svg>` this component rendered — handed to the player, which attaches its
        // triggers to it and writes animated values to the elements under it.
        let rootElement: Element | null = null;
        const apiRef = shallowRef<PxAnimatorApi | null>(null);

        /**
         * The diagnostics channel, built from the CURRENT props each time (API review §5).
         * Not hoisted into a constant wrapper: `(m, d) => props.onWarn?.(m, d)` would always be
         * a function, so the channel would think a handler exists and the console fallback
         * would never fire for anyone who passed nothing.
         */
        const makeDiag = (): PxDiagnostics => createDiagnostics(
            { onWarn: props.onWarn, onError: props.onError, muteWarn: props.muteWarn, muteError: props.muteError },
            '[PixodeskSvgAnimator]',
        );

        // -- Determine control mode ---------------------------------------------

        // ONE control-mode rule, decided in core (API review §1/§7). The template ref is not an
        // input: it is exposed in every mode and never changes which one is chosen.
        const resolvedMode = computed(() => resolveControlMode({
            progress: props.progress, time: props.time,
            play: props.play, pause: props.pause, autoplay: props.autoplay,
        }));
        const compMode = computed<PxControlMode>(() => resolvedMode.value.mode);

        // Warn where the mode is COMPUTED, not inside `applyDocOverrides` — that runs again on
        // every doc recompute and would repeat the same sentence.
        watch(resolvedMode, r => {
            const diag = makeDiag();
            for (const w of r.warnings) diag.warn(PxDiagnosticKind.usage, PxDiagnosticCode.controlPropsConflict, w);
        }, { immediate: true });

        // -- Prepare the document with overrides --------------------------------

        const resolvedDoc = computed(() => {
            // Overrides FIRST: they can change `timeline.engine` and `duration`, and
            // materialization reads both (the engine picks the stages, the duration sizes loop
            // expansion). Then render what the web player renders — materialized, fresh ids.
            // Rendering the raw document dropped every `effects` bucket, so a document painted
            // by `effects` alone came out as an empty canvas.
            const doc = applyDocOverrides(props.doc, props, compMode.value, makeDiag());
            return prepareDocumentForRender(doc);
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
            const options: PxInternalAnimatorOptions = {
                doc,
                // Mounted (or `flush: 'post'`) by the time this runs, so the root exists.
                rootElement: rootElement ?? undefined,
                onPlay:   () => emit('play'),
                onPause:  () => emit('pause'),
                onCancel: () => emit('cancel'),
                onFinish: () => emit('finish'),
                onRemove: () => emit('remove'),
                onStop:   () => emit('stop'),
                // The player's own diagnostics reach the same handlers as the component's.
                onWarn:   props.onWarn,
                onError:  props.onError,
                muteWarn:  props.muteWarn,
                muteError: props.muteError,
            };
            apiRef.value = createAnimator(options);

            // (Re)apply the declarative control state to the fresh animator —
            // covers both the initial mount (e.g. `:play="true"` from the
            // start) and doc swaps.
            syncPlayState();
            applySeek();
        }

        function destroyApi() {
            apiRef.value?.destroy();
            apiRef.value = null;
        }

        /** Declarative play/pause → animator calls. */
        function syncPlayState() {
            if (compMode.value !== PxControlMode.play) return;
            if (props.play && !props.pause) {
                apiRef.value?.play();
            } else if (props.pause) {
                apiRef.value?.pause();
            } else if (props.play === false) {
                // explicit play=false → hold where it is (review §8). This used to `finish()`;
                // a boolean whose `false` means "jump to the end" is not what anyone guesses.
                apiRef.value?.pause();
            } else {
                // pause-only usage: pause switched off → resume
                apiRef.value?.play();
            }
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
        // and trigger setup fails (autoplay would never resume after a doc swap).
        watch(resolvedDoc, () => createApi(), { flush: 'post' });

        // Sync declarative play/pause props with the animator.
        watch([compMode, () => props.play, () => props.pause], () => syncPlayState());

        // Scrubbing progress/time only seeks — the animator is NOT recreated.
        watch([compMode, () => props.progress, () => props.time], () => applySeek());

        onUnmounted(() => {
            destroyApi();
        });

        // -- Expose imperative API ----------------------------------------------

        const publicApi: VueAnimatorApi = {
            isPlaying: () => apiRef.value?.isPlaying() || false,
            play: () => apiRef.value?.play(),
            pause: () => apiRef.value?.pause(),
            cancel: () => apiRef.value?.cancel(),
            finish: () => apiRef.value?.finish(),
            setPlaybackRate: (rate: number) => apiRef.value?.setPlaybackRate(rate),
            getCurrentTime: () => apiRef.value?.getCurrentTime() ?? null,
            setCurrentTime: (time: number) => apiRef.value?.setCurrentTime(time),
            getCurrentProgress: () => apiRef.value?.getCurrentProgress() ?? null,
            setCurrentProgress: (progress: number) => apiRef.value?.setCurrentProgress(progress),
        };

        expose(publicApi);

        // -- Render -------------------------------------------------------------

        return () => {
            const doc = resolvedDoc.value;
            return renderPxTree(doc, createVNode, makeDiag());
        };
    },
});

export default PixodeskSvgAnimator;
