import { createSvgAnimationPlayer } from '@pixodesk/svg-animator-web';

const animator = createSvgAnimationPlayer({
  document: '../../../../animation.json',
  container: '#box',   // plays the way the file says; `disableActionTriggers: true` would wait for timeline.start()
});

const $ = (id: string) => document.getElementById(id)!;
$('start').onclick = () => animator.timeline.start();   // always from the start, in every state
$('play').onclick = () => animator.timeline.play();     // start or carry on: resumes a pause, nothing while playing
$('pause').onclick = () => animator.timeline.pause();
$('stop').onclick = () => animator.timeline.stop();     // back to the rest pose, as the file's stop action says
$('reverse').onclick = () => { animator.timeline.setSpeed(-1); animator.timeline.play(); };
$('normal').onclick = () => { animator.timeline.setSpeed(1); animator.timeline.play(); };

// Slider: pause, then seek to the slider's time — inside the current iteration (0..getDuration()). A seek that is
// not made while playing leaves the playback paused at that frame; play() carries on from it.
// A slider over the WHOLE playback of a finite file would use setTotalTime() with getTotalDuration() as max.
const slider = $('time-slider') as HTMLInputElement;
slider.oninput = () => {
  animator.timeline.pause();
  animator.timeline.setCurrentTime(Number(slider.value));
  $('ms').textContent = slider.value;
};

// Exposed for the tests (and the console).
(window as any).animator = animator;
