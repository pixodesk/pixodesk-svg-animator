import { createAnimator } from '@pixodesk/svg-animator-web';
import animation from '../../../fixtures/animation.json';

// `timeline.mode` picks who runs the animation: the browser (WAAPI) or the player's frame loop.
const withMode = (mode: 'native' | 'player') => ({
  ...animation,
  animator: { ...animation.animator, timeline: { ...animation.animator.timeline, mode, iterations: 'infinite' } },
});

createAnimator({ data: withMode('native') as any, container: '#waapi' });
createAnimator({ data: withMode('player') as any, container: '#frames' });
