// @px-area entry
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { PxDocument, PxAnimationPlayerApi, PxTimelineEngineSetting, PxTimelineOptions, PxActionsInput, PxActionTriggersInput, PxPlaybackOverrideInput } from '@pixodesk/svg-animator-web';
import type { PxInternalAnimationPlayerOptions } from '@pixodesk/svg-animator-web/internal';
import { createSvgAnimationPlayer, PxDiagnosticKind, type PxDiagnostic, type PxDiagnostics } from '@pixodesk/svg-animator-web';
import { applyAnimatorConfig, toPxDocument, type PxDocumentJson, getAnimatorConfig, PxDiagnosticCode, PxWhenFinished, PxPlaybackState, PxWhenIdle, type PxAnimationPlayerHandle, type PxPlayback, type PxVariablesApi, type PxVariableValue } from '@pixodesk/svg-animator-core';
import { applyDeclarativeAction, applyPlaybackOverride, applyVariablesProp, forwardPlaybackControls, type PxDeclarativeProps, PxControlMode, PxPlaybackWorld, PxVariablesRuntime, resolveControlMode, resolveDeclarativePlayback, resolvePlaybackWorld, controlModeTakesOverTrigger, withoutTriggerDriver, type PxControlProps } from '@pixodesk/svg-animator-core/engine';
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
 * What `applyDocOverrides` / `showFixedFrame` read off the props — core's shared shapes, not a local
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

    // The override, applied ONCE through core's one rule (D4: the timing merged, the `actions` and `actionTriggers`
    // blocks replacing the file's), and then the component's own need to take the triggers over in every control
    // mode but `actionTriggers` — the EMPTY block goes on AFTER the caller's override, so nothing re-arms it.
    const overridden = applyPlaybackOverride(doc, props);
    for (const w of overridden.warnings) diag.warn(PxDiagnosticKind.usage, PxDiagnosticCode.timelineOverrideIgnored, w);
    doc = overridden.doc;
    if (controlModeTakesOverTrigger(compMode)) doc = withoutTriggerDriver(doc);

    // §10 / D5: in the play tier's ONE-SHOT world the pose contract beats the file's rest poses — pin
    // both sides (the first frame before, the last frame after), so the held poses are the same on
    // every file (a `finish: jumpToStart` document would otherwise revert to its static attrs).
    if (compMode === PxControlMode.playback
        && resolvePlaybackWorld((getAnimatorConfig(doc) || {}).iterations) === PxPlaybackWorld.oneShot) {
        doc = applyAnimatorConfig(doc, { timeline: { whenIdle: PxWhenIdle.firstFrame, whenFinished: PxWhenFinished.hold } }).doc;
    }

    return doc;
}

/**
 * Controlled-time mode: shows the frame — `showAtTime` is ms inside the iteration (the handle's `getCurrentTime` axis),
 * `showAtProgress` counts iterations in play order (`getCurrentProgress`, 1.26). Through the player API, so scrubbing
 * does NOT recreate the player; the seek rule holds the frame (paused there).
 */
function showFixedFrame(playback: PxAnimationPlayerHandle['playback'], props: DocOverrideProps): void {
    if (props.showAtTime !== undefined) playback.setCurrentTime(props.showAtTime);
    else if (props.showAtProgress !== undefined) playback.setCurrentProgress(props.showAtProgress);
}


// -- Main public component --------------------------------------------------

/** The runtime props of {@link SvgAnimationPlayer} — named so the script-free sibling, `SvgCssAnimationPlayer`, can
 *  derive its own from them and be checked against them. @internal */
export const svgAnimationPlayerProps = {
    // -- Source
    /** The animation document — the same name as the web player's option (1.26; `doc` before). */
    document: { type: Object as PropType<PxDocumentJson>, required: true },

    // -- Playback override (D4, playback-layers.md): `timelineOptions` merged over the file's timing, `actions` replacing
    //    its actions block. The triggers travel with the control props, `actionTriggers`. Same names as React / RN.
    timelineOptions: { type: Object as PropType<PxTimelineOptions> },
    actions: { type: Object as PropType<PxActionsInput> },

    // -- Control — one at a time; none: the file's own triggers drive it
    showAsStatic: { type: Boolean, default: undefined },   // the picture as drawn; playback calls ignored
    disableActionTriggers: { type: Boolean, default: undefined },   // manual: no triggers, code presses the buttons
    actionTriggers: { type: Object as PropType<PxActionTriggersInput | null>, default: undefined },   // the whole block instead of the file's; null = none
    playback: { type: String as PropType<PxPlayback>, default: undefined },   // the lever: the playback's position, off · on · paused

    // -- Variables (docs/library/variables.md): values from the host, a variant, CSS delivery. Same names as React / RN.
    variables: { type: Object as PropType<Readonly<Record<string, PxVariableValue>>> },
    variant: { type: String as PropType<string | null>, default: undefined },
    cssVariables: { type: [Boolean, Object] as PropType<boolean | Readonly<Record<string, string>>>, default: undefined },

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
 * Supports mutually-exclusive control modes (one at a time; a conflicting set warns, PX1501):
 *
 * 1. **As the file says** (no control prop) – the document's own triggers, or `actionTriggers` to use instead.
 *    ```vue
 *    <SvgAnimationPlayer :document="animation" />
 *    <SvgAnimationPlayer :document="animation" :actionTriggers="{ 'playback.start': 'click' }" />
 *    ```
 *
 * 2. **Declarative `playback`** – the playback's position, held by the host: `"off"` · `"on"` · `"paused"`.
 *    ```vue
 *    <SvgAnimationPlayer :document="animation" :playback="hovered ? 'on' : 'off'" />
 *    ```
 *
 * 3. **Manual** – no triggers; a ref-based API for full programmatic control.
 *    ```vue
 *    <SvgAnimationPlayer :document="animation" disableActionTriggers ref="player" />
 *    <button @click="$refs.player.playback.start()">Start</button>
 *    ```
 *
 * 4. **Controlled time** – renders a single frame at a given time.
 *    ```vue
 *    <SvgAnimationPlayer :document="animation" :showAtProgress="0.5" />
 *    <SvgAnimationPlayer :document="animation" :showAtTime="500" />
 *    ```
 *
 * 5. **Static** – the picture as drawn; nothing plays, and playback calls are ignored with a warning.
 *    ```vue
 *    <SvgAnimationPlayer :document="animation" showAsStatic />
 *    ```
 *
 * A script-free SVG + CSS export plays with the sibling `SvgCssAnimationPlayer`: the same prop names, fewer of them
 * (its props derive from {@link svgAnimationPlayerProps} and are checked against them).
 * @public
 */
const SvgAnimationPlayer = defineComponent({
    name: 'SvgAnimationPlayer',

    props: svgAnimationPlayerProps,

    emits: ['ready', 'playbackStart', 'playbackStop', 'playbackPause', 'playbackResume', 'playbackFinish', 'destroy'],

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
            showAsStatic: props.showAsStatic, showAtProgress: props.showAtProgress, showAtTime: props.showAtTime,
            playback: props.playback, disableActionTriggers: props.disableActionTriggers, actionTriggers: props.actionTriggers,
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
        const docInput = shallowRef(props.document);
        watch(() => props.document, next => { if (!deepEquals(docInput.value, next)) docInput.value = next; });

        // Overrides FIRST: they can change `timeline.engine` and `duration`, and materialization reads both (the engine
        // picks the stages, the duration sizes loop expansion).
        const baseDoc = computed(() => applyDocOverrides(toPxDocument(docInput.value), props, compMode.value, makeDiag()));

        // The variables (§4): created with the document — in a watcher, so the values are read once and not tracked:
        // a later value goes to the runtime and the player draws it on its next frame, the tree is not rendered again.
        const runtime = shallowRef<PxVariablesRuntime>(new PxVariablesRuntime(baseDoc.value, { variables: props.variables, variant: props.variant, cssVariables: props.cssVariables }, makeDiag()));
        let appliedVariables: Readonly<Record<string, PxVariableValue>> = props.variables ?? {};
        watch([baseDoc, () => JSON.stringify(props.cssVariables ?? null)], ([doc]) => {
            runtime.value = new PxVariablesRuntime(doc, { variables: props.variables, variant: props.variant, cssVariables: props.cssVariables }, makeDiag());
            appliedVariables = props.variables ?? {};
        });
        watch(() => props.variables, next => {
            applyVariablesProp(runtime.value.api, appliedVariables, next);
            appliedVariables = next ?? {};
        }, { deep: true });
        watch(() => props.variant, next => runtime.value.api.setVariant(next ?? null));

        // Render what the web player renders — materialized, fresh ids. Rendering the raw document dropped every
        // `effects` bucket, so a document painted by `effects` alone came out as an empty canvas.
        // The checked stage repairs what does not match the schema and says what it repaired.
        const resolvedDoc = computed(() =>
            prepareDocumentForRender(runtime.value.resolvedDocument(true), ps => reportDocumentProblems(ps, makeDiag())));

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
            // names every surface uses (review §9). The playback events are the PLAYER's executor's, told when
            // it performs the act — passed through, not re-derived.
            // No `adapter`: the web player's OWN writer drives the elements Vue rendered, found by
            // id under the root. A second writer here was a second place for rules to go missing.
            const options: PxInternalAnimationPlayerOptions = {
                document: doc,
                // The component resolved its control mode and patched the document above, so the web player gets no
                // trigger option (the document's own, already patched, decide) — only `showAsStatic`, whose guard
                // (no scroll, every playback call ignored) lives in the player.
                showAsStatic: compMode.value === PxControlMode.static,
                // the variables the document was resolved with: the player draws their changes
                variablesRuntime: runtime.value,
                // Mounted (or `flush: 'post'`) by the time this runs, so the root exists.
                rootElement: rootElement ?? undefined,
                onReady:  () => emit('ready'),
                onPlaybackStart:  () => emit('playbackStart'),
                onPlaybackStop:   () => emit('playbackStop'),
                onPlaybackPause:  () => emit('playbackPause'),
                onPlaybackResume: () => emit('playbackResume'),
                onPlaybackFinish: () => emit('playbackFinish'),
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

        /** The playback's geometry (§10): its world and its whole length. */
        function playbackGeometry() {
            const view = getAnimatorConfig(resolvedDoc.value) || {};
            const passMs = view.duration ?? PX_DEFAULT_DURATION_MS;
            const totalMs = view.iterations === 'infinite' ? Infinity
                : passMs * (typeof view.iterations === 'number' && view.iterations >= 1 ? view.iterations : 1);
            return { world: resolvePlaybackWorld(view.iterations), totalMs };
        }

        /** The `playback` prop → animator calls — ONE shared rule (§10, `resolveDeclarativePlayback`
         *  in core, same as React and React Native): the lever's position — off · on · paused — and a change
         *  between two positions is one or two of the four buttons. HOW each step moves is the timeline's
         *  `actions`, performed by the executor behind the buttons. */
        function syncPlayState() {
            if (compMode.value !== PxControlMode.playback) return;
            const api = apiRef.value;
            const { world, totalMs } = playbackGeometry();
            const position: PxDeclarativeProps = { playback: props.playback };
            const { actions } = resolveDeclarativePlayback({
                world,
                prev: prevPlayback ?? undefined,
                next: position,
            });
            prevPlayback = position;
            if (api) for (const action of actions) applyDeclarativeAction(api.playback, action);
        }

        /** Controlled-time mode: seek through the animator API (no recreate). */
        function applySeek() {
            if (compMode.value !== PxControlMode.fixedTime) return;
            const playback = apiRef.value?.playback;
            if (playback) showFixedFrame(playback, props);
        }

        // Create the animator once DOM refs are available.
        onMounted(() => createApi());

        // Recreate the animator when the resolved doc changes.
        // `flush: 'post'` — the animator must be created AFTER the DOM is
        // patched, otherwise the new root element isn't in the document yet
        // and trigger setup fails (the file's triggers would never resume after a doc swap).
        watch(resolvedDoc, () => createApi(), { flush: 'post' });

        // Sync the declarative playback props with the animator.
        watch([compMode, () => props.playback], () => syncPlayState());

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
            if (compMode.value === PxControlMode.playback || compMode.value === PxControlMode.fixedTime) {
                makeDiag().warn(PxDiagnosticKind.usage, PxDiagnosticCode.imperativeOverDeclarative, call);
            }
        };
        // ONE forwarder for every wrapper (core `forwardPlaybackControls`); a write warns first when a driver prop owns playback
        // `variables` forwards to the CURRENT runtime — a new document makes a new one
        const variablesApi: PxVariablesApi = {
            get: name => runtime.value.api.get(name),
            set: (name, value) => runtime.value.api.set(name, value),
            setVariables: values => runtime.value.api.setVariables(values),
            getAll: () => runtime.value.api.getAll(),
            getKeys: () => runtime.value.api.getKeys(),
            reset: name => runtime.value.api.reset(name),
            getDefinitions: () => runtime.value.api.getDefinitions(),
            setVariant: name => runtime.value.api.setVariant(name),
            getVariant: () => runtime.value.api.getVariant(),
            getVariantKeys: () => runtime.value.api.getVariantKeys(),
        };
        const publicApi: PxAnimationPlayerHandle = {
            playback: forwardPlaybackControls(
                () => apiRef.value?.playback,
                (call, run) => { guardWrite(call); const playback = apiRef.value?.playback; if (playback) run(playback); }),
            variables: variablesApi,
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
