import { createSvgAnimationPlayer } from '@pixodesk/svg-animator-web';

const animator = createSvgAnimationPlayer({ src: '../../../../animation.json', container: '#box', playUsingActionTriggers: true });

document.getElementById('destroy')!.onclick = () => animator.destroy();
