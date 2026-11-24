// @px-area engine
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// HIDING ON THE WEB — the ONE way `showIn` (1.31) and `showOneOf` (1.32) hide an element: its own inline `display: none`,
// no wrapper. An element hidden for either reason is hidden. Change the way here and both follow (they must stay in sync).
// One hider per player — it remembers why each element is hidden.

/** Why an element is hidden. */
export enum PxHideReason {
    showIn = 'showIn',
    showOneOf = 'showOneOf',
}

/** What hides the element: its own inline style. */
const HIDDEN = 'none';

/** One player's hider. */
export interface PxHider {
    /** Hides `el` for `reason` (or stops hiding it for that reason). */
    set(el: Element, reason: PxHideReason, hidden: boolean): void;
}

export function createHider(): PxHider {
    const reasons = new Map<Element, Set<PxHideReason>>();
    return {
        set: (el, reason, hidden) => {
            if (!(el instanceof HTMLElement || el instanceof SVGElement)) return;
            const mine = reasons.get(el) ?? new Set<PxHideReason>();
            if (hidden) mine.add(reason); else mine.delete(reason);
            if (mine.size) reasons.set(el, mine); else reasons.delete(el);
            el.style.display = mine.size ? HIDDEN : '';
        },
    };
}
