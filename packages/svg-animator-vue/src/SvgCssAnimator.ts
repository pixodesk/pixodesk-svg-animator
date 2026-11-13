// @px-area entry
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { PxOutOfViewBehavior, PxPlaybackState, PxTriggerAction, PxTriggerEvent, PxWhenFinished, type PxActionsInput, type PxActionTriggersInput, type PxTimelineOptions } from '@pixodesk/svg-animator-core';
import { resolveGate, resolveTriggers, triggerActionFor, triggerListsEvent } from '@pixodesk/svg-animator-core/engine';
import { createVisibilityGate, type PxVisibilityGate } from '@pixodesk/svg-animator-web/internal';
import { computed, defineComponent, Fragment, h, onBeforeUnmount, onMounted, ref, watch, type ExtractPropTypes, type PropType } from 'vue';
import type { svgAnimationPlayerProps } from './SvgAnimator';

/**
 * The runtime props of {@link SvgCssAnimationPlayer} — the SAME names as `SvgAnimationPlayer`'s
 * ({@link svgAnimationPlayerProps}), each the same shape or a narrower one where a class toggle can do less:
 *
 * | prop | as on `SvgAnimationPlayer`, narrowed to |
 * |---|---|
 * | `actionTriggers` | the same — but with none given nothing starts it: a script-free SVG imported as a component carries no triggers the component could read |
 * | `timelineOptions` | the gate numbers `inViewThreshold` / `inViewDebounce` |
 * | `actions` | `outOfView` |
 * @internal
 */
export const svgCssAnimationPlayerProps = {
    actionTriggers: { type: Object as PropType<PxActionTriggersInput | null> },
    timelineOptions: { type: Object as PropType<Pick<Extract<PxTimelineOptions, { type?: 'time' }>, 'inViewThreshold' | 'inViewDebounce'>> },
    actions: { type: Object as PropType<Pick<PxActionsInput, 'outOfView'>> },
} as const;

/** The guard: every CSS-component prop is an `SvgAnimationPlayer` prop (no name of its own) of a compatible shape —
 *  rename or reshape one there and this stops compiling. @internal */
export type _SvgCssPropsAreSvgAnimationPlayerProps = [
    AssertNever<Exclude<keyof typeof svgCssAnimationPlayerProps, keyof typeof svgAnimationPlayerProps>>,
    AssertAssignable<ExtractPropTypes<typeof svgCssAnimationPlayerProps>, Partial<ExtractPropTypes<typeof svgAnimationPlayerProps>>>,
];
/** Compiles only when `T` is assignable to `U`. */
type AssertAssignable<T extends U, U> = T;
/** Compiles only when `T` is `never` — here: no prop name the JS component lacks. */
type AssertNever<T extends never> = T;

/**
 * Controls playback of SVG+CSS animated files by toggling class names on a wrapper div — the script-free sibling of
 * `SvgAnimationPlayer` (which plays the JSON document): the SAME prop names ({@link svgCssAnimationPlayerProps}),
 * fewer of them.
 *
 * Intended for use with SVG files exported from the Pixodesk editor using the
 * **CSS Keyframes** (no `<script>` tag). Import the SVG as a Vue component
 * (`vite-svg-loader`) and pass it in the default slot:
 *
 * ```vue
 * <script setup>
 * import AnimationSvg from './animation.svg?component';
 * </script>
 *
 * <template>
 *   <SvgCssAnimationPlayer :actionTriggers="{ 'playback.play': 'hoverIn', 'playback.pause': 'hoverOut' }">
 *     <AnimationSvg />
 *   </SvgCssAnimationPlayer>
 * </template>
 * ```
 *
 * The wrapper div carries one of three states via CSS class names:
 * - *(no class)*                        — idle
 * - `px-anim-enabled`                   — paused
 * - `px-anim-enabled px-anim-playing`   — playing
 *
 * The triggers are the JSON player's (dev-docs/plans/playback-layers.md): event lists — `playback.start`, `playback.play`,
 * `playback.stop`, `playback.pause` (`playback.resume` is derived unless named) — over the events `load`, `hoverIn`, `hoverOut`, `click`,
 * read by the same state rule (core's `triggerActionFor`) and gated by the same visibility gate
 * (`createVisibilityGate`), so the two players cannot drift. No `actionTriggers`, `null` or an empty block: nothing
 * starts it.
 *
 * ACCEPTED LIMITS of a class toggle (the editor shows them next to the choices):
 * - a start that is not from rest restarts by remounting the wrapper's content (a class cannot rewind keyframes)
 * - the stop is always `jumpToStart` — a class cannot play keyframes backwards or on to their end
 * - there is no `finished` state: the class toggle does not see the CSS animation end
 * - `whenIdle` and `whenFinished` are the file's own CSS
 * @public
 */
const SvgCssAnimationPlayer = defineComponent({
    name: 'SvgCssAnimationPlayer',
    // The wrapper spreads `attrs` itself and merges `class` by hand, so Vue must not ALSO
    // apply them — otherwise a host class lands on the div twice.
    inheritAttrs: false,
    props: svgCssAnimationPlayerProps,
    setup(props, { slots, attrs }) {
        // one rule with the JSON player: the lists normalised, the gate defaulted
        const resolved = computed(() => resolveTriggers(props.actionTriggers ?? undefined));
        const gateConfig = computed(() => resolveGate({
            actions: props.actions, inViewThreshold: props.timelineOptions?.inViewThreshold, inViewDebounce: props.timelineOptions?.inViewDebounce,
        }));
        const loadPresses = computed(() => resolved.value.startPlayback.includes(PxTriggerEvent.load) ? PxTriggerAction.startPlayback
            : resolved.value.playPlayback.includes(PxTriggerEvent.load) ? PxTriggerAction.playPlayback : undefined);
        const state = ref<PxPlaybackState>(PxPlaybackState.off);
        /** Bumped by a start that is not from rest: the new key remounts the content, so the CSS keyframes begin again. */
        const generation = ref(0);
        const el = ref<HTMLDivElement | null>(null);
        let gate: PxVisibilityGate | null = null;
        /** What the gate did when the graphic left the screen — undone on return unless a button changed the state since. */
        let gateOwes: PxTriggerAction | undefined;

        // The buttons on the class state — the JSON player's rules, as far as a class can show them.
        const press = (action: PxTriggerAction | undefined): void => {
            if (action === undefined) return;
            gateOwes = undefined;
            switch (action) {
                case PxTriggerAction.startPlayback:
                    if (state.value !== PxPlaybackState.off) generation.value++;   // from the start: remount
                    state.value = PxPlaybackState.playing;
                    break;
                case PxTriggerAction.playPlayback:
                case PxTriggerAction.resumePlayback: state.value = PxPlaybackState.playing; break;
                case PxTriggerAction.pausePlayback: state.value = PxPlaybackState.paused; break;
                case PxTriggerAction.stopPlayback: state.value = PxPlaybackState.off; break;
            }
        };

        const attach = (): void => {
            gate?.dispose();
            gate = null;
            const node = el.value;
            if (!node) return;
            const outOfView = gateConfig.value.outOfView;
            gate = createVisibilityGate(node, gateConfig.value, {
                // the gate presses the real buttons and remembers what it did (1.26)
                leaveView: () => {
                    if (state.value !== PxPlaybackState.playing) return;
                    if (outOfView === PxOutOfViewBehavior.pause) { state.value = PxPlaybackState.paused; gateOwes = PxTriggerAction.resumePlayback; }
                    else if (outOfView === PxOutOfViewBehavior.stop) { state.value = PxPlaybackState.off; gateOwes = PxTriggerAction.startPlayback; }
                },
                returnToView: () => {
                    const owed = gateOwes;
                    gateOwes = undefined;
                    if (owed === PxTriggerAction.resumePlayback && state.value === PxPlaybackState.paused) state.value = PxPlaybackState.playing;
                    else if (owed === PxTriggerAction.startPlayback && state.value === PxPlaybackState.off) state.value = PxPlaybackState.playing;
                },
            });
            // Only `load` is held by the gate; a hover or a click is aimed at something seen.
            const onLoad = loadPresses.value;
            if (onLoad !== undefined) gate.requestStart(false, () => press(onLoad));
        };

        onMounted(attach);
        watch([gateConfig, loadPresses], attach);
        onBeforeUnmount(() => { gate?.dispose(); gate = null; });

        /** The state rule — the player's own, on the class state (which has no `finished`). */
        const fire = (event: PxTriggerEvent): void => {
            const action = triggerActionFor(resolved.value, state.value, event, PxWhenFinished.hold);
            if ((action === PxTriggerAction.startPlayback || action === PxTriggerAction.playPlayback) && gate) gate.requestStart(true, () => press(action));
            else press(action);
        };

        const cssClass = computed(() =>
            state.value === PxPlaybackState.playing ? 'px-anim-enabled px-anim-playing' :
            state.value === PxPlaybackState.paused ? 'px-anim-enabled' : ''
        );

        const handlers = computed(() => {
            const t = resolved.value;
            const hovers = triggerListsEvent(t, PxTriggerEvent.hoverIn) || triggerListsEvent(t, PxTriggerEvent.hoverOut);
            return {
                ...(hovers ? { onMouseenter: () => fire(PxTriggerEvent.hoverIn), onMouseleave: () => fire(PxTriggerEvent.hoverOut) } : {}),
                ...(triggerListsEvent(t, PxTriggerEvent.click) ? { onClick: () => fire(PxTriggerEvent.click) } : {}),
            };
        });

        return () => h('div', {
            ref: el,
            ...attrs,
            class: [attrs.class, cssClass.value],
            ...handlers.value,
        // a new key remounts the content, so a restart begins the CSS keyframes again; the wrapper (and the gate on it) stays
        }, [h(Fragment, { key: generation.value }, slots.default?.())]);
    },
});
export default SvgCssAnimationPlayer;
