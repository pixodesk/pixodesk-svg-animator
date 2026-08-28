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

// Scrubbing: pause, then seek to the slider's time.
const seek = $('seek') as HTMLInputElement;
seek.oninput = () => {
  animator.pause();
  animator.setCurrentTime(Number(seek.value));
  $('ms').textContent = seek.value;
};

// Exposed for the tests (and the console).
(window as any).animator = animator;
