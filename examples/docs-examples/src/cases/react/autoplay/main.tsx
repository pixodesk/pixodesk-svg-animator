import { createRoot } from 'react-dom/client';
import { SvgAnimator } from '@pixodesk/svg-animator-react';
import animation from '../../../fixtures/animation.json';

createRoot(document.getElementById('root')!).render(
  <div className="stage">
    <SvgAnimator doc={animation as any} autoplay />
  </div>
);
