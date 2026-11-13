/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// ONE control-mode rule for react / vue / rn (API review §1 and §7).
//
// Each component used to pick its own order: React `apiRef → playerActionTriggers → showAtProgress/showAtTime →
// play/pause`, Vue `playerActionTriggers → showAtProgress/showAtTime → play/pause`, React Native `showAtProgress/showAtTime →
// play/pause → playerActionTriggers`. So `playerActionTriggers` + `progress={0.5}` played on two and seeked on the
// third, and React let a REF decide the mode — which silently disabled `playerActionTriggers`.

import { describe, expect, it } from 'vitest';
import { PxControlMode, controlModeTakesOverTrigger, resolveControlMode, type PxControlProps } from './PxAnimatorConstants';

describe('resolveControlMode — precedence', () => {

    it('no control props → static, the document decides', () => {
        expect(resolveControlMode({})).toEqual({ mode: PxControlMode.static, warnings: [] });
    });

    it('progress / time win over everything', () => {
        expect(resolveControlMode({ showAtProgress: 0.5 }).mode).toBe(PxControlMode.fixedTime);
        expect(resolveControlMode({ showAtTime: 250 }).mode).toBe(PxControlMode.fixedTime);
        expect(resolveControlMode({ showAtProgress: 0.5, playback: 'on', playerActionTriggers: true }).mode).toBe(PxControlMode.fixedTime);
    });

    it('playback wins over playerActionTriggers', () => {
        expect(resolveControlMode({ playback: 'on' }).mode).toBe(PxControlMode.playback);
        expect(resolveControlMode({ playback: 'paused' }).mode).toBe(PxControlMode.playback);
        expect(resolveControlMode({ playback: 'off', playerActionTriggers: true }).mode).toBe(PxControlMode.playback);
    });

    it('playerActionTriggers alone is playerActionTriggers', () => {
        expect(resolveControlMode({ playerActionTriggers: true }).mode).toBe(PxControlMode.playerActionTriggers);
    });

    it('playerActionTriggers:false is not a control prop — it does not claim the mode', () => {
        expect(resolveControlMode({ playerActionTriggers: false }).mode).toBe(PxControlMode.static);
    });

    it('an "off" playback still claims the mode — it is an explicit instruction', () => {
        expect(resolveControlMode({ playback: 'off' }).mode).toBe(PxControlMode.playback);
    });
});

describe('resolveControlMode — conflict warnings', () => {

    it('says nothing when only one tier is used', () => {
        expect(resolveControlMode({ showAtProgress: 0.5 }).warnings).toEqual([]);
        expect(resolveControlMode({ playback: 'on' }).warnings).toEqual([]);
        expect(resolveControlMode({ playerActionTriggers: true }).warnings).toEqual([]);
    });

    it('names both props and which one won', () => {
        const { warnings } = resolveControlMode({ showAtProgress: 0.5, playerActionTriggers: true });
        expect(warnings).toHaveLength(1);
        expect(warnings[0]).toContain('showAtProgress/showAtTime');
        expect(warnings[0]).toContain('playerActionTriggers');
        expect(warnings[0]).toContain('ignored');
    });

    it('reports EVERY losing tier, not just the first', () => {
        const { warnings } = resolveControlMode({ showAtProgress: 0.5, playback: 'on', playerActionTriggers: true });
        expect(warnings).toHaveLength(2);
        expect(warnings.join('\n')).toContain('playback');
        expect(warnings.join('\n')).toContain('playerActionTriggers');
    });

    it('playback over playerActionTriggers warns once', () => {
        expect(resolveControlMode({ playback: 'paused', playerActionTriggers: true }).warnings).toHaveLength(1);
    });
});

describe('apiRef is NOT a mode (§1)', () => {

    it('the resolver takes no ref at all — a handle is not an instruction', () => {
        // The whole bug was React treating `apiRef` as a mode, which forced
        // `start: 'manual'` and stopped `playerActionTriggers` ever starting.
        expect(resolveControlMode({ playerActionTriggers: true }).mode).toBe(PxControlMode.playerActionTriggers);
        expect(controlModeTakesOverTrigger(PxControlMode.playerActionTriggers)).toBe(false);
    });
});

describe('controlModeTakesOverTrigger', () => {

    it('every mode EXCEPT playerActionTriggers takes the trigger over', () => {
        expect(controlModeTakesOverTrigger(PxControlMode.fixedTime)).toBe(true);
        expect(controlModeTakesOverTrigger(PxControlMode.playback)).toBe(true);
        // `static` too: a component with no control props must not start on its own —
        // both React and Vue assert exactly that ("is static without control props").
        expect(controlModeTakesOverTrigger(PxControlMode.static)).toBe(true);
        expect(controlModeTakesOverTrigger(PxControlMode.playerActionTriggers)).toBe(false);
    });
});

describe('PxControlProps — one driver family at a time, checked by TypeScript (improvements.md §0 #11)', () => {
    it('each family alone compiles; two at once do not; the JavaScript reader still warns on any mix', () => {
        const ok: Array<PxControlProps> = [
            {}, { playback: 'on' }, { playback: 'paused' }, { playback: 'off' }, { showAtProgress: 0.5 }, { showAtTime: 100 },
            { playerActionTriggers: true }, { playerActionTriggers: { 'playback.start': 'hoverIn', 'playback.resume': 'hoverIn' } },
        ];
        // @ts-expect-error — the lever and the triggers are two drivers
        const two: PxControlProps = { playback: 'on', playerActionTriggers: true };
        // @ts-expect-error — a position that is not one of the three (the readout's `playing` is not a request)
        const state: PxControlProps = { playback: 'playing' };
        // @ts-expect-error — both showAt props
        const show: PxControlProps = { showAtProgress: 0.5, showAtTime: 100 };
        expect([ok, two, state, show]).toHaveLength(4);
        expect(resolveControlMode({ showAtProgress: 0.5, showAtTime: 100 }).warnings).toEqual(
            ['showAtProgress and showAtTime were both set — showAtProgress wins, showAtTime is ignored.']);
    });
});

