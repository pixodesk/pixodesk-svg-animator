/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { PxAnimatedSvgDocumentSchema } from './PxAnimatorSchemas';

export type FillMode = 'forwards' | 'backwards' | 'both' | 'none';

export type PlaybackDirection = 'normal' | 'reverse' | 'alternate' | 'alternate-reverse';

export const PX_ANIM_SRC_ATTR_NAME = 'data-px-animation-src';

export const PX_ANIM_ATTR_NAME = '_px_animator';

export type StartOn = 'load' | 'mouseOver' | 'click' | 'scrollIntoView';
type StartOnExtra = StartOn | 'programmatic';

export type OutAction = 'continue' | 'pause' | 'reset' | 'reverse';

export type JsMode = "auto" | "webapi" | "frames";


export const ANIMATE_ATTR = 'animate';
export const TEXT_ATTR = 'text';
export const TEXT_CONTENT_ATTR = 'textContent';

// Attributes that should not be set on DOM elements (internal use only)
export const INTERNAL_ATTRS = new Set([
    'type', 'children', ANIMATE_ATTR, 'animator', 'meta', 'defs', 'bindings', TEXT_ATTR, TEXT_CONTENT_ATTR
]);


/**
 * Easing function definition.
 * Can be a named reference to a predefined easing or a cubic-bezier array [x1, y1, x2, y2].
 *
 * @example "ease-in" | "easeOut" | [0.68, -0.55, 0.265, 1.55]
 */
export type PxEasingOrRef = string | [number, number, number, number];

/**
 * A single animation keyframe defining the state at a specific point in time.
 * Supports both full property names and short aliases for compact notation.
 */
export interface PxKeyframe {
    /** Timestamp in milliseconds from animation start */
    time?: number;

    /** Short alias for "time" */
    t?: number;

    /** The value of the animated property at this keyframe */
    value?: any;

    /** Short alias for "value" */
    v?: any;

    /** Easing function to use when transitioning to this keyframe from the previous one */
    easing?: PxEasingOrRef;

    /** Short alias for "easing" */
    e?: PxEasingOrRef;
}


/**
 * Defines how a property's keyframe animation is extended beyond its defined keyframe range
 * by continuously repeating a chosen segment of the sequence.
 *
 * The repeated segment is a contiguous run of keyframe *intervals* (gaps between consecutive
 * keyframes). Which end of the sequence is repeated is controlled by `before`, and whether
 * each repetition plays in the same direction or alternates is controlled by `alternate`.
 */
export interface PxLoop {

    /**
     * Number of keyframe intervals (gaps between consecutive keyframes) that form the repeating
     * segment.
     *
     * - `undefined` → the entire keyframe sequence is used as the loop segment.
     * - `N`         → only the first `N` intervals (when `before: true`) or the last `N` intervals
     *                 (when `before: false`) are looped. Clamped to `[1, keyframes.length - 1]`.
     */
    segmentCount?: number;

    /**
     * Selects which end of the keyframe sequence is looped.
     *
     * - `true`  → the source segment is taken from the *start* of the keyframe sequence.
     *             The animation is extended *before* the first keyframe — useful for intro loops
     *             that run before the main timeline begins.
     *
     * - `false` (default) → the source segment is taken from the *end* of the keyframe sequence.
     *             The animation is extended *after* the last keyframe — useful for idle or outro
     *             loops that continue once the main timeline has finished.
     */
    before?: boolean;

    /**
     * Controls playback direction on each successive loop iteration.
     *
     * - `false` (default) → **cycle**: every iteration replays the segment in the same direction.
     *
     * - `true`  → **pingpong**: iterations alternate between forward and backward playback
     *             (even iterations play forward, odd iterations play in reverse).
     */
    alternate?: boolean;
}

/**
 * Animation definition for a single CSS/SVG property.
 * Contains an array of keyframes that define how the property changes over time.
 */
export interface PxPropertyAnimation {
    /** Array of keyframes defining the animation timeline */
    keyframes?: PxKeyframe[];

    /** Short alias for "keyframes" */
    kfs?: PxKeyframe[];

    /** Optional loop configuration. When set, the keyframe sequence is extended beyond its defined
     *  range by repeating a chosen segment. See {@link PxLoop} for details. */
    loop?: PxLoop | boolean;
}

/**
 * Complete animation definition containing one or more property animations.
 * Each key is a CSS/SVG property name (e.g., "opacity", "scale", "rotate").
 *
 * @example
 * {
 *   "opacity": { keyframes: [...] },
 *   "scale": { keyframes: [...] }
 * }
 */
export interface PxAnimationDefinition {
    [property: string]: PxPropertyAnimation;
}

/**
 * Defines when and how an animation should be triggered.
 */
export interface PxTrigger {
    /** Event that starts the animation */
    startOn?: StartOnExtra;

    /** Action to take when the trigger condition is no longer met (e.g., mouse leaves) */
    outAction?: 'continue' | 'pause' | 'reset' | 'reverse';

    /** Percentage of element visibility required to trigger (0-1). Only applies to scrollIntoView. */
    scrollIntoViewThreshold?: number;
}

/**
 * Global animation configuration that applies to all animations in the document.
 * Defines timing, playback behavior, and rendering strategy.
 */
export interface PxAnimatorConfig {
    /** JavaScript animation implementation strategy */
    mode?: JsMode;

    /** Total animation duration in milliseconds */
    duration?: number;

    /** Delay before animation starts in milliseconds */
    delay?: number;

    /** Number of times to repeat the animation. Use "infinite" for endless loop. */
    iterations?: number | "infinite";

    /**
     * Defines which values are applied before/after the active animation period
     * (maps directly to the Web Animations API `fill` option).
     * Defaults to `'forwards'` when not set so that elements hold their final
     * state after the animation ends — consistent with Lottie and other animation
     * runtimes. Without this default, seeking to the last frame would cause
     * elements to revert to their pre-animation state.
     */
    fill?: FillMode;

    /** Direction of animation playback */
    direction?: PlaybackDirection;

    /** Target frame rate for frame-based animations (only applicable when mode="frames") */
    frameRate?: number;

    /** Trigger configuration for when animation should start */
    trigger?: PxTrigger;

    debug?: boolean; // FIXME - implement

    debugInstName?: string; // FIXME - implement
}

/**
 * Reusable definitions library for easings, animations, and styles.
 * Allows to define once and referencing by name.
 */
export interface PxDefs {
    /** Named cubic-bezier easing functions */
    easings?: {
        [name: string]: [number, number, number, number];
    };

    /** Named animation definitions that can be referenced by elements */
    animations?: {
        [name: string]: PxAnimationDefinition;
    };

    /** 
     * FIXME - do we need it?
     * Named style presets for common styling patterns 
     */
    styles?: {
        [name: string]: Record<string, string | number>;
    };
}

/**
 * Element animation specification.
 * Can be:
 * - A string referencing a named animation from defs
 * - An array of named animation references
 * - An inline PxAnimationDefinition object
 * - A mixed array of references and inline definitions
 *
 * @example
 * "fadeIn"
 * ["fadeIn", "spin"]
 * { opacity: { keyframes: [...] } }
 * ["fadeIn", { scale: { keyframes: [...] } }]
 */
export type PxElementAnimation =
    | string
    | string[]
    | PxAnimationDefinition
    | (string | PxAnimationDefinition)[];

/**
 * Base interface for all SVG elements.
 * Represents a node in the SVG tree with optional animations and children.
 */
export interface PxNode {
    /** SVG element type (e.g., "circle", "rect", "path", "g") */
    type: string;

    /** Child elements (for container elements like <g>) */
    children?: PxNode[];

    /** Animation applied to this element */
    animate?: PxElementAnimation;

    /** 
     * FIXME - do we need it?
     * Style applied to this element (named reference or inline object) 
     */
    style?: string | Record<string, string | number>;

    /** All other SVG attributes (cx, cy, r, fill, stroke, etc.) */
    [key: string]: any;
}

/**
 * Binds animations to existing DOM elements via CSS selectors.
 * Used when the SVG tree is pre-rendered and animations are applied separately.
 */
export interface PxBinding {
    /** ID targeting elements in the DOM (data-px-id="...") */
    id: string;

    /** Animation to apply to matched elements */
    animate: PxElementAnimation;
}

/**
 * Root SVG element containing the entire animated graphic.
 * Extends PxNode with SVG-specific properties and global configuration.
 */
export interface PxSvgNode extends PxNode {

    /** FIXME - do we need it? 
     * SVG viewport width */
    width?: number;

    /** FIXME - do we need it? 
     * SVG viewport height */
    height?: number;

    /** FIXME - do we need it? 
     * SVG viewBox attribute defining coordinate system */
    viewBox?: string;

    /** Global animation configuration */
    animator?: PxAnimatorConfig;

    /** Reusable definitions library */
    defs?: PxDefs;

    /** Animation bindings for pre-rendered DOM elements */
    bindings?: PxBinding[];

    design?: PxNode;
}

/**
 * The complete animated SVG document.
 * This is the root type for the entire file format.
 */
export interface PxAnimatedSvgDocument extends PxSvgNode {
}

// ============================================================================
// API INTERFACES
// ============================================================================

/** A configuration object for animation lifecycle callbacks. */
export interface PxAnimatorCallbacksConfig {

    /** Callback executed when the animation starts or resumes. */
    onPlay?: () => void;

    /** Callback executed when the animation is paused. */
    onPause?: () => void;

    /** Callback executed when the animation is cancelled. */
    onCancel?: () => void;

    /** Callback executed when the animation finishes naturally. */
    onFinish?: () => void;

    /** Callback executed when the animation is removed. */
    onRemove?: () => void;
}


export type PxPoint2D = Array<number>;

/** Represents a vector path for SVG shape animations. */
export interface PxBezierPath {

    /** An array of vertex points [[x, y], ...]. */
    v: Array<PxPoint2D>;

    /** An array of 'in' tangent handles for each vertex [[x, y], ...]. */
    i?: Array<PxPoint2D>;

    /** An array of 'out' tangent handles for each vertex [[x, y], ...]. */
    o?: Array<PxPoint2D>;

    /** A boolean indicating if the path is closed. */
    c?: boolean;
}

/** Basic animation controls common to all animator types. */
export interface PxBasicAnimatorAPI {

    isReady(): boolean;

    /** Returns the root HTML element for the animation. */
    getRootElement(): Element | null;

    /** Returns true if the animation is currently running. */
    isPlaying(): boolean;

    /** Starts or resumes the animation. */
    play(): void;

    /** Pauses the animation at its current state. */
    pause(): void;

    /** Stops the animation and resets it to its initial state. */
    cancel(): void;

}

/** The full programmatic control interface for an animation. */
export interface PxAnimatorAPI extends PxBasicAnimatorAPI {

    /** Jumps to the end of the animation and holds the final state. */
    finish(): void;

    /** Changes the speed of the animation. 1 is normal, 2 is double, -1 is reverse. */
    setPlaybackRate(rate: number): void;

    /** Returns the current playback time in milliseconds. */
    getCurrentTime(): number | null;

    /** Jumps to a specific time (in milliseconds) in the animation. */
    setCurrentTime(time: number): void;

    /** Stops the animation and cleans up all associated resources. */
    destroy(): void;
}


// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function isPxElementFileFormat(fileJson: any): fileJson is PxAnimatedSvgDocument {
    if (!(
        fileJson &&
        typeof fileJson === 'object' &&
        !Array.isArray(fileJson)
    )) {
        return false;
    }

    return fileJson['type'] === 'svg' || fileJson['tagName'] === 'svg';
}


// ============================================================================
// DEEP VALIDATION
// ============================================================================

export interface PxValidationResult {
    valid: boolean;
    errors: string[];
}

/**
 * Deep validation of PxAnimatedSvgDocument using the PxAnimatedSvgDocumentSchema.
 * @returns PxValidationResult with valid flag and array of error messages
 */
export function isPxElementFileFormatDeep(fileJson: any): PxValidationResult {
    const valid: boolean = PxAnimatedSvgDocumentSchema.isValid(fileJson);
    return { valid, errors: valid ? [] : ['Document failed schema validation'] };
}

export function getAnimatorConfig(doc: PxAnimatedSvgDocument): PxAnimatorConfig | undefined {
    return (
        doc?.animator || doc?.meta?.animator ||
        doc?.animation || doc?.meta?.animation // FIXME - decide on the name
    );
}

export function getDefs(doc: PxAnimatedSvgDocument): PxDefs | undefined {
    if (!doc) return undefined;
    return doc.defs || doc.meta?.defs;
}

export function getBindings(doc: PxAnimatedSvgDocument): PxBinding[] | undefined {
    if (!doc) return undefined;
    return doc.bindings || doc.meta?.bindings;
}

// FIXME - do we need it?
export function getChildren(doc: PxAnimatedSvgDocument): PxNode[] | undefined {
    return doc?.children;
}
