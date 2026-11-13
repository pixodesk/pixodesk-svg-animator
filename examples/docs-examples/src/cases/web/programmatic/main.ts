import { createSvgAnimationPlayer } from '@pixodesk/svg-animator-web';

const animator = createSvgAnimationPlayer({
  document: '../../../../animation.json',
  container: '#box',   // plays the way the file says; `disableActionTriggers: true` would wait for playback.start()
});

const $ = (id: string) => document.getElementById(id)!;
$('start').onclick = () => animator.playback.start();   // always from the start, in every state
$('play').onclick = () => animator.playback.play();     // start or carry on: resumes a pause, nothing while playing
$('pause').onclick = () => animator.playback.pause();
$('stop').onclick = () => animator.playback.stop();     // back to the rest pose, as the file's stop action says
$('reverse').onclick = () => { animator.playback.setSpeed(-1); animator.playback.play(); };
$('normal').onclick = () => { animator.playback.setSpeed(1); animator.playback.play(); };

// Slider: pause, then seek to the slider's time — inside the current iteration (0..getDuration()). A seek that is
// not made while playing leaves the playback paused at that frame; play() carries on from it.
// A slider over the WHOLE playback of a finite file would use setTotalTime() with getTotalDuration() as max.
const slider = $('time-slider') as HTMLInputElement;
slider.oninput = () => {
  animator.playback.pause();
  animator.playback.setCurrentTime(Number(slider.value));
  $('ms').textContent = slider.value;
};

// Exposed for the tests (and the console).
(window as any).animator = animator;
