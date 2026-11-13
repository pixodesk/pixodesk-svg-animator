import { createRoot } from 'react-dom/client';
import { SvgCssAnimationPlayer } from '@pixodesk/svg-animator-react';
import AnimationSvg from '../../../fixtures/ball-css-manual.svg?react';   // vite-plugin-svgr

createRoot(document.getElementById('root')!).render(
  <SvgCssAnimationPlayer playerActionTriggers={{ 'playback.start': 'click', 'playback.pause': 'click' }} className="stage">
    <AnimationSvg />
  </SvgCssAnimationPlayer>
);
