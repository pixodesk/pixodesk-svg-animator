import { loadTagAnimators } from '@pixodesk/svg-animator-web';

// Every element with data-px-animation-src gets its own animator. The document's
// own trigger applies — this one starts on load.
loadTagAnimators();
