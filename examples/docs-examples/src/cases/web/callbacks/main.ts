import { createSvgAnimationPlayer } from '@pixodesk/svg-animator-web';

const log = document.getElementById('log')!;
const say = (line: string) => { log.textContent += line + '\n'; };

const animator = createSvgAnimationPlayer({
    playUsingActionTriggers: true,
  src: '../../../../animation.json',
  container: '#box',
  onRunStart:  () => say('onRunStart'),   // a run began — startRun()
  onRunResume: () => say('onRunResume'),  // the run carried on after a freeze — resumeRun()
  onRunPause:  () => say('onRunPause'),   // the run was frozen — pauseRun()
  onRunStop:   () => say('onRunStop'),    // the run was stopped — stopRun()
  onFinish: () => say('onFinish'),  // natural end, or jumpToEnd()
  onDestroy: () => say('onDestroy'),  // destroyed
});

const $ = (id: string) => document.getElementById(id)!;
$('play').onclick = () => animator.startRun();
$('pause').onclick = () => animator.pauseRun();
$('resume').onclick = () => animator.resumeRun();
$('stop').onclick = () => animator.stopRun();
$('finish').onclick = () => animator.jumpToEnd();
$('destroy').onclick = () => animator.destroy();
