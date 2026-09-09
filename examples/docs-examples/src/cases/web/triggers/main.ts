import { createAnimator } from '@pixodesk/svg-animator-web';
import animation from '../../../fixtures/animation.json';

// A trigger is part of the document, inside `animator.timeline`. Here it is set in
// code so the case is self-contained; the editor writes exactly the same thing from
// its Start setting. To override a trigger per mount instead, see playback/override-web.
const doc = {
  ...animation,
  animator: {
    ...animation.animator,
    timeline: { ...animation.animator.timeline, trigger: { startOn: 'click', outAction: 'pause' } },
  },
};

createAnimator({ data: doc as any, container: '#box' });
