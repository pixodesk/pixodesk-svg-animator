//
// Path COMMAND consistency for animated `d` — the building blocks the WAAPI branch composes
// (PxAnimatorWebApi: `bezierToSvgPath(bz, /*forceCurves*/ true)` over `normalizePathValue`d
// keyframes). CSS/WAAPI interpolate `path()` values only across IDENTICAL command sequences;
// a corner that is `L` at one keyframe and `C` at another goes DISCRETE. These tests pin
// that any mix of incoming forms yields command-equal output.
//

import { describe, expect, it } from 'vitest';
import { bezierToSvgPath, interpolateBeziers } from './PxAnimatorUtil';
import { parseSvgPathToBezier } from './PxDefinitions';

const commandsOf = (d: string): string => d.replace(/[^MLCZmlcz]/g, '');

const SQUARE_L = 'M20,20L180,20L180,180L20,180Z';
const SQUARE_C = 'M20,20C60,0,140,0,180,20C180,60,180,140,180,180C140,200,60,200,20,180Z';

describe('path command consistency (forceCurves)', () => {

    it('forceCurves emits NO L — straight and curved same-topology paths get EQUAL sequences', () => {
        const straight = parseSvgPathToBezier(SQUARE_L)[0];
        const curved = parseSvgPathToBezier(SQUARE_C)[0];
        const dStraight = bezierToSvgPath(straight, true);
        const dCurved = bezierToSvgPath(curved, true);
        expect(commandsOf(dStraight)).not.toContain('L');
        expect(commandsOf(dStraight)).toBe(commandsOf(dCurved));   // ← the WAAPI requirement
    });

    it('without forceCurves, straight segments stay compact L (static use)', () => {
        const straight = parseSvgPathToBezier(SQUARE_L)[0];
        expect(bezierToSvgPath(straight, false)).toContain('L');
    });

    it('forceCurves lines are geometrically identical: control points sit ON the vertices', () => {
        const straight = parseSvgPathToBezier(SQUARE_L)[0];
        const d = bezierToSvgPath(straight, true);
        // First segment: C with both control points equal to its end vertices.
        expect(d).toContain('C20,20,180,20,180,20');
    });

    it('mid-interpolation between L-derived and C-derived structures stays valid and command-stable', () => {
        const a = parseSvgPathToBezier(SQUARE_L);
        const b = parseSvgPathToBezier(SQUARE_C);
        for (const t of [0, 0.25, 0.5, 0.75, 1]) {
            const mid = interpolateBeziers(a, b, t).map(bz => bezierToSvgPath(bz, true)).join('');
            expect(commandsOf(mid)).toBe(commandsOf(bezierToSvgPath(a[0], true)));
        }
    });

    it('closed paths keep the closing segment command-equal too', () => {
        const straight = parseSvgPathToBezier(SQUARE_L)[0];
        const curved = parseSvgPathToBezier(SQUARE_C)[0];
        expect(straight.c).toBe(true);
        expect(commandsOf(bezierToSvgPath(straight, true)).endsWith('z')).toBe(true);
        expect(commandsOf(bezierToSvgPath(straight, true))).toBe(commandsOf(bezierToSvgPath(curved, true)));
    });
});
