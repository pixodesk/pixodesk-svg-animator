// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { applyPlayerEffects } from './PlayerEffectsUtil';
import type { PxNode } from '../PxAnimatorTypes';

const glyphs = { F: { fontFamily: 'F', style: '', ascent: 800, unitsPerEm: 1000,
    glyphs: { H: { width: 700, d: 'M0 0L100 0L100 -700Z' } } } };
const grad = { type: 'linear', start: [-100, 0], end: [100, 0], gradientUnits: 'userSpaceOnUse',
    stops: [{ offset: 0, color: '#007fff' }, { offset: 1, color: '#ff0000' }] };

describe('probe', () => {
  it('literal fill vs fillGradient effect on the tspan', () => {
    for (const [name, tspan] of [
      ['literal', { type: 'tspan', textContent: 'H', fontFamily: 'F', fontSize: '100px', fill: '#f00' }],
      ['gradient', { type: 'tspan', textContent: 'H', fontFamily: 'F', fontSize: '100px', effects: { fillGradient: grad } }],
      ['nested-gradient', { type: 'tspan', textContent: 'H', fontFamily: 'F', fontSize: '100px', effects: { fillGradient: grad },
        children: [{ type: 'tspan', textContent: 'H', fontFamily: 'F', fontSize: '100px', effects: { fillGradient: grad } }] }],
    ] as const) {
      const scene = { type: 'svg', viewBox: '0 0 200 100', animator: { definitions: { glyphs } },
        children: [{ type: 'text', id: 't', children: [JSON.parse(JSON.stringify(tspan))], effects: { text: { useGlyphs: true } } }] } as unknown as PxNode;
      const { root } = applyPlayerEffects(scene);
      const paths: Array<any> = [];
      const walk = (n: any) => { if (!n) return; if (n.type === 'path') paths.push(n); (n.children || []).forEach(walk); };
      walk(root);
      console.log(`CASE ${name}: glyph paths=${paths.length} fills=${JSON.stringify(paths.map(p => p.fill ?? null))}`);
    }
    expect(1).toBe(1);
  });
});
