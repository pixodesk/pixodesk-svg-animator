import { createAnimator } from '@pixodesk/svg-animator-web';
import animation from '../../../fixtures/animation.json';

// The per-instance override: the document is untouched, and `timeline` says how THIS
// instance should play. Spelled exactly like `animator` in the file, so there is one
// vocabulary to learn — and `start: 'none'` means nothing starts it but the
// button below.
const animator = createAnimator({
  doc: animation as any,
  container: '#box',
  timeline: {
    iterations: 'infinite',
    trigger: { start: 'none', offScreen: 'continue' },
  },
});

document.getElementById('play')!.onclick = () => animator.play();
