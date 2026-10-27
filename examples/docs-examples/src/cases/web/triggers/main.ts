import { createSvgAnimationPlayer } from '@pixodesk/svg-animator-web';
import animation from '../../../fixtures/animation.json';

// A trigger is part of the document, inside `animator.timeline`: four lists of events
// (`playOn`, `playOff`, `pauseOn`, `pauseOff`), read by the player's state — `click` in
// `playOn` AND `pauseOn` toggles play / pause. Here it is set in code so the case is
// self-contained; the editor writes exactly the same thing from its Plays on / Pauses on
// settings. To override a trigger per mount instead, see playback/override-web.
const doc = {
  ...animation,
  animator: {
    ...animation.animator,
    timeline: { ...animation.animator.timeline, trigger: { playOn: 'click', pauseOn: 'click' } },
  },
};

createSvgAnimationPlayer({ doc: doc as any, container: '#box', playOnTrigger: true });
