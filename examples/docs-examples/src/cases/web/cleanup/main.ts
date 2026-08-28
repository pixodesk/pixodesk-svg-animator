import { createAnimator } from '@pixodesk/svg-animator-web';

const animator = createAnimator({ src: '../../../../animation.json', container: '#box' });

document.getElementById('destroy')!.onclick = () => animator.destroy();
