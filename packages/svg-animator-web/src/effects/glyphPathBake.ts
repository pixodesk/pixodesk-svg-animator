/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/


/**
 * Bakes an affine transform into an SVG path-`d` string so per-glyph outlines
 * (in em units) can be placed at their pen position and merged into a single
 * `<path>`. Parses the absolute `M`/`L`/`C`/`Q`/`Z` commands opentype's
 * `toPathData` emits — glyph outlines never use relative or arc commands.
 *
 * Matrix order matches SVG: `x' = a·x + c·y + e`, `y' = b·x + d·y + f`.
 * For horizontal text it's just scale+translate `[s,0,0,s,tx,ty]`; the full
 * 6-tuple leaves room for rotation (along-path, later).
 */
export type Affine = [a: number, b: number, c: number, d: number, e: number, f: number];


function fmt(v: number, decimals: number): string {
    // Match opentype's `floatToString`: integers stay bare, else fixed decimals.
    return Math.round(v) === v ? '' + Math.round(v) : v.toFixed(decimals);
}

/** Packs numbers the way opentype does: a space separates a value from the
 *  previous one only when it doesn't already start with a `-`. */
function pack(nums: Array<number>, decimals: number): string {
    let s = '';
    for (let i = 0; i < nums.length; i++) {
        const str = fmt(nums[i], decimals);
        if (i > 0 && str.charCodeAt(0) !== 45 /* '-' */) s += ' ';
        s += str;
    }
    return s;
}

function apply(m: Affine, x: number, y: number): [number, number] {
    return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

const TOKEN_RE = /([MLCQZ])|(-?\d*\.?\d+(?:e[-+]?\d+)?)/gi;

/**
 * Applies `m` to every coordinate in `d` (absolute M/L/C/Q/Z) and re-emits.
 * Unknown tokens are skipped defensively; the input is always opentype output.
 */
export function transformPathData(d: string, m: Affine, decimals: number = 2): string {
    const tokens: Array<string> = [];
    let match: RegExpExecArray | null;
    TOKEN_RE.lastIndex = 0;
    while ((match = TOKEN_RE.exec(d)) !== null) tokens.push(match[0]);

    let out = '';
    let i = 0;
    const num = (): number => parseFloat(tokens[i++]);

    while (i < tokens.length) {
        const cmd = tokens[i++];
        if (cmd === 'M' || cmd === 'L') {
            const [x, y] = apply(m, num(), num());
            out += cmd + pack([x, y], decimals);
        } else if (cmd === 'C') {
            const [x1, y1] = apply(m, num(), num());
            const [x2, y2] = apply(m, num(), num());
            const [x, y] = apply(m, num(), num());
            out += 'C' + pack([x1, y1, x2, y2, x, y], decimals);
        } else if (cmd === 'Q') {
            const [x1, y1] = apply(m, num(), num());
            const [x, y] = apply(m, num(), num());
            out += 'Q' + pack([x1, y1, x, y], decimals);
        } else if (cmd === 'Z' || cmd === 'z') {
            out += 'Z';
        }
        // else: stray number without a command — skip (never happens for glyph data).
    }
    return out;
}
