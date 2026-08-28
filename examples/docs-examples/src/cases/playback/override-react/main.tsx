import { createRoot } from 'react-dom/client';
import { PixodeskSvgAnimator } from '@pixodesk/svg-animator-react';
import animation from '../../../fixtures/animation.json';

createRoot(document.getElementById('root')!).render(
  <div className="stage">
    <PixodeskSvgAnimator doc={animation as any} autoplay
                         iterations="infinite" direction="alternate" mode="frames" />
  </div>
);
