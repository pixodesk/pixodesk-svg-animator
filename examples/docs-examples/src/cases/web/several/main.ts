import { loadTagSvgAnimators } from '@pixodesk/svg-animator-web';

loadTagSvgAnimators();

// Calling it again is safe: only elements without an animator are picked up.
loadTagSvgAnimators();
