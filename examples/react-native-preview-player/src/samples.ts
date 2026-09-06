/**
 * Built-in sample documents.
 *
 * These are plain Pixodesk animator documents — the same wire format the web
 * player and the editor's JSON export use. Every one of them was verified
 * through the real core pipeline (`materialiseAllInTree` + track compilation)
 * so the demo only ships shapes the RN player can actually render.
 */
import type { PxAnimatedSvgDocument } from '@pixodesk/svg-animator-core';

export interface Sample {
    name: string;
    /** One-line description of what the example demonstrates. */
    note: string;
    doc: PxAnimatedSvgDocument;
}

// ---------------------------------------------------------------------------
// 1. Bouncing ball — eased position + squash/stretch + shadow
// ---------------------------------------------------------------------------

const EASE_OUT: [number, number, number, number] = [0.33, 0, 0.67, 0.33];
const EASE_IN: [number, number, number, number] = [0.33, 0.67, 0.67, 1];

const bouncingBall: PxAnimatedSvgDocument = {
    type: 'svg', viewBox: '0 0 300 300',
    animator: {
        duration: 1400, iterations: 'infinite',
        trigger: { startOn: 'load' },
    },
    children: [
        { type: 'line', x1: 20, y1: 250, x2: 280, y2: 250, stroke: '#ffffff33', 'stroke-width': 2 },
        {
            // Shadow shrinks as the ball rises.
            type: 'ellipse', id: 'shadow', cx: 150, cy: 252, rx: 40, ry: 8, fill: '#00000055',
            animate: {
                rx: {
                    keyframes: [
                        { time: 0, value: 40, easing: EASE_OUT },
                        { time: 700, value: 18, easing: EASE_IN },
                        { time: 1400, value: 40 },
                    ],
                },
                opacity: {
                    keyframes: [
                        { time: 0, value: 0.55, easing: EASE_OUT },
                        { time: 700, value: 0.2, easing: EASE_IN },
                        { time: 1400, value: 0.55 },
                    ],
                },
            },
        },
        {
            type: 'ellipse', id: 'ball', cx: 150, cy: 220, rx: 30, ry: 30, fill: '#0087ff',
            stroke: '#ffffff', 'stroke-width': 3,
            animate: {
                cy: {
                    keyframes: [
                        { time: 0, value: 220, easing: EASE_OUT },
                        { time: 700, value: 70, easing: EASE_IN },
                        { time: 1400, value: 220 },
                    ],
                },
                // Squash on impact, stretch mid-flight.
                rx: {
                    keyframes: [
                        { time: 0, value: 36 },
                        { time: 120, value: 30 },
                        { time: 700, value: 27 },
                        { time: 1280, value: 30 },
                        { time: 1400, value: 36 },
                    ],
                },
                ry: {
                    keyframes: [
                        { time: 0, value: 24 },
                        { time: 120, value: 30 },
                        { time: 700, value: 33 },
                        { time: 1280, value: 30 },
                        { time: 1400, value: 24 },
                    ],
                },
                fill: {
                    keyframes: [
                        { time: 0, value: '#0087ff' },
                        { time: 700, value: '#00d4ff' },
                        { time: 1400, value: '#0087ff' },
                    ],
                },
            },
        },
    ],
};

// ---------------------------------------------------------------------------
// 2. Text along a path — per-letter motion-path with auto-orient (SAMPLED)
// ---------------------------------------------------------------------------

const TEXT = 'PIXODESK ANIMATOR • ';
const TEXT_DURATION = 6000;
/** Curve the letters ride: cubic from P0 to P3 with the two control handles. */
const CURVE = { p0: [20, 170], c1: [90, 30], c2: [210, 30], p3: [280, 170] } as const;

/**
 * One `<g>` per letter, each animated along the SAME curve but offset in time.
 * The keyframes carry spatial tangents + `autoOrient`, so core samples position
 * AND tangent angle per frame — the technique that replaces `<textPath>`
 * `startOffset` animation (which is unusably janky in react-native-svg).
 */
function letterNodes() {
    const chars = TEXT.split('');
    const spacing = TEXT_DURATION / chars.length;
    return chars.map((ch, i) => ({
        type: 'g',
        id: 'letter' + i,
        animate: {
            transform: {
                autoOrient: true,
                keyframes: [
                    {
                        time: 0,
                        value: { translate: [CURVE.p0[0], CURVE.p0[1]] },
                        tangentOut: [CURVE.c1[0] - CURVE.p0[0], CURVE.c1[1] - CURVE.p0[1]],
                    },
                    {
                        time: TEXT_DURATION,
                        value: { translate: [CURVE.p3[0], CURVE.p3[1]] },
                        tangentIn: [CURVE.c2[0] - CURVE.p3[0], CURVE.c2[1] - CURVE.p3[1]],
                    },
                ],
            },
        },
        // Each letter starts its journey later: the loop shifts its timeline.
        meta: { delayIndex: i, spacing },
        children: [{
            type: 'text', text: ch, fill: '#ffd166', 'font-size': 22, 'font-weight': 'bold',
            'text-anchor': 'middle', dy: 7,
        }],
    }));
}

/** Applies the per-letter time offset by shifting each letter's keyframes and
 *  wrapping the sequence so the string scrolls continuously along the curve. */
function shiftedLetters() {
    const nodes = letterNodes();
    const spacing = TEXT_DURATION / nodes.length;
    return nodes.map((node, i) => {
        const shift = i * spacing;
        const kfs = (node.animate.transform.keyframes as Array<any>);
        // TWO passes of the curve, the first starting before t=0: a letter that
        // reaches the end mid-iteration snaps back to the start and rides again,
        // so the string scrolls continuously. Keyframes outside [0, duration]
        // are intentional — they define the in-progress state at the edges and
        // must NOT be trimmed, or the letter freezes for the remainder.
        const shifted = [
            { ...kfs[0], time: -shift },
            { ...kfs[1], time: TEXT_DURATION - shift },
            { ...kfs[0], time: TEXT_DURATION - shift + 1 },
            { ...kfs[1], time: 2 * TEXT_DURATION - shift },
        ];
        return { ...node, animate: { transform: { ...node.animate.transform, keyframes: shifted } } };
    });
}

const textAlongPath: PxAnimatedSvgDocument = {
    type: 'svg', viewBox: '0 0 300 300',
    animator: {
        duration: TEXT_DURATION, iterations: 'infinite',
        trigger: { startOn: 'load' },
    },
    children: [
        {
            type: 'path',
            d: 'M ' + CURVE.p0[0] + ' ' + CURVE.p0[1] +
                ' C ' + CURVE.c1[0] + ' ' + CURVE.c1[1] +
                ' ' + CURVE.c2[0] + ' ' + CURVE.c2[1] +
                ' ' + CURVE.p3[0] + ' ' + CURVE.p3[1],
            stroke: '#0087ff55', 'stroke-width': 2, fill: 'none',
        },
        ...shiftedLetters(),
        {
            type: 'text', x: 150, y: 250, text: 'sampled per-letter motion path',
            fill: '#8899aa', 'font-size': 11, 'text-anchor': 'middle',
        },
    ],
};

// ---------------------------------------------------------------------------
// 3. Trim path — draw-on stroke via the strokeTrim effect
// ---------------------------------------------------------------------------

const strokeTrim: PxAnimatedSvgDocument = {
    type: 'svg', viewBox: '0 0 300 300',
    animator: {
        duration: 2600, iterations: 'infinite',
        trigger: { startOn: 'load' },
    },
    children: [
        // Faint full path underneath so the trim is obvious.
        {
            type: 'path',
            d: 'M 40 220 C 40 60 120 40 150 120 C 180 200 220 210 260 90',
            stroke: '#ffffff22', 'stroke-width': 8, fill: 'none', 'stroke-linecap': 'round',
        },
        {
            type: 'path', id: 'drawn',
            d: 'M 40 220 C 40 60 120 40 150 120 C 180 200 220 210 260 90',
            stroke: '#0ea5e9', 'stroke-width': 8, fill: 'none', 'stroke-linecap': 'round',
            effects: {
                strokeTrim: {
                    range: {
                        keyframes: [
                            { time: 0, value: [0, 0], easing: [0.4, 0, 0.2, 1] },
                            { time: 1300, value: [0, 1], easing: [0.4, 0, 0.2, 1] },
                            { time: 2600, value: [1, 1] },
                        ],
                    },
                },
            },
        },
        {
            type: 'circle', id: 'trimDot', cx: 40, cy: 220, r: 7, fill: '#ffd166',
            animate: {
                opacity: {
                    keyframes: [
                        { time: 0, value: 1 },
                        { time: 1300, value: 1 },
                        { time: 1500, value: 0 },
                        { time: 2600, value: 0 },
                    ],
                },
            },
        },
    ],
};

// ---------------------------------------------------------------------------
// 4. Repeater + transform stack
// ---------------------------------------------------------------------------

const repeater: PxAnimatedSvgDocument = {
    type: 'svg', viewBox: '0 0 300 300',
    animator: {
        duration: 2000, iterations: 'infinite', direction: 'alternate',
        trigger: { startOn: 'load' },
    },
    children: [
        {
            type: 'rect', id: 'tile', x: 20, y: 130, width: 30, height: 30, rx: 5, fill: '#6366f1',
            animate: {
                opacity: { keyframes: [{ time: 0, value: 1 }, { time: 2000, value: 0.25 }] },
                fill: { keyframes: [{ time: 0, value: '#6366f1' }, { time: 2000, value: '#ec4899' }] },
            },
            effects: { repeater: { copies: 6, translate: [42, 0], rotate: 12 } },
        },
        {
            // Nested transform stack: static translate → animated rotate →
            // animated scale, one transform function per level.
            type: 'g', transform: 'translate(150,70)',
            children: [{
                type: 'g', id: 'orbitSpin',
                animate: { rotate: { keyframes: [{ time: 0, value: 0 }, { time: 2000, value: 360 }] } },
                children: [{
                    type: 'g', id: 'orbitScale',
                    animate: { scale: { keyframes: [{ time: 0, value: [1, 1] }, { time: 2000, value: [1.6, 1.6] }] } },
                    children: [
                        { type: 'rect', x: -18, y: -18, width: 36, height: 36, rx: 6, fill: '#ff6b35' },
                        { type: 'circle', cx: 0, cy: -34, r: 6, fill: '#ffd166' },
                    ],
                }],
            }],
        },
        {
            type: 'text', x: 150, y: 250, text: 'repeater copies + nested transforms',
            fill: '#8899aa', 'font-size': 11, 'text-anchor': 'middle',
        },
    ],
};

// ---------------------------------------------------------------------------
// 5. Animated gradient
// ---------------------------------------------------------------------------

const gradient: PxAnimatedSvgDocument = {
    type: 'svg', viewBox: '0 0 300 300',
    animator: {
        duration: 3000, iterations: 'infinite', direction: 'alternate',
        trigger: { startOn: 'load' },
    },
    children: [
        {
            type: 'rect', id: 'grad', x: 30, y: 60, width: 240, height: 180, rx: 16,
            effects: {
                fillGradient: {
                    type: 'linear', start: [30, 60], end: [270, 240],
                    gradientUnits: 'userSpaceOnUse',
                    stops: {
                        keyframes: [
                            { time: 0, value: [{ offset: 0, color: '#3b82f6' }, { offset: 0.5, color: '#8b5cf6' }, { offset: 1, color: '#ec4899' }] },
                            { time: 3000, value: [{ offset: 0, color: '#10b981' }, { offset: 0.5, color: '#84cc16' }, { offset: 1, color: '#f59e0b' }] },
                        ],
                    },
                },
            },
        },
        {
            type: 'circle', id: 'gradDot', cx: 150, cy: 150, r: 26, fill: '#ffffffcc',
            animate: {
                r: { keyframes: [{ time: 0, value: 20 }, { time: 3000, value: 44 }] },
                opacity: { keyframes: [{ time: 0, value: 0.85 }, { time: 3000, value: 0.35 }] },
            },
        },
        {
            type: 'text', x: 150, y: 275, text: 'animated gradient stops',
            fill: '#8899aa', 'font-size': 11, 'text-anchor': 'middle',
        },
    ],
};

// ---------------------------------------------------------------------------
// 6. Path morph (shape interpolation)
// ---------------------------------------------------------------------------

const morph: PxAnimatedSvgDocument = {
    type: 'svg', viewBox: '0 0 300 300',
    animator: {
        duration: 2400, iterations: 'infinite', direction: 'alternate',
        trigger: { startOn: 'load' },
    },
    children: [
        {
            // Position lives on a wrapper `<g>`: a static `transform` attribute
            // on the SAME node as an animated `rotate` would be overwritten —
            // both compose into the one `transform` prop. One transform
            // function per nesting level is the rule.
            type: 'g', transform: 'translate(150,140)',
            children: [{
                type: 'path', id: 'morphShape',
                fill: '#ec4899',
                animate: {
                    d: {
                        keyframes: [
                            { time: 0, value: 'M-70,0 L0,-70 L70,0 L0,70 Z', easing: [0.4, 0, 0.2, 1] },
                            { time: 2400, value: 'M-70,-70 L70,-70 L70,70 L-70,70 Z' },
                        ],
                    },
                    fill: {
                        keyframes: [
                            { time: 0, value: '#ec4899' },
                            { time: 2400, value: '#0ea5e9' },
                        ],
                    },
                    rotate: {
                        keyframes: [{ time: 0, value: 0 }, { time: 2400, value: 90 }],
                    },
                },
            }],
        },
        {
            type: 'text', x: 150, y: 265, text: 'path morph (frames-only feature)',
            fill: '#8899aa', 'font-size': 11, 'text-anchor': 'middle',
        },
    ],
};

// ---------------------------------------------------------------------------

export const SAMPLES: Array<Sample> = [
    { name: 'Bouncing ball', note: 'eased position, squash & stretch, colour', doc: bouncingBall },
    { name: 'Text along path', note: 'per-letter motion path, sampled + auto-orient', doc: textAlongPath },
    { name: 'Trim path', note: 'draw-on stroke via the strokeTrim effect', doc: strokeTrim },
    { name: 'Repeater', note: 'repeater copies + nested transform stack', doc: repeater },
    { name: 'Gradient', note: 'animated gradient stops', doc: gradient },
    { name: 'Path morph', note: 'shape interpolation between two paths', doc: morph },
];
