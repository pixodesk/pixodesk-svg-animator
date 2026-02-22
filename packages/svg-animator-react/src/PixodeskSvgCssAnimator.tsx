/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { OutAction, StartOn } from "@pixodesk/svg-animator-web";
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
 * <PixodeskSvgCssAnimator startOn="mouseOver" outAction="pause">
 *   <AnimationSvg />
 * </PixodeskSvgCssAnimator>
 * ```
 *
 * The wrapper div carries one of three animation states via CSS class names:
 * - *(no class)*           — idle, animation not started
 * - `px-anim-enabled`      — started but paused
 * - `px-anim-enabled px-anim-playing` — actively playing
 *
 * @param children  - The SVGR-imported SVG component to animate.
 * @param startOn   - What triggers the animation to start:
 *   - `'load'`           — plays immediately on mount (default)
 *   - `'mouseOver'`      — plays on hover
 *   - `'click'`          — plays on click, toggles on second click
 *   - `'scrollIntoView'` — plays when the element enters the viewport
 * @param outAction - What happens when the trigger ends (hover/scroll out, second click):
 *   - `'continue'` — keeps playing (default)
 *   - `'pause'`    — pauses at the current frame
 *   - `'reset'`    — resets to the beginning
 * @param className - Additional CSS class names to apply to the wrapper div.
 * @param style     - Inline styles for the wrapper div (e.g. `{ width: 400, height: 400 }`).
 */
const PixodeskSvgCssAnimator: FC<{
    className?: string;
    style?: CSSProperties;
    children: ReactNode;
    startOn?: StartOn;
    outAction?: OutAction;
}> = ({ className, style, children, startOn = 'load', outAction = 'continue' }) => {

    const [state, setState] = useState<AnimState>(startOn === 'load' ? 'playing' : 'idle');

    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (startOn !== 'scrollIntoView') return;
        const el = ref.current;
        if (!el) return;
        const outState: AnimState = (
            outAction === 'reset' ? 'idle' :
                outAction === 'pause' ? 'paused' : 'playing'
        );
        const observer = new IntersectionObserver(
            ([entry]) => setState(entry.isIntersecting ? 'playing' : outState),
            { threshold: 0.1 }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [startOn, outAction]);

    const goOut = () => setState(
        outAction === 'reset' ? 'idle' :
            outAction === 'pause' ? 'paused' : 'playing'
    );

    const handlers =
        startOn === 'mouseOver' ? { onMouseEnter: () => setState('playing'), onMouseLeave: goOut } :
            startOn === 'click' ? { onClick: () => state === 'playing' ? goOut() : setState('playing') } :
                {};

    return (
        <div
            ref={ref}
            className={className + (
                state === 'playing' ? 'px-anim-enabled px-anim-playing' :
                    state === 'paused' ? 'px-anim-enabled' : ''
            )}
            style={style}
            {...handlers}
        >
            {children}
        </div>
    );
};
export default PixodeskSvgCssAnimator;