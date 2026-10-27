/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// ONE control-mode rule for react / vue / rn (API review §1 and §7).
//
// Each component used to pick its own order: React `apiRef → playOnTrigger → playCurrentProgress/playCurrentTime →
// play/pause`, Vue `playOnTrigger → playCurrentProgress/playCurrentTime → play/pause`, React Native `playCurrentProgress/playCurrentTime →
// play/pause → playOnTrigger`. So `playOnTrigger` + `progress={0.5}` played on two and seeked on the
// third, and React let a REF decide the mode — which silently disabled `playOnTrigger`.

import { describe, expect, it } from 'vitest';
import { PxControlMode, controlModeTakesOverTrigger, resolveControlMode } from './PxAnimatorConstants';

describe('resolveControlMode — precedence', () => {

    it('no control props → static, the document decides', () => {
        expect(resolveControlMode({})).toEqual({ mode: PxControlMode.static, warnings: [] });
    });

    it('progress / time win over everything', () => {
        expect(resolveControlMode({ playCurrentProgress: 0.5 }).mode).toBe(PxControlMode.fixedTime);
        expect(resolveControlMode({ playCurrentTime: 250 }).mode).toBe(PxControlMode.fixedTime);
        expect(resolveControlMode({ playCurrentProgress: 0.5, play: true, playOnTrigger: true }).mode).toBe(PxControlMode.fixedTime);
    });

    it('play / pause win over playOnTrigger', () => {
        expect(resolveControlMode({ play: true }).mode).toBe(PxControlMode.play);
        expect(resolveControlMode({ pause: true }).mode).toBe(PxControlMode.play);
        expect(resolveControlMode({ play: false, playOnTrigger: true }).mode).toBe(PxControlMode.play);
    });

    it('playOnTrigger alone is playOnTrigger', () => {
        expect(resolveControlMode({ playOnTrigger: true }).mode).toBe(PxControlMode.playOnTrigger);
    });

    it('playOnTrigger:false is not a control prop — it does not claim the mode', () => {
        expect(resolveControlMode({ playOnTrigger: false }).mode).toBe(PxControlMode.static);
    });

    it('a FALSE play still claims the mode — it is an explicit instruction', () => {
        expect(resolveControlMode({ play: false }).mode).toBe(PxControlMode.play);
    });
});

describe('resolveControlMode — conflict warnings', () => {

    it('says nothing when only one tier is used', () => {
        expect(resolveControlMode({ playCurrentProgress: 0.5 }).warnings).toEqual([]);
        expect(resolveControlMode({ play: true }).warnings).toEqual([]);
        expect(resolveControlMode({ playOnTrigger: true }).warnings).toEqual([]);
    });

    it('names both props and which one won', () => {
        const { warnings } = resolveControlMode({ playCurrentProgress: 0.5, playOnTrigger: true });
        expect(warnings).toHaveLength(1);
        expect(warnings[0]).toContain('playCurrentProgress/playCurrentTime');
        expect(warnings[0]).toContain('playOnTrigger');
        expect(warnings[0]).toContain('ignored');
    });

    it('reports EVERY losing tier, not just the first', () => {
        const { warnings } = resolveControlMode({ playCurrentProgress: 0.5, play: true, playOnTrigger: true });
        expect(warnings).toHaveLength(2);
        expect(warnings.join('\n')).toContain('play/pause');
        expect(warnings.join('\n')).toContain('playOnTrigger');
    });

    it('play/pause over playOnTrigger warns once', () => {
        expect(resolveControlMode({ pause: true, playOnTrigger: true }).warnings).toHaveLength(1);
    });
});

describe('apiRef is NOT a mode (§1)', () => {

    it('the resolver takes no ref at all — a handle is not an instruction', () => {
        // The whole bug was React treating `apiRef` as a mode, which forced
        // `start: 'manual'` and stopped `playOnTrigger` ever starting.
        expect(resolveControlMode({ playOnTrigger: true }).mode).toBe(PxControlMode.playOnTrigger);
        expect(controlModeTakesOverTrigger(PxControlMode.playOnTrigger)).toBe(false);
    });
});

describe('controlModeTakesOverTrigger', () => {

    it('every mode EXCEPT playOnTrigger takes the trigger over', () => {
        expect(controlModeTakesOverTrigger(PxControlMode.fixedTime)).toBe(true);
        expect(controlModeTakesOverTrigger(PxControlMode.play)).toBe(true);
        // `static` too: a component with no control props must not start on its own —
        // both React and Vue assert exactly that ("is static without control props").
        expect(controlModeTakesOverTrigger(PxControlMode.static)).toBe(true);
        expect(controlModeTakesOverTrigger(PxControlMode.playOnTrigger)).toBe(false);
    });
});
