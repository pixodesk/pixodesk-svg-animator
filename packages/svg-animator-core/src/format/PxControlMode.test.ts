/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// ONE control-mode rule for react / vue / rn (API review §1 and §7).
//
// Each component used to pick its own order: React `apiRef → autoplay → progress/time →
// play/pause`, Vue `autoplay → progress/time → play/pause`, React Native `progress/time →
// play/pause → autoplay`. So `autoplay` + `progress={0.5}` played on two and seeked on the
// third, and React let a REF decide the mode — which silently disabled `autoplay`.

import { describe, expect, it } from 'vitest';
import { PxControlMode, controlModeTakesOverTrigger, resolveControlMode } from './PxAnimatorConstants';

describe('resolveControlMode — precedence', () => {

    it('no control props → static, the document decides', () => {
        expect(resolveControlMode({})).toEqual({ mode: PxControlMode.static, warnings: [] });
    });

    it('progress / time win over everything', () => {
        expect(resolveControlMode({ progress: 0.5 }).mode).toBe(PxControlMode.fixedTime);
        expect(resolveControlMode({ time: 250 }).mode).toBe(PxControlMode.fixedTime);
        expect(resolveControlMode({ progress: 0.5, play: true, autoplay: true }).mode).toBe(PxControlMode.fixedTime);
    });

    it('play / pause win over autoplay', () => {
        expect(resolveControlMode({ play: true }).mode).toBe(PxControlMode.play);
        expect(resolveControlMode({ pause: true }).mode).toBe(PxControlMode.play);
        expect(resolveControlMode({ play: false, autoplay: true }).mode).toBe(PxControlMode.play);
    });

    it('autoplay alone is autoplay', () => {
        expect(resolveControlMode({ autoplay: true }).mode).toBe(PxControlMode.autoplay);
    });

    it('autoplay:false is not a control prop — it does not claim the mode', () => {
        expect(resolveControlMode({ autoplay: false }).mode).toBe(PxControlMode.static);
    });

    it('a FALSE play still claims the mode — it is an explicit instruction', () => {
        expect(resolveControlMode({ play: false }).mode).toBe(PxControlMode.play);
    });
});

describe('resolveControlMode — conflict warnings', () => {

    it('says nothing when only one tier is used', () => {
        expect(resolveControlMode({ progress: 0.5 }).warnings).toEqual([]);
        expect(resolveControlMode({ play: true }).warnings).toEqual([]);
        expect(resolveControlMode({ autoplay: true }).warnings).toEqual([]);
    });

    it('names both props and which one won', () => {
        const { warnings } = resolveControlMode({ progress: 0.5, autoplay: true });
        expect(warnings).toHaveLength(1);
        expect(warnings[0]).toContain('progress/time');
        expect(warnings[0]).toContain('autoplay');
        expect(warnings[0]).toContain('ignored');
    });

    it('reports EVERY losing tier, not just the first', () => {
        const { warnings } = resolveControlMode({ progress: 0.5, play: true, autoplay: true });
        expect(warnings).toHaveLength(2);
        expect(warnings.join('\n')).toContain('play/pause');
        expect(warnings.join('\n')).toContain('autoplay');
    });

    it('play/pause over autoplay warns once', () => {
        expect(resolveControlMode({ pause: true, autoplay: true }).warnings).toHaveLength(1);
    });
});

describe('apiRef is NOT a mode (§1)', () => {

    it('the resolver takes no ref at all — a handle is not an instruction', () => {
        // The whole bug was React treating `apiRef` as a mode, which forced
        // `startOn: 'programmatic'` and stopped `autoplay` ever starting.
        expect(resolveControlMode({ autoplay: true }).mode).toBe(PxControlMode.autoplay);
        expect(controlModeTakesOverTrigger(PxControlMode.autoplay)).toBe(false);
    });
});

describe('controlModeTakesOverTrigger', () => {

    it('every mode EXCEPT autoplay takes the trigger over', () => {
        expect(controlModeTakesOverTrigger(PxControlMode.fixedTime)).toBe(true);
        expect(controlModeTakesOverTrigger(PxControlMode.play)).toBe(true);
        // `static` too: a component with no control props must not start on its own —
        // both React and Vue assert exactly that ("is static without control props").
        expect(controlModeTakesOverTrigger(PxControlMode.static)).toBe(true);
        expect(controlModeTakesOverTrigger(PxControlMode.autoplay)).toBe(false);
    });
});
