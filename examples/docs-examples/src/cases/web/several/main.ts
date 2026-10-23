import { createSvgAnimationPlayersFromPage } from '@pixodesk/svg-animator-web';

createSvgAnimationPlayersFromPage();

// Calling it again is safe: only elements without an animator are picked up.
createSvgAnimationPlayersFromPage();
