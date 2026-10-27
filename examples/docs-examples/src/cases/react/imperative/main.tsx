import { createRoot } from 'react-dom/client';
import { useRef } from 'react';
import { SvgAnimationPlayer, type PxAnimationPlayerHandle } from '@pixodesk/svg-animator-react';
import animation from '../../../fixtures/animation.json';

function App() {
  const api = useRef<PxAnimationPlayerHandle | null>(null);
  return (
    <>
      <div className="controls">
        <button onClick={() => api.current?.play()}>play()</button>
        <button onClick={() => api.current?.pause()}>pause()</button>
        <button onClick={() => api.current?.cancel()}>cancel()</button>
        <button onClick={() => api.current?.finish()}>finish()</button>
      </div>
      <div className="stage">
        <SvgAnimationPlayer doc={animation as any} playerRef={api} />
      </div>
    </>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
