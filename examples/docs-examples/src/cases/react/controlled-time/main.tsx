import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { PixodeskSvgAnimator } from '@pixodesk/svg-animator-react';
import animation from '../../../fixtures/animation.json';

function App() {
  const [timeMs, setTimeMs] = useState(0);
  return (
    <>
      <div className="controls">
        <label>
          timeMs <input id="time-slider" type="range" min={0} max={2000} value={timeMs}
                        onChange={e => setTimeMs(Number(e.target.value))} />
          <span id="ms">{timeMs}</span> ms
        </label>
      </div>
      <div className="stage">
        <PixodeskSvgAnimator doc={animation as any} timeMs={timeMs} />
      </div>
    </>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
