import { createSvgAnimationPlayer } from '@pixodesk/svg-animator-web';
import animation from '../../../fixtures/animation.json';

// The per-instance override: the document is untouched, and `timelineOptions` is merged over its
// own timing block — spelled exactly like the file's `timeline`, so there is one vocabulary to learn.
// `disableActionTriggers`: the file's own trigger is off, so nothing starts it but the button below.
const animator = createSvgAnimationPlayer({
  document: animation as any,
  container: '#box',
  timelineOptions: { iterations: 'infinite' },
  disableActionTriggers: true,
});

document.getElementById('play')!.onclick = () => animator.playback.start();
