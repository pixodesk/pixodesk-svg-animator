import { createSvgAnimator } from '@pixodesk/svg-animator-web';
import animation from './animation.json';

createSvgAnimator({ doc: animation, container: '#hero', playAsSaved: true });
