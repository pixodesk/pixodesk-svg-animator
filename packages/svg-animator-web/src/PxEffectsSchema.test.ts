import { describe, expect, it } from 'vitest';
import { validateNodeEffects } from './PxAnimatorTypes';

describe('validateNodeEffects', () => {
    it('returns no warnings for empty tree', () => {
        expect(validateNodeEffects({ type: 'svg' } as any)).toEqual([]);
    });
    it('returns no warnings for valid effects', () => {
        expect(validateNodeEffects({
            type: 'svg',
            children: [{
                type: 'rect',
                effects: { transformation: { translate: [10, 20], rotate: 45 } },
            }],
        } as any)).toEqual([]);
    });
    it('reports warnings for malformed effects (wrong type)', () => {
        const warnings = validateNodeEffects({
            type: 'svg',
            children: [{
                type: 'rect',
                effects: { transformation: { translate: 'not-a-vec2' } },
            }],
        } as any);
        expect(warnings.length).toBeGreaterThan(0);
    });
    it('flags unknown top-level effect key in strict mode', () => {
        const warnings = validateNodeEffects({
            type: 'svg',
            children: [{ type: 'rect', effects: { madeUpEffect: { foo: 1 } } }],
        } as any, { strict: true });
        expect(warnings.length).toBeGreaterThan(0);
        expect(warnings.join('\n')).toContain('madeUpEffect');
    });
});
