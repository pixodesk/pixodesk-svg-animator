import { createAnimator } from '@pixodesk/svg-animator-web';
import animation from '../../../fixtures/animation.json';

// `timeline.engine` picks who runs the animation: the browser (WAAPI) or the player's frame loop.
const withEngine = (engine: 'native' | 'js') => ({
  ...animation,
  animator: { ...animation.animator, timeline: { ...animation.animator.timeline, engine, iterations: 'infinite' } },
});

createAnimator({ data: withEngine('native') as any, container: '#waapi' });
createAnimator({ data: withEngine('js') as any, container: '#frames' });
