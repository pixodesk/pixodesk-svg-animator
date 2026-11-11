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
import { PxControlMode, controlModeTakesOverTrigger, resolveControlMode, type PxControlProps } from './PxAnimatorConstants';

describe('resolveControlMode — precedence', () => {

    it('no control props → static, the document decides', () => {
        expect(resolveControlMode({})).toEqual({ mode: PxControlMode.static, warnings: [] });
    });

    it('progress / time win over everything', () => {
        expect(resolveControlMode({ showAtProgress: 0.5 }).mode).toBe(PxControlMode.fixedTime);
        expect(resolveControlMode({ showAtTime: 250 }).mode).toBe(PxControlMode.fixedTime);
        expect(resolveControlMode({ showAtProgress: 0.5, playRun: 'on', playUsingActionTriggers: true }).mode).toBe(PxControlMode.fixedTime);
    });

    it('playRun wins over playUsingActionTriggers', () => {
        expect(resolveControlMode({ playRun: 'on' }).mode).toBe(PxControlMode.playRun);
        expect(resolveControlMode({ playRun: 'paused' }).mode).toBe(PxControlMode.playRun);
        expect(resolveControlMode({ playRun: 'off', playUsingActionTriggers: true }).mode).toBe(PxControlMode.playRun);
    });

    it('playUsingActionTriggers alone is playUsingActionTriggers', () => {
        expect(resolveControlMode({ playUsingActionTriggers: true }).mode).toBe(PxControlMode.playUsingActionTriggers);
    });

    it('playUsingActionTriggers:false is not a control prop — it does not claim the mode', () => {
        expect(resolveControlMode({ playUsingActionTriggers: false }).mode).toBe(PxControlMode.static);
    });

    it('an "off" playRun still claims the mode — it is an explicit instruction', () => {
        expect(resolveControlMode({ playRun: 'off' }).mode).toBe(PxControlMode.playRun);
    });
});

describe('resolveControlMode — conflict warnings', () => {

    it('says nothing when only one tier is used', () => {
        expect(resolveControlMode({ showAtProgress: 0.5 }).warnings).toEqual([]);
        expect(resolveControlMode({ playRun: 'on' }).warnings).toEqual([]);
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
        const { warnings } = resolveControlMode({ showAtProgress: 0.5, playRun: 'on', playUsingActionTriggers: true });
        expect(warnings).toHaveLength(2);
        expect(warnings.join('\n')).toContain('playRun');
        expect(warnings.join('\n')).toContain('playUsingActionTriggers');
    });

    it('playRun over playUsingActionTriggers warns once', () => {
        expect(resolveControlMode({ playRun: 'paused', playUsingActionTriggers: true }).warnings).toHaveLength(1);
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
        expect(controlModeTakesOverTrigger(PxControlMode.playRun)).toBe(true);
        // `static` too: a component with no control props must not start on its own —
        // both React and Vue assert exactly that ("is static without control props").
        expect(controlModeTakesOverTrigger(PxControlMode.static)).toBe(true);
        expect(controlModeTakesOverTrigger(PxControlMode.playUsingActionTriggers)).toBe(false);
    });
});

describe('PxControlProps — one driver family at a time, checked by TypeScript (improvements.md §0 #11)', () => {
    it('each family alone compiles; two at once do not; the JavaScript reader still warns on any mix', () => {
        const ok: Array<PxControlProps> = [
            {}, { playRun: 'on' }, { playRun: 'paused' }, { playRun: 'off' }, { showAtProgress: 0.5 }, { showAtTime: 100 },
            { playUsingActionTriggers: true }, { playUsingActionTriggers: { startRun: 'hoverIn', resumeRun: 'hoverIn' } },
        ];
        // @ts-expect-error — the lever and the triggers are two drivers
        const two: PxControlProps = { playRun: 'on', playUsingActionTriggers: true };
        // @ts-expect-error — a position that is not one of the three (the readout's `playing` is not a request)
        const state: PxControlProps = { playRun: 'playing' };
        // @ts-expect-error — both showAt props
        const show: PxControlProps = { showAtProgress: 0.5, showAtTime: 100 };
        expect([ok, two, state, show]).toHaveLength(4);
        expect(resolveControlMode({ showAtProgress: 0.5, showAtTime: 100 }).warnings).toEqual(
            ['showAtProgress and showAtTime were both set — showAtProgress wins, showAtTime is ignored.']);
    });
});

