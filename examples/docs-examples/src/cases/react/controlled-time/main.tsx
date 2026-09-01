import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { PixodeskSvgAnimator } from '@pixodesk/svg-animator-react';
import animation from '../../../fixtures/animation.json';

function App() {
  const [time, setTime] = useState(0);
  return (
    <>
      <div className="controls">
        <label>
          time <input id="time-slider" type="range" min={0} max={2000} value={time}
                        onChange={e => setTime(Number(e.target.value))} />
          <span id="ms">{time}</span> ms
        </label>
      </div>
      <div className="stage">
        <PixodeskSvgAnimator doc={animation as any} time={time} />
      </div>
    </>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
