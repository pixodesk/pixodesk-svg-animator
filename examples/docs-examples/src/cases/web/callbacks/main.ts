import { createSvgAnimationPlayer } from '@pixodesk/svg-animator-web';

const log = document.getElementById('log')!;
const say = (line: string) => { log.textContent += line + '\n'; };

const animator = createSvgAnimationPlayer({
    playUsingActionTriggers: true,
  src: '../../../../animation.json',
  container: '#box',
  onPlay:   () => say('onPlay'),    // started or resumed
  onPause:  () => say('onPause'),
  onStop:   () => say('onStop'),    // the stop action was performed — stop()
  onFinish: () => say('onFinish'),  // natural end, or jumpToEnd()
  onDestroy: () => say('onDestroy'),  // destroyed
});

const $ = (id: string) => document.getElementById(id)!;
$('play').onclick = () => animator.play();
$('pause').onclick = () => animator.pause();
$('stop').onclick = () => animator.stop();
$('finish').onclick = () => animator.jumpToEnd();
$('destroy').onclick = () => animator.destroy();
