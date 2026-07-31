/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

/**
 * SVG transform string → 2D affine matrix, in the order react-native-svg's
 * native side expects: `[a, b, c, d, e, f]`, i.e. SVG's own `matrix(…)` order
 *
 * ```
 *   | a  c  e |
 *   | b  d  f |
 *   | 0  0  1 |
 * ```
 *
 * WHY THIS EXISTS: react-native-svg parses a `transform` STRING into this matrix
 * in JavaScript, inside `extractTransform`, during render. Values delivered
 * through reanimated's `animatedProps` bypass that JS step and reach the native
 * view directly, where a raw string is meaningless — an animated transform
 * simply does nothing. Feeding the matrix instead makes the animated and static
 * paths agree. (On the web the DOM parses the string itself, which is why this
 * only shows up on a device.)
 */
export type Mat2D = [number, number, number, number, number, number];

export const IDENTITY: Mat2D = [1, 0, 0, 1, 0, 0];

const DEG = Math.PI / 180;

/** `m1 · m2` — apply m2 first, then m1 (same convention as SVG's left-to-right list). */
function multiply(m1: Mat2D, m2: Mat2D): Mat2D {
    const [a1, b1, c1, d1, e1, f1] = m1;
    const [a2, b2, c2, d2, e2, f2] = m2;
    return [
        a1 * a2 + c1 * b2,
        b1 * a2 + d1 * b2,
        a1 * c2 + c1 * d2,
        b1 * c2 + d1 * d2,
        a1 * e2 + c1 * f2 + e1,
        b1 * e2 + d1 * f2 + f1,
    ];
}

/** Splits `translate(1,2)rotate(45)` into `[['translate',[1,2]], ['rotate',[45]]]`. */
const FN_RE = /([a-zA-Z]+)\s*\(([^)]*)\)/g;

function numbers(raw: string): Array<number> {
    return raw
        .split(/[\s,]+/)
        .filter(s => s.length > 0)
        .map(Number)
        .filter(n => Number.isFinite(n));
}

/**
 * Parses an SVG transform list. Returns `undefined` when the string contains no
 * recognisable function, so callers can leave the original value untouched
 * rather than silently replacing it with an identity matrix.
 */
export function svgTransformToMatrix(value: string): Mat2D | undefined {
    let m: Mat2D | undefined;
    FN_RE.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = FN_RE.exec(value)) !== null) {
        const fn = match[1].toLowerCase();
        const n = numbers(match[2]);
        let step: Mat2D | undefined;

        switch (fn) {
            case 'translate':
                step = [1, 0, 0, 1, n[0] || 0, n[1] || 0];
                break;
            case 'scale': {
                const sx = n[0] ?? 1;
                const sy = n.length > 1 ? n[1] : sx;
                step = [sx, 0, 0, sy, 0, 0];
                break;
            }
            case 'rotate': {
                const rad = (n[0] || 0) * DEG;
                const cos = Math.cos(rad), sin = Math.sin(rad);
                const rot: Mat2D = [cos, sin, -sin, cos, 0, 0];
                if (n.length >= 3) {
                    // rotate(a, cx, cy) == translate(cx,cy) rotate(a) translate(-cx,-cy)
                    const cx = n[1], cy = n[2];
                    step = multiply(multiply([1, 0, 0, 1, cx, cy], rot), [1, 0, 0, 1, -cx, -cy]);
                } else {
                    step = rot;
                }
                break;
            }
            case 'skewx':
                step = [1, 0, Math.tan((n[0] || 0) * DEG), 1, 0, 0];
                break;
            case 'skewy':
                step = [1, Math.tan((n[0] || 0) * DEG), 0, 1, 0, 0];
                break;
            case 'matrix':
                if (n.length >= 6) step = [n[0], n[1], n[2], n[3], n[4], n[5]];
                break;
            default:
                step = undefined;   // unknown function — ignore it
        }

        if (step) m = m ? multiply(m, step) : step;
    }

    return m;
}
