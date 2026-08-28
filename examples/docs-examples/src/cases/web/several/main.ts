import { loadTagAnimators } from '@pixodesk/svg-animator-web';

loadTagAnimators();

// Calling it again is safe: only elements without an animator are picked up.
loadTagAnimators();
