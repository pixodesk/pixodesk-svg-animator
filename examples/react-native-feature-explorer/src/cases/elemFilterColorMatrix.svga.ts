/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const elemFilterColorMatrix: SvgaCaseJson = {
    "type": "svg",
    "fill": "none",
    "viewBox": "0 0 200 200",
    "animator": {
        "timeline": {
            "mode": "auto",
            "outTime": 1000,
            "triggers": {
                "start": "load"
            },
            "actions": {
                "suspend": {
                    "transition": "continue"
                }
            },
            "iterationDirection": "normal"
        }
    }
};
