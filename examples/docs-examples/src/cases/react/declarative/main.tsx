import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { SvgAnimationPlayer } from '@pixodesk/svg-animator-react';
import animation from '../../../fixtures/animation.json';

function App() {
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  return (
    <>
      <div className="controls">
        <button id="play" onClick={() => setPlaying(p => !p)}>play = {String(playing)}</button>
        <button id="pause" onClick={() => setPaused(p => !p)}>pause = {String(paused)}</button>
      </div>
      <div className="stage">
        {/* two LEVELS: plays while `play` holds, frozen while `pause` holds — or one word: playState={paused ? 'paused' : playing ? 'playing' : 'idle'} */}
        <SvgAnimationPlayer doc={animation as any} play={playing} pause={paused} />
      </div>
    </>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
