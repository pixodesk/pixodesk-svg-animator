import { createSvgAnimationPlayersFromPage } from '@pixodesk/svg-animator-web';

// Every element with data-px-document gets its own animator. The document's
// own trigger applies — this one starts on load.
createSvgAnimationPlayersFromPage();
