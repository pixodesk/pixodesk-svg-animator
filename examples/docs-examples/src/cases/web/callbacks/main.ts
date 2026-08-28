import { createAnimator } from '@pixodesk/svg-animator-web';

const log = document.getElementById('log')!;
const say = (line: string) => { log.textContent += line + '\n'; };

const animator = createAnimator({
  src: '../../../../animation.json',
  container: '#box',
  callbacks: {
    onPlay:   () => say('onPlay'),    // started or resumed
    onPause:  () => say('onPause'),
    onCancel: () => say('onCancel'),  // reset to the start
    onFinish: () => say('onFinish'),  // natural end, or finish()
    onRemove: () => say('onRemove'),  // destroyed
  },
});

const $ = (id: string) => document.getElementById(id)!;
$('play').onclick = () => animator.play();
$('pause').onclick = () => animator.pause();
$('cancel').onclick = () => animator.cancel();
$('finish').onclick = () => animator.finish();
$('destroy').onclick = () => animator.destroy();
