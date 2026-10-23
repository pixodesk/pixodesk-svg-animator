import { createSvgAnimationPlayer } from '@pixodesk/svg-animator-web';
import animation from './animation.json';

createSvgAnimationPlayer({ doc: animation, container: '#hero', playOnTrigger: true });
