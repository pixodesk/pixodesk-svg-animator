import { createSvgAnimator } from '@pixodesk/svg-animator-web';

const animator = createSvgAnimator({ src: '../../../../animation.json', container: '#box', playAsSaved: true });

document.getElementById('destroy')!.onclick = () => animator.destroy();
