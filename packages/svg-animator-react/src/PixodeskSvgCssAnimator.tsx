/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { PX_TRIGGER_DEFAULTS, PxOutAction, PxStartOn } from "@pixodesk/svg-animator-web";
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
 *   - `'programmatic'`   — **not supported here.** This wrapper exposes no `play()`, so there is
 *                          nothing to wait for and the animation never starts. The prop keeps the
 *                          shared `PxStartOn` type (one enum per wire key), so the value type-checks
 *                          — it simply has no effect. Use `PixodeskSvgAnimator` (the JSON player)
 *                          when you need to start an animation from code.
 * @param outAction - What happens when the trigger ends (hover/scroll out, second click):
 *   - `'continue'` — keeps playing (default)
 *   - `'pause'`    — pauses at the current frame
 *   - `'reset'`    — resets to the beginning
 *   - `'reverse'`  — **acts as `'continue'` here.** A CSS class toggle cannot run keyframes
 *                    backwards. Accepted so the prop keeps the shared `PxOutAction` type.
 * @param scrollIntoViewThreshold - For `'scrollIntoView'`: how much of the element must be
 *   visible (0–1) before it starts, and below which the out action applies. Defaults to the
 *   wire default (`0`, any pixel) — the same as the JSON player, not a private `0.1`.
 * @param className - Additional CSS class names to apply to the wrapper div.
 * @param style     - Inline styles for the wrapper div (e.g. `{ width: 400, height: 400 }`).
 */
const PixodeskSvgCssAnimator: FC<{
    className?: string;
    style?: CSSProperties;
    children: ReactNode;
    startOn?: PxStartOn;
    outAction?: PxOutAction;
    scrollIntoViewThreshold?: number;
}> = ({
    className, style, children, startOn = 'load', outAction = 'continue',
    scrollIntoViewThreshold = PX_TRIGGER_DEFAULTS.scrollIntoViewThreshold,
}) => {

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
        // `isIntersecting` is true at ONE visible pixel, so with a threshold above 0 it can never
        // report "out" — read the ratio against the threshold instead (review §13).
        const visible = (entry: IntersectionObserverEntry): boolean =>
            scrollIntoViewThreshold > 0 ? entry.intersectionRatio >= scrollIntoViewThreshold : entry.isIntersecting;
        const observer = new IntersectionObserver(
            ([entry]) => setState(visible(entry) ? 'playing' : outState),
            { threshold: scrollIntoViewThreshold }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [startOn, outAction, scrollIntoViewThreshold]);

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