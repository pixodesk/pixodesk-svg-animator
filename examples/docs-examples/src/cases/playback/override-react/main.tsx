import { createRoot } from 'react-dom/client';
import { PixodeskSvgAnimator } from '@pixodesk/svg-animator-react';
import animation from '../../../fixtures/animation.json';

// One object, spelled like the file's own `animator` block. `iterations` has a flat
// shortcut because it is one of the four people reach for most; everything else goes
// inside `config`.
createRoot(document.getElementById('root')!).render(
  <div className="stage">
    <PixodeskSvgAnimator
      doc={animation as any}
      autoplay
      iterations="infinite"
      config={{ timeline: { mode: 'player', direction: 'alternate' } }}
    />
  </div>
);
