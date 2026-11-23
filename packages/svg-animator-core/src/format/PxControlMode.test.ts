/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// ONE control-mode rule for react / vue / rn (API review §1 and §7).
//
// Each component used to pick its own order: React `apiRef → triggers → showAtProgress/showAtTime → play/pause`, Vue
// `triggers → showAtProgress/showAtTime → play/pause`, React Native `showAtProgress/showAtTime → play/pause → triggers`.
// So triggers + `progress={0.5}` played on two and seeked on the third, and React let a REF decide the mode — which
// silently disabled the triggers. (`playerActionTriggers` until 1.25; an `actions` block since 1.26.)

import type { PxActionTriggers } from './PxAnimatorTypes';
import { describe, expect, it } from 'vitest';
import { PxControlMode, controlModeTakesOverTrigger, resolveControlMode, type PxControlProps } from './PxAnimatorConstants';

// 1.26 (2026-11-13): `playerActionTriggers` is gone — its tier is an `actions` block (`TRIGGERS` below), and with
// no control prop the file's own triggers drive (`actions` mode), no longer `static`.
const TRIGGERS: PxActionTriggers = [{ action: 'timeline.start', event: 'click' }];

describe('resolveControlMode — precedence', () => {

    it('no control props → actions, the document decides', () => {
        expect(resolveControlMode({})).toEqual({ mode: PxControlMode.actions, warnings: [] });
    });

    it('progress / time win over everything', () => {
        expect(resolveControlMode({ showAtProgress: 0.5 }).mode).toBe(PxControlMode.fixedTime);
        expect(resolveControlMode({ showAtTime: 250 }).mode).toBe(PxControlMode.fixedTime);
        expect(resolveControlMode({ showAtProgress: 0.5, playback: 'on', actions: TRIGGERS }).mode).toBe(PxControlMode.fixedTime);
    });

    it('playback wins over an actions block', () => {
        expect(resolveControlMode({ playback: 'on' }).mode).toBe(PxControlMode.playback);
        expect(resolveControlMode({ playback: 'paused' }).mode).toBe(PxControlMode.playback);
        expect(resolveControlMode({ playback: 'off', actions: TRIGGERS }).mode).toBe(PxControlMode.playback);
    });

    it('an actions block alone is actions', () => {
        expect(resolveControlMode({ actions: TRIGGERS }).mode).toBe(PxControlMode.actions);
    });

    it('disableActions:false is not a control prop — it does not claim the mode', () => {
        expect(resolveControlMode({ disableActions: false }).mode).toBe(PxControlMode.actions);
    });

    it('an "off" playback still claims the mode — it is an explicit instruction', () => {
        expect(resolveControlMode({ playback: 'off' }).mode).toBe(PxControlMode.playback);
    });
});

describe('resolveControlMode — conflict warnings', () => {

    it('says nothing when only one tier is used', () => {
        expect(resolveControlMode({ showAtProgress: 0.5 }).warnings).toEqual([]);
        expect(resolveControlMode({ playback: 'on' }).warnings).toEqual([]);
        expect(resolveControlMode({ actions: TRIGGERS }).warnings).toEqual([]);
    });

    it('names both props and which one won', () => {
        const { warnings } = resolveControlMode({ showAtProgress: 0.5, actions: TRIGGERS });
        expect(warnings).toHaveLength(1);
        expect(warnings[0]).toContain('showAtProgress/showAtTime');
        expect(warnings[0]).toContain('actions');
        expect(warnings[0]).toContain('ignored');
    });

    it('reports EVERY losing tier, not just the first', () => {
        const { warnings } = resolveControlMode({ showAtProgress: 0.5, playback: 'on', actions: TRIGGERS });
        expect(warnings).toHaveLength(2);
        expect(warnings.join('\n')).toContain('playback');
        expect(warnings.join('\n')).toContain('actions');
    });

    it('playback over an actions block warns once', () => {
        expect(resolveControlMode({ playback: 'paused', actions: TRIGGERS }).warnings).toHaveLength(1);
    });
});

describe('apiRef is NOT a mode (§1)', () => {

    it('the resolver takes no ref at all — a handle is not an instruction', () => {
        // The whole bug was React treating `apiRef` as a mode, which forced
        // `start: 'manual'` and stopped the triggers ever starting.
        expect(resolveControlMode({ actions: TRIGGERS }).mode).toBe(PxControlMode.actions);
        expect(controlModeTakesOverTrigger(PxControlMode.actions)).toBe(false);
    });
});

describe('controlModeTakesOverTrigger', () => {

    it('every mode EXCEPT actions takes the trigger over', () => {
        expect(controlModeTakesOverTrigger(PxControlMode.fixedTime)).toBe(true);
        expect(controlModeTakesOverTrigger(PxControlMode.playback)).toBe(true);
        // `static` too (`showAsStatic`): the picture as drawn must not start on its own
        expect(controlModeTakesOverTrigger(PxControlMode.static)).toBe(true);
        expect(controlModeTakesOverTrigger(PxControlMode.actions)).toBe(false);
    });
});

describe('PxControlProps — one driver family at a time, checked by TypeScript (improvements.md §0 #11)', () => {
    it('each family alone compiles; two at once do not; the JavaScript reader still warns on any mix', () => {
        const ok: Array<PxControlProps> = [
            {}, { playback: 'on' }, { playback: 'paused' }, { playback: 'off' }, { showAtProgress: 0.5 }, { showAtTime: 100 },
            { actions: TRIGGERS }, { actions: [{ action: 'timeline.start', event: 'hoverIn' }, { action: 'timeline.resume', event: 'hoverIn' }] },
        ];
        // @ts-expect-error — the lever and the triggers are two drivers
        const two: PxControlProps = { playback: 'on', actions: TRIGGERS };
        // @ts-expect-error — a position that is not one of the three (the readout's `playing` is not a request)
        const state: PxControlProps = { playback: 'playing' };
        // @ts-expect-error — both showAt props
        const show: PxControlProps = { showAtProgress: 0.5, showAtTime: 100 };
        expect([ok, two, state, show]).toHaveLength(4);
        expect(resolveControlMode({ showAtProgress: 0.5, showAtTime: 100 }).warnings).toEqual(
            ['showAtProgress and showAtTime were both set — showAtProgress wins, showAtTime is ignored.']);
    });
});

describe('resolveControlMode — the file drives by default; showAsStatic, disableActions, actions (2026-11-13)', () => {

    it('no control prop → actions: the file\'s own triggers decide', () => {
        expect(resolveControlMode({})).toEqual({ mode: PxControlMode.actions, warnings: [] });
    });

    it('showAsStatic beats every other control prop and names each one it ignores', () => {
        const r = resolveControlMode({ showAsStatic: true, showAtProgress: 0.5, playback: 'on', disableActions: true });
        expect(r.mode).toBe(PxControlMode.static);
        expect(r.warnings).toEqual([
            'showAsStatic and showAtProgress/showAtTime were both set — showAsStatic wins, showAtProgress/showAtTime is ignored.',
            'showAsStatic and playback were both set — showAsStatic wins, playback is ignored.',
            'showAsStatic and disableActions were both set — showAsStatic wins, disableActions is ignored.',
        ]);
    });

    it('manual: disableActions, or actions null — the two together say one thing, no warning', () => {
        expect(resolveControlMode({ disableActions: true }).mode).toBe(PxControlMode.manual);
        expect(resolveControlMode({ actions: null }).mode).toBe(PxControlMode.manual);
        expect(resolveControlMode({ disableActions: true, actions: null })).toEqual({ mode: PxControlMode.manual, warnings: [] });
    });

    it('an actions block — the empty one included — is the triggers tier', () => {
        expect(resolveControlMode({ actions: [{ action: 'timeline.start', event: 'click' }] })).toEqual({ mode: PxControlMode.actions, warnings: [] });
        expect(resolveControlMode({ actions: [] }).mode).toBe(PxControlMode.actions);
    });

    it('disableActions beats a block; the lever beats both', () => {
        expect(resolveControlMode({ disableActions: true, actions: [{ action: 'timeline.start', event: 'click' }] })).toEqual({
            mode: PxControlMode.manual,
            warnings: ['disableActions and actions were both set — disableActions wins, actions is ignored.'],
        });
        expect(resolveControlMode({ playback: 'on', actions: null })).toEqual({
            mode: PxControlMode.playback,
            warnings: ['playback and actions were both set — playback wins, actions is ignored.'],
        });
    });

    it('a flag set to false is not given', () => {
        expect(resolveControlMode({ showAsStatic: false, disableActions: false })).toEqual({ mode: PxControlMode.actions, warnings: [] });
    });

    it('only the default mode leaves the triggers to the file', () => {
        for (const mode of [PxControlMode.static, PxControlMode.fixedTime, PxControlMode.playback, PxControlMode.manual]) {
            expect(controlModeTakesOverTrigger(mode)).toBe(true);
        }
        expect(controlModeTakesOverTrigger(PxControlMode.actions)).toBe(false);
    });

    it('the types: each new family alone compiles; mixed with another does not', () => {
        const ok: Array<PxControlProps> = [
            {}, { showAsStatic: true }, { disableActions: true }, { actions: null }, { actions: [{ action: 'timeline.start', event: 'click' }] },
        ];
        // @ts-expect-error — the still and the lever are two drivers
        const still: PxControlProps = { showAsStatic: true, playback: 'on' };
        // @ts-expect-error — manual and a triggers block are two drivers
        const manual: PxControlProps = { disableActions: true, actions: [{ action: 'timeline.start', event: 'click' }] };
        expect([ok, still, manual]).toHaveLength(3);
    });
});
