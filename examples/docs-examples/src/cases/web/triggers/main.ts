import { createSvgAnimationPlayer } from '@pixodesk/svg-animator-web';
import animation from '../../../fixtures/animation.json';

// The triggers are part of the document, in `animator.actions`: a list of rules `{ action, event }`
// (`timeline.start`, `timeline.play`, `timeline.stop`, `timeline.pause`; what resumes a pause is derived unless the file
// names it), read by the playback's state — `click` for `timeline.start` AND `timeline.pause` toggles play / pause
// (playing: the pause rule wins; paused: the derived resume). Here it is set in code so the case is
// self-contained; the editor writes exactly the same thing from its Play on / Pause on
// settings. To override a trigger per mount instead, see playback/override-web.
const doc = {
  ...animation,
  animator: {
    ...animation.animator,
    actions: [{ action: 'timeline.start', event: 'click' }, { action: 'timeline.pause', event: 'click' }],
  },
};

createSvgAnimationPlayer({ document: doc as any, container: '#box' });   // the document's own triggers drive it
