import { createAnimator } from '@pixodesk/svg-animator-web';
import animation from '../../../fixtures/animation.json';

const doc = {
  ...animation,
  animator: {
    ...animation.animator,
    iterations: 'infinite',
    trigger: { startOn: 'programmatic' },
  },
};

const animator = createAnimator({ data: doc as any, container: '#box' });
document.getElementById('play')!.onclick = () => animator.play();
