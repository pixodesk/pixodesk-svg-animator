// @px-area entry
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { PxPlayState, PxTriggerAction, PxTriggerEvent, type PxActions, type PxTriggers } from '@pixodesk/svg-animator-core';
import { resolveGate, resolveTriggers, triggerActionFor, triggerListsEvent } from '@pixodesk/svg-animator-core/engine';
import { createVisibilityGate, type PxVisibilityGate } from '@pixodesk/svg-animator-web/internal';
import { CSSProperties, FC, ReactNode, useEffect, useRef, useState } from "react";


/**
 * Controls playback of SVG+CSS animated files by toggling class names on a wrapper div.
 *
 * Intended for use with SVG files exported from the Pixodesk editor using the
 * **CSS Keyframes** (no `<script>` tag). Import the SVG as a React component
 * via SVGR (`vite-plugin-svgr` or `@svgr/webpack`) and pass it as `children`:
 *
 * ```tsx
 * import AnimationSvg from './animation.svg?react'; // SVGR
 *
 * <SvgCssAnimationPlayer triggers={{ start: 'hoverIn', pause: 'hoverOut' }}>
 *   <AnimationSvg />
 * </SvgCssAnimationPlayer>
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
 * @param children  - The SVGR-imported SVG component to animate.
 * @param triggers  - WHEN: the file's own `timeline.triggers` block — `start`, `stop`, `pause`, `resume`,
 *   `togglePlay`, `togglePause`, each one event or a list of them.
 * @param actions - Only `suspend` applies — what happens while none of it is on screen (default `'pause'`):
 *   `'pause'` pauses at the current frame and resumes when it comes back, `'continue'` keeps playing and starts
 *   without waiting to be seen, `'reset'` goes back to the beginning so it replays on the next entry.
 * @param inViewThreshold - How much of the element must be on screen (0–1) before it may run (default `0.5`).
 * @param inViewDebounce  - How long that must hold, in ms, before it starts — so scrolling straight past starts
 *   nothing (default `150`).
 * @param className - Additional CSS class names to apply to the wrapper div.
 * @param style     - Inline styles for the wrapper div (e.g. `{ width: 400, height: 400 }`).
 * @public
 */
const SvgCssAnimationPlayer: FC<{
    className?: string;
    style?: CSSProperties;
    children: ReactNode;
    triggers?: PxTriggers;
    actions?: Pick<PxActions, 'suspend'>;
    inViewThreshold?: number;
    inViewDebounce?: number;
}> = ({ className, style, children, triggers, actions, inViewThreshold, inViewDebounce }) => {
    // one rule with the JSON player: the lists normalised, the gate defaulted
    const resolved = resolveTriggers(triggers);
    const gateConfig = resolveGate({ actions, inViewThreshold, inViewDebounce });
    const playsOnLoad = resolved.start.includes(PxTriggerEvent.load);

    const [state, setState] = useState<PxPlayState>(PxPlayState.stopped);

    const ref = useRef<HTMLDivElement>(null);
    // The gate is built once per configuration and asks for the CURRENT state, which a closure
    // over `state` could not give it.
    const stateRef = useRef<PxPlayState>(state);
    stateRef.current = state;
    const gateRef = useRef<PxVisibilityGate | null>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const gate = createVisibilityGate(el, gateConfig, {
            isPlaying: () => stateRef.current === PxPlayState.playing,
            start: () => setState(PxPlayState.playing),
            hold: () => setState(PxPlayState.paused),
            release: () => setState(PxPlayState.playing),
            reset: () => setState(PxPlayState.stopped),
        });
        gateRef.current = gate;
        // Only `load` is held by the gate; a hover or a click is aimed at something already seen.
        if (playsOnLoad) gate.requestStart(false);
        return () => {
            gate.dispose();
            gateRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- the three values stand for `gateConfig`
    }, [playsOnLoad, gateConfig.suspend, gateConfig.inViewThreshold, gateConfig.inViewDebounce]);

    /** The state rule — the player's own, on the class state. */
    const fire = (event: PxTriggerEvent): void => {
        switch (triggerActionFor(resolved, stateRef.current, event)) {
            case PxTriggerAction.play:
                if (gateRef.current) gateRef.current.requestStart(true);
                else setState(PxPlayState.playing);
                break;
            case PxTriggerAction.pause: setState(PxPlayState.paused); break;
            case PxTriggerAction.stop: setState(PxPlayState.stopped); break;
        }
    };

    const hovers = triggerListsEvent(resolved, PxTriggerEvent.hoverIn) || triggerListsEvent(resolved, PxTriggerEvent.hoverOut);
    const handlers = {
        ...(hovers ? { onMouseEnter: () => fire(PxTriggerEvent.hoverIn), onMouseLeave: () => fire(PxTriggerEvent.hoverOut) } : {}),
        ...(triggerListsEvent(resolved, PxTriggerEvent.click) ? { onClick: () => fire(PxTriggerEvent.click) } : {}),
    };

    return (
        <div
            ref={ref}
            className={[
                className,
                state === PxPlayState.playing ? 'px-anim-enabled px-anim-playing' :
                    state === PxPlayState.paused ? 'px-anim-enabled' : ''
            ].filter(Boolean).join(' ')}
            style={style}
            {...handlers}
        >
            {children}
        </div>
    );
};
export default SvgCssAnimationPlayer;
