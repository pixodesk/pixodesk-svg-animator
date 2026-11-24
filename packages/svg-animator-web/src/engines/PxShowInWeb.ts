// @px-area engine
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// SHOW IN ON THE WEB (1.31) — `effects.showIn`, core's rule (`PxShowIn.ts`) on the rendered picture: an element is hidden
// with its own inline `display: none` (no wrapper), at once; shown again by clearing it. Applied when the player binds
// and on every change of step. A pre-rendered SVG writes the start state into the markup, so nothing flashes first.

import type { PxDocument } from '@pixodesk/svg-animator-core';
import { currentFlowStepsOf, isShownIn, planUnits, showInTargetsOf } from '@pixodesk/svg-animator-core/engine';
import { getSelector } from './PxAnimatorFrameLoop';

/** What hides the element: its own inline style. */
const HIDDEN = 'none';

/** The `showIn` elements of one player. */
export interface PxShowInWeb {
    /** Shows and hides them for the steps current now. */
    update(): void;
}

/** The `showIn` elements of `doc` (the document the picture was rendered from), applied now — undefined when it has
 *  none. `current`: each running flow's current step, by flow name; a flow not in it is at its start. */
export function createShowInWeb(doc: PxDocument, root: () => Element | null, current: () => ReadonlyMap<string, string>): PxShowInWeb | undefined {
    const targets = showInTargetsOf(doc);
    if (!targets.length) return undefined;
    const all = planUnits(doc);   // every flow of the file — the page's run lists aside
    const update = (): void => {
        const r = root();
        if (!r) return;
        const steps = all ? currentFlowStepsOf(all, current()) : new Set<string>();
        for (const target of targets) {
            const shown = isShownIn(target.flowSteps, steps);
            r.querySelectorAll(getSelector(target.id)).forEach(el => {
                if (el instanceof HTMLElement || el instanceof SVGElement) el.style.display = shown ? '' : HIDDEN;
            });
        }
    };
    update();
    return { update };
}
