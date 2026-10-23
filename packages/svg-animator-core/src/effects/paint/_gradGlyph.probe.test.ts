// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { materializeNodeEffects } from '../PlayerEffectsUtil';
import type { PxFillGradientEffect, PxGlyphFont, PxNode } from '../../format/PxAnimatorTypes';

const glyphs: { [family: string]: PxGlyphFont } = { F: { fontFamily: 'F', fontStyle: '', ascent: 800, unitsPerEm: 1000,
    glyphs: { H: { width: 700, pathData: 'M0 0L100 0L100 -700Z' } } } };
const grad: PxFillGradientEffect = { type: 'linear', start: [-100, 0], end: [100, 0], gradientUnits: 'userSpaceOnUse',
    stops: [{ offset: 0, color: '#007fff' }, { offset: 1, color: '#ff0000' }] };

describe('probe', () => {
  it('literal fill vs fillGradient effect on the tspan', () => {
    for (const [name, tspan] of [
      ['literal', { type: 'tspan', textContent: 'H', fontFamily: 'F', fontSize: '100px', fill: '#f00' }],
      ['gradient', { type: 'tspan', textContent: 'H', fontFamily: 'F', fontSize: '100px', effects: { fillGradient: grad } }],
      ['nested-gradient', { type: 'tspan', textContent: 'H', fontFamily: 'F', fontSize: '100px', effects: { fillGradient: grad },
        children: [{ type: 'tspan', textContent: 'H', fontFamily: 'F', fontSize: '100px', effects: { fillGradient: grad } }] }],
    ] as const) {
      const tspanCopy: PxNode = JSON.parse(JSON.stringify(tspan));
      const scene: PxNode = { type: 'svg', viewBox: '0 0 200 100', animator: { definitions: { fonts: glyphs } },
        children: [{ type: 'text', id: 't', children: [tspanCopy], effects: { text: { useGlyphs: true } } }] };
      const { root } = materializeNodeEffects(scene);
      const paths: Array<PxNode> = [];
      const walk = (n: PxNode | undefined) => { if (!n) return; if (n.type === 'path') paths.push(n); (n.children || []).forEach(walk); };
      walk(root);
      console.log(`CASE ${name}: glyph paths=${paths.length} fills=${JSON.stringify(paths.map(p => p.fill ?? null))}`);
    }
    expect(1).toBe(1);
  });
});
