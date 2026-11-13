import { createRoot } from 'react-dom/client';
import { useRef } from 'react';
import { SvgAnimationPlayer, type PxAnimationPlayerHandle } from '@pixodesk/svg-animator-react';
import animation from '../../../fixtures/animation.json';

function App() {
  const api = useRef<PxAnimationPlayerHandle | null>(null);
  return (
    <>
      <div className="controls">
        <button onClick={() => api.current?.playback.start()}>playback.start()</button>
        <button onClick={() => api.current?.playback.pause()}>playback.pause()</button>
        <button onClick={() => api.current?.playback.play()}>playback.play()</button>
        <button onClick={() => api.current?.playback.stop()}>playback.stop()</button>
        <button onClick={() => api.current?.playback.setCurrentProgress(1)}>playback.setCurrentProgress(1)</button>
      </div>
      <div className="stage">
        <SvgAnimationPlayer document={animation as any} playerRef={api} />
      </div>
    </>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
