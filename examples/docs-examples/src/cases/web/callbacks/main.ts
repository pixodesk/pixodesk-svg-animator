import { createSvgAnimationPlayer } from '@pixodesk/svg-animator-web';

const log = document.getElementById('log')!;
const say = (line: string) => { log.textContent += line + '\n'; };

const animator = createSvgAnimationPlayer({
  document: '../../../../animation.json',   // plays the way the file says — its own trigger starts it on load
  container: '#box',
  onPlaybackStart:  () => say('onPlaybackStart'),   // a playback began — timeline.start(), or play() from rest
  onPlaybackResume: () => say('onPlaybackResume'),  // the playback carried on after a freeze — timeline.resume(), or play() while paused
  onPlaybackPause:  () => say('onPlaybackPause'),   // the playback was frozen — timeline.pause()
  onPlaybackStop:   () => say('onPlaybackStop'),    // the playback was stopped — timeline.stop()
  onPlaybackFinish: () => say('onPlaybackFinish'),  // the last pass ended by playing — never for a stop
  onDestroy: () => say('onDestroy'),  // destroyed
});

const $ = (id: string) => document.getElementById(id)!;
$('play').onclick = () => animator.timeline.start();
$('pause').onclick = () => animator.timeline.pause();
$('resume').onclick = () => animator.timeline.resume();
$('stop').onclick = () => animator.timeline.stop();
// The file plays 2 iterations: 1.9 is 90 % into the last one. A seek while playing keeps playing (otherwise it
// leaves the playback paused there, and play() carries on), so the playback reaches its end and finishes.
$('finish').onclick = () => { animator.timeline.setCurrentProgress(1.9); animator.timeline.play(); };
$('destroy').onclick = () => animator.destroy();
