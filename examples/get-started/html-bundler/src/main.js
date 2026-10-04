import { createAnimator } from '@pixodesk/svg-animator-web';
import animation from './animation.json';

createAnimator({ doc: animation, container: '#hero' });
