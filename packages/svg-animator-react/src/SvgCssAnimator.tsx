// @px-area entry
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { PxOutOfViewBehavior, PxPlaybackState, PxTriggerAction, PxTriggerEvent, PxWhenFinished } from '@pixodesk/svg-animator-core';
import { resolveGate, resolveTriggers, triggerActionFor, triggerListsEvent } from '@pixodesk/svg-animator-core/engine';
import { createVisibilityGate, type PxVisibilityGate } from '@pixodesk/svg-animator-web/internal';
import { FC, Fragment, ReactNode, useEffect, useRef, useState } from "react";
import type { SvgAnimationPlayerProps } from './SvgAnimator';


/**
 * The props of {@link SvgCssAnimationPlayer} — DERIVED from {@link SvgAnimationPlayerProps}, never a second list: the
 * same names, each the same shape or a narrower one where a class toggle can do less. The type below fails to
 * compile the moment one drifts.
 *
 * | prop | as on `SvgAnimationPlayer`, narrowed to |
 * |---|---|
 * | `playerActionTriggers` | the BLOCK only — a script-free SVG imported as a component carries no triggers the component could read, so there is no `true` |
 * | `timelineOptions` | the gate numbers `inViewThreshold` / `inViewDebounce` |
 * | `actions` | `outOfView` |
 * | `className`, `style` | — (here on the wrapper `<div>`) |
 * | `children` | its own: the SVGR-imported SVG |
 * @public
 */
export type SvgCssAnimationPlayerProps = Pick<SvgAnimationPlayerProps, 'className' | 'style'> & {
    /** WHEN — the triggers block, as on `SvgAnimationPlayer`: `playback.start`, `playback.play`, `playback.stop`,
     *  `playback.pause`, `playback.resume` (derived when left out), each one event or a list. Absent: nothing starts it
     *  (the class toggle waits). */
    playerActionTriggers?: Exclude<SvgAnimationPlayerProps['playerActionTriggers'], boolean>;
    /** The visibility gate's numbers, as in `SvgAnimationPlayer`'s `timelineOptions`: how much must be on screen
     *  (0–1, default 0.5) and for how long, ms (default 150). */
    timelineOptions?: Pick<Extract<NonNullable<SvgAnimationPlayerProps['timelineOptions']>, { type?: 'time' }>, 'inViewThreshold' | 'inViewDebounce'>;
    /** Only `outOfView` applies — `'pause'` (default), `'continue'`, `'stop'` (replays on the next entry). */
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
 * <SvgCssAnimationPlayer playerActionTriggers={{ 'playback.play': 'hoverIn', 'playback.pause': 'hoverOut' }}>
 *   <AnimationSvg />
 * </SvgCssAnimationPlayer>
 * ```
 *
 * The wrapper div carries one of three states via CSS class names:
 * - *(no class)*                        — idle
 * - `px-anim-enabled`                   — paused
 * - `px-anim-enabled px-anim-playing`   — playing
 *
 * The triggers are the JSON player's (dev-docs/plans/playback-layers.md): event lists — `playback.start`, `playback.play`,
 * `playback.stop`, `playback.pause` (`playback.resume` is derived unless named) — over the events `load`, `hoverIn`,
 * `hoverOut`, `click`, read by the same state rule (core's `triggerActionFor`) and gated by the same visibility gate
 * (`createVisibilityGate`), so the two players cannot drift. No `playerActionTriggers`, or an empty block: nothing
 * starts it.
 *
 * ACCEPTED LIMITS of a class toggle (the editor shows them next to the choices):
 * - a start that is not from rest restarts by remounting the wrapper's content (a class cannot rewind keyframes)
 * - the stop is always `jumpToStart` — a class cannot play keyframes backwards or on to their end
 * - there is no `finished` state: the class toggle does not see the CSS animation end
 * - `whenIdle` and `whenFinished` are the file's own CSS
 * @public
 */
const SvgCssAnimationPlayer: FC<SvgCssAnimationPlayerProps> = ({ className, style, children, playerActionTriggers, timelineOptions, actions }) => {
    // one rule with the JSON player: the lists normalised, the gate defaulted
    const resolved = resolveTriggers(playerActionTriggers);
    const gateConfig = resolveGate({ actions, inViewThreshold: timelineOptions?.inViewThreshold, inViewDebounce: timelineOptions?.inViewDebounce });
    const loadPresses = resolved.startPlayback.includes(PxTriggerEvent.load) ? PxTriggerAction.startPlayback
        : resolved.playPlayback.includes(PxTriggerEvent.load) ? PxTriggerAction.playPlayback : undefined;

    const [state, setState] = useState<PxPlaybackState>(PxPlaybackState.off);
    /** Bumped by a start that is not from rest: the new key remounts the content, so the CSS keyframes begin again. */
    const [generation, setGeneration] = useState(0);

    const ref = useRef<HTMLDivElement>(null);
    // The gate is built once per configuration and asks for the CURRENT state, which a closure
    // over `state` could not give it.
    const stateRef = useRef<PxPlaybackState>(state);
    stateRef.current = state;
    const gateRef = useRef<PxVisibilityGate | null>(null);
    /** What the gate did when the graphic left the screen — undone on return unless a button changed the state since. */
    const gateOwesRef = useRef<PxTriggerAction | undefined>(undefined);

    // The buttons on the class state — the JSON player's rules, as far as a class can show them.
    const go = (next: PxPlaybackState): void => { stateRef.current = next; setState(next); };
    const start = (): void => {
        gateOwesRef.current = undefined;
        if (stateRef.current !== PxPlaybackState.off) setGeneration(g => g + 1);   // from the start: remount
        go(PxPlaybackState.playing);
    };
    const play = (): void => {
        gateOwesRef.current = undefined;
        if (stateRef.current !== PxPlaybackState.playing) go(PxPlaybackState.playing);
    };
    const press = (action: PxTriggerAction | undefined): void => {
        switch (action) {
            case PxTriggerAction.startPlayback: start(); break;
            case PxTriggerAction.playPlayback: play(); break;
            case PxTriggerAction.resumePlayback: gateOwesRef.current = undefined; go(PxPlaybackState.playing); break;
            case PxTriggerAction.pausePlayback: gateOwesRef.current = undefined; go(PxPlaybackState.paused); break;
            case PxTriggerAction.stopPlayback: gateOwesRef.current = undefined; go(PxPlaybackState.off); break;
        }
    };

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const gate = createVisibilityGate(el, gateConfig, {
            // the gate presses the real buttons and remembers what it did (1.26)
            leaveView: () => {
                if (stateRef.current !== PxPlaybackState.playing) return;
                if (gateConfig.outOfView === PxOutOfViewBehavior.pause) { go(PxPlaybackState.paused); gateOwesRef.current = PxTriggerAction.resumePlayback; }
                else if (gateConfig.outOfView === PxOutOfViewBehavior.stop) { go(PxPlaybackState.off); gateOwesRef.current = PxTriggerAction.startPlayback; }
            },
            returnToView: () => {
                const owed = gateOwesRef.current;
                gateOwesRef.current = undefined;
                if (owed === PxTriggerAction.resumePlayback && stateRef.current === PxPlaybackState.paused) go(PxPlaybackState.playing);
                else if (owed === PxTriggerAction.startPlayback && stateRef.current === PxPlaybackState.off) go(PxPlaybackState.playing);
            },
        });
        gateRef.current = gate;
        // Only `load` is held by the gate; a hover or a click is aimed at something already seen.
        if (loadPresses !== undefined) gate.requestStart(false, () => press(loadPresses));
        return () => {
            gate.dispose();
            gateRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- the three values stand for `gateConfig`
    }, [loadPresses, gateConfig.outOfView, gateConfig.inViewThreshold, gateConfig.inViewDebounce]);

    /** The state rule — the player's own, on the class state (which has no `finished`). */
    const fire = (event: PxTriggerEvent): void => {
        const action = triggerActionFor(resolved, stateRef.current, event, PxWhenFinished.hold);
        if (action === PxTriggerAction.startPlayback || action === PxTriggerAction.playPlayback) {
            if (gateRef.current) gateRef.current.requestStart(true, () => press(action));
            else press(action);
            return;
        }
        press(action);
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
                state === PxPlaybackState.playing ? 'px-anim-enabled px-anim-playing' :
                    state === PxPlaybackState.paused ? 'px-anim-enabled' : ''
            ].filter(Boolean).join(' ')}
            style={style}
            {...handlers}
        >
            {/* a new key remounts the content, so a restart begins the CSS keyframes again; the wrapper (and the gate on it) stays */}
            <Fragment key={generation}>{children}</Fragment>
        </div>
    );
};
export default SvgCssAnimationPlayer;
