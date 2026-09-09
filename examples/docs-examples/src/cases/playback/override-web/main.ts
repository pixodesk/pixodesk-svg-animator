import { createAnimator } from '@pixodesk/svg-animator-web';
import animation from '../../../fixtures/animation.json';

// The per-instance override: the document is untouched, and `config` says how THIS
// instance should play. Spelled exactly like `animator` in the file, so there is one
// vocabulary to learn — and `startOn: 'programmatic'` means nothing starts it but the
// button below.
const animator = createAnimator({
  data: animation as any,
  container: '#box',
  config: {
    timeline: {
      iterations: 'infinite',
      trigger: { startOn: 'programmatic' },
    },
  },
});

document.getElementById('play')!.onclick = () => animator.play();
