import { createSvgAnimatorsFromPage } from '@pixodesk/svg-animator-web';

createSvgAnimatorsFromPage();

// Calling it again is safe: only elements without an animator are picked up.
createSvgAnimatorsFromPage();
