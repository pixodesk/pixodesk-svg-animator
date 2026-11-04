/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// ONE control-mode rule for react / vue / rn (API review §1 and §7).
//
// Each component used to pick its own order: React `apiRef → playUsingActionTriggers → showAtProgress/showAtTime →
// play/pause`, Vue `playUsingActionTriggers → showAtProgress/showAtTime → play/pause`, React Native `showAtProgress/showAtTime →
// play/pause → playUsingActionTriggers`. So `playUsingActionTriggers` + `progress={0.5}` played on two and seeked on the
// third, and React let a REF decide the mode — which silently disabled `playUsingActionTriggers`.

import { describe, expect, it } from 'vitest';
import { PxControlMode, controlModeTakesOverTrigger, resolveControlMode } from './PxAnimatorConstants';

describe('resolveControlMode — precedence', () => {

    it('no control props → static, the document decides', () => {
        expect(resolveControlMode({})).toEqual({ mode: PxControlMode.static, warnings: [] });
    });

    it('progress / time win over everything', () => {
        expect(resolveControlMode({ showAtProgress: 0.5 }).mode).toBe(PxControlMode.fixedTime);
        expect(resolveControlMode({ showAtTime: 250 }).mode).toBe(PxControlMode.fixedTime);
        expect(resolveControlMode({ showAtProgress: 0.5, playWhile: true, playUsingActionTriggers: true }).mode).toBe(PxControlMode.fixedTime);
    });

    it('play / pause win over playUsingActionTriggers', () => {
        expect(resolveControlMode({ playWhile: true }).mode).toBe(PxControlMode.play);
        expect(resolveControlMode({ pauseWhile: true }).mode).toBe(PxControlMode.play);
        expect(resolveControlMode({ playWhile: false, playUsingActionTriggers: true }).mode).toBe(PxControlMode.play);
    });

    it('playUsingActionTriggers alone is playUsingActionTriggers', () => {
        expect(resolveControlMode({ playUsingActionTriggers: true }).mode).toBe(PxControlMode.playUsingActionTriggers);
    });

    it('playUsingActionTriggers:false is not a control prop — it does not claim the mode', () => {
        expect(resolveControlMode({ playUsingActionTriggers: false }).mode).toBe(PxControlMode.static);
    });

    it('a FALSE play still claims the mode — it is an explicit instruction', () => {
        expect(resolveControlMode({ playWhile: false }).mode).toBe(PxControlMode.play);
    });
});

describe('resolveControlMode — conflict warnings', () => {

    it('says nothing when only one tier is used', () => {
        expect(resolveControlMode({ showAtProgress: 0.5 }).warnings).toEqual([]);
        expect(resolveControlMode({ playWhile: true }).warnings).toEqual([]);
        expect(resolveControlMode({ playUsingActionTriggers: true }).warnings).toEqual([]);
    });

    it('names both props and which one won', () => {
        const { warnings } = resolveControlMode({ showAtProgress: 0.5, playUsingActionTriggers: true });
        expect(warnings).toHaveLength(1);
        expect(warnings[0]).toContain('showAtProgress/showAtTime');
        expect(warnings[0]).toContain('playUsingActionTriggers');
        expect(warnings[0]).toContain('ignored');
    });

    it('reports EVERY losing tier, not just the first', () => {
        const { warnings } = resolveControlMode({ showAtProgress: 0.5, playWhile: true, playUsingActionTriggers: true });
        expect(warnings).toHaveLength(2);
        expect(warnings.join('\n')).toContain('playWhile/pauseWhile');
        expect(warnings.join('\n')).toContain('playUsingActionTriggers');
    });

    it('play/pause over playUsingActionTriggers warns once', () => {
        expect(resolveControlMode({ pauseWhile: true, playUsingActionTriggers: true }).warnings).toHaveLength(1);
    });
});

describe('apiRef is NOT a mode (§1)', () => {

    it('the resolver takes no ref at all — a handle is not an instruction', () => {
        // The whole bug was React treating `apiRef` as a mode, which forced
        // `start: 'manual'` and stopped `playUsingActionTriggers` ever starting.
        expect(resolveControlMode({ playUsingActionTriggers: true }).mode).toBe(PxControlMode.playUsingActionTriggers);
        expect(controlModeTakesOverTrigger(PxControlMode.playUsingActionTriggers)).toBe(false);
    });
});

describe('controlModeTakesOverTrigger', () => {

    it('every mode EXCEPT playUsingActionTriggers takes the trigger over', () => {
        expect(controlModeTakesOverTrigger(PxControlMode.fixedTime)).toBe(true);
        expect(controlModeTakesOverTrigger(PxControlMode.play)).toBe(true);
        // `static` too: a component with no control props must not start on its own —
        // both React and Vue assert exactly that ("is static without control props").
        expect(controlModeTakesOverTrigger(PxControlMode.static)).toBe(true);
        expect(controlModeTakesOverTrigger(PxControlMode.playUsingActionTriggers)).toBe(false);
    });
});
