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
        {/* ONE lever: `playback` holds a position — 'off' · 'on' · 'paused'; each change presses one button */}
        <SvgAnimationPlayer doc={animation as any} playback={paused ? 'paused' : playing ? 'on' : 'off'} />
      </div>
    </>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
