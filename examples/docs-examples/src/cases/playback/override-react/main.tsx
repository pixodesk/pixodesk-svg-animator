import { createRoot } from 'react-dom/client';
import { SvgAnimationPlayer } from '@pixodesk/svg-animator-react';
import animation from '../../../fixtures/animation.json';

// One object, spelled like the file's own `animator` block. `iterations` has a flat
// shortcut because it is one of the four people reach for most; everything else goes
// inside `timeline`.
createRoot(document.getElementById('root')!).render(
  <div className="stage">
    <SvgAnimationPlayer
      doc={animation as any}
      playAsSaved
      iterations="infinite"
      timeline={{ engine: 'js', direction: 'alternate' }}
    />
  </div>
);
