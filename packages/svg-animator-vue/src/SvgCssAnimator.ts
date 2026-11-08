// @px-area entry
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { PxPlayState, PxTriggerAction, PxTriggerEvent, type PxActionsOptions, type PxActionTriggersInput, type PxTimelineOptions } from '@pixodesk/svg-animator-core';
import { resolveGate, resolveTriggers, triggerActionFor, triggerListsEvent } from '@pixodesk/svg-animator-core/engine';
import { createVisibilityGate, type PxVisibilityGate } from '@pixodesk/svg-animator-web/internal';
import { computed, defineComponent, h, onBeforeUnmount, onMounted, ref, watch, type ExtractPropTypes, type PropType } from 'vue';
import type { svgAnimationPlayerProps } from './SvgAnimator';

/**
 * The runtime props of {@link SvgCssAnimationPlayer} — the SAME names as `SvgAnimationPlayer`'s
 * ({@link svgAnimationPlayerProps}), each the same shape or a narrower one where a class toggle can do less:
 *
 * | prop | as on `SvgAnimationPlayer`, narrowed to |
 * |---|---|
 * | `playUsingActionTriggers` | the BLOCK only — a script-free SVG imported as a component carries no triggers the component could read, so there is no `true` |
 * | `timelineOptions` | the gate numbers `inViewThreshold` / `inViewDebounce` |
 * | `actions` | `outOfView` |
 * @internal
 */
export const svgCssAnimationPlayerProps = {
    playUsingActionTriggers: { type: Object as PropType<PxActionTriggersInput> },
    timelineOptions: { type: Object as PropType<Pick<Extract<PxTimelineOptions, { type?: 'time' }>, 'inViewThreshold' | 'inViewDebounce'>> },
    actions: { type: Object as PropType<Pick<PxActionsOptions, 'outOfView'>> },
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
 *   <SvgCssAnimationPlayer :playUsingActionTriggers="{ start: 'hoverIn', pause: 'hoverOut' }">
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
 * The triggers are the JSON player's (dev-docs/plans/playback-layers.md): event lists — `start`, `stop`,
 * `pause` (resume is derived unless named) — over the events `load`, `hoverIn`, `hoverOut`, `click`,
 * read by the same state rule (core's `triggerActionFor`) and gated by the same visibility gate
 * (`createVisibilityGate`), so the two players cannot drift. No `playUsingActionTriggers`, or an empty block: nothing
 * starts it.
 *
 * ACCEPTED LIMITS of a class toggle (the editor shows them next to the choices):
 * - the start is always `continue` — a class cannot jump keyframes to their start or end
 * - the stop is always `jumpToStart` — a class cannot play keyframes backwards or on to their end
 * - `whenIdle` and the finish are the file's own CSS
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
        const resolved = computed(() => resolveTriggers(props.playUsingActionTriggers));
        const gateConfig = computed(() => resolveGate({
            actions: props.actions, inViewThreshold: props.timelineOptions?.inViewThreshold, inViewDebounce: props.timelineOptions?.inViewDebounce,
        }));
        const playsOnLoad = computed(() => resolved.value.start.includes(PxTriggerEvent.load));
        const state = ref<PxPlayState>(PxPlayState.idle);
        const el = ref<HTMLDivElement | null>(null);
        let gate: PxVisibilityGate | null = null;

        const attach = (): void => {
            gate?.dispose();
            gate = null;
            const node = el.value;
            if (!node) return;
            gate = createVisibilityGate(node, gateConfig.value, {
                isPlaying: () => state.value === PxPlayState.playing,
                start: () => { state.value = PxPlayState.playing; },
                hold: () => { state.value = PxPlayState.paused; },
                release: () => { state.value = PxPlayState.playing; },
                jumpToStart: () => { state.value = PxPlayState.idle; },
            });
            // Only `load` is held by the gate; a hover or a click is aimed at something seen.
            if (playsOnLoad.value) gate.requestStart(false);
        };

        onMounted(attach);
        watch([gateConfig, playsOnLoad], attach);
        onBeforeUnmount(() => { gate?.dispose(); gate = null; });

        /** The state rule — the player's own, on the class state. */
        const fire = (event: PxTriggerEvent): void => {
            switch (triggerActionFor(resolved.value, state.value, event)) {
                case PxTriggerAction.play:
                    if (gate) gate.requestStart(true);
                    else state.value = PxPlayState.playing;
                    break;
                case PxTriggerAction.pause: state.value = PxPlayState.paused; break;
                case PxTriggerAction.stop: state.value = PxPlayState.idle; break;
            }
        };

        const cssClass = computed(() =>
            state.value === PxPlayState.playing ? 'px-anim-enabled px-anim-playing' :
            state.value === PxPlayState.paused ? 'px-anim-enabled' : ''
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
        }, slots.default?.());
    },
});
export default SvgCssAnimationPlayer;
