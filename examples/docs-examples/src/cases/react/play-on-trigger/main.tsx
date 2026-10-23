import { createRoot } from 'react-dom/client';
import { SvgAnimationPlayer } from '@pixodesk/svg-animator-react';
import animation from '../../../fixtures/animation.json';

createRoot(document.getElementById('root')!).render(
  <div className="stage">
    <SvgAnimationPlayer doc={animation as any} playOnTrigger />
  </div>
);
