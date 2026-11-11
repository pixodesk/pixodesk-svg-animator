// @px-area entry
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { PxRunState, PxTriggerAction, PxTriggerEvent } from '@pixodesk/svg-animator-core';
import { resolveGate, resolveTriggers, triggerActionFor, triggerListsEvent } from '@pixodesk/svg-animator-core/engine';
import { createVisibilityGate, type PxVisibilityGate } from '@pixodesk/svg-animator-web/internal';
import { FC, ReactNode, useEffect, useRef, useState } from "react";
import type { SvgAnimationPlayerProps } from './SvgAnimator';


/**
 * The props of {@link SvgCssAnimationPlayer} — DERIVED from {@link SvgAnimationPlayerProps}, never a second list: the
 * same names, each the same shape or a narrower one where a class toggle can do less. The type below fails to
 * compile the moment one drifts.
 *
 * | prop | as on `SvgAnimationPlayer`, narrowed to |
 * |---|---|
 * | `playUsingActionTriggers` | the BLOCK only — a script-free SVG imported as a component carries no triggers the component could read, so there is no `true` |
 * | `timelineOptions` | the gate numbers `inViewThreshold` / `inViewDebounce` |
 * | `actions` | `outOfView` |
 * | `className`, `style` | — (here on the wrapper `<div>`) |
 * | `children` | its own: the SVGR-imported SVG |
 * @public
 */
export type SvgCssAnimationPlayerProps = Pick<SvgAnimationPlayerProps, 'className' | 'style'> & {
    /** WHEN — the triggers block, as on `SvgAnimationPlayer`: `startRun`, `stopRun`, `pauseRun`, `resumeRun` (derived when left
     *  out), each one event or a list. Absent: nothing starts it (the class toggle waits). */
    playUsingActionTriggers?: Exclude<SvgAnimationPlayerProps['playUsingActionTriggers'], boolean>;
    /** The visibility gate's numbers, as in `SvgAnimationPlayer`'s `timelineOptions`: how much must be on screen
     *  (0–1, default 0.5) and for how long, ms (default 150). */
    timelineOptions?: Pick<Extract<NonNullable<SvgAnimationPlayerProps['timelineOptions']>, { type?: 'time' }>, 'inViewThreshold' | 'inViewDebounce'>;
    /** Only `outOfView` applies — `'pause'` (default), `'continue'`, `'jumpToStart'` (replays on the next entry). */
    actions?: Pick<NonNullable<SvgAnimationPlayerProps['actions']>, 'outOfView'>;
    /** The SVGR-imported SVG component to animate. */
    children: ReactNode;
};

/** The guard: every CSS-component prop is an `SvgAnimationPlayer` prop (no name of its own) of a compatible shape —
 *  rename or reshape one there and this stops compiling. @internal */
export type _SvgCssPropsAreSvgAnimationPlayerProps = [
    AssertNever<Exclude<keyof SvgCssAnimationPlayerProps, keyof SvgAnimationPlayerProps | 'children'>>,
    AssertAssignable<Omit<SvgCssAnimationPlayerProps, 'children'>, Partial<SvgAnimationPlayerProps>>,
];
/** Compiles only when `T` is assignable to `U`. */
type AssertAssignable<T extends U, U> = T;
/** Compiles only when `T` is `never` — here: no prop name the JS component lacks. */
type AssertNever<T extends never> = T;

/**
 * Controls playback of SVG+CSS animated files by toggling class names on a wrapper div — the script-free sibling of
 * {@link SvgAnimationPlayer} (which plays the JSON document): the SAME prop names ({@link SvgCssAnimationPlayerProps}),
 * fewer of them.
 *
 * Intended for use with SVG files exported from the Pixodesk editor using the
 * **CSS Keyframes** (no `<script>` tag). Import the SVG as a React component
 * via SVGR (`vite-plugin-svgr` or `@svgr/webpack`) and pass it as `children`:
 *
 * ```tsx
 * import AnimationSvg from './animation.svg?react'; // SVGR
 *
 * <SvgCssAnimationPlayer playUsingActionTriggers={{ startRun: 'hoverIn', pauseRun: 'hoverOut' }}>
 *   <AnimationSvg />
 * </SvgCssAnimationPlayer>
 * ```
 *
 * The wrapper div carries one of three states via CSS class names:
 * - *(no class)*                        — idle
 * - `px-anim-enabled`                   — paused
 * - `px-anim-enabled px-anim-playing`   — playing
 *
 * The triggers are the JSON player's (dev-docs/plans/playback-layers.md): event lists — `startRun`, `stopRun`,
 * `pauseRun` (`resumeRun` is derived unless named) — over the events `load`, `hoverIn`, `hoverOut`, `click`,
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
const SvgCssAnimationPlayer: FC<SvgCssAnimationPlayerProps> = ({ className, style, children, playUsingActionTriggers, timelineOptions, actions }) => {
    // one rule with the JSON player: the lists normalised, the gate defaulted
    const resolved = resolveTriggers(playUsingActionTriggers);
    const gateConfig = resolveGate({ actions, inViewThreshold: timelineOptions?.inViewThreshold, inViewDebounce: timelineOptions?.inViewDebounce });
    const playsOnLoad = resolved.startRun.includes(PxTriggerEvent.load);

    const [state, setState] = useState<PxRunState>(PxRunState.off);

    const ref = useRef<HTMLDivElement>(null);
    // The gate is built once per configuration and asks for the CURRENT state, which a closure
    // over `state` could not give it.
    const stateRef = useRef<PxRunState>(state);
    stateRef.current = state;
    const gateRef = useRef<PxVisibilityGate | null>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const gate = createVisibilityGate(el, gateConfig, {
            isPlaying: () => stateRef.current === PxRunState.playing,
            start: () => setState(PxRunState.playing),
            hold: () => setState(PxRunState.paused),
            release: () => setState(PxRunState.playing),
            jumpToStart: () => setState(PxRunState.off),
        });
        gateRef.current = gate;
        // Only `load` is held by the gate; a hover or a click is aimed at something already seen.
        if (playsOnLoad) gate.requestStart(false);
        return () => {
            gate.dispose();
            gateRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- the three values stand for `gateConfig`
    }, [playsOnLoad, gateConfig.outOfView, gateConfig.inViewThreshold, gateConfig.inViewDebounce]);

    /** The state rule — the player's own, on the class state. */
    const fire = (event: PxTriggerEvent): void => {
        switch (triggerActionFor(resolved, stateRef.current, event)) {
            case PxTriggerAction.startRun:
                if (gateRef.current) gateRef.current.requestStart(true);
                else setState(PxRunState.playing);
                break;
            case PxTriggerAction.resumeRun: setState(PxRunState.playing); break;
            case PxTriggerAction.pauseRun: setState(PxRunState.paused); break;
            case PxTriggerAction.stopRun: setState(PxRunState.off); break;
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
                state === PxRunState.playing ? 'px-anim-enabled px-anim-playing' :
                    state === PxRunState.paused ? 'px-anim-enabled' : ''
            ].filter(Boolean).join(' ')}
            style={style}
            {...handlers}
        >
            {children}
        </div>
    );
};
export default SvgCssAnimationPlayer;
