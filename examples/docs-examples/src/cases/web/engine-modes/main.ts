import { createSvgAnimationPlayer } from '@pixodesk/svg-animator-web';
import animation from '../../../fixtures/animation.json';

// a timeline's `engine` picks who runs the animation: the browser (WAAPI) or the player's frame loop.
const withEngine = (engine: 'native' | 'js') => ({
  ...animation,
  animator: { ...animation.animator, timelines: [{ ...animation.animator.timelines[0], engine, iterations: 'infinite' }] },
});

createSvgAnimationPlayer({ document: withEngine('native') as any, container: '#waapi' });
createSvgAnimationPlayer({ document: withEngine('js') as any, container: '#frames' });
