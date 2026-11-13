import { createSvgAnimationPlayer } from '@pixodesk/svg-animator-web';

const log = document.getElementById('log')!;
const say = (line: string) => { log.textContent += line + '\n'; };

const animator = createSvgAnimationPlayer({
  document: '../../../../animation.json',   // plays the way the file says — its own trigger starts it on load
  container: '#box',
  onPlaybackStart:  () => say('onPlaybackStart'),   // a playback began — playback.start(), or play() from rest
  onPlaybackResume: () => say('onPlaybackResume'),  // the playback carried on after a freeze — playback.resume(), or play() while paused
  onPlaybackPause:  () => say('onPlaybackPause'),   // the playback was frozen — playback.pause()
  onPlaybackStop:   () => say('onPlaybackStop'),    // the playback was stopped — playback.stop()
  onPlaybackFinish: () => say('onPlaybackFinish'),  // the last pass ended by playing — never for a stop
  onDestroy: () => say('onDestroy'),  // destroyed
});

const $ = (id: string) => document.getElementById(id)!;
$('play').onclick = () => animator.playback.start();
$('pause').onclick = () => animator.playback.pause();
$('resume').onclick = () => animator.playback.resume();
$('stop').onclick = () => animator.playback.stop();
// The file plays 2 iterations: 1.9 is 90 % into the last one. A seek while playing keeps playing (otherwise it
// leaves the playback paused there, and play() carries on), so the playback reaches its end and finishes.
$('finish').onclick = () => { animator.playback.setCurrentProgress(1.9); animator.playback.play(); };
$('destroy').onclick = () => animator.destroy();
