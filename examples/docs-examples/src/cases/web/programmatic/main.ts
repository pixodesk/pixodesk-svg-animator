import { createAnimator } from '@pixodesk/svg-animator-web';

const animator = createAnimator({
  src: '../../../../animation.json',
  container: '#box',
});

const $ = (id: string) => document.getElementById(id)!;
$('play').onclick = () => animator.play();
$('pause').onclick = () => animator.pause();
$('cancel').onclick = () => animator.cancel();
$('finish').onclick = () => animator.finish();
$('reverse').onclick = () => { animator.setPlaybackRate(-1); animator.play(); };
$('normal').onclick = () => { animator.setPlaybackRate(1); animator.play(); };

// Slider: pause, then jump to the slider's time.
const slider = $('time-slider') as HTMLInputElement;
slider.oninput = () => {
  animator.pause();
  animator.setCurrentTime(Number(slider.value));
  $('ms').textContent = slider.value;
};

// Exposed for the tests (and the console).
(window as any).animator = animator;
