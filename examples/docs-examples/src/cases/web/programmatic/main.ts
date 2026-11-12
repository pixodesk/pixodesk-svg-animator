import { createSvgAnimationPlayer } from '@pixodesk/svg-animator-web';

const animator = createSvgAnimationPlayer({
  src: '../../../../animation.json',
  container: '#box',
  playUsingActionTriggers: true,   // play the way the file says; without it, nothing starts until startPlayback()
});

const $ = (id: string) => document.getElementById(id)!;
$('play').onclick = () => animator.playback.start();
$('pause').onclick = () => animator.playback.pause();
$('jumpToStart').onclick = () => animator.playback.jumpToStart();
$('finish').onclick = () => animator.playback.jumpToEnd();
$('reverse').onclick = () => { animator.playback.setSpeed(-1); animator.playback.start(); };   // start(): from rest it plays, while paused it unfreezes (`continue`)
$('normal').onclick = () => { animator.playback.setSpeed(1); animator.playback.start(); };

// Slider: pause, then jump to the slider's time — inside the current iteration (0..getDuration()).
// A slider over the WHOLE playback of a finite file would use setTotalTime() with getTotalDuration() as max.
const slider = $('time-slider') as HTMLInputElement;
slider.oninput = () => {
  animator.playback.pause();
  animator.playback.setCurrentTime(Number(slider.value));
  $('ms').textContent = slider.value;
};

// Exposed for the tests (and the console).
(window as any).animator = animator;
