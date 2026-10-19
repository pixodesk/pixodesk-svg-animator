import { createRoot } from 'react-dom/client';
import { SvgCssAnimator } from '@pixodesk/svg-animator-react';
import AnimationSvg from '../../../fixtures/ball-css-manual.svg?react';   // vite-plugin-svgr

createRoot(document.getElementById('root')!).render(
  <SvgCssAnimator start="click" mouseOut="pause" className="stage">
    <AnimationSvg />
  </SvgCssAnimator>
);
