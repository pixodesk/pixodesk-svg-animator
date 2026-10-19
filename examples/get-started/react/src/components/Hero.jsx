import { SvgAnimator } from '@pixodesk/svg-animator-react';
import animation from './animation.json';

export function Hero() {
  return (
    <div style={{ width: 300, height: 300 }}>
      <SvgAnimator doc={animation} playAsSaved />
    </div>
  );
}
