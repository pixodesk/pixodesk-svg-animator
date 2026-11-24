// @px-area engine
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// SHOW ONE OF ON THE WEB (1.32) — `effects.showOneOf`, core's rule (`shownOptionOf`) on the rendered picture: of a group's
// children one is shown, the others hidden by the shared hider (`PxHideWeb.ts` — the same way as `showIn`). `which` is a
// number in the full player's document (its variables are written in before rendering; a change rebuilds the player); in
// a pre-rendered binding it may be binding text, read from the player's variables — `update()` again on a change.

import type { PxDocument } from '@pixodesk/svg-animator-core';
import { isBindingText } from '@pixodesk/svg-animator-core';
import { PxVariableBinding, showOneOfTargetsOf, shownOptionOf } from '@pixodesk/svg-animator-core/engine';
import type { PxVariableValue } from '@pixodesk/svg-animator-core';
import { getSelector } from './PxAnimatorFrameLoop';
import { PxHideReason, type PxHider } from './PxHideWeb';

/** The groups of one player that show one of their children. */
export interface PxShowOneOfWeb {
    update(): void;
}

/** `which` as a number: as written, or read through the variables when it is binding text. */
function whichOf(which: number | string | undefined, read: ((name: string) => PxVariableValue | undefined) | undefined): number | undefined {
    if (typeof which === 'number') return which;
    if (!isBindingText(which) || !read) return undefined;
    const value = PxVariableBinding.parse(which).binding?.evaluate(read);
    return typeof value === 'number' ? value : undefined;
}

/** The `showOneOf` groups of `doc` (the document the picture was rendered from), applied now — undefined when it has none. */
export function createShowOneOfWeb(doc: PxDocument, root: () => Element | null, hider: PxHider,
    read?: (name: string) => PxVariableValue | undefined): PxShowOneOfWeb | undefined {
    const targets = showOneOfTargetsOf(doc);
    if (!targets.length) return undefined;
    const update = (): void => {
        const r = root();
        if (!r) return;
        for (const target of targets) {
            // the options: as listed, or the group's children as rendered (a pre-rendered binding that lists none)
            const options: Array<Array<Element>> = target.options
                ? target.options.map(id => Array.from(r.querySelectorAll(getSelector(id))))
                : Array.from(target.group ? r.querySelector(getSelector(target.group))?.children ?? [] : []).map(el => [el]);
            const shown = shownOptionOf(whichOf(target.which, read), options.length);
            options.forEach((els, i) => els.forEach(el => hider.set(el, PxHideReason.showOneOf, i !== shown)));
        }
    };
    update();
    return { update };
}
