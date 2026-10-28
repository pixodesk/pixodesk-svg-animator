import { createSvgAnimationPlayer } from '@pixodesk/svg-animator-web';
import animation from '../../../fixtures/animation.json';

// The triggers are part of the document, inside `animator.timeline.triggers`: lists of events
// (`start`, `stop`, `pause`, `resume`, `togglePlay`, `togglePause`), read by the player's state — `click` in
// `start` AND `pause` toggles play / pause. Here it is set in code so the case is
// self-contained; the editor writes exactly the same thing from its Plays on / Pauses on
// settings. To override a trigger per mount instead, see playback/override-web.
const doc = {
  ...animation,
  animator: {
    ...animation.animator,
    timeline: { ...animation.animator.timeline, triggers: { start: 'click', pause: 'click' } },
  },
};

createSvgAnimationPlayer({ doc: doc as any, container: '#box', playOnTrigger: true });
