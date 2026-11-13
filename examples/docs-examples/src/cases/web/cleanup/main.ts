import { createSvgAnimationPlayer } from '@pixodesk/svg-animator-web';

const animator = createSvgAnimationPlayer({ document: '../../../../animation.json', container: '#box' });

document.getElementById('destroy')!.onclick = () => animator.destroy();
