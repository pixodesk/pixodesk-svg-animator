/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { PX_TRIGGER_DEFAULTS, PxOutAction, PxStartOn } from "@pixodesk/svg-animator-web";
import { computed, defineComponent, h, onMounted, onUnmounted, ref, useAttrs, type PropType } from 'vue';


type AnimState = 'idle' | 'paused' | 'playing';


/**
 * Controls playback of a SVG+CSS animated file by toggling class names on a wrapper div.
 *
 * Intended for use with SVG files exported from the Pixodesk editor using the
 * **CSS Keyframes** flavor (no `<script>` tag). Import the SVG as a Vue component
 * via `vite-svg-loader` and pass it as the default slot:
 *
 * ```vue
 * <script setup>
 * import AnimationSvg from './animation.svg'; // vite-svg-loader
 * </script>
 *
 * <template>
 *   <PixodeskSvgCssAnimator startOn="mouseOver" outAction="pause">
 *     <AnimationSvg />
 *   </PixodeskSvgCssAnimator>
 * </template>
 * ```
 *
 * The wrapper div carries one of three animation states via CSS class names:
 * - *(no class)*                       — idle, animation not started
 * - `px-anim-enabled`                  — started but paused
 * - `px-anim-enabled px-anim-playing`  — actively playing
 *
 * @prop startOn   - What triggers the animation to start:
 *   - `'load'`           — plays immediately on mount (default)
 *   - `'mouseOver'`      — plays on hover
 *   - `'click'`          — plays on click, toggles on second click
 *   - `'scrollIntoView'` — plays when the element enters the viewport
 *   - `'programmatic'`   — **not supported here.** This wrapper exposes no `play()`, so there is
 *                          nothing to wait for and the animation never starts. The prop keeps the
 *                          shared `PxStartOn` type (one enum per wire key), so the value type-checks
 *                          — it simply has no effect. Use `PixodeskSvgAnimator` (the JSON player)
 *                          when you need to start an animation from code.
 * @prop outAction - What happens when the trigger ends (hover/scroll out, second click):
 *   - `'continue'` — keeps playing (default)
 *   - `'pause'`    — pauses at the current frame
 *   - `'reset'`    — resets to the beginning
 *   - `'reverse'`  — **acts as `'continue'` here.** A CSS class toggle cannot run keyframes
 *                    backwards. Accepted so the prop keeps the shared `PxOutAction` type.
 * @prop scrollIntoViewThreshold - For `'scrollIntoView'`: how much of the element must be
 *   visible (0–1) before it starts, and below which the out action applies. Defaults to the
 *   wire default (`0`, any pixel) — the same as the JSON player, not a private `0.1`.
 */
const PixodeskSvgCssAnimator = defineComponent({
    name: 'PixodeskSvgCssAnimator',

    inheritAttrs: false,

    props: {
        startOn:   { type: String as PropType<PxStartOn>,   default: 'load' },
        outAction: { type: String as PropType<PxOutAction>, default: 'continue' },
        scrollIntoViewThreshold: { type: Number, default: PX_TRIGGER_DEFAULTS.scrollIntoViewThreshold },
    },

    setup(props, { slots }) {
        const attrs = useAttrs();
        const state = ref<AnimState>(props.startOn === 'load' ? 'playing' : 'idle');
        const divRef = ref<HTMLDivElement | null>(null);

        const goOut = () => {
            state.value =
                props.outAction === 'reset' ? 'idle' :
                props.outAction === 'pause' ? 'paused' : 'playing';
        };

        let observerCleanup: (() => void) | undefined;

        onMounted(() => {
            if (props.startOn !== 'scrollIntoView') return;
            const el = divRef.value;
            if (!el) return;
            const outState: AnimState =
                props.outAction === 'reset' ? 'idle' :
                props.outAction === 'pause' ? 'paused' : 'playing';
            // `isIntersecting` is true at ONE visible pixel, so with a threshold above 0 it could
            // never report "out" — read the ratio against the threshold instead (review §13).
            const threshold = props.scrollIntoViewThreshold;
            const visible = (entry: IntersectionObserverEntry): boolean =>
                threshold > 0 ? entry.intersectionRatio >= threshold : entry.isIntersecting;
            const observer = new IntersectionObserver(
                ([entry]) => { state.value = visible(entry) ? 'playing' : outState; },
                { threshold }
            );
            observer.observe(el);
            observerCleanup = () => observer.disconnect();
        });

        onUnmounted(() => observerCleanup?.());

        const animClass = computed(() =>
            state.value === 'playing' ? 'px-anim-enabled px-anim-playing' :
            state.value === 'paused'  ? 'px-anim-enabled' : ''
        );

        const handlers = computed(() =>
            props.startOn === 'mouseOver' ? {
                onMouseenter: () => { state.value = 'playing'; },
                onMouseleave: goOut,
            } :
            props.startOn === 'click' ? {
                onClick: () => state.value === 'playing' ? goOut() : (state.value = 'playing'),
            } : {}
        );

        return () => h('div', {
            ref: divRef,
            ...attrs,
            class: [attrs.class, animClass.value],
            ...handlers.value,
        }, slots.default?.());
    },
});

export default PixodeskSvgCssAnimator;
