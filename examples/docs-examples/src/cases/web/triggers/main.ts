import { createSvgAnimationPlayer } from '@pixodesk/svg-animator-web';
import animation from '../../../fixtures/animation.json';

// The triggers are part of the document, inside `animator.timeline.actionTriggers`: lists of events
// (`playback.start`, `playback.play`, `playback.stop`, `playback.pause`; what resumes a pause is derived unless the file
// names it), read by the playback's state — `click` in `playback.start` AND `playback.pause` toggles play / pause
// (playing: the pause list wins; paused: the derived resume list). Here it is set in code so the case is
// self-contained; the editor writes exactly the same thing from its Play on / Pause on
// settings. To override a trigger per mount instead, see playback/override-web.
const doc = {
  ...animation,
  animator: {
    ...animation.animator,
    timeline: { ...animation.animator.timeline, actionTriggers: { 'playback.start': 'click', 'playback.pause': 'click' } },
  },
};

createSvgAnimationPlayer({ document: doc as any, container: '#box', playerActionTriggers: true });
