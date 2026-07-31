/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import type { SvgaCaseJson } from '../caseTypes';

export const effectRepeaterRadial: SvgaCaseJson = {
    "type": "svg",
    "fill": "none",
    "viewBox": "0 0 200 200",
    "animator": {
        "duration": 1000,
        "mode": "auto",
        "direction": "normal",
        "timeline": "time",
        "trigger": {
            "startOn": "load",
            "outAction": "pause"
        }
    },
    "children": [
        {
            "type": "ellipse",
            "fill": "#4d99e6",
            "rx": 6,
            "ry": 14,
            "stroke": "none",
            "transform": "translate(100,50)",
            "effects": {
                "repeater": {
                    "copies": 8,
                    "origin": [
                        0,
                        50
                    ],
                    "rotate": 45
                }
            }
        }
    ]
};
