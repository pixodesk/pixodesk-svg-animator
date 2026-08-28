import { createRoot } from 'react-dom/client';
import { useRef } from 'react';
import { PixodeskSvgAnimator, type ReactAnimatorApi } from '@pixodesk/svg-animator-react';
import animation from '../../../fixtures/animation.json';

function App() {
  const api = useRef<ReactAnimatorApi | null>(null);
  return (
    <>
      <div className="controls">
        <button onClick={() => api.current?.play()}>play()</button>
        <button onClick={() => api.current?.pause()}>pause()</button>
        <button onClick={() => api.current?.cancel()}>cancel()</button>
        <button onClick={() => api.current?.finish()}>finish()</button>
      </div>
      <div className="stage">
        <PixodeskSvgAnimator doc={animation as any} apiRef={api} />
      </div>
    </>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
