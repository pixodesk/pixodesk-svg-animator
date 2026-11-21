import { createRoot } from 'react-dom/client';
import { SvgCssAnimationPlayer } from '@pixodesk/svg-animator-react';
import AnimationSvg from '../../../fixtures/ball-css-manual.svg?react';   // vite-plugin-svgr

createRoot(document.getElementById('root')!).render(
  <SvgCssAnimationPlayer actionTriggers={[{ action: 'timeline.start', event: 'click' }, { action: 'timeline.pause', event: 'click' }]} className="stage">
    <AnimationSvg />
  </SvgCssAnimationPlayer>
);
