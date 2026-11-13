import { createSvgAnimationPlayer } from '@pixodesk/svg-animator-web';
import animation from './animation.json';

createSvgAnimationPlayer({ document: animation, container: '#hero' });
