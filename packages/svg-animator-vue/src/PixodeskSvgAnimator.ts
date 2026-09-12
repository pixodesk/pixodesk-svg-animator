/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { PxAnimatedSvgDocument, PxAnimatorAPI, PxAnimatorConfigPatch, PxNode, PxPlatformAdapter, PxTimelineEngineExtra, PxTrigger } from '@pixodesk/svg-animator-web';
import { camelCaseToKebabWordIfNeeded, createAnimator, createDiagnostics, generateNewIds, getNormalizedProps, STYLE_ATTR_NAMES, applyAnimatorConfig, foldAnimatorConfigShortcuts, getAnimatorConfig, PxControlMode, resolveControlMode, controlModeTakesOverTrigger, PxDiagnosticKind, type PxDiagnostic, type PxDiagnostics } from '@pixodesk/svg-animator-web';
import {
    computed, defineComponent, h, onMounted, onUnmounted, ref, shallowRef, type PropType, type VNode,
    watch,
} from 'vue';


// -- Public types -----------------------------------------------------------

/** Vue's own prop names on the vnode — not wire keys. See the React twin. */
const VUE_PROP = { ref: 'ref' } as const;

export interface VueAnimatorApi {
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


// -- Internal types ---------------------------------------------------------

// The control mode is core's `PxControlMode`, shared with React and React Native
// (API review §1/§7) — one precedence rule, one set of conflict warnings.


// -- Vue ↔ Animator bridge --------------------------------------------------

/**
 * Creates a platform adapter that routes animator attribute updates
 * to the corresponding Vue-managed DOM element refs.
 */
function createVueAdapter(elementRefs: Map<string, Element>, diag: PxDiagnostics) {
    const warnedSelectors = new Set<string>();

    const adapter: PxPlatformAdapter = {
        isConnected: () => true,
        setAttribute: (id, attrName, value) => {
            attrName = camelCaseToKebabWordIfNeeded(attrName);

            const element = elementRefs.get(id);

            if (!element && !warnedSelectors.has(id)) {
                warnedSelectors.add(id);
                diag.warn(PxDiagnosticKind.host, 'setAttribute: No elements found for id "' + id + '"');
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

// FIXME: add model validation (e.g. isElementFileJson check)


// -- Helper: apply doc overrides --------------------------------------------

interface DocOverrideProps {
    /** Per-instance override of the document's `animator` config — the same shape as
     *  `animator` in SCHEMA.md, deep-merged; `null` at a slot deletes it. Also accepts a
     *  JSON string. Replaces the former flat mode/fill/direction/frameRate/outAction props. */
    config?: PxAnimatorConfigPatch | string;
    /** Start from the player's defaults instead of the document's playback settings. */
    resetDocDefaults?: boolean;
    duration?: number;
    delay?: number;
    iterations?: number | 'infinite';
    startOn?: 'load' | 'mouseOver' | 'click' | 'scrollIntoView' | 'programmatic';
    progress?: number;
    time?: number;
}

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
    // discarded. See PLAYBACK-OVERRIDE-PLAN.md §1.1.
    const { config, resetDocDefaults, duration, delay, iterations, startOn } = props;
    const patch = foldAnimatorConfigShortcuts(config, { duration, delay, iterations, startOn });
    const fullPatch: any = controlModeTakesOverTrigger(compMode)
        ? {
            ...(patch ?? {}),
            timeline: {
                ...((patch as any)?.timeline ?? {}),
                trigger: { ...((patch as any)?.timeline?.trigger ?? {}), startOn: 'programmatic' },
            },
        }
        : patch;

    if (fullPatch !== undefined || resetDocDefaults) {
        const applied = applyAnimatorConfig(doc, fullPatch ?? {}, { resetDefaults: !!resetDocDefaults });
        for (const w of applied.warnings) diag.warn(PxDiagnosticKind.usage, 'config override: ' + w);
        doc = applied.doc;
    }

    return doc;
}

/**
 * Controlled-time mode: absolute seek target in ms. `progress` is a fraction
 * (0–1) of the WHOLE timeline (duration × iterations); `time` is absolute.
 * Applied through the animator API (setCurrentTime) so scrubbing does NOT
 * recreate the animator.
 */
function calcSeekMs(doc: PxAnimatedSvgDocument, props: DocOverrideProps): number | undefined {
    let seekMs: number | undefined;
    // The FLAT runtime view, so this works on a wire-format document too — reading
    // `doc.animator.duration` directly finds nothing there.
    const animator = getAnimatorConfig(doc) || {};
    if (props.progress !== undefined) {
        const iterationsValue = props.iterations ?? animator.iterations;
        const iterationsCount = typeof iterationsValue === 'number' && iterationsValue >= 1 ? iterationsValue : 1;
        const singleDuration = props.duration ?? animator.duration ?? 1000; // engine default duration
        seekMs = props.progress * singleDuration * iterationsCount;
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
 */
const PixodeskSvgAnimator = defineComponent({
    name: 'PixodeskSvgAnimator',

    props: {
        // -- Source
        doc: { type: Object as PropType<PxAnimatedSvgDocument>, required: true },

        // -- Playback override: one object spelled exactly like `animator` in the file,
        //    plus the four shortcuts people reach for most.
        config: { type: [Object, String] as PropType<PxAnimatorConfigPatch | string> },
        resetDocDefaults: { type: Boolean, default: undefined },
        duration: { type: Number },
        delay: { type: Number },
        iterations: { type: [Number, String] as PropType<number | 'infinite'> },
        startOn: { type: String as PropType<'load' | 'mouseOver' | 'click' | 'scrollIntoView' | 'programmatic'> },

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
        //    `silent` takes `true` or just the kinds to quiet, so `platform` chatter can be
        //    silenced while `document` problems still speak.
        silent: { type: [Boolean, Array] as PropType<boolean | ReadonlyArray<PxDiagnosticKind>>, default: undefined },
    },

    emits: ['play', 'stop', 'pause', 'cancel', 'finish', 'remove'],

    setup(props, { expose, emit }) {
        const elementRefs = new Map<string, Element>();
        const apiRef = shallowRef<PxAnimatorAPI | null>(null);

        /**
         * The diagnostics channel, built from the CURRENT props each time (API review §5).
         * Not hoisted into a constant wrapper: `(m, d) => props.onWarn?.(m, d)` would always be
         * a function, so the channel would think a handler exists and the console fallback
         * would never fire for anyone who passed nothing.
         */
        const makeDiag = (): PxDiagnostics => createDiagnostics(
            { onWarn: props.onWarn, onError: props.onError, silent: props.silent },
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
            for (const w of r.warnings) diag.warn(PxDiagnosticKind.usage, w);
        }, { immediate: true });

        // -- Prepare the document with overrides --------------------------------

        const resolvedDoc = computed(() => {
            let doc = generateNewIds(props.doc);
            return applyDocOverrides(doc, props, compMode.value, makeDiag());
        });

        // -- Render the SVG node tree -------------------------------------------

        function renderNode(node: PxNode | undefined): VNode | null {
            if (!node) return null;

            const { type, animate, meta, children, ...attrs } = node;
            const normProps = getNormalizedProps(attrs);

            // Capture a ref to each element with an id.
            if (node.id) {
                const nodeId = node.id;
                normProps[VUE_PROP.ref] = (el: Element | null) => {
                    if (el) {
                        elementRefs.set(nodeId, el);
                    } else {
                        elementRefs.delete(nodeId);
                    }
                };
            }

            const childVNodes = children?.map(child => renderNode(child)).filter(Boolean) as VNode[] | undefined;
            // Text content: a node's own `textContent` renders only when it has no child nodes — a
            // line <tspan> can carry both, and then its children are the styled spans (the React
            // Native renderer's rule). `getNormalizedProps` strips `textContent` from the attributes.
            const text = typeof node.textContent === 'string' ? node.textContent : undefined;
            return h(type, normProps, childVNodes?.length ? childVNodes : text);
        }

        // -- Animator lifecycle -------------------------------------------------

        function createApi() {
            destroyApi();
            const doc = resolvedDoc.value;
            if (!doc) return;

            // Route animator lifecycle events to Vue component events.
            // `stop` fires alongside any event that halts playback.
            const callbacks = {
                onPlay:   () => emit('play'),
                onPause:  () => { emit('pause');  emit('stop'); },
                onCancel: () => { emit('cancel'); emit('stop'); },
                onFinish: () => { emit('finish'); emit('stop'); },
                onRemove: () => { emit('remove'); emit('stop'); },
                // The player's own diagnostics reach the same handlers as the component's.
                onWarn: props.onWarn,
                onError: props.onError,
                silent: props.silent,
            };

            apiRef.value = createAnimator({ data: doc, adapter: createVueAdapter(elementRefs, makeDiag()), callbacks });

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
                // explicit play=false → jump to the end state
                apiRef.value?.finish();
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
            return doc ? renderNode(doc) : null;
        };
    },
});

export default PixodeskSvgAnimator;
