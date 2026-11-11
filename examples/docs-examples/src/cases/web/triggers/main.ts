import { createSvgAnimationPlayer } from '@pixodesk/svg-animator-web';
import animation from '../../../fixtures/animation.json';

// The triggers are part of the document, inside `animator.timeline.actionTriggers`: lists of events
// (`startRun`, `stopRun`, `pauseRun`; what resumes a pause is derived unless the file names it), read by the run's state — `click` in
// `startRun` AND `pauseRun` toggles play / pause. Here it is set in code so the case is
// self-contained; the editor writes exactly the same thing from its Play on / Pause on
// settings. To override a trigger per mount instead, see playback/override-web.
const doc = {
  ...animation,
  animator: {
    ...animation.animator,
    timeline: { ...animation.animator.timeline, actionTriggers: { startRun: 'click', pauseRun: 'click' } },
  },
};

createSvgAnimationPlayer({ doc: doc as any, container: '#box', playUsingActionTriggers: true });
