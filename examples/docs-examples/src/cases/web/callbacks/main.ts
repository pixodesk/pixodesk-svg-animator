import { createSvgAnimationPlayer } from '@pixodesk/svg-animator-web';

const log = document.getElementById('log')!;
const say = (line: string) => { log.textContent += line + '\n'; };

const animator = createSvgAnimationPlayer({
    playUsingActionTriggers: true,
  src: '../../../../animation.json',
  container: '#box',
  onPlay:   () => say('onPlay'),    // started or resumed
  onPause:  () => say('onPause'),
  onReset: () => say('onReset'),    // back at the start pose
  onFinish: () => say('onFinish'),  // natural end, or jumpToEnd()
  onDestroy: () => say('onDestroy'),  // destroyed
});

const $ = (id: string) => document.getElementById(id)!;
$('play').onclick = () => animator.play();
$('pause').onclick = () => animator.pause();
$('reset').onclick = () => animator.reset();
$('finish').onclick = () => animator.jumpToEnd();
$('destroy').onclick = () => animator.destroy();
