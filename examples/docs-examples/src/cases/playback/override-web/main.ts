import { createSvgAnimationPlayer } from '@pixodesk/svg-animator-web';
import animation from '../../../fixtures/animation.json';

// The per-instance override: the document is untouched, and `timeline` is merged over its
// own timing block — spelled exactly like the file, so there is one vocabulary to learn.
// No `playOnTrigger`: nothing starts it but the button below.
const animator = createSvgAnimationPlayer({
  doc: animation as any,
  container: '#box',
  timeline: { iterations: 'infinite' },
});

document.getElementById('play')!.onclick = () => animator.play();
