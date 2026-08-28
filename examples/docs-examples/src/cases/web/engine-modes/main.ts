import { createAnimator } from '@pixodesk/svg-animator-web';
import animation from '../../../fixtures/animation.json';

const withMode = (mode: 'waapi' | 'frames') => ({
  ...animation,
  animator: { ...animation.animator, mode, iterations: 'infinite' },
});

createAnimator({ data: withMode('waapi') as any, container: '#waapi' });
createAnimator({ data: withMode('frames') as any, container: '#frames' });
