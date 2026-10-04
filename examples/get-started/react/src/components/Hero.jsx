import { PixodeskSvgAnimator } from '@pixodesk/svg-animator-react';
import animation from './animation.json';

export function Hero() {
  return (
    <div style={{ width: 300, height: 300 }}>
      <PixodeskSvgAnimator doc={animation} autoplay />
    </div>
  );
}
