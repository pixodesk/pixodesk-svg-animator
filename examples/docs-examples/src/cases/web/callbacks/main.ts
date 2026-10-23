import { createSvgAnimationPlayer } from '@pixodesk/svg-animator-web';

const log = document.getElementById('log')!;
const say = (line: string) => { log.textContent += line + '\n'; };

const animator = createSvgAnimationPlayer({
    playOnTrigger: true,
  src: '../../../../animation.json',
  container: '#box',
  onPlay:   () => say('onPlay'),    // started or resumed
  onPause:  () => say('onPause'),
  onCancel: () => say('onCancel'),  // reset to the start
  onFinish: () => say('onFinish'),  // natural end, or finish()
  onDestroy: () => say('onDestroy'),  // destroyed
});

const $ = (id: string) => document.getElementById(id)!;
$('play').onclick = () => animator.play();
$('pause').onclick = () => animator.pause();
$('cancel').onclick = () => animator.cancel();
$('finish').onclick = () => animator.finish();
$('destroy').onclick = () => animator.destroy();
