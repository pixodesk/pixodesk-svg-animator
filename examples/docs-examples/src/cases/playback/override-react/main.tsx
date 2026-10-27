import { createRoot } from 'react-dom/client';
import { SvgAnimationPlayer } from '@pixodesk/svg-animator-react';
import animation from '../../../fixtures/animation.json';

// One object, spelled like the file's own `timeline` block and merged over it key by key —
// corrections, never a replacement. `playOnTrigger` keeps the file's own trigger.
createRoot(document.getElementById('root')!).render(
  <div className="stage">
    <SvgAnimationPlayer
      doc={animation as any}
      playOnTrigger
      timeline={{ iterations: 'infinite', engine: 'js', iterationDirection: 'alternate' }}
    />
  </div>
);
