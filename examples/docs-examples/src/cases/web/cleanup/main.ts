import { createSvgAnimationPlayer } from '@pixodesk/svg-animator-web';

const animator = createSvgAnimationPlayer({ document: '../../../../animation.json', container: '#box', playerActionTriggers: true });

document.getElementById('destroy')!.onclick = () => animator.destroy();
