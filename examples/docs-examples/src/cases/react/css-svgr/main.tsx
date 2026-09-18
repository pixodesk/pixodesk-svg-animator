import { createRoot } from 'react-dom/client';
import { PixodeskSvgCssAnimator } from '@pixodesk/svg-animator-react';
import AnimationSvg from '../../../fixtures/ball-css-manual.svg?react';   // vite-plugin-svgr

createRoot(document.getElementById('root')!).render(
  <PixodeskSvgCssAnimator start="click" mouseOut="pause" className="stage">
    <AnimationSvg />
  </PixodeskSvgCssAnimator>
);
