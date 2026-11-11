import { createSvgAnimationPlayer } from '@pixodesk/svg-animator-web';

const animator = createSvgAnimationPlayer({
  src: '../../../../animation.json',
  container: '#box',
  playUsingActionTriggers: true,   // play the way the file says; without it, nothing starts until startRun()
});

const $ = (id: string) => document.getElementById(id)!;
$('play').onclick = () => animator.startRun();
$('pause').onclick = () => animator.pauseRun();
$('jumpToStart').onclick = () => animator.jumpToStart();
$('finish').onclick = () => animator.jumpToEnd();
$('reverse').onclick = () => { animator.setPlaybackSpeed(-1); animator.play(); };   // play(): paused → resumeRun(), else startRun()
$('normal').onclick = () => { animator.setPlaybackSpeed(1); animator.play(); };

// Slider: pause, then jump to the slider's time — inside the current iteration (0..getDuration()).
// A slider over the WHOLE run of a finite file would use setTotalTime() with getTotalDuration() as max.
const slider = $('time-slider') as HTMLInputElement;
slider.oninput = () => {
  animator.pauseRun();
  animator.setCurrentTime(Number(slider.value));
  $('ms').textContent = slider.value;
};

// Exposed for the tests (and the console).
(window as any).animator = animator;
