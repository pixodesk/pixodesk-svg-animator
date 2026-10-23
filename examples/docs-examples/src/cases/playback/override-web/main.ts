import { createSvgAnimationPlayer } from '@pixodesk/svg-animator-web';
import animation from '../../../fixtures/animation.json';

// The per-instance override: the document is untouched, and `timeline` says how THIS
// instance should play. Spelled exactly like `animator` in the file, so there is one
// vocabulary to learn — and `start: 'manual'` means nothing starts it but the
// button below.
const animator = createSvgAnimationPlayer({
    playOnTrigger: true,
  doc: animation as any,
  container: '#box',
  timeline: {
    iterations: 'infinite',
    trigger: { start: 'manual', outOfView: 'continue' },
  },
});

document.getElementById('play')!.onclick = () => animator.play();
