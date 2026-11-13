import { createRoot } from 'react-dom/client';
import { SvgAnimationPlayer } from '@pixodesk/svg-animator-react';
import animation from '../../../fixtures/animation.json';

createRoot(document.getElementById('root')!).render(
  <div className="stage">
    {/* no control prop: the document's own trigger plays it — here, start on load */}
    <SvgAnimationPlayer document={animation as any} />
  </div>
);
