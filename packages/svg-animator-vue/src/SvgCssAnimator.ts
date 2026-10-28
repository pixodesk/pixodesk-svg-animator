// @px-area entry
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { PxPlayState, PxTriggerAction, PxTriggerEvent, type PxActions, type PxTriggers } from '@pixodesk/svg-animator-core';
import { resolveGate, resolveTriggers, triggerActionFor, triggerListsEvent } from '@pixodesk/svg-animator-core/engine';
import { createVisibilityGate, type PxVisibilityGate } from '@pixodesk/svg-animator-web/internal';
import { computed, defineComponent, h, onBeforeUnmount, onMounted, ref, watch, type PropType } from 'vue';


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
 *   <SvgCssAnimationPlayer :triggers="{ start: 'hoverIn', pause: 'hoverOut' }">
 *     <AnimationSvg />
 *   </SvgCssAnimationPlayer>
 * </template>
 * ```
 *
 * The wrapper div carries one of three states via CSS class names:
 * - *(no class)*                        — stopped
 * - `px-anim-enabled`                   — paused
 * - `px-anim-enabled px-anim-playing`   — playing
 *
 * The triggers are the JSON player's (dev-docs/plans/playback-layers.md): event lists — `start`, `stop`,
 * `pause`, `resume`, plus `togglePlay` / `togglePause` — over the events `load`, `hoverIn`, `hoverOut`, `click`,
 * read by the same state rule (core's `triggerActionFor`) and gated by the same visibility gate
 * (`createVisibilityGate`), so the two players cannot drift. An absent `triggers` block plays on load; an
 * empty one lists nothing.
 *
 * ACCEPTED LIMITS of a class toggle (the editor shows them next to the choices):
 * - the start transition is always `continue` — a class cannot restart keyframes or jump to their end
 * - the stop transition is always `reset` — a class cannot play keyframes backwards
 * - completing the iteration, `beforeStart` and the finish transition are the file's own CSS
 *
 * @prop triggers  - WHEN: the file's own `timeline.triggers` block — `start`, `stop`, `pause`, `resume`,
 *   `togglePlay`, `togglePause`, each one event or a list of them.
 * @prop actions - Only `suspend` applies — what happens while none of it is on screen (default `'pause'`):
 *   `'pause'` pauses at the current frame and resumes when it comes back, `'continue'` keeps playing and starts
 *   without waiting to be seen, `'reset'` goes back to the beginning so it replays on the next entry.
 * @prop inViewThreshold - How much of the element must be on screen (0–1) before it may run (default `0.5`).
 * @prop inViewDebounce  - How long that must hold, in ms, before it starts (default `150`).
 * @public
 */
const SvgCssAnimationPlayer = defineComponent({
    name: 'SvgCssAnimationPlayer',
    // The wrapper spreads `attrs` itself and merges `class` by hand, so Vue must not ALSO
    // apply them — otherwise a host class lands on the div twice.
    inheritAttrs: false,
    props: {
        triggers: { type: Object as PropType<PxTriggers> },
        actions: { type: Object as PropType<Pick<PxActions, 'suspend'>> },
        inViewThreshold: { type: Number },
        inViewDebounce: { type: Number },
    },
    setup(props, { slots, attrs }) {
        // one rule with the JSON player: the lists normalised, the gate defaulted
        const resolved = computed(() => resolveTriggers(props.triggers));
        const gateConfig = computed(() => resolveGate({
            actions: props.actions, inViewThreshold: props.inViewThreshold, inViewDebounce: props.inViewDebounce,
        }));
        const playsOnLoad = computed(() => resolved.value.start.includes(PxTriggerEvent.load));
        const state = ref<PxPlayState>(PxPlayState.stopped);
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
                reset: () => { state.value = PxPlayState.stopped; },
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
                case PxTriggerAction.stop: state.value = PxPlayState.stopped; break;
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
