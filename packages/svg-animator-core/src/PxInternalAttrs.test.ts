import { describe, expect, it } from 'vitest';
import { INTERNAL_ATTRS } from './PxAnimatorConstants';
import { getNormalizedProps } from './PxNodeProps';

/**
 * J4 — wire keys that carry STRUCTURE must never be written to the DOM as attributes.
 *
 * `getNormalizedProps` is the one gate: whatever it returns becomes element attributes.
 * `effects` was missing from the list and safe only because `applyPlayerEffects` deletes
 * it at load — a property of the pipeline, not of the contract. A path that returned
 * early, or an unrecognised effect key, would have produced `effects="[object Object]"`
 * on the element with no error anywhere.
 */
describe('INTERNAL_ATTRS — structural keys never become DOM attributes (J4)', () => {

    it('lists every key that carries structure rather than presentation', () => {
        for (const key of ['type', 'children', 'animator', 'meta', 'animate', 'effects', 'text', 'textContent']) {
            expect(INTERNAL_ATTRS.has(key), key).toBe(true);
        }
    });

    it('strips them from rendered props, and keeps real SVG attributes', () => {
        const props = getNormalizedProps({
            // structural — must all be dropped
            type: 'rect',
            children: [{ type: 'circle' }],
            animate: { opacity: { keyframes: [] } },
            effects: { strokeTrim: { range: [0, 1] } },
            meta: { label: 'x' },
            animator: { duration: 1000 },
            textContent: 'hello',
            // presentation — must survive
            width: 10,
            fill: '#ff0000',
        });

        for (const key of ['type', 'children', 'animate', 'effects', 'meta', 'animator', 'textContent']) {
            expect(key in props, `${key} must not reach the DOM`).toBe(false);
        }
        // Values are stringified on the way to the DOM — that is the normaliser's job.
        expect(String(props.width)).toBe('10');
        expect(props.fill).toBe('#ff0000');
    });

    it('an UNCONSUMED effects bucket cannot leak as an attribute', () => {
        // The regression this guards: a document reaching the renderer with `effects` still
        // attached (unrecognised key, or an applier that returned early) used to stringify
        // onto the element.
        const props = getNormalizedProps({ type: 'g', effects: { someFutureEffect: { a: 1 } } });
        expect('effects' in props).toBe(false);
        expect(JSON.stringify(props)).not.toContain('someFutureEffect');
    });

});
