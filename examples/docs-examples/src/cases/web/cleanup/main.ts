import { createSvgAnimationPlayer } from '@pixodesk/svg-animator-web';

const animator = createSvgAnimationPlayer({ src: '../../../../animation.json', container: '#box', playAsSaved: true });

document.getElementById('destroy')!.onclick = () => animator.destroy();
