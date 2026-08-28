import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { PixodeskSvgAnimator } from '@pixodesk/svg-animator-react';
import animation from '../../../fixtures/animation.json';

function App() {
  const [play, setPlay] = useState(false);
  const [pause, setPause] = useState(false);
  return (
    <>
      <div className="controls">
        <button id="play" onClick={() => setPlay(p => !p)}>play = {String(play)}</button>
        <button id="pause" onClick={() => setPause(p => !p)}>pause = {String(pause)}</button>
      </div>
      <div className="stage">
        <PixodeskSvgAnimator doc={animation as any} play={play} pause={pause} />
      </div>
    </>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
