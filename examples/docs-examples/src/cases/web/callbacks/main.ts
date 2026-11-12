import { createSvgAnimationPlayer } from '@pixodesk/svg-animator-web';

const log = document.getElementById('log')!;
const say = (line: string) => { log.textContent += line + '\n'; };

const animator = createSvgAnimationPlayer({
    playUsingActionTriggers: true,
  src: '../../../../animation.json',
  container: '#box',
  onPlaybackStart:  () => say('onPlaybackStart'),   // a playback began — startPlayback()
  onPlaybackResume: () => say('onPlaybackResume'),  // the playback carried on after a freeze — resumePlayback()
  onPlaybackPause:  () => say('onPlaybackPause'),   // the playback was frozen — pausePlayback()
  onPlaybackStop:   () => say('onPlaybackStop'),    // the playback was stopped — stopPlayback()
  onFinish: () => say('onFinish'),  // natural end, or jumpToEnd()
  onDestroy: () => say('onDestroy'),  // destroyed
});

const $ = (id: string) => document.getElementById(id)!;
$('play').onclick = () => animator.playback.start();
$('pause').onclick = () => animator.playback.pause();
$('resume').onclick = () => animator.playback.resume();
$('stop').onclick = () => animator.playback.stop();
$('finish').onclick = () => animator.playback.jumpToEnd();
$('destroy').onclick = () => animator.destroy();
