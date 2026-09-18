/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { PX_TRIGGER_DEFAULTS, PxMouseOutAction, PxOffScreenAction, PxTriggerStart } from '@pixodesk/svg-animator-core';
import { createVisibilityGate } from '@pixodesk/svg-animator-web/internal';
import { CSSProperties, FC, ReactNode, useEffect, useRef, useState } from "react";


type AnimState = 'idle' | 'paused' | 'playing';

/**
 * Controls playback of a SVG+CSS animated files by toggling class names on a wrapper div.
 *
 * Intended for use with SVG files exported from the Pixodesk editor using the
 * **CSS Keyframes** (no `<script>` tag). Import the SVG as a React component
 * via SVGR (`vite-plugin-svgr` or `@svgr/webpack`) and pass it as `children`:
 *
 * ```tsx
 * import AnimationSvg from './animation.svg?react'; // SVGR
 *
 * <PixodeskSvgCssAnimator start="mouseOver" mouseOut="pause">
 *   <AnimationSvg />
 * </PixodeskSvgCssAnimator>
 * ```
 *
 * The wrapper div carries one of three animation states via CSS class names:
 * - *(no class)*           — idle, animation not started
 * - `px-anim-enabled`      — started but paused
 * - `px-anim-enabled px-anim-playing` — actively playing
 *
 * TWO AXES, the same two the JSON player has: `start` says what STARTS it, `offScreen` says
 * whether it may RUN. Visibility is not a start trigger, so an animation started by a click is
 * paused off screen too. The gate itself is the player's (`createVisibilityGate`), so the
 * threshold, the dwell, the hysteresis and the hidden-tab rule cannot drift between the two.
 *
 * @param children  - The SVGR-imported SVG component to animate.
 * @param start     - What starts the animation:
 *   - `'load'`      — plays as soon as it is visible enough (default)
 *   - `'mouseOver'` — plays on hover
 *   - `'click'`     — plays on click, toggles on second click
 *   - `'none'`      — **not supported here.** This wrapper exposes no `play()`, so there is
 *                     nothing to wait for and the animation never starts. The prop keeps the
 *                     shared `PxTriggerStart` type (one enum per wire key), so the value
 *                     type-checks — it simply has no effect. Use `PixodeskSvgAnimator` (the JSON
 *                     player) when you need to start an animation from code.
 * @param offScreen - What happens while none of it is on screen:
 *   - `'pause'`    — pauses at the current frame (default); resumes when it comes back
 *   - `'continue'` — keeps playing, and starts without waiting to be seen
 *   - `'reset'`    — back to the beginning, so it replays on the next entry
 * @param mouseOut  - What happens when the pointer leaves, for `start: 'mouseOver'`:
 *   - `'continue'` — keeps playing (default)
 *   - `'pause'`    — pauses at the current frame
 *   - `'reset'`    — resets to the beginning
 *   - `'reverse'`  — **acts as `'continue'` here.** A CSS class toggle cannot run keyframes
 *                    backwards. Accepted so the prop keeps the shared `PxMouseOutAction` type.
 * @param visibilityThreshold - How much of the element must be on screen (0–1) before it may
 *   run. Defaults to the wire default (`0.5`), the same as the JSON player.
 * @param visibilityDebounce  - How long that must hold, in ms, before it starts — so scrolling
 *   straight past starts nothing. Defaults to the wire default (`150`).
 * @param className - Additional CSS class names to apply to the wrapper div.
 * @param style     - Inline styles for the wrapper div (e.g. `{ width: 400, height: 400 }`).
 * @public
 */
const PixodeskSvgCssAnimator: FC<{
    className?: string;
    style?: CSSProperties;
    children: ReactNode;
    start?: PxTriggerStart;
    offScreen?: PxOffScreenAction;
    mouseOut?: PxMouseOutAction;
    visibilityThreshold?: number;
    visibilityDebounce?: number;
}> = ({
    className, style, children,
    start = PX_TRIGGER_DEFAULTS.start,
    offScreen = PX_TRIGGER_DEFAULTS.offScreen,
    mouseOut = PX_TRIGGER_DEFAULTS.mouseOut,
    visibilityThreshold = PX_TRIGGER_DEFAULTS.visibilityThreshold,
    visibilityDebounce = PX_TRIGGER_DEFAULTS.visibilityDebounce,
}) => {

    const [state, setState] = useState<AnimState>('idle');

    const ref = useRef<HTMLDivElement>(null);
    // The gate is built once per configuration and asks for the CURRENT state, which a closure
    // over `state` could not give it.
    const stateRef = useRef<AnimState>(state);
    stateRef.current = state;
    const gateRef = useRef<ReturnType<typeof createVisibilityGate> | null>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const gate = createVisibilityGate(
            el,
            {
                start, offScreen, mouseOut, visibilityThreshold, visibilityDebounce,
            },
            {
                isPlaying: () => stateRef.current === 'playing',
                play: () => setState('playing'),
                pause: () => setState('paused'),
                cancel: () => setState('idle'),
            });
        gateRef.current = gate;
        // Only `load` is held by the gate; a hover or a click is aimed at something already seen.
        if (start === PxTriggerStart.load) gate.requestStart(false);
        return () => {
            gate.dispose();
            gateRef.current = null;
        };
    }, [start, offScreen, mouseOut, visibilityThreshold, visibilityDebounce]);

    const requestStart = () => gateRef.current?.requestStart(true) ?? setState('playing');

    const goOut = () => setState(
        mouseOut === PxMouseOutAction.reset ? 'idle' :
            mouseOut === PxMouseOutAction.pause ? 'paused' : 'playing'
    );

    const handlers =
        start === PxTriggerStart.mouseOver ? { onMouseEnter: requestStart, onMouseLeave: goOut } :
            start === PxTriggerStart.click
                ? { onClick: () => state === 'playing' ? setState('paused') : requestStart() }
                : {};

    return (
        <div
            ref={ref}
            className={[
                className,
                state === 'playing' ? 'px-anim-enabled px-anim-playing' :
                    state === 'paused' ? 'px-anim-enabled' : ''
            ].filter(Boolean).join(' ')}
            style={style}
            {...handlers}
        >
            {children}
        </div>
    );
};
export default PixodeskSvgCssAnimator;
