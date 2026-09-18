/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { PX_TRIGGER_DEFAULTS, PxMouseOutAction, PxOffScreenAction, PxTriggerStart } from '@pixodesk/svg-animator-core';
import { createVisibilityGate, type PxVisibilityGate } from '@pixodesk/svg-animator-web/internal';
import { computed, defineComponent, h, onBeforeUnmount, onMounted, ref, watch, type PropType } from 'vue';


type AnimState = 'idle' | 'paused' | 'playing';

/**
 * Controls playback of SVG+CSS animated files by toggling class names on a wrapper div.
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
 *   <PixodeskSvgCssAnimator start="mouseOver" mouseOut="pause">
 *     <AnimationSvg />
 *   </PixodeskSvgCssAnimator>
 * </template>
 * ```
 *
 * The wrapper div carries one of three animation states via CSS class names:
 * - *(no class)*           — idle, animation not started
 * - `px-anim-enabled`      — started but paused
 * - `px-anim-enabled px-anim-playing` — actively playing
 *
 * TWO AXES, the same two the JSON player has: `start` says what STARTS it, `offScreen` says
 * whether it may RUN. The gate itself is the player's (`createVisibilityGate`), so the threshold,
 * the dwell, the hysteresis and the hidden-tab rule cannot drift between the two.
 *
 * @prop start     - What starts the animation:
 *   - `'load'`      — plays as soon as it is visible enough (default)
 *   - `'mouseOver'` — plays on hover
 *   - `'click'`     — plays on click, toggles on second click
 *   - `'none'`      — **not supported here.** This wrapper exposes no `play()`, so there is
 *                     nothing to wait for and the animation never starts. The prop keeps the
 *                     shared `PxTriggerStart` type (one enum per wire key), so the value
 *                     type-checks — it simply has no effect. Use `PixodeskSvgAnimator` (the JSON
 *                     player) when you need to start an animation from code.
 * @prop offScreen - What happens while none of it is on screen:
 *   - `'pause'`    — pauses at the current frame (default); resumes when it comes back
 *   - `'continue'` — keeps playing, and starts without waiting to be seen
 *   - `'reset'`    — back to the beginning, so it replays on the next entry
 * @prop mouseOut  - What happens when the pointer leaves, for `start: 'mouseOver'`:
 *   - `'continue'` — keeps playing (default)
 *   - `'pause'`    — pauses at the current frame
 *   - `'reset'`    — resets to the beginning
 *   - `'reverse'`  — **acts as `'continue'` here.** A CSS class toggle cannot run keyframes
 *                    backwards. Accepted so the prop keeps the shared `PxMouseOutAction` type.
 * @prop visibilityThreshold - How much of the element must be on screen (0–1) before it may run.
 *   Defaults to the wire default (`0.5`), the same as the JSON player.
 * @prop visibilityDebounce  - How long that must hold, in ms, before it starts. Defaults to the
 *   wire default (`150`).
 * @public
 */
const PixodeskSvgCssAnimator = defineComponent({
    name: 'PixodeskSvgCssAnimator',
    // The wrapper spreads `attrs` itself and merges `class` by hand, so Vue must not ALSO
    // apply them — otherwise a host class lands on the div twice.
    inheritAttrs: false,
    props: {
        start:     { type: String as PropType<PxTriggerStart>,    default: PX_TRIGGER_DEFAULTS.start },
        offScreen: { type: String as PropType<PxOffScreenAction>, default: PX_TRIGGER_DEFAULTS.offScreen },
        mouseOut:  { type: String as PropType<PxMouseOutAction>,  default: PX_TRIGGER_DEFAULTS.mouseOut },
        visibilityThreshold: { type: Number, default: PX_TRIGGER_DEFAULTS.visibilityThreshold },
        visibilityDebounce:  { type: Number, default: PX_TRIGGER_DEFAULTS.visibilityDebounce },
    },
    setup(props, { slots, attrs }) {
        const state = ref<AnimState>('idle');
        const el = ref<HTMLDivElement | null>(null);
        let gate: PxVisibilityGate | null = null;

        const goOut = (): void => {
            state.value =
                props.mouseOut === PxMouseOutAction.reset ? 'idle' :
                props.mouseOut === PxMouseOutAction.pause ? 'paused' : 'playing';
        };

        const attach = (): void => {
            gate?.dispose();
            gate = null;
            const node = el.value;
            if (!node) return;
            gate = createVisibilityGate(node, {
                start: props.start,
                offScreen: props.offScreen,
                mouseOut: props.mouseOut,
                visibilityThreshold: props.visibilityThreshold,
                visibilityDebounce: props.visibilityDebounce,
            }, {
                isPlaying: () => state.value === 'playing',
                play: () => { state.value = 'playing'; },
                pause: () => { state.value = 'paused'; },
                cancel: () => { state.value = 'idle'; },
            });
            // Only `load` is held by the gate; a hover or a click is aimed at something seen.
            if (props.start === PxTriggerStart.load) gate.requestStart(false);
        };

        onMounted(attach);
        watch(() => [props.start, props.offScreen, props.mouseOut, props.visibilityThreshold, props.visibilityDebounce], attach);
        onBeforeUnmount(() => { gate?.dispose(); gate = null; });

        const requestStart = (): void => {
            if (gate) gate.requestStart(true);
            else state.value = 'playing';
        };

        const cssClass = computed(() =>
            state.value === 'playing' ? 'px-anim-enabled px-anim-playing' :
            state.value === 'paused' ? 'px-anim-enabled' : ''
        );

        const handlers = computed(() =>
            props.start === PxTriggerStart.mouseOver
                ? { onMouseenter: requestStart, onMouseleave: goOut }
                : props.start === PxTriggerStart.click
                    ? { onClick: () => { if (state.value === 'playing') state.value = 'paused'; else requestStart(); } }
                    : {}
        );

        return () => h('div', {
            ref: el,
            ...attrs,
            class: [attrs.class, cssClass.value],
            ...handlers.value,
        }, slots.default?.());
    },
});
export default PixodeskSvgCssAnimator;
